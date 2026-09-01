/**
 * Rate Limiting Configuration
 * Fixed for express-rate-limit v7/v8 compatibility
 * Uses memory store by default to prevent Redis constructor errors
 * Uses ipKeyGenerator helper for IPv6 support
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Define rate limit tiers
const TIERS = {
  PUBLIC: { windowMs: 60 * 1000, max: 100 },    // 100 req/min
  AUTH:   { windowMs: 15 * 60 * 1000, max: 20 }, // 20 req/15min (login)
  READ:   { windowMs: 60 * 1000, max: 300 },    // 300 req/min
  WRITE:  { windowMs: 60 * 1000, max: 50 },     // 50 req/min
  BULK:   { windowMs: 60 * 1000, max: 10 },     // 10 req/min
  IMPORT: { windowMs: 60 * 1000, max: 5 },      // 5 req/min
  STRICT: { windowMs: 60 * 1000, max: 30 }      // 30 req/min
};

/**
 * Creates a rate limiter instance
 * @param {string} tierName - Key from TIERS object
 * @param {function} keyGenerator - Optional custom key generator
 */
function createLimiter(tierName, keyGenerator) {
  const tier = TIERS[tierName];

  if (!tier) {
    console.error(`[RateLimiter] Unknown tier: ${tierName}. Defaulting to PUBLIC.`);
    return createLimiter('PUBLIC');
  }

  return rateLimit({
    windowMs: tier.windowMs,
    max: tier.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ipKeyGenerator,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded for ${tierName}. Please try again later.`,
        retryAfter: Math.ceil(tier.windowMs / 1000)
      });
    },
    skip: (req) => req.path === '/api/health' || req.path === '/health' || req.path === '/ready'
  });
}

// Pre-created limiters for common use cases
const publicLimiter = createLimiter('PUBLIC');
const authLimiter = createLimiter('AUTH');
const readLimiter = createLimiter('READ');
const writeLimiter = createLimiter('WRITE');
const bulkLimiter = createLimiter('BULK');
const importLimiter = createLimiter('IMPORT');
const strictLimiter = createLimiter('STRICT');

// Load balancing specific limiters
const globalLimiter = createLimiter('PUBLIC');
const apiLimiter = createLimiter('READ');
const dashboardLimiter = createLimiter('READ');
const heavyOpLimiter = createLimiter('BULK');

/**
 * Skip rate limiting for health checks
 */
const skipHealthChecks = (req) => {
  return req.path === '/api/health' || 
         req.path === '/health' || 
         req.path === '/ready' ||
         req.path === '/metrics' ||
         req.headers['x-internal-request'] === 'true';
};

module.exports = {
  createLimiter,
  TIERS,
  publicLimiter,
  authLimiter,
  readLimiter,
  writeLimiter,
  bulkLimiter,
  importLimiter,
  strictLimiter,
  // Load balancing specific
  globalLimiter,
  apiLimiter,
  dashboardLimiter,
  heavyOpLimiter,
  skipHealthChecks,
};