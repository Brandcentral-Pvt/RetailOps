/**
 * PEMS access policy — pure, unit-testable decision helpers.
 */
const { isGlobalUserRole } = require('../../utils/roleUtils');

function userIdOf(user) {
  return user?.Id || user?._id || user?.id || null;
}

function roleNameOf(user) {
  return String(user?.role?.name || user?.role?.Name || user?.role || '').toLowerCase();
}

/**
 * May `user` act on `task`? Global roles always; otherwise the task's
 * assignee or reviewer.
 */
function canActOnTask(user, task) {
  if (!user || !task) return false;
  if (isGlobalUserRole(roleNameOf(user))) return true;
  const uid = userIdOf(user);
  if (!uid) return false;
  return uid === task.AssignedTo || uid === task.ReviewerId;
}

module.exports = { userIdOf, roleNameOf, canActOnTask, isGlobalUserRole };
