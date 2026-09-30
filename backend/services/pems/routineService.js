/**
 * Daily-routine administration: import the Daily Operations Master as templates, and run today's generation.
 * Parsing lives in dailyOpsImporter (pure); this file is the database side.
 */
const { sql, getPool } = require('../../database/db');
const pemsService = require('./pemsService');
const { parseDailyOpsSheet } = require('./dailyOpsImporter');
const { generateRoutineOccurrences } = require('./recurrenceService');
const { parseHHmm, parseRunDays } = require('./routineSchedule');
const logger = require('../../utils/logger');

/** Match "Chintan" / "Anjali Shah" to active users. Only an unambiguous single match is accepted. */
async function resolvePeople(pool, names) {
  const ids = []; const problems = [];
  for (const raw of names) {
    const n = String(raw).trim();
    if (!n) continue;
    const res = await pool.request().input('a', sql.NVarChar, `${n}%`).input('b', sql.NVarChar, n)
      .query(`SELECT Id, FirstName, LastName FROM Users
              WHERE IsActive = 1 AND (FirstName LIKE @a OR LTRIM(RTRIM(FirstName + ' ' + ISNULL(LastName, ''))) = @b)`);
    if (res.recordset.length === 1) ids.push(res.recordset[0].Id);
    else problems.push(res.recordset.length === 0 ? `no active user named "${n}"` : `"${n}" matches ${res.recordset.length} users`);
  }
  return { ids: [...new Set(ids)], problems };
}

function applyOverrides(tpl, o = {}) {
  const out = { ...tpl };
  if (typeof o.autoAssign === 'boolean') out.autoAssign = o.autoAssign;
  if (o.dueTime) out.dueTime = parseHHmm(o.dueTime, tpl.dueTime).text;
  if (o.runDays) out.runDays = parseRunDays(o.runDays).join(',');
  const est = parseInt(o.estimatedExecutionMinutes, 10);
  if (est > 0) out.estimatedExecutionMinutes = Math.min(480, est);
  return out;
}

async function importDailyOps({ rows, overrides = {}, dryRun = true, generateNow = true, userId = null } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('The sheet is empty.');
  const { templates, warnings } = parseDailyOpsSheet(rows);
  const pool = await getPool();

  // Existing templates (matched by code = Task ID) keep their routine settings on re-import.
  const existingRes = templates.length
    ? await (() => {
        const req = pool.request();
        templates.forEach((t, i) => req.input(`c${i}`, sql.VarChar, t.code));
        return req.query(`SELECT Id, TaskCode, AutoAssign, DueTime, RunDays, EstimatedExecutionMinutes, AssigneeUserIds, IsActive
                          FROM PemsTaskTemplates WHERE TaskCode IN (${templates.map((_, i) => `@c${i}`).join(',')})`);
      })()
    : { recordset: [] };
  const existing = new Map(existingRes.recordset.map(r => [r.TaskCode, r]));

  const prepared = [];
  for (const base of templates) {
    let t = { ...base };
    const ex = existing.get(t.code);
    if (ex) {
      t.autoAssign = !!ex.AutoAssign; if (ex.DueTime) t.dueTime = ex.DueTime; if (ex.RunDays) t.runDays = ex.RunDays;
      t.estimatedExecutionMinutes = ex.EstimatedExecutionMinutes || t.estimatedExecutionMinutes;
    }
    t = applyOverrides(t, overrides[t.code]);

    let assigneeUserIds = [];
    if (t.owner.kind === 'people') {
      const r = await resolvePeople(pool, t.owner.names);
      assigneeUserIds = r.ids;
      r.problems.forEach(p => warnings.push(`${t.code}: ${p}.`));
      if (!assigneeUserIds.length) {
        if (t.autoAssign) warnings.push(`${t.code}: nobody resolved for "${t.owner.label}" — daily generation switched off until an owner exists.`);
        t.autoAssign = false;
      }
    } else if (ex && ex.AssigneeUserIds) { try { assigneeUserIds = JSON.parse(ex.AssigneeUserIds); } catch (_) { /* ignore */ } }
    t.assigneeUserIds = assigneeUserIds;
    t._existingId = ex ? ex.Id : null;
    prepared.push(t);
  }

  const summary = prepared.map(t => ({
    code: t.code, name: t.name, priority: t.priority, sourcePriority: t.sourcePriority, category: t.category,
    action: t._existingId ? 'update' : 'create',
    owner: t.owner.label, assigneeRole: t.assigneeRole, resolvedPeople: t.assigneeUserIds.length,
    autoAssign: t.autoAssign, dueTime: t.dueTime, runDays: t.runDays,
    estimatedExecutionMinutes: t.estimatedExecutionMinutes,
    subTaskCount: t.subTaskCount, activityCount: t.activityCount, scheduledSubTasks: t.scheduledSubTasks,
  }));
  if (dryRun) return { dryRun: true, templates: summary, warnings };

  let created = 0; let updated = 0; const generated = { created: 0 };
  for (const t of prepared) {
    const payload = {
      name: t.name, description: t.description, category: t.category, department: t.department,
      frequency: t.frequency, priority: t.priority, slaHours: t.slaHours, tatHours: t.tatHours,
      expectedOutput: t.expectedOutput, assigneeRole: t.assigneeRole, subTaskDefinitions: t.subTaskDefinitions,
      tags: t.tags, estimatedExecutionMinutes: t.estimatedExecutionMinutes,
      autoAssign: t.autoAssign, dueTime: t.dueTime, runDays: t.runDays, assigneeUserIds: t.assigneeUserIds,
    };
    let id = t._existingId;
    if (id) { await pemsService.updateTemplate(id, payload); updated++; }
    else { const r = await pemsService.createTemplate({ ...payload, taskCode: t.code, reviewRequired: true, createdBy: userId }); id = r.id; created++; }
    if (generateNow && t.autoAssign) {
      try { generated.created += (await generateRoutineOccurrences(new Date(), { templateId: id })).created; }
      catch (err) { logger.error(`Routine import: generation failed for ${t.code}`, { error: err.message }); }
    }
  }
  return { dryRun: false, created, updated, generatedToday: generated.created, templates: summary, warnings };
}

/** Run today's generation now (all routines, or one template). Safe to call repeatedly. */
async function generateToday({ templateId } = {}) {
  return generateRoutineOccurrences(new Date(), { templateId });
}

module.exports = { importDailyOps, generateToday, resolvePeople };
