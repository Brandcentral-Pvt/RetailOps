const S = require('../../services/pems/routineSchedule');
const { parseDailyOpsSheet, splitSteps, parseOwner } = require('../../services/pems/dailyOpsImporter');

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

describe('splitSteps', () => {
  it('splits an ordered SOP into activities', () => {
    const a = splitSteps('1. Open the dashboard\n2. Filter OOS ASINs\n   keep only live ones\n3. Share list with seller', 'OOS check');
    expect(a.map(x => x.title)).toEqual(['Open the dashboard', 'Filter OOS ASINs', 'Share list with seller']);
    expect(a[1].instructions).toBe('keep only live ones');
  });
  it('never splits alternative methods into separate mandatory steps', () => {
    const txt = '1. Method 1: Brand Central\n2. Method 2: Retail Ops\n3. Method 3 (backup): Vendor Central';
    const a = splitSteps(txt, 'Inventory check');
    expect(a).toHaveLength(1);
    expect(a[0].instructions).toBe(txt);
  });
  it('keeps unstructured text as one activity with the full instructions', () => {
    const a = splitSteps('Just check the page and note issues.', 'Quick check');
    expect(a).toEqual([expect.objectContaining({ title: 'Quick check', instructions: 'Just check the page and note issues.' })]);
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
    row({ 'Task ID': 'DLY-001', Priority: 'P1', 'Main Task': 'Top ASIN Monitoring', 'Sub-Task No': '1.1', 'Sub Task': 'Inventory check', 'How to Perform': '1. Open dashboard\n2. Filter OOS', Owner: 'BM' }),
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
    expect(t.subTaskDefinitions[0].activities.map(a => a.title)).toEqual(['Open dashboard', 'Filter OOS']);
    expect(t.subTaskDefinitions[1].schedule).toEqual({ weekdays: [1] });
    expect(t.subTaskDefinitions[1].activities).toHaveLength(1);       // alternatives stay one step
    expect(t.expectedOutput).toBe('Dashboard updated');
  });
  it('treats need-driven tasks as on-demand and splits multi-owner IDs', () => {
    expect(by('DLY-009')).toMatchObject({ autoAssign: false, frequency: 'ONE_TIME' });
    expect(by('DLY-001')).toMatchObject({ autoAssign: true, frequency: 'DAILY', slaHours: 8 });
    expect(by('DLY-0012-1').owner.names).toEqual(['TL-SWAGAT'.replace('TL-', '')]);
    expect(by('DLY-0012-2').owner.names).toEqual(['Chintan', 'Jay']);
  });
  it('fails clearly when the header is missing', () => {
    expect(() => parseDailyOpsSheet([['a', 'b'], ['1', '2']])).toThrow(/header row/);
  });
});
