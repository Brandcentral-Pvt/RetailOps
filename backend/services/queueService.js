/**
 * Bull Queue Service for Heavy Operations
 * Offloads long-running tasks to background workers
 */

const Queue = require('bull');
const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_PREFIX = process.env.QUEUE_PREFIX || 'retailops:queue:';

let redisClient = null;
const queues = new Map();

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
      family: 4,
    });
    redisClient.connect().catch(() => {});
  }
  return redisClient;
}

/**
 * Get or create a named queue
 */
function getQueue(name, options = {}) {
  const fullName = `${QUEUE_PREFIX}${name}`;
  if (queues.has(fullName)) return queues.get(fullName);

  const queue = new Queue(fullName, {
    redis: REDIS_URL,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options.defaultJobOptions,
    },
    ...options,
  });

  queue.on('error', (err) => {
    logger.error(`Queue ${name} error`, { error: err.message });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Queue ${name} job failed`, { 
      jobId: job.id, 
      error: err.message,
      attemptsMade: job.attemptsMade,
    });
  });

  queues.set(fullName, queue);
  return queue;
}

/**
 * Add a job to the queue
 */
async function addJob(queueName, jobName, data, options = {}) {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, {
    priority: options.priority || 0,
    delay: options.delay || 0,
    attempts: options.attempts || 3,
    backoff: options.backoff || { type: 'exponential', delay: 2000 },
    timeout: options.timeout || 300000, // 5 min default
    ...options,
  });
}

/**
 * Process jobs with a handler function
 */
function processQueue(queueName, jobName, concurrency, handler) {
  const queue = getQueue(queueName);
  queue.process(jobName, concurrency, async (job) => {
    const startTime = Date.now();
    logger.info(`Processing job ${jobName}`, { jobId: job.id, queue: queueName });
    try {
      const result = await handler(job.data, job);
      logger.info(`Job ${jobName} completed`, { 
        jobId: job.id, 
        duration: Date.now() - startTime 
      });
      return result;
    } catch (err) {
      logger.error(`Job ${jobName} failed`, { 
        jobId: job.id, 
        error: err.message,
        duration: Date.now() - startTime 
      });
      throw err;
    }
  });
}

/**
 * Predefined queues for common operations
 */
const QUEUES = {
  // Dashboard data refresh
  DASHBOARD: 'dashboard',
  // Data sync operations
  SYNC: 'sync',
  // Report generation
  REPORTS: 'reports',
  // Export operations
  EXPORT: 'export',
  // AI/ML operations
  AI: 'ai',
  // Webhook processing
  WEBHOOK: 'webhook',
  // Notification sending
  NOTIFICATIONS: 'notifications',
  // Scraping tasks
  SCRAPING: 'scraping',
};

/**
 * Add dashboard refresh job
 */
async function queueDashboardRefresh(userId, filters, priority = 0) {
  return addJob(QUEUES.DASHBOARD, 'refresh', { userId, filters }, { priority });
}

/**
 * Add sync job
 */
async function queueSync(sellerId, type, priority = 0) {
  return addJob(QUEUES.SYNC, 'sync', { sellerId, type }, { priority });
}

/**
 * Add report generation job
 */
async function queueReport(userId, reportType, params, priority = 0) {
  return addJob(QUEUES.REPORTS, 'generate', { userId, reportType, params }, { 
    priority,
    timeout: 600000, // 10 min for reports
  });
}

/**
 * Add export job
 */
async function queueExport(userId, exportType, params, priority = 0) {
  return addJob(QUEUES.EXPORT, 'export', { userId, exportType, params }, { 
    priority,
    timeout: 600000,
  });
}

/**
 * Add AI job
 */
async function queueAI(taskType, data, priority = 0) {
  return addJob(QUEUES.AI, taskType, data, { 
    priority,
    timeout: 300000,
  });
}

/**
 * Add notification job
 */
async function queueNotification(type, recipients, payload, priority = 0) {
  return addJob(QUEUES.NOTIFICATIONS, type, { recipients, payload }, { priority });
}

/**
 * Get queue statistics
 */
async function getQueueStats(queueName) {
  const queue = getQueue(queueName);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

/**
 * Get all queue statistics
 */
async function getAllQueueStats() {
  const stats = {};
  for (const [name, queueName] of Object.entries(QUEUES)) {
    stats[name] = await getQueueStats(queueName);
  }
  return stats;
}

/**
 * Pause a queue
 */
async function pauseQueue(queueName) {
  const queue = getQueue(queueName);
  return queue.pause();
}

/**
 * Resume a queue
 */
async function resumeQueue(queueName) {
  const queue = getQueue(queueName);
  return queue.resume();
}

/**
 * Clean completed/failed jobs
 */
async function cleanQueue(queueName, grace = 5000) {
  const queue = getQueue(queueName);
  await queue.clean(grace, 'completed');
  await queue.clean(grace, 'failed');
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  await Promise.all(
    Array.from(queues.values()).map(q => q.close())
  );
  if (redisClient) {
    await redisClient.quit();
  }
}

module.exports = {
  getQueue,
  addJob,
  processQueue,
  QUEUES,
  queueDashboardRefresh,
  queueSync,
  queueReport,
  queueExport,
  queueAI,
  queueNotification,
  getQueueStats,
  getAllQueueStats,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  shutdown,
};