require('dotenv').config();
const { sql, getPool } = require('./database/db');

async function main() {
  const pool = await getPool();

  // 1. Get all amazon.in sellers that have unsynced Active ASINs
  const sellers = await pool.request().query(`
    SELECT s.Id, s.Name, 
           COUNT(a.Id) as Total,
           SUM(CASE WHEN a.LastLiveSyncAt IS NOT NULL THEN 1 ELSE 0 END) as Synced
    FROM Sellers s
    JOIN Asins a ON a.SellerId = s.Id
    WHERE s.IsActive = 1 AND a.Status = 'Active' AND s.Marketplace = 'amazon.in'
    GROUP BY s.Id, s.Name
    ORDER BY (COUNT(a.Id) - SUM(CASE WHEN a.LastLiveSyncAt IS NOT NULL THEN 1 ELSE 0 END)) DESC
  `);

  const totalUnsynced = sellers.recordset.reduce((s, r) => s + (r.Total - r.Synced), 0);
  const totalBatches = Math.ceil(totalUnsynced / 10);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AMAZON.IN FULL LIVE SYNC`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Sellers needing sync: ${sellers.recordset.length}`);
  console.log(`  Total unsynced ASINs: ${totalUnsynced}`);
  console.log(`  API batches needed (10/req): ${totalBatches}`);
  console.log(`  Est. time (2 req/s with 2 credentials): ${Math.ceil(totalBatches / 2 / 60)} min`);
  console.log(`${'='.repeat(60)}\n`);

  const service = require('./services/liveDataSyncService');
  let done = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  for (const seller of sellers.recordset) {
    done++;
    const unsynced = seller.Total - seller.Synced;
    const pct = ((done / sellers.recordset.length) * 100).toFixed(1);

    console.log(`[${done}/${sellers.recordset.length}] (${pct}%) ${seller.Name} — ${unsynced} unsynced of ${seller.Total} total`);

    try {
      const result = await service.syncSellerLiveData(seller.Id);
      const updated = result.updatedAsins || 0;
      const failed = result.failedAsins || 0;
      totalSuccess += updated;
      totalFailed += failed;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  → ${updated} updated, ${failed} failed (${elapsed}s elapsed)`);
    } catch (err) {
      totalFailed += unsynced;
      console.log(`  → FAILED: ${err.message}`);
    }

    if (done < sellers.recordset.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  COMPLETE in ${totalElapsed}s`);
  console.log(`  Updated: ${totalSuccess} | Failed: ${totalFailed}`);
  console.log(`${'='.repeat(60)}`);

  const remaining = await pool.request().query(`
    SELECT COUNT(*) as Remaining
    FROM Asins a JOIN Sellers s ON a.SellerId = s.Id
    WHERE s.IsActive = 1 AND a.Status = 'Active' AND s.Marketplace = 'amazon.in'
    AND a.LastLiveSyncAt IS NULL
  `);
  console.log(`\nRemaining unsynced ASINs: ${remaining.recordset[0].Remaining}`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
