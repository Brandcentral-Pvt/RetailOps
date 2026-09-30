/**
 * PEMS Recurrence Service
 * Materializes the next occurrence of recurring task templates
 * (Frequency != ONE_TIME) on a schedule, with idempotency guarantees.
 */
const { sql, getPool, generateId } = require('../../database/db');
const pemsService = require('./pemsService');
const { getNextDueDate } = require('./workflowEngine');
const logger = require('../../utils/logger');
const { runsOn, dueAtFor, startOfDay, nextMidnight } = require('./routineSchedule');

const BATCH_CAP = 100;

/**
 * Pure: compute the next occurrence datetime for a template.
 * CUSTOM frequency uses cron-parser (if installed) with a safe fallback.
 */
function computeNextOccurrence(frequency, customCron, fromDate = new Date()) {
  if (frequency === 'CUSTOM' && customCron) {
    try {
      // eslint-disable-next-line global-require
      const cronParser = require('cron-parser');
      const interval = cronParser.parseExpression(customCron, { currentDate: fromDate });
      return interval.next().toDate();
    } catch (err) {
      logger.warn(`Recurrence: invalid customCron "${customCron}" — falling back to frequency math`, { error: err.message });
      return getNextDueDate(frequency, customCron, fromDate);
    }
  }
  return getNextDueDate(frequency, customCron, fromDate);
}


/** Who does this routine? Explicit AssigneeUserIds win; otherwise every active user holding AssigneeRole. */
async function resolveAssignees(pool, tpl) {
  let ids = [];
  try { ids = JSON.parse(tpl.AssigneeUserIds || '[]'); } catch (_) { ids = []; }
  ids = Array.isArray(ids) ? ids.filter(Boolean) : [];

  const req = pool.request();
  let query;
  if (ids.length) {
    ids.forEach((id, i) => req.input(`u${i}`, sql.VarChar, String(id)));
    query = `SELECT Id, FirstName, LastName, Email FROM Users
             WHERE IsActive = 1 AND Id IN (${ids.map((_, i) => `@u${i}`).join(',')})`;
  } else {
    req.input('role', sql.VarChar, tpl.AssigneeRole || 'brand_manager');
    query = `SELECT u.Id, u.FirstName, u.LastName, u.Email FROM Users u
             JOIN Roles r ON u.RoleId = r.Id
             WHERE u.IsActive = 1 AND r.Name = @role`;
  }
  const res = await req.query(query);
  return res.recordset.map(u => ({
    id: u.Id,
    name: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email || u.Id,
  }));
}

/**
 * Daily routines: for every active AutoAssign template that runs today, create one ASSIGNED instance
 * per assignee (due today at the template's DueTime). Idempotent per (template, day, person) through
 * PemsRecurrenceLog, and never back-fills missed days — a routine is about today, not a backlog.
 * Only the sub-tasks scheduled for today (e.g. Monday-only steps) are included.
 */
