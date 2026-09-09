require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sql, getPool } = require('../database/db');
const playwrightScraperRunner = require('../services/playwrightScraperRunner');

async function waitForQueuedJobs() {
    const pool = await getPool();
    
    // Get all job IDs from history that are not completed
    const activeJobs = playwrightScraperRunner.getAllJobs();
    console.log('Active runner jobs:', activeJobs.length);
    activeJobs.forEach(job => {
        console.log(`  ${job.jobId}: ${job.status} - ${job.processed}/${job.total}`);
    });
    
    // Also check recent job history
    const recentJobs = await pool.request().query(`
        SELECT JobId, SellerId, Status, TotalAsins, Successful, Failed, StartTime
        FROM ScrapeJobHistory 
        WHERE CreatedAt > '2026-09-07 14:00:00'
        ORDER BY CreatedAt DESC
    `);
    
    console.log('\nRecent job history:');
    recentJobs.recordset.forEach(job => {
        console.log(`  ${job.JobId}: ${job.Status} (${job.Successful}/${job.TotalAsins})`);
    });
    
    // Wait for active jobs
    let pending = new Set(activeJobs.map(j => j.jobId));
    
    // Also add from history if running
    for (const job of recentJobs.recordset) {
        if (job.Status === 'running' || job.Status === 'processing' || job.Status === 'queued') {
            pending.add(job.JobId);
        }
    }
    
    console.log(`\nWaiting for ${pending.size} jobs...`);
    
    let lastLogTime = Date.now();
    
    while (pending.size > 0) {
        await new Promise(r => setTimeout(r, 30000));
        
        const completed = [];
        for (const jobId of pending) {
            const job = playwrightScraperRunner.getJobStatus(jobId);
            if (!job) {
                // Check history
                const history = await pool.request()
                    .input('jobId', sql.VarChar, jobId)
                    .query('SELECT TOP 1 Status, Successful, Failed FROM ScrapeJobHistory WHERE JobId = @jobId ORDER BY CreatedAt DESC');
                
                if (history.recordset.length > 0) {
                    const h = history.recordset[0];
                    if (h.Status === 'completed' || h.Status === 'failed' || h.Status === 'cancelled') {
                        console.log(`  Job ${jobId}: ${h.Status} (${h.Successful}/${h.Failed} failed)`);
                        completed.push(jobId);
                    }
                }
            } else if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
                console.log(`  Job ${jobId}: ${job.status} (${job.successful} success, ${job.failed} failed)`);
                completed.push(jobId);
            }
        }
        
        completed.forEach(id => pending.delete(id));
        
        if (Date.now() - lastLogTime > 60000) {
            console.log(`  Still waiting for ${pending.size} jobs...`);
            const stats = playwrightScraperRunner.getStats();
            console.log(`  Runner: ${stats.totalSuccessful} success, ${stats.totalFailed} failed`);
            lastLogTime = Date.now();
        }
    }
    
    console.log('\nAll jobs completed!');
    
    // Final stats
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
    
    console.table(finalStats.recordset[0]);
    process.exit(0);
}

waitForQueuedJobs().catch(e => { console.error(e); process.exit(1); });