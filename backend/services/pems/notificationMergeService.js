/**
 * PEMS Notification Merge Service
 * Combines PEMS task notifications with legacy Notifications rows
 * into a single, time-ordered feed (Source = 'PEMS' | 'LEGACY').
 */
const { sql, getPool } = require('../../database/db');

async function getMergedNotifications(userId, limit = 20) {
  const pool = await getPool();
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const result = await pool.request()
    .input('userId', sql.VarChar, userId)
    .input('limit', sql.Int, safeLimit)
    .query(`
      SELECT TOP (@limit) Id, ReferenceId, UserId, Type, Title, Message, IsRead, CreatedAt, Source
      FROM (
        SELECT
          Id,
          TaskInstanceId AS ReferenceId,
          UserId,
          Type,
          Title,
          Message,
          IsRead,
          CreatedAt,
          'PEMS' AS Source
        FROM PemsNotifications
        WHERE UserId = @userId

        UNION ALL

        SELECT
          Id,
          ReferenceId,
          RecipientId AS UserId,
          Type,
          Type AS Title,
          Message,
          IsRead,
          CreatedAt,
          'LEGACY' AS Source
        FROM Notifications
        WHERE RecipientId = @userId
      ) merged
      ORDER BY CreatedAt DESC
    `);

  return result.recordset || [];
}

module.exports = { getMergedNotifications };
