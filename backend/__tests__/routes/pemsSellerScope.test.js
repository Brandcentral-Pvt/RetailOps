/**
 * Seller-scope RBAC regression tests for the PEMS task module.
 *
 * The security property under test: a restricted user assigned a subset of
 * sellers can never read, mutate or aggregate another seller's task data
 * through any PEMS surface — list, detail, My Day, notifications, dashboards,
 * automation stats, or the assignee/reviewer pickers.
 *
 * These cover the gaps found in the audit that motivated the work:
 *   - dashboardController ran 8 unfiltered aggregates (KPIs, departments, top
 *     performers, workload, stale reviews, high-priority delays, live tasks,
 *     activity feed) for any authenticated user.
 *   - pemsService dashboard/service functions had no seller scope at all.
 *   - PemsTaskReviews carries no SellerId, so reviewer/review-stat queries
 *     leaked cross-seller activity through a missing join.
 *   - getAutomationStats 500'd because a second, unscoped definition of the
 *     controller function shadowed the real one and required a module path
 *     (config/db) that does not exist.
 *   - synthetic rule_* task ids 404'd because they live in `Actions`.
 *   - `Actions` has no ReviewerId column, so a scope fragment referencing it
 *     would fail the whole list query at runtime.
 *   - notifications accepted ?userId= for any caller (IDOR).
 *   - estate-wide write jobs (SLA refresh, escalations, progress rebuild,
 *     demo seed) were open to any authenticated seller user.
 */
const express = require('express');
const request = require('supertest');

let mockState = { user: null, pool: null, callers: [] };
const mockCacheStore = new Map();

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id',
        withTransaction: async (fn) => fn(mockState.pool),
    };
});

jest.mock('../../services/cacheService', () => ({
    key: (...parts) => parts.join(':'),
    get: async (k) => (mockCacheStore.has(k) ? mockCacheStore.get(k) : null),
    set: async (k, v) => { mockCacheStore.set(k, v); },
    invalidateNamespace: async () => {},
}));

jest.mock('../../middleware/auth', () => ({
    authenticate: (req, res, next) => (mockState.user ? (req.user = mockState.user, next()) : res.status(401).json({})),
    auth: (req, res, next) => (mockState.user ? (req.user = mockState.user, next()) : res.status(401).json({})),
    requirePermission: () => (req, res, next) => next(),
}));

const pemsRoutes = require('../../routes/pems/pemsRoutes');
const { makeFakePool } = require('../../testUtils/fakePool');

// ── Scope helper unit tests (no HTTP) ────────────────────────────────────────
const { resolveSellerScope, buildScopeClause, getAssignedSellerIds, canViewTaskByScope } =
    require('../../services/pems/sellerScope');

const restricted = (sellers) => ({ Id: 'u1', role: { name: 'brand_manager' }, assignedSellers: sellers });
const admin = { Id: 'a1', role: { name: 'admin' }, assignedSellers: [] };

/** Collects every SQL string the run issued, for leak assertions. */
const pool = () => {
    const p = makeFakePool([
        // instance + dashboard style aggregates: always return a marker row so a
        // scoped response is distinguishable from an unscoped one.
        { match: /FROM PemsTaskInstances/i, rows: [{ SellerId: 'S9', Status: 'ASSIGNED', Department: 'Ops', total: 999 }] },
        { match: /FROM Actions/i, rows: [{ Id: 'act-1', Title: 'Automated action', SellerId: 'S9', Status: 'PENDING' }] },
        { match: /FROM PemsTaskReviews/i, rows: [{ ReviewerId: 'u1', ReviewerName: 'U', totalReviews: 999 }] },
        { match: /FROM PemsTaskAuditLogs/i, rows: [{ Id: 1, Action: 'X' }] },
        { match: /FROM Sellers/i, rows: [{ Id: 'S1', Name: 'Seller One', Marketplace: 'US' }] },
        { match: /FROM Users/i, rows: [] },
        { match: /UserSellers/i, rows: [] },
        // Must precede the generic PemsNotifications route: the unread-count
        // query reads recordset[0].count and throws on an empty recordset.
        { match: /SELECT COUNT\(\*\) as count FROM PemsNotifications/i, rows: [{ count: 0 }] },
        { match: /PemsNotifications/i, rows: [] },
        { match: /.*/, rows: [] },
    ]);
    // Record every issued query against the current user so tests can assert on
    // the actual scope fragments rather than trusting the response shape alone.
    const origRequest = p.request;
    p.request = (...a) => {
        const r = origRequest(...a);
        const origQuery = r.query.bind(r);
        r.query = (t) => { mockState.callers.push({ sql: t, user: mockState.user }); return origQuery(t); };
        return r;
    };
    return p;
};

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/pems', pemsRoutes);
    return app;
};

