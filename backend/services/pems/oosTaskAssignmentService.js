const { getPool, sql, generateId } = require('../../database/db');
const { getActivePolicy } = require('../oos/oosPolicyService');
const { getOosAffectedAsins } = require('./pemsService');

function getOosRunsInsertQuery() {
  return "INSERT INTO OosRuns (Id, RunDate, MonitoredDate, SellerId, SellerName, Channel, Status, PolicyVersion, ManifestJson, TaskInstanceId, CreatedBy, CreatedAt, UpdatedAt) VALUES (@id, @runDate, @monitoredDate, @sellerId, @sellerName, @channel, @status, @policyVersion, @manifestJson, @taskInstanceId, @createdBy, GETUTCDATE(), GETUTCDATE())";
}

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

async function getAvailableBrandManagers(marketplace) {
  marketplace = marketplace || 'amazon.in';
  const pool = await getPool();
  const result = await pool.request()
    .input('marketplace', sql.VarChar, marketplace)
    .query(
      'SELECT u.Id, u.FirstName, u.LastName, u.Email, ' +
      'COUNT(DISTINCT us.SellerId) as SellerCount ' +
      'FROM Users u ' +
      'JOIN Roles r ON u.RoleId = r.Id ' +
      'LEFT JOIN UserSellers us ON us.UserId = u.Id ' +
      'LEFT JOIN Sellers s ON s.Id = us.SellerId AND s.Marketplace = @marketplace AND s.IsActive = 1 ' +
      'WHERE u.IsActive = 1 AND u.RoleId IN (' +
        'SELECT Id FROM Roles WHERE Name IN (\'brand_manager\', \'admin\', \'super_admin\', \'operational_manager\')' +
      ') ' +
      'GROUP BY u.Id, u.FirstName, u.LastName, u.Email ' +
      'HAVING COUNT(DISTINCT us.SellerId) > 0 ' +
      'ORDER BY SellerCount ASC, u.FirstName'
    );
  return result.recordset.map(function(r) {
    var firstName = r.FirstName || '';
    var lastName = r.LastName || '';
    var name = (firstName + ' ' + lastName).trim() || r.Email;
    return {
      id: r.Id,
      name: name,
      email: r.Email,
      sellerCount: r.SellerCount,
      load: 0
    };
  });
}

async function calculateManagerLoads(managerIds) {
  const pool = await getPool();
  if (!managerIds.length) return {};

  var placeholders = managerIds.map(function(_, i) { return '@uid' + i; }).join(',');
  const request = pool.request();
  managerIds.forEach(function(id, i) { request.input('uid' + i, sql.VarChar, id); });

  const result = await request.query(
    'SELECT AssignedTo as ManagerId, COUNT(*) as TaskCount ' +
    'FROM PemsTaskInstances ' +
    'WHERE AssignedTo IN (' + placeholders + ')' +
    '  AND Status NOT IN (\'APPROVED\', \'CANCELLED\', \'REJECTED\')' +
    'GROUP BY AssignedTo'
  );

  var loads = {};
  for (var i = 0; i < result.recordset.length; i++) {
    var row = result.recordset[i];
    loads[row.ManagerId] = row.TaskCount;
  }
  return loads;
}

async function assignSellersWithLoadBalancing(sellers, marketplace) {
  marketplace = marketplace || 'amazon.in';
  var managers = await getAvailableBrandManagers(marketplace);
  if (!managers.length) {
    throw new Error('No available brand managers for marketplace: ' + marketplace);
  }
  var managerIds = managers.map(function(m) { return m.id; });
  var loads = await calculateManagerLoads(managerIds);
  managers.forEach(function(m) { m.load = loads[m.id] || 0; });
  managers.sort(function(a, b) { return a.load - b.load; });
  var assignments = [];
  var managerIndex = 0;
  for (var i = 0; i < sellers.length; i++) {
    var seller = sellers[i];
    var manager = managers[managerIndex % managers.length];
    assignments.push({
      managerId: manager.id,
      managerName: manager.name,
      managerEmail: manager.email,
      sellerId: seller.SellerId,
      sellerName: seller.SellerName,
      marketplace: seller.Marketplace
    });
    manager.load++;
    managers.sort(function(a, b) { return a.load - b.load; });
    managerIndex = managers.findIndex(function(m) { return m.id === assignments[assignments.length - 1].managerId; }) + 1;
  }
  return assignments;
}

