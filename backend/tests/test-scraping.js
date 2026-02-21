const mongoose = require('mongoose');
require('dotenv').config();
const Asin = require('./models/Asin');
const Seller = require('./models/Seller');
const marketSyncService = require('./services/marketDataSyncService');

async function verifyScraping() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell');
        console.log('✅ Connected');

        // 1. Create a dummy seller and ASIN
        const seller = await Seller.create({
            name: 'Test Scraping Seller',
            marketplace: 'amazon.in',
            sellerId: 'SCRAPE-TEST-' + Date.now(),
            marketSyncTaskId: 'TASK-123'
        });

        const asin = await Asin.create({
            asinCode: 'B0TEST' + Date.now(),
            seller: seller._id,
            title: 'Initial Title',
            status: 'Active'
        });

        console.log(`📦 Created Test ASIN: ${asin.asinCode}`);

        // 2. Simulate raw data from Octoparse
        const mockRawData = {
            asin: asin.asinCode,
            title: 'Enhanced Wireless Earbuds Pro with Extreme Noise Cancellation and Long Battery Life for Professionals',
            description: 'This is a long description that should exceed five hundred characters to test the LQS score calculation logic effectively. It contains detailed information about the product features, specifications, and advantages over competitors. We are adding more text here to make sure it is long enough. Blah blah blah. More features, more specs, more advantages. Even more text to reach the limit. Almost there. Done.',
            price: 2999.50,
            bsr: 450,
            rating: 4.8,
            reviews: 1250,
            imageCount: 9,
            hasAplus: true
        };

        console.log('🔄 Applying mock scraping results...');
        await marketSyncService.updateAsinMetrics(asin._id, mockRawData);

        // 3. Verify updates
        const updatedAsin = await Asin.findById(asin._id);
        console.log('\n📊 Updated ASIN Metrics:');
        console.log(`- Title: ${updatedAsin.title.substring(0, 50)}...`);
        console.log(`- Price: ₹${updatedAsin.currentPrice}`);
        console.log(`- BSR: #${updatedAsin.bsr}`);
        console.log(`- Rating: ${updatedAsin.rating} (${updatedAsin.reviewCount} reviews)`);
        console.log(`- LQS Score: ${updatedAsin.lqs}/100`);
        console.log(`- Images: ${updatedAsin.imagesCount}`);
        console.log(`- A+ Content: ${updatedAsin.hasAplus}`);

        if (updatedAsin.lqs === 100) {
            console.log('\n✅ LQS Calculation Verified (100/100 as expected)');
        } else {
            console.warn(`\n⚠️ LQS Calculation returned ${updatedAsin.lqs}/100`);
        }

        if (updatedAsin.currentPrice === 2999.50 && updatedAsin.bsr === 450) {
            console.log('✅ Metrics Mapping Verified');
        } else {
            console.error('❌ Metrics Mapping Failed');
        }

        // 4. Cleanup
        await Asin.findByIdAndDelete(asin._id);
        await Seller.findByIdAndDelete(seller._id);
        console.log('\n🧹 Cleanup complete');

        process.exit(0);
    } catch (error) {
        console.error('❌ Verification Error:', error);
        process.exit(1);
    }
}

verifyScraping();
