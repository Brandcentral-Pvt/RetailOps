const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runFix() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        const { isBuyBoxWinner } = require('../utils/buyBoxUtils');

        console.log('🔍 Scanning all ASINs for BuyBox discrepancies...');
        
        const asins = await mongoose.connection.collection('asins').find({}).toArray();
        let updatedCount = 0;

        for (const asin of asins) {
            const shouldWin = isBuyBoxWinner(asin.soldBy);
            if (asin.buyBoxWin !== shouldWin) {
                await mongoose.connection.collection('asins').updateOne(
                    { _id: asin._id },
                    { $set: { buyBoxWin: shouldWin, updatedAt: new Date() } }
                );
                updatedCount++;
            }
        }

        console.log(`✅ Synchronization Complete!`);
        console.log(`📊 Total ASINs updated: ${updatedCount}`);
        
        // Step 2: Verification
        const lostCount = await mongoose.connection.collection('asins').countDocuments({
            soldBy: { $regex: authorizedRegex },
            buyBoxWin: false
        });
        
        if (lostCount > 0) {
            console.warn(`⚠️ Warning: ${lostCount} ASINs still matching authorized patterns but marked as LOST.`);
        } else {
            console.log(`🎉 Noauthorized sellers remain marked as LOST.`);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Failed:', err);
        process.exit(1);
    }
}

runFix();
