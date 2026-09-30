// Run with:  node --test src/modules/tasks/utils/__tests__/dayPlanner.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlan, scoreTask, estimateMinutes, bucketOf, primaryAction, workWindows, reviewBlockMinutes,
  DEFAULT_WORKDAY, parseHM, formatDuration,
} from '../dayPlanner.js';

const at = (h, m = 0, dayOffset = 0) => new Date(2026, 8, 30 + dayOffset, h, m, 0, 0).getTime(); // 30 Sep 2026, local time
let n = 0;
const task = (o = {}) => ({ Id: `t${++n}`, Title: 'Task', Priority: 'MEDIUM', Status: 'ASSIGNED', EstimatedMinutes: 60, SubTaskTotal: 0, SubTaskDone: 0, DueDate: null, ...o });
const due = (h, m = 0, dayOffset = 0) => new Date(2026, 8, 30 + dayOffset, h, m).toISOString();
const ids = (list) => list.map(e => e.task.Id);

test('work windows exclude lunch and handle custom hours', () => {
  const w = workWindows(at(9), DEFAULT_WORKDAY);
  assert.equal(w.windows.length, 2);
  assert.equal(w.windows[0][0], at(10)); assert.equal(w.windows[0][1], at(13, 30));
  assert.equal(w.windows[1][0], at(14, 30)); assert.equal(w.windows[1][1], at(19));
  const noBreak = workWindows(at(9), { start: '09:00', end: '17:00', breaks: [] });
  assert.equal(noBreak.windows.length, 1);
});

test('overdue outranks due-today outranks due-later; priority breaks ties', () => {
  const now = at(10);
  const overdue = scoreTask(task({ DueDate: due(9, 0, -2) }), now);
  const today = scoreTask(task({ DueDate: due(17) }), now);
  const later = scoreTask(task({ DueDate: due(12, 0, 10) }), now);
  assert.equal(overdue.urgency, 'overdue'); assert.equal(today.urgency, 'today'); assert.equal(later.urgency, 'later');
  assert.ok(overdue.score > today.score && today.score > later.score);
  assert.ok(scoreTask(task({ Priority: 'CRITICAL' }), now).score > scoreTask(task({ Priority: 'LOW' }), now).score);
});

test('reasons explain the ranking in plain language', () => {
  const s = scoreTask(task({ Priority: 'CRITICAL', DueDate: due(9, 0, -3), SLAStatus: 'BREACHED', Status: 'REJECTED' }), at(10));
  const texts = s.reasons.map(r => r.text);
  assert.ok(texts.includes('Critical') && texts.includes('Overdue 3d') && texts.includes('SLA breached') && texts.includes('Fix requested'));
});

test('bucketing: overdue / due today / fixes / escalations are MUST; idle low priority is LATER', () => {
  const now = at(10);
  const b = (t) => bucketOf(scoreTask(t, now), t);
  assert.equal(b(task({ DueDate: due(9, 0, -1) })), 'MUST');
  assert.equal(b(task({ DueDate: due(16) })), 'MUST');
  assert.equal(b(task({ Status: 'REJECTED' })), 'MUST');
  assert.equal(b(task({ Status: 'ESCALATED' })), 'MUST');
  assert.equal(b(task({ Priority: 'LOW', DueDate: due(12, 0, 20) })), 'LATER');
  assert.equal(b(task({ Priority: 'LOW', Status: 'IN_PROGRESS', DueDate: due(12, 0, 20) })), 'SHOULD');
});

test('estimates shrink with progress; fixes are ~half; clamps and rounding', () => {
  assert.equal(estimateMinutes(task({ EstimatedMinutes: 60 })), 60);
  assert.equal(estimateMinutes(task({ EstimatedMinutes: 60, SubTaskTotal: 4, SubTaskDone: 3 })), 15);
  assert.equal(estimateMinutes(task({ EstimatedMinutes: 60, Status: 'REWORK' })), 30);
  assert.equal(estimateMinutes(task({ EstimatedMinutes: 1 })), 10);
  assert.equal(estimateMinutes(task({ EstimatedMinutes: 99999 })), 480);
  assert.equal(estimateMinutes(task({ EstimatedMinutes: null })), 60);
  assert.equal(estimateMinutes(task({ EstimatedMinutes: 60, SubTaskTotal: 3, SubTaskDone: 3 })), 10);
});

test('plan orders by score, starts now, and never overlaps lunch', () => {
  const now = at(11);
  const a = task({ Title: 'A', DueDate: due(9, 0, -1), EstimatedMinutes: 90 });
  const b = task({ Title: 'B', Priority: 'HIGH', DueDate: due(17), EstimatedMinutes: 60 });
  const c = task({ Title: 'C', Priority: 'HIGH', EstimatedMinutes: 30 });
  const p = buildPlan({ tasks: [c, b, a], now });
  const order = p.slots.filter(s => s.type === 'task').map(s => s.entry.task.Title);
  assert.deepEqual(order.slice(0, 2), ['A', 'B']);
  assert.equal(p.slots[0].start, now);
  const lunchS = at(13, 30), lunchE = at(14, 30);
  for (const s of p.slots.filter(x => x.type === 'task')) assert.ok(s.end <= lunchS || s.start >= lunchE, 'slot overlaps lunch');
  const sorted = p.slots.filter(s => s.type !== 'break');
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].start >= sorted[i - 1].end, 'overlap');
  assert.ok(p.slots.some(s => s.type === 'break'));
  assert.equal(p.next.task.Title, 'A');
});

