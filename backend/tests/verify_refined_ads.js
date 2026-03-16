
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const AdsPerformance = require('../models/AdsPerformance');

const testDailyData = [
  {
    "asin": "\"\"\"B08MZG8X6X\"\"\"",
    "date": "\"\"\"2026-02-27\"\"\"",
    "metrics.spend": "\"\"\"5.50\"\"\"",
    "metrics.sales": "\"\"\"120.00\"\"\"",
    "metrics.impressions": "\"\"\"1000\"\"\"",
    "metrics.clicks": "\"\"\"50\"\"\"",
    "metrics.orders": "\"\"\"2\"\"\""
  }
];

const testMonthlyData = [
  {
    "metrics.asin": "\"\"\"B08MZG8X6X\"\"\"",
    "metrics.date": "\"\"\"2026-02-01\"\"\"",
    "metrics.spend": "\"\"\"150.00\"\"\"",
    "metrics.sales": "\"\"\"3500.00\"\"\"",
    "metrics.impressions": "\"\"\"25000\"\"\"",
    "metrics.clicks": "\"\"\"1200\"\"\"",
    "metrics.orders": "\"\"\"45\"\"\""
  }
];

// Helper to clean and parse data similar to the controller
const cleanValue = (val) => {
  if (val === null || val === undefined) return null;
  let cleaned = val.toString().trim();
  cleaned = cleaned.replace(/^"+|"+$/g, '');
  if (cleaned.toLowerCase() === 'none' || cleaned === '') return null;
  return cleaned;
};

const mappings = {
  asin: ['asin', 'Advertised ASIN', 'ASIN', 'metrics.asin'],
  sku: ['sku', 'Advertised SKU', 'SKU', 'metrics.sku'],
  spend: ['metrics.spend', 'Spend', 'ad_spend', 'Total Spend'],
  sales: ['metrics.sales', '7 Day Total Sales', 'Total Sales', 'ad_sales', 'Sales'],
  impressions: ['metrics.impressions', 'Impressions', 'impressions'],
  clicks: ['metrics.clicks', 'Clicks', 'clicks'],
  orders: ['metrics.orders', '7 Day Total Orders', 'Total Orders', 'orders'],
  date: ['date', 'Date', 'Day', 'metrics.date']
};

const findValue = (row, fields) => {
  const key = Object.keys(row).find(k => fields.includes(k));
  return key ? cleanValue(row[key]) : null;
};

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear previous test data for this ASIN
    await AdsPerformance.deleteMany({ asin: 'B08MZG8X6X' });
    console.log('Cleared previous test data');

    // Test Daily Data Simulation
    console.log('Testing Daily Data Parsing...');
    for (const row of testDailyData) {
      const asin = findValue(row, mappings.asin);
      const spend = parseFloat(findValue(row, mappings.spend) || '0');
      const sales = parseFloat(findValue(row, mappings.sales) || '0');
      const date = findValue(row, mappings.date);
      
      await AdsPerformance.findOneAndUpdate(
        { asin, date: new Date(date), reportType: 'daily' },
        { ad_spend: spend, ad_sales: sales, reportType: 'daily' },
        { upsert: true, new: true }
      );
    }
    console.log('Daily data processed.');

    // Test Monthly Data Simulation
    console.log('Testing Monthly Data Parsing...');
    for (const row of testMonthlyData) {
      const asin = findValue(row, mappings.asin);
      const spend = parseFloat(findValue(row, mappings.spend) || '0');
      const sales = parseFloat(findValue(row, mappings.sales) || '0');
      const month = findValue(row, mappings.date);
      
      await AdsPerformance.findOneAndUpdate(
        { asin, month: new Date(month), reportType: 'monthly' },
        { ad_spend: spend, ad_sales: sales, reportType: 'monthly' },
        { upsert: true, new: true }
      );
    }
    console.log('Monthly data processed.');

    // Verify Results
    const daily = await AdsPerformance.findOne({ asin: 'B08MZG8X6X', reportType: 'daily' });
    console.log('Daily Verification:', daily ? 'SUCCESS' : 'FAILURE', daily);

    const monthly = await AdsPerformance.findOne({ asin: 'B08MZG8X6X', reportType: 'monthly' });
    console.log('Monthly Verification:', monthly ? 'SUCCESS' : 'FAILURE', monthly);

    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

runTest();
