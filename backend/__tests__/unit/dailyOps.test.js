const S = require('../../services/pems/routineSchedule');
const { parseDailyOpsSheet, splitSteps, parseOwner, mapFrequency, parseHours, TASK_DEFAULTS } = require('../../services/pems/dailyOpsImporter');
const { loadDailyOpsDefaults, DEFAULT_FILE } = require('../../services/pems/dailyOpsDefaults');

const HEAD = ['Seq', 'Task ID', 'Priority', 'Main Task', 'Sub-Task No', 'Sub Task', 'How to Perform', 'Function', 'Team', 'Owner', 'Expected Output'];
const row = (o) => HEAD.map(h => o[h] || '');

describe('routineSchedule', () => {
  const mon = new Date(2026, 8, 28);  // Mon 28 Sep 2026
  const thu = new Date(2026, 8, 24);
  const sun = new Date(2026, 8, 27);

  it('defaults run days to Mon–Sat and honours explicit lists', () => {
    expect(S.parseRunDays(null)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(S.parseRunDays('1,3,5')).toEqual([1, 3, 5]);
    expect(S.parseRunDays('nonsense')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(S.runsOn('1,2,3,4,5,6', sun)).toBe(false);
    expect(S.runsOn(null, mon)).toBe(true);
  });
  it('filters sub-tasks by weekday and day of month', () => {
    const defs = [{ title: 'daily' }, { title: 'monday', schedule: { weekdays: [1] } }, { title: 'early', schedule: { dayOfMonthTo: 10 } }];
    expect(S.filterSubTasksForDate(defs, mon).map(d => d.title)).toEqual(['daily', 'monday']);
    expect(S.filterSubTasksForDate(defs, thu).map(d => d.title)).toEqual(['daily']);
    expect(S.filterSubTasksForDate(defs, new Date(2026, 8, 2)).map(d => d.title)).toEqual(['daily', 'early']);
  });
  it('computes due time, with a fair fallback when generated after it', () => {
    const d = new Date(2026, 8, 30);
    const at = (h, m = 0) => new Date(2026, 8, 30, h, m);
    expect(S.dueAtFor(d, '13:30', at(0, 5))).toEqual(at(13, 30));
    expect(S.dueAtFor(d, '13:30', at(15))).toEqual(at(19));   // past due → end of workday
    expect(S.dueAtFor(d, '13:30', at(20))).toBeNull();        // too late for today
    expect(S.dueAtFor(d, 'bad', at(1))).toEqual(at(18));      // invalid → default 18:00
  });
  it('infers schedules from sub-task titles', () => {
    expect(S.inferSchedule('Top ASIN check')).toBeNull();
    expect(S.inferSchedule('Weekly PO monitoring')).toEqual({ weekdays: [1] });
    expect(S.inferSchedule('Sales report (twice a week)')).toEqual({ weekdays: [1, 4] });
    expect(S.inferSchedule('Thursday: confirm POs')).toEqual({ weekdays: [4] });
    expect(S.inferSchedule('ASP check – first 10 days of month')).toEqual({ dayOfMonthTo: 10 });
    expect(S.describeSchedule({ weekdays: [1, 4] })).toBe('Mon & Thu');
  });
});

describe('splitSteps — tick outcomes, not clicks', () => {
  it('keeps a numbered click-path as ONE activity with the full how-to', () => {
    const txt = '1. Go to Help\n2. Click Contact Us\n3. Submit';
    const a = splitSteps(txt, 'Raise a ticket');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ title: 'Raise a ticket', instructions: txt });
  });
  it('splits parent-labelled groups (Task N / Step N) and keeps children as instructions', () => {
    const a = splitSteps('• Task 1: Receive POs\n1. Open inbox\n2. Verify\n• Task 2: Confirm POs\n1. Review', 'PO upload');
    expect(a.map(x => x.title)).toEqual(['Task 1: Receive POs', 'Task 2: Confirm POs']);
    expect(a[0].instructions).toBe('1. Open inbox\n2. Verify');
  });
  it('splits headed sections into one activity each', () => {
    const a = splitSteps('Order Management\n• Share reminders\n• Follow up\nInventory\n• Share report', 'WhatsApp');
    expect(a.map(x => x.title)).toEqual(['Order Management', 'Inventory']);
    expect(a[0].instructions).toBe('• Share reminders\n• Follow up');
  });
  it('uses the heading before a generic lead-in like "Discuss:"', () => {
    const a = splitSteps('Common Calls\nASIN Suppression\nDiscuss:\n• Packing\n• Quality\nBuy Box Issues\nDiscuss:\n• Price', 'Phone');
    expect(a.map(x => x.title)).toEqual(['ASIN Suppression', 'Buy Box Issues']);
  });
  it('does not treat the line after "Navigate to:" as a heading', () => {
    const a = splitSteps('Access\n1. Log in\n2. Navigate to:\nDashboard → Overall Data\n3. Export\nShare\n1. Screenshot', 'Report');
    expect(a.map(x => x.title)).toEqual(['Access', 'Share']);
    expect(a[0].instructions).toContain('Dashboard → Overall Data');
  });
  it('never splits alternatives (Method / Option / backup)', () => {
    const txt = '• Task 1: a\n• Task 2: b\nMethod 1: x';
    expect(splitSteps(txt, 't')).toHaveLength(1);
  });
  it('keeps unstructured text as one activity', () => {
    expect(splitSteps('Just check.', 'Quick')).toEqual([expect.objectContaining({ title: 'Quick', instructions: 'Just check.' })]);
  });
});

