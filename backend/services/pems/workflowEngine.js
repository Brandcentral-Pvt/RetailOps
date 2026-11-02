/**
 * PEMS V2 Workflow Engine
 * Manages task lifecycle with departments, escalation, and notifications
 */

const WORKFLOW_STATUSES = {
  DRAFT: 'DRAFT',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REWORK: 'REWORK',
  RESUBMITTED: 'RESUBMITTED',
  ESCALATED: 'ESCALATED',
  CANCELLED: 'CANCELLED',
};

const VALID_TRANSITIONS = {
  DRAFT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED', 'ESCALATED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  REJECTED: ['REWORK'],
  REWORK: ['RESUBMITTED'],
  RESUBMITTED: ['UNDER_REVIEW'],
  ESCALATED: ['IN_PROGRESS', 'UNDER_REVIEW', 'CANCELLED'],
  APPROVED: [],
  CANCELLED: [],
};

const REVIEW_DECISIONS = { APPROVE: 'APPROVE', REJECT: 'REJECT', REWORK: 'REWORK' };

const SLA_STATUSES = { WITHIN_SLA: 'WITHIN_SLA', AT_RISK: 'AT_RISK', BREACHED: 'BREACHED' };

const FREQUENCIES = {
  ONE_TIME: 'ONE_TIME', DAILY: 'DAILY', WEEKLY: 'WEEKLY', BI_WEEKLY: 'BI_WEEKLY',
  MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', HALF_YEARLY: 'HALF_YEARLY',
  YEARLY: 'YEARLY', CUSTOM: 'CUSTOM',
};

const DEPARTMENTS = {
  OPERATIONS: 'Operations',
  BRAND_MANAGERS: 'Brand Managers',
  CATALOG: 'Catalog Team',
};

const CATEGORIES = {
  LISTING: 'LISTING', PRICING: 'PRICING', INVENTORY: 'INVENTORY',
  ADS: 'ADS', ANALYTICS: 'ANALYTICS', COMPLIANCE: 'COMPLIANCE', GENERAL: 'GENERAL',
};

const PRIORITIES = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

const TARGET_TYPES = { NUMERIC: 'NUMERIC', PERCENTAGE: 'PERCENTAGE', BOOLEAN: 'BOOLEAN', QUALITATIVE: 'QUALITATIVE' };

const COMPLEXITY_LEVELS = {
  LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL',
};

const APPROVAL_LEVELS = {
  SINGLE: 'single', DUAL: 'dual', MULTI: 'multi',
};

const AUTO_ASSIGN_STRATEGIES = {
  LOWEST_WORKLOAD: 'lowest_workload',
  DEPARTMENT_BASED: 'department_based',
  ROUND_ROBIN: 'round_robin',
};

const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_ACCEPTED: 'TASK_ACCEPTED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  SLA_WARNING: 'SLA_WARNING',
  SLA_BREACH: 'SLA_BREACH',
  REVIEW_ASSIGNED: 'REVIEW_ASSIGNED',
};

// V2.3: Conditional workflow states
const VISIBILITY_STATES = {
  VISIBLE: 'VISIBLE',
  SKIPPED: 'SKIPPED',
  WAITING: 'WAITING',
};

const CONDITION_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'is_null', 'is_not_null'];

function canTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

function getNextTransitions(currentStatus) {
  return VALID_TRANSITIONS[currentStatus] || [];
}

function calculateSLAStatus(dueDate, slaHours) {
  if (!dueDate) return SLA_STATUSES.WITHIN_SLA;
  const now = new Date();
  const due = new Date(dueDate);
  if (now > due) return SLA_STATUSES.BREACHED;
  const hoursRemaining = (due - now) / (1000 * 60 * 60);
  if (hoursRemaining <= (slaHours || 48) * 0.25) return SLA_STATUSES.AT_RISK;
  return SLA_STATUSES.WITHIN_SLA;
}

