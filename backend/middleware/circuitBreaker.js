/**
 * Circuit Breaker Middleware
 * Provides resilience patterns for external service calls
 * Uses opossum library for circuit breaker implementation
 */

const opossum = require('opossum');

// Circuit breaker configurations for external services
const CIRCUIT_BREAKERS = {
  AMAZON_CREATORS: {
    name: 'amazon_creators',
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 10,
  },
  AMAZON_LIVE: {
    name: 'amazon_live',
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 10,
  },
  AMAZON_SP_API: {
    name: 'amazon_sp_api',
    timeout: 15000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    volumeThreshold: 10,
  },
  KEEPA: {
    name: 'keepa',
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    volumeThreshold: 5,
  },
  OCTOPARSE: {
    name: 'octoparse',
    timeout: 60000,
    errorThresholdPercentage: 50,
    resetTimeout: 120000,
    volumeThreshold: 5,
  },
  OPENAI: {
    name: 'openai',
    timeout: 60000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    volumeThreshold: 10,
  },
  NVIDIA: {
    name: 'nvidia',
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    volumeThreshold: 10,
  },
  COMETCHAT: {
    name: 'cometchat',
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 10,
  },
  PEMS: {
    name: 'pems',
    timeout: 15000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    volumeThreshold: 10,
  },
  DATABASE_READ: {
    name: 'database_read',
    timeout: 15000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 20,
  },
};

// Store for circuit breaker instances
const breakers = new Map();

/**
 * Get or create a circuit breaker instance
 * @param {Object} config - Circuit breaker configuration
 * @returns {opossum.CircuitBreaker}
 */
function getBreaker(config) {
  if (!breakers.has(config.name)) {
    const breaker = new opossum(async (fn) => fn(), {
      timeout: config.timeout,
      errorThresholdPercentage: config.errorThresholdPercentage,
      resetTimeout: config.resetTimeout,
      volumeThreshold: config.volumeThreshold,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: config.name,
    });

    breaker.on('open', () => {
      console.warn(`[CircuitBreaker] ${config.name} OPEN - failing fast`);
    });

    breaker.on('close', () => {
      console.info(`[CircuitBreaker] ${config.name} CLOSED - recovered`);
    });

    breaker.on('halfOpen', () => {
      console.info(`[CircuitBreaker] ${config.name} HALF_OPEN - testing recovery`);
    });

    breaker.on('fallback', (result) => {
      console.warn(`[CircuitBreaker] ${config.name} FALLBACK triggered`);
    });

    breaker.on('timeout', () => {
      console.warn(`[CircuitBreaker] ${config.name} TIMEOUT`);
    });

    breaker.on('failure', (err) => {
      console.error(`[CircuitBreaker] ${config.name} FAILURE:`, err.message);
    });

    breakers.set(config.name, breaker);
  }

  return breakers.get(config.name);
}

/**
 * Create circuit breaker middleware for Express routes
 * @param {Object} config - Circuit breaker configuration from CIRCUIT_BREAKERS
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function circuitBreakerMiddleware(config, options = {}) {
  const breaker = getBreaker(config);
  const { fallback = defaultFallback } = options;

  return async (req, res, next) => {
    // Skip if circuit breaker is disabled via header
    if (req.headers['x-disable-circuit-breaker'] === 'true') {
      return next();
    }

    try {
      // Wrap the route handler with circuit breaker
      const result = await breaker.fire(async () => {
        // Create a promise that resolves when next() is called
        return new Promise((resolve, reject) => {
          const originalSend = res.send;
          res.send = function (body) {
            // Restore original send
            res.send = originalSend;
            // Check if response indicates an error that should count as failure
            if (res.statusCode >= 500) {
              reject(new Error(`HTTP ${res.statusCode}`));
            } else {
              resolve(body);
            }
            return originalSend.call(this, body);
          };

          // Call next to continue to the actual route handler
          next();
        });
      });

      return result;
    } catch (err) {
      // Circuit breaker open or timeout - use fallback
      if (breaker.status.closed === false || err.message.includes('timeout')) {
        return fallback(req, res, err);
      }
      // Other errors - pass to error handler
      next(err);
    }
  };
}

/**
 * Default fallback handler
 */
function defaultFallback(req, res, err) {
  const serviceName = req.path.split('/')[2] || 'service';
  
  res.status(503).json({
    error: 'Service temporarily unavailable',
    message: `${serviceName} is experiencing issues. Please try again later.`,
    code: 'CIRCUIT_BREAKER_OPEN',
    service: serviceName,
    retryAfter: 30,
  });
}

/**
 * Get metrics for all circuit breakers
 * @returns {Object} Metrics for all circuit breakers
 */
function getAllMetrics() {
  const metrics = {};
  
  for (const [name, breaker] of breakers) {
    metrics[name] = {
      state: breaker.status,
      stats: breaker.stats,
      opened: breaker.opened,
      closed: breaker.closed,
      halfOpen: breaker.halfOpen,
      failures: breaker.stats?.failures || 0,
      successes: breaker.stats?.successes || 0,
      timeouts: breaker.stats?.timeouts || 0,
      fallbacks: breaker.stats?.fallbacks || 0,
    };
  }
  
  return metrics;
}

/**
 * Get metrics for a specific circuit breaker
 * @param {string} name - Circuit breaker name
 * @returns {Object|null} Metrics or null if not found
 */
function getMetrics(name) {
  const breaker = breakers.get(name);
  if (!breaker) return null;
  
  return {
    state: breaker.status,
    stats: breaker.stats,
    opened: breaker.opened,
    closed: breaker.closed,
    halfOpen: breaker.halfOpen,
  };
}

/**
 * Manually reset a circuit breaker
 * @param {string} name - Circuit breaker name
 */
function resetBreaker(name) {
  const breaker = breakers.get(name);
  if (breaker) {
    breaker.close();
    console.info(`[CircuitBreaker] ${name} manually reset`);
  }
}

/**
 * Manually open a circuit breaker (for testing/maintenance)
 * @param {string} name - Circuit breaker name
 */
function openBreaker(name) {
  const breaker = breakers.get(name);
  if (breaker) {
    breaker.open();
    console.warn(`[CircuitBreaker] ${name} manually opened`);
  }
}

/**
 * Fire a function with circuit breaker protection (for non-HTTP use)
 * @param {string} name - Circuit breaker name from CIRCUIT_BREAKERS
 * @param {Function} fn - Function to execute
 * @param {Function} fallback - Optional fallback function
 * @returns {Promise<any>}
 */
async function fireWithBreaker(name, fn, fallback) {
  const config = CIRCUIT_BREAKERS[name.toUpperCase()];
  if (!config) {
    throw new Error(`Unknown circuit breaker: ${name}`);
  }
  
  const breaker = getBreaker(config);
  return breaker.fire(fn).catch(fallback || (() => { throw new Error('Circuit breaker open'); }));
}

module.exports = {
  circuitBreakerMiddleware,
  CIRCUIT_BREAKERS,
  getAllMetrics,
  getMetrics,
  resetBreaker,
  openBreaker,
  fireWithBreaker,
};