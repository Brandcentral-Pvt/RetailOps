const playwrightScraperService = require('../services/playwrightScraperService');

async function testScraper() {
    console.log('Testing Playwright Scraper Service...');
    
    const testAsin = 'B0C1SSWQWS'; // Test ASIN
    
    try {
        console.log(`Scraping ASIN: ${testAsin}`);
        const result = await playwrightScraperService.scrapeAsin(testAsin);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await playwrightScraperService.close();
    }
}

testScraper();