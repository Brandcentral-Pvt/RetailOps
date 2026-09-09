/**
 * TaskFlow Service
 * Core business logic for the new TaskFlow system
 */
const { sql, getPool, generateId, withTransaction } = require('../../database/db');
const { buildInClause } = require('../../utils/sqlHelpers');
const logger = require('../../utils/logger');
const cacheService = require('../cacheService');
const eventBus = require('../eventBus');
const slaEngine = require('./slaEngine');
const escalationEngine = new (require('./escalationEngine').EscalationEngine)();
const notificationService = require('./notificationService');
const {
  TASK_STATUS,
  SUBTASK_STATUS,
  PRIORITY,
  SLA_STATUS,
  VALID_TRANSITIONS,
  ACTIVITY_TYPES,
  ESCALATION_LEVELS,
  createTaskInstance,
  createTaskActivity,
  createTaskAttachment,
  createTaskComment,
  createTaskAuditLog,
  createTaskWatcher,
  createTaskTemplate,
  createTaskRecurrenceLog,
  canTransition,
  getNextTransitions,
  calculateSlaStatus,
  calculateAchievement,
  calculateVariance,
  getNextDueDate,
  getEscalationLevel,
  getTransitionTimestamps,
  resolveReviewTransition
} = require('./models');

const TASK_CACHE_PREFIX = 'taskflow:';
const TASK_CACHE_TTL = 60; // 60 seconds

const CACHE_KEYS = {
  TASK: 'task:',
  TASK_LIST: 'tasklist:',
  TEMPLATE: 'template:',
  TEMPLATE_LIST: 'templatelist:',
  SUBTASKS: 'subtasks:',
  ACTIVITIES: 'activities:',
  DASHBOARD: 'dashboard:'
};

function cacheKey(...parts) {
  return `${TASK_CACHE_PREFIX}${parts.join(':')}`;
}

async function invalidateTaskCache(taskId) {
  await cacheService.invalidate(
    cacheKey('task', taskId),
    cacheKey('tasklist', '*'),
    cacheKey('dashboard', '*')
  );
}

async function invalidateTemplateCache(templateId) {
  await cacheService.invalidate(
    cacheKey('template', templateId),
    cacheKey('templatelist', '*')
  );
}

function cacheKey(...parts) {
  return `${TASK_CACHE_PREFIX}${parts.join(':')}`;
}

async function invalidateTaskCache(taskId) {
  await cacheService.invalidate(
    cacheKey('task', taskId),
    cacheKey('tasklist', '*'),
    cacheKey('dashboard', '*')
  );
}

async function invalidateTemplateCache(templateId) {
  await cacheService.invalidate(
    cacheKey('template', templateId),
    cacheKey('templatelist', '*')
  );
}

// ============================================================
// PHASE 2: SLA ENGINE, ESCALATION ENGINE, NOTIFICATION SERVICE
// ============================================================

// Initialize SLA Engine
slaEngine.startMonitoring(30); // Check every 30 minutes

// Initialize Escalation Engine
escalationEngine.loadEscalationRules().catch(err => logger.error('Failed to load escalation rules', err));
escalationEngine.startMonitoring(15); // Check every 15 minutes

// Notification service is ready to use

// ============================================================
// SLA POLICIES
// ============================================================

