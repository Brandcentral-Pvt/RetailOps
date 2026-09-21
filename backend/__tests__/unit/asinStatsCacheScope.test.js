/**
 * Scoped stats-cache invalidation (docs/asin-manager-deep-dive.md → F12).
 *
 * Every ASIN write used to call `clearAsinStatsCache()` with no argument, so a
 * single bulk import dropped the cached stats of every user and every scope —
 * the aggregate queries then ran again for each of them (the dashboard's N+1).
 *
 * The cache key is `{seller, marketplace, roleName, userId, assignedSellers}`.
 * A write for seller X may only drop keys that can contain seller X: keys whose
 * `assignedSellers` include X, keys filtered to X, and unscoped keys (no seller
 * named at all — those cover everyone). Everything else is left alone.
 */
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => null,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

jest.mock('../../services/marketDataSyncService', () => ({
    isConfigured: () => false,
    syncSellerAsinsToOctoparse: jest.fn(() => Promise.resolve()),
}));

const { matchesStatsCacheScope } = require('../../controllers/asinController');

const key = (scope) => JSON.stringify(scope);

describe('matchesStatsCacheScope', () => {
    test('a scope listing the written seller is invalidated', () => {
        const scoped = key({ seller: undefined, marketplace: 'amazon.in', assignedSellers: ['S1', 'S2'], userId: 'U1' });
        expect(matchesStatsCacheScope(scoped, 'S1')).toBe(true);
        expect(matchesStatsCacheScope(scoped, 'S2')).toBe(true);
    });

    test('a scope for other sellers is left alone', () => {
        const other = key({ seller: undefined, assignedSellers: ['S7'], userId: 'U2' });
        expect(matchesStatsCacheScope(other, 'S1')).toBe(false);
    });

    test('a scope filtered to the written seller is invalidated', () => {
        const filtered = key({ seller: 'S1', assignedSellers: [], userId: 'U3' });
        expect(matchesStatsCacheScope(filtered, 'S1')).toBe(true);
        expect(matchesStatsCacheScope(filtered, 'S2')).toBe(false);
    });

    test('an unscoped key covers every seller and is dropped', () => {
        const globalKey = key({ seller: undefined, marketplace: undefined, assignedSellers: [], userId: 'U0', roleName: 'admin' });
        expect(matchesStatsCacheScope(globalKey, 'S1')).toBe(true);
    });

    test('an unreadable key is dropped rather than trusted', () => {
        expect(matchesStatsCacheScope('not-json', 'S1')).toBe(true);
    });
});
