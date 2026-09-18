const { sql, getPool, generateId } = require('../database/db');
const playwrightScraperService = require('./playwrightScraperService');
const socketService = require('./socketService');

/**
 * Orchestrates Playwright scraping jobs:
 *  - tracks active/in-memory job state
 *  - persists ScrapeJobHistory + ScrapeJobDetails + AsinScrapeData snapshots
 *  - updates the Asins row with fresh metrics + ScrapeStatus/LastScrapeStatus
 *  - streams progress over Socket.IO (per-user rooms)
 */
class PlaywrightScraperRunner {
    constructor() {
        this.activeJobs = new Map(); // jobId -> live job state
        this.concurrency = parseInt(process.env.SCRAPER_MAX_CONCURRENT_ASINS || '5', 10);
        this.batchSize = parseInt(process.env.SCRAPER_BATCH_SIZE || '30', 10);
        this.batchDelay = parseInt(process.env.SCRAPER_BATCH_DELAY || '3000', 10);
        this.interBatchDelay = parseInt(process.env.SCRAPER_INTER_BATCH_DELAY || '8000', 10);
        this.interChunkDelay = parseInt(process.env.SCRAPER_INTER_CHUNK_DELAY || '2000', 10);
    }

    /**
     * Fetch ASINs to scrape for a seller (all active + missing-data ones).
     */
    async getSellerAsins(sellerId, { onlyMissing = false } = {}) {
        const pool = await getPool();
        const request = pool.request().input('sellerId', sql.VarChar, sellerId);

        let where = "SellerId = @sellerId AND Status != 'Paused'";
        if (onlyMissing) {
            where += ` AND (
                Title IS NULL OR Title = '' OR Title LIKE '%Amazon Product%' OR
                CurrentPrice = 0 OR BSR = 0 OR Rating IS NULL
            )`;
        }

        const result = await request.query(`
            SELECT Id, AsinCode, SellerId, Title, CurrentPrice, BSR, Rating, ReviewCount, LastScrapedAt
            FROM Asins WHERE ${where}
        `);
        return result.recordset;
    }

    /**
     * Start a fresh scraping job. Non-blocking; returns the job id.
     */
    async startJob({ sellerId, asins, userId, jobType = 'SCRAPE', targetType = 'SELLER' }) {
        const pool = await getPool();
        const running = await pool.request()
            .input('targetType', sql.VarChar, targetType)
            .input('targetId', sql.VarChar, sellerId || '')
            .query(`
                SELECT TOP 1 Id FROM ScrapeJobHistory
                WHERE TargetType = @targetType AND TargetId = @targetId
                  AND Status IN ('QUEUED', 'RUNNING')
                  AND CreatedAt > DATEADD(hour, -6, dbo.GetEnvDate())
            `);

        if (running.recordset.length > 0) {
            const existing = running.recordset[0].Id;
            const inMemory = this.activeJobs.get(existing);
            if (inMemory) return { jobId: existing, resumed: true };
            const fresh = await pool.request()
                .input('id', sql.VarChar, existing)
                .query(`SELECT * FROM ScrapeJobHistory WHERE Id = @id`);
            return { jobId: existing, resumed: true, status: fresh.recordset[0]?.Status || 'ACTIVE' };
        }

        const jobId = generateId();
        const jobState = {
            jobId,
            jobType,
            targetType,
            targetId: sellerId || null,
            userId: userId || null,
            total: asins.length,
            queued: asins.length,
            completed: 0,
            failed: 0,
            skipped: 0,
            status: 'QUEUED',
            startedAt: null,
            finishedAt: null,
            error: null,
            cancelRequested: false,
        };

        await pool.request()
            .input('id', sql.VarChar, jobId)
            .input('jobType', sql.VarChar, jobType)
            .input('targetType', sql.VarChar, targetType)
            .input('targetId', sql.VarChar, sellerId || null)
            .input('initiatedBy', sql.VarChar, userId || null)
            .input('total', sql.Int, asins.length)
            .query(`
                INSERT INTO ScrapeJobHistory (Id, JobType, Status, TargetType, TargetId, InitiatedBy, TotalAsins, CreatedAt, UpdatedAt)
                VALUES (@id, @jobType, 'QUEUED', @targetType, @targetId, @initiatedBy, @total, dbo.GetEnvDate(), dbo.GetEnvDate())
            `);

        // Persist detail rows
        for (const a of asins) {
            await pool.request()
                .input('id', sql.VarChar, generateId())
                .input('jobId', sql.VarChar, jobId)
                .input('asinId', sql.VarChar, a.Id)
                .input('asinCode', sql.VarChar, a.AsinCode)
                .query(`
                    INSERT INTO ScrapeJobDetails (Id, JobId, AsinId, AsinCode, Status, Attempts, CreatedAt, UpdatedAt)
                    VALUES (@id, @jobId, @asinId, @asinCode, 'PENDING', 0, dbo.GetEnvDate(), dbo.GetEnvDate())
                `);
        }

        this.activeJobs.set(jobId, jobState);

        // Fire-and-forget execution
        this._run(jobState, asins).catch(async (err) => {
            jobState.status = 'FAILED';
            jobState.error = err.message;
            await this._persistJobState(jobState);
            this._emitFinished(jobState);
            this.activeJobs.delete(jobId);
        });

        return { jobId, total: asins.length };
    }

