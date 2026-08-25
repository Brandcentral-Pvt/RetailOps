const emailService = require('../services/emailService');
const { getClientIp } = require('../utils/clientIp');

/**
 * Login Rate Limiter with progressive delay, account lockout, and email notification.
 *
 * Layers:
 *   1. IP rate limit   — 10 req/min per IP (express-rate-limit compatible)
 *   2. Per-email lockout — 5 consecutive failures → 15 min lockout
 *   3. Progressive delay — each failure doubles the wait: 1s, 2s, 4s, 8s, 16s
 *   4. Email notification — sent when account is locked
 *
 * All counts stored in Redis (falls back to in-memory if Redis unavailable).
 * Generic errors — never reveals which layer triggered the block.
 */

const GENERIC_BLOCK = 'Unable to sign in. Please try again later.';

// ─── Redis / in-memory fallback ───────────────────────────────────────────────

let redis = null;
const memStore = new Map(); // fallback: { key: { count, lockUntil, nextAllowed } }

async function getRedis() {
    if (redis !== null) return redis;
    try {
        const Redis = require('ioredis');
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            lazyConnect: true,
            enableOfflineQueue: false,
        });
        redis.on('error', () => { redis = null; });
        await redis.connect();
        console.log('✅ Redis connected for login rate limiter');
        return redis;
    } catch {
        redis = null;
        console.warn('⚠️ Redis unavailable for rate limiter — using in-memory fallback');
        return null;
    }
}

async function cacheGet(key) {
    const r = await getRedis();
    if (r) {
        try { return await r.get(key); } catch { return null; }
    }
    const entry = memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) { memStore.delete(key); return null; }
    return entry.value;
}

