const { getPool, sql, generateId } = require('../../database/db');
const { getOosAffectedAsins } = require('../../services/pems/pemsService');
const oosTaskAssignment = require('../../services/pems/oosTaskAssignmentService');

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

async function ensureTaskAccess(req, res, taskInstanceId) {
  const pool = await getPool();
  const task = await pool.request()
    .input('id', sql.VarChar, taskInstanceId)
    .query('SELECT * FROM PemsTaskInstances WHERE Id = @id');
  if (!task.recordset[0]) {
    return res.status(404).json({ success: false, code: 'TASK_NOT_FOUND', error: 'Task instance not found' });
  }
  return task.recordset[0];
}

function fail(res, err) {
  const status = err.status || 500;
  return res.status(status).json({ success: false, code: err.code || 'OOS_TASK_ERROR', error: err.message });
}

/**
 * Create OOS task with brand-manager assignment and auto-fetch ASINs
 */
exports.createOosMonitoringTask = async (req, res) => {
  try {
    const { marketplace = 'amazon.in', assignMode = 'load_balance' } = req.body;
    const result = await oosTaskAssignment.createOOSTaskWithAssignment({
      marketplace,
      assignMode,
      createdBy: req.user?.Id
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

/**
 * Get OOS task context with brands and runs
 */
exports.getOosTaskContext = async (req, res) => {
  try {
    const task = await oosTaskAssignment.getOosTaskContext(req.params.id);
    if (!task) return res.status(404).json({ success: false, code: 'TASK_NOT_FOUND', error: 'Task not found' });
    return res.json({ success: true, ...task });
  } catch (err) { return fail(res, err); }
};

/**
 * Get brand managers available for OOS tasks
 */
exports.getAvailableBrandManagers = async (req, res) => {
  try {
    const marketplace = req.query.marketplace || 'amazon.in';
    const managers = await oosTaskAssignment.getAvailableBrandManagers(req.query.marketplace);
    return res.json({ success: true, managers });
  } catch (err) { return fail(res, err); }
};

/**
 * Get sellers with unavailable ASINs for a marketplace
 */
exports.getSellersWithUnavailableASINs = async (req, res) => {
  try {
    const marketplace = req.query.marketplace || 'amazon.in';
    const sellers = await oosTaskAssignment.getSellersWithUnavailableASINs(marketplace);
    return res.json({ success: true, sellers });
  } catch (err) { return fail(res, err); }
};

/**
 * Preview assignment without creating task
 */
exports.previewAssignment = async (req, res) => {
  try {
    const marketplace = req.query.marketplace || 'amazon.in';
    const sellers = await oosTaskAssignment.getSellersWithUnavailableASINs(req.query.marketplace);
    const assignments = await oosTaskAssignment.assignSellersWithLoadBalancing(sellers);
    
    // Group by assignee
    const assigneeGroups = {};
    for (const a of assignments) {
      if (!assigneeGroups[a.managerId]) {
        assigneeGroups[a.managerId] = { managerId: a.managerId, managerName: a.managerName, managerEmail: a.managerEmail, brands: [], count: 0 };
      }
      assigneeGroups[a.managerId].brands.push({ sellerId: a.sellerId, sellerName: a.sellerName, marketplace: a.marketplace });
      assigneeGroups[a.managerId].count++;
    }
    
    return res.json({ success: true, assignments: Object.values(assigneeGroups) });
  } catch (err) { return fail(res, err); }
};

function fail(res, err) {
  const status = err.status || 500;
  return res.status(status).json({ success: false, code: err.code || 'OOS_TASK_ERROR', error: err.message });
}