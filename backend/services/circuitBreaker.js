/**
 * Circuit Breaker for External API Calls
 * Prevents cascade failures when external services are down
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CB_PREFIX = 'cb:';

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      family: 4,
      connectTimeout: 5000,
      commandTimeout: 2000,
    });
    redisClient.connect().catch(() => {});
  }
  return redisClient;
}

/**
 * Circuit Breaker States
 */
const STATES = {
  CLOSED: 'closed',      // Normal operation, requests pass through
  OPEN: 'open',          // Failing, requests blocked immediately
  HALF_OPEN: 'half_open', // Testing if service recovered
};

/**
 * Circuit Breaker Class
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000; // Time in OPEN state before HALF_OPEN
    this.rollingWindow = options.rollingWindow || 60000; // Time window for failure counting
    this.minimumRequests = options.minimumRequests || 5; // Min requests before evaluating
    
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.requestCount = 0;
    this.lastStateChange = Date.now();
    
    this.onStateChange = options.onStateChange || (() => {});
  }

  /**
   * Get current state, transitioning if needed
   */
  async getState() {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === STATES.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        await this.transitionTo(STATES.HALF_OPEN);
      }
    }
    return this.state;
  }

  /**
   * Record a successful request
   */
  async recordSuccess() {
    this.requestCount++;
    
    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        await this.transitionTo(STATES.CLOSED);
      }
    } else if (this.state === STATES.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
    
    await this.persistState();
  }

  /**
   * Record a failed request
   */
  async recordFailure() {
    this.requestCount++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === STATES.HALF_OPEN) {
      // Any failure in half-open goes back to open
      await this.transitionTo(STATES.OPEN);
    } else if (this.state === STATES.CLOSED) {
      // Check if we should open the circuit
      if (this.requestCount >= this.minimumRequests) {
        const failureRate = this.failureCount / this.requestCount;
        if (failureRate >= (this.failureThreshold / this.minimumRequests)) {
          await this.transitionTo(STATES.OPEN);
        }
      }
    }
    
    await this.persistState();
  }

  /**
   * Transition to a new state
   */
  async transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    
    if (newState === STATES.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.requestCount = 0;
    } else if (newState === STATES.HALF_OPEN) {
      this.successCount = 0;
    } else if (newState === STATES.OPEN) {
      this.lastFailureTime = Date.now();
    }
    
    logger.warn(`Circuit breaker ${this.name} state change: ${oldState} -> ${newState}`);
    this.onStateChange(this.name, oldState, newState);
    
    await this.persistState();
  }

  /**
   * Persist state to Redis for distributed circuit breaking
   */
  async persistState() {
    try {
      const redis = getRedisClient();
      const key = `${CB_PREFIX}${this.name}`;
      const data = {
        state: this.state,
        failureCount: this.failureCount,
        successCount: this.successCount,
        requestCount: this.requestCount,
        lastFailureTime: this.lastFailureTime,
        lastStateChange: this.lastStateChange,
      };
      await redis.setex(key, 300, JSON.stringify(data)); // 5 min TTL
    } catch (err) {
      // Non-critical, just log
      logger.debug(`Circuit breaker persist failed: ${err.message}`);
    }
  }

  /**
   * Load state from Redis
   */
  async loadState() {
    try {
      const redis = getRedisClient();
      const key = `${CB_PREFIX}${this.name}`;
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        this.state = parsed.state;
        this.failureCount = parsed.failureCount || 0;
        this.successCount = parsed.successCount || 0;
        this.requestCount = parsed.requestCount || 0;
        this.lastFailureTime = parsed.lastFailureTime || 0;
        this.lastStateChange = parsed.lastStateChange || Date.now();
      }
    } catch (err) {
      logger.debug(`Circuit breaker load failed: ${err.message}`);
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn) {
    const state = await this.getState();
    
    if (state === STATES.OPEN) {
      const error = new Error(`Circuit breaker ${this.name} is OPEN`);
      error.code = 'CIRCUIT_OPEN';
      error.retryAfter = Math.ceil((this.timeout - (Date.now() - this.lastFailureTime)) / 1000);
      throw error;
    }

    try {
      const result = await fn();
      await this.recordSuccess();
      return result;
    } catch (err) {
      await this.recordFailure();
      throw err;
    }
  }

  /**
   * Check if circuit allows requests
   */
  async canExecute() {
    const state = await this.getState();
    return state !== STATES.OPEN;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      failureRate: this.requestCount > 0 ? this.failureCount / this.requestCount : 0,
      lastStateChange: this.lastStateChange,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Manual reset (for admin/ops)
   */
  async reset() {
    await this.transitionTo(STATES.CLOSED);
  }

  /**
   * Force open (for maintenance)
   */
  async forceOpen() {
    await this.transitionTo(STATES.OPEN);
  }
}

// In-memory registry for single-process use
const breakers = new Map();

/**
 * Get or create a circuit breaker
 */
function getCircuitBreaker(name, options = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  return breakers.get(name);
}

/**
 * Get all circuit breaker metrics
 */
function getAllMetrics() {
  const metrics = {};
  for (const [name, breaker] of breakers) {
    metrics[name] = breaker.getMetrics();
  }
  return metrics;
}

/**
 * Express middleware for circuit breaker
 */
function circuitBreakerMiddleware(name, options = {}) {
  const breaker = getCircuitBreaker(name, options);
  
  return async (req, res, next) => {
    // Skip for health checks
    if (req.path === '/health' || req.path === '/ready') {
      return next();
    }

    try {
      const canExecute = await breaker.canExecute();
      if (!canExecute) {
        return res.status(503).json({
          error: `Service temporarily unavailable: ${name}`,
          code: 'CIRCUIT_OPEN',
          retryAfter: Math.ceil(options.timeout / 1000) || 30,
        });
      }
      next();
    } catch (err) {
      logger.error(`Circuit breaker middleware error: ${err.message}`);
      next(); // Fail open - don't block on circuit breaker errors
    }
  };
}

/**
 * Predefined circuit breakers for common external services
 */
const CIRCUIT_BREAKERS = {
  // Amazon APIs
  AMAZON_CREATORS: 'amazon_creators',
  AMAZON_LIVE: 'amazon_live',
  AMAZON_SP_API: 'amazon_sp_api',
  
  // Keepa
  KEEPA: 'keepa',
  
  // Octoparse
  OCTOPARSE: 'octoparse',
  
  // OpenAI
  OPENAI: 'openai',
  
  // NVIDIA AI
  NVIDIA: 'nvidia',
  
  // CometChat
  COMETCHAT: 'cometchat',
  
  // PEMS
  PEMS: 'pems',
  
  // Database (for read operations)
  DATABASE_READ: 'database_read',
  
  // File storage
  FILE_STORAGE: 'file_storage',
};

/**
 * Create a circuit breaker with default config for a service
 */
function createServiceBreaker(serviceName, customOptions = {}) {
  const defaultOptions = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    rollingWindow: 60000,
    minimumRequests: 10,
  };
  
  return getCircuitBreaker(serviceName, { ...defaultOptions, ...customOptions });
}

module.exports = {
  CircuitBreaker,
  getCircuitBreaker,
  getAllMetrics,
  circuitBreakerMiddleware,
  CIRCUIT_BREAKERS,
  createServiceBreaker,
  STATES,
};