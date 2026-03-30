const MarketSyncService = require('../services/marketDataSyncService');
const Asin = require('../models/Asin');
const Seller = require('../models/Seller');

/**
 * Controller for discreet Market Data Synchronization.
 */
exports.syncAsin = async (req, res) => {
    try {
        const { id } = req.params;
        const asin = await Asin.findById(id).populate('seller');

        if (!asin) {
            return res.status(404).json({ success: false, error: 'ASIN not found' });
        }

        // Security check
        const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
        const sellerIdStr = asin.seller ? (asin.seller._id ? asin.seller._id.toString() : asin.seller.toString()) : null;
        const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === sellerIdStr);

        if (!isAdmin && !isAssigned && sellerIdStr) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to ASIN sync' });
        }

        const taskId = asin.seller?.marketSyncTaskId;

        // Check if sync already in progress
        if (asin.scrapeStatus === 'SCRAPING') {
            return res.status(400).json({ success: false, error: 'Sync already in progress' });
        }

        // Update status to scraping
        asin.scrapeStatus = 'SCRAPING';
        asin.status = 'Scraping';
        await asin.save();

        const isConfigured = MarketSyncService.isConfigured();
        let useDirect = !taskId || !isConfigured;

        console.log(`[SyncAsin] Decision for ${asin.asinCode}: taskId=${taskId}, isConfigured=${isConfigured} => useDirect=${useDirect}`);

        if (!useDirect) {
            try {
                // Option A: Use Octoparse (Managed Task)
                console.log(`🤖 Using Octoparse for ASIN: ${asin.asinCode}`);
                await MarketSyncService.triggerSync(
                    taskId,
                    [{ name: 'ASIN', value: asin.asinCode }]
                );

                return res.json({
                    success: true,
                    message: 'Market data sync initiated (Octoparse)',
                    status: 'SCRAPING'
                });
            } catch (octoError) {
                console.warn(`⚠️ Octoparse Sync failed for ${asin.asinCode}, falling back to Direct:`, octoError.message);
                useDirect = true;
            }
        }

        if (useDirect) {
            // Option B: Fallback to Direct Web Scraping
            console.log(`🕷️ Using Direct Scraper for ASIN: ${asin.asinCode}`);
            const DirectScraperService = require('../services/directScraperService');

            try {
                const rawData = await DirectScraperService.scrapeAsin(asin.asinCode);
                const updatedAsin = await MarketSyncService.updateAsinMetrics(asin._id, rawData);

                return res.json({
                    success: true,
                    message: 'Market data synced successfully (Direct)',
                    status: 'COMPLETED',
                    data: updatedAsin
                });
            } catch (scrapeError) {
                // Revert status if scraping fails
                asin.scrapeStatus = 'FAILED';
                asin.status = 'Error';
                await asin.save();
                throw scrapeError;
            }
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
        const { asinId, rawData } = req.body;

        // This would typically be a webhook from the provider
        // but can be triggered manually for direct API updates.
        const updatedAsin = await MarketSyncService.updateAsinMetrics(asinId, rawData);

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
        const seller = await Seller.findById(sellerId);

        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // Security check
        const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
        const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === sellerId);

        if (!isAdmin && !isAssigned) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger sync for this seller' });
        }

        const asins = await Asin.find({ seller: sellerId, status: 'Active' });
        if (asins.length === 0) {
            return res.json({ success: true, message: 'No active ASINs to sync' });
        }

        const asinCodes = asins.map(a => a.asinCode);

        // Update ASIN statuses
        await Asin.updateMany(
            { _id: { $in: asins.map(a => a._id) } },
            { $set: { scrapeStatus: 'SCRAPING', status: 'Scraping' } }
        );

        const isConfigured = MarketSyncService.isConfigured();
        let useDirect = !seller.marketSyncTaskId || !isConfigured;

        console.log(`[SellerSync] Decision for ${seller.name}: taskId=${seller.marketSyncTaskId}, isConfigured=${isConfigured} => useDirect=${useDirect}`);

        if (!useDirect) {
            try {
                console.log(`🤖 Using Octoparse for Batch Sync for Seller: ${seller.name}`);
                await MarketSyncService.triggerSync(
                    seller.marketSyncTaskId,
                    [{ name: 'ASIN', value: asinCodes.join(',') }]
                );

                return res.json({
                    success: true,
                    message: `Batch sync initiated (Octoparse) for ${asins.length} ASINs`,
                    count: asins.length
                });
            } catch (octoError) {
                console.warn(`⚠️ Octoparse Batch Sync failed for ${seller.name}, falling back to Direct:`, octoError.message);
                useDirect = true;
            }
        }

        if (useDirect) {
            console.log(`🕷️ Using Direct Scraper for Batch Sync for Seller: ${seller.name}`);
            const DirectScraperService = require('../services/directScraperService');

            // Fire and forget background process
            setTimeout(async () => {
                for (const asin of asins) {
                    try {
                        const rawData = await DirectScraperService.scrapeAsin(asin.asinCode);
                        await MarketSyncService.updateAsinMetrics(asin._id, rawData);
                        console.log(`✅ Background sync completed for ASIN: ${asin.asinCode}`);
                    } catch (err) {
                        console.error(`❌ Background sync failed for ASIN: ${asin.asinCode}`, err.message);
                        await Asin.updateOne({ _id: asin._id }, { $set: { scrapeStatus: 'FAILED', status: 'Error' } });
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }, 0);

            return res.json({
                success: true,
                message: `Batch sync initiated (Direct) in background for ${asins.length} ASINs`,
                count: asins.length
            });
        }
    } catch (error) {
        console.error('Batch Sync Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Batch Sync Error: ' + error.message });
    }
};

