const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
const PREFIX = process.env.CACHE_PREFIX || 'retailops:';

let client = null;
let enabled = true;

function createClient() {
  const c = new Redis(REDIS_URL, {
    retryStrategy: (times) => {
      if (times > 5) {
        logger.warn('Redis cache retry limit reached — disabling cache');
        enabled = false;
        return null;
      }
      return Math.min(times * 200, 3000);
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  c.on('error', (err) => {
    logger.warn('Redis cache error', { error: err.message });
    enabled = false;
  });

  c.on('ready', () => {
    enabled = true;
    logger.info('Redis cache connected');
  });

  c.on('close', () => {
    enabled = false;
  });

  return c;
}

function key(...parts) {
  return `${PREFIX}${parts.join(':')}`;
}

async function connect() {
  if (client) return client;
  client = createClient();
  try {
    await client.connect();
    enabled = true;
  } catch (err) {
    logger.warn('Redis cache unavailable — running without cache', { error: err.message });
    enabled = false;
    client = null;
  }
  return client;
}

async function get(cacheKey) {
  if (!enabled || !client) return null;
  try {
    const val = await client.get(cacheKey);
    if (!val) return null;
    return JSON.parse(val);
  } catch (err) {
    logger.warn('Cache read error', { key: cacheKey, error: err.message });
    return null;
  }
}

async function set(cacheKey, data, ttl = DEFAULT_TTL) {
  if (!enabled || !client) return;
  try {
    const str = JSON.stringify(data);
    if (ttl > 0) {
      await client.setex(cacheKey, ttl, str);
    } else {
      await client.set(cacheKey, str);
    }
  } catch (err) {
    logger.warn('Cache write error', { key: cacheKey, error: err.message });
  }
}

async function del(...cacheKeys) {
  if (!enabled || !client) return;
  try {
    if (cacheKeys.length > 0) {
      await client.del(cacheKeys);
    }
  } catch (err) {
    logger.warn('Cache delete error', { error: err.message });
  }
}

async function delPattern(pattern) {
  if (!enabled || !client) return;
  try {
    const stream = client.scanStream({ match: `${PREFIX}${pattern}`, count: 100 });
    for await (const keys of stream) {
      if (keys.length > 0) {
        const pipeline = client.pipeline();
        keys.forEach(k => pipeline.del(k));
        await pipeline.exec();
      }
    }
  } catch (err) {
    logger.warn('Cache pattern delete error', { pattern, error: err.message });
  }
}

async function remember(cacheKey, fetchFn, ttl = DEFAULT_TTL) {
  const cached = await get(cacheKey);
  if (cached !== null) return cached;

  const fresh = await fetchFn();
  if (fresh !== null && fresh !== undefined) {
    await set(cacheKey, fresh, ttl);
  }
  return fresh;
}

async function invalidate(...patterns) {
  for (const p of patterns) {
    await delPattern(p);
  }
}

function isEnabled() {
  return enabled && client !== null;
}

async function disconnect() {
  if (client) {
    await client.quit();
    client = null;
    enabled = false;
  }
}

module.exports = {
  connect,
  get,
  set,
  del,
  delPattern,
  remember,
  invalidate,
  key,
  isEnabled,
  disconnect,
};
