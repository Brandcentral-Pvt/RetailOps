require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sql, getPool } = require('../database/db');
const playwrightScraperRunner = require('../services/playwrightScraperRunner');
const playwrightScraperService = require('../services/playwrightScraperService');
const logger = require('../utils/logger');

const SELLER_ID = '69e8612f1e4de9e2dc81f78d'; // 101-BHARVITA
const SELLER_NAME = '101-BHARVITA';

async function getActiveAsinsForSeller(sellerId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('sellerId', sql.VarChar, sellerId)
        .query(`
            SELECT AsinCode 
            FROM Asins 
            WHERE SellerId = @sellerId 
            AND (Status IS NULL OR Status != 'Archived')
            ORDER BY CreatedAt
        `);
    return result.recordset.map(r => r.AsinCode);
}

async function main() {
    console.log('='.repeat(60));
    console.log(`Starting scrape for seller: ${SELLER_NAME} (${SELLER_ID})`);
    console.log('='.repeat(60));

    try {
        // Get all active ASINs
        const asins = await getActiveAsinsForSeller(SELLER_ID);
        console.log(`Found ${asins.length} active ASINs to scrape`);

        if (asins.length === 0) {
            console.log('No ASINs to scrape. Exiting.');
            return;
        }

        // Start scrape job
        const jobConfig = {
            sellerId: SELLER_ID,
            asins: asins,
            userId: 'system-batch-scraper',
            priority: 'normal',
            options: {
                proxies: process.env.SCRAPER_PROXY_LIST ? process.env.SCRAPER_PROXY_LIST.split(',') : [],
            },
        };

        console.log('Starting scrape job...');
        const result = await playwrightScraperRunner.startJob(jobConfig);
        console.log(`Job started: ${result.jobId}`);
        console.log(`Total ASINs: ${result.total}`);

        // Poll for completion
        let lastProgress = -1;
        while (true) {
            await new Promise(r => setTimeout(r, 10000)); // Check every 10 seconds
            
            const job = playwrightScraperRunner.getJobStatus(result.jobId);
            if (!job) {
                // Job might be completed, check history
                const pool = await getPool();
                const history = await pool.request()
                    .input('jobId', sql.VarChar, result.jobId)
                    .query('SELECT TOP 1 * FROM ScrapeJobHistory WHERE JobId = @jobId ORDER BY CreatedAt DESC');
                
                if (history.recordset.length > 0) {
                    const h = history.recordset[0];
                    console.log('\n' + '='.repeat(60));
                    console.log('JOB COMPLETED');
                    console.log('='.repeat(60));
                    console.log(`Status: ${h.Status}`);
                    console.log(`Total: ${h.TotalAsins}`);
                    console.log(`Processed: ${h.Processed}`);
                    console.log(`Successful: ${h.Successful}`);
                    console.log(`Failed: ${h.Failed}`);
                    console.log(`Duration: ${h.EndTime ? new Date(h.EndTime) - new Date(h.StartTime) : 'N/A'} ms`);
                    break;
                }
                console.log('Job not found in active jobs or history');
                break;
            }

            if (job.progress !== lastProgress) {
                console.log(`Progress: ${job.progress}% (${job.processed}/${job.total}) - Success: ${job.successful}, Failed: ${job.failed}`);
                lastProgress = job.progress;
            }

            if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
                console.log('\n' + '='.repeat(60));
                console.log(`JOB ${job.status.toUpperCase()}`);
                console.log('='.repeat(60));
                console.log(`Total: ${job.total}`);
                console.log(`Processed: ${job.processed}`);
                console.log(`Successful: ${job.successful}`);
                console.log(`Failed: ${job.failed}`);
                break;
            }
        }

        // Show final stats
        const stats = playwrightScraperRunner.getStats();
        console.log('\nRunner Stats:', stats);

    } catch (error) {
        console.error('Error:', error.message);
        logger.error('Batch scrape error', { error: error.message, stack: error.stack });
    } finally {
        // Give time for any pending DB writes
        await new Promise(r => setTimeout(r, 5000));
        await playwrightScraperService.close();
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});