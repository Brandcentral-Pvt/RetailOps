const cron = require('node-cron');
const { sql, getPool } = require('../database/db');
const logger = require('../utils/logger');

const OTP_CLEANUP_SCHEDULE = process.env.OTP_CLEANUP_SCHEDULE || '0 3 * * *';

if (process.env.OTP_CLEANUP_ENABLED !== 'false') {
  cron.schedule(OTP_CLEANUP_SCHEDULE, async () => {
    logger.info('✅ OTP cleanup job scheduled (daily at 3 AM)');
    try {
      const pool = await getPool();
      const result = await pool.request()
        .query(`
          DELETE FROM OTPs
          WHERE ExpiresAt < dbo.GetEnvDate()
        `);
      logger.info(`🧹 OTP cleanup: removed ${result.rowsAffected[0] || 0} expired OTPs`);
    } catch (err) {
      logger.error('❌ OTP cleanup failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: process.env.AUTOMATION_TIMEZONE || 'Asia/Kolkata'
  });
} else {
  logger.info('OTP cleanup job is DISABLED');
}