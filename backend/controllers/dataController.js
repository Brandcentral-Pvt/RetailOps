const Master = require("../models/Master");
const MonthlyPerformance = require("../models/MonthlyPerformance");

// Get category-specific attribute mapping
const getCategoryAttributes = (category) => {
  const attributeMaps = {
    apparel: {
      variant1: 'size',
      variant2: 'color'
    },
    electronics: {
      variant1: 'storage',
      variant2: 'ram'
    },
    fmcg: {
      variant1: 'pack_size',
      variant2: 'flavor'
    },
    home_goods: {
      variant1: 'material',
      variant2: 'finish'
    },
    beauty: {
      variant1: 'shade',
      variant2: 'formula'
    },
    industrial: {
      variant1: 'voltage',
      variant2: 'capacity'
    },
    general: {
      variant1: 'attribute1',
      variant2: 'attribute2'
    }
  };
  return attributeMaps[category] || attributeMaps.general;
};

// Get all category options
exports.getCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'general', label: 'All Categories' },
      { value: 'apparel', label: 'Apparel' },
      { value: 'electronics', label: 'Electronics' },
      { value: 'fmcg', label: 'FMCG' },
      { value: 'home_goods', label: 'Home Goods' },
      { value: 'beauty', label: 'Beauty' },
      { value: 'industrial', label: 'Industrial' }
    ];
    res.json(categories);
  } catch (err) {
    console.error("❌ Categories Error:", err);
    res.status(500).send("Error fetching categories");
  }
};

exports.getMasterWithRevenue = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id) : [];

    const result = await Master.aggregate([
      {
        $lookup: {
          from: "asins",
          localField: "asin",
          foreignField: "asinCode",
          as: "asinData"
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: "monthlyperformances",
          localField: "asin",
          foreignField: "asin",
          as: "monthlyData",
        },
      },
      {
        $addFields: {
          total_revenue: { $sum: "$monthlyData.ordered_revenue" },
        },
      },
      {
        $project: {
          sku: 1,
          parent_asin: 1,
          category: 1,
          attributes: 1,
          asin: 1,
          total_revenue: 1,
        },
      },
    ]);

    res.json(result);
  } catch (err) {
    console.error("❌ Controller Error:", err);
    res.status(500).send("Error calculating revenue");
  }
};

