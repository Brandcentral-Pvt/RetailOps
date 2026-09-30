const { sql, getPool, generateId, withTransaction } = require('../../database/db');
const { canTransition, calculateSLAStatus, calculateAchievement, calculateVariance, getNextDueDate, getTransitionTimestamps, resolveReviewTransition, WORKFLOW_STATUSES } = require('./workflowEngine');
const { canActOnTask } = require('./pemsPolicy');
const { isGlobalUserRole } = require('../../utils/roleUtils');
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
      .query('SELECT Department, SubTaskDefinitions FROM PemsTaskTemplates WHERE Id = @tplId');
    tplRow = tplResult.recordset[0];
  }
  const department = data.department || tplRow?.Department || 'Operations';

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
    .query(`
      INSERT INTO PemsTaskInstances
        (Id, InstanceCode, TemplateId, SellerId, SellerName, AssignedTo, AssigneeName,
         ReviewerId, ReviewerName, Department, Status, ReviewStatus, Frequency, Title, Description,
         Priority, Target, Achievement, SLAStatus, SLAHours, DueDate, AssignedAt,
         Attachments, Tags, Source, SourceId, SourceRef, Asins, Category)
      VALUES
        (@id, @instanceCode, @templateId, @sellerId, @sellerName, @assignedTo, @assigneeName,
         @reviewerId, @reviewerName, @department, @status, @reviewStatus, @frequency, @title, @description,
         @priority, @target, @achievement, @slaStatus, @slaHours, @dueDate, @assignedAt,
         @attachments, @tags, @source, @sourceId, @sourceRef, @asins, @category)
    `);

  // Create subtasks from template definitions
  // Fetch template's SOP if subTaskDefinitions not provided in request
  let subTaskDefs = data.subTaskDefinitions;
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
            .query(`
              INSERT INTO PemsActivities (Id, SubTaskId, TaskInstanceId, StepNo, Title, Instructions, ExpectedOutput, SupportDocuments, IsMandatory)
              VALUES (@id, @subTaskId, @taskInstanceId, @stepNo, @title, @instructions, @expectedOutput, @supportDocuments, @isMandatory)
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

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 25;
  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy || 'CreatedAt';
  const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const allowedSorts = ['CreatedAt', 'DueDate', 'Priority', 'Status', 'AchievementPct', 'SLAStatus', 'InstanceCode', 'Department', 'Frequency', 'SubmittedAt', 'UpdatedAt', 'ReviewedAt'];
  const sortCol = allowedSorts.includes(sortBy) ? sortBy : 'CreatedAt';

  const countReq = pool.request();
  applyFilterInputs(countReq, filters);
  sellerScope.params.forEach(([n, v]) => countReq.input(n, sql.VarChar, v));
  if (filters.dueBefore) countReq.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore));
  if (filters.dueAfter) countReq.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter));
  const countResult = await countReq.query(`SELECT COUNT(*) as total FROM PemsTaskInstances i ${where}`);
  const total = countResult.recordset[0].total;

  const dataReq = pool.request();
  applyFilterInputs(dataReq, filters);
  sellerScope.params.forEach(([n, v]) => dataReq.input(n, sql.VarChar, v));
  if (filters.dueBefore) dataReq.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore));
  if (filters.dueAfter) dataReq.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter));
  dataReq.input('offset', sql.Int, offset);
  dataReq.input('limit', sql.Int, limit);

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

  const result = await dataReq.query(`
    SELECT i.*, t.Name as TemplateName, t.TaskCode as TemplateCode, t.Category as TemplateCategory${reviewMetaSelect}
    FROM PemsTaskInstances i
    LEFT JOIN PemsTaskTemplates t ON i.TemplateId = t.Id
    ${where}
    ORDER BY ${orderExpr}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  let instances = result.recordset.map(r => ({ ...r, Tags: safeParse(r.Tags, []), Attachments: safeParse(r.Attachments, []) }));

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

  if (filters.includeRuleTasks === 'true') {
    const ruleReq = pool.request();
    let ruleWhere = "WHERE a.Status IN ('PENDING','IN_PROGRESS') AND a.Type = 'automated'";
    if (filters.sellerId) { ruleWhere += ' AND a.SellerId = @ruleSellerId'; ruleReq.input('ruleSellerId', sql.VarChar, filters.sellerId); }
    if (filters.priority) { ruleWhere += ' AND a.Priority = @rulePriority'; ruleReq.input('rulePriority', sql.VarChar, filters.priority); }
    try {
      const ruleResult = await ruleReq.query(`
        SELECT a.Id, a.Title, a.Status, a.Priority, a.SellerId, s.Name as SellerName,
               a.AssignedTo, a.CreatedAt, a.DueDate, a.Description, a.Asins, a.SubTasks,
               a.SubTaskProgress, a.Category as Department
        FROM Actions a
        LEFT JOIN Sellers s ON a.SellerId = s.Id
        ${ruleWhere}
        ORDER BY a.CreatedAt DESC
      `);
      const ruleTasks = ruleResult.recordset.map(r => ({
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
      instances = [...ruleTasks, ...instances];
    } catch (e) { console.error('Failed to fetch rule tasks:', e.message); }
  }

  return { instances, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getInstanceById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query(`
    SELECT i.*, t.Name as TemplateName, t.TaskCode as TemplateCode, t.Category as TemplateCategory,
           t.Activities as TemplateActivities, t.SubTaskDefinitions as TemplateSubTasks
    FROM PemsTaskInstances i
    LEFT JOIN PemsTaskTemplates t ON i.TemplateId = t.Id
    WHERE i.Id = @id
  `);
  const instance = result.recordset[0];
  if (!instance) return null;

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

async function transitionStatus(taskInstanceId, toStatus, actorId, actorName, actorRole, details, tx) {
  const pool = tx || (await getPool());
  const instanceResult = await pool.request()
    .input('id', sql.VarChar, taskInstanceId)
    .query('SELECT Status, AssignedTo, AssigneeName, ReviewerId, ReviewerName, DueDate, SLAHours, Title FROM PemsTaskInstances WHERE Id = @id');
  const instance = instanceResult.recordset[0];
  if (!instance) throw new Error('Task instance not found');

  if (!canTransition(instance.Status, toStatus)) {
    throw new Error(`Invalid transition: ${instance.Status} → ${toStatus}`);
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
    if (details) {
      sets.push('SubmissionRemarks = @submissionRemarks');
      req.input('submissionRemarks', sql.NVarChar(sql.MAX), details);
    }
  }

  await req.query(`UPDATE PemsTaskInstances SET ${sets.join(', ')} WHERE Id = @id`);

  await writeAuditLog(taskInstanceId, 'STATUS_CHANGED', instance.Status, toStatus, actorId, actorName, details || `Status changed to ${toStatus}`, tx);

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
async function bulkTransition(taskIds, toStatus, actorId, actorName, actorRole, details) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) throw new Error('No task ids provided');
  if (!WORKFLOW_STATUSES[toStatus]) throw new Error(`Unknown status: ${toStatus}`);
  if (taskIds.length > 200) throw new Error('Too many tasks (max 200 per bulk operation)');

  const pool = await getPool();
  const updated = [];
  const skipped = [];

  for (const id of taskIds) {
    try {
      const inst = await pool.request().input('id', sql.VarChar, id)
        .query('SELECT Status, AssignedTo, ReviewerId FROM PemsTaskInstances WHERE Id = @id');
      const row = inst.recordset[0];
      if (!row) { skipped.push({ id, reason: 'NOT_FOUND' }); continue; }
      if (!canActOnTask({ Id: actorId, role: actorRole }, row)) {
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
  return withTransaction(async (tx) => {
  const pool = tx;
  await pool.request()
    .input('id', sql.VarChar, subTaskId)
    .query("UPDATE PemsSubTasks SET IsCompleted = 1, Status = 'COMPLETED', CompletedAt = dbo.GetEnvDate() WHERE Id = @id");

  const st = await pool.request().input('id', sql.VarChar, subTaskId).query('SELECT TaskInstanceId FROM PemsSubTasks WHERE Id = @id');
  if (st.recordset[0]) {
    const instId = st.recordset[0].TaskInstanceId;
    // Recalculate progress
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
    await writeAuditLog(instId, 'SUBTASK_COMPLETED', null, null, actorId, actorName, `Subtask completed`, tx);
    eventBus.emit(eventBus.EVENTS.SUBTASK_COMPLETED, { taskInstanceId: instId, subTaskId, actorId, actorName });
  }
  });
}

/**
 * Tick / un-tick a brand on a multi-brand task (or all of them when brandRowId is omitted).
 * Only while the work is open — same window in which steps can be ticked.
 */
async function setBrandCheck(taskId, brandRowId, completed, actorId, note) {
  const pool = await getPool();
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
  return { total: counts.total, done: counts.done };
}

async function completeActivity(activityId, actorId, actorName) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, activityId)
    .input('actorId', sql.VarChar, actorId)
    .query("UPDATE PemsActivities SET IsCompleted = 1, CompletedAt = dbo.GetEnvDate(), CompletedBy = @actorId WHERE Id = @id");
}

// ═══════════════════════════════════════════════════════
// EVIDENCE
// ═══════════════════════════════════════════════════════

async function uploadEvidence(data) {
  const pool = await getPool();
  const id = genId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskInstanceId', sql.VarChar, data.taskInstanceId)
    .input('subTaskId', sql.VarChar, data.subTaskId || null)
    .input('activityId', sql.VarChar, data.activityId || null)
    .input('fileName', sql.NVarChar, data.fileName)
    .input('fileUrl', sql.NVarChar, data.fileUrl)
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
  await writeAuditLog(data.taskInstanceId, 'EVIDENCE_UPLOADED', null, null, data.uploadedBy, data.uploadedByName, `Evidence uploaded: ${data.fileName}`);
  return { id };
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
      .query('SELECT Status, AssignedTo, ReviewerId FROM PemsTaskInstances WITH (UPDLOCK, ROWLOCK) WHERE Id = @id');
    const task = cur.recordset[0];
    if (!task) throw new Error('Task instance not found');

    if (!REVIEWABLE_STATUSES.includes(task.Status)) {
      throw new Error(`Task is ${task.Status} and is not awaiting review`);
    }
    const actorRole = String(actor.role?.name || actor.role || '').toLowerCase();
    if (!isGlobalUserRole(actorRole) && task.AssignedTo && task.AssignedTo === actor.id) {
      throw new Error('You cannot review a task that is assigned to you');
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
        .query('SELECT Id, AssignedTo, ReviewerId FROM PemsTaskInstances WHERE Id = @id');
      const row = r.recordset[0];
      if (!row) { skipped.push({ id, reason: 'Task not found' }); continue; }
      if (!canActOnTask(user, row)) { skipped.push({ id, reason: 'No access to this task' }); continue; }
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

  const windowStats = async (fromDays, toDays) => {
    const rq = pool.request().input('fromDays', sql.Int, fromDays).input('toDays', sql.Int, toDays);
    if (scoped) rq.input('uid', sql.VarChar, uid);
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
        AND r.CreatedAt <  DATEADD(DAY, -@toDays, dbo.GetEnvDate())${scopeSql}
    `);
    const rq2 = pool.request().input('fromDays', sql.Int, fromDays).input('toDays', sql.Int, toDays);
    if (scoped) rq2.input('uid', sql.VarChar, uid);
    const sla = await rq2.query(`
      SELECT COUNT(*) AS approvedTotal,
        SUM(CASE WHEN i.DueDate IS NULL OR i.CompletedAt <= i.DueDate THEN 1 ELSE 0 END) AS onTime
      FROM PemsTaskInstances i
      WHERE i.Status = 'APPROVED' AND i.CompletedAt IS NOT NULL
        AND i.CompletedAt >= DATEADD(DAY, -@fromDays, dbo.GetEnvDate())
        AND i.CompletedAt <  DATEADD(DAY, -@toDays, dbo.GetEnvDate())${scopeSql}
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
  const mine = await mineReq.query(`
    SELECT
      SUM(CASE WHEN CAST(CreatedAt AS DATE) = CAST(dbo.GetEnvDate() AS DATE) THEN 1 ELSE 0 END) AS reviewsToday,
      SUM(CASE WHEN CreatedAt >= DATEADD(DAY, -7, dbo.GetEnvDate()) THEN 1 ELSE 0 END) AS reviewsWeek,
      COUNT(*) AS reviews30,
      SUM(CASE WHEN Decision = 'APPROVE' THEN 1 ELSE 0 END) AS approved30,
      AVG(CAST(ReviewDurationMinutes AS FLOAT)) AS avgMinutesSpent,
      AVG(CAST(QualityScore AS FLOAT)) AS avgQuality
    FROM PemsTaskReviews
    WHERE ReviewerId = @uid AND CreatedAt >= DATEADD(DAY, -30, dbo.GetEnvDate())
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

  const actionableQ = pool.request().input('uid', sql.VarChar, uid).query(`
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
    WHERE i.AssignedTo = @uid AND i.Status IN (${inList(MYDAY_ACTIONABLE)})
    ORDER BY i.DueDate ASC
  `);

  const waitingQ = pool.request().input('uid', sql.VarChar, uid).query(`
    SELECT TOP 30 i.Id, i.InstanceCode, i.Title, i.Priority, i.Status, i.DueDate, i.SubmittedAt, i.ReviewerName
    FROM PemsTaskInstances i
    WHERE i.AssignedTo = @uid AND i.Status IN (${inList(MYDAY_IN_REVIEW)})
    ORDER BY i.SubmittedAt ASC
  `);

  const reviewsQ = pool.request().input('uid', sql.VarChar, uid).query(`
    SELECT TOP 50 i.Id, i.InstanceCode, i.Title, i.Priority, i.Status, i.DueDate, i.SubmittedAt, i.AssigneeName, i.SellerName
    FROM PemsTaskInstances i
    WHERE i.ReviewerId = @uid AND (i.AssignedTo IS NULL OR i.AssignedTo <> @uid)
      AND i.Status IN (${inList(MYDAY_IN_REVIEW)})
    ORDER BY i.SubmittedAt ASC
  `);

  const doneQ = pool.request().input('uid', sql.VarChar, uid).query(`
    SELECT TOP 30 i.Id, i.InstanceCode, i.Title, i.Priority, i.Status, i.SubmittedAt, i.CompletedAt
    FROM PemsTaskInstances i
    WHERE i.AssignedTo = @uid
      AND (CAST(i.SubmittedAt AS DATE) = CAST(dbo.GetEnvDate() AS DATE)
        OR CAST(i.CompletedAt AS DATE) = CAST(dbo.GetEnvDate() AS DATE))
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

async function getDashboardKPIs(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assignedTo) { where += ' AND AssignedTo = @assignedTo'; req.input('assignedTo', sql.VarChar, filters.assignedTo); }
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

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

async function getSellerPerformance(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE SellerId IS NOT NULL';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

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

async function getDepartmentPerformance(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

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

async function getBrandManagerPerformance(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE AssignedTo IS NOT NULL';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND i.CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND i.CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }
  if (filters.department) { where += ' AND i.Department = @department'; req.input('department', sql.NVarChar, filters.department); }

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

async function getReviewerPerformance(filters = {}) {
  const pool = await getPool();
  const result = await pool.request()
    .query(`
      SELECT ReviewerId, ReviewerName,
        COUNT(*) as totalReviews,
        SUM(CASE WHEN Decision = 'APPROVE' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN Decision = 'REJECT' THEN 1 ELSE 0 END) as rejected,
        ISNULL(AVG(QualityScore), 0) as avgQualityScore,
        ISNULL(AVG(ReviewDurationMinutes), 0) as avgReviewTime
      FROM PemsTaskReviews
      GROUP BY ReviewerId, ReviewerName
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
  let offset = 0;
  let escalated = 0;

  while (true) {
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

    offset += BATCH_SIZE;
  }
  return { escalated };
}

// ═══════════════════════════════════════════════════════
// V2: ENHANCED DASHBOARD
// ═══════════════════════════════════════════════════════

async function getRiskPanel() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreaches,
      SUM(CASE WHEN Status IN ('ASSIGNED', 'IN_PROGRESS', 'REWORK') AND DueDate < dbo.GetEnvDate() THEN 1 ELSE 0 END) as overdueTasks,
      SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as pendingReviews,
      SUM(CASE WHEN ReviewStatus = 'REJECTED' THEN 1 ELSE 0 END) as rejectedTasks
    FROM PemsTaskInstances
    WHERE Status NOT IN ('CANCELLED')
  `);
  return result.recordset[0] || {};
}

async function getTopPerformers() {
  const pool = await getPool();
  const [sellers, managers] = await Promise.all([
    pool.request().query(`
      SELECT TOP 5 SellerId, SellerName,
        COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
        ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement
      FROM PemsTaskInstances WHERE SellerId IS NOT NULL
      GROUP BY SellerId, SellerName ORDER BY completed DESC
    `),
    pool.request().query(`
      SELECT TOP 5 AssignedTo as UserId, AssigneeName as UserName,
        COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
        ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement
      FROM PemsTaskInstances WHERE AssignedTo IS NOT NULL
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

async function getSellersForPEMS(marketplace) {
  const pool = await getPool();
  let where = 'WHERE IsActive = 1';
  const req = pool.request();
  if (marketplace && marketplace !== 'all') { where += ' AND Marketplace = @mp'; req.input('mp', sql.VarChar, marketplace); }
  const result = await req.query(`SELECT Id, Name, Marketplace FROM Sellers ${where} ORDER BY Name`);
  return result.recordset;
}

async function getBrandManagersForPEMS() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.Id
    WHERE r.Name IN ('brand_manager', 'admin', 'super_admin', 'developer')
    ORDER BY u.FirstName
  `);
  return result.recordset.map(u => ({
    ...u,
    FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email,
  }));
}

async function getReviewersForPEMS() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.Id
    WHERE r.Name IN ('reviewer', 'operational_manager', 'admin', 'super_admin')
    ORDER BY u.FirstName
  `);
  return result.recordset.map(u => ({
    ...u,
    FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email,
  }));
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
  const pool = await getPool();
  const existing = await pool.request().input('tid', sql.VarChar, templateId)
    .query('SELECT Id FROM PemsAssignmentRules WHERE TemplateId = @tid');
  
  if (existing.recordset.length > 0) {
    const sets = [];
    const req = pool.request().input('tid', sql.VarChar, templateId);
    const fields = {
      AssignmentMode: data.assignmentMode,
      AutoAssignStrategy: data.autoAssignStrategy,
      ReviewerId: data.reviewerId,
      BackupReviewerId: data.backupReviewerId,
      EscalationHours: data.escalationHours,
      ApprovalLevel: data.approvalLevel,
      QualityScoreRequired: data.qualityScoreRequired,
    };
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined) { sets.push(`${k} = @${k}`); req.input(k, sql.NVarChar, v); }
    });
    if (sets.length > 0) {
      await req.query(`UPDATE PemsAssignmentRules SET ${sets.join(', ')} WHERE TemplateId = @tid`);
    }
  } else {
    const id = genId();
    await pool.request()
      .input('id', sql.VarChar, id)
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

async function getAssignmentRules(templateId) {
  const pool = await getPool();
  const result = await pool.request().input('tid', sql.VarChar, templateId)
    .query('SELECT * FROM PemsAssignmentRules WHERE TemplateId = @tid');
  return result.recordset[0] || null;
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

module.exports = {
  addComment, verifyFix, setBrandCheck,
  bulkTransition,
  submitReviewAndTransition,
  createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate,
  createInstance, getInstances, getInstanceById,
  transitionStatus,
  completeSubTask, completeActivity,
  uploadEvidence,
  submitReview,
  updateAchievement, refreshSLAStatuses,
  getDashboardKPIs, getSellerPerformance,
  // V2 additions
  createNotification, getNotifications, getUnreadCount, markNotificationRead, markAllRead,
  getDepartmentPerformance, getBrandManagerPerformance, getReviewerPerformance,
  bulkReview, getReviewStats, getMyDay,
  checkEscalations, getRiskPanel, getTopPerformers,
  getSellersForPEMS, getBrandManagersForPEMS, getReviewersForPEMS,
  // V3 additions
  calculateWeightedProgress, upsertAssignmentRules, getAssignmentRules,
  getTemplateAnalytics, recalculateAllWeightedProgress,
};