function calculateAchievement(achievement, target) {
  if (!target || target <= 0) return 0;
  return Math.round((achievement / target) * 100 * 100) / 100;
}

function calculateVariance(achievement, target) {
  return Math.round((achievement - (target || 0)) * 100) / 100;
}

function calculateProgress(subTasks) {
  if (!subTasks || subTasks.length === 0) return 0;
  const completed = subTasks.filter(st => st.IsCompleted || st.status === 'COMPLETED').length;
  return Math.round((completed / subTasks.length) * 100);
}

/**
 * V2.3: Evaluate a condition expression against persisted outputs.
 * Condition format: { field: 'outputField', operator: 'eq', value: 'expected' }
 * Supports nested conditions: { and: [...] }, { or: [...] }, { not: {...} }
 */
function evaluateCondition(condition, outputs) {
  if (!condition) return true; // No condition = always visible

  // Handle compound conditions
  if (condition.and && Array.isArray(condition.and)) {
    return condition.and.every(c => evaluateCondition(c, outputs));
  }
  if (condition.or && Array.isArray(condition.or)) {
    return condition.or.some(c => evaluateCondition(c, outputs));
  }
  if (condition.not) {
    return !evaluateCondition(condition.not, outputs);
  }

  // Simple condition: { field, operator, value }
  const { field, operator, value } = condition;
  if (!field || !operator) {
    return true; // Malformed condition = visible (fail open for safety)
  }

  const actual = outputs?.[field];
  const expected = value;

  switch (operator) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'nin': return Array.isArray(expected) && !expected.includes(actual);
    case 'contains': return String(actual || '').includes(String(expected || ''));
    case 'is_null': return actual === null || actual === undefined || actual === '';
    case 'is_not_null': return actual !== null && actual !== undefined && actual !== '';
    default: return true; // Unknown operator = visible (fail open)
  }
}

/**
 * V2.3: Determine visibility state for an activity/subtask based on its VisibleWhen condition.
 * Returns 'VISIBLE', 'SKIPPED', or 'WAITING'.
 * WAITING means the condition depends on outputs that don't exist yet.
 */
function evaluateVisibility(visibleWhen, outputs) {
  if (!visibleWhen) return VISIBILITY_STATES.VISIBLE;

  // Check if all required fields for the condition exist in outputs
  const requiredFields = extractConditionFields(visibleWhen);
  const missingFields = requiredFields.filter(f => !(f in (outputs || {})));

  if (missingFields.length > 0) {
    return VISIBILITY_STATES.WAITING;
  }

  const result = evaluateCondition(visibleWhen, outputs);
  return result ? VISIBILITY_STATES.VISIBLE : VISIBILITY_STATES.SKIPPED;
}

/**
 * Extract all field references from a condition (including nested).
 */
function extractConditionFields(condition) {
  const fields = new Set();
  function walk(c) {
    if (!c || typeof c !== 'object') return;
    if (c.field) fields.add(c.field);
    if (c.and) c.and.forEach(walk);
    if (c.or) c.or.forEach(walk);
    if (c.not) walk(c.not);
  }
  walk(condition);
  return Array.from(fields);
}

/**
 * V2.3: Calculate weighted progress excluding skipped activities.
 * WeightedProgress = (CompletedMandatory + CompletedOptional) / (TotalMandatory + VisibleOptional) * 100
 */
