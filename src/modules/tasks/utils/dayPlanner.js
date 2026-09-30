/**
 * dayPlanner — turns "everything assigned to me" into "what I do today, in what order, and when".
 *
 * Pure functions only (no React, no network, `now` is injected) so the plan can
 * re-flow every minute and is fully unit-testable.
 *
 * Principles
 *  1. Explainable  – every task carries plain-language reasons ("Overdue 2d", "Sent back").
 *  2. Finish before you start – work already in progress gets a boost (less context switching).
 *  3. Honest        – if the day cannot fit the must-dos, say so instead of pretending.
 *  4. Forgiving     – estimates shrink as steps are ticked; lunch / after-hours handled.
 */

export const DEFAULT_WORKDAY = {
  start: '10:00',
  end: '19:00',
  breaks: [{ start: '13:30', end: '14:30', label: 'Lunch' }],
};

export const ACTIONABLE_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'REWORK', 'REJECTED', 'ESCALATED'];

const PRIORITY_WEIGHT = { CRITICAL: 40, HIGH: 28, MEDIUM: 16, LOW: 6 };
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** Per-status plain-language label — no workflow jargon for people doing the work. */
export const FRIENDLY_STATUS = {
  ASSIGNED: 'To do',
  ACCEPTED: 'To do',
  IN_PROGRESS: 'In progress',
  REJECTED: 'Fix requested',
  REWORK: 'Fixing',
  ESCALATED: 'Escalated',
  SUBMITTED: 'With reviewer',
  RESUBMITTED: 'With reviewer',
  UNDER_REVIEW: 'Being reviewed',
  APPROVED: 'Approved',
};

export function parseHM(hm) {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatHM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Working windows for the day that contains `anchorMs`, minus breaks. Epoch-ms pairs. */
export function workWindows(anchorMs, workday = DEFAULT_WORKDAY) {
  const day0 = startOfDay(anchorMs);
  const start = day0 + parseHM(workday.start) * MIN;
  const end = day0 + parseHM(workday.end) * MIN;
  const breaks = (workday.breaks || [])
    .map(b => ({ ...b, s: day0 + parseHM(b.start) * MIN, e: day0 + parseHM(b.end) * MIN }))
    .filter(b => b.e > b.s && b.s >= start && b.e <= end)
    .sort((a, b) => a.s - b.s);
  const windows = [];
  let cursor = start;
  for (const b of breaks) {
    if (b.s > cursor) windows.push([cursor, b.s]);
    cursor = Math.max(cursor, b.e);
  }
  if (end > cursor) windows.push([cursor, end]);
  return { start, end, windows, breaks };
}

export function parseJson(v, fallback = []) {
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v || 'null'); return p ?? fallback; } catch { return fallback; }
}

/**
 * How long is this task likely to still take?
 * base = template estimate (default 60m); shrinks with step progress;
 * fixes after a review are assumed to be about half the original effort.
 */
export function estimateMinutes(task) {
  const base = Math.min(480, Math.max(10, Number(task.EstimatedMinutes) || 60));
  const total = Number(task.SubTaskTotal) || 0;
  const done = Number(task.SubTaskDone) || 0;
  // Multi-brand routines: brands covered count as progress too (averaged with sub-task progress when both exist).
  const brandTotal = Number(task.BrandTotal) || 0;
  const brandDone = Number(task.BrandDone) || 0;
  const stProgress = total > 0 ? Math.min(1, done / total) : null;
  const brandProgress = brandTotal > 0 ? Math.min(1, brandDone / brandTotal) : null;
  const progress = stProgress !== null && brandProgress !== null ? (stProgress + brandProgress) / 2 : (brandProgress ?? stProgress ?? 0);
  const isFix = task.Status === 'REJECTED' || task.Status === 'REWORK';
  const remaining = base * (isFix ? 0.5 : 1) * (1 - progress);
  return Math.max(10, Math.round(remaining / 5) * 5);
}

/**
 * Score + explain one task.  Higher = do sooner.
 * urgency: overdue | today | soon (next 24h after today) | week | later | none
 */