async function getSlaPolicies(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.isActive !== undefined) {
    where += ' AND IsActive = @isActive';
    req.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
  }
  if (filters.isDefault !== undefined) {
    where += ' AND IsDefault = @isDefault';
    req.input('isDefault', sql.Bit, filters.isDefault ? 1 : 0);
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 25;
  const offset = (page - 1) * limit;

  const countResult = await req.query(`SELECT COUNT(*) as total FROM TaskSlaPolicies ${where}`);
  const total = countResult.recordset[0].total;

  const dataReq = pool.request();
  Object.keys(req.parameters).forEach(key => {
    if (key !== 'offset' && key !== 'limit') {
      dataReq.input(key, req.parameters[key]);
    }
  });
  dataReq.input('offset', sql.Int, offset);
  dataReq.input('limit', sql.Int, limit);

  const result = await dataReq.query(`
    SELECT * FROM TaskSlaPolicies ${where}
    ORDER BY IsDefault DESC, CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  return { policies: result.recordset, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getSlaPolicyById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM TaskSlaPolicies WHERE Id = @id');
  return result.recordset[0] || null;
}

async function createSlaPolicy(data) {
  const pool = await getPool();
  const id = generateId();
  
  // If this is default, unset other defaults
  if (data.isDefault) {
    await pool.request().query('UPDATE TaskSlaPolicies SET IsDefault = 0 WHERE IsDefault = 1');
  }

  const now = new Date();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('name', sql.NVarChar, data.name)
    .input('description', sql.NVarChar, data.description || '')
    .input('slaHours', sql.Int, data.slaHours || 48)
    .input('warningHours', sql.NVarChar, JSON.stringify(data.warningHours || [24, 12, 6]))
    .input('businessHoursOnly', sql.Bit, data.businessHoursOnly !== false ? 1 : 0)
    .input('timezone', sql.NVarChar, data.timezone || 'Asia/Kolkata')
    .input('excludeWeekends', sql.Bit, data.excludeWeekends !== false ? 1 : 0)
    .input('holidayCalendar', sql.NVarChar, data.holidayCalendar || null)
    .input('escalationRules', sql.NVarChar(sql.MAX), JSON.stringify(data.escalationRules || []))
    .input('notificationChannels', sql.NVarChar(sql.MAX), JSON.stringify(data.notificationChannels || { email: true, inApp: true }))
    .input('isDefault', sql.Bit, data.isDefault ? 1 : 0)
    .input('isActive', sql.Bit, data.isActive !== false ? 1 : 0)
    .input('createdBy', sql.VarChar, data.createdBy || null)
    .query(`
      INSERT INTO TaskSlaPolicies (Id, Name, Description, SlaHours, WarningHours, BusinessHoursOnly, Timezone, ExcludeWeekends, HolidayCalendar, EscalationRules, NotificationChannels, IsDefault, IsActive, CreatedBy, CreatedAt, UpdatedAt)
      VALUES (@id, @name, @description, @slaHours, @warningHours, @businessHoursOnly, @timezone, @excludeWeekends, @holidayCalendar, @escalationRules, @notificationChannels, @isDefault, @isActive, @createdBy, dbo.GetEnvDate(), dbo.GetEnvDate())
    `);

  await invalidateSlaCache();
  return { id };
}

async function updateSlaPolicy(id, data) {
  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('id', sql.VarChar, id);

  const fields = ['name', 'description', 'slaHours', 'businessHoursOnly', 'timezone', 'excludeWeekends', 'holidayCalendar', 'isDefault', 'isActive'];
  fields.forEach(f => {
    const key = f.charAt(0).toLowerCase() + f.slice(1);
    if (data[key] !== undefined) {
      sets.push(`${f} = @${f}`);
      req.input(f, typeof data[key] === 'number' ? sql.Int : sql.NVarChar, data[key]);
    }
  });

  if (data.warningHours) { sets.push('WarningHours = @warningHours'); req.input('warningHours', sql.NVarChar, JSON.stringify(data.warningHours)); }
  if (data.escalationRules) { sets.push('EscalationRules = @escalationRules'); req.input('escalationRules', sql.NVarChar(sql.MAX), JSON.stringify(data.escalationRules)); }
  if (data.notificationChannels) { sets.push('NotificationChannels = @notificationChannels'); req.input('notificationChannels', sql.NVarChar(sql.MAX), JSON.stringify(data.notificationChannels)); }

  if (data.isDefault) {
    await pool.request().query('UPDATE TaskSlaPolicies SET IsDefault = 0 WHERE IsDefault = 1');
  }

  if (sets.length === 0) return false;
  sets.push('UpdatedAt = dbo.GetEnvDate()');
  await req.query(`UPDATE TaskSlaPolicies SET ${sets.join(', ')} WHERE Id = @id`);

  await invalidateSlaCache();
  return true;
}

async function deleteSlaPolicy(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id).query('DELETE FROM TaskSlaPolicies WHERE Id = @id');
  await invalidateSlaCache();
}

async function invalidateSlaCache() {
  await cacheService.invalidate('taskflow:sla:*');
}

async function getDefaultSlaPolicy() {
  const pool = await getPool();
  const result = await pool.request().query('SELECT TOP 1 * FROM TaskSlaPolicies WHERE IsDefault = 1 AND IsActive = 1');
  return result.recordset[0] || null;
}

// ============================================================
// TASK TEMPLATES
// ============================================================

async function getTemplates(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.category) { where += ' AND Category = @category'; req.input('category', sql.VarChar, filters.category); }
  if (filters.department) { where += ' AND Department = @department'; req.input('department', sql.VarChar, filters.department); }
  if (filters.search) { where += ' AND (Name LIKE @search OR Description LIKE @search OR Code LIKE @search)'; req.input('search', sql.NVarChar, `%${filters.search}%`); }
  if (filters.isActive !== undefined) { where += ' AND IsActive = @isActive'; req.input('isActive', sql.Bit, filters.isActive ? 1 : 0); }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 25;
  const offset = (page - 1) * limit;

  const countResult = await req.query(`SELECT COUNT(*) as total FROM TaskTemplates ${where}`);
  const total = countResult.recordset[0].total;

  const dataReq = pool.request();
  Object.keys(req.parameters).forEach(key => {
    if (key !== 'offset' && key !== 'limit') {
      dataReq.input(key, req.parameters[key]);
    }
  });
  dataReq.input('offset', sql.Int, offset);
  dataReq.input('limit', sql.Int, limit);

  const result = await dataReq.query(`
    SELECT * FROM TaskTemplates ${where}
    ORDER BY CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const templates = result.recordset.map(t => ({
    ...t,
    SubtaskDefinitions: safeParse(t.SubtaskDefinitions, []),
    ActivityDefinitions: safeParse(t.ActivityDefinitions, []),
    Tags: safeParse(t.Tags, [])
  }));

  return { templates, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getTemplateById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM TaskTemplates WHERE Id = @id');
  const t = result.recordset[0];
  if (!t) return null;
  return {
    ...t,
    SubtaskDefinitions: safeParse(t.SubtaskDefinitions, []),
    ActivityDefinitions: safeParse(t.ActivityDefinitions, []),
    Tags: safeParse(t.Tags, [])
  };
}

async function createTemplate(data) {
  const pool = await getPool();
  const id = generateId();
  const countResult = await pool.request().query('SELECT COUNT(*) as c FROM TaskTemplates');
  const taskCode = `TPL-${String(countResult.recordset[0].c + 1).padStart(4, '0')}`;

  const now = new Date();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('code', sql.VarChar, taskCode)
    .input('name', sql.NVarChar, data.name)
    .input('description', sql.NVarChar, data.description || '')
    .input('category', sql.VarChar, data.category || 'GENERAL')
    .input('department', sql.VarChar, data.department || 'OPERATIONS')
    .input('defaultAssigneeRole', sql.VarChar, data.defaultAssigneeRole || 'brand_manager')
    .input('defaultReviewerRole', sql.VarChar, data.defaultReviewerRole || 'reviewer')
    .input('defaultSlaPolicyId', sql.VarChar, data.defaultSlaPolicyId || null)
    .input('defaultPriority', sql.VarChar, data.defaultPriority || 'MEDIUM')
    .input('defaultSlaHours', sql.Int, data.defaultSlaHours || 48)
    .input('frequency', sql.VarChar, data.frequency || 'ONE_TIME')
    .input('cronExpression', sql.NVarChar, data.cronExpression || null)
    .input('businessDaysOnly', sql.Bit, data.businessDaysOnly !== false ? 1 : 0)
    .input('excludeHolidays', sql.Bit, data.excludeHolidays !== false ? 1 : 0)
    .input('holidayCalendar', sql.NVarChar, data.holidayCalendar || null)
    .input('timezone', sql.NVarChar, data.timezone || 'Asia/Kolkata')
    .input('subtaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.subtaskDefinitions || []))
    .input('activityDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.activityDefinitions || []))
    .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags || []))
    .input('isActive', sql.Bit, data.isActive !== false ? 1 : 0)
    .input('createdBy', sql.VarChar, data.createdBy || null)
    .query(`
      INSERT INTO TaskTemplates (Id, Code, Name, Description, Category, Department, DefaultAssigneeRole, DefaultReviewerRole, DefaultSlaPolicyId, DefaultPriority, DefaultSlaHours, Frequency, CronExpression, BusinessDaysOnly, ExcludeHolidays, HolidayCalendar, Timezone, SubtaskDefinitions, ActivityDefinitions, Tags, IsActive, CreatedBy, CreatedAt, UpdatedAt)
      VALUES (@id, @code, @name, @description, @category, @department, @defaultAssigneeRole, @defaultReviewerRole, @defaultSlaPolicyId, @defaultPriority, @defaultSlaHours, @frequency, @cronExpression, @businessDaysOnly, @excludeHolidays, @holidayCalendar, @timezone, @subtaskDefinitions, @activityDefinitions, @tags, @isActive, @createdBy, dbo.GetEnvDate(), dbo.GetEnvDate())
    `);

  await invalidateTemplateCache();
  return { id, taskCode };
}

async function updateTemplate(id, data) {
  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('id', sql.VarChar, id);

  const fields = ['name', 'description', 'category', 'department', 'defaultAssigneeRole', 'defaultReviewerRole', 'defaultSlaPolicyId', 'defaultPriority', 'defaultSlaHours', 'frequency', 'cronExpression', 'businessDaysOnly', 'excludeHolidays', 'holidayCalendar', 'timezone', 'isActive'];
  fields.forEach(f => {
    const key = f.charAt(0).toLowerCase() + f.slice(1);
    if (data[key] !== undefined) {
      sets.push(`${f} = @${f}`);
      req.input(f, typeof data[key] === 'number' ? sql.Int : sql.NVarChar, data[key]);
    }
  });

  if (data.subtaskDefinitions) { sets.push('SubtaskDefinitions = @subtaskDefinitions'); req.input('subtaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.subtaskDefinitions)); }
  if (data.activityDefinitions) { sets.push('ActivityDefinitions = @activityDefinitions'); req.input('activityDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.activityDefinitions)); }
  if (data.tags) { sets.push('Tags = @tags'); req.input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags)); }

  if (sets.length === 0) return false;
  sets.push('UpdatedAt = dbo.GetEnvDate()');
  await req.query(`UPDATE TaskTemplates SET ${sets.join(', ')} WHERE Id = @id`);

  await invalidateTemplateCache(id);
  return true;
}

async function deleteTemplate(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id).query('DELETE FROM TaskTemplates WHERE Id = @id');
  await invalidateTemplateCache(id);
}

async function invalidateTemplateCache(templateId) {
  await cacheService.invalidate(
    `taskflow:template:${templateId}`,
    'taskflow:templatelist:*'
  );
}

function safeParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ============================================================
// TASK INSTANCES
// ============================================================

async function getTasks(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  // User scope
  if (filters.userId && !filters.isGlobalUser) {
    where += ' AND (AssigneeId = @userId OR ReviewerId = @userId)';
    req.input('userId', sql.VarChar, filters.userId);
  }
  if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assigneeId) { where += ' AND AssigneeId = @assigneeId'; req.input('assigneeId', sql.VarChar, filters.assigneeId); }
  if (filters.reviewerId) { where += ' AND ReviewerId = @reviewerId'; req.input('reviewerId', sql.VarChar, filters.reviewerId); }
  if (filters.status) { where += ' AND Status = @status'; req.input('status', sql.VarChar, filters.status); }
  if (filters.slaStatus) { where += ' AND SlaStatus = @slaStatus'; req.input('slaStatus', sql.VarChar, filters.slaStatus); }
  if (filters.priority) { where += ' AND Priority = @priority'; req.input('priority', sql.VarChar, filters.priority); }
  if (filters.department) { where += ' AND Department = @department'; req.input('department', sql.VarChar, filters.department); }
  if (filters.templateId) { where += ' AND TemplateId = @templateId'; req.input('templateId', sql.VarChar, filters.templateId); }
  if (filters.dueBefore) { where += ' AND DueDate <= @dueBefore'; req.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore)); }
  if (filters.dueAfter) { where += ' AND DueDate >= @dueAfter'; req.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter)); }
  if (filters.search) { where += ' AND (Title LIKE @search OR Code LIKE @search OR Description LIKE @search)'; req.input('search', sql.NVarChar, `%${filters.search}%`); }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 25;
  const offset = (page - 1) * limit;

  const countReq = pool.request();
  Object.keys(req.parameters).forEach(key => {
    if (key !== 'offset' && key !== 'limit') {
      countReq.input(key, req.parameters[key]);
    }
  });
  const countResult = await countReq.query(`SELECT COUNT(*) as total FROM TaskInstances ${where}`);
  const total = countResult.recordset[0].total;

  const dataReq = pool.request();
  Object.keys(req.parameters).forEach(key => {
    if (key !== 'offset' && key !== 'limit') {
      dataReq.input(key, req.parameters[key]);
    }
  });
  dataReq.input('offset', sql.Int, offset);
  dataReq.input('limit', sql.Int, limit);

  const sortBy = filters.sortBy || 'CreatedAt';
  const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const allowedSorts = ['CreatedAt', 'DueDate', 'Priority', 'Status', 'SlaStatus', 'Code', 'Title', 'Department'];
  const sortCol = allowedSorts.includes(filters.sortBy) ? filters.sortBy : 'CreatedAt';

  const result = await dataReq.query(`
    SELECT i.*, t.Name as TemplateName, t.Code as TemplateCode
    FROM TaskInstances i
    LEFT JOIN TaskTemplates t ON i.TemplateId = t.Id
    ${where}
    ORDER BY i.${sortCol} ${sortOrder}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const tasks = result.recordset.map(r => ({
    ...r,
    Tags: safeParse(r.Tags, [])
  }));

  return { tasks, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getTaskById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query(`
    SELECT i.*, t.Name as TemplateName, t.Code as TemplateCode
    FROM TaskInstances i
    LEFT JOIN TaskTemplates t ON i.TemplateId = t.Id
    WHERE i.Id = @id
  `);
  const task = result.recordset[0];
  if (!task) return null;
  return {
    ...task,
    Tags: safeParse(task.Tags, [])
  };
}

async function createTask(data) {
  return withTransaction(async (tx) => {
    const pool = tx;
    const id = generateId();
    const countResult = await pool.request().query('SELECT COUNT(*) as c FROM TaskInstances');
    const taskCode = `TASK-${String(countResult.recordset[0].c + 1).padStart(4, '0')}`;

    const dueDate = data.dueDate || getNextDueDate(data.frequency || 'ONE_TIME');
    
    // Get template defaults if template provided
    let slaPolicyId = data.slaPolicyId;
    let slaHours = data.slaHours || 48;
    let priority = data.priority || 'MEDIUM';
    let department = data.department || 'OPERATIONS';
    let assigneeRole = data.assigneeRole || 'brand_manager';
    let reviewerRole = data.reviewerRole || 'reviewer';

    if (data.templateId) {
      const tpl = await tx.request().input('tplId', sql.VarChar, data.templateId)
        .query('SELECT DefaultSlaPolicyId, DefaultPriority, DefaultSlaHours, DefaultAssigneeRole, DefaultReviewerRole, Department FROM TaskTemplates WHERE Id = @tplId');
      if (tpl.recordset[0]) {
        const tplRow = tpl.recordset[0];
        slaPolicyId = data.slaPolicyId || tplRow.DefaultSlaPolicyId;
        priority = data.priority || tplRow.DefaultPriority;
        slaHours = data.slaHours || tplRow.DefaultSlaHours;
        department = data.department || tplRow.Department;
        assigneeRole = data.assigneeRole || tplRow.DefaultAssigneeRole;
        reviewerRole = data.reviewerRole || tplRow.DefaultReviewerRole;
      }
    }

    // If no slaPolicyId provided, use default
    if (!slaPolicyId) {
      const defaultPolicy = await getDefaultSlaPolicy();
      slaPolicyId = defaultPolicy?.Id;
    }

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('code', sql.VarChar, `TASK-${String(Date.now()).slice(-6)}`)
      .input('templateId', sql.VarChar, data.templateId || null)
      .input('title', sql.NVarChar, data.title)
      .input('description', sql.NVarChar, data.description || '')
      .input('status', sql.VarChar, data.status || 'CREATED')
      .input('assigneeId', sql.VarChar, data.assigneeId || null)
      .input('reviewerId', sql.VarChar, data.reviewerId || null)
      .input('assigneeRole', sql.VarChar, assigneeRole)
      .input('reviewerRole', sql.VarChar, reviewerRole)
      .input('sellerId', sql.VarChar, data.sellerId || null)
      .input('department', sql.VarChar, department)
      .input('priority', sql.VarChar, priority)
      .input('slaHours', sql.Int, slaHours)
      .input('slaPolicyId', sql.VarChar, slaPolicyId || null)
      .input('dueDate', sql.DateTime2, dueDate)
      .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags || []))
      .input('createdBy', sql.VarChar, data.createdBy || null)
      .query(`
        INSERT INTO TaskInstances (Id, Code, TemplateId, Title, Description, Status, AssigneeId, ReviewerId, AssigneeRole, ReviewerRole, SellerId, Department, Priority, SlaHours, SlaPolicyId, DueDate, Tags, CreatedBy, CreatedAt, UpdatedAt)
        VALUES (@id, @code, @templateId, @title, @description, @status, @assigneeId, @reviewerId, @assigneeRole, @reviewerRole, @sellerId, @department, @priority, @slaHours, @slaPolicyId, @dueDate, @tags, @createdBy, dbo.GetEnvDate(), dbo.GetEnvDate())
      `);

    // Create subtasks from template if provided
    if (data.templateId && data.createSubtasks !== false) {
      const tpl = await tx.request().input('tplId', sql.VarChar, data.templateId)
        .query('SELECT SubtaskDefinitions, ActivityDefinitions FROM TaskTemplates WHERE Id = @tplId');
      if (tpl.recordset[0]) {
        const subtaskDefs = safeParse(tpl.recordset[0].SubtaskDefinitions, []);
        for (let i = 0; i < subtaskDefs.length; i++) {
          const st = subtaskDefs[i];
          const stId = generateId();
          const stCode = `ST-${String(i + 1).padStart(3, '0')}`;
          await pool.request()
            .input('id', sql.VarChar, stId)
            .input('taskId', sql.VarChar, id)
            .input('code', sql.VarChar, stCode)
            .input('title', sql.NVarChar, st.title || st.name || `Sub Task ${i + 1}`)
            .input('description', sql.NVarChar, st.description || '')
            .input('status', sql.VarChar, 'PENDING')
            .input('sortOrder', sql.Int, i)
            .input('expectedOutput', sql.NVarChar, st.expectedOutput || '')
            .input('assigneeId', sql.VarChar, st.assigneeId || null)
            .query(`
              INSERT INTO TaskSubTasks (Id, TaskId, Code, Title, Description, Status, SortOrder, ExpectedOutput, AssigneeId, CreatedAt, UpdatedAt)
              VALUES (@id, @taskId, @code, @title, @description, @status, @sortOrder, @expectedOutput, @assigneeId, dbo.GetEnvDate(), dbo.GetEnvDate())
            `);
        }
      }
    }

    await writeAuditLog(null, id, 'CREATED', null, data.status || 'CREATED', data.createdBy, data.createdBy, 'Task created', tx);

    return { id, code: `TASK-${String(Date.now()).slice(-6)}` };
  });
}

async function updateTask(id, data) {
  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('id', sql.VarChar, id);

  const fields = ['title', 'description', 'department', 'priority', 'slaHours', 'slaPolicyId', 'dueDate', 'tags', 'assigneeId', 'reviewerId', 'assigneeRole', 'reviewerRole'];
  fields.forEach(f => {
    const key = f.charAt(0).toLowerCase() + f.slice(1);
    if (data[key] !== undefined) {
      sets.push(`${f} = @${f}`);
      req.input(f, typeof data[key] === 'number' ? sql.Int : sql.NVarChar, data[key]);
    }
  });

  if (data.tags) { sets.push('Tags = @tags'); req.input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags)); }

  if (sets.length === 0) return false;
  sets.push('UpdatedAt = dbo.GetEnvDate()');
  await req.query(`UPDATE TaskInstances SET ${sets.join(', ')} WHERE Id = @id`);

  await invalidateTaskCache(id);
  return true;
}

async function deleteTask(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id).query('DELETE FROM TaskInstances WHERE Id = @id');
  await invalidateTaskCache(id);
}

async function getTaskById(id) {
  const cacheKey = `taskflow:${CACHE_KEYS.TASK}${id}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query(`
    SELECT i.*, t.Name as TemplateName, t.Code as TemplateCode
    FROM TaskInstances i
    LEFT JOIN TaskTemplates t ON i.TemplateId = t.Id
    WHERE i.Id = @id
  `);
  const task = result.recordset[0];
  if (!task) return null;
  
  const resultTask = {
    ...task,
    Tags: safeParse(task.Tags, [])
  };
  
  await cacheService.set(`taskflow:${CACHE_KEYS.TASK}${id}`, resultTask, 60);
  return resultTask;
}

