/**
 * TaskFlow Workflow Engine
 * Pure state machine for task lifecycle management
 */

const WORKFLOW_STATUSES = {
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

const ESCALATION_LEVELS = {
  NONE: 0,
  ASSIGNEE: 1,
  REVIEWER: 2,
  MANAGER: 3,
  ADMIN: 4
};

const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  IN_APP: 'inApp',
  SLACK: 'slack',
  WEBHOOK: 'webhook'
};

// ============================================================
// STATE MACHINE
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
  return transitions[currentStatus] || [];
}

// ============================================================
// SLA CALCULATIONS
// ============================================================

function calculateSlaStatus(dueDate, slaHours, options = {}) {
  if (!dueDate) return 'WITHIN_SLA';
  
  const now = new Date();
  const due = new Date(dueDate);
  
  if (now > due) return 'BREACHED';
  
  const hoursRemaining = (due - now) / (1000 * 60 * 60);
  const riskThreshold = (slaHours || 48) * 0.25; // 25% of SLA = at risk
  
  if (hoursRemaining <= riskThreshold) return 'AT_RISK';
  return 'WITHIN_SLA';
}

function calculateBusinessHoursElapsed(startDate, endDate, options = {}) {
  const { timezone = 'Asia/Kolkata', excludeWeekends = true, holidays = [] } = options;
  
  let current = new Date(startDate);
  const end = new Date(endDate);
  let hours = 0;
  
  while (current < end) {
    const day = current.getDay();
    const isWeekend = excludeWeekends && (day === 0 || day === 6);
    const isHoliday = holidays.some(holiday => {
      const h = new Date(holiday);
      return h.toDateString() === current.toDateString();
    });
    
    if (!isWeekend && !isHoliday) {
      hours += 1;
    }
    
    current.setTime(current.getTime() + 60 * 60 * 1000); // +1 hour
  }
  
  return hours;
}

function calculateSlaBreach(dueDate, slaHours, options = {}) {
  const { businessHoursOnly = true, timezone = 'Asia/Kolkata', excludeWeekends = true } = options;
  
  if (!dueDate) return { breached: false, hoursOverdue: 0 };
  
  const now = new Date();
  const due = new Date(dueDate);
  
  if (!businessHoursOnly) {
    const hoursOverdue = (now - due) / (1000 * 60 * 60);
    return { breached: now > due, hoursOverdue: Math.max(0, hoursOverdue) };
  }
  
  // Business hours calculation
  const businessHoursElapsed = calculateBusinessHoursElapsed(new Date(Date.now() - slaHours * 60 * 60 * 1000), now, {
    excludeWeekends,
    timezone: options.timezone
  });
  
  return {
    breached: businessHoursElapsed > slaHours,
    hoursOverdue: Math.max(0, businessHoursElapsed - slaHours)
  };
}

// ============================================================
// ESCALATION ENGINE
// ============================================================

function getEscalationLevel(dueDate, slaHours, options = {}) {
  if (!dueDate) return null;
  
  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due - now) / (1000 * 60 * 60);
  
  // After breach
  if (hoursUntilDue < -24) return 'ADMIN';
  if (hoursUntilDue < 0) return 'MANAGER';
  if (hoursUntilDue <= 12) return 'REVIEWER';
  if (hoursUntilDue <= 24) return 'ASSIGNEE';
  
  return null;
}

function getEscalationTargets(escalationLevel, task) {
  const targets = [];
  
  switch (escalationLevel) {
    case 'ASSIGNEE':
      if (task.assigneeId) targets.push({ userId: task.assigneeId, role: 'assignee' });
      break;
    case 'REVIEWER':
      if (task.reviewerId) targets.push({ userId: task.reviewerId, role: 'reviewer' });
      if (task.assigneeId) targets.push({ userId: task.assigneeId, role: 'assignee' });
      break;
    case 'MANAGER':
      // Would need to look up manager from user hierarchy
      if (task.assigneeId) targets.push({ userId: task.assigneeId, role: 'assignee' });
      if (task.reviewerId) targets.push({ userId: task.reviewerId, role: 'reviewer' });
      break;
    case 'ADMIN':
      // Would need to look up admins
      break;
  }
  
  return targets;
}

