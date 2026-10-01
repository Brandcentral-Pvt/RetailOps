/**
 * Regression tests for server-side pagination on GET /api/pems/instances.
 *
 * The task list used to ask the server for one page and then filter it again in
 * the browser, which meant: results only ever reflected the rows on screen,
 * "N shown of M" never added up, and a filtered page could come back empty with
 * no way back. Filtering and paging both belong to the API.
 *
 * Covers:
 *   - page/limit are clamped, so the endpoint can't be turned into a full dump.
 *   - automation "rule tasks" (Actions) participate in the page slice and in
 *     `total` instead of being prepended to every page.
 *   - the filters the client used to apply locally (excludeStatuses, categories,
 *     health) reach the SQL.
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

jest.mock('../../middleware/auth', () => ({
    authenticate: (req, res, next) => { req.user = mockState.user; next(); },
    auth: (req, res, next) => {
        if (!mockState.user) return res.status(401).json({ success: false, message: 'Authentication required' });
        req.user = mockState.user;
        next();
    },
    requirePermission: () => (req, res, next) => next(),
}));

const pemsRoutes = require('../../routes/pems/pemsRoutes');
const { makeFakePool } = require('../../testUtils/fakePool');

/** How many rows each source is allowed to report, per test. */
let instanceTotal = 40;
let ruleTotal = 0;

const instance = (i) => ({
    Id: `inst-${i}`,
    InstanceCode: `PT-${i}`,
    Title: `Task ${i}`,
    Status: 'ASSIGNED',
    Priority: 'HIGH',
    SellerId: 's1',
    SellerName: 'Seller s1',
    DueDate: null,
    CreatedAt: new Date().toISOString(),
    Tags: null,
    Attachments: null,
});

const ruleAction = (i) => ({
    Id: `act-${i}`,
    Title: `Automation ${i}`,
    Status: 'PENDING',
    Priority: 'HIGH',
    SellerId: 's1',
    SellerName: 'Seller s1',
    AssignedTo: 'u1',
    CreatedAt: new Date().toISOString(),
    DueDate: null,
    Description: null,
    Asins: null,
    SubTasks: null,
    SubTaskProgress: null,
    Category: 'PRICING',
});

/**
 * Emulates OFFSET/FETCH so the assertions test the service's paging arithmetic
 * rather than the fake pool's willingness to return rows.
 */
const paged = (rows, entry) => {
    const offset = Number(entry.inputs.offset ?? 0);
    const limit = Number(entry.inputs.limit ?? rows.length);
    return rows.slice(offset, offset + limit);
};

const pool = () => makeFakePool([
    { match: /COUNT\(\*\) as total FROM PemsTaskInstances/, rows: () => [{ total: instanceTotal }] },
    { match: /COUNT\(\*\) as total FROM Actions a/, rows: () => [{ total: ruleTotal }] },
    { match: /FROM Actions a\s+LEFT JOIN Sellers/, rows: entry => paged(Array.from({ length: ruleTotal }, (_, i) => ruleAction(i)), entry) },
    { match: /FROM PemsTaskInstances i\s+LEFT JOIN/, rows: entry => paged(Array.from({ length: instanceTotal }, (_, i) => instance(i)), entry) },
]);

const app = () => {
    const a = express();
    a.use(express.json());
    a.use('/api/pems', pemsRoutes);
    return a;
};

const globalUser = { Id: 'u-admin', role: { name: 'admin' }, assignedSellers: [] };

const get = (qs) => request(app()).get(`/api/pems/instances${qs}`);

beforeEach(() => {
    instanceTotal = 40;
    ruleTotal = 0;
    mockState.user = globalUser;
    mockState.pool = pool();
    mockCacheStore.clear();
    mockCacheSetKeys.length = 0;
});

describe('GET /api/pems/instances — page size is clamped', () => {
    test('an oversized limit is capped instead of dumping the table', async () => {
        const res = await get('?limit=100000');
        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(100);
    });

    test('a nonsense limit falls back to the default', async () => {
        const res = await get('?limit=abc');
        expect(res.body.pagination.limit).toBe(25);
    });

    test('page below 1 is floored to the first page', async () => {
        const res = await get('?page=-4&limit=10');
        expect(res.body.pagination.page).toBe(1);
        const data = mockState.pool.callWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/);
        expect(data.inputs.offset).toBe(0);
    });

    test('totalPages is derived from the clamped limit', async () => {
        const res = await get('?limit=100000');
        expect(res.body.pagination.totalPages).toBe(Math.ceil(instanceTotal / 100));
    });
});

