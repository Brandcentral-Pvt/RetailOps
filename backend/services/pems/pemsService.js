const { sql, getPool, generateId, withTransaction } = require('../../database/db');
const { canTransition, calculateSLAStatus, calculateAchievement, calculateVariance, getNextDueDate, getTransitionTimestamps, resolveReviewTransition, WORKFLOW_STATUSES } = require('./workflowEngine');
const { canActOnTask, canReviewTask, canTransitionTask } = require('./pemsPolicy');
const taskExecutionGates = require('./taskExecutionGates');
const taskInstanceSnapshot = require('./taskInstanceSnapshot');
const { isGlobalUserRole } = require('../../utils/roleUtils');
const { resolveSellerScope, buildScopeClause, canViewTaskByScope, applyScopeInputs } = require('./sellerScope');

/**
 * Appends the caller's seller-scope fragment to a `WHERE` under construction and
 * returns the params that must be bound. `alias` is '' for un-aliased queries.
 * Returns an empty fragment for global roles, so callers stay unchanged.
 */
function scopeWhere(requester, where, alias = '', requestedSellerIds = null, options = {}) {
  const scope = resolveSellerScope(requester, requestedSellerIds);
  const { clause, params } = buildScopeClause(scope, alias, options);
  return { where: `${where}${clause}`, params };
}

const { filterSubTasksForDate, parseRunDays, parseHHmm } = require('./routineSchedule');
const eventBus = require('../eventBus');
const eventStore = require('./eventStore');
const logger = require('../../utils/logger');

function genId() { return generateId ? generateId() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function genCode(prefix, n) { return `${prefix}-${String(n).padStart(4, '0')}`; }

// ═══════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════

async function createTemplate(data) {
  const pool = await getPool();
  const id = genId();
  const countResult = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskTemplates');
  const taskCode = data.taskCode ? String(data.taskCode).slice(0, 20) : genCode('TPL', countResult.recordset[0].c + 1);
  const runDays = data.runDays === undefined || data.runDays === null || data.runDays === '' ? null : parseRunDays(data.runDays).join(',');
  const dueTime = data.dueTime ? parseHHmm(data.dueTime).text : null;
  const assigneeUserIds = Array.isArray(data.assigneeUserIds) && data.assigneeUserIds.length ? JSON.stringify(data.assigneeUserIds) : null;

  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskCode', sql.VarChar, taskCode)
    .input('name', sql.NVarChar, data.name)
    .input('description', sql.NVarChar, data.description || '')
    .input('category', sql.VarChar, data.category || 'GENERAL')
    .input('department', sql.VarChar, data.department || 'OPERATIONS')
    .input('frequency', sql.VarChar, data.frequency || 'ONE_TIME')
    .input('customCron', sql.NVarChar, data.customCron || null)
    .input('slaHours', sql.Int, data.slaHours || 48)
    .input('tatHours', sql.Int, data.tatHours || 24)
    .input('priority', sql.VarChar, data.priority || 'MEDIUM')
    .input('targetType', sql.VarChar, data.targetType || 'NUMERIC')
    .input('defaultTarget', sql.Decimal(18, 2), data.defaultTarget || 0)
    .input('expectedOutput', sql.NVarChar, data.expectedOutput || '')
    .input('reviewerId', sql.VarChar, data.reviewerId || null)
    .input('assigneeRole', sql.VarChar, data.assigneeRole || 'brand_manager')
    .input('activities', sql.NVarChar(sql.MAX), JSON.stringify(data.activities || []))
    .input('subTaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.subTaskDefinitions || []))
    .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags || []))
    .input('isActive', sql.Bit, data.isActive !== false ? 1 : 0)
    .input('reviewRequired', sql.Bit, data.reviewRequired === false ? 0 : 1)
    .input('criticalityScore', sql.Int, Math.min(10, Math.max(1, parseInt(data.criticalityScore, 10) || 5)))
    .input('estMinutes', sql.Int, Math.max(1, parseInt(data.estimatedExecutionMinutes, 10) || 60))
    .input('createdBy', sql.VarChar, data.createdBy || null)
    .input('autoAssign', sql.Bit, data.autoAssign ? 1 : 0)
    .input('dueTime', sql.VarChar, dueTime)
    .input('runDays', sql.VarChar, runDays)
    .input('assigneeUserIds', sql.NVarChar(sql.MAX), assigneeUserIds)
    .input('brandMode', sql.VarChar, data.brandMode === 'CHECKLIST' ? 'CHECKLIST' : 'NONE')
    .query(`
      INSERT INTO PemsTaskTemplates
        (Id, TaskCode, Name, Description, Category, Department, Frequency, CustomCron,
         SLAHours, TATHours, Priority, TargetType, DefaultTarget, ExpectedOutput,
         ReviewerId, AssigneeRole, Activities, SubTaskDefinitions, Tags, IsActive,
         ReviewRequired, CriticalityScore, EstimatedExecutionMinutes, CreatedBy,
         AutoAssign, DueTime, RunDays, AssigneeUserIds, BrandMode)
      VALUES
        (@id, @taskCode, @name, @description, @category, @department, @frequency, @customCron,
         @slaHours, @tatHours, @priority, @targetType, @defaultTarget, @expectedOutput,
         @reviewerId, @assigneeRole, @activities, @subTaskDefinitions, @tags, @isActive,
         @reviewRequired, @criticalityScore, @estMinutes, @createdBy,
         @autoAssign, @dueTime, @runDays, @assigneeUserIds, @brandMode)
    `);

  return { id, taskCode };
}

async function getTemplates(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.category) { where += ' AND Category = @category'; req.input('category', sql.VarChar, filters.category); }
  if (filters.frequency) { where += ' AND Frequency = @frequency'; req.input('frequency', sql.VarChar, filters.frequency); }
  if (filters.search) { where += ' AND (Name LIKE @search OR Description LIKE @search OR TaskCode LIKE @search)'; req.input('search', sql.NVarChar, `%${filters.search}%`); }
  if (filters.isActive !== undefined) { where += ' AND IsActive = @isActive'; req.input('isActive', sql.Bit, filters.isActive ? 1 : 0); }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 25;
  const offset = (page - 1) * limit;

  const countResult = await req.query(`SELECT COUNT(*) as total FROM PemsTaskTemplates ${where}`);
  const total = countResult.recordset[0].total;

  const dataReq = pool.request();
  if (filters.category) dataReq.input('category', sql.VarChar, filters.category);
  if (filters.frequency) dataReq.input('frequency', sql.VarChar, filters.frequency);
  if (filters.search) dataReq.input('search', sql.NVarChar, `%${filters.search}%`);
  if (filters.isActive !== undefined) dataReq.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
  dataReq.input('offset', sql.Int, offset);
  dataReq.input('limit', sql.Int, limit);

  const result = await dataReq.query(`
    SELECT * FROM PemsTaskTemplates ${where}
    ORDER BY CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const templates = result.recordset.map(t => ({
    ...t,
    Activities: safeParse(t.Activities, []),
    SubTaskDefinitions: safeParse(t.SubTaskDefinitions, []),
    Tags: safeParse(t.Tags, []),
    AssigneeUserIds: safeParse(t.AssigneeUserIds, []),
  }));

  return { templates, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Company-wide template summary. Computed on the full table, never on a
 * paginated subset — the library page must not present filtered counts as
 * authoritative totals.
 */
async function getTemplateSummary() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS scheduled
    FROM PemsTaskTemplates
  `);
  // SOP coverage needs the JSON length, which SQL Server cannot count cheaply —
  // do it in JS over the compact projection rather than pulling every column.
  const sop = await pool.request().query(`
    SELECT
      SUM(CASE WHEN SubTaskDefinitions IS NOT NULL AND LEN(SubTaskDefinitions) > 4 AND SubTaskDefinitions <> '[]' THEN 1 ELSE 0 END) AS withSop
    FROM PemsTaskTemplates
  `);
  const auto = await pool.request().query(`
    SELECT SUM(CASE WHEN AutoAssign = 1 THEN 1 ELSE 0 END) AS automatic
    FROM PemsTaskTemplates
  `);
  const row = r.recordset[0] || {};
  return {
    total: Number(row.total) || 0,
    active: Number(row.active) || 0,
    scheduled: Number(row.scheduled) || 0,
    withSop: Number(sop.recordset[0]?.withSop) || 0,
    automatic: Number(auto.recordset[0]?.automatic) || 0,
  };
}

async function getTemplateById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM PemsTaskTemplates WHERE Id = @id');
  const t = result.recordset[0];
  if (!t) return null;
  return { ...t, Activities: safeParse(t.Activities, []), SubTaskDefinitions: safeParse(t.SubTaskDefinitions, []), Tags: safeParse(t.Tags, []), AssigneeUserIds: safeParse(t.AssigneeUserIds, []) };
}

async function updateTemplate(id, data) {
  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('id', sql.VarChar, id);

  const fields = ['Name', 'Description', 'Category', 'Department', 'Frequency', 'CustomCron', 'Priority', 'TargetType', 'ExpectedOutput', 'ReviewerId', 'AssigneeRole'];
  fields.forEach(f => {
    const key = f.charAt(0).toLowerCase() + f.slice(1);
    if (data[key] !== undefined) {
      sets.push(`${f} = @${f}`);
      req.input(f, sql.NVarChar, data[key] === null ? null : String(data[key]));
    }
  });
  // Typed columns (ints / decimals / bits) — never coerce these through NVarChar
  const intFields = { SLAHours: 'slaHours', TATHours: 'tatHours', CriticalityScore: 'criticalityScore', EstimatedExecutionMinutes: 'estimatedExecutionMinutes' };
  Object.entries(intFields).forEach(([col, key]) => {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      let v = parseInt(data[key], 10); if (Number.isNaN(v)) return;
      if (col === 'CriticalityScore') v = Math.min(10, Math.max(1, v));
      sets.push(`${col} = @${col}`); req.input(col, sql.Int, v);
    }
  });
  if (data.defaultTarget !== undefined && data.defaultTarget !== null && data.defaultTarget !== '') {
    sets.push('DefaultTarget = @DefaultTarget'); req.input('DefaultTarget', sql.Decimal(18, 2), Number(data.defaultTarget) || 0);
  }
  if (data.autoAssign !== undefined) { sets.push('AutoAssign = @AutoAssign'); req.input('AutoAssign', sql.Bit, data.autoAssign ? 1 : 0); }
  if (data.brandMode !== undefined) { sets.push('BrandMode = @BrandMode'); req.input('BrandMode', sql.VarChar, data.brandMode === 'CHECKLIST' ? 'CHECKLIST' : 'NONE'); }
  if (data.dueTime !== undefined) { sets.push('DueTime = @DueTime'); req.input('DueTime', sql.VarChar, data.dueTime ? parseHHmm(data.dueTime).text : null); }
  if (data.runDays !== undefined) { sets.push('RunDays = @RunDays'); req.input('RunDays', sql.VarChar, data.runDays === null || data.runDays === '' ? null : parseRunDays(data.runDays).join(',')); }
  if (data.assigneeUserIds !== undefined) {
    const ids = Array.isArray(data.assigneeUserIds) ? data.assigneeUserIds.filter(Boolean) : [];
    sets.push('AssigneeUserIds = @AssigneeUserIds'); req.input('AssigneeUserIds', sql.NVarChar(sql.MAX), ids.length ? JSON.stringify(ids) : null);
  }
  ['isActive', 'reviewRequired'].forEach(key => {
    if (data[key] !== undefined) {
      const col = key.charAt(0).toUpperCase() + key.slice(1);
      sets.push(`${col} = @${col}`); req.input(col, sql.Bit, data[key] ? 1 : 0);
    }
  });

  if (data.activities) { sets.push('Activities = @Activities'); req.input('Activities', sql.NVarChar(sql.MAX), JSON.stringify(data.activities)); }
  if (data.subTaskDefinitions) { sets.push('SubTaskDefinitions = @SubTaskDefinitions'); req.input('SubTaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.subTaskDefinitions)); }
  if (data.tags) { sets.push('Tags = @Tags'); req.input('Tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags)); }

  if (sets.length === 0) return false;
  sets.push('UpdatedAt = dbo.GetEnvDate()');
  await req.query(`UPDATE PemsTaskTemplates SET ${sets.join(', ')} WHERE Id = @id`);
  return true;
}

async function deleteTemplate(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id).query('DELETE FROM PemsTaskTemplates WHERE Id = @id');
}

// ═══════════════════════════════════════════════════════
// TASK INSTANCES
// ═══════════════════════════════════════════════════════

async function createInstance(data) {
  return withTransaction(async (tx) => {
  const pool = tx;
  const id = genId();
  const countResult = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskInstances');
  const instanceCode = genCode('TASK', countResult.recordset[0].c + 1);
  const now = new Date();
  const dueDate = data.dueDate || getNextDueDate(data.frequency || 'ONE_TIME');

  // Resolve template defaults (department, SOP) once up-front.
  // Guard against missing templateId so programmatic callers (ruleset engine,
  // integrations) can create ad-hoc tasks without a pre-existing template.
  let tplRow = null;
  if (data.templateId) {
    const tplResult = await pool.request().input('tplId', sql.VarChar, data.templateId)
      .query(`SELECT Department, SubTaskDefinitions FROM PemsTaskTemplates${taskInstanceSnapshot.viewPinningEnabled() ? ' WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE Id = @tplId`);
    tplRow = tplResult.recordset[0];
  }
  const department = data.department || tplRow?.Department || 'Operations';
  const viewPin = await taskInstanceSnapshot.resolveViewPin(pool, data.templateId);

  // Resolve sellerName if not provided
  let sellerName = data.sellerName || '';
  if (!sellerName && data.sellerId) {
    try {
      const sn = await pool.request().input('sid', sql.VarChar, data.sellerId)
        .query('SELECT TOP 1 Name FROM Sellers WHERE Id = @sid');
      sellerName = sn.recordset[0]?.Name || '';
    } catch (_) { /* best effort */ }
  }

  await pool.request()
    .input('id', sql.VarChar, id)
    .input('instanceCode', sql.VarChar, instanceCode)
    .input('templateId', sql.VarChar, data.templateId)
    .input('sellerId', sql.VarChar, data.sellerId || null)
    .input('sellerName', sql.NVarChar, sellerName || '')
    .input('assignedTo', sql.VarChar, data.assignedTo || null)
    .input('assigneeName', sql.NVarChar, data.assigneeName || '')
    .input('reviewerId', sql.VarChar, data.reviewerId || null)
    .input('reviewerName', sql.NVarChar, data.reviewerName || '')
    .input('department', sql.NVarChar, department)
    .input('status', sql.VarChar, data.status || 'DRAFT')
    .input('reviewStatus', sql.VarChar, 'NOT_REVIEWED')
    .input('frequency', sql.VarChar, data.frequency || 'ONE_TIME')
    .input('title', sql.NVarChar, data.title || data.name || '')
    .input('description', sql.NVarChar, data.description || '')
    .input('priority', sql.VarChar, data.priority || 'MEDIUM')
    .input('target', sql.Decimal(18, 2), data.target || 0)
    .input('achievement', sql.Decimal(18, 2), 0)
    .input('slaStatus', sql.VarChar, 'WITHIN_SLA')
    .input('slaHours', sql.Int, data.slaHours || 48)
    .input('dueDate', sql.DateTime2, dueDate)
    .input('assignedAt', sql.DateTime2, data.status === 'ASSIGNED' || data.status === 'IN_PROGRESS' ? now : null)
    .input('attachments', sql.NVarChar(sql.MAX), JSON.stringify(data.attachments || []))
    .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags || []))
    .input('source', sql.NVarChar, data.source || 'MANUAL')
    .input('sourceId', sql.VarChar, data.sourceId || null)
    .input('sourceRef', sql.NVarChar, data.sourceRef || null)
    .input('asins', sql.NVarChar(sql.MAX), JSON.stringify(data.asins || data.ASINs || []))
    .input('category', sql.NVarChar, data.category || department)
    .input('viewDefinitionId', sql.VarChar, viewPin.viewDefinitionId)
    .input('viewDefinitionSnapshot', sql.NVarChar(sql.MAX), viewPin.snapshotJson)
    .query(`
      INSERT INTO PemsTaskInstances
        (Id, InstanceCode, TemplateId, SellerId, SellerName, AssignedTo, AssigneeName,
         ReviewerId, ReviewerName, Department, Status, ReviewStatus, Frequency, Title, Description,
         Priority, Target, Achievement, SLAStatus, SLAHours, DueDate, AssignedAt,
         Attachments, Tags, Source, SourceId, SourceRef, Asins, Category${viewPin.pinned ? ', ViewDefinitionId, ViewDefinitionSnapshot' : ''})
      VALUES
        (@id, @instanceCode, @templateId, @sellerId, @sellerName, @assignedTo, @assigneeName,
         @reviewerId, @reviewerName, @department, @status, @reviewStatus, @frequency, @title, @description,
         @priority, @target, @achievement, @slaStatus, @slaHours, @dueDate, @assignedAt,
         @attachments, @tags, @source, @sourceId, @sourceRef, @asins, @category${viewPin.pinned ? ', @viewDefinitionId, @viewDefinitionSnapshot' : ''})
    `);

  // Create subtasks from template definitions
  // Fetch template's SOP if subTaskDefinitions not provided in request
  // Snapshot mode uses the template SOP from the locked database row,
  // preventing caller-supplied step overrides for published task instances.
  let subTaskDefs = viewPin.pinned && data.templateId && tplRow
    ? safeParse(tplRow.SubTaskDefinitions, [])
    : data.subTaskDefinitions;
  if ((!subTaskDefs || subTaskDefs.length === 0) && data.templateId && tplRow?.SubTaskDefinitions) {
    subTaskDefs = safeParse(tplRow.SubTaskDefinitions, []);
  } else if ((!subTaskDefs || subTaskDefs.length === 0) && data.templateId) {
    const tplResult2 = await pool.request().input('tplId', sql.VarChar, data.templateId)
      .query('SELECT SubTaskDefinitions FROM PemsTaskTemplates WHERE Id = @tplId');
    const tplRow2 = tplResult2.recordset[0];
    if (tplRow2) subTaskDefs = safeParse(tplRow2.SubTaskDefinitions, []);
  }

  // Recurring routines: only the sub-tasks scheduled for this occurrence's date (e.g. Monday-only steps)
  if (data.occurrenceDate && subTaskDefs && subTaskDefs.length > 0) {
    subTaskDefs = filterSubTasksForDate(subTaskDefs, data.occurrenceDate);
  }

  if (subTaskDefs && subTaskDefs.length > 0) {
    for (let i = 0; i < subTaskDefs.length; i++) {
      const st = subTaskDefs[i];
      const stId = genId();
      const stCode = genCode('ST', i + 1);
      await pool.request()
        .input('id', sql.VarChar, stId)
        .input('taskInstanceId', sql.VarChar, id)
        .input('subTaskCode', sql.VarChar, stCode)
        .input('title', sql.NVarChar, st.title || st.name || `Sub Task ${i + 1}`)
        .input('description', sql.NVarChar, st.description || '')
        .input('status', sql.VarChar, 'PENDING')
        .input('expectedOutput', sql.NVarChar, st.expectedOutput || '')
        .input('sortOrder', sql.Int, i)
        .query(`
          INSERT INTO PemsSubTasks (Id, TaskInstanceId, SubTaskCode, Title, Description, Status, ExpectedOutput, SortOrder)
          VALUES (@id, @taskInstanceId, @subTaskCode, @title, @description, @status, @expectedOutput, @sortOrder)
        `);

      // Create activities for each subtask
      if (st.activities && st.activities.length > 0) {
        for (let j = 0; j < st.activities.length; j++) {
          const act = st.activities[j];
          const evidenceRequired = act.evidenceRequired === true ? 1 : 0;
          await pool.request()
            .input('id', sql.VarChar, genId())
            .input('subTaskId', sql.VarChar, stId)
            .input('taskInstanceId', sql.VarChar, id)
            .input('stepNo', sql.Int, j + 1)
            .input('title', sql.NVarChar, act.title || `Step ${j + 1}`)
            .input('instructions', sql.NVarChar, act.instructions || '')
            .input('expectedOutput', sql.NVarChar, act.expectedOutput || '')
            .input('supportDocuments', sql.NVarChar(sql.MAX), JSON.stringify(act.supportDocuments || []))
            .input('isMandatory', sql.Bit, act.isMandatory !== false ? 1 : 0)
            .input('evidenceRequired', sql.Bit, evidenceRequired)
            .query(`
              INSERT INTO PemsActivities (Id, SubTaskId, TaskInstanceId, StepNo, Title, Instructions, ExpectedOutput, SupportDocuments, IsMandatory, EvidenceRequired)
              VALUES (@id, @subTaskId, @taskInstanceId, @stepNo, @title, @instructions, @expectedOutput, @supportDocuments, @isMandatory, @evidenceRequired)
            `);
        }
      }
    }
  }

  // Brand checklist (multi-brand routines): one row per brand the assignee looks after
  if (Array.isArray(data.brands) && data.brands.length > 0) {
    for (let i = 0; i < data.brands.length; i++) {
      const b = data.brands[i];
      await pool.request()
        .input('id', sql.VarChar, genId())
        .input('taskInstanceId', sql.VarChar, id)
        .input('sellerId', sql.VarChar, String(b.id))
        .input('sellerName', sql.NVarChar, b.name || '')
        .input('sortOrder', sql.Int, i)
        .query(`INSERT INTO PemsTaskBrands (Id, TaskInstanceId, SellerId, SellerName, SortOrder)
                VALUES (@id, @taskInstanceId, @sellerId, @sellerName, @sortOrder)`);
    }
  }

  // Update SubTaskCount and ActivityCount on the instance
  const stCountResult = await pool.request().input('instId', sql.VarChar, id)
    .query('SELECT COUNT(*) as stCount FROM PemsSubTasks WHERE TaskInstanceId = @instId');
  const actCountResult = await pool.request().input('instId', sql.VarChar, id)
    .query('SELECT COUNT(*) as actCount FROM PemsActivities WHERE TaskInstanceId = @instId');
  const stCount = stCountResult.recordset[0]?.stCount || 0;
  const actCount = actCountResult.recordset[0]?.actCount || 0;
  await pool.request()
    .input('instId', sql.VarChar, id)
    .input('stCount', sql.Int, stCount)
    .input('actCount', sql.Int, actCount)
    .query('UPDATE PemsTaskInstances SET SubTaskCount = @stCount, ActivityCount = @actCount WHERE Id = @instId');

  // Audit log
  await writeAuditLog(id, 'CREATED', null, data.status || 'DRAFT', data.createdBy, data.assigneeName, 'Task instance created', tx);

  return { id, instanceCode };
  });
}

