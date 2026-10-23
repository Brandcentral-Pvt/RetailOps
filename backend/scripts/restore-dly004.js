/**
 * ONE-OFF REPAIR: restore DLY-004 to its importer-original state.
 *
 * An earlier pilot experiment edited the live DLY-004 row (changed its SOP,
 * set AutoAssign/IsActive off and added an assignment-rules row). The OOS
 * rebuild must leave DLY-004 untouched, so this restores the exact shape the
 * Daily Operations importer produces and deletes the stray rules row.
 *
 * Idempotent. Safe to re-run.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getPool, sql } = require('../database/db');
const { parseDailyOpsSheet } = require('../services/pems/dailyOpsImporter');

const TASK_CODE = 'DLY-004';
// The DLY-* rows were all updated in one batch right after import (~16:54–16:55
// on 2026-09-30). DLY-003 followed at 16:54:57.703 and DLY-005 at 16:54:59.030,
// so DLY-004's original UpdatedAt sat between them.
const IMPORT_BATCH_UPDATED_AT = '2026-09-30T16:54:58.300Z';

(async () => {
  const text = fs.readFileSync(path.join(__dirname, '../__tests__/fixtures/dailyOpsMaster.csv'), 'utf8');
  const rows = XLSX.utils.sheet_to_json(XLSX.read(text, { type: 'string' }).Sheets.Sheet1, {
    header: 1, defval: '', raw: false, blankrows: false,
  });
  const { templates } = parseDailyOpsSheet(rows);
  const t = templates.find((x) => x.code === TASK_CODE);
  if (!t) throw new Error(`Importer did not produce ${TASK_CODE}`);

  const pool = await getPool();
  const found = await pool.request()
    .input('code', sql.VarChar, TASK_CODE)
    .query('SELECT Id FROM PemsTaskTemplates WHERE TaskCode = @code');
  if (!found.recordset.length) throw new Error(`${TASK_CODE} not found`);
  const templateId = found.recordset[0].Id;

  await pool.request()
    .input('id', sql.VarChar, templateId)
    .input('description', sql.NVarChar, t.description)
    .input('expectedOutput', sql.NVarChar, t.expectedOutput)
    .input('subTaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(t.subTaskDefinitions))
    .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(t.tags))
    .input('slaHours', sql.Int, t.slaHours)
    .input('tatHours', sql.Int, t.tatHours)
    .input('priority', sql.VarChar, t.priority)
    .input('department', sql.VarChar, t.department)
    .input('brandMode', sql.VarChar, t.brandMode)
    .input('dueTime', sql.VarChar, t.dueTime)
    .input('runDays', sql.VarChar, t.runDays)
    .input('estMinutes', sql.Int, t.estimatedExecutionMinutes)
    .input('autoAssign', sql.Bit, 1)
    .input('isActive', sql.Bit, 1)
    .input('updatedAt', sql.DateTime2, new Date(IMPORT_BATCH_UPDATED_AT))
    .query(`
      UPDATE PemsTaskTemplates SET
        Description = @description,
        ExpectedOutput = @expectedOutput,
        SubTaskDefinitions = @subTaskDefinitions,
        Tags = @tags,
        SLAHours = @slaHours,
        TATHours = @tatHours,
        Priority = @priority,
        Department = @department,
        BrandMode = @brandMode,
        DueTime = @dueTime,
        RunDays = @runDays,
        EstimatedExecutionMinutes = @estMinutes,
        AutoAssign = @autoAssign,
        IsActive = @isActive,
        UpdatedAt = @updatedAt
      WHERE Id = @id
    `);

  const del = await pool.request()
    .input('tid', sql.VarChar, templateId)
    .query('DELETE FROM PemsAssignmentRules WHERE TemplateId = @tid');

  console.log(`Restored ${TASK_CODE} (id=${templateId}); removed ${del.rowsAffected[0]} stray assignment-rule row(s).`);
  console.log(`  IsActive=1 AutoAssign=1 | SOP ${t.subTaskDefinitions.length} phases / ${t.activityCount} activities`);
  process.exit(0);
})().catch((e) => { console.error('Restore failed:', e.message); process.exit(1); });
