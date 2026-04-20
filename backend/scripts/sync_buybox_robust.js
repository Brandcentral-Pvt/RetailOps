const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env from backend/.env relative to this file's future location (backend/scripts/)
dotenv.config({ path: path.join(__dirname, '../.env') });

const Asin = require('../models/Asin');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');

async function runSync() {
    try {
        console.log('🔄 Connecting to MongoDB:', process.env.MONGO_URI?.split('@').pop());
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        const asins = await Asin.find({}).select('asinCode soldBy buyBoxWin');
        console.log(`📋 Processing ${asins.length} ASINs...`);

        let updated = 0;
        for (const asin of asins) {
            const shouldWin = isBuyBoxWinner(asin.soldBy);
            if (asin.buyBoxWin !== shouldWin) {
                asin.buyBoxWin = shouldWin;
                await asin.save();
                updated++;
                if (updated % 100 === 0) console.log(`⏳ Updated ${updated} ASINs...`);
            }
        }

        console.log(`--- Result ---`);
        console.log(`✅ Total Updated: ${updated}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Sync Failed:', err.message);
        process.exit(1);
    }
}

runSync();