    /**
     * Requeue failed ASINs from a previous job as a new job.
     */
    async retryJob(prevJobId, userId) {
        const pool = await getPool();
        const job = await pool.request()
            .input('id', sql.VarChar, prevJobId)
            .query(`SELECT * FROM ScrapeJobHistory WHERE Id = @id`);

        if (!job.recordset.length) throw new Error('Job not found');

        const details = await pool.request()
            .input('jobId', sql.VarChar, prevJobId)
            .query(`
                SELECT d.AsinId, d.AsinCode
                FROM ScrapeJobDetails d
                WHERE d.JobId = @jobId AND d.Status = 'FAILED'
            `);

        if (!details.recordset.length) return { message: 'No failed ASINs to retry', count: 0 };

        const asins = details.recordset.map(r => ({ Id: r.AsinId, AsinCode: r.AsinCode }));
        return this.startJob({
            sellerId: job.recordset[0].TargetId,
            asins,
            userId,
            jobType: 'RETRY',
            targetType: job.recordset[0].TargetType,
        });
    }

    async cancelJob(jobId) {
        const job = this.activeJobs.get(jobId);
        if (!job) {
            const pool = await getPool();
            await pool.request()
                .input('id', sql.VarChar, jobId)
                .query(`
                    UPDATE ScrapeJobHistory SET Status = 'CANCELLED'
                    WHERE Id = @id AND Status IN ('QUEUED', 'RUNNING')
                `);
            return { jobId, cancelled: true };
        }
        job.cancelRequested = true;
        return { jobId, cancelled: true };
    }

