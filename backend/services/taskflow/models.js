/**
 * TaskFlow Domain Models
 * Pure, serializable data structures for the new TaskFlow system
 */

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

const TASK_STATUS = {
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REWORK: 'REWORK',
  CANCELLED: 'CANCELLED'
};

const SUBTASK_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED'
};

const ACTIVITY_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED'
};

const PRIORITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

const SLA_STATUS = {
  WITHIN_SLA: 'WITHIN_SLA',
  AT_RISK: 'AT_RISK',
  BREACHED: 'BREACHED'
};

const FREQUENCY = {
  ONE_TIME: 'ONE_TIME',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BI_WEEKLY: 'BI_WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM'
};

const ACTIVITY_TYPES = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNED: 'ASSIGNED',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REWORK: 'REWORK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SUBTASK_COMPLETED: 'SUBTASK_COMPLETED',
  ACTIVITY_COMPLETED: 'ACTIVITY_COMPLETED',
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  SLA_WARNING: 'SLA_WARNING',
  SLA_BREACH: 'SLA_BREACH',
  ESCALATED: 'ESCALATED'
};

const ESCALATION_LEVELS = {
  NONE: 0,
  ASSIGNEE: 1,
  REVIEWER: 2,
  MANAGER: 3,
  ADMIN: 4
};

// Valid status transitions
const VALID_TRANSITIONS = {
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  REJECTED: ['REWORK'],
  REWORK: ['IN_PROGRESS'],
  APPROVED: [],
  CANCELLED: []
};

// ============================================================
// MODEL FACTORIES
// ============================================================

