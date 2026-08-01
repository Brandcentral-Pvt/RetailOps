const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

const DEFAULT_CACHE_TTL = 300;
const CACHEABLE_METHODS = ['GET'];

function shouldCache(req) {
  if (!CACHEABLE_METHODS.includes(req.method)) return false;
  const noCache = req.headers['cache-control'] === 'no-cache' || req.query._skipCache === 'true';
  return !noCache;
}

function cacheRoute(ttl = DEFAULT_CACHE_TTL) {
  return async (req, res, next) => {
    if (!shouldCache(req)) return next();

    const cacheKey = cacheService.key('route', req.originalUrl.replace(/\?.*$/, '').replace(/\/+/g, ':'));

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

function invalidateCache(pattern) {
  return async (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.delPattern(pattern).catch(() => {});
      }
    });
    next();
  };
}

module.exports = { cacheRoute, invalidateCache };
