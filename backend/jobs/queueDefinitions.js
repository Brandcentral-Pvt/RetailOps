const queueService = require('../services/queueService');

const QUEUES = {
  MARKET_SYNC: 'market-sync',
  KEEPA_SYNC: 'keepa-sync',
  PIPELINE_RUN: 'pipeline-run',
  AUTO_TAG: 'auto-tag',
  SLA_ESCALATION: 'sla-escalation',
  PEMS_NOTIFICATION: 'pems-notification',
  WEBHOOK_DELIVERY: 'webhook-delivery',
};

function initializeQueues() {
  queueService.create(QUEUES.MARKET_SYNC, {
    attempts: 3,
    backoffDelay: 5000,
    timeout: 600000,
    limiter: { max: 10, duration: 1000 },
  });

  queueService.create(QUEUES.KEEPA_SYNC, {
    attempts: 2,
    backoffDelay: 10000,
    timeout: 300000,
    limiter: { max: 5, duration: 1000 },
  });

  queueService.create(QUEUES.PIPELINE_RUN, {
    attempts: 1,
    timeout: 7200000,
    limiter: { max: 1, duration: 1000 },
  });

  queueService.create(QUEUES.AUTO_TAG, {
    attempts: 2,
    timeout: 600000,
  });

  queueService.create(QUEUES.SLA_ESCALATION, {
    attempts: 3,
    backoffDelay: 1000,
    timeout: 120000,
  });

  queueService.create(QUEUES.PEMS_NOTIFICATION, {
    attempts: 3,
    backoffDelay: 1000,
    timeout: 30000,
    limiter: { max: 50, duration: 1000 },
  });

  queueService.create(QUEUES.WEBHOOK_DELIVERY, {
    attempts: 5,
    backoffType: 'fixed',
    backoffDelay: 10000,
    timeout: 30000,
    limiter: { max: 20, duration: 1000 },
  });

  return QUEUES;
}

module.exports = { QUEUES, initializeQueues };
