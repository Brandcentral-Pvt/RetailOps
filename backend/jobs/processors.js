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
        return LiveSyncService.syncSeller(sellerId);
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
      return pemsService.createNotification({ userId, type, title, message, actionUrl, taskInstanceId });
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
