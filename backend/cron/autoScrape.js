const cron = require('node-cron');
const Asin = require('../models/Asin');
const DirectScraperService = require('../services/directScraperService');
const MarketDataSyncService = require('../services/marketDataSyncService');

class AutoScrapeScheduler {
    static init() {
        console.log('⏰ Initializing 24-Hour ASIN Auto-Scraper Cron Job...');
        
        // Run every hour at minute 0
        cron.schedule('0 * * * *', async () => {
            console.log('🔄 Running hourly check for ASINs needing scrape...');
            await this.cleanupStuckScrapes();
            await this.runScrapeCycle();
        });
    }

    static async runScrapeCycle() {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            // Find Active ASINs that haven't been scraped in the last 24 hours, or never scraped
            const asinsToScrape = await Asin.find({
                status: 'Active',
                $or: [
                    { lastScraped: null },
                    { lastScraped: { $lt: twentyFourHoursAgo } }
                ]
            });

            if (asinsToScrape.length === 0) {
                console.log('ℹ️ No ASINs require automatic scraping at this time.');
                return;
            }

            console.log(`🚀 Found ${asinsToScrape.length} ASIN(s) that need automatic scraping.`);

            // Process sequentially to be gentle on resources
            for (const asin of asinsToScrape) {
                try {
                    console.log(`🤖 Auto-scraping ASIN: ${asin.asinCode}`);
                    const scrapeResult = await DirectScraperService.scrapeAsin(asin.asinCode);
                    
                    if (scrapeResult && typeof scrapeResult === 'object') {
                        // Use MarketDataSyncService to process and store the result (updating weekHistory too)
                        await MarketDataSyncService.updateAsinMetrics(asin._id, scrapeResult);
                        console.log(`✅ Auto-scrape successful for ASIN: ${asin.asinCode}`);
                    } else {
                        console.warn(`⚠️ Auto-scrape failed or returned invalid data for ASIN: ${asin.asinCode}`);
                    }
                    
                    // Small delay to prevent rate-limiting between products
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (scrapeErr) {
                    console.error(`❌ Error auto-scraping ASIN ${asin.asinCode}:`, scrapeErr.message);
                }
            }
            console.log('🏁 Auto-scrape cycle completed.');
        } catch (error) {
            console.error('❌ Auto-scrape cycle failed:', error);
        }
    }

    static async cleanupStuckScrapes() {
        try {
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            
            // Revert ASINs stuck in 'Scraping' for more than 4 hours back to 'Active'
            const result = await Asin.updateMany(
                { 
                    status: 'Scraping', 
                    updatedAt: { $lt: fourHoursAgo } 
                },
                { 
                    $set: { 
                        status: 'Active', 
                        scrapeStatus: 'FAILED',
                        scrapeError: 'Scrape timed out after 4 hours'
                    } 
                }
            );
            
            if (result.modifiedCount > 0) {
                console.log(`🧹 Maintenance: Cleaned up ${result.modifiedCount} stuck ASIN scrapes.`);
            }
        } catch (error) {
            console.error('❌ Error cleaning up stuck scrapes:', error);
        }
    }
}

module.exports = AutoScrapeScheduler;
