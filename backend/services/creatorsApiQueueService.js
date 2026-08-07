/**
 * Amazon Creators API — cached + BullMQ-queued client
 *
 * Guarantees the Creators API rate limit is never exhausted:
 *   - Every outbound HTTP call is processed by a single BullMQ Worker whose
 *     limiter is configured to at most 1 request per 1000 ms (configurable).
 *     If a call is already running, incoming calls are simply queued.
 *   - Identical in-flight requests share one job (single-flight dedup via a
 *     deterministic jobId derived from the request signature), so a burst of
 *     the same request never fans out into duplicate API calls.
 *   - Successful responses are cached in Redis (cacheService). Cache hits
 *     short-circuit the queue entirely, so repeated reads consume zero API
 *     quota.
 *   - OAuth tokens are cached (memory + Redis) and credentials are rotated
 *     via creatorsApiCredentials when multiple sets are configured.
 *
 * Requires a Redis server (BullMQ + cache). The worker must be started once
 * per process (see server.js — only started on the primary PM2 worker).
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const crypto = require('crypto');
const cacheService = require('./cacheService');
const CreatorsApiCredentials = require('./creatorsApiCredentials');
const logger = require('../utils/logger');

// ── Config (env-driven, safe defaults) ─────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_PREFIX = process.env.CREATORS_API_QUEUE_PREFIX || 'retailops:bullmq';
const QUEUE_NAME = process.env.CREATORS_API_QUEUE_NAME || 'creators-api-calls';
const JOB_NAME = process.env.CREATORS_API_JOB_NAME || 'creators-api-request';

// Rate limiter: at most RATE_LIMIT_MAX requests every RATE_LIMIT_DURATION_MS.
// Default 1 request per 1000ms → strict 1-second spacing between two calls.
const RATE_LIMIT_MAX = Math.max(1, parseInt(process.env.CREATORS_API_RATE_LIMIT_MAX || '1', 10));
const RATE_LIMIT_DURATION_MS = Math.max(50, parseInt(process.env.CREATORS_API_RATE_LIMIT_DURATION_MS || '1000', 10));

const CACHE_TTL = Math.max(0, parseInt(process.env.CREATORS_API_CACHE_TTL || '300', 10));
const JOB_TIMEOUT_MS = Math.max(5000, parseInt(process.env.CREATORS_API_JOB_TIMEOUT_MS || '120000', 10));
const API_TIMEOUT_MS = Math.max(5000, parseInt(process.env.CREATORS_API_TIMEOUT_MS || '30000', 10));
const TOKEN_TIMEOUT_MS = Math.max(5000, parseInt(process.env.CREATORS_API_TOKEN_TIMEOUT_MS || '10000', 10));

const BASE_URL = process.env.CREATORS_API_BASE_URL || 'https://creatorsapi.amazon';
const TOKEN_URL = process.env.CREATORS_API_TOKEN_URL || 'https://api.amazon.co.uk/auth/o2/token';
const DEFAULT_MARKETPLACE = process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in';

// Only run the Worker on the primary process. In a PM2 cluster
// (NODE_APP_INSTANCE set) that is worker 0; in single-process mode /
// standalone scripts NODE_APP_INSTANCE is undefined → treated as primary.
const isPrimaryWorker = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0';

// In-worker retry backoff for transient errors (network / 5xx).
const RETRY_DELAYS_MS = [3000, 8000, 20000];
// Pause after a 429 (Amazon does not reliably send Retry-After).
const RETRY_AFTER_429_MS = 30000;

const DEFAULT_RESOURCES = [
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

let queue = null;
let worker = null;
let events = null;
let started = false;

// credId -> { token, expiresAt }
const tokenMemoryCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sha1 = (input) => crypto.createHash('sha1').update(input).digest('hex');

function redisOpts() {
    return { maxRetriesPerRequest: null, enableOfflineQueue: false };
}

function newConnection() {
    return new IORedis(REDIS_URL, redisOpts());
}

// ── Lazy singletons ────────────────────────────────────────────────────
function getQueue() {
    if (queue) return queue;
    queue = new Queue(QUEUE_NAME, {
        connection: newConnection(),
        prefix: QUEUE_PREFIX,
        defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { age: 3600, count: 2000 },
            removeOnFail: { age: 86400, count: 1000 },
        },
    });
    return queue;
}

function getEvents() {
    if (events) return events;
    events = new QueueEvents(QUEUE_NAME, {
        connection: newConnection(),
        prefix: QUEUE_PREFIX,
    });
    return events;
}

async function processJob(job) {
    const { cacheKey, cacheTtl, request, credId } = job.data;

    if (cacheKey && cacheTtl > 0) {
        const cached = await cacheService.get(cacheKey);
        if (cached !== null && cached !== undefined) return cached;
    }

    const data = await executeRequest(request, credId);

    if (cacheKey && cacheTtl > 0 && data !== null && data !== undefined) {
        await cacheService.set(cacheKey, data, cacheTtl);
    }
    return data;
}

function getWorker() {
    if (worker) return worker;
    worker = new Worker(QUEUE_NAME, processJob, {
        connection: newConnection(),
        prefix: QUEUE_PREFIX,
        concurrency: 1,
        limiter: { max: RATE_LIMIT_MAX, duration: RATE_LIMIT_DURATION_MS },
    });

    worker.on('completed', (job) => {
        logger.info(`Creators API job ${job.id} completed`, {
            queue: QUEUE_NAME,
            jobId: job.id,
            durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
        });
    });

    worker.on('failed', (job, err) => {
        logger.error(`Creators API job ${job.id} failed`, {
            queue: QUEUE_NAME,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            error: err.message,
        });
    });

    worker.on('error', (err) => {
        logger.warn('Creators API worker error', { error: err.message });
    });

    return worker;
}

// ── Request execution (runs inside the worker) ─────────────────────────
async function executeRequest(request, credId) {
    const {
        path,
        method = 'POST',
        params,
        data,
        headers = {},
        timeout = API_TIMEOUT_MS,
        disableRetries = false,
    } = request;

    const url = /^https?:\/\//i.test(path) ? path : `${BASE_URL}${path}`;
    const maxAttempts = disableRetries ? 1 : RETRY_DELAYS_MS.length + 1;
    let lastErr = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const token = await getAccessToken(credId);
            const response = await axios({
                method,
                url,
                params,
                data,
                timeout,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...headers,
                },
            });
            return response.data;
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;

            // Stale / rejected token → invalidate and retry once with a fresh one.
            if (status === 401 || status === 403) {
                await invalidateToken(credId);
                if (attempt === 0) continue;
                throw err;
            }

            // Rate limited → wait (honour Retry-After when present) and retry.
            if (status === 429) {
                const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0', 10);
                const waitMs = Math.max(retryAfter * 1000, RETRY_AFTER_429_MS);
                logger.warn('Creators API rate limited (429), backing off', {
                    waitMs, attempt: attempt + 1, path,
                });
                await sleep(waitMs);
                continue;
            }

            // Permanent client error — retrying will not help.
            if (status && status >= 400 && status < 500) {
                throw err;
            }

            // Network / 5xx — exponential backoff.
            const waitMs = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
            logger.warn('Creators API transient error, retrying', {
                status: status || err.code || 'unknown',
                waitMs, attempt: attempt + 1, path,
            });
            await sleep(waitMs);
        }
    }
    throw lastErr || new Error('Creators API request failed after retries');
}

// ── OAuth token management (cached, rotated) ───────────────────────────
function resolveCredential(credId) {
    if (credId) {
        const found = CreatorsApiCredentials.credentials.find((c) => c.id === credId);
        if (found) return found;
    }
    return CreatorsApiCredentials.get();
}

async function getAccessToken(credId) {
    const cred = resolveCredential(credId);

    const mem = tokenMemoryCache.get(cred.id);
    if (mem && Date.now() < mem.expiresAt) return mem.token;

    const redisKey = cacheService.key('creators-api', 'token', cred.id);
    const cached = await cacheService.get(redisKey);
    if (cached && cached.token && Date.now() < cached.expiresAt) {
        tokenMemoryCache.set(cred.id, cached);
        return cached.token;
    }

    try {
        const res = await axios.post(TOKEN_URL, new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: cred.clientId,
            client_secret: cred.clientSecret,
            scope: 'creatorsapi::default',
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: TOKEN_TIMEOUT_MS,
        });

        const token = res.data.access_token;
        const expiresIn = parseInt(res.data.expires_in, 10) || 3600;
        const expiresAt = Date.now() + expiresIn * 1000 - 120000; // refresh 2 min early
        const entry = { token, expiresAt };

        tokenMemoryCache.set(cred.id, entry);
        await cacheService.set(redisKey, entry, Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)));
        CreatorsApiCredentials.markSuccess(cred);
        return token;
    } catch (err) {
        CreatorsApiCredentials.markFailed(cred, err.message || String(err));
        throw new Error(`Creators API token fetch failed for credential '${cred.id}': ${err.message || err}`);
    }
}

async function invalidateToken(credId) {
    const cred = resolveCredential(credId);
    tokenMemoryCache.delete(cred.id);
    await cacheService.del(cacheService.key('creators-api', 'token', cred.id));
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Queue + await a Creators API call.
 *
 * 1. Cache fast-path: identical request already cached → return immediately
 *    (zero queue / quota cost).
 * 2. Single-flight: an identical request already queued/running → share its
 *    job instead of firing a second HTTP call.
 * 3. Otherwise add a job; the worker's rate limiter enforces the max
 *    requests-per-second, so concurrent callers simply wait in line.
 *
 * @param {object} opts
 * @param {string} opts.path            API path (e.g. '/catalog/v1/getItems')
 * @param {string} [opts.method]        HTTP method (default 'POST')
 * @param {object} [opts.params]        Query params
 * @param {object} [opts.data]          JSON body
 * @param {object} [opts.headers]       Extra headers
 * @param {number} [opts.timeout]       Per-request timeout (ms)
 * @param {string} [opts.credId]        Pin a specific credential
 * @param {number} [opts.cacheTtl]      Cache TTL seconds (0 disables caching)
 * @param {boolean} [opts.disableRetries]
 * @returns {Promise<{cached: boolean, data: *, jobId: string|null}>}
 */
