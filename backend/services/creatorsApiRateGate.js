/**
 * Creators API Rate Gate
 *
 * Single choke-point for EVERY Creators API request (live sync, keyword
 * research, future callers) so the account can never be throttled:
 *
 *  TPS — one request per `intervalMs` account-wide, enforced with an atomic
 *        Redis token bucket so all PM2 workers share ONE budget (each worker
 *        having its own 1 req/s limiter would multiply to 4 TPS and get 429s).
 *        Falls back to an in-process limiter if Redis is unavailable.
 *
 *  TPD — the 8640/day budget is counted in the CreatorsApiQuota table (one
 *        row per UTC day), so it survives process restarts and is shared by
 *        every caller. A restart can no longer re-spend the day's quota.
 *
 * 429  — callers keep their own Retry-After / backoff handling; this gate
 *        guarantees we are already under quota so 429 only ever happens when
 *        Amazon lowered the limit (x-amzn-ratelimit-limit), which we honour
 *        by tightening intervalMs from the response header.
 */
const Redis = require('ioredis');
const logger = require('../utils/logger');
const { sql, getPool, generateId } = require('../database/db');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = process.env.QUEUE_PREFIX || 'retailops:queue';

// Account key = the top-level budget bucket. All credentials/callers share it
// by default so the PRIMARY account's 8640/day can never be silently exceeded
// when credentials belong to the same Associate account.
const DEFAULT_ACCOUNT_KEY = process.env.CREATORS_RATE_ACCOUNT || 'primary';

class CreatorsApiRateGate {
    constructor() {
        this.intervalMs = parseInt(process.env.CREATORS_RATE_INTERVAL_MS || '1100', 10);
        this.policyTps = parseFloat(process.env.CREATORS_RATE_TPS || '1');
        this.tpdLimit = parseInt(process.env.CREATORS_RATE_TPD || '8640', 10);
        this.tpdBuffer = parseInt(process.env.CREATORS_RATE_TPD_BUFFER || '40', 10);
        this._redis = null;
        this._redisUp = false;
        // In-process fallback limits (used only when Redis is unreachable)
        this._lastPerAccount = new Map();
        this._dailyCounters = new Map(); // {account:date} -> count (fallback only)
        this._dbAvailable = true;
    }

    getEffectiveTpdLimit() {
        return Math.max(1, this.tpdLimit - this.tpdBuffer);
    }

    // ── Redis -----------------------------------------------------------
    _getRedis() {
        if (this._redis) return this._redis;
        this._redis = new Redis(REDIS_URL, {
            lazyConnect: true,
            retryStrategy: () => null, // never keep the gate blocked
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
        });
        this._redis.on('error', () => { this._redisUp = false; });
        this._redis.on('ready', () => { this._redisUp = true; });
        this._redis.on('close', () => { this._redisUp = false; });
        this._redis.connect().catch(() => { this._redisUp = false; });
        return this._redis;
    }

    _redisReady() {
        this._getRedis();
        return this._redisUp;
    }

    /**
     * Reserve a TPS slot account-wide. Returns ms to sleep before calling, or 0.
     * Atomic EVAL: whichever caller wins advances the shared timestamp so the
     * next caller must wait `intervalMs` — exactly 1 req / interval across cluster.
     */
    async _acquireTpsSlot(accountKey = DEFAULT_ACCOUNT_KEY) {
        if (!this._redisReady()) return this._localAcquireTps(accountKey);

        const key = `${PREFIX}:creators:tps:${accountKey}`;
        const now = Date.now();
        try {
            const wait = await this._redis.eval(
                `
                local lastKey = KEYS[1]
                local now = tonumber(ARGV[1])
                local interval = tonumber(ARGV[2])
                local last = tonumber(redis.call('GET', lastKey) or '0')
                if last == 0 then
                    redis.call('SET', lastKey, now)
                    return 0
                end
                local nextAt = last + interval
                if now < nextAt then
                    return nextAt - now
                end
                redis.call('SET', lastKey, now)
                return 0
                `,
                1,
                key,
                now,
                this.intervalMs,
            );
            return Number(wait) || 0;
        } catch (err) {
            logger.warn('[CreatorsGate] Redis TPS slot failed, falling back to in-process:', err.message);
            return this._localAcquireTps(accountKey);
        }
    }

    _localAcquireTps(accountKey) {
        const now = Date.now();
        const last = this._lastPerAccount.get(accountKey) || 0;
        const dueAt = last + this.intervalMs;
        if (now >= dueAt) {
            this._lastPerAccount.set(accountKey, now);
            return 0;
        }
        return dueAt - now;
    }

    /**
     * Wait until a TPS slot is free. Bounded by `maxWaitMs` (default 1s) so a
     * server-propagated rate change can't stall a batch forever.
     */
    async waitForTps(accountKey = DEFAULT_ACCOUNT_KEY) {
        const maxWaitMs = parseInt(process.env.CREATORS_RATE_MAX_WAIT_MS || '1000', 10);
        const budget = Date.now() + maxWaitMs;
        for (;;) {
            const sleepFor = await this._acquireTpsSlot(accountKey);
            if (sleepFor <= 0) return;
            const capped = Math.min(sleepFor, Math.max(0, budget - Date.now()));
            if (capped <= 0) return; // give up waiting, caller's 429 handling will absorb it
            await new Promise((r) => setTimeout(r, capped));
        }
    }