exports.getChartData = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id) : [];

    const chartData = await MonthlyPerformance.aggregate([
      {
        $lookup: {
          from: 'asins',
          localField: 'asin',
          foreignField: 'asinCode',
          as: 'asinData'
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: 'masters',
          localField: 'asin',
          foreignField: 'asin',
          as: 'master'
        }
      },
      { $unwind: "$master" },
      {
        $group: {
          _id: {
            size: "$master.size",
            month: { $dateToString: { format: "%Y-%m", date: "$month" } }
          },
          totalRevenue: { $sum: "$ordered_revenue" }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          sizes: {
            $push: {
              size: "$_id.size",
              revenue: "$totalRevenue"
            }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json(chartData);
  } catch (err) {
    console.error("❌ Chart Data Error:", err);
    res.status(500).send("Chart data fetch failed");
  }
};

// 1. Revenue by Attribute (Bar)
exports.getRevenueBySize = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id) : [];

    const data = await MonthlyPerformance.aggregate([
      {
        $lookup: {
          from: 'asins',
          localField: 'asin',
          foreignField: 'asinCode',
          as: 'asinData'
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: 'masters',
          localField: 'asin',
          foreignField: 'asin',
          as: 'master'
        }
      },
      { $unwind: "$master" },
      {
        $group: {
          _id: "$master.size",
          totalRevenue: { $sum: "$ordered_revenue" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (err) {
    console.error("❌ Revenue by Size Error:", err.message);
    res.status(500).send("Error");
  }
};

// 3. Size Share (Pie)
exports.getSizeShare = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id) : [];

    const data = await MonthlyPerformance.aggregate([
      {
        $lookup: {
          from: 'asins',
          localField: 'asin',
          foreignField: 'asinCode',
          as: 'asinData'
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: 'masters',
          localField: 'asin',
          foreignField: 'asin',
          as: 'master'
        }
      },
      { $unwind: "$master" },
      {
        $group: {
          _id: "$master.size",
          revenue: { $sum: "$ordered_revenue" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (err) {
    console.error("❌ Size Share Pie Chart Error:", err.message);
    res.status(500).send("Error");
  }
};

// Dummy ads data API (Updated for multi-tenancy)
exports.getAdsReport = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    const dummyAds = [
      { asin: "B0A1", ad_spend: 1200, clicks: 300, orders: 25, acos: 15.4, ctr: 5.1 },
      { asin: "B0A2", ad_spend: 800, clicks: 180, orders: 20, acos: 18.7, ctr: 4.2 },
      { asin: "B0A3", ad_spend: 2000, clicks: 500, orders: 45, acos: 12.3, ctr: 6.0 },
    ];

    if (!isAdmin) {
      // Filter dummy data to simulate isolation based on allowed sellers
      // In a real scenario, this would query a model with a seller relationship
      const asinsInAllowedSellers = await Asin.find({ seller: { $in: allowedSellerIds } }).select('asinCode');
      const allowedAsins = asinsInAllowedSellers.map(a => a.asinCode);

      const filteredAds = dummyAds.filter(ad => allowedAsins.includes(ad.asin));
      return res.json(filteredAds);
    }

    res.json(dummyAds);
  } catch (err) {
    res.status(500).send("Error fetching ads data");
  }
};

// SKU Report API (Updated for multi-tenancy)
exports.getSkuReport = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    const dummySkuData = [
      { sku: "SKU001", asin: "B0A1", title: "Product 1", size: "S", revenue: 15000, units_sold: 150, price: 100, stock: 200 },
      { sku: "SKU002", asin: "B0A2", title: "Product 2", size: "M", revenue: 20000, units_sold: 200, price: 100, stock: 150 },
      { sku: "SKU003", asin: "B0A3", title: "Product 3", size: "L", revenue: 25000, units_sold: 250, price: 100, stock: 100 },
    ];

    if (!isAdmin) {
      const asinsInAllowedSellers = await Asin.find({ seller: { $in: allowedSellerIds } }).select('asinCode');
      const allowedAsins = asinsInAllowedSellers.map(a => a.asinCode);

      const filteredSku = dummySkuData.filter(sku => allowedAsins.includes(sku.asin));
      return res.json(filteredSku);
    }

    res.json(dummySkuData);
  } catch (err) {
    res.status(500).send("Error fetching SKU report data");
  }
};

// Parent ASIN Report API (Dummy implementation)
exports.getParentAsinReport = async (req, res) => {
  try {
    const dummyParentAsinData = [
      { parent_asin: "B0A0", title: "Product Family 1", total_revenue: 35000, total_units_sold: 350, sku_count: 2, average_price: 100, total_stock: 350 },
      { parent_asin: "B0B0", title: "Product Family 2", total_revenue: 25000, total_units_sold: 250, sku_count: 1, average_price: 100, total_stock: 100 },
    ];
    // In a real scenario, this would also need filtering via a lookup to ASINs/Seller
    res.json(dummyParentAsinData);
  } catch (err) {
    res.status(500).send("Error fetching Parent ASIN report data");
  }
};

// Month-wise Report API
exports.getMonthWiseReport = async (req, res) => {
  try {
    const dummyMonthlyData = [
      { month: "2024-01", total_revenue: 15000, total_units_sold: 150, average_price: 100, sku_count: 3, growth_rate: 10 },
      { month: "2024-02", total_revenue: 18000, total_units_sold: 180, average_price: 100, sku_count: 3, growth_rate: 20 },
      { month: "2024-03", total_revenue: 21000, total_units_sold: 210, average_price: 100, sku_count: 3, growth_rate: 16.67 },
    ];
    res.json(dummyMonthlyData);
  } catch (err) {
    res.status(500).send("Error fetching monthly report data");
  }
};
