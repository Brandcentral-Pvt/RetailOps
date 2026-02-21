const directScraper = require('../services/directScraperService');

async function testDirectScraping() {
    const testAsins = [
        'B0D4M9C9FB',
        'B0BR852N53',
        'B07D3PL8WN',
        'B0D678M9CV',
        'B0BR8BVQTT', // Amazon Basics Apple Certified Nylon Braided Lightning to USB Cable
    ];

    console.log(`🚀 Starting Direct Scraping Test...`);

    for (const asin of testAsins) {
        try {
            console.log(`\n--- Scraping ASIN: ${asin} ---`);
            const data = await directScraper.scrapeAsin(asin);

            console.log('\n📊 Results:');
            console.log(JSON.stringify(data, null, 2));
            console.log('✅ Test Passed\n');

        } catch (err) {
            console.error(`❌ Test Failed for ${asin}:`, err.message);
        }
    }
}

testDirectScraping();