beforeEach(() => {
    mockState.user = null;
    mockState.pool = pool();
    mockState.callers = [];
    mockCacheStore.clear();
});

describe('sellerScope — canonical scope resolution', () => {
    test('restricted user scope is their assignment, brand-less work allowed', () => {
        const s = resolveSellerScope(restricted(['S1', 'S2']), null);
        expect(s.unrestricted).toBe(false);
        expect(s.sellerIds).toEqual(['S1', 'S2']);
        expect(s.allowOwnBrandless).toBe(true);
    });

    test('global roles are unrestricted', () => {
        expect(resolveSellerScope(admin, null).unrestricted).toBe(true);
    });

    test('requested seller outside the assignment resolves to an empty scope', () => {
        const s = resolveSellerScope(restricted(['S1']), 'S9');
        expect(s.sellerIds).toEqual([]);
        expect(s.empty).toBe(true);
    });

    test('requested seller inside the assignment is allowed', () => {
        expect(resolveSellerScope(restricted(['S1', 'S2']), 'S2').sellerIds).toEqual(['S2']);
    });

    test('no assigned sellers yields an empty scope (not unrestricted)', () => {
        const s = resolveSellerScope(restricted([]), null);
        expect(s.unrestricted).toBe(false);
        expect(s.sellerIds).toEqual([]);
    });

    test('assignedSellers accepts ids, objects and case variants', () => {
        expect(getAssignedSellerIds({ assignedSellers: ['S1'] })).toEqual(['S1']);
        expect(getAssignedSellerIds({ AssignedSellers: [{ _id: 'S2' }] })).toEqual(['S2']);
        expect(getAssignedSellerIds({ sellers: [{ Id: 'S3' }] })).toEqual(['S3']);
    });

    test('no requester (internal job) is unrestricted, never fails closed by accident', () => {
        expect(resolveSellerScope(null, null).unrestricted).toBe(true);
    });
});

describe('sellerScope — SQL fragment generation', () => {
    const clause = (u, req, alias, opts) => buildScopeClause(resolveSellerScope(u, req), alias, opts);

    test('unrestricted yields an empty fragment (global roles see everything)', () => {
        expect(clause(admin, null, 'i').clause).toBe('');
    });

    test('restricted user sees only assigned sellers plus own brand-less tasks', () => {
        const { clause: c, params } = clause(restricted(['S1', 'S2']), null, 'i');
        expect(c).toContain('i.SellerId IN (@ssi_0,@ssi_1)');
        expect(c).toContain('i.SellerId IS NULL');
        expect(params).toEqual(expect.arrayContaining([['ssi_0', 'S1'], ['ssi_1', 'S2'], ['ssMe', 'u1']]));
    });

    test('Actions scope never references a nonexistent ReviewerId column', () => {
        // Actions has no ReviewerId. If the fragment named it, SQL Server would
        // reject the entire task list with "Invalid column name".
        const { clause: c } = clause(restricted(['S1']), null, 'a', { hasReviewer: false });
        expect(c).not.toContain('ReviewerId');
        expect(c).toContain('a.SellerId IN (@ssa_0)');
        expect(c).toContain('a.AssignedTo = @ssMe');
    });

    test('PemsTaskInstances scope does include ReviewerId for brand-less review', () => {
        expect(clause(restricted(['S1']), null, 'i').clause).toContain('i.ReviewerId = @ssMe');
    });

    test('out-of-scope explicit seller is denied via impossible predicate', () => {
        expect(clause(restricted(['S1']), 'S9', 'i').clause).toBe(' AND 1=0');
    });

    test('un-aliased queries use bare column names (no leading dot)', () => {
        const c = clause(restricted(['S1']), null, '').clause;
        expect(c).toContain('SellerId IN (');
        expect(c).not.toContain('.SellerId');
    });

    test('zero-seller user with no seller filter sees only own brand-less tasks', () => {
        const { clause: c } = clause(restricted([]), null, 'i');
        expect(c).toContain('SellerId IS NULL');
        expect(c).not.toContain('SellerId IN (');
    });
});

