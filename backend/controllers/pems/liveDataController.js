const { sql, getPool } = require('../../database/db');
const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const SystemLogService = require('../../services/SystemLogService');
const runLogService = require('../../services/liveSyncRunLogService');
const aiLqsService = require('../../services/aiLqsService');
const lqsUtils = require('../../utils/lqs');
const TitleAnalyzer = require('../../utils/titleAnalyzer');
const BulletPointsAnalyzer = require('../../utils/bulletPointsAnalyzer');
const ImageAnalyzer = require('../../utils/imageAnalyzer');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/live-data');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Redis-backed job store (works across PM2 cluster workers)
let redis = null;
async function getRedis() {
    if (redis && redis.status === 'ready') return redis;
    try {
        const Redis = require('ioredis');
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 3, retryStrategy: (times) => Math.min(times * 100, 3000),
            lazyConnect: true, connectTimeout: 3000,
        });
        redis.on('error', () => { redis = null; });
        await redis.connect();
        return redis;
    } catch { redis = null; return null; }
}

const JOB_PREFIX = 'ldi:job:';
const JOB_RESULTS_PREFIX = 'ldi:results:';
const JOB_TTL = 7200; // 2 hours

// jobId -> LiveSyncRunLogs.Id (used to complete inspector-upload runs)
const JOB_RUN_MAP = new Map();
function jobRunId(jobId) { return JOB_RUN_MAP.get(jobId) || null; }

async function saveJob(job) {
    const r = await getRedis();
    const { results, notFoundList, ...meta } = job;
    if (r) {
        await r.setex(JOB_PREFIX + job.id, JOB_TTL, JSON.stringify(meta));
        if (results && results.length > 0) {
            await r.setex(JOB_RESULTS_PREFIX + job.id + ':data', JOB_TTL, JSON.stringify(results));
        }
        if (notFoundList && notFoundList.length > 0) {
            await r.setex(JOB_RESULTS_PREFIX + job.id + ':nf', JOB_TTL, JSON.stringify(notFoundList));
        }
    } else {
        // Fallback to file-based storage
        fs.writeFileSync(path.join(UPLOADS_DIR, job.id + '.json'), JSON.stringify({ meta, results, notFoundList }));
    }
}

async function loadJob(jobId) {
    const r = await getRedis();
    if (r) {
        const metaStr = await r.get(JOB_PREFIX + jobId);
        if (!metaStr) return null;
        const meta = JSON.parse(metaStr);
        const dataStr = await r.get(JOB_RESULTS_PREFIX + jobId + ':data');
        const nfStr = await r.get(JOB_RESULTS_PREFIX + jobId + ':nf');
        return { ...meta, results: dataStr ? JSON.parse(dataStr) : [], notFoundList: nfStr ? JSON.parse(nfStr) : [] };
    } else {
        const filePath = path.join(UPLOADS_DIR, jobId + '.json');
        if (!fs.existsSync(filePath)) return null;
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { ...data.meta, results: data.results || [], notFoundList: data.notFoundList || [] };
    }
}

async function deleteJob(jobId) {
    const r = await getRedis();
    if (r) {
        await r.del(JOB_PREFIX + jobId, JOB_RESULTS_PREFIX + jobId + ':data', JOB_RESULTS_PREFIX + jobId + ':nf');
    } else {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, jobId + '.json')); } catch { }
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Config (env-driven, sensible defaults) ──────────────────────────────
const CONFIG = {
    batchSize: Math.max(1, parseInt(process.env.LIVE_SYNC_BATCH_SIZE || '10', 10)),
    batchDelayMs: Math.max(0, parseInt(process.env.LIVE_SYNC_BATCH_DELAY_MS || '1200', 10)),
    rateLimitPerSec: Math.max(0.05, parseFloat(process.env.LIVE_SYNC_RATE_LIMIT_RPS || '1')),
    rateLimitBurst: Math.max(1, parseInt(process.env.LIVE_SYNC_RATE_LIMIT_BURST || '3', 10)),
    maxConcurrentJobs: Math.max(1, parseInt(process.env.LIVE_SYNC_MAX_CONCURRENT_JOBS || '2', 10)),
    maxFetchAsins: Math.max(1, parseInt(process.env.LIVE_SYNC_MAX_FETCH_ASINS || '100', 10)),
    maxUploadAsins: Math.max(1, parseInt(process.env.LIVE_SYNC_MAX_UPLOAD_ASINS || '50000', 10)),
    aiEnabled: process.env.LIVE_SYNC_AI_ENABLED !== 'false',
    aiMaxAsins: Math.max(1, parseInt(process.env.LIVE_SYNC_AI_MAX_ASINS || '20', 10)),
};

const BATCH_SIZE = CONFIG.batchSize;
const BATCH_DELAY_MS = CONFIG.batchDelayMs;

const API_RESOURCES = [
    'itemInfo.title', 'itemInfo.byLineInfo', 'itemInfo.features',
    'images.primary.small', 'images.primary.medium', 'images.primary.large', 'images.primary.highRes',
    'images.variants.small', 'images.variants.medium', 'images.variants.large', 'images.variants.highRes',
    'offersV2.listings.price', 'offersV2.listings.availability',
    'offersV2.listings.merchantInfo', 'offersV2.listings.dealDetails',
    'offersV2.listings.isBuyBoxWinner', 'offersV2.listings.condition',
    'customerReviews.count', 'customerReviews.starRating',
    'browseNodeInfo.browseNodes', 'browseNodeInfo.browseNodes.salesRank',
    'browseNodeInfo.websiteSalesRank', 'parentASIN',
];

const CreatorsApiCredentials = require('../../services/creatorsApiCredentials');
const TOKEN_CACHE = new Map(); // credId -> { token, expiry }

