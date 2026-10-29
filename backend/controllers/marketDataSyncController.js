const { isGlobalUserRole } = require('../utils/roleUtils');
const { sql, getPool } = require('../database/db');
const marketDataSyncService = require('../services/marketDataSyncService');
const liveDataSyncService = require('../services/liveDataSyncService');
const { updateSellerAsinCount } = require('./asinController');

/**
 * Delegate an on-demand seller scrape to the in-house scrapers.
 * Ajio → AjioScraperService, Amazon → Playwright job runner.
 * Fire-and-forget; progress is streamed over Socket.IO.
 */
function startInHouseScrape(seller, userId) {
    const marketplace = (seller.Marketplace || '').toLowerCase();
    return (async () => {
        if (marketplace === 'ajio') {
            const ajioScraperService = require('../services/ajioScraperService');
            const result = await ajioScraperService.scrapeAllSellerProducts(seller.Id, {
                maxProducts: parseInt(process.env.AJIO_SCRAPER_CRON_MAX_PRODUCTS_PER_SELLER || '10000', 10),
                delayMs: parseInt(process.env.AJIO_SCRAPER_CRON_DELAY_MS || '600', 10),
                concurrency: parseInt(process.env.AJIO_SCRAPER_CONCURRENT_PAGES || '2', 10),
                full: false,
            });
            if (result.skipped) {
                console.log(`[mkt-sync] Ajio scrape already running for seller ${seller.Id} — skipped duplicate`);
            } else {
                console.log(`[mkt-sync] Ajio scrape done for ${seller.Name}: ${result.scraped} ok, ${result.failed} failed`);
            }
            return;
        }

        const playwrightScraperRunner = require('../services/playwrightScraperRunner');
        const asins = await playwrightScraperRunner.getSellerAsins(seller.Id);
        if (!asins.length) {
            console.log(`[mkt-sync] No ASINs to scrape for ${seller.Name}`);
            return;
        }
        const result = await playwrightScraperRunner.startJob({
            sellerId: seller.Id,
            asins,
            userId: userId || null,
            jobType: 'SCRAPE',
            targetType: 'SELLER',
        });
        console.log(`[mkt-sync] Playwright scrape started for ${seller.Name} (job ${result.jobId})`);
    })().catch(err => {
        console.error(`[mkt-sync] In-house scrape failed for seller ${seller.Id}:`, err.message);
    });
}

/**
 * Helper to validate identifiers and generate correct marketplace URLs,
 * filtering out mismatched cross-market patterns to protect tracker pipelines.
 */
const generateAndValidateMarketplaceUrls = (asins, seller) => {
    const isAjio = seller.Marketplace && seller.Marketplace.toLowerCase() === 'ajio';
    const urls = [];
    let skipped = 0;

    for (const a of asins) {
        const rawCode = (a.AsinCode || '').trim();
        if (!rawCode) continue;

        const isUrl = rawCode.startsWith('http://') || rawCode.startsWith('https://');
        let skip = false;

        if (isAjio) {
            if (isUrl && (rawCode.includes('amazon') || rawCode.includes('/dp/'))) {
                skip = true;
            } else if (!isUrl) {
                // Amazon ASIN pattern (usually starts with B)
                if (/^B[0-9A-Z]{9}$/i.test(rawCode)) {
                    skip = true;
                }
            }
        } else {
            if (isUrl && rawCode.includes('ajio')) {
                skip = true;
            } else if (!isUrl) {
                // Ajio numeric identifier pattern (12 digits)
                if (/^\d{12}$/.test(rawCode)) {
                    skip = true;
                }
            }
        }

        if (skip) {
            skipped++;
            continue;
        }

        if (isUrl) {
            urls.push(rawCode);
        } else {
            urls.push(isAjio ? `https://www.ajio.com/p/${rawCode}` : `https://www.amazon.in/dp/${rawCode}`);
        }
    }
    return { urls, skipped, isAjio };
};

/**
 * Controller for discreet Market Data Synchronization.
 */
exports.syncAsin = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        // 1. Fetch ASIN with Seller info
        const asinResult = await pool.request()
            .input('id', sql.VarChar, id)
            .query(`
                SELECT A.*, S.Name as SellerName, S.OctoparseId 
                FROM Asins A
                LEFT JOIN Sellers S ON A.SellerId = S.Id
                WHERE A.Id = @id
            `);

        const asin = asinResult.recordset[0];
        if (!asin) {
            return res.status(404).json({ success: false, error: 'ASIN not found' });
        }

        // 2. Security check
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = isGlobalUserRole(roleName);
        const isAssigned = req.user && req.user.assignedSellers.includes(asin.SellerId);

        if (!isGlobalUser && !isAssigned && asin.SellerId) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to ASIN sync' });
        }

        const taskId = asin.OctoparseId;

        // 3. Check if sync already in progress
        if (asin.ScrapeStatus === 'SCRAPING') {
            return res.status(400).json({ success: false, error: 'Sync already in progress' });
        }

        // 4. Update status to scraping in SQL
        await pool.request()
            .input('id', sql.VarChar, id)
            .query("UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = dbo.GetEnvDate() WHERE Id = @id");

        const isConfigured = marketDataSyncService.isConfigured();
        const automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
        let useDirect = (!taskId || !isConfigured) && !automationEnabled;

        // Silent decision log

        if (!useDirect) {
            try {
                // Option A: Use Octoparse (Managed Task)
                // Silent sync start
                
                // Trigger batch sync logic (which handles URL injection and scrape start)
                const syncStarted = await marketDataSyncService.syncSellerAsinsToOctoparse(asin.SellerId, { triggerScrape: true });

                if (!syncStarted) {
                    throw new Error('Failed to start sync via automated service');
                }

                return res.json({
                    success: true,
                    message: 'Market data sync initiated and automated monitoring started (Octoparse)',
                    status: 'SCRAPING'
                });
            } catch (octoError) {
                console.error(`❌ Octoparse Sync failed for ${asin.AsinCode}:`, octoError.message);
                
                // Revert status if sync fails
                await pool.request()
                    .input('id', sql.VarChar, id)
                    .query("UPDATE Asins SET ScrapeStatus = 'FAILED', Status = 'Error', UpdatedAt = dbo.GetEnvDate() WHERE Id = @id");

                return res.status(400).json({ 
                    success: false, 
                    error: 'Octoparse Sync failed: ' + octoError.message
                });
            }
        } else {
            // Fallback or direct sync not implemented here, use manual upload
            return res.status(400).json({ 
                success: false, 
                error: 'Octoparse is not configured and direct sync is disabled.' 
            });
        }

    } catch (error) {
        console.error('Market Sync Controller Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Market Sync Error: ' + error.message });
    }
};

