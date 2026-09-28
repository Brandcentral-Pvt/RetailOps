'use strict';
/**
 * Redis-backed store for express-rate-limit (v8 `Store` interface).
 *
 * Shares ONE ioredis client across every limiter instance, so PM2 cluster
 * workers enforce the same global counters (the default MemoryStore is
 * per-process — each worker would allow its own copy of the limit).
 *
 * Each limiter instance prefixes its keys with its tier name, so the global
 * READ limiter and the route-level STRICT/BULK/AUTH limiters never overwrite
 * each other's counters.
 *
 * Fail-open: if Redis is unreachable the methods throw; limiters are created
 * with `passOnStoreError: true`, so traffic keeps flowing under degraded
 * conditions instead of failing closed.
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let sharedClient = null;
let connectPromise = null;

async function client() {
  if (!sharedClient) {
    sharedClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 3000)),
    });
    sharedClient.on('error', () => {});
    connectPromise = sharedClient.connect().catch((err) => {
      logger.warn('Rate-limit Redis unavailable — traffic passes unrestricted', { error: err.message });
      try { sharedClient.disconnect(); } catch (_) {}
      sharedClient = null;
      connectPromise = null;
      throw err;
    });
  }
  if (connectPromise) await connectPromise;
  return sharedClient;
}

function rateLimitRedisStore(tierName) {
  const prefix = `rl:${tierName}`;
  return {
    localKeys: false,
    prefix,
    windowMs: 60000,

    init(options) {
      this.windowMs = options.windowMs || 60000;
    },

    async get(key) {
      const c = await client();
      const full = `${prefix}:${key}`;
      const raw = await c.get(full);
      const totalHits = parseInt(raw, 10);
      if (!totalHits) return undefined;
      const ttl = await c.pttl(full);
      return {
        totalHits,
        resetTime: ttl >= 0 ? new Date(Date.now() + ttl) : new Date(Date.now() + this.windowMs),
      };
    },

    async increment(key) {
      const c = await client();
      const full = `${prefix}:${key}`;
      const totalHits = await c.incr(full);
      if (totalHits === 1) {
        await c.pexpire(full, this.windowMs);
        return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
      }
      const ttl = await c.pttl(full);
      return {
        totalHits,
        resetTime: ttl > 0 ? new Date(Date.now() + ttl) : new Date(Date.now() + this.windowMs),
      };
    },

    async decrement(key) {
      const c = await client();
      const full = `${prefix}:${key}`;
      const next = await c.decr(full);
      if (next <= 0) await c.del(full);
    },

    async resetKey(key) {
      const c = await client();
      await c.del(`${prefix}:${key}`);
    },

    async resetAll() {
      const c = await client();
      let cursor = '0';
      do {
        const [next, keys] = await c.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 200);
        if (keys && keys.length > 0) await c.del(keys);
        cursor = next;
      } while (cursor !== '0');
    },

    async shutdown() {
      if (sharedClient) {
        try { await sharedClient.quit(); } catch (_) {}
        sharedClient = null;
        connectPromise = null;
      }
    },
  };
}

module.exports = rateLimitRedisStore;