async function getSellersWithUnavailableASINs(marketplace) {
  marketplace = marketplace || 'amazon.in';
  var pool = await getPool();
  var result = await pool.request()
    .input('marketplace', sql.VarChar, marketplace)
    .query(
      'SELECT DISTINCT s.Id as SellerId, s.Name as SellerName, s.Marketplace ' +
      'FROM Sellers s ' +
      'INNER JOIN Asins a ON a.SellerId = s.Id ' +
      'WHERE s.Marketplace = @marketplace ' +
        'AND a.Status = \'Active\' ' +
        'AND ( ' +
          'a.Availability = \'OutOfStock\' ' +
          'OR LOWER(ISNULL(a.AvailabilityStatus, \'\')) LIKE \'%unavailable%\' ' +
          'OR LOWER(ISNULL(a.AvailabilityStatus, \'\')) LIKE \'%out of stock%\' ' +
        ')'
    );
  return result.recordset;
}

async function createOOSTaskWithAssignment(data) {
  data = data || {};
  var pool = await getPool();
  var marketplace = data.marketplace || 'amazon.in';
  var sellers = await getSellersWithUnavailableASINs(data.marketplace);
  if (!sellers.length) {
    throw new Error('No sellers found with unavailable ASINs for the specified marketplace');
  }
  var assignments = await assignSellersWithLoadBalancing(sellers);
  var assigneeGroups = {};
  for (var i = 0; i < assignments.length; i++) {
    var assignment = assignments[i];
    if (!assigneeGroups[assignment.managerId]) {
      assigneeGroups[assignment.managerId] = {
        managerId: assignment.managerId,
        managerName: assignment.managerName,
        managerEmail: assignment.managerEmail,
        brands: []
      };
    }
    assigneeGroups[assignment.managerId].brands.push({
      sellerId: assignment.sellerId,
      sellerName: assignment.sellerName,
      marketplace: assignment.marketplace
    });
  }
  var pool = await getPool();
  var templateResult = await pool.request()
    .query("SELECT Id FROM PemsTaskTemplates WHERE TaskCode = 'OOS-RECON-001'");
  if (!templateResult.recordset.length) {
    throw new Error('OOS-RECON-001 template not found');
  }
  var templateId = templateResult.recordset[0].Id;
  var templateResult2 = await pool.request()
    .input('tid', sql.VarChar, templateResult.recordset[0].Id)
    .query('SELECT * FROM PemsTaskTemplates WHERE Id = @tid');
  var template = templateResult2.recordset[0];
  var createdTasks = [];
  var assigneeGroupsKeys = Object.keys(assigneeGroups);
  for (var i = 0; i < assigneeGroupsKeys.length; i++) {
    var managerId = assigneeGroupsKeys[i];
    var group = assigneeGroups[assigneeGroupsKeys[i]];
    var runDate = new Date().toISOString().split('T')[0];
    var taskId = require('crypto').randomBytes(16).toString('hex');
    var instanceCode = 'TASK-OOS-' + Date.now().toString(36).toUpperCase() + '-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();
    var brands = group.brands.map(function(b) {
      return {
        id: b.sellerId,
        name: b.sellerName,
        marketplace: b.marketplace
      };
    });
    var pool = await getPool();
    await pool.request()
      .input('id', sql.VarChar, taskId)
      .input('instanceCode', sql.VarChar, instanceCode)
      .input('templateId', sql.VarChar, 'cf7dc8fb89884a2383cdde38')
      .input('sellerId', sql.VarChar, null)
      .input('sellerName', sql.NVarChar, '')
      .input('assignedTo', sql.VarChar, group.managerId)
      .input('assigneeName', sql.NVarChar, group.managerName)
      .input('reviewerId', sql.VarChar, null)
      .input('reviewerName', sql.NVarChar, '')
      .input('department', sql.NVarChar, 'INVENTORY')
      .input('status', sql.VarChar, 'DRAFT')
      .input('reviewStatusParam', sql.VarChar, 'NOT_REVIEWED')
      .input('frequency', sql.VarChar, 'DAILY')
      .input('title', sql.NVarChar, 'OOS Monitoring & Reconciliation')
      .input('description', sql.NVarChar, 'Daily OOS monitoring and reconciliation for assigned sellers')
      .input('priority', sql.VarChar, 'HIGH')
      .input('target', sql.Decimal(18,2), 0)
      .input('achievement', sql.Decimal(18,2), 0)
      .input('slaStatus', sql.VarChar, 'WITHIN_SLA')
      .input('slaHours', sql.Int, 8)
      .input('dueDate', sql.DateTime2, new Date())
      .input('assignedAt', sql.DateTime2, new Date())
      .input('attachments', sql.NVarChar(sql.MAX), JSON.stringify([]))
      .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(['oos','reconciliation','pilot','OOS-RECON-001']))
      .input('source', sql.NVarChar, 'ROUTINE')
      .input('sourceId', sql.VarChar, null)
      .input('sourceRef', sql.VarChar, null)
      .input('asins', sql.NVarChar(sql.MAX), JSON.stringify([]))
      .input('category', sql.NVarChar, 'INVENTORY')
      .input('brandMode', sql.VarChar, 'CHECKLIST')
      .input('estimatedExecutionMinutes', sql.Int, 55)
      .input('autoAssign', sql.Bit, 0)
      .input('isActive', sql.Bit, 1)
      .input('reviewRequired', sql.Bit, 1)
      .input('criticalityScore', sql.Int, 5)
      .input('estMinutes', sql.Int, 55)
      .input('createdBy', sql.VarChar, 'system')
      .input('autoAssign', sql.Bit, 0)
      .input('dueTime', sql.VarChar, '12:00')
      .input('runDays', sql.VarChar, '1,2,3,4,5,6')
      .query(
        'INSERT INTO PemsTaskInstances ' +
          '(Id, InstanceCode, TemplateId, SellerId, SellerName, AssignedTo, AssigneeName, ' +
           'ReviewerId, ReviewerName, Department, Status, ReviewStatus, Frequency, Title, Description, ' +
           'Priority, Target, Achievement, SLAStatus, SLAHours, DueDate, AssignedAt, ' +
           'Attachments, Tags, Source, SourceId, SourceRef, Asins, Category, BrandMode, ' +
           'EstimatedExecutionMinutes, AutoAssign, IsActive, ReviewRequired, CriticalityScore, ' +
           'EstimatedExecutionMinutes, CreatedBy, AutoAssign, DueTime, RunDays) ' +
        'VALUES ' +
          '(@id, @instanceCode, @templateId, @sellerId, @sellerName, @assignedTo, @assigneeName, ' +
           '@reviewerId, @reviewerName, @department, @status, @reviewStatusParam, @frequency, @title, @description, ' +
           '@priority, @target, @achievement, @slaStatus, @slaHours, @dueDate, @assignedAt, ' +
           '@attachments, @tags, @source, @sourceId, @sourceRef, @asins, @category, @brandMode, ' +
           '@estimatedExecutionMinutes, @autoAssign, @isActive, @reviewRequired, @criticalityScore, ' +
           '@estMinutes, @createdBy, @autoAssign, @dueTime, @runDays)'
      );
    for (var i = 0; i < group.brands.length; i++) {
      var b = group.brands[i];
      await pool.request()
        .input('id', sql.VarChar, require('crypto').randomBytes(16).toString('hex'))
        .input('taskInstanceId', sql.VarChar, taskId)
        .input('sellerId', sql.VarChar, b.sellerId)
        .input('sellerName', sql.NVarChar, b.sellerName)
        .input('sortOrder', sql.Int, i + 1)
        .query('INSERT INTO PemsTaskBrands (Id, TaskInstanceId, SellerId, SellerName, SortOrder) VALUES (@id, @taskInstanceId, @sellerId, @sellerName, @sortOrder)');
    }
    for (var j = 0; j < group.brands.length; j++) {
      var b = group.brands[j];
      var runId = require('crypto').randomBytes(16).toString('hex');
      var runDate = new Date().toISOString().split('T')[0];
      var manifestResult = await pool.request()
        .input('sellerId', sql.VarChar, b.sellerId)
        .input('channel', sql.VarChar, b.marketplace)
        .query(
          'SELECT ' +
            'COUNT(*) AS EligibleActiveAsins, ' +
            'SUM(CASE WHEN Availability = \'OutOfStock\' ' +
                      'OR LOWER(ISNULL(AvailabilityStatus,\'\')) LIKE \'%unavailable%\' ' +
                      'OR LOWER(ISNULL(AvailabilityStatus,\'\')) LIKE \'%out of stock%\' ' +
                   'THEN 1 ELSE 0 END) AS RetailOpsUnavailableCount, ' +
            'SUM(CASE WHEN Availability IS NULL AND (AvailabilityStatus IS NULL OR LTRIM(RTRIM(AvailabilityStatus)) = \'\') THEN 1 ELSE 0 END) AS MissingAvailabilityCount, ' +
            'MAX(LastScrapedAt) AS LastRetailOpsObservation ' +
          'FROM Asins ' +
          'WHERE SellerId = @sellerId AND Status = \'Active\' AND Marketplace = @channel'
        );
      var manifest = manifestResult.recordset[0];
      var runId = require('crypto').randomBytes(16).toString('hex');
      var runDate = new Date().toISOString().split('T')[0];
      await pool.request()
        .input('id', sql.VarChar, require('crypto').randomBytes(16).toString('hex'))
        .input('runDate', sql.Date, new Date().toISOString().split('T')[0])
        .input('monitoredDate', sql.Date, new Date().toISOString().split('T')[0])
        .input('sellerId', sql.VarChar, b.sellerId)
        .input('sellerName', sql.NVarChar, b.sellerName)
        .input('channel', sql.VarChar, b.marketplace)
        .input('status', sql.VarChar, 'MONITORING')
        .input('policyVersion', sql.VarChar, 'v1')
        .input('manifestJson', sql.NVarChar(sql.MAX), JSON.stringify({
          channel: b.marketplace,
          capturedAt: new Date().toISOString(),
          policyVersion: 'v1',
          eligibleActiveAsins: manifest.EligibleActiveAsins,
          retailOpsUnavailableCount: manifest.RetailOpsUnavailableCount,
          missingAvailabilityCount: manifest.MissingAvailabilityCount,
          lastRetailOpsObservation: manifest.LastRetailOpsObservation,
          gms: { windowDays: 30, asinCount: 0, revenue: null, verified: false, note: 'GMS_UNVERIFIED' }
        }))
        .input('taskInstanceId', sql.VarChar, taskId)
        .input('createdBy', sql.VarChar, 'system')
        .query("INSERT INTO OosRuns (Id, RunDate, MonitoredDate, SellerId, SellerName, Channel, Status, PolicyVersion, ManifestJson, TaskInstanceId, CreatedBy, CreatedAt, UpdatedAt) VALUES " +
          "(@id, @runDate, @monitoredDate, @sellerId, @sellerName, @channel, @status, @policyVersion, @manifestJson, @taskInstanceId, @createdBy, GETUTCDATE(), GETUTCDATE())");
      await pool.request()
        .input('id', sql.VarChar, require('crypto').randomBytes(16).toString('hex'))
        .input('taskInstanceId', sql.VarChar, taskId)
        .input('oosRunId', sql.VarChar, runId)
        .input('sellerId', sql.VarChar, b.sellerId)
        .input('channel', sql.VarChar, b.marketplace)
        .input('state', sql.VarChar, 'OPEN')
        .query('INSERT INTO OosTaskBindings (Id, TaskInstanceId, OosRunId, SellerId, Channel, State, CreatedAt, UpdatedAt) VALUES (@id, @taskInstanceId, @oosRunId, @sellerId, @channel, @state, GETUTCDATE(), GETUTCDATE())');
    }
    var reconciliation = require('./oos/oosReconciliationService');
    for (var j = 0; j < group.brands.length; j++) {
      var b = group.brands[j];
      var run = await pool.request()
        .input('sellerId', sql.VarChar, b.sellerId)
        .input('channel', sql.VarChar, b.marketplace)
        .input('taskInstanceId', sql.VarChar, taskId)
        .query('SELECT TOP 1 Id FROM OosRuns WHERE SellerId = @sellerId AND Channel = @channel AND TaskInstanceId = @taskInstanceId ORDER BY CreatedAt DESC');
      if (run.recordset.length > 0) {
        var runId = run.recordset[0].Id;
        var reconciliation = require('./oos/oosReconciliationService');
        var result = await reconciliation.reconcileRun(runId, { actorId: 'system' });
        console.log('  Reconciled ' + b.sellerName + ': ' + result.analysed + ' ASINs');
      }
    }
    createdTasks.push({
      taskId: taskId,
      instanceCode: instanceCode,
      assigneeId: group.managerId,
      assigneeName: group.managerName,
      brands: group.brands.length
    });
  }
  return { createdTasks: createdTasks, totalSellers: assignments.length };
}

