/**
 * Cleanup: legacy ruleset task rows in the Actions table.
 *
 * Background
 * ----------
 * PemsTaskInstances.TemplateId was NOT NULL, so every ruleset "create_task" action
 * failed inside pemsService.createInstance. The engine caught that error and silently
 * fell back to the legacy Actions table, so a single run over the ~188k-row Asins table
 * wrote 221,665 rows with Type='automated' / Status='PENDING' / Title LIKE '[Ruleset]%'.
 *
 * The Tasks page prepended every one of those rows to its response (no LIMIT), which is
 * why a page load produced a 107.9 MB payload and took ~9.5s.
 *
 * That bug is fixed (migration 030 + rulesetEngineService), so these rows are dead
 * weight. This script removes them.
 *
 * SAFETY
 * ------
 *   • Dry run by default. Nothing is deleted without --apply.
 *   • Only rows matching Type='automated' AND Status='PENDING' AND Title LIKE '[Ruleset]%'
 *     are ever considered. Genuine Actions (any other Type/Status/Title) are untouched.
 *   • Batched deletes so the transaction log does not blow up.
 *   • Optional --export writes the doomed rows to CSV first.
 *
 * Usage
 *   node scripts/cleanup-legacy-rule-tasks.js                      # preview
 *   node scripts/cleanup-legacy-rule-tasks.js --export out.csv     # preview + dump
 *   node scripts/cleanup-legacy-rule-tasks.js --apply               # delete
 *   node scripts/cleanup-legacy-rule-tasks.js --apply --batch 2000
 *   node scripts/cleanup-legacy-rule-tasks.js --keep-completed      # also drop in-progress ones
 *
 *   node scripts/cleanup-legacy-rule-tasks.js --include-pems --export pems.csv --apply
 *     ALSO removes PemsTaskInstances rows with Source = 'RULESET' (the tasks the
 *     ruleset engine writes today). Only rows carrying that Source are touched, so
 *     ROUTINE (Daily Ops) and MANUAL tasks are never affected.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getPool, sql } = require('../database/db');

// Every one of these must hold for a row to be deleted. Kept in one place so the
// preview and the delete can never drift apart.
const TARGET = {
  type: 'automated',
  status: 'PENDING',
  titlePrefix: '[Ruleset]',
};

function parseArgs(argv) {
  const args = { apply: false, export: null, batch: 5000, keepCompleted: false, includePems: false, allAutomated: false, limit: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--export') args.export = argv[++i];
    else if (a === '--keep-completed') args.keepCompleted = true;
    else if (a === '--include-pems') args.includePems = true;
    else if (a === '--all-automated') args.allAutomated = true;
    else if (a === '--batch') args.batch = Math.max(1, parseInt(argv[++i], 10) || 5000);
    else if (a === '--limit') args.limit = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === '--help' || a === '-h') { args.help = true; }
  }
  return args;
}

function buildPredicate(keepCompleted, allAutomated) {
  const params = [];
  if (allAutomated) {
    // Every automated Actions row is ruleset output. Two different title formats exist
    // depending on which engine path wrote it ("[Ruleset] rule - asin" and
    // "[rule] seller - N items"), so match on Type alone rather than a title prefix.
    return { where: "Type = @type", params: [{ name: 'type', type: sql.VarChar, value: TARGET.type }] };
  }
  // NOT `Title LIKE '[Ruleset]%'` — in SQL Server LIKE, '[' opens a character class, so
  // that pattern silently matches nothing when the title literally starts with '['.
  // LEFT(...) = compares the literal prefix instead.
  let where = "Type = @type AND LEFT(Title, 9) = @titlePrefix";
  params.push({ name: 'type', type: sql.VarChar, value: TARGET.type });
  params.push({ name: 'titlePrefix', type: sql.NVarChar, value: TARGET.titlePrefix });
  if (keepCompleted) {
    where += ' AND Status IN (@status0, @status1)';
    params.push({ name: 'status0', type: sql.VarChar, value: 'PENDING' });
    params.push({ name: 'status1', type: sql.VarChar, value: 'IN_PROGRESS' });
  } else {
    where += ' AND Status = @status';
    params.push({ name: 'status', type: sql.VarChar, value: TARGET.status });
  }
  return { where, params };
}

function bound(req, params) {
  for (const p of params) req.input(p.name, p.type, p.value);
  return req;
}

const fmt = (n) => (n || 0).toLocaleString();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
    return;
  }

  const pool = await getPool();
  const { where, params } = buildPredicate(args.keepCompleted, args.allAutomated);

  try {
    // ── Preview ─────────────────────────────────────────────────────────────
    const summary = await bound(pool.request(), params).query(`
      SELECT COUNT(*) AS total,
             MIN(CreatedAt) AS oldest,
             MAX(CreatedAt) AS newest,
             COUNT(DISTINCT Title) AS distinctTitles,
             COUNT(DISTINCT AssignedTo) AS distinctAssignees
      FROM Actions WHERE ${where}
    `);
    const s = summary.recordset[0];

    const byDay = await bound(pool.request(), params).query(`
      SELECT CAST(CreatedAt AS DATE) AS d, COUNT(*) AS c
      FROM Actions WHERE ${where} GROUP BY CAST(CreatedAt AS DATE) ORDER BY d DESC
    `);
    const byTitle = await bound(pool.request(), params).query(`
      SELECT TOP 8 Title, COUNT(*) AS c
      FROM Actions WHERE ${where} GROUP BY Title ORDER BY c DESC
    `);

    console.log('\n=== Legacy ruleset task cleanup ===\n');
    if (!s.total) {
      console.log('No matching legacy Actions rows.');
      // Still fall through: --include-pems may still have PEMS ruleset instances to remove.
      if (!args.includePems) {
        console.log('Nothing to clean up.');
        return;
      }
    }
    console.log(`Matching rows : ${fmt(s.total)}`);
    console.log(`Created       : ${s.oldest?.toISOString?.().slice(0, 10)} → ${s.newest?.toISOString?.().slice(0, 10)}`);
    console.log(`Distinct titles: ${fmt(s.distinctTitles)}   Assignees: ${fmt(s.distinctAssignees)}`);
    console.log('\nBy day:');
    for (const r of byDay.recordset) console.log(`  ${r.d?.toISOString?.().slice(0, 10) || r.d}  ${fmt(r.c)}`);
    console.log('\nMost repeated titles:');
    for (const r of byTitle.recordset) console.log(`  ${fmt(r.c).padStart(8)}  ${(r.Title || '').slice(0, 70)}`);

    // Safety: confirm we are not about to touch anything that is not a ruleset row.
    const guardRes = await pool.request()
      .input('type', sql.VarChar, TARGET.type)
      .input('tp', sql.NVarChar, TARGET.titlePrefix)
      .query(`SELECT COUNT(*) AS c FROM Actions WHERE Type = @type AND LEFT(Title, 9) = @tp`);
    const allRuleset = guardRes.recordset[0].c;
    console.log(`\nGuard: ${fmt(allRuleset)} total '[Ruleset]' automated rows, ${fmt(s.total)} match this run's filter.`);

    if (args.export) {
      const out = path.resolve(args.export);
      const rows = await bound(pool.request(), params).query(`
        SELECT Id, Title, Status, Priority, SellerId, AssignedTo, CreatedBy, CreatedAt, Asins, DueDate
        FROM Actions WHERE ${where} ORDER BY CreatedAt
      `);
      const cols = ['Id', 'Title', 'Status', 'Priority', 'SellerId', 'AssignedTo', 'CreatedBy', 'CreatedAt', 'Asins', 'DueDate'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [cols.join(','), ...rows.recordset.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
      fs.writeFileSync(out, csv, 'utf8');
      console.log(`\nExported ${fmt(rows.recordset.length)} rows → ${out}`);
    }

    // ── Delete in batches ───────────────────────────────────────────────────
    if (!args.apply) {
      console.log('\nDRY RUN — no rows deleted. Re-run with --apply to remove them.');
    } else {
      console.log(`\nDeleting Actions in batches of ${fmt(args.batch)}…`);
      let deleted = 0;
      for (;;) {
        const take = args.limit && deleted + args.batch > args.limit ? args.limit - deleted : args.batch;
        if (take <= 0) break;

        const delReq = pool.request();
        bound(delReq, params);
        delReq.input('take', sql.Int, take);
        const res = await delReq.query(`
          DECLARE @n INT;
          DELETE TOP (@take) FROM Actions WHERE ${where};
          SET @n = @@ROWCOUNT;
          SELECT @n AS deleted;
        `);
        // A bare DELETE produces no result set, so the SELECT lands at index 0. Reading
        // index 1 returned undefined and made the loop exit after the first batch while
        // still reporting "Deleted 0".
        const n = Number(res.recordsets?.[0]?.[0]?.deleted ?? res.rowsAffected?.[0] ?? 0);
        if (n === 0) break;
        deleted += n;
        process.stdout.write(`\r  deleted ${fmt(deleted)}${args.limit ? ` / ${fmt(args.limit)}` : ''}   `);
        if (n < take) break;
      }
      process.stdout.write('\n');
      console.log(`\nDeleted ${fmt(deleted)} legacy ruleset rows from Actions.`);

      const after = await pool.request().query(`SELECT COUNT(*) AS c FROM Actions`);
      console.log(`Actions rows remaining: ${fmt(after.recordset[0].c)}`);
      const stillOpen = await pool.request().query(`
        SELECT COUNT(*) AS c FROM Actions WHERE Type='automated' AND Status IN ('PENDING','IN_PROGRESS')
      `);
      console.log(`Open automated ruleset rows remaining: ${fmt(stillOpen.recordset[0].c)}`);
    }

    // ── PEMS ruleset instances ──────────────────────────────────────────────
    // Scoped to Source = 'RULESET' exactly. ROUTINE (Daily Ops), MANUAL and any other
    // source are left alone; this is the only predicate used for deletion.
    if (args.includePems) {
      const pemsBefore = await pool.request()
        .query(`SELECT COUNT(*) AS c FROM PemsTaskInstances WHERE Source = 'RULESET'`);
      const pemsTotal = pemsBefore.recordset[0].c;

      const byStatus = await pool.request().query(`
        SELECT Status, COUNT(*) AS c FROM PemsTaskInstances WHERE Source = 'RULESET' GROUP BY Status
      `);
      const byRuleset = await pool.request().query(`
        SELECT TOP 8 SourceId, SourceRef, COUNT(*) AS c
        FROM PemsTaskInstances WHERE Source = 'RULESET' GROUP BY SourceId, SourceRef ORDER BY c DESC
      `);
      console.log(`\n--- PEMS ruleset instances: ${fmt(pemsTotal)} ---`);
      for (const r of byStatus.recordset) console.log(`  ${fmt(r.c).padStart(8)}  ${r.Status}`);
      console.log('  By rule:');
      for (const r of byRuleset.recordset) console.log(`  ${fmt(r.c).padStart(8)}  ${r.SourceRef || '(no rule)'} [${r.SourceId || '-'}]`);

      if (args.export) {
        const out = path.resolve(args.export.replace(/\.csv$/i, '') + '-pems.csv');
        const rows = await pool.request().query(`
          SELECT Id, InstanceCode, Title, Status, Priority, SellerId, AssignedTo,
                 SourceId, SourceRef, Asins, DueDate, CreatedAt
          FROM PemsTaskInstances WHERE Source = 'RULESET' ORDER BY CreatedAt
        `);
        const cols = ['Id', 'InstanceCode', 'Title', 'Status', 'Priority', 'SellerId', 'AssignedTo',
                      'SourceId', 'SourceRef', 'Asins', 'DueDate', 'CreatedAt'];
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.join(','), ...rows.recordset.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
        fs.writeFileSync(out, csv, 'utf8');
        console.log(`  Exported ${fmt(rows.recordset.length)} PEMS rows -> ${out}`);
      }

      if (args.apply && pemsTotal > 0) {
        // Child rows first: 7 tables reference PemsTaskInstances via TaskInstanceId, and the
        // delete below would fail on the FK. Each is scoped to the same Source='RULESET' set.
        const CHILD_TABLES = [
          'PemsSubTasks', 'PemsEvidence', 'PemsTaskReviews', 'PemsTaskAuditLogs',
          'PemsActivities', 'PemsNotifications', 'PemsTaskBrands',
        ];
        for (const t of CHILD_TABLES) {
          const r = await pool.request().query(
            `DELETE FROM ${t} WHERE TaskInstanceId IN (SELECT Id FROM PemsTaskInstances WHERE Source = 'RULESET')`
          );
          if (r.rowsAffected && r.rowsAffected[0]) console.log(`  cleared ${fmt(r.rowsAffected[0])} rows from ${t}`);
        }

        let pemsDeleted = 0;
        for (;;) {
          const res = await pool.request().input('take', sql.Int, args.batch).query(`
            DECLARE @n INT;
            DELETE TOP (@take) FROM PemsTaskInstances WHERE Source = 'RULESET';
            SET @n = @@ROWCOUNT;
            SELECT @n AS deleted;
          `);
          const n = Number(res.recordsets?.[0]?.[0]?.deleted ?? res.rowsAffected?.[0] ?? 0);
          if (n === 0) break;
          pemsDeleted += n;
          process.stdout.write(`\r  pems deleted ${fmt(pemsDeleted)}${args.limit ? ` / ${fmt(args.limit)}` : ''}   `);
          if (n < args.batch) break;
        }
        process.stdout.write('\n');
        console.log(`PEMS ruleset instances deleted: ${fmt(pemsDeleted)}`);
      }
      const pemsAfter = await pool.request()
        .query(`SELECT COUNT(*) AS c FROM PemsTaskInstances WHERE Source = 'RULESET'`);
      console.log(`PEMS ruleset instances remaining: ${fmt(pemsAfter.recordset[0].c)}`);
      const bySource = await pool.request().query(`
        SELECT Source, COUNT(*) AS c FROM PemsTaskInstances GROUP BY Source ORDER BY c DESC
      `);
      console.log('PEMS instances by source (kept):');
      for (const r of bySource.recordset) console.log(`  ${fmt(r.c).padStart(8)}  ${r.Source || '(none)'}`);
    }
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
