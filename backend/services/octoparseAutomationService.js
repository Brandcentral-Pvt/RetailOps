/**
 * Octoparse Automation Service (SQL-adapted stub)
 * Note: Full implementation would maintain Octoparse API integration.
 * This stub provides minimal viable functionality.
 * DISABLED: Octoparse is being replaced by Playwright scraper.
 */

const { sql, getPool } = require('../database/db');
const logger = require('./logger').service('octoparse');

class OctoparseAutomationService {
    constructor() {
        this.baseUrl = process.env.OCTOPARSE_BASE_URL || 'https://openapi.octoparse.com';
        this.masterTaskId = process.env.OCTOPARSE_MASTER_TASK_ID;
        this.groupId = process.env.OCTOPARSE_GROUP_ID;
        this.maxRetries = parseInt(process.env.OCTOPARSE_MAX_RETRIES) || 3;
        this.retryDelay = parseInt(process.env.OCTOPARSE_RETRY_DELAY) || 30000;
        this.pollInterval = parseInt(process.env.OCTOPARSE_POLL_INTERVAL) || 60000;
        this.disabled = process.env.AUTOMATION_ENABLED !== 'true';
    }

    isConfigured() {
        return false; // DISABLED: Octoparse replaced by Playwright scraper
    }

    /**
     * For now, just log and return a dummy task ID
     */
    async ensureTaskForSeller(sellerId) {
        if (this.disabled) return null;
        try {
            const pool = await getPool();
            // Check if seller already has a task
            const result = await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query("SELECT OctoparseId FROM Sellers WHERE Id = @sellerId");

            const seller = result.recordset[0];
            if (seller && seller.OctoparseId) {
                logger.debug(`Seller ${sellerId} already has task: ${seller.OctoparseId}`);
                return seller.OctoparseId;
            }

            // Generate a fake task ID
            const fakeTaskId = `task_${sellerId}_${Date.now()}`;
            if (seller) {
                await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .input('taskId', sql.NVarChar, fakeTaskId)
                    .query("UPDATE Sellers SET OctoparseId = @taskId WHERE Id = @id");
            }

            logger.debug(`Assigned task ${fakeTaskId} to seller ${sellerId}`);
            return fakeTaskId;
        } catch (err) {
            logger.warn(`ensureTaskForSeller error: ${err.message}`);
            return null;
        }
    }

    /**
     * Clone master task (stub)
     */
    async cloneMasterTask(taskName) {
        if (this.disabled) return null;
        logger.debug(`Cloning master task for: ${taskName}`);
        return `task_${taskName}_${Date.now()}`;
    }

    /**
     * Inject URLs into Octoparse task (stub)
     */
    async injectUrls(taskId, urls) {
        if (this.disabled) return { success: false, disabled: true };
        logger.debug(`Would inject ${urls.length} URLs into task ${taskId}`);
        return { success: true, injected: urls.length };
    }

    /**
     * Start Octoparse task (stub)
     */
    async startTask(taskId) {
        if (this.disabled) return { success: false, disabled: true };
        logger.debug(`Would start task ${taskId}`);
        return { success: true, taskId };
    }

    /**
     * Get task status (stub)
     */
    async getTaskStatus(taskId) {
        return { status: 'DISABLED', progress: 0 };
    }

    /**
     * Sync seller ASINs to Octoparse (main entry point)
     */
    async syncSellerAsinsToOctoparse(sellerId, options = {}) {
        if (this.disabled) {
            logger.debug('syncSellerAsinsToOctoparse blocked (Automation is disabled)');
            return false;
        }
        try {
            logger.debug(`syncSellerAsinsToOctoparse for seller ${sellerId}`);
            const taskId = await this.ensureTaskForSeller(sellerId);
            if (!taskId) return false;

            // Get ASINs for seller
            const pool = await getPool();
            const asinsResult = await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status IN ('Active', 'Scraping', 'Error', 'Pending')");

            const asins = asinsResult.recordset.map(a => a.AsinCode);
            if (asins.length === 0) {
                logger.debug(`No ASINs to sync for seller ${sellerId}`);
                return false;
            }

            // Inject URLs and start
            await this.injectUrls(taskId, asins);
            if (options.triggerScrape) {
                await this.startTask(taskId);
            }

            logger.debug(`Synced ${asins.length} ASINs for seller ${sellerId}`);
            return true;
        } catch (err) {
            logger.warn(`sync error: ${err.message}`);
            return false;
        }
    }

    /**
     * Update ASIN metrics after scrape (stub)
     */
    async updateAsinMetrics(asinId, rawData) {
        if (this.disabled) return { success: false, disabled: true };
        logger.debug(`Would update metrics for ASIN ${asinId}`);
        return { success: true };
    }
}

module.exports = new OctoparseAutomationService();
