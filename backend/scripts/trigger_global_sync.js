const mongoose = require('mongoose');
require('dotenv').config();
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const octoparseAutomationService = require('../services/octoparseAutomationService');

async function triggerGlobalSync() {
    try {
        console.log('🔄 [TRIGGER] Starting Global ASIN Injection & Sync Script...');
        
        // 1. Connect to MongoDB
        const mongoOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        };
        
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell', mongoOptions);
        console.log('✅ Connected to MongoDB');

        // 2. Clear all locks first to ensure we can start fresh
        console.log('🧹 Clearing all sync locks...');
        octoparseAutomationService.syncLocks.clear();

        // 3. Find all active ASINs to identify sellers
        const activeAsins = await Asin.find({ status: 'Active' });
        const sellerIds = [...new Set(activeAsins.map(a => a.seller.toString()))];
        
        console.log(`📊 Found ${activeAsins.length} active ASINs across ${sellerIds.length} sellers.`);

        const results = [];
        
        // 4. Process each seller
        for (const sellerId of sellerIds) {
            try {
                const seller = await Seller.findById(sellerId);
                if (!seller) continue;
                
                console.log(`🚀 [${seller.name}] Triggering injection and scrape...`);
                
                // Set ASINs to Scraping status
                await Asin.updateMany(
                    { seller: sellerId, status: 'Active' },
                    { $set: { scrapeStatus: 'SCRAPING', status: 'Scraping' } }
                );

                const success = await octoparseAutomationService.syncSellerAsinsToOctoparse(sellerId, {
                    triggerScrape: true,
                    forceReRun: true,
                    fullSync: true
                });

                if (success) {
                    console.log(`✅ [${seller.name}] Sync successfully triggered.`);
                    results.push({ seller: seller.name, status: 'SUCCESS' });
                } else {
                    console.error(`❌ [${seller.name}] Sync trigger failed.`);
                    results.push({ seller: seller.name, status: 'FAILED' });
                }
            } catch (err) {
                console.error(`❌ Error processing seller ${sellerId}:`, err.message);
                results.push({ sellerId, status: 'ERROR', error: err.message });
            }
        }

        console.log('\n--- SYNC SUMMARY ---');
        console.table(results);
        console.log('--------------------\n');
        
        console.log('🎉 Global trigger script finished. Background workers will handle the rest.');
        process.exit(0);
    } catch (error) {
        console.error('💥 Critical Script Error:', error.message);
        process.exit(1);
    }
}

triggerGlobalSync();
