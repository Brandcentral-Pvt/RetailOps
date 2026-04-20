/**
 * Fix Review Counts - Cleanup Script
 * Identifies ASINs with review counts likely corrupted by the "5" rating prefix.
 * e.g. "5 stars (22 reviews)" parsed as 522.
 */
require('dotenv').config({ path: './backend/.env' });
const mongoose = require('mongoose');
const Asin = require('../models/Asin');

async function fixReviewCounts() {
    console.log('🔍 [CLEANUP] Scanning for corrupted review counts...');
    
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Pattern: Starts with 5 (e.g. 522, 50522)
        // This is a heuristic. We compare with historical values if available.
        const suspiciousAsins = await Asin.find({
            reviewCount: { $gte: 5, $lte: 6000000 },
            status: 'Active'
        });

        console.log(`📊 Found ${suspiciousAsins.length} potentially suspicious ASINs`);
        let fixedCount = 0;

        for (const asin of suspiciousAsins) {
            const current = asin.reviewCount.toString();
            
            // Heuristic 1: If it starts with 5 and ends with a much smaller number found in history
            // Actually, let's just look for the specific "5" prefixing.
            // If the count is 5XX and previous was < 100, it's likely a bug.
            
            if (current.startsWith('5')) {
                const legacyFixed = current.substring(1); // Remove the '5'
                const legacyVal = parseInt(legacyFixed) || 0;

                // Check history for sanity check
                const lastHistory = asin.weekHistory && asin.weekHistory.length > 1 ? 
                    asin.weekHistory[asin.weekHistory.length - 2].reviews : null;

                if (lastHistory !== null && lastHistory < 500 && legacyVal < 100) {
                     // High confidence fix
                     console.log(`✨ [FIX] ASIN ${asin.asinCode}: ${asin.reviewCount} -> ${legacyVal} (based on history: ${lastHistory})`);
                     asin.reviewCount = legacyVal;
                     await asin.save();
                     fixedCount++;
                } else if (current.length >= 3 && current.startsWith('5') && parseInt(current) > 500 && parseInt(current) < 600) {
                     // Moderate confidence fix for the "522" case
                     // Instead of automatically fixing, let's mark it for re-scrape
                     asin.scrapeStatus = 'RETRY';
                     await asin.save();
                }
            }
        }

        console.log(`\n✅ Cleanup complete. Fixed ${fixedCount} ASINs and marked others for retry.`);

    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

fixReviewCounts();