// ── Pagination & server-side filter helpers ──
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Accepts `a,b,c` or `['a','b','c']` and returns a clean, non-empty list. */
function splitList(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map(v => String(v).trim()).filter(Boolean);
}

/** Health band → inclusive score range. Mirrors calculateHealth()'s labels. */
const HEALTH_BANDS = {
  critical: [0, 49],
  attention: [50, 79],
  healthy: [80, 100],
};

/**
 * SQL mirror of `calculateHealth()` in src/modules/tasks/utils/taskHealth.js.
 * Kept in lockstep with that function: same penalty ladder, same thresholds, same
 * `||`-style zero-is-missing fallback for progress and achievement, and the same
 * "no due date costs 5" rule. The worst case subtracts exactly 100, so the JS
 * clamp to 0..100 is a no-op here and needs no SQL equivalent.
 *
 * The only intentional difference is `now`: the server uses dbo.GetEnvDate() so
 * the score is consistent with the `overdue` filter and stays correct for
 * scheduled/off-peak runs.
 */
function healthScoreSql(alias) {
  const i = alias;
  const progress = `COALESCE(NULLIF(${i}.WeightedProgressPct, 0), NULLIF(${i}.ProgressPct, 0), 0)`;
  const hoursToDue = `DATEDIFF(SECOND, dbo.GetEnvDate(), ${i}.DueDate) / 3600.0`;
  return `(
      100
      - CASE WHEN ${progress} < 25 THEN 25 WHEN ${progress} < 50 THEN 15 WHEN ${progress} < 75 THEN 5 ELSE 0 END
      - CASE WHEN ${i}.DueDate IS NULL THEN 5
             WHEN DATEDIFF(SECOND, dbo.GetEnvDate(), ${i}.DueDate) < 0 THEN 25
             WHEN ${hoursToDue} < 12 THEN 20
             WHEN ${hoursToDue} < 24 THEN 12
             WHEN ${hoursToDue} < 48 THEN 5
             ELSE 0 END
      - CASE ${i}.SLAStatus WHEN 'BREACHED' THEN 20 WHEN 'AT_RISK' THEN 10 ELSE 0 END
      - CASE WHEN ISNULL(${i}.Target, 0) > 0
             THEN CASE WHEN ISNULL(${i}.AchievementPct, 0) < 30 THEN 15
                       WHEN ISNULL(${i}.AchievementPct, 0) < 60 THEN 8
                       WHEN ISNULL(${i}.AchievementPct, 0) < 80 THEN 3
                       ELSE 0 END
             ELSE 0 END
      - CASE WHEN ISNULL(${i}.ReworkCount, 0) > 0
             THEN CASE WHEN ISNULL(${i}.ReworkCount, 0) * 5 > 15 THEN 15 ELSE ISNULL(${i}.ReworkCount, 0) * 5 END
             ELSE 0 END
    )`;
}

