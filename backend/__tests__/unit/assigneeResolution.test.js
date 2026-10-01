/**
 * Assignee attribution for seller-scoped work.
 *
 * Two defects are locked down here:
 *
 *  1. Ruleset-generated tasks rendered as "Unknown" in the task list. The engine
 *     resolved an id with `SELECT TOP 1 UserId FROM UserSellers WHERE SellerId=@s`
 *     — arbitrary row, no ORDER BY — and passed `assigneeName: ''` to
 *     createInstance, so the denormalised `PemsTaskInstances.AssigneeName`
 *     column was written blank.
 *
 *  2. That same lookup could hand work to any user bound to the seller,
 *     including someone whose role has nothing to do with running brand tasks,
 *     and could pick a different person on every re-run.
 */
const { makeFakePool, FAKE_SQL } = require('../../testUtils/fakePool');

let mockState = { pool: null };
jest.mock('../../database/db', () => {
    const { FAKE_SQL: FS } = require('../../testUtils/fakePool');
    return {
        sql: FS,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id',
        withTransaction: async (fn) => fn(mockState.pool),
    };
});

const pemsService = require('../../services/pems/pemsService');

const bm = (id, first, last, role = 'brand_manager') => ({
    Id: id, FirstName: first, LastName: last, Email: `${first}@x.com`, RoleName: role,
});

/** Records every issued query so ordering/preference can be asserted. */
function recordingPool(routes) {
    const p = makeFakePool(routes);
    const calls = [];
    const origRequest = p.request;
    p.request = (...a) => {
        const r = origRequest(...a);
        const origQuery = r.query.bind(r);
        r.query = (t) => { calls.push({ sql: t, inputs: { ...r._inputs } }); return origQuery(t); };
        return r;
    };
    p.calls = calls;
    return p;
}

const COVERS_ROUTE = {
    match: /JOIN Roles r ON r\.Id = u\.RoleId[\s\S]*EXISTS \(SELECT 1 FROM UserSellers/i,
    rows: [{ ok: 1 }],
};

beforeEach(() => { mockState.pool = makeFakePool([]); });

describe('resolveAssigneeForSeller — deterministic, seller-associated owner', () => {
    test('returns the name alongside the id', async () => {
        mockState.pool = recordingPool([{ match: /FROM UserSellers us/i, rows: [bm('u1', 'Nadim', 'Shaikh')] }]);
        const owner = await pemsService.resolveAssigneeForSeller('S1');
        expect(owner).toEqual({ id: 'u1', name: 'Nadim Shaikh' });
    });

    test('prefers a brand manager over an operational manager', async () => {
        // Rows arrive already ordered by the SQL, so assert the ranking is in the
        // query — a wrong ORDER BY is how a reviewer used to win the assignment.
        mockState.pool = recordingPool([{ match: /FROM UserSellers us/i, rows: [bm('u1', 'Nadim', 'Shaikh')] }]);
        await pemsService.resolveAssigneeForSeller('S1');
        const q = mockState.pool.calls.find(c => /FROM UserSellers us/i.test(c.sql));
        expect(q.sql).toMatch(/ORDER BY CASE r\.Name/);
        expect(q.sql).toMatch(/WHEN 'brand_manager' THEN 0/);
        expect(q.sql).toMatch(/u\.FirstName, u\.LastName/); // stable tiebreak
    });

    test('only considers active users and active roles', async () => {
        mockState.pool = recordingPool([{ match: /FROM UserSellers us/i, rows: [bm('u1', 'A', 'B')] }]);
        await pemsService.resolveAssigneeForSeller('S1');
        const q = mockState.pool.calls.find(c => /FROM UserSellers us/i.test(c.sql));
        expect(q.sql).toMatch(/u\.IsActive = 1/);
        expect(q.sql).toMatch(/r\.IsActive = 1/);
    });

    test('honours the ruleset author when they cover the seller', async () => {
        mockState.pool = recordingPool([
            COVERS_ROUTE,
            { match: /SELECT Id, FirstName, LastName, Email FROM Users WHERE Id = @raPref/i, rows: [{ Id: 'author', FirstName: 'Richa', LastName: 'Patel', Email: 'r@x.com' }] },
            { match: /FROM UserSellers us/i, rows: [bm('someone-else', 'Other', 'Person')] },
        ]);
        const owner = await pemsService.resolveAssigneeForSeller('S1', 'author');
        expect(owner).toEqual({ id: 'author', name: 'Richa Patel' });
    });

    test('ignores a preferred user who does not cover the seller', async () => {
        mockState.pool = recordingPool([
            { match: /JOIN Roles r ON r\.Id = u\.RoleId[\s\S]*EXISTS \(SELECT 1 FROM UserSellers/i, rows: [] },
            { match: /FROM UserSellers us/i, rows: [bm('right-person', 'Right', 'Owner')] },
        ]);
        const owner = await pemsService.resolveAssigneeForSeller('S1', 'stranger');
        expect(owner).toEqual({ id: 'right-person', name: 'Right Owner' });
    });

    test('returns null when nobody covers the seller (stays unassigned)', async () => {
        mockState.pool = recordingPool([{ match: /FROM UserSellers us/i, rows: [] }]);
        expect(await pemsService.resolveAssigneeForSeller('S1')).toBeNull();
    });

    test('returns null with no seller, rather than guessing', async () => {
        expect(await pemsService.resolveAssigneeForSeller(null, 'author')).toBeNull();
    });

    test('re-running for the same seller picks the same person', async () => {
        mockState.pool = recordingPool([{ match: /FROM UserSellers us/i, rows: [bm('u1', 'Nadim', 'Shaikh')] }]);
        const [a, b] = await Promise.all([
            pemsService.resolveAssigneeForSeller('S1'),
            pemsService.resolveAssigneeForSeller('S1'),
        ]);
        expect(a).toEqual(b);
    });

    test('falls back to the email when the person has no name', async () => {
        mockState.pool = recordingPool([{ match: /FROM UserSellers us/i, rows: [{ Id: 'u1', FirstName: '', LastName: '', Email: 'ops@x.com' }] }]);
        expect(await pemsService.resolveAssigneeForSeller('S1')).toEqual({ id: 'u1', name: 'ops@x.com' });
    });
});

describe('userCoversSeller', () => {
    test('true when the user is bound to the seller', async () => {
        mockState.pool = makeFakePool([COVERS_ROUTE]);
        expect(await pemsService.userCoversSeller('u1', 'S1')).toBe(true);
    });

    test('false when they are not', async () => {
        mockState.pool = makeFakePool([{ match: /JOIN Roles r ON r\.Id = u\.RoleId[\s\S]*EXISTS/i, rows: [] }]);
        expect(await pemsService.userCoversSeller('u1', 'S1')).toBe(false);
    });

    test('no seller or no user is not a coverage failure', async () => {
        expect(await pemsService.userCoversSeller('u1', null)).toBe(true);
        expect(await pemsService.userCoversSeller(null, 'S1')).toBe(true);
    });
});