function createTaskTemplate(data) {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description || '',
    category: data.category || 'GENERAL',
    department: data.department || 'OPERATIONS',
    defaultAssigneeRole: data.defaultAssigneeRole || 'brand_manager',
    defaultReviewerRole: data.defaultReviewerRole || 'reviewer',
    defaultSlaPolicyId: data.defaultSlaPolicyId || null,
    defaultPriority: data.defaultPriority || 'MEDIUM',
    defaultSlaHours: data.defaultSlaHours || 48,
    frequency: data.frequency || 'ONE_TIME',
    cronExpression: data.cronExpression || null,
    businessDaysOnly: data.businessDaysOnly !== false,
    excludeHolidays: data.excludeHolidays !== false,
    holidayCalendar: data.holidayCalendar || null,
    timezone: data.timezone || 'Asia/Kolkata',
    subtaskDefinitions: data.subtaskDefinitions || [],
    activityDefinitions: data.activityDefinitions || [],
    tags: data.tags || [],
    isActive: data.isActive !== false,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskInstance(data) {
  return {
    id: data.id,
    code: data.code,
    templateId: data.templateId || null,
    title: data.title,
    description: data.description || '',
    status: data.status || 'CREATED',
    assigneeId: data.assigneeId || null,
    reviewerId: data.reviewerId || null,
    assigneeRole: data.assigneeRole || 'brand_manager',
    reviewerRole: data.reviewerRole || 'reviewer',
    sellerId: data.sellerId || null,
    department: data.department || 'OPERATIONS',
    priority: data.priority || 'MEDIUM',
    slaHours: data.slaHours || 48,
    slaPolicyId: data.slaPolicyId || null,
    dueDate: data.dueDate || null,
    assignedAt: data.assignedAt || null,
    startedAt: data.startedAt || null,
    submittedAt: data.submittedAt || null,
    reviewedAt: data.reviewedAt || null,
    completedAt: data.completedAt || null,
    slaStatus: data.slaStatus || 'WITHIN_SLA',
    slaBreachedAt: data.slaBreachedAt || null,
    escalationLevel: data.escalationLevel || 0,
    tags: data.tags || [],
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createSubTask(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    code: data.code,
    title: data.title,
    description: data.description || '',
    status: data.status || 'PENDING',
    sortOrder: data.sortOrder || 0,
    expectedOutput: data.expectedOutput || '',
    assigneeId: data.assigneeId || null,
    completedAt: data.completedAt || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskActivity(data) {
  return {
    id: data.id,
    subTaskId: data.subTaskId,
    taskId: data.taskId,
    stepNo: data.stepNo || 1,
    title: data.title,
    instructions: data.instructions || '',
    expectedOutput: data.expectedOutput || '',
    isMandatory: data.isMandatory !== false,
    isCompleted: data.isCompleted || false,
    completedAt: data.completedAt || null,
    completedBy: data.completedBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskAttachment(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    subTaskId: data.subTaskId || null,
    activityId: data.activityId || null,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    fileType: data.fileType || 'FILE',
    fileSize: data.fileSize || null,
    mimeType: data.mimeType || null,
    remarks: data.remarks || '',
    uploadedBy: data.uploadedBy,
    uploadedByName: data.uploadedByName || '',
    uploadedAt: data.uploadedAt || new Date().toISOString()
  };
}

function createTaskComment(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    subTaskId: data.subTaskId || null,
    authorId: data.authorId,
    content: data.content,
    isInternal: data.isInternal || false,
    parentCommentId: data.parentCommentId || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || null,
    deletedAt: data.deletedAt || null
  };
}

function createTaskAuditLog(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    action: data.action,
    fromStatus: data.fromStatus || null,
    toStatus: data.toStatus || null,
    actorId: data.actorId || null,
    actorName: data.actorName || '',
    details: data.details || '',
    metadata: data.metadata || null,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

function createTaskWatcher(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    userId: data.userId,
    notifyOnStatusChange: data.notifyOnStatusChange !== false,
    notifyOnComment: data.notifyOnComment !== false,
    notifyOnSla: data.notifyOnSla !== false,
    notifyOnAssignment: data.notifyOnAssignment !== false,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

function createSlaPolicy(data) {
  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    slaHours: data.slaHours || 48,
    warningHours: data.warningHours || [24, 12, 6],
    businessHoursOnly: data.businessHoursOnly !== false,
    timezone: data.timezone || 'Asia/Kolkata',
    excludeWeekends: data.excludeWeekends !== false,
    holidayCalendar: data.holidayCalendar || null,
    escalationRules: data.escalationRules || [
      { level: 'assignee', hoursBeforeDue: 24, notify: ['assignee'] },
      { level: 'reviewer', hoursBeforeDue: 12, notify: ['reviewer'] },
      { level: 'manager', hoursAfterBreach: 0, notify: ['manager'] },
      { level: 'admin', hoursAfterBreach: 24, notify: ['admin'] }
    ],
    notificationChannels: data.notificationChannels || { email: true, inApp: true, slack: false, webhook: null },
    isDefault: data.isDefault || false,
    isActive: data.isActive !== false,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskTemplate(data) {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description || '',
    category: data.category || 'GENERAL',
    department: data.department || 'OPERATIONS',
    defaultAssigneeRole: data.defaultAssigneeRole || 'brand_manager',
    defaultReviewerRole: data.defaultReviewerRole || 'reviewer',
    defaultSlaPolicyId: data.defaultSlaPolicyId || null,
    defaultPriority: data.defaultPriority || 'MEDIUM',
    defaultSlaHours: data.defaultSlaHours || 48,
    frequency: data.frequency || 'ONE_TIME',
    cronExpression: data.cronExpression || null,
    businessDaysOnly: data.businessDaysOnly !== false,
    excludeHolidays: data.excludeHolidays !== false,
    holidayCalendar: data.holidayCalendar || null,
    timezone: data.timezone || 'Asia/Kolkata',
    subtaskDefinitions: data.subtaskDefinitions || [],
    activityDefinitions: data.activityDefinitions || [],
    tags: data.tags || [],
    isActive: data.isActive !== false,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createSubTask(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    code: data.code,
    title: data.title,
    description: data.description || '',
    status: data.status || 'PENDING',
    sortOrder: data.sortOrder || 0,
    expectedOutput: data.expectedOutput || '',
    assigneeId: data.assigneeId || null,
    completedAt: data.completedAt || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskActivity(data) {
  return {
    id: data.id,
    subTaskId: data.subTaskId,
    taskId: data.taskId,
    stepNo: data.stepNo || 1,
    title: data.title,
    instructions: data.instructions || '',
    expectedOutput: data.expectedOutput || '',
    isMandatory: data.isMandatory !== false,
    isCompleted: data.isCompleted || false,
    completedAt: data.completedAt || null,
    completedBy: data.completedBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskAttachment(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    subTaskId: data.subTaskId || null,
    activityId: data.activityId || null,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    fileType: data.fileType || 'FILE',
    fileSize: data.fileSize || null,
    mimeType: data.mimeType || null,
    remarks: data.remarks || '',
    uploadedBy: data.uploadedBy,
    uploadedByName: data.uploadedByName || '',
    uploadedAt: data.uploadedAt || new Date().toISOString()
  };
}

function createTaskComment(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    subTaskId: data.subTaskId || null,
    authorId: data.authorId,
    content: data.content,
    isInternal: data.isInternal || false,
    parentCommentId: data.parentCommentId || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || null,
    deletedAt: data.deletedAt || null
  };
}

function createTaskAuditLog(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    action: data.action,
    fromStatus: data.fromStatus || null,
    toStatus: data.toStatus || null,
    actorId: data.actorId || null,
    actorName: data.actorName || '',
    details: data.details || '',
    metadata: data.metadata || null,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

function createTaskWatcher(data) {
  return {
    id: data.id,
    taskId: data.taskId,
    userId: data.userId,
    notifyOnStatusChange: data.notifyOnStatusChange !== false,
    notifyOnComment: data.notifyOnComment !== false,
    notifyOnSla: data.notifyOnSla !== false,
    notifyOnAssignment: data.notifyOnAssignment !== false,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

function createSlaPolicy(data) {
  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    slaHours: data.slaHours || 48,
    warningHours: data.warningHours || [24, 12, 6],
    businessHoursOnly: data.businessHoursOnly !== false,
    timezone: data.timezone || 'Asia/Kolkata',
    excludeWeekends: data.excludeWeekends !== false,
    holidayCalendar: data.holidayCalendar || null,
    escalationRules: data.escalationRules || [
      { level: 'assignee', hoursBeforeDue: 24, notify: ['assignee'] },
      { level: 'reviewer', hoursBeforeDue: 12, notify: ['reviewer'] },
      { level: 'manager', hoursAfterBreach: 0, notify: ['manager'] },
      { level: 'admin', hoursAfterBreach: 24, notify: ['admin'] }
    ],
    notificationChannels: data.notificationChannels || { email: true, inApp: true, slack: false, webhook: null },
    isDefault: data.isDefault || false,
    isActive: data.isActive !== false,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskTemplate(data) {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description || '',
    category: data.category || 'GENERAL',
    department: data.department || 'OPERATIONS',
    defaultAssigneeRole: data.defaultAssigneeRole || 'brand_manager',
    defaultReviewerRole: data.defaultReviewerRole || 'reviewer',
    defaultSlaPolicyId: data.defaultSlaPolicyId || null,
    defaultPriority: data.defaultPriority || 'MEDIUM',
    defaultSlaHours: data.defaultSlaHours || 48,
    frequency: data.frequency || 'ONE_TIME',
    cronExpression: data.cronExpression || null,
    businessDaysOnly: data.businessDaysOnly !== false,
    excludeHolidays: data.excludeHolidays !== false,
    holidayCalendar: data.holidayCalendar || null,
    timezone: data.timezone || 'Asia/Kolkata',
    subtaskDefinitions: data.subtaskDefinitions || [],
    activityDefinitions: data.activityDefinitions || [],
    tags: data.tags || [],
    isActive: data.isActive !== false,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function createTaskRecurrenceLog(data) {
  return {
    id: data.id,
    templateId: data.templateId,
    instanceId: data.instanceId,
    occurrenceFor: data.occurrenceFor,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

function canTransition(fromStatus, toStatus) {
  const transitions = {
    CREATED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    REJECTED: ['REWORK'],
    REWORK: ['IN_PROGRESS'],
    APPROVED: [],
    CANCELLED: []
  };
  const allowed = transitions[fromStatus];
  return allowed && allowed.includes(toStatus);
}

function getNextTransitions(currentStatus) {
  return VALID_TRANSITIONS[currentStatus] || [];
}

function calculateSlaStatus(dueDate, slaHours) {
  if (!dueDate) return 'WITHIN_SLA';
  const now = new Date();
  const due = new Date(dueDate);
  if (now > due) return 'BREACHED';
  const hoursRemaining = (due - now) / (1000 * 60 * 60);
  if (hoursRemaining <= (slaHours || 48) * 0.25) return 'AT_RISK';
  return 'WITHIN_SLA';
}

function calculateAchievement(achievement, target) {
  if (!target || target <= 0) return 0;
  return Math.round((achievement / target) * 100 * 100) / 100;
}

function calculateVariance(achievement, target) {
  return Math.round((achievement - (target || 0)) * 100) / 100;
}

function getNextDueDate(frequency, customCron, fromDate = new Date()) {
  const d = new Date(fromDate);
  switch (frequency) {
    case 'DAILY': d.setDate(d.getDate() + 1); break;
    case 'WEEKLY': d.setDate(d.getDate() + 7); break;
    case 'BI_WEEKLY': d.setDate(d.getDate() + 14); break;
    case 'MONTHLY': d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'YEARLY': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setDate(d.getDate() + 7); break;
  }
  return d;
}

function getEscalationLevel(dueDate, slaHours) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due - now) / (1000 * 60 * 60);
  if (hoursUntilDue < -24) return 'admin';
  if (hoursUntilDue < 0) return 'manager';
  if (hoursUntilDue <= 12) return 'reviewer';
  if (hoursUntilDue <= 24) return 'assignee';
  return null;
}

function getTransitionTimestamps(fromStatus, toStatus, now = new Date()) {
  const t = {};
  switch (toStatus) {
    case 'ASSIGNED': t.assignedAt = now; break;
    case 'IN_PROGRESS': t.startedAt = now; break;
    case 'SUBMITTED': t.submittedAt = now; break;
    case 'UNDER_REVIEW': t.reviewedAt = now; break;
    case 'APPROVED': t.reviewedAt = now; t.completedAt = now; break;
    case 'REJECTED': t.reviewedAt = now; t.completedAt = null; break;
    case 'REWORK': break;
    case 'CANCELLED': break;
    default: break;
  }
  return t;
}

function resolveReviewTransition(decision) {
  if (decision === 'APPROVE') return 'APPROVED';
  if (decision === 'REWORK') return 'REWORK';
  return 'REJECTED';
}

function getEscalationLevel(dueDate, slaHours) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due - now) / (1000 * 60 * 60);
  if (hoursUntilDue < -24) return 'admin';
  if (hoursUntilDue < 0) return 'manager';
  if (hoursUntilDue <= 12) return 'reviewer';
  if (hoursUntilDue <= 24) return 'assignee';
  return null;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Enums
  TASK_STATUS,
  SUBTASK_STATUS,
  ACTIVITY_STATUS,
  PRIORITY,
  SLA_STATUS,
  FREQUENCY,
  ACTIVITY_TYPES,
  ESCALATION_LEVELS,
  
  // Transitions
  VALID_TRANSITIONS,
  canTransition,
  getNextTransitions,
  
  // Factories
  createTaskTemplate,
  createTaskInstance,
  createSubTask,
  createTaskActivity,
  createTaskAttachment,
  createTaskComment,
  createTaskAuditLog,
  createTaskWatcher,
  createSlaPolicy,
  createTaskTemplate,
  createSubTask,
  createTaskActivity,
  createTaskAttachment,
  createTaskComment,
  createTaskAuditLog,
  createTaskWatcher,
  createSlaPolicy,
  createTaskRecurrenceLog,
  
  // Helpers
  canTransition,
  getNextTransitions,
  calculateSlaStatus,
  calculateAchievement,
  calculateVariance,
  getNextDueDate,
  getEscalationLevel,
  getTransitionTimestamps,
  resolveReviewTransition,
  getEscalationLevel,
  getTransitionTimestamps
};