export function scoreTask(task, now, workday = DEFAULT_WORKDAY) {
  const reasons = [];
  let score = PRIORITY_WEIGHT[task.Priority] ?? PRIORITY_WEIGHT.MEDIUM;
  if (task.Priority === 'CRITICAL') reasons.push({ text: 'Critical', tone: 'danger' });
  else if (task.Priority === 'HIGH') reasons.push({ text: 'High priority', tone: 'warn' });

  let urgency = 'none';
  const due = task.DueDate ? new Date(task.DueDate).getTime() : null;
  if (due !== null && !Number.isNaN(due)) {
    const { end } = workWindows(now, workday);
    const dayEnd = Math.max(end, now); // after hours: "today" just means "already late"
    if (due < now) {
      const days = Math.floor((now - due) / DAY); // whole days late (0 = late, but < 1 day)
      urgency = 'overdue';
      score += 50 + Math.min(20, Math.max(1, days) * 5);
      reasons.push({ text: days < 1 ? 'Overdue' : `Overdue ${days}d`, tone: 'danger' });
    } else if (due <= dayEnd) {
      urgency = 'today';
      // Earlier deadlines outrank later ones on the same day (a 1:30 PM cut-off before a 6 PM report).
      const hoursLeft = (due - now) / 3600000;
      score += 30 + Math.max(0, Math.min(8, Math.round(8 - hoursLeft)));
      const t = new Date(due);
      const clock = `${t.getHours() % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')} ${t.getHours() < 12 ? 'AM' : 'PM'}`;
      reasons.push({ text: `Due by ${clock}`, tone: 'warn' });
    } else if (due <= dayEnd + DAY) {
      urgency = 'soon';
      score += 18;
      reasons.push({ text: 'Due tomorrow', tone: 'info' });
    } else if (due <= dayEnd + 3 * DAY) {
      urgency = 'week';
      score += 8;
    } else urgency = 'later';
  }

  if (task.SLAStatus === 'BREACHED') { score += 15; reasons.push({ text: 'SLA breached', tone: 'danger' }); }
  else if (task.SLAStatus === 'AT_RISK') { score += 10; reasons.push({ text: 'SLA at risk', tone: 'warn' }); }

  const needsFix = task.Status === 'REJECTED' || task.Status === 'REWORK';
  if (needsFix) { score += 18; reasons.push({ text: 'Fix requested', tone: 'danger' }); }
  const escalated = task.Status === 'ESCALATED';
  if (escalated) { score += 15; reasons.push({ text: 'Escalated', tone: 'danger' }); }
  if (task.Status === 'IN_PROGRESS' || task.Status === 'REWORK') { score += 8; reasons.push({ text: 'Already started', tone: 'info' }); }
  if (task.Source === 'RULESET') reasons.push({ text: 'Automation', tone: 'auto' });

  return { score, reasons, urgency, needsFix, escalated };
}

/** MUST = will hurt if skipped today · SHOULD = good use of the day · LATER = not today. */
export function bucketOf(scored, task) {
  if (scored.urgency === 'overdue' || scored.urgency === 'today' || scored.needsFix || scored.escalated || scored.score >= 70) return 'MUST';
  if (scored.score >= 35 || task.Status === 'IN_PROGRESS') return 'SHOULD';
  return 'LATER';
}

/** Minutes a reviewer should budget for the waiting review queue (capped). */
export function reviewBlockMinutes(count) {
  if (!count) return 0;
  return Math.min(60, Math.max(15, count * 8));
}

/**
 * Lay items onto the free windows, splitting across lunch when a chunk is big
 * enough to be worth resuming. Returns slots + items that did not fit.
 */
function schedule(items, windows, from) {
  const free = windows
    .map(([s, e]) => [Math.max(s, from), e])
    .filter(([s, e]) => e - s >= 5 * MIN)
    .map(([s, e]) => ({ cursor: s, end: e }));
  const slots = [];
  const overflow = [];
  let wi = 0;

  for (const item of items) {
    let remaining = item.minutes;
    const pieces = [];
    let probe = wi;
    let probeCursors = free.map(w => w.cursor);
    while (remaining > 0 && probe < free.length) {
      const w = free[probe];
      const room = Math.floor((w.end - probeCursors[probe]) / MIN);
      if (room <= 0) { probe++; continue; }
      const take = Math.min(room, remaining);
      // don't leave a sliver (<25m) at a window's edge unless it finishes the task
      if (take < remaining && take < 25) { probe++; continue; }
      pieces.push({ start: probeCursors[probe], end: probeCursors[probe] + take * MIN, minutes: take });
      probeCursors[probe] += take * MIN;
      remaining -= take;
      if (probeCursors[probe] >= w.end) probe++;
    }
    if (remaining > 0) { overflow.push({ ...item, unplacedMinutes: remaining }); continue; }
    free.forEach((w, i) => { w.cursor = probeCursors[i]; });
    while (wi < free.length && free[wi].cursor >= free[wi].end) wi++;
    pieces.forEach((p, idx) => slots.push({ ...item, ...p, part: pieces.length > 1 ? idx + 1 : null, of: pieces.length > 1 ? pieces.length : null }));
  }
  return { slots, overflow };
}

/**
 * Build the whole day.
 *
 * @param {object}   input
 * @param {object[]} input.tasks        actionable tasks (from /pems/my-day)
 * @param {object[]} [input.reviews]    tasks waiting for me to review
 * @param {number}   input.now          epoch ms
 * @param {object}   [input.workday]
 * @param {Set|string[]} [input.deferred] ids the user pushed to "later"
 */
