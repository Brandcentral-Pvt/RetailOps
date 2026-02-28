const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

const ApiKey = require('./backend/models/ApiKey');
const MONGO_URI = process.env.MONGODB_URI;

const INITIAL_KEYS = [
    {
        name: 'Data Connector Alpha',
        serviceId: 'scraper_primary',
        value: 'sk-scraper-default-key-12345678',
        category: 'Scraping',
        description: 'Primary product scraping engine'
    },
    {
        name: 'Market Intelligence API',
        serviceId: 'amazon_data_main',
        value: 'amz-data-keepa-compat-99887766',
        category: 'Amazon Data',
        description: 'Historical pricing and rank data'
    },
    {
        name: 'AI Logic Core',
        serviceId: 'openai_standard',
        value: 'sk-ai-logic-xxx-yyy-zzz',
        category: 'AI',
        description: 'Content generation and optimization'
    },
    {
        name: 'Messaging Gateway',
        serviceId: 'cometchat_io',
        value: 'cc-msg-gateway-id-554433',
        category: 'Communication',
        description: 'Real-time user communication'
    }
];

const seedKeys = async () => {
    try {
        if (!MONGO_URI) {
            throw new Error('MONGODB_URI not found in environment');
        }
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        for (const k of INITIAL_KEYS) {
            await ApiKey.findOneAndUpdate(
                { serviceId: k.serviceId },
                k,
                { upsert: true, new: true }
            );
            console.log(`Seeded: ${k.name}`);
        }

        console.log('API Keys seeding complete');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedKeys();
