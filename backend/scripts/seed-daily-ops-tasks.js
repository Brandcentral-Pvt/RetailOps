/**
 * Seed the PEMS task templates from the Daily Operations Master sheet — straight from the file
 * into the database, with no task knowledge in this script.
 *
 *   node scripts/seed-daily-ops-tasks.js --file "<path to the master>.csv"            # dry run (default)
 *   node scripts/seed-daily-ops-tasks.js --file "<path>" --apply                     # write + generate today
 *   node scripts/seed-daily-ops-tasks.js --file "<path>" --apply --no-generate      # write only
 *   node scripts/seed-daily-ops-tasks.js --file "<path>" --defaults "<overrides>.json"
 *
 * Everything about a task — name, priority, owner, sub-tasks, SOP text, expected output,
 * frequency, TAT, SLA — comes from the sheet. The few values the sheet leaves blank come from
 * config/dailyOps.defaults.json (or --defaults), which is data you can edit without code.
 *
 * Dry run is the default: it reports what would be created/updated and touches nothing.
 * Re-running is safe — templates are matched by Task Code and updated, not duplicated.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const XLSX = require('xlsx');
const routineService = require('../services/pems/routineService');
const { loadDailyOpsDefaults } = require('../services/pems/dailyOpsDefaults');
const { getPool } = require('../database/db');

const HELP = `
Daily Operations Master → PEMS task templates

  --file, -f <path>     Master sheet (.csv/.xlsx/.xls). Required.
  --apply               Write to the database. Without it the run is a dry run.
  --no-generate         With --apply, do not create today's occurrences.
  --defaults <path>     Defaults JSON for the sheet's blank cells
                        (default: config/dailyOps.defaults.json).
  --user-id <id>        Value stored in CreatedBy for new templates.
  --json                Print the machine-readable result instead of the table.
  --help, -h            This text.
`.trim();

function parseArgs(argv) {
  const opts = { apply: false, generate: true, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} needs a value.`);
      return v;
    };
    switch (arg) {
      case '--file': case '-f': opts.file = next(); break;
      case '--apply': opts.apply = true; break;
      case '--no-generate': opts.generate = false; break;
      case '--defaults': opts.defaultsFile = next(); break;
      case '--user-id': opts.userId = next(); break;
      case '--json': opts.json = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`Unknown option "${arg}". Use --help.`);
    }
  }
  return opts;
}

/** Delimited sheets are read as UTF-8 text on purpose: letting SheetJS sniff the codepage of a
 *  buffer turns "•", "→" and "₹" into mojibake inside the long quoted SOP cells. */
const TEXT_SHEET = /\.(csv|tsv|txt)$/i;

/** CSV or Excel → the same "array of cell arrays" the importer and the UI upload both produce. */
function readSheet(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`No such file: ${abs}`);
  const isText = TEXT_SHEET.test(abs);
  const input = isText ? fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '') : fs.readFileSync(abs);
  const workbook = XLSX.read(input, { type: isText ? 'string' : 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error(`${path.basename(abs)} has no sheets.`);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1, defval: '', raw: false, blankrows: false,
  });
  if (rows.length < 2) throw new Error(`${path.basename(abs)} has no data rows.`);
  return { rows, sheetName, file: abs };
}

/** Cheap guard against a sheet that was saved in a non-UTF-8 codepage. */
function encodingProblem(rows) {
  const text = rows.map((r) => (r || []).join(' ')).join('\n');
  if (text.includes('\uFFFD')) return 'the file contains replacement characters (�) — it is probably not UTF-8';
  const mojibake = (text.match(/â/g) || []).length;
  if (mojibake > 0) return `${mojibake} mojibake sequences (â…) — the file looks like Windows-1252, not UTF-8`;
  return null;
}

const pad = (v, n) => String(v == null ? '' : v).padEnd(n).slice(0, n);
const yesNo = (b) => (b ? 'yes' : 'no');

