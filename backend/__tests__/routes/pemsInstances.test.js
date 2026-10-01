/**
 * Regression tests for /api/pems/instances — the task source the dashboard
 * now shares with the task workspace (/pems/tasks).
 *
 * Covers:
 *   - Seller-level scoping on getInstances (restricted users can neither read
 *     another seller's instances nor widen their scope via query params).
 *   - cacheRoute isolation: the cache key must include the user and the
 *     query — previously `/instances?sellerId=A` and `?sellerId=B` shared one
 *     key and one user's scoped response was served to another user.
 *   - Response envelope contract { success, instances, pagination }.
 */
const express = require('express');
const request = require('supertest');

let mockState = { user: null, pool: null };
const mockCacheStore = new Map();
const mockCacheSetKeys = [];

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id',
    };
});

jest.mock('../../services/cacheService', () => ({
    key: (...parts) => parts.join(':'),
    get: async (k) => (mockCacheStore.has(k) ? mockCacheStore.get(k) : null),
    set: async (k, v) => { mockCacheStore.set(k, v); mockCacheSetKeys.push(k); },
    invalidateNamespace: async () => {},
}));

jest.mock('../../middleware/auth', () => {
    const setUser = (req) => { req.user = mockState.user; };
    return {
        authenticate: (req, res, next) => {
            if (!mockState.user) return res.status(401).json({ success: false, message: 'Authentication required' });
            setUser(req);
            next();
        },
        auth: (req, res, next) => {
            if (!mockState.user) return res.status(401).json({ success: false, message: 'Authentication required' });
            setUser(req);
            next();
        },
        requirePermission: () => (req, res, next) => next(),
    };
});

const pemsRoutes = require('../../routes/pems/pemsRoutes');
const { makeFakePool } = require('../../testUtils/fakePool');

const instanceFor = (sellerId, i = 0) => ({
    Id: `inst-${sellerId}-${i}`,
    InstanceCode: `PT-${sellerId}-${i}`,
    Title: `Task for ${sellerId}`,
    Status: 'ASSIGNED',
    Priority: 'HIGH',
    SellerId: sellerId,
    SellerName: `Seller ${sellerId}`,
    AssignedTo: 'u-assignee',
    DueDate: null,
    CreatedAt: new Date().toISOString(),
    Tags: null,
    Attachments: null,
});

/** Instances derived from the bound seller scope — lets responses differ per user. */
const pemsPool = () => makeFakePool([
    { match: /COUNT\(\*\) as total FROM PemsTaskInstances/, rows: [{ total: 1 }] },
    {
        match: /FROM PemsTaskInstances i/,
        rows: (entry) => {
            if (entry.sql.includes('AND 1=0')) return [];
            const scoped = Object.entries(entry.inputs)
                .filter(([k]) => k.startsWith('scopeSeller_'))
                .map(([, v]) => v);
            const single = entry.inputs.sellerId;
            // The scope clause distinguishes the two outcomes a restricted user
            // with zero assigned sellers can still have: the impossible
            // predicate (an explicit out-of-scope ?sellerId) yields nothing,
            // while the brand-less clause yields only their own brand-less work.
            const ownBrandless = entry.sql.includes('SellerId IS NULL');
            if (ownBrandless && scoped.length === 0 && !single) {
                return [{ ...instanceFor(null, 0), Id: 'inst-brandless-0', AssignedTo: entry.inputs.scopeMe }];
            }
            const ids = scoped.length > 0 ? scoped : (single ? [single] : ['s-all']);
            return ids.map((sid, i) => instanceFor(sid, i));
        },
    },
]);

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/pems', pemsRoutes);
    return app;
};

const mkUser = (id, sellers) => ({
    Id: id,
    _id: id,
    role: { name: 'brand_manager' },
    assignedSellers: sellers,
});

beforeEach(() => {
    mockState.user = null;
    mockState.pool = pemsPool();
    mockCacheStore.clear();
    mockCacheSetKeys.length = 0;
});

