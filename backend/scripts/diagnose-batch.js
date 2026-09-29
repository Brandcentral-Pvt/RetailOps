/**
 * Reproduce the liveDataSyncService full-scrape fallback exactly, but WITHOUT
 * swallowing errors, so we can see why every ASIN reported
 * "Scrape fallback failed".
 *
 * Mirrors _scrapeEnrichmentBatch: Promise.allSettled over all codes,
 * full: true, result only kept when r.title is truthy.
 */
const asins = process.argv.slice(2);
const CONCURRENCY = process.env.DIAG_CONCURRENCY || "2";

if (!asins.length) {
  console.error("usage: node diagnose-batch.js <ASIN> [ASIN...]");
  process.exit(1);
}

(async () => {
  const scraper = require("../services/playwrightScraperService");
  const results = new Map();
  const failures = [];

  const t0 = Date.now();
  let done = 0;

  await Promise.allSettled(
    asins.map(async (code) => {
      const started = Date.now();
      try {
        const r = await scraper.scrapeAsin(code, { full: true });
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        if (r && r.title) {
          results.set(code, r);
          console.log(
            `  OK    ${code}  ${secs}s  price=${r.currentPrice ?? r.mrp ?? "-"}  "${String(r.title).slice(0, 48)}"`,
          );
        } else {
          failures.push({ code, error: "NO TITLE RETURNED" });
          console.log(`  EMPTY ${code}  ${secs}s  keys=${Object.keys(r || {}).length}`);
        }
      } catch (e) {
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        failures.push({ code, error: e.message });
        console.log(`  FAIL  ${code}  ${secs}s  ${e.message}`);
      } finally {
        done++;
        const pct = ((done / asins.length) * 100).toFixed(0);
        console.log(
          `        progress ${done}/${asins.length} (${pct}%)  busy=${scraper.busy}  activePages=${scraper.activePages.size}  success=${scraper.successCount}  consecFail=${scraper.consecutiveFailures}`,
        );
      }
    }),
  );

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== SUMMARY (concurrency cap ${CONCURRENCY}, ${total}s) ===`);
  console.log(`succeeded: ${results.size}/${asins.length}`);
  console.log(`failed   : ${failures.length}/${asins.length}`);
  if (failures.length) {
    const grouped = failures.reduce((acc, f) => {
      (acc[f.error] = acc[f.error] || []).push(f.code);
      return acc;
    }, {});
    console.log("\nfailures grouped by error:");
    for (const [err, codes] of Object.entries(grouped)) {
      console.log(`  [${codes.length}x] ${err}`);
      console.log(`         ${codes.join(", ")}`);
    }
  }
  console.log(
    `\nresource state: busy=${scraper.busy} activePages=${scraper.activePages.size} successCount=${scraper.successCount} consecutiveFailures=${scraper.consecutiveFailures}`,
  );

  await scraper.close?.().catch(() => {});
  process.exit(0);
})();
