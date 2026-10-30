import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorklistParams, taskProgress, taskDue, taskNextAction } from '../taskListPresentation.js';

const params = overrides => buildWorklistParams({ userId: 'worker', scope: 'mine', quickView: 'TODO', dateFilter: 'all', filters: {}, page: 1, limit: 25, sort: 'due', ...overrides });

test('personal scope cannot be overridden by an owner filter', () => {
  assert.equal(params({ filters: { manager: 'other-person' } }).assignedTo, 'worker');
  assert.throws(() => params({ userId: null }), /sign in again/);
});
test('all-accessible scope retains the requested owner filter', () => {
  assert.equal(params({ scope: 'all', filters: { manager: 'other-person' } }).assignedTo, 'other-person');
  assert.equal(params({ scope: 'all' }).assignedTo, undefined);
});
test('review tab includes every submitted review state and intersects brand and dates', () => {
  const result = params({ quickView: 'PENDING_REVIEW', dateFilter: 'today', filters: { seller: 'brand' }, now: new Date(2026, 9, 30, 12) });
  assert.equal(result.status, 'SUBMITTED,UNDER_REVIEW,RESUBMITTED');
  assert.equal(result.sellerId, 'brand');
  assert.equal(new Date(result.dueAfter).getDate(), 30);
  assert.equal(new Date(result.dueBefore).getHours(), 23);
  assert.equal(result.assignedTo, 'worker');
});
test('overdue excludes closed tasks and pagination and sort remain server-side', () => {
  const result = params({ dateFilter: 'overdue', page: 3, limit: 50, sort: 'newest' });
  assert.equal(result.excludeStatuses, 'APPROVED,CANCELLED');
  assert.equal(result.overdue, 'true');
  assert.equal(result.page, 3);
  assert.equal(result.limit, 50);
  assert.equal(result.sortBy, 'CreatedAt');
  assert.equal(result.sortOrder, 'desc');
});
test('saved zero progress is authoritative and invalid numbers are safe', () => {
  assert.equal(taskProgress({ WeightedProgressPct: 0, ProgressPct: 80 }), 0);
  assert.equal(taskProgress({ WeightedProgressPct: null, ProgressPct: 45 }), 45);
  assert.equal(taskProgress({ WeightedProgressPct: 'bad' }), 0);
  assert.equal(taskProgress({ ProgressPct: 105 }), 100);
});
test('closed work is never marked overdue and missing dates remain explicit', () => {
  const now = new Date(2026, 9, 30, 12);
  assert.equal(taskDue({ Status: 'APPROVED', DueDate: '2026-10-20T12:00:00Z' }, now).tone, 'muted');
  assert.equal(taskDue({ Status: 'IN_PROGRESS', DueDate: '2026-10-20T12:00:00Z' }, now).tone, 'danger');
  assert.equal(taskDue({}).label, 'No due date');
});
test('next actions distinguish waiting for review and requested rework', () => {
  assert.equal(taskNextAction({ Status: 'SUBMITTED' }).label, 'View submission');
  assert.equal(taskNextAction({ Status: 'REWORK' }).label, 'Review feedback');
  assert.equal(taskNextAction({ Status: 'IN_PROGRESS' }).label, 'Continue');
});