// ============================================================
// STATUS TRANSITIONS
// ============================================================

async function transitionStatus(taskId, toStatus, actorId, actorName, details, tx) {
  const pool = tx || (await getPool());
  const instanceResult = await pool.request()
    .input('id', sql.VarChar, taskId)
    .query('SELECT Status, AssignedTo, ReviewerId, DueDate, SlaHours, Title FROM TaskInstances WHERE Id = @id');
  const instance = instanceResult.recordset[0];
  if (!instance) throw new Error('Task not found');

  if (!canTransition(instance.Status, toStatus)) {
    throw new Error(`Invalid transition: ${instance.Status} → ${toStatus}`);
  }

  const now = new Date();
  const timeFields = getTransitionTimestamps(instance.Status, toStatus, now);

  const sets = ['Status = @status', 'UpdatedAt = dbo.GetEnvDate()'];
  const req = pool.request().input('id', sql.VarChar, taskId).input('status', sql.VarChar, toStatus);

  Object.entries(timeFields).forEach(([field, val]) => {
    sets.push(`${field} = @${field}`);
    req.input(field, sql.DateTime2, val);
  });

  // Handle SLA breach
  if (toStatus === 'APPROVED') {
    const slaStatus = calculateSlaStatus(instance.DueDate, instance.SlaHours);
    if (slaStatus === 'BREACHED') {
      sets.push('SlaStatus = @slaStatus', 'SlaBreachedAt = @slaBreachedAt');
      req.input('slaStatus', sql.VarChar, 'BREACHED');
      req.input('slaBreachedAt', sql.DateTime2, now);
    }
  }

  if (toStatus === 'REWORK') {
    // Reset to IN_PROGRESS after rework
    sets.push('Status = @reworkStatus');
    req.input('reworkStatus', sql.VarChar, 'IN_PROGRESS');
  }

  await req.query(`UPDATE TaskInstances SET ${sets.join(', ')} WHERE Id = @id`);

  await writeAuditLog(null, taskId, 'STATUS_CHANGED', instance.Status, toStatus, actorId, actorName, details || `Status changed to ${toStatus}`, tx);

  // Emit event
  eventBus.emit('task:status_changed', { taskId, from: instance.Status, to: toStatus, actorId, actorName });

  await invalidateTaskCache(taskId);

  return { success: true, from: instance.Status, to: toStatus };
}