const COLUMNS = [
  ['CODE', 12, (t) => t.code],
  ['ACTION', 7, (t) => t.action],
  ['PRIORITY', 9, (t) => t.priority],
  ['OWNER', 20, (t) => t.owner],
  ['PEOPLE', 6, (t) => t.resolvedPeople],
  ['DAILY', 6, (t) => yesNo(t.autoAssign)],
  ['DUE', 5, (t) => t.dueTime],
  ['BRAND', 9, (t) => (t.brandMode === 'CHECKLIST' ? 'per-brand' : '—')],
  ['MIN', 4, (t) => t.estimatedExecutionMinutes],
  ['SUBS', 4, (t) => t.subTaskCount],
  ['ACTS', 4, (t) => t.activityCount],
  ['NAME', 46, (t) => {
    const notDaily = (t.scheduledSubTasks || []).map((s) => `${s.title} (${s.runs})`);
    return [t.name, notDaily.length ? `[${notDaily.length} not daily: ${notDaily.join('; ')}]` : ''].filter(Boolean).join(' ');
  }],
];

function printTable(templates) {
  console.log(COLUMNS.map(([h, n]) => pad(h, n)).join(' '));
  console.log(COLUMNS.map(([, n]) => '-'.repeat(n)).join(' '));
  for (const t of templates) console.log(COLUMNS.map(([, n, get]) => pad(get(t), n)).join(' '));
}

async function main(argv = process.argv.slice(2)) {
  let exitCode = 0;
  let opts;
  try { opts = parseArgs(argv); }
  catch (err) { console.error(`${err.message}\n`); console.error(HELP); return 1; }

  if (opts.help) { console.log(HELP); return 0; }
  if (!opts.file) { console.error('--file is required.\n'); console.error(HELP); return 1; }

  try {
    const { rows, file } = readSheet(opts.file);
    const problem = encodingProblem(rows);
    if (problem) {
      console.error(`Refusing to continue: ${problem}.`);
      console.error('Re-save the sheet as UTF-8 (Excel: File → Save As → CSV UTF-8) and run it again.');
      return 1;
    }
    const defaults = opts.defaultsFile
      ? loadDailyOpsDefaults(path.resolve(opts.defaultsFile))
      : loadDailyOpsDefaults();
    console.log(`Sheet : ${file}`);
    console.log(`Rows  : ${rows.length}`);
    console.log(`Mode  : ${opts.apply ? `WRITE${opts.generate ? ' + generate today' : ''}` : 'DRY RUN (nothing is saved)'}\n`);

    const result = await routineService.importDailyOps({
      rows, defaults, overrides: {}, dryRun: !opts.apply, generateNow: opts.generate, userId: opts.userId || null,
    });

    if (opts.json) { console.log(JSON.stringify(result, null, 2)); }
    else {
      printTable(result.templates);
      if (result.dryRun) {
        const counts = result.templates.reduce((a, t) => { a[t.action] = (a[t.action] || 0) + 1; return a; }, {});
        console.log(`\n${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing to do'}.`);
        console.log('Dry run — re-run with --apply to save these templates.');
      } else {
        console.log(`\nCreated ${result.created}, updated ${result.updated}, today's occurrences: ${result.generatedToday}.`);
      }
      if (result.warnings.length) {
        console.log(`\nWarnings (${result.warnings.length}):`);
        for (const w of result.warnings) console.log(`  - ${w}`);
      }
    }
  } catch (err) {
    console.error(`\nFailed: ${err.message}`);
    if (process.env.DEBUG) console.error(err);
    exitCode = 1;
  } finally {
    // The pool is a singleton shared with the server; close it so the CLI can exit.
    try { (await getPool()).close(); } catch (_) { /* never connected */ }
  }
  return exitCode;
}

module.exports = { main, parseArgs, readSheet, encodingProblem, printTable };

if (require.main === module) {
  main().then((code) => process.exit(code)).catch((err) => { console.error(err); process.exit(1); });
}
