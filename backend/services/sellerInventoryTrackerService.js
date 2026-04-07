/**
 * Seller Inventory Tracker Service
 * Uses Keepa API to track seller inventory and detect new ASINs.
 * Adds any new ASINs to the system automatically.
 */

const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const Notification = require('../models/Notification');
const { getSellerAsins, getTokenStatus, isValidSellerId } = require('./keepaService');
const marketDataSyncService = require('./marketDataSyncService');

class SellerInventoryTracker {
    constructor() {
        this.syncLocks = new Map();
    }

    /**
     * Main entry point - sync all active sellers' inventory
     */
    async syncAllSellersInventory() {
        console.log('[InventoryTracker] Starting inventory sync for all sellers...');
        
        const sellers = await Seller.find({ 
            status: 'Active',
            $or: [
                { keepaSellerId: { $exists: true, $ne: '' } },
                { sellerId: { $exists: true, $ne: '' } }
            ]
        });

        if (sellers.length === 0) {
            console.log('[InventoryTracker] No sellers with Keepa seller ID configured');
            return { success: false, reason: 'No sellers configured' };
        }

        console.log(`[InventoryTracker] Syncing ${sellers.length} sellers...`);

        const results = await Promise.allSettled(
            sellers.map(seller => this.syncSellerInventory(seller))
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const totalNewAsins = results
            .filter(r => r.status === 'fulfilled')
            .reduce((sum, r) => sum + (r.value?.newAsinsCount || 0), 0);

        console.log(`[InventoryTracker] Completed: ${successful} success, ${failed} failed, ${totalNewAsins} new ASINs added`);

        return {
            success: true,
            totalSellers: sellers.length,
            successful,
            failed,
            totalNewAsins
        };
    }

    /**
     * Sync a single seller's inventory from Keepa
     */
    async syncSellerInventory(sellerId) {
        const sellerIdStr = sellerId.toString();
        
        if (this.syncLocks.get(sellerIdStr)) {
            console.log(`[InventoryTracker] Sync already in progress for seller ${sellerIdStr}`);
            return { success: false, reason: 'Already syncing' };
        }
        this.syncLocks.set(sellerIdStr, true);

        try {
            const seller = await Seller.findById(sellerId);
            if (!seller) {
                throw new Error('Seller not found');
            }

            console.log(`[InventoryTracker] Processing seller: ${seller.name}`);
            console.log(`[InventoryTracker] - keepaSellerId: "${seller.keepaSellerId}"`);
            console.log(`[InventoryTracker] - sellerId: "${seller.sellerId}"`);
            console.log(`[InventoryTracker] - marketplace: "${seller.marketplace}"`);

            // Use keepaSellerId if set, otherwise fallback to sellerId
            const lookupId = seller.keepaSellerId || seller.sellerId;
            console.log(`[InventoryTracker] Will query Keepa with ID: "${lookupId}"`);

            if (!lookupId) {
                console.log(`[InventoryTracker] Seller ${seller.name} has no Keepa seller ID or seller ID configured`);
                return { success: false, reason: 'No Keepa seller ID' };
            }

            // Validate seller ID format before making API call
            if (!isValidSellerId(lookupId)) {
                console.log(`[InventoryTracker] Seller ${seller.name} has invalid Keepa seller ID format: "${lookupId}"`);
                return { success: false, reason: `Invalid seller ID format: "${lookupId}". Must be like A1Z2XYZ3` };
            }

            console.log(`[InventoryTracker] Fetching inventory for seller: ${seller.name} (Keepa ID: ${lookupId})`);
            
            const keepaAsins = await getSellerAsins(lookupId, seller.marketplace || 'amazon.in');

            console.log(`[InventoryTracker] Keepa returned ${keepaAsins.length} ASINs for ${seller.name}`);

            if (keepaAsins.length === 0) {
                console.log(`[InventoryTracker] No ASINs found in Keepa response for seller: ${seller.name}`);
                return { success: true, newAsinsCount: 0, totalAsins: 0 };
            }

            // Debug: log sample ASINs
            console.log(`[InventoryTracker] Sample ASINs from Keepa:`, keepaAsins.slice(0, 5));

            // Get existing ASINs in DB
            const existingAsins = await Asin.find({ seller: seller._id }).select('asinCode').lean();
            console.log(`[InventoryTracker] Existing ASINs in DB for ${seller.name}: ${existingAsins.length}`);
            const existingCodes = new Set(existingAsins.map(a => a.asinCode.toUpperCase()));

            // If no existing ASINs, treat all as new
            if (existingAsins.length === 0) {
                console.log(`[InventoryTracker] No existing ASINs for seller ${seller.name}. Adding all ${keepaAsins.length} from Keepa.`);
            }

            // Find new ASINs (case-insensitive comparison)
            const newAsins = existingAsins.length === 0 
                ? keepaAsins // If no existing, all are new
                : keepaAsins.filter(code => !existingCodes.has(code.toUpperCase()));

            console.log(`[InventoryTracker] ${seller.name}: ${keepaAsins.length} on Keepa, ${existingCodes.size} in DB, ${newAsins.length} new`);

            let addedAsins = [];
            if (newAsins.length > 0) {
                // Add new ASINs to database
                const docs = newAsins.map(code => ({
                    asinCode: code.toUpperCase(),
                    seller: seller._id,
                    status: 'Active',
                    scrapeStatus: 'PENDING',
                    source: 'KEEPA_INVENTORY_TRACKER',
                    title: 'Pending Scrape',
                    createdAt: new Date()
                }));

                addedAsins = await Asin.insertMany(docs).catch(err => {
                    console.warn(`[InventoryTracker] Partial insert error: ${err.message}`);
                    return [];
                });

                console.log(`[InventoryTracker] Added ${addedAsins.length} new ASINs for seller: ${seller.name}`);

                // Send notifications
                await this.sendNotifications(seller, addedAsins.length);

                // Trigger Octoparse sync if configured
                if (marketDataSyncService.isConfigured()) {
                    console.log(`[InventoryTracker] Triggering Octoparse sync for ${seller.name} (+${addedAsins.length} ASINs)`);
                    marketDataSyncService.syncSellerAsinsToOctoparse(seller._id, { triggerScrape: true })
                        .catch(err => console.error(`[InventoryTracker] Octoparse trigger failed: ${err.message}`));
                }
            }

            // Update seller stats
            await Seller.findByIdAndUpdate(seller._id, {
                keepaAsinCount: keepaAsins.length,
                lastKeepaSync: new Date(),
                totalAsins: existingCodes.size + addedAsins.length,
                activeAsins: existingCodes.size + addedAsins.length
            });

            return {
                success: true,
                sellerName: seller.name,
                keepaAsinsCount: keepaAsins.length,
                existingAsinsCount: existingCodes.size,
                newAsinsCount: addedAsins.length,
                newAsins: addedAsins.map(a => a.asinCode)
            };

        } catch (error) {
            console.error(`[InventoryTracker] Error syncing seller ${sellerId}:`, error.message);
            return { success: false, error: error.message };
        } finally {
            this.syncLocks.delete(sellerIdStr);
        }
    }

    /**
     * Send notifications to seller users about new ASINs
     */
    async sendNotifications(seller, newAsinsCount) {
        if (!seller.users || seller.users.length === 0 || newAsinsCount === 0) {
            return;
        }

        try {
            const message = `📦 Inventory Update: ${newAsinsCount} new ASINs discovered for seller "${seller.name}" via Keepa tracking.`;

            for (const userId of seller.users) {
                await Notification.create({
                    recipient: userId,
                    type: 'SYSTEM',
                    referenceModel: 'Seller',
                    referenceId: seller._id,
                    message,
                    createdAt: new Date()
                });
            }
            console.log(`[InventoryTracker] Sent notifications to ${seller.users.length} users`);
        } catch (err) {
            console.error(`[InventoryTracker] Notification error: ${err.message}`);
        }
    }

    /**
     * Get current token status from Keepa
     */
    async getTokenStatus() {
        return await getTokenStatus();
    }

    /**
     * Get detailed inventory status for a seller
     */
    async getInventoryStatus(sellerId) {
        const seller = await Seller.findById(sellerId);
        if (!seller) return null;

        const dbAsins = await Asin.find({ seller: seller._id }).select('asinCode scrapeStatus status createdAt');
        
        const activeCount = dbAsins.filter(a => a.status === 'Active').length;
        const pendingCount = dbAsins.filter(a => a.scrapeStatus === 'PENDING').length;
        const completedCount = dbAsins.filter(a => a.scrapeStatus === 'COMPLETED').length;

        return {
            sellerName: seller.name,
            keepaSellerId: seller.keepaSellerId,
            lastKeepaSync: seller.lastKeepaSync,
            keepaAsinCount: seller.keepaAsinCount || 0,
            dbTotal: dbAsins.length,
            dbActive: activeCount,
            dbPending: pendingCount,
            dbCompleted: completedCount,
            newAsinsToday: dbAsins.filter(a => {
                const today = new Date();
                return a.createdAt >= new Date(today.setHours(0, 0, 0, 0));
            }).length
        };
    }
}

module.exports = new SellerInventoryTracker();