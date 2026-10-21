const CreatorsApiSdk = require('../lib/creatorsapi-sdk/index');
const Credentials = require('./creatorsApiCredentials');
const creatorsApiRateGate = require('./creatorsApiRateGate');

class KeywordResearchService {
    constructor() {
        this._config = {
            // Request pacing lives in creatorsApiRateGate (account-wide, shared
            // with live sync) — the old per-service KEYWORD_REQUEST_DELAY_MS
            // timer was removed because two concurrent callers would read the
            // same timestamp and fire together.
            maxRetries: 2,
            retryDelay: 3000,
            concurrency: Number(process.env.KEYWORD_BATCH_CONCURRENCY || 4),
            cacheTtlMs: Number(process.env.KEYWORD_CACHE_TTL_MS || 10 * 60 * 1000),
            cacheMaxEntries: Number(process.env.KEYWORD_CACHE_MAX || 300),
        };
        this._sdkApis = new Map();

        // In-memory snapshot cache. The module persists nothing by design, so
        // this is the whole caching story: a re-run of the same search (a tab
        // switch, a saved list, an export straight after a search) costs no
        // upstream call. Nothing here survives a restart, which is intended.
        this._cache = new Map();
        this._cacheHits = 0;
        this._cacheMisses = 0;
    }

    /* ── cache ─────────────────────────────────────────────────────────── */

    _cacheKey(params) {
        const keys = [
            'keywords', 'searchIndex', 'brand', 'minPrice', 'maxPrice', 'minReviewsRating',
            'minSavingPercent', 'availability', 'condition', 'sortBy', 'itemCount', 'itemPage', 'marketplace',
        ];
        return keys.map(k => `${k}=${params[k] ?? ''}`).join('&').toLowerCase();
    }

    _getCached(key) {
        const hit = this._cache.get(key);
        if (!hit) return null;
        if (Date.now() > hit.expiresAt) {
            this._cache.delete(key);
            return null;
        }
        return hit.value;
    }

    _setCached(key, value) {
        if (this._cache.size >= this._config.cacheMaxEntries) {
            // Map preserves insertion order → drop the oldest entry.
            const oldest = this._cache.keys().next().value;
            this._cache.delete(oldest);
        }
        this._cache.set(key, { value, expiresAt: Date.now() + this._config.cacheTtlMs });
    }

    getCacheStats() {
        const total = this._cacheHits + this._cacheMisses;
        return {
            entries: this._cache.size,
            hits: this._cacheHits,
            misses: this._cacheMisses,
            hitRate: total > 0 ? Number(((this._cacheHits / total) * 100).toFixed(1)) : null,
            ttlMs: this._config.cacheTtlMs,
            maxEntries: this._config.cacheMaxEntries,
        };
    }

    clearCache() {
        const size = this._cache.size;
        this._cache.clear();
        return size;
    }

    _getSdkApi() {
        const cred = Credentials.get();
        const cached = this._sdkApis.get(cred.clientId);
        if (cached) return cached;

        const { ApiClient, DefaultApi } = CreatorsApiSdk;
        const apiClient = new ApiClient();
        apiClient.credentialId = cred.clientId;
        apiClient.credentialSecret = cred.clientSecret;
        apiClient.version = cred.version;
        const api = new DefaultApi(apiClient);
        this._sdkApis.set(cred.clientId, api);
        return api;
    }

    /**
     * Reserve a rate-limit slot.
     *
     * The upstream limit is one call per interval, ACCOUNT-wide. Handled by the
     * shared creatorsApiRateGate: an atomic Redis token bucket coordinates TPS
     * across ALL processes and all callers (live sync included), and the
     * durable CreatorsApiQuota ledger counts every attempt toward the daily
     * 8640 budget so it survives restarts.
     *
     * Returns true when a slot is granted (still within daily quota), false
     * when the daily TPD budget is exhausted.
     */
    async _acquireSlot(credId) {
        // Uses the rotation pool (primary/secondary), never v3, so the account
        // key resolves to 'primary' under CREATORS_RATE_SHARE_ACCOUNT — but go
        // through the helper so all callers derive the key the same way.
        const accountKey = creatorsApiRateGate.accountKeyFor(credId ?? Credentials.get().id);
        await creatorsApiRateGate.waitForTps(accountKey);
        return creatorsApiRateGate.recordRequest(accountKey);
    }

    async _rateLimit(credId) {
        return this._acquireSlot(credId);
    }

    /** Simple promise-pool so a batch cannot open unbounded sockets. */
    async _mapWithConcurrency(items, limit, worker) {
        const results = new Array(items.length);
        let cursor = 0;
        const size = Math.max(1, Math.min(limit, items.length));

        const runners = Array.from({ length: size }, async () => {
            while (cursor < items.length) {
                const index = cursor;
                cursor += 1;
                results[index] = await worker(items[index], index);
            }
        });

        await Promise.all(runners);
        return results;
    }

