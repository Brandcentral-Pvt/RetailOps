const nimService = require('./nimService');
const nvidiaAiService = require('./nvidiaAiService');

/**
 * AI-assisted Listing Quality scoring for the Live Data Inspector.
 *
 * Replaces the URL-keyword heuristics with two real AI analyses per ASIN:
 *   1. TEXT   — NVIDIA NIM chat scores the title/bullets/images against
 *               Amazon's actual criteria and reports below/within/above status.
 *   2. VISION — NVIDIA NIM vision model downloads the main image and inspects
 *               the real pixels: white background, resolution, compliance.
 *
 * Every failure degrades gracefully: the controller merges whatever part
 * succeeded over the rule-based analyzers and falls back entirely to rules
 * when AI is unavailable.
 */

const CONFIG = {
    enabled: process.env.LIVE_SYNC_AI_ENABLED !== 'false',
    concurrency: Math.max(1, parseInt(process.env.LIVE_SYNC_AI_CONCURRENCY || '2', 10)),
    textTimeoutMs: Math.max(5000, parseInt(process.env.LIVE_SYNC_AI_TIMEOUT_MS || '25000', 10)),
    visionTimeoutMs: Math.max(5000, parseInt(process.env.LIVE_SYNC_AI_VISION_TIMEOUT_MS || '40000', 10)),
};

function isAvailable() {
    return CONFIG.enabled && !!(process.env.NVIDIA_NIM_API_KEY);
}

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
function getTitle(item) { return item.itemInfo?.title?.displayValue || item.productName || ''; }
function getBullets(item) { return item.itemInfo?.features?.displayValues || []; }
function getImages(item) {
    const img = item.images || {};
    const urls = [];
    const pick = (o) => o?.url || null;
    const primary = pick(img.primary?.highRes) || pick(img.primary?.large) || pick(img.primary?.medium) || pick(img.primary?.small);
    if (primary) urls.push(primary);
    for (const v of (img.variants || [])) {
        const u = pick(v.highRes) || pick(v.large) || pick(v.medium) || pick(v.small);
        if (u && !urls.includes(u)) urls.push(u);
    }
    return urls;
}
function getCategory(item) {
    const nodes = item.browseNodeInfo?.browseNodes || [];
    return nodes.map(n => n.displayName || n.contextFreeName).filter(Boolean).join(' > ') || item.category || '';
}

function buildTextPrompt(item) {
    const title = getTitle(item);
    const bullets = getBullets(item);
    const images = getImages(item);
    const brand = item.itemInfo?.byLineInfo?.brand?.displayValue || '';
    return `You are an Amazon listing quality expert. Analyze this product listing against Amazon's OFFICIAL listing requirements and best practices.

AMAZON CRITERIA (apply these exact thresholds):
TITLE:
- Hard maximum: 200 characters (anything longer is truncated by Amazon)
- Ideal optimized length: 150-200 characters
- Acceptable: 60-149 characters
- Brand must be the first word
- No ALL-CAPS words (brand names excepted), no promotional words (SALE, FREE, BEST, GUARANTEED), no special symbols like ! ? @ # $ %
- No keyword stuffing or duplicate keywords
- For the title decide its criteria status: "below" if under 60 chars, "within" if 60-200 chars (note whether it is inside the 150-200 ideal band), "above" if over 200 chars.

BULLET POINTS:
- Exactly 5 is the recommended count (1 required, more than 8 excessive)
- Each bullet 150-250 characters is ideal
- Each bullet should open with an ALL-CAPS header + colon (e.g. "DURABLE MATERIAL: ...")
- Highlight benefits AND features, not just features
- No superiority claims, pricing, shipping or seller information

IMAGES:
- Minimum 1 main image required (0 = suppression risk), 6-9 total recommended
- Main image must be pure white background (RGB 255,255,255)
- Strong sets include: alternate angles, lifestyle/in-use, close-up/detail, infographic, size chart

PRODUCT DATA:
ASIN: ${item.asin || 'N/A'}
Brand: ${brand || 'Unknown'}
Category: ${getCategory(item) || 'Unknown'}
Rating: ${item.customerReviews?.starRating ?? 'N/A'}/5
Reviews: ${item.customerReviews?.count ?? 'N/A'}
Title (${title.length} chars): "${title || 'MISSING'}"
Bullet points (${bullets.length}):${bullets.length ? '\n' + bullets.map((b, i) => `${i + 1}. ${b}`).join('\n') : '\n- NONE'}
Images (${images.length}): ${images.length ? images.join(', ') : 'NONE'}

Score each field 0-100 and list concrete issues and fixes. Return JSON ONLY (no markdown):
{
  "overall_score": <0-100>,
  "title": {
    "score": <0-100>,
    "length": <number>,
    "criteria": { "status": "below|within|above", "note": "<one short sentence, e.g. '74 chars, below the 150-200 ideal band'>" },
    "issues": ["..."],
    "recommendations": ["..."]
  },
  "bullets": {
    "score": <0-100>,
    "count": <number>,
    "issues": ["..."],
    "recommendations": ["..."]
  },
  "images": {
    "score": <0-100>,
    "count": <number>,
    "issues": ["..."],
    "recommendations": ["..."]
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
    const t = parsed.title || {};
    const b = parsed.bullets || {};
    const i = parsed.images || {};
    const c = t.criteria || {};
    return {
        title: {
            score: clamp(t.score),
            issues: Array.isArray(t.issues) ? t.issues : [],
            recommendations: Array.isArray(t.recommendations) ? t.recommendations : [],
            criteria: c.status ? { status: c.status, note: typeof c.note === 'string' ? c.note : '' } : null,
        },
        bullets: {
            score: clamp(b.score),
            issues: Array.isArray(b.issues) ? b.issues : [],
            recommendations: Array.isArray(b.recommendations) ? b.recommendations : [],
        },
        imagesText: {
            score: clamp(i.score),
            issues: Array.isArray(i.issues) ? i.issues : [],
            recommendations: Array.isArray(i.recommendations) ? i.recommendations : [],
        },
        summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    };
}

async function analyzeVision(imageUrl) {
    if (!imageUrl) return null;
    const result = await nvidiaAiService.analyzeProductImage(imageUrl, { type: 'full' });
    const score = typeof result.quality_score === 'number'
        ? Math.max(0, Math.min(100, result.quality_score))
        : null;
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
 * Returns null if both text and vision failed; otherwise a partial result
 * that the controller merges over the rule-based analyzers.
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
        return {
            full: !!(text && vision),
            title: text?.title || null,
            bullets: text?.bullets || null,
            imagesText: text?.imagesText || null,
            vision,
            summary: text?.summary || null,
        };
    });
}

module.exports = { analyzeItem, isAvailable, CONFIG };
