/**
 * Global Live Sync workflow — regression tests.
 *
 * Production runs PM2 in cluster mode (4 instances), so ANY per-process state
 * is invisible to the worker that answers the next HTTP request. These tests
 * pin the fixes for that class of bug:
 *
 *   - the run state is published to Redis and the status endpoint reads it, so
 *     the UI cannot see "idle" while a sync is running on another worker;
 *   - the start endpoint reports the TRUTH (409 when another run owns the
 *     lock) instead of always claiming success;
 *   - the global lock TTL outlives the run timeout, so a long run cannot
 *     silently lose its lock and start a concurrent second run;
 *   - the per-seller last-run lookup filters on EntityId, not on a
 *     Description LIKE that never matched.
 */

let mockState = { pool: null, lockResult: null, sharedState: null, abortSignal: null };

// config/env.js calls process.exit() when required vars are absent — stub it so
// requiring the controller in a test process is side-effect free.
jest.mock('../../config/env', () => ({
    jwt: { secret: 'test-secret', refreshSecret: 'test-refresh-secret' },
    env: 'test',
}));

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id',
    };
});

// Stub the Redis-backed gate: we only care about the coordination CONTRACT.
const mockAcquireLock = jest.fn(async () => mockState.lockResult);
const mockReleaseLock = jest.fn(async () => {});
jest.mock('../../services/creatorsApiRateGate', () => ({
    acquireLock: (...a) => mockAcquireLock(...a),
    releaseLock: (...a) => mockReleaseLock(...a),
    waitForTps: async () => {},
    accountKeyFor: (id) => id || 'primary',
    getGlobalSyncState: async () => mockState.sharedState,
    setGlobalSyncState: async (state) => { mockState.sharedState = state; return true; },
    clearGlobalSyncState: async () => { mockState.sharedState = null; return true; },
    requestGlobalSyncAbort: async (reason) => { mockState.abortSignal = { reason }; return true; },
    getGlobalSyncAbort: async () => mockState.abortSignal,
    clearGlobalSyncAbort: async () => { mockState.abortSignal = null; return true; },
}));

jest.mock('../../services/asinCompletenessService', () => ({
    buildHardPredicate: () => '1=1',
    getSellerCompleteness: async () => ({ complete: 0, total: 0, incomplete: 0, percent: 100 }),
    listIncompleteAsins: async () => [],
    getMissingFieldBreakdown: async () => ({}),
}));

// Heavy collaborators we do not exercise here.
jest.mock('../../services/playwrightScraperService', () => ({ scrapeAsin: async () => ({}) }));
jest.mock('../../services/listingQualityService', () => ({ recalculateForAsins: async () => {} }));
jest.mock('../../services/rulesetEngineService', () => ({ evaluateForAsins: async () => {} }));
jest.mock('../../services/SystemLogService', () => ({ log: async () => {} }));
jest.mock('../../controllers/notificationController', () => ({ createNotification: async () => {} }));
jest.mock('../../lib/creatorsapi-sdk/index', () => ({}));

const { makeFakePool } = require('../../testUtils/fakePool');
const liveDataSyncService = require('../../services/liveDataSyncService');

beforeEach(() => {
    mockState.pool = makeFakePool();
    mockState.lockResult = { owner: 'test-owner', released: false };
    mockState.sharedState = null;
    mockState.abortSignal = null;
    mockAcquireLock.mockClear();
    mockReleaseLock.mockClear();
    // Reset in-process flags left over between tests.
    liveDataSyncService._globalSyncRunning = false;
    liveDataSyncService._globalSyncProgress = null;
    liveDataSyncService._lastGlobalSummary = null;
    liveDataSyncService._globalSyncAborted = false;
    liveDataSyncService._globalSyncAbortReason = null;
    liveDataSyncService._abortCheckAt = 0;
});

describe('global live sync — start contract', () => {
    test('startGlobalSync reports NOT accepted when another worker holds the lock', async () => {
        mockState.lockResult = null; // lock already taken elsewhere
        const res = await liveDataSyncService.startGlobalSync({});
        expect(res.accepted).toBe(false);
        expect(res.status).toBe('IN_PROGRESS');
    });

    test('startGlobalSync rejects a second call while a run is already in flight', async () => {
        liveDataSyncService._globalSyncRunning = true;
        const res = await liveDataSyncService.startGlobalSync({});
        expect(res.accepted).toBe(false);
        expect(res.error).toMatch(/already in progress/i);
        // Must not have tried to claim the lock a second time.
        expect(mockAcquireLock).not.toHaveBeenCalled();
    });

    test('startGlobalSync accepts, detaches the run, and returns promptly', async () => {
        // The run itself is stubbed: we only assert the handoff contract.
        const original = liveDataSyncService.syncAllSellers;
        liveDataSyncService.syncAllSellers = jest.fn(() => new Promise(() => {}));

        const res = await liveDataSyncService.startGlobalSync({ concurrency: 1 });

        expect(res.accepted).toBe(true);
        expect(liveDataSyncService.syncAllSellers).toHaveBeenCalledWith({ concurrency: 1 });
        // The probe lock is released before handing off to the real run.
        expect(mockReleaseLock).toHaveBeenCalled();

        liveDataSyncService.syncAllSellers = original;
    });
});