async function bulkTransition(taskIds, toStatus, actorId, actorName, details) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) throw new Error('No task ids provided');
  if (!VALID_TRANSITIONS[toStatus]) throw new Error(`Unknown status: ${toStatus}`);
  if (taskIds.length > 200) throw new Error('Too many tasks (max 200 per bulk operation)');

  const pool = await getPool();
  const updated = [];
  const skipped = [];

  for (const id of taskIds) {
    try {
      const inst = await pool.request().input('id', sql.VarChar, id)
        .query('SELECT Status, AssignedTo, ReviewerId FROM TaskInstances WHERE Id = @id');
      const row = inst.recordset[0];
      if (!row) { skipped.push({ id, reason: 'NOT_FOUND' }); continue; }
      
      // Check access - simplified for now
      if (!canTransition(row.Status, toStatus)) {
        skipped.push({ id, reason: `INVALID_TRANSITION:${row.Status}->${toStatus}` });
        continue;
      }
      
      await transitionStatus(id, toStatus, actorId, actorName, details);
      updated.push(id);
    } catch (err) {
      skipped.push({ id, reason: err.message || 'ERROR' });
    }
  }

  return { updated, skipped, updatedCount: updated.length, skippedCount: skipped.length };
}

// ============================================================
// REVIEW WORKFLOW
// ============================================================

/**
 * Submit task for review
 * Validates all mandatory subtasks/activities are complete
 */
async function submitForReview(taskId, actorId, actorName, details, tx) {
  const pool = tx || (await getPool());
  
  // Check if all mandatory subtasks are completed
  const subTaskCheck = await pool.request()
    .input('taskId', sql.VarChar, taskId)
    .query(`
      SELECT COUNT(*) as total, SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
      FROM TaskSubTasks WHERE TaskId = @taskId AND IsMandatory = 1
    `);
  
  const mandatoryTotal = subTaskCheck.recordset[0]?.total || 0;
  const mandatoryCompleted = subTaskCheck.recordset[0]?.completed || 0;
  
  if (mandatoryTotal > 0 && mandatoryCompleted < mandatoryTotal) {
    throw new Error(`Cannot submit: ${mandatoryTotal - mandatoryCompleted} mandatory subtask(s) incomplete`);
  }
  
  // Check if all mandatory activities are completed
  const activityCheck = await pool.request()
    .input('taskId', sql.VarChar, taskId)
    .query(`
      SELECT COUNT(*) as total, SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) as completed
      FROM TaskActivities WHERE TaskId = @taskId AND IsMandatory = 1
    `);
  
  const activityTotal = activityCheck.recordset[0]?.total || 0;
  const activityCompleted = activityCheck.recordset[0]?.completed || 0;
  
  if (activityTotal > 0 && activityCompleted < activityTotal) {
    throw new Error(`Cannot submit: ${activityTotal - activityCompleted} mandatory activity(ies) incomplete`);
  }
  
  // Transition to SUBMITTED
  return await transitionStatus(taskId, 'SUBMITTED', actorId, actorName, details, tx);
}

/**
 * Approve a task (reviewer action)
 * Validates quality checklist if provided
 */
async function approveTask(taskId, actorId, actorName, qualityScore, feedback, checklist, tx) {
  const pool = tx || (await getPool());
  
  const instanceResult = await pool.request()
    .input('id', sql.VarChar, taskId)
    .query('SELECT Status, ReviewerId FROM TaskInstances WHERE Id = @id');
  
  const instance = instanceResult.recordset[0];
  if (!instance) throw new Error('Task not found');
  
  // Verify reviewer authorization
  if (instance.ReviewerId && instance.ReviewerId !== actorId) {
    throw new Error('Only assigned reviewer can approve this task');
  }
  
  // Validate quality score if provided (0-100)
  if (qualityScore !== undefined) {
    if (qualityScore < 0 || qualityScore > 100) {
      throw new Error('Quality score must be between 0 and 100');
    }
  }
  
  // Transition to APPROVED
  const result = await transitionStatus(taskId, 'APPROVED', actorId, actorName, details || `Approved with quality score: ${qualityScore || 'N/A'}`, tx);
  
  // Record review
  if (qualityScore !== undefined || feedback || checklist) {
    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('taskInstanceId', sql.VarChar, taskId)
      .input('reviewerId', sql.VarChar, actorId)
      .input('reviewerName', sql.NVarChar, actorName)
      .input('decision', sql.VarChar, 'APPROVE')
      .input('qualityScore', sql.Int, qualityScore || null)
      .input('feedback', sql.NVarChar, feedback || '')
      .input('reviewChecklist', sql.NVarChar(sql.MAX), JSON.stringify(checklist || []))
      .query(`
        INSERT INTO TaskReviews (Id, TaskInstanceId, ReviewerId, ReviewerName, Decision, QualityScore, Feedback, ReviewChecklist, ReviewDurationMinutes)
        VALUES (@id, @taskInstanceId, @reviewerId, @reviewerName, @decision, @qualityScore, @feedback, @reviewChecklist, 0)
      `);
  }
  
  return { success: true, message: 'Task approved' };
}

/**
 * Reject a task (reviewer action)
 * Requires feedback
 */