async function enqueue(opts) {
    const {
        path,
        method = 'POST',
        params,
        data,
        headers = {},
        timeout,
        credId,
        cacheTtl = CACHE_TTL,
        cacheable = cacheTtl > 0,
        disableRetries = false,
    } = opts;

    const signature = JSON.stringify({
        path,
        method,
        params: params || null,
        data: data || null,
        marketplace: headers['x-marketplace'] || data?.marketplace || null,
    });
    const cacheKey = cacheService.key('creators-api', 'data', sha1(signature));

    if (cacheable) {
        const cached = await cacheService.get(cacheKey);
        if (cached !== null && cached !== undefined) {
            return { cached: true, data: cached, jobId: null };
        }
    }

    const jobId = sha1(signature);
    // Ensure a worker is running (single-process dev / standalone scripts).
    // In a PM2 cluster this is a no-op on non-primary workers.
    await start();
    const job = await getQueue().add(JOB_NAME, {
        cacheKey: cacheable ? cacheKey : null,
        cacheTtl: cacheable ? cacheTtl : 0,
        request: { path, method, params, data, headers, timeout, disableRetries },
        credId,
    }, { jobId });

    const result = await job.waitUntilFinished(getEvents(), JOB_TIMEOUT_MS);
    return { cached: false, data: result, jobId };
}