describe('parseOwner', () => {
  it('maps BM to the brand_manager role and TL-names to people', () => {
    expect(parseOwner('BM')).toMatchObject({ kind: 'role', role: 'brand_manager' });
    expect(parseOwner('TL-SWAGAT')).toMatchObject({ kind: 'people', names: ['SWAGAT'] });
    expect(parseOwner('TL-Chintan, Jay, Anjali').names).toEqual(['Chintan', 'Jay', 'Anjali']);
  });
});

describe('parseDailyOpsSheet', () => {
  const sheet = [
    ['Daily Operations Master'], [],                          // title rows before the header
    HEAD,
    row({ 'Task ID': 'DLY-001', Priority: 'P1', 'Main Task': 'Top ASIN Monitoring', 'Sub-Task No': '1.1', 'Sub Task': 'Inventory check', 'How to Perform': 'Sales\n• Open dashboard\n• Filter OOS\nStock\n• Check stock', Owner: 'BM' }),
    row({ 'Sub-Task No': '1.2', 'Sub Task': 'Weekly sales report', 'How to Perform': 'Method 1: A\nMethod 2: B' }),   // continuation row
    row({ 'Sub Task': 'Output', 'How to Perform': 'Dashboard updated' }),
    row({ 'Task ID': 'DLY-009', Priority: 'P1', 'Main Task': 'Priority Based Tasks', 'Sub Task': 'Do what management asks', 'How to Perform': 'Follow instructions', Owner: 'BM' }),
    row({ 'Task ID': 'DLY-0012', Priority: 'P2', 'Main Task': 'Daily Business Report', 'Sub Task': 'Ads report', 'How to Perform': 'Send report', Owner: 'TL-SWAGAT' }),
    row({ 'Sub Task': 'GMS report', 'How to Perform': 'Send GMS', Owner: 'TL-Chintan, Jay' }),
    row({ 'Task ID': 'DLY-0099', Priority: 'P9', 'Main Task': 'Odd one', 'Sub Task': 'x', 'How to Perform': 'y' }),
  ];
  const { templates, warnings } = parseDailyOpsSheet(sheet);
  const by = (c) => templates.find(t => t.code === c);

  it('finds the header after title rows and groups by Task ID', () => {
    expect(templates.map(t => t.code)).toEqual(['DLY-001', 'DLY-009', 'DLY-0012-1', 'DLY-0012-2', 'DLY-0099']);
  });
  it('maps priorities without ever using CRITICAL', () => {
    expect(by('DLY-001').priority).toBe('HIGH');
    expect(by('DLY-0012-1').priority).toBe('MEDIUM');
    expect(templates.some(t => t.priority === 'CRITICAL')).toBe(false);
    expect(by('DLY-0099').priority).toBe('MEDIUM');
    expect(warnings.some(w => /DLY-0099.*priority/.test(w))).toBe(true);
  });
  it('builds sub-tasks, activities, output and inferred schedule', () => {
    const t = by('DLY-001');
    expect(t.subTaskCount).toBe(2);
    expect(t.brandMode).toBe('CHECKLIST');
    expect(t.subTaskDefinitions[0].activities.map(a => a.title)).toEqual(['Sales', 'Stock']);
    expect(t.subTaskDefinitions[1].schedule).toEqual({ weekdays: [1] });
    expect(t.subTaskDefinitions[1].activities).toHaveLength(1);       // alternatives stay one step
    expect(t.expectedOutput).toBe('Dashboard updated');
  });
  it('treats need-driven tasks as on-demand and splits multi-owner IDs', () => {
    expect(by('DLY-009')).toMatchObject({ autoAssign: false, frequency: 'ONE_TIME' });
    expect(by('DLY-001')).toMatchObject({ autoAssign: true, frequency: 'DAILY', slaHours: 8 });
    expect(by('DLY-0012-1').owner.names).toEqual(['SWAGAT']);
    expect(by('DLY-0012-2').owner.names).toEqual(['Chintan', 'Jay']);
  });
  it('fails clearly when the header is missing', () => {
    expect(() => parseDailyOpsSheet([['a', 'b'], ['1', '2']])).toThrow(/header row/);
  });
});