/**
 * Handle manual completion/webhooks for sync completion.
 */
exports.handleSyncComplete = async (req, res) => {
    try {
        const { asinId, rawData } = req.body || {};

        // This would typically be a webhook from the provider
        // but can be triggered manually for direct API updates.
        const updatedAsin = await marketDataSyncService.updateAsinMetrics(asinId, rawData);

        res.json({
            success: true,
            message: 'Market metrics updated successfully',
            data: updatedAsin
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Trigger batch sync for all active ASINs of a seller.
 */
exports.syncSellerAsins = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();

        // 1. Fetch Seller
        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT * FROM Sellers WHERE Id = @id");

        const seller = sellerResult.recordset[0];
        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // 2. Security check
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = isGlobalUserRole(roleName);
        const isAssigned = req.user && req.user.assignedSellers.includes(sellerId);

        if (!isGlobalUser && !isAssigned) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger sync for this seller' });
        }

        const isConfigured = marketDataSyncService.isConfigured();
        const automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
        const isOctoparseReady = isConfigured && automationEnabled;

        if (isOctoparseReady) {
            // Octoparse path: injects URLs → starts scraping → polls results → writes to DB
            // Works for BOTH Amazon and Ajio
            await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query("UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Inactive')");

            try {
                const fullSync = req.body?.fullSync === true || req.query?.fullSync === 'true';
                const forceReRun = req.body?.forceReRun === true || req.query?.forceReRun === 'true';

                const syncStarted = await marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, {
                    triggerScrape: true,
                    fullSync,
                    forceReRun
                });

                if (!syncStarted) {
                    throw new Error('Octoparse sync service failed to initialize');
                }

                return res.json({
                    success: true,
                    message: `Scrape initiated for ${seller.Name}. Data will appear when the task completes.`,
                });
            } catch (octoError) {
                console.error(`❌ Octoparse Sync failed for ${seller.Name}:`, octoError.message);

                await pool.request()
                    .input('sellerId', sql.VarChar, sellerId)
                    .query("UPDATE Asins SET ScrapeStatus = 'FAILED', Status = 'Error', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND ScrapeStatus = 'SCRAPING'");

                return res.status(400).json({
                    success: false,
                    error: 'Sync failed: ' + octoError.message
                });
            }
        } else {
            // No Octoparse — run the in-house scrapers on-demand (marketplace-aware).
            const marketplace = (seller.Marketplace || '').toLowerCase();
            if (marketplace !== 'ajio' && marketplace !== 'amazon' && marketplace !== 'amazon.in') {
                return res.status(400).json({
                    success: false,
                    error: 'Scraping not configured for this seller.',
                    hint: `Marketplace '${seller.Marketplace || 'unknown'}' is not supported by the in-house scrapers. ` +
                          'Set it to Ajio or Amazon, or configure Octoparse in .env.'
                });
            }

            await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query("UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Inactive')");

            startInHouseScrape(seller, req.user?.Id || req.user?._id);

            return res.json({
                success: true,
                message: `Scrape started for ${seller.Name} via in-house ${marketplace === 'ajio' ? 'Ajio' : 'Playwright'} scraper. Progress is streamed live.`,
            });
        }

    } catch (error) {
        console.error('Sync Error:', error.message);
        res.status(500).json({ success: false, error: 'Sync Error: ' + error.message });
    }
};

/**
 * Trigger batch sync for all active ASINs across all sellers assigned to the user.
 */
