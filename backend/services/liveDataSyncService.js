const { sql, getPool } = require('../database/db');
const CreatorsApiSdk = require('../lib/creatorsapi-sdk/index');
const SystemLogService = require('./SystemLogService');
const notificationController = require('../controllers/notificationController');
const listingQualityService = require('./listingQualityService');
const rulesetEngineService = require('./rulesetEngineService');
const EventEmitter = require('events');

class LiveDataSyncService extends EventEmitter {
    constructor() {
        super();

        this._config = {
            maxPerRequest: 10,             // Amazon API allows max 10 ASINs per request
            concurrency: 1,               // One seller at a time
            requestDelay: 1100,            // 1.1s between requests (API limit = 1 TPS)
            sellerDelay: 2000,            // 2s between sellers
            maxRetries: 3,
            retryDelay: 3000,
            rateLimitPerSecond: 1,        // API rate = 1 TPS per account
            tpdLimit: 8600,               // Daily limit = 8640 TPD, leave 40 buffer
            maxConcurrency: 1,            // One seller at a time
        };

        this._sdkClients = new Map();          // credId -> DefaultApi instance (cached SDK client)
        this._lastRequestTime = 0;             // Global last request timestamp (1 TPS per account)
        this._tpdCounters = new Map();         // credId -> daily request count
        this._tpdDate = null;                  // Today's date (YYYY-MM-DD) to reset counters
        this._credThrottledUntil = new Map();  // credId -> timestamp when throttling ends
        this.activeSyncs = new Map();
        this._globalSyncRunning = false;
    }

    // Rate limiter — strict 1 req/sec (API limit = 1 TPS per account)
    async _rateLimit() {
        const minInterval = 1100;
        const now = Date.now();
        const elapsed = now - this._lastRequestTime;
        if (elapsed < minInterval) {
            await this._delay(minInterval - elapsed);
        }
        this._lastRequestTime = Date.now();
    }

    // Track TPD per credential and optionally adjust rate from API header
    _updateRateFromHeader(headers, credId) {
        const today = new Date().toISOString().split('T')[0];
        if (this._tpdDate !== today) {
            this._tpdDate = today;
            this._tpdCounters.clear();
        }
        if (credId) {
            this._tpdCounters.set(credId, (this._tpdCounters.get(credId) || 0) + 1);
        }

        const limit = parseFloat(headers['x-amzn-ratelimit-limit']);
        if (limit && limit > 0 && limit < this._config.rateLimitPerSecond) {
            this._config.rateLimitPerSecond = limit;
            this._config.requestDelay = Math.ceil(1000 / limit) + 100;
            console.log(`📊 Rate limit updated from API: ${limit} req/s (delay: ${this._config.requestDelay}ms)`);
        }
    }

    // ============================================
    // Internal: Get or create cached SDK client per credential
    // ============================================
    _getSdkApi(credId) {
        const cached = this._sdkClients.get(credId);
        if (cached) return cached;

        const Credentials = require('./creatorsApiCredentials');
        const cred = Credentials.credentials.find(c => c.id === credId);
        if (!cred) throw new Error(`Credential '${credId}' not found`);

        const { ApiClient, DefaultApi } = CreatorsApiSdk;
        const apiClient = new ApiClient();
        apiClient.credentialId = cred.clientId;
        apiClient.credentialSecret = cred.clientSecret;
        apiClient.version = cred.version;
        const api = new DefaultApi(apiClient);
        this._sdkClients.set(credId, api);
        return api;
    }

