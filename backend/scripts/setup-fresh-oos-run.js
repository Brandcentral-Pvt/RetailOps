require('dotenv').config();
const {getPool, sql, generateId} = require('../database/db');

async function main() {
  const pool = await getPool();

  try {
    console.log('=== Setting up fresh OOS run with latest data ===\n');

    // 1. Get all sellers with unavailable ASINs from RetailOps
    const sellersWithUnavailable = await pool.request().query(`
      SELECT DISTINCT s.Id as SellerId, s.Name as SellerName, s.Marketplace
      FROM Sellers s
      INNER JOIN Asins a ON a.SellerId = s.Id
      WHERE a.Status = 'Active'
        AND (
          a.Availability = 'OutOfStock'
          OR LOWER(ISNULL(a.AvailabilityStatus, '')) LIKE '%unavailable%'
          OR LOWER(ISNULL(a.AvailabilityStatus, '')) LIKE '%out of stock%'
        )
    `);

    console.log('=== Setting up fresh OOS run with latest data ===\n');
    console.log('Found', sellersWithUnavailable.recordset.length, 'sellers with unavailable ASINs:');
    for (const s of sellersWithUnavailable.recordset) {
      console.log('  -', s.SellerName, '(' + s.SellerId + ') [' + s.Marketplace + ']');
    }

    // 2. Create OOS task instance
    const taskId = generateId();
    const instanceCode = 'TASK-OOS-' + Date.now().toString(36).toUpperCase();

    await pool.request()
      .input('id', sql.VarChar, taskId)
      .input('instanceCode', sql.VarChar, instanceCode)
      .input('templateId', sql.VarChar, 'cf7dc8fb89884a2383cdde38')
      .input('sellerId', sql.VarChar, null)
      .input('sellerName', sql.NVarChar, '')
      .input('assignedTo', sql.VarChar, null)
      .input('assigneeName', sql.NVarChar, '')
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
      .input('source', sql.NVarChar, 'MANUAL')
      .input('sourceId', sql.VarChar, null)
      .input('sourceRef', sql.VarChar, null)
      .input('asins', sql.NVarChar(sql.MAX), JSON.stringify([]))
      .input('category', sql.NVarChar, 'INVENTORY')
      .query(`
        INSERT INTO PemsTaskInstances
          (Id, InstanceCode, TemplateId, SellerId, SellerName, AssignedTo, AssigneeName,
           ReviewerId, ReviewerName, Department, Status, ReviewStatus, Frequency, Title, Description,
           Priority, Target, Achievement, SLAStatus, SLAHours, DueDate, AssignedAt,
           Attachments, Tags, Source, SourceId, SourceRef, Asins, Category)
        VALUES
          (@id, @instanceCode, @templateId, @sellerId, @sellerName, @assignedTo, @assigneeName,
           @reviewerId, @reviewerName, @department, @status, @reviewStatusParam, @frequency, @title, @description,
           @priority, @target, @achievement, @slaStatus, @slaHours, @dueDate, @assignedAt,
           @attachments, @tags, @source, @sourceId, @sourceRef, @asins, @category)
      `);

    console.log('\nCreated task:', taskId, instanceCode);

    // 3. Add brands to task
    const sellersResult = await pool.request().query(`
      SELECT s.Id, s.Name, s.Marketplace
      FROM Sellers s
      INNER JOIN Asins a ON a.SellerId = s.Id
      WHERE a.Status = 'Active'
        AND (
          a.Availability = 'OutOfStock'
          OR LOWER(ISNULL(a.AvailabilityStatus, '')) LIKE '%unavailable%'
          OR LOWER(ISNULL(a.AvailabilityStatus, '')) LIKE '%out of stock%'
        )
      GROUP BY s.Id, s.Name, s.Marketplace
    `);

    for (let i = 0; i < sellersWithUnavailable.recordset.length; i++) {
      const s = sellersWithUnavailable.recordset[i];
      await pool.request()
        .input('id', sql.VarChar, generateId())
        .input('taskInstanceId', sql.VarChar, taskId)
        .input('sellerId', sql.VarChar, s.SellerId)
        .input('sellerName', sql.NVarChar, s.SellerName)
        .input('sortOrder', sql.Int, i + 1)
        .query('INSERT INTO PemsTaskBrands (Id, TaskInstanceId, SellerId, SellerName, SortOrder) VALUES (@id, @taskInstanceId, @sellerId, @sellerName, @sortOrder)');
    }
    console.log('Added', sellersWithUnavailable.recordset.length, 'brands to task');

    // 4. Create OOS runs for each seller (skip if already exists for today)
    for (const s of sellersWithUnavailable.recordset) {
      const request = pool.request()
        .input('sellerId', sql.VarChar, s.SellerId)
        .input('channel', sql.VarChar, s.Marketplace);

      const manifestResult = await request.query(`
        SELECT 
          COUNT(*) AS EligibleActiveAsins,
          SUM(CASE WHEN Availability = 'OutOfStock' 
                      OR LOWER(ISNULL(AvailabilityStatus,'')) LIKE '%unavailable%' 
                      OR LOWER(ISNULL(AvailabilityStatus,'')) LIKE '%out of stock%' 
                 THEN 1 ELSE 0 END) AS RetailOpsUnavailableCount,
          SUM(CASE WHEN Availability IS NULL AND (AvailabilityStatus IS NULL OR LTRIM(RTRIM(AvailabilityStatus)) = '') THEN 1 ELSE 0 END) AS MissingAvailabilityCount,
          MAX(LastScrapedAt) AS LastRetailOpsObservation
        FROM Asins
        WHERE SellerId = @sellerId AND Status = 'Active' AND Marketplace = @channel
      `);

      const manifest = manifestResult.recordset[0];
      const runDate = new Date().toISOString().split('T')[0];

      // Check if run already exists for this seller/date
      const existingRun = await pool.request()
        .input('sellerId', sql.VarChar, s.SellerId)
        .input('runDate', sql.Date, runDate)
        .query('SELECT Id FROM OosRuns WHERE SellerId = @sellerId AND RunDate = @runDate');
      
      let runId;
      if (existingRun.recordset.length > 0) {
        runId = existingRun.recordset[0].Id;
        console.log(`  Run already exists for ${s.SellerName} (${s.SellerId}), skipping`);
      } else {
        const runId = require('crypto').randomBytes(16).toString('hex');
        const runDate = new Date().toISOString().split('T')[0];

        await pool.request()
          .input('id', sql.VarChar, require('crypto').randomBytes(16).toString('hex'))
          .input('runDate', sql.Date, new Date().toISOString().split('T')[0])
          .input('monitoredDate', sql.Date, new Date().toISOString().split('T')[0])
          .input('sellerId', sql.VarChar, s.SellerId)
          .input('sellerName', sql.NVarChar, s.SellerName)
          .input('channel', sql.VarChar, s.Marketplace)
          .input('status', sql.VarChar, 'MONITORING')
          .input('policyVersion', sql.VarChar, 'v1')
          .input('manifestJson', sql.NVarChar(sql.MAX), JSON.stringify({
            channel: s.Marketplace,
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
        .query(`
          INSERT INTO OosRuns
            (Id, RunDate, MonitoredDate, SellerId, SellerName, Channel, Status, PolicyVersion, ManifestJson, TaskInstanceId, CreatedBy, CreatedAt, UpdatedAt)
          VALUES
            (@id, @runDate, @monitoredDate, @sellerId, @sellerName, @channel, @status, @policyVersion, @manifestJson, @taskInstanceId, @createdBy, GETUTCDATE(), GETUTCDATE())
        `);

        await pool.request()
          .input('id', sql.VarChar, require('crypto').randomBytes(16).toString('hex'))
          .input('taskInstanceId', sql.VarChar, taskId)
          .input('oosRunId', sql.VarChar, runId)
          .input('sellerId', sql.VarChar, s.SellerId)
          .input('channel', sql.VarChar, s.Marketplace)
          .input('state', sql.VarChar, 'OPEN')
          .query('INSERT INTO OosTaskBindings (Id, TaskInstanceId, OosRunId, SellerId, Channel, State, CreatedAt, UpdatedAt) VALUES (@id, @taskInstanceId, @oosRunId, @sellerId, @channel, @state, GETUTCDATE(), GETUTCDATE())');
      }
    }
    console.log('Created OOS runs for', sellersWithUnavailable.recordset.length, 'sellers');

    // Run reconciliation for each run
    const reconciliation = require('../services/oos/oosReconciliationService');
    const runs = await pool.request().query('SELECT Id FROM OosRuns');
    
    for (const run of runs.recordset) {
      console.log('\nRunning reconciliation for run:', run.Id);
      const result = await reconciliation.reconcileRun(run.Id, { actorId: 'system' });
      console.log('  Analysed:', result.analysed, 'Counts:', result.counts);
    }

    console.log('\n=== SETUP COMPLETE ===');
    console.log('Task created with all OOS runs and reconciliation complete');

    // Show summary
    const summary = await pool.request().query(`
      SELECT d.Category, COUNT(*) as count
      FROM OosDecisions d
      INNER JOIN OosRuns r ON r.Id = d.RunId
      WHERE r.TaskInstanceId = (SELECT TOP 1 Id FROM PemsTaskInstances ORDER BY CreatedAt DESC)
      GROUP BY d.Category
    `);
    console.log('\nDecision Summary:');
    console.table(summary.recordset);

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});