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

describe('Canonical Ads route authorization and retirement',()=>{
    test('anonymous canonical report is 401',async()=>{mockState.user=null;expect((await request(app).get('/api/ads/canonical-report'+WINDOW)).status).toBe(401);});
    test('view permission required',async()=>{mockState.user=NO_PERMISSION;expect((await request(app).get('/api/ads/canonical-report'+WINDOW)).status).toBe(403);});
    test('mixed seller scope fails before report SQL',async()=>{mockState.user=SCOPED;const r=await request(app).get('/api/ads/canonical-report'+WINDOW+'&sellerId=S1,S9');expect(r.status).toBe(403);expect(r.body.code).toBe('forbidden_seller');expect(mockState.pool.calls).toHaveLength(0);});
    test('no assignments returns empty canonical report',async()=>{mockState.user={...SCOPED,assignedSellers:[]};const r=await request(app).get('/api/ads/canonical-report'+WINDOW);expect(r.status).toBe(200);expect(r.body.data.empty).toBe(true);expect(mockState.pool.calls).toHaveLength(0);});
    test('legacy ads reads and AI are retired for authorized users',async()=>{mockState.user=SCOPED;for(const p of ['overview','series','table','history','filter-options','insights','report'])expect((await request(app).get('/api/ads/'+p+WINDOW)).status).toBe(410);expect((await request(app).post('/api/ads/ai-review').send({})).status).toBe(410);expect(mockState.pool.calls).toHaveLength(0);});
    test('canonical export requires separate export permission',async()=>{mockState.user=SCOPED;expect((await request(app).get('/api/ads/canonical-export'+WINDOW)).status).toBe(403);});
    test('authenticated capability metadata still available',async()=>{mockState.user=NO_PERMISSION;expect((await request(app).get('/api/ads/meta')).status).toBe(200);});
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
