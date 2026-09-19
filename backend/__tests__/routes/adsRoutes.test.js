/**
 * Ads Intelligence — HTTP access tests.
 *
 * Mounts the real `/api/ads` router behind a faithful mock of
 * middleware/auth.js (same semantics as backend/__tests__/routes/
 * dashboardAccess.test.js) so the *wiring* is pinned, not just the controller:
 *
 *   - anonymous → 401;
 *   - authenticated without `adsreport_view` → 403;
 *   - scoped user asking for another seller → 403 `forbidden_seller`;
 *   - scoped user → 200, with every DB query restricted to their sellers;
 *   - the table endpoint really paginates in SQL;
 *   - the export/upload endpoints carry their own permissions.
 */
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

let mockState = { user: null, pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

jest.mock('../../middleware/auth', () => {
    const deny = (res, message, status) => res.status(status).json({ success: false, message });
    const roleOf = (req) => req.user?.role?.name || req.user?.role?.Name || req.user?.role;
    return {
        authenticate: (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            req.user = mockState.user;
            next();
        },
        requirePermission: (permissionName) => (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            if (['admin', 'super_admin'].includes(roleOf(req))) return next();
            if (!(req.user.permissions || []).includes(permissionName)) {
                return deny(res, `Missing permission: ${permissionName}`, 403);
            }
            next();
        },
        requireAnyPermission: (names) => (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            if (['admin', 'super_admin'].includes(roleOf(req))) return next();
            if (!names.some((n) => (req.user.permissions || []).includes(n))) return deny(res, 'Forbidden', 403);
            next();
        },
    };
});

const { buildAdsPool } = require('../../testUtils/adsFixtures');
const adsRoutes = require('../../routes/adsRoutes');

const app = express();
app.use(express.json());
app.use('/api/ads', adsRoutes);

const ADMIN = { Id: 'u-admin', role: { name: 'admin' }, assignedSellers: [], permissions: [] };
const SCOPED = {
    Id: 'u-bm', role: { name: 'brand_manager' }, assignedSellers: ['S1', 'S2'], permissions: ['adsreport_view'],
};
const NO_PERMISSION = { Id: 'u-np', role: { name: 'listing_team' }, assignedSellers: ['S1'], permissions: [] };

const WINDOW = '?startDate=2026-08-01&endDate=2026-08-28';

beforeEach(() => { mockState.pool = buildAdsPool(); });

describe('GET /api/ads/overview', () => {
    test('anonymous callers get 401', async () => {
        mockState.user = null;
        const res = await request(app).get(`/api/ads/overview${WINDOW}`);
        expect(res.status).toBe(401);
    });

    test('authenticated but lacking adsreport_view gets 403', async () => {
        mockState.user = NO_PERMISSION;
        const res = await request(app).get(`/api/ads/overview${WINDOW}`);
        expect(res.status).toBe(403);
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('a scoped user receives only their own sellers in the response scope', async () => {
        mockState.user = SCOPED;
        const res = await request(app).get(`/api/ads/overview${WINDOW}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.scope.isGlobal).toBe(false);
        expect(res.body.data.scope.sellerFilterApplied).toBe(true);
        expect(res.body.data.insights.insights.length).toBeGreaterThan(0);
        const scoped = mockState.pool.calls.filter((c) => c.sql.includes('SellerId IN (@adsScope_'));
        expect(scoped.length).toBeGreaterThan(5);
        expect(Object.values(scoped[0].inputs)).toEqual(expect.arrayContaining(['S1', 'S2']));
    });

    test('requesting a foreign seller is refused with context, and no query runs', async () => {
        mockState.user = SCOPED;
        const res = await request(app).get(`/api/ads/overview${WINDOW}&sellerId=S9`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(res.body.assignedSellers).toEqual(['S1', 'S2']);
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('an admin may filter by a specific seller (the dropdown is honoured)', async () => {
        mockState.user = ADMIN;
        const res = await request(app).get(`/api/ads/overview${WINDOW}&sellerId=S9`);
        expect(res.status).toBe(200);
        const scoped = mockState.pool.calls.find((c) => c.sql.includes('FROM AdsPerformance'));
        expect(Object.values(scoped.inputs)).toContain('S9');
    });
});

describe('GET /api/ads/table', () => {
    test('paginates in SQL and returns the whole-set total', async () => {
        mockState.user = SCOPED;
        const res = await request(app).get(`/api/ads/table${WINDOW}&page=2&limit=25&sortBy=acos&sortOrder=desc`);
        expect(res.status).toBe(200);
        const paged = mockState.pool.callWhere(/OFFSET @offset ROWS/);
        expect(paged).toBeTruthy();
        expect(paged.inputs.offset).toBe(25);
        expect(paged.inputs.limit).toBe(25);
        expect(res.body.data.page).toBe(2);
        expect(res.body.data.total).toBe(3);
        expect(res.body.data.rows[0]).toHaveProperty('spark');
    });

    test('the seller scope is applied to the table query too', async () => {
        mockState.user = SCOPED;
        await request(app).get(`/api/ads/table${WINDOW}`);
        const tableCalls = mockState.pool.callsWhere(/OFFSET @offset ROWS|SUM\(prevSpend\) AS prevSpend/);
        expect(tableCalls.length).toBeGreaterThan(0);
        for (const call of tableCalls) {
            expect(call.sql).toContain('SellerId IN (@adsScope_');
            expect(call.sql).toContain('ReportType = @reportType');
        }
    });
});

describe('GET /api/ads/meta', () => {
    test('capability metadata needs authentication but no ads permission', async () => {
        mockState.user = NO_PERMISSION;
        const res = await request(app).get('/api/ads/meta');
        expect(res.status).toBe(200);
        expect(res.body.data.flags).toContain('waste');
    });
});

describe('POST /api/ads/ai-review', () => {
    test('refuses when the caller cannot see the requested seller', async () => {
        mockState.user = SCOPED;
        const res = await request(app).post('/api/ads/ai-review').send({ sellerId: 'S9', startDate: '2026-08-01', endDate: '2026-08-28' });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
    });

    test('never sends more than the caller is allowed to see', async () => {
        mockState.user = SCOPED;
        await request(app).post('/api/ads/ai-review').send({ startDate: '2026-08-01', endDate: '2026-08-28' });
        const adsQueries = mockState.pool.calls.filter((c) => c.sql.includes('FROM AdsPerformance'));
        expect(adsQueries.length).toBeGreaterThan(0);
        for (const call of adsQueries) {
            const values = Object.values(call.inputs);
            expect(values).toContain('S1');
            expect(values).not.toContain('S9');
        }
    });
});

describe('route wiring', () => {
    const routesSrc = fs.readFileSync(path.join(__dirname, '../../routes/adsRoutes.js'), 'utf8');
    const exportSrc = fs.readFileSync(path.join(__dirname, '../../routes/exportRoutes.js'), 'utf8');
    const uploadSrc = fs.readFileSync(path.join(__dirname, '../../routes/uploadRoutes.js'), 'utf8');
    const serverSrc = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

    test('/api/ads is mounted in server.js', () => {
        expect(serverSrc).toContain("app.use('/api/ads', adsRoutes)");
    });

    test('every data route requires the ads view permission', () => {
        const dataRoutes = routesSrc.match(/router\.(get|post)\('\/[a-z-]+'/g) || [];
        expect(dataRoutes.length).toBeGreaterThanOrEqual(8);
        const protectedLines = routesSrc.split('\n').filter((l) => /router\.(get|post)\('\/[a-z-]+'/.test(l) && !l.includes("'/meta'"));
        for (const line of protectedLines) {
            expect(line).toContain('canViewAds');
        }
    });

    test('the AI review route is rate limited (it is the only paid endpoint)', () => {
        const aiLine = routesSrc.split('\n').find((l) => l.includes("'/ai-review'"));
        expect(aiLine).toContain('aiLimiter');
    });

    test('ads export requires adsreport_export', () => {
        expect(exportSrc).toMatch(/router\.post\('\/start-ads', auth, requirePermission\('adsreport_export'\), startAdsExport\)/);
    });

    test('ads upload requires adsreport_import', () => {
        expect(uploadSrc).toMatch(/router\.post\('\/upload\/upload-ads', authenticate, requirePermission\('adsreport_import'\)/);
    });

    test('the ads manager data routes moved off the legacy /data path', () => {
        const dataRoutesSrc = fs.readFileSync(path.join(__dirname, '../../routes/dataRoutes.js'), 'utf8');
        // The rebuilt module owns /api/ads/*; the old endpoints stay only for
        // backwards compatibility during rollout and are no longer used by the UI.
        expect(dataRoutesSrc).toContain("'/data/ads-manager'");
        expect(routesSrc).toContain("router.get('/overview'");
    });
});
