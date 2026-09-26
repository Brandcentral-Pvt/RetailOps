// Quick test script for Ajio scraper
// Run: node backend/scripts/test-ajio-scraper.js <productId>

const ajioScraperService = require('../services/ajioScraperService');
const fs = require('fs');
const path = require('path');

async function test() {
    const productId = process.argv[2];
    if (!productId) {
        console.error('Usage: node test-ajio-scraper.js <productId>');
        console.error('Example: node test-ajio-scraper.js 488001234');
        process.exit(1);
    }

    console.log(`Testing Ajio scraper for product: ${productId}`);
    console.log('=' .repeat(50));

    try {
        const result = await ajioScraperService.scrapeProduct(productId, { full: true });
        
        console.log('\n✅ SCRAPED DATA:');
        console.log('─'.repeat(50));
        console.log(`Brand:        ${result.brand || 'NOT FOUND'}`);
        console.log(`Title:        ${result.title || 'NOT FOUND'}`);
        console.log(`MRP:          ₹${result.mrp || 0}`);
        console.log(`ASP (Price):  ₹${result.currentPrice || 0}`);
        console.log(`Discount %:   ${result.discountPercentage || 0}%`);
        console.log(`Rating:       ${result.rating !== null ? result.rating : 'NOT FOUND'} / 5`);
        console.log(`Review Count: ${result.reviewCount !== null ? result.reviewCount : 'NOT FOUND'}`);
        console.log(`Discount %:   ${result.discountPercentage || 0}%`);
        console.log(`Add to Cart:  ${result.addToCartStatus}`);
        console.log(`Sizes:        ${result.sizes ? result.sizes.join(', ') : 'NOT FOUND'}`);
        console.log(`Colors:       ${result.colors ? result.colors.join(', ') : 'NOT FOUND'}`);
        console.log(`Marketplace:  ${result.marketplace}`);
        console.log(`Scraped At:   ${result.scrapedAt}`);
        
        if (result.images && result.images.length > 0) {
            console.log(`\nImages (${result.imagesCount || result.images.length}):`);
            result.images.slice(0, 3).forEach(img => console.log(`  - ${img}`));
        }

        if (result.description) {
            console.log(`\nDescription: ${result.description.substring(0, 200)}...`);
        }
        if (result.specifications) {
            console.log('\nSpecifications:');
            Object.entries(result.specifications).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
        }

    } catch (err) {
        console.error('\n❌ ERROR:', err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    } finally {
        // Cleanup
        await ajioScraperService.forceCleanup();
    }
}

test().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});