const Bull = require('bull');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const prefix = process.env.QUEUE_PREFIX || 'retailops:queue';

const queues = {};

function create(name, opts = {}) {
  if (queues[name]) return queues[name];

  const queue = new Bull(name, REDIS_URL, {
    prefix,
    defaultJobOptions: {
      attempts: opts.attempts || 3,
      backoff: {
        type: opts.backoffType || 'exponential',
        delay: opts.backoffDelay || 2000,
      },
      removeOnComplete: opts.removeOnComplete !== undefined ? opts.removeOnComplete : 100,
      removeOnFail: opts.removeOnFail !== undefined ? opts.removeOnFail : 50,
      timeout: opts.timeout || 600000,
    },
    settings: {
      stalledInterval: opts.stalledInterval || 30000,
      maxStalledCount: opts.maxStalledCount || 3,
      lockDuration: opts.lockDuration || 60000,
    },
    limiter: opts.limiter ? {
      max: opts.limiter.max || 10,
      duration: opts.limiter.duration || 1000,
    } : undefined,
  });

  queue.on('completed', (job) => {
    logger.info(`Queue [${name}] job ${job.id} completed`, {
      queue: name,
      jobId: job.id,
      duration: Math.round((Date.now() - job.timestamp) / 1000) + 's',
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Queue [${name}] job ${job.id} failed`, {
      queue: name,
      jobId: job.id,
      attempts: job.attemptsMade,
      error: err.message,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Queue [${name}] job ${job.id} stalled`, { queue: name, jobId: job.id });
  });

  queues[name] = queue;
  logger.info(`Queue [${name}] initialized`, {
    attempts: opts.attempts || 3,
    limiter: opts.limiter || 'none',
  });
  return queue;
}

function get(name) {
  return queues[name] || null;
}

async function add(name, data, opts = {}) {
  const queue = get(name);
  if (!queue) throw new Error(`Queue "${name}" not found`);
  return queue.add(data, {
    priority: opts.priority,
    delay: opts.delay,
    jobId: opts.jobId,
    attempts: opts.attempts,
  });
}

async function addBulk(name, jobs) {
  const queue = get(name);
  if (!queue) throw new Error(`Queue "${name}" not found`);
  return queue.addBulk(jobs.map(j => ({
    data: j.data,
    opts: {
      priority: j.priority,
      delay: j.delay,
      jobId: j.jobId,
      attempts: j.attempts,
    },
  })));
}

async function getJobCounts(name) {
  const queue = get(name);
  if (!queue) return {};
  return queue.getJobCounts();
}

async function getActiveJobs(name) {
  const queue = get(name);
  if (!queue) return [];
  return queue.getActive();
}

async function pause(name) {
  const queue = get(name);
  if (queue) await queue.pause();
}

async function resume(name) {
  const queue = get(name);
  if (queue) await queue.resume();
}

async function empty(name) {
  const queue = get(name);
  if (queue) await queue.empty();
}

async function close(name) {
  const queue = queues[name];
  if (queue) {
    await queue.close();
    delete queues[name];
  }
}

async function closeAll() {
  const names = Object.keys(queues);
  await Promise.all(names.map(n => close(n)));
}

function getQueues() {
  return Object.keys(queues);
}

module.exports = {
  create,
  get,
  add,
  addBulk,
  getJobCounts,
  getActiveJobs,
  pause,
  resume,
  empty,
  close,
  closeAll,
  getQueues,
};