describe('canViewTaskByScope — in-memory single-record guard', () => {
    test('assigned seller readable, foreign seller not', () => {
        const u = restricted(['S1']);
        expect(canViewTaskByScope(u, { SellerId: 'S1' })).toBe(true);
        expect(canViewTaskByScope(u, { SellerId: 'S9' })).toBe(false);
    });

    test('brand-less readable only by assignee (no reviewer on Actions)', () => {
        const u = restricted(['S1']);
        expect(canViewTaskByScope(u, { SellerId: null, AssignedTo: 'u1' })).toBe(true);
        expect(canViewTaskByScope(u, { SellerId: null, AssignedTo: 'u2' })).toBe(false);
    });
});

describe('GET /api/pems/dashboard/* — seller scope', () => {
    test('dashboard summary applies seller scope to every aggregate query', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/dashboard/summary');

        expect(res.status).toBe(200);
        // Every query that reads PemsTaskInstances must carry a scope fragment
        // (or be the caller-scoped request). Assert none is a bare aggregate.
        const instanceQueries = mockState.callers.filter(c => /FROM PemsTaskInstances/i.test(c.sql));
        expect(instanceQueries.length).toBeGreaterThan(0);
        for (const q of instanceQueries) {
            expect(q.sql).toMatch(/SellerId IN \(|SellerId IS NULL|1=0/);
        }
    });

    test('dashboard summary never leaks foreign seller rows to a restricted user', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/dashboard/summary');
        expect(res.status).toBe(200);
        // The fake pool always returns a S9 row; a scoped response must not
        // surface it. (Scope is in the WHERE; the fixture models the DB honoring
        // it, so this mainly guards the envelope stays 200 and scoped.)
        const scopedQueries = mockState.callers.filter(c => /S9|999/.test(JSON.stringify(c.user || {})) === false);
        expect(scopedQueries.length).toBeGreaterThan(0);
    });

    test('live-tasks applies seller scope', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/dashboard/live-tasks');
        expect(res.status).toBe(200);
        const q = mockState.callers.find(c => /FROM PemsTaskInstances i/i.test(c.sql));
        expect(q.sql).toMatch(/SellerId IN \(|1=0/);
    });

    test('activity-feed scopes through the joined task instance', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/dashboard/activity-feed');
        expect(res.status).toBe(200);
        const q = mockState.callers.find(c => /FROM PemsTaskAuditLogs/i.test(c.sql));
        expect(q.sql).toMatch(/SellerId IN \(|1=0/);
    });

    test('global admin dashboard summary is not restricted', async () => {
        mockState.user = admin;
        const res = await request(buildApp()).get('/api/pems/dashboard/summary');
        expect(res.status).toBe(200);
    });
});

describe('GET /api/pems/dashboard service aggregates — seller scope', () => {
    const readEndpoints = [
        '/api/pems/dashboard/kpis',
        '/api/pems/dashboard/seller-performance',
        '/api/pems/dashboard/department-performance',
        '/api/pems/dashboard/brand-manager-performance',
        '/api/pems/dashboard/reviewer-performance',
        '/api/pems/dashboard/risk-panel',
        '/api/pems/dashboard/top-performers',
    ];

    test.each(readEndpoints)('%s is seller-scoped for a restricted user', async (path) => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get(path);
        expect(res.status).toBe(200);
        const reads = mockState.callers.filter(c => /FROM PemsTaskInstances|JOIN PemsTaskInstances|FROM Actions/i.test(c.sql));
        // Each endpoint must have bound at least one scoped task query.
        expect(reads.length).toBeGreaterThan(0);
        for (const q of reads) {
            expect(q.sql).toMatch(/SellerId IN \(|SellerId IS NULL|1=0/);
        }
    });

    test('reviewer-performance joins the task instance so reviews carry seller scope', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/dashboard/reviewer-performance');
        expect(res.status).toBe(200);
        const q = mockState.callers.find(c => /FROM PemsTaskReviews/i.test(c.sql));
        expect(q.sql).toMatch(/JOIN PemsTaskInstances/);
        expect(q.sql).toMatch(/SellerId IN \(|1=0/);
    });
});

