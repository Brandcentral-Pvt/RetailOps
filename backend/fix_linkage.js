const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const fix = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const Asin = mongoose.model('Asin', new mongoose.Schema({
            asinCode: String,
            seller: mongoose.Schema.Types.ObjectId
        }, { strict: false }));
        const Seller = mongoose.model('Seller', new mongoose.Schema({
            name: String
        }, { strict: false }));
        const User = mongoose.model('User', new mongoose.Schema({
            email: String,
            assignedSellers: [mongoose.Schema.Types.ObjectId]
        }, { strict: false }));

        // 1. Get a valid seller
        const seller = await Seller.findOne({ name: '101-A' });
        if (!seller) {
            console.error('Seller 101-A not found.');
            process.exit(1);
        }
        console.log(`Using Seller: ${seller.name} (ID: ${seller._id})`);

        // 2. Identify and fix ASINs
        const asins = await Asin.find({ seller: { $ne: seller._id } });
        console.log(`Found ${asins.length} ASINs with alternative seller IDs.`);

        let updated = 0;
        let deleted = 0;

        for (const asin of asins) {
            // Check if this ASIN already exists for the target seller
            const existing = await Asin.findOne({
                asinCode: asin.asinCode,
                seller: seller._id
            });

            if (existing) {
                // If it exists, delete the orphaned one (assuming the existing one is "better" or just to resolve conflict)
                await Asin.deleteOne({ _id: asin._id });
                deleted++;
            } else {
                // Update to point to the new seller
                asin.seller = seller._id;
                await asin.save();
                updated++;
            }
        }

        console.log(`Summary: Updated ${updated} ASINs, Removed ${deleted} duplicates.`);

        // 3. Ensure Jenil has this seller assigned
        const user = await User.findOne({ email: 'jenilrupapara340@gmail.com' });
        if (user) {
            console.log(`Updating User assignments for: ${user.email}`);
            if (!user.assignedSellers.some(id => id.toString() === seller._id.toString())) {
                user.assignedSellers.push(seller._id);
                await user.save();
                console.log('User assigned sellers updated.');
            } else {
                console.log('User already has seller assigned.');
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fix();