    // ============================================
    // 🚀 MAIN: Live Sync for Seller (Public Method)
    // ============================================
    async syncSellerLiveData(sellerId, options = {}) {
        const startTime = Date.now();
        const sellerIdStr = sellerId.toString();

        if (this.activeSyncs.has(sellerIdStr)) {
            return {
                error: 'Live sync already in progress for this seller',
                status: 'IN_PROGRESS'
            };
        }

        const stats = {
            sellerId: sellerIdStr,
            syncType: 'LIVE',
            totalAsins: 0,
            successCount: 0,
            failedCount: 0,
            failedAsinCodes: [],
            errors: [],
            duration: 0
        };

        this.activeSyncs.set(sellerIdStr, stats);

        try {
            const pool = await getPool();

            // 1. Get ALL active ASINs
            const asinsResult = await pool.request()
                .input('sellerId', sql.VarChar, sellerIdStr)
                .query(`
                    SELECT Id, AsinCode, UploadedPrice 
                    FROM Asins 
                    WHERE SellerId = @sellerId 
                    AND Status IN ('Active', 'Error', 'Scraping')
                    AND AsinCode IS NOT NULL
                    ORDER BY AsinCode
                `);

            const allAsins = asinsResult.recordset;
            stats.totalAsins = allAsins.length;

            if (allAsins.length === 0) {
                throw new Error('No active ASINs found for this seller');
            }

            console.log(`Live sync: Seller ${sellerIdStr} - ${allAsins.length} ASINs`);

            this.emit('liveSync:started', {
                sellerId: sellerIdStr,
                totalAsins: allAsins.length
            });

            // 2. Create batches
            const batches = this._createBatches(allAsins, this._config.maxPerRequest);
            const totalBatches = batches.length;

            // 3. Process batches SEQUENTIALLY (Amazon API: 1 TPS per account)
            let completedCount = 0;

            for (const batch of batches) {
                if (this._globalSyncAborted) break;

                const credId = this._selectBestCred();
                if (!credId) {
                    console.error(`⛔ No available credential (all throttled or TPD exhausted)`);
                    for (const asinRecord of batch) {
                        stats.failedCount++;
                        stats.failedAsinCodes.push(asinRecord.AsinCode);
                    }
                    continue;
                }

                try {
                    await this._processBatch(sellerIdStr, batch, credId, stats);
                    completedCount++;

                    const progress = Math.round((completedCount / totalBatches) * 100);
                    this.emit('liveSync:progress', {
                        sellerId: sellerIdStr,
                        progress,
                        processed: completedCount,
                        total: totalBatches
                    });
                } catch (e) {
                    stats.errors.push({ batch: completedCount, error: e.message });
                    for (const asinRecord of batch) {
                        stats.failedCount++;
                        stats.failedAsinCodes.push(asinRecord.AsinCode);
                    }
                    console.log(`  ⏳ Batch failed: ${e.message}`);
                }
            }
            stats.duration = Date.now() - startTime;

            console.log(`Live sync complete: Seller ${sellerIdStr}`, {
                success: stats.successCount,
                failed: stats.failedCount,
                duration: `${(stats.duration / 1000).toFixed(2)}s`
            });

            // 5. Post-sync actions (may take time for LQS analysis)
            try {
                await this._triggerPostSync(sellerIdStr, allAsins);
            } catch (postSyncErr) {
                console.error(`Post-sync actions failed for seller ${sellerIdStr}:`, postSyncErr.message);
                // Don't fail the whole sync for post-sync errors
            }

            // 6. Log sync
            await this._logSync(sellerIdStr, stats);

            // 7. Emit socket event for real-time UI updates
            try {
                const SocketService = require('./socketService');
                const io = SocketService.getIo();
                if (io) {
                    console.log(`⚡ Emitting liveSync:completed for ${sellerIdStr}`);
                    io.emit('liveSync:completed', {
                        sellerId: sellerIdStr,
                        totalAsins: stats.totalAsins,
                        updatedAsins: stats.successCount,
                        failedAsins: stats.failedCount,
                        failedAsinCodes: stats.failedAsinCodes,
                        duration: stats.duration
                    });
                    // Also emit ASIN update event for ASIN manager auto-refresh
                    console.log(`⚡ Emitting ASINS_UPDATED for ${sellerIdStr}`);
                    io.emit('ASINS_UPDATED', { sellerId: sellerIdStr });
                } else {
                    console.warn('⚠️ SocketService not initialized, skipping socket emission');
                }
            } catch (e) { console.error('Socket emission error:', e.message); }

            // 8. If there are failed ASINs, schedule auto-retry after 10s (was 30s)
            if (stats.failedAsinCodes.length > 0) {
                const failedCodes = [...stats.failedAsinCodes];
                console.log(`🔄 Scheduling re-sync for ${failedCodes.length} failed ASINs in 10s...`);

                setTimeout(async () => {
                    try {
                        await this._resyncFailedAsins(sellerIdStr, failedCodes);
                    } catch (reSyncErr) {
                        console.error(`Re-sync of failed ASINs error:`, reSyncErr.message);
                    }
                }, 10000);
            }

            // 9. Notify users about sync results
            await this._notifySyncResult(sellerIdStr, stats);

            stats.completedAt = new Date().toISOString();
            stats.status = 'COMPLETED';
            this.emit('liveSync:completed', stats);

            return {
                success: true,
                sellerId: sellerIdStr,
                totalAsins: stats.totalAsins,
                updatedAsins: stats.successCount,
                failedAsins: stats.failedCount,
                failedAsinCodes: stats.failedAsinCodes,
                duration: stats.duration,
                completedAt: stats.completedAt
            };

        } catch (error) {
            stats.fatalError = error.message;
            stats.status = 'FAILED';
            console.error(`Live sync failed for seller ${sellerIdStr}:`, error);

            this.emit('liveSync:failed', { sellerId: sellerIdStr, error: error.message });

            throw new Error(`Live sync failed: ${error.message}`);

        } finally {
            // Always clean up after ALL operations complete (success or failure)
            this.activeSyncs.delete(sellerIdStr);
        }
    }

    // ============================================
    // GLOBAL: Sync All Sellers (parallel batching)
    // ============================================
    async syncAllSellers(options = {}) {
        const { concurrency = this._config.maxConcurrency, sellerIds = null, maxRetries = 2 } = options;
        const startTime = Date.now();

        // Prevent duplicate global sync
        if (this._globalSyncRunning) {
            return { error: 'Global live sync already in progress', status: 'IN_PROGRESS' };
        }
        this._globalSyncRunning = true;

        try {
            const pool = await getPool();

            // Get all active sellers with Amazon ASINs
            let sellersQuery = `
                SELECT DISTINCT s.Id, s.Name, COUNT(a.Id) as AsinCount
                FROM Sellers s
                JOIN Asins a ON a.SellerId = s.Id
                WHERE s.IsActive = 1 AND a.Status = 'Active' AND a.AsinCode LIKE 'B0%'
                GROUP BY s.Id, s.Name
                HAVING COUNT(a.Id) > 0
            `;
            const request = pool.request();
            if (sellerIds && sellerIds.length > 0) {
                sellersQuery += ` AND s.Id IN (${sellerIds.map((_, i) => `@sellerId${i}`).join(',')})`;
                sellerIds.forEach((id, i) => request.input(`sellerId${i}`, sql.VarChar, id));
            }

            const sellersResult = await request.query(sellersQuery);
            const sellers = sellersResult.recordset;

            console.log(`⚡ Live sync all: ${sellers.length} sellers (${sellers.reduce((s, v) => s + v.AsinCount, 0)} ASINs)`);
            console.log(`   Config: concurrency=${concurrency}, retries=${maxRetries}, delay=${this._config.sellerDelay}ms`);
            this.emit('liveSyncAll:started', { totalSellers: sellers.length });

            const results = [];

            // Parallel seller processing with concurrency limiter
            const processOneSeller = async (seller, index) => {
                const progress = `[${index + 1}/${sellers.length}]`;
                let lastError = null;
                let attempt = 0;

                while (attempt <= maxRetries) {
                    try {
                        if (attempt > 0) {
                            console.log(`  ${progress} 🔄 ${seller.Name} — retry ${attempt}/${maxRetries}`);
                            await this._delay(this._config.retryDelay);
                        }
                        const result = await this.syncSellerLiveData(seller.Id);
                        results.push({
                            sellerId: seller.Id, name: seller.Name,
                            status: result.success ? 'SUCCESS' : 'PARTIAL',
                            updated: result.updatedAsins || 0, failed: result.failedAsins || 0,
                            duration: result.duration || 0
                        });
                        console.log(`  ${progress} ✅ ${seller.Name}: ${result.updatedAsins || 0} updated, ${result.failedAsins || 0} failed (${((result.duration || 0) / 1000).toFixed(1)}s)`);
                        return;
                    } catch (err) {
                        lastError = err;
                        attempt++;
                        console.warn(`  ${progress} ⚠️  ${seller.Name}: attempt ${attempt}/${maxRetries} failed — ${err.message}`);
                    }
                }
                results.push({ sellerId: seller.Id, name: seller.Name, status: 'FAILED', error: lastError?.message, retries: maxRetries });
            };

            // Process with concurrency limiter
            const queue = [...sellers];
            const running = new Set();
            let processed = 0;

            while (queue.length > 0 || running.size > 0) {
                while (running.size < concurrency && queue.length > 0) {
                    const seller = queue.shift();
                    const idx = processed++;
                    const p = processOneSeller(seller, idx);
                    running.add(p);
                    p.finally(() => running.delete(p));
                }
                if (running.size > 0) {
                    await Promise.race(running);
                }
            }

            const totalDuration = Date.now() - startTime;
            const summary = {
                totalSellers: sellers.length,
                success: results.filter(r => r.status === 'SUCCESS').length,
                partial: results.filter(r => r.status === 'PARTIAL').length,
                failed: results.filter(r => r.status === 'FAILED').length,
                skipped: results.filter(r => r.status === 'SKIPPED').length,
                totalAsinsUpdated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
                duration: totalDuration,
                completedAt: new Date().toISOString()
            };

            console.log(`⚡ Live sync complete: ${summary.success}/${summary.totalSellers} success, ${summary.partial} partial, ${summary.failed} failed, ${summary.totalAsinsUpdated} ASINs in ${(totalDuration / 1000).toFixed(1)}s`);
            this.emit('liveSyncAll:completed', summary);

            // Emit socket event for real-time UI updates
            try {
                const SocketService = require('./socketService');
                const io = SocketService.getIo();
                if (io) {
                    io.emit('liveSyncAll:completed', summary);
                    io.emit('ASINS_UPDATED', { type: 'bulk', sellerCount: summary.success });
                }
            } catch (e) { /* socket not critical */ }

            return { success: true, summary, results };
        } finally {
            this._globalSyncRunning = false;
        }
    }