describe('global live sync — shared status', () => {
    test('status reads the Redis snapshot when this worker is not the owner', async () => {
        // Simulate: another PM2 worker is running the sync.
        mockState.sharedState = {
            status: 'RUNNING',
            running: true,
            totalSellers: 40,
            processedSellers: 7,
            activeSyncs: 1,
        };

        const status = await liveDataSyncService.getGlobalSyncStatus();

        expect(status.isRunning).toBe(true);
        expect(status.activeSyncs).toBe(1);
        expect(status.globalProgress.processedSellers).toBe(7);
    });

    test('local running state always wins over a stale shared snapshot', async () => {
        liveDataSyncService._globalSyncRunning = true;
        mockState.sharedState = { status: 'COMPLETED', running: false, activeSyncs: 0 };

        const status = await liveDataSyncService.getGlobalSyncStatus();
        expect(status.isRunning).toBe(true);
    });

    test('reports idle when neither local nor shared state says running', async () => {
        mockState.sharedState = { status: 'COMPLETED', running: false, activeSyncs: 0 };
        const status = await liveDataSyncService.getGlobalSyncStatus();
        expect(status.isRunning).toBe(false);
        expect(status.activeSyncs).toBe(0);
    });

    test('a finished run keeps its summary available to late polls', async () => {
        mockState.sharedState = { status: 'COMPLETED', running: false, summary: { success: 12 } };
        const status = await liveDataSyncService.getGlobalSyncStatus();
        expect(status.lastSummary).toEqual({ success: 12 });
    });
});

describe('global live sync — lock lifetime', () => {
    test('the global lock TTL outlives the 2h run timeout', async () => {
        // Read the TTL the service requests and compare with the default timeout.
        let requestedTtl = 0;
        mockAcquireLock.mockImplementation(async (_key, opts) => {
            requestedTtl = Math.max(requestedTtl, opts.ttlMs);
            return { owner: 'test-owner', released: false };
        });

        // Run only as far as the lock acquisition, then abort via an empty seller set.
        await liveDataSyncService.syncAllSellers({ globalTimeoutMs: 2 * 60 * 60 * 1000 });

        const twoHours = 2 * 60 * 60 * 1000;
        expect(requestedTtl).toBeGreaterThan(twoHours);
    });
});

describe('per-seller sync status — last-run lookup', () => {
    test('filters SystemLogs on EntityId, not on a never-matching Description LIKE', async () => {
        const pool = makeFakePool([
            { match: /FROM SystemLogs/i, rows: [{ CreatedAt: '2026-10-20', Metadata: '{"totalAsins":5,"successCount":4,"failedCount":1,"duration":1200}' }] },
            { match: /FROM Asins/i, rows: [{ lastOcto: null }] },
            { match: /FROM Sellers/i, rows: [] },
        ]);
        mockState.pool = pool;

        // Import after mocks are in place.
        const controller = require('../../controllers/marketDataSyncController');

        const req = {
            params: { sellerId: 'S1' },
            user: { role: 'admin', assignedSellers: [] },
        };
        let payload = null;
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { payload = body; return this; },
        };

        await controller.getSellerSyncStatus(req, res);

        const logCall = pool.callWhere(/FROM SystemLogs/i);
        expect(logCall).toBeTruthy();
        expect(logCall.sql).toMatch(/EntityId\s*=\s*@sellerId/i);
        expect(logCall.sql).not.toMatch(/Description\s+LIKE/i);
        expect(logCall.inputs.sellerId).toBe('S1');

        expect(payload.liveSync.lastRun).toBe('2026-10-20');
        expect(payload.liveSync.lastResult).toEqual({ totalAsins: 5, success: 4, failed: 1, duration: 1200 });
    });
});

describe('global live sync — cross-worker abort', () => {
    test('aborting with no run anywhere is refused', async () => {
        mockState.sharedState = null;
        const res = await liveDataSyncService.requestGlobalSyncAbort('nope');
        expect(res.accepted).toBe(false);
        expect(res.error).toMatch(/no global live sync/i);
    });

    test('abort is accepted and published when another worker owns the run', async () => {
        // No local run — only the shared snapshot says one is in flight.
        mockState.sharedState = { running: true, status: 'RUNNING' };

        const res = await liveDataSyncService.requestGlobalSyncAbort('user hit stop');

        expect(res.accepted).toBe(true);
        expect(mockState.abortSignal).toEqual({ reason: 'user hit stop' });
        // Local flag is set too, so an owning worker stops on its next check.
        expect(liveDataSyncService._globalSyncAborted).toBe(true);
    });

    test('the owner observes a remote abort request within one poll window', async () => {
        liveDataSyncService._globalSyncRunning = true;
        liveDataSyncService._globalSyncAborted = false;
        liveDataSyncService._abortCheckAt = 0;
        mockState.abortSignal = { reason: 'remote stop' };

        const aborted = await liveDataSyncService._isGlobalSyncAborted();

        expect(aborted).toBe(true);
        expect(liveDataSyncService._globalSyncAbortReason).toBe('remote stop');
    });

    test('the shared abort poll is throttled so it does not hammer Redis per batch', async () => {
        liveDataSyncService._globalSyncAborted = false;
        liveDataSyncService._abortCheckAt = Date.now() + 5000; // cooling down

        const aborted = await liveDataSyncService._isGlobalSyncAborted();

        // No signal read happened, so no abort was observed this call.
        expect(aborted).toBe(false);
    });

    test('status surfaces the abort request to any worker', async () => {
        mockState.sharedState = { running: true, status: 'RUNNING' };
        mockState.abortSignal = { reason: 'stop' };

        const status = await liveDataSyncService.getGlobalSyncStatus();

        expect(status.abortRequested).toBe(true);
    });

    test('a stopped run clears the shared abort signal so it cannot leak into the next run', async () => {
        // Drive a full (empty) run: no sellers -> completes immediately.
        mockState.pool = makeFakePool([
            { match: /FROM Sellers/i, rows: [] },
        ]);
        mockState.abortSignal = { reason: 'leftover' };

        await liveDataSyncService.syncAllSellers({ globalTimeoutMs: 60_000 });

        expect(mockState.abortSignal).toBeNull();
        expect(liveDataSyncService._globalSyncAborted).toBe(false);
    });
});