async function getInstances(filters = {}, requester = null) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.status && filters.status.includes(',')) { where += " AND ',' + @status + ',' LIKE '%,' + i.Status + ',%'"; req.input('status', sql.VarChar, filters.status); }
  else if (filters.status) { where += ' AND i.Status = @status'; req.input('status', sql.VarChar, filters.status); }

  // ✅ Seller-scope enforcement: restricted (non-global) users may only list
  // instances within their assigned sellers. An explicitly requested sellerId
  // outside that scope yields an empty set, never another seller's data.
  // NOTE: params are collected (not bound here) because the WHERE fragment is
  // shared by BOTH the count and the data queries, which each use their own
  // request object — binding on a single request caused
  // "Must declare the scalar variable" errors (and would leak scope on the
  // other). Bind order matters: applyFilterInputs runs first, scope params
  // are re-applied right after on each request.
  const requestedSellerIds = filters.sellerId && filters.sellerId !== 'all'
    ? String(filters.sellerId).split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const requesterRole = requester?.role?.name || requester?.role || '';
  // No requester (internal jobs) → no scope applied; the HTTP controller
  // always passes req.user, which is what the scoping below protects.
  const sellerScope = { clause: '', params: [] };
  const bindSellerEquality = (value) => {
    // applyFilterInputs already declares @sellerId from raw filters; re-input
    // with the (validated) value to keep one code path.
    sellerScope.params.push(['sellerId', value]);
    sellerScope.clause = ' AND i.SellerId = @sellerId';
  };
  const bindSellerInList = (values) => {
    sellerScope.params.push(...values.map((v, idx) => [`scopeSeller_${idx}`, v]));
    const placeholders = values.map((_v, idx) => `@scopeSeller_${idx}`).join(',');
    sellerScope.clause = ` AND i.SellerId IN (${placeholders})`;
  };

  if (!requester || isGlobalUserRole(requesterRole)) {
    if (requestedSellerIds.length === 1) bindSellerEquality(requestedSellerIds[0]);
    else if (requestedSellerIds.length > 1) bindSellerInList(requestedSellerIds);
  } else {
    const allowed = (requester?.assignedSellers || [])
      .map(s => (typeof s === 'string' ? s : s?._id || s?.Id || s)?.toString())
      .filter(Boolean);
    const effective = requestedSellerIds.length > 0
      ? requestedSellerIds.filter(id => allowed.includes(id))
      : allowed;
    if (effective.length === 1) bindSellerEquality(effective[0]);
    else if (effective.length > 1) bindSellerInList(effective);
    else sellerScope.clause = ' AND 1=0';

    // Brand-less work (daily routines span all of a person's brands, so SellerId is NULL) must stay visible to
    // the person it is assigned to / reviewed by — never to anyone else. Only when no brand filter was requested.
    const meId = requester?.Id || requester?._id || requester?.id;
    if (meId && requestedSellerIds.length === 0) {
      sellerScope.params.push(['scopeMe', String(meId)]);
      const own = '(i.SellerId IS NULL AND (i.AssignedTo = @scopeMe OR i.ReviewerId = @scopeMe))';
      sellerScope.clause = sellerScope.clause === ' AND 1=0'
        ? ` AND ${own}`
        : ` AND ((${sellerScope.clause.replace(/^ AND /, '')}) OR ${own})`;
    }
  }
  where += sellerScope.clause;
  if (filters.assignedTo) { where += ' AND i.AssignedTo = @assignedTo'; req.input('assignedTo', sql.VarChar, filters.assignedTo); }
  if (filters.reviewerId) { where += ' AND i.ReviewerId = @reviewerId'; req.input('reviewerId', sql.VarChar, filters.reviewerId); }
  if (filters.priority) { where += ' AND i.Priority = @priority'; req.input('priority', sql.VarChar, filters.priority); }
  if (filters.slaStatus) { where += ' AND i.SLAStatus = @slaStatus'; req.input('slaStatus', sql.VarChar, filters.slaStatus); }
  if (filters.reviewStatus) { where += ' AND i.ReviewStatus = @reviewStatus'; req.input('reviewStatus', sql.VarChar, filters.reviewStatus); }
  if (filters.dueBefore) { where += ' AND i.DueDate <= @dueBefore'; req.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore)); }
  if (filters.dueAfter) { where += ' AND i.DueDate >= @dueAfter'; req.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter)); }
  if (filters.search) { where += ' AND (i.Title LIKE @search OR i.InstanceCode LIKE @search OR i.SellerName LIKE @search)'; req.input('search', sql.NVarChar, `%${filters.search}%`); }
  if (filters.templateId) { where += ' AND i.TemplateId = @templateId'; req.input('templateId', sql.VarChar, filters.templateId); }
  if (filters.department) { where += ' AND i.Department = @department'; req.input('department', sql.NVarChar, filters.department); }
  if (filters.frequency) { where += ' AND i.Frequency = @frequency'; req.input('frequency', sql.VarChar, filters.frequency); }
  if (filters.source) { where += ' AND i.Source = @source'; req.input('source', sql.NVarChar, filters.source); }
  if (filters.sourceId) { where += ' AND i.SourceId = @sourceId'; req.input('sourceId', sql.VarChar, filters.sourceId); }
  if (filters.isAutomated === 'true' || filters.isAutomated === true) { where += " AND i.Source = 'RULESET'"; }
  if (filters.overdue === 'true' || filters.overdue === true) { where += ' AND i.DueDate IS NOT NULL AND i.DueDate < dbo.GetEnvDate()'; }
  if (filters.dueToday === 'true' || filters.dueToday === true) { where += ' AND i.DueDate IS NOT NULL AND CAST(i.DueDate AS DATE) = CAST(dbo.GetEnvDate() AS DATE)'; }
  if (filters.category) { where += ' AND (i.Category = @cat OR i.Department = @cat)'; req.input('cat', sql.NVarChar, filters.category); }

  // ── Server-side filters (previously applied client-side, which only ever
  //    saw one page of rows and therefore returned wrong/empty results).
  //    `excludeStatuses` powers the "To do" view.
  //    These params are collected and re-declared on the count and data
  //    requests below, for the same reason sellerScope does: the WHERE text is
  //    shared by both queries but each runs on its own mssql request object.
  const sharedParams = [];
  const excluded = splitList(filters.excludeStatuses);
  if (excluded.length) {
    excluded.forEach((st, idx) => {
      where += ` AND i.Status <> @exSt${idx}`;
      sharedParams.push([`exSt${idx}`, sql.VarChar, st]);
    });
  }
  // `categories` (multi) powers the disputes filter: Category IN (…) OR Department IN (…).
  const categories = splitList(filters.categories);
  if (categories.length) {
    const ph = categories.map((c, idx) => `@cat${idx}`).join(',');
    where += ` AND (i.Category IN (${ph}) OR i.Department IN (${ph}))`;
    categories.forEach((c, idx) => sharedParams.push([`cat${idx}`, sql.NVarChar, c]));
  }
  // `health` is the server-side equivalent of calculateHealth()'s score bands.
  // Inlined as literals, so it needs no bound params.
  if (HEALTH_BANDS[filters.health]) {
    where += ` AND ${healthScoreSql('i')} BETWEEN ${HEALTH_BANDS[filters.health][0]} AND ${HEALTH_BANDS[filters.health][1]}`;
  }
  const bindShared = (request) => sharedParams.forEach(([n, t, v]) => request.input(n, t, v));

  const page = Math.max(1, parseInt(filters.page) || 1);
  // Clamp the page size: an unbounded `limit` turns a paginated endpoint into
  // a full-table dump.
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(filters.limit) || DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy || 'CreatedAt';
  const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const allowedSorts = ['CreatedAt', 'DueDate', 'Priority', 'Status', 'AchievementPct', 'SLAStatus', 'InstanceCode', 'Department', 'Frequency', 'SubmittedAt', 'UpdatedAt', 'ReviewedAt'];
  const sortCol = allowedSorts.includes(sortBy) ? sortBy : 'CreatedAt';

  // ── Rule tasks (automation Actions) ──
  // These are prepended above the paged instances — that "automation first"
  // ordering is a deliberate contract, so the page slice is computed across
  // both sources instead of appending an unbounded Action list to every page
  // (which used to make a "25 per page" page return 25+N rows and left `total`
  // inconsistent with what the caller actually received).
  const wantsRuleTasks = filters.includeRuleTasks === 'true' || filters.includeRuleTasks === true;
  let ruleTasks = [];
  let ruleTotal = 0;
  let instSkip = offset;
  let instTake = limit;

  if (wantsRuleTasks) {
    const ruleReq = pool.request();
    let ruleWhere = "WHERE a.Status IN ('PENDING','IN_PROGRESS') AND a.Type = 'automated'";

    // Seller scope for ruleset tasks. This used to be applied only when the
    // caller explicitly passed ?sellerId=, which meant a restricted user with no
    // seller filter received every seller's automated actions. It also compared
    // a raw, possibly comma-joined filter with '=', so a multi-seller request
    // matched nothing. Both go through the same canonical scope as the
    // instance query below.
    const ruleScope = resolveSellerScope(requester, filters.sellerId);
    const { clause: ruleScopeClause, params: ruleScopeParams } =
      buildScopeClause(ruleScope, 'a', { hasReviewer: false });
    ruleWhere += ruleScopeClause;
    ruleScopeParams.forEach(([name, value]) => ruleReq.input(name, sql.VarChar, value));

    if (filters.priority) { ruleWhere += ' AND a.Priority = @rulePriority'; ruleReq.input('rulePriority', sql.VarChar, filters.priority); }
    if (filters.search) { ruleWhere += ' AND a.Title LIKE @ruleSearch'; ruleReq.input('ruleSearch', sql.NVarChar, `%${filters.search}%`); }
    if (filters.overdue === 'true' || filters.overdue === true) ruleWhere += ' AND a.DueDate IS NOT NULL AND a.DueDate < dbo.GetEnvDate()';
    if (filters.dueAfter) { ruleWhere += ' AND a.DueDate >= @ruleDueAfter'; ruleReq.input('ruleDueAfter', sql.DateTime2, new Date(filters.dueAfter)); }
    if (filters.dueBefore) { ruleWhere += ' AND a.DueDate <= @ruleDueBefore'; ruleReq.input('ruleDueBefore', sql.DateTime2, new Date(filters.dueBefore)); }
    // Action statuses map onto the instance status vocabulary (see the projection below).
    const ruleExcluded = excluded.map(s => (s === 'ASSIGNED' ? 'PENDING' : s));
    ruleExcluded.forEach((st, idx) => { ruleWhere += ` AND a.Status <> @ruleExSt${idx}`; ruleReq.input(`ruleExSt${idx}`, sql.VarChar, st); });
    if (categories.length) {
      const ph = categories.map((c, idx) => `@ruleCat${idx}`).join(',');
      ruleWhere += ` AND a.Category IN (${ph})`;
      categories.forEach((c, idx) => ruleReq.input(`ruleCat${idx}`, sql.NVarChar, c));
    }
    // Mirrors calculateHealth() applied to the projected rule-task row
    // (0% progress, no target, no rework, SLA within): progress costs 25 and
    // the due-date ladder applies. Keeps the band filter consistent with the
    // score the caller renders for these rows.
    if (HEALTH_BANDS[filters.health]) {
      const [lo, hi] = HEALTH_BANDS[filters.health];
      const hrs = 'DATEDIFF(SECOND, dbo.GetEnvDate(), a.DueDate) / 3600.0';
      ruleWhere += ` AND (100 - 25 - CASE WHEN a.DueDate IS NULL THEN 5
            WHEN DATEDIFF(SECOND, dbo.GetEnvDate(), a.DueDate) < 0 THEN 25
            WHEN ${hrs} < 12 THEN 20 WHEN ${hrs} < 24 THEN 12 WHEN ${hrs} < 48 THEN 5
            ELSE 0 END) BETWEEN ${lo} AND ${hi}`;
    }

    try {
      const ruleCountReq = pool.request();
      // Re-declare the bound params on the count request; mssql requests are
      // independent objects, exactly as for sellerScope above.
      ruleScopeParams.forEach(([name, value]) => ruleCountReq.input(name, sql.VarChar, value));
      if (filters.priority) ruleCountReq.input('rulePriority', sql.VarChar, filters.priority);
      if (filters.search) ruleCountReq.input('ruleSearch', sql.NVarChar, `%${filters.search}%`);
      if (filters.dueAfter) ruleCountReq.input('ruleDueAfter', sql.DateTime2, new Date(filters.dueAfter));
      if (filters.dueBefore) ruleCountReq.input('ruleDueBefore', sql.DateTime2, new Date(filters.dueBefore));
      ruleExcluded.forEach((st, idx) => ruleCountReq.input(`ruleExSt${idx}`, sql.VarChar, st));
      categories.forEach((c, idx) => ruleCountReq.input(`ruleCat${idx}`, sql.NVarChar, c));
      const ruleCountResult = await ruleCountReq.query(`SELECT COUNT(*) as total FROM Actions a ${ruleWhere}`);
      ruleTotal = ruleCountResult.recordset[0].total || 0;

      // Page slice across the two sources: rule tasks fill the head of the page
      // while they last, then the instances continue underneath.
      const ruleSkip = Math.min(offset, ruleTotal);
      const ruleTake = Math.min(limit, ruleTotal - ruleSkip);
      instSkip = Math.max(0, offset - ruleTotal);
      instTake = limit - ruleTake;

      if (ruleTake > 0) {
        ruleReq.input('offset', sql.Int, ruleSkip);
        ruleReq.input('limit', sql.Int, ruleTake);
        const ruleResult = await ruleReq.query(`
          SELECT a.Id, a.Title, a.Status, a.Priority, a.SellerId, s.Name as SellerName,
                 a.AssignedTo, a.CreatedAt, a.DueDate, a.Description, a.Asins, a.SubTasks,
                 a.SubTaskProgress, a.Category as Department,
                 CONCAT(au.FirstName, ' ', au.LastName) AS AssigneeName
          FROM Actions a
          LEFT JOIN Sellers s ON a.SellerId = s.Id
          LEFT JOIN Users au ON au.Id = a.AssignedTo
          ${ruleWhere}
          ORDER BY a.CreatedAt DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
        ruleTasks = ruleResult.recordset.map(r => ({
          Id: `rule_${r.Id}`,
          InstanceCode: `[RULESET]`,
          Title: r.Title,
          Status: r.Status === 'PENDING' ? 'ASSIGNED' : 'IN_PROGRESS',
          Priority: (r.Priority || 'MEDIUM').toUpperCase(),
          SellerId: r.SellerId,
          SellerName: r.SellerName || '-',
          AssignedTo: r.AssignedTo,
          DueDate: r.DueDate,
          CreatedAt: r.CreatedAt,
          Description: r.Description,
          Department: r.Department || 'General',
          SLAStatus: 'WITHIN_SLA',
          AchievementPct: 0,
          subTasks: [],
          _isRuleTask: true,
          IsRuleTask: true,
        }));
      }
    } catch (e) { console.error('Failed to fetch rule tasks:', e.message); }
  }

  const countReq = pool.request();
  applyFilterInputs(countReq, filters);
  bindShared(countReq);
  sellerScope.params.forEach(([n, v]) => countReq.input(n, sql.VarChar, v));
  if (filters.dueBefore) countReq.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore));
  if (filters.dueAfter) countReq.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter));
  const countResult = await countReq.query(`SELECT COUNT(*) as total FROM PemsTaskInstances i ${where}`);
  const instanceTotal = countResult.recordset[0].total;
  const total = instanceTotal + ruleTotal;

  // Priority sorts by severity (not alphabetically); NULL submit times sort last.
  const orderExpr = sortCol === 'Priority'
    ? `CASE i.Priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END ${sortOrder === 'ASC' ? 'DESC' : 'ASC'}, i.CreatedAt DESC`
    : `i.${sortCol} ${sortOrder}`;
  // Optional per-row counts used by the review queue (evidence / sub-task progress).
  const reviewMetaSelect = filters.includeReviewMeta === 'true'
    ? `,
      (SELECT COUNT(*) FROM PemsEvidence e WHERE e.TaskInstanceId = i.Id) AS EvidenceCount,
      (SELECT COUNT(*) FROM PemsSubTasks st WHERE st.TaskInstanceId = i.Id) AS SubTaskTotal,
      (SELECT COUNT(*) FROM PemsSubTasks st WHERE st.TaskInstanceId = i.Id AND st.IsCompleted = 1) AS SubTaskDone`
    : '';

  let instances = [];
  if (instTake > 0) {
    const dataReq = pool.request();
    applyFilterInputs(dataReq, filters);
    bindShared(dataReq);
    sellerScope.params.forEach(([n, v]) => dataReq.input(n, sql.VarChar, v));
    if (filters.dueBefore) dataReq.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore));
    if (filters.dueAfter) dataReq.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter));
    dataReq.input('offset', sql.Int, instSkip);
    dataReq.input('limit', sql.Int, instTake);

  const result = await dataReq.query(`
    SELECT i.*, t.Name as TemplateName, t.TaskCode as TemplateCode, t.Category as TemplateCategory${reviewMetaSelect},
           CONCAT(au.FirstName, ' ', au.LastName) AS AssigneeFromUser
    FROM PemsTaskInstances i
    LEFT JOIN PemsTaskTemplates t ON i.TemplateId = t.Id
    LEFT JOIN Users au ON au.Id = i.AssignedTo
    ${where}
    ORDER BY ${orderExpr}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
    // AssigneeName is denormalised onto the row, and ruleset-created tasks were
    // written with it blank, so the list rendered them as "Unknown". Fall back to
    // the live Users record rather than migrating historical rows.
    instances = result.recordset.map(r => ({
      ...r,
      AssigneeName: r.AssigneeName || r.AssigneeFromUser || '',
      ReviewerName: r.ReviewerName || '',
      Tags: safeParse(r.Tags, []),
      Attachments: safeParse(r.Attachments, []),
    }));

    if (filters.includeSubtasks === 'true' && instances.length > 0) {
      const ids = instances.map(r => r.Id);
      const idPlaceholders = ids.map((_, i) => `@id${i}`).join(',');
      const req2 = pool.request();
      ids.forEach((id, i) => req2.input(`id${i}`, sql.VarChar, id));
      const subResult = await req2.query(`
        SELECT * FROM PemsSubTasks WHERE TaskInstanceId IN (${idPlaceholders}) ORDER BY SortOrder
      `);
      const subMap = {};
      subResult.recordset.forEach(st => {
        if (!subMap[st.TaskInstanceId]) subMap[st.TaskInstanceId] = [];
        subMap[st.TaskInstanceId].push(st);
      });
      instances.forEach(inst => { inst.subTasks = subMap[inst.Id] || []; });
    }
  }

  // Automation rows are pinned above the instances for this page slice.
  const merged = ruleTasks.length ? [...ruleTasks, ...instances] : instances;

  return { instances: merged, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Resolves the synthetic `rule_<actionId>` ids that the task list mints for
 * ruleset-generated work living in `Actions` rather than PemsTaskInstances.
 *
 * Without this, opening a rule task from the list 404s: the id is not a task
 * instance, and the detail queries below all key off PemsTaskInstances.
 */
async function getRuleTaskById(ruleActionId, requester = null) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, ruleActionId).query(`
    SELECT a.Id, a.Title, a.Status, a.Priority, a.SellerId, s.Name as SellerName,
           a.AssignedTo, a.CreatedAt, a.DueDate, a.Description, a.SubTasks,
           a.SubTaskProgress, a.Asins, a.Category
    FROM Actions a
    LEFT JOIN Sellers s ON a.SellerId = s.Id
    WHERE a.Id = @id AND a.Type = 'automated'
  `);
  const a = result.recordset[0];
  if (!a) return null;

  // Same seller rule as everything else, and ruleset tasks may be brand-less
  // (SellerId NULL) in which case only the assignee sees them — `Actions` has
  // no ReviewerId column, so there is no reviewer to widen it to.
  if (!canViewTaskByScope(requester, { SellerId: a.SellerId, AssignedTo: a.AssignedTo })) {
    return null;
  }

  return {
    Id: `rule_${a.Id}`,
    InstanceCode: '[RULESET]',
    Title: a.Title,
    Status: a.Status === 'PENDING' ? 'ASSIGNED' : 'IN_PROGRESS',
    Priority: (a.Priority || 'MEDIUM').toUpperCase(),
    SellerId: a.SellerId,
    SellerName: a.SellerName || '-',
    AssignedTo: a.AssignedTo,
    DueDate: a.DueDate,
    CreatedAt: a.CreatedAt,
    Description: a.Description,
    Department: a.Category || 'General',
    SLAStatus: 'WITHIN_SLA',
    AchievementPct: 0,
    Asins: safeParse(a.Asins, []),
    IsRuleTask: true,
    _isRuleTask: true,
    subTasks: safeParse(a.SubTasks, []),
    activities: [],
    brands: [],
    evidence: [],
    reviews: [],
  };
}

async function getInstanceById(id, requester = null) {
  const pool = await getPool();

  if (typeof id === 'string' && id.startsWith('rule_')) {
    return getRuleTaskById(id.slice('rule_'.length), requester);
  }

  const result = await pool.request().input('id', sql.VarChar, id).query(`
    SELECT i.*, t.Name as TemplateName, t.TaskCode as TemplateCode, t.Category as TemplateCategory,
           t.Activities as TemplateActivities, t.SubTaskDefinitions as TemplateSubTasks
    FROM PemsTaskInstances i
    LEFT JOIN PemsTaskTemplates t ON i.TemplateId = t.Id
    WHERE i.Id = @id
  `);
  const instance = result.recordset[0];
  if (!instance) return null;

  // Seller scope: a detail read must not be a way around the list scoping.
  if (!canViewTaskByScope(requester, instance)) return null;

  instance.Tags = safeParse(instance.Tags, []);
  instance.Attachments = safeParse(instance.Attachments, []);
  instance.TemplateActivities = safeParse(instance.TemplateActivities, []);
  instance.TemplateSubTasks = safeParse(instance.TemplateSubTasks, []);

  const subTasks = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT * FROM PemsSubTasks WHERE TaskInstanceId = @instanceId ORDER BY SortOrder');
  instance.subTasks = subTasks.recordset;

  if (instance.subTasks.length > 0) {
    const ids = instance.subTasks.map(s => s.Id);
    const placeholders = ids.map((_, i) => `@id${i}`).join(',');
    const req3 = pool.request();
    ids.forEach((id, i) => req3.input(`id${i}`, sql.VarChar, id));
    const acts = await req3.query(`SELECT * FROM PemsActivities WHERE SubTaskId IN (${placeholders}) ORDER BY StepNo`);
    const actMap = {};
    acts.recordset.forEach(a => {
      if (!actMap[a.SubTaskId]) actMap[a.SubTaskId] = [];
      actMap[a.SubTaskId].push({ ...a, SupportDocuments: safeParse(a.SupportDocuments, []) });
    });
    instance.subTasks.forEach(st => { st.activities = actMap[st.Id] || []; });
  }

  const brands = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT Id, SellerId, SellerName, IsCompleted, CompletedAt, Note FROM PemsTaskBrands WHERE TaskInstanceId = @instanceId ORDER BY SortOrder, SellerName');
  instance.brands = brands.recordset;

  const evidence = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT * FROM PemsEvidence WHERE TaskInstanceId = @instanceId ORDER BY UploadedAt DESC');
  instance.evidence = evidence.recordset;

  const reviews = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT * FROM PemsTaskReviews WHERE TaskInstanceId = @instanceId ORDER BY CreatedAt DESC');
  instance.reviews = reviews.recordset.map(r => ({ ...r, ReviewChecklist: safeParse(r.ReviewChecklist, []) }));

  const auditLogs = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT TOP 50 * FROM PemsTaskAuditLogs WHERE TaskInstanceId = @instanceId ORDER BY CreatedAt DESC');
  instance.auditLogs = auditLogs.recordset.map(l => ({ ...l, Metadata: safeParse(l.Metadata, null) }));

  // Comments are stored as COMMENT audit entries; fetched separately so a busy
  // audit trail can never push them out of the TOP 50 window above.
  const commentRows = await pool.request().input('instanceId', sql.VarChar, id)
    .query(`SELECT TOP 200 Id, ActorId, ActorName, Details, CreatedAt
            FROM PemsTaskAuditLogs WHERE TaskInstanceId = @instanceId AND Action = 'COMMENT'
            ORDER BY CreatedAt DESC`);
  instance.comments = commentRows.recordset;

  return instance;
}

// ═══════════════════════════════════════════════════════
// WORKFLOW TRANSITIONS
// ═══════════════════════════════════════════════════════

// Templates that require ASIN validation gate on submit/resubmit.
const ASIN_GATED_TEMPLATES = new Set([
  'DLY-001',  // Top ASIN Performance Monitoring (quality signals)
  'DLY-002',  // Buy Box Monitoring (buybox/pricing signals)
  'DLY-003',  // ASP Monitoring (price dispute signals)
  'DLY-010A', 'DLY-010B', // Listing Optimization (may have listing quality signals)
]);

/**
 * Check if a task instance's template requires the ASIN submission gate.
 */
async function checkAsinSubmissionGate(pool, taskInstanceId) {
  const task = await pool.request()
    .input('id', sql.VarChar, taskInstanceId)
    .query(`
      SELECT t.TaskCode, t.Category
      FROM PemsTaskInstances ti
      JOIN PemsTaskTemplates t ON ti.TemplateId = t.Id
      WHERE ti.Id = @id
    `);
  const tpl = task.recordset[0];
  if (!tpl || !ASIN_GATED_TEMPLATES.has(tpl.TaskCode)) return null;

  // Check for OPEN required ASINs
  const asins = await pool.request()
    .input('taskId', sql.VarChar, taskInstanceId)
    .query(`
      SELECT COUNT_BIG(*) AS unresolvedCount,
             COUNT_BIG(CASE WHEN Severity = 'critical' THEN 1 END) AS criticalCount,
             COUNT_BIG(CASE WHEN Severity = 'major' THEN 1 END) AS majorCount,
             COUNT_BIG(CASE WHEN Severity = 'minor' THEN 1 END) AS minorCount
      FROM PemsTaskAsins
      WHERE TaskInstanceId = @taskId AND Status = 'OPEN'
    `);

  const counts = asins.recordset[0];
  const unresolvedCount = Number(counts.unresolvedCount);
  if (unresolvedCount === 0) return null;

  // Get sample ASINs for the blocked response
  const samples = await pool.request()
    .input('taskId', sql.VarChar, taskInstanceId)
    .query(`
      SELECT TOP 5 AsinCode, SignalCode, SignalLabel, Severity, SellerName
      FROM PemsTaskAsins
      WHERE TaskInstanceId = @taskId AND Status = 'OPEN'
      ORDER BY CASE Severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 ELSE 2 END, AsinCode
    `);

  return {
    templateCode: tpl.TaskCode,
    category: tpl.Category,
    unresolvedCount,
    criticalCount: Number(counts.criticalCount),
    majorCount: Number(counts.majorCount),
    minorCount: Number(counts.minorCount),
    sampleAsins: samples.recordset,
  };
}

async function transitionStatus(taskInstanceId, toStatus, actorId, actorName, actorRole, details, tx) {
  // Only an atomic review transaction may approve or reject a task.
  // The direct /transition endpoint must never bypass review records.
  if (!tx && ['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(toStatus)) {
    const error = new Error('Review decisions must use the review endpoint');
    error.status = 403;
    throw error;
  }
  if (!tx && taskExecutionGates.strictGatesEnabled()) {
    return withTransaction((transaction) =>
      transitionStatus(taskInstanceId, toStatus, actorId, actorName, actorRole, details, transaction));
  }
  const pool = tx || (await getPool());
  const instanceResult = await pool.request()
    .input('id', sql.VarChar, taskInstanceId)
    .query(`SELECT Status, AssignedTo, AssigneeName, ReviewerId, ReviewerName, DueDate, SLAHours, Title
             FROM PemsTaskInstances ${tx && taskExecutionGates.strictGatesEnabled() ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE Id = @id`);
  const instance = instanceResult.recordset[0];
  if (!instance) throw new Error('Task instance not found');

  if (!canTransition(instance.Status, toStatus)) {
    throw new Error(`Invalid transition: ${instance.Status} → ${toStatus}`);
  }

  // ── ASIN Submission Gate ──
  // Gate SUBMITTED (from IN_PROGRESS) and RESUBMITTED (from REWORK)
  // for templates that have required ASIN signals.
  const isSubmitGate = (instance.Status === 'IN_PROGRESS' && toStatus === 'SUBMITTED');
  const isResubmitGate = (instance.Status === 'REWORK' && toStatus === 'RESUBMITTED');

  // Template activity and evidence gates cannot be bypassed by ASIN waivers.
  if ((isSubmitGate || isResubmitGate) && taskExecutionGates.strictGatesEnabled()) {
    await taskExecutionGates.assertSubmissionReady(pool, taskInstanceId);
  }

  if ((isSubmitGate || isResubmitGate) && !details?.waiveAsinGate) {
    const gate = await checkAsinSubmissionGate(pool, taskInstanceId);
    if (gate) {
      const gateError = new Error('ASIN_SUBMISSION_BLOCKED');
      gateError.blocked = true;
      gateError.gate = gate;
      gateError.message = `Submission blocked: ${gate.unresolvedCount} required ASIN(s) unresolved (${gate.criticalCount} critical, ${gate.majorCount} major, ${gate.minorCount} minor). Resolve or waive with reason.`;
      throw gateError;
    }
  }

  // Allow gate waive: details = { waiveAsinGate: true, waiveReason: '...' }
  if ((isSubmitGate || isResubmitGate) && details?.waiveAsinGate) {
    if (!details.waiveReason) {
      throw new Error('waiveReason required when waiving ASIN gate');
    }
    // Log the waive for audit
    await writeAuditLog(taskInstanceId, 'ASIN_GATE_WAIVED', null, null, actorId, actorName,
      `ASIN gate waived for ${toStatus}: ${details.waiveReason}`, tx);
  }

  const now = new Date();
  const timeFields = getTransitionTimestamps(instance.Status, toStatus, now);

  const sets = ['Status = @status', 'UpdatedAt = dbo.GetEnvDate()'];
  const req = pool.request().input('id', sql.VarChar, taskInstanceId).input('status', sql.VarChar, toStatus);

  Object.entries(timeFields).forEach(([field, val]) => {
    sets.push(`${field} = @${field}`);
    req.input(field, sql.DateTime2, val);
  });

  if (toStatus === 'REWORK') {
    sets.push('ReworkCount = ReworkCount + 1');
  }

  if (toStatus === 'REJECTED' || toStatus === 'REWORK') {
    sets.push('ReviewStatus = @reviewStatus');
    req.input('reviewStatus', sql.VarChar, 'REJECTED');
  }
  if (toStatus === 'APPROVED') {
    sets.push('ReviewStatus = @reviewStatus');
    req.input('reviewStatus', sql.VarChar, 'APPROVED');
  }
  if (toStatus === 'SUBMITTED') {
    sets.push('ReviewStatus = @reviewStatus');
    req.input('reviewStatus', sql.VarChar, 'PENDING_REVIEW');
    const submissionRemarks = typeof details === 'string' ? details : String(details?.submissionRemarks || details?.waiveReason || '');
    if (submissionRemarks && submissionRemarks.trim()) {
      sets.push('SubmissionRemarks = @submissionRemarks');
      req.input('submissionRemarks', sql.NVarChar(sql.MAX), submissionRemarks.trim());
    }
  }

  req.input('fromStatus', sql.VarChar, instance.Status);
  const changed = await req.query(`UPDATE PemsTaskInstances SET ${sets.join(', ')} WHERE Id = @id AND Status = @fromStatus`);
  if (Number(changed.rowsAffected?.[0] || 0) !== 1) {
    const error = new Error('Task status changed while processing this action. Refresh and retry.');
    error.status = 409;
    throw error;
  }

  await writeAuditLog(taskInstanceId, 'STATUS_CHANGED', instance.Status, toStatus, actorId, actorName, typeof details === 'string' ? details : JSON.stringify(details), tx);

  // ── Event Store (append-only) ──
  try {
    const eventTypeMap = {
      'ASSIGNED': eventStore.EVENT_TYPES.TASK_ASSIGNED,
      'ACCEPTED': eventStore.EVENT_TYPES.TASK_ACCEPTED,
      'IN_PROGRESS': eventStore.EVENT_TYPES.TASK_STARTED,
      'SUBMITTED': eventStore.EVENT_TYPES.TASK_SUBMITTED,
      'UNDER_REVIEW': eventStore.EVENT_TYPES.TASK_REVIEWED,
      'APPROVED': eventStore.EVENT_TYPES.TASK_APPROVED,
      'REJECTED': eventStore.EVENT_TYPES.TASK_REJECTED,
      'REWORK': eventStore.EVENT_TYPES.TASK_REWORKED,
      'CANCELLED': eventStore.EVENT_TYPES.TASK_CANCELLED,
      'ESCALATED': eventStore.EVENT_TYPES.TASK_ESCALATED,
    };
    const eventType = eventTypeMap[toStatus] || eventStore.EVENT_TYPES.TASK_UPDATED;
    await eventStore.append(eventType, taskInstanceId, {
      fromStatus: instance.Status,
      toStatus,
      actorId,
      actorName,
      details,
      assigneeId: instance.AssignedTo,
      reviewerId: instance.ReviewerId,
    });
  } catch (err) { logger.warn('Event store append error:', err.message); }

  // ── Event Bus Notification ──
  try {
    eventBus.emit(eventBus.EVENTS.TASK_TRANSITIONED, {
      taskInstanceId,
      fromStatus: instance.Status,
      toStatus,
      userId: actorId,
      actorName,
      assigneeId: instance.AssignedTo,
      reviewerId: instance.ReviewerId,
    });
  } catch (err) { logger.warn('Event bus error:', err.message); }

  return { success: true, from: instance.Status, to: toStatus };
}

/**
 * Bulk transition for a list of task ids.
 * Validates each task independently — non-transitionable / missing tasks are
 * skipped, not failed. Returns per-id results for the UI.
 */
async function bulkTransition(taskIds, toStatus, actorId, actorName, actorRole, details, requester = null) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) throw new Error('No task ids provided');
  if (!WORKFLOW_STATUSES[toStatus]) throw new Error(`Unknown status: ${toStatus}`);
  if (['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(toStatus)) {
    const error = new Error('Bulk review decisions must use /reviews/bulk');
    error.status = 403;
    throw error;
  }
  if (taskIds.length > 200) throw new Error('Too many tasks (max 200 per bulk operation)');

  const pool = await getPool();
  const updated = [];
  const skipped = [];

  // The full requester is required, not just {Id, role}: seller scope lives on
  // the user record (assignedSellers), so a stub would deny every restricted
  // user's tasks. Falls back to the stub only for internal callers.
  const actor = requester || { Id: actorId, role: actorRole };

  for (const id of taskIds) {
    try {
      const inst = await pool.request().input('id', sql.VarChar, id)
        .query('SELECT Id, Status, AssignedTo, ReviewerId, SellerId FROM PemsTaskInstances WHERE Id = @id');
      const row = inst.recordset[0];
      if (!row) { skipped.push({ id, reason: 'NOT_FOUND' }); continue; }
      if (!canTransitionTask(actor, row, toStatus)) {
        skipped.push({ id, reason: 'NO_ACCESS' });
        continue;
      }
      if (!canTransition(row.Status, toStatus)) {
        skipped.push({ id, reason: `INVALID_TRANSITION:${row.Status}->${toStatus}` });
        continue;
      }
      await transitionStatus(id, toStatus, actorId, actorName, actorRole, details);
      updated.push(id);
    } catch (err) {
      skipped.push({ id, reason: err.message || 'ERROR' });
    }
  }

  return { updated, skipped, updatedCount: updated.length, skippedCount: skipped.length };
}

// ═══════════════════════════════════════════════════════
// SUB TASKS
// ═══════════════════════════════════════════════════════

async function completeSubTask(subTaskId, actorId, actorName) {
  if (taskExecutionGates.strictGatesEnabled()) {
    return withTransaction(async (tx) => {
      await taskExecutionGates.lockChildParent(tx, 'phase', subTaskId);
      const phase = await taskExecutionGates.assertPhaseReady(tx, subTaskId);
      if (phase.alreadyCompleted) return { success: true, alreadyCompleted: true };
      const result = await tx.request().input('id', sql.VarChar, subTaskId)
        .query("UPDATE PemsSubTasks SET IsCompleted = 1, Status = 'COMPLETED', CompletedAt = dbo.GetEnvDate() WHERE Id = @id AND IsCompleted = 0");
      if (Number(result.rowsAffected?.[0] || 0) === 0) return { success: true, alreadyCompleted: true };
      const progress = await taskExecutionGates.reconcileTaskProgress(tx, phase.TaskInstanceId);
      await writeAuditLog(phase.TaskInstanceId, 'SUBTASK_COMPLETED', null, null, actorId, actorName, 'Subtask completed', tx);
      return { success: true, progress };
    });
  }
  return withTransaction(async (tx) => {
  const pool = tx;
  await pool.request()
    .input('id', sql.VarChar, subTaskId)
    .query("UPDATE PemsSubTasks SET IsCompleted = 1, Status = 'COMPLETED', CompletedAt = dbo.GetEnvDate() WHERE Id = @id");

  const st = await pool.request().input('id', sql.VarChar, subTaskId).query('SELECT TaskInstanceId FROM PemsSubTasks WHERE Id = @id');
  if (st.recordset[0]) {
    const instId = st.recordset[0].TaskInstanceId;
    const stCount = await pool.request().input('instId', sql.VarChar, instId)
      .query("SELECT COUNT(*) as total, SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) as done FROM PemsSubTasks WHERE TaskInstanceId = @instId");
    const total = stCount.recordset[0]?.total || 0;
    const done = stCount.recordset[0]?.done || 0;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const weightedProgress = await calculateWeightedProgress(instId);
    await pool.request()
      .input('instId', sql.VarChar, instId)
      .input('done', sql.Int, done)
      .input('pct', sql.Decimal(5, 2), progressPct)
      .input('wp', sql.Decimal(5, 2), weightedProgress)
      .query('UPDATE PemsTaskInstances SET CompletedSubTasks = @done, ProgressPct = @pct, WeightedProgressPct = @wp WHERE Id = @instId');
    await writeAuditLog(instId, 'SUBTASK_COMPLETED', null, null, actorId, actorName, 'Subtask completed', tx);
    eventBus.emit(eventBus.EVENTS.SUBTASK_COMPLETED, { taskInstanceId: instId, subTaskId, actorId, actorName });
  }
  });
}

/**
 * Tick / un-tick a brand on a multi-brand task (or all of them when brandRowId is omitted).
 * Only while the work is open — same window in which steps can be ticked.
 */
async function setBrandCheck(taskId, brandRowId, completed, actorId, note, tx = null) {
  if (!tx && taskExecutionGates.strictGatesEnabled()) {
    return withTransaction((transaction) =>
      setBrandCheck(taskId, brandRowId, completed, actorId, note, transaction));
  }
  const pool = tx || (await getPool());
  if (tx && taskExecutionGates.strictGatesEnabled()) {
    await taskExecutionGates.lockTaskForExecution(tx, taskId);
  }
  const task = (await pool.request().input('id', sql.VarChar, taskId)
    .query('SELECT Id, Status FROM PemsTaskInstances WHERE Id = @id')).recordset[0];
  if (!task) { const e = new Error('Task not found'); e.status = 404; throw e; }
  if (!['IN_PROGRESS', 'REWORK', 'ACCEPTED'].includes(task.Status)) {
    const e = new Error('Start the task before ticking brands'); e.status = 409; throw e;
  }
  const req = pool.request()
    .input('taskId', sql.VarChar, taskId)
    .input('done', sql.Bit, completed ? 1 : 0)
    .input('actor', sql.VarChar, actorId || null)
    .input('note', sql.NVarChar, note === undefined ? null : String(note).slice(0, 500));
  let where = 'TaskInstanceId = @taskId';
  if (brandRowId) { where += ' AND Id = @rowId'; req.input('rowId', sql.VarChar, brandRowId); }
  const res = await req.query(`
    UPDATE PemsTaskBrands
       SET IsCompleted = @done,
           CompletedAt = CASE WHEN @done = 1 THEN dbo.GetEnvDate() ELSE NULL END,
           CompletedBy = CASE WHEN @done = 1 THEN @actor ELSE NULL END,
           Note = COALESCE(@note, Note)
     WHERE ${where}`);
  if (brandRowId && !res.rowsAffected[0]) { const e = new Error('Brand not found on this task'); e.status = 404; throw e; }
  const counts = (await pool.request().input('taskId', sql.VarChar, taskId)
    .query('SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END), 0) AS done FROM PemsTaskBrands WHERE TaskInstanceId = @taskId')).recordset[0];
  if (tx && taskExecutionGates.strictGatesEnabled()) {
    await taskExecutionGates.reconcileTaskProgress(tx, taskId);
  }
  return { total: counts.total, done: counts.done };
}

async function completeActivity(activityId, actorId, actorName) {
  if (taskExecutionGates.strictGatesEnabled()) {
    return withTransaction(async (tx) => {
      await taskExecutionGates.lockChildParent(tx, 'activity', activityId);
      const activity = await taskExecutionGates.assertActivityReady(tx, activityId);
      if (activity.alreadyCompleted) return { success: true, alreadyCompleted: true };
      const change = await tx.request()
        .input('id', sql.VarChar, activityId)
        .input('actorId', sql.VarChar, actorId)
        .query("UPDATE PemsActivities SET IsCompleted = 1, CompletedAt = dbo.GetEnvDate(), CompletedBy = @actorId WHERE Id = @id AND IsCompleted = 0");
      if (Number(change.rowsAffected?.[0] || 0) === 0) return { success: true, alreadyCompleted: true };
      await taskExecutionGates.autoCompleteReadyPhase(tx, activity.SubTaskId, activity.TaskInstanceId);
      const progress = await taskExecutionGates.reconcileTaskProgress(tx, activity.TaskInstanceId);
      await writeAuditLog(activity.TaskInstanceId, 'ACTIVITY_COMPLETED', null, null, actorId, actorName, `Activity ${activityId} completed`, tx);
      return { success: true, progress };
    });
  }
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, activityId)
    .input('actorId', sql.VarChar, actorId)
    .query("UPDATE PemsActivities SET IsCompleted = 1, CompletedAt = dbo.GetEnvDate(), CompletedBy = @actorId WHERE Id = @id");
}

// ════════════════════════════════════════════════════════
// AFFECTED ASINS
// ═════════════════════════════════════════════════════════

// AFFECTED ASINS
// ══════════════════════════════════════════════════════════

async function getInstanceAsins(taskInstanceId, user) {
  const pool = await getPool();

  // Verify user can view this task (seller scope enforced)
  // Join with PemsTaskTemplates to get the TaskCode (template code)
  const taskCheck = await pool.request().input('id', sql.VarChar, taskInstanceId)
    .query(`
      SELECT ti.Id, ti.TemplateId, tt.TaskCode as TemplateCode
      FROM PemsTaskInstances ti
      LEFT JOIN PemsTaskTemplates tt ON tt.Id = ti.TemplateId
      WHERE ti.Id = @id
    `);
  if (!taskCheck.recordset.length) return null;

  const task = taskCheck.recordset[0];
  const isOosTask = task.TemplateCode === 'OOS-RECON-001';

  // For OOS-RECON-001 tasks, fetch RetailOps unavailable ASINs for assigned sellers
  if (isOosTask) {
    return await getOosAffectedAsins(taskInstanceId, pool);
  }

  // Get ASINs with seller grouping (generic task ASINs)
  const result = await pool.request().input('taskId', sql.VarChar, taskInstanceId).query(`
    SELECT pa.Id, pa.AsinCode, pa.SellerId, pa.SellerName,
           pa.SignalCode, pa.SignalLabel, pa.Severity,
           pa.NumericValue, pa.StringValue, pa.Remarks,
           pa.Status, pa.Resolution, pa.WaiveReason,
           pa.ResolvedAt, pa.ResolvedBy, pa.CreatedAt
    FROM PemsTaskAsins pa
    WHERE pa.TaskInstanceId = @taskId
    ORDER BY pa.SellerName, pa.Severity DESC, pa.SignalCode, pa.AsinCode
  `);

  // Group by seller for UI
  const bySeller = new Map();
  for (const row of result.recordset) {
    const key = row.SellerId;
    if (!bySeller.has(key)) {
      bySeller.set(key, {
        sellerId: row.SellerId,
        sellerName: row.SellerName,
        asins: [],
        counts: { critical: 0, major: 0, minor: 0, total: 0 }
      });
    }
    const seller = bySeller.get(key);
    seller.asins.push({
      id: row.Id,
      asinCode: row.AsinCode,
      signalCode: row.SignalCode,
      signalLabel: row.SignalLabel,
      severity: row.Severity,
      numericValue: row.NumericValue,
      stringValue: row.StringValue,
      remarks: row.Remarks,
      status: row.Status,
      resolution: row.Resolution,
      waiveReason: row.WaiveReason,
      resolvedAt: row.ResolvedAt,
      resolvedBy: row.ResolvedBy,
      createdAt: row.CreatedAt
    });
    if (row.Severity === 'critical') seller.counts.critical++;
    else if (row.Severity === 'major') seller.counts.major++;
    else seller.counts.minor++;
    seller.counts.total++;
  }

  return {
    taskInstanceId,
    sellers: [...bySeller.values()].sort((a, b) => a.sellerName.localeCompare(b.sellerName))
  };
}

async function getOosAffectedAsins(taskInstanceId, pool) {
  // Get task's assigned sellers from PemsTaskBrands
  const brandsResult = await pool.request().input('taskId', sql.VarChar, taskInstanceId).query(`
    SELECT ptb.SellerId, ptb.SellerName, ptb.SortOrder
    FROM PemsTaskBrands ptb
    WHERE ptb.TaskInstanceId = @taskId
    ORDER BY ptb.SortOrder
  `);

  const sellers = brandsResult.recordset;
  if (sellers.length === 0) {
    return { taskInstanceId, sellers: [] };
  }

  const sellerIds = sellers.map(s => s.SellerId);
  const placeholders = sellerIds.map((_, i) => `@sid${i}`).join(',');
  
  // Get all active ASINs for these sellers where RetailOps shows unavailable
  const request = pool.request();
  sellerIds.forEach((id, i) => request.input(`sid${i}`, sql.VarChar, id));
  
  const unavailableResult = await request.query(`
    SELECT 
      a.AsinCode,
      a.SellerId,
      s.Name as SellerName,
      a.Availability,
      a.AvailabilityStatus,
      a.StockLevel,
      a.LastScrapedAt,
      a.ScrapeStatus,
      a.Marketplace,
      a.Title as ProductTitle,
      a.SKU
    FROM Asins a
    INNER JOIN Sellers s ON s.Id = a.SellerId
    WHERE a.SellerId IN (${placeholders})
      AND a.Status = 'Active'
      AND (
        a.Availability = 'OutOfStock'
        OR LOWER(ISNULL(a.AvailabilityStatus, '')) LIKE '%unavailable%'
        OR LOWER(ISNULL(a.AvailabilityStatus, '')) LIKE '%out of stock%'
      )
    ORDER BY s.Name, a.AsinCode
  `);

  // Group by seller for UI
  const bySeller = new Map();
  for (const row of unavailableResult.recordset) {
    const key = row.SellerId;
    if (!bySeller.has(key)) {
      const sellerInfo = sellers.find(s => s.SellerId === key);
      bySeller.set(key, {
        sellerId: row.SellerId,
        sellerName: row.SellerName,
        asins: [],
        counts: { critical: 0, major: 0, minor: 0, total: 0, unavailable: 0 }
      });
    }
    const seller = bySeller.get(key);
    const isUnavailable = row.Availability === 'OutOfStock' || 
      (row.AvailabilityStatus && (row.AvailabilityStatus.toLowerCase().includes('unavailable') || row.AvailabilityStatus.toLowerCase().includes('out of stock')));
    
    seller.asins.push({
      id: `oos-${row.AsinCode}-${row.SellerId}`,
      asinCode: row.AsinCode,
      sku: row.SKU,
      productTitle: row.ProductTitle,
      signalCode: 'OOS',
      signalLabel: 'Out of Stock',
      severity: 'critical',
      numericValue: null,
      stringValue: row.AvailabilityStatus || row.Availability,
      remarks: '',
      status: 'OPEN',
      resolution: '',
      waiveReason: '',
      resolvedAt: null,
      resolvedBy: '',
      createdAt: row.LastScrapedAt,
      // OOS-specific fields
      retailOpsAvailability: row.Availability,
      retailOpsAvailabilityStatus: row.AvailabilityStatus,
      retailOpsStockLevel: row.StockLevel,
      retailOpsLastScrapedAt: row.LastScrapedAt,
      retailOpsScrapeStatus: row.ScrapeStatus,
      marketplace: row.Marketplace
    });
    if (isUnavailable) seller.counts.unavailable++;
    seller.counts.critical++;
    seller.counts.total++;
  }

  return {
    taskInstanceId,
    sellers: [...bySeller.values()].sort((a, b) => a.sellerName.localeCompare(b.sellerName))
  };
}

async function updateAsinRemarks(taskInstanceId, asinCode, sellerId, signalCode, remarks, resolution, waiveReason, actorId, actorName) {
  const pool = await getPool();

  // Verify access (same as other write ops)
  const task = await pool.request().input('id', sql.VarChar, taskInstanceId)
    .query('SELECT Id, AssignedTo, ReviewerId FROM PemsTaskInstances WHERE Id = @id');
  if (!task.recordset.length) throw new Error('Task not found');

  const { canActOnTask } = require('./pemsPolicy');
  if (!canActOnTask({ Id: actorId, role: { name: '' } }, task.recordset[0])) {
    throw new Error('You do not have permission to update this task');
  }

  const fields = [];
  const params = [
    ['taskId', taskInstanceId, sql.VarChar],
    ['asinCode', asinCode, sql.VarChar],
    ['sellerId', sellerId, sql.VarChar],
    ['signalCode', signalCode, sql.VarChar]
  ];

  if (remarks !== undefined) { fields.push('Remarks = @remarks'); params.push(['remarks', remarks, sql.NVarChar]); }
  if (resolution !== undefined) { fields.push('Resolution = @resolution'); params.push(['resolution', resolution, sql.VarChar]); }
  if (waiveReason !== undefined) { fields.push('WaiveReason = @waiveReason'); params.push(['waiveReason', waiveReason, sql.NVarChar]); }
  if (fields.length === 0) throw new Error('No fields to update');

  fields.push('UpdatedAt = dbo.GetEnvDate()');

  const request = pool.request();
  params.forEach(([name, value, type]) => request.input(name, type, value));
  request.input('actorId', sql.VarChar, actorId);
  request.input('actorName', sql.NVarChar, actorName);

  await request.query(`
    UPDATE PemsTaskAsins
    SET ${fields.join(', ')}
    WHERE TaskInstanceId = @taskId AND AsinCode = @asinCode AND SellerId = @sellerId AND SignalCode = @signalCode
  `);

  await writeAuditLog(taskInstanceId, 'ASIN_REMARKS_UPDATED', null, null, actorId, actorName, `Updated ASIN ${asinCode} (${signalCode})`);

  return { success: true };
}

async function resolveAsin(taskInstanceId, asinId, action, waiveReason, actorId, actorName) {
  const pool = await getPool();

  const task = await pool.request().input('id', sql.VarChar, taskInstanceId)
    .query('SELECT Id, AssignedTo, ReviewerId FROM PemsTaskInstances WHERE Id = @id');
  if (!task.recordset.length) throw new Error('Task not found');

  const { canActOnTask } = require('./pemsPolicy');
  if (!canActOnTask({ Id: actorId, role: { name: '' } }, task.recordset[0])) {
    throw new Error('You do not have permission to resolve ASINs on this task');
  }

  const request = pool.request()
    .input('taskId', sql.VarChar, taskInstanceId)
    .input('asinId', sql.VarChar, asinId)
    .input('actorId', sql.VarChar, actorId)
    .input('actorName', sql.NVarChar, actorName);

  if (action === 'resolve') {
    await request.query(`
      UPDATE PemsTaskAsins
      SET Status = 'RESOLVED', Resolution = 'Resolved', ResolvedAt = dbo.GetEnvDate(), ResolvedBy = @actorId, UpdatedAt = dbo.GetEnvDate()
      WHERE Id = @asinId AND TaskInstanceId = @taskId
    `);
  } else if (action === 'waive') {
    if (!waiveReason) throw new Error('waiveReason required when waiving');
    request.input('waiveReason', sql.NVarChar, waiveReason);
    await request.query(`
      UPDATE PemsTaskAsins
      SET Status = 'WAIVED', WaiveReason = @waiveReason, ResolvedAt = dbo.GetEnvDate(), ResolvedBy = @actorId, UpdatedAt = dbo.GetEnvDate()
      WHERE Id = @asinId AND TaskInstanceId = @taskId
    `);
  } else {
    throw new Error('Invalid action');
  }

  await writeAuditLog(taskInstanceId, 'ASIN_' + action.toUpperCase(), null, null, actorId, actorName, `ASIN ${asinId} ${action}d${waiveReason ? ': ' + waiveReason : ''}`);

  return { success: true };
}

// ════════════════════════════════════════════════════════
// EVIDENCE
// ═══════════════════════════════════════════════════════
// EVIDENCE
// ═══════════════════════════════════════════════════════

async function uploadEvidence(data) {
  const taskId = String(data?.taskInstanceId || '').trim();
  const fileName = String(data?.fileName || '').trim();
  const fileUrl = String(data?.fileUrl || '').trim();
  const activityId = data?.activityId || null;
  const subTaskId = data?.subTaskId || null;
  if (!taskId || !fileName || !fileUrl || !data?.uploadedBy) {
    const error = new Error('Task, evidence name, URL and authenticated uploader are required');
    error.status = 400;
    throw error;
  }
  if (String(data.fileType || 'FILE').toUpperCase() === 'LINK' && !/^https?:\/\//i.test(fileUrl)) {
    const error = new Error('Evidence links must use http or https');
    error.status = 400;
    throw error;
  }

  return withTransaction(async (tx) => {
    // Serialize evidence uploads against submission and activity completion.
    const task = await taskExecutionGates.lockTaskForExecution(tx, taskId);
    if (taskExecutionGates.strictGatesEnabled() &&
        !['ACCEPTED', 'IN_PROGRESS', 'REWORK'].includes(task.Status)) {
      const error = new Error('Cannot add execution evidence while this task is not in progress');
      error.status = 409;
      throw error;
    }

    if (activityId) {
      const record = await tx.request().input('activityId', sql.VarChar, activityId)
        .query('SELECT Id, TaskInstanceId, SubTaskId FROM PemsActivities WHERE Id = @activityId');
      const activity = record.recordset[0];
      if (!activity || activity.TaskInstanceId !== taskId ||
          (subTaskId && activity.SubTaskId !== subTaskId)) {
        const error = new Error('Evidence activity does not belong to this task and phase');
        error.status = 400;
        throw error;
      }
    } else if (subTaskId) {
      const record = await tx.request().input('phaseId', sql.VarChar, subTaskId)
        .query('SELECT Id, TaskInstanceId FROM PemsSubTasks WHERE Id = @phaseId');
      if (!record.recordset[0] || record.recordset[0].TaskInstanceId !== taskId) {
        const error = new Error('Evidence phase does not belong to this task');
        error.status = 400;
        throw error;
      }
    }

    // A retry with the identical task, activity, URL and uploader returns the
    // existing record instead of creating duplicate proof.
    const existing = await tx.request()
      .input('taskId', sql.VarChar, taskId)
      .input('activityId', sql.VarChar, activityId)
      .input('subTaskId', sql.VarChar, subTaskId)
      .input('fileUrl', sql.NVarChar, fileUrl)
      .input('uploadedBy', sql.VarChar, data.uploadedBy)
      .query(`
        SELECT TOP (1) Id FROM PemsEvidence
        WHERE TaskInstanceId = @taskId
          AND ((ActivityId = @activityId) OR (ActivityId IS NULL AND @activityId IS NULL))
          AND ((SubTaskId = @subTaskId) OR (SubTaskId IS NULL AND @subTaskId IS NULL))
          AND FileUrl = @fileUrl AND UploadedBy = @uploadedBy
        ORDER BY UploadedAt DESC
      `);
    if (existing.recordset[0]) return { id: existing.recordset[0].Id, alreadyExists: true };

    const id = genId();
    await tx.request()
      .input('id', sql.VarChar, id)
      .input('taskInstanceId', sql.VarChar, taskId)
      .input('subTaskId', sql.VarChar, subTaskId)
      .input('activityId', sql.VarChar, activityId)
      .input('fileName', sql.NVarChar, fileName)
      .input('fileUrl', sql.NVarChar, fileUrl)
      .input('fileType', sql.VarChar, data.fileType || 'FILE')
      .input('fileSize', sql.BigInt, data.fileSize || 0)
      .input('mimeType', sql.NVarChar, data.mimeType || '')
      .input('remarks', sql.NVarChar, data.remarks || '')
      .input('uploadedBy', sql.VarChar, data.uploadedBy)
      .input('uploadedByName', sql.NVarChar, data.uploadedByName || '')
      .query(`
        INSERT INTO PemsEvidence (Id, TaskInstanceId, SubTaskId, ActivityId, FileName, FileUrl, FileType, FileSize, MimeType, Remarks, UploadedBy, UploadedByName)
        VALUES (@id, @taskInstanceId, @subTaskId, @activityId, @fileName, @fileUrl, @fileType, @fileSize, @mimeType, @remarks, @uploadedBy, @uploadedByName)
      `);
    await writeAuditLog(taskId, 'EVIDENCE_UPLOADED', null, null,
      data.uploadedBy, data.uploadedByName, `Evidence uploaded: ${fileName}`, tx);
    return { id };
  });
}

// ═══════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════

async function submitReview(data, tx) {
  const pool = tx || (await getPool());
  const id = genId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskInstanceId', sql.VarChar, data.taskInstanceId)
    .input('reviewerId', sql.VarChar, data.reviewerId)
    .input('reviewerName', sql.NVarChar, data.reviewerName || '')
    .input('decision', sql.VarChar, data.decision)
    .input('qualityScore', sql.Int, data.qualityScore ?? null)
    .input('feedback', sql.NVarChar, data.feedback || '')
    .input('reviewChecklist', sql.NVarChar(sql.MAX), JSON.stringify(data.reviewChecklist || []))
    .input('reviewDurationMinutes', sql.Int, data.reviewDurationMinutes ?? null)
    .query(`
      INSERT INTO PemsTaskReviews (Id, TaskInstanceId, ReviewerId, ReviewerName, Decision, QualityScore, Feedback, ReviewChecklist, ReviewDurationMinutes)
      VALUES (@id, @taskInstanceId, @reviewerId, @reviewerName, @decision, @qualityScore, @feedback, @reviewChecklist, @reviewDurationMinutes)
    `);

  return { id };
}

// Statuses from which a reviewer may take a task and decide on it.
const REVIEWABLE_STATUSES = ['SUBMITTED', 'RESUBMITTED', 'ESCALATED', 'UNDER_REVIEW'];

function normaliseReviewInput(data) {
  const decision = String(data.decision || '').toUpperCase();
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    throw new Error('Decision must be APPROVE or REJECT');
  }
  const feedback = String(data.feedback || '').trim();
  if (decision === 'REJECT' && !feedback) {
    throw new Error('Feedback is required when sending a task back');
  }
  if (feedback.length > 4000) throw new Error('Feedback is too long (max 4000 characters)');

  let qualityScore = null;
  if (data.qualityScore !== undefined && data.qualityScore !== null && data.qualityScore !== '') {
    const n = Number(data.qualityScore);
    if (!Number.isFinite(n)) throw new Error('qualityScore must be a number');
    qualityScore = Math.max(0, Math.min(100, Math.round(n)));
  }
  let reviewDurationMinutes = null;
  if (data.reviewDurationMinutes !== undefined && data.reviewDurationMinutes !== null) {
    const m = Number(data.reviewDurationMinutes);
    if (Number.isFinite(m) && m >= 0) reviewDurationMinutes = Math.min(Math.round(m), 600);
  }
  return {
    ...data,
    decision,
    feedback,
    qualityScore,
    reviewDurationMinutes,
    reviewChecklist: Array.isArray(data.reviewChecklist) ? data.reviewChecklist : [],
  };
}