async function generateRoutineOccurrences(now = new Date(), opts = {}) {
  const pool = await getPool();
  const today = startOfDay(now);
  const req = pool.request().input('now', sql.DateTime2, now);
  let where = `IsActive = 1 AND ISNULL(AutoAssign, 0) = 1 AND Frequency != 'ONE_TIME'`;
  if (opts.templateId) { where += ' AND Id = @tid'; req.input('tid', sql.VarChar, opts.templateId); }
  else where += ' AND (NextScheduledDate IS NULL OR NextScheduledDate <= @now)';

  const tpls = (await req.query(`
    SELECT TOP (200) Id, TaskCode, Name, Category, Department, Priority, SLAHours, DefaultTarget, ReviewerId,
           Frequency, RunDays, DueTime, AssigneeRole, AssigneeUserIds
    FROM PemsTaskTemplates WHERE ${where}`)).recordset;

  const out = { created: 0, skipped: 0, templates: tpls.length, noAssignees: [] };
  for (const tpl of tpls) {
    const setNext = () => pool.request().input('id', sql.VarChar, tpl.Id).input('next', sql.DateTime2, nextMidnight(today))
      .input('gen', sql.DateTime2, now)
      .query('UPDATE PemsTaskTemplates SET NextScheduledDate = @next, LastGeneratedAt = @gen WHERE Id = @id');

    if (!runsOn(tpl.RunDays, today)) { await setNext(); continue; }
    const dueAt = dueAtFor(today, tpl.DueTime, now);
    if (!dueAt) { await setNext(); continue; }

    let assignees = [];
    try { assignees = await resolveAssignees(pool, tpl); }
    catch (err) { logger.error(`Routine: cannot resolve assignees for ${tpl.TaskCode}`, { error: err.message }); continue; }
    if (!assignees.length) { out.noAssignees.push(tpl.TaskCode); await setNext(); continue; }

    for (const a of assignees) {
      const dup = await pool.request()
        .input('t', sql.VarChar, tpl.Id).input('occ', sql.DateTime2, today).input('a', sql.VarChar, a.id)
        .query('SELECT COUNT(*) AS c FROM PemsRecurrenceLog WHERE TemplateId = @t AND OccurrenceFor = @occ AND AssigneeId = @a');
      if (dup.recordset[0].c > 0) { out.skipped++; continue; }
      try {
        const inst = await pemsService.createInstance({
          templateId: tpl.Id, title: tpl.Name, department: tpl.Department, category: tpl.Category,
          priority: tpl.Priority, slaHours: tpl.SLAHours, target: tpl.DefaultTarget,
          reviewerId: tpl.ReviewerId, frequency: tpl.Frequency,
          status: 'ASSIGNED', assignedTo: a.id, assigneeName: a.name,
          dueDate: dueAt, occurrenceDate: today,
          source: 'ROUTINE', sourceId: tpl.Id, sourceRef: tpl.TaskCode, tags: [tpl.TaskCode].filter(Boolean),
          description: `Daily routine · ${today.toISOString().slice(0, 10)}`,
        });
        await pool.request()
          .input('id', sql.VarChar, generateId ? generateId() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
          .input('t', sql.VarChar, tpl.Id).input('i', sql.VarChar, inst.id)
          .input('occ', sql.DateTime2, today).input('a', sql.VarChar, a.id)
          .query('INSERT INTO PemsRecurrenceLog (Id, TemplateId, InstanceId, OccurrenceFor, AssigneeId) VALUES (@id, @t, @i, @occ, @a)');
        out.created++;
      } catch (err) {
        logger.error(`Routine generation failed for ${tpl.TaskCode} → ${a.id}`, { error: err.message });
      }
    }
    await setNext();
  }
  if (out.created) logger.info(`Routine: created ${out.created} task(s) across ${out.templates} template(s)`);
  return out;
}

/**
 * Generate due occurrences for all active recurring templates.
 * Idempotent: PemsRecurrenceLog (TemplateId, OccurrenceFor) is the guard.
 */
async function generateDueOccurrences(now = new Date()) {
  if (process.env.PEMS_RECURRENCE_ENABLED === 'false') {
    return { disabled: true, created: 0, scanned: 0 };
  }

  let routineCreated = 0;
  try { routineCreated = (await generateRoutineOccurrences(now)).created; }
  catch (err) { logger.error('Routine generation failed', { error: err.message }); }

  const pool = await getPool();

  const templatesRes = await pool.request()
    .input('now', sql.DateTime2, now)
    .input('limit', sql.Int, BATCH_CAP)
    .query(`
      SELECT TOP (@limit) Id, Name, Department, Priority, SLAHours, TargetType,
        DefaultTarget, ReviewerId, Frequency, CustomCron, CreatedAt, NextScheduledDate
      FROM PemsTaskTemplates
      WHERE IsActive = 1 AND Frequency != 'ONE_TIME' AND ISNULL(AutoAssign, 0) = 0
        AND (NextScheduledDate IS NULL OR NextScheduledDate <= @now)
      ORDER BY ISNULL(NextScheduledDate, '1900-01-01') ASC
    `);

  const templates = templatesRes.recordset;
  if (templates.length === 0) return { disabled: false, created: routineCreated, scanned: 0 };

  let created = 0;

  for (const tpl of templates) {
    if (created >= BATCH_CAP) break;

    const occurrenceFor = tpl.NextScheduledDate
      ? new Date(tpl.NextScheduledDate)
      : computeNextOccurrence(tpl.Frequency, tpl.CustomCron, new Date(tpl.CreatedAt || now));

    const nextOccurrence = computeNextOccurrence(tpl.Frequency, tpl.CustomCron, occurrenceFor);

    // Idempotency guard — never create the same occurrence twice
    const dup = await pool.request()
      .input('templateId', sql.VarChar, tpl.Id)
      .input('occ', sql.DateTime2, occurrenceFor)
      .query('SELECT COUNT(*) as c FROM PemsRecurrenceLog WHERE TemplateId = @templateId AND OccurrenceFor = @occ');
    if (dup.recordset[0].c > 0) {
      await pool.request()
        .input('id', sql.VarChar, tpl.Id)
        .input('next', sql.DateTime2, nextOccurrence)
        .query('UPDATE PemsTaskTemplates SET NextScheduledDate = @next WHERE Id = @id');
      continue;
    }

    try {
      const result = await pemsService.createInstance({
        templateId: tpl.Id,
        title: tpl.Name,
        department: tpl.Department,
        priority: tpl.Priority,
        slaHours: tpl.SLAHours,
        target: tpl.DefaultTarget,
        reviewerId: tpl.ReviewerId,
        frequency: tpl.Frequency,
        status: 'DRAFT',
        dueDate: occurrenceFor,
        description: `Auto-generated recurring occurrence for ${tpl.Name}`,
        tags: [],
      });

      const logId = generateId ? generateId() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await pool.request()
        .input('id', sql.VarChar, logId)
        .input('templateId', sql.VarChar, tpl.Id)
        .input('instanceId', sql.VarChar, result.id)
        .input('occ', sql.DateTime2, occurrenceFor)
        .query('INSERT INTO PemsRecurrenceLog (Id, TemplateId, InstanceId, OccurrenceFor) VALUES (@id, @templateId, @instanceId, @occ)');

      await pool.request()
        .input('id', sql.VarChar, tpl.Id)
        .input('next', sql.DateTime2, nextOccurrence)
        .input('lastGen', sql.DateTime2, now)
        .query('UPDATE PemsTaskTemplates SET NextScheduledDate = @next, LastGeneratedAt = @lastGen WHERE Id = @id');

      created++;
      logger.info(`Recurrence: created instance ${result.instanceCode} for template ${tpl.Name} (${tpl.Id})`);
    } catch (err) {
      logger.error(`Recurrence generation failed for template ${tpl.Id}`, { error: err.message });
    }
  }

  return { disabled: false, created: created + routineCreated, scanned: templates.length };
}

module.exports = { generateDueOccurrences, generateRoutineOccurrences, resolveAssignees, computeNextOccurrence };
