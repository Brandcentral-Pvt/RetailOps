const sql = require('mssql');
const net = require('net');
const path = require('path');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const logger = require('../utils/logger');

// Node 24+/26 refuses to set the TLS `servername` to an IP literal
// (ERR_INVALID_ARG_VALUE). When the SQL host is an IP address, TLS is
// disabled by default — override explicitly with DB_ENCRYPT=true|false.
const isIpLiteral = (host) => !!host && net.isIP(host) !== 0;

function resolveSqlOptions(host, { trustServerCertificate = false } = {}) {
  const encryptOverride = process.env.DB_ENCRYPT;
  return {
    encrypt: encryptOverride !== undefined ? encryptOverride === 'true' : !isIpLiteral(host),
    trustServerCertificate,
    enableArithAbort: true,
    useUTC: false,
  };
}

// Pool sizing is PER WORKER. With N PM2 cluster instances the total
// connections to SQL Server ≈ N × max. Defaults keep 20 workers ≈ ≤160 total.
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '8');
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '1');
const READER_POOL_MAX = parseInt(process.env.DB_READER_POOL_MAX || String(POOL_MAX));
const READER_POOL_MIN = parseInt(process.env.DB_READER_POOL_MIN || String(POOL_MIN));

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: resolveSqlOptions(process.env.DB_SERVER, {
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    }),
    requestTimeout: 600000,
    connectionTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '30000'),
    cancelTimeout: 10000,
    pool: {
        max: POOL_MAX,
        min: POOL_MIN,
        idleTimeoutMillis: 60000,
        evictionRunIntervalMillis: 60000
    }
};

const readerConfig = process.env.DB_READER_SERVER ? {
    user: process.env.DB_READER_USER || process.env.DB_USER,
    password: process.env.DB_READER_PASSWORD || process.env.DB_PASSWORD,
    server: process.env.DB_READER_SERVER,
    database: process.env.DB_READER_NAME || process.env.DB_NAME,
    port: parseInt(process.env.DB_READER_PORT || process.env.DB_PORT),
    options: resolveSqlOptions(process.env.DB_READER_SERVER, {
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    }),
    requestTimeout: 300000,
    connectionTimeout: 30000,
    cancelTimeout: 10000,
    pool: {
        max: READER_POOL_MAX,
        min: READER_POOL_MIN,
        idleTimeoutMillis: 60000,
        evictionRunIntervalMillis: 60000
    }
} : null;

let poolPromise = null;
let readerPoolPromise = null;
let reconnectTimer = null;
let keepAliveTimer = null;

const CONNECT_RETRIES = parseInt(process.env.DB_CONNECT_RETRIES || '5');
const CONNECT_BASE_DELAY_MS = parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || '2000');
const RECONNECT_INTERVAL_MS = parseInt(process.env.DB_RECONNECT_INTERVAL_MS || '10000');
const KEEPALIVE_INTERVAL_MS = parseInt(process.env.DB_KEEPALIVE_MS || '60000');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function scheduleBackgroundReconnect(label) {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        logger.info(`DB background reconnect attempt (${label})...`);
        try {
            if (label === 'primary') await getPool();
            else await getReader();
        } catch (_) { /* scheduleBackgroundReconnect fires again inside get* */ }
    }, RECONNECT_INTERVAL_MS);
    if (reconnectTimer.unref) reconnectTimer.unref();
}

/**
 * Creates a ConnectionPool and connects with bounded exponential-backoff retries.
 * A fresh pool object is used per attempt (mssql pools are single-use after fatal errors).
 */
async function createPoolWithRetry(cfg, label) {
    let lastErr;
    for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
        const pool = new sql.ConnectionPool(cfg);
        pool.on('error', (err) => {
            logger.error(`SQL ${label} pool error event`, { error: err.message });
            // Fatal pool-level errors invalidate the cached promise; the next
            // caller (or the background timer) transparently reconnects.
            if (!pool.connected && !pool.connecting) {
                if (label === 'primary') { if (poolPromise && poolPromise.value === pool) poolPromise = null; }
                else { if (readerPoolPromise && readerPoolPromise.value === pool) readerPoolPromise = null; }
                scheduleBackgroundReconnect(label);
            }
        });
        try {
            const connected = await pool.connect();
            await initUdf(connected);
            logger.info(`SQL Server ${label} pool connected (attempt ${attempt})`);
            return connected;
        } catch (err) {
            lastErr = err;
            try { await pool.close(); } catch (_) {}
            if (attempt < CONNECT_RETRIES) {
                const delay = CONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
                logger.warn(`SQL ${label} connect failed (${err.message}). Retry ${attempt}/${CONNECT_RETRIES} in ${delay}ms`);
                await sleep(delay);
            }
        }
    }
    throw lastErr;
}

function startKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(async () => {
        try {
            const p = await getPool();
            if (p.connected) await p.request().query('SELECT 1');
        } catch (_) { /* errors logged by pool handlers; keeps socket warm */ }
    }, KEEPALIVE_INTERVAL_MS);
    if (keepAliveTimer.unref) keepAliveTimer.unref();
}

async function initUdf(pool) {
    const tz = process.env.AUTOMATION_TIMEZONE || 'Asia/Kolkata';
    const d = new Date();
    const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' });
    const locStr = d.toLocaleString('en-US', { timeZone: tz });
    const offsetMins = Math.round((new Date(locStr) - new Date(utcStr)) / 60000);

    try {
        const checkResult = await pool.request().query(
            `SELECT OBJECT_ID(N'dbo.GetEnvDate', N'FN') AS FuncId`
        );
        if (!checkResult.recordset[0]?.FuncId) {
            await pool.request().query(`
                CREATE FUNCTION dbo.GetEnvDate()
                RETURNS DATETIME2 AS BEGIN
                    RETURN DATEADD(minute, ${offsetMins}, GETUTCDATE())
                END
            `);
        } else {
            try {
                await pool.request().query(`
                    ALTER FUNCTION dbo.GetEnvDate()
                    RETURNS DATETIME2 AS BEGIN
                        RETURN DATEADD(minute, ${offsetMins}, GETUTCDATE())
                    END
                `);
            } catch (alterErr) {
                if (!alterErr.message.includes('referenced by object')) throw alterErr;
                logger.warn('dbo.GetEnvDate exists with constraints — using existing definition');
            }
        }
    } catch (err) {
        if (!err.message.includes('referenced by object')) {
            logger.error('SQL UDF setup warning', { error: err.message });
        }
    }
}

function getPool() {
    if (!poolPromise) {
        poolPromise = createPoolWithRetry(config, 'primary')
            .then(pool => { startKeepAlive(); return pool; })
            .catch(err => {
                poolPromise = null;                       // allow next call to retry
                scheduleBackgroundReconnect('primary');   // self-heal without traffic
                throw err;
            });
    }
    return poolPromise;
}

function getReader() {
    if (!readerConfig) return getPool();
    if (!readerPoolPromise) {
        readerPoolPromise = createPoolWithRetry(readerConfig, 'reader')
            .catch(err => {
                readerPoolPromise = null;
                logger.warn(`SQL Reader Pool failed — falling back to primary (${err.message})`);
                scheduleBackgroundReconnect('reader');
                return getPool();
            });
    }
    return readerPoolPromise;
}

async function query(text, params = []) {
    const pool = await getPool();
    const request = pool.request();
    if (params && params.length > 0) {
        params.forEach((p, i) => request.input(`param${i}`, p));
    }
    return request.query(text);
}

function generateId() {
    try {
        const uuid = randomUUID().replace(/-/g, '');
        return uuid.substring(0, 24);
    } catch (err) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 12);
        return (timestamp + random).substring(0, 24);
    }
}

async function executeWithRetry(queryFn, maxRetries = 5, retryDelayMs = 250) {
    let retries = 0;
    while (true) {
        try {
            return await queryFn();
        } catch (err) {
            const isDeadlock = err.number === 1205 || (err.message && err.message.toLowerCase().includes('deadlock'));
            const isConnectionError = err.message && (
                err.message.toLowerCase().includes('failed to connect') ||
                err.message.toLowerCase().includes('timeout') ||
                err.message.toLowerCase().includes('socket hang up') ||
                err.message.toLowerCase().includes('sequence')
            );

            if ((isDeadlock || isConnectionError) && retries < maxRetries) {
                const jitter = Math.floor(Math.random() * 200);
                const delay = (retryDelayMs * Math.pow(2, retries)) + jitter;
                logger.warn(`DB transient error (${isDeadlock ? 'Deadlock' : 'Connection'}). Retry ${retries + 1}/${maxRetries} in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
            } else {
                throw err;
            }
        }
    }
}

/**
 * Run `fn(transaction)` inside a SQL transaction (begin → fn → commit / rollback).
 * Use `transaction.request()` to build requests inside the transaction.
 */
async function withTransaction(fn) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const result = await fn(transaction);
        await transaction.commit();
        return result;
    } catch (err) {
        try { await transaction.rollback(); } catch (_) { /* connection already aborted */ }
        throw err;
    }
}

module.exports = {
    sql,
    getPool,
    getReader,
    query,
    generateId,
    executeWithRetry,
    withTransaction
};