test('a long task that spans lunch is split into two resumable parts', () => {
  const p = buildPlan({ tasks: [task({ Title: 'Big', DueDate: due(17), EstimatedMinutes: 240 })], now: at(11) });
  const parts = p.slots.filter(s => s.type === 'task');
  assert.equal(parts.length, 2);
  assert.equal(parts[0].part, 1); assert.equal(parts[1].of, 2);
  assert.equal(parts[0].minutes + parts[1].minutes, 240);
});

test('before working hours the plan starts at opening time', () => {
  const p = buildPlan({ tasks: [task({ DueDate: due(17) })], now: at(8, 15) });
  assert.equal(p.slots[0].start, at(10));
  assert.equal(p.isTomorrow, false);
});

test('after hours the plan rolls to tomorrow morning', () => {
  const p = buildPlan({ tasks: [task({ DueDate: due(17) })], now: at(20) });
  assert.equal(p.isTomorrow, true);
  assert.equal(p.slots[0].start, at(10, 0, 1));
  assert.equal(p.summary.mustCount, 1); // it is overdue by then
});

test('overloaded day is reported honestly with overflow', () => {
  const tasks = [1, 2, 3, 4].map(i => task({ Title: `T${i}`, DueDate: due(17), EstimatedMinutes: 180 }));
  const p = buildPlan({ tasks, now: at(10) }); // 7.5h capacity vs 12h must
  assert.equal(p.summary.health, 'overloaded');
  assert.ok(p.overflow.length >= 1);
  assert.ok(p.summary.overflowMinutes > 0);
});

test('tight vs on-track vs clear', () => {
  const light = buildPlan({ tasks: [task({ DueDate: due(17), EstimatedMinutes: 60 })], now: at(10) });
  assert.equal(light.summary.health, 'on_track');
  const tight = buildPlan({ tasks: [task({ DueDate: due(17), EstimatedMinutes: 240 }), task({ DueDate: due(17), EstimatedMinutes: 195 })], now: at(10) });
  assert.equal(tight.summary.health, 'tight');
  const empty = buildPlan({ tasks: [], now: at(10) });
  assert.equal(empty.summary.health, 'clear'); assert.equal(empty.next, null);
});

test('deferred tasks move to LATER and are not scheduled', () => {
  const t = task({ DueDate: due(17) });
  const p = buildPlan({ tasks: [t], now: at(10), deferred: [t.Id] });
  assert.equal(p.later.length, 1); assert.equal(p.slots.filter(s => s.type === 'task').length, 0);
  assert.equal(p.later[0].deferred, true);
});

test('non-actionable statuses are ignored', () => {
  const p = buildPlan({ tasks: [task({ Status: 'SUBMITTED' }), task({ Status: 'APPROVED' }), task({ Status: 'CANCELLED' })], now: at(10) });
  assert.equal(p.must.length + p.should.length + p.later.length, 0);
});

test('reviewers get a review block after their top task', () => {
  const reviews = Array.from({ length: 4 }, (_, i) => ({ Id: `r${i}` }));
  const p = buildPlan({ tasks: [task({ DueDate: due(17) }), task({ DueDate: due(17), Priority: 'HIGH' })], reviews, now: at(10) });
  const kinds = p.slots.filter(s => s.type !== 'break').map(s => s.type);
  assert.deepEqual(kinds, ['task', 'review', 'task']);
  assert.equal(reviewBlockMinutes(4), 32); assert.equal(reviewBlockMinutes(1), 15); assert.equal(reviewBlockMinutes(30), 60); assert.equal(reviewBlockMinutes(0), 0);
  const only = buildPlan({ tasks: [], reviews, now: at(10) });
  assert.equal(only.slots[0].type, 'review');
  assert.equal(only.summary.health, 'on_track');
});

test('primary action speaks the user\'s language and gates submit on open steps', () => {
  assert.deepEqual(primaryAction({ Status: 'ASSIGNED' }), { label: 'Start task', next: 'IN_PROGRESS', needsNote: false });
  assert.equal(primaryAction({ Status: 'IN_PROGRESS' }, 0).next, 'SUBMITTED');
  assert.equal(primaryAction({ Status: 'IN_PROGRESS' }, 3).blocked, true);
  assert.equal(primaryAction({ Status: 'IN_PROGRESS' }, 3).next, null);
  assert.equal(primaryAction({ Status: 'REJECTED' }).next, 'REWORK');
  assert.equal(primaryAction({ Status: 'REWORK' }, 0).next, 'RESUBMITTED');
  assert.equal(primaryAction({ Status: 'ESCALATED' }).next, 'IN_PROGRESS');
});

test('helpers', () => {
  assert.equal(parseHM('13:30'), 810);
  assert.equal(formatDuration(45), '45m'); assert.equal(formatDuration(90), '1h 30m'); assert.equal(formatDuration(120), '2h');
});
