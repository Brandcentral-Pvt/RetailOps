const { sql, getPool } = require('../database/db');
const { LiveSyncTracker, ScraperTracker, LiveSyncTrackerClass, ScraperTrackerClass } = require('../services/syncTracker');

/**
 * GET /api/tracking/live-sync/runs
 * Get recent live sync runs
 */
async function getLiveSyncRuns(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const runs = await LiveSyncTracker.getRecentRuns(limit);
        return res.json({ success: true, runs });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * GET /api/tracking/live-sync/runs/:runId
 * Get detailed live sync run with sellers
 */
async function getLiveSyncRun(req, res) {
    try {
        const run = await LiveSyncTrackerClass.getRun(req.params.runId);
        if (!run) {
            return res.status(404).json({ success: false, error: 'Run not found' });
        }
        return res.json({ success: true, run });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * GET /api/tracking/live-sync/sellers/:sellerId
 * Get live sync runs for a specific seller
 */
async function getLiveSyncSellerRuns(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const runs = await LiveSyncTrackerClass.getSellerRuns(req.params.sellerId, limit);
        return res.json({ success: true, runs });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * GET /api/tracking/scraper/runs
 * Get recent scraper runs
 */
async function getScraperRuns(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const marketplace = req.query.marketplace || null;
        const runs = await ScraperTracker.getRecentRuns(limit, marketplace);
        return res.json({ success: true, runs });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * GET /api/tracking/scraper/runs/:runId
 * Get detailed scraper run with sellers and jobs
 */
async function getScraperRun(req, res) {
    try {
        const run = await ScraperTrackerClass.getRun(req.params.runId);
        if (!run) {
            return res.status(404).json({ success: false, error: 'Run not found' });
        }
        return res.json({ success: true, run });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * GET /api/tracking/scraper/sellers/:sellerId
 * Get scraper runs for a specific seller
 */
async function getScraperSellerRuns(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const runs = await ScraperTrackerClass.getSellerRuns(req.params.sellerId, limit);
        return res.json({ success: true, runs });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * GET /api/tracking/summary
 * Get summary statistics for both live sync and scraper
 */
async function getTrackingSummary(req, res) {
    try {
        const pool = await getPool();
        
        // Recent live sync runs stats
        const liveSyncStats = await pool.request().query(`
            SELECT 
                COUNT(*) as totalRuns,
                SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN Status = 'ABORTED' THEN 1 ELSE 0 END) as aborted,
                SUM(TotalAsins) as totalAsins,
                SUM(UpdatedAsins) as updatedAsins,
                SUM(FailedAsins) as failedAsins,
                MAX(StartTime) as lastRun
            FROM LiveSyncRuns
            WHERE RunDate >= DATEADD(day, -30, CAST(dbo.GetEnvDate() AS DATE))
        `);
        
        // Recent scraper runs stats
        const scraperStats = await pool.request().query(`
            SELECT 
                COUNT(*) as totalRuns,
                SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                SUM(TotalAsinsScraped) as totalAsinsScraped,
                SUM(TotalJobs) as totalJobs,
                MAX(StartTime) as lastRun
            FROM ScraperRuns
            WHERE RunDate >= DATEADD(day, -30, CAST(dbo.GetEnvDate() AS DATE))
        `);
        
        // Today's runs
        const today = new Date().toISOString().split('T')[0];
        const todayLiveSync = await pool.request()
            .input('date', sql.Date, today)
            .query(`SELECT COUNT(*) as count, Status FROM LiveSyncRuns WHERE RunDate = @date GROUP BY Status`);
        
        const todayScraper = await pool.request()
            .input('date', sql.Date, today)
            .query(`SELECT COUNT(*) as count, Status FROM ScraperRuns WHERE RunDate = @date GROUP BY Status`);
        
        return res.json({
            success: true,
            summary: {
                liveSync: {
                    last30Days: liveSyncStats.recordset[0],
                    today: todayLiveSync.recordset
                },
                scraper: {
                    last30Days: scraperStats.recordset[0],
                    today: todayScraper.recordset
                }
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getLiveSyncRuns,
    getLiveSyncRun,
    getLiveSyncSellerRuns,
    getScraperRuns,
    getScraperRun,
    getScraperSellerRuns,
    getTrackingSummary
};