// ── Per-credential rate limiter (token bucket) ─────────────────────────
class TokenBucket {
    constructor(rate, capacity) {
        this.rate = rate;
        this.capacity = capacity;
        this.tokens = capacity;
        this.last = Date.now();
    }
    _refill() {
        const now = Date.now();
        this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.rate);
        this.last = now;
    }
    // Consumes one token. Returns a promise that resolves once a token is available.
    async take() {
        for (;;) {
            this._refill();
            if (this.tokens >= 1) { this.tokens -= 1; return; }
            const waitMs = Math.max(10, Math.ceil(((1 - this.tokens) / this.rate) * 1000));
            await sleep(waitMs);
        }
    }
}

const buckets = new Map();    // credId -> TokenBucket
const credChains = new Map(); // credId -> Promise chain (serializes API calls)

function getBucket(credId) {
    if (!buckets.has(credId)) buckets.set(credId, new TokenBucket(CONFIG.rateLimitPerSec, CONFIG.rateLimitBurst));
    return buckets.get(credId);
}

/**
 * Run a single Creators API request on a credential.
 * 1) Waits for a rate-limit token (token bucket per credential).
 * 2) Chains onto the per-credential serial queue so calls never overlap.
 * This guarantees we never exceed the configured requests-per-second even
 * when multiple fetches / upload jobs are running at the same time.
 */
async function throttledCall(credId, fn) {
    await getBucket(credId).take();
    const prev = credChains.get(credId) || Promise.resolve();
    const run = prev.then(() => fn());
    credChains.set(credId, run.then(() => {}, () => {}));
    return run;
}

// ── Global job concurrency (FIFO, bounded) ─────────────────────────────
let activeJobs = 0;
const jobWaiters = [];

function acquireJobSlot() {
    return new Promise((resolve) => {
        if (activeJobs < CONFIG.maxConcurrentJobs) { activeJobs++; resolve(); }
        else jobWaiters.push(resolve);
    });
}

function releaseJobSlot() {
    activeJobs = Math.max(0, activeJobs - 1);
    const next = jobWaiters.shift();
    if (next) { activeJobs++; next(); }
}

async function withJobSlot(fn) {
    await acquireJobSlot();
    try { return await fn(); }
    finally { releaseJobSlot(); }
}

// ── Token management ───────────────────────────────────────────────────
function getCreds() {
    return {
        pt: process.env.LIVE_SYNC_PARTNER_TAG,
        mk: process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in',
    };
}

async function getTokenInfo(credId) {
    const cred = credId
        ? CreatorsApiCredentials.credentials.find(c => c.id === credId) || CreatorsApiCredentials.get()
        : CreatorsApiCredentials.get();
    const cacheKey = cred.id;
    const cached = TOKEN_CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return { token: cached.token, credId: cred.id };

    const r = await axios.post('https://api.amazon.co.uk/auth/o2/token', new URLSearchParams({
        grant_type: 'client_credentials', client_id: cred.clientId,
        client_secret: cred.clientSecret, scope: 'creatorsapi::default',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });

    const token = r.data.access_token;
    TOKEN_CACHE.set(cacheKey, { token, expiry: Date.now() + (r.data.expires_in * 1000) - 120000 });
    CreatorsApiCredentials.markSuccess(cred);
    return { token, credId: cred.id };
}

async function getToken(credId) {
    const info = await getTokenInfo(credId);
    return info.token;
}

async function callCreatorsAPI(token, batch, creds) {
    const r = await axios.post('https://creatorsapi.amazon/catalog/v1/getItems', {
        itemIds: batch, itemIdType: 'ASIN', marketplace: creds.mk,
        partnerTag: creds.pt, resources: API_RESOURCES,
    }, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'x-marketplace': creds.mk },
        timeout: 30000,
    });
    return r.data;
}

// ── Batch fetching with retry + rate limiting ──────────────────────────
const MAX_BATCH_RETRIES = 5;
const RETRY_DELAYS = [3000, 8000, 20000, 40000, 80000]; // exponential backoff per retry
const RATE_LIMIT_DELAY = 30000; // 30s on 429
const STALE_DELAY = 5000; // 5s after any error before next batch

function isNetworkError(err) {
    if (!err) return false;
    if (!err.response) return true;
    return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)
        || /timeout/i.test(err.message || '');
}

/**
 * Fetch one batch of ASINs, routed through the per-credential rate limiter
 * (token bucket + serial queue). Returns the full API response body on
 * success; throws the last error after retries.
 */
async function fetchBatchWithRetry(credId, token, batch, creds, refreshToken) {
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_BATCH_RETRIES; attempt++) {
        try {
            const res = await throttledCall(credId, () => callCreatorsAPI(token, batch, creds));
            return res;
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;

            if (status === 429) {
                const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0');
                const waitMs = Math.max(retryAfter * 1000, RATE_LIMIT_DELAY);
                console.log(`[LiveData] Rate limited (429) on ${credId}, attempt ${attempt + 1}/${MAX_BATCH_RETRIES}, waiting ${Math.round(waitMs / 1000)}s...`);
                TOKEN_CACHE.clear();
                if (refreshToken) { try { token = await refreshToken(); } catch { } }
                await sleep(waitMs);
                continue;
            }

            if (status === 401 || status === 403) {
                console.log(`[LiveData] Auth error (${status}) on ${credId}, rotating credential...`);
                TOKEN_CACHE.clear();
                if (refreshToken) { try { token = await refreshToken(); } catch { } }
                continue;
            }

            // Permanent 4xx client error — retrying will not help
            if (status && status >= 400 && status < 500) {
                throw err;
            }

            // Network / 5xx — backoff and retry
            const waitMs = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
            console.log(`[LiveData] API error ${status || err.code || 'unknown'} on ${credId}, attempt ${attempt + 1}/${MAX_BATCH_RETRIES}, waiting ${Math.round(waitMs / 1000)}s...`);
            await sleep(waitMs);
        }
    }
    throw lastErr || new Error('Failed after retries');
}

