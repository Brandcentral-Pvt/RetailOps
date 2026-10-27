/**
 * OOS task-bound authorization middleware.
 * Enforces that OOS objects are accessed only via authorized task bindings.
 */
const { sql, getPool } = require('../database/db');
const { canActOnTask, canViewTask } = require('../services/pems/pemsPolicy');
const { isGlobalUserRole } = require('../utils/roleUtils');
const { resolveSellerScope } = require('../utils/sellerScope');

function roleNameOf(user) {
  return String(user?.role?.name || user?.role?.Name || user?.role || '').toLowerCase();
}

async function loadTaskInstance(pool, taskInstanceId) {
  if (!taskInstanceId) return null;
  const r = await pool.request().input('id', sql.VarChar, taskInstanceId)
    .query('SELECT Id, AssignedTo, ReviewerId, SellerId, SellerName, Status, TemplateId FROM PemsTaskInstances WHERE Id = @id');
  return r.recordset[0] || null;
}

async function findBindingByRun(pool, runId) {
  const r = await pool.request().input('runId', sql.VarChar, runId)
    .query(`SELECT TOP 1 b.Id, b.TaskInstanceId, b.SellerId, b.Channel, b.State, b.OosRunId
            FROM OosTaskBindings b
            WHERE b.OosRunId = @runId`);
  return r.recordset[0] || null;
}

async function findBindingByTaskAndSeller(pool, taskInstanceId, sellerId) {
  const req = pool.request().input('taskInstanceId', sql.VarChar, taskInstanceId);
  let sqlQuery = `SELECT TOP 1 b.Id, b.TaskInstanceId, b.SellerId, b.Channel, b.State, b.OosRunId
                  FROM OosTaskBindings b
                  WHERE b.TaskInstanceId = @taskInstanceId`;
  if (sellerId) {
    req.input('sellerId', sql.VarChar, sellerId);
    sqlQuery += ' AND b.SellerId = @sellerId';
  }
  sqlQuery += ' ORDER BY b.CreatedAt ASC';
  const r = await req.query(sqlQuery);
  return r.recordset[0] || null;
}

async function findBindingBySellerChannel(pool, sellerId, channel) {
  if (!sellerId) return null;
  const req = pool.request().input('sellerId', sql.VarChar, sellerId);
  let sqlQuery = `SELECT TOP 1 b.Id, b.TaskInstanceId, b.SellerId, b.Channel, b.State, b.OosRunId
                  FROM OosTaskBindings b
                  WHERE b.SellerId = @sellerId`;
  if (channel) {
    req.input('channel', sql.VarChar, channel);
    sqlQuery += ' AND b.Channel = @channel';
  }
  sqlQuery += ' ORDER BY b.CreatedAt DESC';
  const r = await req.query(sqlQuery);
  return r.recordset[0] || null;
}

function deny(res, status, code, message) {
  return res.status(status).json({ success: false, code, error: message });
}

async function enforceTaskAccess(req, res, mode, task, sellerId) {
  const allowed = mode === 'view' ? canViewTask(req.user, task) : canActOnTask(req.user, task);
  if (!allowed) {
    return deny(res, 403, 'OOS_TASK_ACCESS_DENIED', 'You do not have access to this OOS task.');
  }
  const scope = resolveSellerScope(req.user, sellerId || task.SellerId);
  if (scope.denied) {
    return deny(res, 403, 'forbidden_seller', 'You do not have access to the requested seller.');
  }
  return null;
}

/**
 * Require task-bound access for a run. Attaches req.oosBinding and req.oosTask.
 */
function requireOosRunAccess(options = {}) {
  const mode = options.mode === 'view' ? 'view' : 'act';
  return async function (req, res, next) {
    try {
      const pool = await getPool();
      const runId = req.params.id || req.params.runId;
      if (!runId) return deny(res, 400, 'RUN_ID_REQUIRED', 'Run id required');

      // Load run
      const runRes = await pool.request().input('id', sql.VarChar, runId)
        .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
      const run = runRes.recordset[0];
      if (!run) return deny(res, 404, 'RUN_NOT_FOUND', 'OOS run not found');

      // Find binding
      const binding = await findBindingByRun(pool, runId);
      if (!binding || !binding.TaskInstanceId) {
        // For legacy/unbound runs, enforce seller scope at minimum
        const scope = resolveSellerScope(req.user, run.SellerId);
        if (scope.denied) return deny(res, 403, 'forbidden_seller', 'You do not have access to the requested seller.');
        if (mode === 'act' && !isGlobalUserRole(roleNameOf(req.user))) {
          return deny(res, 403, 'OOS_TASK_BINDING_REQUIRED', 'This run is not bound to an authorized task instance.');
        }
        req.oosRun = run;
        req.oosBinding = null;
        return next();
      }

      // Load task instance
      const task = await loadTaskInstance(pool, binding.TaskInstanceId);
      if (!task) return deny(res, 404, 'TASK_NOT_FOUND', 'Task instance not found');

      if (String(run.SellerId) !== String(binding.SellerId)) {
        return deny(res, 403, 'OOS_SCOPE_MISMATCH', 'Run seller does not match task binding.');
      }

      const denied = await enforceTaskAccess(req, res, mode, task, task.SellerId || run.SellerId);
      if (denied) return denied;

      req.oosRun = run;
      req.oosBinding = binding;
      req.oosTask = task;
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, code: 'OOS_AUTH_ERROR', error: err.message });
    }
  };
}

