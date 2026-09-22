/**
 * Device push notifications via the Expo Push Service.
 *
 * Push tokens are stored per-user in the `PushTokens` table (auto-created on
 * first use). Whenever the app creates an in-app notification for a user, the
 * matching device tokens are dispatched to the Expo Push Service which forwards
 * them to APNs (iOS) / FCM (Android).
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
const { sql, getPool, generateId } = require('../database/db');
const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;
const MAX_TOKENS_PER_USER = 5;
const TOKEN_RE = /^ExpoPushToken\[|^ExponentPushToken\[/;

let schemaPromise = null;

async function ensureSchema() {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            const pool = await getPool();
            await pool.request().query(`
                IF OBJECT_ID(N'dbo.PushTokens', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.PushTokens (
                        Id VARCHAR(24) NOT NULL,
                        UserId VARCHAR(24) NOT NULL,
                        Token NVARCHAR(255) NOT NULL,
                        Platform NVARCHAR(20) NULL,
                        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                        CONSTRAINT PK_PushTokens PRIMARY KEY (Id),
                        CONSTRAINT UQ_PushTokens_Token UNIQUE (Token)
                    );
                    CREATE INDEX IX_PushTokens_UserId ON dbo.PushTokens (UserId);
                END
            `);
        })().catch((err) => {
            schemaPromise = null;
            logger.error('PushTokens schema setup failed', { error: err.message });
            throw err;
        });
    }
    return schemaPromise;
}

/**
 * Register (upsert) a device push token for a user.
 */
async function registerToken(userId, token, platform = null) {
    await ensureSchema();
    const pool = await getPool();

    const existing = await pool.request()
        .input('token', sql.NVarChar, token)
        .query(`SELECT Id, UserId FROM dbo.PushTokens WHERE Token = @token`);
    const row = existing.recordset[0];

    if (row) {
        await pool.request()
            .input('id', sql.VarChar, row.Id)
            .input('userId', sql.VarChar, userId)
            .input('platform', sql.NVarChar, platform)
            .input('token', sql.NVarChar, token)
            .query(`
                UPDATE dbo.PushTokens
                SET UserId = @userId, Platform = @platform, UpdatedAt = dbo.GetEnvDate()
                WHERE Id = @id
            `);
    } else {
        await pool.request()
            .input('id', sql.VarChar, generateId())
            .input('userId', sql.VarChar, userId)
            .input('platform', sql.NVarChar, platform)
            .input('token', sql.NVarChar, token)
            .query(`
                INSERT INTO dbo.PushTokens (Id, UserId, Token, Platform, CreatedAt, UpdatedAt)
                VALUES (@id, @userId, @token, @platform, dbo.GetEnvDate(), dbo.GetEnvDate())
            `);
    }

    // Keep the number of tokens per user bounded (devices/users churn over time).
    await pool.request()
        .input('userId', sql.VarChar, userId)
        .input('max', sql.Int, MAX_TOKENS_PER_USER)
        .query(`
            DELETE pt FROM dbo.PushTokens pt
            INNER JOIN (
                SELECT Id, ROW_NUMBER() OVER (ORDER BY UpdatedAt DESC) AS rn
                FROM dbo.PushTokens WHERE UserId = @userId
            ) ranked ON pt.Id = ranked.Id
            WHERE ranked.rn > @max
        `);
}

/**
 * Remove a push token (e.g. user logs out of a device). Only tokens owned by
 * the given user are removed.
 */
async function unregisterToken(userId, token) {
    await ensureSchema();
    const pool = await getPool();
    await pool.request()
        .input('userId', sql.VarChar, userId)
        .input('token', sql.NVarChar, token)
        .query(`DELETE FROM dbo.PushTokens WHERE Token = @token AND UserId = @userId`);
}

/**
 * Send a push notification to every device registered for a user.
 * Best-effort: failures are logged, never thrown to the caller.
 */
async function sendPush(userId, { title, body, data = {} } = {}) {
    try {
        await ensureSchema();
        const pool = await getPool();

        const result = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`SELECT Token, Platform FROM dbo.PushTokens WHERE UserId = @userId`);

        const tokens = result.recordset
            .map((r) => r.Token)
            .filter((t) => typeof t === 'string' && TOKEN_RE.test(t))
            .slice(0, BATCH_SIZE);

        if (tokens.length === 0) return { sent: 0, failed: 0, skipped: true };

        const message = {
            to: null, // replaced per token below
            title: String(title || 'RetailOps').slice(0, 180),
            body: String(body || '').slice(0, 2000),
            data: {
                ...(data || {}),
                channelId: 'default',
            },
            sound: 'default',
        };

        let sent = 0;
        let failed = 0;

        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const chunk = tokens.slice(i, i + BATCH_SIZE).map((to) => ({ ...message, to }));
            try {
                const response = await fetch(EXPO_PUSH_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chunk),
                });
                if (!response.ok) {
                    const text = await response.text().catch(() => '');
                    logger.error('Expo push request failed', {
                        status: response.status,
                        body: text.slice(0, 500),
                    });
                    failed += chunk.length;
                    continue;
                }
                const payload = await response.json();
                payload.forEach((item) => {
                    if (item && item.status === 'ok') sent += 1;
                    else failed += 1;
                });
            } catch (err) {
                logger.error('Expo push request error', { error: err.message });
                failed += chunk.length;
            }
        }

        return { sent, failed, skipped: false };
    } catch (err) {
        logger.error('Expo push dispatch error', { userId, error: err.message });
        return { sent: 0, failed: 0, skipped: true };
    }
}

module.exports = {
    registerToken,
    unregisterToken,
    sendPush,
};