/**
 * Load Balancing Integration Middleware
 * Applies all load balancing features to routes
 */

const { 
  globalLimiter, 
  apiLimiter, 
  dashboardLimiter, 
  authLimiter, 
  heavyOpLimiter,
  skipHealthChecks 
} = require('./rateLimiter');

const { 
  requestDeduplication, 
  distributedDeduplication 
} = require('./requestDeduplication');

const { circuitBreakerMiddleware, CIRCUIT_BREAKERS } = require('./circuitBreaker');

const cacheService = require('./cacheService');
const queueService = require('./queueService');

/**
 * Initialize all load balancing services
 */
async function initLoadBalancing() {
  // Connect to Redis
  await cacheService.connect();
  
  // Initialize queue service
  await queueService.getQueue('init');
  
  console.log('Load balancing services initialized');
}

/**
 * Apply global middleware stack
 */
function applyGlobalMiddleware(app) {
  // Skip health checks from all rate limiting
  app.use(skipHealthChecks);
  
  // Global rate limiter (applied to all requests)
  app.use(globalLimiter);
  
  // Request deduplication (in-memory, per-process)
  app.use(requestDeduplication({
    methods: ['GET', 'HEAD'],
    ttlMs: 5000,
  }));
}

/**
 * Apply API-specific middleware
 */
function applyApiMiddleware(app) {
  // API rate limiter for all /api routes
  app.use('/api', apiLimiter);
  
  // Dashboard-specific rate limiter
  app.use('/api/dashboard', dashboardLimiter);
  
  // Auth rate limiter
  app.use('/api/auth', authLimiter);
  
  // Heavy operation rate limiter
  app.use('/api/export', heavyOpLimiter);
  app.use('/api/reports', heavyOpLimiter);
  app.use('/api/sync', heavyOpLimiter);
}

/**
 * Apply circuit breakers to external service routes
 */
function applyCircuitBreakers(app) {
  // Amazon APIs
  app.use('/api/creators', circuitBreakerMiddleware(CIRCUIT_BREAKERS.AMAZON_CREATORS));
  app.use('/api/live', circuitBreakerMiddleware(CIRCUIT_BREAKERS.AMAZON_LIVE));
  app.use('/api/amazon', circuitBreakerMiddleware(CIRCUIT_BREAKERS.AMAZON_SP_API));
  
  // Keepa
  app.use('/api/keepa', circuitBreakerMiddleware(CIRCUIT_BREAKERS.KEEPA));
  
  // Octoparse
  app.use('/api/octoparse', circuitBreakerMiddleware(CIRCUIT_BREAKERS.OCTOPARSE));
  
  // OpenAI
  app.use('/api/ai', circuitBreakerMiddleware(CIRCUIT_BREAKERS.OPENAI));
  
  // NVIDIA
  app.use('/api/nvidia', circuitBreakerMiddleware(CIRCUIT_BREAKERS.NVIDIA));
  
  // CometChat
  app.use('/api/chat', circuitBreakerMiddleware(CIRCUIT_BREAKERS.COMETCHAT));
  
  // PEMS
  app.use('/api/pems', circuitBreakerMiddleware(CIRCUIT_BREAKERS.PEMS));
  
  // Database read operations
  app.use('/api/dashboard', circuitBreakerMiddleware(CIRCUIT_BREAKERS.DATABASE_READ, {
    failureThreshold: 10,
    timeout: 15000,
  }));
}

/**
 * Enhanced dashboard data fetching with distributed cache
 */
async function getDashboardDataWithCache(req, fetchFn) {
  const userId = req.user?.Id || req.user?._id?.toString() || 'anonymous';
  const sellerId = req.query.sellerId || 'all';
  const period = req.query.period || '30d';
  
  const cacheKey = `dashboard:${userId}:${sellerId}:${period}`;
  
  // Use rememberWithLock to prevent thundering herd
  return cacheService.rememberWithLock(
    cacheKey,
    fetchFn,
    60, // 60 second cache TTL
    30000 // 30 second lock TTL
  );
}

