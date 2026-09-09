require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sql, getPool } = require('../database/db');
const playwrightScraperRunner = require('../services/playwrightScraperRunner');
const playwrightScraperService = require('../services/playwrightScraperService');

const SELLER_ID = '69e8612f1e4de9e2dc81f78d';

async function test() {
  const pool = await getPool();
  
  // Get ASINs that need scraping (missing data)
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
  
  console.log('ASINs needing scrape:', result.recordset.length);
  
  if (result.recordset.length > 0) {
    const asins = result.recordset.slice(0, 5).map(r => r.AsinCode);
    console.log('Testing with:', asins);
    
    const jobConfig = {
      sellerId: SELLER_ID,
      asins,
      userId: 'test-sync',
      priority: 'high',
      options: { proxies: [] },
    };
    
    const jobResult = await playwrightScraperRunner.startJob(jobConfig);
    console.log('Job started:', jobResult.jobId);
    
    // Wait for completion
    let lastProgress = -1;
    while (true) {
      await new Promise(r => setTimeout(r, 5000));
      const job = playwrightScraperRunner.getJobStatus(jobResult.jobId);
      if (!job) break;
      if (job.progress !== lastProgress) {
        console.log(`Progress: ${job.progress}% (${job.processed}/${job.total})`);
        lastProgress = job.progress;
      }
      if (job.status === 'completed' || job.status === 'failed') break;
    }
  }
  
  await playwrightScraperService.close();
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });