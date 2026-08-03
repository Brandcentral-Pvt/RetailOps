const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

const DEFAULT_CACHE_TTL = 300;
const CACHEABLE_METHODS = ['GET'];

function shouldCache(req) {
  if (!CACHEABLE_METHODS.includes(req.method)) return false;
  const noCache = req.headers['cache-control'] === 'no-cache' || req.query._skipCache === 'true';
  return !noCache;
}

/**
 * Namespace-based route cache.
 * Keys are `route:{namespace}:{normalizedPath}` so invalidation is precise:
 * `invalidateCache(namespace)` deletes exactly that namespace's keys.
 *
 * Usage: router.get('/instances', auth, cacheRoute('pems:instances', 30), ctrl.getInstances)
 */
function cacheRoute(namespace, ttl = DEFAULT_CACHE_TTL) {
  return async (req, res, next) => {
    if (!shouldCache(req)) return next();

    const normalizedPath = req.originalUrl.replace(/\?.*$/, '').replace(/\/+/g, ':');
    const cacheKey = cacheService.key('route', namespace, normalizedPath);

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
