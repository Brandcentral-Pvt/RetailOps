const { sql, getPool, executeWithRetry } = require('../database/db');
const playwrightScraperService = require('./playwrightScraperService');
const socketService = require('./socketService');
const logger = require('../utils/logger');

class PlaywrightScraperRunner {
    constructor() {
        this.activeJobs = new Map();
        this.jobQueue = [];
        this.isProcessing = false;
        this.workerCount = parseInt(process.env.SCRAPER_WORKERS) || 1;
        this.batchSize = parseInt(process.env.SCRAPER_BATCH_SIZE) || 50;
        this.maxConcurrentASINs = parseInt(process.env.SCRAPER_MAX_CONCURRENT_ASINS) || 10;
        this.retryFailedAfter = parseInt(process.env.SCRAPER_RETRY_FAILED_HOURS) || 24;
        
        this.stats = {
            totalProcessed: 0,
            totalSuccessful: 0,
            totalFailed: 0,
            startTime: null,
            lastProcessedAt: null,
        };
    }

    async startJob(jobConfig) {
        const {
            jobId = `scrape-${Date.now()}`,
            sellerId,
            asins = [],
            userId,
            priority = 'normal',
            options = {},
        } = jobConfig;

        if (this.activeJobs.has(jobId)) {
            throw new Error(`Job ${jobId} already exists`);
        }

        if (asins.length === 0) {
            throw new Error('No ASINs provided for scraping');
        }

        const validAsins = this.validateAsins(asins);
        if (validAsins.length === 0) {
            throw new Error('No valid ASINs provided');
        }

        const job = {
            jobId,
            sellerId,
            userId,
            priority,
            asins: validAsins,
            total: validAsins.length,
            processed: 0,
            successful: 0,
            failed: 0,
            status: 'queued',
            options,
            startTime: new Date(),
            endTime: null,
            progress: 0,
            currentBatch: 0,
            totalBatches: Math.ceil(validAsins.length / this.batchSize),
            results: [],
            errors: [],
        };

        this.activeJobs.set(jobId, job);
        this.jobQueue.push(job);
        this.jobQueue.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));

        if (!this.isProcessing) {
            this.processQueue().catch(err => logger.error('Queue processor error', { error: err.message }));
        }

        logger.info('Scrape job queued', { jobId, sellerId, totalAsins: validAsins.length });
        this.emitProgress(jobId, job);

        return { jobId, total: validAsins.length, status: 'queued' };
    }

    validateAsins(asins) {
        const asinRegex = /^[A-Z0-9]{10}$/;
        return [...new Set(asins.map(a => a.trim().toUpperCase()).filter(a => asinRegex.test(a)))];
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.stats.startTime = new Date();

        logger.info('Starting scrape queue processor', { 
            queueLength: this.jobQueue.length,
            workers: this.workerCount 
        });

        while (this.jobQueue.length > 0 || this.hasActiveProcessingJobs()) {
            const availableSlots = this.workerCount - this.getActiveWorkerCount();
            
            if (availableSlots > 0 && this.jobQueue.length > 0) {
                const job = this.jobQueue.shift();
                this.runJob(job).catch(err => logger.error('Job execution error', { 
                    jobId: job.jobId, 
                    error: err.message 
                }));
            } else {
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        this.isProcessing = false;
        logger.info('Scrape queue processor finished', this.stats);
    }

    hasActiveProcessingJobs() {
        for (const job of this.activeJobs.values()) {
            if (job.status === 'running' || job.status === 'processing') return true;
        }
        return false;
    }

    getActiveWorkerCount() {
        let count = 0;
        for (const job of this.activeJobs.values()) {
            if (job.status === 'running' || job.status === 'processing') count++;
        }
        return count;
    }

    async runJob(job) {
        job.status = 'running';
        job.startTime = new Date();
        this.emitProgress(job.jobId, job);

        logger.info('Starting scrape job', { 
            jobId: job.jobId, 
            sellerId: job.sellerId, 
            total: job.total 
        });

        try {
            const batches = this.createBatches(job.asins, this.batchSize);
            
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                if (job.status === 'cancelled') break;

                job.currentBatch = batchIndex + 1;
                const batch = batches[batchIndex];

                const batchResults = await this.processBatch(batch, job);
                
                job.results.push(...batchResults.results);
                job.errors.push(...batchResults.errors);
                job.processed += batch.length;
                job.successful += batchResults.results.filter(r => r.success).length;
                job.failed += batchResults.results.filter(r => !r.success).length + batchResults.errors.length;
                job.progress = Math.round((job.processed / job.total) * 100);
                job.lastProcessedAt = new Date();

                this.stats.totalProcessed += batch.length;
                this.stats.totalSuccessful += batchResults.results.filter(r => r.success).length;
                this.stats.totalFailed += batchResults.results.filter(r => !r.success).length + batchResults.errors.length;
                this.stats.lastProcessedAt = new Date();

                await this.saveBatchResults(job, batchResults.results);
                this.emitProgress(job.jobId, job);

                if (batchIndex < batches.length - 1) {
                    const interBatchDelay = parseInt(process.env.SCRAPER_INTER_BATCH_DELAY) || 5000;
                    await new Promise(r => setTimeout(r, interBatchDelay));
                }
            }

            job.status = job.status === 'cancelled' ? 'cancelled' : 'completed';
            job.endTime = new Date();
            job.progress = 100;

            await this.finalizeJob(job);
            this.emitProgress(job.jobId, job);

            logger.info('Scrape job completed', { 
                jobId: job.jobId, 
                processed: job.processed, 
                successful: job.successful, 
                failed: job.failed 
            });

        } catch (error) {
            job.status = 'failed';
            job.endTime = new Date();
            job.error = error.message;
            logger.error('Scrape job failed', { jobId: job.jobId, error: error.message });
            this.emitProgress(job.jobId, job);
        } finally {
            this.activeJobs.delete(job.jobId);
        }
    }

    createBatches(asins, batchSize) {
        const batches = [];
        for (let i = 0; i < asins.length; i += batchSize) {
            batches.push(asins.slice(i, i + batchSize));
        }
        return batches;
    }

    async processBatch(asins, job) {
        const concurrency = Math.min(this.maxConcurrentASINs, asins.length);
        const results = [];
        const errors = [];

        const chunks = [];
        for (let i = 0; i < asins.length; i += concurrency) {
            chunks.push(asins.slice(i, i + concurrency));
        }

        for (const chunk of chunks) {
            if (job.status === 'cancelled') break;

            const proxy = this.getNextProxyForJob(job);
            const chunkPromises = chunk.map(asin => 
                playwrightScraperService.scrapeAsin(asin, { proxy })
            );

            const chunkResults = await Promise.allSettled(chunkPromises);

            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    errors.push({ error: result.reason.message });
                }
            }

            if (chunk !== chunks[chunks.length - 1]) {
                const interChunkDelay = parseInt(process.env.SCRAPER_INTER_CHUNK_DELAY) || 1000;
                await new Promise(r => setTimeout(r, interChunkDelay));
            }
        }

        return { results, errors };
    }

    getNextProxyForJob(job) {
        const proxyList = job.options?.proxies || 
            (process.env.SCRAPER_PROXY_LIST ? process.env.SCRAPER_PROXY_LIST.split(',') : []);
        
        if (proxyList.length === 0) return null;
        
        const index = job.currentBatch % proxyList.length;
        return proxyList[index].trim();
    }

    async saveBatchResults(job, results) {
        if (results.length === 0) return;

        const pool = await getPool();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            for (const result of results) {
                if (!result.success) continue;

                const request = transaction.request();
                request.input('asin', sql.VarChar, result.asin);
                request.input('sellerId', sql.VarChar, job.sellerId);
                request.input('rating', sql.Decimal(3, 2), result.rating || 0);
                request.input('reviewCount', sql.Int, result.reviewCount || 0);
                request.input('hasAplus', sql.Bit, result.hasAplus ? 1 : 0);
                request.input('aplusDetails', sql.NVarChar(sql.MAX), JSON.stringify(result.aplusDetails || {}));
                request.input('verifiedAsin', sql.VarChar, result.verifiedAsin || result.asin);
                request.input('title', sql.NVarChar(sql.MAX), result.title);
                request.input('price', sql.Decimal(18, 2), result.price || 0);
                request.input('bsr', sql.Int, result.bsr);
                request.input('ratingBreakdown', sql.NVarChar(sql.MAX), JSON.stringify(result.ratingBreakdown || {}));
                request.input('scrapedAt', sql.DateTime2, new Date(result.scrapedAt));
                request.input('duration', sql.Int, result.duration || 0);

                await request.query(`
                    MERGE INTO AsinScrapeData AS target
                    USING (SELECT @asin AS Asin, @sellerId AS SellerId) AS source
                    ON target.Asin = source.Asin AND target.SellerId = source.SellerId
                    WHEN MATCHED THEN
                        UPDATE SET
                            Rating = @rating,
                            ReviewCount = @reviewCount,
                            HasAplus = @hasAplus,
                            AplusDetails = @aplusDetails,
                            VerifiedAsin = @verifiedAsin,
                            Title = @title,
                            Price = @price,
                            BSR = @bsr,
                            RatingBreakdown = @ratingBreakdown,
                            LastScrapedAt = @scrapedAt,
                            ScrapeDurationMs = @duration,
                            UpdatedAt = dbo.GetEnvDate()
                    WHEN NOT MATCHED THEN
                        INSERT (Asin, SellerId, Rating, ReviewCount, HasAplus, AplusDetails, VerifiedAsin, Title, Price, BSR, RatingBreakdown, LastScrapedAt, ScrapeDurationMs, CreatedAt, UpdatedAt)
                        VALUES (@asin, @sellerId, @rating, @reviewCount, @hasAplus, @aplusDetails, @verifiedAsin, @title, @price, @bsr, @ratingBreakdown, @scrapedAt, @duration, dbo.GetEnvDate(), dbo.GetEnvDate());
                `);
            }

            await transaction.commit();
            logger.debug('Batch results saved', { jobId: job.jobId, count: results.filter(r => r.success).length });
        } catch (error) {
            try { await transaction.rollback(); } catch (_) {}
            logger.error('Failed to save batch results', { jobId: job.jobId, error: error.message });
            throw error;
        }
    }

    async finalizeJob(job) {
        try {
            const pool = await getPool();
            await pool.request()
                .input('jobId', sql.VarChar, job.jobId)
                .input('sellerId', sql.VarChar, job.sellerId)
                .input('userId', sql.VarChar, job.userId)
                .input('status', sql.VarChar, job.status)
                .input('total', sql.Int, job.total)
                .input('processed', sql.Int, job.processed)
                .input('successful', sql.Int, job.successful)
                .input('failed', sql.Int, job.failed)
                .input('startTime', sql.DateTime2, job.startTime)
                .input('endTime', sql.DateTime2, job.endTime)
                .input('error', sql.NVarChar(sql.MAX), job.error || null)
                .query(`
                    INSERT INTO ScrapeJobHistory (JobId, SellerId, UserId, Status, TotalAsins, Processed, Successful, Failed, StartTime, EndTime, ErrorMessage, CreatedAt)
                    VALUES (@jobId, @sellerId, @userId, @status, @total, @processed, @successful, @failed, @startTime, @endTime, @error, dbo.GetEnvDate())
                `);

            if (job.userId) {
                socketService.emitToUser(job.userId, 'scrape_job_finished', {
                    jobId: job.jobId,
                    sellerId: job.sellerId,
                    status: job.status,
                    total: job.total,
                    processed: job.processed,
                    successful: job.successful,
                    failed: job.failed,
                    duration: job.endTime - job.startTime,
                });
            }
        } catch (error) {
            logger.error('Failed to finalize job', { jobId: job.jobId, error: error.message });
        }
    }

    emitProgress(jobId, job) {
        const progressData = {
            jobId,
            sellerId: job.sellerId,
            status: job.status,
            total: job.total,
            processed: job.processed,
            successful: job.successful,
            failed: job.failed,
            progress: job.progress,
            currentBatch: job.currentBatch,
            totalBatches: job.totalBatches,
            startTime: job.startTime,
            endTime: job.endTime,
        };

        if (job.userId) {
            socketService.emitToUser(job.userId, 'scrape_job_progress', progressData);
        }
        
        if (job.sellerId) {
            socketService.emitToRoom(`seller:${job.sellerId}`, 'scrape_job_progress', progressData);
        }
    }

    getJobStatus(jobId) {
        return this.activeJobs.get(jobId) || null;
    }

    getAllJobs() {
        return Array.from(this.activeJobs.values());
    }

    async cancelJob(jobId) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            job.status = 'cancelled';
            logger.info('Job cancelled', { jobId });
            return { success: true, message: 'Job cancellation requested' };
        }
        
        const queuedIndex = this.jobQueue.findIndex(j => j.jobId === jobId);
        if (queuedIndex !== -1) {
            this.jobQueue.splice(queuedIndex, 1);
            return { success: true, message: 'Queued job removed' };
        }

        return { success: false, message: 'Job not found' };
    }

    async retryFailedAsins(jobId) {
        const job = this.activeJobs.get(jobId);
        if (!job) return { success: false, message: 'Job not found' };

        const failedAsins = job.results
            .filter(r => !r.success)
            .map(r => r.asin)
            .concat(job.errors.map(e => e.asin).filter(Boolean));

        if (failedAsins.length === 0) {
            return { success: true, message: 'No failed ASINs to retry', count: 0 };
        }

        const uniqueFailedAsins = [...new Set(failedAsins)];
        job.asins = uniqueFailedAsins;
        job.total = uniqueFailedAsins.length;
        job.processed = 0;
        job.successful = 0;
        job.failed = 0;
        job.progress = 0;
        job.currentBatch = 0;
        job.totalBatches = Math.ceil(uniqueFailedAsins.length / this.batchSize);
        job.status = 'queued';
        job.results = [];
        job.errors = [];

        this.jobQueue.unshift(job);
        logger.info('Retrying failed ASINs', { jobId, count: uniqueFailedAsins.length });

        return { success: true, message: 'Retry queued', count: uniqueFailedAsins.length };
    }

    getStats() {
        return {
            ...this.stats,
            activeJobs: this.activeJobs.size,
            queuedJobs: this.jobQueue.length,
            uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0,
        };
    }

    async healthCheck() {
        const scraperHealth = await playwrightScraperService.healthCheck();
        return {
            runner: this.isProcessing ? 'processing' : 'idle',
            scraper: scraperHealth,
            stats: this.getStats(),
        };
    }
}

module.exports = new PlaywrightScraperRunner();