exports.syncAllAsins = async (req, res) => {
    // Silent entry
    try {
        const pool = await getPool();
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = isGlobalUserRole(roleName);

        // 1. Fetch Active, Error, Pending ASINs for assigned sellers
        let asinsQuery = "SELECT Id, SellerId FROM Asins WHERE (Status IS NULL OR Status != 'Inactive')";
        const request = pool.request();

        if (!isGlobalUser) {
            if (!req.user.assignedSellers || req.user.assignedSellers.length === 0) {
                return res.json({ success: true, message: 'No active ASINs to sync (no assigned sellers)' });
            }
            request.input('assignedSellersJson', sql.NVarChar, JSON.stringify(req.user.assignedSellers));
            asinsQuery += ` AND SellerId IN (SELECT value FROM OPENJSON(@assignedSellersJson))`;
        }

        const asinsResult = await request.query(asinsQuery);
        const asins = asinsResult.recordset;

        if (asins.length === 0) {
            return res.json({ success: true, message: 'No active ASINs to sync' });
        }

        // 2. Check which sellers have sync methods available
        const sellerIds = [...new Set(asins.map(a => a.SellerId).filter(Boolean))];
        const sellersResult = await pool.request()
            .query(`SELECT Id, Marketplace, OctoparseId, LiveSyncClientId, LiveSyncClientSecret 
                    FROM Sellers WHERE Id IN (${sellerIds.map((_, i) => `@sid${i}`).join(',')})`);
        sellerIds.forEach((id, i) => pool.request().input(`sid${i}`, sql.VarChar, id));
        
        const sellerMap = {};
        sellersResult.recordset.forEach(s => { sellerMap[s.Id] = s; });
        
        const syncableSellerIds = sellerIds.filter(id => {
            const s = sellerMap[id];
            if (!s) return false;
            const marketplace = (s.Marketplace || '').toLowerCase();
            const isAmazon = marketplace === 'amazon.in' || marketplace === 'amazon';
            const isAjio = marketplace === 'ajio';
            const hasLiveSync = s.LiveSyncClientId && s.LiveSyncClientSecret;
            const hasOctoparse = s.OctoparseId && marketDataSyncService.isConfigured();
            return isAmazon || isAjio || hasLiveSync || hasOctoparse;
        });

        // Only update status for ASINs belonging to syncable sellers
        const syncableAsinIds = asins.filter(a => syncableSellerIds.includes(a.SellerId)).map(a => a.Id);
        const skippedCount = asins.length - syncableAsinIds.length;
        
        if (syncableAsinIds.length === 0) {
            return res.json({ success: true, message: 'No sellers have sync methods configured. Use Bulk Import to upload catalog data.', count: 0 });
        }

        await pool.request()
            .input('asinIdsJson', sql.NVarChar, JSON.stringify(syncableAsinIds))
            .query(`UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = dbo.GetEnvDate() WHERE Id IN (SELECT value FROM OPENJSON(@asinIdsJson))`);
        
        // Force-Clear any stale locks for these specific sellers
        syncableSellerIds.forEach(id => marketDataSyncService.syncLocks.delete(id.toString()));
        console.log(`🧹 Cleared status locks for ${syncableSellerIds.length} sellers to allow fresh sync.`);

        // Fire and forget background process
        setTimeout(async () => {
            console.log(`🚀 Starting ${syncableSellerIds.length} sync tasks simultaneously...`);
            
            const triggerPromises = syncableSellerIds.map(async (sellerId) => {
                const seller = sellerMap[sellerId];
                const automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
                const useOctoparse = !!(seller && seller.OctoparseId && marketDataSyncService.isConfigured() && automationEnabled);
                try {
                    if (!useOctoparse) {
                        // In-house scrapers (Ajio + Amazon) replace Octoparse when it isn't ready.
                        startInHouseScrape(seller, req.user?.Id || req.user?._id);
                    } else {
                        await marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { 
                            fullSync: true,
                            forceReRun: true,
                            triggerScrape: true
                        });
                    }
                    console.log(`✅ Task triggered for seller ${sellerId}`);
                    return { sellerId, success: true };
                } catch (err) {
                    console.error(`❌ Task trigger failed for seller ${sellerId}:`, err.message);
                    
                    // Revert status for ASINs belonging to this seller to prevent them getting stuck in SCRAPING
                    try {
                        const localPool = await getPool();
                        await localPool.request()
                            .input('sellerId', sql.VarChar, sellerId)
                            .query("UPDATE Asins SET ScrapeStatus = 'FAILED', Status = 'Error', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND ScrapeStatus = 'SCRAPING'");
                    } catch(revertErr) {
                        console.error(`❌ Status revert failed for seller ${sellerId}:`, revertErr.message);
                    }
                    
                    return { sellerId, success: false, error: err.message };
                }
            });

            await Promise.all(triggerPromises);
            // Silent trigger completion
        }, 0);

        res.json({
            success: true,
            message: `Global sync initiated for ${syncableAsinIds.length} ASINs${skippedCount > 0 ? ` (${skippedCount} skipped — no sync method configured)` : ''}`,
            count: syncableAsinIds.length,
            skipped: skippedCount
        });
    } catch (error) {
        console.error('Global Sync Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Global Sync Error: ' + error.message });
    }
};

/**
 * Fetch results from provider and apply to ASINs.
 */
exports.fetchAndApplyResults = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();

        // 1. Fetch Seller
        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT OctoparseId FROM Sellers WHERE Id = @id");

        const seller = sellerResult.recordset[0];
        if (!seller || !seller.OctoparseId) {
            return res.status(404).json({ success: false, error: 'Seller or Sync Task not found' });
        }

        // 2. Retrieve results from Octoparse
        const data = await marketDataSyncService.retrieveResults(seller.OctoparseId);

        if (!data || data.length === 0) {
            return res.json({ success: true, message: 'No new data found from provider' });
        }

        // 3. Process batch results
        const batchResult = await marketDataSyncService.processBatchResults(sellerId, data);
        const updatedCount = typeof batchResult === 'object' && batchResult !== null ? (batchResult.updatedCount || 0) : (batchResult || 0);
        
        // Update seller counts
        await updateSellerAsinCount(sellerId);

        res.json({
            success: true,
            message: `Processed ${data.length} items, updated ${updatedCount} ASINs via high-performance bulk link.`,
            count: updatedCount
        });
    } catch (error) {
        console.error('Fetch Results Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch and apply results: ' + error.message });
    }
};

/**
 * Ingest all results from a specific task or latest task execution.
 * This is used for bulk discovery and adding new ASINs.
 */
exports.ingestTaskResults = async (req, res) => {
    try {
        const { taskId, executionId, sellerId } = req.body || {};
        const pool = await getPool();

        if (!taskId && !executionId) {
            return res.status(400).json({ success: false, error: 'Task ID or Execution ID required' });
        }

        // 1. Identify Seller
        let seller;
        if (sellerId) {
            const result = await pool.request()
                .input('id', sql.VarChar, sellerId)
                .query("SELECT * FROM Sellers WHERE Id = @id");
            seller = result.recordset[0];
        } else if (taskId) {
            const result = await pool.request()
                .input('taskId', sql.NVarChar, taskId)
                .query("SELECT * FROM Sellers WHERE OctoparseId = @taskId");
            seller = result.recordset[0];
        }

        if (!seller) {
            return res.status(404).json({ success: false, error: 'Target Seller not found for this task' });
        }

        // 2. Resolve Execution ID
        let targetExecutionId = executionId;
        if (!targetExecutionId && (taskId || seller.OctoparseId)) {
            // Silent execution lookup
            targetExecutionId = await marketDataSyncService.getLatestExecutionId(taskId || seller.OctoparseId);
        }

        if (!targetExecutionId) {
            return res.status(404).json({ success: false, error: 'No execution ID found for this task' });
        }

        // 3. Fetch Data
        // Silent ingestion
        const data = await marketDataSyncService.retrieveResults(taskId || seller.OctoparseId, targetExecutionId);

        if (!data || data.length === 0) {
            return res.json({ success: true, message: 'No data found in execution', count: 0 });
        }

        // 4. Process & Discover ASINs
        const batchResult = await marketDataSyncService.processBatchResults(seller.Id, data);
        const updatedCount = typeof batchResult === 'object' && batchResult !== null ? (batchResult.updatedCount || 0) : (batchResult || 0);
        
        res.json({
            success: true,
            message: `Successfully processed ${data.length} records and updated ${updatedCount} existing ASINs.`,
            count: updatedCount
        });
    } catch (error) {
        console.error('Ingest Results Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to ingest results: ' + error.message });
    }
};