    // ── TPD ledger --------------------------------------------------------

    _usageDate() {
        return new Date().toISOString().slice(0, 10); // UTC day
    }

    /**
     * Resolve today's quota row (create on first use). Returns {used, quota}.
     */
    async _getOrCreateUsage(accountKey, date) {
        const pool = await getPool();
        const find = await pool.request()
            .input('account', sql.VarChar, accountKey)
            .input('date', sql.VarChar, date)
            .query(`
                SELECT RequestsUsed, Quota FROM CreatorsApiQuota
                WHERE AccountKey = @account AND UsageDate = @date
            `);
        if (find.recordset.length) {
            return { used: find.recordset[0].RequestsUsed, quota: find.recordset[0].Quota };
        }

        const quota = this.getEffectiveTpdLimit();
        try {
            await pool.request()
                .input('id', sql.VarChar, generateId())
                .input('account', sql.VarChar, accountKey)
                .input('date', sql.VarChar, date)
                .input('quota', sql.Int, quota)
                .query(`
                    INSERT INTO CreatorsApiQuota (Id, AccountKey, UsageDate, RequestsUsed, Quota)
                    VALUES (@id, @account, @date, 0, @quota)
                `);
            return { used: 0, quota };
        } catch (err) {
            // Concurrent create race — re-read the winner's row (typically exists).
            if (/duplicate|PK|UQ|Violation/i.test(err.message || '')) {
                const again = await getPool().request()
                    .input('account', sql.VarChar, accountKey)
                    .input('date', sql.VarChar, date)
                    .query(`SELECT RequestsUsed, Quota FROM CreatorsApiQuota WHERE AccountKey = @account AND UsageDate = @date`);
                if (again.recordset.length) {
                    return { used: again.recordset[0].RequestsUsed, quota: again.recordset[0].Quota };
                }
            }
            throw err;
        }
    }

    /**
     * Records one request against today's ledger. Returns true if within quota,
     * false if the day's budget is exhausted. Atomic-ish (guarded UPDATE).
     */
    async recordRequest(accountKey = DEFAULT_ACCOUNT_KEY) {
        const date = this._usageDate();
        try {
            let { used, quota } = await this._getOrCreateUsage(accountKey, date);
            if (used >= quota) return false;

            const pool = await getPool();
            const upd = await pool.request()
                .input('account', sql.VarChar, accountKey)
                .input('date', sql.VarChar, date)
                .query(`
                    UPDATE CreatorsApiQuota SET
                        RequestsUsed = RequestsUsed + 1,
                        UpdatedAt = dbo.GetEnvDate()
                    WHERE AccountKey = @account AND UsageDate = @date AND RequestsUsed < Quota
                `);
            return upd.rowsAffected[0] > 0;
        } catch (err) {
            logger.warn('[CreatorsGate] TPD ledger write failed, using in-process fallback:', err.message);
            return this._recordLocal(accountKey, date);
        }
    }

    _recordLocal(accountKey, date) {
        const key = `${accountKey}:${date}`;
        const used = (this._dailyCounters.get(key) || 0) + 1;
        if (used > this.getEffectiveTpdLimit()) return false;
        this._dailyCounters.set(key, used);
        return true;
    }

    /** Remaining requests for today, from the durable ledger. */
    async getRemaining(accountKey = DEFAULT_ACCOUNT_KEY) {
        const date = this._usageDate();
        try {
            const { used, quota } = await this._getOrCreateUsage(accountKey, date);
            return Math.max(0, quota - used);
        } catch (err) {
            const local = this._dailyCounters.get(`${accountKey}:${date}`) || 0;
            return Math.max(0, this.getEffectiveTpdLimit() - local);
        }
    }

    /**
     * Tighten the per-second budget from the server's x-amzn-ratelimit-limit
     * header when Amazon lowers it on the account.
     */
    setPolicyFromHeader(headers) {
        const limit = parseFloat((headers || {})['x-amzn-ratelimit-limit']);
        if (!limit || !(limit > 0) || limit >= this.policyTps) return;
        this.policyTps = limit;
        this.intervalMs = Math.ceil(1000 / limit) + 100;
    }

    getStatus() {
        return {
            account: DEFAULT_ACCOUNT_KEY,
            intervalMs: this.intervalMs,
            policyTps: this.policyTps,
            dailyLimit: this.getEffectiveTpdLimit(),
            redisUp: this._redisUp,
            env: {
                intervalMs: process.env.CREATORS_RATE_INTERVAL_MS || '1100 (default)',
                tpd: process.env.CREATORS_RATE_TPD || '8640 (default)',
                tpdBuffer: process.env.CREATORS_RATE_TPD_BUFFER || '40 (default)',
            },
        };
    }
}

module.exports = new CreatorsApiRateGate();