    _getAvailableCredIds() {
        const CreatorsApiCredentials = require('./creatorsApiCredentials');
        return CreatorsApiCredentials.credentials
            .filter(c => c.clientId && c.clientSecret && c.consecutiveErrors < 5)
            .map(c => c.id);
    }

    _getCredInfo(credId) {
        const CreatorsApiCredentials = require('./creatorsApiCredentials');
        const cred = CreatorsApiCredentials.credentials.find(c => c.id === credId);
        if (!cred) throw new Error(`Credential '${credId}' not found`);
        return {
            marketplace: cred.marketplace || 'www.amazon.in',
            partnerTag: cred.partnerTag,
        };
    }

    _selectBestCred() {
        const CreatorsApiCredentials = require('./creatorsApiCredentials');
        const healthy = CreatorsApiCredentials.credentials
            .filter(c => c.clientId && c.clientSecret && c.consecutiveErrors < 5);
        if (healthy.length === 0) return null;

        // Prefer non-throttled credentials, then least TPD usage
        const now = Date.now();
        let best = null;
        let bestTpd = Infinity;

        for (const cred of healthy) {
            if (this._credThrottledUntil.get(cred.id) === Infinity) continue; // TPD exhausted permanently
            if ((this._credThrottledUntil.get(cred.id) || 0) > now) continue; // Temporarily throttled

            const tpd = this._tpdCounters.get(cred.id) || 0;
            if (tpd < bestTpd) {
                bestTpd = tpd;
                best = cred.id;
            }
        }

        return best;
    }

    _isCredThrottled(credId) {
        const until = this._credThrottledUntil.get(credId);
        if (!until) return false;
        if (until === Infinity) return true;
        return Date.now() < until;
    }

