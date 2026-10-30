const { canActOnTask, canExecuteTask, canReviewTask, canTransitionTask, userIdOf, roleNameOf } = require('../../services/pems/pemsPolicy');

const globalUser = { Id: 'u-admin', role: { name: 'admin' } };
const assignee = { Id: 'u-assignee', role: { name: 'brand_manager' } };
const reviewer = { Id: 'u-reviewer', role: { name: 'brand_manager' } };
const stranger = { Id: 'u-stranger', role: { name: 'brand_manager' } };
const task = { Id: 't1', AssignedTo: 'u-assignee', ReviewerId: 'u-reviewer' };

describe('pemsPolicy', () => {
  it('resolves user id across Id/_id/id shapes', () => {
    expect(userIdOf({ Id: 'a' })).toBe('a');
    expect(userIdOf({ _id: 'b' })).toBe('b');
    expect(userIdOf({ id: 'c' })).toBe('c');
    expect(userIdOf({})).toBeNull();
  });

  it('normalizes role names', () => {
    expect(roleNameOf({ role: { name: 'Admin' } })).toBe('admin');
    expect(roleNameOf({ role: { Name: 'SUPER_ADMIN' } })).toBe('super_admin');
    expect(roleNameOf({ role: 'operational_manager' })).toBe('operational_manager');
  });

  it('allows global roles (admin, super_admin, developer, operational_manager)', () => {
    expect(canActOnTask({ Id: 'x', role: { name: 'admin' } }, task)).toBe(true);
    expect(canActOnTask({ Id: 'x', role: { name: 'super_admin' } }, task)).toBe(true);
    expect(canActOnTask({ Id: 'x', role: { name: 'developer' } }, task)).toBe(true);
    expect(canActOnTask({ Id: 'x', role: { name: 'operational_manager' } }, task)).toBe(true);
  });

  it('allows the assignee and reviewer', () => {
    expect(canActOnTask(assignee, task)).toBe(true);
    expect(canActOnTask(reviewer, task)).toBe(true);
  });

  it('denies strangers and anonymous users', () => {
    expect(canActOnTask(stranger, task)).toBe(false);
    expect(canActOnTask(null, task)).toBe(false);
    expect(canActOnTask({ Id: 'u-assignee', role: { name: 'brand_manager' } }, null)).toBe(false);
  });
});

describe('Phase 1 separation of duties', () => {
  it('allows the assigned employee to execute but not approve their own work', () => {
    expect(canExecuteTask(assignee, task)).toBe(true);
    expect(canReviewTask(assignee, task)).toBe(false);
  });
  it('allows assigned reviewer to review but not complete employee activities', () => {
    expect(canReviewTask(reviewer, task)).toBe(true);
    expect(canExecuteTask(reviewer, task)).toBe(false);
  });
  it('prohibits self-review for global administrators as well', () => {
    const me = { Id: 'same', role: { name: 'admin' } };
    const mine = { AssignedTo: 'same', ReviewerId: 'same', SellerId: null };
    expect(canReviewTask(me, mine)).toBe(false);
  });
  it('rejects standalone approval, rejection and review-start transitions', () => {
    expect(canTransitionTask(assignee, task, 'APPROVED')).toBe(false);
    expect(canTransitionTask(reviewer, task, 'REJECTED')).toBe(false);
    expect(canTransitionTask(globalUser, task, 'UNDER_REVIEW')).toBe(false);
  });
  it('keeps executor lifecycle transitions separate from review', () => {
    expect(canTransitionTask(assignee, task, 'IN_PROGRESS')).toBe(true);
    expect(canTransitionTask(reviewer, task, 'SUBMITTED')).toBe(false);
  });
});
