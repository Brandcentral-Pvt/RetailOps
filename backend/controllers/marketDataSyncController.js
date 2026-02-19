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
        const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller._id.toString());

        if (!isAdmin && !isAssigned) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to ASIN sync' });
        }

        const taskId = asin.seller?.marketSyncTaskId;
        if (!taskId) {
            return res.status(400).json({
                success: false,
                error: 'No Sync Task configured for this seller'
            });
        }

        // Check if sync already in progress
        if (asin.scrapeStatus === 'SCRAPING') {
            return res.status(400).json({ success: false, error: 'Sync already in progress' });
        }

        // Update status to scraping
        asin.scrapeStatus = 'SCRAPING';
        asin.status = 'Scraping';
        await asin.save();

        // Trigger extraction in service (Discreet ASIN sync)
        const syncResult = await MarketSyncService.triggerSync(
            taskId,
            [{ name: 'ASIN', value: asin.asinCode }]
        );

        res.json({
            success: true,
            message: 'Market data sync initiated',
            status: 'SCRAPING'
        });
    } catch (error) {
        console.error('Market Sync Controller Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Market Sync Error' });
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

        if (!seller || !seller.marketSyncTaskId) {
            return res.status(404).json({ success: false, error: 'Seller or Sync Task not found' });
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

        // Trigger extraction in service (Batch ASIN sync)
        await MarketSyncService.triggerSync(
            seller.marketSyncTaskId,
            [{ name: 'ASIN', value: asinCodes.join(',') }]
        );

        res.json({
            success: true,
            message: `Batch sync initiated for ${asins.length} ASINs`,
            count: asins.length
        });
    } catch (error) {
        console.error('Batch Sync Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Batch Sync Error' });
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