function parseApiErrors(apiErrors) {
    const map = new Map();
    for (const err of apiErrors) {
        let asin = err.asin || err.itemId || err.resourceId;
        if (!asin && err.message) {
            const m = err.message.match(/(?:ItemId|ASIN|Item)\s+(B[A-Z0-9]{9,})/i);
            if (m) asin = m[1];
        }
        if (asin) map.set(asin, err.message);
    }
    return map;
}

const AVAILABLE_METRICS = [
    { key: 'price', label: 'Price' },
    { key: 'mrp', label: 'MRP / List Price' },
    { key: 'bsr', label: 'Main BSR' },
    { key: 'subBsr', label: 'Sub BSR' },
    { key: 'rating', label: 'Rating' },
    { key: 'reviewCount', label: 'Review Count' },
    { key: 'buyBoxWinner', label: 'BuyBox Winner' },
    { key: 'seller', label: 'Seller (BuyBox)' },
    { key: 'availability', label: 'Availability' },
    { key: 'title', label: 'Title' },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'dealBadge', label: 'Deal Badge' },
    // ── LQS raw inputs (all sourced from the Creators API) ──────────
    { key: 'imagesCount', label: 'Image Count' },
    { key: 'mainImage', label: 'Main Image' },
    { key: 'bulletPointCount', label: 'Bullet Point Count' },
    { key: 'titleLength', label: 'Title Length' },
    // ── LQS computed (Listing Quality Score, API-only inputs) ────────
    { key: 'lqsScore', label: 'LQS Score' },
    { key: 'lqsGrade', label: 'LQS Grade' },
    { key: 'lqsTitle', label: 'LQS Title Quality' },
    { key: 'lqsBullets', label: 'LQS Bullets Quality' },
    { key: 'lqsImages', label: 'LQS Image Quality' },
    { key: 'mainImageBackground', label: 'Main Image Background' },
    { key: 'lqsIssues', label: 'LQS Issues' },
    // ── LQS AI-assisted ───────────────────────────────────────────────
    { key: 'lqsSource', label: 'LQS Source' },
    { key: 'titleCriteriaStatus', label: 'Title vs Criteria' },
    { key: 'imageCompliance', label: 'Main Image Compliance' },
];

// Metrics that trigger AI-assisted LQS analysis (text + vision).
const LQS_METRIC_KEYS = [
    'imagesCount', 'mainImage', 'bulletPointCount', 'titleLength',
    'lqsScore', 'lqsGrade', 'lqsTitle', 'lqsBullets', 'lqsImages',
    'mainImageBackground', 'lqsIssues', 'lqsSource', 'titleCriteriaStatus', 'imageCompliance',
];

function dedupe(arr) {
    const seen = new Set();
    const out = [];
    for (const s of arr) { if (s && !seen.has(s)) { seen.add(s); out.push(s); } }
    return out;
}

function getListing(item) {
    const offers = item.offersV2?.listings?.find(l => l.isBuyBoxWinner)
        || item.offersV2?.listings?.[0]
        || item.buyBoxes?.find(b => b.isBuyBoxWinner)
        || item.buyBoxes?.[0];
    return offers;
}

