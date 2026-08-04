/**
 * aiLqsService — DYNAMIC AI-assisted Listing Quality Scoring for the Live Data Inspector.
 *
 * Design (vs the old hardcoded prompt):
 *  1. PROMPT-BUILDER is DATA-DRIVEN: criteria come from `lqsCriteria` config
 *     (per-category overrides + marketplace wording), NOT hardcoded prose.
 *  2. Analyzes whatever fields the API actually returned (title/bullets/images/
 *     description/pricing) — only present fields are scored.
 *  3. Two engines: TEXT (NIM chat) + VISION (NVIDIA image) — each optional,
 *     each degrades gracefully; partial results are merged.
 *  4. Deterministic JSON contract { overall_score, grade, fields, summary }.
 *
 * Every failure degrades gracefully: returns null if both engines fail;
 * partial result otherwise. Never throws.
 */
const nimService = require('./nimService');
const nvidiaAiService = require('./nvidiaAiService');
const { LQS_CRITERIA, MARKETPLACE_WORDING, criteriaFor, getCategory, getMarketplace } = require('./lqsCriteria');

const CONFIG = {
  enabled: process.env.LIVE_SYNC_AI_ENABLED !== 'false',
  concurrency: Math.max(1, parseInt(process.env.LIVE_SYNC_AI_CONCURRENCY || '2', 10)),
  textTimeoutMs: Math.max(5000, parseInt(process.env.LIVE_SYNC_AI_TIMEOUT_MS || '25000', 10)),
  visionTimeoutMs: Math.max(5000, parseInt(process.env.LIVE_SYNC_AI_VISION_TIMEOUT_MS || '40000', 10)),
};

// ── Tiny promise semaphore (bounds total in-flight AI work) ────────────
class Semaphore {
  constructor(n) { this.n = n; this.active = 0; this.waiters = []; }
  async acquire() {
    if (this.active < this.n) { this.active++; return; }
    await new Promise((resolve) => this.waiters.push(resolve));
    this.active++;
  }
  release() {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }
  async run(fn) {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }
}
const sem = new Semaphore(CONFIG.concurrency);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms)),
  ]);
}

// ── Data extraction (mirrors the controller; kept small & local) ───────
function getTitle(item) { return item.itemInfo?.title?.displayValue || item.productName || item.Title || ''; }
function getBullets(item) { return item.itemInfo?.features?.displayValues || item.bulletPointsText || []; }
function getDescription(item) { return item.itemInfo?.contentInfo?.description || item.ProductDescription || item.description || ''; }
function getImages(item) {
  const img = item.images || {};
  const urls = [];
  const pick = (o) => o?.url || null;
  const primary = pick(img.primary?.highRes) || pick(img.primary?.large) || pick(img.primary?.medium) || pick(img.primary?.small) || item.ImageUrl || null;
  if (primary) urls.push(primary);
  for (const v of (img.variants || [])) {
    const u = pick(v.highRes) || pick(v.large) || pick(v.medium) || pick(v.small);
    if (u && !urls.includes(u)) urls.push(u);
  }
  return urls;
}
function getPrice(item) {
  const l = item.offersV2?.listings?.[0];
  return l?.price?.money?.amount || item.CurrentPrice || item.price || null;
}

function buildCriteriaBlock(item) {
  const c = criteriaFor(item);
  return JSON.stringify({
    ...c,
    weight: undefined,
    amazonInCompliance: c.amazonInCompliance,
  }, null, 2);
}

function getPresentMetrics(item) {
  const metrics = [];
  if (getTitle(item)) metrics.push('title');
  if (Array.isArray(getBullets(item)) && getBullets(item).length) metrics.push('bullets');
  if (getDescription(item)) metrics.push('description');
  if (getImages(item).length) metrics.push('images');
  return metrics;
}

