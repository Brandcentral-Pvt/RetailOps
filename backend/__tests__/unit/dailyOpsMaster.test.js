/**
 * The REAL Daily Operations Master (fixture) through the same path the UI uses:
 * SheetJS reads the CSV as UTF-8 text → importer.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parseDailyOpsSheet } = require('../../services/pems/dailyOpsImporter');

const text = fs.readFileSync(path.join(__dirname, '../fixtures/dailyOpsMaster.csv'), 'utf8');
const rows = XLSX.utils.sheet_to_json(XLSX.read(text, { type: 'string' }).Sheets.Sheet1, { header: 1, defval: '', raw: false, blankrows: false });
const { templates, warnings } = parseDailyOpsSheet(rows);
const by = (c) => templates.find(t => t.code === c);
const sub = (c, title) => by(c).subTaskDefinitions.find(d => d.title.startsWith(title));

describe('Daily Operations Master (real sheet)', () => {
  it('finds all 14 routines, splitting DLY-0012 into its two owner groups', () => {
    expect(templates.map(t => t.code).sort()).toEqual(
      ['DLY-001', 'DLY-002', 'DLY-003', 'DLY-004', 'DLY-005', 'DLY-006', 'DLY-007', 'DLY-008', 'DLY-009',
        'DLY-0010A', 'DLY-0010B', 'DLY-0011', 'DLY-0012-1', 'DLY-0012-2'].sort());
  });

  it('reads the long "How to Perform - Execute (SOP Steps)" column and UTF-8 punctuation', () => {
    const ins = sub('DLY-001', 'Inventory Monitoring').activities[0].instructions;
    expect(ins).toContain('seller.brandcentral.in');
    expect(ins).toContain('→');
    expect(ins).not.toMatch(/â/);          // no Windows-1252 mojibake
    expect(sub('DLY-003', 'Dispute').activities[0].instructions).toContain('±₹5');
  });

  it('takes the TL owners from inside the Main Task cell', () => {
    expect(by('DLY-0012-1').owner).toMatchObject({ kind: 'people', names: ['SWAGAT'] });
    expect(by('DLY-0012-2').owner).toMatchObject({ kind: 'people', names: ['Chintan', 'Jay', 'Anjali'] });
    expect(by('DLY-0012-1').name).toBe('Daily Business Report (1)');
    expect(by('DLY-001').owner).toMatchObject({ kind: 'role', role: 'brand_manager' });
  });

  it('merges Method 1/2/3 into one step and never makes the backup method mandatory', () => {
    const d = by('DLY-001').subTaskDefinitions[0];
    expect(d.title).toBe('Inventory Monitoring');
    expect(d.activities).toHaveLength(1);
    const ins = d.activities[0].instructions;
    expect(ins).toContain('Method 1: Brand Central'); expect(ins).toContain('Method 2: Retail Ops'); expect(ins).toContain('Backup Process');
    expect(by('DLY-004').subTaskDefinitions[0].activities).toHaveLength(1);
  });

  it('attaches the DF backup process to the step before it, as reference', () => {
    expect(by('DLY-005').subTaskDefinitions.map(d => d.title)).toEqual(['Access Brand Central', 'Filter Orders', 'Print Labels Tab', 'Manifest Generation']);
    const tail = sub('DLY-005', 'Manifest').activities[0].instructions;
    expect(tail).toContain('BACKUP — Vendor Central Order Processing');
    expect(tail).toContain('before 1:30 PM');           // the continuation row is kept
    expect(warnings.some(w => /DLY-005.*attached/.test(w))).toBe(true);
  });

  it('turns Task N groups and headed sections into steps, not click-paths', () => {
    expect(sub('DLY-006', 'PO Upload').activities).toHaveLength(9);
    expect(sub('DLY-008', 'WhatsApp').activities.map(a => a.title)).toEqual(
      ['Order Management', 'ASIN Suppression', 'Inventory Management', 'Payment Queries', 'Buy Box Monitoring', 'Advertising (Ads)']);
    expect(sub('DLY-008', 'Phone').activities.map(a => a.title)).toContain('Rating & Review Issues');
    expect(sub('DLY-007', 'Raise a New Ticket').activities).toHaveLength(1);       // 9 clicks → one step
    expect(sub('DLY-0012-2', 'Access').activities).toHaveLength(3);                 // Step 1/2/3
    expect(sub('DLY-0012-1', 'Step 1').activities.map(a => a.title)).toEqual(['Access Adbrew', 'Export Performance Data']);
  });

  it('keeps each routine a manageable number of ticks', () => {
    for (const t of templates) expect(t.activityCount).toBeLessThanOrEqual(20);
    expect(by('DLY-001').activityCount).toBeLessThanOrEqual(20);
  });

  it('puts reference-only rows in the description and Output rows in expected output', () => {
    expect(by('DLY-002').subTaskDefinitions.some(d => /root cause/i.test(d.title))).toBe(false);
    expect(by('DLY-002').description).toMatch(/Reference — Root Cause/);
    expect(by('DLY-0012-2').subTaskDefinitions.some(d => /key points/i.test(d.title))).toBe(false);
    expect(by('DLY-004').expectedOutput).toContain('Out of Stock report');
    expect(by('DLY-005').expectedOutput).toContain('Pickup manifest');
  });

  it('schedules the weekly/monthly sub-tasks', () => {
    expect(sub('DLY-001', 'Weekly Sales Report').schedule).toEqual({ weekdays: [1, 4] });
    expect(sub('DLY-001', 'Weekly Purchase Order').schedule).toEqual({ weekdays: [1] });
    expect(sub('DLY-001', 'Monthly Sales Target').schedule).toEqual({ weekdays: [1], dayOfMonthTo: 7 });
    expect(sub('DLY-001', 'Average Selling Price').schedule).toBeUndefined();
  });

  it('flags per-brand routines, sets due times, and leaves need-driven ones off', () => {
    const brand = templates.filter(t => t.brandMode === 'CHECKLIST').map(t => t.code).sort();
    expect(brand).toEqual(['DLY-001', 'DLY-002', 'DLY-003', 'DLY-004', 'DLY-005', 'DLY-007', 'DLY-008', 'DLY-0011', 'DLY-0012-1'].sort());
    expect(by('DLY-005').dueTime).toBe('13:30');
    expect(templates.filter(t => !t.autoAssign).map(t => t.code).sort()).toEqual(['DLY-009', 'DLY-0010A', 'DLY-0010B'].sort());
    expect(templates.every(t => t.priority !== 'CRITICAL')).toBe(true);
    expect(by('DLY-0010A').priority).toBe('LOW');
    expect(by('DLY-0010B').priority).toBe('MEDIUM');
  });
});
