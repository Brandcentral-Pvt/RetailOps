const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const User = require('../models/User');

/**
 * Enrich sellers with their assigned managers.
 * A manager is a User who has the seller's _id in their `assignedSellers` array.
 */
const enrichSellersWithManagers = async (sellers) => {
  if (!sellers || sellers.length === 0) return sellers;
  const sellerIds = sellers.map(s => s._id);
  // Find all users that manage at least one of these sellers
  const managers = await User.find({ assignedSellers: { $in: sellerIds } })
    .select('firstName lastName email assignedSellers')
    .lean();

  return sellers.map(seller => {
    const sellerObj = seller.toObject ? seller.toObject() : { ...seller };
    sellerObj.managers = managers
      .filter(m => m.assignedSellers.some(sid => sid.toString() === sellerObj._id.toString()))
      .map(m => ({ _id: m._id, firstName: m.firstName, lastName: m.lastName, email: m.email }));
    return sellerObj;
  });
};

// Get all sellers
exports.getSellers = async (req, res) => {
  try {
    // If not admin, return only assigned sellers
    if (req.user && req.user.role && req.user.role.name !== 'admin') {
      const sellerIds = req.user.assignedSellers.map(s => s._id);

      const filter = { _id: { $in: sellerIds } };
      const sellers = await Seller.find(filter).sort({ createdAt: -1 });
      const enriched = await enrichSellersWithManagers(sellers);

      return res.json({
        sellers: enriched,
        pagination: {
          page: 1,
          limit: enriched.length,
          total: enriched.length,
          totalPages: 1
        }
      });
    }

    const { status, marketplace, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (marketplace) filter.marketplace = marketplace;

    const sellers = await Seller.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Seller.countDocuments(filter);
    const enriched = await enrichSellersWithManagers(sellers);

    res.json({
      sellers: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single seller with ASINs
exports.getSeller = async (req, res) => {
  try {
    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === req.params.id);

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to seller profile' });
    }

    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const asins = await Asin.find({ seller: seller._id }).sort({ createdAt: -1 });

    res.json({ seller, asins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new seller
exports.createSeller = async (req, res) => {
  try {
    const userRole = req.user?.role?.name || req.user?.role;
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'Brand Manager';

    // Extract managerId from body (admin can select a manager)
    const { managerId, ...sellerData } = req.body;

    const seller = new Seller(sellerData);
    await seller.save();

    // Validated: Sync to CometChat
    try {
      const { syncSellerToCometChat } = require('../services/cometChatService');
      syncSellerToCometChat(seller);
    } catch (chatError) {
      console.error('CometChat Sync Error during seller creation:', chatError);
    }

    // Determine which manager to assign the seller to
    let assignToManagerId = null;
    if (isManager) {
      // Manager creates: auto-assign to themselves
      assignToManagerId = req.user._id;
    } else if (isAdmin && managerId) {
      // Admin creates with a selected manager
      assignToManagerId = managerId;
    }

    if (assignToManagerId) {
      await User.findByIdAndUpdate(
        assignToManagerId,
        { $addToSet: { assignedSellers: seller._id } },
        { new: true }
      );
    }

    res.status(201).json(seller);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Seller ID already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update seller
exports.updateSeller = async (req, res) => {
  try {
    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === req.params.id);

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to update this seller' });
    }

    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.json(seller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete seller
exports.deleteSeller = async (req, res) => {
  try {
    const userRole = req.user?.role?.name || req.user?.role;
    const isAdmin = userRole === 'admin';
    // Manager can delete sellers assigned to them
    const isAssigned = req.user && (req.user.assignedSellers || []).some(s =>
      (s._id || s).toString() === req.params.id
    );

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to delete this seller' });
    }

    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Delete all ASINs for this seller
    await Asin.deleteMany({ seller: seller._id });

    // Remove seller from any manager's assignedSellers
    await User.updateMany(
      { assignedSellers: seller._id },
      { $pull: { assignedSellers: seller._id } }
    );

    await seller.deleteOne();
    res.json({ message: 'Seller deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk import sellers
exports.importSellers = async (req, res) => {
  try {
    const { sellers } = req.body;

    if (!sellers || !Array.isArray(sellers)) {
      return res.status(400).json({ error: 'Sellers array required' });
    }

    const results = { imported: 0, errors: [] };

    const { syncSellerToCometChat } = require('../services/cometChatService');

    for (const sellerData of sellers) {
      try {
        const seller = new Seller(sellerData);
        await seller.save();

        // Sync to CometChat
        try {
          await syncSellerToCometChat(seller);
        } catch (chatError) {
          console.error(`CometChat Sync Error for imported seller ${sellerData.name}:`, chatError);
        }

        results.imported++;
      } catch (error) {
        results.errors.push({ seller: sellerData.name, error: error.message });
      }
    }

    res.status(201).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Seed demo data
exports.seedDemoData = async (req, res) => {
  try {
    // Check if data already exists
    const existingSellers = await Seller.countDocuments();
    if (existingSellers > 0) {
      return res.json({ message: 'Demo data already exists', count: existingSellers });
    }

    const demoSellers = [
      { name: 'TechGear Pro', marketplace: 'amazon.in', sellerId: 'A1B2C3D4E5F6', apiKey: 'oct_xxx123', plan: 'Pro', scrapeLimit: 500, totalAsins: 45, activeAsins: 42, status: 'Active', lastScraped: new Date() },
      { name: 'HomeEssentials', marketplace: 'amazon.in', sellerId: 'A2B3C4D5E6F7', apiKey: 'oct_xxx456', plan: 'Enterprise', scrapeLimit: 2000, totalAsins: 78, activeAsins: 75, status: 'Active', lastScraped: new Date() },
      { name: 'SportZone', marketplace: 'amazon.com', sellerId: 'A3B4C5D6E7F8', apiKey: 'oct_xxx789', plan: 'Starter', scrapeLimit: 100, totalAsins: 32, activeAsins: 30, status: 'Active', lastScraped: new Date() },
      { name: 'FashionHub', marketplace: 'amazon.uk', sellerId: 'A4B5C6D7E8F9', apiKey: 'oct_xxx012', plan: 'Pro', scrapeLimit: 500, totalAsins: 56, activeAsins: 52, status: 'Active', lastScraped: new Date() },
      { name: 'BeautyCare', marketplace: 'amazon.in', sellerId: 'A5B6C7D8E9F0', apiKey: 'oct_xxx345', plan: 'Pro', scrapeLimit: 500, totalAsins: 89, activeAsins: 85, status: 'Paused', lastScraped: new Date(Date.now() - 86400000) },
      { name: 'KitchenMaster', marketplace: 'amazon.com', sellerId: 'A6B7C8D9E0F1', apiKey: 'oct_xxx678', plan: 'Enterprise', scrapeLimit: 2000, totalAsins: 41, activeAsins: 40, status: 'Active', lastScraped: new Date() },
      { name: 'PetParadise', marketplace: 'amazon.in', sellerId: 'A7B8C9D0E1F2', apiKey: 'oct_xxx901', plan: 'Pro', scrapeLimit: 500, totalAsins: 67, activeAsins: 62, status: 'Active', lastScraped: new Date(Date.now() - 172800000) },
      { name: 'Office Supplies Co', marketplace: 'amazon.uk', sellerId: 'A8B9C0D1E2F3', apiKey: 'oct_xxx234', plan: 'Starter', scrapeLimit: 100, totalAsins: 23, activeAsins: 20, status: 'Active', lastScraped: new Date() },
    ];

    const sellers = await Seller.insertMany(demoSellers);

    // Create demo ASINs for each seller
    const demoAsins = [
      { asinCode: 'B07XYZ123', title: 'Wireless Bluetooth Earbuds Pro with Noise Cancellation', brand: 'AudioTech', currentPrice: 49.99, currentRank: 1250, rating: 4.5, reviewCount: 1250, lqs: 85 },
      { asinCode: 'B07ABC456', title: 'Smart Watch Elite - Fitness Tracker with Heart Rate Monitor', brand: 'FitGear', currentPrice: 199.99, currentRank: 890, rating: 4.2, reviewCount: 890, lqs: 72 },
      { asinCode: 'B07DEF789', title: 'Premium Yoga Mat - Non-Slip Exercise Mat for Home Gym', brand: 'FitLife', currentPrice: 29.99, currentRank: 3200, rating: 4.8, reviewCount: 2100, lqs: 92 },
      { asinCode: 'B07GHI012', title: 'Automatic Coffee Maker Deluxe - 12-Cup Programmable Coffee Machine', brand: 'KitchenPro', currentPrice: 79.99, currentRank: 1560, rating: 4.3, reviewCount: 650, lqs: 68 },
      { asinCode: 'B07JKL345', title: 'Portable Bluetooth Speaker - Waterproof Wireless Speaker with Bass', brand: 'SoundWave', currentPrice: 39.99, currentRank: 2100, rating: 4.1, reviewCount: 1800, lqs: 75 },
    ];

    const asinsToInsert = [];
    for (const seller of sellers) {
      for (const asin of demoAsins) {
        asinsToInsert.push({
          ...asin,
          seller: seller._id,
          status: 'Active',
          lastScraped: new Date(),
          history: [],
          ratingHistory: [],
        });
      }
    }

    await Asin.insertMany(asinsToInsert);

    res.status(201).json({
      message: 'Demo data seeded successfully',
      sellers: sellers.length,
      asins: asinsToInsert.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