    async getJob(jobId) {
        const memory = this.activeJobs.get(jobId);
        if (memory) return memory;

        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.VarChar, jobId)
            .query(`SELECT * FROM ScrapeJobHistory WHERE Id = @id`);
        return result.recordset[0] || null;
    }

    async getJobs({ limit = 20, status } = {}) {
        const pool = await getPool();
        const request = pool.request().input('limit', sql.Int, limit);
        let where = '';
        if (status) {
            request.input('status', sql.VarChar, status);
            where = 'WHERE Status = @status';
        }
        const result = await request.query(`
            SELECT TOP (@limit) * FROM ScrapeJobHistory
            ${where}
            ORDER BY CreatedAt DESC
        `);
        return result.recordset;
    }

    async getJobDetails(jobId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('jobId', sql.VarChar, jobId)
            .query(`SELECT * FROM ScrapeJobDetails WHERE JobId = @jobId ORDER BY CreatedAt`);
        return result.recordset;
    }

    async getStats() {
        const pool = await getPool();

        const [totalJobs, totalScraped, totalFailed, lastJob, asinsScraped] = await Promise.all([
            pool.request().query(`SELECT COUNT(*) AS c FROM ScrapeJobHistory`),
            pool.request().query(`SELECT ISNULL(SUM(CompletedAsins), 0) AS c FROM ScrapeJobHistory`),
            pool.request().query(`SELECT ISNULL(SUM(FailedAsins), 0) AS c FROM ScrapeJobHistory`),
            pool.request().query(`SELECT TOP 1 * FROM ScrapeJobHistory ORDER BY CreatedAt DESC`),
            pool.request().query(`
                SELECT COUNT(*) AS c FROM Asins
                WHERE ScrapeStatus = 'COMPLETED' OR LastScrapeStatus = 'COMPLETED'
            `),
        ]);

        return {
            totalJobs: totalJobs.recordset[0].c,
            totalScraped: totalScraped.recordset[0].c,
            totalFailed: totalFailed.recordset[0].c,
            asinsScraped: asinsScraped.recordset[0].c,
            lastJob: lastJob.recordset[0] || null,
            activeJobs: this.activeJobs.size,
            running: Array.from(this.activeJobs.values()).filter(j => j.status === 'RUNNING').length,
        };
    }

    async getSellerSummary() {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT TOP 10
                s.Id,
                s.Name,
                COUNT(ai.Id) as TotalAsins,
                SUM(CASE WHEN ai.ScrapeStatus = 'COMPLETED' OR ai.LastScrapeStatus = 'COMPLETED' THEN 1 ELSE 0 END) as ScrapedCount,
                MAX(ai.LastScrapedAt) as LastScrapedAt
            FROM Sellers s
            LEFT JOIN Asins ai ON ai.SellerId = s.Id
            GROUP BY s.Id, s.Name
            ORDER BY LastScrapedAt DESC
        `);
        return result.recordset.map(r => ({
            sellerId: r.Id,
            sellerName: r.Name,
            totalAsins: r.TotalAsins || 0,
            scrapedCount: r.ScrapedCount || 0,
            lastScrapedAt: r.LastScrapedAt || null,
        }));
    }

    /**
     * Main execution loop: batch → concurrent within batch → persist → progress.
     */
    async _run(job, asins) {
        const pool = await getPool();
        job.status = 'RUNNING';
        job.startedAt = new Date();
        await pool.request()
            .input('id', sql.VarChar, job.jobId)
            .query(`UPDATE ScrapeJobHistory SET Status = 'RUNNING', StartedAt = dbo.GetEnvDate(), UpdatedAt = dbo.GetEnvDate() WHERE Id = @id`);

        this._emit(job.jobId, 'scraper_job_started', this._publicJob(job));

        for (let b = 0; b < asins.length && !job.cancelRequested; b += this.batchSize) {
            const batch = asins.slice(b, b + this.batchSize);

            for (let i = 0; i < batch.length && !job.cancelRequested; i += this.concurrency) {
                const chunk = batch.slice(i, i + this.concurrency);
                await Promise.all(chunk.map(asinRow => this._scrapeOne(job, asinRow)));
                if (job.cancelRequested) break;
                if (this.interChunkDelay) await new Promise(r => setTimeout(r, this.interChunkDelay));
            }

            if (job.cancelRequested) break;
            if (this.interBatchDelay && b + this.batchSize < asins.length) {
                await new Promise(r => setTimeout(r, this.interBatchDelay));
            }
        }

        job.status = job.cancelRequested ? 'CANCELLED' : 'COMPLETED';
        job.finishedAt = new Date();
        if (job.cancelRequested) job.error = 'Cancelled by user';

        await this._persistJobState(job);
        this._emitFinished(job);
        this.activeJobs.delete(job.jobId);

        // Friendly process teardown of the browser when idle
        if (this.activeJobs.size === 0) {
            setTimeout(() => playwrightScraperService.close().catch(() => {}), 60000);
        }
    }

    /**
     * Scrape one ASIN, update Asins + snapshot + job counters.
     */
    async _scrapeOne(job, asinRow) {
        try {
            const data = await playwrightScraperService.scrapeAsin(asinRow.AsinCode);

            if (!data || !data.title) {
                throw new Error('Empty scrape result');
            }

            // Track success for dynamic concurrency and circuit breaker
            playwrightScraperService.trackAsinSuccess(asinRow.AsinCode);

            const pool = await getPool();
            await pool.request()
                .input('id', sql.VarChar, asinRow.Id)
                .input('rating', sql.Decimal(3, 2), data.rating ?? null)
                .input('reviewCount', sql.Int, data.reviewCount ?? null)
                .input('hasAplus', sql.Bit, data.hasAplus ? 1 : 0)
                .query(`
                    UPDATE Asins SET
                        Rating = ISNULL(@rating, Rating),
                        ReviewCount = ISNULL(@reviewCount, ReviewCount),
                        HasAplus = @hasAplus,
                        ScrapeStatus = 'COMPLETED',
                        LastScrapeStatus = 'COMPLETED',
                        LastScrapedAt = dbo.GetEnvDate(),
                        LastSyncSource = 'SCRAPER',
                        UpdatedAt = dbo.GetEnvDate()
                    WHERE Id = @id
                `);

            await pool.request()
                .input('id', sql.VarChar, generateId())
                .input('jobId', sql.VarChar, job.jobId)
                .input('asinId', sql.VarChar, asinRow.Id)
                .input('asinCode', sql.VarChar, asinRow.AsinCode)
                .input('scrapedAt', sql.DateTime, new Date())
                .query(`
                    UPDATE ScrapeJobDetails SET
                        Status = 'COMPLETED',
                        ScrapedAt = @scrapedAt,
                        UpdatedAt = dbo.GetEnvDate()
                    WHERE JobId = @jobId AND AsinId = @asinId
                `);

            job.completed++;
            job.queued = Math.max(0, job.queued - 1);
        } catch (err) {
            // Track failure for circuit breaker
            playwrightScraperService.trackAsinFailure(asinRow.AsinCode);

            const isCaptcha = /CAPTCHA/i.test(err.message || '');
            job.failed++;
            job.queued = Math.max(0, job.queued - 1);

            const pool = await getPool();
            await pool.request()
                .input('jobId', sql.VarChar, job.jobId)
                .input('asinId', sql.VarChar, asinRow.Id)
                .input('error', sql.NVarChar(sql.MAX), `${err.message || 'Unknown error'}${isCaptcha ? ' [CAPTCHA]' : ''}`)
                .query(`
                    UPDATE ScrapeJobDetails SET
                        Status = 'FAILED',
                        Error = @error,
                        UpdatedAt = dbo.GetEnvDate()
                    WHERE JobId = @jobId AND AsinId = @asinId
                `);

            const pool2 = await getPool();
            await pool2.request()
                .input('id', sql.VarChar, asinRow.Id)
                .input('error', sql.NVarChar(sql.MAX), `${err.message || 'Unknown error'}${isCaptcha ? ' [CAPTCHA]' : ''}`)
                .query(`
                    UPDATE Asins SET
                        ScrapeStatus = 'FAILED',
                        LastScrapeStatus = 'FAILED',
                        LastScrapeError = @error,
                        LastScrapedAt = dbo.GetEnvDate(),
                        UpdatedAt = dbo.GetEnvDate()
                    WHERE Id = @id
                `);
        }

        this._emit(job.jobId, 'scraper_progress', this._publicJob(job));
    }

    async _persistJobState(job) {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, job.jobId)
            .input('status', sql.VarChar, job.status)
            .input('completed', sql.Int, job.completed)
            .input('failed', sql.Int, job.failed)
            .input('error', sql.NVarChar(sql.MAX), job.error || null)
            .input('finishedAt', sql.DateTime, job.finishedAt || null)
            .query(`
                UPDATE ScrapeJobHistory SET
                    Status = @status,
                    CompletedAsins = @completed,
                    FailedAsins = @failed,
                    Error = @error,
                    FinishedAt = @finishedAt,
                    UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);
    }

    _publicJob(job) {
        return {
            jobId: job.jobId,
            jobType: job.jobType,
            targetType: job.targetType,
            targetId: job.targetId,
            total: job.total,
            queued: job.queued,
            completed: job.completed,
            failed: job.failed,
            skipped: job.skipped,
            status: job.status,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            error: job.error,
            percentage: job.total ? Math.round(((job.completed + job.failed) / job.total) * 100) : 0,
        };
    }

    _emit(jobId, event, payload) {
        // Broadcast to everyone watching the scraper room
        if (socketService.getIo()) {
            socketService.getIo().emit(`scraper:${event}`, payload);
            socketService.getIo().emit('scraper:event', { event, data: payload });
        }
    }

    _emitFinished(job) {
        const pub = this._publicJob(job);
        this._emit(job.jobId, 'scraper_job_finished', pub);
        if (job.userId) {
            socketService.emitToUser(job.userId, 'scraper_job_finished', pub);
        }
    }
}

module.exports = new PlaywrightScraperRunner();