/**
 * Queue heavy dashboard operations
 */
async function queueDashboardRefresh(req, res, next) {
  // For very heavy dashboard loads, offer async processing
  const isHeavy = req.query.async === 'true';
  
  if (isHeavy) {
    try {
      const job = await queueService.queueDashboardRefresh(
        req.user?.Id || req.user?._id?.toString(),
        req.query
      );
      
      return res.json({
        queued: true,
        jobId: job.id,
        message: 'Dashboard refresh queued. Poll for results.',
      });
    } catch (err) {
      // Fall through to synchronous processing
      console.warn('Queue unavailable, processing synchronously:', err.message);
    }
  }
  next();
}

/**
 * Graceful degradation for high load
 */
function loadShedding(options = {}) {
  const { 
    maxConcurrent = 100, 
    queueLimit = 50,
    retryAfter = 5 
  } = options;
  
  let activeRequests = 0;
  let queuedRequests = 0;
  
  return (req, res, next) => {
    // Skip for health checks
    if (req.path === '/health' || req.path === '/ready') {
      return next();
    }
    
    // Check if we're at capacity
    if (activeRequests >= maxConcurrent) {
      if (queuedRequests >= queueLimit) {
        return res.status(503).json({
          error: 'Server at capacity, please retry',
          retryAfter,
          code: 'LOAD_SHEDDING',
        });
      }
      
      // Queue this request
      queuedRequests++;
      const checkInterval = setInterval(() => {
        if (activeRequests < maxConcurrent) {
          clearInterval(checkInterval);
          queuedRequests--;
          activeRequests++;
          next();
        }
      }, 100);
      
      // Timeout after retryAfter seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        queuedRequests--;
        if (!res.headersSent) {
          res.status(503).json({
            error: 'Request timed out waiting for capacity',
            retryAfter,
            code: 'LOAD_SHEDDING_TIMEOUT',
          });
        }
      }, retryAfter * 1000);
      
      return;
    }
    
    activeRequests++;
    
    const cleanup = () => {
      activeRequests--;
    };
    
    res.on('finish', cleanup);
    res.on('close', cleanup);
    
    next();
  };
}

/**
 * Health check endpoint with circuit breaker status
 */
function createHealthCheck() {
  return async (req, res) => {
    const cbMetrics = require('./circuitBreaker').getAllMetrics();
    const queueStats = await queueService.getAllQueueStats();
    const cacheEnabled = cacheService.isEnabled();
    
    // Check if any critical circuit breakers are open
    const criticalOpen = Object.entries(cbMetrics).some(
      ([name, metrics]) => metrics.state === 'open' && 
        ['database_read', 'amazon_sp_api'].includes(name)
    );
    
    const status = criticalOpen ? 'degraded' : 'healthy';
    
    res.json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      circuitBreakers: cbMetrics,
      queues: queueStats,
      cache: { enabled: cacheEnabled },
      load: {
        activeRequests: 0, // Would need tracking
      },
    });
  };
}

/**
 * Ready check for Kubernetes/load balancer
 */
function createReadyCheck() {
  return async (req, res) => {
    const cacheEnabled = cacheService.isEnabled();
    const dbPool = require('../database/db').getPool;
    
    try {
      // Quick DB connectivity check
      const pool = await dbPool();
      await pool.request().query('SELECT 1');
      
      res.json({
        ready: true,
        database: 'connected',
        cache: cacheEnabled ? 'connected' : 'unavailable',
      });
    } catch (err) {
      res.status(503).json({
        ready: false,
        database: 'disconnected',
        cache: cacheEnabled ? 'connected' : 'unavailable',
        error: err.message,
      });
    }
  };
}

module.exports = {
  initLoadBalancing,
  applyGlobalMiddleware,
  applyApiMiddleware,
  applyCircuitBreakers,
  getDashboardDataWithCache,
  queueDashboardRefresh,
  loadShedding,
  createHealthCheck,
  createReadyCheck,
};