function requireOosIncidentAccess(options = {}) {
  const mode = options.mode === 'view' ? 'view' : 'act';
  return async function (req, res, next) {
    try {
      const pool = await getPool();
      const incidentId = req.params.id || req.params.incidentId;
      if (!incidentId) return deny(res, 400, 'INCIDENT_ID_REQUIRED', 'Incident id required');

      const incidentRes = await pool.request().input('id', sql.VarChar, incidentId)
        .query('SELECT TOP 1 * FROM OosIncidents WHERE Id = @id');
      const incident = incidentRes.recordset[0];
      if (!incident) return deny(res, 404, 'INCIDENT_NOT_FOUND', 'Incident not found');

      // Try to find binding by seller/channel
      let binding = await findBindingBySellerChannel(pool, incident.SellerId, incident.Channel);
      if (!binding) {
        // Fallback: any binding for seller
        binding = await findBindingBySellerChannel(pool, incident.SellerId, null);
      }

      if (!binding || !binding.TaskInstanceId) {
        const scope = resolveSellerScope(req.user, incident.SellerId);
        if (scope.denied) return deny(res, 403, 'forbidden_seller', 'You do not have access to the requested seller.');
        if (mode === 'act' && !isGlobalUserRole(roleNameOf(req.user))) {
          return deny(res, 403, 'OOS_TASK_BINDING_REQUIRED', 'This incident is not bound to an authorized task instance.');
        }
        req.oosIncident = incident;
        req.oosBinding = null;
        return next();
      }

      const task = await loadTaskInstance(pool, binding.TaskInstanceId);
      if (!task) return deny(res, 404, 'TASK_NOT_FOUND', 'Task instance not found');

      const denied = await enforceTaskAccess(req, res, mode, task, incident.SellerId);
      if (denied) return denied;

      req.oosIncident = incident;
      req.oosBinding = binding;
      req.oosTask = task;
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, code: 'OOS_AUTH_ERROR', error: err.message });
    }
  };
}

function requireOosExportAccess(options = {}) {
  const mode = options.mode === 'view' ? 'view' : 'act';
  return async function (req, res, next) {
    try {
      const pool = await getPool();
      const exportId = req.params.exportId || req.query.exportId;
      const runId = req.params.id || req.params.runId;
      let exportRow = null;
      if (exportId) {
        const er = await pool.request().input('id', sql.VarChar, exportId)
          .query('SELECT TOP 1 * FROM OosExports WHERE Id = @id');
        exportRow = er.recordset[0];
      } else if (runId) {
        const er = await pool.request().input('runId', sql.VarChar, runId)
          .query('SELECT TOP 1 * FROM OosExports WHERE RunId = @runId ORDER BY CreatedAt DESC');
        exportRow = er.recordset[0];
      }
      if (!exportRow) return deny(res, 404, 'EXPORT_NOT_FOUND', 'Export not found');

      // Try binding via run or task instance
      let binding = null;
      if (exportRow.RunId) binding = await findBindingByRun(pool, exportRow.RunId);
      if (!binding && exportRow.TaskInstanceId) {
        const r = await pool.request().input('taskInstanceId', sql.VarChar, exportRow.TaskInstanceId)
          .query('SELECT TOP 1 b.Id, b.TaskInstanceId, b.SellerId, b.Channel, b.State, b.OosRunId FROM OosTaskBindings b WHERE b.TaskInstanceId = @taskInstanceId ORDER BY b.CreatedAt DESC');
        binding = r.recordset[0];
      }

      const taskId = binding?.TaskInstanceId || exportRow.TaskInstanceId;
      if (taskId) {
        const task = await loadTaskInstance(pool, taskId);
        if (task) {
          const denied = await enforceTaskAccess(req, res, mode, task, exportRow.SellerId || binding?.SellerId);
          if (denied) return denied;
          req.oosTask = task;
          req.oosBinding = binding;
          req.oosExport = exportRow;
          return next();
        }
      }

      // Fallback to seller scope
      const scope = resolveSellerScope(req.user, exportRow.SellerId);
      if (scope.denied) return deny(res, 403, 'forbidden_seller', 'You do not have access to the requested seller.');
      if (mode === 'act' && !isGlobalUserRole(roleNameOf(req.user))) {
        return deny(res, 403, 'OOS_TASK_BINDING_REQUIRED', 'This export is not bound to an authorized task instance.');
      }
      req.oosExport = exportRow;
      req.oosBinding = binding;
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, code: 'OOS_AUTH_ERROR', error: err.message });
    }
  };
}

module.exports = { 
  requireOosRunAccess, 
  requireOosIncidentAccess, 
  requireOosExportAccess,
  findBindingByRun, 
  findBindingByTaskAndSeller, 
  findBindingBySellerChannel,
  loadTaskInstance 
};