/**
 * Trigger batch sync for all active ASINs across all sellers assigned to the user.
 */
exports.syncAllAsins = async (req, res) => {
    console.log('📨 Entering syncAllAsins handler');
    try {
        const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
        const filter = { status: 'Active' };

        if (!isAdmin) {
            const allowedSellerIds = req.user.assignedSellers.map(s => s._id);
            filter.seller = { $in: allowedSellerIds };
        }

        const asins = await Asin.find(filter).populate('seller');
        if (asins.length === 0) {
            return res.json({ success: true, message: 'No active ASINs to sync' });
        }

        // Update ASIN statuses
        await Asin.updateMany(
            { _id: { $in: asins.map(a => a._id) } },
            { $set: { scrapeStatus: 'SCRAPING', status: 'Scraping' } }
        );

        // Process in background
        const DirectScraperService = require('../services/directScraperService');
        const MarketSyncService = require('../services/marketDataSyncService');
        const SocketService = require('../services/socketService');

        // Fire and forget background process
        setTimeout(async () => {
            const CONCURRENCY_LIMIT = parseInt(process.env.CONCURRENCY_LIMIT || '5', 10);
            const CHUNK_SIZE = 5; // Emit progress more frequently for UI responsiveness
            let processedCount = 0;
            const io = SocketService.getIo(); // Correctly get Socket.io instance

            const broadcastProgress = (statusText) => {
                if (io) {
                    // Broadcast globally so any connected dashboard sees the global sync progress
                    io.emit('scrape_progress', {
                        total: asins.length,
                        processed: processedCount,
                        status: statusText,
                        timestamp: Date.now()
                    });
                }
            };

            console.log(`🚀 Starting background sync for ${asins.length} ASINs with concurrency ${CONCURRENCY_LIMIT}`);
            broadcastProgress('Initializing Scrape Task...');

            // Helper function to process a single ASIN
            const processAsin = async (asin) => {
                try {
                    const isConfigured = MarketSyncService.isConfigured();
                    let useDirect = !asin.seller?.marketSyncTaskId || !isConfigured;

                    console.log(`[BatchSync] Processing ${asin.asinCode}: taskId=${asin.seller?.marketSyncTaskId}, isConfigured=${isConfigured} => useDirect=${useDirect}`);

                    if (!useDirect) {
                        try {
                            await MarketSyncService.triggerSync(
                                asin.seller.marketSyncTaskId,
                                [{ name: 'ASIN', value: asin.asinCode }]
                            );
                        } catch (octoError) {
                            console.warn(`⚠️ Octoparse trigger failed for ${asin.asinCode}, falling back to Direct:`, octoError.message);
                            useDirect = true;
                        }
                    }

                    if (useDirect) {
                        const rawData = await DirectScraperService.scrapeAsin(asin.asinCode);
                        await MarketSyncService.updateAsinMetrics(asin._id, rawData);
                    }
                    console.log(`✅ Background sync completed for ASIN: ${asin.asinCode}`);
                } catch (err) {
                    console.error(`❌ Background sync failed for ASIN: ${asin.asinCode}`, err.message);
                    await Asin.updateOne({ _id: asin._id }, { $set: { scrapeStatus: 'FAILED', status: 'Error' } });
                }
            };

            // Process strictly with concurrency limit using a queue pool
            let index = 0;
            const workers = Array(CONCURRENCY_LIMIT).fill(null).map(async () => {
                while (index < asins.length) {
                    const currentIndex = index++;
                    const asin = asins[currentIndex];
                    await processAsin(asin);
                    processedCount++;

                    if (processedCount % CHUNK_SIZE === 0 || processedCount === asins.length) {
                        const percent = ((processedCount / asins.length) * 100).toFixed(1);
                        console.log(`📊 Sync Progress: ${processedCount}/${asins.length} ASINs processed (${percent}%).`);
                        broadcastProgress(`Scraping in progress... (${percent}%)`);
                    }
                    // Small delay between requests per worker to be polite
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            });

            await Promise.all(workers);
            console.log(`🎉 Global sync finished processing ${asins.length} ASINs.`);
            broadcastProgress('Complete');

        }, 0);

        res.json({
            success: true,
            message: `Global sync initiated for ${asins.length} ASINs`,
            count: asins.length
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
        const seller = await Seller.findById(sellerId);

        if (!seller || !seller.marketSyncTaskId) {
            return res.status(404).json({ success: false, error: 'Seller or Sync Task not found' });
        }

        const data = await MarketSyncService.retrieveResults(seller.marketSyncTaskId);

        if (!data || data.length === 0) {
            return res.json({ success: true, message: 'No new data found from provider' });
        }

        let updatedCount = 0;
        for (const item of data) {
            // Find ASIN by code for this seller
            const asin = await Asin.findOne({
                asinCode: item.ASIN || item.asin,
                seller: sellerId
            });

            if (asin) {
                await MarketSyncService.updateAsinMetrics(asin._id, item);
                updatedCount++;
            }
        }

        res.json({
            success: true,
            message: `Processed ${data.length} items, updated ${updatedCount} ASINs`,
            count: updatedCount
        });
    } catch (error) {
        console.error('Fetch Results Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch and apply results' });
    }
};

/**
 * Provide general status of sync capabilities.
 */
exports.getSyncStatus = async (req, res) => {
    try {
        await MarketSyncService.authenticate();
        res.json({ success: true, service: 'Operational', provider: 'Connected' });
    } catch (error) {
        res.json({ success: true, service: 'Maintenance', provider: 'Disconnected' });
    }
};
