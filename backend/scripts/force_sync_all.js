/**
 * Force Sync All - Injection Script
 * Fetches ALL historical data from Octoparse for all active sellers
 * and performs a full database injection.
 */
require('dotenv').config({ path: './backend/.env' });
const mongoose = require('mongoose');
const octoparseAutomationService = require('../services/octoparseAutomationService');
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');

async function runForceSync() {
    console.log('🚀 [FORCE-SYNC] Starting Global Data Injection...');
    
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Finding active sellers...');
        const sellers = await Seller.find({ 
            status: 'Active', 
            marketSyncTaskId: { $exists: true, $ne: '' } 
        });
        console.log(`📊 Found ${sellers.length} active sellers.`);

        console.log(`📊 Found ${sellers.length} sellers with Octoparse tasks`);

        for (const seller of sellers) {
            console.log(`\n---------------------------------------------------------`);
            console.log(`🏢 Processing Seller: ${seller.name}`);
            console.log(`🆔 Task ID: ${seller.marketSyncTaskId}`);
            console.log(`---------------------------------------------------------`);

            try {
                // 1. Fetch ALL data (Historical + New)
                console.log(`📥 Fetching ALL results from Octoparse...`);
                const allResults = await octoparseAutomationService.fetchAllResults(seller.marketSyncTaskId);
                
                if (allResults.length === 0) {
                    console.log(`⚠️ No data found for task ${seller.marketSyncTaskId}`);
                    continue;
                }

                console.log(`💾 Injecting ${allResults.length} items into database...`);
                
                // 2. Process results (updates DB)
                const updatedCount = await octoparseAutomationService.processResults(seller._id, allResults);
                
                console.log(`✅ Successfully updated ${updatedCount}/${allResults.length} ASINs for ${seller.name}`);

            } catch (sellerErr) {
                console.error(`❌ Error processing seller ${seller.name}:`, sellerErr.message);
            }
        }

        console.log('\n\n=========================================================');
        console.log('🎉 GLOBAL FORCE SYNC COMPLETE');
        console.log('=========================================================');

    } catch (err) {
        console.error('❌ Critical Failure:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

runForceSync();
