const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
const Action = require('./models/Action');
const hierarchyService = require('./services/hierarchyService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gms_dashboard';

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Ensure roles are seeded
        console.log('Seeding roles...');
        const Permission = require('./models/Permission');
        await Role.seedDefaultRoles(Permission);

        const managerRole = await Role.findOne({ name: 'manager' });
        const tlRole = await Role.findOne({ name: 'team_leader' });
        const employeeRole = await Role.findOne({ name: 'employee' });

        // 2. Create Hierarchy
        console.log('Creating test users...');
        await User.deleteMany({ email: /test-Hierarchy/i });

        const m1 = await User.create({
            firstName: 'Manager', lastName: 'One', email: 'm1@test-Hierarchy.com',
            password: 'password123', role: managerRole._id
        });

        const tl1 = await User.create({
            firstName: 'TL', lastName: 'One', email: 'tl1@test-Hierarchy.com',
            password: 'password123', role: tlRole._id, supervisors: [m1._id]
        });

        const e1 = await User.create({
            firstName: 'Employee', lastName: 'One', email: 'e1@test-Hierarchy.com',
            password: 'password123', role: employeeRole._id, supervisors: [tl1._id]
        });

        console.log('Hierarchy created: M1 -> TL1 -> E1');

        // 3. Verify hierarchyService
        console.log('Verifying hierarchyService...');
        const m1Subordinates = await hierarchyService.getSubordinateIds(m1._id);
        console.log('M1 Subordinates:', m1Subordinates);

        const expectedSubordinates = [tl1._id.toString(), e1._id.toString()];
        const success = expectedSubordinates.every(id => m1Subordinates.includes(id));

        if (success) {
            console.log('✅ Hierarchy service verified recursively.');
        } else {
            console.log('❌ Hierarchy service failed recursive lookup.');
        }

        // 4. Test Action Visibility (Simulate Route filter)
        console.log('Testing action visibility logic...');
        const action = await Action.create({
            title: 'Test Action for E1',
            description: 'Verification',
            type: 'GENERAL_OPTIMIZATION',
            priority: 'MEDIUM',
            assignedTo: e1._id,
            createdBy: m1._id // Create by manager for e1
        });

        // Simulating Manager query: find actions where assignedTo in [m1_id, tl1_id, e1_id]
        const teamIds = [m1._id, ...m1Subordinates];
        const visibleActions = await Action.find({
            $or: [
                { assignedTo: { $in: teamIds } },
                { createdBy: { $in: teamIds } }
            ]
        });

        if (visibleActions.some(a => a._id.toString() === action._id.toString())) {
            console.log('✅ Manager can see subordinate actions.');
        } else {
            console.log('❌ Manager cannot see subordinate actions.');
        }

        // Cleanup
        await User.deleteMany({ email: /test-Hierarchy/i });
        await Action.deleteOne({ _id: action._id });
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verify();
