const queueService = require('../services/queueService');
const { QUEUES } = require('./queueDefinitions');
const logger = require('../utils/logger');

function registerProcessors() {
  const mq = queueService.get(QUEUES.MARKET_SYNC);
  if (mq) {
    mq.process(async (job) => {
      const { sellerId, type, options } = job.data;
      logger.info(`Processing market sync for seller ${sellerId}`, { type });

      if (type === 'octoparse') {
        const MarketSyncService = require('../services/marketDataSyncService');
        return MarketSyncService.syncSellerAsinsToOctoparse(sellerId, options || {});
      }

      if (type === 'live') {
        const LiveSyncService = require('../services/liveDataSyncService');
        // Scheduled live sync — sellerId '*' means "all sellers". Runs the
        // global sync with triggerType AUTO so every run lands in the
        // Live Sync Tracker log.
        const opts = { triggerType: 'AUTO', ...(options || {}) };
        if (sellerId && sellerId !== '*') {
          return LiveSyncService.syncSellerLiveData(sellerId, opts);
        }
        return LiveSyncService.syncAllSellers(opts);
      }

      throw new Error(`Unknown market sync type: ${type}`);
    });
  }

  const kq = queueService.get(QUEUES.KEEPA_SYNC);
  if (kq) {
    kq.process(async (job) => {
      const { sellerId } = job.data;
      const MarketSyncService = require('../services/marketDataSyncService');
      return MarketSyncService.syncSellerFromKeepa(sellerId);
    });
  }

  const pq = queueService.get(QUEUES.PIPELINE_RUN);
  if (pq) {
    pq.process(async (job) => {
      const { marketplace, options } = job.data;
      const schedulerService = require('../services/schedulerService');
      return schedulerService.runEnterprisePipeline(marketplace, options || {});
    });
  }

  const aq = queueService.get(QUEUES.AUTO_TAG);
  if (aq) {
    aq.process(async (job) => {
      const { type } = job.data;
      const AutoTagService = require('../services/autoTagService');
      const { getPool } = require('../database/db');
      const pool = await getPool();

      if (type === 'full') return AutoTagService.runAllAutoTags(pool);
      if (type === 'age') return AutoTagService.batchUpdateAgeTags(pool);
      throw new Error(`Unknown auto-tag type: ${type}`);
    });
  }

  const sq = queueService.get(QUEUES.SLA_ESCALATION);
  if (sq) {
    sq.process(async () => {
      const pemsService = require('../services/pems/pemsService');
      return pemsService.checkEscalations();
    });
  }

  const nq = queueService.get(QUEUES.PEMS_NOTIFICATION);
  if (nq) {
    nq.process(async (job) => {
      const { type, userId, title, message, actionUrl, taskInstanceId } = job.data;
      const pemsService = require('../services/pems/pemsService');
      await pemsService.createNotification({ userId, type, title, message, actionUrl, taskInstanceId });

      // Best-effort email dispatch (gated by PEMS_EMAIL_ENABLED=true)
      if (process.env.PEMS_EMAIL_ENABLED === 'true' && taskInstanceId) {
        try {
          const { sql, getPool } = require('../database/db');
          const pool = await getPool();
          const taskRes = await pool.request().input('id', sql.VarChar, taskInstanceId)
            .query('SELECT * FROM PemsTaskInstances WHERE Id = @id');
          const task = taskRes.recordset[0];
          if (task) {
            const emailNotificationService = require('../services/pems/emailNotificationService');
            await emailNotificationService.triggerNotification(type, task, userId, { message, actionUrl }, { skipInApp: true });
          }
        } catch (err) {
          logger.warn('PEMS email notification failed', { error: err.message, type });
        }
      }

      return { ok: true };
    });
  }

  const wq = queueService.get(QUEUES.WEBHOOK_DELIVERY);
  if (wq) {
    wq.process(async (job) => {
      const { webhookId, event, payload } = job.data;
      const WebhookService = require('../services/WebhookService');
      return WebhookService.deliver(webhookId, event, payload);
    });
  }

  logger.info('All job processors registered');
}

module.exports = { registerProcessors };