function calculateWeightedProgress(subTasks, activities) {
  if (!subTasks || subTasks.length === 0) return 0;

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const st of subTasks) {
    const stActivities = activities?.filter(a => a.SubTaskId === st.Id) || [];
    const mandatoryCount = stActivities.filter(a => a.IsMandatory).length;
    const completedMandatory = stActivities.filter(a => a.IsMandatory && a.IsCompleted).length;

    const visibleOptional = stActivities.filter(a => !a.IsMandatory && (a.VisibilityState || 'VISIBLE') === 'VISIBLE').length;
    const completedOptional = stActivities.filter(a => !a.IsMandatory && a.IsCompleted && (a.VisibilityState || 'VISIBLE') === 'VISIBLE').length;

    // Subtask weight = 1 (or could be WeightagePct)
    const stWeight = st.WeightagePct || 1;
    totalWeight += stWeight;

    // Earn weight proportionally
    const mandatoryRatio = mandatoryCount > 0 ? completedMandatory / mandatoryCount : 1;
    const optionalRatio = visibleOptional > 0 ? completedOptional / visibleOptional : 1;
    // Weight = 70% mandatory, 30% optional (or use WeightagePct)
    earnedWeight += stWeight * (0.7 * mandatoryRatio + 0.3 * optionalRatio);
  }

  return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100 * 100) / 100 : 0;
}

/**
 * V2.3: Check if a subtask is "complete" considering conditional visibility.
 * A subtask is complete when all its VISIBLE mandatory activities are completed.
 */
function isSubTaskComplete(subTask, activities) {
  const stActivities = activities?.filter(a => a.SubTaskId === subTask.Id) || [];
  const visibleMandatory = stActivities.filter(a => a.IsMandatory && (a.VisibilityState || 'VISIBLE') === 'VISIBLE');
  if (visibleMandatory.length === 0) return subTask.IsCompleted || false;
  return visibleMandatory.every(a => a.IsCompleted);
}

/**
 * V2.3: Check if a task is "complete" considering conditional visibility.
 * A task is complete when all its subtasks are complete (considering visibility).
 */
function isTaskComplete(subTasks, activities) {
  if (!subTasks || subTasks.length === 0) return false;
  return subTasks.every(st => isSubTaskComplete(st, activities));
}

function getNextDueDate(frequency, customCron, fromDate = new Date()) {
  const d = new Date(fromDate);
  switch (frequency) {
    case 'DAILY': d.setDate(d.getDate() + 1); break;
    case 'WEEKLY': d.setDate(d.getDate() + 7); break;
    case 'BI_WEEKLY': d.setDate(d.getDate() + 14); break;
    case 'MONTHLY': d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'HALF_YEARLY': d.setMonth(d.getMonth() + 6); break;
    case 'YEARLY': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setDate(d.getDate() + 7); break;
  }
  return d;
}

function getTransitionTimestamps(fromStatus, toStatus, now = new Date()) {
  const t = {};
  switch (toStatus) {
    case 'ASSIGNED': t.AssignedAt = now; break;
    case 'ACCEPTED': t.AcceptedAt = now; break;
    case 'IN_PROGRESS': t.StartedAt = now; break;
    case 'SUBMITTED': t.SubmittedAt = now; break;
    case 'UNDER_REVIEW': t.ReviewedAt = now; break;
    case 'APPROVED': t.ReviewedAt = now; t.CompletedAt = now; break;
    case 'REJECTED': t.ReviewedAt = now; t.CompletedAt = null; break;
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

module.exports = {
  WORKFLOW_STATUSES, VALID_TRANSITIONS, REVIEW_DECISIONS, SLA_STATUSES,
  FREQUENCIES, DEPARTMENTS, CATEGORIES, PRIORITIES, TARGET_TYPES,
  COMPLEXITY_LEVELS, APPROVAL_LEVELS, AUTO_ASSIGN_STRATEGIES,
  NOTIFICATION_TYPES,
  VISIBILITY_STATES, CONDITION_OPERATORS,
  canTransition, getNextTransitions, calculateSLAStatus,
  calculateAchievement, calculateVariance, calculateProgress,
  calculateWeightedProgress, isSubTaskComplete, isTaskComplete,
  evaluateCondition, evaluateVisibility, extractConditionFields,
  getNextDueDate, getEscalationLevel, getTransitionTimestamps,
  resolveReviewTransition,
};