describe('defaults are data, not code', () => {
  const WIDE = [...HEAD, 'Frequency', 'TAT', 'SLA'];
  const wideRow = (o) => WIDE.map(h => o[h] || '');

  it('loads the shipped defaults file and keeps shared settings separate from per-task ones', () => {
    const { base, byCode } = loadDailyOpsDefaults(DEFAULT_FILE);
    expect(base).toMatchObject({ slaHours: 8, runDays: '1,2,3,4,5,6' });
    expect(byCode['DLY-001']).toMatchObject({ minutes: 12, brand: true, dueTime: '18:00' });
    expect(byCode['DLY-009'].onDemand).toBe(true);
    expect(Object.keys(byCode)).not.toContain('_note');
    expect(TASK_DEFAULTS['DLY-001']).toMatchObject({ minutes: 12, brand: true, slaHours: 8 });   // flat view the importer exposes
  });

  it('lets a caller-supplied defaults file win over the shipped one', () => {
    const rows = [WIDE, wideRow({ 'Task ID': 'DLY-042', Priority: 'P2', 'Main Task': 'Anything', 'Sub Task': 'Do it', 'How to Perform': 'Go' })];
    const t = parseDailyOpsSheet(rows, { defaults: { byCode: { 'DLY-042': { minutes: 99, brand: true, dueTime: '09:15', onDemand: true } } } }).templates[0];
    expect(t).toMatchObject({ code: 'DLY-042', estimatedExecutionMinutes: 99, brandMode: 'CHECKLIST', dueTime: '09:15', autoAssign: false, frequency: 'ONE_TIME' });
  });

  it('reads Frequency, TAT and SLA from the sheet itself, carried down the block', () => {
    const rows = [
      WIDE,
      wideRow({ 'Task ID': 'DLY-050', Priority: 'P1', 'Main Task': 'Reports', 'Sub Task': 'First', 'How to Perform': 'a', Frequency: 'Weekly', TAT: '4 hrs', SLA: '2 days' }),
      wideRow({ 'Sub Task': 'Second', 'How to Perform': 'b' }),
    ];
    const { templates, warnings } = parseDailyOpsSheet(rows);
    const t = templates[0];
    expect(t).toMatchObject({ code: 'DLY-050', frequency: 'WEEKLY', tatHours: 4 });
    expect(t.slaHours).toBe(8);                                    // "2 days" is not hours → not guessed
    expect(warnings.some(w => /SLA "2 days" is not a number of hours/.test(w))).toBe(true);
  });

  it('never guesses a frequency, and never turns need-driven text into a daily task', () => {
    expect(mapFrequency('Every day')).toBe('DAILY');
    expect(mapFrequency('Twice a week')).toBe('BI_WEEKLY');
    expect(mapFrequency('Monthly')).toBe('MONTHLY');
    expect(mapFrequency('on demand')).toBe('ONE_TIME');
    expect(mapFrequency('whenever needed')).toBe('ONE_TIME');
    expect(mapFrequency('sometime soon')).toBeNull();
    expect(mapFrequency('')).toBeNull();
    expect(parseHours('8')).toBe(8);
    expect(parseHours('12 hours')).toBe(12);
    expect(parseHours('1 day')).toBeNull();
    expect(parseHours('TBD')).toBeNull();
  });
});