async function getOosTaskContext(taskInstanceId) {
  var pool = await getPool();
  var taskResult = await pool.request()
    .input('id', sql.VarChar, taskInstanceId)
    .query(
      'SELECT ti.*, tt.TaskCode as TemplateCode ' +
      'FROM PemsTaskInstances ti ' +
      'LEFT JOIN PemsTaskTemplates tt ON tt.Id = ti.TemplateId ' +
      'WHERE ti.Id = @id'
    );
  if (!taskResult.recordset.length) return null;
  var task = taskResult.recordset[0];
  var brandsResult = await pool.request()
    .input('taskId', sql.VarChar, taskInstanceId)
    .query('SELECT * FROM PemsTaskBrands WHERE TaskInstanceId = @taskId');
  var runsResult = await pool.request()
    .input('taskInstanceId', sql.VarChar, taskInstanceId)
    .query('SELECT * FROM OosTaskBindings WHERE TaskInstanceId = @taskInstanceId');
  return {
    task: task,
    brands: brandsResult.recordset,
    runs: runsResult.recordset
  };
}
module.exports = {
  getAvailableBrandManagers: getAvailableBrandManagers,
  calculateManagerLoads: calculateManagerLoads,
  assignSellersWithLoadBalancing: assignSellersWithLoadBalancing,
  getSellersWithUnavailableASINs: getSellersWithUnavailableASINs,
  createOOSTaskWithAssignment: createOOSTaskWithAssignment,
  getOosTaskContext: getOosTaskContext
};