async function rejectTask(taskId, actorId, actorName, feedback, checklist, tx) {
  const pool = tx || (await getPool());
  
  const instanceResult = await pool.request()
    .input('id', sql.VarChar, taskId)
    .query('SELECT Status, ReviewerId FROM TaskInstances WHERE Id = @id');
  
  const instance = instanceResult.recordset[0];
  if (!instance) throw new Error('Task not found');
  
  // Verify reviewer authorization
  if (instance.ReviewerId && instance.ReviewerId !== actorId) {
    throw new Error('Only assigned reviewer can reject this task');
  }
  
  // Feedback is required for rejection
  if (!feedback || feedback.trim() === '') {
    throw new Error('Feedback is required when rejecting a task');
  }
  
  // Transition to REJECTED
  const result = await transitionStatus(taskId, 'REJECTED', actorId, actorName, feedback, tx);
  
  // Record review
  await pool.request()
    .input('id', sql.VarChar, generateId())
    .input('taskInstanceId', sql.VarChar, taskId)
    .input('reviewerId', sql.VarChar, actorId)
    .input('reviewerName', sql.NVarChar, actorName)
    .input('decision', sql.VarChar, 'REJECT')
    .input('qualityScore', sql.Int, null)
    .input('feedback', sql.NVarChar, feedback)
    .input('reviewChecklist', sql.NVarChar(sql.MAX), JSON.stringify(checklist || []))
    .query(`
      INSERT INTO TaskReviews (Id, TaskInstanceId, ReviewerId, ReviewerName, Decision, QualityScore, Feedback, ReviewChecklist, ReviewDurationMinutes)
      VALUES (@id, @taskInstanceId, @reviewerId, @reviewerName, @decision, @qualityScore, @feedback, @reviewChecklist, 0)
    `);
  
  return { success: true, message: 'Task rejected' };
}

/**
 * Request rework (reviewer action)
 * Sends back to assignee with feedback
 */
async function requestRework(taskId, actorId, actorName, feedback, checklist, tx) {
  const pool = tx || (await getPool());
  
  const instanceResult = await pool.request()
    .input('id', sql.VarChar, taskId)
    .query('SELECT Status, ReviewerId FROM TaskInstances WHERE Id = @id');
  
  const instance = instanceResult.recordset[0];
  if (!instance) throw new Error('Task not found');
  
  // Verify reviewer authorization
  if (instance.ReviewerId && instance.ReviewerId !== actorId) {
    throw new Error('Only assigned reviewer can request rework');
  }
  
  // Feedback is required for rework
  if (!feedback || feedback.trim() === '') {
    throw new Error('Feedback is required when requesting rework');
  }
  
  // Transition to REWORK (which will go back to IN_PROGRESS)
  const result = await transitionStatus(taskId, 'REWORK', actorId, actorName, feedback, tx);
  
  // Record review
  await pool.request()
    .input('id', sql.VarChar, generateId())
    .input('taskInstanceId', sql.VarChar, taskId)
    .input('reviewerId', sql.VarChar, actorId)
    .input('reviewerName', sql.NVarChar, actorName)
    .input('decision', sql.VarChar, 'REWORK')
    .input('qualityScore', sql.Int, null)
    .input('feedback', sql.NVarChar, feedback)
    .input('reviewChecklist', sql.NVarChar(sql.MAX), JSON.stringify(checklist || []))
    .query(`
      INSERT INTO TaskReviews (Id, TaskInstanceId, ReviewerId, ReviewerName, Decision, QualityScore, Feedback, ReviewChecklist, ReviewDurationMinutes)
      VALUES (@id, @taskInstanceId, @reviewerId, @reviewerName, @decision, @qualityScore, @feedback, @reviewChecklist, 0)
    `);
  
  return { success: true, message: 'Rework requested' };
}

/**
 * Get quality metrics for a task
 */
async function getQualityMetrics(taskId) {
  const pool = await getPool();
  
  // Get review history
  const reviews = await pool.request()
    .input('taskId', sql.VarChar, taskId)
    .query('SELECT * FROM TaskReviews WHERE TaskInstanceId = @taskId ORDER BY CreatedAt DESC');
  
  // Get activity completion
  const activities = await pool.request()
    .input('taskId', sql.VarChar, taskId)
    .query('SELECT * FROM TaskActivities WHERE TaskId = @taskId ORDER BY StepNo');
  
  // Get subtask completion
  const subtasks = await pool.request()
    .input('taskId', sql.VarChar, taskId)
    .query('SELECT * FROM TaskSubTasks WHERE TaskId = @taskId ORDER BY SortOrder');
  
  return {
    reviews: reviews.recordset,
    activities: activities.recordset,
    subtasks: subtasks.recordset,
    mandatoryActivitiesComplete: activities.recordset.filter(a => a.IsMandatory && a.IsCompleted).length,
    totalMandatoryActivities: activities.recordset.filter(a => a.IsMandatory).length,
    completedSubtasks: subtasks.recordset.filter(s => s.Status === 'COMPLETED').length,
    totalSubtasks: subtasks.recordset.length
  };
}

// ============================================================
// EXPORT / REPORTING
// ============================================================

/**
 * Export tasks to CSV/JSON
 */
async function exportTasks(filters = {}, format = 'json') {
  const { tasks } = await getTasks(filters);
  
  if (format === 'csv') {
    // Convert to CSV
    const fields = ['Id', 'Code', 'Title', 'Status', 'Priority', 'AssigneeId', 'ReviewerId', 'SellerId', 'Department', 'DueDate', 'Status', 'SlaStatus', 'ProgressPct', 'CreatedAt', 'CompletedAt'];
    const headers = fields.join(',');
    const rows = tasks.map(t => fields.map(f => `"${(t[f] || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    return { format: 'csv', data: headers + '\n' + rows };
  }
  
  return { format: 'json', data: tasks };
}

/**
 * Generate task report for a date range
 */
async function generateTaskReport(filters = {}) {
  const { sql, getPool } = require('../../database/db');
  const pool = await getPool();
  
  let where = 'WHERE 1=1';
  const req = pool.request();
  
  if (filters.startDate) { where += ' AND CreatedAt >= @startDate'; req.input('startDate', sql.DateTime2, filters.startDate); }
  if (filters.endDate) { where += ' AND CreatedAt <= @endDate'; req.input('endDate', sql.DateTime2, filters.endDate); }
  if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assigneeId) { where += ' AND AssigneeId = @assigneeId'; req.input('assigneeId', sql.VarChar, filters.assigneeId); }
  
  const [summary, byStatus, byPriority, byDepartment, byAssignee, slaMetrics] = await Promise.all([
    pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN Status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as rework,
        AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END) as avgQualityScore
      FROM TaskInstances ${where}
    `),
    pool.request().query(`SELECT Status, COUNT(*) as count FROM TaskInstances ${where} GROUP BY Status`),
    pool.request().query(`SELECT Priority, COUNT(*) as count FROM TaskInstances ${where} GROUP BY Priority`),
    pool.request().query(`SELECT Department, COUNT(*) as count FROM TaskInstances ${where} GROUP BY Department`),
    pool.request().query(`
      SELECT AssignedTo, u.FirstName + ' ' + u.LastName as Name,
        COUNT(*) as total,
        SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN SlaStatus = 'BREACHED' THEN 1 ELSE 0 END) as breached
      FROM TaskInstances ${where}
      LEFT JOIN Users u ON AssignedTo = u.Id
      GROUP BY AssignedTo, u.FirstName, u.LastName
    `),
    pool.request().query(`
      SELECT SlaStatus, COUNT(*) as count FROM TaskInstances ${where} GROUP BY SlaStatus
    `)
  ]);
  
  return {
    summary: summary.recordset[0],
    byStatus: byStatus.recordset,
    byPriority: byPriority.recordset,
    byDepartment: byDepartment.recordset,
    byAssignee: byAssignee.recordset,
    slaMetrics: slaMetrics.recordset
  };
}

/**
 * Export tasks to CSV
 */
