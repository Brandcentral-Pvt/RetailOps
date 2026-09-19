/**
 * Regression tests for GET/PUT/DELETE /api/tasks.
 *
 * Covers the acceptance criteria from the data-correctness & access-control
 * patch:
 *   - GET /api/tasks resolves to the Tasks-table contract (NOT the legacy
 *     Actions-table stub that used to shadow it).
 *   - Restricted users are scoped to their assigned sellers and cannot read
 *     or mutate another seller's tasks.
 *   - Admins can filter by explicit sellerId.
 */
const express = require('express');
const request = require('supertest');

// ── Hoisted mocks (jest requires mock* variables in factories) ──────────────
let mockState = { user: null, pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
    };
});

jest.mock('../../middleware/auth', () => {
    return {
        // Same shape as the real middleware: 401 when unauthenticated.
        authenticate: (req, res, next) => {
            if (!mockState.user) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            req.user = mockState.user;
            next();
        },
        auth: (req, res, next) => {
            if (!mockState.user) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            req.user = mockState.user;
            next();
        },
    };
});

const taskRoutes = require('../../routes/taskRoutes');
const growthExecutionRoutes = require('../../routes/growthExecutionRoutes');
const { makeFakePool } = require('../../testUtils/fakePool');

const TASK_ROW = {
    Id: 't-1',
    Title: 'Fix listing title',
    Description: 'desc',
    Category: 'Listing Quality',
    Priority: 'High',
    Status: 'To-Do',
    Type: 'OPTIMIZATION',
    AsinId: null,
    AsinCode: 'B0TEST0001',
    SellerId: 's1',
    SellerName: 'ACME Store',
    AssignedTo: 'u-assignee',
    CreatedBy: 'u-creator',
    ImpactScore: 7,
    EffortEstimate: 'low',
    IsAIGenerated: false,
    Tags: '[]',
    CreatedAt: '2026-01-01T00:00:00Z',
    UpdatedAt: '2026-01-02T00:00:00Z',
    AssignedToFirstName: 'Ada',
    AssignedToLastName: 'Lovelace',
};

const tasksPool = () => makeFakePool([
    { match: /COUNT\(\*\) as total FROM Tasks/, rows: [{ total: 1 }] },
    { match: /FROM Tasks t/, rows: [TASK_ROW] },
    { match: /COUNT\(\*\) as count FROM Tasks/, rows: [{ Status: 'To-Do', count: 1 }] },
    { match: /SELECT TOP 1 SellerId FROM Tasks/, rows: [{ SellerId: 's-other' }] },
    { match: /UPDATE Tasks/, rows: [] },
    { match: /DELETE FROM Tasks/, rows: [] },
]);

/** Mirrors server.js ordering: explicit routers first, wildcard /api last. */
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/tasks', taskRoutes);
    app.use('/api', growthExecutionRoutes);
    return app;
};

const mkUser = (overrides = {}) => ({
    Id: 'u-bm',
    _id: 'u-bm',
    role: { name: 'brand_manager' },
    assignedSellers: ['s1', 's2'],
    ...overrides,
});

beforeEach(() => {
    mockState.user = null;
    mockState.pool = tasksPool();
    jest.clearAllMocks();
});

describe('GET /api/tasks — route ownership & contract', () => {
    test('resolves to the Tasks-table contract (success envelope + camelCase rows)', async () => {
        mockState.user = mkUser({ role: { name: 'admin' }, assignedSellers: [] });
        const res = await request(buildApp()).get('/api/tasks');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.tasks)).toBe(true);

        const task = res.body.data.tasks[0];
        expect(task.id).toBe('t-1');
        expect(task.title).toBe('Fix listing title');
        expect(task.status).toBe('To-Do');
        expect(task.sellerId).toBe('s1');
        expect(task.assignedToName).toBe('Ada Lovelace');
        // Legacy stub leaked PascalCase rows with no camelCase projection.
        expect(task.Status).toBeUndefined();

        // The winning SQL must read the Tasks table.
        const select = mockState.pool.callWhere(/FROM Tasks t/);
        expect(select).not.toBeNull();
        expect(select.sql).toContain('FROM Tasks t');
    });

    test('the legacy growth-execution stub must not shadow the route', async () => {
        mockState.user = mkUser({ role: { name: 'admin' }, assignedSellers: [] });
        const res = await request(buildApp()).get('/api/tasks');

        // Legacy stub shape was { success, data: <raw array> } from the
        // Actions table — none of that may appear.
        expect(res.body.data).not.toEqual(expect.any(Array));
        expect(mockState.pool.callWhere(/FROM Actions/)).toBeNull();
    });
});

