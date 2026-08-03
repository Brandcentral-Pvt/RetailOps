/**
 * PEMS Recurrence Service
 * Materializes the next occurrence of recurring task templates
 * (Frequency != ONE_TIME) on a schedule, with idempotency guarantees.
 */
const { sql, getPool, generateId } = require('../../database/db');
const pemsService = require('./pemsService');
const { getNextDueDate } = require('./workflowEngine');
const logger = require('../../utils/logger');

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

/**
 * Generate due occurrences for all active recurring templates.
 * Idempotent: PemsRecurrenceLog (TemplateId, OccurrenceFor) is the guard.
 */
async function generateDueOccurrences(now = new Date()) {
  if (process.env.PEMS_RECURRENCE_ENABLED === 'false') {
    return { disabled: true, created: 0, scanned: 0 };
  }

  const pool = await getPool();

  const templatesRes = await pool.request()
    .input('now', sql.DateTime2, now)
    .input('limit', sql.Int, BATCH_CAP)
    .query(`
      SELECT TOP (@limit) Id, Name, Department, Priority, SLAHours, TargetType,
        DefaultTarget, ReviewerId, Frequency, CustomCron, CreatedAt, NextScheduledDate
      FROM PemsTaskTemplates
      WHERE IsActive = 1 AND Frequency != 'ONE_TIME'
        AND (NextScheduledDate IS NULL OR NextScheduledDate <= @now)
      ORDER BY ISNULL(NextScheduledDate, '1900-01-01') ASC
    `);

  const templates = templatesRes.recordset;
  if (templates.length === 0) return { disabled: false, created: 0, scanned: 0 };

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

  return { disabled: false, created, scanned: templates.length };
}

module.exports = { generateDueOccurrences, computeNextOccurrence };
