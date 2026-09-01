/**
 * Request Deduplication Middleware
 * Prevents duplicate concurrent requests for the same endpoint+params from the same user
 * Uses in-memory + Redis for distributed deduplication
 */

const { dedup, key: cacheKey } = require('./cacheService');

const inflight = new Map();
const DEDUP_TTL_MS = parseInt(process.env.DEDUP_TTL_MS || '5000', 10);

/**
 * Generate a deduplication key from request
 */
function generateDedupKey(req) {
  const userId = req.user?.Id || req.user?._id?.toString() || req.ip || 'anonymous';
  const method = req.method;
  const path = req.route?.path || req.path || req.originalUrl;
  const query = JSON.stringify(req.query);
  const body = req.method !== 'GET' ? JSON.stringify(req.body || {}) : '';
  return `dedup:${userId}:${method}:${path}:${query}:${body}`;
}

/**
 * Express middleware for request deduplication
 * @param {Object} options - Configuration options
 * @param {number} options.ttlMs - Time to hold deduplication (default: 5000ms)
 * @param {string[]} options.methods - HTTP methods to deduplicate (default: ['GET'])
 * @param {Function} options.keyGenerator - Custom key generator function
 */
function requestDeduplication(options = {}) {
  const {
    ttlMs = DEDUP_TTL_MS,
    methods = ['GET'],
    keyGenerator = generateDedupKey,
    skip = () => false,
  } = options;

  return async (req, res, next) => {
    // Skip if method not in list
    if (!methods.includes(req.method)) {
      return next();
    }

    // Skip if custom skip function returns true
    if (skip(req)) {
      return next();
    }

    const dedupKeyStr = keyGenerator(req);
    
    // Check in-flight requests (same process)
    if (inflight.has(dedupKeyStr)) {
      const { promise, timestamp } = inflight.get(dedupKeyStr);
      // Check if expired
      if (Date.now() - timestamp < ttlMs) {
        try {
          const result = await promise;
          return res.json(result);
        } catch (err) {
          // If failed, remove and let new request through
          inflight.delete(dedupKeyStr);
        }
      } else {
        inflight.delete(dedupKeyStr);
      }
    }

    // Create promise for this request
    const originalJson = res.json.bind(res);
    let responseSent = false;
    let responseData = null;

    res.json = (data) => {
      responseSent = true;
      responseData = data;
      return originalJson(data);
    };

    const promise = new Promise((resolve, reject) => {
      const originalEnd = res.end.bind(res);
      res.end = (chunk, encoding, callback) => {
        if (!responseSent && responseData) {
          resolve(responseData);
        }
        return originalEnd(chunk, encoding, callback);
      };
    });

    inflight.set(dedupKeyStr, { promise, timestamp: Date.now() });

    // Clean up after response
    res.on('finish', () => {
      setTimeout(() => {
        inflight.delete(dedupKeyStr);
      }, ttlMs);
    });

    res.on('close', () => {
      inflight.delete(dedupKeyStr);
    });

    next();
  };
}

/**
 * Distributed request deduplication using Redis
 * Works across multiple workers/instances
 */
function distributedDeduplication(options = {}) {
  const { ttlMs = DEDUP_TTL_MS, methods = ['GET'], keyGenerator = generateDedupKey, skip = () => false } = options;

  return async (req, res, next) => {
    if (!methods.includes(req.method)) return next();
    if (skip(req)) return next();

    const dedupKeyStr = keyGenerator(req);
    
    // Use Redis-based deduplication
    const redisKey = cacheKey(dedupKeyStr);
    
    try {
      // Try to set a lock for this request
      const { acquireLock } = require('./cacheService');
      const { acquired, release } = await acquireLock(dedupKeyStr, ttlMs);
      
      if (!acquired) {
        // Another request is processing, wait for result
        const cached = await require('./cacheService').get(redisKey);
        if (cached !== null) {
          return res.json(cached);
        }
        // Wait briefly and try again
        await new Promise(r => setTimeout(r, 50));
        const retry = await require('./cacheService').get(redisKey);
        if (retry !== null) return res.json(retry);
      }

      // Wrap response to cache result
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (data && !res.headersSent) {
          require('./cacheService').set(redisKey, data, Math.ceil(ttlMs / 1000));
        }
        return originalJson(data);
      };

      res.on('finish', () => release());
      res.on('close', () => release());

    } catch (err) {
      // On error, just proceed without deduplication
      console.warn('Deduplication error:', err.message);
    }

    next();
  };
}

/**
 * Clear all in-flight deduplication keys (for testing/admin)
 */
function clearDedupCache() {
  inflight.clear();
}

module.exports = {
  requestDeduplication,
  distributedDeduplication,
  generateDedupKey,
  clearDedupCache,
};