describe('GET /api/tasks — seller-level access', () => {
    test('restricted user is scoped to assigned sellers', async () => {
        mockState.user = mkUser();
        const res = await request(buildApp()).get('/api/tasks');

        expect(res.status).toBe(200);
        const select = mockState.pool.callWhere(/FROM Tasks t/);
        expect(select.sql).toContain('SellerId IN (');
        expect(select.inputs.taskSeller_0).toBe('s1');
        expect(select.inputs.taskSeller_1).toBe('s2');
    });

    test('restricted user cannot read another seller via query param', async () => {
        mockState.user = mkUser();
        const res = await request(buildApp()).get('/api/tasks?sellerId=s-secret');

        expect(res.status).toBe(200);
        const select = mockState.pool.callWhere(/FROM Tasks t/);
        // The unauthorized seller id must never be bound into the query.
        expect(JSON.stringify(select.inputs)).not.toContain('s-secret');
        // Falls back to the assigned-sellers IN clause.
        expect(select.sql).toContain('SellerId IN (');
    });

    test('restricted user with no assigned sellers gets an empty list', async () => {
        mockState.user = mkUser({ assignedSellers: [] });
        const res = await request(buildApp()).get('/api/tasks');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.tasks).toEqual([]);
        expect(res.body.data.pagination.total).toBe(0);
        // Early return — no task SQL executed at all.
        expect(mockState.pool.callsWhere(/FROM Tasks/)).toHaveLength(0);
    });

    test('admin can filter by an explicit sellerId', async () => {
        mockState.user = mkUser({ role: { name: 'admin' }, assignedSellers: [] });
        const res = await request(buildApp()).get('/api/tasks?sellerId=s9');

        expect(res.status).toBe(200);
        const select = mockState.pool.callWhere(/FROM Tasks t/);
        expect(select.sql).toContain('SellerId = @sellerId');
        expect(select.inputs.sellerId).toBe('s9');
    });
});

describe('task mutations — seller-level access enforcement', () => {
    test('restricted user cannot update another seller’s task', async () => {
        // Access-check query reports the task belongs to s-other.
        mockState.user = mkUser({ assignedSellers: ['s1'] });
        const res = await request(buildApp())
            .put('/api/tasks/t-1/status')
            .send({ status: 'Completed' });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(mockState.pool.callWhere(/UPDATE Tasks/)).toBeNull();
    });

    test('restricted user CAN update a task inside their seller scope', async () => {
        mockState.pool = makeFakePool([
            { match: /SELECT TOP 1 SellerId FROM Tasks/, rows: [{ SellerId: 's1' }] },
            { match: /UPDATE Tasks/, rows: [] },
        ]);
        mockState.user = mkUser({ assignedSellers: ['s1'] });
        const res = await request(buildApp())
            .put('/api/tasks/t-1/status')
            .send({ status: 'In Progress' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockState.pool.callWhere(/UPDATE Tasks/)).not.toBeNull();
    });

    test('updating a non-existent task returns 404', async () => {
        mockState.pool = makeFakePool([
            { match: /SELECT TOP 1 SellerId FROM Tasks/, rows: [] },
        ]);
        mockState.user = mkUser({ assignedSellers: ['s1'] });
        const res = await request(buildApp())
            .put('/api/tasks/missing/status')
            .send({ status: 'Completed' });

        expect(res.status).toBe(404);
    });

    test('global roles bypass the seller-scope check', async () => {
        mockState.pool = makeFakePool([
            { match: /UPDATE Tasks/, rows: [] },
        ]);
        mockState.user = mkUser({ role: { name: 'admin' }, assignedSellers: [] });
        const res = await request(buildApp())
            .put('/api/tasks/t-1/status')
            .send({ status: 'Completed' });

        expect(res.status).toBe(200);
        // No ownership lookup needed for global roles.
        expect(mockState.pool.callWhere(/SELECT TOP 1 SellerId FROM Tasks/)).toBeNull();
    });

    test('restricted user cannot assign another seller’s task', async () => {
        mockState.user = mkUser({ assignedSellers: ['s1'] });
        const res = await request(buildApp())
            .put('/api/tasks/t-1/assign')
            .send({ userId: 'u-someone' });

        expect(res.status).toBe(403);
        expect(mockState.pool.callWhere(/UPDATE Tasks SET AssignedTo/)).toBeNull();
    });

    test('restricted user cannot delete another seller’s task', async () => {
        mockState.user = mkUser({ assignedSellers: ['s1'] });
        const res = await request(buildApp()).delete('/api/tasks/t-1');

        expect(res.status).toBe(403);
        expect(mockState.pool.callWhere(/DELETE FROM Tasks/)).toBeNull();
    });
});
