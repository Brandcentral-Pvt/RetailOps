const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const AlertModel = require('../models/AlertModel');
const { AlertRule } = AlertModel;
const axios = require('axios');

// Fetch random avatars from Unsplash
const fetchUnsplashAvatar = async (query = 'person portrait') => {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) return null;

    const response = await axios.get('https://api.unsplash.com/photos/random', {
      params: { query, orientation: 'squarish' },
      headers: { Authorization: `Client-ID ${accessKey}` }
    });

    return response.data.urls.small;
  } catch (error) {
    console.error('Unsplash Avatar Error:', error.response?.data || error.message);
    return null;
  }
};

// Demo data arrays
const asinPrefixes = ['B07', 'B08', 'B09', 'B01', 'B00'];
const productNames = [
  'Wireless Bluetooth Headphones',
  'USB-C Charging Cable',
  'Smart Watch Pro',
  'Laptop Stand Aluminum',
  'Mechanical Keyboard RGB',
  'Wireless Mouse Ergonomic',
  'Monitor Light Bar',
  'Webcam HD 1080p',
  'Desk Organizer Premium',
  'Phone Stand Adjustable',
  'Power Bank 20000mAh',
  'Wireless Charger Pad',
  'LED Desk Lamp',
  'Portable Speaker',
  'Gaming Headset',
];


// Get dashboard summary from database
exports.getDashboardSummary = async (req, res) => {
  try {
    const [users, roles, permissions, sellers, asins, alertRules] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Role.countDocuments({ isActive: true }),
      Permission.countDocuments(),
      Seller.countDocuments({ status: 'Active' }),
      Asin.countDocuments({ isActive: true }),
      AlertRule.countDocuments({ active: true }),
    ]);

    const allAsins = await Asin.find({ isActive: true }).populate('seller');

    const totalRevenue = allAsins.reduce((sum, a) => sum + (a.currentPrice * (a.reviewCount || 100) * 0.3), 0);
    const totalUnits = allAsins.reduce((sum, a) => sum + ((a.reviewCount || 100) * 0.3), 0);
    const avgAcos = allAsins.length > 0 ? 22 : 0;
    const avgRoas = allAsins.length > 0 ? 3.5 : 0;
    const totalProfit = totalRevenue * 0.22;
    const lowStockCount = 3; // Default value since stock field doesn't exist

    res.json({
      success: true,
      data: {
        kpis: [
          { id: 1, title: 'Total Revenue', value: `₹${Math.round(totalRevenue).toLocaleString()}`, icon: 'bi-currency-rupee', trend: 12.5, trendType: 'positive' },
          { id: 2, title: 'Units Sold (30d)', value: totalUnits.toLocaleString(), icon: 'bi-box-seam', trend: 8.3, trendType: 'positive' },
          { id: 3, title: 'Avg ACoS', value: `${avgAcos.toFixed(1)}%`, icon: 'bi-percent', trend: 2.1, trendType: 'positive' },
          { id: 4, title: 'Avg ROAS', value: `${avgRoas.toFixed(2)}x`, icon: 'bi-graph-up', trend: 5.7, trendType: 'positive' },
          { id: 5, title: 'Net Profit (30d)', value: `₹${Math.round(totalProfit).toLocaleString()}`, icon: 'bi-cash-stack', trend: 15.2, trendType: 'positive' },
          { id: 6, title: 'Low Stock Items', value: lowStockCount.toString(), icon: 'bi-exclamation-triangle', trend: lowStockCount, trendType: lowStockCount > 5 ? 'negative' : 'positive' },
          { id: 7, title: 'Active Sellers', value: sellers.toString(), icon: 'bi-shop', trend: 0, trendType: 'neutral' },
          { id: 8, title: 'Active ASINs', value: asins.toString(), icon: 'bi-tag', trend: 0, trendType: 'neutral' },
        ],
        counts: { users, roles, permissions, sellers, asins, alertRules },
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dashboard summary' });
  }
};

exports.seedAll = async (req, res) => {
  try {
    const Permission = require('../models/Permission');
    await Role.seedDefaultRoles(Permission);
    res.json({ success: true, message: 'System roles and permissions seeded successfully' });
  } catch (error) {
    console.error('Seed all error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed system roles' });
  }
};
