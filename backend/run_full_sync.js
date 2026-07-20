require('dotenv').config();
const { sql, getPool } = require('./database/db');

// Abort any in-progress global sync
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted — waiting for current seller to finish...');
  process.exit(1);
});

async function main() {
  const pool = await getPool();

  // 1. Get all amazon.in sellers with active ASINs (full re-sync)
  console.log('🔍 Finding all amazon.in sellers for full sync...\n');
  const sellers = await pool.request().query(`
    SELECT s.Id, s.Name, 
           COUNT(a.Id) as TotalAsins
    FROM Sellers s
    JOIN Asins a ON a.SellerId = s.Id
    WHERE s.IsActive = 1 AND a.Status = 'Active' AND s.Marketplace = 'amazon.in'
    GROUP BY s.Id, s.Name
    ORDER BY s.Name
  `);

  if (sellers.recordset.length === 0) {
    console.log('✅ No sellers found with active ASINs!');
    process.exit(0);
  }

  const totalAsinsAcrossSellers = sellers.recordset.reduce((sum, s) => sum + s.TotalAsins, 0);
  console.log(`Found ${sellers.recordset.length} sellers (${totalAsinsAcrossSellers} ASINs total) — full sync\n`);

  // 2. Load the live sync service
  const liveDataSyncService = require('./services/liveDataSyncService');

  // 3. Abort any active syncs
  if (liveDataSyncService.activeSyncs.size > 0) {
    console.log(`⚠️  Aborting ${liveDataSyncService.activeSyncs.size} active sync(s)...`);
    liveDataSyncService._globalSyncAborted = true;
    liveDataSyncService.activeSyncs.clear();
    await new Promise(r => setTimeout(r, 2000));
  }

  // 4. Sync each seller SEQUENTIALLY (one by one, no parallel sellers)
  let completed = 0;
  let totalSellers = sellers.recordset.length;

  for (const seller of sellers.recordset) {
    completed++;
    const pct = ((completed / totalSellers) * 100).toFixed(1);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${completed}/${totalSellers}] (${pct}%) ${seller.Name}`);
    console.log(`   Total ASINs: ${seller.TotalAsins} — full re-sync`);
    console.log(`${'='.repeat(60)}`);

    try {
      const result = await liveDataSyncService.syncSellerLiveData(seller.Id);
      if (result.success) {
        console.log(`   ✅ Done — ${result.updatedAsins} updated, ${result.failedAsins} failed (${(result.duration / 1000).toFixed(1)}s)`);
      } else {
        console.log(`   ⚠️  Partial — Updated: ${result.updatedAsins || 0}, Failed: ${result.failedAsins || 0}`);
      }
    } catch (err) {
      console.log(`   ❌ Failed — ${err.message}`);
    }

    // Small delay between sellers to let rate limits cool down
    if (completed < totalSellers) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // 5. Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 SYNC COMPLETE');
  console.log(`${'='.repeat(60)}`);

  // Verify results
  const remaining = await pool.request().query(`
    SELECT COUNT(*) as Remaining 
    FROM Asins a 
    JOIN Sellers s ON a.SellerId = s.Id
    WHERE s.IsActive = 1 AND a.Status = 'Active' AND s.Marketplace = 'amazon.in'
    AND a.LastLiveSyncAt IS NULL
  `);
  console.log(`\nASINs still missing LastLiveSyncAt: ${remaining.recordset[0].Remaining} (failed or skipped)`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
