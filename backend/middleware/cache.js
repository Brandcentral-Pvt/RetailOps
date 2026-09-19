const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');
const crypto = require('crypto');

const DEFAULT_CACHE_TTL = 300;
const CACHEABLE_METHODS = ['GET'];

function shouldCache(req) {
  if (!CACHEABLE_METHODS.includes(req.method)) return false;
  const noCache = req.headers['cache-control'] === 'no-cache' || req.query._skipCache === 'true';
  return !noCache;
}

/** Stable hash of the sorted query string so different filters never share a key. */
function queryFingerprint(query = {}) {
  const entries = Object.keys(query)
    .sort()
    .map((k) => {
      const v = Array.isArray(query[k]) ? [...query[k]].sort().join(',') : String(query[k]);
      return `${k}=${v}`;
    });
  return crypto.createHash('sha1').update(entries.join('&')).digest('hex').slice(0, 12);
}

/**
 * Namespace-based route cache.
 * Keys are `route:{namespace}:{normalizedPath}:u:{userId}:q:{queryHash}` so
 * invalidation is precise: `invalidateCache(namespace)` deletes exactly that
 * namespace's keys.
 *
 * ✅ Cache-isolation fix: the key previously used ONLY the path with the
 * query string stripped and no user identity — `/instances?sellerId=A` and
 * `/instances?sellerId=B` shared one cache entry, so one user's scoped
 * response was served to another user (and any query variation returned
 * whatever was cached first). The key now includes the authenticated user
 * and a fingerprint of the sorted query string.
 *
 * Usage: router.get('/instances', auth, cacheRoute('pems:instances', 30), ctrl.getInstances)
 */
function cacheRoute(namespace, ttl = DEFAULT_CACHE_TTL) {
  return async (req, res, next) => {
    if (!shouldCache(req)) return next();

    const normalizedPath = req.originalUrl.replace(/\?.*$/, '').replace(/\/+/g, ':');
    const userId = req.user?.Id || req.user?._id || 'anonymous';
    const cacheKey = cacheService.key(
      'route', namespace, normalizedPath,
      `u:${userId}`, `q:${queryFingerprint(req.query)}`
    );

    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return res.json(cached);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.set(cacheKey, body, ttl).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Namespace-based invalidation middleware for write routes.
 * Usage: router.post('/instances', auth, invalidateCache('pems:instances'), ctrl.createInstance)
 */
function invalidateCache(namespace) {
  return async (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.invalidateNamespace(namespace).catch(err => {
          logger.warn('Cache invalidation error', { namespace, error: err.message });
        });
      }
    });
    next();
  };
}

module.exports = { cacheRoute, invalidateCache, DEFAULT_CACHE_TTL };