/**
 * The single review entry point. In ONE transaction it:
 *   1. locks the task and verifies it is awaiting review,
 *   2. enforces separation of duties (no reviewing your own task),
 *   3. claims it (SUBMITTED / RESUBMITTED / ESCALATED → UNDER_REVIEW),
 *   4. records the review,
 *   5. applies the decision (APPROVE → APPROVED · REJECT → REJECTED).
 * Any failure rolls everything back — no orphan review rows.
 */
async function submitReviewAndTransition(rawData, actor) {
  const data = normaliseReviewInput(rawData);
  if (!data.taskInstanceId) throw new Error('taskInstanceId is required');
  if (!actor?.id) throw new Error('Reviewer identity is required');

  return withTransaction(async (tx) => {
    const cur = await tx.request()
      .input('id', sql.VarChar, data.taskInstanceId)
      .query('SELECT Status, AssignedTo, ReviewerId, SellerId FROM PemsTaskInstances WITH (UPDLOCK, ROWLOCK) WHERE Id = @id');
    const task = cur.recordset[0];
    if (!task) throw new Error('Task instance not found');

    if (!REVIEWABLE_STATUSES.includes(task.Status)) {
      throw new Error(`Task is ${task.Status} and is not awaiting review`);
    }
    // No administrator bypass for separation of duties. Review assignment
    // and seller scope must match the authenticated caller, not request body.
    if (!canReviewTask(actor.user || { Id: actor.id, role: actor.role }, task)) {
      const error = new Error('You cannot review this task or your own assigned work');
      error.status = 403;
      throw error;
    }

    const from = task.Status;
    if (from !== 'UNDER_REVIEW') {
      await transitionStatus(data.taskInstanceId, 'UNDER_REVIEW', actor.id, actor.name, actor.role, 'Review started', tx);
    }
    if (!task.ReviewerId) {
      await tx.request()
        .input('id', sql.VarChar, data.taskInstanceId)
        .input('rid', sql.VarChar, actor.id)
        .input('rname', sql.NVarChar, actor.name || '')
        .query('UPDATE PemsTaskInstances SET ReviewerId = @rid, ReviewerName = @rname WHERE Id = @id AND ReviewerId IS NULL');
    }

    const review = await submitReview({ ...data, reviewerId: actor.id, reviewerName: actor.name }, tx);
    const to = resolveReviewTransition(data.decision);
    await transitionStatus(
      data.taskInstanceId, to, actor.id, actor.name, actor.role,
      data.feedback || (data.decision === 'APPROVE' ? 'Approved' : ''),
      tx
    );
    return { id: review.id, reviewId: review.id, from, to, decision: data.decision };
  });
}