function calculateEscalationSchedule(dueDate, slaHours, rules = []) {
  const schedule = [];
  const now = new Date();
  const due = new Date(dueDate);
  
  if (!dueDate) return schedule;
  
  // Default escalation rules if none provided
  const defaultRules = [
    { level: 'ASSIGNEE', hoursBeforeDue: 24, notify: ['assignee'] },
    { level: 'REVIEWER', hoursBeforeDue: 12, notify: ['reviewer'] },
    { level: 'MANAGER', hoursAfterBreach: 0, notify: ['manager'] },
    { level: 'ADMIN', hoursAfterBreach: 24, notify: ['admin'] }
  ];
  
  const rulesToUse = rules.length > 0 ? rules : defaultRules;
  
  for (const rule of rulesToUse) {
    if (rule.hoursBeforeDue !== undefined) {
      const triggerTime = new Date(due.getTime() - rule.hoursBeforeDue * 60 * 60 * 1000);
      if (triggerTime > new Date()) {
        schedule.push({
          level: rule.level,
          triggerAt: triggerTime,
          notify: rule.notify,
          type: 'warning'
        });
      }
    }
    
    if (rule.hoursAfterBreach !== undefined) {
      const breachTime = new Date(due.getTime() + rule.hoursAfterBreach * 60 * 60 * 1000);
      schedule.push({
        level: rule.level,
        triggerAt: breachTime,
        notify: rule.notify,
        type: 'breach'
      });
    }
  }
  
  return schedule.sort((a, b) => a.triggerAt - b.triggerAt);
}

// ============================================================
// UTILITY FUNCTIONS
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
  return transitions[currentStatus] || [];
}

function calculateSlaStatus(dueDate, slaHours, options = {}) {
  return calculateSlaStatus(dueDate, slaHours, options);
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
    case 'CUSTOM':
      // Would need cron-parser for custom cron
      break;
    default: d.setDate(d.getDate() + 7); break;
  }
  return d;
}

function getEscalationLevel(dueDate, slaHours, options = {}) {
  return getEscalationLevel(dueDate, slaHours, options);
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

function getEscalationSchedule(dueDate, slaHours, rules = []) {
  const schedule = [];
  const due = new Date(dueDate);
  
  const defaultRules = [
    { level: 'ASSIGNEE', hoursBeforeDue: 24, notify: ['assignee'] },
    { level: 'REVIEWER', hoursBeforeDue: 12, notify: ['reviewer'] },
    { level: 'MANAGER', hoursAfterBreach: 0, notify: ['manager'] },
    { level: 'ADMIN', hoursAfterBreach: 24, notify: ['admin'] }
  ];
  
  const rulesToUse = rules.length > 0 ? rules : defaultRules;
  
  for (const rule of rulesToUse) {
    if (rule.hoursBeforeDue !== undefined) {
      const triggerTime = new Date(due.getTime() - rule.hoursBeforeDue * 60 * 60 * 1000);
      if (triggerTime > new Date()) {
        schedule.push({
          level: rule.level,
          triggerAt: triggerTime,
          notify: rule.notify,
          type: 'warning'
        });
      }
    }
    
    if (rule.hoursAfterBreach !== undefined) {
      const breachTime = new Date(due.getTime() + rule.hoursAfterBreach * 60 * 60 * 1000);
      schedule.push({
        level: rule.level,
        triggerAt: breachTime,
        notify: rule.notify,
        type: 'breach'
      });
    }
  }
  
  return schedule.sort((a, b) => a.triggerAt - b.triggerAt);
}

function getNextTransitions(currentStatus) {
  return getNextTransitions(currentStatus);
}

function calculateSlaStatus(dueDate, slaHours, options = {}) {
  return calculateSlaStatus(dueDate, slaHours, options);
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

function getEscalationLevel(dueDate, slaHours, options = {}) {
  return getEscalationLevel(dueDate, slaHours, options);
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

module.exports = {
  // Enums
  WORKFLOW_STATUSES: ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REWORK', 'CANCELLED'],
  SUBTASK_STATUS: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'],
  SLA_STATUS: ['WITHIN_SLA', 'AT_RISK', 'BREACHED'],
  PRIORITY: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
  FREQUENCY: ['ONE_TIME', 'DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'],
  ESCALATION_LEVELS: ['NONE', 'ASSIGNEE', 'REVIEWER', 'MANAGER', 'ADMIN'],
  
  // State Machine
  VALID_TRANSITIONS: {
    CREATED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    REJECTED: ['REWORK'],
    REWORK: ['IN_PROGRESS'],
    APPROVED: [],
    CANCELLED: []
  },
  canTransition,
  getNextTransitions,
  
  // SLA
  calculateSlaStatus,
  calculateBusinessHoursElapsed,
  calculateSlaBreach,
  calculateAchievement,
  calculateVariance,
  
  // Escalation
  getEscalationLevel,
  getEscalationTargets,
  getEscalationSchedule,
  
  // Transitions
  canTransition,
  getNextTransitions,
  getTransitionTimestamps,
  resolveReviewTransition,
  
  // Recurrence
  getNextDueDate,
  
  // Escalation
  getEscalationLevel,
  getEscalationSchedule,
  
  // Constants
  WORKFLOW_STATUSES: ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REWORK', 'CANCELLED'],
  SUBTASK_STATUSES: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'],
  SLA_STATUSES: ['WITHIN_SLA', 'AT_RISK', 'BREACHED'],
  PRIORITIES: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
  FREQUENCIES: ['ONE_TIME', 'DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'],
  ESCALATION_LEVELS: ['NONE', 'ASSIGNEE', 'REVIEWER', 'MANAGER', 'ADMIN']
};