describe('GET /api/pems/instances — automation rows are paged, not prepended', () => {
    beforeEach(() => { ruleTotal = 3; });

    test('a page holds exactly `limit` rows even with automation rows present', async () => {
        const res = await get('?limit=25&includeRuleTasks=true');
        expect(res.body.instances).toHaveLength(25);
    });

    test('automation rows are counted in total', async () => {
        const res = await get('?limit=25&includeRuleTasks=true');
        expect(res.body.pagination.total).toBe(instanceTotal + ruleTotal);
        expect(res.body.pagination.totalPages).toBe(Math.ceil((instanceTotal + ruleTotal) / 25));
    });

    test('automation rows occupy the head of page 1, instances continue after them', async () => {
        const res = await get('?limit=25&includeRuleTasks=true');
        const ruleRows = res.body.instances.filter(t => t.IsRuleTask);
        expect(ruleRows).toHaveLength(3);
        // 3 automation + 22 instances fills the page; the instances query must
        // therefore start at offset 0 and ask for only the remainder.
        const data = mockState.pool.callWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/);
        expect(data.inputs.offset).toBe(0);
        expect(data.inputs.limit).toBe(22);
    });

    test('page 2 skips past the automation rows entirely', async () => {
        const res = await get('?page=2&limit=25&includeRuleTasks=true');
        expect(res.body.instances.filter(t => t.IsRuleTask)).toHaveLength(0);
        const data = mockState.pool.callWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/);
        expect(data.inputs.offset).toBe(25 - 3);
        expect(data.inputs.limit).toBe(25);
    });

    test('the instance query is skipped when one page holds only automation rows', async () => {
        instanceTotal = 2;
        ruleTotal = 5;
        const res = await get('?limit=5&includeRuleTasks=true');
        expect(res.body.instances).toHaveLength(5);
        expect(res.body.instances.every(t => t.IsRuleTask)).toBe(true);
        expect(mockState.pool.callsWhere(/FROM PemsTaskInstances i\s+LEFT JOIN/)).toHaveLength(0);
    });

    test('without includeRuleTasks the automation table is never queried', async () => {
        await get('?limit=25');
        expect(mockState.pool.callsWhere(/FROM Actions a/)).toHaveLength(0);
    });
});

describe('GET /api/pems/instances — filters reach the SQL', () => {
    test('excludeStatuses drives the "To do" view', async () => {
        await get('?excludeStatuses=APPROVED,CANCELLED');
        const count = mockState.pool.callWhere(/COUNT\(\*\) as total FROM PemsTaskInstances/);
        expect(count.sql).toContain('i.Status <> @exSt0');
        expect(count.sql).toContain('i.Status <> @exSt1');
        expect(count.inputs.exSt0).toBe('APPROVED');
        expect(count.inputs.exSt1).toBe('CANCELLED');
    });

    test('categories matches Category OR Department, as the disputes view expects', async () => {
        await get('?categories=PRICING,LISTING');
        const count = mockState.pool.callWhere(/COUNT\(\*\) as total FROM PemsTaskInstances/);
        expect(count.sql).toContain('i.Category IN (@cat0,@cat1)');
        expect(count.sql).toContain('i.Department IN (@cat0,@cat1)');
    });

    test('the health band is computed in SQL, not in the browser', async () => {
        await get('?health=critical');
        const count = mockState.pool.callWhere(/COUNT\(\*\) as total FROM PemsTaskInstances/);
        expect(count.sql).toContain('BETWEEN 0 AND 49');
        // The score must come from the same penalty ladder as calculateHealth().
        expect(count.sql).toContain('WeightedProgressPct');
        expect(count.sql).toContain('ReworkCount');
        expect(count.sql).toContain('SLAStatus');
    });

    test('health bands do not overlap', async () => {
        const bands = {};
        for (const band of ['critical', 'attention', 'healthy']) {
            // Fresh pool per request: callWhere() returns the first match, and
            // the response is cached per user+query for 30s.
            mockState.pool = pool();
            const res = await get(`?health=${band}`);
            expect(res.status).toBe(200);
            const count = mockState.pool.callWhere(/COUNT\(\*\) as total FROM PemsTaskInstances/);
            bands[band] = count.sql.match(/BETWEEN (\d+) AND (\d+)/).slice(1).map(Number);
        }
        expect(bands.critical).toEqual([0, 49]);
        expect(bands.attention).toEqual([50, 79]);
        expect(bands.healthy).toEqual([80, 100]);
    });

    test('an unknown health value is ignored rather than erroring', async () => {
        const res = await get('?health=nonsense');
        expect(res.status).toBe(200);
        const count = mockState.pool.callWhere(/COUNT\(\*\) as total FROM PemsTaskInstances/);
        expect(count.sql).not.toContain('BETWEEN 0 AND 49');
    });
});