async function exportTasksToCsv(filters = {}) {
  const { tasks } = await getTasks(filters);
  
  const fields = ['Id', 'Code', 'Title', 'Status', 'Priority', 'AssigneeId', 'ReviewerId', 'SellerId', 'Department', 'DueDate', 'Status', 'SlaStatus', 'ProgressPct', 'CreatedAt', 'CompletedAt'];
  const headers = fields.join(',');
  const rows = tasks.map(t => fields.map(f => `"${(t[f] || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  
  return headers + '\n' + rows;
}

module.exports = {
  // ... existing exports
  
  // Review Workflow
  submitForReview,
  approveTask,
  rejectTask,
  requestRework,
  getQualityMetrics,
  
  // Export/Reporting
  exportTasks,
  generateTaskReport,
  exportTasksToCsv
};

async function getSubTasks(taskId) {
  const cacheKey = `${CACHE_KEYS.SUBTASKS}${taskId}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const pool = await getPool();
  const result = await pool.request().input('taskId', sql.VarChar, taskId)
    .query('SELECT * FROM TaskSubTasks WHERE TaskId = @taskId ORDER BY SortOrder');
  
  const subtasks = result.recordset.map(s => ({
    ...s,
    // Activities will be loaded separately
  }));
  
  await cacheService.set(`taskflow:${CACHE_KEYS.SUBTASKS}${taskId}`, subtasks, 60);
  return subtasks;
}

async function createSubTask(data) {
  const pool = await getPool();
  const id = generateId();
  
  // Get next sort order
  const orderResult = await pool.request().input('taskId', sql.VarChar, data.taskId)
    .query('SELECT ISNULL(MAX(SortOrder), -1) + 1 as nextOrder FROM TaskSubTasks WHERE TaskId = @taskId');
  const sortOrder = orderResult.recordset[0].nextOrder;

  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskId', sql.VarChar, data.taskId)
    .input('code', sql.VarChar, data.code || `ST-${String(Date.now()).slice(-4)}`)
    .input('title', sql.NVarChar, data.title)
    .input('description', sql.NVarChar, data.description || '')
    .input('status', sql.VarChar, 'PENDING')
    .input('sortOrder', sql.Int, sortOrder)
    .input('expectedOutput', sql.NVarChar, data.expectedOutput || '')
    .input('assigneeId', sql.VarChar, data.assigneeId || null)
    .query(`
      INSERT INTO TaskSubTasks (Id, TaskId, Code, Title, Description, Status, SortOrder, ExpectedOutput, AssigneeId, CreatedAt, UpdatedAt)
      VALUES (@id, @taskId, @code, @title, @description, @status, @sortOrder, @expectedOutput, @assigneeId, dbo.GetEnvDate(), dbo.GetEnvDate())
    `);

  await invalidateSubTaskCache(data.taskId);
  return { id };
}

async function updateSubTask(id, data) {
  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('id', sql.VarChar, id);

  const fields = ['title', 'description', 'status', 'expectedOutput', 'assigneeId'];
  fields.forEach(f => {
    const key = f.charAt(0).toLowerCase() + f.slice(1);
    if (data[key] !== undefined) {
      sets.push(`${f} = @${f}`);
      req.input(f, typeof data[key] === 'number' ? sql.Int : sql.NVarChar, data[key]);
    }
  });

  if (data.status === 'COMPLETED') {
    sets.push('CompletedAt = dbo.GetEnvDate()');
  }

  if (sets.length === 0) return false;
  sets.push('UpdatedAt = dbo.GetEnvDate()');
  await req.query(`UPDATE TaskSubTasks SET ${sets.join(', ')} WHERE Id = @id`);

  // If completed, update task progress
  if (data.status === 'COMPLETED') {
    await updateTaskProgress(data.taskId);
  }

  await invalidateSubTaskCache(data.taskId);
  return true;
}

async function completeSubTask(subTaskId, actorId, actorName) {
  const pool = await getPool();
  
  // Get taskId first
  const stResult = await pool.request().input('id', sql.VarChar, subTaskId)
    .query('SELECT TaskId FROM TaskSubTasks WHERE Id = @id');
  if (!stResult.recordset[0]) throw new Error('Subtask not found');
  const taskId = stResult.recordset[0].TaskId;

  await pool.request()
    .input('id', sql.VarChar, subTaskId)
    .query("UPDATE TaskSubTasks SET Status = 'COMPLETED', CompletedAt = dbo.GetEnvDate() WHERE Id = @id");

  // Recalculate progress
  await updateTaskProgress(taskId);

  await writeAuditLog(null, taskId, 'SUBTASK_COMPLETED', null, null, actorId, actorName, `Subtask completed`);
  eventBus.emit('subtask:completed', { taskId, subTaskId, actorId, actorName });

  await invalidateSubTaskCache(taskId);
}

async function updateTaskProgress(taskId) {
  const pool = await getPool();
  const stCount = await pool.request().input('instId', sql.VarChar, taskId)
    .query("SELECT COUNT(*) as total, SUM(CASE WHEN IsCompleted = 1 OR Status = 'COMPLETED' THEN 1 ELSE 0 END) as done FROM TaskSubTasks WHERE TaskId = @instId");
  const total = stCount.recordset[0]?.total || 0;
  const done = stCount.recordset[0]?.done || 0;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  
  await pool.request()
    .input('instId', sql.VarChar, taskId)
    .input('done', sql.Int, done)
    .input('pct', sql.Decimal(5, 2), progressPct)
    .query('UPDATE TaskInstances SET CompletedSubTasks = @done, ProgressPct = @pct WHERE Id = @instId');
}

async function invalidateSubTaskCache(taskId) {
  await cacheService.invalidate(`taskflow:subtasks:${taskId}`);
}

// ============================================================
// ACTIVITIES
// ============================================================

async function getActivities(subTaskId) {
  const cacheKey = `${CACHE_KEYS.ACTIVITIES}${subTaskId}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const pool = await getPool();
  const result = await pool.request().input('subTaskId', sql.VarChar, subTaskId)
    .query('SELECT * FROM TaskActivities WHERE SubTaskId = @subTaskId ORDER BY StepNo');
  
  const activities = result.recordset;
  await cacheService.set(`taskflow:${CACHE_KEYS.ACTIVITIES}${subTaskId}`, activities, 60);
  return activities;
}

async function createActivity(data) {
  const pool = await getPool();
  const id = generateId();
  
  // Get next step number
  const orderResult = await pool.request().input('subTaskId', sql.VarChar, data.subTaskId)
    .query('SELECT ISNULL(MAX(StepNo), 0) + 1 as nextStep FROM TaskActivities WHERE SubTaskId = @subTaskId');
  const stepNo = orderResult.recordset[0].nextStep;

  // Get taskId from subTask
  const stResult = await pool.request().input('id', sql.VarChar, data.subTaskId)
    .query('SELECT TaskId FROM TaskSubTasks WHERE Id = @id');
  const taskId = stResult.recordset[0]?.TaskId;

  await pool.request()
    .input('id', sql.VarChar, id)
    .input('subTaskId', sql.VarChar, data.subTaskId)
    .input('taskId', sql.VarChar, taskId)
    .input('stepNo', sql.Int, stepNo)
    .input('title', sql.NVarChar, data.title)
    .input('instructions', sql.NVarChar, data.instructions || '')
    .input('expectedOutput', sql.NVarChar, data.expectedOutput || '')
    .input('isMandatory', sql.Bit, data.isMandatory !== false ? 1 : 0)
    .query(`
      INSERT INTO TaskActivities (Id, SubTaskId, TaskId, StepNo, Title, Instructions, ExpectedOutput, IsMandatory, IsCompleted, CreatedAt, UpdatedAt)
      VALUES (@id, @subTaskId, @taskId, @stepNo, @title, @instructions, @expectedOutput, @isMandatory, 0, dbo.GetEnvDate(), dbo.GetEnvDate())
    `);

  return { id };
}

async function completeActivity(activityId, actorId, actorName) {
  const pool = await getPool();
  
  await pool.request()
    .input('id', sql.VarChar, activityId)
    .input('actorId', sql.VarChar, actorId)
    .query("UPDATE TaskActivities SET IsCompleted = 1, CompletedAt = dbo.GetEnvDate(), CompletedBy = @actorId WHERE Id = @id");

  // Check if all mandatory activities completed
  const subTaskResult = await pool.request().input('id', sql.VarChar, activityId)
    .query('SELECT SubTaskId FROM TaskActivities WHERE Id = @id');
  if (subTaskResult.recordset[0]) {
    const subTaskId = subTaskResult.recordset[0].SubTaskId;
    const actCount = await pool.request().input('subTaskId', sql.VarChar, subTaskId)
      .query("SELECT COUNT(*) as total, SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) as done FROM TaskActivities WHERE SubTaskId = @subTaskId AND IsMandatory = 1");
    const total = actCount.recordset[0]?.total || 0;
    const done = actCount.recordset[0]?.done || 0;
    
    if (total > 0 && total === done) {
      // All mandatory activities done, check if all subtasks complete
      await updateTaskProgress(subTaskId);
    }
  }

  await writeAuditLog(null, null, 'ACTIVITY_COMPLETED', null, null, actorId, actorName, `Activity completed`);
}

async function invalidateActivityCache(subTaskId) {
  await cacheService.invalidate(`taskflow:activities:${subTaskId}`);
}

// ============================================================
// ATTACHMENTS
// ============================================================

async function uploadAttachment(data) {
  const pool = await getPool();
  const id = generateId();
  
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskId', sql.VarChar, data.taskId)
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
      INSERT INTO TaskAttachments (Id, TaskId, SubTaskId, ActivityId, FileName, FileUrl, FileType, FileSize, MimeType, Remarks, UploadedBy, UploadedByName, UploadedAt)
      VALUES (@id, @taskId, @subTaskId, @activityId, @fileName, @fileUrl, @fileType, @fileSize, @mimeType, @remarks, @uploadedBy, @uploadedByName, dbo.GetEnvDate())
    `);

  await writeAuditLog(null, data.taskId, 'EVIDENCE_UPLOADED', null, null, data.uploadedBy, data.uploadedByName, `Evidence uploaded: ${data.fileName}`);
  
  return { id };
}

async function getAttachments(taskId) {
  const pool = await getPool();
  const result = await pool.request().input('taskId', sql.VarChar, taskId)
    .query('SELECT * FROM TaskAttachments WHERE TaskId = @taskId ORDER BY UploadedAt DESC');
  return result.recordset;
}

async function deleteAttachment(id, actorId) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id).query('DELETE FROM TaskAttachments WHERE Id = @id');
  await writeAuditLog(null, null, 'EVIDENCE_DELETED', null, null, actorId, actorName, 'Attachment deleted');
}

