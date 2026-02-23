require('dotenv').config();
const mongoose = require('mongoose');
const Asin = require('../models/Asin');

async function checkDB() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gms_dashboard');
    const asins = await Asin.find({}).limit(5).lean();
    console.log(JSON.stringify(asins.map(a => ({ asinCode: a.asinCode, category: a.category })), null, 2));
    process.exit();
}

checkDB();
