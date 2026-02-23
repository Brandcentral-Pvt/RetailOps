require('dotenv').config();
const mongoose = require('mongoose');
const Asin = require('./backend/models/Asin');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gms')
  .then(async () => {
    const asins = await Asin.find({}).limit(5).lean();
    console.log(JSON.stringify(asins.map(a => ({ asin: a.asinCode, category: a.category })), null, 2));
    process.exit(0);
  });
