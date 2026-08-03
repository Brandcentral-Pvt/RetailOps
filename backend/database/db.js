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
    connectionTimeout: 60000,
    cancelTimeout: 10000,
    pool: {
        max: 200,
        min: 10,
        idleTimeoutMillis: 10000
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
        max: parseInt(process.env.DB_READER_POOL_MAX || '100'),
        min: parseInt(process.env.DB_READER_POOL_MIN || '10'),
        idleTimeoutMillis: 10000
    }
} : null;

let poolPromise = null;
let readerPoolPromise = null;

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
        const pool = new sql.ConnectionPool(config);
        // Prevent unhandled 'error' events from taking the process down
        pool.on('error', (err) => logger.error('SQL pool error event', { error: err.message }));
        poolPromise = pool.connect()
            .then(async connected => {
                await initUdf(connected);
                return connected;
            })
            .catch(err => {
                logger.error('SQL Connection Pool Error', { error: err.message });
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

function getReader() {
    if (!readerConfig) return getPool();
    if (!readerPoolPromise) {
        const pool = new sql.ConnectionPool(readerConfig);
        pool.on('error', (err) => logger.warn('SQL reader pool error event', { error: err.message }));
        readerPoolPromise = pool.connect()
            .then(async connected => {
                await initUdf(connected);
                return connected;
            })
            .catch(err => {
                logger.warn('SQL Reader Pool failed — falling back to primary', { error: err.message });
                readerPoolPromise = null;
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
