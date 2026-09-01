/**
 * Rate Limiting Configuration
 * Provides per-user, per-endpoint, and global rate limits
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const { key: cacheKey } = require('./cacheService');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const DEFAULT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
      family: 4,
    });
    redisClient.connect().catch(() => {});
  }
  return redisClient;
}

/**
 * Create a rate limiter with Redis store
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    max = DEFAULT_MAX,
    keyGenerator = (req) => req.user?.Id || req.user?._id?.toString() || req.ip,
    message = { error: 'Too many requests, please try again later' },
    statusCode = 429,
    skip = () => false,
    standardHeaders = true,
    legacyHeaders = false,
    handler = null,
  } = options;

  const redis = getRedisClient();

  return rateLimit({
    windowMs,
    max,
    message,
    statusCode,
    standardHeaders,
    legacyHeaders,
    keyGenerator,
    skip,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: 'ratelimit:',
    }),
    handler: handler || ((req, res) => {
      res.status(statusCode).json(message);
    }),
  });
}

/**
 * Global rate limiter - applies to all requests
 */
const globalLimiter = createRateLimiter({
  windowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || '1000', 10),
  keyGenerator: (req) => req.ip,
  message: { error: 'Global rate limit exceeded' },
});

/**
 * Auth rate limiter - stricter limits for login/register
 */
const authLimiter = createRateLimiter({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many authentication attempts, please try again later' },
  skip: (req) => req.method !== 'POST',
});

/**
 * API rate limiter - per authenticated user
 */
const apiLimiter = createRateLimiter({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10),
  keyGenerator: (req) => req.user?.Id || req.user?._id?.toString() || req.ip,
  message: { error: 'API rate limit exceeded, please slow down' },
});

/**
 * Dashboard rate limiter - higher limits for dashboard endpoints
 */
const dashboardLimiter = createRateLimiter({
  windowMs: parseInt(process.env.DASHBOARD_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.DASHBOARD_RATE_LIMIT_MAX || '60', 10),
  keyGenerator: (req) => req.user?.Id || req.user?._id?.toString() || req.ip,
  message: { error: 'Dashboard rate limit exceeded' },
});

/**
 * Sync/Heavy operation rate limiter - very strict
 */
const heavyOpLimiter = createRateLimiter({
  windowMs: parseInt(process.env.HEAVY_OP_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
  max: parseInt(process.env.HEAVY_OP_RATE_LIMIT_MAX || '10', 10),
  keyGenerator: (req) => req.user?.Id || req.user?._id?.toString() || req.ip,
  message: { error: 'Heavy operation rate limit exceeded' },
});

/**
 * Dynamic rate limiter based on user role
 */
function createRoleBasedLimiter(roleLimits = {}) {
  return createRateLimiter({
    windowMs: DEFAULT_WINDOW_MS,
    max: (req) => {
      const role = req.user?.role?.name || 'default';
      return roleLimits[role] || roleLimits.default || DEFAULT_MAX;
    },
    keyGenerator: (req) => req.user?.Id || req.user?._id?.toString() || req.ip,
  });
}

/**
 * Endpoint-specific rate limiter
 */
function createEndpointLimiter(endpoint, max, windowMs = DEFAULT_WINDOW_MS) {
  return createRateLimiter({
    windowMs,
    max,
    keyGenerator: (req) => `${req.user?.Id || req.ip}:${endpoint}`,
    message: { error: `Rate limit exceeded for ${endpoint}` },
  });
}

/**
 * Skip rate limiting for health checks and internal requests
 */
const skipHealthChecks = (req) => {
  return req.path === '/health' || 
         req.path === '/ready' || 
         req.path === '/metrics' ||
         req.headers['x-internal-request'] === 'true';
};

module.exports = {
  createRateLimiter,
  globalLimiter,
  authLimiter,
  apiLimiter,
  dashboardLimiter,
  heavyOpLimiter,
  createRoleBasedLimiter,
  createEndpointLimiter,
  skipHealthChecks,
};