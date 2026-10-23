/**
 * Client-side mirror of the server publish gate
 * (backend/services/pems/pemsService.js → validateTemplateForPublish).
 *
 * This exists purely so the six-section builder can show field-level feedback
 * while the process owner is editing. It is NOT a security or business-rule
 * boundary — the server re-validates every publish and is the source of truth.
 * Keep the two in sync; when they disagree the server wins.
 */

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_FREQUENCIES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM'];
const VALID_APPROVAL_LEVELS = ['single', 'dual', 'multi'];

/** Normalise the template object the builder holds into the server's shape. */
export function templateToPayload(values, phases) {
  return {
    name: values.name,
    taskCode: values.taskCode,
    category: values.category,
    department: values.department,
    description: values.description,
    priority: values.priority,
    frequency: values.frequency,
    runDays: values.runDays,
    dueTime: values.dueTime,
    customCron: values.customCron,
    slaHours: values.slaHours,
    tatHours: values.tatHours,
    estimatedExecutionMinutes: values.estimatedExecutionMinutes,
    criticalityScore: values.criticalityScore,
    targetType: values.targetType,
    defaultTarget: values.defaultTarget,
    expectedOutput: values.expectedOutput,
    reviewRequired: values.reviewRequired,
    reviewerId: values.reviewerId,
    assigneeRole: values.assigneeRole,
    autoAssign: values.autoAssign,
    brandMode: values.brandMode,
    assigneeUserIds: values.assigneeUserIds,
    isActive: values.isActive,
    subTaskDefinitions: Array.isArray(phases) ? phases : [],
  };
}

export function validateTemplate(template, rules = {}) {
  const t = template || {};
  const errors = [];
  const warnings = [];

  if (!t.name || !String(t.name).trim()) errors.push({ field: 'name', message: 'Task name is required.' });
  if (!t.taskCode || !String(t.taskCode).trim()) errors.push({ field: 'taskCode', message: 'Task code is required.' });
  if (!t.category || !String(t.category).trim()) errors.push({ field: 'category', message: 'Category is required.' });
  if (t.priority && !VALID_PRIORITIES.includes(String(t.priority).toUpperCase())) {
    errors.push({ field: 'priority', message: `Priority must be one of ${VALID_PRIORITIES.join(', ')}.` });
  }
  if (t.frequency && !VALID_FREQUENCIES.includes(String(t.frequency).toUpperCase())) {
    errors.push({ field: 'frequency', message: `Frequency must be one of ${VALID_FREQUENCIES.join(', ')}.` });
  }

  const freq = String(t.frequency || 'ONE_TIME').toUpperCase();
  const hasRunDays = Array.isArray(t.runDays) ? t.runDays.length > 0 : Boolean(t.runDays);
  if (freq !== 'ONE_TIME') {
    if (!hasRunDays && !t.customCron) errors.push({ field: 'schedule', message: 'A recurring template needs run days or a cron expression.' });
    if (!t.dueTime) warnings.push({ field: 'dueTime', message: 'No due time set; the routine will use the system default.' });
  }

  const phases = Array.isArray(t.subTaskDefinitions) ? t.subTaskDefinitions : [];
  if (phases.length === 0) {
    errors.push({ field: 'sop', message: 'At least one SOP phase is required before publishing.' });
  } else {
    phases.forEach((phase, pi) => {
      const acts = Array.isArray(phase.activities) ? phase.activities : [];
      if (!phase.title || !String(phase.title).trim()) errors.push({ field: `sop.${pi}.title`, message: `Phase ${pi + 1} needs a title.` });
      if (acts.length === 0) errors.push({ field: `sop.${pi}.activities`, message: `Phase ${pi + 1} needs at least one activity.` });
      acts.forEach((act, ai) => {
        if (act.isMandatory === false) return;
        if (!act.title || !String(act.title).trim()) errors.push({ field: `sop.${pi}.${ai}.title`, message: `Phase ${pi + 1} activity ${ai + 1} needs a title.` });
        if (!act.instructions || !String(act.instructions).trim()) errors.push({ field: `sop.${pi}.${ai}.instructions`, message: `Phase ${pi + 1} activity ${ai + 1} is mandatory but has no instructions.` });
      });
    });
  }

  if (t.reviewRequired !== false && !t.reviewerId) {
    warnings.push({ field: 'reviewerId', message: 'Review is required but no reviewer is set; a default will be assigned.' });
  }

  const r = rules || {};
  if (r.approvalLevel && !VALID_APPROVAL_LEVELS.includes(String(r.approvalLevel))) {
    errors.push({ field: 'approvalLevel', message: `Approval level must be one of ${VALID_APPROVAL_LEVELS.join(', ')}.` });
  }
  if (r.approvalLevel && String(r.approvalLevel) !== 'single') {
    warnings.push({ field: 'approvalLevel', message: 'Dual/multi approval is stored but review enforcement is limited to single-approver today.' });
  }
  if (r.escalationHours !== undefined && r.escalationHours !== null) {
    const n = Number(r.escalationHours);
    if (Number.isNaN(n) || n < 0 || n > 720) errors.push({ field: 'escalationHours', message: 'Escalation hours must be between 0 and 720.' });
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Group errors by top-level section for the section-rail status badges. */
export function groupErrorsBySection(validation) {
  const map = { definition: [], playbook: [], automation: [], evidence: [], assignment: [], review: [] };
  for (const e of validation.errors || []) {
    if (e.field === 'sop' || e.field.startsWith('sop.')) map.playbook.push(e);
    else if (['name', 'taskCode', 'category', 'priority', 'frequency', 'schedule', 'department'].includes(e.field)) map.definition.push(e);
    else if (['approvalLevel', 'escalationHours'].includes(e.field)) map.assignment.push(e);
    else map.automation.push(e);
  }
  return map;
}
