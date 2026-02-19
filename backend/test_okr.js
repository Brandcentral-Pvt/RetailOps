const axios = require('axios');

async function testOKR() {
    try {
        console.log('Testing OKR API...');

        // 1. Login to get token (assuming admin/admin123 exists from seed)
        const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@gms.com',
            password: 'admin123'
        });
        const token = loginRes.data.data.accessToken;
        console.log('✅ Login successful, Token obtained');

        // 2. Create Monthly Objective
        const objectiveRes = await axios.post('http://localhost:3001/api/objectives', {
            title: 'Test Monthly Objective ' + Date.now(),
            type: 'MONTHLY',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            autoGenerateWeekly: true,
            sellerId: null // Global
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Objective created:', objectiveRes.data.title);

        // 3. Verify Weekly Breakdowns
        const hierarchyRes = await axios.get('http://localhost:3001/api/objectives', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const createdObj = hierarchyRes.data.find(o => o._id === objectiveRes.data._id);

        if (createdObj && createdObj.keyResults.length === 4) {
            console.log('✅ Weekly Key Results auto-generated: 4/4');

            // Check actions in first KR
            const firstKR = createdObj.keyResults[0];
            if (firstKR.actions && firstKR.actions.length === 3) {
                console.log('✅ Default Actions created for Week 1: 3/3');
            } else {
                console.error('❌ Actions not created correctly', firstKR.actions);
            }
        } else {
            console.error('❌ Weekly KRs not generated', createdObj?.keyResults);
        }

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) console.error(error.response.data);
    }
}

testOKR();
