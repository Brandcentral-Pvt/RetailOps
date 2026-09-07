async function getDashboardKPIs(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.userId && !filters.isGlobalUser) {
    where += ' AND (AssigneeId = @userId OR ReviewerId = @userId)';
    req.input('userId', sql.VarChar, filters.userId);
  }
  if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assigneeId) { where += ' AND AssigneeId = @assigneeId'; req.input('assigneeId', sql.VarChar, filters.assigneeId); }
  if (filters.reviewerId) { where += ' AND ReviewerId = @reviewerId'; req.input('reviewerId', sql.VarChar, filters.reviewerId); }

  const sellerParams = [];
  if (filters.sellerIds && filters.sellerIds.length > 0) {
    filters.sellerIds.forEach((id, i) => {
      const param = `seller_${i}`;
      req.input(param, sql.VarChar, id);
      sellerParams.push(`@${param}`);
    }
    where += ` AND SellerId IN (${sellerParams.join(',')})`;
  }

  const [
    taskCounts,
    slaStats,
    priorityStats,
    deptStats,
    recentActivity
  ] = await Promise.all([
    pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Status = 'CREATED' THEN 1 ELSE 0 END) as created,
        SUM(CASE WHEN Status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN Status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as underReview,
        SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN Status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as rework,
        SUM(CASE WHEN Status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN SlaStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
        SUM(CASE WHEN SlaStatus = 'AT_RISK' THEN 1 ELSE 0 END) as slaAtRisk,
        AVG(CASE WHEN DueDate IS NOT NULL AND DueDate > GETDATE() THEN 1.0 ELSE 0.0 END) * 100 as onTrackPct
      FROM TaskInstances ${where.replace('WHERE 1=1', '')}
    `),
    pool.request().query(`
      SELECT SlaStatus, COUNT(*) as count FROM TaskInstances ${where} GROUP BY SlaStatus
    `),
    pool.request().query(`
      SELECT Priority, COUNT(*) as count FROM TaskInstances ${where} GROUP BY Priority
    `),
    pool.request().query(`
      SELECT Department, COUNT(*) as count FROM TaskInstances ${where} GROUP BY Department
    `),
    pool.request().query(`
      SELECT TOP 10 i.Id, i.Code, i.Title, i.Status, i.DueDate, i.Priority, i.Department, u.FirstName + ' ' + u.LastName as AssigneeName
      FROM TaskInstances i LEFT JOIN Users u ON i.AssignedTo = u.Id ${where} ORDER BY i.CreatedAt DESC
    `)
  ]);

  const tasks = taskCounts.recordset[0];
  const sla = slaStats.recordset.reduce((acc, r) => { acc[r.SlaStatus] = r.count; return acc; }, {});
  const priority = priorityStats.recordset.reduce((acc, r) => { acc[r.Priority] = r.count; return acc; }, {});
  const dept = deptStats.recordset;

  return {
    summary: {
      total: tasks.total || 0,
      created: tasks.created || 0,
      assigned: tasks.assigned || 0,
      inProgress: tasks.inProgress || 0,
      submitted: tasks.submitted || 0,
      underReview: tasks.underReview || 0,
      approved: tasks.approved || 0,
      rejected: tasks.rejected || 0,
      rework: tasks.rework || 0,
      cancelled: tasks.cancelled || 0,
      slaBreached: sla.BREACHED || 0,
      slaAtRisk: sla.AT_RISK || 0,
      onTrackPct: Math.round(tasks.onTrackPct || 0)
    },
    slaBreakdown: sla,
    priorityBreakdown: priority,
    departmentBreakdown: dept,
    recentActivity: recentActivity.recordset
  };
}