export function buildPlan({ tasks = [], reviews = [], now, workday = DEFAULT_WORKDAY, deferred = [] }) {
  const deferredSet = new Set(deferred);

  // After hours → plan tomorrow so the user still gets a useful "first thing in the morning".
  let today = workWindows(now, workday);
  let isTomorrow = false;
  if (now >= today.end) {
    today = workWindows(now + DAY, workday);
    isTomorrow = true;
  }
  const effectiveNow = isTomorrow ? today.start : now;

  const enriched = tasks
    .filter(t => ACTIONABLE_STATUSES.includes(t.Status))
    .map(t => {
      const scored = scoreTask(t, effectiveNow, workday);
      let bucket = bucketOf(scored, t);
      const wasDeferred = deferredSet.has(t.Id);
      if (wasDeferred) bucket = 'LATER';
      return { task: t, ...scored, bucket, deferred: wasDeferred, minutes: estimateMinutes(t) };
    })
    .sort((a, b) => b.score - a.score || (new Date(a.task.DueDate || 8.64e15) - new Date(b.task.DueDate || 8.64e15)));

  const must = enriched.filter(e => e.bucket === 'MUST');
  const should = enriched.filter(e => e.bucket === 'SHOULD');
  const later = enriched.filter(e => e.bucket === 'LATER');

  const reviewMin = reviewBlockMinutes(reviews.length);
  const ordered = [...must, ...should].map(e => ({ type: 'task', key: `t-${e.task.Id}`, taskId: e.task.Id, entry: e, minutes: e.minutes }));
  if (reviewMin > 0) {
    // reviewers shouldn't block their own work: do the most important task first, then review
    ordered.splice(ordered.length ? 1 : 0, 0, { type: 'review', key: 'reviews', minutes: reviewMin, count: reviews.length });
  }

  const from = Math.max(today.start, effectiveNow);
  const { slots: placed, overflow } = schedule(ordered, today.windows, from);

  // merge breaks that are still ahead, so the timeline reads like a real agenda
  const breakSlots = today.breaks
    .filter(b => b.e > from)
    .map(b => ({ type: 'break', key: `b-${b.s}`, label: b.label || 'Break', start: Math.max(b.s, from), end: b.e, minutes: Math.round((b.e - Math.max(b.s, from)) / MIN) }));
  const slots = [...placed, ...breakSlots].sort((a, b) => a.start - b.start);

  const capacityMin = today.windows.reduce((sum, [s, e]) => sum + Math.max(0, Math.floor((e - Math.max(s, from)) / MIN)), 0);
  const plannedMin = ordered.reduce((s, i) => s + i.minutes, 0);
  const mustMin = must.reduce((s, e) => s + e.minutes, 0);
  const overflowMust = overflow.filter(o => o.type === 'task' && o.entry.bucket === 'MUST');
  const overflowShould = overflow.filter(o => o.type === 'task' && o.entry.bucket === 'SHOULD');

  let health = 'on_track';
  if (overflowMust.length > 0) health = 'overloaded';
  else if (plannedMin > capacityMin * 0.9 || overflowShould.length > 0) health = 'tight';
  if (!ordered.length) health = 'clear';

  const firstTask = slots.find(s => s.type === 'task');
  return {
    isTomorrow,
    workday: { start: today.start, end: today.end },
    must, should, later,
    slots,
    overflow,
    next: firstTask ? firstTask.entry : null,
    summary: {
      capacityMin, plannedMin, mustMin,
      mustCount: must.length, shouldCount: should.length, laterCount: later.length,
      reviewCount: reviews.length, reviewMin,
      overflowMinutes: Math.max(0, plannedMin - capacityMin),
      health,
    },
  };
}

/**
 * The one button that moves a task forward, in the user's language.
 * `next` is the workflow status it transitions to (null = open the full task).
 */
export function primaryAction(task, stepsLeft = 0) {
  switch (task.Status) {
    case 'ASSIGNED':
    case 'ACCEPTED': return { label: 'Start task', next: 'IN_PROGRESS', needsNote: false };
    case 'IN_PROGRESS': return { label: stepsLeft > 0 ? `${stepsLeft} step${stepsLeft > 1 ? 's' : ''} to go` : 'Submit for review', next: stepsLeft > 0 ? null : 'SUBMITTED', needsNote: true, blocked: stepsLeft > 0 };
    case 'REJECTED': return { label: 'Start fixing', next: 'REWORK', needsNote: false };
    case 'REWORK': return { label: stepsLeft > 0 ? `${stepsLeft} step${stepsLeft > 1 ? 's' : ''} to go` : 'Resubmit for review', next: stepsLeft > 0 ? null : 'RESUBMITTED', needsNote: true, blocked: stepsLeft > 0 };
    case 'ESCALATED': return { label: 'Resume task', next: 'IN_PROGRESS', needsNote: false };
    default: return { label: 'Open', next: null, needsNote: false };
  }
}

/** "Good morning" etc., by local hour. */
export function greeting(now) {
  const h = new Date(now).getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