async function cacheSet(key, value, ttlSeconds) {
    const r = await getRedis();
    if (r) {
        try { await r.setex(key, ttlSeconds, value); return; } catch {}
    }
    memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function cacheIncr(key, ttlSeconds) {
    const r = await getRedis();
    if (r) {
        try {
            const val = await r.incr(key);
            if (val === 1) await r.expire(key, ttlSeconds);
            return val;
        } catch { return null; }
    }
    const entry = memStore.get(key);
    if (!entry || (entry.expiresAt && Date.now() > entry.expiresAt)) {
        memStore.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
        return 1;
    }
    entry.value++;
    return entry.value;
}

async function cacheSetEx(key, value, ttlSeconds) {
    const r = await getRedis();
    if (r) {
        try { await r.setex(key, ttlSeconds, value); return; } catch {}
    }
    memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IP_WINDOW        = 60;       // 1 minute IP rate limit window
const IP_MAX           = 10;       // max 10 requests per IP per minute
const FAIL_THRESHOLD   = 5;        // failures before lockout
const PROGRESSIVE_DELAYS = [0, 1, 2, 4, 8, 16]; // seconds per attempt (index 0 = attempt 1)

// F3 — Progressive lock durations. Flat 15-minute locks gave an attacker a
// cheap, predictable DoS cost. Lock length now escalates with the number of
// lock cycles the account has already burned TODAY (the daily counter in
// `lock_cycles:<email>:<yyyymmdd>`, which also drives the email cap below):
//
//   lock cycle today | duration
//   -----------------+------------------
//   1                | 15 minutes
//   2                | 30 minutes
//   3                | 60 minutes
//   4+               | 120 minutes (cap)
//
// The counter resets at local midnight, so a legitimate user who trips one
// accidental lockout still gets the base 15-minute duration.
//
// NOTE: this raises attacker cost only. A CAPTCHA / vendor challenge on
// repeated failures remains the proper long-term fix and should be revisited.
const LOCK_DURATION_SECONDS_BY_CYCLE = [900, 1800, 3600, 7200];
// TTL for the consecutive-failure counter: must outlive the shortest (base)
// lock so the count survives one full lockout cycle. Lock gating itself is
// done by the separate lock key, so this only affects progressive delays.
const FAIL_COUNTER_TTL = 900 + 60;
function getLockDurationSeconds(priorCyclesToday) {
    // priorCyclesToday === 0 → this is cycle 1 → index 0.
    const idx = Math.min(Math.max(priorCyclesToday, 0), LOCK_DURATION_SECONDS_BY_CYCLE.length - 1);
    return LOCK_DURATION_SECONDS_BY_CYCLE[idx];
}

function getProgressiveDelay(attemptNumber) {
    const idx = Math.min(attemptNumber, PROGRESSIVE_DELAYS.length - 1);
    return PROGRESSIVE_DELAYS[idx] * 1000; // ms
}

// ─── Email notification on lockout ────────────────────────────────────────────

// RB5 (F-14 mitigation): lockout emails are attacker-triggerable (anyone who
// knows a victim's email can fail logins 5x). Two caps:
//   1. Per-recipient throttle — max ONE lockout email per address per 30 min.
//   2. Daily cumulative cap — after MAX_LOCK_CYCLES_PER_DAY lock cycles in a
//      day, accounts keep LOCKING (security unchanged) but no further emails
//      are sent for the rest of that day.
const LOCKOUT_EMAIL_THROTTLE_SECONDS = 1800; // 30 minutes
const MAX_LOCK_CYCLES_PER_DAY = 5;

function localDateKey(now = new Date()) {
    // App runs under AUTOMATION_TIMEZONE (process.env.TZ), so local date parts
    // are the operational "day".
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

async function sendLockoutEmail(email, clientIp) {
    try {
        const { accountLockout } = require('../emails');
        const html = accountLockout({
            userName: email,
            ipAddress: clientIp || 'Unknown',
            timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        });
        await emailService.send({
            to: email,
            subject: '⚠️ Security Alert: Your account has been temporarily locked',
            html
        });
        console.log(`📧 [LOCKOUT EMAIL] Sent to ${email}`);
    } catch (err) {
        console.error(`📧 [LOCKOUT EMAIL FAILED] ${email}: ${err.message}`);
    }
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Layer 1: IP rate limiter — 10 requests per IP per minute.
 * Returns early with generic error if exceeded.
 */
async function ipRateLimiter(req, res, next) {
    const ip = getClientIp(req); // SECURITY: server-derived (trust proxy aware) — XFF is spoofable
    const key = `rl:ip:${ip}`;
    const count = await cacheIncr(key, IP_WINDOW);

    if (count > IP_MAX) {
        console.warn(`[RATE_LIMIT] IP ${ip} exceeded ${IP_MAX} requests/min (${count} counted)`);
        return res.status(429).json({ success: false, message: GENERIC_BLOCK });
    }
    next();
}

/**
 * Layer 2: Per-email lockout check — runs BEFORE the controller processes credentials.
 * Checks Redis/in-memory for lock status and progressive delay.
 */
async function accountLockoutCheck(req, res, next) {
    const { email } = req.body || {};
    if (!email) return next(); // validation middleware handles missing email

    const normalizedEmail = email.toLowerCase().trim();
    const lockKey = `rl:lock:${normalizedEmail}`;
    const failKey = `rl:fail:${normalizedEmail}`;
    const clientIp = getClientIp(req); // SECURITY: server-derived — XFF is spoofable

    // Check if account is currently locked
    const lockUntil = await cacheGet(lockKey);
    if (lockUntil) {
        const remainingMs = parseInt(lockUntil) - Date.now();
        if (remainingMs > 0) {
            const remainingMin = Math.ceil(remainingMs / 60000);
            console.warn(`[LOCKOUT] ${normalizedEmail} is locked. ${remainingMin}min remaining. IP: ${clientIp}`);
            return res.status(423).json({
                success: false,
                message: GENERIC_BLOCK
            });
        }
        // Lock expired — clean up
        await cacheSet(lockKey, '0', 1);
    }

    // Check progressive delay
    const failCount = parseInt(await cacheGet(failKey) || '0');
    if (failCount > 0 && failCount < FAIL_THRESHOLD) {
        const delayMs = getProgressiveDelay(failCount);
        if (delayMs > 0) {
            console.log(`[PROGRESSIVE_DELAY] ${normalizedEmail} attempt ${failCount + 1}: waiting ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    // Attach metadata for the controller to use
    req._authMetadata = { email: normalizedEmail, clientIp };
    next();
}

/**
 * Called by the controller after a FAILED login attempt.
 * Increments failure count, applies lockout at threshold, sends email.
 */
async function recordFailedAttempt(email, clientIp) {
    const normalizedEmail = email.toLowerCase().trim();
    const failKey = `rl:fail:${normalizedEmail}`;
    const lockKey = `rl:lock:${normalizedEmail}`;

    const count = await cacheIncr(failKey, FAIL_COUNTER_TTL);
    console.warn(`[FAILED_ATTEMPT] ${normalizedEmail} — attempt ${count}/${FAIL_THRESHOLD} | IP: ${clientIp}`);

    if (count >= FAIL_THRESHOLD) {
        // F3: read the DAILY lock-cycle counter FIRST — it determines this
        // lock's duration (15m → 30m → 60m → 120m cap) and, incremented by
        // one, the email-suppression accounting below.
        const now = new Date();
        const dayKey = localDateKey(now);
        const cyclesKey = `lock_cycles:${normalizedEmail}:${dayKey}`;
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
        const dayTtl = Math.max(60, Math.floor((endOfDay - now) / 1000));
        const priorCycles = parseInt(await cacheGet(cyclesKey) || '0', 10);

        // F3: escalating duration replaces the flat 15-minute lockout.
        const lockSeconds = getLockDurationSeconds(priorCycles);
        const lockUntil = Date.now() + lockSeconds * 1000;
        await cacheSetEx(lockKey, String(lockUntil), lockSeconds + 60);
        console.warn(`[LOCKOUT] ${normalizedEmail} locked for ${lockSeconds / 60} minutes (lock cycle ${priorCycles + 1} today). IP: ${clientIp}`);

        // RB5: bookkeeping for the daily cumulative cap. The counter is keyed
        // per local day and expires at local midnight.
        const cycles = await cacheIncr(cyclesKey, dayTtl);

        if (cycles > MAX_LOCK_CYCLES_PER_DAY) {
            // Security unchanged: the account stays locked. Only the email is
            // suppressed so lockouts cannot be turned into mail-bombing.
            console.warn(`[LOCKOUT] ${normalizedEmail}: daily lock-cycle cap reached (${cycles}/${MAX_LOCK_CYCLES_PER_DAY}) — locking WITHOUT email`);
            return count;
        }

        // RB5: per-recipient throttle — at most one lockout email / 30 min.
        const throttleKey = `lockout_email_throttle:${normalizedEmail}`;
        if (await cacheGet(throttleKey)) {
            console.warn(`[LOCKOUT EMAIL] Suppressed for ${normalizedEmail} — throttled (max 1 per ${LOCKOUT_EMAIL_THROTTLE_SECONDS / 60} min)`);
            return count;
        }
        await cacheSetEx(throttleKey, '1', LOCKOUT_EMAIL_THROTTLE_SECONDS);

        // Send email notification (fire-and-forget)
        sendLockoutEmail(normalizedEmail, clientIp).catch(() => {});
    }

    return count;
}

/**
 * Called by the controller after a SUCCESSFUL login.
 * Clears all failure counters for the email.
 */
async function recordSuccessfulLogin(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const failKey = `rl:fail:${normalizedEmail}`;
    const lockKey = `rl:lock:${normalizedEmail}`;
    await cacheSet(failKey, '0', 1);
    await cacheSet(lockKey, '0', 1);
}

module.exports = {
    ipRateLimiter,
    accountLockoutCheck,
    recordFailedAttempt,
    recordSuccessfulLogin,
    GENERIC_BLOCK
};
