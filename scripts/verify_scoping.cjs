// Try to load mongoose from root or backend
let mongoose;
try {
    mongoose = require('mongoose');
} catch (e) {
    console.log('Mongoose not found in root, trying backend/node_modules...');
    mongoose = require('../backend/node_modules/mongoose');
}
const User = require('../backend/models/User');
const Seller = require('../backend/models/Seller');
const Asin = require('../backend/models/Asin');
const asinController = require('../backend/controllers/asinController');

try {
    require('dotenv').config({ path: '../backend/.env' });
} catch (e) {
    try {
        require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
    } catch (e2) {
        console.log('Dotenv not found, using defaults or env vars...');
    }
}

// Mock Response Object
const mockRes = () => {
    const res = {};
    res.json = (data) => { res.data = data; return res; };
    res.status = (code) => { res.statusCode = code; return res; };
    return res;
};

// Mock Request Object
const mockReq = (user, query = {}, params = {}) => ({
    user,
    query,
    params,
    body: {}
});

async function runVerification() {
    try {
        // Connect to DB
        // Using hardcoded connection string or from env if available. 
        // Assuming local mongo for this environment based on previous logs 
        await mongoose.connect('mongodb://localhost:27017/gms_dashboard');
        console.log('Connected to MongoDB');

        // Cleanup test data
        await User.deleteMany({ email: { $regex: /test_scope_/ } });
        await Seller.deleteMany({ sellerId: { $regex: /TEST_SELLER_/ } });
        await Asin.deleteMany({ asinCode: { $regex: /TEST_ASIN_/ } });

        // 1. Create Sellers
        const sellerA = await Seller.create({
            name: 'Test Seller A',
            marketplace: 'amazon.com',
            sellerId: 'TEST_SELLER_A',
            status: 'Active'
        });

        const sellerB = await Seller.create({
            name: 'Test Seller B',
            marketplace: 'amazon.com',
            sellerId: 'TEST_SELLER_B',
            status: 'Active'
        });

        // 2. Create Users
        // Need a Role first? explicit role creation or assumed existing?
        // Assuming strict schema on Role might fail if I don't provide valid Object ID for role.
        // Let's check User model... it requires 'role' as ObjectId. 
        // I'll skip user creation if schema is strict and just mock the req.user object directly with needed fields!
        // Much safer and faster.

        const userA = {
            _id: new mongoose.Types.ObjectId(),
            role: 'user', // Mocking role name/id logic. logic checks req.user.role !== 'admin'
            sellerId: sellerA._id
        };

        const userB = {
            _id: new mongoose.Types.ObjectId(),
            role: 'user',
            sellerId: sellerB._id
        };

        const adminUser = {
            _id: new mongoose.Types.ObjectId(),
            role: 'admin'
        };

        // 3. Create ASINs
        await Asin.create({
            asinCode: 'TEST_ASIN_A1',
            title: 'Seller A Product',
            seller: sellerA._id,
            status: 'Active'
        });

        await Asin.create({
            asinCode: 'TEST_ASIN_B1',
            title: 'Seller B Product',
            seller: sellerB._id,
            status: 'Active'
        });

        console.log('Test Data Created. Starting Verification...');

        // 4. Test Scoping - getAsins

        // Case 1: User A requests all ASINs (should only see Seller A's)
        console.log('\nTest 1: User A requesting all ASINs...');
        let req = mockReq(userA);
        let res = mockRes();
        await asinController.getAsins(req, res);

        if (res.data.asins.length === 1 && res.data.asins[0].asinCode === 'TEST_ASIN_A1') {
            console.log('✅ PASS: User A sees only their own ASIN.');
        } else {
            console.error('❌ FAIL: User A saw:', res.data.asins.map(a => a.asinCode));
        }

        // Case 2: User A tries to explicitly request Seller B's ASINs via query param
        console.log('\nTest 2: User A tries to filter by Seller B ID...');
        req = mockReq(userA, { seller: sellerB._id.toString() });
        res = mockRes();
        await asinController.getAsins(req, res);

        // The controller should IGNORE the query param and overwrite it with req.user.sellerId
        // OR return empty if logic forces mismatch, but my logic enforces: filter.seller = req.user.sellerId
        if (res.data.asins.length === 1 && res.data.asins[0].asinCode === 'TEST_ASIN_A1') {
            console.log('✅ PASS: User A restricted to Seller A despite requesting Seller B.');
        } else if (res.data.asins.length === 0) {
            console.log('✅ PASS: User A saw nothing (Acceptable if filtered out).');
        } else {
            console.error('❌ FAIL: User A accessed Seller B data!');
        }

        // Case 3: Admin User requests all
        console.log('\nTest 3: Admin requests all ASINs...');
        req = mockReq(adminUser);
        res = mockRes();
        await asinController.getAsins(req, res);

        // Should mock pagination limit to ensure we get our test ones or filter by test code
        // Or just check if we get > 1
        const testAsins = res.data.asins.filter(a => a.asinCode.startsWith('TEST_ASIN'));
        if (testAsins.length >= 2) {
            console.log('✅ PASS: Admin sees both ASINs.');
        } else {
            console.error('❌ FAIL: Admin only saw:', testAsins.length);
        }

        // Case 4: getAsinsBySeller protection
        console.log('\nTest 4: User A calls getAsinsBySeller for Seller B...');
        req = mockReq(userA, {}, { sellerId: sellerB._id.toString() });
        res = mockRes();
        await asinController.getAsinsBySeller(req, res);

        if (res.statusCode === 403) {
            console.log('✅ PASS: Access Forbidden (403) as expected.');
        } else {
            console.error('❌ FAIL: Request was allowed with status or data:', res.statusCode || 200);
        }

    } catch (error) {
        console.error('Verification Script Error:', error);
    } finally {
        // Cleanup
        await User.deleteMany({ email: { $regex: /test_scope_/ } });
        await Seller.deleteMany({ sellerId: { $regex: /TEST_SELLER_/ } });
        await Asin.deleteMany({ asinCode: { $regex: /TEST_ASIN_/ } });
        await mongoose.disconnect();
        console.log('\nVerification Complete.');
    }
}

runVerification();
