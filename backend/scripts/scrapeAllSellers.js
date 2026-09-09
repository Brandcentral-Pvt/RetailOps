require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sql, getPool } = require('../database/db');
const playwrightScraperRunner = require('../services/playwrightScraperRunner');
const playwrightScraperService = require('../services/playwrightScraperService');

async function getActiveSellers() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT Id, Name, Marketplace 
        FROM Sellers 
        WHERE IsActive = 1 
        AND Marketplace = 'amazon.in'
        ORDER BY Name
    `);
    return result.recordset;
}

async function getMissingAsinsForSeller(sellerId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('sellerId', sql.VarChar, sellerId);
    // Set query timeout to 2 minutes
    request.queryTimeout = 120000;
    
    const result = await request.query(`
        SELECT a.AsinCode 
        FROM Asins a
        LEFT JOIN AsinScrapeData s ON a.AsinCode = s.Asin AND s.SellerId = @sellerId
        WHERE a.SellerId = @sellerId 
        AND (a.Status IS NULL OR a.Status != 'Archived')
        AND (
            s.Asin IS NULL  -- Not scraped yet
            OR a.Rating IS NULL OR a.Rating = 0
            OR a.ReviewCount IS NULL OR a.ReviewCount = 0
            OR a.HasAplus IS NULL OR a.HasAplus = 0
        )
        ORDER BY a.CreatedAt
    `);
    return result.recordset.map(r => r.AsinCode);
}

async function startScrapeForSeller(sellerId, sellerName, asins) {
    const jobConfig = {
        sellerId,
        asins,
        userId: 'system-all-sellers-sync',
        priority: 'normal',
        options: { proxies: [] },
    };

    const jobResult = await playwrightScraperRunner.startJob(jobConfig);
    console.log(`  [${sellerName}] Started job ${jobResult.jobId} for ${asins.length} ASINs`);
    return { skipped: false, jobId: jobResult.jobId, asins: asins.length };
}

async function waitForJobs(jobIds) {
    const pool = await getPool();
    let pending = new Set(jobIds);
    let lastLogTime = Date.now();

    while (pending.size > 0) {
        await new Promise(r => setTimeout(r, 15000));
        
        const completed = [];
        for (const jobId of pending) {
            const job = playwrightScraperRunner.getJobStatus(jobId);
            if (!job) {
                const history = await pool.request()
                    .input('jobId', sql.VarChar, jobId)
                    .query('SELECT TOP 1 Status, Successful, Failed FROM ScrapeJobHistory WHERE JobId = @jobId ORDER BY CreatedAt DESC');
                
                if (history.recordset.length > 0) {
                    const h = history.recordset[0];
                    console.log(`  Job ${jobId}: ${h.Status} (${h.Successful} success, ${h.Failed} failed)`);
                    completed.push(jobId);
                }
            }
        }
        
        completed.forEach(id => pending.delete(id));
        
        if (Date.now() - lastLogTime > 60000) {
            console.log(`  Waiting for ${pending.size} jobs...`);
            lastLogTime = Date.now();
        }
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('STARTING SCRAPE FOR ALL AMAZON.IN SELLERS');
    console.log('='.repeat(60));

    const sellers = await getActiveSellers();
    console.log(`Found ${sellers.length} active Amazon.in sellers`);

    const jobsToWait = [];
    let totalAsinsToScrape = 0;

    for (const seller of sellers) {
        console.log(`\n[${seller.Name}] Checking missing ASINs...`);
        const asins = await getMissingAsinsForSeller(seller.Id);
        
        if (asins.length === 0) {
            console.log(`  [${seller.Name}] All ASINs already have data, skipping`);
            continue;
        }
        
        console.log(`  [${seller.Name}] Missing data for ${asins.length} ASINs`);
        
        const result = await startScrapeForSeller(seller.Id, seller.Name, asins);
        jobsToWait.push(result.jobId);
        totalAsinsToScrape += result.asins;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Started ${jobsToWait.length} jobs for ${totalAsinsToScrape} total ASINs`);
    console.log(`Waiting for completion...`);
    console.log(`${'='.repeat(60)}`);

    if (jobsToWait.length > 0) {
        await waitForJobs(jobsToWait);
    }

    // Final stats
    const pool = await getPool();
    const finalStats = await pool.request().query(`
        SELECT 
            COUNT(*) as TotalScraped,
            COUNT(Mrp) as WithMrp,
            COUNT(CASE WHEN DiscountPercentage > 0 THEN 1 END) as WithDiscount,
            COUNT(CASE WHEN ImagesCount > 0 THEN 1 END) as WithImages,
            COUNT(CASE WHEN Brand IS NOT NULL AND Brand != '' THEN 1 END) as WithBrand,
            COUNT(CASE WHEN Category IS NOT NULL AND Category != '' THEN 1 END) as WithCategory,
            COUNT(CASE WHEN Availability IS NOT NULL AND Availability != '' THEN 1 END) as WithAvailability,
            COUNT(CASE WHEN SoldBy IS NOT NULL AND SoldBy != '' THEN 1 END) as WithSoldBy
        FROM AsinScrapeData
    `);

    console.log('\n' + '='.repeat(60));
    console.log('ALL SELLERS COMPLETE');
    console.log('='.repeat(60));
    console.table(finalStats.recordset[0]);

    await playwrightScraperService.close();
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });