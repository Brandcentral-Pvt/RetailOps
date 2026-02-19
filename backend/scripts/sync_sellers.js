const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Seller = require('../models/Seller');

const COMETCHAT_APP_ID = "167556928fc00314a";
const COMETCHAT_REGION = "in";
const COMETCHAT_API_KEY = "e9b80ec532f553e701de51613d81ca4c81c726cc"; // Auth Key

const COMETCHAT_API_URL = `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3.0/users`;

async function syncSellers() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        // Fallback to local if env var missing in this context
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/easysell";
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        const sellers = await Seller.find({});
        console.log(`📊 Found ${sellers.length} sellers to sync.`);

        for (const seller of sellers) {
            // Sanitize UID
            const uid = `seller_${seller.sellerId.replace(/[@.]/g, '_').toLowerCase()}`;
            const name = seller.name;
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;

            const payload = {
                uid: uid,
                name: name,
                avatar: avatar,
                role: 'default', // 'seller' role might not exist in CC yet, sticking to default or just creates error if role invalid
                tags: ['gms-user'] // Tagging for filtering
            };

            // If we want to identify them as sellers easily in UI besides tags, maybe append (Seller) to name? 
            // The user asked "i also want sellers in this in users", keeping name clean is probably better.

            console.log(`Processing ${name} (${uid})...`);

            try {
                // Try to create user
                const response = await fetch(COMETCHAT_API_URL, {
                    method: 'POST',
                    headers: {
                        'apiKey': COMETCHAT_API_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok) {
                    console.log(`✅ Created: ${name}`);
                } else if (data.code === 'ERR_UID_ALREADY_EXISTS') {
                    // Update if exists to ensure tags are set
                    const updateResponse = await fetch(`${COMETCHAT_API_URL}/${uid}`, {
                        method: 'PUT',
                        headers: {
                            'apiKey': COMETCHAT_API_KEY,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            name: name,
                            avatar: avatar,
                            tags: ['gms-user']
                        })
                    });

                    if (updateResponse.ok) {
                        console.log(`♻️ Updated existing: ${name}`);
                    } else {
                        console.error(`❌ Failed to update ${name}:`, await updateResponse.json());
                    }
                } else {
                    console.error(`❌ Failed to create ${name}:`, data);
                }

            } catch (err) {
                console.error(`Error processing ${name}:`, err.message);
            }
        }

        console.log('🎉 Sync completed!');
        process.exit(0);

    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
}

syncSellers();