/**
 * Review many tasks with one decision. Each task runs in its own transaction
 * and is access-checked individually; failures are reported, never fatal.
 */
async function bulkReview(taskIds, data, actor, user) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) throw new Error('No task ids provided');
  if (taskIds.length > 100) throw new Error('Too many tasks (max 100 per bulk review)');
  normaliseReviewInput({ ...data, taskInstanceId: 'x' }); // validate decision/feedback once

  const pool = await getPool();
  const reviewed = [];
  const skipped = [];
  for (const id of [...new Set(taskIds)]) {
    try {
      const r = await pool.request().input('id', sql.VarChar, id)
        .query('SELECT Id, AssignedTo, ReviewerId, SellerId FROM PemsTaskInstances WHERE Id = @id');
      const row = r.recordset[0];
      if (!row) { skipped.push({ id, reason: 'Task not found' }); continue; }
      if (!canReviewTask(user, row)) { skipped.push({ id, reason: 'No permission to review this task' }); continue; }
      const out = await submitReviewAndTransition({ ...data, taskInstanceId: id }, actor);
      reviewed.push({ id, to: out.to });
    } catch (err) {
      skipped.push({ id, reason: err.message });
    }
  }
  return { reviewed, skipped };
}

/**
 * Real review KPIs. Global roles see the whole team; everyone else sees only
 * tasks they are the reviewer of.
 *  - windows compare the last 7 days with the 7 days before (trend)
 *  - `mine` is always about the calling reviewer
 */
async function getReviewStats(user) {
  const pool = await getPool();
  const uid = user?.Id || user?._id || user?.id || null;
  const role = String(user?.role?.name || user?.role || '').toLowerCase();
  const scoped = !isGlobalUserRole(role);
  const scopeSql = scoped ? ' AND i.ReviewerId = @uid' : '';

  // Reviewer scoping alone is not enough: a user can be the reviewer on tasks in
  // sellers they are not assigned to, so their review counters would still leak
  // cross-seller activity. Layer the seller scope on top of every query here.
  const seller = buildScopeClause(resolveSellerScope(user, null), 'i');
  const sellerSql = seller.clause;
  const bindSeller = (r) => applyScopeInputs(r, seller.params, sql);

  const windowStats = async (fromDays, toDays) => {
    const rq = pool.request().input('fromDays', sql.Int, fromDays).input('toDays', sql.Int, toDays);
    if (scoped) rq.input('uid', sql.VarChar, uid);
    bindSeller(rq);
    const rev = await rq.query(`
      SELECT COUNT(*) AS decided,
        SUM(CASE WHEN r.Decision = 'APPROVE' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN r.Decision = 'REJECT' THEN 1 ELSE 0 END) AS rejected,
        AVG(CASE WHEN i.SubmittedAt IS NOT NULL AND r.CreatedAt >= i.SubmittedAt
                 THEN CAST(DATEDIFF(MINUTE, i.SubmittedAt, r.CreatedAt) AS FLOAT) END) AS avgTurnaroundMin,
        AVG(CAST(r.QualityScore AS FLOAT)) AS avgQuality
      FROM PemsTaskReviews r
      JOIN PemsTaskInstances i ON i.Id = r.TaskInstanceId
      WHERE r.CreatedAt >= DATEADD(DAY, -@fromDays, dbo.GetEnvDate())
        AND r.CreatedAt <  DATEADD(DAY, -@toDays, dbo.GetEnvDate())${scopeSql}${sellerSql}
    `);
    const rq2 = pool.request().input('fromDays', sql.Int, fromDays).input('toDays', sql.Int, toDays);
    if (scoped) rq2.input('uid', sql.VarChar, uid);
    bindSeller(rq2);
    const sla = await rq2.query(`
      SELECT COUNT(*) AS approvedTotal,
        SUM(CASE WHEN i.DueDate IS NULL OR i.CompletedAt <= i.DueDate THEN 1 ELSE 0 END) AS onTime
      FROM PemsTaskInstances i
      WHERE i.Status = 'APPROVED' AND i.CompletedAt IS NOT NULL
        AND i.CompletedAt >= DATEADD(DAY, -@fromDays, dbo.GetEnvDate())
        AND i.CompletedAt <  DATEADD(DAY, -@toDays, dbo.GetEnvDate())${scopeSql}${sellerSql}
    `);
    const a = rev.recordset[0] || {};
    const b = sla.recordset[0] || {};
    const decided = a.decided || 0;
    return {
      decided,
      approved: a.approved || 0,
      rejected: a.rejected || 0,
      avgTurnaroundMin: a.avgTurnaroundMin != null ? Math.round(a.avgTurnaroundMin) : null,
      avgQuality: a.avgQuality != null ? Math.round(a.avgQuality) : null,
      approvalRate: decided ? Math.round(((a.approved || 0) / decided) * 100) : null,
      reworkRate: decided ? Math.round(((a.rejected || 0) / decided) * 100) : null,
      slaCompliance: b.approvedTotal ? Math.round(((b.onTime || 0) / b.approvedTotal) * 100) : null,
    };
  };

  const [d30, d7, prev7] = await Promise.all([windowStats(30, 0), windowStats(7, 0), windowStats(14, 7)]);
  const delta = (cur, prev) => (cur == null || prev == null) ? null : Math.round((cur - prev) * 10) / 10;
  const pct = (cur, prev) => (cur == null || prev == null || prev === 0) ? null : Math.round(((cur - prev) / prev) * 100);

  const mineReq = pool.request().input('uid', sql.VarChar, uid);
  bindSeller(mineReq);
  const mine = await mineReq.query(`
    SELECT
      SUM(CASE WHEN CAST(r.CreatedAt AS DATE) = CAST(dbo.GetEnvDate() AS DATE) THEN 1 ELSE 0 END) AS reviewsToday,
      SUM(CASE WHEN r.CreatedAt >= DATEADD(DAY, -7, dbo.GetEnvDate()) THEN 1 ELSE 0 END) AS reviewsWeek,
      COUNT(*) AS reviews30,
      SUM(CASE WHEN r.Decision = 'APPROVE' THEN 1 ELSE 0 END) AS approved30,
      AVG(CAST(r.ReviewDurationMinutes AS FLOAT)) AS avgMinutesSpent,
      AVG(CAST(r.QualityScore AS FLOAT)) AS avgQuality
    FROM PemsTaskReviews r
    JOIN PemsTaskInstances i ON i.Id = r.TaskInstanceId
    WHERE r.ReviewerId = @uid AND r.CreatedAt >= DATEADD(DAY, -30, dbo.GetEnvDate())${sellerSql}
  `);
  const m = mine.recordset[0] || {};

  return {
    scope: scoped ? 'mine' : 'team',
    window30: d30,
    window7: d7,
    trends: {
      avgTurnaroundPct: pct(d7.avgTurnaroundMin, prev7.avgTurnaroundMin),
      slaCompliancePts: delta(d7.slaCompliance, prev7.slaCompliance),
      reworkRatePts: delta(d7.reworkRate, prev7.reworkRate),
      throughputPct: pct(d7.decided, prev7.decided),
    },
    mine: {
      reviewsToday: m.reviewsToday || 0,
      reviewsWeek: m.reviewsWeek || 0,
      reviews30: m.reviews30 || 0,
      approvalRate: m.reviews30 ? Math.round(((m.approved30 || 0) / m.reviews30) * 100) : null,
      avgMinutesSpent: m.avgMinutesSpent != null ? Math.round(m.avgMinutesSpent) : null,
      avgQuality: m.avgQuality != null ? Math.round(m.avgQuality) : null,
    },
  };
}

// ═══════════════════════════════════════════════════════
// MY DAY — everything one person has to act on today
// ═══════════════════════════════════════════════════════

// Statuses where the ASSIGNEE is the one who must act next.
const MYDAY_ACTIONABLE = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'REWORK', 'REJECTED', 'ESCALATED'];
// Statuses where the ball is in a reviewer's court.
const MYDAY_IN_REVIEW = ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'];

/**
 * Raw material for the employee's daily plan. Ranking and scheduling are done
 * client-side (working hours + "now" are local, and the plan re-flows as the
 * day goes by), so this only returns facts:
 *   actionable  – tasks the user must do (with estimate, step progress, last reviewer feedback)
 *   waiting     – tasks the user submitted that are waiting on a reviewer
 *   reviews     – tasks waiting for THIS user to review
 *   doneToday   – tasks the user submitted / got approved today
 * Global roles may pass `targetUserId` to see a teammate's day.
 */
