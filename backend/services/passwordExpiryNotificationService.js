const { sql, getPool } = require('../database/db');
const emailService = require('./emailService');
const passwordExpiryTemplate = require('../emails/templates/auth/passwordExpiry');
const config = require('../config/env');

class PasswordExpiryNotificationService {
  constructor() {
    this.NOTIFICATION_DAYS = [14, 7, 3, 1]; // Send notifications at these intervals before expiry
  }

  async checkAndNotifyExpiringPasswords() {
    try {
      const pool = await getPool();
      const dashboardUrl = config.brand?.dashboardUrl || process.env.DASHBOARD_URL || 'https://data.brandcentral.in';
      const changePasswordUrl = `${dashboardUrl.replace(/\/$/, '')}/change-password`;

      for (const days of this.NOTIFICATION_DAYS) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        const result = await pool.request()
          .input('targetDate', sql.Date, targetDateStr)
          .query(`
            SELECT Id, Email, FirstName, LastName, PasswordExpiresAt
            FROM Users
            WHERE IsActive = 1
            AND ForcePasswordReset = 0
            AND PasswordExpiresAt IS NOT NULL
            AND CAST(PasswordExpiresAt AS DATE) = @targetDate
            AND Email IS NOT NULL
          `);

        const users = result.recordset;

        for (const user of users) {
          try {
            const html = passwordExpiryTemplate({
              userName: user.FirstName,
              daysUntilExpiry: days,
              changePasswordUrl,
              ipAddress: 'Scheduled Check'
            });

            await emailService.send({
              to: user.Email,
              subject: `Your RetailOps Password Expires in ${days} Day${days !== 1 ? 's' : ''}`,
              html
            });

            console.log(`[PasswordExpiry] Sent notification to ${user.Email} for ${days} day${days !== 1 ? 's' : ''} warning`);
          } catch (emailError) {
            console.error(`[PasswordExpiry] Failed to send email to ${user.Email}:`, emailError.message);
          }
        }
      }

      // Also notify users whose passwords have already expired (but haven't been notified recently)
      await this.notifyAlreadyExpired(pool, changePasswordUrl);
    } catch (error) {
      console.error('[PasswordExpiry] Error checking expiring passwords:', error.message);
    }
  }

  async notifyAlreadyExpired(pool, changePasswordUrl) {
    try {
      // Find users with expired passwords who haven't been sent an expiry notification in the last 24 hours
      // We'll use a simple approach: check if there's a log entry for password expiry notification in the last 24h
      const result = await pool.request().query(`
        SELECT u.Id, u.Email, u.FirstName, u.LastName, u.PasswordExpiresAt
        FROM Users u
        WHERE u.IsActive = 1
        AND u.ForcePasswordReset = 0
        AND u.PasswordExpiresAt IS NOT NULL
        AND u.PasswordExpiresAt < dbo.GetEnvDate()
        AND NOT EXISTS (
          SELECT 1 FROM SystemLogs sl
          WHERE sl.EntityId = u.Id
          AND sl.Type = 'PASSWORD_EXPIRY_NOTIFICATION'
          AND sl.CreatedAt > DATEADD(hour, -24, dbo.GetEnvDate())
        )
      `);

      const users = result.recordset;

      for (const user of users) {
        try {
          const html = passwordExpiryTemplate({
            userName: user.FirstName,
            daysUntilExpiry: 0,
            changePasswordUrl,
            ipAddress: 'Scheduled Check'
          });

          await emailService.send({
            to: user.Email,
            subject: 'Your RetailOps Password Has Expired - Action Required',
            html
          });

          // Log the notification
          await pool.request()
            .input('userId', sql.VarChar, user.Id)
            .input('type', sql.NVarChar, 'PASSWORD_EXPIRY_NOTIFICATION')
            .input('entityType', sql.NVarChar, 'USER')
            .input('entityId', sql.VarChar, user.Id)
            .input('entityTitle', sql.NVarChar, user.Email)
            .input('description', sql.NVarChar, 'Password expiry notification sent (already expired)')
            .query(`
              INSERT INTO SystemLogs (Id, Type, EntityType, EntityId, EntityTitle, Description, CreatedAt)
              VALUES (NEWID(), @type, @entityType, @entityId, @entityTitle, @description, dbo.GetEnvDate())
            `);

          console.log(`[PasswordExpiry] Sent expired password notification to ${user.Email}`);
        } catch (emailError) {
          console.error(`[PasswordExpiry] Failed to send expired notification to ${user.Email}:`, emailError.message);
        }
      }
    } catch (error) {
      console.error('[PasswordExpiry] Error notifying already expired users:', error.message);
    }
  }

  async triggerNow() {
    console.log('[PasswordExpiry] Manually triggering password expiry check...');
    await this.checkAndNotifyExpiringPasswords();
  }
}

module.exports = new PasswordExpiryNotificationService();