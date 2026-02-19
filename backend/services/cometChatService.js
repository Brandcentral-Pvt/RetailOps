// const fetch = require('node-fetch'); // Native fetch in Node 18+

const COMETCHAT_APP_ID = process.env.COMETCHAT_APP_ID || "167556928fc00314a";
const COMETCHAT_REGION = process.env.COMETCHAT_REGION || "in";
const COMETCHAT_API_KEY = process.env.COMETCHAT_API_KEY || "e9b80ec532f553e701de51613d81ca4c81c726cc"; // Auth Key if API Key not set, but better use restricted API key if possible
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

module.exports = {
    syncUserToCometChat,
    syncSellerToCometChat
};
