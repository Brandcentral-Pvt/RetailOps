const { sql, getPool } = require('../database/db');
const CreatorsApiSdk = require('../lib/creatorsapi-sdk/index');
const creatorsApiRateGate = require('./creatorsApiRateGate');
const SystemLogService = require('./SystemLogService');
const notificationController = require('../controllers/notificationController');
const listingQualityService = require('./listingQualityService');
const rulesetEngineService = require('./rulesetEngineService');
const playwrightScraperService = require('./playwrightScraperService');
const asinCompletenessService = require('./asinCompletenessService');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');
const EventEmitter = require('events');

// Transient account-level Creators API conditions (TPD exhausted, throttled,
// no healthy credential). These must NOT count batches as 'failed' — the
// caller pauses the seller and lets the completeness loop resume it later.
function creatorsTransient(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function omitZero(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (v > 0) out[k] = v;
    }
    return out;
}

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
            scraperEnrichment: process.env.LIVE_SYNC_SCRAPER_ENRICHMENT === 'true',
            scraperTimeout: parseInt(process.env.LIVE_SYNC_SCRAPER_TIMEOUT || '25000', 10),
        };

        this._sdkClients = new Map();          // credId -> DefaultApi instance (cached SDK client)
        this._credThrottledUntil = new Map();  // credId -> timestamp when throttling ends
        this.activeSyncs = new Map();
        this._globalSyncRunning = false;
        this._globalSyncProgress = null;       // progress tracking for global sync
        this._globalSyncAborted = false;       // abort flag for global sync
        this._pendingScrapes = new Set();   // in-flight scraper enrichment / full-scrape promises
    }

    // Rate limiter — 1 req/sec per account, coordinated across ALL processes
    // and callers by the shared creatorsApiRateGate (Redis token bucket).
    async _rateLimit() {
        await creatorsApiRateGate.waitForTps('primary');
    }

    // Track TPD in the durable daily ledger and adapt TPS if API lowers it
    _updateRateFromHeader(headers, credId) {
        creatorsApiRateGate.setPolicyFromHeader(headers);
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

        // Cross-PM2-instance guard: the same seller must never be synced by two
        // workers at once (that doubles RPM usage against one Amazon account).
        const sellerLock = await creatorsApiRateGate.acquireLock(`syncseller:${sellerIdStr}`, {
            ttlMs: 8 * 60 * 60 * 1000,
            maxWaitMs: 3000,
            retryMs: 800,
        });
        if (!sellerLock) {
            return {
                error: 'Live sync already in progress for this seller (another instance)',
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
            pendingAsinCodes: [],
            pausedReason: null,
            pausedMessage: null,
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

            // Optional scope: re-sync ONLY the passed-in ASIN codes (used by the
            // completeness loop to finish the gaps instead of re-doing the seller).
            const { asinCodes } = options;
            const scopedAsins = (asinCodes && asinCodes.length)
                ? allAsins.filter((a) => asinCodes.includes(a.AsinCode))
                : allAsins;

            stats.totalAsins = scopedAsins.length;

            if (scopedAsins.length === 0) {
                throw new Error('No active ASINs found for this seller');
            }

            // 1b. Fetch seller name once for this sync (used for BuyBox winner logic)
            let sellerName = sellerIdStr;
            try {
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerIdStr)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* use sellerId as fallback */ }

            console.log(`Live sync: Seller ${sellerIdStr} (${sellerName}) - ${allAsins.length} ASINs`);

            this.emit('liveSync:started', {
                sellerId: sellerIdStr,
                totalAsins: allAsins.length
            });

            // 2. Create batches (from the scoped set when this is a completeness pass)
            const batches = this._createBatches(scopedAsins, this._config.maxPerRequest);
            const totalBatches = batches.length;

            // 3. Process batches SEQUENTIALLY (Amazon API: 1 TPS per account).
            //    Account-level transients (TPD exhausted / throttled / no credential)
            //    PAUSE the seller instead of burning its ASINs as 'failed' — the
            //    completeness loop picks the remaining ASINs up on the next attempt.
            let completedCount = 0;

            for (const batch of batches) {
                if (this._globalSyncAborted) break;

                const credId = this._selectBestCred();
                if (!credId) {
                    console.error(`⛔ No available credential (all throttled or TPD exhausted)`);
                    stats.pausedReason = 'NO_CREDENTIAL';
                    stats.pausedMessage = 'No available credential (all throttled or TPD exhausted)';
                    for (const asinRecord of batch) {
                        stats.pendingAsinCodes.push(asinRecord.AsinCode);
                    }
                    break;
                }

                try {
                    await this._processBatch(sellerIdStr, batch, credId, stats, sellerName);
                    completedCount++;

                    const progress = Math.round((completedCount / totalBatches) * 100);
                    this.emit('liveSync:progress', {
                        sellerId: sellerIdStr,
                        progress,
                        processed: completedCount,
                        total: totalBatches
                    });
                } catch (e) {
                    if (e.code === 'CREATORS_TPD' || e.code === 'CREATORS_THROTTLED') {
                        stats.pausedReason = e.code;
                        stats.pausedMessage = e.message;
                        for (const asinRecord of batch) {
                            stats.pendingAsinCodes.push(asinRecord.AsinCode);
                        }
                        console.log(`  ⏸️ Pausing seller ${sellerIdStr} sync (${e.code}): ${e.message}. ${stats.pendingAsinCodes.length} ASIN(s) deferred.`);
                        break;
                    }
                    stats.errors.push({ batch: completedCount, error: e.message });
                    for (const asinRecord of batch) {
                        stats.failedCount++;
                        stats.failedAsinCodes.push(asinRecord.AsinCode);
                    }
                    console.log(`  ⏳ Batch failed: ${e.message}`);
                }
            }

            // Wait for queued scraper enrichment / full-scrape applies so
            // post-sync analysis and completion reflect the final scraped data.
            if (this._pendingScrapes.size > 0) {
                const pending = [...this._pendingScrapes];
                console.log(`   Waiting for ${pending.length} scraper queue item(s) to apply...`);
                await Promise.allSettled(pending);
            }

            stats.duration = Date.now() - startTime;

            if (stats.pausedReason) {
                console.log(`Live sync PAUSED: Seller ${sellerIdStr} ({ stats }), ${stats.pendingAsinCodes.length} ASINs deferred until account recovers`);
            } else {
                console.log(`Live sync complete: Seller ${sellerIdStr}`, {
                    success: stats.successCount,
                    failed: stats.failedCount,
                    duration: `${(stats.duration / 1000).toFixed(2)}s`
                });
            }

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

            // 8. If there are failed ASINs (real/per-ASIN failures), schedule auto-retry.
            //    Skip when the run was paused for TPD/throttle — retrying mid-cooldown
            //    is what caused the 429 cascade; the completeness loop resumes later.
            if (stats.failedAsinCodes.length > 0 && !stats.pausedReason) {
                const failedCodes = [...stats.failedAsinCodes];
                console.log(`🔄 Scheduling re-sync for ${failedCodes.length} failed ASINs in 10s...`);

                setTimeout(async () => {
                    try {
                        await this._resyncFailedAsins(sellerIdStr, failedCodes);
                    } catch (reSyncErr) {
                        console.error(`Re-sync of failed ASINs error:`, reSyncErr.message);
                    }
                }, 10000);
            } else if (stats.pausedReason) {
                console.log(`⏸️ Skipping failed-ASIN re-sync (paused: ${stats.pausedReason}).`);
            }

            // 9. Notify users about sync results
            await this._notifySyncResult(sellerIdStr, stats);

            stats.completedAt = new Date().toISOString();
            stats.status = 'COMPLETED';
            this.emit('liveSync:completed', stats);

            return {
                success: stats.pausedReason ? false : true,
                sellerId: sellerIdStr,
                totalAsins: stats.totalAsins,
                updatedAsins: stats.successCount,
                failedAsins: stats.failedCount,
                failedAsinCodes: stats.failedAsinCodes,
                pendingAsinsCount: stats.pendingAsinCodes.length,
                pendingAsinCodes: stats.pendingAsinCodes,
                pausedReason: stats.pausedReason || null,
                pausedMessage: stats.pausedMessage || null,
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
            await creatorsApiRateGate.releaseLock(`syncseller:${sellerIdStr}`, sellerLock);
        }
    }

    // ============================================
    // GLOBAL: Sync All Sellers (parallel batching)
    // ============================================
    async syncAllSellers(options = {}) {
        const { 
            concurrency = this._config.maxConcurrency, 
            sellerIds = null, 
            maxRetries = 2,
            globalTimeoutMs = 2 * 60 * 60 * 1000 // 2 hours default
        } = options;
        const startTime = Date.now();

        // Prevent duplicate global sync (in-process).
        if (this._globalSyncRunning) {
            return { error: 'Global live sync already in progress', status: 'IN_PROGRESS' };
        }
        this._globalSyncRunning = true;

        // Cross-PM2-instance guard: only ONE worker may run the global sync —
        // otherwise every PM2 instance runs the same seller list -> N× RPM.
        const globalLock = await creatorsApiRateGate.acquireLock('syncAllSellers', {
            ttlMs: 90 * 60 * 1000,
            maxWaitMs: 3000,
            retryMs: 1000,
        });
        if (!globalLock) {
            this._globalSyncRunning = false;
            return { error: 'Global live sync already in progress (another instance)', status: 'IN_PROGRESS' };
        }

        // Global progress tracking (for status endpoint)
        this._globalSyncProgress = {
            totalSellers: 0,
            processedSellers: 0,
            currentSeller: null,
            startTime,
            status: 'STARTING',
        };

        // Global timeout safety net
        let globalTimeout = setTimeout(() => {
            console.error('⚡ Global live sync TIMEOUT — aborting');
            this._globalSyncAborted = true;
        }, globalTimeoutMs);

        try {
            const pool = await getPool();

            // Get all active sellers with Amazon ASINs, ordered by how many ASINs are
            // still incomplete (worst first) so an interrupted run resumes the
            // sellers that need the most work — and a fully-done seller is never
            // touched before an incomplete one.
            const hardPredicate = asinCompletenessService.buildHardPredicate();
            let sellersQuery = `
                SELECT s.Id, s.Name,
                       COUNT(a.Id) as AsinCount,
                       COUNT(a.Id) - ISNULL(SUM(CASE WHEN (${hardPredicate}) THEN 1 ELSE 0 END), 0) AS IncompleteCount
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
            sellersQuery += `
                ORDER BY (COUNT(a.Id) - ISNULL(SUM(CASE WHEN (${hardPredicate}) THEN 1 ELSE 0 END), 0)) DESC, s.Name
            `;

            const sellersResult = await request.query(sellersQuery);
            const sellers = sellersResult.recordset;

            console.log(`⚡ Live sync all: ${sellers.length} sellers (${sellers.reduce((s, v) => s + v.AsinCount, 0)} ASINs)`);
            console.log(`   Config: concurrency=${concurrency}, retries=${maxRetries}, delay=${this._config.sellerDelay}ms, timeout=${globalTimeoutMs}ms`);
            this.emit('liveSyncAll:started', { totalSellers: sellers.length });

            this._globalSyncProgress.totalSellers = sellers.length;
            this._globalSyncProgress.status = 'RUNNING';

            const results = [];

            // ── One seller at a time, COMPLETENESS-GATED ───────────────────
            // Each seller is synced until every active ASIN meets the completeness
            // predicate (or the bounded per-seller attempt cap is hit), and only
            // then do we move to the next seller. Concurrency is forced to 1
            // (config default) so RPM is never multiplied across sellers.
            const maxSellerAttempts = parseInt(process.env.LIVE_SYNC_MAX_SELLER_ATTEMPTS || '2', 10);
            const sellerDelay = this._config.sellerDelay;
            const hardCapReached = globalTimeoutMs ? startTime + globalTimeoutMs : null;

            let processedSellers = 0;
            for (const seller of sellers) {
                if (this._globalSyncAborted) {
                    console.warn('⚡ Global sync aborted — stopping seller loop');
                    break;
                }
                if (hardCapReached && Date.now() > hardCapReached) {
                    console.warn(`⚡ Global sync timeout (${(globalTimeoutMs / 60000).toFixed(0)}min) reached — stopping seller loop`);
                    break;
                }

                if (processedSellers > 0) {
                    await this._delay(sellerDelay); // 2s breathing room between sellers
                }

                processedSellers++;
                const progress = `[${processedSellers}/${sellers.length}]`;
                this._globalSyncProgress.processedSellers = processedSellers;
                this._globalSyncProgress.currentSeller = { name: seller.Name, id: seller.Id, asinCount: seller.AsinCount, attempt: 0 };

                // 1) The main live sync pass (with retry-on-fatal).
                let sellerResult = null;
                let lastError = null;
                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                        if (attempt > 0) {
                            console.log(`  ${progress} 🔄 ${seller.Name} — retry ${attempt}/${maxRetries}`);
                            this._globalSyncProgress.currentSeller.attempt = attempt;
                            await this._delay(this._config.retryDelay);
                        }
                        sellerResult = await this.syncSellerLiveData(seller.Id);
                        break;
                    } catch (err) {
                        lastError = err;
                        console.warn(`  ${progress} ⚠️  ${seller.Name}: attempt ${attempt + 1}/${maxRetries} failed — ${err.message}`);
                    }
                }

                if (!sellerResult) {
                    results.push({ sellerId: seller.Id, name: seller.Name, status: 'FAILED', error: lastError?.message, retries: maxRetries });
                    continue;
                }

                // TPD is permanent for the day — don't waste completeness retries.
                if (sellerResult.pausedReason === 'CREATORS_TPD') {
                    console.log(`  ${progress} ⏸️  ${seller.Name}: TPD exhausted, deferring remaining ${sellerResult.pendingAsinsCount || 0} ASIN(s) to a later run.`);
                    results.push({
                        sellerId: seller.Id, name: seller.Name,
                        status: 'PARTIAL', pausedReason: 'CREATORS_TPD',
                        updated: sellerResult.updatedAsins || 0, failed: sellerResult.failedAsins || 0,
                        pending: sellerResult.pendingAsinsCount || 0,
                        duration: sellerResult.duration || 0
                    });
                    continue;
                }

                // 2) Completeness gate: keep refining THIS seller (only its gaps)
                //    until complete or the attempt cap is exhausted.
                let completeness = await asinCompletenessService.getSellerCompleteness(seller.Id);
                let completenessAttempt = 0;
                while (completeness.incomplete > 0 && completenessAttempt < maxSellerAttempts) {
                    if (this._globalSyncAborted) break;
                    if (hardCapReached && Date.now() > hardCapReached) break;
                    completenessAttempt++;
                    this._globalSyncProgress.currentSeller.attempt = maxRetries + completenessAttempt;

                    const incompleteAsins = await asinCompletenessService.listIncompleteAsins(seller.Id, { limit: 500 });
                    if (incompleteAsins.length === 0) break;

                    console.log(`  ${progress} 🔁 ${seller.Name} — completeness pass ${completenessAttempt}/${maxSellerAttempts}: re-syncing ${incompleteAsins.length} incomplete ASIN(s)`);
                    try {
                        await this.syncSellerLiveData(seller.Id, { asinCodes: incompleteAsins.map((a) => a.AsinCode) });
                    } catch (err) {
                        console.warn(`  ${progress} ⚠️  ${seller.Name} completeness pass ${completenessAttempt} failed: ${err.message}`);
                    }
                    completeness = await asinCompletenessService.getSellerCompleteness(seller.Id);
                }

                const missing = await asinCompletenessService.getMissingFieldBreakdown(seller.Id);
                console.log(`  ${progress} ${completeness.incomplete === 0 ? '✅' : '⚠️'} ${seller.Name}: ${completeness.complete}/${completeness.total} ASINs complete (${completeness.percent}%)${completeness.incomplete > 0 ? `, ${completeness.incomplete} still incomplete; missing ${JSON.stringify(omitZero(missing))}` : ''} in ${((sellerResult.duration || 0) / 1000).toFixed(1)}s`);

                results.push({
                    sellerId: seller.Id,
                    name: seller.Name,
                    status: completeness.incomplete > 0 ? 'PARTIAL' : 'SUCCESS',
                    updated: sellerResult.updatedAsins || 0,
                    failed: sellerResult.failedAsins || 0,
                    pending: sellerResult.pendingAsinsCount || 0,
                    pausedReason: sellerResult.pausedReason || null,
                    completeAsins: completeness.complete,
                    totalAsins: completeness.total,
                    incompleteAsins: completeness.incomplete,
                    completePercent: completeness.percent,
                    missingFields: missing,
                    duration: sellerResult.duration || 0
                });
            }

            const totalDuration = Date.now() - startTime;
            const totalAsinsAll = results.reduce((sum, r) => sum + (r.totalAsins || 0), 0);
            const completeAsinsAll = results.reduce((sum, r) => sum + (r.completeAsins || 0), 0);
            const summary = {
                totalSellers: sellers.length,
                success: results.filter(r => r.status === 'SUCCESS').length,
                partial: results.filter(r => r.status === 'PARTIAL').length,
                failed: results.filter(r => r.status === 'FAILED').length,
                skipped: results.filter(r => r.status === 'SKIPPED').length,
                totalAsinsUpdated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
                totalAsins: totalAsinsAll,
                totalAsinsComplete: completeAsinsAll,
                completenessPercent: totalAsinsAll > 0 ? +((completeAsinsAll / totalAsinsAll) * 100).toFixed(1) : 100,
                duration: totalDuration,
                completedAt: new Date().toISOString()
            };

            console.log(`⚡ Live sync complete: ${summary.success}/${summary.totalSellers} sellers complete, ${summary.partial} partial, ${summary.failed} failed, ${completeAsinsAll}/${totalAsinsAll} ASINs complete (${summary.completenessPercent}%), ${summary.totalAsinsUpdated} updated in ${(totalDuration / 1000).toFixed(1)}s`);
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
            clearTimeout(globalTimeout);
            this._globalSyncRunning = false;
            this._globalSyncAborted = false;
            await creatorsApiRateGate.releaseLock('syncAllSellers', globalLock);
            this._globalSyncProgress = {
                ...this._globalSyncProgress,
                status: 'COMPLETED',
                currentSeller: null,
                completedAt: new Date().toISOString()
            };
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

        // Prefer non-throttled credentials (TPD is account-wide, tracked by the rate gate)
        const now = Date.now();
        let best = null;
        let bestTpd = Infinity;

        for (const cred of healthy) {
            if (this._credThrottledUntil.get(cred.id) === Infinity) continue; // TPD exhausted permanently
            if ((this._credThrottledUntil.get(cred.id) || 0) > now) continue; // Temporarily throttled

            // Prefer least recently used healthy cred; TPD is shared account-wide.
            const tpd = now - (cred.lastUsed || 0);
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
    // Internal: Playwright Scraper Enrichment for a batch
    // Scrapes rating, reviewCount, hasAplus concurrently (or FULL product data
    // when opts.full=true) for API-inaccessible ASINs. Concurrency is capped by
    // the scraper service semaphore (SCRAPER_CONCURRENT_PAGES). Never throws —
    // failures are collected as missing entries. Returns Map<asinCode, data>.
    // ============================================
    async _scrapeEnrichmentBatch(codes, opts = {}) {
        const results = new Map();
        const errors = new Map();
        await Promise.allSettled(
            codes.map(async (code) => {
                try {
                    const r = await playwrightScraperService.scrapeAsin(code, opts);
                    if (r && r.title) {
                        results.set(code, opts.full ? r : {
                            rating: r.rating ?? null,
                            reviewCount: r.reviewCount ?? null,
                            hasAplus: r.hasAplus ?? false,
                        });
                    } else {
                        errors.set(code, 'NO_TITLE');
                    }
                } catch (e) {
                    errors.set(code, e.message);
                }
            }),
        );
        return { results, errors };
    }

    // ============================================
    // Internal: Apply scraped rating/review/hasAplus to Asins + today's history
    // Runs AFTER the API batch write, so scraped values always win without
    // clobbering API-provided fields.
    // ============================================
    async _applyScrapeEnrichment(results) {
        if (!(results instanceof Map) || results.size === 0) return;
        for (const [code, d] of results) {
            try {
                const pool = await getPool();
                await pool.request()
                    .input('asin', sql.NVarChar, code)
                    .input('rating', sql.Decimal(3, 2), d.rating)
                    .input('reviewCount', sql.Int, d.reviewCount)
                    .input('hasAplus', sql.Bit, d.hasAplus)
                    .query(`
                        UPDATE Asins SET
                            Rating = ISNULL(@rating, Rating),
                            ReviewCount = ISNULL(@reviewCount, ReviewCount),
                            HasAplus = ISNULL(@hasAplus, HasAplus),
                            LastScrapedAt = dbo.GetEnvDate(),
                            LastSyncSource = 'LIVE',
                            UpdatedAt = dbo.GetEnvDate()
                        WHERE AsinCode = @asin
                    `);
                await pool.request()
                    .input('asin', sql.NVarChar, code)
                    .input('rating', sql.Decimal(3, 2), d.rating)
                    .input('reviewCount', sql.Int, d.reviewCount)
                    .query(`
                        UPDATE h SET
                            Rating = ISNULL(@rating, h.Rating),
                            ReviewCount = ISNULL(@reviewCount, h.ReviewCount)
                        FROM AsinHistory h
                        INNER JOIN Asins a ON a.Id = h.AsinId
                        WHERE a.AsinCode = @asin
                          AND CAST(h.Date AS DATE) = CAST(dbo.GetEnvDate() AS DATE)
                    `);
            } catch (e) {
                console.warn(`  ⚠ Scrape enrichment apply failed for ${code}: ${e.message}`);
            }
        }
    }

    // ============================================
    // Internal: Write FULL scraped product data (API-inaccessible ASINs)
    // ============================================
    async _applyFullScrape(results) {
        if (!(results instanceof Map) || results.size === 0) return;
        for (const [code, d] of results) {
            try {
                const pool = await getPool();
                const row = await pool.request()
                    .input('asin', sql.NVarChar, code)
                    .query('SELECT Id FROM Asins WHERE AsinCode = @asin');
                if (!row.recordset[0]) continue;

                const hasDeal = !!(d.dealBadge && d.dealBadge.trim() && !/no deal/i.test(d.dealBadge));
                const dealBadge = (d.dealBadge ?? '').toString().trim().slice(0, 100);
                await pool.request()
                    .input('id', sql.VarChar, row.recordset[0].Id)
                    .input('title', sql.NVarChar(sql.MAX), d.title)
                    .input('currentPrice', sql.Decimal(18, 2), d.currentPrice)
                    .input('mrp', sql.Decimal(18, 2), d.mrp)
                    .input('discount', sql.Int, d.discountPercentage)
                    .input('rating', sql.Decimal(3, 2), d.rating)
                    .input('reviewCount', sql.Int, d.reviewCount)
                    .input('hasAplus', sql.Bit, d.hasAplus ? 1 : 0)
                    .input('mainImage', sql.NVarChar(sql.MAX), d.imageUrl)
                    .input('imageCount', sql.Int, d.imagesCount)
                    .input('mainCategory', sql.NVarChar, d.category)
                    .input('brand', sql.NVarChar, d.brand)
                    .input('availability', sql.NVarChar, d.availability)
                    .input('soldBy', sql.NVarChar, d.soldBy)
                    .input('hasDeal', sql.Bit, hasDeal ? 1 : 0)
                    .input('dealBadge', sql.NVarChar, dealBadge)
                    .input('dealType', sql.NVarChar, dealBadge.slice(0, 50))
                    .input('mainBSR', sql.Int, d.bsr)
                    .input('subBSR', sql.Int, d.subBsr)
                    .input('subBSRCategory', sql.NVarChar(255), d.subBsrCategory)
                    .input('bulletPointCount', sql.Int, Array.isArray(d.bulletPoints) ? d.bulletPoints.length : 0)
                    .input('bulletPoints', sql.NVarChar(sql.MAX), Array.isArray(d.bulletPoints) ? JSON.stringify(d.bulletPoints) : (d.bulletPointsText || null))
                    .input('description', sql.NVarChar(sql.MAX), d.description || null)
                    .query(`
                        UPDATE Asins SET
                            Title = ISNULL(@title, Title),
                            CurrentPrice = ISNULL(NULLIF(@currentPrice, 0), CurrentPrice),
                            Mrp = ISNULL(@mrp, Mrp),
                            DiscountPercentage = ISNULL(@discount, DiscountPercentage),
                            Rating = ISNULL(NULLIF(@rating, 0), Rating),
                            ReviewCount = ISNULL(@reviewCount, ReviewCount),
                            HasAplus = ISNULL(@hasAplus, HasAplus),
                            ImageUrl = ISNULL(@mainImage, ImageUrl),
                            ImagesCount = ISNULL(@imageCount, ImagesCount),
                            Category = ISNULL(@mainCategory, Category),
                            Brand = ISNULL(@brand, Brand),
                            AvailabilityStatus = ISNULL(@availability, AvailabilityStatus),
                            SoldBy = ISNULL(@soldBy, SoldBy),
                            HasDeal = ISNULL(@hasDeal, HasDeal),
                            DealBadge = ISNULL(@dealBadge, DealBadge),
                            DealType = ISNULL(@dealType, DealType),
                            BSR = ISNULL(NULLIF(@mainBSR, 0), BSR),
                            SubBSR = ISNULL(NULLIF(@subBSR, 0), SubBSR),
                            SubBSRCategory = ISNULL(@subBSRCategory, SubBSRCategory),
                            BulletPoints = ISNULL(NULLIF(@bulletPointCount, 0), BulletPoints),
                            BulletPointsText = ISNULL(@bulletPoints, BulletPointsText),
                            ProductDescription = ISNULL(NULLIF(@description, ''), ProductDescription),
                            ScrapeStatus = 'COMPLETED',
                            LastScrapeStatus = 'COMPLETED',
                            LastScrapedAt = dbo.GetEnvDate(),
                            LastSyncSource = 'SCRAPER',
                            Status = 'Active',
                            UpdatedAt = dbo.GetEnvDate()
                        WHERE Id = @id
                    `);

                // Record today's history snapshot for the full-scraped ASIN
                await this._upsertAsinHistory(pool, row.recordset[0].Id, {
                    price: d.currentPrice,
                    mrp: d.mrp,
                    bsr: d.bsr,
                    subBsr: d.subBsr,
                    rating: d.rating,
                    reviewCount: d.reviewCount,
                    source: 'SCRAPER'
                });
            } catch (e) {
                console.warn(`  ⚠ Full scrape apply failed for ${code}: ${e.message}`);
            }
        }
    }

    // ============================================
    // Internal: Upsert today's AsinHistory snapshot
    // One row per ASIN per day — price, MRP, BSR, SubBSR, rating, reviews.
    // ============================================
    async _upsertAsinHistory(parent, asinId, data) {
        const { price, mrp, bsr, subBsr, rating, reviewCount, source } = data;
        await new sql.Request(parent)
            .input('asinId', sql.VarChar, asinId)
            .input('price', sql.Decimal(18, 2), price ?? null)
            .input('mrp', sql.Decimal(18, 2), mrp ?? null)
            .input('bsr', sql.Int, bsr ?? null)
            .input('subBSR', sql.Int, subBsr ?? null)
            .input('rating', sql.Decimal(3, 2), rating ?? null)
            .input('reviewCount', sql.Int, reviewCount ?? null)
            .input('source', sql.NVarChar, source)
            .query(`
                MERGE AsinHistory AS target
                USING (SELECT @asinId AS AsinId, CAST(dbo.GetEnvDate() AS DATE) AS [Date]) AS source
                ON target.AsinId = source.AsinId AND target.[Date] = source.[Date]
                WHEN MATCHED THEN
                    UPDATE SET
                        Price = ISNULL(@price, target.Price),
                        Mrp = ISNULL(@mrp, target.Mrp),
                        BSR = ISNULL(@bsr, target.BSR),
                        SubBSR = ISNULL(@subBSR, target.SubBSR),
                        Rating = ISNULL(@rating, target.Rating),
                        ReviewCount = ISNULL(@reviewCount, target.ReviewCount),
                        Source = @source
                WHEN NOT MATCHED THEN
                    INSERT (AsinId, [Date], Price, Mrp, BSR, SubBSR, Rating, ReviewCount, Source)
                    VALUES (source.AsinId, source.[Date], @price, @mrp, @bsr, @subBSR, @rating, @reviewCount, @source);
            `);
    }

    // ============================================
    // Internal: Process Batch
    // ============================================
    async _processBatch(sellerId, batch, credId, stats, sellerName = null) {
        const codes = batch.map(a => a.AsinCode);
        let lastError = null;

        for (let attempt = 0; attempt <= this._config.maxRetries; attempt++) {
            try {
                if (this._isCredThrottled(credId)) {
                    const throttledCred = this._selectBestCred();
                    if (throttledCred && throttledCred !== credId) {
                        console.log(`   Credential '${credId}' throttled, switching to '${throttledCred}'`);
                        return this._processBatch(sellerId, batch, throttledCred, stats, sellerName);
                    }
                    throw new Error(`Credential '${credId}' is throttled — waiting`);
                }

                // Check TPD limit before making request (account-wide, durable ledger)
                const tpdRemaining = await creatorsApiRateGate.getRemaining('primary');
                if (tpdRemaining <= 0) {
                    console.warn(`⛔ Creators API daily TPD quota reached (${creatorsApiRateGate.getEffectiveTpdLimit()}/day)`);
                    throw creatorsTransient('CREATORS_TPD', 'Creators API daily TPD quota reached');
                }

                const credInfo = this._getCredInfo(credId);
                const api = this._getSdkApi(credId);

                // Fire scraper enrichment concurrently — runs during rate-limit wait + API call
                let scrapePromise = null;
                if (this._config.scraperEnrichment) {
                    scrapePromise = this._scrapeEnrichmentBatch(codes);
                }

                // Strict 1 req/s rate limit (shared account-wide), then record
                // this attempt against the durable daily quota.
                await this._rateLimit();
                const reserved = await creatorsApiRateGate.recordRequest('primary');
                if (!reserved) {
                    console.warn(`⛔ Creators API daily TPD quota reached (${creatorsApiRateGate.getEffectiveTpdLimit()}/day)`);
                    throw creatorsTransient('CREATORS_TPD', 'Creators API daily TPD quota reached');
                }

                const { GetItemsRequestContent } = CreatorsApiSdk;
                const request = new GetItemsRequestContent();
                request.partnerTag = credInfo.partnerTag;
                request.itemIds = codes;
                request.resources = this._getResources();
                request.itemIdType = 'ASIN';
                request.marketplace = credInfo.marketplace;

                const response_and_data = await api.getItemsWithHttpInfo(credInfo.marketplace, request);
                const data = response_and_data.data;
                const response = response_and_data.response;

                // Track TPD from successful request
                this._updateRateFromHeader(response.headers, credId);

                const items = data.itemsResult?.items || [];

                const savePromises = [];
                const fullScrapeCodes = [];
                for (const asinRecord of batch) {
                    const item = items.find(i => i.asin === asinRecord.AsinCode);
                    if (!item) {
                        // API cannot serve this ASIN → full Playwright scrape fallback
                        fullScrapeCodes.push(asinRecord.AsinCode);
                        continue;
                    }

                    savePromises.push((async () => {
                        try {
                            await this._updateAsinFromLiveSync(asinRecord.Id, sellerId, item, asinRecord, null, sellerName);
                            stats.successCount++;
                        } catch (e) {
                            stats.failedCount++;
                            stats.failedAsinCodes.push(asinRecord.AsinCode);
                            stats.errors.push({ asin: asinRecord.AsinCode, error: e.message });
                        }
                    })());
                }

                await Promise.all(savePromises);

                // Scraper enrichment applies in the BACKGROUND after this batch's
                // API write completes (guaranteed ordering → scraped values win).
                if (scrapePromise) {
                    const apply = scrapePromise
                        .then(({ results }) => this._applyScrapeEnrichment(results))
                        .catch((e) => console.warn(`  ⚠ Scraper enrichment apply failed: ${e.message}`));
                    this._pendingScrapes.add(apply);
                    apply.finally(() => this._pendingScrapes.delete(apply));
                }

                // Full scrape fallback for API-inaccessible ASINs (background queue)
                if (fullScrapeCodes.length > 0) {
                    const applyFull = this._scrapeEnrichmentBatch(fullScrapeCodes, { full: true })
                        .then(async ({ results, errors }) => {
                            await this._applyFullScrape(results);
                            for (const code of fullScrapeCodes) {
                                if (results.has(code)) {
                                    stats.successCount++;
                                } else {
                                    stats.failedCount++;
                                    stats.failedAsinCodes.push(code);
                                    const err = errors.get(code) ?? 'Scrape fallback failed';
                                    stats.errors.push({ asin: code, error: err });
                                }
                            }
                        })
                        .catch((e) => {
                            console.warn(`  ⚠ Full scrape fallback failed: ${e.message}`);
                            for (const code of fullScrapeCodes) {
                                stats.failedCount++;
                                stats.failedAsinCodes.push(code);
                                stats.errors.push({ asin: code, error: e.message });
                            }
                        });
                    this._pendingScrapes.add(applyFull);
                    applyFull.finally(() => this._pendingScrapes.delete(applyFull));
                }

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

                // 429: The ACCOUNT is rate-limited (both credentials share the same Amazon
                // partner tag/account — a 429 is NOT a token problem). Set an
                // account-wide cooldown on the gate (seen by every caller + every
                // PM2 worker) and retry the SAME credential after backoff. NEVER
                // flip credentials on 429 — flipping just burns the other token's
                // budget into the same throttle and resets the attempt counter.
                if (status === 429 || error.code === 'CREATORS_THROTTLED') {
                    const retryAfterSec = parseInt((resp.headers || {})['retry-after'] || '0', 10);
                    const backoffMs = retryAfterSec > 0
                        ? retryAfterSec * 1000
                        : Math.min(10000 * Math.pow(2, attempt), 80000);

                    this._credThrottledUntil.set(credId, Date.now() + backoffMs);
                    creatorsApiRateGate.cooldownAfter429('primary', backoffMs);
                    console.warn(`⏳ [429] Account cooled down for ${(backoffMs / 1000).toFixed(0)}s (attempt ${attempt + 1}/${this._config.maxRetries + 1})`);

                    // Wait out the cooldown + min-gap (both honored by the gate).
                    // If the gate still can't grant a slot (long cooldown), it throws
                    // CREATORS_THROTTLED which lands back here with attempt++.
                    try {
                        await this._rateLimit();
                    } catch (cooldownErr) {
                        if (cooldownErr.code === 'CREATORS_THROTTLED') continue;
                        throw cooldownErr;
                    }
                    continue;
                }

                // 401/400: Rotate token and try the other credential
                if ((status === 401 || status === 400) && attempt < this._config.maxRetries) {
                    this._sdkClients.delete(credId);
                    console.warn(`🔄 [${status}] Rotating credential '${credId}', trying fallback (attempt ${attempt + 1})`);
                    const fallbackCred = this._selectBestCred();
                    if (fallbackCred && fallbackCred !== credId) {
                        await this._delay(this._config.retryDelay);
                        return this._processBatch(sellerId, batch, fallbackCred, stats, sellerName);
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
    async _updateAsinFromLiveSync(asinId, sellerId, item, asinRecord = null, scrapeData = null, sellerName = null) {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            const extracted = this._extractFields(item, sellerName);

            // Scraper enrichment overrides API rating/reviewCount when available
            const rating = (scrapeData && scrapeData.rating != null) ? scrapeData.rating : extracted.rating;
            const reviewCount = (scrapeData && scrapeData.reviewCount != null) ? scrapeData.reviewCount : extracted.reviewCount;
            // HasAplus comes ONLY from scraper (API never returns it). Null = leave existing value.
            const hasAplus = (scrapeData && scrapeData.hasAplus != null) ? (scrapeData.hasAplus ? 1 : 0) : null;

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
                .input('rating', sql.Decimal(3, 2), rating)
                .input('reviewCount', sql.Int, reviewCount)
                .input('hasAplus', sql.Bit, hasAplus)
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
                        CurrentPrice = ISNULL(NULLIF(@currentPrice, 0), CurrentPrice),
                        Mrp = ISNULL(@mrp, Mrp),
                        Category = ISNULL(@mainCategory, Category),
                        Brand = ISNULL(@brand, Brand),
                        BSR = ISNULL(@mainBSR, BSR),
                        SubBSR = ISNULL(@subBSR, SubBSR),
                        SubBSRCategory = ISNULL(@subBSRCategory, SubBSRCategory),
                        Rating = ISNULL(@rating, Rating),
                        ReviewCount = ISNULL(@reviewCount, ReviewCount),
                        HasAplus = ISNULL(@hasAplus, HasAplus),
                        ImageUrl = @mainImage,
                        ImagesCount = @imageCount,
                        Images = @imagesJson,
                        BulletPoints = @bulletPointCount,
                        BulletPointsText = @bulletPoints,

                        SoldBy = ISNULL(@soldBy, SoldBy),
                        SoldBySec = ISNULL(@soldBySec, SoldBySec),
                        BuyBoxWin = ISNULL(@buyBoxWin, BuyBoxWin),
                        AllOffers = @allOffersJson,
                        SellerExternalId = ISNULL(@sellerId, SellerExternalId),
                        CategoryPath = ISNULL(@categoryPath, CategoryPath),
                        VariantImages = @variantImages,
                        Dimensions = @dimensions,
                        BuyBoxes = @buyBoxes,
                        HasDeal = ISNULL(@hasDeal, HasDeal),
                        DealBadge = ISNULL(@dealType, DealBadge),
                        DealType = ISNULL(@dealType, DealType),
                        DealStartTime = ISNULL(@dealStartTime, DealStartTime),
                        DealEndTime = ISNULL(@dealEndTime, DealEndTime),
                        DealAccessType = @dealAccessType,
                        DealPercentClaimed = ISNULL(@dealPercentClaimed, DealPercentClaimed),
                        Manufacturer = ISNULL(@manufacturer, Manufacturer),
                        PriceDispute = @priceDispute,
                        DiscountPercentage = ISNULL(@discount, DiscountPercentage),
                        LastScrapedAt = dbo.GetEnvDate(),
                        LastSyncSource = 'LIVE',
                        Status = 'Active',
                        UpdatedAt = dbo.GetEnvDate(),
                        AvailabilityStatus = ISNULL(@availability, AvailabilityStatus)
                    WHERE Id = @asinId
                `);

            // Upsert today's AsinHistory snapshot (price/mrp/bsr/subBSR/rating/reviews).
            // MERGE keyed on (AsinId, Date) — re-syncs update the same-day row
            // instead of creating duplicates, and nulls preserve existing values.
            await this._upsertAsinHistory(transaction, asinId, {
                price: extracted.priceAmount,
                mrp: extracted.mrpAmount,
                bsr: extracted.mainBSR,
                subBsr: extracted.subBSR,
                rating,
                reviewCount,
                source: 'LIVE'
            });

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
    _extractFields(item, sellerName = null) {
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
        const dealBadge = (activeDeal?.badge || activeDeal?.type || activeDeal?.dealType || activeDeal?.dealBadge || itemDeal?.badge || null);

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
            buyBoxWin: isBuyBoxWinner(buyBoxWinner?.seller || listing?.merchantInfo?.name || null, sellerName),
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

            // Fetch seller name once for this re-sync (used for BuyBox winner logic)
            let sellerName = sellerId;
            try {
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* fallback */ }

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
                    await this._processBatch(sellerId, batch, credId, stats, sellerName);
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