function buildSystemPrompt(item) {
  const market = getMarketplace(item);
  const wording = MARKETPLACE_WORDING[market] || MARKETPLACE_WORDING['www.amazon.in'];
  const criteria = criteriaFor(item);
  const presentMetrics = getPresentMetrics(item);
  const metricList = presentMetrics.length ? presentMetrics.join(', ') : 'title, bullets, images, description';

  return `You are a strict Amazon listing quality auditor for ${market}. Follow Amazon Seller Central policy and Amazon.in marketplace expectations. Use ONLY the data supplied in the payload and the rules below.

Responsibilities:
- Score every applicable metric independently and evidence-based.
- If a required field is missing or empty, score it 0 and explicitly note that the data was missing from the API.
- Use ${wording.currency} as the pricing context and ${wording.locale} as the locale context.
- Be conservative with compliance: penalize promotional language, policy violations, missing product context, and weak imagery.
- For each metric, provide specific issues and actionable recommendations.

Applicable metrics from API payload: ${metricList}
Category-specific guidance: ${criteria.amazonInCompliance ? Object.keys(criteria.amazonInCompliance).join(', ') : 'standard listing quality'}
`;
}

function buildMetricInstructions(item) {
  const criteria = criteriaFor(item);
  const lines = [];
  const metricNames = ['title', 'bullets', 'images', 'description'];

  metricNames.forEach((metric) => {
    const rules = criteria.amazonInCompliance?.[metric] || [];
    if (metric === 'title') {
      lines.push(`TITLE metric:\n- Check title length against the target band of ${criteria.title.idealMin}-${criteria.title.idealMax} chars.\n- Score below 60 as weak, 60-149 as acceptable, 150-200 as strong, and above ${criteria.title.maxChars} as non-compliant.\n- Apply the compliance rules below: ${rules.join(' ')}\n- If the title is missing or too short, mention that data is missing or insufficient.`);
    }
    if (metric === 'bullets') {
      lines.push(`BULLETS metric:\n- Check bullet count against the target range of ${criteria.bullets.min}-${criteria.bullets.ideal} bullets, with ${criteria.bullets.ideal} as ideal.\n- Prefer concise, benefit-led bullets of roughly ${criteria.bullets.idealChar[0]}-${criteria.bullets.idealChar[1]} characters each.\n- Apply the compliance rules below: ${rules.join(' ')}\n- If bullets are absent, score them 0 and call out missing data.`);
    }
    if (metric === 'images') {
      lines.push(`IMAGES metric:\n- Check image count against the target minimum of ${criteria.images.min} and the ideal of ${criteria.images.ideal}.\n- Penalize weak or non-compliant imagery, especially missing white background, poor resolution, or cluttered composition.\n- Apply the compliance rules below: ${rules.join(' ')}\n- If images are absent, score them 0 and call out missing data.`);
    }
    if (metric === 'description') {
      lines.push(`DESCRIPTION metric:\n- Check whether the description is informative, readable, and useful for Amazon.in shoppers.\n- Penalize vague content, unsupported claims, or missing product context.\n- Apply the compliance rules below: ${rules.join(' ')}\n- If description is absent, score it 0 and call out missing data.`);
    }
  });

  return lines.join('\n\n');
}