function extractImages(item) {
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

function extractDescription(item) {
    return item.itemInfo?.contentInfo?.description || item.ProductDescription || item.description || null;
}

function extractBullets(item) {
    return item.itemInfo?.features?.displayValues || [];
}

function extractCategory(item) {
    const nodes = item.browseNodeInfo?.browseNodes || [];
    return nodes.map(n => n.displayName || n.contextFreeName).filter(Boolean).join(' > ') || item.category || null;
}

// ── LQS analysis (AI-assisted, API-only inputs) ────────────────────────
// Description and A+ flag are not available from the Creators API, so the
// weighted score is renormalized over Title (30%), Bullets (25%), Images (25%).
// When AI analysis is available (item.__aiLqs set by enrichWithAi), the AI
// scores/issues replace the rule-based ones; otherwise the rules are used.
const LQS_CACHE = new WeakMap();
function getLqs(item) {
    let cached = LQS_CACHE.get(item);
    if (cached) return cached;

    const title = item.itemInfo?.title?.displayValue || item.productName || '';
    const bullets = item.itemInfo?.features?.displayValues || [];
    const images = extractImages(item);
    const category = extractCategory(item) || '';
    const ai = item.__aiLqs || null;

    const titleAnalysis = TitleAnalyzer.analyze(title);
    const bulletAnalysis = BulletPointsAnalyzer.analyze(bullets);
    const imageAnalysis = ImageAnalyzer.analyze({
        imageCount: images.length,
        imageUrls: images,
        metadata: { category, title },
    });

    // AI scores win where available; fall back per-part to the rules.
    const titleScore = ai?.title?.score ?? titleAnalysis.score;
    const bulletScore = ai?.bullets?.score ?? bulletAnalysis.score;
    const imageScore = ai?.vision?.score ?? ai?.imagesText?.score ?? imageAnalysis.score;

    const titleIssues = ai?.title?.issues?.length ? ai.title.issues.map(i => `[Title] ${i}`) : titleAnalysis.issues;
    const bulletIssues = ai?.bullets?.issues?.length ? ai.bullets.issues.map(i => `[Bullets] ${i}`) : bulletAnalysis.issues;
    const imageIssues = ai?.vision?.issues?.length
        ? ai.vision.issues.map(i => `[Images] ${i}`)
        : (ai?.imagesText?.issues?.length ? ai.imagesText.issues.map(i => `[Images] ${i}`) : imageAnalysis.issues);

    const backgroundStatus = ai?.vision?.background ?? (imageAnalysis.details?.whiteBackground?.status || 'warning');

    const weights = { title: 0.30, bullets: 0.25, images: 0.25 };
    const denom = weights.title + weights.bullets + weights.images;
    const rawScore = (
        titleScore * weights.title
        + bulletScore * weights.bullets
        + imageScore * weights.images
    ) / denom;
    const score = parseFloat((rawScore / 10).toFixed(1));

    const hasAi = !!(ai && (ai.title || ai.bullets || ai.vision));
    const analysis = {
        score,
        grade: lqsUtils.getGrade(score),
        source: hasAi ? (ai.full ? 'AI' : 'AI + Rules') : 'Rules',
        components: {
            titleQuality: parseFloat((titleScore / 10).toFixed(1)),
            bulletPoints: parseFloat((bulletScore / 10).toFixed(1)),
            imageQuality: parseFloat((imageScore / 10).toFixed(1)),
        },
        imageCount: images.length,
        imageChecks: {
            ...imageAnalysis.details,
            whiteBackground: { status: backgroundStatus },
            vision: ai?.vision || null,
        },
        titleCriteria: ai?.title?.criteria || null,
        aiSummary: ai?.summary || null,
        issues: dedupe([...titleIssues, ...bulletIssues, ...imageIssues]),
    };
    LQS_CACHE.set(item, analysis);
    return analysis;
}

// Run AI-assisted LQS on a batch of fetched items. Always safe — the service
// never throws and falls back to rules internally.
let aiSkippedLogged = false;
async function enrichWithAi(items, selectedMetrics, totalRequested, aiFlag) {
    if (aiFlag === false) return;
    if (!CONFIG.aiEnabled || !aiLqsService.isAvailable()) return;
    if (!items || items.length === 0) return;
    if (!selectedMetrics.some(m => LQS_METRIC_KEYS.includes(m))) return;
    if (totalRequested > CONFIG.aiMaxAsins) {
        if (!aiSkippedLogged) {
            console.log(`[Inspector] AI LQS skipped: ${totalRequested} ASINs > LIVE_SYNC_AI_MAX_ASINS (${CONFIG.aiMaxAsins})`);
            aiSkippedLogged = true;
        }
        return;
    }
    await Promise.all(items.map(item =>
        aiLqsService.analyzeItem(item).then(ai => { if (ai) item.__aiLqs = ai; })
    ));
}

function extractMetricValue(key, item) {
    const listing = getListing(item);
    switch (key) {
        case 'price': return listing?.price?.money?.amount || listing?.priceAmount || null;
        case 'mrp': return listing?.price?.savingBasis?.money?.amount || listing?.mrpAmount || null;
        case 'bsr': return item.browseNodeInfo?.websiteSalesRank?.salesRank || item.browseNodeInfo?.browseNodes?.[0]?.salesRank || null;
        case 'subBsr': {
            const rankings = item.rankings || [];
            if (rankings.length >= 2) {
                const match = rankings[1]?.match(/#([\d,]+)/);
                return match ? parseInt(match[1].replace(/,/g, '')) : null;
            }
            return item.browseNodeInfo?.browseNodes?.[1]?.salesRank || null;
        }
        case 'rating': return item.customerReviews?.starRating || null;
        case 'reviewCount': return item.customerReviews?.count || null;
        case 'buyBoxWinner': return listing?.isBuyBoxWinner ? 'Yes' : 'No';
        case 'seller': return listing?.merchantInfo?.name || listing?.seller || null;
        case 'availability': return listing?.availability?.message || listing?.availability?.status || item.stock?.status || null;
        case 'title': return item.itemInfo?.title?.displayValue || item.productName || null;
        case 'brand': return item.itemInfo?.byLineInfo?.brand?.displayValue || null;
        case 'category': return extractCategory(item);
        case 'dealBadge': return listing?.dealDetails?.badge || listing?.dealDetails?.type || (item.deals?.[0]?.badge) || null;
        // ── LQS raw inputs ──────────────────────────────────────────
        case 'imagesCount': {
            const count = extractImages(item).length;
            return count > 0 ? count : null;
        }
        case 'mainImage': return extractImages(item)[0] || null;
        case 'bulletPointCount': {
            const bullets = item.itemInfo?.features?.displayValues || [];
            return bullets.length > 0 ? bullets.length : null;
        }
        case 'titleLength': {
            const t = item.itemInfo?.title?.displayValue || item.productName || '';
            return t ? t.length : null;
        }
        // ── LQS computed ────────────────────────────────────────────
        case 'lqsScore': return getLqs(item).score;
        case 'lqsGrade': return getLqs(item).grade;
        case 'lqsTitle': return getLqs(item).components.titleQuality;
        case 'lqsBullets': return getLqs(item).components.bulletPoints;
        case 'lqsImages': return getLqs(item).components.imageQuality;
        case 'mainImageBackground': {
            const status = getLqs(item).imageChecks?.whiteBackground?.status;
            if (!status) return 'N/A';
            if (status === 'pass') return 'White';
            if (status === 'warning') return 'Possibly non-white';
            return 'Non-white';
        }
        case 'lqsIssues': {
            const issues = getLqs(item).issues;
            return issues.length > 0 ? issues.join(' | ') : 'None';
        }
        case 'lqsSource': return getLqs(item).source;
        case 'titleCriteriaStatus': {
            const c = getLqs(item).titleCriteria;
            if (!c) return null;
            const map = { below: 'Below ideal', within: 'Within criteria', above: 'Above max' };
            const label = map[c.status] || c.status;
            return c.note ? `${label} — ${c.note}` : label;
        }
        case 'imageCompliance': {
            const v = getLqs(item).imageChecks?.vision;
            if (!v) return null;
            const violations = [...(v.compliance_issues || []), ...(v.visual_issues || [])];
            if (violations.length === 0) return `Pass${v.image_type ? ` (${v.image_type})` : ''}`;
            const preview = violations.slice(0, 2).join('; ');
            return `${violations.length} issue(s): ${preview}${violations.length > 2 ? '...' : ''}`;
        }
        default: return null;
    }
}

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || 'unknown';
}

async function logActivity(type, description, metadata = {}) {
    try {
        await SystemLogService.log({
            type,
            entityType: 'LIVE_DATA_INSPECTOR',
            entityId: String(metadata.jobId || metadata.asinCount || 'N/A'),
            entityTitle: String(description).slice(0, 100),
            user: metadata.userId || null,
            description: String(description).slice(0, 400),
            metadata: { ...metadata, source: 'live-data-inspector' },
        });
    } catch (e) { /* don't block on log failure */ }
}

/**
 * Log an inspector-tool run (fetch or upload) into the Live Sync Tracker.
 * Creates a run, appends per-ASIN rows, and completes it. Fire-and-forget.
 */
async function logToolRun({ req, source, asins, results, notFoundList, metadata = {}, durationMs } = {}) {
    try {
        const success = Array.isArray(results) ? results : [];
        const notFound = Array.isArray(notFoundList) ? notFoundList : [];
        const created = await runLogService.createRun({
            triggerType: 'TOOL',
            source,
            triggeredBy: req?.user,
            sellerName: 'Live Data Inspector',
            marketplace: 'Amazon',
            metadata: { ...metadata, ip: getClientIp(req) },
        });
        const runId = created.id;

        const entries = [];
        for (const row of success) entries.push({ asinCode: row?.asin, asinId: null, status: 'SUCCESS', error: null });
        for (const nf of notFound) entries.push({ asinCode: nf?.asin, asinId: null, status: 'NOT_FOUND', error: nf?.reason || null });
        await runLogService.addAsinLogs(runId, entries);

        await runLogService.completeRun(runId, {
            status: notFound.length > 0 && success.length > 0 ? 'PARTIAL'
                : notFound.length === 0 && success.length > 0 ? 'COMPLETED'
                : notFound.length > 0 && success.length === 0 ? 'FAILED' : 'COMPLETED',
            totalAsins: Array.isArray(asins) ? asins.length : success.length + notFound.length,
            successCount: success.length,
            failedCount: notFound.length,
            failedAsinCodes: notFound.map(n => n?.asin).filter(Boolean),
            errors: notFound.slice(0, 100),
            durationMs,
        });
        return runId;
    } catch (e) {
        console.error('[Inspector] logToolRun failed:', e.message);
        return null;
    }
}

exports.getMetrics = (req, res) => {
    res.json({ success: true, data: AVAILABLE_METRICS.map(m => ({ key: m.key, label: m.label })) });
};

exports.disabledV1 = (req, res) => {
    res.status(410).json({
        success: false,
        error: 'The v1 Live Data Inspector API is disabled. Use the v2 endpoints (/api/live-data/v2/*) instead.',
        v2: true,
    });
};

exports.fetchLiveData = async (req, res) => {
    const startTs = Date.now();
    try {
        const { asins, metrics, credId } = req.body;
        if (!asins || !Array.isArray(asins) || asins.length === 0)
            return res.status(400).json({ success: false, error: 'ASINs array required' });
        if (!metrics || !Array.isArray(metrics) || metrics.length === 0)
            return res.status(400).json({ success: false, error: 'Metrics array required' });
        if (asins.length > CONFIG.maxFetchAsins)
            return res.status(400).json({ success: false, error: `Maximum ${CONFIG.maxFetchAsins} ASINs per request` });

        const selectedMetrics = metrics.filter(m => AVAILABLE_METRICS.some(am => am.key === m));
        if (selectedMetrics.length === 0)
            return res.status(400).json({ success: false, error: 'No valid metrics selected' });

        const asinList = asins.map(a => a.toUpperCase().trim());
        const targetCredId = credId || null;
        const aiFlag = !(req.body.ai === false || req.body.ai === 'false' || req.body.ai === '0');

        if (CreatorsApiCredentials.count === 0)
            return res.status(500).json({ success: false, error: 'Live Sync credentials not configured on server' });

        const creds = getCreds();

        // ── Shared batch processor (rate-limited + queued) ───────────
        async function processBatches(credId, token, asinList, selectedMetrics) {
            const results = [];
            const notFound = [];
            const refreshToken = () => getToken(credId);
            for (let i = 0; i < asinList.length; i += BATCH_SIZE) {
                const batch = asinList.slice(i, i + BATCH_SIZE);
                let apiData;
                try {
                    apiData = await fetchBatchWithRetry(credId, token, batch, creds, refreshToken);
                } catch (batchErr) {
                    for (const a of batch) {
                        notFound.push({ asin: a, reason: 'Failed after retries: ' + (batchErr.response?.status || batchErr.message || 'API error') });
                    }
                    continue;
                }
                const items = apiData?.itemsResult?.items || [];
                const errorMap = parseApiErrors(apiData?.errors || []);
                await enrichWithAi(items, selectedMetrics, asinList.length, aiFlag);
                for (const asinCode of batch) {
                    const item = items.find(i => i.asin === asinCode);
                    if (!item) { notFound.push({ asin: asinCode, reason: errorMap.get(asinCode) || 'Not returned' }); continue; }
                    const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                    for (const key of selectedMetrics) row[key] = extractMetricValue(key, item);
                    row.title = extractMetricValue('title', item);
                    row.description = extractDescription(item);
                    row.bulletPoints = extractBullets(item);
                    row.imageUrls = extractImages(item);
                    row.optimization = item.__aiLqs?.optimization || null;
                    results.push(row);
                }
                if (i + BATCH_SIZE < asinList.length) await sleep(BATCH_DELAY_MS);
            }
            return { results, notFound };
        }

        // ── Credential selection ─────────────────────────────────────
        let apiResult;
        if (targetCredId) {
            const info = await getTokenInfo(targetCredId);
            apiResult = await processBatches(info.credId, info.token, asinList, selectedMetrics);
        } else if (CreatorsApiCredentials.count >= 2) {
            const mid = Math.ceil(asinList.length / 2);
            const half1 = asinList.slice(0, mid);
            const half2 = asinList.slice(mid);

            let token1, token2;
            try {
                [token1, token2] = await Promise.all([getTokenInfo('primary'), getTokenInfo('secondary')]);
            } catch (tokenErr) {
                console.error('[Inspector] Token error:', tokenErr.message);
                return res.status(500).json({ success: false, error: 'Failed to get API token: ' + tokenErr.message });
            }

            console.log(`[Inspector] Dual-key: ${half1.length} ASINs → primary, ${half2.length} ASINs → secondary`);

            const [r1, r2] = await Promise.all([
                processBatches(token1.credId, token1.token, half1, selectedMetrics),
                processBatches(token2.credId, token2.token, half2, selectedMetrics),
            ]);

            apiResult = {
                results: [...r1.results, ...r2.results],
                notFound: [...r1.notFound, ...r2.notFound],
            };
            console.log(`[Inspector] Dual-key result: ${r1.results.length} (primary) + ${r2.results.length} (secondary) = ${apiResult.results.length} total`);
        } else {
            const info = await getTokenInfo(null);
            apiResult = await processBatches(info.credId, info.token, asinList, selectedMetrics);
        }

        res.json({
            success: true,
            data: apiResult.results,
            total: apiResult.results.length,
            notFound: apiResult.notFound.length > 0 ? apiResult.notFound : undefined,
            metrics: selectedMetrics,
        });

        logActivity('LIVE_DATA_FETCH', `Fetched ${apiResult.results.length} ASINs (${apiResult.notFound.length} not found) — metrics: ${selectedMetrics.join(', ')}`, {
            ip: getClientIp(req), asinCount: asins.length, foundCount: apiResult.results.length,
            notFoundCount: apiResult.notFound.length, metrics: selectedMetrics,
        });
        logToolRun({
            req,
            source: 'INSPECTOR_FETCH',
            asins: asinList,
            results: apiResult.results,
            notFoundList: apiResult.notFound,
            durationMs: Date.now() - startTs,
            metadata: { metrics: selectedMetrics, credId: targetCredId || 'auto', asinCount: asins.length },
        });
    } catch (err) {
        console.error('Live data fetch error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/live-data/upload
 * Upload CSV/Excel file with ASINs, starts background batch processing
 */
exports.uploadAndProcess = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const metrics = req.body.metrics ? (typeof req.body.metrics === 'string' ? JSON.parse(req.body.metrics) : req.body.metrics) : [];
        const selectedMetrics = metrics.filter(m => AVAILABLE_METRICS.some(am => am.key === m));
        if (selectedMetrics.length === 0) return res.status(400).json({ success: false, error: 'No valid metrics selected' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const asinSet = new Set();
        for (const row of rows) {
            for (const key of Object.keys(row)) {
                const val = String(row[key] || '').trim().toUpperCase();
                if (/^B[A-Z0-9]{9,}$/.test(val)) asinSet.add(val);
            }
        }

        const asinList = [...asinSet];
        if (asinList.length === 0) return res.status(400).json({ success: false, error: 'No valid ASINs found in file.' });
        if (asinList.length > CONFIG.maxUploadAsins) return res.status(400).json({ success: false, error: `Maximum ${CONFIG.maxUploadAsins} ASINs per upload` });

        const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const job = {
            id: jobId, status: 'processing', totalAsins: asinList.length,
            processed: 0, found: 0, notFound: 0, failed: 0,
            metrics: selectedMetrics, results: [], notFoundList: [],
            startedAt: new Date().toISOString(), completedAt: null, error: null,
        };
        await saveJob(job);

        const targetCredId = req.body._credId || req.body.credId || null;
        const aiFlag = !(req.body.ai === false || req.body.ai === 'false' || req.body.ai === '0');
        processJob(jobId, asinList, selectedMetrics, targetCredId, aiFlag, req.user).catch(async (err) => {
            console.error(`Job ${jobId} failed:`, err.message);
            const j = await loadJob(jobId);
            if (j) { j.status = 'failed'; j.error = err.message; j.completedAt = new Date().toISOString(); await saveJob(j); }
            runLogService.completeRun(jobRunId(jobId), {
                status: 'FAILED',
                totalAsins: asinList.length,
                successCount: 0,
                failedCount: asinList.length,
                errors: [{ fatal: err.message }],
            });
        });

        res.json({ success: true, jobId, totalAsins: asinList.length, estimatedMinutes: Math.ceil((asinList.length / BATCH_SIZE) * BATCH_DELAY_MS / 60000) });

        logActivity('LIVE_DATA_UPLOAD', `File upload: ${asinList.length} ASINs from ${req.file.originalname} — metrics: ${selectedMetrics.join(', ')}`, {
            ip: getClientIp(req), jobId, asinCount: asinList.length,
            fileName: req.file.originalname, fileSize: req.file.size, metrics: selectedMetrics,
        });
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getProgress = async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({
        success: true,
        data: {
            id: job.id, status: job.status, totalAsins: job.totalAsins,
            processed: job.processed, found: job.found, notFound: job.notFound, failed: job.failed,
            percent: job.totalAsins > 0 ? Math.round((job.processed / job.totalAsins) * 100) : 0,
            startedAt: job.startedAt, completedAt: job.completedAt, error: job.error,
        }
    });
};

exports.getResults = async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: job.results, notFound: job.notFoundList.length > 0 ? job.notFoundList : undefined, metrics: job.metrics, total: job.results.length });
};

exports.downloadResults = async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ success: false, error: 'Job not completed yet' });
    if (job.results.length === 0) return res.status(400).json({ success: false, error: 'No results to download' });

    const ws = XLSX.utils.json_to_sheet(job.results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Live Data');
    if (job.notFoundList.length > 0) {
        const nfWs = XLSX.utils.json_to_sheet(job.notFoundList);
        XLSX.utils.book_append_sheet(wb, nfWs, 'Not Found');
    }
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `live_data_${jobId_safe(job.id)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);

    logActivity('LIVE_DATA_DOWNLOAD', `Downloaded XLSX: ${job.results.length} ASINs from job ${job.id}`, {
        ip: getClientIp(req), jobId: job.id, resultCount: job.results.length,
        notFoundCount: job.notFoundList.length,
    });
};

exports.cancelJob = async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    job.status = 'cancelled';
    await saveJob(job);
    res.json({ success: true });

    logActivity('LIVE_DATA_CANCEL', `Cancelled job ${job.id} at ${job.processed}/${job.totalAsins} ASINs`, {
        ip: getClientIp(req), jobId: job.id, processed: job.processed, total: job.totalAsins,
    });
};

// ── Background job processor ────────────────────────────────────────────
// Runs inside the global job-slot pool (bounded concurrency) and every API
// call goes through the per-credential rate limiter + serial queue.
async function processJob(jobId, asinList, selectedMetrics, credId, aiFlag, user = null) {
    if (CreatorsApiCredentials.count === 0) throw new Error('Live Sync credentials not configured');

    // ── Run log: start tracking this upload job ──
    const runCreated = await runLogService.createRun({
        triggerType: 'TOOL',
        source: 'INSPECTOR_UPLOAD',
        triggeredBy: user,
        sellerName: 'Live Data Inspector',
        marketplace: 'Amazon',
        metadata: { jobId, metrics: selectedMetrics, totalAsins: asinList.length },
    });
    JOB_RUN_MAP.set(jobId, runCreated.id);

    await withJobSlot(async () => {
        const creds = getCreds();
        let token = await getToken(credId);
        let tokenExpiry = Date.now() + 3600000;
        let results = [];
        let notFoundList = [];
        let processed = 0, found = 0, notFound = 0;
        let consecutiveErrors = 0;

        const refreshToken = async () => {
            const t = await getToken(credId);
            tokenExpiry = Date.now() + 3600000;
            return t;
        };

        for (let i = 0; i < asinList.length; i += BATCH_SIZE) {
            const job = await loadJob(jobId);
            if (!job || job.status === 'cancelled') break;

            const batch = asinList.slice(i, i + BATCH_SIZE);

            // Refresh token if expired or about to expire
            if (Date.now() > tokenExpiry - 120000) {
                try { token = await refreshToken(); consecutiveErrors = 0; } catch { }
            }

            try {
                const apiData = await fetchBatchWithRetry(credId, token, batch, creds, refreshToken);
                const items = apiData?.itemsResult?.items || [];
                const errorMap = parseApiErrors(apiData?.errors || []);
                await enrichWithAi(items, selectedMetrics, asinList.length, aiFlag);

                for (const asinCode of batch) {
                    const item = items.find(it => it.asin === asinCode);
                    if (!item) {
                        notFoundList.push({ asin: asinCode, reason: errorMap.get(asinCode) || 'Not returned by API' });
                        notFound++;
                    } else {
                        const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                        for (const key of selectedMetrics) row[key] = extractMetricValue(key, item);
                        results.push(row);
                        found++;
                    }
                    processed++;
                }
                consecutiveErrors = 0;

            } catch (batchErr) {
                consecutiveErrors++;
                // If all retries failed — queue failed ASINs for the retry pass
                for (const a of batch) { notFoundList.push({ asin: a, reason: 'API error after all retries' }); notFound++; processed++; }
                console.warn(`Batch ${i / BATCH_SIZE + 1} FAILED after ${MAX_BATCH_RETRIES} retries — ${batch.length} ASINs queued for retry`);
            }

            // Save progress to Redis every batch
            job.processed = processed; job.found = found; job.notFound = notFound;
            job.results = results; job.notFoundList = notFoundList;
            await saveJob(job);

            // Delay between batches — longer after errors
            if (i + BATCH_SIZE < asinList.length) {
                const delay = consecutiveErrors > 0
                    ? Math.min(STALE_DELAY * consecutiveErrors, 30000) // scale up on consecutive errors, max 30s
                    : BATCH_DELAY_MS;
                await sleep(delay);
            }
        }

        // ── RETRY PASS 2: Re-fetch all failed ASINs with fresh token ──
        const failedAsins = notFoundList.map(n => n.asin);
        if (failedAsins.length > 0 && failedAsins.length <= 5000) {
            console.log(`Retry pass 2: re-fetching ${failedAsins.length} failed ASINs...`);
            // Clear not-found list and re-process
            notFoundList = [];
            notFound = 0;
            const retryResults = [];
            let retryFound = 0;

            // Get fresh token
            try { token = await refreshToken(); } catch { }

            for (let i = 0; i < failedAsins.length; i += BATCH_SIZE) {
                const job = await loadJob(jobId);
                if (!job || job.status === 'cancelled') break;

                const batch = failedAsins.slice(i, i + BATCH_SIZE);
                let retryBatchOk = false;

                try {
                    if (Date.now() > tokenExpiry - 120000) {
                        try { token = await refreshToken(); } catch { }
                    }
                    const apiData = await fetchBatchWithRetry(credId, token, batch, creds, refreshToken);
                    const items = apiData?.itemsResult?.items || [];
                    const errorMap = parseApiErrors(apiData?.errors || []);
                    await enrichWithAi(items, selectedMetrics, asinList.length, aiFlag);

                    for (const asinCode of batch) {
                        const item = items.find(it => it.asin === asinCode);
                        if (!item) {
                            notFoundList.push({ asin: asinCode, reason: errorMap.get(asinCode) || 'Not accessible' });
                            notFound++;
                        } else {
                            const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                            for (const key of selectedMetrics) row[key] = extractMetricValue(key, item);
                            retryResults.push(row);
                            retryFound++;
                        }
                    }
                    retryBatchOk = true;
                } catch (err) {
                    console.warn(`Retry batch ${i / BATCH_SIZE + 1} failed:`, err.message);
                }

                if (!retryBatchOk) {
                    for (const a of batch) { notFoundList.push({ asin: a, reason: 'Not accessible after retries' }); notFound++; }
                }

                if (i + BATCH_SIZE < failedAsins.length) await sleep(BATCH_DELAY_MS * 2);
            }

            // Merge retry results
            results = [...results, ...retryResults];
            found += retryFound;
        }

        const finalJob = await loadJob(jobId);
        if (finalJob && finalJob.status !== 'cancelled') {
            finalJob.status = 'completed';
            finalJob.completedAt = new Date().toISOString();
            await saveJob(finalJob);

            logActivity('LIVE_DATA_COMPLETE', `Job completed: ${finalJob.found}/${finalJob.totalAsins} ASINs found, ${finalJob.notFound} not found`, {
                jobId, foundCount: finalJob.found, notFoundCount: finalJob.notFound,
                totalAsins: finalJob.totalAsins, metrics: finalJob.metrics,
                duration: finalJob.completedAt ? Math.round((new Date(finalJob.completedAt) - new Date(finalJob.startedAt)) / 1000) + 's' : 'unknown',
            });

            // ── Run log: finalize upload job ──
            const runId = JOB_RUN_MAP.get(jobId);
            if (runId) {
                const entries = [
                    ...finalJob.results.map(r => ({ asinCode: r?.asin, status: 'SUCCESS' })),
                    ...finalJob.notFoundList.map(n => ({ asinCode: n?.asin, status: 'NOT_FOUND', error: n?.reason })),
                ];
                await runLogService.addAsinLogs(runId, entries);
                await runLogService.completeRun(runId, {
                    status: finalJob.notFound > 0 ? 'PARTIAL' : 'COMPLETED',
                    totalAsins: finalJob.totalAsins,
                    successCount: finalJob.found,
                    failedCount: finalJob.notFound,
                    failedAsinCodes: finalJob.notFoundList.map(n => n?.asin).filter(Boolean),
                    errors: finalJob.notFoundList.slice(0, 100),
                    durationMs: finalJob.completedAt ? Math.round(new Date(finalJob.completedAt) - new Date(finalJob.startedAt)) : null,
                });
                JOB_RUN_MAP.delete(jobId);
            }
        } else if (finalJob && finalJob.status === 'cancelled') {
            const runId = JOB_RUN_MAP.get(jobId);
            if (runId) {
                await runLogService.completeRun(runId, {
                    status: 'CANCELLED',
                    totalAsins: finalJob.totalAsins,
                    successCount: finalJob.found,
                    failedCount: finalJob.totalAsins - finalJob.found,
                    failedAsinCodes: finalJob.notFoundList.map(n => n?.asin).filter(Boolean),
                });
                JOB_RUN_MAP.delete(jobId);
            }
        }
    });
}

function jobId_safe(id) { return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40); }

function requireSecondaryCred() {
    const cred = CreatorsApiCredentials.credentials.find(c => c.id === 'secondary');
    if (!cred || !cred.clientId || !cred.clientSecret) {
        return null;
    }
    return cred;
}

// ── V2: Locked to secondary credential only ──────────────────────────
exports.fetchLiveDataV2 = async (req, res) => {
    if (!requireSecondaryCred())
        return res.status(500).json({ success: false, error: 'V2 requires the secondary Creators API credential (CREATORS_API_CLIENT_ID_2 / CREATORS_API_CLIENT_SECRET_2).' });
    req.body.credId = 'secondary';
    return exports.fetchLiveData(req, res);
};

exports.uploadAndProcessV2 = async (req, res) => {
    if (!requireSecondaryCred())
        return res.status(500).json({ success: false, error: 'V2 requires the secondary Creators API credential (CREATORS_API_CLIENT_ID_2 / CREATORS_API_CLIENT_SECRET_2).' });
    req.body._credId = 'secondary';
    return exports.uploadAndProcess(req, res);
};

exports.getProgressV2 = (req, res) => exports.getProgress(req, res);
exports.getResultsV2 = (req, res) => exports.getResults(req, res);
exports.downloadResultsV2 = (req, res) => exports.downloadResults(req, res);
exports.cancelJobV2 = (req, res) => exports.cancelJob(req, res);
