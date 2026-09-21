/**
 * Raw-payload contract (docs/asin-manager-deep-dive.md → F15).
 *
 * Scraped payloads reach `AsinDataParser` from several sources (Octoparse dumps,
 * the raw-upload endpoint, the FULL_SCRAPE path). Before this contract the only
 * check was "can an ASIN be extracted from Original_URL" — thrown from the middle
 * of the transform, after the pool was open, with no indication of which fields
 * were empty. Now every payload is validated up front and a rejected row carries
 * the reason back to the caller instead of failing a whole batch silently.
 */
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

let mockState = { pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

jest.mock('../../services/socketService', () => ({ getIo: () => null }));

const { makeFakePool } = require('../../testUtils/fakePool');
const AsinDataParser = require('../../services/asinDataParser');

const FULL_PAYLOAD = {
    Original_URL: 'https://www.amazon.in/dp/B0TEST0001',
    Title: 'Test product',
    Price: '₹499',
    BSR: '#1,200 in Electronics',
    Rating: '4.2 out of 5 stars',
    Image_count: '<img src="https://img/a.jpg">',
    Category: 'Electronics',
};

beforeEach(() => {
    mockState = { pool: makeFakePool([]) };
});

describe('validateRawPayload', () => {
    test('a complete payload is valid with no warnings', () => {
        const report = AsinDataParser.validateRawPayload(FULL_PAYLOAD);
        expect(report).toMatchObject({ valid: true, asinCode: 'B0TEST0001', missing: [], warnings: [] });
    });

    test('a payload without a URL cannot be stored', () => {
        const report = AsinDataParser.validateRawPayload({ Title: 'No url' });
        expect(report.valid).toBe(false);
        expect(report.missing).toEqual(['Original_URL']);
    });

    test('a URL without an ASIN is rejected with the specific reason', () => {
        const report = AsinDataParser.validateRawPayload({ Original_URL: 'https://www.amazon.in/stores/page/1' });
        expect(report.valid).toBe(false);
        expect(report.missing).toEqual(['ASIN in URL']);
    });

    test('unparseable input is reported, not thrown', () => {
        const report = AsinDataParser.validateRawPayload(42);
        expect(report.valid).toBe(false);
        expect(report.error).toBeTruthy();
    });

    test('missing soft fields are warnings, and the row is still importable', () => {
        const report = AsinDataParser.validateRawPayload({ Original_URL: FULL_PAYLOAD.Original_URL });
        expect(report.valid).toBe(true);
        expect(report.warnings).toEqual(['Title', 'Price', 'BSR', 'Rating', 'Image_count', 'Category']);
    });
});

describe('upsertAsinFromRaw contract enforcement', () => {
    test('an invalid payload throws INVALID_RAW_PAYLOAD before touching the database', async () => {
        await expect(AsinDataParser.upsertAsinFromRaw({ Title: 'no url' }, 'S1'))
            .rejects.toMatchObject({ code: 'INVALID_RAW_PAYLOAD' });
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('a batch reports which rows failed and why, and keeps the rest', async () => {
        mockState.pool = makeFakePool([
            {
                match: /MERGE INTO Asins/,
                rows: [{ Id: 'A1', AsinCode: 'B0TEST0001', SellerId: 'S1' }],
            },
        ]);

        const results = await AsinDataParser.bulkUpsertAsins(
            [FULL_PAYLOAD, { Title: 'broken row' }],
            'S1'
        );

        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({ success: true, asinCode: 'B0TEST0001' });
        expect(results[1]).toMatchObject({
            success: false,
            code: 'INVALID_RAW_PAYLOAD',
            missing: ['Original_URL'],
        });
    });
});
