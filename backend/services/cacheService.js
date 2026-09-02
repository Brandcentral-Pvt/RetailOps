// In-memory cache service (no Redis)
const logger = require('../utils/logger');

const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
const PREFIX = process.env.CACHE_PREFIX || 'retailops:';

const memoryCache = new Map();

function key(...parts) {
  return `${PREFIX}${parts.join(':')}`;
}

async function connect() {
  logger.info('In-memory cache initialized');
  return true;
}

async function get(cacheKey) {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

async function set(cacheKey, data, ttl = DEFAULT_TTL) {
  const expiry = Date.now() + ttl * 1000;
  memoryCache.set(cacheKey, { value: data, expiry });
}

async function del(...cacheKeys) {
  for (const k of cacheKeys) {
    memoryCache.delete(k);
  }
}

async function delPattern(pattern) {
  const regex = new RegExp(`^${PREFIX}${pattern.replace('*', '.*')}$`);
  for (const k of memoryCache.keys()) {
    if (regex.test(k)) {
      memoryCache.delete(k);
    }
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

async function invalidateNamespace(namespace) {
  await delPattern(`route:${namespace}:*`);
}

function isEnabled() {
  return true;
}

async function disconnect() {
  memoryCache.clear();
}

module.exports = {
  connect,
  get,
  set,
  del,
  delPattern,
  remember,
  invalidate,
  invalidateNamespace,
  key,
  isEnabled,
  disconnect,
};