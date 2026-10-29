const { sql, getPool, generateId } = require('../database/db');

class LiveSyncTracker {
    constructor() {
        this.currentRunId = null;
        this.currentSellerDetails = new Map(); // sellerId -> detailId
    }

    /**
     * Start a new Live Sync run
     */
    async startRun(options = {}) {
        const {
            triggerType = 'CRON',
            totalSellers = 0,
            totalAsins = 0,
            createdBy = 'system',
            sellers = [] // [{ sellerId, sellerName, marketplace, asinCount }]
        } = options;

        const runId = generateId();
        this.currentRunId = runId;
        this.currentSellerDetails.clear();

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, runId)
            .input('status', sql.VarChar, 'STARTING')
            .input('triggerType', sql.VarChar, triggerType)
            .input('totalSellers', sql.Int, totalSellers)
            .input('totalAsins', sql.Int, totalAsins)
            .input('createdBy', sql.VarChar, createdBy)
            .input('detailsJson', sql.NVarChar(sql.MAX), JSON.stringify({
                sellers: sellers.map(s => ({
                    sellerId: s.sellerId,
                    sellerName: s.sellerName,
                    marketplace: s.marketplace,
                    asinCount: s.asinCount
                }))
            }))
            .query(`
                INSERT INTO LiveSyncRuns (Id, Status, TriggerType, TotalSellers, TotalAsins, CreatedBy, DetailsJson, CreatedAt, UpdatedAt)
                VALUES (@id, @status, @triggerType, @totalSellers, @totalAsins, @createdBy, @detailsJson, dbo.GetEnvDate(), dbo.GetEnvDate())
            `);

        // Create seller detail records
        for (const seller of sellers) {
            const detailId = generateId();
            this.currentSellerDetails.set(seller.sellerId, detailId);
            await pool.request()
                .input('id', sql.VarChar, detailId)
                .input('runId', sql.VarChar, runId)
                .input('sellerId', sql.VarChar, seller.sellerId)
                .input('sellerName', sql.NVarChar, seller.sellerName)
                .input('marketplace', sql.VarChar, seller.marketplace)
                .input('status', sql.VarChar, 'PENDING')
                .input('totalAsins', sql.Int, seller.asinCount || 0)
                .query(`
                    INSERT INTO LiveSyncSellerDetails (Id, RunId, SellerId, SellerName, Marketplace, Status, TotalAsins, CreatedAt, UpdatedAt)
                    VALUES (@id, @runId, @sellerId, @sellerName, @marketplace, @status, @totalAsins, dbo.GetEnvDate(), dbo.GetEnvDate())
                `);
        }

