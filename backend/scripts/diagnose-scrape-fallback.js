/**
 * Diagnostic: run the Amazon.in Playwright scraper against specific ASINs and
 * print the REAL error. liveDataSyncService._scrapeEnrichmentBatch swallows
 * scrape errors, so the sync only ever reports "Scrape fallback failed".
 */
const asins = process.argv.slice(2);

if (!asins.length) {
  console.error("usage: node diagnose-scrape-fallback.js <ASIN> [ASIN...]");
  process.exit(1);
}

(async () => {
  const scraper = require("../services/playwrightScraperService");

  for (const asin of asins) {
    const t0 = Date.now();
    process.stdout.write(`\n=== ${asin} ===\n`);
    try {
      const r = await scraper.scrapeAsin(asin, { full: true });
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (r && r.title) {
        console.log(`  OK in ${secs}s`);
        console.log(`  title : ${r.title}`);
        console.log(`  brand : ${r.brand ?? "-"}`);
        console.log(`  price : ${r.currentPrice ?? r.mrp ?? "-"}`);
        console.log(
          `  rating: ${r.rating ?? "-"} | reviews: ${r.reviewCount ?? "-"}`,
        );
        console.log(
          `  stock : addToCartStatus=${r.addToCartStatus ?? "(n/a)"} | ctaLabel=${r.ctaLabel ?? "(n/a)"}`,
        );
      } else {
        console.log(`  EMPTY RESULT in ${secs}s (no title)`);
        console.log(`  keys: ${Object.keys(r || {}).join(", ")}`);
      }
    } catch (e) {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  FAILED in ${secs}s`);
      console.log(`  error: ${e.message}`);
      if (e.stack) {
        console.log(
          `  at   : ${e.stack.split("\n").slice(1, 3).join("\n         ")}`,
        );
      }
    }
  }

  await scraper.close?.().catch(() => {});
  process.exit(0);
})();
