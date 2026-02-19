require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('./models/User');
const Role = require('./models/Role');
const Permission = require('./models/Permission');
const Seller = require('./models/Seller');
const Asin = require('./models/Asin');
const Action = require('./models/Action');
const { Alert, AlertRule } = require('./models/AlertModel');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

// Seed Data
// Seed Data
async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding (ASINs ONLY)...\n');

        // Clear existing data selectively
        console.log('🗑️  Clearing existing ASINs and Actions...');
        await Promise.all([
            Asin.deleteMany({}),
            Action.deleteMany({}),
            Alert.deleteMany({}),
        ]);
        console.log('✅ Temporary data cleared\n');

        // 1. Ensure Permissions & Roles exist
        console.log('📋 Ensuring permissions and roles...');
        const existingPermissions = await Permission.countDocuments();
        if (existingPermissions === 0) {
            await Permission.seedDefaultPermissions();
        }
        const permissions = await Permission.find({});

        let adminRole = await Role.findOne({ name: 'admin' });
        if (!adminRole) {
            adminRole = await Role.create({
                name: 'admin',
                displayName: 'Administrator',
                description: 'Administrator with full access',
                permissions: permissions.map(p => p._id)
            });
        }
        console.log('✅ Roles and permissions verified\n');

        // 2. Ensure Admin User exists
        console.log('👤 Ensuring admin user...');
        let adminUser = await User.findOne({ email: 'admin@gms.com' });
        if (!adminUser) {
            adminUser = await User.create({
                email: 'admin@gms.com',
                password: await bcrypt.hash('admin123', 10),
                firstName: 'Admin',
                lastName: 'User',
                role: adminRole._id,
                isEmailVerified: true
            });
            console.log('✅ Admin user created (admin@gms.com / admin123)\n');
        } else {
            console.log('✅ Admin user already exists\n');
        }

        // 3. Ensure Sellers exist
        console.log('🏪 Ensuring sellers exist...');
        let sellers = await Seller.find({});
        if (sellers.length === 0) {
            sellers = await Seller.insertMany([
                {
                    name: 'TechGear Pro',
                    sellerId: 'A2XVJBKSJH9K3L',
                    marketplace: 'amazon.com',
                    status: 'Active',
                    email: 'contact@techgearpro.com'
                },
                {
                    name: 'HomeStyle Essentials',
                    sellerId: 'A1BVJBKSJH9K3M',
                    marketplace: 'amazon.com',
                    status: 'Active',
                    email: 'support@homestyleessentials.com'
                }
            ]);
            console.log(`✅ Created ${sellers.length} default sellers\n`);
        } else {
            console.log(`✅ Found ${sellers.length} existing sellers\n`);
        }

        // 4. Create ASINs with realistic history for testing
        console.log('📦 Seeding ASINs...');
        const asinsData = [
            {
                seller: sellers[0]._id,
                asinCode: 'B08N5WRWNW',
                title: 'Wireless Bluetooth Headphones with ANC - Premium Sound',
                brand: 'TechGear Pro',
                category: 'Electronics',
                sku: 'TGP-WH-001',
                status: 'Active',
                currentPrice: 79.99,
                bsr: 1245,
                rating: 4.5,
                reviewCount: 2847,
                lqs: 85,
                imageCount: 7,
                hasAplus: true,
                weekHistory: [
                    { week: 'W04', date: new Date('2026-01-20'), price: 79.99, bsr: 1300, rating: 4.4, reviews: 2700, lqs: 83 },
                    { week: 'W05', date: new Date('2026-01-27'), price: 79.99, bsr: 1280, rating: 4.5, reviews: 2750, lqs: 84 },
                    { week: 'W06', date: new Date('2026-02-03'), price: 79.99, bsr: 1260, rating: 4.5, reviews: 2800, lqs: 85 },
                    { week: 'W07', date: new Date('2026-02-10'), price: 79.99, bsr: 1245, rating: 4.5, reviews: 2847, lqs: 85 }
                ]
            },
            {
                seller: sellers[0]._id,
                asinCode: 'B09JQVH3K2',
                title: 'USB-C Hub 7-in-1 Adapter - 4K HDMI, USB 3.0',
                brand: 'TechGear Pro',
                category: 'Electronics',
                sku: 'TGP-HUB-002',
                status: 'Active',
                currentPrice: 34.99,
                bsr: 856,
                rating: 4.7,
                reviewCount: 4521,
                lqs: 92,
                imageCount: 8,
                hasAplus: true,
                weekHistory: [
                    { week: 'W04', date: new Date('2026-01-20'), price: 34.99, bsr: 900, rating: 4.6, reviews: 4300, lqs: 90 },
                    { week: 'W05', date: new Date('2026-01-27'), price: 34.99, bsr: 880, rating: 4.7, reviews: 4400, lqs: 91 },
                    { week: 'W06', date: new Date('2026-02-03'), price: 34.99, bsr: 870, rating: 4.7, reviews: 4460, lqs: 92 },
                    { week: 'W07', date: new Date('2026-02-10'), price: 34.99, bsr: 856, rating: 4.7, reviews: 4521, lqs: 92 }
                ]
            },
            {
                seller: sellers[1]._id,
                asinCode: 'B08KLMN4P5',
                title: 'Premium Cotton Bed Sheets Set - Queen Size',
                brand: 'HomeStyle Essentials',
                category: 'Home & Kitchen',
                sku: 'HSE-BS-001',
                status: 'Active',
                currentPrice: 42.99,
                bsr: 567,
                rating: 4.6,
                reviewCount: 5234,
                lqs: 88,
                imageCount: 9,
                hasAplus: true,
                weekHistory: [
                    { week: 'W04', date: new Date('2026-01-20'), price: 44.99, bsr: 620, rating: 4.5, reviews: 4900, lqs: 86 },
                    { week: 'W05', date: new Date('2026-01-27'), price: 42.99, bsr: 590, rating: 4.6, reviews: 5050, lqs: 87 },
                    { week: 'W06', date: new Date('2026-02-03'), price: 42.99, bsr: 580, rating: 4.6, reviews: 5150, lqs: 88 },
                    { week: 'W07', date: new Date('2026-02-10'), price: 42.99, bsr: 567, rating: 4.6, reviews: 5234, lqs: 88 }
                ]
            }
        ];

        const seededAsins = await Asin.insertMany(asinsData);
        console.log(`✅ Seeded ${seededAsins.length} ASINs with historical trends.\n`);

        // Update seller counts
        console.log('📊 Updating seller statistics...');
        for (const seller of sellers) {
            const sellerAsinsCount = await Asin.countDocuments({ seller: seller._id });
            seller.totalAsins = sellerAsinsCount;
            seller.activeAsins = await Asin.countDocuments({ seller: seller._id, status: 'Active' });
            await seller.save();
        }
        console.log('✅ Seller statistics updated\n');

        console.log('🎉 Database seeding (ASINs ONLY) completed successfully!\n');
        console.log('✅ Login with: admin@gms.com / admin123');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
    }
}

// Run the seeder
seedDatabase();

// Run the seeder
seedDatabase();