/**
 * Setup a new Octoparse Sync Task for a seller by duplicating the master template.
 */
exports.setupSellerTask = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();

        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT * FROM Sellers WHERE Id = @id");

        const seller = sellerResult.recordset[0];
        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // 1. Assign from Pool (Fallback to duplication if pool empty - but pool is preferred now)
        console.log(`🤖 Setting up auto-sync task for ${seller.Name}...`);
        
        let newTaskId = await marketDataSyncService.assignTaskFromPool(sellerId);
        
        if (!newTaskId) {
            // Attempt Duplication
            try {
                newTaskId = await marketDataSyncService.duplicateTask(seller.Name);
                
                // Update Seller with Task ID
                await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .input('taskId', sql.NVarChar, newTaskId)
                    .query("UPDATE Sellers SET OctoparseId = @taskId WHERE Id = @id");
            } catch (dupError) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Auto-duplication failed and no available tasks in the pool. Please upload more Task IDs to the management pool.' 
                });
            }
        }
        
        // 2. Initial URL Injection (Fetch active/error/pending ASINs)
        const asinsResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Inactive')");
        
        const asins = asinsResult.recordset;
        if (asins.length > 0) {
            const { urls, skipped, isAjio } = generateAndValidateMarketplaceUrls(asins, seller);
            if (urls.length > 0) {
                await marketDataSyncService.updateTaskUrlsWithFile(newTaskId, urls, isAjio);
                console.log(`✅ Injected ${urls.length} marketplace URLs into new task: ${newTaskId}${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
            } else {
                console.warn(`⚠️ No valid identifiers aligned with marketplace for ${seller.Name} during initial injection.`);
            }
        }

        res.json({
            success: true,
            message: `Market sync task successfully linked/allocated for ${seller.Name}`,
            taskId: newTaskId,
            asinsLinked: asins.length
        });
    } catch (error) {
        console.error('Setup Seller Task Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to setup market sync task: ' + error.message });
    }
};

/**
 * Bulk upload task IDs to the pool.
 */
exports.uploadTaskPool = async (req, res) => {
    try {
        const userRole = req.user.role?.Name || req.user.role?.name || req.user.role;
        const isGlobalUser = isGlobalUserRole(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to upload task pool' });
        }

        const { taskIds } = req.body || {};
        
        if (!taskIds || !Array.isArray(taskIds)) {
            return res.status(400).json({ success: false, error: 'Invalid Task IDs list. Expected an array of strings.' });
        }

        const result = await marketDataSyncService.importTaskPool(taskIds);
        
        res.json({
            success: true,
            message: `Successfully updated task pool. ${result.added} new tasks added.`,
            stats: result.stats
        });
    } catch (error) {
        console.error('Upload Task Pool Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get the current status of the task pool.
 */
exports.getPoolStatus = async (req, res) => {
    try {
        const stats = await marketDataSyncService.getPoolStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get Pool Status Controller Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Sync all tasks from Octoparse API to the local task pool.
 */
exports.syncTaskPool = async (req, res) => {
    try {
        const userRole = req.user.role?.Name || req.user.role?.name || req.user.role;
        const isGlobalUser = isGlobalUserRole(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to sync task pool' });
        }

        const result = await marketDataSyncService.syncOctoparseTasksToPool();
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Sync Task Pool Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Trigger concurrent recovery for ASINs with missing critical data.
 */
exports.recoverMissingData = async (req, res) => {
    try {
        const userRole = req.user.role?.Name || req.user.role?.name || req.user.role;
        const isGlobalUser = isGlobalUserRole(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger missing data recovery' });
        }

        console.log('🔍 Manual trigger: Missing Data Recovery...');
        const SchedulerService = require('../services/schedulerService');
        
        // Fire and forget background process
        setTimeout(async () => {
            await SchedulerService.runMissingDataRecovery();
        }, 0);

        res.json({
            success: true,
            message: 'Concurrent missing data recovery initiated in the background'
        });
    } catch (error) {
        console.error('Missing Data Recovery Trigger Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to initiate recovery' });
    }
};

/**
 * Global ingestion trigger: Checks and imports results for ALL active sellers in the background.
 */
exports.syncAllSellersResults = async (req, res) => {
    try {
        const userRole = req.user.role?.Name || req.user.role?.name || req.user.role;
        const isGlobalUser = isGlobalUserRole(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger global results ingestion' });
        }

        console.log('🗳️ Global ingestion triggered (Fetch all Octoparse results)...');
        
        const SchedulerService = require('../services/schedulerService');
        
        // Fire and forget background process
        setTimeout(async () => {
            await SchedulerService.runOctoparseResultFetch();
            console.log('✅ Global ingestion cycle finished.');
        }, 0);

        res.json({
            success: true,
            message: 'Global results ingestion initiated in the background'
        });
    } catch (error) {
        console.error('Global Ingest Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to initiate global ingestion' });
    }
};

/**
 * Provide general status of sync capabilities.
 */
/**
 * Provide general status of sync capabilities.
 */
exports.getSyncStatus = async (req, res) => {
    try {
        await marketDataSyncService.authenticate();
        res.json({ success: true, service: 'Operational', provider: 'Connected' });
    } catch (error) {
        res.json({ success: true, service: 'Maintenance', provider: 'Disconnected' });
    }
};

/**
 * Get the sync status details (Live & Octoparse) for a specific seller.
 */
exports.getSellerSyncStatus = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();
        
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = isGlobalUserRole(roleName);
        const isAssigned = req.user && req.user.assignedSellers.includes(sellerId);

        if (!isGlobalUser && !isAssigned) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const activeLiveSync = liveDataSyncService.activeSyncs.get(sellerId.toString());
        
        // SystemLogs.EntityId holds the seller id (see _logSync), which is what
        // we must filter on — the old `Description LIKE '%seller <id>%'` never
        // matched, because the description is the seller NAME, so `lastRun`/
        // `lastResult` were permanently null.
        const logResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId.toString())
            .query(`
                SELECT TOP 1 CreatedAt, Metadata
                FROM SystemLogs
                WHERE Type = 'LIVE_SYNC' AND EntityId = @sellerId
                ORDER BY CreatedAt DESC
            `);
            
        const lastLiveLog = logResult.recordset[0];
        let lastLiveMetadata = null;
        if (lastLiveLog && lastLiveLog.Metadata) {
            try {
                lastLiveMetadata = JSON.parse(lastLiveLog.Metadata);
            } catch (e) {}
        }

        const octoResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query(`
                SELECT MAX(LastScrapedAt) as lastOcto
                FROM Asins
                WHERE SellerId = @sellerId
            `);
        
        const lastOcto = octoResult.recordset[0]?.lastOcto;

        // Determine live sync status
        let liveSyncStatus = 'IDLE';
        let liveSyncProgress = null;
        let liveSyncError = null;
        
        if (activeLiveSync) {
            if (activeLiveSync.status === 'FAILED') {
                liveSyncStatus = 'FAILED';
                liveSyncError = activeLiveSync.fatalError;
            } else {
                liveSyncStatus = 'RUNNING';
                liveSyncProgress = {
                    processed: activeLiveSync.successCount,
                    total: activeLiveSync.totalAsins
                };
            }
        }

        res.json({
            sellerId: sellerId,
            liveSync: {
                status: liveSyncStatus,
                lastRun: lastLiveLog?.CreatedAt || null,
                lastResult: lastLiveMetadata ? {
                    totalAsins: lastLiveMetadata.totalAsins,
                    success: lastLiveMetadata.successCount,
                    failed: lastLiveMetadata.failedCount,
                    duration: lastLiveMetadata.duration
                } : null,
                progress: liveSyncProgress,
                error: liveSyncError
            },
            octoparseSync: {
                status: 'SCHEDULED',
                lastRun: lastOcto || null,
                nextRun: 'Daily at 2 AM',
                handles: 'A+ Content & Rating Breakdown'
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Trigger Live Data Sync for a seller (uses obfuscated API credentials).
 */
exports.triggerLiveSync = async (req, res) => {
    try {
        const { sellerId } = req.params;
        
        // Check if sync is already running
        const existingSync = liveDataSyncService.activeSyncs.get(sellerId.toString());
        if (existingSync) {
            return res.json({
                success: true,
                message: 'Live sync already in progress for this seller',
                sellerId,
                status: 'IN_PROGRESS',
                progress: {
                    processed: existingSync.successCount,
                    total: existingSync.totalAsins
                }
            });
        }
        
        // Start sync in background (returns immediately to client)
        // The frontend polls /sync/status/:sellerId for completion
        liveDataSyncService.syncSellerLiveData(sellerId)
            .then(result => {
                console.log(`Live sync completed for seller ${sellerId}:`, {
                    success: result.success,
                    updated: result.updatedAsins,
                    failed: result.failedAsins
                });
            })
            .catch(e => {
                console.error(`Live sync failed for seller ${sellerId}:`, e.message);
                // Store error in activeSyncs so status endpoint can report it
                liveDataSyncService.activeSyncs.set(sellerId.toString(), {
                    sellerId: sellerId,
                    status: 'FAILED',
                    fatalError: e.message,
                    totalAsins: 0,
                    successCount: 0,
                    failedCount: 0
                });
                // Auto-cleanup after 30 seconds
                setTimeout(() => {
                    liveDataSyncService.activeSyncs.delete(sellerId.toString());
                }, 30000);
            });
        
        res.json({
            success: true,
            message: 'Live data sync started. Updates will appear within minutes.',
            sellerId,
            estimatedTime: 'Usually completes in 1-5 minutes'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

/**
 * Live-sync an explicit set of ASINs via the Amazon Creators API.
 *
 * ASIN Manager works on individual rows and its selection can span several
 * sellers, while the sync engine (LiveDataSyncService) is seller-scoped. So we
 * resolve the requested ASIN ids to their owning sellers, then run the normal
 * seller sync once per seller with `asinCodes` scoping it to just those ASINs.
 * That reuses the existing rate gate, per-seller lock, batching and completeness
 * handling instead of duplicating any of it.
 *
 * Runs in the background; progress/completion arrive over Socket.IO
 * (`liveSync:started` / `liveSync:progress` / `liveSync:completed`).
 */
exports.syncAsinsLive = async (req, res) => {
    try {
        const rawIds = Array.isArray(req.body?.asinIds) ? req.body.asinIds : [];
        const asinIds = [...new Set(rawIds.filter((v) => v != null && String(v).trim() !== ''))]
            .map((v) => String(v));

        if (asinIds.length === 0) {
            return res.status(400).json({ success: false, error: 'asinIds array is required' });
        }

        // Cap the fan-out so one request can't queue the whole table by accident.
        const maxAsins = parseInt(process.env.LIVE_SYNC_MAX_LIVE_ASINS_PER_REQUEST || '500', 10);
        if (asinIds.length > maxAsins) {
            return res.status(400).json({
                success: false,
                error: `Too many ASINs (${asinIds.length}). Maximum ${maxAsins} per live sync request.`,
            });
        }

        const pool = await getPool();
        const request = pool.request();
        const placeholders = asinIds.map((_, i) => `@id${i}`).join(',');
        asinIds.forEach((id, i) => request.input(`id${i}`, sql.VarChar, id));

        const found = await request.query(`
            SELECT Id, AsinCode, SellerId, Status, Marketplace
            FROM Asins
            WHERE Id IN (${placeholders})
        `);

        const rows = found.recordset;
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No matching ASINs found' });
        }

        // Seller-scope guard: a non-global user may only live-sync ASINs that
        // belong to sellers assigned to them.
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = isGlobalUserRole(roleName);
        const assigned = new Set(req.user?.assignedSellers || []);
        const allowed = isGlobalUser ? rows : rows.filter((r) => assigned.has(r.SellerId));

        if (allowed.length === 0) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to live sync for these ASINs' });
        }

        // Creators API covers Amazon only — Ajio rows are scraped in-house.
        const isAmazon = (r) => String(r.Marketplace || '').toLowerCase() !== 'ajio';
        const syncable = allowed.filter(isAmazon);
        const skippedMarketplace = allowed.length - syncable.length;

        // Group by seller: the sync engine is seller-scoped.
        const bySeller = new Map();
        for (const r of syncable) {
            if (!r.SellerId || !r.AsinCode) continue;
            if (!bySeller.has(r.SellerId)) bySeller.set(r.SellerId, []);
            bySeller.get(r.SellerId).push(r.AsinCode);
        }

        const skippedNoAsin = syncable.length - [...bySeller.values()].reduce((s, v) => s + v.length, 0);

        if (bySeller.size === 0) {
            return res.status(400).json({
                success: false,
                error: 'None of the selected ASINs can be live-synced (missing ASIN code or marketplace not supported by the Creators API)',
            });
        }

        // Fire and forget — the client polls status / listens on Socket.IO.
        const sellers = [...bySeller.entries()];
        (async () => {
            for (const [sellerId, asinCodes] of sellers) {
                try {
                    await liveDataSyncService.syncSellerLiveData(sellerId, { asinCodes });
                } catch (e) {
                    console.error(`[live-asins] Live sync failed for seller ${sellerId}:`, e.message);
                }
            }
        })().catch((e) => console.error('[live-asins] Live sync runner crashed:', e.message));

        return res.json({
            success: true,
            message: `Live sync started for ${syncable.length} ASIN(s) across ${bySeller.size} seller(s).`,
            requested: asinIds.length,
            matched: rows.length,
            syncing: syncable.length,
            sellers: bySeller.size,
            skipped: {
                unauthorized: rows.length - allowed.length,
                notAmazon: skippedMarketplace,
                missingAsinCode: skippedNoAsin,
            },
        });
    } catch (error) {
        console.error('[live-asins] Failed to start live sync:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get the status of all sync tasks associated with sellers.
 */
exports.getGlobalSyncTasks = async (req, res) => {
    try {
        const pool = await getPool();
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = isGlobalUserRole(roleName);
        
        let query = "SELECT Id, Name, Marketplace, OctoparseId FROM Sellers WHERE OctoparseId IS NOT NULL AND OctoparseId <> ''";
        const request = pool.request();
        
        if (!isGlobalUser) {
            if (!req.user.assignedSellers || req.user.assignedSellers.length === 0) {
                return res.json({ success: true, tasks: [] });
            }
            request.input('assignedSellersJson', sql.NVarChar, JSON.stringify(req.user.assignedSellers));
            query += ` AND Id IN (SELECT value FROM OPENJSON(@assignedSellersJson))`;
        }

        const sellersResult = await request.query(query);
        const sellers = sellersResult.recordset;
        
        if (sellers.length === 0) {
            return res.json({ success: true, tasks: [] });
        }

        const taskIds = [...new Set(sellers.map(s => s.OctoparseId))];
        const statuses = await marketDataSyncService.getBulkStatuses(taskIds);
        const statusMap = new Map(statuses.map(s => [s.taskId, s]));

        // N+1 Fix: Get all stats in a single query
        const sellerIdsArray = sellers.map(s => s.Id);
        const asinStatsResult = await pool.request()
            .input('sellerIdsJson', sql.NVarChar, JSON.stringify(sellerIdsArray))
            .query(`
                SELECT 
                    SellerId,
                    COUNT(*) as count, 
                    MAX(LastScrapedAt) as lastScraped 
                FROM Asins 
                WHERE Status = 'Active' AND SellerId IN (SELECT value FROM OPENJSON(@sellerIdsJson))
                GROUP BY SellerId
            `);
            
        const statsMap = new Map();
        for (const row of asinStatsResult.recordset) {
            statsMap.set(row.SellerId, { count: row.count, lastScraped: row.lastScraped });
        }

        const tasks = sellers.map((seller) => {
            const asinStats = statsMap.get(seller.Id) || { count: 0, lastScraped: null };
            const remoteStatus = statusMap.get(seller.OctoparseId);
            
            // Map Octoparse status (1: Running, 0: Stopped/Paused, etc)
            let status = 'IDLE';
            if (remoteStatus) {
                if (remoteStatus.status === 1) status = 'RUNNING';
                else if (remoteStatus.status === 2) status = 'PAUSED';
                else if (remoteStatus.status === 0) status = 'STOPPED';
            }

            return {
                sellerId: seller.Id,
                sellerName: seller.Name,
                marketplace: seller.Marketplace,
                taskId: seller.OctoparseId,
                asinCount: asinStats.count,
                lastSync: asinStats.lastScraped,
                status: status,
                progress: remoteStatus?.progress || 0
            };
        });

        res.json({ success: true, tasks });
    } catch (error) {
        console.error('Get Global Sync Tasks Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch sync tasks' });
    }
};

/**
 * Bulk create/update dedicated Octoparse tasks for sellers.
 */
exports.bulkUpdateSellerTasks = async (req, res) => {
    try {
        const { sellerIds } = req.body || {};
        const pool = await getPool();

        let query = "SELECT Id, Name, Marketplace, OctoparseId FROM Sellers";
        const request = pool.request();
        if (sellerIds && Array.isArray(sellerIds) && sellerIds.length > 0) {
            request.input('sellerIdsJson', sql.NVarChar, JSON.stringify(sellerIds));
            query += ` WHERE Id IN (SELECT value FROM OPENJSON(@sellerIdsJson))`;
        }

        const sellersResult = await request.query(query);
        const targetSellers = sellersResult.recordset;

        if (targetSellers.length === 0) {
            return res.status(404).json({ success: false, error: 'No sellers found.' });
        }

        console.log(`🚀 Starting Dedicated Task Creation for ${targetSellers.length} sellers...`);
        const summary = [];

        for (const seller of targetSellers) {
            try {
                // 1. Assign from Pool or Duplicate
                let newTaskId = await marketDataSyncService.assignTaskFromPool(seller.Id);
                if (!newTaskId) {
                    newTaskId = await marketDataSyncService.duplicateTask(seller.Name);
                    
                    await pool.request()
                        .input('id', sql.VarChar, seller.Id)
                        .input('taskId', sql.NVarChar, newTaskId)
                        .query("UPDATE Sellers SET OctoparseId = @taskId WHERE Id = @id");
                }

                // 2. Auto-inject ASINs
                const asinsResult = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status IN ('Active', 'Error', 'Pending')");
                
                const asins = asinsResult.recordset;
                let injectStatus = 'No ASINs';
                
                if (asins.length > 0) {
                    const { urls, skipped, isAjio } = generateAndValidateMarketplaceUrls(asins, seller);
                    if (urls.length > 0) {
                        await marketDataSyncService.updateTaskUrlsWithFile(newTaskId, urls, isAjio);
                        injectStatus = `Success (${urls.length} injected${skipped > 0 ? `, ${skipped} skipped` : ''})`;
                    } else {
                        injectStatus = 'Skipped (Mismatched identifiers)';
                    }
                }

                summary.push({ seller: seller.Name, taskId: newTaskId, status: 'Created', injection: injectStatus });
            } catch (err) {
                console.error(`❌ Setup failed for ${seller.Name}:`, err.message);
                summary.push({ seller: seller.Name, status: 'Failed', error: err.message });
            }
        }

        res.json({
            success: true,
            message: `Processed task setup for ${targetSellers.length} sellers.`,
            summary
        });
    } catch (error) {
        console.error('Bulk Task Setup Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Start a specific Octoparse task.
 */
exports.startTask = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT OctoparseId FROM Sellers WHERE Id = @id");
        
        const seller = result.recordset[0];
        if (!seller || !seller.OctoparseId) {
            return res.status(400).json({ success: false, error: 'Seller has no Task ID assigned.' });
        }

        const startResult = await marketDataSyncService.startCloudExtraction(seller.OctoparseId);
        res.json({ success: true, data: startResult });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Bulk inject ASIN URLs into associated Octoparse tasks.
 */
exports.bulkInjectAsinsToTasks = async (req, res) => {
    try {
        const { sellerIds } = req.body || {};
        const pool = await getPool();

        let query = "SELECT Id, Name, Marketplace, OctoparseId FROM Sellers WHERE OctoparseId IS NOT NULL AND OctoparseId <> ''";
        const request = pool.request();
        if (sellerIds && Array.isArray(sellerIds) && sellerIds.length > 0) {
            request.input('sellerIdsJson', sql.NVarChar, JSON.stringify(sellerIds));
            query += ` AND Id IN (SELECT value FROM OPENJSON(@sellerIdsJson))`;
        }

        const sellersResult = await request.query(query);
        const sellers = sellersResult.recordset;

        if (sellers.length === 0) {
            return res.status(404).json({ success: false, error: 'No sellers with assigned Task IDs found.' });
        }

        console.log(`🚀 Starting bulk ASIN injection for ${sellers.length} sellers...`);

        const summary = [];
        for (const seller of sellers) {
            try {
                const asinsResult = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Inactive')");
                
                const asins = asinsResult.recordset;

                if (asins.length === 0) {
                    summary.push({ seller: seller.Name, status: 'No ASINs found', count: 0 });
                    continue;
                }

                const { urls, skipped, isAjio } = generateAndValidateMarketplaceUrls(asins, seller);
                
                if (urls.length === 0) {
                    summary.push({ 
                        seller: seller.Name, 
                        status: 'Skipped (Mismatched identifiers)', 
                        count: 0,
                        skipped
                    });
                    continue;
                }

                await marketDataSyncService.updateTaskUrlsWithFile(seller.OctoparseId, urls, isAjio);

                summary.push({ 
                    seller: seller.Name, 
                    taskId: seller.OctoparseId, 
                    status: skipped > 0 ? `Success (with ${skipped} skipped)` : 'Success', 
                    asinCount: urls.length
                });

            } catch (err) {
                console.error(`❌ ASIN Injection failed for ${seller.Name}:`, err.message);
                summary.push({ seller: seller.Name, status: 'Error', error: err.message });
            }
        }

        res.json({
            success: true,
            message: `Bulk ASIN injection processed for ${sellers.length} sellers.`,
            summary
        });

    } catch (error) {
        console.error('Bulk ASIN Injection Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Bulk inject raw JSON results from Octoparse into the dashboard.
 */
exports.bulkInjectJson = async (req, res) => {
    try {
        const { data, sellerId } = req.body || {};

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ success: false, error: 'Data array required' });
        }

        if (!sellerId) {
            return res.status(400).json({ success: false, error: 'Seller ID required' });
        }

        const batchResult = await marketDataSyncService.processBatchResults(sellerId, data);
        const updatedCount = typeof batchResult === 'object' && batchResult !== null ? (batchResult.updatedCount || 0) : (batchResult || 0);
        await updateSellerAsinCount(sellerId);

        res.json({
            success: true,
            message: `Successfully injected ${data.length} records manually. Updated ${updatedCount} ASINs.`,
            count: updatedCount
        });
    } catch (error) {
        console.error('Manual JSON Ingestion Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Manually trigger the global database integrity repair process.
 */
exports.triggerRepair = async (req, res) => {
    try {
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        if (roleName !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admins can trigger global repair' });
        }

        const result = await marketDataSyncService.runBackgroundDatabaseRepair();
        
        res.json({
            success: true,
            message: 'Global database integrity repair initiated',
            details: result
        });
    } catch (error) {
        console.error('Manual Repair Trigger Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to trigger repair: ' + error.message });
    }
};

/**
 * Global Live Sync: Sync all sellers' data via Amazon Creators API.
 * Runs in background with parallel batching.
 */
exports.syncAllLiveSync = async (req, res) => {
    try {
        const { sellerIds } = req.body || {};

        // The sync engine is the single source of truth for whether a run can
        // start (in-process flag + cross-PM2 lock). Await just the START — the
        // engine returns quickly once it claims the lock and then keeps running
        // in the background — so we can report the truth instead of always
        // claiming success while another instance already owns the run.
        const started = await liveDataSyncService.startGlobalSync({
            sellerIds: sellerIds || null,
        });

        if (!started.accepted) {
            // 409: the request was understood but conflicts with the current run.
            return res.status(409).json({
                success: false,
                status: started.status || 'IN_PROGRESS',
                error: started.error || 'Global live sync already in progress',
                isRunning: true,
            });
        }

        return res.json({
            success: true,
            message: 'Global live sync started. All sellers with Amazon ASINs will be synced.',
            estimatedTime: 'Usually completes in 5-15 minutes depending on seller count',
            runId: started.runId
        });
    } catch (error) {
        console.error('Global Live Sync Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Abort the running global live sync from ANY worker.
 */
exports.abortGlobalLiveSync = async (req, res) => {
    try {
        const result = await liveDataSyncService.requestGlobalSyncAbort(
            req.body?.reason || 'Cancelled by user',
        );
        if (!result.accepted) {
            return res.status(409).json({
                success: false,
                error: result.error || 'No global live sync is running',
            });
        }
        return res.json({
            success: true,
            message: 'Abort requested. The sync stops after the current seller finishes.',
            reason: result.reason,
        });
    } catch (error) {
        console.error('Abort Global Live Sync Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get Global Live Sync Status
 * Accepts optional runId query parameter to fetch status from durable tracker.
 * Falls back to in-process/Redis status if no runId provided.
 */
exports.getGlobalLiveSyncStatus = async (req, res) => {
    try {
        const { runId } = req.query;
        let status;

        if (runId) {
            // Use durable tracker for specific run
            status = await liveDataSyncService.getGlobalSyncStatusByRunId(runId);
            if (!status) {
                return res.status(404).json({ success: false, error: 'Run not found' });
            }
        } else {
            // Fall back to in-process/Redis status
            status = await liveDataSyncService.getGlobalSyncStatus();
        }
        res.json({ success: true, ...status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Creators API rate gate status + durable daily quota remaining.
 */
exports.getCreatorsRateStatus = async (req, res) => {
    try {
        const creatorsApiRateGate = require('../services/creatorsApiRateGate');
        const remaining = await creatorsApiRateGate.getRemaining('primary');
        res.json({
            success: true,
            remainingToday: remaining,
            dailyLimit: creatorsApiRateGate.getEffectiveTpdLimit(),
            gate: creatorsApiRateGate.getStatus(),
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Restart all Octoparse tasks: stop all running → clear locks → re-inject → start fresh
 */
exports.restartAllOctoparseTasks = async (req, res) => {
    try {
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        if (!isGlobalUserRole(roleName)) {
            return res.status(403).json({ success: false, error: 'Admin only' });
        }

        const pool = await getPool();

        // 1. Get all sellers with Octoparse tasks
        const sellersResult = await pool.request()
            .query("SELECT Id, Name, OctoparseId FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != ''");
        const sellers = sellersResult.recordset;

        if (sellers.length === 0) {
            return res.json({ success: true, message: 'No sellers with Octoparse tasks found', stopped: 0, restarted: 0 });
        }

        console.log(`🔄 [RESTART] Stopping ${sellers.length} Octoparse tasks...`);

        // 2. Stop all running tasks
        let stopped = 0;
        for (const seller of sellers) {
            try {
                await marketDataSyncService.stopSync(seller.OctoparseId);
                stopped++;
            } catch (e) {
                console.warn(`⚠️ [RESTART] Could not stop task for ${seller.Name}: ${e.message}`);
            }
        }

        // 3. Clear all sync locks
        marketDataSyncService.syncLocks.clear();
        console.log(`🧹 [RESTART] Cleared all sync locks`);

        // 4. Wait for tasks to stabilize
        await new Promise(r => setTimeout(r, 3000));

        // 5. Re-inject and start all tasks in parallel (fire and forget)
        const results = [];
        for (const seller of sellers) {
            try {
                await marketDataSyncService.syncSellerAsinsToOctoparse(seller.Id, {
                    triggerScrape: true,
                    fullSync: true,
                    forceReRun: true
                });
                results.push({ sellerId: seller.Id, name: seller.Name, success: true });
                console.log(`✅ [RESTART] Re-synced: ${seller.Name}`);
            } catch (e) {
                results.push({ sellerId: seller.Id, name: seller.Name, success: false, error: e.message });
                console.error(`❌ [RESTART] Failed: ${seller.Name} — ${e.message}`);
            }
        }

        const restarted = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);

        res.json({
            success: true,
            message: `Stopped ${stopped} tasks, restarted ${restarted}${failed.length ? `, ${failed.length} failed` : ''}`,
            stopped,
            restarted,
            failed: failed.length,
            details: results
        });
    } catch (error) {
        console.error('[RESTART] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