function buildTextPrompt(item) {
  const title = getTitle(item);
  const bullets = getBullets(item);
  const images = getImages(item);
  const desc = getDescription(item);
  const brand = item.itemInfo?.byLineInfo?.brand?.displayValue || '';
  const market = getMarketplace(item);
  const wording = MARKETPLACE_WORDING[market] || MARKETPLACE_WORDING['www.amazon.in'];
  const presentMetrics = getPresentMetrics(item);

  return `${buildSystemPrompt(item)}

CRITERIA (JSON):
${buildCriteriaBlock(item)}

METRIC INSTRUCTIONS:
${buildMetricInstructions(item)}

PRODUCT DATA:
ASIN: ${item.asin || item.AsinCode || 'N/A'}
Brand: ${brand || 'Unknown'}
Category: ${getCategory(item) || 'Unknown'}
Marketplace: ${market} (${wording.currency})
Rating: ${item.customerReviews?.starRating ?? 'N/A'}/5
Reviews: ${item.customerReviews?.count ?? 'N/A'}
Price: ${getPrice(item) ?? 'N/A'}
Title (${title.length} chars): "${title || 'MISSING'}"
Bullet points (${bullets.length}):${bullets.length ? '\n' + bullets.map((b, i) => `${i + 1}. ${b}`).join('\n') : '\n- NONE'}
Description (${desc.length} chars): ${desc ? desc.slice(0, 600) + (desc.length > 600 ? '…' : '') : 'NONE'}
Images (${images.length}): ${images.length ? images.join(', ') : 'NONE'}
Present metrics from API: ${presentMetrics.length ? presentMetrics.join(', ') : 'none'}

Score ONLY the fields present in PRODUCT DATA. Fields that are missing or empty should get score 0 with issue "data missing from API".
Return JSON ONLY (no markdown):
{
  "overall_score": <0-100>,
  "grade": "<A|B|C|D|F>",
  "fields": {
    "title": { "score": <0-100>, "criteria": { "status": "below|within|above", "note": "..." }, "issues": ["..."], "recommendations": ["..."] },
    "bullets": { "score": <0-100>, "count": <number>, "issues": ["..."], "recommendations": ["..."] },
    "images": { "score": <0-100>, "count": <number>, "issues": ["..."], "recommendations": ["..."] },
    "description": { "score": <0-100>, "issues": ["..."], "recommendations": ["..."] }
  },
  "summary": "<one-line overall assessment>"
}`;
}

function extractKeywords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => word.length > 2 && !['the','and','with','for','that','this','your','from','into','have','were','will','when','daily','product','premium','wireless','earbuds','audio','device','using','best','high','quality'].includes(word))
    .slice(0, 6);
}

function buildFallbackOptimization(item) {
  const title = getTitle(item);
  const bullets = getBullets(item);
  const description = getDescription(item);
  const images = getImages(item);
  const category = getCategory(item) || 'general';
  const keywords = extractKeywords(`${title} ${bullets.join(' ')} ${description}`);
  const recommendations = [];

  if (!title || title.length < 90) {
    recommendations.push({
      area: 'title',
      score: 58,
      priority: 'high',
      remarks: ['Make the title more descriptive and include the most relevant product attribute or use case.'],
      seoFocus: keywords.slice(0, 3),
      suggestedUpdate: 'Add the core product type, key feature, and brand naturally near the front of the title.',
    });
  }

  if (!Array.isArray(bullets) || bullets.length < 3) {
    recommendations.push({
      area: 'bullets',
      score: 62,
      priority: 'high',
      remarks: ['Add benefit-led bullet points that explain the product experience and usage clearly.'],
      seoFocus: keywords.slice(0, 3),
      suggestedUpdate: 'Expand the bullet list with customer-facing benefits, use cases, and compatibility details.',
    });
  }

  if (!images.length || images.length < 3) {
    recommendations.push({
      area: 'images',
      score: 65,
      priority: 'medium',
      remarks: ['Add more images to support trust, detail, and discovery.'],
      seoFocus: keywords.slice(0, 3),
      suggestedUpdate: 'Add lifestyle, size, packaging, and feature-closeup images to strengthen the listing.',
    });
  }

  if (!description || description.length < 180) {
    recommendations.push({
      area: 'description',
      score: 60,
      priority: 'medium',
      remarks: ['Expand the description with plain-language product benefits, usage context, and key differentiators.'],
      seoFocus: keywords.slice(0, 3),
      suggestedUpdate: 'Write a fuller description that explains how the product solves the customer need.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      area: 'content',
      score: 78,
      priority: 'medium',
      remarks: ['The listing already contains strong core content; enrich it with a recent benefit or customer use case to keep it fresh.'],
      seoFocus: keywords.slice(0, 3),
      suggestedUpdate: 'Refresh the listing with one new keyword-led detail that matches current customer intent.',
    });
  }

  return {
    summary: `The ${category} listing needs focused improvement in ${recommendations.map(r => r.area).slice(0, 3).join(', ')} to improve search relevance and conversion.`,
    priority: recommendations.some(r => r.priority === 'high') ? 'high' : 'medium',
    recommendations,
    keywords: keywords.slice(0, 4).map(term => ({ term, reason: 'Derived from the live title, bullet points, and description' })),
  };
}