// ============================================================
// COMMENTS
// ============================================================

async function getComments(taskId) {
  const pool = await getPool();
  const result = await pool.request().input('taskId', sql.VarChar, taskId)
    .query('SELECT c.*, u.FirstName, u.LastName FROM TaskComments c JOIN Users u ON c.AuthorId = u.Id WHERE c.TaskId = @taskId AND c.DeletedAt IS NULL ORDER BY c.CreatedAt ASC');
  return result.recordset;
}

async function addComment(data) {
  const pool = await getPool();
  const id = generateId();
  
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskId', sql.VarChar, data.taskId)
    .input('subTaskId', sql.VarChar, data.subTaskId || null)
    .input('authorId', sql.VarChar, data.authorId)
    .input('content', sql.NVarChar, data.content)
    .input('isInternal', sql.Bit, data.isInternal ? 1 : 0)
    .input('parentCommentId', sql.VarChar, data.parentCommentId || null)
    .query(`
      INSERT INTO TaskComments (Id, TaskId, SubTaskId, AuthorId, Content, IsInternal, ParentCommentId, CreatedAt)
      VALUES (@id, @taskId, @subTaskId, @authorId, @content, @isInternal, @parentCommentId, dbo.GetEnvDate())
    `);

  eventBus.emit('comment:added', { taskId: data.taskId, commentId: id, authorId: data.authorId });
  
  return { id };
}

async function deleteComment(id, actorId) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('actorId', sql.VarChar, actorId)
    .query('UPDATE TaskComments SET DeletedAt = dbo.GetEnvDate() WHERE Id = @id AND AuthorId = @actorId');
}

// ============================================================
// AUDIT LOG
// ============================================================

async function writeAuditLog(tx, taskId, action, fromStatus, toStatus, actorId, actorName, details, metadata) {
  const pool = tx || (await getPool());
  const id = generateId();
  
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskId', sql.VarChar, taskId)
    .input('action', sql.VarChar, action)
    .input('fromStatus', sql.VarChar, fromStatus || null)
    .input('toStatus', sql.VarChar, toStatus || null)
    .input('actorId', sql.VarChar, actorId || null)
    .input('actorName', sql.NVarChar, actorName || '')
    .input('details', sql.NVarChar, details || '')
    .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
    .query(`
      INSERT INTO TaskAuditLogs (Id, TaskId, Action, FromStatus, ToStatus, ActorId, ActorName, Details, Metadata, CreatedAt)
      VALUES (@id, @taskId, @action, @fromStatus, @toStatus, @actorId, @actorName, @details, @metadata, dbo.GetEnvDate())
    `);
}

async function getAuditLogs(taskId, limit = 50) {
  const pool = await getPool();
  const result = await pool.request()
    .input('taskId', sql.VarChar, taskId)
    .input('limit', sql.Int, limit)
    .query('SELECT TOP (@limit) * FROM TaskAuditLogs WHERE TaskId = @taskId ORDER BY CreatedAt DESC');
  return result.recordset.map(l => ({ ...l, Metadata: safeParse(l.Metadata, null) }));
}

// ============================================================
// WATCHERS
// ============================================================

async function addWatcher(taskId, userId) {
  const pool = await getPool();
  const id = generateId();
  
  try {
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('taskId', sql.VarChar, taskId)
      .input('userId', sql.VarChar, userId)
      .query('INSERT INTO TaskWatchers (Id, TaskId, UserId, NotifyOnStatusChange, NotifyOnComment, NotifyOnSla, NotifyOnAssignment, CreatedAt) VALUES (@id, @taskId, @userId, 1, 1, 1, 1, dbo.GetEnvDate())');
    return { id };
  } catch (err) {
    if (err.number === 2601 || err.number === 2627) {
      return { exists: true };
    }
    throw err;
  }
}

async function removeWatcher(taskId, userId) {
  const pool = await getPool();
  await pool.request().input('taskId', sql.VarChar, taskId).input('userId', sql.VarChar, userId)
    .query('DELETE FROM TaskWatchers WHERE TaskId = @taskId AND UserId = @userId');
}

async function getWatchers(taskId) {
  const pool = await getPool();
  const result = await pool.request().input('taskId', sql.VarChar, taskId)
    .query('SELECT w.*, u.FirstName, u.LastName, u.Email FROM TaskWatchers w JOIN Users u ON w.UserId = u.Id WHERE w.TaskId = @taskId');
  return result.recordset;
}

// ============================================================
// RECURRENCE
// ============================================================

async function generateRecurringTasks(now = new Date()) {
  if (process.env.TASKFLOW_RECURRENCE_ENABLED === 'false') {
    return { disabled: true, created: 0, scanned: 0 };
  }

  const BATCH_CAP = 100;
  const pool = await getPool();

  const templatesRes = await pool.request()
    .input('now', sql.DateTime2, now)
    .input('limit', sql.Int, 100)
    .query(`
      SELECT TOP 100 Id, Name, Department, Priority, SlaHours, DefaultSlaPolicyId, DefaultSlaHours, DefaultPriority, DefaultAssigneeRole, DefaultReviewerRole, Frequency, CronExpression, CreatedAt
      FROM TaskTemplates
      WHERE IsActive = 1 AND Frequency != 'ONE_TIME'
        AND (NextScheduledDate IS NULL OR NextScheduledDate <= @now)
      ORDER BY ISNULL(NextScheduledDate, '1900-01-01') ASC
    `);

  const templates = templatesRes.recordset;
  if (templates.length === 0) return { disabled: false, created: 0, scanned: 0 };

  let created = 0;

  for (const tpl of templates) {
    if (created >= 100) break;

    const occurrenceFor = tpl.NextScheduledDate
      ? new Date(tpl.NextScheduledDate)
      : getNextDueDate(tpl.Frequency, tpl.CronExpression, new Date(tpl.CreatedAt || now));

    const nextOccurrence = getNextDueDate(tpl.Frequency, tpl.CronExpression, occurrenceFor);

    // Idempotency guard
    const dup = await pool.request()
      .input('templateId', sql.VarChar, tpl.Id)
      .input('occ', sql.DateTime2, occurrenceFor)
      .query('SELECT COUNT(*) as c FROM TaskRecurrenceLog WHERE TemplateId = @templateId AND OccurrenceFor = @occ');
    if (dup.recordset[0].c > 0) {
      await pool.request()
        .input('id', sql.VarChar, tpl.Id)
        .input('next', sql.DateTime2, nextOccurrence)
        .query('UPDATE TaskTemplates SET NextScheduledDate = @next WHERE Id = @id');
      continue;
    }

    try {
      const result = await createTask({
        templateId: tpl.Id,
        title: tpl.Name,
        department: tpl.Department,
        priority: tpl.DefaultPriority,
        slaHours: tpl.DefaultSlaHours,
        slaPolicyId: tpl.DefaultSlaPolicyId,
        assigneeRole: tpl.DefaultAssigneeRole,
        reviewerRole: tpl.DefaultReviewerRole,
        frequency: tpl.Frequency,
        status: 'DRAFT',
        dueDate: occurrenceFor,
        description: `Auto-generated recurring occurrence for ${tpl.Name}`,
        tags: []
      });

      const logId = generateId();
      await pool.request()
        .input('id', sql.VarChar, logId)
        .input('templateId', sql.VarChar, tpl.Id)
        .input('instanceId', sql.VarChar, result.id)
        .input('occ', sql.DateTime2, occurrenceFor)
        .query('INSERT INTO TaskRecurrenceLog (Id, TemplateId, InstanceId, OccurrenceFor) VALUES (@id, @templateId, @instanceId, @occ)');

      await pool.request()
        .input('id', sql.VarChar, tpl.Id)
        .input('next', sql.DateTime2, nextOccurrence)
        .input('lastGen', sql.DateTime2, now)
        .query('UPDATE TaskTemplates SET NextScheduledDate = @next, LastGeneratedAt = @lastGen WHERE Id = @id');

      created++;
      logger.info(`Recurrence: created instance ${result.code} for template ${tpl.Name} (${tpl.Id})`);
    } catch (err) {
      logger.error(`Recurrence generation failed for template ${tpl.Id}`, { error: err.message });
    }
  }

  return { disabled: false, created, scanned: templates.length };
}

