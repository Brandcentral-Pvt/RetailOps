const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const TIERS = {
  PUBLIC: { windowMs: 60 * 1000, max: 100 },
  AUTH: { windowMs: 60 * 1000, max: 20 },
  READ: { windowMs: 60 * 1000, max: 300 },
  WRITE: { windowMs: 60 * 1000, max: 50 },
  BULK: { windowMs: 60 * 1000, max: 10 },
  IMPORT: { windowMs: 60 * 1000, max: 5 },
  STRICT: { windowMs: 60 * 1000, max: 30 },
};

function createLimiter(tierName) {
  const tier = TIERS[tierName];
  if (!tier) throw new Error(`Unknown rate limit tier: ${tierName}`);

  return rateLimit({
    windowMs: tier.windowMs,
    max: tier.max,
    message: { success: false, error: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Per-user limiting when authenticated; IPv6-safe IP fallback otherwise.
      if (req.user?.Id) return `user:${req.user.Id}`;
      return ipKeyGenerator()(req) || 'unknown';
    },
  });
}

module.exports = { TIERS, createLimiter };
