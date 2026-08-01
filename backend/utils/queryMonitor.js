const logger = require('./logger');

const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10);
const enabled = process.env.QUERY_MONITOR_ENABLED !== 'false';

function wrapQuery(originalQuery, context = '') {
  return async function monitoredQuery(...args) {
    if (!enabled) return originalQuery(...args);

    const start = Date.now();
    try {
      const result = await originalQuery(...args);
      const duration = Date.now() - start;
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn(`Slow query (${duration}ms)`, {
          durationMs: duration,
          threshold: SLOW_QUERY_THRESHOLD_MS,
          context,
          args: args.map(a => typeof a === 'string' ? a.substring(0, 200) : typeof a).join(', '),
        });
      }
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      logger.error(`Query failed (${duration}ms)`, {
        durationMs: duration,
        context,
        error: err.message,
      });
      throw err;
    }
  };
}

module.exports = { wrapQuery, SLOW_QUERY_THRESHOLD_MS };
