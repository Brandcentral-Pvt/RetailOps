require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sql, getPool } = require('../database/db');
const playwrightScraperRunner = require('../services/playwrightScraperRunner');
const playwrightScraperService = require('../services/playwrightScraperService');

const SELLER_ID = '69e8612f1e4de9e2dc81f78d';

async function main() {
  const pool = await getPool();
  
  // Get all ASINs that need scraping (missing data)
  const result = await pool.request()
    .input('sellerId', sql.VarChar, SELLER_ID)
    .query(`
      SELECT AsinCode FROM Asins 
      WHERE SellerId = @sellerId 
      AND (Status IS NULL OR Status != 'Archived')
      AND (
        AsinCode NOT IN (SELECT Asin FROM AsinScrapeData WHERE SellerId = @sellerId)
        OR Rating IS NULL OR Rating = 0
        OR ReviewCount IS NULL OR ReviewCount = 0
        OR HasAplus IS NULL OR HasAplus = 0
      )
      ORDER BY CreatedAt
    `);

  const asins = result.recordset.map(r => r.AsinCode);
  console.log(`Found ${asins.length} ASINs needing scrape`);
  
  if (asins.length === 0) {
    console.log('All ASINs already have data!');
    await playwrightScraperService.close();
    process.exit(0);
  }

  const jobConfig = {
    sellerId: SELLER_ID,
    asins,
    userId: 'system-full-sync',
    priority: 'normal',
    options: { proxies: [] },
  };

  console.log('Starting full sync job...');
  const jobResult = await playwrightScraperRunner.startJob(jobConfig);
  console.log(`Job started: ${jobResult.jobId}`);
  console.log(`Total ASINs: ${asins.length}`);

  // Poll for completion
  let lastProgress = -1;
  let lastLogTime = Date.now();
  
  while (true) {
    await new Promise(r => setTimeout(r, 10000));
    
    const job = playwrightScraperRunner.getJobStatus(jobResult.jobId);
    if (!job) {
      // Check history
      const history = await pool.request()
        .input('jobId', sql.VarChar, jobResult.jobId)
        .query('SELECT TOP 1 * FROM ScrapeJobHistory WHERE JobId = @jobId ORDER BY CreatedAt DESC');
      
      if (history.recordset.length > 0) {
        const h = history.recordset[0];
        console.log('\n' + '='.repeat(60));
        console.log('JOB COMPLETED');
        console.log('='.repeat(60));
        console.log(`Status: ${h.Status}`);
        console.log(`Total: ${h.TotalAsins}`);
        console.log(`Successful: ${h.Successful}`);
        console.log(`Failed: ${h.Failed}`);
        console.log(`Duration: ${h.EndTime ? new Date(h.EndTime) - new Date(h.StartTime) : 'N/A'} ms`);
        break;
      }
      console.log('Job not found');
      break;
    }

    if (job.progress !== lastProgress) {
      console.log(`Progress: ${job.progress}% (${job.processed}/${job.total}) - Success: ${job.successful}, Failed: ${job.failed}`);
      lastProgress = job.progress;
    }

    // Log stats every 30 seconds
    if (Date.now() - lastLogTime > 30000) {
      const stats = playwrightScraperRunner.getStats();
      console.log(`Runner: ${stats.totalSuccessful} success, ${stats.totalFailed} failed`);
      lastLogTime = Date.now();
    }

    if (job.status === 'completed' || job.status === 'failed') {
      console.log(`\nJob ${job.status}: ${job.processed}/${job.total} (${job.successful} success, ${job.failed} failed)`);
      break;
    }
  }

  // Final verification
  const finalStats = await pool.request()
    .input('sellerId', sql.VarChar, SELLER_ID)
    .query(`
      SELECT 
        COUNT(*) as TotalScraped, 
        COUNT(Mrp) as WithMrp,
        COUNT(CASE WHEN DiscountPercentage > 0 THEN 1 END) as WithDiscount,
        COUNT(CASE WHEN ImagesCount > 0 THEN 1 END) as WithImages,
        COUNT(CASE WHEN Brand IS NOT NULL AND Brand != '' THEN 1 END) as WithBrand,
        COUNT(CASE WHEN Category IS NOT NULL AND Category != '' THEN 1 END) as WithCategory,
        COUNT(CASE WHEN Availability IS NOT NULL AND Availability != '' THEN 1 END) as WithAvailability,
        COUNT(CASE WHEN SoldBy IS NOT NULL AND SoldBy != '' THEN 1 END) as WithSoldBy,
        COUNT(CASE WHEN DealBadge IS NOT NULL AND DealBadge != '' THEN 1 END) as WithDealBadge
      FROM AsinScrapeData 
      WHERE SellerId = @sellerId
    `);

  console.log('\nFinal Database Stats:');
  console.table(finalStats.recordset[0]);

  await playwrightScraperService.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });