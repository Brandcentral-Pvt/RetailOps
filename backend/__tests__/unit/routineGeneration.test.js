/** Fan-out generation of daily routines — DB and createInstance are mocked. */
const mockLog = [];              // simulated PemsRecurrenceLog rows
const mockCreated = [];          // createInstance payloads
let mockTemplates = [];
let mockUsers = [];
const mockUpdates = [];

jest.mock('../../database/db', () => {
  const makeReq = () => {
    const params = {};
    const req = {
      input: (k, _t, v) => { params[k] = v; return req; },
      query: async (q) => {
        if (/FROM PemsTaskTemplates WHERE/.test(q) && /AutoAssign/.test(q)) return { recordset: mockTemplates };
        if (/FROM Users/.test(q)) return { recordset: mockUsers };
        if (/COUNT\(\*\) AS c FROM PemsRecurrenceLog/.test(q)) {
          const hit = mockLog.some(l => l.t === params.t && +l.occ === +params.occ && l.a === params.a);
          return { recordset: [{ c: hit ? 1 : 0 }] };
        }
        if (/INSERT INTO PemsRecurrenceLog/.test(q)) { mockLog.push({ t: params.t, occ: params.occ, a: params.a }); return { recordset: [] }; }
        if (/UPDATE PemsTaskTemplates/.test(q)) { mockUpdates.push({ id: params.id, next: params.next }); return { recordset: [] }; }
        return { recordset: [] };
      },
    };
    return req;
  };
  return {
    sql: { VarChar: 'VarChar', DateTime2: 'DateTime2' },
    getPool: async () => ({ request: makeReq }),
    generateId: () => `id-${Math.random().toString(36).slice(2, 8)}`,
  };
});
jest.mock('../../services/pems/pemsService', () => ({
  createInstance: jest.fn(async (d) => { mockCreated.push(d); return { id: `inst-${mockCreated.length}` }; }),
}));
jest.mock('../../services/pems/workflowEngine', () => ({ getNextDueDate: () => new Date() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { generateRoutineOccurrences } = require('../../services/pems/recurrenceService');

const tpl = (o = {}) => ({
  Id: 'T1', TaskCode: 'DLY-001', Name: 'Top ASIN Monitoring', Category: 'ANALYTICS', Department: 'Brand Managers',
  Priority: 'HIGH', SLAHours: 8, DefaultTarget: 0, ReviewerId: null, Frequency: 'DAILY',
  RunDays: '1,2,3,4,5,6', DueTime: '18:00', AssigneeRole: 'brand_manager', AssigneeUserIds: null, ...o,
});

beforeEach(() => {
  mockLog.length = 0; mockCreated.length = 0; mockUpdates.length = 0;
  mockTemplates = [tpl()];
  mockUsers = [{ Id: 'u1', FirstName: 'Asha', LastName: 'K' }, { Id: 'u2', FirstName: 'Ravi', LastName: '' }];
});

const TUE_EARLY = new Date(2026, 8, 29, 0, 10);   // Tue 29 Sep 2026, 00:10

describe('generateRoutineOccurrences', () => {
  it('creates one ASSIGNED instance per assignee, due today, tagged as a routine', async () => {
    const r = await generateRoutineOccurrences(TUE_EARLY);
    expect(r.created).toBe(2);
    expect(mockCreated.map(c => c.assignedTo).sort()).toEqual(['u1', 'u2']);
    const c = mockCreated[0];
    expect(c).toMatchObject({ status: 'ASSIGNED', source: 'ROUTINE', sourceRef: 'DLY-001', priority: 'HIGH', slaHours: 8 });
    expect(c.dueDate).toEqual(new Date(2026, 8, 29, 18, 0));
    expect(c.occurrenceDate).toEqual(new Date(2026, 8, 29, 0, 0));
    expect(mockUpdates[0].next).toEqual(new Date(2026, 8, 30, 0, 0));   // next run gated to tomorrow
  });

  it('is idempotent — a second run the same day creates nothing', async () => {
    await generateRoutineOccurrences(TUE_EARLY);
    const again = await generateRoutineOccurrences(new Date(2026, 8, 29, 9, 0), { templateId: 'T1' });
    expect(again.created).toBe(0);
    expect(again.skipped).toBe(2);
    expect(mockCreated).toHaveLength(2);
  });

  it('skips days the routine does not run on (Sunday)', async () => {
    const r = await generateRoutineOccurrences(new Date(2026, 8, 27, 0, 10));
    expect(r.created).toBe(0);
    expect(mockCreated).toHaveLength(0);
  });

  it('does not back-fill: after the workday ended nothing is created', async () => {
    const r = await generateRoutineOccurrences(new Date(2026, 8, 29, 20, 0));
    expect(r.created).toBe(0);
  });

  it('moves a passed due time to the end of the workday instead of creating an instantly-overdue task', async () => {
    mockTemplates = [tpl({ DueTime: '13:30' })];
    await generateRoutineOccurrences(new Date(2026, 8, 29, 15, 0));
    expect(mockCreated[0].dueDate).toEqual(new Date(2026, 8, 29, 19, 0));
  });

  it('uses explicit AssigneeUserIds when present', async () => {
    mockTemplates = [tpl({ AssigneeUserIds: JSON.stringify(['u2']) })];
    mockUsers = [{ Id: 'u2', FirstName: 'Ravi', LastName: '' }];
    await generateRoutineOccurrences(TUE_EARLY);
    expect(mockCreated.map(c => c.assignedTo)).toEqual(['u2']);
  });

  it('reports templates that have nobody to assign to', async () => {
    mockUsers = [];
    const r = await generateRoutineOccurrences(TUE_EARLY);
    expect(r.created).toBe(0);
    expect(r.noAssignees).toEqual(['DLY-001']);
  });
});
