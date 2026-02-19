const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const check = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const Asin = mongoose.model('Asin', new mongoose.Schema({}, { strict: false }));
        const Seller = mongoose.model('Seller', new mongoose.Schema({}, { strict: false }));
        const User = mongoose.model('User', new mongoose.Schema({
            role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
            assignedSellers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seller' }]
        }, { strict: false }));
        const Role = mongoose.model('Role', new mongoose.Schema({
            name: String
        }, { strict: false }));

        const asinCount = await Asin.countDocuments();
        const sellerCount = await Seller.countDocuments();
        console.log(`ASINs: ${asinCount}`);
        console.log(`Sellers: ${sellerCount}`);

        const users = await User.find().populate('role').populate('assignedSellers').lean();
        console.log('--- Users ---');
        users.forEach(u => {
            console.log(`- ${u.firstName} ${u.lastName} (${u.email})`);
            console.log(`  Role: ${u.role ? u.role.name : 'None'}`);
            console.log(`  Assigned Sellers: ${(u.assignedSellers || []).map(s => s.name || s._id).join(', ')}`);
        });

        const asins = await Asin.find().limit(3).lean();
        console.log('--- Sample ASINs ---');
        asins.forEach(a => {
            console.log(`- ASIN: ${a.asinCode}, Seller ID: ${a.seller}`);
        });

        const sellers = await Seller.find().lean();
        console.log('--- Sellers ---');
        sellers.forEach(s => {
            console.log(`- Seller: ${s.name}, ID: ${s._id}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();
