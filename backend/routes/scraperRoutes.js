const express = require('express');
const router = express.Router();
const { authenticate: protect, requirePermission, checkSellerAccess } = require('../middleware/auth');
const playwrightScraperRunner = require('../services/playwrightScraperRunner');
const playwrightScraperService = require('../services/playwrightScraperService');
const { sql, getPool } = require('../database/db');
const logger = require('../utils/logger');

const SCRAPE_PERMISSION = 'asinmanager_manage';

router.post('/scrape/start', protect, requirePermission(SCRAPE_PERMISSION), checkSellerAccess, async (req, res) => {
  try {
    const { sellerId, asins, priority = 'normal', options = {} } = req.body;
    const userId = req.user.Id;

    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'sellerId is required' });
    }

    if (!asins || !Array.isArray(asins) || asins.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one ASIN is required' });
    }

    const jobConfig = {
      sellerId,
      asins,
      userId,
      priority,
      options: {
        ...options,
        proxies: options.proxies || (process.env.SCRAPER_PROXY_LIST ? process.env.SCRAPER_PROXY_LIST.split(',') : []),
      },
    };

    const result = await playwrightScraperRunner.startJob(jobConfig);
    
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Start scrape job error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/scrape/start-bulk', protect, requirePermission(SCRAPE_PERMISSION), checkSellerAccess, async (req, res) => {
  try {
    const { sellerId, asinFile, priority = 'normal', options = {} } = req.body;
    const userId = req.user.Id;

    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'sellerId is required' });
    }

    if (!asinFile) {
      return res.status(400).json({ success: false, message: 'asinFile (CSV content or file path) is required' });
    }

    let asins = [];
    
    if (typeof asinFile === 'string' && asinFile.includes('\n')) {
      asins = asinFile.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
    } else if (Array.isArray(asinFile)) {
      asins = asinFile;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid asinFile format' });
    }

    const validAsins = [...new Set(asins.map(a => a.trim().toUpperCase()).filter(a => /^[A-Z0-9]{10}$/.test(a)))];
    
    if (validAsins.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid ASINs found in file' });
    }

    const jobConfig = {
      sellerId,
      asins: validAsins,
      userId,
      priority,
      options: {
        ...options,
        proxies: options.proxies || (process.env.SCRAPER_PROXY_LIST ? process.env.SCRAPER_PROXY_LIST.split(',') : []),
      },
    };

    const result = await playwrightScraperRunner.startJob(jobConfig);
    
    res.json({ success: true, ...result, totalAsins: validAsins.length });
  } catch (error) {
    logger.error('Start bulk scrape job error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/scrape/status/:jobId', protect, requirePermission('asinmanager_view'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = playwrightScraperRunner.getJobStatus(jobId);

    if (!job) {
      const pool = await getPool();
      const history = await pool.request()
        .input('jobId', sql.VarChar, jobId)
        .query('SELECT TOP 1 * FROM ScrapeJobHistory WHERE JobId = @jobId ORDER BY CreatedAt DESC');
      
      if (history.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      return res.json({ success: true, job: history.recordset[0], fromHistory: true });
    }

    res.json({ success: true, job });
  } catch (error) {
    logger.error('Get scrape job status error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/scrape/jobs', protect, requirePermission('asinmanager_view'), async (req, res) => {
  try {
    const { sellerId, status, limit = 50, offset = 0 } = req.query;
    
    const pool = await getPool();
    let query = 'SELECT * FROM ScrapeJobHistory WHERE 1=1';
    const request = pool.request();

    if (sellerId) {
      query += ' AND SellerId = @sellerId';
      request.input('sellerId', sql.VarChar, sellerId);
    }

    if (status) {
      query += ' AND Status = @status';
      request.input('status', sql.VarChar, status);
    }

    query += ' ORDER BY CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
    request.input('offset', sql.Int, parseInt(offset));
    request.input('limit', sql.Int, parseInt(limit));

    const result = await request.query(query);
    
    res.json({ success: true, jobs: result.recordset });
  } catch (error) {
    logger.error('Get scrape jobs error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/scrape/job-details/:jobId', protect, requirePermission('asinmanager_view'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 100, offset = 0, success } = req.query;

    const pool = await getPool();
    let query = 'SELECT * FROM ScrapeJobDetails WHERE JobId = @jobId';
    const request = pool.request().input('jobId', sql.VarChar, jobId);

    if (success !== undefined) {
      query += ' AND Success = @success';
      request.input('success', sql.Bit, success === 'true' ? 1 : 0);
    }

    query += ' ORDER BY ScrapedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
    request.input('offset', sql.Int, parseInt(offset));
    request.input('limit', sql.Int, parseInt(limit));

    const result = await request.query(query);
    
    res.json({ success: true, details: result.recordset });
  } catch (error) {
    logger.error('Get scrape job details error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/scrape/cancel/:jobId', protect, requirePermission(SCRAPE_PERMISSION), async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await playwrightScraperRunner.cancelJob(jobId);
    res.json(result);
  } catch (error) {
    logger.error('Cancel scrape job error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/scrape/retry/:jobId', protect, requirePermission(SCRAPE_PERMISSION), async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await playwrightScraperRunner.retryFailedAsins(jobId);
    res.json(result);
  } catch (error) {
    logger.error('Retry failed ASINs error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/scrape/stats', protect, requirePermission('asinmanager_view'), async (req, res) => {
  try {
    const runnerStats = playwrightScraperRunner.getStats();
    const scraperHealth = await playwrightScraperService.healthCheck();

    const pool = await getPool();
    const dbStats = await pool.request().query(`
      SELECT 
        COUNT(*) as totalScraped,
        COUNT(CASE WHEN HasAplus = 1 THEN 1 END) as withAplus,
        COUNT(CASE WHEN HasAplus = 0 THEN 1 END) as withoutAplus,
        AVG(Rating) as avgRating,
        AVG(ReviewCount) as avgReviewCount,
        MAX(LastScrapedAt) as lastScrapedAt
      FROM AsinScrapeData
    `);

    const recentJobs = await pool.request().query(`
      SELECT TOP 10 JobId, SellerId, Status, TotalAsins, Successful, Failed, CreatedAt
      FROM ScrapeJobHistory
      ORDER BY CreatedAt DESC
    `);

    res.json({
      success: true,
      runner: runnerStats,
      scraper: scraperHealth,
      database: dbStats.recordset[0],
      recentJobs: recentJobs.recordset,
    });
  } catch (error) {
    logger.error('Get scrape stats error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/scrape/asin-data/:sellerId/:asin', protect, requirePermission('asinmanager_view'), checkSellerAccess, async (req, res) => {
  try {
    const { sellerId, asin } = req.params;

    const pool = await getPool();
    const result = await pool.request()
      .input('asin', sql.VarChar, asin.toUpperCase())
      .input('sellerId', sql.VarChar, sellerId)
      .query('SELECT * FROM AsinScrapeData WHERE Asin = @asin AND SellerId = @sellerId');

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'No scrape data found for this ASIN' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    logger.error('Get ASIN scrape data error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/scrape/seller-summary/:sellerId', protect, requirePermission('asinmanager_view'), checkSellerAccess, async (req, res) => {
  try {
    const { sellerId } = req.params;

    const pool = await getPool();
    const summary = await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query(`
        SELECT 
          COUNT(*) as totalAsins,
          COUNT(CASE WHEN HasAplus = 1 THEN 1 END) as withAplus,
          COUNT(CASE WHEN HasAplus = 0 THEN 1 END) as withoutAplus,
          AVG(Rating) as avgRating,
          SUM(ReviewCount) as totalReviews,
          MIN(Rating) as minRating,
          MAX(Rating) as maxRating,
          COUNT(CASE WHEN Rating >= 4.0 THEN 1 END) as highRated,
          COUNT(CASE WHEN Rating < 3.0 THEN 1 END) as lowRated,
          MAX(LastScrapedAt) as lastScrapedAt
        FROM AsinScrapeData
        WHERE SellerId = @sellerId
      `);

    const ratingDistribution = await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query(`
        SELECT 
          CASE 
            WHEN Rating >= 4.5 THEN '4.5-5.0'
            WHEN Rating >= 4.0 THEN '4.0-4.4'
            WHEN Rating >= 3.5 THEN '3.5-3.9'
            WHEN Rating >= 3.0 THEN '3.0-3.4'
            WHEN Rating > 0 THEN '1.0-2.9'
            ELSE 'No Rating'
          END as ratingRange,
          COUNT(*) as count
        FROM AsinScrapeData
        WHERE SellerId = @sellerId
        GROUP BY 
          CASE 
            WHEN Rating >= 4.5 THEN '4.5-5.0'
            WHEN Rating >= 4.0 THEN '4.0-4.4'
            WHEN Rating >= 3.5 THEN '3.5-3.9'
            WHEN Rating >= 3.0 THEN '3.0-3.4'
            WHEN Rating > 0 THEN '1.0-2.9'
            ELSE 'No Rating'
          END
        ORDER BY count DESC
      `);

    res.json({ 
      success: true, 
      summary: summary.recordset[0],
      ratingDistribution: ratingDistribution.recordset,
    });
  } catch (error) {
    logger.error('Get seller scrape summary error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/scrape/test', protect, requirePermission(SCRAPE_PERMISSION), async (req, res) => {
  try {
    const { asin } = req.body;

    if (!asin || !/^[A-Z0-9]{10}$/.test(asin.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Valid ASIN is required' });
    }

    const result = await playwrightScraperService.scrapeAsin(asin.toUpperCase());
    
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Test scrape error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/scrape/health', protect, requirePermission('asinmanager_view'), async (req, res) => {
  try {
    const health = await playwrightScraperRunner.healthCheck();
    res.json({ success: true, ...health });
  } catch (error) {
    logger.error('Scraper health check error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/scrape/export/:jobId', protect, requirePermission('asinmanager_export'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { format = 'csv' } = req.query;

    const pool = await getPool();
    const details = await pool.request()
      .input('jobId', sql.VarChar, jobId)
      .query('SELECT * FROM ScrapeJobDetails WHERE JobId = @jobId ORDER BY ScrapedAt');

    if (details.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'No data found for this job' });
    }

    if (format === 'csv') {
      const headers = ['ASIN', 'Success', 'Rating', 'ReviewCount', 'HasAplus', 'VerifiedASIN', 'Error', 'DurationMs', 'ScrapedAt'];
      const rows = details.recordset.map(d => [
        d.Asin,
        d.Success ? 'Yes' : 'No',
        d.Rating,
        d.ReviewCount,
        d.HasAplus ? 'Yes' : 'No',
        d.VerifiedAsin || '',
        d.ErrorMessage || '',
        d.DurationMs,
        d.ScrapedAt,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="scrape-job-${jobId}-${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.json({ success: true, data: details.recordset });
  } catch (error) {
    logger.error('Export scrape job error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ NEW: Sync seller ASINs (replaces Octoparse sync button) ============
router.post('/scrape/sync-seller/:sellerId', protect, requirePermission('asinmanager_manage'), checkSellerAccess, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const userId = req.user.Id;
    const { fullSync = false, forceReRun = false, onlyMissing = false } = req.body;

    const pool = await getPool();

    // Fetch seller to verify
    const sellerResult = await pool.request()
      .input('id', sql.VarChar, sellerId)
      .query("SELECT * FROM Sellers WHERE Id = @id");

    const seller = sellerResult.recordset[0];
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    // Build query to get ASINs to scrape
    let whereClause = "WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Archived')";
    
    if (onlyMissing) {
      // Only scrape ASINs that don't have scrape data or have missing critical fields
      whereClause += ` AND (
        AsinCode NOT IN (SELECT Asin FROM AsinScrapeData WHERE SellerId = @sellerId)
        OR Rating IS NULL OR Rating = 0
        OR ReviewCount IS NULL OR ReviewCount = 0
        OR HasAplus IS NULL OR HasAplus = 0
      )`;
    }

    if (forceReRun) {
      // Force re-scrape all ASINs
      whereClause = "WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Archived')";
    }

    const asinsResult = await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query(`SELECT AsinCode FROM Asins ${whereClause} ORDER BY CreatedAt`);

    const asins = asinsResult.recordset.map(r => r.AsinCode);

    if (asins.length === 0) {
      return res.json({ 
        success: true, 
        message: onlyMissing ? 'All ASINs already have complete data' : 'No active ASINs found for this seller',
        totalAsins: 0,
        jobId: null
      });
    }

    // Update status to scraping
    await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query("UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Archived')");

    // Start scrape job
    const jobConfig = {
      sellerId,
      asins,
      userId,
      priority: 'high',
      options: {
        proxies: process.env.SCRAPER_PROXY_LIST ? process.env.SCRAPER_PROXY_LIST.split(',') : [],
        fullSync,
        forceReRun,
        onlyMissing,
      },
    };

    const result = await playwrightScraperRunner.startJob(jobConfig);
    
    res.json({ 
      success: true, 
      message: `Playwright scrape initiated for ${seller.Name} (${asins.length} ASINs)`,
      jobId: result.jobId,
      totalAsins: asins.length,
      seller: seller.Name
    });
  } catch (error) {
    logger.error('Sync seller ASINs error', { error: error.message });
    
    // Reset status on error
    const pool = await getPool();
    await pool.request()
      .input('sellerId', sql.VarChar, req.params.sellerId)
      .query("UPDATE Asins SET ScrapeStatus = 'FAILED', Status = 'Error', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND ScrapeStatus = 'SCRAPING'");
    
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sync status for seller
router.get('/scrape/sync-status/:sellerId', protect, requirePermission('asinmanager_view'), checkSellerAccess, async (req, res) => {
  try {
    const { sellerId } = req.params;

    const pool = await getPool();
    
    // Get active job if any
    const activeJob = playwrightScraperRunner.getAllJobs().find(j => j.sellerId === sellerId && (j.status === 'running' || j.status === 'processing' || j.status === 'queued'));
    
    // Get scrape stats
    const stats = await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query(`
        SELECT 
          COUNT(*) as totalAsins,
          COUNT(CASE WHEN a.S scrapeStatus = 'COMPLETED' OR a.LastScrapedAt IS NOT NULL THEN 1 END) as scrapedAsins,
          COUNT(CASE WHEN a.ScrapeStatus = 'SCRAPING' THEN 1 END) as scrapingAsins,
          COUNT(CASE WHEN a.ScrapeStatus = 'FAILED' THEN 1 END) as failedAsins,
          COUNT(CASE WHEN a.ScrapeStatus = 'PENDING' OR a.ScrapeStatus IS NULL THEN 1 END) as pendingAsins,
          MAX(a.LastScrapedAt) as lastScrapedAt
        FROM Asins a
        WHERE a.SellerId = @sellerId AND (a.Status IS NULL OR a.Status != 'Archived')
      `);

    // Get recent scrape job
    const recentJob = await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query(`
        SELECT TOP 1 JobId, Status, TotalAsins, Successful, Failed, StartTime, EndTime
        FROM ScrapeJobHistory
        WHERE SellerId = @sellerId
        ORDER BY CreatedAt DESC
      `);

    res.json({
      success: true,
      sellerId,
      activeJob: activeJob || null,
      stats: stats.recordset[0],
      recentJob: recentJob.recordset[0] || null,
    });
  } catch (error) {
    logger.error('Get sync status error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;