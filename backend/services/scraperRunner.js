const Asin = require('../models/Asin');
const directScraperService = require('./directScraperService');
const socketService = require('./socketService');
const { calculateCDQ } = require('../utils/lqs');

/**
 * Orchestrates high-volume ASIN repair jobs using DirectScraperService.
 * Handles concurrency, batching, and real-time progress reporting.
 */
class ScraperRunner {
    constructor() {
        this.activeJobs = new Map(); // JobId -> Status
        this.concurrencyLimit = parseInt(process.env.CONCURRENCY_LIMIT) || 5;
    }

    /**
     * Identifies ASINs with missing or generic data for a specific seller.
     */
    async findIncompleteAsins(sellerId) {
        return await Asin.find({
            seller: sellerId,
            status: { $ne: 'Paused' },
            $or: [
                { title: { $exists: false } },
                { title: '' },
                { title: /Amazon Product/i }, // Generic Octoparse placeholder
                { currentPrice: 0 },
                { bsr: 0 },
                { imageUrl: { $exists: false } }
            ]
        }).select('asinCode _id');
    }

    /**
     * Starts a repair job for a seller. Non-blocking.
     */
    async startRepairJob(sellerId, userId) {
        const jobId = `repair-${sellerId}-${Date.now()}`;
        
        if (this.activeJobs.has(sellerId.toString())) {
            throw new Error('A repair job is already running for this seller.');
        }

        const asins = await this.findIncompleteAsins(sellerId);
        if (asins.length === 0) {
            return { message: 'No incomplete ASINs found for this seller.', count: 0 };
        }

        this.activeJobs.set(sellerId.toString(), {
            jobId,
            total: asins.length,
            processed: 0,
            failed: 0,
            startTime: new Date()
        });

        // Run in background
        this._runJob(sellerId, asins, userId).catch(console.error);

        return { jobId, total: asins.length };
    }

    async getJobStatus(sellerId) {
        return this.activeJobs.get(sellerId.toString()) || null;
    }

    /**
     * Internal runner for the repair job.
     */
    async _runJob(sellerId, asins, userId) {
        console.log(`🚀 Starting repair job for seller ${sellerId} (${asins.length} ASINs)`);
        
        const job = this.activeJobs.get(sellerId.toString());
        
        // Process in chunks based on concurrency limit
        for (let i = 0; i < asins.length; i += this.concurrencyLimit) {
            const chunk = asins.slice(i, i + this.concurrencyLimit);
            
            await Promise.all(chunk.map(async (asinDoc) => {
                try {
                    const scrapedData = await directScraperService.scrapeAsin(asinDoc.asinCode);
                    
                    if (scrapedData && scrapedData.title) {
                        const asin = await Asin.findById(asinDoc._id);
                        if (asin) {
                            // Update data
                            Object.assign(asin, scrapedData);
                            
                            // Recalculate CDQ/LQS
                            const cdq = calculateCDQ(asin);
                            asin.cdq = Math.round(cdq.totalScore);
                            asin.cdqGrade = cdq.grade;
                            asin.lqs = asin.cdq;
                            
                            asin.scrapeStatus = 'COMPLETED';
                            asin.lastScraped = new Date();
                            
                            await asin.save();
                            job.processed++;
                        }
                    } else {
                        job.failed++;
                    }
                } catch (err) {
                    console.error(`❌ Repair failed for ${asinDoc.asinCode}:`, err.message);
                    job.failed++;
                }

                // Report progress via Socket
                this._reportProgress(userId, sellerId, job);
            }));

            // Optional delay between batches to avoid IP ban if no proxies
            if (!process.env.PROXY_URL) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        console.log(`✅ Repair job FINISHED for seller ${sellerId}. Processed: ${job.processed}, Failed: ${job.failed}`);
        this.activeJobs.delete(sellerId.toString());
        
        // Final notification
        socketService.emitToUser(userId, 'repair_job_finished', {
            sellerId,
            status: 'COMPLETED',
            total: job.total,
            processed: job.processed,
            failed: job.failed
        });
    }

    _reportProgress(userId, sellerId, job) {
        socketService.emitToUser(userId, 'repair_job_progress', {
            sellerId,
            processed: job.processed,
            failed: job.failed,
            total: job.total,
            percentage: Math.round(((job.processed + job.failed) / job.total) * 100)
        });
    }
}

module.exports = new ScraperRunner();
