/**
 * The seeder CLI: argument handling, and — most importantly — that a CSV read from disk keeps its
 * UTF-8 characters. Reading the file as a buffer lets SheetJS sniff the codepage and turns "•" into
 * "â¢" inside the long quoted SOP cells, which silently changes how many steps a routine produces.
 */
const path = require('path');
const { parseArgs, readSheet, encodingProblem } = require('../../scripts/seed-daily-ops-tasks');
const { parseDailyOpsSheet } = require('../../services/pems/dailyOpsImporter');

const FIXTURE = path.join(__dirname, '../fixtures/dailyOpsMaster.csv');

describe('seed-daily-ops-tasks CLI', () => {
  it('defaults to a dry run and never writes without --apply', () => {
    expect(parseArgs(['--file', 'x.csv'])).toMatchObject({ file: 'x.csv', apply: false, generate: true });
    expect(parseArgs(['-f', 'x.csv', '--apply', '--no-generate', '--json', '--user-id', 'u1']))
      .toMatchObject({ file: 'x.csv', apply: true, generate: false, json: true, userId: 'u1' });
    expect(parseArgs(['--help'])).toMatchObject({ help: true });
  });

  it('rejects unknown options and options with no value', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown option/);
    expect(() => parseArgs(['--file'])).toThrow(/needs a value/);
  });

  it('reads a UTF-8 sheet without mojibake', () => {
    const { rows } = readSheet(FIXTURE);
    expect(encodingProblem(rows)).toBeNull();
    const text = rows.map((r) => (r || []).join(' ')).join('\n');
    expect(text).toContain('•');
    expect(text).not.toMatch(/â/);
  });

  it('produces the same routines from disk as the importer test fixture', () => {
    const { rows } = readSheet(FIXTURE);
    const { templates } = parseDailyOpsSheet(rows);
    expect(templates).toHaveLength(14);
    // The bullet characters decide whether "Task 1…Task 9" style SOPs split into separate activities.
    const poUpload = templates.find((t) => t.code === 'DLY-006').subTaskDefinitions[0];
    expect(poUpload.activities).toHaveLength(9);
    const whatsapp = templates.find((t) => t.code === 'DLY-008').subTaskDefinitions[0];
    expect(whatsapp.activities.length).toBeGreaterThanOrEqual(6);
  });

  it('flags a sheet that is not UTF-8 instead of seeding broken text', () => {
    expect(encodingProblem([['a â¢ b'], ['x']])).toMatch(/Windows-1252/);
    expect(encodingProblem([['a � b'], ['x']])).toMatch(/replacement characters/);
    expect(encodingProblem([['a • b'], ['x']])).toBeNull();
  });
});