    // ============================================
    // Internal: Process Batch
    // ============================================
    async _processBatch(sellerId, batch, credId, stats) {
        const codes = batch.map(a => a.AsinCode);
        let lastError = null;

        for (let attempt = 0; attempt <= this._config.maxRetries; attempt++) {
            try {
                if (this._isCredThrottled(credId)) {
                    const throttledCred = this._selectBestCred();
                    if (throttledCred && throttledCred !== credId) {
                        console.log(`   Credential '${credId}' throttled, switching to '${throttledCred}'`);
                        return this._processBatch(sellerId, batch, throttledCred, stats);
                    }
                    throw new Error(`Credential '${credId}' is throttled — waiting`);
                }

                // Check TPD limit before making request
                const tpdCount = this._tpdCounters.get(credId) || 0;
                if (tpdCount >= this._config.tpdLimit) {
                    this._credThrottledUntil.set(credId, Infinity);
                    console.warn(`⛔ Credential '${credId}' reached TPD limit (${tpdCount}/${this._config.tpdLimit})`);
                    const fallbackCred = this._selectBestCred();
                    if (fallbackCred && fallbackCred !== credId) {
                        return this._processBatch(sellerId, batch, fallbackCred, stats);
                    }
                    throw new Error(`All credentials exhausted TPD limit`);
                }

                const credInfo = this._getCredInfo(credId);
                const api = this._getSdkApi(credId);

                // Strict 1 req/s rate limit (per account)
                await this._rateLimit();

                const { GetItemsRequestContent } = CreatorsApiSdk;
                const request = new GetItemsRequestContent();
                request.partnerTag = credInfo.partnerTag;
                request.itemIds = codes;
                request.resources = this._getResources();

                const response_and_data = await api.getItemsWithHttpInfo(credInfo.marketplace, request);
                const data = response_and_data.data;
                const response = response_and_data.response;

                // Track TPD from successful request
                this._updateRateFromHeader(response.headers, credId);

                const items = data.itemsResult?.items || [];

                const apiErrors = data.errors || [];
                const errorMap = new Map();
                for (const err of apiErrors) {
                    let asin = err.asin || err.itemId || err.resourceId;
                    if (!asin && err.message) {
                        const match = err.message.match(/(?:ItemId|ASIN|Item)\s+(B[A-Z0-9]{9,})/i);
                        if (match) asin = match[1];
                    }
                    if (asin) errorMap.set(asin, err.message || err.errorType || err.code || 'API error');
                }

                const savePromises = batch.map(async (asinRecord) => {
                    try {
                        const item = items.find(i => i.asin === asinRecord.AsinCode);
                        if (!item) {
                            const reason = errorMap.get(asinRecord.AsinCode) || 'Not returned by API';
                            stats.errors.push({ asin: asinRecord.AsinCode, error: reason });

                            stats.failedCount++;
                            stats.failedAsinCodes.push(asinRecord.AsinCode);
                            return;
                        }

                        await this._updateAsinFromLiveSync(asinRecord.Id, sellerId, item, asinRecord);
                        stats.successCount++;
                    } catch (e) {
                        stats.failedCount++;
                        stats.failedAsinCodes.push(asinRecord.AsinCode);
                        stats.errors.push({ asin: asinRecord.AsinCode, error: e.message });
                    }
                });

                await Promise.all(savePromises);
                return; // Success

            } catch (error) {
                lastError = error;
                const status = error.status || error.response?.status;

                // SDK errors carry status at top level; body and headers via response
                const resp = error.response || {};
                if (error.body || resp.body) {
                    const body = JSON.stringify(error.body || resp.body || {}).substring(0, 500);
                    console.error(`❌ [LiveSync] API ${status} for batch [${codes?.slice(0, 3).join(', ')}...]: ${body}`);
                }

                // 429: Throttle this credential, try the other one
                if (status === 429) {
                    const retryAfterSec = parseInt((resp.headers || {})['retry-after'] || '0', 10);
                    const backoffMs = retryAfterSec > 0
                        ? retryAfterSec * 1000
                        : Math.min(10000 * Math.pow(2, attempt), 80000);

                    this._credThrottledUntil.set(credId, Date.now() + backoffMs);
                    console.warn(`⏳ [429] Throttled '${credId}' for ${(backoffMs / 1000).toFixed(0)}s (attempt ${attempt + 1})`);

                    const fallbackCred = this._selectBestCred();
                    if (fallbackCred && fallbackCred !== credId) {
                        console.log(`   Switching to '${fallbackCred}' for retry`);
                        await this._delay(2000);
                        return this._processBatch(sellerId, batch, fallbackCred, stats);
                    }
                    // All credentials throttled — wait for the shortest throttle to expire
                    const minUntil = Math.min(...Array.from(this._credThrottledUntil.values()).filter(t => t !== Infinity));
                    const wait = Math.min(Math.max(minUntil - Date.now(), 1000), 120000);
                    console.log(`   All credentials throttled, waiting ${(wait / 1000).toFixed(0)}s...`);
                    await this._delay(wait);
                    continue;
                }

                // 401/400: Rotate token and try the other credential
                if ((status === 401 || status === 400) && attempt < this._config.maxRetries) {
                    this._sdkClients.delete(credId);
                    console.warn(`🔄 [${status}] Rotating credential '${credId}', trying fallback (attempt ${attempt + 1})`);
                    const fallbackCred = this._selectBestCred();
                    if (fallbackCred && fallbackCred !== credId) {
                        await this._delay(this._config.retryDelay);
                        return this._processBatch(sellerId, batch, fallbackCred, stats);
                    }
                    await this._delay(this._config.retryDelay);
                    continue;
                }
            }
        }

        // All retries exhausted
        if (lastError) throw lastError;
    }

    // Mark an ASIN as not accessible via API (permanent failure)