/**
 * Fetch catalog items (batched getItems) with caching + queueing.
 * @param {string[]} itemIds
 * @param {object} [opts]
 * @returns {Promise<{cached: boolean, data: *, jobId: string|null}>}
 */
async function getItems(itemIds, opts = {}) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        throw new Error('getItems requires a non-empty array of itemIds');
    }
    const marketplace = opts.marketplace || DEFAULT_MARKETPLACE;
    const partnerTag = opts.partnerTag || process.env.LIVE_SYNC_PARTNER_TAG;
    const sortedIds = [...new Set(itemIds)].sort();

    return enqueue({
        path: '/catalog/v1/getItems',
        method: 'POST',
        data: {
            itemIds: sortedIds,
            itemIdType: opts.itemIdType || 'ASIN',
            marketplace,
            partnerTag,
            resources: opts.resources || DEFAULT_RESOURCES,
        },
        headers: { 'x-marketplace': marketplace },
        credId: opts.credId,
        cacheTtl: opts.cacheTtl,
        timeout: opts.timeout,
    });
}

/**
 * Search catalog items with caching + queueing.
 * @param {object} params  SearchItemsRequestContent fields
 * @returns {Promise<{cached: boolean, data: *, jobId: string|null}>}
 */
async function searchItems(params = {}) {
    const marketplace = params.marketplace || DEFAULT_MARKETPLACE;
    const { marketplace: _mkt, credId, cacheTtl, timeout, ...body } = params;

    return enqueue({
        path: '/catalog/v1/searchItems',
        method: 'POST',
        data: body,
        headers: { 'x-marketplace': marketplace },
        credId,
        cacheTtl,
        timeout,
    });
}

/** Get a cached/reused access token for a credential. */
async function getToken(credId) {
    return getAccessToken(credId);
}

/** Queue diagnostics for monitoring endpoints. */
async function getQueueStats() {
    try {
        const q = getQueue();
        const [counts, waiting, active, delayed, completed, failed] = await Promise.all([
            q.getJobCounts(),
            q.getWaitingCount(),
            q.getActiveCount(),
            q.getDelayedCount(),
            q.getCompletedCount(),
            q.getFailedCount(),
        ]);
        return {
            queueName: QUEUE_NAME,
            rateLimit: { max: RATE_LIMIT_MAX, durationMs: RATE_LIMIT_DURATION_MS },
            cacheTtl: CACHE_TTL,
            counts: { ...counts, waiting, active, delayed, completed, failed },
        };
    } catch (err) {
        return { queueName: QUEUE_NAME, error: err.message };
    }
}

/** Start the worker (call once, from the primary process). */
async function start() {
    if (started) return;
    if (!isPrimaryWorker) {
        // Non-primary cluster workers never run the worker — they only enqueue.
        getQueue();
        getEvents();
        return;
    }
    started = true;
    if (!cacheService.isEnabled()) {
        try { await cacheService.connect(); } catch { /* cache is optional */ }
    }
    getQueue();
    getEvents();
    getWorker();
    await worker.waitUntilReady();
    logger.info('Creators API queue service started', {
        queue: QUEUE_NAME,
        rateLimit: { max: RATE_LIMIT_MAX, durationMs: RATE_LIMIT_DURATION_MS },
        cacheTtl: CACHE_TTL,
    });
}

/** Graceful shutdown (close connections). */
async function shutdown() {
    if (worker) { await worker.close(); worker = null; }
    if (events) { await events.close(); events = null; }
    if (queue) { await queue.close(); queue = null; }
    started = false;
    logger.info('Creators API queue service stopped');
}

module.exports = {
    start,
    shutdown,
    enqueue,
    getItems,
    searchItems,
    getToken,
    getQueueStats,
    getWorker,
};