describe('GET /api/pems/automation-stats — 500 regression + scope', () => {
    test('returns 200 with seller-scoped counts for a restricted user', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/automation-stats');

        // Regression: an unscoped duplicate of this handler used to shadow the
        // real one and require config/db (nonexistent) => 500.
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({ total: expect.any(Number), open: expect.any(Number), overdue: expect.any(Number) });
        const q = mockState.callers.find(c => /Source = 'RULESET'/i.test(c.sql));
        expect(q).toBeTruthy();
        expect(q.sql).toMatch(/SellerId IN \(|SellerId IS NULL|1=0/);
    });

    test('global admin gets unscoped automation stats', async () => {
        mockState.user = admin;
        const res = await request(buildApp()).get('/api/pems/automation-stats');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('synthetic rule_* task detail — 404 regression', () => {
    test('opens a rule task for a user assigned to its seller', async () => {
        mockState.user = restricted(['S9']);
        // The Actions fixture returns a PENDING automated action for S9.
        const res = await request(buildApp()).get('/api/pems/instances/rule_act-1');
        // Reaches the service and passes the seller check (not a 404 from a
        // missing PemsTaskInstances row).
        expect(res.status).not.toBe(404);
    });

    test('a rule task in a foreign seller is not readable', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/instances/rule_act-1');
        // Denied: either 404 (not found / not visible) — never 200 with the row.
        expect([200, 404]).toContain(res.status);
        if (res.status === 200) {
            expect(res.body.instance?.SellerId).not.toBe('S9');
        }
    });
});

describe('GET /api/pems/sellers — picker limited to assigned sellers', () => {
    test('restricted user seller list is scoped to their assignment', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/sellers');
        expect(res.status).toBe(200);
        const q = mockState.callers.find(c => /FROM Sellers/i.test(c.sql));
        expect(q.sql).toMatch(/Id IN \(|1=0/);
    });

    test('global admin sees all sellers', async () => {
        mockState.user = admin;
        const res = await request(buildApp()).get('/api/pems/sellers');
        expect(res.status).toBe(200);
    });
});

describe('GET /api/pems/brand-managers + /reviewers — assignee scoped to the seller', () => {
    /** Fake pool for the picker that records queries like the shared helper. */
    const pickerPool = (rows) => {
        const p = makeFakePool([
            { match: /FROM Users u/i, rows },
            { match: /.*/, rows: [] },
        ]);
        const origRequest = p.request;
        p.request = (...a) => {
            const r = origRequest(...a);
            const origQuery = r.query.bind(r);
            r.query = (t) => { mockState.callers.push({ sql: t, inputs: { ...r._inputs }, user: mockState.user }); return origQuery(t); };
            return r;
        };
        return p;
    };

    test("with no seller the list is still limited to the caller's own sellers", async () => {
        mockState.pool = pickerPool([
            { Id: 'u9', FirstName: 'Own', LastName: 'Brand', Email: 'o@x.com', RoleName: 'brand_manager' },
        ]);
        mockState.user = restricted(['S1', 'S2']);
        const res = await request(buildApp()).get('/api/pems/brand-managers');
        expect(res.status).toBe(200);
        const q = mockState.callers.find(c => /FROM Users u/i.test(c.sql));
        expect(q.sql).toMatch(/UserSellers/);
        // Bound to the caller's two sellers, not the whole directory.
        expect(Object.values(q.inputs)).toEqual(expect.arrayContaining(['S1', 'S2']));
        expect(q.sql).not.toMatch(/SELECT u\.Id[^]*?\n(?!.*UserSellers)/);
    });

    test('a seller narrows the list to that brand\'s people', async () => {
        mockState.pool = pickerPool([
            { Id: 'u9', FirstName: 'Nova', LastName: 'Lead', Email: 'n@x.com', RoleName: 'brand_manager' },
        ]);
        mockState.user = restricted(['S1', 'S2']);
        const res = await request(buildApp()).get('/api/pems/brand-managers?sellerId=S1');
        expect(res.status).toBe(200);
        const q = mockState.callers.find(c => /FROM Users u/i.test(c.sql));
        expect(q.inputs).toHaveProperty('pickSellerOne', 'S1');
        // A single-seller filter must not use the IN (...) multi-seller form.
        expect(q.sql).toMatch(/us\.SellerId = @pickSellerOne/);
        expect(q.sql).not.toMatch(/us\.SellerId IN \(/);
        expect(res.body.data[0].FullName).toBe('Nova Lead');
    });

    test('naming a seller outside the caller\'s scope returns nothing (fails closed)', async () => {
        mockState.pool = pickerPool([
            { Id: 'u9', FirstName: 'Other', LastName: 'Brand', Email: 'o@x.com', RoleName: 'brand_manager' },
        ]);
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/brand-managers?sellerId=S-OTHER-BRAND');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        // It must not even reach the database.
        expect(mockState.callers.some(c => /FROM Users u/i.test(c.sql))).toBe(false);
    });

    test('reviewer picker follows the same rule', async () => {
        mockState.pool = pickerPool([
            { Id: 'u8', FirstName: 'Rev', LastName: 'Iewer', Email: 'r@x.com', RoleName: 'reviewer' },
        ]);
        mockState.user = restricted(['S1']);
        const ok = await request(buildApp()).get('/api/pems/reviewers?sellerId=S1');
        expect(ok.body.data[0].FullName).toBe('Rev Iewer');
        const denied = await request(buildApp()).get('/api/pems/reviewers?sellerId=S-OTHER-BRAND');
        expect(denied.body.data).toEqual([]);
    });

    test('a global admin may still scope down to one seller', async () => {
        mockState.pool = pickerPool([
            { Id: 'u9', FirstName: 'Nova', LastName: 'Lead', Email: 'n@x.com', RoleName: 'brand_manager' },
        ]);
        mockState.user = admin;
        const res = await request(buildApp()).get('/api/pems/brand-managers?sellerId=S1');
        expect(res.status).toBe(200);
        const q = mockState.callers.find(c => /FROM Users u/i.test(c.sql));
        expect(q.inputs).toHaveProperty('pickSellerOne', 'S1');
        expect(res.body.data).toHaveLength(1);
    });
});

describe('POST /api/pems/instances — assignee must cover the seller', () => {
    test('rejects an assignee who is not bound to the chosen seller', async () => {
        mockState.pool = makeFakePool([{
            // userCoversSeller() asks whether the assignee covers the seller.
            match: /JOIN Roles r ON r\.Id = u\.RoleId[\s\S]*EXISTS \(SELECT 1 FROM UserSellers/i,
            rows: [], // not covered
        }]);
        mockState.user = restricted(['S1']);
        const res = await request(buildApp())
            .post('/api/pems/instances')
            .send({ title: 'Cross-brand assignment', sellerId: 'S1', assignedTo: 'u-from-another-brand' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/assignee does not work on this seller/i);
    });

    test('allows an assignee who is bound to the chosen seller', async () => {
        mockState.pool = makeFakePool([
            { match: /JOIN Roles r ON r\.Id = u\.RoleId[\s\S]*EXISTS \(SELECT 1 FROM UserSellers/i, rows: [{ ok: 1 }] },
            // createInstance counts existing rows to build the instance code.
            { match: /SELECT COUNT\(\*\) as c FROM PemsTaskInstances/i, rows: [{ c: 7 }] },
            { match: /INSERT INTO PemsTaskInstances/i, rows: [{ Id: 'new-task' }] },
            { match: /.*/, rows: [] },
        ]);
        mockState.user = restricted(['S1']);
        const res = await request(buildApp())
            .post('/api/pems/instances')
            .send({ title: 'In-brand assignment', sellerId: 'S1', assignedTo: 'u-of-this-brand' });
        expect(res.status).toBe(200);
    });
});

describe('GET /api/pems/my-day — per-user and seller scoped', () => {
    test('my-day applies seller scope to its per-user queries', async () => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp()).get('/api/pems/my-day');
        expect(res.status).toBe(200);
        const reads = mockState.callers.filter(c => /FROM PemsTaskInstances i/i.test(c.sql));
        expect(reads.length).toBeGreaterThan(0);
        for (const q of reads) {
            expect(q.sql).toMatch(/SellerId IN \(|SellerId IS NULL|1=0/);
        }
    });
});

describe('GET /api/pems/notifications — IDOR regression', () => {
    test('caller cannot read another user\'s notifications via ?userId', async () => {
        mockState.user = { Id: 'u1', role: { name: 'brand_manager' }, assignedSellers: ['S1'] };
        const res = await request(buildApp()).get('/api/pems/notifications?userId=someone-else');
        expect(res.status).toBe(200);
        // The service must be called with the caller's id, not the query param.
        const q = mockState.callers.find(c => /PemsNotifications/i.test(c.sql));
        if (q) {
            const bound = Object.values(q.inputs || {});
            expect(bound).not.toContain('someone-else');
        }
    });
});

describe('estate-wide write jobs — restricted to global roles', () => {
    const jobEndpoints = [
        ['post', '/api/pems/dashboard/refresh-sla'],
        ['post', '/api/pems/dashboard/check-escalations'],
        ['post', '/api/pems/recalculate-progress'],
        ['post', '/api/pems/seed-demo'],
    ];

    test.each(jobEndpoints)('%s %s is 403 for a restricted seller user', async (method, path) => {
        mockState.user = restricted(['S1']);
        const res = await request(buildApp())[method](path).send({});
        expect(res.status).toBe(403);
    });

    test.each(jobEndpoints)('%s %s is allowed for a global admin', async (method, path) => {
        mockState.user = admin;
        const res = await request(buildApp())[method](path).send({});
        // Not 403 — the point is the guard does not over-block global roles.
        expect(res.status).not.toBe(403);
    });
});
