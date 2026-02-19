const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
let adminToken = '';
let manager1Token = '';
let manager2Token = '';

let seller1Id = '';
let seller2Id = '';
let asin1Id = '';
let asin2Id = '';

async function setup() {
    console.log('🔄 Setting up test data...');
    try {
        // 1. Login as Admin
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@gms.com',
            password: 'admin123'
        });
        adminToken = loginRes.data.data.accessToken;
        console.log('✅ Admin logged in');

        const suffix = Date.now().toString().slice(-6);
        // 2. Create two sellers
        const s1Res = await axios.post(`${BASE_URL}/sellers`, {
            name: `Test Seller 1 ${suffix}`,
            marketplace: 'amazon.in',
            sellerId: `TS1_${suffix}`
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        seller1Id = s1Res.data._id;

        const s2Res = await axios.post(`${BASE_URL}/sellers`, {
            name: `Test Seller 2 ${suffix}`,
            marketplace: 'amazon.com',
            sellerId: `TS2_${suffix}`
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        seller2Id = s2Res.data._id;
        console.log('✅ Sellers created');

        // 3. Create ASINs for each
        const a1Res = await axios.post(`${BASE_URL}/asins`, {
            asinCode: `ASIN1_${suffix}`,
            seller: seller1Id,
            status: 'Active'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        asin1Id = a1Res.data._id;

        const a2Res = await axios.post(`${BASE_URL}/asins`, {
            asinCode: `ASIN2_${suffix}`,
            seller: seller2Id,
            status: 'Active'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        asin2Id = a2Res.data._id;
        console.log('✅ ASINs created');

        // 4. Create Brand Managers
        const roleRes = await axios.get(`${BASE_URL}/roles`, { headers: { Authorization: `Bearer ${adminToken}` } });
        const managerRole = roleRes.data.data.roles.find(r => r.name === 'manager');

        const m1Res = await axios.post(`${BASE_URL}/users`, {
            email: `manager1_${suffix}@test.com`,
            password: 'password123',
            firstName: 'Manager',
            lastName: 'One',
            role: managerRole._id,
            assignedSellers: [seller1Id]
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        console.log('✅ Manager 1 created and assigned Seller 1');

        const m2Res = await axios.post(`${BASE_URL}/users`, {
            email: `manager2_${suffix}@test.com`,
            password: 'password123',
            firstName: 'Manager',
            lastName: 'Two',
            role: managerRole._id,
            assignedSellers: [seller2Id]
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        console.log('✅ Manager 2 created and assigned Seller 2');

        // 5. Get Tokens for Managers
        const l1Res = await axios.post(`${BASE_URL}/auth/login`, {
            email: `manager1_${suffix}@test.com`,
            password: 'password123'
        });
        manager1Token = l1Res.data.data.accessToken;

        const l2Res = await axios.post(`${BASE_URL}/auth/login`, {
            email: `manager2_${suffix}@test.com`,
            password: 'password123'
        });
        manager2Token = l2Res.data.data.accessToken;
        console.log('✅ Manager tokens obtained');

    } catch (error) {
        console.error('❌ Setup failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

async function testIsolation() {
    console.log('\n🔍 Testing Data Isolation...');
    try {
        // --- Manager 1 Tests ---
        console.log('\n--- Manager 1 (Assigned to Seller 1) ---');

        const m1Sellers = await axios.get(`${BASE_URL}/sellers`, { headers: { Authorization: `Bearer ${manager1Token}` } });
        console.log(`Sellers visible: ${m1Sellers.data.sellers.length} (Expected: 1)`);
        if (m1Sellers.data.sellers.length !== 1 || m1Sellers.data.sellers[0]._id !== seller1Id) {
            console.error('❌ M1 seller filtering failed');
        } else {
            console.log('✅ M1 seller filtering successful');
        }

        const m1Asins = await axios.get(`${BASE_URL}/asins`, { headers: { Authorization: `Bearer ${manager1Token}` } });
        console.log(`ASINs visible: ${m1Asins.data.asins.length} (Expected: 1)`);
        if (m1Asins.data.asins.length !== 1 || m1Asins.data.asins[0]._id !== asin1Id) {
            console.error('❌ M1 ASIN filtering failed');
        } else {
            console.log('✅ M1 ASIN filtering successful');
        }

        // Cross-access attempt
        try {
            await axios.get(`${BASE_URL}/sellers/${seller2Id}`, { headers: { Authorization: `Bearer ${manager1Token}` } });
            console.error('❌ M1 accessed Seller 2! (Should have failed)');
        } catch (e) {
            console.log('✅ M1 blocked from Seller 2 (Expected)');
        }

        try {
            await axios.get(`${BASE_URL}/asins/${asin2Id}`, { headers: { Authorization: `Bearer ${manager1Token}` } });
            console.error('❌ M1 accessed ASIN 2! (Should have failed)');
        } catch (e) {
            console.log('✅ M1 blocked from ASIN 2 (Expected)');
        }

        // --- Manager 2 Tests ---
        console.log('\n--- Manager 2 (Assigned to Seller 2) ---');

        const m2Sellers = await axios.get(`${BASE_URL}/sellers`, { headers: { Authorization: `Bearer ${manager2Token}` } });
        console.log(`Sellers visible: ${m2Sellers.data.sellers.length} (Expected: 1)`);
        if (m2Sellers.data.sellers.length !== 1 || m2Sellers.data.sellers[0]._id !== seller2Id) {
            console.error('❌ M2 seller filtering failed');
        } else {
            console.log('✅ M2 seller filtering successful');
        }

        const m2Asins = await axios.get(`${BASE_URL}/asins`, { headers: { Authorization: `Bearer ${manager2Token}` } });
        console.log(`ASINs visible: ${m2Asins.data.asins.length} (Expected: 1)`);
        if (m2Asins.data.asins.length !== 1 || m2Asins.data.asins[0]._id !== asin2Id) {
            console.error('❌ M2 ASIN filtering failed');
        } else {
            console.log('✅ M2 ASIN filtering successful');
        }

        // --- Admin Tests ---
        console.log('\n--- Admin (Global Access) ---');
        const adminSellers = await axios.get(`${BASE_URL}/sellers`, { headers: { Authorization: `Bearer ${adminToken}` } });
        console.log(`Sellers visible to Admin: ${adminSellers.data.sellers.length} (Expected: All)`);
        if (adminSellers.data.sellers.length >= 2) {
            console.log('✅ Admin global seller access confirmed');
        } else {
            console.error('❌ Admin seller access failed');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

async function run() {
    await setup();
    await testIsolation();
    console.log('\n🏁 Tests completed.');
}

run();
