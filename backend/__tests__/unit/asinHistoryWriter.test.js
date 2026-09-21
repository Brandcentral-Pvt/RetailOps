/**
 * ASIN history writers (docs/asin-manager-deep-dive.md → F10 / F13).
 *
 * Pins the three writers that give the module a real paper trail:
 *   - a daily `AsinHistory` row (MERGE on AsinId + today),
 *   - a weekly `AsinWeekHistory` aggregate derived from those daily rows, keyed
 *     on the **ISO week start computed in SQL** (not a Node-timezone date),
 *   - one `SubBsrHistory` row per ASIN / day / category, including for ranks that
 *     arrive as the scraped `#1,234 in Electronics` strings.
 */
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

const { makeFakePool } = require('../../testUtils/fakePool');
const asinHistoryService = require('../../services/asinHistoryService');

let mockState = { pool: null };

beforeEach(() => {
    mockState.pool = makeFakePool([]);
});

describe('weekStartSql', () => {
    test('is DATEFIRST-independent and anchored on Monday', () => {
        const sqlText = asinHistoryService.weekStartSql('@date');
        expect(sqlText).toContain("DATEDIFF(day, '19000101', @date)");
        expect(sqlText).toContain('% 7');
        expect(sqlText).toContain('AS DATE');
        // no reliance on the session DATEFIRST / @@DATEFIRST
        expect(sqlText).not.toContain('@@DATEFIRST');
        expect(sqlText).not.toContain('DATEPART(weekday');
    });

    test('isoWeekSql uses DATEPART(iso_week)', () => {
        expect(asinHistoryService.isoWeekSql('WeekStartDate')).toBe('DATEPART(iso_week, WeekStartDate)');
    });
});

describe('parseSubBsrPairs', () => {
    test('parses the scraped "#rank in Category" strings', () => {
        const pairs = asinHistoryService.parseSubBsrPairs([
            '#1,234 in Electronics',
            '#56 in Home & Kitchen',
        ]);
        expect(pairs).toEqual([
            { rank: 1234, category: 'Electronics' },
            { rank: 56, category: 'Home & Kitchen' },
        ]);
    });

    test('accepts object shapes and drops unusable entries', () => {
        const pairs = asinHistoryService.parseSubBsrPairs([
            { rank: 12, category: 'Books' },
            { SubBsrRank: 9, SubBsrCategory: 'Toys' },
            null,
            'no rank here',
            { rank: 0, category: 'Nothing' },
        ]);
        expect(pairs).toEqual([
            { rank: 12, category: 'Books' },
            { rank: 9, category: 'Toys' },
        ]);
    });

    test('tolerates a JSON string or garbage', () => {
        expect(asinHistoryService.parseSubBsrPairs('["#5 in Books"]')).toEqual([{ rank: 5, category: 'Books' }]);
        expect(asinHistoryService.parseSubBsrPairs('not json')).toEqual([]);
        expect(asinHistoryService.parseSubBsrPairs(null)).toEqual([]);
    });
});

describe('recordSnapshot', () => {
    test('writes the daily row, the weekly aggregate and every sub-BSR rank', async () => {
        const written = await asinHistoryService.recordSnapshot(mockState.pool, 'A1', {
            price: 499,
            mrp: 999,
            bsr: 1200,
            subBsr: 34,
            subBsrCategory: 'Electronics',
            subBsrList: ['#1,234 in Electronics', '#56 in Home & Kitchen'],
            rating: 4.2,
            reviewCount: 31,
            source: 'OCTOPARSE',
        });

        const daily = mockState.pool.callsWhere(/MERGE AsinHistory/);
        expect(daily).toHaveLength(1);
        expect(daily[0].inputs).toMatchObject({ asinId: 'A1', price: 499, bsr: 1200, source: 'OCTOPARSE' });

        const week = mockState.pool.callsWhere(/MERGE AsinWeekHistory/);
        expect(week).toHaveLength(1);
        expect(week[0].sql).toContain('DECLARE @weekStart DATE');
        expect(week[0].sql).toContain('Group'.replace('Group', 'FROM AsinHistory'));

        // explicit category + the two scraped pairs = 3 rank rows
        const subBsr = mockState.pool.callsWhere(/MERGE SubBsrHistory/);
        expect(subBsr).toHaveLength(3);
        expect(subBsr.map((c) => c.inputs.category)).toEqual(['Electronics', 'Electronics', 'Home & Kitchen']);
        expect(written).toEqual({ daily: true, week: true, subBsr: 3 });
    });

    test('still records the daily and weekly rows when no rank is available', async () => {
        const written = await asinHistoryService.recordSnapshot(mockState.pool, 'A2', {
            price: 100,
            bsr: 10,
            source: 'LIVE',
        });
        expect(written.subBsr).toBe(0);
        expect(mockState.pool.callsWhere(/MERGE AsinHistory/)).toHaveLength(1);
        expect(mockState.pool.callsWhere(/MERGE AsinWeekHistory/)).toHaveLength(1);
        expect(mockState.pool.callsWhere(/MERGE SubBsrHistory/)).toHaveLength(0);
    });

    test('the weekly aggregate is derived from the daily rows, not sampled', async () => {
        await asinHistoryService.recordSnapshot(mockState.pool, 'A3', { price: 10, bsr: 5, source: 'LIVE' });
        const weekSql = mockState.pool.callWhere(/MERGE AsinWeekHistory/).sql;
        expect(weekSql).toContain('AVG(CAST(Price AS DECIMAL(18, 2)))');
        expect(weekSql).toContain('MAX(ReviewCount)');
        expect(weekSql).toContain('FROM AsinHistory');
        expect(weekSql).toContain('DATEADD(day, 7, @weekStart)');
    });
});