function buildOptimizationPrompt(item) {
  const title = getTitle(item);
  const bullets = getBullets(item);
  const description = getDescription(item);
  const images = getImages(item);
  const brand = item.itemInfo?.byLineInfo?.brand?.displayValue || 'Unknown';
  const market = getMarketplace(item);
  const criteria = criteriaFor(item);

  return `You are an Amazon listing optimization strategist for ${market}. Use only the live product data supplied below and generate a dynamic optimization plan for SEO, content quality, and conversion.

Marketplace: ${market}
Category: ${getCategory(item) || 'Unknown'}
Brand: ${brand}
Criteria context: ${JSON.stringify({
    title: criteria.title,
    bullets: criteria.bullets,
    images: criteria.images,
    description: criteria.description,
    amazonInCompliance: criteria.amazonInCompliance,
  }, null, 2)}

PRODUCT DATA:
Title: ${title || 'MISSING'}
Bullets:
${bullets.length ? bullets.map((b, i) => `${i + 1}. ${b}`).join('\n') : '- NONE'}
Description: ${description || 'MISSING'}
Images:
${images.length ? images.join('\n') : '- NONE'}

Return JSON ONLY with this exact structure:
{
  "summary": "short overall optimization summary",
  "priority": "high|medium|low",
  "recommendations": [
    {
      "area": "title|bullets|images|description|content",
      "score": 0,
      "priority": "high|medium|low",
      "remarks": ["one short remark", "another short remark"],
      "seoFocus": ["keyword1", "keyword2"],
      "suggestedUpdate": "one concise action"
    }
  ],
  "keywords": [{"term": "keyword", "reason": "why it matters"}]
}`;
}

async function analyzeOptimization(item) {
  if (!item) return buildFallbackOptimization(item);

  try {
    const content = await nimService.chat([
      { role: 'system', content: 'You are an Amazon listing optimization expert. Always return valid JSON.' },
      { role: 'user', content: buildOptimizationPrompt(item) },
    ], { json: true, max_tokens: 2200 });

    const parsed = nimService.cleanJSON(content);
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations.map((rec) => ({
      area: typeof rec.area === 'string' ? rec.area : 'content',
      score: typeof rec.score === 'number' ? Math.max(0, Math.min(100, rec.score)) : 60,
      priority: ['high', 'medium', 'low'].includes(rec.priority) ? rec.priority : 'medium',
      remarks: Array.isArray(rec.remarks) ? rec.remarks.filter(Boolean) : [],
      seoFocus: Array.isArray(rec.seoFocus) ? rec.seoFocus.filter(Boolean).slice(0, 3) : [],
      suggestedUpdate: typeof rec.suggestedUpdate === 'string' ? rec.suggestedUpdate : '',
    })) : [];

    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : buildFallbackOptimization(item).summary,
      priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
      recommendations: recommendations.length ? recommendations : buildFallbackOptimization(item).recommendations,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean).map(k => ({
        term: typeof k.term === 'string' ? k.term : '',
        reason: typeof k.reason === 'string' ? k.reason : 'Derived from the live product content',
      })).filter(k => k.term) : buildFallbackOptimization(item).keywords,
    };
  } catch (error) {
    console.warn(`[AI-LQS] Optimization analysis failed for ${item.asin || '?'}: ${error.message}`);
    return buildFallbackOptimization(item);
  }
}

