// const fetch = require('node-fetch'); // Native fetch in Node 18+

const COMETCHAT_APP_ID = process.env.COMETCHAT_APP_ID || "1675623ba4da04e9e";
const COMETCHAT_REGION = process.env.COMETCHAT_REGION || "in";
const COMETCHAT_API_KEY = process.env.COMETCHAT_API_KEY || "d07adba4924933e6c9c6ab5d15ec2abe92704a5c"; // Auth Key if API Key not set
const COMETCHAT_API_URL = `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3.0/users`;

const getAvatar = (name) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
};

const sanitizeUid = (id) => {
    return id.replace(/[@.]/g, '_').toLowerCase();
};

const syncUserToCometChat = async (user) => {
    try {
        const uid = sanitizeUid(user.email);
        const name = `${user.firstName} ${user.lastName}`;
        const avatar = user.avatar || getAvatar(name);

        const payload = {
            uid: uid,
            name: name,
            avatar: avatar,
            role: 'default',
            tags: ['gms-user']
        };

        console.log(`💬 Syncing User to CometChat: ${name} (${uid})`);

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
            console.log(`✅ CometChat User Created: ${uid}`);
            user.cometChatUid = uid;
            await user.save();
            return { success: true, data };
        } else if (data.error?.code === 'ERR_UID_ALREADY_EXISTS') {
            console.log(`ℹ️ CometChat User already exists, updating tags: ${uid}`);
            // Update to ensure tags are set
            await fetch(`${COMETCHAT_API_URL}/${uid}`, {
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
            user.cometChatUid = uid;
            await user.save();
            return { success: true, message: 'User updated' };
        } else {
            console.error(`❌ CometChat User Creation Failed:`, data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ CometChat Sync Error:', error);
        return { success: false, error: error.message };
    }
};

const syncSellerToCometChat = async (seller) => {
    try {
        const uid = `seller_${sanitizeUid(seller.sellerId)}`;
        const name = seller.name;
        const avatar = getAvatar(name);

        const payload = {
            uid: uid,
            name: name,
            avatar: avatar,
            role: 'default',
            tags: ['gms-user']
        };

        console.log(`💬 Syncing Seller to CometChat: ${name} (${uid})`);

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
            console.log(`✅ CometChat Seller Created: ${uid}`);
            seller.cometChatUid = uid;
            await seller.save();
            return { success: true, data };
        } else if (data.error?.code === 'ERR_UID_ALREADY_EXISTS') {
            console.log(`ℹ️ CometChat Seller already exists, updating tags: ${uid}`);
            await fetch(`${COMETCHAT_API_URL}/${uid}`, {
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
            seller.cometChatUid = uid;
            await seller.save();
            return { success: true, message: 'Seller updated' };
        } else {
            console.error(`❌ CometChat Seller Creation Failed:`, data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ CometChat Sync Error:', error);
        // Don't modify return here so we don't break the caller if they don't await/check
        return { success: false, error: error.message };
    }
};

const syncAllToCometChat = async () => {
    try {
        console.log('🚀 Starting Background CometChat Sync...');
        const User = require('../models/User');
        const Seller = require('../models/Seller');

        // Sync Users
        const users = await User.find({});
        console.log(`📊 Syncing ${users.length} users...`);
        for (const user of users) {
            await syncUserToCometChat(user);
        }

        // Sync Sellers
        const sellers = await Seller.find({});
        console.log(`📊 Syncing ${sellers.length} sellers...`);
        for (const seller of sellers) {
            await syncSellerToCometChat(seller);
        }

        console.log('✅ Background CometChat Sync Completed');
        return { success: true };
    } catch (error) {
        console.error('❌ Background CometChat Sync Failed:', error);
        return { success: false, error: error.message };
    }
};

const deleteFromCometChat = async (uid) => {
    try {
        console.log(`💬 Deleting from CometChat: ${uid}`);

        const response = await fetch(`${COMETCHAT_API_URL}/${uid}`, {
            method: 'DELETE',
            headers: {
                'apiKey': COMETCHAT_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`✅ CometChat Entity Deleted: ${uid}`);
            return { success: true, data };
        } else if (data.error?.code === 'ERR_UID_NOT_FOUND') {
            console.log(`ℹ️ CometChat Entity not found, already deleted: ${uid}`);
            return { success: true, message: 'Entity not found' };
        } else {
            console.error(`❌ CometChat Deletion Failed:`, data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ CometChat Deletion Error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    syncUserToCometChat,
    syncSellerToCometChat,
    syncAllToCometChat,
    deleteFromCometChat,
    sanitizeUid
};
