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
  return JSON.stringify({ ...c, weight: undefined }, null, 2);
}

function buildTextPrompt(item) {
  const title = getTitle(item);
  const bullets = getBullets(item);
  const images = getImages(item);
  const desc = getDescription(item);
  const brand = item.itemInfo?.byLineInfo?.brand?.displayValue || '';
  const market = getMarketplace(item);
  const wording = MARKETPLACE_WORDING[market] || MARKETPLACE_WORDING['www.amazon.in'];

  return `You are an Amazon listing quality expert. Score this listing against the PROVIDED CRITERIA (data-driven, not your assumptions).

CRITERIA (JSON):
${buildCriteriaBlock(item)}

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

Score ONLY the fields present in PRODUCT DATA (fields marked NONE or MISSING should get score 0 with issue "data missing from API").
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

    if (!text && !vision) return null;

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
      summary: text?.summary || null,
    };
  });
}

function isAvailable() {
  return CONFIG.enabled && !!(process.env.NVIDIA_NIM_API_KEY);
}

module.exports = { analyzeItem, isAvailable, CONFIG, LQS_CRITERIA, criteriaFor };