    // ============================================
    // 🔥 KEY: Update ALL Fields EXCEPT A+ and Rating Breakdown
    // ============================================
    async _updateAsinFromLiveSync(asinId, sellerId, item, asinRecord = null) {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            const extracted = this._extractFields(item);

            // Price Dispute Calculation — read UploadedPrice from DB record (passed from batch query)
            const uploadedPrice = asinRecord?.UploadedPrice || 0;
            const currentPrice = extracted.priceAmount || 0;
            const dealBadge = extracted.dealBadge || '';

            // Any deal badge present → suppress dispute (deals change prices frequently)
            // Includes: Lightning Deal, Limited Time Deal, Prime Day, Coupon, % off, Ends in, etc.
            const hasDeal = dealBadge && dealBadge !== 'No deal found' && dealBadge.trim().length > 0;

            let priceDispute = false;
            if (uploadedPrice > 0 && currentPrice > 0) {
                const priceDiff = Math.abs(uploadedPrice - currentPrice);
                if (!hasDeal && priceDiff > 5) {
                    priceDispute = true;
                }
            }

            // ⚠️ Update ALL fields EXCEPT:
            // - HasAplus, AplusContent, AplusModuleCount (from Octoparse)
            // - RatingBreakdown (from Octoparse)

            await new sql.Request(transaction)
                .input('asinId', sql.VarChar, asinId)
                .input('title', sql.NVarChar(sql.MAX), extracted.title)
                .input('parentAsin', sql.NVarChar, extracted.parentAsin)
                .input('currentPrice', sql.Decimal(18, 2), extracted.priceAmount)
                .input('mrp', sql.Decimal(18, 2), extracted.mrpAmount)
                .input('discount', sql.Int, extracted.discountPercent)
                .input('mainImage', sql.NVarChar(sql.MAX), extracted.mainImage)
                .input('rating', sql.Decimal(3, 2), extracted.rating)
                .input('reviewCount', sql.Int, extracted.reviewCount)
                .input('mainBSR', sql.Int, extracted.mainBSR)
                .input('subBSR', sql.Int, extracted.subBSR)
                .input('subBSRCategory', sql.NVarChar(255), extracted.subBSRCategory)
                .input('mainCategory', sql.NVarChar, extracted.mainCategory)
                .input('subCategory', sql.NVarChar, extracted.subCategory)
                .input('categoryPath', sql.NVarChar(500), extracted.categoryPath)
                .input('brand', sql.NVarChar, extracted.brand)
                .input('seller', sql.NVarChar, extracted.seller)
                .input('sellerId', sql.NVarChar, extracted.sellerId)
                .input('availability', sql.NVarChar, extracted.availability)
                .input('imageCount', sql.Int, extracted.imageCount)
                .input('bulletPointCount', sql.Int, extracted.bulletPointCount)
                .input('bulletPoints', sql.NVarChar(sql.MAX), JSON.stringify(extracted.bulletPoints))
                .input('imagesJson', sql.NVarChar(sql.MAX), JSON.stringify([extracted.mainImage, ...extracted.variantImages].filter(Boolean)))
                .input('hasDeal', sql.Bit, extracted.hasDeal ? 1 : 0)
                .input('dealType', sql.NVarChar, extracted.dealType)
                .input('dealStartTime', sql.DateTime, extracted.dealStartTime)
                .input('dealEndTime', sql.DateTime, extracted.dealEndTime)
                .input('dealAccessType', sql.NVarChar, extracted.dealAccessType)
                .input('dealPercentClaimed', sql.NVarChar, extracted.dealPercentClaimed)
                .input('manufacturer', sql.NVarChar, extracted.manufacturer)
                .input('priceDispute', sql.Bit, priceDispute ? 1 : 0)
                .input('variantImages', sql.NVarChar(sql.MAX), JSON.stringify(extracted.variantImages))
                .input('dimensions', sql.NVarChar(sql.MAX), JSON.stringify(extracted.dimensions))
                .input('buyBoxes', sql.NVarChar(sql.MAX), JSON.stringify(extracted.buyBoxes))
                .input('soldBy', sql.NVarChar, extracted.soldBy)
                .input('soldBySec', sql.NVarChar, extracted.soldBySec)
                .input('buyBoxWin', sql.Bit, extracted.buyBoxWin ? 1 : 0)
                .input('allOffersJson', sql.NVarChar(sql.MAX), JSON.stringify(extracted.allOffers))
                .query(`
                    UPDATE Asins SET
                        Title = @title,
                        ParentAsin = @parentAsin,
                        CurrentPrice = @currentPrice,
                        Mrp = @mrp,
                        Category = @mainCategory,
                        Brand = @brand,
                        BSR = @mainBSR,
                        SubBSR = @subBSR,
                        SubBSRCategory = @subBSRCategory,
                        Rating = @rating,
                        ReviewCount = @reviewCount,
                        ImageUrl = @mainImage,
                        ImagesCount = @imageCount,
                        Images = @imagesJson,
                        BulletPoints = @bulletPointCount,
                        BulletPointsText = @bulletPoints,

                        SoldBy = @soldBy,
                        SoldBySec = @soldBySec,
                        BuyBoxWin = @buyBoxWin,
                        AllOffers = @allOffersJson,
                        SellerExternalId = @sellerId,
                        CategoryPath = @categoryPath,
                        VariantImages = @variantImages,
                        Dimensions = @dimensions,
                        BuyBoxes = @buyBoxes,
                        HasDeal = @hasDeal,
                        DealBadge = @dealType,
                        DealType = @dealType,
                        DealStartTime = @dealStartTime,
                        DealEndTime = @dealEndTime,
                        DealAccessType = @dealAccessType,
                        DealPercentClaimed = @dealPercentClaimed,
                        Manufacturer = @manufacturer,
                        PriceDispute = @priceDispute,
                        DiscountPercentage = @discount,
                        LastLiveSyncAt = dbo.GetEnvDate(),
                        LastSyncSource = 'LIVE',
                        Status = 'Active',
                        UpdatedAt = dbo.GetEnvDate(),
                        AvailabilityStatus = @availability
                    WHERE Id = @asinId
                `);

            // Insert into AsinHistory
            await new sql.Request(transaction)
                .input('asinId', sql.VarChar, asinId)
                .input('price', sql.Decimal(18, 2), extracted.priceAmount)
                .input('mrp', sql.Decimal(18, 2), extracted.mrpAmount)
                .input('bsr', sql.Int, extracted.mainBSR)
                .input('subBSR', sql.Int, extracted.subBSR)
                .input('rating', sql.Decimal(3, 2), extracted.rating)
                .input('reviewCount', sql.Int, extracted.reviewCount)
                .input('source', sql.NVarChar, 'LIVE')
                .query(`
                    INSERT INTO AsinHistory (
                        AsinId, Date, Price, BSR, SubBSR, Rating, ReviewCount, Source
                    )
                    VALUES (
                        @asinId, 
                        CAST(dbo.GetEnvDate() AS DATE), 
                        @price, 
                        @bsr, 
                        @subBSR,
                        @rating, 
                        @reviewCount, 
                        @source
                    )
                `);

            await transaction.commit();

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    // ============================================
    // Internal: Extract Fields from API response
    // Maps the actual Creators API JSON response format
    // ============================================
    _extractFields(item) {
        // ── Buy Box / Listing (Creators API uses offersV2.listings) ─────
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner)
            || item.offersV2?.listings?.[0]
            || item.buyBoxes?.find(b => b.isBuyBoxWinner)
            || item.buyBoxes?.[0];

        // ── Price (Creators API: offersV2.listings[].price.money.amount) ─
        const priceMoney = listing?.price?.money;
        const savingBasis = listing?.price?.savingBasis?.money;
        const savings = listing?.price?.savings;

        const priceAmount = priceMoney?.amount
            || listing?.priceAmount
            || this._parsePrice(item.price);
        const mrpAmount = savingBasis?.amount
            || listing?.mrpAmount
            || this._parsePrice(item.mrp);
        const discountPercent = savings?.percentage
            || this._parseDiscount(item.discount);

        // ── BSR (Creators API: rankings array format) ─────────────────────
        // API returns: ["#467556 in Unknown", "#578 in Washer Floor Trays"]
        // First = main BSR (website-wide), Second = sub BSR (category-specific)
        const rankings = item.rankings || [];
        const browseNodes = item.browseNodeInfo?.browseNodes || [];

        let mainBSR = null;
        let subBSR = null;
        let subBSRCategory = null;

        // Primary: Parse from rankings array (most reliable)
        if (rankings.length >= 2) {
            mainBSR = this._parseBSR(rankings[0]);
            subBSR = this._parseBSR(rankings[1]);
            subBSRCategory = this._parseBSRCategory(rankings[1]);
        } else if (rankings.length === 1) {
            mainBSR = this._parseBSR(rankings[0]);
        }

        // Fallback: Use browseNodeInfo.websiteSalesRank for main BSR
        if (!mainBSR && item.browseNodeInfo?.websiteSalesRank?.salesRank) {
            mainBSR = item.browseNodeInfo.websiteSalesRank.salesRank;
        }

        // Fallback: Use browseNodes for sub BSR
        if (!subBSR && browseNodes.length > 1) {
            for (const node of browseNodes) {
                if (node.salesRank && node.salesRank !== mainBSR && !subBSR) {
                    subBSR = node.salesRank;
                    subBSRCategory = node.contextFreeName;
                }
            }
        }

        // ── Category ────────────────────────────────────────────────────
        const categoryPath = item.category || browseNodes[0]?.contextFreeName || '';
        const pathParts = categoryPath.split(/[›>]/).filter(Boolean);

        // ── Customer Reviews ────────────────────────────────────────────
        const customerReviews = item.customerReviews || {};
        const rating = this._parseRating(customerReviews.starRating);
        const reviewCount = this._parseReviewCount(customerReviews.count);

        // ── Images (Creators API: images.primary.large.url) ─────────────
        const primaryImage = item.images?.primary?.large?.url
            || item.images?.primary?.medium?.url
            || item.images?.primary?.small?.url
            || item.mainImage
            || null;
        const variantImages = (item.images?.variants || []).map(v => v?.large?.url || v?.medium?.url || v?.url).filter(Boolean)
            || item.variantImages
            || [];

        // ── Deals (Creators API: from listing.dealDetails, NOT item.deals) ──
        const listingDealDetails = listing?.dealDetails || null;

        // Fallback: item.deals array (Octoparse format or alternative API)
        const itemDeals = item.deals || [];
        const itemDeal = Array.isArray(itemDeals) && itemDeals.length > 0 ? itemDeals[0] : null;

        // Use listing.dealDetails if present, else item.deals[0]
        const activeDeal = listingDealDetails || itemDeal;
        const hasDeal = !!(activeDeal && (
            activeDeal.badge || activeDeal.type || activeDeal.hasDeal ||
            activeDeal.dealType || activeDeal.dealBadge ||
            (activeDeal.startDate && activeDeal.endDate) ||
            (activeDeal.startTime && activeDeal.endTime)
        ));

        // ── Manufacturer ──────────────────────────────────────────────
        const manufacturer = item.itemInfo?.byLineInfo?.manufacturer?.displayValue
            || item.itemInfo?.byLineInfo?.brand?.displayValue
            || null;

        // ── Deal details with dates ──────────────────────────────────
        const dealBadge = (activeDeal?.badge || activeDeal?.type || activeDeal?.dealType || activeDeal?.dealBadge || null);

        let dealStartTime = null;
        let dealEndTime = null;

        if (hasDeal) {
            dealStartTime = activeDeal?.startDate ? new Date(activeDeal.startDate)
                : activeDeal?.startTime ? new Date(activeDeal.startTime)
                    : null;
            dealEndTime = activeDeal?.endDate ? new Date(activeDeal.endDate)
                : activeDeal?.endTime ? new Date(activeDeal.endTime)
                    : null;
        }

        const dealAccessType = activeDeal?.accessType || null;
        const dealPercentClaimed = activeDeal?.percentClaimed != null ? `${activeDeal.percentClaimed}%` : null;

        // ── Availability ────────────────────────────────────────────
        const availability = listing?.availability?.message
            || listing?.availability?.type
            || item.stock?.status
            || 'Unknown';

        const buyBoxes = (item.offersV2?.listings || item.buyBoxes || []).map(l => ({
            buyBoxNumber: l.buyBoxNumber || 1,
            isBuyBoxWinner: l.isBuyBoxWinner || false,
            seller: l.merchantInfo?.name || l.seller || null,
            sellerId: l.merchantInfo?.id || l.sellerId || null,
            price: l.price?.money?.displayAmount || l.price,
            priceAmount: l.price?.money?.amount || l.priceAmount,
            currency: l.price?.money?.currency || l.currency || 'INR',
            mrp: l.price?.savingBasis?.money?.displayAmount || l.mrp,
            mrpAmount: l.price?.savingBasis?.money?.amount || l.mrpAmount,
            savingsAmount: l.price?.savings?.money?.amount || l.savingsAmount,
            savingsPercentage: l.price?.savings?.percentage || l.savingsPercentage,
            condition: l.condition,
            conditionSub: l.condition?.subCondition || null,
            availability: l.availability?.type || l.availability,
            availabilityType: l.availabilityType,
            maxOrderQuantity: l.maxOrderQuantity,
            minOrderQuantity: l.minOrderQuantity,
            violatesMAP: l.violatesMAP || false,
            loyaltyPoints: l.loyaltyPoints?.points || null,
            type: l.type
        }));

        const buyBoxWinner = buyBoxes.find(b => b.isBuyBoxWinner) || buyBoxes[0];

        // ── New SDK fields ─────────────────────────────────────────
        const pi = item.itemInfo?.productInfo || {};
        const byLine = item.itemInfo?.byLineInfo || {};

        const brand = byLine.brand?.displayValue || null;
        const detailPageURL = item.detailPageURL || null;
        const score = item.score || null;
        const variationAttributes = (item.variationAttributes || []).map(v => ({
            name: v.name || null,
            value: v.value || null
        }));
        const externalIds = item.itemInfo?.externalIds || null;
        const color = pi.color?.displayValue || null;
        const size = pi.size?.displayValue || null;
        const releaseDate = pi.releaseDate?.displayValue || null;
        const unitCount = pi.unitCount?.value != null ? pi.unitCount.value : null;
        const isAdultProduct = pi.isAdultProduct?.value === true;

        const classifications = item.itemInfo?.classifications || null;
        const contentInfo = item.itemInfo?.contentInfo || null;
        const contentRating = item.itemInfo?.contentRating || null;
        const techInfo = item.itemInfo?.technicalInfo || null;

        // Build structured external IDs
        const extIds = externalIds ? {
            upcs: externalIds.upcs?.displayValues || [],
            eans: externalIds.eans?.displayValues || [],
            isbns: externalIds.isbns?.displayValues || []
        } : null;

        return {
            title: item.itemInfo?.title?.displayValue || item.productName || null,
            parentAsin: item.parentASIN || item.parentAsin || null,
            priceAmount,
            mrpAmount,
            discountPercent,
            availability,
            seller: listing?.merchantInfo?.name || listing?.seller || null,
            sellerId: listing?.merchantInfo?.id || listing?.sellerId || null,
            rating,
            reviewCount,
            mainCategory: pathParts[0] || null,
            subCategory: pathParts[pathParts.length - 1] || null,
            categoryPath,
            mainBSR,
            subBSR,
            subBSRCategory,
            mainImage: primaryImage,
            imageCount: variantImages.length + (primaryImage ? 1 : 0),
            bulletPoints: item.itemInfo?.features?.displayValues || item.bulletPoints || [],
            bulletPointCount: item.itemInfo?.features?.displayValues?.length || item.bulletPointsCount || item.bulletPoints?.length || 0,
            hasDeal,
            dealType: dealBadge,
            dealStartTime,
            dealEndTime,
            dealAccessType,
            dealPercentClaimed,
            manufacturer,
            brand,
            variantImages,
            dimensions: item.dimensions || null,
            buyBoxes,
            soldBy: buyBoxWinner?.seller || listing?.merchantInfo?.name || null,
            soldBySec: buyBoxes.find(b => !b.isBuyBoxWinner && b.seller)?.seller || null,
            buyBoxWin: buyBoxes.some(b => b.isBuyBoxWinner),
            allOffers: buyBoxes.map(b => ({
                seller: b.seller,
                price: b.priceAmount || 0,
                isBuyBoxWinner: b.isBuyBoxWinner
            })),
            detailPageURL,
            score,
            variationAttributes,
            externalIds: extIds,
            color,
            size,
            releaseDate,
            unitCount,
            isAdultProduct,
            classifications,
            contentInfo,
            contentRating,
            technicalInfo: techInfo
        };
    }

