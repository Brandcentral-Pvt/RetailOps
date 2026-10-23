/**
 * Template configuration: publish validation + atomic save.
 *
 * Locks down three defects found in the audit:
 *   - H-3: the assignment-rule UPDATE bound INT/BIT columns as NVarChar, so
 *     editing a template sent the string 'true' to a BIT column and SQL Server
 *     failed conversion. Bundled typed inputs must carry the right JS type.
 *   - Partial save: the old flow wrote the template and the rules as two
 *     separate requests, and the frontend swallowed the second failure. A
 *     template could be "saved" with no assignment rules.
 *   - Publish gate: an invalid template (no SOP, empty mandatory activity) must
 *     never be publishable, and the backend must reject it directly.
 */
const mockQueries = [];
let existingTemplate = null;
let hasRules = false;

function mockPool() {
  return {
    request() {
      const inp = {};
      const r = {
        input(n, t, v) { inp[n] = v === undefined ? t : v; return r; },
        async query(q) {
          mockQueries.push({ q, inp: { ...inp } });
          if (/COUNT\(\*\) as c FROM PemsTaskTemplates/.test(q)) return { recordset: [{ c: 0 }] };
          if (/SELECT Id, TaskCode FROM PemsTaskTemplates/.test(q)) {
            return { recordset: existingTemplate ? [existingTemplate] : [] };
          }
          if (/SELECT Id FROM PemsAssignmentRules/.test(q)) {
            return { recordset: hasRules ? [{ Id: 'rule-1' }] : [] };
          }
          return { recordset: [], rowsAffected: [1] };
        },
      };
      return r;
    },
  };
}

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => mockPool(),
  generateId: () => 'gen-id',
  withTransaction: async (fn) => fn(mockPool()),
}));
jest.mock('../../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {} }));
jest.mock('../../services/eventBus', () => ({ emit() {}, on() {}, EVENTS: {} }));
jest.mock('../../services/pems/eventStore', () => ({ append: async () => {}, EVENT_TYPES: {} }));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const svc = require('../../services/pems/pemsService');

const validTemplate = {
  name: 'OOS Data Monitoring', taskCode: 'DLY-004', category: 'INVENTORY',
  frequency: 'DAILY', runDays: [1, 2, 3, 4, 5, 6], dueTime: '12:00', priority: 'HIGH',
  subTaskDefinitions: [
    { title: 'Monitor', activities: [{ title: 'Check ASP', instructions: 'Open ASIN Manager', isMandatory: true }] },
  ],
};

beforeEach(() => { mockQueries.length = 0; existingTemplate = null; hasRules = false; });

describe('validateTemplateForPublish', () => {
  it('passes a complete, internally consistent template', () => {
    const v = svc.validateTemplateForPublish(validTemplate, { approvalLevel: 'single', escalationHours: 24 });
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it('blocks publication when there is no SOP', () => {
    const v = svc.validateTemplateForPublish({ ...validTemplate, subTaskDefinitions: [] });
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.field === 'sop')).toBe(true);
  });

  it('blocks a mandatory activity with no instructions', () => {
    const v = svc.validateTemplateForPublish({
      ...validTemplate,
      subTaskDefinitions: [{ title: 'P', activities: [{ title: 'A', instructions: '   ', isMandatory: true }] }],
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => /no instructions/.test(e.message))).toBe(true);
  });

  it('allows an optional empty activity to pass', () => {
    const v = svc.validateTemplateForPublish({
      ...validTemplate,
      subTaskDefinitions: [{ title: 'P', activities: [{ title: 'A', instructions: '', isMandatory: false }] }],
    });
    expect(v.ok).toBe(true);
  });

  it('requires schedule fields on a recurring template', () => {
    const v = svc.validateTemplateForPublish({ ...validTemplate, runDays: [], dueTime: null });
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.field === 'schedule')).toBe(true);
  });

  it('warns (but does not block) on dual/multi approval', () => {
    const v = svc.validateTemplateForPublish(validTemplate, { approvalLevel: 'dual' });
    expect(v.ok).toBe(true);
    expect(v.warnings.some(w => /approval/.test(w.field))).toBe(true);
  });

  it('rejects an out-of-range escalation window', () => {
    const v = svc.validateTemplateForPublish(validTemplate, { escalationHours: 9999 });
    expect(v.ok).toBe(false);
  });
});

describe('saveTemplateConfig', () => {
  it('creates the template and its rules in one transaction', async () => {
    const out = await svc.saveTemplateConfig({
      template: validTemplate,
      assignmentRules: { assignmentMode: 'auto', approvalLevel: 'single', escalationHours: 24, qualityScoreRequired: true },
      createdBy: 'u1',
    });
    expect(out.created).toBe(true);
    expect(out.id).toBe('gen-id');
    expect(mockQueries.some(x => /INSERT INTO PemsTaskTemplates/.test(x.q))).toBe(true);
    expect(mockQueries.some(x => /INSERT INTO PemsAssignmentRules/.test(x.q))).toBe(true);
  });

  it('binds QualityScoreRequired as a Bit and EscalationHours as an Int', async () => {
    hasRules = true; // force the UPDATE path
    await svc.upsertAssignmentRules('tpl-1', { qualityScoreRequired: true, escalationHours: 48 });
    const upd = mockQueries.find(x => /UPDATE PemsAssignmentRules/.test(x.q));
    expect(upd).toBeTruthy();
    // The bound JS values must be coerced numbers, not the boolean true / string
    // 'true' — that is what failed BIT conversion before H-3 was fixed.
    expect(upd.inp.QualityScoreRequired).toBe(1);
    expect(upd.inp.EscalationHours).toBe(48);
    expect(typeof upd.inp.QualityScoreRequired).toBe('number');
    expect(typeof upd.inp.EscalationHours).toBe('number');
  });

  it('refuses to publish an invalid template (throws 400, writes nothing)', async () => {
    await expect(svc.saveTemplateConfig({
      template: { ...validTemplate, subTaskDefinitions: [], isActive: true },
      assignmentRules: {},
    })).rejects.toMatchObject({ status: 400 });
    expect(mockQueries.some(x => /INSERT INTO PemsTaskTemplates/.test(x.q))).toBe(false);
  });

  it('allows saving an invalid template as a draft', async () => {
    const out = await svc.saveTemplateConfig({
      template: { ...validTemplate, subTaskDefinitions: [], isActive: false },
      assignmentRules: {},
    });
    expect(out.created).toBe(true);
  });

  it('404s when updating a template that does not exist', async () => {
    existingTemplate = null;
    await expect(svc.saveTemplateConfig({
      id: 'missing', template: validTemplate, assignmentRules: {},
    })).rejects.toMatchObject({ status: 404 });
  });
});
