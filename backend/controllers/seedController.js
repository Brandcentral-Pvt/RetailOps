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

// Comprehensive demo data seeding
exports.seedAllDemoData = async (req, res) => {
  try {
    console.log('🌱 Starting comprehensive demo data seeding...');

    // 1. Seed Permissions
    console.log('📝 Seeding permissions...');
    const defaultPermissions = [
      { name: 'dashboard_view', displayName: 'View Dashboard', description: 'View dashboard overview', category: 'dashboard', action: 'view' },
      { name: 'reports_sku_view', displayName: 'View SKU Report', description: 'View SKU performance report', category: 'reports', action: 'view' },
      { name: 'reports_parent_view', displayName: 'View Parent ASIN Report', description: 'View parent ASIN performance report', category: 'reports', action: 'view' },
      { name: 'reports_monthly_view', displayName: 'View Monthly Report', description: 'View monthly performance report', category: 'reports', action: 'view' },
      { name: 'reports_ads_view', displayName: 'View Ads Report', description: 'View advertising performance report', category: 'reports', action: 'view' },
      { name: 'reports_profit_view', displayName: 'View Profit & Loss', description: 'View profit and loss report', category: 'reports', action: 'view' },
      { name: 'reports_inventory_view', displayName: 'View Inventory', description: 'View inventory report', category: 'reports', action: 'view' },
      { name: 'reports_export', displayName: 'Export Reports', description: 'Export report data', category: 'reports', action: 'export' },
      { name: 'sellers_view', displayName: 'View Sellers', description: 'View seller list', category: 'sellers', action: 'view' },
      { name: 'sellers_create', displayName: 'Add Sellers', description: 'Add new sellers', category: 'sellers', action: 'create' },
      { name: 'sellers_edit', displayName: 'Edit Sellers', description: 'Edit seller information', category: 'sellers', action: 'edit' },
      { name: 'sellers_delete', displayName: 'Delete Sellers', description: 'Delete sellers', category: 'sellers', action: 'delete' },
      { name: 'sellers_manage_asins', displayName: 'Manage ASINs', description: 'Manage seller ASINs', category: 'sellers', action: 'manage' },
      { name: 'users_view', displayName: 'View Users', description: 'View user list', category: 'users', action: 'view' },
      { name: 'users_create', displayName: 'Add Users', description: 'Add new users', category: 'users', action: 'create' },
      { name: 'users_edit', displayName: 'Edit Users', description: 'Edit user information', category: 'users', action: 'edit' },
      { name: 'users_delete', displayName: 'Delete Users', description: 'Delete users', category: 'users', action: 'delete' },
      { name: 'users_assign_roles', displayName: 'Assign Roles', description: 'Assign roles to users', category: 'users', action: 'manage' },
      { name: 'roles_view', displayName: 'View Roles', description: 'View roles list', category: 'users', action: 'view' },
      { name: 'roles_create', displayName: 'Create Roles', description: 'Create new roles', category: 'users', action: 'create' },
      { name: 'roles_edit', displayName: 'Edit Roles', description: 'Edit role permissions', category: 'users', action: 'edit' },
      { name: 'roles_delete', displayName: 'Delete Roles', description: 'Delete roles', category: 'users', action: 'delete' },
      { name: 'settings_view', displayName: 'View Settings', description: 'View system settings', category: 'settings', action: 'view' },
      { name: 'settings_edit', displayName: 'Edit Settings', description: 'Edit system settings', category: 'settings', action: 'edit' },
      { name: 'scraping_view', displayName: 'View Scraping', description: 'View scraping tasks', category: 'scraping', action: 'view' },
      { name: 'scraping_create', displayName: 'Create Tasks', description: 'Create scraping tasks', category: 'scraping', action: 'create' },
      { name: 'scraping_manage', displayName: 'Manage Scraping', description: 'Manage all scraping operations', category: 'scraping', action: 'manage' },
      // Actions/Tasks permissions
      { name: 'actions_view', displayName: 'View Actions', description: 'View actions/tasks', category: 'actions', action: 'view' },
      { name: 'actions_create', displayName: 'Create Actions', description: 'Create new actions', category: 'actions', action: 'create' },
      { name: 'actions_manage', displayName: 'Manage Actions', description: 'Manage all actions', category: 'actions', action: 'manage' },
      { name: 'actions_delete', displayName: 'Delete Actions', description: 'Delete actions', category: 'actions', action: 'delete' },
      // Calculator permissions
      { name: 'calculator_view', displayName: 'View Calculator', description: 'Access revenue calculator', category: 'calculator', action: 'view' },
      { name: 'calculator_manage', displayName: 'Manage Calculator', description: 'Manage calculator settings', category: 'calculator', action: 'manage' },
    ];

    for (const perm of defaultPermissions) {
      await Permission.findOneAndUpdate({ name: perm.name }, perm, { upsert: true, new: true });
    }
    const permissions = await Permission.find();
    console.log(`✅ Seeded ${permissions.length} permissions`);

    // 2. Seed Roles
    console.log('🎭 Seeding roles...');
    const roleData = [
      { name: 'admin', displayName: 'Administrator', description: 'Full system access with all permissions', isSystem: true, level: 100, color: '#DC2626' },
      { name: 'manager', displayName: 'Manager', description: 'Can manage sellers and view all reports', isSystem: true, level: 80, color: '#D97706' },
      { name: 'analyst', displayName: 'Analyst', description: 'Can view reports and dashboards', isSystem: true, level: 50, color: '#0891B2' },
      { name: 'viewer', displayName: 'Viewer', description: 'Read-only access to dashboards and reports', isSystem: true, level: 10, color: '#6B7280' },
    ];

    for (const role of roleData) {
      const existingRole = await Role.findOne({ name: role.name });
      if (!existingRole) {
        let rolePermissions;
        if (role.name === 'admin') {
          rolePermissions = permissions.map(p => p._id);
        } else if (role.name === 'manager') {
          rolePermissions = permissions.filter(p => ['dashboard', 'reports', 'sellers', 'scraping', 'actions', 'calculator'].includes(p.category)).map(p => p._id);
        } else if (role.name === 'analyst') {
          rolePermissions = permissions.filter(p => ['dashboard', 'reports'].includes(p.category)).map(p => p._id);
        } else {
          rolePermissions = permissions.filter(p => p.action === 'view' && p.category !== 'settings').map(p => p._id);
        }
        await Role.create({ ...role, permissions: rolePermissions });
      } else if (!existingRole.permissions || existingRole.permissions.length === 0) {
        // Update existing role without permissions
        let rolePermissions;
        if (role.name === 'admin') {
          rolePermissions = permissions.map(p => p._id);
        } else if (role.name === 'manager') {
          rolePermissions = permissions.filter(p => ['dashboard', 'reports', 'sellers', 'scraping', 'actions', 'calculator'].includes(p.category)).map(p => p._id);
        } else if (role.name === 'analyst') {
          rolePermissions = permissions.filter(p => ['dashboard', 'reports'].includes(p.category)).map(p => p._id);
        } else {
          rolePermissions = permissions.filter(p => p.action === 'view' && p.category !== 'settings').map(p => p._id);
        }
        await Role.findByIdAndUpdate(existingRole._id, { permissions: rolePermissions });
      }
    }
    const roles = await Role.find();
    console.log(`✅ Seeded ${roles.length} roles`);

    // 3. Seed Users
    console.log('👥 Seeding users...');
    const adminRole = roles.find(r => r.name === 'admin');
    const managerRole = roles.find(r => r.name === 'manager');
    const analystRole = roles.find(r => r.name === 'analyst');

    const userData = [
      { email: 'admin@gms.com', firstName: 'Admin', lastName: 'User', role: adminRole._id, isActive: true, isEmailVerified: true, avatar: await fetchUnsplashAvatar('man portrait') },
      { email: 'manager@gms.com', firstName: 'Sales', lastName: 'Manager', role: managerRole._id, isActive: true, isEmailVerified: true, avatar: await fetchUnsplashAvatar('woman portrait') },
      { email: 'analyst@gms.com', firstName: 'Data', lastName: 'Analyst', role: analystRole._id, isActive: true, isEmailVerified: true, avatar: await fetchUnsplashAvatar('portrait') },
    ];

    for (const user of userData) {
      const existingUser = await User.findOne({ email: user.email });
      if (!existingUser) {
        await User.create({ ...user, password: 'demo123' });
      } else {
        // Update avatar for existing demo users
        await User.findByIdAndUpdate(existingUser._id, { avatar: user.avatar });
      }
    }
    const users = await User.find().populate('role');
    console.log(`✅ Seeded ${users.length} users`);

    // 4. Seed Sellers - Use valid enum values
    console.log('🏪 Seeding sellers...');
    const marketplaceMap = {
      'US': 'amazon.com',
      'CA': 'amazon.ca',
      'UK': 'amazon.uk',
      'DE': 'amazon.de',
      'FR': 'amazon.fr',
      'IN': 'amazon.in'
    };

    const planMap = {
      'Professional': 'Pro',
      'Starter': 'Starter',
      'Enterprise': 'Enterprise'
    };

    const sellerData = [
      { name: 'TechGadgets Pro', marketplace: 'US', plan: 'Pro', status: 'Active', apiKey: 'octo_abc123', sellerId: 'SELLER001' },
      { name: 'HomeEssentials', marketplace: 'US', plan: 'Pro', status: 'Active', apiKey: 'octo_def456', sellerId: 'SELLER002' },
      { name: 'SportFit Gear', marketplace: 'US', plan: 'Pro', status: 'Active', apiKey: 'octo_ghi789', sellerId: 'SELLER003' },
      { name: 'BeautyTrendy', marketplace: 'CA', plan: 'Pro', status: 'Active', apiKey: 'octo_jkl012', sellerId: 'SELLER004' },
      { name: 'ToyWonderland', marketplace: 'UK', plan: 'Pro', status: 'Active', apiKey: 'octo_mno345', sellerId: 'SELLER005' },
      { name: 'PetLovers Hub', marketplace: 'US', plan: 'Pro', status: 'Active', apiKey: 'octo_pqr678', sellerId: 'SELLER006' },
      { name: 'OfficePro Supplies', marketplace: 'DE', plan: 'Pro', status: 'Active', apiKey: 'octo_stu901', sellerId: 'SELLER007' },
      { name: 'BabyCare Plus', marketplace: 'FR', plan: 'Pro', status: 'Active', apiKey: 'octo_vwx234', sellerId: 'SELLER008' },
    ];

    // Map marketplace and plan to valid enum values
    const mappedSellerData = sellerData.map(seller => ({
      ...seller,
      marketplace: marketplaceMap[seller.marketplace] || 'amazon.com',
      plan: planMap[seller.plan] || 'Pro'
    }));

    const createdSellers = [];
    for (const seller of mappedSellerData) {
      const existingSeller = await Seller.findOne({ name: seller.name });
      if (!existingSeller) {
        const created = await Seller.create(seller);
        createdSellers.push(created);
      } else {
        createdSellers.push(existingSeller);
      }
    }
    const allSellers = await Seller.find();
    console.log(`✅ Seeded ${allSellers.length} sellers`);

    // 5. Seed ASINs with weekHistory
    console.log('📦 Seeding ASINs with week history...');

    // Generate 8 weeks of dates (weekly intervals)
    const generateWeekDates = () => {
      const dates = [];
      const today = new Date();
      for (let i = 7; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - (i * 7));
        dates.push(date);
      }
      return dates;
    };
    const weekDates = generateWeekDates();

    // Demo ASIN data matching frontend demoAsins
    const demoAsinData = [
      {
        asinCode: 'B07XYZ123',
        sku: 'SKU-WE-001',
        title: 'Wireless Bluetooth Earbuds Pro with Noise Cancellation',
        imageUrl: 'https://placehold.co/100x100?text=Earbuds',
        brand: 'AudioTech',
        category: 'Electronics',
        currentPrice: 2499,
        currentRank: 1250,
        rating: 4.5,
        reviewCount: 1250,
        buyBoxWin: true,
        couponDetails: '₹100 Off',
        dealDetails: 'Lightning Deal',
        totalOffers: 15,
        imagesCount: 7,
        hasAPlus: true,
        descLength: 520,
        lqs: 85,
        status: 'Active',
        weekHistory: [
          { week: 'W1', date: weekDates[0], price: 2399, bsr: 1400, rating: 4.4, reviews: 1180 },
          { week: 'W2', date: weekDates[1], price: 2499, bsr: 1350, rating: 4.4, reviews: 1200 },
          { week: 'W3', date: weekDates[2], price: 2499, bsr: 1300, rating: 4.5, reviews: 1215 },
          { week: 'W4', date: weekDates[3], price: 2599, bsr: 1280, rating: 4.5, reviews: 1225 },
          { week: 'W5', date: weekDates[4], price: 2499, bsr: 1250, rating: 4.5, reviews: 1235 },
          { week: 'W6', date: weekDates[5], price: 2399, bsr: 1220, rating: 4.5, reviews: 1240 },
          { week: 'W7', date: weekDates[6], price: 2499, bsr: 1200, rating: 4.5, reviews: 1245 },
          { week: 'W8', date: weekDates[7], price: 2499, bsr: 1250, rating: 4.5, reviews: 1250 },
        ],
      },
      {
        asinCode: 'B07ABC456',
        sku: 'SKU-SW-002',
        title: 'Smart Watch Elite - Fitness Tracker with GPS',
        imageUrl: 'https://placehold.co/100x100?text=Watch',
        brand: 'FitGear',
        category: 'Electronics',
        currentPrice: 8999,
        currentRank: 890,
        rating: 4.2,
        reviewCount: 890,
        buyBoxWin: true,
        couponDetails: 'None',
        dealDetails: 'None',
        totalOffers: 8,
        imagesCount: 5,
        hasAPlus: true,
        descLength: 480,
        lqs: 72,
        status: 'Active',
        weekHistory: [
          { week: 'W1', date: weekDates[0], price: 8799, bsr: 950, rating: 4.1, reviews: 820 },
          { week: 'W2', date: weekDates[1], price: 8999, bsr: 920, rating: 4.1, reviews: 835 },
          { week: 'W3', date: weekDates[2], price: 9199, bsr: 900, rating: 4.2, reviews: 850 },
          { week: 'W4', date: weekDates[3], price: 8999, bsr: 910, rating: 4.2, reviews: 860 },
          { week: 'W5', date: weekDates[4], price: 8799, bsr: 895, rating: 4.2, reviews: 870 },
          { week: 'W6', date: weekDates[5], price: 8999, bsr: 890, rating: 4.2, reviews: 880 },
          { week: 'W7', date: weekDates[6], price: 9199, bsr: 885, rating: 4.2, reviews: 885 },
          { week: 'W8', date: weekDates[7], price: 8999, bsr: 890, rating: 4.2, reviews: 890 },
        ],
      },
      {
        asinCode: 'B07DEF789',
        sku: 'SKU-YM-003',
        title: 'Premium Yoga Mat - Non-Slip Exercise Mat',
        imageUrl: 'https://placehold.co/100x100?text=Yoga',
        brand: 'FitLife',
        category: 'Sports',
        currentPrice: 1299,
        currentRank: 3200,
        rating: 4.8,
        reviewCount: 3200,
        buyBoxWin: true,
        couponDetails: '₹50 Off',
        dealDetails: 'None',
        totalOffers: 22,
        imagesCount: 6,
        hasAPlus: false,
        descLength: 280,
        lqs: 68,
        status: 'Active',
        weekHistory: [
          { week: 'W1', date: weekDates[0], price: 1199, bsr: 3500, rating: 4.7, reviews: 3050 },
          { week: 'W2', date: weekDates[1], price: 1299, bsr: 3400, rating: 4.7, reviews: 3080 },
          { week: 'W3', date: weekDates[2], price: 1299, bsr: 3350, rating: 4.7, reviews: 3100 },
          { week: 'W4', date: weekDates[3], price: 1399, bsr: 3300, rating: 4.7, reviews: 3120 },
          { week: 'W5', date: weekDates[4], price: 1299, bsr: 3250, rating: 4.8, reviews: 3140 },
          { week: 'W6', date: weekDates[5], price: 1199, bsr: 3220, rating: 4.8, reviews: 3160 },
          { week: 'W7', date: weekDates[6], price: 1299, bsr: 3210, rating: 4.8, reviews: 3180 },
          { week: 'W8', date: weekDates[7], price: 1299, bsr: 3200, rating: 4.8, reviews: 3200 },
        ],
      },
      {
        asinCode: 'B07GHI012',
        sku: 'SKU-KT-004',
        title: 'Kitchen Scale Digital - Precision Food Scale',
        imageUrl: 'https://placehold.co/100x100?text=Scale',
        brand: 'HomeChef',
        category: 'Home & Kitchen',
        currentPrice: 799,
        currentRank: 4500,
        rating: 4.3,
        reviewCount: 4500,
        buyBoxWin: false,
        couponDetails: 'None',
        dealDetails: 'None',
        totalOffers: 35,
        imagesCount: 8,
        hasAPlus: true,
        descLength: 420,
        lqs: 78,
        status: 'Active',
        weekHistory: [
          { week: 'W1', date: weekDates[0], price: 699, bsr: 4800, rating: 4.2, reviews: 4300 },
          { week: 'W2', date: weekDates[1], price: 799, bsr: 4700, rating: 4.2, reviews: 4350 },
          { week: 'W3', date: weekDates[2], price: 849, bsr: 4650, rating: 4.3, reviews: 4400 },
          { week: 'W4', date: weekDates[3], price: 799, bsr: 4600, rating: 4.3, reviews: 4420 },
          { week: 'W5', date: weekDates[4], price: 749, bsr: 4550, rating: 4.3, reviews: 4440 },
          { week: 'W6', date: weekDates[5], price: 799, bsr: 4520, rating: 4.3, reviews: 4460 },
          { week: 'W7', date: weekDates[6], price: 849, bsr: 4510, rating: 4.3, reviews: 4480 },
          { week: 'W8', date: weekDates[7], price: 799, bsr: 4500, rating: 4.3, reviews: 4500 },
        ],
      },
      {
        asinCode: 'B07JKL345',
        sku: 'SKU-SP-005',
        title: 'Security Camera 1080P - Wireless Home Security',
        imageUrl: 'https://placehold.co/100x100?text=Camera',
        brand: 'SecureHome',
        category: 'Electronics',
        currentPrice: 3499,
        currentRank: 1850,
        rating: 4.1,
        reviewCount: 1850,
        buyBoxWin: true,
        couponDetails: '₹200 Off',
        dealDetails: 'Prime Deal',
        totalOffers: 12,
        imagesCount: 9,
        hasAPlus: true,
        descLength: 680,
        lqs: 82,
        status: 'Active',
        weekHistory: [
          { week: 'W1', date: weekDates[0], price: 3299, bsr: 2000, rating: 4.0, reviews: 1750 },
          { week: 'W2', date: weekDates[1], price: 3499, bsr: 1950, rating: 4.0, reviews: 1770 },
          { week: 'W3', date: weekDates[2], price: 3699, bsr: 1900, rating: 4.1, reviews: 1790 },
          { week: 'W4', date: weekDates[3], price: 3499, bsr: 1880, rating: 4.1, reviews: 1805 },
          { week: 'W5', date: weekDates[4], price: 3299, bsr: 1860, rating: 4.1, reviews: 1820 },
          { week: 'W6', date: weekDates[5], price: 3499, bsr: 1855, rating: 4.1, reviews: 1830 },
          { week: 'W7', date: weekDates[6], price: 3699, bsr: 1852, rating: 4.1, reviews: 1840 },
          { week: 'W8', date: weekDates[7], price: 3499, bsr: 1850, rating: 4.1, reviews: 1850 },
        ],
      },
    ];

    const createdAsins = [];
    for (const seller of allSellers) {
      // Use demo data for first seller, random for others
      if (seller.name === 'TechGadgets Pro' || createdAsins.length < 5) {
        for (let i = 0; i < demoAsinData.length; i++) {
          const asinData = { ...demoAsinData[i], seller: seller._id };

          const existingAsin = await Asin.findOne({ asinCode: asinData.asinCode, seller: seller._id });
          if (!existingAsin) {
            const asin = await Asin.create(asinData);
            createdAsins.push(asin);
          } else {
            createdAsins.push(existingAsin);
          }
        }
      }

      // Add random ASINs for other sellers
      const asinsPerSeller = seller.name === 'TechGadgets Pro' ? 5 : Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < asinsPerSeller; i++) {
        const asinPrefix = asinPrefixes[Math.floor(Math.random() * asinPrefixes.length)];
        const asinCode = `${asinPrefix}${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`;

        const existingAsin = await Asin.findOne({ asinCode: asinCode, seller: seller._id });
        if (!existingAsin) {
          const productName = productNames[Math.floor(Math.random() * productNames.length)];
          const price = Math.round((Math.random() * 100 + 15) * 100) / 100;
          const rating = (Math.random() * 2 + 3).toFixed(1);
          const reviews = Math.floor(Math.random() * 2000) + 50;
          const bsr = Math.floor(Math.random() * 50) + 1;

          // Generate random week history
          const weekHistory = weekDates.map((date, idx) => ({
            week: `W${idx + 1}`,
            date: date,
            price: Math.round(price * (1 + (Math.random() - 0.5) * 0.2) * 100) / 100,
            bsr: Math.floor(bsr + (Math.random() - 0.5) * 20),
            rating: parseFloat((parseFloat(rating) + (Math.random() - 0.5) * 0.3).toFixed(1)),
            reviews: Math.floor(reviews + idx * (Math.random() * 50 + 10)),
          }));

          const asin = await Asin.create({
            asinCode: asinCode,
            sku: `SKU-${seller.name.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
            title: productName,
            seller: seller._id,
            currentPrice: price,
            currentRank: bsr,
            rating: parseFloat(rating),
            reviewCount: reviews,
            buyBoxWin: Math.random() > 0.3,
            couponDetails: Math.random() > 0.7 ? '₹50 Off' : 'None',
            dealDetails: Math.random() > 0.8 ? 'Prime Deal' : 'None',
            totalOffers: Math.floor(Math.random() * 20) + 5,
            imagesCount: Math.floor(Math.random() * 8) + 3,
            hasAPlus: Math.random() > 0.4,
            descLength: Math.floor(Math.random() * 500) + 200,
            lqs: Math.floor(Math.random() * 30) + 60,
            status: 'Active',
            weekHistory: weekHistory,
          });
          createdAsins.push(asin);
        }
      }
    }

    const allAsins = await Asin.find().populate('seller');
    console.log(`✅ Seeded ${allAsins.length} ASINs`);

    // 6. Seed Alert Rules
    console.log('🔔 Seeding alert rules...');
    const alertRuleData = [
      { name: 'Revenue Drop Alert', type: 'revenue', condition: { metric: 'revenue', operator: 'decrease', value: 10, period: '7d' }, severity: 'warning', active: true },
      { name: 'Low Inventory Alert', type: 'inventory', condition: { metric: 'stock', operator: '<', value: 50, period: '1d' }, severity: 'critical', active: true },
      { name: 'High ACOS Alert', type: 'ads', condition: { metric: 'acos', operator: '>', value: 25, period: '7d' }, severity: 'warning', active: true },
      { name: 'Low Stock Alert', type: 'inventory', condition: { metric: 'stock', operator: '<', value: 10, period: '1d' }, severity: 'warning', active: true },
      { name: 'Revenue Target Alert', type: 'revenue', condition: { metric: 'revenue', operator: '<', value: 1000, period: '1d' }, severity: 'info', active: true },
    ];

    for (const alertRule of alertRuleData) {
      const existingRule = await AlertRule.findOne({ name: alertRule.name });
      if (!existingRule) {
        await AlertRule.create({ ...alertRule, createdAt: new Date(), updatedAt: new Date() });
      }
    }
    const alertRules = await AlertRule.find();
    console.log(`✅ Seeded ${alertRules.length} alert rules`);

    // Generate summary statistics
    const totalRevenue = allAsins.reduce((sum, a) => sum + (a.currentPrice * (a.reviewCount || 100) * 0.3), 0);
    const totalUnits = allAsins.reduce((sum, a) => sum + ((a.reviewCount || 100) * 0.3), 0);
    const avgAcos = allAsins.length > 0 ? 22 : 0;
    const avgRoas = allAsins.length > 0 ? 3.5 : 0;
    const totalProfit = totalRevenue * 0.22;

    console.log('\n📊 Demo Data Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Roles: ${roles.length}`);
    console.log(`   - Permissions: ${permissions.length}`);
    console.log(`   - Sellers: ${allSellers.length}`);
    console.log(`   - ASINs: ${allAsins.length}`);
    console.log(`   - Alert Rules: ${alertRules.length}`);
    console.log(`   - Total Revenue: $${totalRevenue.toLocaleString()}`);
    console.log(`   - Total Units Sold: ${totalUnits.toLocaleString()}`);
    console.log(`   - Average ACoS: ${avgAcos.toFixed(1)}%`);
    console.log(`   - Average ROAS: ${avgRoas.toFixed(2)}x`);
    console.log(`   - Total Profit: $${totalProfit.toLocaleString()}`);

    res.json({
      success: true,
      message: 'All demo data seeded successfully',
      data: {
        users: users.length,
        roles: roles.length,
        permissions: permissions.length,
        sellers: allSellers.length,
        asins: allAsins.length,
        alertRules: alertRules.length,
        summary: {
          totalRevenue: Math.round(totalRevenue),
          totalUnitsSold: totalUnits,
          avgAcos: avgAcos.toFixed(1),
          avgRoas: avgRoas.toFixed(2),
          totalProfit: Math.round(totalProfit),
        }
      }
    });
  } catch (error) {
    console.error('❌ Seeding error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed demo data', error: error.message });
  }
};

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
