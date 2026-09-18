const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../database/db');
const playwrightScraperService = require('../services/playwrightScraperService');
const scraperRunner = require('../services/playwrightScraperRunner');
const { authenticate, requirePermission, checkSellerAccess } = require('../middleware/auth');

/**
 * In-house Playwright scraper endpoints (replaces Octoparse).
 * Mounted at /api/scraper
 */

// Health check — verifies Playwright loads
router.get('/health', async (req, res) => {
    try {
        const browser = await playwrightScraperService.getBrowser();
        const version = browser.version();
        res.json({
            success: true,
            ready: true,
            browserVersion: version,
            headless: playwrightScraperService.headless,
        });
    } catch (err) {
        res.status(500).json({ success: false, ready: false, error: err.message });
    }
});

// Test scrape a single ASIN
router.post('/test', authenticate, requirePermission('scraping_manage'), async (req, res) => {
    try {
        const { asin } = req.body;
        if (!asin) return res.status(400).json({ success: false, error: 'ASIN is required' });

        const data = await playwrightScraperService.scrapeAsin(asin);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start a scrape job for a seller's ASINs (Playwright batch -> DB)
router.post('/scrape/start', authenticate, requirePermission('scraping_manage'), checkSellerAccess, async (req, res) => {
    try {
        const { sellerId, asinIds = [], onlyMissing = false } = req.body;
        if (!sellerId) return res.status(400).json({ success: false, error: 'sellerId is required' });

        let asins = [];
        if (asinIds && asinIds.length) {
            const pool = await getPool();
            const chunks = [];
            for (let i = 0; i < asinIds.length; i += 30) {
                chunks.push(asinIds.slice(i, i + 30));
            }
            for (const chunk of chunks) {
                const placeholders = chunk.map((_, i) => `@id${i}`).join(',');
                const request = pool.request();
                chunk.forEach((id, i) => request.input(`id${i}`, sql.VarChar, id));
                const resQuery = await request.query(`SELECT Id, AsinCode, SellerId FROM Asins WHERE Id IN (${placeholders})`);
                asins = asins.concat(resQuery.recordset);
            }
        } else {
            asins = await scraperRunner.getSellerAsins(sellerId, { onlyMissing });
        }

        if (!asins.length) {
            return res.status(200).json({ success: true, message: 'No ASINs to scrape', total: 0 });
        }

        const result = await scraperRunner.startJob({
            sellerId,
            asins,
            userId: req.user.Id || req.user._id,
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start scraping all selected ASINs (global)
router.post('/scrape/start-bulk', authenticate, requirePermission('scraping_manage'), async (req, res) => {
    try {
        const { asinIds = [] } = req.body;
        if (!asinIds.length) return res.status(400).json({ success: false, error: 'asinIds are required' });

        const pool = await getPool();
        const asins = [];
        for (let i = 0; i < asinIds.length; i += 30) {
            const chunk = asinIds.slice(i, i + 30);
            const placeholders = chunk.map((_, idx) => `@id${idx}`).join(',');
            const request = pool.request();
            chunk.forEach((id, idx) => request.input(`id${idx}`, sql.VarChar, id));
            const resQuery = await request.query(`SELECT Id, AsinCode, SellerId FROM Asins WHERE Id IN (${placeholders})`);
            asins.push(...resQuery.recordset);
        }

        const result = await scraperRunner.startJob({
            asins,
            userId: req.user.Id || req.user._id,
            jobType: 'SCRAPE',
            targetType: 'BULK',
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get status of a job
router.get('/scrape/status/:jobId', authenticate, requirePermission('scraping_view'), async (req, res) => {
    try {
        const job = await scraperRunner.getJob(req.params.jobId);
        if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Cancel a job
router.post('/scrape/cancel/:jobId', authenticate, requirePermission('scraping_manage'), async (req, res) => {
    try {
        const result = await scraperRunner.cancelJob(req.params.jobId);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Retry failed ASINs of a job
router.post('/scrape/retry/:jobId', authenticate, requirePermission('scraping_manage'), async (req, res) => {
    try {
        const result = await scraperRunner.retryJob(req.params.jobId, req.user.Id || req.user._id);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Job history list
router.get('/jobs', authenticate, requirePermission('scraping_view'), async (req, res) => {
    try {
        const { limit = 20, status } = req.query;
        const jobs = await scraperRunner.getJobs({ limit: parseInt(limit, 10) || 20, status });
        res.json({ success: true, jobs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Job detail rows (per-ASIN)
router.get('/jobs/:jobId/details', authenticate, requirePermission('scraping_view'), async (req, res) => {
    try {
        const details = await scraperRunner.getJobDetails(req.params.jobId);
        res.json({ success: true, details });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Overall stats
router.get('/stats', authenticate, requirePermission('scraping_view'), async (req, res) => {
    try {
        const stats = await scraperRunner.getStats();
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Seller scrape summary
router.get('/sellers/summary', authenticate, requirePermission('scraping_view'), async (req, res) => {
    try {
        const summary = await scraperRunner.getSellerSummary();
        res.json({ success: true, sellers: summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Replace the Octoparse "Sync Seller" button: scrape + ingest in one hit
router.post('/sync-seller/:sellerId', authenticate, requirePermission('scraping_manage'), checkSellerAccess, async (req, res) => {
    try {
        const { asinIds = [], onlyMissing = false } = req.body || {};
        let asins = [];
        if (asinIds && asinIds.length) {
            const pool = await getPool();
            for (let i = 0; i < asinIds.length; i += 30) {
                const chunk = asinIds.slice(i, i + 30);
                const placeholders = chunk.map((_, idx) => `@id${idx}`).join(',');
                const request = pool.request();
                chunk.forEach((id, idx) => request.input(`id${idx}`, sql.VarChar, id));
                const resQuery = await request.query(`SELECT Id, AsinCode, SellerId FROM Asins WHERE Id IN (${placeholders}) AND SellerId = @sellerId`);
                asins = asins.concat(resQuery.recordset);
            }
        } else {
            asins = await scraperRunner.getSellerAsins(req.params.sellerId, { onlyMissing });
        }

        if (!asins.length) {
            return res.status(200).json({ success: true, message: 'No ASINs to sync for this seller', total: 0 });
        }

        const result = await scraperRunner.startJob({
            sellerId: req.params.sellerId,
            asins,
            userId: req.user.Id || req.user._id,
        });

        res.json({ success: true, message: 'Playwright scrape started', ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sync status for a seller (scraper-based progress)
router.get('/sync-status/:sellerId', authenticate, requirePermission('scraping_view'), checkSellerAccess, async (req, res) => {
    try {
        const pool = await getPool();
        const sellerId = req.params.sellerId;
        const [seller, lastJob, syncRows] = await Promise.all([
            pool.request().input('id', sql.VarChar, sellerId)
                .query(`
                    SELECT Id, Name, Marketplace, LastSyncAt as LastOctoparseSyncAt
                    FROM Sellers WHERE Id = @id
                `),
            pool.request().input('sellerId', sql.VarChar, sellerId)
                .query(`
                    SELECT TOP 1 * FROM ScrapeJobHistory
                    WHERE TargetId = @sellerId OR TargetType = 'BULK'
                    ORDER BY CreatedAt DESC
                `),
            pool.request().input('sellerId', sql.VarChar, sellerId)
                .query(`
                    SELECT
                        COUNT(*) as TotalAsins,
                        SUM(CASE WHEN LastSyncSource = 'SCRAPER' THEN 1 ELSE 0 END) as scraperSynced,
                        SUM(CASE WHEN LastSyncSource = 'LIVE' THEN 1 ELSE 0 END) as liveSynced,
                        SUM(CASE WHEN LastSyncSource = 'OCTOPARSE' THEN 1 ELSE 0 END) as octoparseSynced,
                        SUM(CASE WHEN ScrapeStatus = 'COMPLETED' THEN 1 ELSE 0 END) as scrapedOk,
                        SUM(CASE WHEN ScrapeStatus = 'FAILED' THEN 1 ELSE 0 END) as scrapedFailed,
                        MAX(LastScrapedAt) as lastScrapedAt
                    FROM Asins WHERE SellerId = @sellerId
                `),
        ]);

        const countRow = syncRows.recordset[0] || {};
        res.json({
            success: true,
            seller: seller.recordset[0] || null,
            lastJob: lastJob.recordset[0] || null,
            summary: {
                totalAsins: countRow.TotalAsins || 0,
                scraperSynced: countRow.scraperSynced || 0,
                liveSynced: countRow.liveSynced || 0,
                octoparseSynced: countRow.octoparseSynced || 0,
                scrapedOk: countRow.scrapedOk || 0,
                scrapedFailed: countRow.scrapedFailed || 0,
                lastScrapedAt: countRow.lastScrapedAt || null,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;