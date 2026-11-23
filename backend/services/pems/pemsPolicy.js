/**
 * PEMS access policy — pure, unit-testable decision helpers.
 *
 * Two independent gates, both of which must pass:
 *   1. seller scope  — is this task in a seller the user is assigned to?
 *   2. assignment    — is the user the assignee or reviewer?
 *
 * Global roles bypass both. Read access is broader than write access: a user may
 * read any task in their sellers, but may only act on the ones assigned to
 * them (or ones they review).
 */
const { isGlobalUserRole } = require('../../utils/roleUtils');
const { canViewTaskByScope, resolveSellerScope } = require('./sellerScope');

function userIdOf(user) {
  return user?.Id || user?._id || user?.id || null;
}

function roleNameOf(user) {
  return String(user?.role?.name || user?.role?.Name || user?.role || '').toLowerCase();
}

function isAssignedOrReviewer(user, task) {
  const uid = userIdOf(user);
  if (!uid) return false;
  return uid === task.AssignedTo || uid === task.ReviewerId;
}

/**
 * May `user` see `task` in a list/detail response?
 * Global roles yes; otherwise the task must be inside the user's sellers.
 */
function canViewTask(user, task) {
  if (!user || !task) return false;
  if (isGlobalUserRole(roleNameOf(user))) return true;
  return canViewTaskByScope(user, task);
}

/**
 * May `user` act on `task`? Global roles always; otherwise the task must be
 * inside the user's sellers AND the user must own it.
 *
 * Both conditions matter: without the seller check a restricted user could act
 * on a task that was assigned to them for a seller they have since lost.
 */
function canActOnTask(user, task) {
  if (!user || !task) return false;
  if (isGlobalUserRole(roleNameOf(user))) return true;
  if (!canViewTaskByScope(user, task)) return false;
  return isAssignedOrReviewer(user, task);
}

/**
 * Executor and reviewer are distinct capabilities. A reviewer can read and
 * approve work but cannot complete another employee's activities.
 * Global operations roles may intervene in execution, but must never
 * approve a task assigned to themselves.
 */
function canExecuteTask(user, task) {
  if (!user || !task) return false;
  if (isGlobalUserRole(roleNameOf(user))) return true;
  return canViewTaskByScope(user, task) && userIdOf(user) === task.AssignedTo;
}

function canReviewTask(user, task) {
  if (!user || !task) return false;
  const uid = userIdOf(user);
  if (!uid || uid === task.AssignedTo) return false;
  if (isGlobalUserRole(roleNameOf(user))) return true;
  return canViewTaskByScope(user, task) && uid === task.ReviewerId;
}

function canTransitionTask(user, task, toStatus) {
  // Review decisions must use the atomic /reviews endpoint and never a
  // standalone status change without the review record.
  if (['APPROVED', 'REJECTED', 'UNDER_REVIEW'].includes(toStatus)) return false;
  if (['ASSIGNED', 'CANCELLED'].includes(toStatus)) {
    return Boolean(user && task && isGlobalUserRole(roleNameOf(user)));
  }
  return canExecuteTask(user, task);
}

/**
 * May `user` create a task against `sellerId`?
 * Global roles yes; otherwise only within assigned sellers. An empty seller
 * (brand-agnostic work) is allowed — it is visible only to its own assignee.
 */
function canCreateTaskForSeller(user, sellerId) {
  if (!user) return false;
  if (isGlobalUserRole(roleNameOf(user))) return true;
  if (!sellerId) return true;
  const scope = resolveSellerScope(user, null);
  return scope.sellerIds.includes(String(sellerId));
}

module.exports = {
  userIdOf,
  roleNameOf,
  isAssignedOrReviewer,
  canViewTask,
  canActOnTask,
  canExecuteTask,
  canReviewTask,
  canTransitionTask,
  canCreateTaskForSeller,
  isGlobalUserRole,
};
