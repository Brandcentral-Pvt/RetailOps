/**
 * PEMS entity-access middleware — assignee / reviewer / global roles only.
 */
const { sql, getPool } = require('../database/db');
const { canActOnTask, canViewTask } = require('../services/pems/pemsPolicy');
const { isGlobalUserRole } = require('../utils/roleUtils');

/**
 * Gate for PEMS endpoints that are estate-wide by nature: SLA recomputation,
 * escalation sweeps, weighted-progress rebuilds and demo seeding. These mutate
 * or expose every seller's tasks, so they cannot be scoped per seller — a
 * restricted user triggering them would be a cross-tenant write. Restricted
 * users get 403 rather than a silently unscoped result.
 */
function requireGlobalPemsRole(req, res, next) {
  const role = String(req.user?.role?.name || req.user?.role || '').toLowerCase();
  if (!isGlobalUserRole(role)) {
    return res.status(403).json({
      success: false,
      error: 'This action affects all sellers and is restricted to global roles.',
    });
  }
  return next();
}

/**
 * Resolve the task instance id from route params / body,
 * following subtask/activity references when needed.
 */
async function resolveTaskId(req, pool) {
  const direct = req.params.id || req.body?.taskInstanceId || req.body?.id;
  if (direct) return direct;

  if (req.params.subTaskId) {
    const r = await pool.request().input('id', sql.VarChar, req.params.subTaskId)
      .query('SELECT TaskInstanceId FROM PemsSubTasks WHERE Id = @id');
    return r.recordset[0]?.TaskInstanceId || null;
  }

  if (req.params.activityId) {
    const r = await pool.request().input('id', sql.VarChar, req.params.activityId)
      .query('SELECT TaskInstanceId FROM PemsActivities WHERE Id = @id');
    return r.recordset[0]?.TaskInstanceId || null;
  }

  return null;
}

/**
 * Loads the task, enforces access policy, attaches req.pemsTask.
 *
 * `mode` is 'act' (default) or 'view'. Both enforce seller scope; 'act' also
 * requires the user to be the assignee or reviewer. 'view' is used for detail
 * reads, where seeing a task in your sellers is enough even if someone else
 * owns it.
 */
async function requireTaskAccess(req, res, next, options = {}) {
  const mode = options.mode === 'view' ? 'view' : 'act';
  try {
    const pool = await getPool();
    const taskId = await resolveTaskId(req, pool);
    if (!taskId) return res.status(400).json({ success: false, error: 'Task id required' });

    // Synthetic ids minted for ruleset tasks live in `Actions`, not
    // PemsTaskInstances, so there is no row to load here. getInstanceById
    // resolves them and applies the same seller scope itself; short-circuiting
    // here would 404 every rule task before it got that far.
    if (mode === 'view' && typeof taskId === 'string' && taskId.startsWith('rule_')) {
      return next();
    }

    const r = await pool.request().input('id', sql.VarChar, taskId)
      .query('SELECT Id, AssignedTo, ReviewerId, SellerId, SellerName FROM PemsTaskInstances WHERE Id = @id');
    const task = r.recordset[0];
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    const allowed = mode === 'view' ? canViewTask(req.user, task) : canActOnTask(req.user, task);
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'You do not have access to this task' });
    }

    req.pemsTask = task;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/** View-level variant: seller scope only, no assignment requirement. */
const requireTaskView = (req, res, next) => requireTaskAccess(req, res, next, { mode: 'view' });

module.exports = { requireTaskAccess, requireTaskView, requireGlobalPemsRole };
