const CLOSED = new Set(['APPROVED', 'CANCELLED']);
const REVIEW = new Set(['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED']);

export const TASK_LIST_VIEWS = [
  { key: 'TODO', label: 'To do' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'PENDING_REVIEW', label: 'In review' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ALL', label: 'All tasks' },
];

export function taskProgress(task) {
  const value = Number(task.WeightedProgressPct ?? task.ProgressPct ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

export function taskNextAction(task) {
  if (REVIEW.has(task.Status)) return { label: 'View submission', hint: 'Waiting for independent review' };
  if (task.Status === 'APPROVED') return { label: 'View task', hint: 'Approved and complete' };
  if (task.Status === 'CANCELLED') return { label: 'View task', hint: 'This task was cancelled' };
  if (['REWORK', 'REJECTED'].includes(task.Status)) return { label: 'Review feedback', hint: 'Changes requested by your reviewer' };
  if (task.Status === 'IN_PROGRESS') return { label: 'Continue', hint: 'Continue your task activities' };
  if (task.Status === 'ESCALATED') return { label: 'Open task', hint: 'Attention needed' };
  return { label: 'Open task', hint: task.Status === 'DRAFT' ? 'Awaiting assignment' : 'Ready to get started' };
}

export function taskDue(task, now = new Date()) {
  const due = new Date(task.DueDate);
  if (!task.DueDate || Number.isNaN(due.getTime())) return { label: 'No due date', tone: 'muted' };
  const sameDay = due.toDateString() === now.toDateString();
  const date = due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (!CLOSED.has(task.Status) && due < now) return { label: sameDay ? 'Overdue today' : `Overdue · ${date}`, detail: time, tone: 'danger' };
  return { label: sameDay ? 'Today' : date, detail: time, tone: sameDay && !CLOSED.has(task.Status) ? 'today' : 'muted' };
}

/** Server-side filtering keeps pagination and the visible work scope aligned. */
export function buildWorklistParams({ userId, scope, quickView, dateFilter, filters = {}, search, page, limit, sort, disputesOnly, viewMode, now = new Date() }) {
  if (scope === 'mine' && !userId) throw new Error('Your account could not be identified. Please sign in again.');
  const p = { page, limit, includeRuleTasks: 'true' };
  if (search) p.search = search;
  if (quickView === 'TODO') p.status = 'ASSIGNED,ACCEPTED,IN_PROGRESS,REJECTED,REWORK,ESCALATED';
  if (quickView === 'IN_PROGRESS') p.status = 'IN_PROGRESS';
  if (quickView === 'PENDING_REVIEW') p.status = 'SUBMITTED,UNDER_REVIEW,RESUBMITTED';
  if (quickView === 'COMPLETED') p.status = 'APPROVED';
  const mappings = { department: 'department', seller: 'sellerId', manager: 'assignedTo', reviewer: 'reviewerId', priority: 'priority', status: 'status', frequency: 'frequency', health: 'health' };
  Object.entries(mappings).forEach(([key, target]) => { if (filters[key]) p[target] = filters[key]; });
  // A secondary owner filter can never broaden the personal queue.
  if (scope === 'mine') p.assignedTo = userId;
  if (dateFilter === 'overdue') { p.overdue = 'true'; p.excludeStatuses = 'APPROVED,CANCELLED'; }
  if (dateFilter === 'today' || dateFilter === 'upcoming') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    if (dateFilter === 'upcoming') start.setDate(start.getDate() + 1);
    p.dueAfter = start.toISOString();
    if (dateFilter === 'today') { const end = new Date(start); end.setDate(end.getDate() + 1); p.dueBefore = new Date(end.getTime() - 1).toISOString(); }
  }
  if (filters.source === 'automation') p.isAutomated = true;
  else if (filters.source) p.source = filters.source;
  if (disputesOnly) p.categories = 'PRICING,LISTING';
  if (viewMode === 'seller') p.includeSubtasks = 'true';
  p.sortBy = sort === 'newest' ? 'CreatedAt' : 'DueDate';
  p.sortOrder = sort === 'newest' ? 'desc' : 'asc';
  return p;
}
