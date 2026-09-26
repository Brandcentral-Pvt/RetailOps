// On-demand full Ajio sync for a single brand/seller.
// Run: node backend/scripts/run-ajio-brand-sync.js <sellerId> [maxProducts] [delayMs]
// Example: node run-ajio-brand-sync.js 04f6d6304f1e4153aad48d65 10000 600

const ajioScraperService = require('../services/ajioScraperService');

async function run() {
    const sellerId = process.argv[2];
    if (!sellerId) {
        console.error('Usage: node run-ajio-brand-sync.js <sellerId> [maxProducts] [delayMs]');
        process.exit(1);
    }
    const maxProducts = parseInt(process.argv[3] || '10000', 10);
    const delayMs = parseInt(process.argv[4] || '600', 10);
    const concurrency = parseInt(process.env.AJIO_SCRAPER_CONCURRENT_PAGES || '2', 10);

    console.log(`Starting full Ajio sync — seller: ${sellerId} (max: ${maxProducts}, delay: ${delayMs}ms, workers: ${concurrency})`);
    const startedAt = Date.now();

    try {
        const result = await ajioScraperService.scrapeAllSellerProducts(sellerId, {
            maxProducts,
            delayMs,
            concurrency,
            full: false,
        });
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`\n✅ COMPLETE in ${elapsed}s: ${result.scraped} scraped, ${result.failed} failed`);
        if (result.errors && result.errors.length > 0) {
            console.log(`First errors (${result.errors.length}):`);
            result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
        }
    } catch (err) {
        console.error('\n❌ CRON FAILURE:', err.message);
        if (err.stack) console.error(err.stack);
        process.exitCode = 1;
    } finally {
        await ajioScraperService.forceCleanup();
    }
}

run();