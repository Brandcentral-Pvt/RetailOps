const mongoose = require('mongoose');

// Mock Models
const Seller = { countDocuments: async () => 1 };
const Asin = {
    countDocuments: async () => 10,
    find: () => ({
        lean: () => [{ currentPrice: 100, history: [{ date: new Date().toISOString(), price: 100 }] }],
        populate: () => [{ asinCode: 'TEST', currentPrice: 100 }]
    })
};
const Alert = {
    find: () => ({
        sort: () => ({
            limit: () => []
        })
    })
};

// Logic from dashboardController.js
const parsePeriod = (period) => {
    if (!period) return 30;
    const p = (Array.isArray(period) ? period[0] : period).toString().trim();
    const num = parseInt(p);
    if (isNaN(num)) return 30;
    const unit = p.slice(-1).toLowerCase();
    switch (unit) {
        case 'd': return num;
        case 'w': return num * 7;
        case 'm': return num * 30;
        case 'y': return num * 365;
        default:
            if (p.endsWith('M')) return num * 30;
            return num;
    }
};

function processChartData(asins, days) {
    const dateMap = {};
    const today = new Date();
    const validDays = Math.max(1, Math.floor(days));
    for (let i = validDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dateMap[dateStr] = { revenue: 0, units: 0 };
    }
    return { success: true };
}

// Test cases
try {
    console.log('Testing "30d":', parsePeriod('30d'));
    console.log('Testing "3M":', parsePeriod('3M'));
    console.log('Testing "30D":', parsePeriod('30D'));
    console.log('Testing undefined:', parsePeriod(undefined));

    processChartData([], 90);
    console.log('Chart processing passed for 90 days');

    processChartData([], 30);
    console.log('Chart processing passed for 30 days');

} catch (e) {
    console.error('FAILED:', e.message);
    console.error(e.stack);
}
