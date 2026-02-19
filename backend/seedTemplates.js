const mongoose = require('mongoose');
const TaskTemplate = require('./models/TaskTemplate');
require('dotenv').config();

const templates = [
    {
        title: 'Title SEO Optimization',
        description: 'Audit and update product title with high-volume keywords and clarity.',
        type: 'TITLE_OPTIMIZATION',
        priority: 'MEDIUM',
        estimatedMinutes: 45,
        category: 'SEO & Content'
    },
    {
        title: 'A+ Content Audit',
        description: 'Review A+ content for mobile optimization and conversion rate improvements.',
        type: 'A_PLUS_CONTENT',
        priority: 'HIGH',
        estimatedMinutes: 60,
        category: 'SEO & Content'
    },
    {
        title: 'Competitor Price Analysis',
        description: 'Monitor competitor pricing and adjust map pricing strategy accordingly.',
        type: 'PRICING_STRATEGY',
        priority: 'HIGH',
        estimatedMinutes: 30,
        category: 'Sales & Marketing'
    },
    {
        title: 'Inventory Health Check',
        description: 'Check IPI scores and identify slow-moving stock for liquidation.',
        type: 'INVENTORY_MANAGEMENT',
        priority: 'MEDIUM',
        estimatedMinutes: 40,
        category: 'Operations & General'
    },
    {
        title: 'Account Health Review',
        description: 'Verify account performance metrics and address any policy warnings.',
        type: 'GENERAL_OPTIMIZATION',
        priority: 'URGENT',
        estimatedMinutes: 20,
        category: 'Operations & General'
    }
];

const seedTemplates = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://jenil:jenilpatel@aiap.sedzp3h.mongodb.net/aiap?retryWrites=true&w=majority&appName=aiap');
        console.log('Connected to MongoDB');

        await TaskTemplate.deleteMany({});
        await TaskTemplate.insertMany(templates);

        console.log('Task Templates seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedTemplates();