        return runId;
    }

    /**
     * Mark a seller as running
     */
    async startSeller(sellerId, attempt = 1, maxRetries = 2) {
        const detailId = this.currentSellerDetails.get(sellerId);
        if (!detailId) return;

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, detailId)
            .input('status', sql.VarChar, 'RUNNING')
            .input('attempt', sql.Int, attempt)
            .input('maxRetries', sql.Int, maxRetries)
            .input('startTime', sql.DateTime2, new Date())
            .query(`
                UPDATE LiveSyncSellerDetails 
                SET Status = @status, Attempt = @attempt, MaxRetries = @maxRetries, StartTime = @startTime, UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);
    }

    /**
     * Update seller progress with ASIN counts
     */
    async updateSellerProgress(sellerId, updates) {
        const detailId = this.currentSellerDetails.get(sellerId);
        if (!detailId) return;

        const pool = await getPool();
        const setParts = ['UpdatedAt = dbo.GetEnvDate()'];
        const request = pool.request().input('id', sql.VarChar, detailId);

        if (updates.updatedAsins !== undefined) {
            setParts.push('UpdatedAsins = @updatedAsins');
            request.input('updatedAsins', sql.Int, updates.updatedAsins);
        }
        if (updates.failedAsins !== undefined) {
            setParts.push('FailedAsins = @failedAsins');
            request.input('failedAsins', sql.Int, updates.failedAsins);
        }
        if (updates.skippedAsins !== undefined) {
            setParts.push('SkippedAsins = @skippedAsins');
            request.input('skippedAsins', sql.Int, updates.skippedAsins);
        }
        if (updates.asinsJson) {
            setParts.push('AsinsJson = @asinsJson');
            request.input('asinsJson', sql.NVarChar(sql.MAX), JSON.stringify(updates.asinsJson));
        }

        await request.query(`
            UPDATE LiveSyncSellerDetails 
            SET ${setParts.join(', ')}
            WHERE Id = @id
        `);
    }

    /**
     * Complete a seller (success or failure)
     */
    async completeSeller(sellerId, status, errorMessage = null) {
        const detailId = this.currentSellerDetails.get(sellerId);
        if (!detailId) return;

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, detailId)
            .input('status', sql.VarChar, status)
            .input('endTime', sql.DateTime2, new Date())
            .input('errorMessage', sql.NVarChar(sql.MAX), errorMessage)
            .query(`
                UPDATE LiveSyncSellerDetails 
                SET Status = @status, EndTime = @endTime, ErrorMessage = @errorMessage, UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);
    }

    /**
     * Complete the entire run
     */
    async completeRun(status, summary = {}) {
        if (!this.currentRunId) return;

        const {
            processedSellers = 0,
            successfulSellers = 0,
            failedSellers = 0,
            totalAsins = 0,
            updatedAsins = 0,
            failedAsins = 0,
            skippedAsins = 0,
            errorMessage = null
        } = summary;

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, this.currentRunId)
            .input('status', sql.VarChar, status)
            .input('endTime', sql.DateTime2, new Date())
            .input('processedSellers', sql.Int, processedSellers)
            .input('successfulSellers', sql.Int, successfulSellers)
            .input('failedSellers', sql.Int, failedSellers)
            .input('totalAsins', sql.Int, totalAsins)
            .input('updatedAsins', sql.Int, updatedAsins)
            .input('failedAsins', sql.Int, failedAsins)
            .input('skippedAsins', sql.Int, skippedAsins)
            .input('errorMessage', sql.NVarChar(sql.MAX), errorMessage)
            .query(`
                UPDATE LiveSyncRuns 
                SET Status = @status, EndTime = @endTime, 
                    ProcessedSellers = @processedSellers,
                    SuccessfulSellers = @successfulSellers,
                    FailedSellers = @failedSellers,
                    TotalAsins = @totalAsins,
                    UpdatedAsins = @updatedAsins,
                    FailedAsins = @failedAsins,
                    SkippedAsins = @skippedAsins,
                    ErrorMessage = @errorMessage,
                    UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);

        this.currentRunId = null;
        this.currentSellerDetails.clear();
    }

    /**
     * Get run details with sellers
     */
    static async getRun(runId) {
        const pool = await getPool();
        const runResult = await pool.request()
            .input('id', sql.VarChar, runId)
            .query('SELECT * FROM LiveSyncRuns WHERE Id = @id');
        
        if (!runResult.recordset[0]) return null;

        const sellersResult = await pool.request()
            .input('runId', sql.VarChar, runId)
            .query('SELECT * FROM LiveSyncSellerDetails WHERE RunId = @runId ORDER BY StartTime');

        return {
            ...runResult.recordset[0],
            sellers: sellersResult.recordset
        };
    }

    /**
     * Get recent runs
     */
    static async getRecentRuns(limit = 50) {
        const pool = await getPool();
        const result = await pool.request()
            .input('limit', sql.Int, limit)
            .query('SELECT TOP (@limit) * FROM LiveSyncRuns ORDER BY CreatedAt DESC');
        return result.recordset;
    }

    /**
     * Get runs for a specific seller
     */
    static async getSellerRuns(sellerId, limit = 20) {
        const pool = await getPool();
        const result = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT TOP (@limit) lsd.*, ls.RunDate, ls.StartTime as RunStartTime, ls.Status as RunStatus
                FROM LiveSyncSellerDetails lsd
                JOIN LiveSyncRuns ls ON ls.Id = lsd.RunId
                WHERE lsd.SellerId = @sellerId
                ORDER BY lsd.StartTime DESC
            `);
        return result.recordset;
    }
}

