/**
 * CreatorsAPI Credential Rotation Service
 * Manages multiple versioned credential sets (v1–v6) and rotates them randomly
 * for higher request throughput.
 *
 * Env layout (all optional except v1):
 *   v1: LIVE_SYNC_CLIENT_ID / LIVE_SYNC_CLIENT_SECRET        (id: 'primary')
 *   v2: CREATORS_API_CLIENT_ID_2 / CREATORS_API_CLIENT_SECRET_2  (id: 'secondary')
 *   v3: CREATORS_API_CLIENT_ID_3 / CREATORS_API_CLIENT_SECRET_3   (id: 'v3')
 *   v4: CREATORS_API_CLIENT_ID_4 / CREATORS_API_CLIENT_SECRET_4   (id: 'v4')
 *   v5: CREATORS_API_CLIENT_ID_5 / CREATORS_API_CLIENT_SECRET_5   (id: 'v5')
 *   v6: CREATORS_API_CLIENT_ID_6 / CREATORS_API_CLIENT_SECRET_6   (id: 'v6')
 *
 * Per-version overrides (fall back to the global LIVE_SYNC_* values):
 *   CREATORS_API_PARTNER_TAG_<N>  — partner tag bound to that version's client
 *   CREATORS_API_MARKETPLACE_<N>  — marketplace (default 'www.amazon.in')
 *   CREATORS_API_CLIENT_VERSION_<N> — CreatorsAPI client version (default LIVE_SYNC_CLIENT_VERSION)
 */
class CreatorsApiCredentials {
    constructor() {
        this.credentials = [];
        this.currentIndex = 0;
        this._loadFromEnv();
    }

    // Static definition list so unconfigured versions still appear in the UI
    // (configured: false) and getById() can validate incoming credIds.
    static get VERSION_DEFS() {
        return [
            { id: 'primary', label: 'V1', envId: 'LIVE_SYNC_CLIENT_ID', envSecret: 'LIVE_SYNC_CLIENT_SECRET', num: 1 },
            { id: 'secondary', label: 'V2', envId: 'CREATORS_API_CLIENT_ID_2', envSecret: 'CREATORS_API_CLIENT_SECRET_2', num: 2 },
            { id: 'v3', label: 'V3', envId: 'CREATORS_API_CLIENT_ID_3', envSecret: 'CREATORS_API_CLIENT_SECRET_3', num: 3 },
            { id: 'v4', label: 'V4', envId: 'CREATORS_API_CLIENT_ID_4', envSecret: 'CREATORS_API_CLIENT_SECRET_4', num: 4 },
            { id: 'v5', label: 'V5', envId: 'CREATORS_API_CLIENT_ID_5', envSecret: 'CREATORS_API_CLIENT_SECRET_5', num: 5 },
            { id: 'v6', label: 'V6', envId: 'CREATORS_API_CLIENT_ID_6', envSecret: 'CREATORS_API_CLIENT_SECRET_6', num: 6 },
        ];
    }

    _loadFromEnv() {
        const apiVersion = process.env.LIVE_SYNC_CLIENT_VERSION || '3.2';

        this.credentials = [];
        for (const def of CreatorsApiCredentials.VERSION_DEFS) {
            const clientId = process.env[def.envId];
            const clientSecret = process.env[def.envSecret];
            if (!clientId || !clientSecret) continue;

            const num = def.num;
            this.credentials.push({
                id: def.id,
                label: def.label,
                clientId,
                clientSecret,
                version: process.env[`CREATORS_API_CLIENT_VERSION_${num}`] || apiVersion,
                partnerTag: process.env[`CREATORS_API_PARTNER_TAG_${num}`] || process.env.LIVE_SYNC_PARTNER_TAG,
                marketplace: process.env[`CREATORS_API_MARKETPLACE_${num}`] || process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in',
                successCount: 0,
                failCount: 0,
                lastUsed: 0,
                lastError: null,
                consecutiveErrors: 0,
            });
        }

        if (this.credentials.length === 0) {
            console.error('[Credentials] No Creators API credentials found in environment!');
        } else {
            console.log(`[Credentials] Loaded ${this.credentials.length} credential set(s): ${this.credentials.map(c => c.label).join(', ')}`);
        }
    }

    /**
     * Resolve one credential set by its id ('primary'/'secondary'/'v3'..'v6').
     * Returns the credential or null when the id is unknown/not configured.
     */
    getById(credId) {
        if (!credId) return null;
        return this.credentials.find(c => c.id === credId) || null;
    }

    /**
     * Get next credential set using smart rotation:
     * 1. Random selection among healthy credentials
     * 2. Skip credentials with consecutive errors
     * 3. Least-recently-used preference
     */
    get() {
        const healthy = this.credentials.filter(c => c.consecutiveErrors < 5);
        if (healthy.length === 0) {
            // All credentials are failing — reset and use any
            console.warn('[Credentials] All credential sets have consecutive errors, resetting...');
            this.credentials.forEach(c => { c.consecutiveErrors = 0; });
            return this.credentials[0];
        }

        // Pick random healthy credential, preferring least recently used
        const now = Date.now();
        const sorted = healthy.sort((a, b) => {
            // Penalize if used in last 200ms (rate limit protection)
            const aPenalty = (now - a.lastUsed < 200) ? 1000 : 0;
            const bPenalty = (now - b.lastUsed < 200) ? 1000 : 0;
            return (a.consecutiveErrors + aPenalty) - (b.consecutiveErrors + bPenalty);
        });

        const chosen = sorted[0];
        chosen.lastUsed = now;
        return chosen;
    }

    /**
     * Mark credential as successful
     */
    markSuccess(cred) {
        cred.successCount++;
        cred.consecutiveErrors = 0;
        cred.lastError = null;
    }

    /**
     * Mark credential as failed
     */
    markFailed(cred, error) {
        cred.failCount++;
        cred.consecutiveErrors++;
        cred.lastError = error;
    }

    /**
     * Full v1–v6 overview (configured or not) for UI display.
     */
    getVersions() {
        return CreatorsApiCredentials.VERSION_DEFS.map(def => {
            const live = this.getById(def.id);
            return {
                id: def.id,
                label: def.label,
                configured: !!live,
                clientId: live ? `${live.clientId.slice(0, 8)}...${live.clientId.slice(-4)}` : null,
                version: live ? live.version : null,
                partnerTag: live ? live.partnerTag : null,
                marketplace: live ? live.marketplace : null,
                successCount: live ? live.successCount : 0,
                failCount: live ? live.failCount : 0,
                consecutiveErrors: live ? live.consecutiveErrors : 0,
                healthy: !!live && live.consecutiveErrors < 5,
            };
        });
    }

    /**
     * Get stats for configured credentials (legacy shape used by /creds-stats).
     */
    getStats() {
        return this.credentials.map(c => ({
            id: c.id,
            label: c.label,
            clientId: c.clientId ? `${c.clientId.slice(0, 8)}...${c.clientId.slice(-4)}` : 'NOT SET',
            successCount: c.successCount,
            failCount: c.failCount,
            consecutiveErrors: c.consecutiveErrors,
            healthy: c.consecutiveErrors < 5,
        }));
    }

    get count() { return this.credentials.length; }
}

module.exports = new CreatorsApiCredentials();