    async searchItems(params) {
        const {
            keywords,
            searchIndex,
            brand,
            minPrice,
            maxPrice,
            minReviewsRating,
            minSavingPercent,
            availability,
            condition,
            sortBy,
            itemCount = 10,
            itemPage = 1,
            marketplace = 'www.amazon.in',
            cache = true,
        } = params;

        const cacheKey = cache ? this._cacheKey({ ...params, keywords, marketplace, itemCount, itemPage }) : null;
        if (cacheKey) {
            const cached = this._getCached(cacheKey);
            if (cached) {
                this._cacheHits += 1;
                return { ...cached, cached: true };
            }
            this._cacheMisses += 1;
        }

        const api = this._getSdkApi();
        const cred = Credentials.get();
        const { SearchItemsRequestContent } = CreatorsApiSdk;

        const request = new SearchItemsRequestContent();
        request.keywords = keywords;
        request.partnerTag = cred.partnerTag;
        request.itemCount = itemCount;
        request.itemPage = itemPage;
        request.resources = [
            'itemInfo.title',
            'itemInfo.features',
            'itemInfo.productInfo',
            'itemInfo.byLineInfo',
            'itemInfo.classifications',
            'images.primary.large',
            'images.primary.medium',
            'offersV2.listings.price',
            'offersV2.listings.availability',
            'offersV2.listings.condition',
            'offersV2.listings.merchantInfo',
            'offersV2.listings.isBuyBoxWinner',
            'offersV2.listings.type',
            'customerReviews.count',
            'customerReviews.starRating',
            'browseNodeInfo.browseNodes',
            'browseNodeInfo.browseNodes.salesRank',
            'browseNodeInfo.websiteSalesRank',
            'parentASIN',
        ];

        if (searchIndex) request.searchIndex = searchIndex;
        if (brand) request.brand = brand;
        if (minPrice != null) request.minPrice = minPrice;
        if (maxPrice != null) request.maxPrice = maxPrice;
        if (minReviewsRating != null) request.minReviewsRating = minReviewsRating;
        if (minSavingPercent != null) request.minSavingPercent = minSavingPercent;
        if (availability) request.availability = availability;
        if (condition) request.condition = condition;
        if (sortBy) request.sortBy = sortBy;

        let lastError = null;

        for (let attempt = 0; attempt <= this._config.maxRetries; attempt++) {
            try {
                const reserved = await this._acquireSlot();
                if (!reserved) {
                    throw Object.assign(new Error('Creators API daily TPD quota reached'), { status: 429 });
                }

                const raw = await api.searchItems(marketplace, {
                    searchItemsRequestContent: request,
                });

                if (!raw || typeof raw !== 'object') {
                    console.error(`[KW Search] Unexpected response type for "${keywords}":`, typeof raw, raw);
                    throw new Error(`SDK returned unexpected type: ${typeof raw}`);
                }

                const data = raw.data || raw;
                if (!data || typeof data !== 'object') {
                    console.error(`[KW Search] No data in response for "${keywords}":`, JSON.stringify(raw).substring(0, 500));
                    throw new Error(`SDK returned empty response`);
                }

                const searchResult = data.searchResult || {};
                const items = (searchResult.items || []).map(item => this._extractItem(item));
                const refinements = data.searchRefinements || null;

                const payload = {
                    items,
                    totalResultCount: searchResult.totalResultCount || items.length,
                    searchRefinements: refinements,
                    itemPage,
                    itemCount,
                };

                if (cacheKey) this._setCached(cacheKey, payload);

                // `cached: false` lets the UI say whether a result came from the
                // snapshot cache or cost a fresh upstream call.
                return { ...payload, cached: false };
            } catch (err) {
                lastError = err;
                const status = err.status || err.response?.status;
                const body = err.body || err.response?.body;
                console.error(`[KW Search] API ${status} for "${keywords}":`, body ? JSON.stringify(body).substring(0, 300) : err.message);

                const isDailyQuota = (err.message || '').includes('daily TPD quota reached');
                if (status === 429 && !isDailyQuota) {
                    const retryAfter = parseInt((err.response?.headers || {})['retry-after'] || '5', 10);
                    console.warn(`[KW Search] 429 rate limited, waiting ${retryAfter}s...`);
                    await this._delay(retryAfter * 1000);
                    continue;
                }

                if ((status === 401 || status === 400) && attempt < this._config.maxRetries) {
                    this._sdkApis.delete(Credentials.get().clientId);
                    await this._delay(this._config.retryDelay);
                    continue;
                }

                throw err;
            }
        }

        throw lastError || new Error('Search failed after retries');
    }