async function getMyDay(user, targetUserId) {
  const pool = await getPool();
  const callerId = user?.Id || user?._id || user?.id || null;
  const role = String(user?.role?.name || user?.role || '').toLowerCase();
  const uid = targetUserId && isGlobalUserRole(role) ? targetUserId : callerId;
  if (!uid) throw new Error('User identity is required');

  const inList = (arr) => arr.map(x => `'${x}'`).join(',');   // constants only, never user input

  // My Day is per-user, but "my" tasks are still seller-owned: a restricted user
  // can be assigned work in a seller they no longer cover, and that work must
  // not surface here. Each of the four queries is a separate request, so the
  // scope params are bound onto each one.
  const scope = resolveSellerScope(user, null);
  const { clause: scopeSql, params: scopeParams } = buildScopeClause(scope, 'i');
  const makeQ = () => {
    const r = pool.request().input('uid', sql.VarChar, uid);
    applyScopeInputs(r, scopeParams, sql);
    return r;
  };

  const actionableQ = makeQ().query(`
    SELECT i.Id, i.InstanceCode, i.Title, i.Priority, i.Status, i.DueDate, i.SLAStatus, i.SLAHours,
           i.StartedAt, i.SubmittedAt, i.ReworkCount, i.Source, i.SourceRef, i.SellerName, i.Department,
           i.Category, i.ReviewerName, i.AssignedAt,
           t.Name AS TemplateName,
           -- multi-brand routines: the template estimate is per brand
           COALESCE(t.EstimatedExecutionMinutes, 60)
             * CASE WHEN t.BrandMode = 'CHECKLIST' AND bt.Total > 0 THEN bt.Total ELSE 1 END AS EstimatedMinutes,
           bt.Total AS BrandTotal, bt.Done AS BrandDone, t.BrandMode,
           (SELECT COUNT(*) FROM PemsSubTasks st WHERE st.TaskInstanceId = i.Id) AS SubTaskTotal,
           (SELECT COUNT(*) FROM PemsSubTasks st WHERE st.TaskInstanceId = i.Id AND st.IsCompleted = 1) AS SubTaskDone,
           (SELECT COUNT(*) FROM PemsEvidence e WHERE e.TaskInstanceId = i.Id) AS EvidenceCount,
           (SELECT TOP 1 r.Feedback FROM PemsTaskReviews r WHERE r.TaskInstanceId = i.Id ORDER BY r.CreatedAt DESC) AS LastFeedback
    FROM PemsTaskInstances i
    LEFT JOIN PemsTaskTemplates t ON i.TemplateId = t.Id
    OUTER APPLY (SELECT COUNT(*) AS Total, COALESCE(SUM(CASE WHEN b.IsCompleted = 1 THEN 1 ELSE 0 END), 0) AS Done
                 FROM PemsTaskBrands b WHERE b.TaskInstanceId = i.Id) bt
    WHERE i.AssignedTo = @uid AND i.Status IN (${inList(MYDAY_ACTIONABLE)})${scopeSql}
    ORDER BY i.DueDate ASC
  `);

  const waitingQ = makeQ().query(`
    SELECT TOP 30 i.Id, i.InstanceCode, i.Title, i.Priority, i.Status, i.DueDate, i.SubmittedAt, i.ReviewerName
    FROM PemsTaskInstances i
    WHERE i.AssignedTo = @uid AND i.Status IN (${inList(MYDAY_IN_REVIEW)})${scopeSql}
    ORDER BY i.SubmittedAt ASC
  `);

  const reviewsQ = makeQ().query(`
    SELECT TOP 50 i.Id, i.InstanceCode, i.Title, i.Priority, i.Status, i.DueDate, i.SubmittedAt, i.AssigneeName, i.SellerName
    FROM PemsTaskInstances i
    WHERE i.ReviewerId = @uid AND (i.AssignedTo IS NULL OR i.AssignedTo <> @uid)
      AND i.Status IN (${inList(MYDAY_IN_REVIEW)})${scopeSql}
    ORDER BY i.SubmittedAt ASC
  `);

  const doneQ = makeQ().query(`
    SELECT TOP 30 i.Id, i.InstanceCode, i.Title, i.Priority, i.Status, i.SubmittedAt, i.CompletedAt
    FROM PemsTaskInstances i
    WHERE i.AssignedTo = @uid
      AND (CAST(i.SubmittedAt AS DATE) = CAST(dbo.GetEnvDate() AS DATE)
        OR CAST(i.CompletedAt AS DATE) = CAST(dbo.GetEnvDate() AS DATE))${scopeSql}
    ORDER BY COALESCE(i.CompletedAt, i.SubmittedAt) DESC
  `);

  const [actionable, waiting, reviews, done] = await Promise.all([actionableQ, waitingQ, reviewsQ, doneQ]);
  return {
    userId: uid,
    actionable: actionable.recordset,
    waiting: waiting.recordset,
    reviews: reviews.recordset,
    doneToday: done.recordset,
    generatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════
// ACHIEVEMENT & SLA
// ═══════════════════════════════════════════════════════

async function updateAchievement(taskInstanceId, achievement) {
  const pool = await getPool();
  const instance = await pool.request().input('id', sql.VarChar, taskInstanceId).query('SELECT Target FROM PemsTaskInstances WHERE Id = @id');
  if (!instance.recordset[0]) throw new Error('Instance not found');
  const target = instance.recordset[0].Target;
  const achievementPct = calculateAchievement(achievement, target);
  const variance = calculateVariance(achievement, target);

  await pool.request()
    .input('id', sql.VarChar, taskInstanceId)
    .input('achievement', sql.Decimal(18, 2), achievement)
    .query('UPDATE PemsTaskInstances SET Achievement = @achievement, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');

  return { achievementPct, variance };
}

async function refreshSLAStatuses() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, DueDate, SLAHours, Status FROM PemsTaskInstances
    WHERE Status NOT IN ('APPROVED', 'CANCELLED')
  `);
  let updated = 0;
  for (const inst of result.recordset) {
    const slaStatus = calculateSLAStatus(inst.DueDate, inst.SLAHours);
    if (slaStatus !== inst.SLAStatus) {
      await pool.request().input('id', sql.VarChar, inst.Id).input('sla', sql.VarChar, slaStatus)
        .query('UPDATE PemsTaskInstances SET SLAStatus = @sla WHERE Id = @id');
      updated++;
    }
  }
  return { updated };
}

// ═══════════════════════════════════════════════════════
// DASHBOARD / KPIs
// ═══════════════════════════════════════════════════════

async function getDashboardKPIs(filters = {}, requester = null) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assignedTo) { where += ' AND AssignedTo = @assignedTo'; req.input('assignedTo', sql.VarChar, filters.assignedTo); }
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

  const scoped = scopeWhere(requester, where, '', filters.sellerId);
  where = scoped.where;
  applyScopeInputs(req, scoped.params, sql);

  const result = await req.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN Status = 'DRAFT' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN Status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
      SUM(CASE WHEN Status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN Status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as underReview,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN Status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as rework,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      SUM(CASE WHEN SLAStatus = 'AT_RISK' THEN 1 ELSE 0 END) as slaAtRisk,
      SUM(CASE WHEN ReviewStatus = 'PENDING_REVIEW' THEN 1 ELSE 0 END) as pendingReview,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(SUM(Achievement), 0) as totalAchievement,
      ISNULL(SUM(Target), 0) as totalTarget
    FROM PemsTaskInstances ${where}
  `);

  const r = result.recordset[0];
  return {
    total: r.total || 0,
    draft: r.draft || 0,
    assigned: r.assigned || 0,
    accepted: r.accepted || 0,
    inProgress: r.inProgress || 0,
    submitted: r.submitted || 0,
    underReview: r.underReview || 0,
    approved: r.approved || 0,
    rejected: r.rejected || 0,
    rework: r.rework || 0,
    slaBreached: r.slaBreached || 0,
    slaAtRisk: r.slaAtRisk || 0,
    pendingReview: r.pendingReview || 0,
    avgAchievementPct: Math.round((r.avgAchievementPct || 0) * 100) / 100,
    totalAchievement: r.totalAchievement || 0,
    totalTarget: r.totalTarget || 0,
    overallProgress: r.total > 0 ? Math.round(((r.approved || 0) / r.total) * 100) : 0,
  };
}

async function getSellerPerformance(filters = {}, requester = null) {
  const pool = await getPool();
  let where = 'WHERE SellerId IS NOT NULL';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

  const scoped = scopeWhere(requester, where, '', filters.sellerId);
  where = scoped.where;
  applyScopeInputs(req, scoped.params, sql);

  const result = await req.query(`
    SELECT TOP 20
      SellerId, SellerName,
      COUNT(*) as totalTasks,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(SUM(Achievement), 0) as totalAchievement,
      ISNULL(SUM(Target), 0) as totalTarget
    FROM PemsTaskInstances ${where}
    GROUP BY SellerId, SellerName
    ORDER BY completedTasks DESC
  `);

  return result.recordset.map(r => ({
    ...r,
    avgAchievementPct: Math.round(r.avgAchievementPct * 100) / 100,
    completionRate: r.totalTasks > 0 ? Math.round((r.completedTasks / r.totalTasks) * 100) : 0,
  }));
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

async function addComment(taskInstanceId, text, actorId, actorName) {
  const body = String(text || '').trim();
  if (!body) throw new Error('Comment cannot be empty');
  if (body.length > 2000) throw new Error('Comment is too long (max 2000 characters)');
  await writeAuditLog(taskInstanceId, 'COMMENT', null, null, actorId, actorName, body);
  return { taskInstanceId, text: body, actorName, createdAt: new Date().toISOString() };
}

/**
 * Verify that the work behind a task is really done.
 *  - RULESET tasks that carry ASINs: dry-run the originating ruleset against those
 *    ASINs. An ASIN that still matches the rule's conditions is NOT fixed.
 *  - Everything else: all sub-tasks must be completed.
 * Never mutates task data apart from an audit entry.
 */
async function verifyFix(taskInstanceId, actorId, actorName) {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.VarChar, taskInstanceId)
    .query('SELECT Id, Source, SourceId, Asins FROM PemsTaskInstances WHERE Id = @id');
  const task = r.recordset[0];
  if (!task) throw new Error('Task not found');

  const subs = await pool.request().input('id', sql.VarChar, taskInstanceId)
    .query('SELECT COUNT(*) AS total, SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) AS done FROM PemsSubTasks WHERE TaskInstanceId = @id');
  const total = subs.recordset[0].total || 0;
  const done = subs.recordset[0].done || 0;
  const asins = safeParse(task.Asins, []);

  let result;
  if (task.Source === 'RULESET' && task.SourceId && asins.length > 0) {
    try {
      const engine = require('../rulesetEngineService');
      const { entries } = await engine.evaluateRuleset(task.SourceId, { dryRun: true, triggeredBy: 'manual', selectedAsins: asins });
      const stillFailing = new Set((entries || []).map(e => e.entityId));
      const items = asins.map(a => ({ asin: a, verified: !stillFailing.has(a) }));
      const failing = items.filter(i => !i.verified).length;
      result = failing === 0
        ? { status: 'success', message: `All ${items.length} ASIN(s) now pass the rule — fix confirmed`, asins: items }
        : { status: 'mismatch', message: `${failing} of ${items.length} ASIN(s) still match the rule conditions`, asins: items };
    } catch (err) {
      result = { status: 'unavailable', message: `Automatic check unavailable (${err.message}). Confirm manually.`, asins: asins.map(a => ({ asin: a, verified: false })) };
    }
  } else if (total > 0 && done < total) {
    result = { status: 'mismatch', message: `${total - done} of ${total} sub-task(s) still open`, asins: [] };
  } else if (taskExecutionGates.strictGatesEnabled()) {
    // A checked SOP is not evidence of a repaired listing or recovered stock.
    // Preserve the manual-confirmation pathway without manufacturing a
    // FIX_VERIFIED audit event for a task with no real business verifier.
    result = { status: 'unavailable', message: 'SOP completion recorded. No automated business-outcome verification is configured; attach evidence and confirm the outcome manually.', asins: [] };
  } else {
    result = { status: 'success', message: total > 0 ? 'All sub-tasks completed' : 'No automated check for this task — nothing outstanding', asins: [] };
  }

  await writeAuditLog(taskInstanceId, result.status === 'success' ? 'FIX_VERIFIED' : 'FIX_NOT_VERIFIED',
    null, null, actorId, actorName, result.message);
  return { ...result, checkedAt: new Date().toISOString() };
}

async function writeAuditLog(taskInstanceId, action, fromStatus, toStatus, actorId, actorName, details, tx) {
  const pool = tx || (await getPool());
  await pool.request()
    .input('id', sql.VarChar, genId())
    .input('taskInstanceId', sql.VarChar, taskInstanceId)
    .input('action', sql.VarChar, action)
    .input('fromStatus', sql.VarChar, fromStatus || null)
    .input('toStatus', sql.VarChar, toStatus || null)
    .input('actorId', sql.VarChar, actorId || null)
    .input('actorName', sql.NVarChar, actorName || '')
    .input('details', sql.NVarChar, details || '')
    .query(`
      INSERT INTO PemsTaskAuditLogs (Id, TaskInstanceId, Action, FromStatus, ToStatus, ActorId, ActorName, Details)
      VALUES (@id, @taskInstanceId, @action, @fromStatus, @toStatus, @actorId, @actorName, @details)
    `);
}

function safeParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function applyFilterInputs(req, filters) {
  if (filters.status) req.input('status', sql.VarChar, filters.status);
  if (filters.sellerId) req.input('sellerId', sql.VarChar, filters.sellerId);
  if (filters.assignedTo) req.input('assignedTo', sql.VarChar, filters.assignedTo);
  if (filters.reviewerId) req.input('reviewerId', sql.VarChar, filters.reviewerId);
  if (filters.priority) req.input('priority', sql.VarChar, filters.priority);
  if (filters.slaStatus) req.input('slaStatus', sql.VarChar, filters.slaStatus);
  if (filters.reviewStatus) req.input('reviewStatus', sql.VarChar, filters.reviewStatus);
  if (filters.search) req.input('search', sql.NVarChar, `%${filters.search}%`);
  if (filters.templateId) req.input('templateId', sql.VarChar, filters.templateId);
  if (filters.department) req.input('department', sql.NVarChar, filters.department);
  if (filters.frequency) req.input('frequency', sql.VarChar, filters.frequency);
}

// ═══════════════════════════════════════════════════════
// V2: NOTIFICATIONS
// ═══════════════════════════════════════════════════════

async function createNotification(data) {
  const pool = await getPool();
  const id = genId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskInstanceId', sql.VarChar, data.taskInstanceId || null)
    .input('userId', sql.VarChar, data.userId)
    .input('type', sql.VarChar, data.type)
    .input('title', sql.NVarChar, data.title)
    .input('message', sql.NVarChar, data.message || '')
    .input('actionUrl', sql.NVarChar, data.actionUrl || null)
    .query(`INSERT INTO PemsNotifications (Id, TaskInstanceId, UserId, Type, Title, Message, ActionUrl) VALUES (@id, @taskInstanceId, @userId, @type, @title, @message, @actionUrl)`);
  return { id };
}

async function getNotifications(userId, unreadOnly = false) {
  const pool = await getPool();
  const where = unreadOnly ? 'WHERE UserId = @userId AND IsRead = 0' : 'WHERE UserId = @userId';
  const result = await pool.request().input('userId', sql.VarChar, userId)
    .query(`SELECT TOP 100 * FROM PemsNotifications ${where} ORDER BY CreatedAt DESC`);
  return result.recordset;
}

async function getUnreadCount(userId) {
  const pool = await getPool();
  const result = await pool.request().input('userId', sql.VarChar, userId)
    .query('SELECT COUNT(*) as count FROM PemsNotifications WHERE UserId = @userId AND IsRead = 0');
  return result.recordset[0].count;
}

async function markNotificationRead(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id)
    .query('UPDATE PemsNotifications SET IsRead = 1 WHERE Id = @id');
}

async function markAllRead(userId) {
  const pool = await getPool();
  await pool.request().input('userId', sql.VarChar, userId)
    .query('UPDATE PemsNotifications SET IsRead = 1 WHERE UserId = @userId AND IsRead = 0');
}

// ═══════════════════════════════════════════════════════
// V2: DEPARTMENT PERFORMANCE
// ═══════════════════════════════════════════════════════

async function getDepartmentPerformance(filters = {}, requester = null) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

  const scoped = scopeWhere(requester, where, '', filters.sellerId);
  where = scoped.where;
  applyScopeInputs(req, scoped.params, sql);

  const result = await req.query(`
    SELECT Department,
      COUNT(*) as totalTasks,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(AVG(ProgressPct), 0) as avgProgress,
      SUM(CASE WHEN Status IN ('ASSIGNED', 'IN_PROGRESS', 'REWORK') THEN 1 ELSE 0 END) as activeTasks
    FROM PemsTaskInstances ${where}
    GROUP BY Department
    ORDER BY completedTasks DESC
  `);

  return result.recordset.map(r => ({
    ...r,
    avgAchievementPct: Math.round(r.avgAchievementPct * 100) / 100,
    avgProgress: Math.round(r.avgProgress * 100) / 100,
    completionRate: r.totalTasks > 0 ? Math.round((r.completedTasks / r.totalTasks) * 100) : 0,
    slaCompliance: r.totalTasks > 0 ? Math.round(((r.totalTasks - r.slaBreached) / r.totalTasks) * 100) : 100,
  }));
}

async function getBrandManagerPerformance(filters = {}, requester = null) {
  const pool = await getPool();
  let where = 'WHERE AssignedTo IS NOT NULL';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND i.CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND i.CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }
  if (filters.department) { where += ' AND i.Department = @department'; req.input('department', sql.NVarChar, filters.department); }

  const scoped = scopeWhere(requester, where, 'i', filters.sellerId);
  where = scoped.where;
  applyScopeInputs(req, scoped.params, sql);

  const result = await req.query(`
    SELECT TOP 20 i.AssignedTo, i.AssigneeName,
      COUNT(*) as totalTasks,
      SUM(CASE WHEN i.Status = 'APPROVED' THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN i.SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN i.Target > 0 THEN (i.Achievement / i.Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(AVG(i.ProgressPct), 0) as avgProgress
    FROM PemsTaskInstances i ${where}
    GROUP BY i.AssignedTo, i.AssigneeName
    ORDER BY completedTasks DESC
  `);

  return result.recordset.map(r => ({
    ...r,
    avgAchievementPct: Math.round(r.avgAchievementPct * 100) / 100,
    avgProgress: Math.round(r.avgProgress * 100) / 100,
    completionRate: r.totalTasks > 0 ? Math.round((r.completedTasks / r.totalTasks) * 100) : 0,
  }));
}

async function getReviewerPerformance(filters = {}, requester = null) {
  const pool = await getPool();
  // PemsTaskReviews carries no SellerId, so seller scope has to come through a
  // join to the owning task instance.
  const req = pool.request();
  const scoped = scopeWhere(requester, 'WHERE 1=1', 'i', filters.sellerId);
  applyScopeInputs(req, scoped.params, sql);
  const result = await req
    .query(`
      SELECT r.ReviewerId, r.ReviewerName,
        COUNT(*) as totalReviews,
        SUM(CASE WHEN r.Decision = 'APPROVE' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN r.Decision = 'REJECT' THEN 1 ELSE 0 END) as rejected,
        ISNULL(AVG(r.QualityScore), 0) as avgQualityScore,
        ISNULL(AVG(r.ReviewDurationMinutes), 0) as avgReviewTime
      FROM PemsTaskReviews r
      JOIN PemsTaskInstances i ON i.Id = r.TaskInstanceId
      ${scoped.where}
      GROUP BY r.ReviewerId, r.ReviewerName
      ORDER BY totalReviews DESC
    `);
  return result.recordset.map(r => ({
    ...r,
    avgQualityScore: Math.round(r.avgQualityScore * 100) / 100,
  }));
}