async function analyzeText(item) {
  const content = await nimService.chat([
    { role: 'system', content: 'You are an Amazon Seller Central listing policy expert. Always return valid JSON.' },
    { role: 'user', content: buildTextPrompt(item) },
  ], { json: true, max_tokens: 2500 });

  const parsed = nimService.cleanJSON(content);
  const clamp = (n) => (typeof n === 'number' ? Math.max(0, Math.min(100, n)) : null);
  const normalizeField = (f) => {
    const obj = f || {};
    return {
      score: clamp(obj.score),
      issues: Array.isArray(obj.issues) ? obj.issues : [],
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations : [],
      criteria: obj.criteria?.status ? { status: obj.criteria.status, note: typeof obj.criteria.note === 'string' ? obj.criteria.note : '' } : null,
    };
  };

  return {
    overall: clamp(parsed.overall_score),
    grade: typeof parsed.grade === 'string' ? parsed.grade : null,
    fields: {
      title: normalizeField(parsed.fields?.title),
      bullets: normalizeField(parsed.fields?.bullets),
      images: normalizeField(parsed.fields?.images),
      description: normalizeField(parsed.fields?.description),
    },
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
  };
}

async function analyzeVision(imageUrl) {
  if (!imageUrl) return null;
  const result = await nvidiaAiService.analyzeProductImage(imageUrl, { type: 'full' });
  const score = typeof result.quality_score === 'number' ? Math.max(0, Math.min(100, result.quality_score)) : null;
  const issues = [
    ...(Array.isArray(result.compliance_issues) ? result.compliance_issues : []),
    ...(Array.isArray(result.visual_issues) ? result.visual_issues : []),
  ];
  return {
    score,
    background: result.has_white_background === true ? 'pass' : result.has_white_background === false ? 'fail' : 'warning',
    issues,
    quality_score: result.quality_score,
    has_white_background: result.has_white_background,
    has_high_resolution: result.has_high_resolution,
    image_type: result.image_type || null,
    text_in_image: result.text_in_image || null,
  };
}

/**
 * Analyze one fetched ASIN with AI. Never throws.
 * Returns null if both text and vision failed; otherwise a partial result.
 */
async function analyzeItem(item) {
  if (!isAvailable() || !item) return null;

  return sem.run(async () => {
    const images = getImages(item);
    let text = null;
    let vision = null;
    let optimization = null;

    try {
      text = await withTimeout(analyzeText(item), CONFIG.textTimeoutMs);
    } catch (e) {
      console.warn(`[AI-LQS] Text analysis failed for ${item.asin || '?'}: ${e.message}`);
    }
    try {
      vision = await withTimeout(analyzeVision(images[0] || null), CONFIG.visionTimeoutMs);
    } catch (e) {
      console.warn(`[AI-LQS] Vision analysis failed for ${item.asin || '?'}: ${e.message}`);
    }
    try {
      optimization = await withTimeout(analyzeOptimization(item), CONFIG.textTimeoutMs);
    } catch (e) {
      console.warn(`[AI-LQS] Optimization analysis failed for ${item.asin || '?'}: ${e.message}`);
    }

    if (!text && !vision && !optimization) return null;

    // Merge: overall from text if present, else vision-derived
    const overall = text?.overall != null ? text.overall
      : vision?.score != null ? vision.score : null;
    const grade = text?.grade || (overall != null ? (overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 45 ? 'D' : 'F') : null);

    return {
      full: !!(text && vision),
      criteria: criteriaFor(item),
      overall,
      grade,
      fields: text?.fields || null,
      vision,
      optimization,
      summary: text?.summary || null,
    };
  });
}

function isAvailable() {
  return CONFIG.enabled && !!(process.env.NVIDIA_NIM_API_KEY);
}

module.exports = { analyzeItem, isAvailable, CONFIG, LQS_CRITERIA, criteriaFor, buildTextPrompt, buildSystemPrompt, buildOptimizationPrompt, analyzeOptimization };