    // Parse BSR from ranking string like "#367 in Unknown"
    _parseBSR(rankStr) {
        if (!rankStr) return null;
        const match = rankStr.match(/#([\d,]+)/);
        if (!match) return null;
        return parseInt(match[1].replace(/,/g, ''), 10) || null;
    }

    // Parse category name from ranking string like "#578 in Washer Floor Trays"
    _parseBSRCategory(rankStr) {
        if (!rankStr) return null;
        const match = rankStr.match(/in\s+(.+)$/);
        return match ? match[1].trim() : null;
    }

    // Parse price from "₹599.00" format
    _parsePrice(priceStr) {
        if (!priceStr) return null;
        if (typeof priceStr === 'number') return priceStr;
        const match = priceStr.replace(/,/g, '').match(/([\d.]+)/);
        return match ? parseFloat(match[1]) : null;
    }

    // Parse discount from "-88%" format
    _parseDiscount(discountStr) {
        if (!discountStr) return null;
        const match = discountStr.match(/(-?\d+)/);
        return match ? Math.abs(parseInt(match[1], 10)) : null;
    }

    // Parse rating from Amazon API response (can be number, string, or object with value)
    _parseRating(ratingData) {
        if (!ratingData) return null;
        if (typeof ratingData === 'number') return ratingData;
        if (typeof ratingData === 'string') {
            const parsed = parseFloat(ratingData);
            return isNaN(parsed) ? null : parsed;
        }
        if (ratingData.value !== undefined) return parseFloat(ratingData.value) || null;
        if (ratingData.starRating !== undefined) return parseFloat(ratingData.starRating) || null;
        return null;
    }

    // Parse review count from Amazon API response (can be number, string, or object with value)
    _parseReviewCount(countData) {
        if (!countData) return null;
        if (typeof countData === 'number') return Math.round(countData);
        if (typeof countData === 'string') {
            const cleaned = countData.replace(/[,]/g, '');
            const parsed = parseInt(cleaned, 10);
            return isNaN(parsed) ? null : parsed;
        }
        if (countData.value !== undefined) return Math.round(parseFloat(countData.value)) || null;
        if (countData.count !== undefined) return Math.round(parseFloat(countData.count)) || null;
        return null;
    }

    _getResources() {
        return [
            'itemInfo.title',
            'itemInfo.features',
            'itemInfo.productInfo',
            'itemInfo.byLineInfo',
            'itemInfo.classifications',
            'itemInfo.contentInfo',
            'itemInfo.contentRating',
            'itemInfo.externalIds',
            'itemInfo.manufactureInfo',
            'itemInfo.technicalInfo',
            'itemInfo.tradeInInfo',
            'images.primary.small',
            'images.primary.medium',
            'images.primary.large',
            'images.primary.highRes',
            'images.variants.small',
            'images.variants.medium',
            'images.variants.large',
            'images.variants.highRes',
            'offersV2.listings.price',
            'offersV2.listings.availability',
            'offersV2.listings.condition',
            'offersV2.listings.merchantInfo',
            'offersV2.listings.dealDetails',
            'offersV2.listings.isBuyBoxWinner',
            'offersV2.listings.loyaltyPoints',
            'offersV2.listings.type',
            'customerReviews.count',
            'customerReviews.starRating',
            'browseNodeInfo.browseNodes',
            'browseNodeInfo.browseNodes.ancestor',
            'browseNodeInfo.browseNodes.salesRank',
            'browseNodeInfo.websiteSalesRank',
            'parentASIN'
        ];
    }

    async _triggerPostSync(sellerId, allAsins) {
        try {
            console.log(`Running post-sync operations for seller: ${sellerId}`);
            for (const asin of allAsins) {
                try {
                    await listingQualityService.analyzeAndSaveFull(asin.Id);
                } catch (e) {
                    console.error(`LQS analysis failed for ASIN ${asin.Id}:`, e.message);
                }
            }

            // Rulesets/Alerts engine execution if present
            try {
                if (rulesetEngineService && typeof rulesetEngineService.runForSeller === 'function') {
                    await rulesetEngineService.runForSeller(sellerId);
                }
            } catch (e) {
                console.error(`RulesetEngineService run failed for seller ${sellerId}:`, e.message);
            }
        } catch (e) {
            console.error('Post-sync actions failed:', e);
        }
    }

    async _logSync(sellerId, stats) {
        try {
            // Fetch seller name for human-readable log
            let sellerName = sellerId;
            try {
                const pool = await getPool();
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* use sellerId as fallback */ }

            await SystemLogService.log({
                type: 'LIVE_SYNC',
                entityType: 'SELLER',
                entityId: sellerId,
                entityTitle: sellerName,
                description: `Live data sync completed for ${sellerName}. Total: ${stats.totalAsins}, Success: ${stats.successCount}, Failed: ${stats.failedCount}, Duration: ${(stats.duration / 1000).toFixed(1)}s`,
                metadata: { ...stats, sellerName }
            });
        } catch (e) {
            console.error('Logging sync failed:', e);
        }
    }

    // ============================================
    // Re-sync only failed ASINs (called after main sync)
    // ============================================
    async _resyncFailedAsins(sellerId, failedCodes) {
        const pool = await getPool();
        const startTime = Date.now();
        const stats = {
            sellerId,
            syncType: 'RE_SYNC',
            totalAsins: failedCodes.length,
            successCount: 0,
            failedCount: 0,
            failedAsinCodes: [],
            errors: []
        };

        try {
            console.log(`🔄 Re-sync: Starting for ${failedCodes.length} failed ASINs...`);

            const request = pool.request()
                .input('sellerId', sql.VarChar, sellerId);
            failedCodes.forEach((code, i) => request.input(`code${i}`, sql.VarChar, code));
            const asinsResult = await request.query(`
                    SELECT Id, AsinCode, UploadedPrice
                    FROM Asins 
                    WHERE SellerId = @sellerId 
                    AND AsinCode IN (${failedCodes.map((_, i) => `@code${i}`).join(',')})
                `);
            const asinsToRetry = asinsResult.recordset;

            if (asinsToRetry.length === 0) {
                console.log(`🔄 Re-sync: No ASINs found to retry`);
                return;
            }

            const batches = this._createBatches(asinsToRetry, this._config.maxPerRequest);

            for (const batch of batches) {
                const credId = this._selectBestCred();
                if (!credId) {
                    console.log(`⛔ Re-sync: No available credential (all throttled or TPD exhausted), skipping remaining`);
                    stats.failedCount += batch.length;
                    batch.forEach(a => stats.failedAsinCodes.push(a.AsinCode));
                    continue;
                }
                try {
                    await this._processBatch(sellerId, batch, credId, stats);
                } catch (e) {
                    stats.errors.push({ error: e.message });
                    batch.forEach(a => stats.failedAsinCodes.push(a.AsinCode));
                }
            }
            stats.duration = Date.now() - startTime;

            console.log(`🔄 Re-sync complete: Seller ${sellerId}`, {
                success: stats.successCount,
                failed: stats.failedCount,
                duration: `${(stats.duration / 1000).toFixed(2)}s`
            });

            // Emit socket events for UI refresh
            try {
                const SocketService = require('./socketService');
                const io = SocketService.getIo();
                if (io) {
                    io.emit('liveSync:reSyncCompleted', {
                        sellerId,
                        retried: failedCodes.length,
                        successCount: stats.successCount,
                        failedCount: stats.failedCount,
                        failedAsinCodes: stats.failedAsinCodes,
                        duration: stats.duration
                    });
                    io.emit('ASINS_UPDATED', { sellerId });
                }
            } catch (e) { console.error('Socket emission error:', e.message); }

            // Log re-sync
            let sellerName = sellerId;
            try {
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* fallback */ }

            await SystemLogService.log({
                type: 'RE_SYNC',
                entityType: 'SELLER',
                entityId: sellerId,
                entityTitle: sellerName,
                description: `Re-sync of ${failedCodes.length} failed ASINs for ${sellerName}. Success: ${stats.successCount}, Still Failed: ${stats.failedCount}, Duration: ${(stats.duration / 1000).toFixed(1)}s${stats.failedAsinCodes.length > 0 ? '. Still failed: ' + stats.failedAsinCodes.slice(0, 5).join(', ') + (stats.failedAsinCodes.length > 5 ? '...' : '') : ''}`,
                metadata: { ...stats, sellerName, failedAsinCodes: stats.failedAsinCodes }
            });

            // Notify users about re-sync result
            const failedStill = stats.failedAsinCodes.length;
            const reSyncMsg = failedStill === 0
                ? `✅ Re-sync successful! All ${stats.successCount} previously failed ASINs for ${sellerName} are now synced.`
                : `⚠️ Re-sync for ${sellerName}: ${stats.successCount} recovered, ${failedStill} still failing. ASINs: ${stats.failedAsinCodes.slice(0, 3).join(', ')}${failedStill > 3 ? '...' : ''}`;

            await this._sendNotificationToAllAdmins('RE_SYNC', sellerId, sellerName, reSyncMsg);

        } catch (error) {
            console.error(`🔄 Re-sync error for seller ${sellerId}:`, error.message);
            await SystemLogService.log({
                type: 'RE_SYNC_ERROR',
                entityType: 'SELLER',
                entityId: sellerId,
                entityTitle: sellerId,
                description: `Re-sync failed for seller ${sellerId}: ${error.message}`,
                metadata: { error: error.message, failedCodes }
            });
        }
    }

    // ============================================
    // Notify users about sync result
    // ============================================
    async _notifySyncResult(sellerId, stats) {
        try {
            let sellerName = sellerId;
            try {
                const pool = await getPool();
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* fallback */ }

            const message = stats.failedCount === 0
                ? `✅ Live sync completed for ${sellerName}. All ${stats.successCount} ASINs updated successfully.`
                : `⚠️ Live sync for ${sellerName}: ${stats.successCount} updated, ${stats.failedCount} failed. Re-sync scheduled in 30s for ${stats.failedCount} failed ASINs.`;

            await this._sendNotificationToAllAdmins('LIVE_SYNC', sellerId, sellerName, message);
        } catch (e) {
            console.error('Failed to send sync notification:', e.message);
        }
    }

    // ============================================
    // Helper: Send notification to all active users
    // ============================================
    async _sendNotificationToAllAdmins(type, referenceId, referenceTitle, message) {
        try {
            const pool = await getPool();
            const users = await pool.request().query('SELECT Id FROM Users WHERE IsActive = 1');

            for (const user of users.recordset) {
                await notificationController.createNotification(
                    user.Id,
                    type,
                    'Seller',
                    referenceId,
                    message
                );
            }
        } catch (e) {
            console.error('Failed to send admin notifications:', e.message);
        }
    }

    _createBatches(items, size) {
        const batches = [];
        for (let i = 0; i < items.length; i += size) {
            batches.push(items.slice(i, i + size));
        }
        return batches;
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new LiveDataSyncService();
