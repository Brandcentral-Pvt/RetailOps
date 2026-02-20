require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust path to your User model

const COMETCHAT_APP_ID = "1675623ba4da04e9e";
const COMETCHAT_REGION = "in";
const COMETCHAT_API_KEY = "d07adba4924933e6c9c6ab5d15ec2abe92704a5c"; // Auth Key

const COMETCHAT_API_URL = `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3.0/users`;

async function syncUsers() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/easysell";
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        const users = await User.find({});
        console.log(`📊 Found ${users.length} users to sync.`);

        for (const user of users) {
            // CometChat SDK 4.0 UIDs must be alphanumeric (underscores/hyphens allowed)
            // Sanitizing email to be a valid UID (replacing @ and . with _)
            const uid = user.email.replace(/[@.]/g, '_').toLowerCase();
            const name = `${user.firstName} ${user.lastName}`;

            // Use existing avatar or generate default
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
            const avatar = user.avatar || defaultAvatar;

            const payload = {
                uid: uid,
                name: name,
                avatar: avatar,
                role: 'default',
                tags: ['gms-user'] // The critical tag for filtering
            };

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
                } else if (data.error?.code === 'ERR_UID_ALREADY_EXISTS') {
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

        console.log('🎉 User Sync completed!');
        process.exit(0);

    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
}

syncUsers();