describe('GET /api/pems/instances — seller-level access', () => {
    test('envelope contract: { success, instances, pagination }', async () => {
        mockState.user = mkUser('u-bm-1', ['s1']);
        const res = await request(buildApp()).get('/api/pems/instances');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.instances)).toBe(true);
        expect(res.body.pagination).toMatchObject({ page: 1, limit: 25 });
    });

    test('restricted user is scoped to assigned sellers', async () => {
        mockState.user = mkUser('u-bm-2', ['s1', 's2']);
        const res = await request(buildApp()).get('/api/pems/instances');

        expect(res.status).toBe(200);
        const sellers = res.body.instances.map(i => i.SellerId).sort();
        expect(sellers).toEqual(['s1', 's2']);
        const select = mockState.pool.callWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/);
        expect(select.sql).toContain('SellerId IN (@scopeSeller_0,@scopeSeller_1)');
        expect(select.inputs.scopeSeller_0).toBe('s1');
        expect(select.inputs.scopeSeller_1).toBe('s2');
    });

    test('restricted user cannot widen scope via sellerId param', async () => {
        mockState.user = mkUser('u-bm-3', ['s1']);
        const res = await request(buildApp()).get('/api/pems/instances?sellerId=s-secret');

        expect(res.status).toBe(200);
        expect(res.body.instances).toEqual([]);
        const select = mockState.pool.callWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/);
        // The WHERE text is the safety property: an impossible predicate and
        // no equality/IN clause that could reference the unauthorized seller.
        expect(select.sql).toContain('AND 1=0');
        expect(select.sql).not.toContain('SellerId = @sellerId');
        expect(select.sql).not.toContain('SellerId IN (');
        expect(res.body.instances).toEqual([]);
    });

    test('restricted user with no assigned sellers sees only their own brand-less work', async () => {
        mockState.user = mkUser('u-bm-4', []);
        const res = await request(buildApp()).get('/api/pems/instances');

        expect(res.status).toBe(200);
        // Zero assigned sellers means no seller-owned task is reachable. Daily
        // routines are brand-less by design and stay visible to the person they
        // are assigned to, so the result is exactly that carve-out.
        const sellers = res.body.instances.map(i => i.SellerId);
        expect(sellers.every(sid => sid === null)).toBe(true);
        expect(res.body.instances.every(i => i.AssignedTo === 'u-bm-4')).toBe(true);
        const select = mockState.pool.callWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/);
        expect(select.sql).toContain('SellerId IS NULL');
        expect(select.sql).not.toContain('SellerId IN (');
    });

    test('global user can filter by explicit sellerId', async () => {
        mockState.user = { Id: 'u-admin-1', role: { name: 'admin' }, assignedSellers: [] };
        const res = await request(buildApp()).get('/api/pems/instances?sellerId=s9');

        expect(res.status).toBe(200);
        expect(res.body.instances.map(i => i.SellerId)).toEqual(['s9']);
        const select = mockState.pool.callWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/);
        expect(select.sql).toContain('SellerId = @sellerId');
        expect(select.inputs.sellerId).toBe('s9');
    });
});

describe('GET /api/pems/instances — cache isolation (cross-user leak regression)', () => {
    test('two users hitting the same path never share a cached response', async () => {
        const app = buildApp();

        mockState.user = mkUser('u-cache-a', ['s1']);
        const resA = await request(app).get('/api/pems/instances');
        expect(resA.body.instances.map(i => i.SellerId)).toEqual(['s1']);

        mockState.user = mkUser('u-cache-b', ['s2']);
        const resB = await request(app).get('/api/pems/instances');

        // Pre-fix, user B received user A's cached body.
        expect(resB.body.instances.map(i => i.SellerId)).toEqual(['s2']);

        // Distinct users → distinct cache keys.
        expect(mockCacheSetKeys.length).toBe(2);
        expect(mockCacheSetKeys[0]).not.toBe(mockCacheSetKeys[1]);
        expect(mockCacheSetKeys[1]).toContain('u:u-cache-b');
    });

    test('same user, different query params → different cache keys', async () => {
        const app = buildApp();
        mockState.user = mkUser('u-cache-c', ['s1']);

        await request(app).get('/api/pems/instances');
        await request(app).get('/api/pems/instances?page=2');
        await request(app).get('/api/pems/instances?status=ASSIGNED');

        const uniqueKeys = new Set(mockCacheSetKeys);
        expect(uniqueKeys.size).toBe(3);
    });

    test('second identical request within TTL is served from cache', async () => {
        const app = buildApp();
        mockState.user = mkUser('u-cache-d', ['s1']);

        const res1 = await request(app).get('/api/pems/instances');
        const readsBefore = mockCacheStore.size;
        const res2 = await request(app).get('/api/pems/instances');

        expect(res2.body).toEqual(res1.body);
        expect(mockCacheStore.size).toBe(readsBefore); // no new set → cache hit
        // Only one scope query executed against the pool for the data read.
        expect(mockState.pool.callsWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/)).toHaveLength(1);
    });
});