class ScraperTracker {
    constructor() {
        this.currentRunId = null;
        this.currentSellerDetails = new Map(); // sellerId -> detailId
        this.currentJobDetails = new Map(); // jobId -> jobDetailId
    }

    /**
     * Start a new Scraper run
     */
    async startRun(options = {}) {
        const {
            triggerType = 'CRON',
            marketplace = 'amazon.in',
            totalSellers = 0,
            createdBy = 'system',
            sellers = [] // [{ sellerId, sellerName, marketplace }]
        } = options;

        const runId = generateId();
        this.currentRunId = runId;
        this.currentSellerDetails.clear();
        this.currentJobDetails.clear();

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, runId)
            .input('status', sql.VarChar, 'STARTING')
            .input('triggerType', sql.VarChar, triggerType)
            .input('marketplace', sql.VarChar, marketplace)
            .input('totalSellers', sql.Int, totalSellers)
            .input('createdBy', sql.VarChar, createdBy)
            .input('detailsJson', sql.NVarChar(sql.MAX), JSON.stringify({
                sellers: sellers.map(s => ({
                    sellerId: s.sellerId,
                    sellerName: s.sellerName,
                    marketplace: s.marketplace
                }))
            }))
            .query(`
                INSERT INTO ScraperRuns (Id, Status, TriggerType, Marketplace, TotalSellers, CreatedBy, DetailsJson, CreatedAt, UpdatedAt)
                VALUES (@id, @status, @triggerType, @marketplace, @totalSellers, @createdBy, @detailsJson, dbo.GetEnvDate(), dbo.GetEnvDate())
            `);

        // Create seller detail records
        for (const seller of sellers) {
            const detailId = generateId();
            this.currentSellerDetails.set(seller.sellerId, detailId);
            await pool.request()
                .input('id', sql.VarChar, detailId)
                .input('runId', sql.VarChar, runId)
                .input('sellerId', sql.VarChar, seller.sellerId)
                .input('sellerName', sql.NVarChar, seller.sellerName)
                .input('marketplace', sql.VarChar, seller.marketplace)
                .input('status', sql.VarChar, 'PENDING')
                .query(`
                    INSERT INTO ScraperSellerDetails (Id, RunId, SellerId, SellerName, Marketplace, Status, CreatedAt, UpdatedAt)
                    VALUES (@id, @runId, @sellerId, @sellerName, @marketplace, @status, dbo.GetEnvDate(), dbo.GetEnvDate())
                `);
        }