    /**
     * Search several keywords.
     *
     * Runs through `_mapWithConcurrency`, which is safe because upstream starts
     * are still spaced by the shared 1.1 s slot queue — parallelism buys back
     * the request latency, it does not exceed the rate limit. Results keep the
     * caller's keyword order, failures stay per-keyword, and a cache hit costs
     * nothing.
     */
    async batchSearchItems(keywordsArray, params = {}, options = {}) {
        const cleaned = (keywordsArray || [])
            .map((k) => String(k || '').trim())
            .filter(Boolean);

        const concurrency = Math.max(1, Math.min(
            Number(options.concurrency || this._config.concurrency),
            cleaned.length || 1,
        ));

        const started = Date.now();
        let failed = 0;
        let cachedCount = 0;

        const results = await this._mapWithConcurrency(cleaned, concurrency, async (kw, index) => {
            console.log(`[KW Batch] ${index + 1}/${cleaned.length}: "${kw}"`);
            try {
                const result = await this.searchItems({ ...params, keywords: kw });
                if (result.cached) cachedCount += 1;
                return { keyword: kw, ...result };
            } catch (err) {
                failed += 1;
                console.error(`[KW Batch] Failed for "${kw}": ${err.message}`);
                return {
                    keyword: kw,
                    items: [],
                    totalResultCount: 0,
                    searchRefinements: null,
                    error: err.message,
                    itemPage: params.itemPage || 1,
                    itemCount: params.itemCount || 10,
                };
            }
        });

        return {
            results,
            totalKeywords: results.length,
            meta: {
                requested: cleaned.length,
                failed,
                cached: cachedCount,
                fresh: results.length - cachedCount - failed,
                concurrency,
                elapsedMs: Date.now() - started,
            },
        };
    }

    _extractItem(item) {
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner)
            || item.offersV2?.listings?.[0];
        const rankings = item.rankings || [];
        const browseNodes = item.browseNodeInfo?.browseNodes || [];

        let mainBSR = null;
        let subBSR = null;
        if (rankings.length >= 1) {
            mainBSR = this._parseBSR(rankings[0]);
            if (rankings.length >= 2) subBSR = this._parseBSR(rankings[1]);
        }
        if (!mainBSR && item.browseNodeInfo?.websiteSalesRank?.salesRank) {
            mainBSR = item.browseNodeInfo.websiteSalesRank.salesRank;
        }

        const price = listing?.price?.money?.amount || listing?.priceAmount || null;
        const mrp = listing?.price?.savingBasis?.money?.amount || null;
        const savingsPct = listing?.price?.savings?.percentage || null;
        const rating = this._parseRating(item.customerReviews?.starRating);
        const reviewCount = this._parseReviewCount(item.customerReviews?.count);
        const image = item.images?.primary?.large?.url || item.images?.primary?.medium?.url || null;
        const availability = listing?.availability?.type || listing?.availability?.message || null;

        return {
            asin: item.asin,
            title: item.itemInfo?.title?.displayValue || null,
            parentAsin: item.parentASIN || null,
            price,
            mrp,
            discountPercent: savingsPct,
            currency: listing?.price?.money?.currency || 'INR',
            rating,
            reviewCount,
            mainBSR,
            subBSR,
            mainImage: image,
            availability,
            detailPageURL: item.detailPageURL || null,
            brand: item.itemInfo?.byLineInfo?.brand?.displayValue || null,
            manufacturer: item.itemInfo?.byLineInfo?.manufacturer?.displayValue || null,
            seller: listing?.merchantInfo?.name || null,
            sellerId: listing?.merchantInfo?.id || null,
            isBuyBoxWinner: listing?.isBuyBoxWinner || false,
            condition: listing?.condition || null,
            category: browseNodes[0]?.contextFreeName || null,
            browseNodeId: browseNodes[0]?.id || null,
            color: item.itemInfo?.productInfo?.color?.displayValue || null,
            size: item.itemInfo?.productInfo?.size?.displayValue || null,
            bulletPoints: item.itemInfo?.features?.displayValues || [],
            score: item.score || null,
        };
    }

    _parseBSR(rankStr) {
        if (!rankStr) return null;
        const match = rankStr.match(/#([\d,]+)/);
        if (!match) return null;
        return parseInt(match[1].replace(/,/g, ''), 10) || null;
    }

    _parseRating(ratingData) {
        if (!ratingData) return null;
        if (typeof ratingData === 'number') return ratingData;
        if (typeof ratingData === 'string') {
            const parsed = parseFloat(ratingData);
            return isNaN(parsed) ? null : parsed;
        }
        if (ratingData.value !== undefined) return parseFloat(ratingData.value) || null;
        return null;
    }

    _parseReviewCount(countData) {
        if (!countData) return null;
        if (typeof countData === 'number') return Math.round(countData);
        if (typeof countData === 'string') {
            const cleaned = countData.replace(/[,]/g, '');
            const parsed = parseInt(cleaned, 10);
            return isNaN(parsed) ? null : parsed;
        }
        if (countData.value !== undefined) return Math.round(parseFloat(countData.value)) || null;
        return null;
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new KeywordResearchService();
