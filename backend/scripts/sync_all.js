require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Seller = require('../models/Seller');
const CometChatService = require('../services/cometChatService');

async function syncAll() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/easysell";
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        // 1. Sync Users
        const users = await User.find({});
        console.log(`📊 Found ${users.length} users to sync.`);

        let userSuccess = 0;
        let userFail = 0;

        for (const user of users) {
            try {
                console.log(`Processing User: ${user.firstName} ${user.lastName} (${user.email})...`);
                await CometChatService.syncUserToCometChat(user);
                console.log(`✅ Synced User: ${user.email}`);
                userSuccess++;
            } catch (err) {
                console.error(`❌ Failed User: ${user.email}`, err.message);
                userFail++;
            }
        }

        // 2. Sync Sellers
        const sellers = await Seller.find({});
        console.log(`📊 Found ${sellers.length} sellers to sync.`);

        let sellerSuccess = 0;
        let sellerFail = 0;

        for (const seller of sellers) {
            try {
                // Construct a mock seller object if needed, but the service expects the mongoose doc usually
                // The service uses: seller.sellerId, seller.name, seller.profilePicture (optional)
                console.log(`Processing Seller: ${seller.name} (${seller.sellerId})...`);
                await CometChatService.syncSellerToCometChat(seller);
                console.log(`✅ Synced Seller: ${seller.name}`);
                sellerSuccess++;
            } catch (err) {
                console.error(`❌ Failed Seller: ${seller.name}`, err.message);
                sellerFail++;
            }
        }

        console.log('\n================================');
        console.log('🎉 Sync Complete!');
        console.log(`Users: ${userSuccess} success, ${userFail} failed`);
        console.log(`Sellers: ${sellerSuccess} success, ${sellerFail} failed`);
        console.log('================================\n');

        process.exit(0);
    } catch (error) {
        console.error('Fatal Error during sync:', error);
        process.exit(1);
    }
}

syncAll();
