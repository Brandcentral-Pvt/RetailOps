const CreatorsApiSdk = require('../lib/creatorsapi-sdk/index');
const Credentials = require('./creatorsApiCredentials');

class KeywordResearchService {
    constructor() {
        this._lastRequestTime = 0;
        this._config = {
            requestDelay: 1100,
            maxRetries: 2,
            retryDelay: 3000,
        };
        this._sdkApis = new Map();
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

    async _rateLimit() {
        const now = Date.now();
        const elapsed = now - this._lastRequestTime;
        if (elapsed < this._config.requestDelay) {
            await this._delay(this._config.requestDelay - elapsed);
        }
        this._lastRequestTime = Date.now();
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
        } = params;

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
                await this._rateLimit();

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

                return {
                    items,
                    totalResultCount: searchResult.totalResultCount || items.length,
                    searchRefinements: refinements,
                    itemPage,
                    itemCount,
                };
            } catch (err) {
                lastError = err;
                const status = err.status || err.response?.status;
                const body = err.body || err.response?.body;
                console.error(`[KW Search] API ${status} for "${keywords}":`, body ? JSON.stringify(body).substring(0, 300) : err.message);

                if (status === 429) {
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

    async batchSearchItems(keywordsArray, params = {}) {
        const results = [];
        const totalKeywords = keywordsArray.length;

        for (let i = 0; i < totalKeywords; i++) {
            const kw = keywordsArray[i].trim();
            if (!kw) continue;

            console.log(`[KW Batch] ${i + 1}/${totalKeywords}: "${kw}"`);
            try {
                const result = await this.searchItems({ ...params, keywords: kw });
                results.push({
                    keyword: kw,
                    ...result,
                });
            } catch (err) {
                console.error(`[KW Batch] Failed for "${kw}": ${err.message}`);
                results.push({
                    keyword: kw,
                    items: [],
                    totalResultCount: 0,
                    searchRefinements: null,
                    error: err.message,
                    itemPage: params.itemPage || 1,
                    itemCount: params.itemCount || 10,
                });
            }
        }

        return { results, totalKeywords: results.length };
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
