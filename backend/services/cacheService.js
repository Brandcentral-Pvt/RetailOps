const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
const PREFIX = process.env.CACHE_PREFIX || 'retailops:';
const DEDUP_PREFIX = 'dedup:';
const LOCK_PREFIX = 'lock:';

let client = null;
let enabled = true;
const pendingRequests = new Map();

function createClient() {
  const c = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
    family: 4,
    connectTimeout: 10000,
    commandTimeout: 5000,
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

function dedupKey(...parts) {
  return `${PREFIX}${DEDUP_PREFIX}${parts.join(':')}`;
}

function lockKey(...parts) {
  return `${PREFIX}${LOCK_PREFIX}${parts.join(':')}`;
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

/**
 * Request Deduplication - prevents duplicate concurrent requests for the same key
 * Returns cached result if available, otherwise executes fetchFn once and caches
 */
async function dedup(cacheKey, fetchFn, ttl = DEFAULT_TTL) {
  const fullKey = dedupKey(cacheKey);
  
  // Check local pending requests first (in-memory for same process)
  if (pendingRequests.has(fullKey)) {
    return pendingRequests.get(fullKey);
  }
  
  // Check Redis cache
  const cached = await get(fullKey);
  if (cached !== null) return cached;

  // Create promise for this request
  const promise = (async () => {
    try {
      const fresh = await fetchFn();
      if (fresh !== null && fresh !== undefined) {
        await set(fullKey, fresh, ttl);
      }
      return fresh;
    } finally {
      pendingRequests.delete(fullKey);
    }
  })();

  pendingRequests.set(fullKey, promise);
  return promise;
}

/**
 * Distributed Lock - for preventing thundering herd on cache misses
 * Uses Redis SETNX with TTL for automatic expiration
 */
async function acquireLock(lockName, ttlMs = 30000) {
  if (!enabled || !client) return { acquired: false, release: () => {} };
  
  const fullKey = lockKey(lockName);
  const lockValue = `${process.pid}:${Date.now()}:${Math.random()}`;
  
  try {
    // SET with NX (only if not exists) and PX (millisecond TTL)
    const result = await client.set(fullKey, lockValue, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      return {
        acquired: true,
        release: async () => {
          // Only release if we still own the lock (Lua script for atomicity)
          const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
              return redis.call("DEL", KEYS[1])
            else
              return 0
            end
          `;
          await client.eval(script, 1, fullKey, lockValue);
        }
      };
    }
  } catch (err) {
    logger.warn('Lock acquire error', { lockName, error: err.message });
  }
  return { acquired: false, release: () => {} };
}

/**
 * Remember with distributed lock to prevent thundering herd
 */
async function rememberWithLock(cacheKey, fetchFn, ttl = DEFAULT_TTL, lockTtlMs = 30000) {
  const cached = await get(key(cacheKey));
  if (cached !== null) return cached;

  const { acquired, release } = await acquireLock(cacheKey, lockTtlMs);
  if (!acquired) {
    // Another process is fetching, wait and retry from cache
    await new Promise(r => setTimeout(r, 100));
    const waiting = await get(key(cacheKey));
    if (waiting !== null) return waiting;
    // Fallback: execute anyway (last resort)
    return fetchFn();
  }

  try {
    const fresh = await fetchFn();
    if (fresh !== null && fresh !== undefined) {
      await set(key(cacheKey), fresh, ttl);
    }
    return fresh;
  } finally {
    await release();
  }
}

async function remember(cacheKey, fetchFn, ttl = DEFAULT_TTL) {
  const cached = await get(key(cacheKey));
  if (cached !== null) return cached;

  const fresh = await fetchFn();
  if (fresh !== null && fresh !== undefined) {
    await set(key(cacheKey), fresh, ttl);
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
  rememberWithLock,
  dedup,
  acquireLock,
  invalidate,
  invalidateNamespace,
  key,
  isEnabled,
  disconnect,
};