// ============================================================
// DASHBOARD KPIs
// ============================================================

async function getDashboardKPIs(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.userId && !filters.isGlobalUser) {
    where += ' AND (AssigneeId = @userId OR ReviewerId = @userId)';
    req.input('userId', sql.VarChar, filters.userId);
  }
  if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assigneeId) { where += ' AND AssigneeId = @assigneeId'; req.input('assigneeId', sql.VarChar, filters.assigneeId); }
  if (filters.reviewerId) { where += ' AND ReviewerId = @reviewerId'; req.input('reviewerId', sql.VarChar, filters.reviewerId); }

  const sellerParams = [];
  if (filters.sellerIds && filters.sellerIds.length > 0) {
    filters.sellerIds.forEach((id, i) => {
      const param = `seller_${i}`;
      req.input(param, sql.VarChar, id);
      sellerParams.push(`@${param}`);
    });
    where += ` AND SellerId IN (${sellerParams.join(',')})`;
  }

  const [
    taskCounts,
    slaStats,
    priorityStats,
    deptStats,
    recentActivity
  ] = await Promise.all([
    pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Status = 'CREATED' THEN 1 ELSE 0 END) as created,
        SUM(CASE WHEN Status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN Status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as underReview,
        SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN Status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as rework,
        SUM(CASE WHEN Status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN SlaStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
        SUM(CASE WHEN SlaStatus = 'AT_RISK' THEN 1 ELSE 0 END) as slaAtRisk,
        AVG(CASE WHEN DueDate IS NOT NULL AND DueDate > GETDATE() THEN 1.0 ELSE 0.0 END) * 100 as onTrackPct
      FROM TaskInstances ${where.replace('WHERE 1=1', '')}
    `),
    pool.request().query(`
      SELECT SlaStatus, COUNT(*) as count FROM TaskInstances ${where} GROUP BY SlaStatus
    `),
    pool.request().query(`
      SELECT Priority, COUNT(*) as count FROM TaskInstances ${where} GROUP BY Priority
    `),
    pool.request().query(`
      SELECT Department, COUNT(*) as count FROM TaskInstances ${where} GROUP BY Department
    `),
    pool.request().query(`
      SELECT TOP 10 i.Id, i.Code, i.Title, i.Status, i.DueDate, i.Priority, i.Department, u.FirstName + ' ' + u.LastName as AssigneeName
      FROM TaskInstances i LEFT JOIN Users u ON i.AssignedTo = u.Id ${where} ORDER BY i.CreatedAt DESC
    `)
  ]);

  const tasks = taskCounts.recordset[0];
  const sla = slaStats.recordset.reduce((acc, r) => { acc[r.SlaStatus] = r.count; return acc; }, {});
  const priority = priorityStats.recordset.reduce((acc, r) => { acc[r.Priority] = r.count; return acc; }, {});
  const dept = deptStats.recordset;

  return {
    summary: {
      total: tasks.total || 0,
      created: tasks.created || 0,
      assigned: tasks.assigned || 0,
      inProgress: tasks.inProgress || 0,
      submitted: tasks.submitted || 0,
      underReview: tasks.underReview || 0,
      approved: tasks.approved || 0,
      rejected: tasks.rejected || 0,
      rework: tasks.rework || 0,
      cancelled: tasks.cancelled || 0,
      slaBreached: sla.BREACHED || 0,
      slaAtRisk: sla.AT_RISK || 0,
      onTrackPct: Math.round(tasks.onTrackPct || 0)
    },
    slaBreakdown: sla,
    priorityBreakdown: priority,
    departmentBreakdown: dept,
    recentActivity: recentActivity.recordset
  };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // SLA Policies
  getSlaPolicies,
  getSlaPolicyById,
  createSlaPolicy,
  updateSlaPolicy,
  deleteSlaPolicy,
  getDefaultSlaPolicy,
  
  // Templates
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  
  // Tasks
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  
  // Status Transitions
  transitionStatus,
  bulkTransition,
  
  // Subtasks
  getSubTasks,
  createSubTask,
  updateSubTask,
  completeSubTask,
  
  // Activities
  getActivities,
  createActivity,
  completeActivity,
  
  // Attachments
  uploadAttachment,
  getAttachments,
  deleteAttachment,
  
  // Comments
  getComments: async (taskId) => {
    const pool = await getPool();
    const result = await pool.request().input('taskId', sql.VarChar, taskId)
      .query('SELECT c.*, u.FirstName, u.LastName FROM TaskComments c JOIN Users u ON c.AuthorId = u.Id WHERE c.TaskId = @taskId AND c.DeletedAt IS NULL ORDER BY c.CreatedAt ASC');
    return result.recordset;
  },
  addComment: async (data) => {
    const pool = await getPool();
    const id = generateId();
    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('taskId', sql.VarChar, data.taskId)
      .input('subTaskId', sql.VarChar, data.subTaskId || null)
      .input('authorId', sql.VarChar, data.authorId)
      .input('content', sql.NVarChar, data.content)
      .input('isInternal', sql.Bit, data.isInternal ? 1 : 0)
      .input('parentCommentId', sql.VarChar, data.parentCommentId || null)
      .query('INSERT INTO TaskComments (Id, TaskId, SubTaskId, AuthorId, Content, IsInternal, ParentCommentId, CreatedAt) VALUES (@id, @taskId, @subTaskId, @authorId, @content, @isInternal, @parentCommentId, dbo.GetEnvDate())');
    return { id: generateId() };
  },
  deleteComment: async (id, actorId) => {
    const pool = await getPool();
    await pool.request().input('id', sql.VarChar, id).input('actorId', sql.VarChar, actorId)
      .query('UPDATE TaskComments SET DeletedAt = dbo.GetEnvDate() WHERE Id = @id AND AuthorId = @actorId');
  },
  
  // Attachments
  uploadAttachment: async (data) => {
    const pool = await getPool();
    const id = generateId();
    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('taskId', sql.VarChar, data.taskId)
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
      .query('INSERT INTO TaskAttachments (Id, TaskId, SubTaskId, ActivityId, FileName, FileUrl, FileType, FileSize, MimeType, Remarks, UploadedBy, UploadedByName, UploadedAt) VALUES (@id, @taskId, @subTaskId, @activityId, @fileName, @fileUrl, @fileType, @fileSize, @mimeType, @remarks, @uploadedBy, @uploadedByName, dbo.GetEnvDate())');
    return { id: generateId() };
  },
  getAttachments: async (taskId) => {
    const pool = await getPool();
    const result = await pool.request().input('taskId', sql.VarChar, taskId)
      .query('SELECT * FROM TaskAttachments WHERE TaskId = @taskId ORDER BY UploadedAt DESC');
    return result.recordset;
  },
  deleteAttachment: async (id, actorId) => {
    const pool = await getPool();
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM TaskAttachments WHERE Id = @id');
  },
  
  // Audit
  writeAuditLog,
  getAuditLogs: async (taskId, limit = 50) => {
    const pool = await getPool();
    const result = await pool.request().input('taskId', sql.VarChar, taskId).input('limit', sql.Int, limit)
      .query('SELECT TOP (@limit) * FROM TaskAuditLogs WHERE TaskId = @taskId ORDER BY CreatedAt DESC');
    return result.recordset.map(l => ({ ...l, Metadata: safeParse(l.Metadata, null) }));
  },
  
  // Watchers
  addWatcher,
  removeWatcher,
  getWatchers,
  
  // Recurrence
  generateRecurringTasks,
  
  // Dashboard
  getDashboardKPIs,
  
  // Helpers
  safeParse,
  generateId,
  
  // Phase 2: SLA Engine, Escalation Engine, Notification Service
  slaEngine,
  escalationEngine,
  notificationService
};