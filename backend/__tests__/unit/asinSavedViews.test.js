/**
 * Saved views + column preferences (Step 3).
 *
 * A saved view is the whole workspace state — filters, search, sort, columns and
 * which surface the user was on — owned by one user and optionally shared. The
 * rules that matter: a view can only be changed by its owner (or a global role),
 * the payload is validated before it is stored, and a user cannot grow their own
 * view collection without bound.
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
        generateId: () => 'view-1',
        executeWithRetry: async (fn) => fn(),
    };
});

const { makeFakePool } = require('../../testUtils/fakePool');
const views = require('../../controllers/asinViewController');

const USER = { _id: 'U1', role: { name: 'brand_manager' }, assignedSellers: ['S1'] };
const ADMIN = { _id: 'A1', role: { name: 'admin' } };

const makeRes = () => ({
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
});

const VIEW_ROW = {
    Id: 'view-1',
    Name: 'Stale hero SKUs',
    OwnerId: 'U1',
    IsShared: 0,
    UpdatedAt: new Date('2026-09-01T00:00:00Z'),
    ViewJson: JSON.stringify({ view: 'asins', filters: { freshness: 'stale' }, search: 'B0', sortBy: 'lqs', sortOrder: 'asc', columns: ['asinCode', 'title'] }),
};

beforeEach(() => {
    mockState.pool = makeFakePool([
        { match: /FROM AsinSavedViews WITH \(NOLOCK\)/, rows: [VIEW_ROW, { ...VIEW_ROW, Id: 'view-2', OwnerId: 'U2', IsShared: 1 }] },
        { match: /SELECT Id, Name, OwnerId, IsShared, ViewJson FROM AsinSavedViews WHERE Id = @id/, rows: [VIEW_ROW] },
        { match: /SELECT Id, OwnerId FROM AsinSavedViews WHERE Id = @id/, rows: [{ Id: 'view-1', OwnerId: 'U1' }] },
        { match: /SELECT COUNT\(\*\) as total FROM AsinSavedViews/, rows: [{ total: 2 }] },
        { match: /SELECT ColumnsJson FROM AsinColumnPreferences/, rows: [{ ColumnsJson: '["asinCode","title"]' }] },
    ]);
});

describe('sanitizeView', () => {
    test('rejects a view without a name', () => {
        expect(views._internal.sanitizeView({}).ok).toBe(false);
    });

    test('keeps only the known shape and normalises the rest', () => {
        const result = views._internal.sanitizeView({
            name: '  Tracker watchlist  ',
            isShared: true,
            view: 'tracker',
            search: 'acme',
            sortBy: 'bsr',
            sortOrder: 'ASC',
            columns: ['asinCode', 'title', 42],
            filters: { freshness: 'stale', junk: undefined },
            ignored: 'yes',
        });
        expect(result.ok).toBe(true);
        expect(result.value).toEqual({
            name: 'Tracker watchlist',
            isShared: true,
            view: { view: 'tracker', filters: { freshness: 'stale' }, search: 'acme', sortBy: 'bsr', sortOrder: 'asc', columns: ['asinCode', 'title'] },
        });
    });

    test('an unknown surface falls back to the ASIN table', () => {
        const result = views._internal.sanitizeView({ name: 'x', view: 'something-else' });
        expect(result.value.view.view).toBe('asins');
    });

    test('an oversized column list is capped, not rejected', () => {
        const columns = Array.from({ length: 500 }, (_, i) => `col${i}`);
        const result = views._internal.sanitizeView({ name: 'big', columns });
        expect(result.value.view.columns).toHaveLength(200);
    });
});

describe('listViews', () => {
    test('returns own + shared views and marks ownership', async () => {
        const res = makeRes();
        await views.listViews({ user: USER, params: {}, query: {} }, res);

        expect(res.body.views).toHaveLength(2);
        expect(res.body.views[0]).toMatchObject({ id: 'view-1', isOwner: true, isShared: false });
        expect(res.body.views[1]).toMatchObject({ id: 'view-2', isOwner: false, isShared: true });
        expect(res.body.views[1].view.filters).toEqual({ freshness: 'stale' });

        const query = mockState.pool.callWhere(/FROM AsinSavedViews WITH \(NOLOCK\)/);
        expect(query.sql).toContain('OwnerId = @userId OR IsShared = 1');
        expect(query.inputs.userId).toBe('U1');
    });

    test('an unreadable ViewJson does not break the list', async () => {
        mockState.pool = makeFakePool([
            { match: /FROM AsinSavedViews WITH \(NOLOCK\)/, rows: [{ ...VIEW_ROW, ViewJson: '{not-json' }] },
        ]);
        const res = makeRes();
        await views.listViews({ user: USER, params: {}, query: {} }, res);
        expect(res.body.views[0].view).toMatchObject({ view: 'asins', filters: {} });
    });
});

describe('createView', () => {
    test('validates, then writes the view with its payload', async () => {
        const res = makeRes();
        await views.createView(
            { user: USER, params: {}, query: {}, body: { name: 'My view', filters: { status: 'Active' }, columns: ['asinCode'], sortBy: 'lqs', sortOrder: 'asc' } },
            res
        );

        expect(res.statusCode).toBe(201);
        expect(res.body.view).toMatchObject({ id: 'view-1', name: 'My view', isOwner: true });
        const insert = mockState.pool.callWhere(/INSERT INTO AsinSavedViews/);
        expect(insert).toBeTruthy();
        expect(JSON.parse(insert.inputs.viewJson)).toMatchObject({
            view: 'asins',
            filters: { status: 'Active' },
            sortBy: 'lqs',
            sortOrder: 'asc',
            columns: ['asinCode'],
        });
    });

    test('rejects a nameless view with 400 and writes nothing', async () => {
        const res = makeRes();
        await views.createView({ user: USER, params: {}, query: {}, body: { filters: { status: 'Active' } } }, res);
        expect(res.statusCode).toBe(400);
        expect(mockState.pool.callsWhere(/INSERT INTO AsinSavedViews/)).toHaveLength(0);
    });

    test('refuses to grow past the per-user cap', async () => {
        mockState.pool = makeFakePool([
            { match: /SELECT COUNT\(\*\) as total FROM AsinSavedViews/, rows: [{ total: views._internal.MAX_VIEWS_PER_USER }] },
        ]);
        const res = makeRes();
        await views.createView({ user: USER, params: {}, query: {}, body: { name: 'one too many' } }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('too_many_views');
    });
});

describe('updateView / deleteView', () => {
    test('the owner can rename without resending the whole state', async () => {
        const res = makeRes();
        await views.updateView({ user: USER, params: { id: 'view-1' }, query: {}, body: { name: 'Renamed' } }, res);

        expect(res.body.view.name).toBe('Renamed');
        // untouched parts of the state survive the rename
        expect(res.body.view.view.filters).toEqual({ freshness: 'stale' });
        expect(res.body.view.view.columns).toEqual(['asinCode', 'title']);
    });

    test('a non-owner cannot edit a view, even a shared one', async () => {
        const res = makeRes();
        await views.updateView(
            { user: { _id: 'U9', role: { name: 'brand_manager' } }, params: { id: 'view-1' }, query: {}, body: { name: 'Hijack' } },
            res
        );
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('not_view_owner');
        expect(mockState.pool.callsWhere(/UPDATE AsinSavedViews/)).toHaveLength(0);
    });

    test('a global role may edit any view', async () => {
        const res = makeRes();
        await views.updateView({ user: ADMIN, params: { id: 'view-1' }, query: {}, body: { isShared: true } }, res);
        expect(res.body.view.isShared).toBe(true);
    });

    test('deleting a missing view is a 404, not a silent success', async () => {
        mockState.pool = makeFakePool([
            { match: /SELECT Id, OwnerId FROM AsinSavedViews WHERE Id = @id/, rows: [] },
        ]);
        const res = makeRes();
        await views.deleteView({ user: USER, params: { id: 'nope' }, query: {} }, res);
        expect(res.statusCode).toBe(404);
    });

    test('the owner can delete their view', async () => {
        const res = makeRes();
        await views.deleteView({ user: USER, params: { id: 'view-1' }, query: {} }, res);
        expect(res.body).toEqual({ success: true, deletedId: 'view-1' });
        expect(mockState.pool.callsWhere(/DELETE FROM AsinSavedViews/)).toHaveLength(1);
    });
});

describe('column preferences', () => {
    test('returns the stored columns for the caller', async () => {
        const res = makeRes();
        await views.getColumnPreferences({ user: USER, params: {}, query: {} }, res);
        expect(res.body.columns).toEqual(['asinCode', 'title']);
        expect(mockState.pool.callWhere(/SELECT ColumnsJson/).inputs.userId).toBe('U1');
    });

    test('a user with no stored preference gets null (client falls back)', async () => {
        mockState.pool = makeFakePool([{ match: /SELECT ColumnsJson/, rows: [] }]);
        const res = makeRes();
        await views.getColumnPreferences({ user: USER, params: {}, query: {} }, res);
        expect(res.body.columns).toBeNull();
    });

    test('saving merges on UserId so a user has exactly one row', async () => {
        const res = makeRes();
        await views.saveColumnPreferences({ user: USER, params: {}, query: {}, body: { columns: ['asinCode', 'bsr'] } }, res);

        expect(res.body.columns).toEqual(['asinCode', 'bsr']);
        const merge = mockState.pool.callWhere(/MERGE AsinColumnPreferences/);
        expect(merge.sql).toContain('ON target.UserId = source.UserId');
        expect(JSON.parse(merge.inputs.columnsJson)).toEqual(['asinCode', 'bsr']);
    });

    test('an empty column list is rejected', async () => {
        const res = makeRes();
        await views.saveColumnPreferences({ user: USER, params: {}, query: {}, body: { columns: [] } }, res);
        expect(res.statusCode).toBe(400);
        expect(mockState.pool.callsWhere(/MERGE AsinColumnPreferences/)).toHaveLength(0);
    });
});