// ═══════════════════════════════════════════════════════
// V2: ESCALATION CHECK
// ═══════════════════════════════════════════════════════

async function checkEscalations() {
  const pool = await getPool();
  const BATCH_SIZE = 500;
  // Offset paging while rows are written back into the scanned table can, under
  // a misbehaving client or an id-collision, never reach an empty page. A hard
  // iteration cap bounds the scan so the scheduler cannot spin forever.
  const MAX_BATCHES = 200;
  let offset = 0;
  let escalated = 0;
  let batches = 0;

  while (batches < MAX_BATCHES) {
    const batch = await pool.request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, BATCH_SIZE)
      .query(`
        SELECT Id, AssignedTo, AssigneeName, ReviewerId, ReviewerName, DueDate, SLAHours,
               Status, SLAStatus, Title, LastSlaWarningAt, LastSlaBreachAt
        FROM PemsTaskInstances
        WHERE Status NOT IN ('APPROVED', 'CANCELLED')
        AND DueDate IS NOT NULL
        ORDER BY Id
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    if (batch.recordset.length === 0) break;

    for (const task of batch.recordset) {
      const { getEscalationLevel } = require('./workflowEngine');
      const level = getEscalationLevel(task.DueDate, task.SLAHours);
      if (!level) continue;

      const newSlaStatus = calculateSLAStatus(task.DueDate, task.SLAHours);
      if (newSlaStatus !== task.SLAStatus) {
        await pool.request().input('id', sql.VarChar, task.Id).input('sla', sql.VarChar, newSlaStatus)
          .query('UPDATE PemsTaskInstances SET SLAStatus = @sla WHERE Id = @id');
        await eventStore.append(eventStore.EVENT_TYPES.SLA_UPDATED, task.Id, {
          slaStatus: newSlaStatus,
          previousSlaStatus: task.SLAStatus,
          dueDate: task.DueDate,
        }).catch(() => {});
      }

      // Notification dedup: warn at most once per 12h, breach at most once per 24h
      const now2 = new Date();
      const H12 = 12 * 60 * 60 * 1000;
      const H24 = 24 * 60 * 60 * 1000;
      const lastWarn = task.LastSlaWarningAt ? new Date(task.LastSlaWarningAt).getTime() : 0;
      const lastBreach = task.LastSlaBreachAt ? new Date(task.LastSlaBreachAt).getTime() : 0;
      const warnDue = (now2.getTime() - lastWarn) >= H12;
      const breachDue = (now2.getTime() - lastBreach) >= H24;

      if (warnDue && (level === 'assignee' || level === 'reviewer')) {
        if (level === 'assignee' && task.AssignedTo) {
          await createNotification({ taskInstanceId: task.Id, userId: task.AssignedTo, type: 'SLA_WARNING', title: `SLA Warning: ${task.Title}`, message: `Task due in less than 24 hours`, actionUrl: `/pems/tasks?id=${task.Id}` });
          await pool.request().input('id', sql.VarChar, task.Id).input('t', sql.DateTime2, now2)
            .query('UPDATE PemsTaskInstances SET LastSlaWarningAt = @t WHERE Id = @id');
        }
        if (level === 'reviewer' && task.ReviewerId) {
          await createNotification({ taskInstanceId: task.Id, userId: task.ReviewerId, type: 'SLA_WARNING', title: `SLA Urgent: ${task.Title}`, message: `Task due in less than 12 hours, review needed`, actionUrl: `/pems/tasks?id=${task.Id}` });
          await pool.request().input('id', sql.VarChar, task.Id).input('t', sql.DateTime2, now2)
            .query('UPDATE PemsTaskInstances SET LastSlaWarningAt = @t WHERE Id = @id');
        }
      }
      if (breachDue && (level === 'manager' || level === 'admin') && task.AssignedTo) {
        await createNotification({ taskInstanceId: task.Id, userId: task.AssignedTo, type: 'SLA_BREACH', title: `SLA BREACHED: ${task.Title}`, message: `Task has breached its SLA deadline`, actionUrl: `/pems/tasks?id=${task.Id}` });
        await pool.request().input('id', sql.VarChar, task.Id).input('t', sql.DateTime2, now2)
          .query('UPDATE PemsTaskInstances SET LastSlaBreachAt = @t WHERE Id = @id');
      }
      escalated++;
    }

    // Advance by what was actually returned so a short page still terminates
    // (a fake/test pool or a race that returns fewer rows must not re-read the
    // same offset forever).
    offset += batch.recordset.length;
    batches++;
  }
  return { escalated };
}

// ═══════════════════════════════════════════════════════
// V2: ENHANCED DASHBOARD
// ═══════════════════════════════════════════════════════

async function getRiskPanel(requester = null) {
  const pool = await getPool();
  const req = pool.request();
  // Risk counters describe the whole estate by default, so they must be scoped
  // or a restricted user sees every seller's breach and overdue counts.
  const scoped = scopeWhere(requester, 'WHERE Status NOT IN (\'CANCELLED\')');
  applyScopeInputs(req, scoped.params, sql);
  const result = await req.query(`
    SELECT
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreaches,
      SUM(CASE WHEN Status IN ('ASSIGNED', 'IN_PROGRESS', 'REWORK') AND DueDate < dbo.GetEnvDate() THEN 1 ELSE 0 END) as overdueTasks,
      SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as pendingReviews,
      SUM(CASE WHEN ReviewStatus = 'REJECTED' THEN 1 ELSE 0 END) as rejectedTasks
    FROM PemsTaskInstances
    ${scoped.where}
  `);
  return result.recordset[0] || {};
}

async function getTopPerformers(requester = null) {
  const pool = await getPool();
  // Two independent aggregates, so the scope clause is bound onto each request
  // separately — mssql request objects do not share parameters.
  const sellerScope = scopeWhere(requester, 'WHERE SellerId IS NOT NULL');
  const managerScope = scopeWhere(requester, 'WHERE AssignedTo IS NOT NULL');
  const sellerReq = pool.request();
  const managerReq = pool.request();
  applyScopeInputs(sellerReq, sellerScope.params, sql);
  applyScopeInputs(managerReq, managerScope.params, sql);

  const [sellers, managers] = await Promise.all([
    sellerReq.query(`
      SELECT TOP 5 SellerId, SellerName,
        COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
        ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement
      FROM PemsTaskInstances ${sellerScope.where}
      GROUP BY SellerId, SellerName ORDER BY completed DESC
    `),
    managerReq.query(`
      SELECT TOP 5 AssignedTo as UserId, AssigneeName as UserName,
        COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
        ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement
      FROM PemsTaskInstances ${managerScope.where}
      GROUP BY AssignedTo, AssigneeName ORDER BY completed DESC
    `),
  ]);
  return {
    topSellers: sellers.recordset.map(r => ({ ...r, avgAchievement: Math.round(r.avgAchievement * 100) / 100 })),
    topManagers: managers.recordset.map(r => ({ ...r, avgAchievement: Math.round(r.avgAchievement * 100) / 100 })),
  };
}

// ═══════════════════════════════════════════════════════
// V2: DYNAMIC DATA SOURCES
// ═══════════════════════════════════════════════════════

async function getSellersForPEMS(marketplace, requester = null) {
  const pool = await getPool();
  let where = 'WHERE IsActive = 1';
  const req = pool.request();
  if (marketplace && marketplace !== 'all') { where += ' AND Marketplace = @mp'; req.input('mp', sql.VarChar, marketplace); }

  // The seller picker is the entry point to every seller-scoped list, so it must
  // not advertise sellers the caller cannot act on. Restricted users get exactly
  // their assignment; an assignment of zero sellers yields an empty list.
  const scope = resolveSellerScope(requester, null);
  if (scope.unrestricted) {
    const all = await req.query(`SELECT Id, Name, Marketplace FROM Sellers ${where} ORDER BY Name`);
    return all.recordset;
  }
  if (!scope.sellerIds.length) return [];

  const placeholders = scope.sellerIds
    .map((id, i) => { const n = `ssp_${i}`; req.input(n, sql.VarChar, id); return `@${n}`; })
    .join(',');
  const result = await req.query(
    `SELECT Id, Name, Marketplace FROM Sellers ${where} AND Id IN (${placeholders}) ORDER BY Name`
  );
  return result.recordset;
}

/**
 * Assignee / reviewer pickers. Restricted users must not be offered people who
 * do not cover their sellers, otherwise a task can be handed to a reviewer who
 * could never be granted access to it. Global roles keep the full directory.
 * `roles` is the allow-list of role names for the picker.
 */
async function getPemsUserPicker(requester, roles, sellerId = null) {
  const pool = await getPool();
  const req = pool.request();
  const roleList = roles.map((r, i) => { const n = `pickRole${i}`; req.input(n, sql.VarChar, r); return `@${n}`; }).join(',');

  const scope = resolveSellerScope(requester, null);

  // A seller narrows the picker to the people who actually cover that brand, so
  // one brand's team never appears in another brand's dropdown. It can only
  // ever narrow within the requester's own scope: naming a seller you cannot
  // access returns nothing rather than falling back to the wider list.
  const wantedSeller = sellerId ? String(sellerId).trim() : '';
  if (wantedSeller) {
    const allowed = scope.unrestricted || scope.sellerIds.some(id => String(id) === wantedSeller);
    if (!allowed) return [];
    req.input('pickSellerOne', sql.VarChar, wantedSeller);
    const forSeller = await req.query(`
      SELECT DISTINCT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
      FROM Users u
      LEFT JOIN Roles r ON u.RoleId = r.Id
      LEFT JOIN UserSellers us ON us.UserId = u.Id
      WHERE r.Name IN (${roleList})
        AND (us.SellerId = @pickSellerOne
             OR r.Name IN ('admin', 'super_admin', 'developer', 'operational_manager'))
      ORDER BY u.FirstName
    `);
    return forSeller.recordset.map(u => ({ ...u, FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email }));
  }

  if (scope.unrestricted) {
    const all = await req.query(`
      SELECT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
      FROM Users u
      LEFT JOIN Roles r ON u.RoleId = r.Id
      WHERE r.Name IN (${roleList})
      ORDER BY u.FirstName
    `);
    return all.recordset.map(u => ({ ...u, FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email }));
  }
  if (!scope.sellerIds.length) return [];

  const sellerList = scope.sellerIds
    .map((id, i) => { const n = `pickSeller${i}`; req.input(n, sql.VarChar, id); return `@${n}`; })
    .join(',');
  const result = await req.query(`
    SELECT DISTINCT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.Id
    LEFT JOIN UserSellers us ON us.UserId = u.Id
    WHERE r.Name IN (${roleList})
      AND (us.SellerId IN (${sellerList}) OR r.Name IN ('admin', 'super_admin', 'developer', 'operational_manager'))
    ORDER BY u.FirstName
  `);
  return result.recordset.map(u => ({ ...u, FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email }));
}

/**
 * Picks the person who should own an automated task for `sellerId`.
 *
 * Rules previously did `SELECT TOP 1 UserId FROM UserSellers WHERE SellerId=@s`,
 * which is wrong twice over: with no ORDER BY it returns an arbitrary row, and
 * it never returns a *name* — so `PemsTaskInstances.AssigneeName` was written
 * empty and every ruleset task rendered as "Unknown" in the task list.
 *
 * Preference order:
 *   1. `preferredUserId` (usually the ruleset author) when they cover the
 *      seller, so automation does not silently hand work to a stranger.
 *   2. An active brand manager bound to that seller.
 *   3. An active operational manager / global role bound to that seller.
 * Ordering is deterministic (role rank, then name) so re-running a ruleset
 * assigns the same person instead of flipping between users.
 *
 * Returns null when nobody covers the seller, which leaves the task explicitly
 * unassigned rather than attributed to a user who cannot open it.
 */
async function resolveAssigneeForSeller(sellerId, preferredUserId = null) {
  if (!sellerId) return null;
  const pool = await getPool();

  if (preferredUserId && await userCoversSeller(preferredUserId, sellerId)) {
    const pref = await pool.request()
      .input('raPref', sql.VarChar, preferredUserId)
      .query('SELECT Id, FirstName, LastName, Email FROM Users WHERE Id = @raPref AND IsActive = 1');
    if (pref.recordset[0]) return toAssignee(pref.recordset[0]);
  }

  const rows = await pool.request()
    .input('raSeller', sql.VarChar, sellerId)
    .query(`
      SELECT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
      FROM UserSellers us
      JOIN Users u ON u.Id = us.UserId
      JOIN Roles r ON r.Id = u.RoleId
      WHERE us.SellerId = @raSeller
        AND u.IsActive = 1
        AND r.IsActive = 1
        AND r.Name IN ('brand_manager', 'operational_manager', 'admin', 'super_admin', 'developer')
      ORDER BY CASE r.Name
                 WHEN 'brand_manager' THEN 0
                 WHEN 'operational_manager' THEN 1
                 WHEN 'admin' THEN 2
                 WHEN 'super_admin' THEN 3
                 ELSE 4
               END,
               u.FirstName, u.LastName
    `);
  return rows.recordset[0] ? toAssignee(rows.recordset[0]) : null;
}

function toAssignee(u) {
  const name = `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email || '';
  return { id: u.Id, name };
}

/**
 * True when `userId` is bound to `sellerId` in UserSellers, or holds a global
 * role (which can legitimately cover any brand).
 *
 * Used to stop a task being assigned to someone who has no access to the seller
 * it belongs to: the assignee could never open the task, so the work would be
 * invisible to the person expected to do it. Brand-less tasks pass through.
 */
async function userCoversSeller(userId, sellerId) {
  if (!userId || !sellerId) return true;
  const pool = await getPool();
  const row = await pool.request()
    .input('covUid', sql.VarChar, userId)
    .input('covSid', sql.VarChar, sellerId)
    .query(`
      SELECT 1 AS ok FROM Users u
      JOIN Roles r ON r.Id = u.RoleId
      WHERE u.Id = @covUid
        AND (r.Name IN ('admin', 'super_admin', 'developer', 'operational_manager')
             OR EXISTS (SELECT 1 FROM UserSellers us WHERE us.UserId = u.Id AND us.SellerId = @covSid))
    `);
  return row.recordset.length > 0;
}

async function getBrandManagersForPEMS(requester = null, sellerId = null) {
  return getPemsUserPicker(requester, ['brand_manager', 'admin', 'super_admin', 'developer'], sellerId);
}

async function getReviewersForPEMS(requester = null, sellerId = null) {
  return getPemsUserPicker(requester, ['reviewer', 'operational_manager', 'admin', 'super_admin'], sellerId);
}

// ═══════════════════════════════════════════════════════
// V3: WEIGHTED PROGRESS
// ═══════════════════════════════════════════════════════

async function calculateWeightedProgress(taskInstanceId) {
  const pool = await getPool();
  const result = await pool.request().input('instId', sql.VarChar, taskInstanceId).query(`
    SELECT WeightagePct, IsCompleted, SubTaskCode, Title
    FROM PemsSubTasks WHERE TaskInstanceId = @instId ORDER BY SortOrder
  `);
  const subTasks = result.recordset;
  if (subTasks.length === 0) return 0;
  
  const totalWeight = subTasks.reduce((s, st) => s + (st.WeightagePct || 0), 0);
  if (totalWeight <= 0) {
    // Fallback to count-based if no weights
    const completed = subTasks.filter(st => st.IsCompleted).length;
    return Math.round((completed / subTasks.length) * 100);
  }
  
  const completedWeight = subTasks
    .filter(st => st.IsCompleted)
    .reduce((s, st) => s + (st.WeightagePct || 0), 0);
  
  return Math.round((completedWeight / totalWeight) * 100);
}

// ═══════════════════════════════════════════════════════
// V3: ASSIGNMENT RULES
// ═══════════════════════════════════════════════════════

async function upsertAssignmentRules(templateId, data) {
  // Delegates to the transaction-aware helper so the typed binding (INT/BIT vs
  // NVarChar) is defined in exactly one place.
  const pool = await getPool();
  return upsertAssignmentRulesTx(pool, templateId, data);
}

async function getAssignmentRules(templateId) {
  const pool = await getPool();
  const result = await pool.request().input('tid', sql.VarChar, templateId)
    .query('SELECT * FROM PemsAssignmentRules WHERE TemplateId = @tid');
  return result.recordset[0] || null;
}

// ═══════════════════════════════════════════════════════
// TEMPLATE CONFIGURATION: VALIDATION + TRANSACTIONAL SAVE
// ═══════════════════════════════════════════════════════

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_FREQUENCIES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM'];
const VALID_APPROVAL_LEVELS = ['single', 'dual', 'multi'];

/**
 * Backend source of truth for whether a template may be *published* (made
 * schedulable / active). The frontend mirrors these checks for usability, but
 * they must be enforced here because REST callers can bypass the UI.
 *
 * Returns { ok, errors:[{field, message}], warnings:[] }. `ok:false` means
 * publication must be blocked; drafts are always allowed to be saved.
 */
function validateTemplateForPublish(template, rules) {
  const t = template || {};
  const errors = [];
  const warnings = [];

  if (!t.name || !String(t.name).trim()) {
    errors.push({ field: 'name', message: 'Task name is required.' });
  }
  if (!t.taskCode || !String(t.taskCode).trim()) {
    errors.push({ field: 'taskCode', message: 'Task code is required.' });
  }
  if (!t.category || !String(t.category).trim()) {
    errors.push({ field: 'category', message: 'Category is required.' });
  }
  if (t.priority && !VALID_PRIORITIES.includes(String(t.priority).toUpperCase())) {
    errors.push({ field: 'priority', message: `Priority must be one of ${VALID_PRIORITIES.join(', ')}.` });
  }
  if (t.frequency && !VALID_FREQUENCIES.includes(String(t.frequency).toUpperCase())) {
    errors.push({ field: 'frequency', message: `Frequency must be one of ${VALID_FREQUENCIES.join(', ')}.` });
  }

  // Scheduling consistency: a recurring template must have a schedule, and a
  // one-time template must not pretend to run daily.
  const freq = String(t.frequency || 'ONE_TIME').toUpperCase();
  // An empty array means "no run days selected", not "scheduled on nothing".
  const hasRunDays = Array.isArray(t.runDays) ? t.runDays.length > 0 : Boolean(t.runDays);
  if (freq !== 'ONE_TIME') {
    if (!hasRunDays && !t.customCron) {
      errors.push({ field: 'schedule', message: 'A recurring template needs run days or a cron expression.' });
    }
    if (!t.dueTime) {
      warnings.push({ field: 'dueTime', message: 'No due time set; the routine will use the system default.' });
    }
  }

  // SOP completeness: at least one phase, and every phase needs a title and at
  // least one activity with instructions. Empty mandatory activities may never
  // pass publication.
  const phases = Array.isArray(t.subTaskDefinitions) ? t.subTaskDefinitions : [];
  if (phases.length === 0) {
    errors.push({ field: 'sop', message: 'At least one SOP phase is required before publishing.' });
  } else {
    phases.forEach((phase, pi) => {
      const acts = Array.isArray(phase.activities) ? phase.activities : [];
      if (!phase.title || !String(phase.title).trim()) {
        errors.push({ field: `sop.${pi}.title`, message: `Phase ${pi + 1} needs a title.` });
      }
      if (acts.length === 0) {
        errors.push({ field: `sop.${pi}.activities`, message: `Phase ${pi + 1} needs at least one activity.` });
      }
      acts.forEach((act, ai) => {
        if (act.isMandatory === false) return;
        if (!act.title || !String(act.title).trim()) {
          errors.push({ field: `sop.${pi}.${ai}.title`, message: `Phase ${pi + 1} activity ${ai + 1} needs a title.` });
        }
        if (!act.instructions || !String(act.instructions).trim()) {
          errors.push({ field: `sop.${pi}.${ai}.instructions`, message: `Phase ${pi + 1} activity ${ai + 1} is mandatory but has no instructions.` });
        }
      });
    });
  }

  // Reviewer / separation of duties at the template level.
  if (t.reviewRequired !== false && !t.reviewerId) {
    warnings.push({ field: 'reviewerId', message: 'Review is required but no reviewer is set; a default will be assigned.' });
  }

  // Assignment rules consistency.
  const r = rules || {};
  if (r.approvalLevel && !VALID_APPROVAL_LEVELS.includes(String(r.approvalLevel))) {
    errors.push({ field: 'approvalLevel', message: `Approval level must be one of ${VALID_APPROVAL_LEVELS.join(', ')}.` });
  }
  if (r.approvalLevel && String(r.approvalLevel) !== 'single') {
    // Multi/dual review is modelled but enforcement is not yet proven in the
    // workflow engine — publishing a template as multi-approval would be a lie.
    warnings.push({ field: 'approvalLevel', message: 'Dual/multi approval is stored but review enforcement is limited to single-approver today.' });
  }
  if (r.escalationHours !== undefined && r.escalationHours !== null) {
    const n = Number(r.escalationHours);
    if (Number.isNaN(n) || n < 0 || n > 720) {
      errors.push({ field: 'escalationHours', message: 'Escalation hours must be between 0 and 720.' });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Atomically persist a template and its assignment rules. Either both land or
 * neither does — a template can no longer be saved with silently-dropped rules
 * (the old frontend made two separate calls and swallowed the second failure).
 *
 * `id` null/undefined creates; otherwise updates. Returns { id, taskCode, created }.
 */
async function saveTemplateConfig({ id, template, assignmentRules, createdBy }, requester = null) {
  const tpl = template || {};
  const rules = assignmentRules || {};

  // Validate at the backend edge — never trust the caller.
  const validation = validateTemplateForPublish(tpl, rules);
  if (tpl.isActive && !validation.ok) {
    const err = new Error('Template cannot be published: ' + validation.errors.map(e => e.message).join(' '));
    err.status = 400;
    err.validation = validation;
    throw err;
  }

  return withTransaction(async (tx) => {
    let templateId = id;
    let taskCode = tpl.taskCode;
    let created = false;

    if (!templateId) {
      // Create inside the transaction.
      const countResult = await tx.request().query('SELECT COUNT(*) as c FROM PemsTaskTemplates');
      const generated = genCode('TPL', (countResult.recordset[0]?.c || 0) + 1);
      taskCode = tpl.taskCode ? String(tpl.taskCode).slice(0, 20) : generated;
      templateId = genId();
      created = true;

      const runDays = tpl.runDays === undefined || tpl.runDays === null || tpl.runDays === ''
        ? null : parseRunDays(tpl.runDays).join(',');
      const dueTime = tpl.dueTime ? parseHHmm(tpl.dueTime).text : null;
      const assigneeUserIds = Array.isArray(tpl.assigneeUserIds) && tpl.assigneeUserIds.length
        ? JSON.stringify(tpl.assigneeUserIds) : null;

      await tx.request()
        .input('id', sql.VarChar, templateId)
        .input('taskCode', sql.VarChar, taskCode)
        .input('name', sql.NVarChar, tpl.name)
        .input('description', sql.NVarChar, tpl.description || '')
        .input('category', sql.VarChar, tpl.category || 'GENERAL')
        .input('department', sql.VarChar, tpl.department || 'OPERATIONS')
        .input('frequency', sql.VarChar, tpl.frequency || 'ONE_TIME')
        .input('customCron', sql.NVarChar, tpl.customCron || null)
        .input('slaHours', sql.Int, tpl.slaHours || 48)
        .input('tatHours', sql.Int, tpl.tatHours || 24)
        .input('priority', sql.VarChar, tpl.priority || 'MEDIUM')
        .input('targetType', sql.VarChar, tpl.targetType || 'NUMERIC')
        .input('defaultTarget', sql.Decimal(18, 2), tpl.defaultTarget || 0)
        .input('expectedOutput', sql.NVarChar, tpl.expectedOutput || '')
        .input('reviewerId', sql.VarChar, tpl.reviewerId || null)
        .input('assigneeRole', sql.VarChar, tpl.assigneeRole || 'brand_manager')
        .input('activities', sql.NVarChar(sql.MAX), JSON.stringify(tpl.activities || []))
        .input('subTaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(tpl.subTaskDefinitions || []))
        .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(tpl.tags || []))
        .input('isActive', sql.Bit, tpl.isActive ? 1 : 0)
        .input('reviewRequired', sql.Bit, tpl.reviewRequired === false ? 0 : 1)
        .input('criticalityScore', sql.Int, Math.min(10, Math.max(1, parseInt(tpl.criticalityScore, 10) || 5)))
        .input('estMinutes', sql.Int, Math.max(1, parseInt(tpl.estimatedExecutionMinutes, 10) || 60))
        .input('createdBy', sql.VarChar, createdBy || null)
        .input('autoAssign', sql.Bit, tpl.autoAssign ? 1 : 0)
        .input('dueTime', sql.VarChar, dueTime)
        .input('runDays', sql.VarChar, runDays)
        .input('assigneeUserIds', sql.NVarChar(sql.MAX), assigneeUserIds)
        .input('brandMode', sql.VarChar, tpl.brandMode === 'CHECKLIST' ? 'CHECKLIST' : 'NONE')
        .query(`
          INSERT INTO PemsTaskTemplates
            (Id, TaskCode, Name, Description, Category, Department, Frequency, CustomCron,
             SLAHours, TATHours, Priority, TargetType, DefaultTarget, ExpectedOutput,
             ReviewerId, AssigneeRole, Activities, SubTaskDefinitions, Tags, IsActive,
             ReviewRequired, CriticalityScore, EstimatedExecutionMinutes, CreatedBy,
             AutoAssign, DueTime, RunDays, AssigneeUserIds, BrandMode)
          VALUES
            (@id, @taskCode, @name, @description, @category, @department, @frequency, @customCron,
             @slaHours, @tatHours, @priority, @targetType, @defaultTarget, @expectedOutput,
             @reviewerId, @assigneeRole, @activities, @subTaskDefinitions, @tags, @isActive,
             @reviewRequired, @criticalityScore, @estMinutes, @createdBy,
             @autoAssign, @dueTime, @runDays, @assigneeUserIds, @brandMode)
        `);
    } else {
      const existing = await tx.request().input('id', sql.VarChar, templateId)
        .query('SELECT Id, TaskCode FROM PemsTaskTemplates WHERE Id = @id');
      if (!existing.recordset.length) {
        const err = new Error('Template not found');
        err.status = 404;
        throw err;
      }
      taskCode = existing.recordset[0].TaskCode;

      const sets = [];
      const req = tx.request().input('id', sql.VarChar, templateId);
      const nvar = ['Name', 'Description', 'Category', 'Department', 'Frequency', 'CustomCron', 'Priority', 'TargetType', 'ExpectedOutput', 'ReviewerId', 'AssigneeRole'];
      nvar.forEach(f => {
        const key = f.charAt(0).toLowerCase() + f.slice(1);
        if (tpl[key] !== undefined) { sets.push(`${f} = @${f}`); req.input(f, sql.NVarChar, tpl[key] === null ? null : String(tpl[key])); }
      });
      const ints = { SLAHours: 'slaHours', TATHours: 'tatHours', CriticalityScore: 'criticalityScore', EstimatedExecutionMinutes: 'estimatedExecutionMinutes' };
      Object.entries(ints).forEach(([col, key]) => {
        if (tpl[key] !== undefined && tpl[key] !== null && tpl[key] !== '') {
          let v = parseInt(tpl[key], 10); if (Number.isNaN(v)) return;
          if (col === 'CriticalityScore') v = Math.min(10, Math.max(1, v));
          sets.push(`${col} = @${col}`); req.input(col, sql.Int, v);
        }
      });
      if (tpl.defaultTarget !== undefined && tpl.defaultTarget !== null && tpl.defaultTarget !== '') {
        sets.push('DefaultTarget = @DefaultTarget'); req.input('DefaultTarget', sql.Decimal(18, 2), Number(tpl.defaultTarget) || 0);
      }
      if (tpl.autoAssign !== undefined) { sets.push('AutoAssign = @AutoAssign'); req.input('AutoAssign', sql.Bit, tpl.autoAssign ? 1 : 0); }
      if (tpl.brandMode !== undefined) { sets.push('BrandMode = @BrandMode'); req.input('BrandMode', sql.VarChar, tpl.brandMode === 'CHECKLIST' ? 'CHECKLIST' : 'NONE'); }
      if (tpl.dueTime !== undefined) { sets.push('DueTime = @DueTime'); req.input('DueTime', sql.VarChar, tpl.dueTime ? parseHHmm(tpl.dueTime).text : null); }
      if (tpl.runDays !== undefined) { sets.push('RunDays = @RunDays'); req.input('RunDays', sql.VarChar, tpl.runDays === null || tpl.runDays === '' ? null : parseRunDays(tpl.runDays).join(',')); }
      if (tpl.assigneeUserIds !== undefined) {
        const ids = Array.isArray(tpl.assigneeUserIds) ? tpl.assigneeUserIds.filter(Boolean) : [];
        sets.push('AssigneeUserIds = @AssigneeUserIds'); req.input('AssigneeUserIds', sql.NVarChar(sql.MAX), ids.length ? JSON.stringify(ids) : null);
      }
      ['isActive', 'reviewRequired'].forEach(key => {
        if (tpl[key] !== undefined) {
          const col = key.charAt(0).toUpperCase() + key.slice(1);
          sets.push(`${col} = @${col}`); req.input(col, sql.Bit, tpl[key] ? 1 : 0);
        }
      });
      if (tpl.activities) { sets.push('Activities = @Activities'); req.input('Activities', sql.NVarChar(sql.MAX), JSON.stringify(tpl.activities)); }
      if (tpl.subTaskDefinitions) { sets.push('SubTaskDefinitions = @SubTaskDefinitions'); req.input('SubTaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(tpl.subTaskDefinitions)); }
      if (tpl.tags) { sets.push('Tags = @Tags'); req.input('Tags', sql.NVarChar(sql.MAX), JSON.stringify(tpl.tags)); }

      if (sets.length) {
        sets.push('UpdatedAt = dbo.GetEnvDate()');
        await req.query(`UPDATE PemsTaskTemplates SET ${sets.join(', ')} WHERE Id = @id`);
      }
    }

    // Assignment rules — same transaction, so a failure rolls back the template.
    if (Object.keys(rules).length > 0) {
      await upsertAssignmentRulesTx(tx, templateId, rules);
    }

    return { id: templateId, taskCode, created, validation };
  });
}

/** Assignment-rules upsert bound to a transaction (shared by saveTemplateConfig). */
async function upsertAssignmentRulesTx(tx, templateId, data) {
  const existing = await tx.request().input('tid', sql.VarChar, templateId)
    .query('SELECT Id FROM PemsAssignmentRules WHERE TemplateId = @tid');

  if (existing.recordset.length > 0) {
    const sets = [];
    const req = tx.request().input('tid', sql.VarChar, templateId);
    const fields = {
      AssignmentMode: [data.assignmentMode, sql.NVarChar],
      AutoAssignStrategy: [data.autoAssignStrategy, sql.NVarChar],
      ReviewerId: [data.reviewerId, sql.VarChar],
      BackupReviewerId: [data.backupReviewerId, sql.VarChar],
      EscalationHours: [data.escalationHours, sql.Int],
      ApprovalLevel: [data.approvalLevel, sql.NVarChar],
      QualityScoreRequired: [data.qualityScoreRequired, sql.Bit],
    };
    Object.entries(fields).forEach(([k, [v, type]]) => {
      if (v === undefined) return;
      sets.push(`${k} = @${k}`);
      if (type === sql.Bit) req.input(k, sql.Bit, v ? 1 : 0);
      else if (type === sql.Int) req.input(k, sql.Int, v === null ? null : Number(v));
      else req.input(k, type, v === null ? null : String(v));
    });
    if (sets.length) await req.query(`UPDATE PemsAssignmentRules SET ${sets.join(', ')} WHERE TemplateId = @tid`);
  } else {
    await tx.request()
      .input('id', sql.VarChar, genId())
      .input('tid', sql.VarChar, templateId)
      .input('mode', sql.NVarChar, data.assignmentMode || 'manual')
      .input('strategy', sql.NVarChar, data.autoAssignStrategy || 'lowest_workload')
      .input('reviewer', sql.VarChar, data.reviewerId || null)
      .input('backup', sql.VarChar, data.backupReviewerId || null)
      .input('escHrs', sql.Int, data.escalationHours || 24)
      .input('approval', sql.NVarChar, data.approvalLevel || 'single')
      .input('qsReq', sql.Bit, data.qualityScoreRequired ? 1 : 0)
      .query(`INSERT INTO PemsAssignmentRules (Id, TemplateId, AssignmentMode, AutoAssignStrategy, ReviewerId, BackupReviewerId, EscalationHours, ApprovalLevel, QualityScoreRequired)
        VALUES (@id, @tid, @mode, @strategy, @reviewer, @backup, @escHrs, @approval, @qsReq)`);
  }
}

// ═══════════════════════════════════════════════════════
// V3: TEMPLATE DETAIL ANALYTICS
// ═══════════════════════════════════════════════════════

async function getTemplateAnalytics(templateId) {
  const pool = await getPool();
  const r = await pool.request().input('tid', sql.VarChar, templateId).query(`
    SELECT 
      COUNT(*) as totalInstances,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completedInstances,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(AVG(WeightedProgressPct), 0) as avgProgress,
      ISNULL(AVG(ProgressPct), 0) as avgCountProgress
    FROM PemsTaskInstances WHERE TemplateId = @tid
  `);
  const d = r.recordset[0] || {};
  return {
    totalInstances: d.totalInstances || 0,
    completedInstances: d.completedInstances || 0,
    completionRate: d.totalInstances > 0 ? Math.round((d.completedInstances / d.totalInstances) * 100) : 0,
    slaCompliance: d.totalInstances > 0 ? Math.round(((d.totalInstances - (d.slaBreached || 0)) / d.totalInstances) * 100) : 100,
    avgAchievementPct: Math.round((d.avgAchievementPct || 0) * 100) / 100,
    avgProgress: Math.round((d.avgProgress || d.avgCountProgress || 0) * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════
// V3: RECALCULATE WEIGHTED PROGRESS
// ═══════════════════════════════════════════════════════

async function recalculateAllWeightedProgress() {
  const pool = await getPool();
  const instances = await pool.request()
    .query("SELECT Id FROM PemsTaskInstances WHERE Status NOT IN ('APPROVED','CANCELLED')");
  
  let updated = 0;
  for (const inst of instances.recordset) {
    const wp = await calculateWeightedProgress(inst.Id);
    await pool.request()
      .input('id', sql.VarChar, inst.Id)
      .input('wp', sql.Decimal(5, 2), wp)
      .query('UPDATE PemsTaskInstances SET WeightedProgressPct = @wp WHERE Id = @id');
    updated++;
  }
  return { updated };
}

// ═══════════════════════════════════════════════════════
// AUTOMATION (RULESET) STATS
// ═══════════════════════════════════════════════════════

/**
 * Counts ruleset-generated tasks for the automation KPI panel.
 *
 * Automation tasks are PemsTaskInstances with Source='RULESET' (see the
 * isAutomated filter in getInstances). Scoped to the caller's sellers like
 * every other tasks query — this feeds a dashboard tile, so an unscoped count
 * would leak another seller's volume at a glance.
 */
async function getAutomationStats(filters = {}, requester = null) {
  const pool = await getPool();
  const scope = resolveSellerScope(requester, filters.sellerId);
  const { clause, params } = buildScopeClause(scope, 'i');

  const openStatuses = "('ASSIGNED','IN_PROGRESS','UNDER_REVIEW','PENDING_REVIEW','REWORK')";

  const request = pool.request();
  const query = `
    SELECT
      COUNT(*) AS total,
      -- [open] must stay bracketed: OPEN is a reserved word in T-SQL
      -- (OPENROWSET/OPENQUERY), and an unbracketed \`AS open\` alias fails the
      -- whole query with "Incorrect syntax near the keyword 'open'".
      SUM(CASE WHEN i.Status IN ${openStatuses} THEN 1 ELSE 0 END) AS [open],
      SUM(CASE WHEN i.DueDate < GETDATE() AND i.Status IN ${openStatuses} THEN 1 ELSE 0 END) AS overdue
    FROM PemsTaskInstances i
    WHERE i.Source = 'RULESET'${clause}
  `;

  // Same clause, three summaries — bind onto the one request we use.
  const bind = (r) => params.forEach(([name, value]) => r.input(name, sql.VarChar, value));
  bind(request);

  const r = await request.query(query);
  const d = r.recordset[0] || {};

  // Per-ruleset breakdown, using the same scope.
  const byRequest = pool.request();
  bind(byRequest);
  const byRuleset = await byRequest.query(`
    SELECT ISNULL(i.SourceRef, 'Unassigned') AS RulesetRef,
           COUNT(*) AS count,
           SUM(CASE WHEN i.Status IN ${openStatuses} THEN 1 ELSE 0 END) AS [open]
    FROM PemsTaskInstances i
    WHERE i.Source = 'RULESET'${clause}
    GROUP BY ISNULL(i.SourceRef, 'Unassigned')
    ORDER BY COUNT(*) DESC
  `);

  return {
    total: Number(d.total || 0),
    open: Number(d.open || 0),
    overdue: Number(d.overdue || 0),
    byRuleset: byRuleset.recordset.map((row) => ({
      ruleset: row.RulesetRef,
      count: Number(row.count || 0),
      open: Number(row.open || 0),
    })),
  };
}

module.exports = {
  addComment, verifyFix, setBrandCheck,
  bulkTransition,
  submitReviewAndTransition,
  createTemplate, getTemplates, getTemplateSummary, getTemplateById, updateTemplate, deleteTemplate,
  createInstance, getInstances, getInstanceById,
  transitionStatus,
  completeSubTask, completeActivity,
  uploadEvidence,
  getInstanceAsins, updateAsinRemarks, resolveAsin,
  submitReview,
  updateAchievement, refreshSLAStatuses,
  getDashboardKPIs, getSellerPerformance,
  // V2 additions
  createNotification, getNotifications, getUnreadCount, markNotificationRead, markAllRead,
  getDepartmentPerformance, getBrandManagerPerformance, getReviewerPerformance,
  bulkReview, getReviewStats, getMyDay,
  checkEscalations, getRiskPanel, getTopPerformers,
  getSellersForPEMS, getBrandManagersForPEMS, getReviewersForPEMS, userCoversSeller, resolveAssigneeForSeller,
  getOosAffectedAsins,
  // V3 additions
  calculateWeightedProgress, upsertAssignmentRules, getAssignmentRules,
  getTemplateAnalytics, recalculateAllWeightedProgress,
  getAutomationStats,
  // Template configuration (validation + transactional save)
  validateTemplateForPublish, saveTemplateConfig,
};
