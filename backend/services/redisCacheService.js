// Redis-backed cache service (production) with in-memory fallback
const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL;
const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
const PREFIX = process.env.CACHE_PREFIX || 'retailops:';

let redisClient = null;
let useRedis = false;
let memoryCache = new Map();

function createRedisClient() {
  if (!REDIS_URL || REDIS_URL === 'redis://localhost:6379') {
    logger.info('Redis URL not configured, using in-memory cache');
    return null;
  }

  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
      connectTimeout: 5000,
    });

    client.on('error', (err) => {
      logger.warn('Redis cache error', { error: err.message });
      useRedis = false;
    });

    client.on('ready', () => {
      useRedis = true;
      logger.info('Redis cache connected');
    });

    client.on('close', () => {
      useRedis = false;
    });

    return client;
  } catch (err) {
    logger.warn('Redis client creation failed, using in-memory cache', { error: err.message });
    return null;
  }
}

async function initRedis() {
  if (redisClient) return redisClient;
  redisClient = createRedisClient();
  if (redisClient) {
    try {
      await redisClient.connect();
    } catch (err) {
      logger.warn('Redis connection failed, using in-memory cache', { error: err.message });
      redisClient = null;
    }
  }
  return redisClient;
}

function key(...parts) {
  return `${PREFIX}${parts.join(':')}`;
}

async function get(cacheKey) {
  const k = key(cacheKey);
  
  if (useRedis && redisClient) {
    try {
      const val = await redisClient.get(k);
      if (!val) return null;
      return JSON.parse(val);
    } catch (err) {
      logger.warn('Redis get failed, falling back to memory', { error: err.message });
    }
  }

  // In-memory fallback
  const entry = memoryCache.get(k);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memoryCache.delete(k);
    return null;
  }
  return entry.value;
}

async function set(cacheKey, data, ttl = 300) {
  const k = key(cacheKey);
  const expiry = Date.now() + ttl * 1000;

  if (useRedis && redisClient) {
    try {
      await redisClient.setex(k, ttl, JSON.stringify(data));
      return;
    } catch (err) {
      logger.warn('Redis set failed, falling back to memory', { error: err.message });
    }
  }

  memoryCache.set(k, { value: data, expiry });
}

async function del(...cacheKeys) {
  const keys = cacheKeys.map(k => key(k));
  
  if (useRedis && redisClient) {
    try {
      await redisClient.del(...keys);
    } catch (err) {
      logger.warn('Redis del failed', { error: err.message });
    }
  }

  for (const k of keys) {
    memoryCache.delete(k);
  }
}

async function delPattern(pattern) {
  const regex = new RegExp(`^retailops:${pattern.replace('*', '.*')}$`);
  
  if (useRedis && redisClient) {
    try {
      let cursor = '0';
      do {
        const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', `retailops:${pattern}`, 'COUNT', 100);
        cursor = newCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.warn('Redis delPattern failed', { error: err.message });
    }
  }

  for (const k of memoryCache.keys()) {
    if (regex.test(k)) {
      memoryCache.delete(k);
    }
  }
}

async function remember(cacheKey, fetchFn, ttl = 300) {
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

async function invalidateNamespace(namespace) {
  await delPattern(`route:${namespace}:*`);
}

function cacheKey(...parts) {
  return parts.join(':');
}

function isEnabled() {
  return true;
}

async function disconnect() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    useRedis = false;
  }
  memoryCache.clear();
}

module.exports = {
  connect: initRedis,
  get,
  set,
  del,
  delPattern,
  remember,
  invalidate,
  invalidateNamespace,
  key: cacheKey,
  isEnabled,
  disconnect,
};