        return runId;
    }

    /**
     * Mark a seller as running
     */
    async startSeller(sellerId, attempt = 1, maxAttempts = 3) {
        const detailId = this.currentSellerDetails.get(sellerId);
        if (!detailId) return;

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, detailId)
            .input('status', sql.VarChar, 'RUNNING')
            .input('attempt', sql.Int, attempt)
            .input('maxAttempts', sql.Int, maxAttempts)
            .input('startTime', sql.DateTime2, new Date())
            .query(`
                UPDATE ScraperSellerDetails 
                SET Status = @status, Attempt = @attempt, MaxAttempts = @maxAttempts, StartTime = @startTime, UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);
    }

    /**
     * Update seller progress
     */
    async updateSellerProgress(sellerId, updates) {
        const detailId = this.currentSellerDetails.get(sellerId);
        if (!detailId) return;

        const pool = await getPool();
        const setParts = ['UpdatedAt = dbo.GetEnvDate()'];
        const request = pool.request().input('id', sql.VarChar, detailId);

        if (updates.scrapedAsins !== undefined) {
            setParts.push('ScrapedAsins = @scrapedAsins');
            request.input('scrapedAsins', sql.Int, updates.scrapedAsins);
        }
        if (updates.failedAsins !== undefined) {
            setParts.push('FailedAsins = @failedAsins');
            request.input('failedAsins', sql.Int, updates.failedAsins);
        }
        if (updates.completeAsins !== undefined) {
            setParts.push('CompleteAsins = @completeAsins');
            request.input('completeAsins', sql.Int, updates.completeAsins);
        }
        if (updates.incompleteAsins !== undefined) {
            setParts.push('IncompleteAsins = @incompleteAsins');
            request.input('incompleteAsins', sql.Int, updates.incompleteAsins);
        }
        if (updates.totalAsins !== undefined) {
            setParts.push('TotalAsins = @totalAsins');
            request.input('totalAsins', sql.Int, updates.totalAsins);
        }
        if (updates.jobsCount !== undefined) {
            setParts.push('JobsCount = @jobsCount');
            request.input('jobsCount', sql.Int, updates.jobsCount);
        }
        if (updates.missingFieldsJson) {
            setParts.push('MissingFieldsJson = @missingFieldsJson');
            request.input('missingFieldsJson', sql.NVarChar(sql.MAX), JSON.stringify(updates.missingFieldsJson));
        }
        if (updates.asinsJson) {
            setParts.push('AsinsJson = @asinsJson');
            request.input('asinsJson', sql.NVarChar(sql.MAX), JSON.stringify(updates.asinsJson));
        }

        await request.query(`
            UPDATE ScraperSellerDetails 
            SET ${setParts.join(', ')}
            WHERE Id = @id
        `);
    }

    /**
     * Start a scraper job
     */
    async startJob(sellerId, jobId, asinsRequested) {
        const sellerDetailId = this.currentSellerDetails.get(sellerId);
        if (!sellerDetailId) return;

        const jobDetailId = generateId();
        this.currentJobDetails.set(jobId, jobDetailId);

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, jobDetailId)
            .input('runId', sql.VarChar, this.currentRunId)
            .input('sellerDetailId', sql.VarChar, sellerDetailId)
            .input('sellerId', sql.VarChar, sellerId)
            .input('jobId', sql.VarChar, jobId)
            .input('status', sql.VarChar, 'QUEUED')
            .input('asinsRequested', sql.Int, asinsRequested)
            .input('startTime', sql.DateTime2, new Date())
            .query(`
                INSERT INTO ScraperJobs (Id, RunId, SellerDetailId, SellerId, JobId, Status, AsinsRequested, StartTime, CreatedAt, UpdatedAt)
                VALUES (@id, @runId, @sellerDetailId, @sellerId, @jobId, @status, @asinsRequested, @startTime, dbo.GetEnvDate(), dbo.GetEnvDate())
            `);
    }

    /**
     * Update job status
     */
    async updateJob(jobId, updates) {
        const jobDetailId = this.currentJobDetails.get(jobId);
        if (!jobDetailId) return;

        const pool = await getPool();
        const setParts = ['UpdatedAt = dbo.GetEnvDate()'];
        const request = pool.request().input('id', sql.VarChar, jobDetailId);

        if (updates.status) {
            setParts.push('Status = @status');
            request.input('status', sql.VarChar, updates.status);
            if (updates.status === 'RUNNING' && !updates.startTime) {
                setParts.push('StartTime = @startTime');
                request.input('startTime', sql.DateTime2, new Date());
            }
            if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(updates.status)) {
                setParts.push('EndTime = @endTime');
                request.input('endTime', sql.DateTime2, new Date());
            }
        }
        if (updates.asinsCompleted !== undefined) {
            setParts.push('AsinsCompleted = @asinsCompleted');
            request.input('asinsCompleted', sql.Int, updates.asinsCompleted);
        }
        if (updates.asinsFailed !== undefined) {
            setParts.push('AsinsFailed = @asinsFailed');
            request.input('asinsFailed', sql.Int, updates.asinsFailed);
        }
        if (updates.errorMessage) {
            setParts.push('ErrorMessage = @errorMessage');
            request.input('errorMessage', sql.NVarChar(sql.MAX), updates.errorMessage);
        }

        await request.query(`
            UPDATE ScraperJobs 
            SET ${setParts.join(', ')}
            WHERE Id = @id
        `);
    }

    /**
     * Complete a seller
     */
    async completeSeller(sellerId, status, errorMessage = null) {
        const detailId = this.currentSellerDetails.get(sellerId);
        if (!detailId) return;

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, detailId)
            .input('status', sql.VarChar, status)
            .input('endTime', sql.DateTime2, new Date())
            .input('errorMessage', sql.NVarChar(sql.MAX), errorMessage)
            .query(`
                UPDATE ScraperSellerDetails 
                SET Status = @status, EndTime = @endTime, ErrorMessage = @errorMessage, UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);
    }

    /**
     * Complete the entire run
     */
    async completeRun(status, summary = {}) {
        if (!this.currentRunId) return;

        const {
            processedSellers = 0,
            completeSellers = 0,
            incompleteSellers = 0,
            totalJobs = 0,
            totalAsinsScraped = 0,
            errorMessage = null
        } = summary;

        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, this.currentRunId)
            .input('status', sql.VarChar, status)
            .input('endTime', sql.DateTime2, new Date())
            .input('processedSellers', sql.Int, processedSellers)
            .input('completeSellers', sql.Int, completeSellers)
            .input('incompleteSellers', sql.Int, incompleteSellers)
            .input('totalJobs', sql.Int, totalJobs)
            .input('totalAsinsScraped', sql.Int, totalAsinsScraped)
            .input('errorMessage', sql.NVarChar(sql.MAX), errorMessage)
            .query(`
                UPDATE ScraperRuns 
                SET Status = @status, EndTime = @endTime, 
                    ProcessedSellers = @processedSellers,
                    CompleteSellers = @completeSellers,
                    IncompleteSellers = @incompleteSellers,
                    TotalJobs = @totalJobs,
                    TotalAsinsScraped = @totalAsinsScraped,
                    ErrorMessage = @errorMessage,
                    UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);

        this.currentRunId = null;
        this.currentSellerDetails.clear();
        this.currentJobDetails.clear();
    }

    /**
     * Get run details with sellers and jobs
     */
    static async getRun(runId) {
        const pool = await getPool();
        const runResult = await pool.request()
            .input('id', sql.VarChar, runId)
            .query('SELECT * FROM ScraperRuns WHERE Id = @id');
        
        if (!runResult.recordset[0]) return null;

        const sellersResult = await pool.request()
            .input('runId', sql.VarChar, runId)
            .query('SELECT * FROM ScraperSellerDetails WHERE RunId = @runId ORDER BY StartTime');

        const run = runResult.recordset[0];
        run.sellers = sellersResult.recordset;

        // Get jobs for each seller
        for (const seller of run.sellers) {
            const jobsResult = await pool.request()
                .input('sellerDetailId', sql.VarChar, seller.Id)
                .query('SELECT * FROM ScraperJobs WHERE SellerDetailId = @sellerDetailId ORDER BY StartTime');
            seller.jobs = jobsResult.recordset;
        }

        return run;
    }

    /**
     * Get recent runs
     */
    static async getRecentRuns(limit = 50, marketplace = null) {
        const pool = await getPool();
        let query = 'SELECT TOP (@limit) * FROM ScraperRuns';
        const request = pool.request().input('limit', sql.Int, limit);
        
        if (marketplace) {
            query += ' WHERE Marketplace = @marketplace';
            request.input('marketplace', sql.VarChar, marketplace);
        }
        query += ' ORDER BY CreatedAt DESC';
        
        const result = await request.query(query);
        return result.recordset;
    }

    /**
     * Get runs for a specific seller
     */
    static async getSellerRuns(sellerId, limit = 20) {
        const pool = await getPool();
        const result = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT TOP (@limit) ssd.*, sr.RunDate, sr.StartTime as RunStartTime, sr.Status as RunStatus, sr.Marketplace
                FROM ScraperSellerDetails ssd
                JOIN ScraperRuns sr ON sr.Id = ssd.RunId
                WHERE ssd.SellerId = @sellerId
                ORDER BY ssd.StartTime DESC
            `);
        return result.recordset;
    }
}

module.exports = {
    LiveSyncTracker: new LiveSyncTracker(),
    ScraperTracker: new ScraperTracker(),
    LiveSyncTrackerClass: LiveSyncTracker,
    ScraperTrackerClass: ScraperTracker
};