const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const Asin = require('../models/Asin');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');

async function fixBuyBoxStatus() {
    try {
        console.log('🔄 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell');
        console.log('✅ Connected to MongoDB.');

        const asins = await Asin.find({}).select('asinCode soldBy buyBoxWin');
        console.log(`📋 Found ${asins.length} ASINs to check.`);

        let updatedCount = 0;
        let alreadyCorrectCount = 0;

        for (const asin of asins) {
            const correctStatus = isBuyBoxWinner(asin.soldBy);
            
            if (asin.buyBoxWin !== correctStatus) {
                asin.buyBoxWin = correctStatus;
                await asin.save();
                updatedCount++;
                if (updatedCount % 50 === 0) {
                    console.log(`⏳ Progress: Updated ${updatedCount} ASINs...`);
                }
            } else {
                alreadyCorrectCount++;
            }
        }

        console.log('--- Final Result ---');
        console.log(`✅ Total Processed: ${asins.length}`);
        console.log(`✅ Updated: ${updatedCount}`);
        console.log(`✅ Already Correct: ${alreadyCorrectCount}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error during bulk update:', error.message);
        process.exit(1);
    }
}

fixBuyBoxStatus();
