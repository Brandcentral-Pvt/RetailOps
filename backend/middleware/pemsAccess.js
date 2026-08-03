/**
 * PEMS entity-access middleware — assignee / reviewer / global roles only.
 */
const { sql, getPool } = require('../database/db');
const { canActOnTask } = require('../services/pems/pemsPolicy');

/**
 * Resolve the task instance id from route params / body,
 * following subtask/activity references when needed.
 */
async function resolveTaskId(req, pool) {
  const direct = req.params.id || req.body.taskInstanceId || req.body.id;
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
 */
async function requireTaskAccess(req, res, next) {
  try {
    const pool = await getPool();
    const taskId = await resolveTaskId(req, pool);
    if (!taskId) return res.status(400).json({ success: false, error: 'Task id required' });

    const r = await pool.request().input('id', sql.VarChar, taskId)
      .query('SELECT Id, AssignedTo, ReviewerId FROM PemsTaskInstances WHERE Id = @id');
    const task = r.recordset[0];
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    if (!canActOnTask(req.user, task)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this task' });
    }

    req.pemsTask = task;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { requireTaskAccess };
