'use strict';

/**
 * Real, isolated SQL Server smoke suite for Phase 2.2 persistence.
 *
 * Set PEMS_SQLSERVER_SMOKE=1 and PEMS_TEST_MSSQL_MODULE to an independently
 * installed driver. No production database or credentials are used.
 */
jest.mock('../../database/db', () => {
  const sql = require(process.env.PEMS_TEST_MSSQL_MODULE || 'mssql');
  return {
    sql,
    getPool: async () => mockSqlPool,
    withTransaction: async callback => {
      const tx = new sql.Transaction(mockSqlPool);
      await tx.begin();
      try {
        const result = await callback({ request: () => new sql.Request(tx) });
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    },
    generateId: () => 'audit-' + (++mockAuditId),
  };
});

let mockSqlPool, mockAuditId;
const sql = require(process.env.PEMS_TEST_MSSQL_MODULE || 'mssql');
const migration = require('../../migrations/042_pems_workflow_v2_activity_outputs');
const service = require('../../services/pems/taskWorkflowV2Execution');
const runReal = process.env.PEMS_SQLSERVER_SMOKE === '1' ? test : test.skip;

const view = {
  viewKey: 'STANDARD_V1', schemaVersion: '2.0', definitionVersion: 2, tabs: [],
  workflow: {
    schemaVersion: '2.0',
    phases: [{
      key: 'inventory', title: 'Inventory',
      activities: [
        { key: 'source', title: 'Select source', instructions: 'Choose a source',
          type: 'SELECT_SOURCE', required: true, evidenceRequired: false,
          validatorKey: 'SOURCE_SELECTED',
          fields: [{ key: 'source', label: 'Source', type: 'select', required: true, options: ['RETAILOPS','BRANDCENTRAL'] }] },
        { key: 'verify', title: 'Confirm inventory', instructions: 'Check inventory evidence',
          type: 'CHECKLIST', required: true, evidenceRequired: true,
          validatorKey: 'BOOLEAN_CONFIRMED',
          fields: [{ key: 'checked', label: 'Checked', type: 'boolean', required: true }] },
      ],
    }],
  },
};

async function connectWhenReady() {
  const config = {
    server: process.env.PEMS_TEST_SQLSERVER_HOST || '127.0.0.1',
    port: Number(process.env.PEMS_TEST_SQLSERVER_PORT || '1433'),
    user: process.env.PEMS_TEST_SQLSERVER_USER || 'sa',
    password: process.env.PEMS_TEST_SQLSERVER_PASSWORD,
    database: 'tempdb', options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 15000, connectionTimeout: 4000,
  };
  if (!config.password) throw new Error('PEMS_TEST_SQLSERVER_PASSWORD required');
  for (let i = 0; i < 40; i++) {
    const p = new sql.ConnectionPool(config);
    try { await p.connect(); return p; }
    catch (e) {
      await p.close().catch(() => {});
      if (i === 39) throw e;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

runReal('migration 042 and validated outputs run against real SQL Server', async () => {
  mockAuditId = 0;
  const old = {
    PEMS_V2_EXECUTION_ENABLED: process.env.PEMS_V2_EXECUTION_ENABLED,
    PEMS_PIN_VIEW_SNAPSHOTS: process.env.PEMS_PIN_VIEW_SNAPSHOTS,
    PEMS_STRICT_ACTIVITY_GATES: process.env.PEMS_STRICT_ACTIVITY_GATES,
  };
  for (const key of Object.keys(old)) process.env[key] = 'true';
  mockSqlPool = await connectWhenReady();

  try {
    await mockSqlPool.request().query(`
      CREATE TABLE dbo.PemsTaskInstances (
        Id VARCHAR(50) PRIMARY KEY, Status VARCHAR(30),
        ViewDefinitionId VARCHAR(50), ViewDefinitionSnapshot NVARCHAR(MAX)
      );
      CREATE TABLE dbo.PemsSubTasks (
        Id VARCHAR(50) PRIMARY KEY, TaskInstanceId VARCHAR(50), SortOrder INT
      );
      CREATE TABLE dbo.PemsActivities (
        Id VARCHAR(50) PRIMARY KEY, TaskInstanceId VARCHAR(50), SubTaskId VARCHAR(50),
        StepNo INT, IsCompleted BIT NOT NULL DEFAULT 0,
        EvidenceRequired BIT NOT NULL DEFAULT 0
      );
      CREATE TABLE dbo.PemsEvidence (
        Id VARCHAR(50) PRIMARY KEY, TaskInstanceId VARCHAR(50), ActivityId VARCHAR(50)
      );
      CREATE TABLE dbo.PemsTaskAuditLogs (
        Id VARCHAR(50) PRIMARY KEY, TaskInstanceId VARCHAR(50),
        Action NVARCHAR(50), ActorId VARCHAR(50), ActorName NVARCHAR(200),
        Details NVARCHAR(MAX)
      );
    `);
    await mockSqlPool.request().query(`
      CREATE FUNCTION dbo.GetEnvDate() RETURNS DATETIME2
      AS BEGIN RETURN GETUTCDATE(); END
    `);

    await migration.up(mockSqlPool);
    await migration.up(mockSqlPool);

    const columns = (await mockSqlPool.request().query(`
      SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities')
        AND name IN ('WorkflowActivityKey','ActivityType','OutputJson',
        'OutputRevision','OutputUpdatedBy','OutputUpdatedAt')
    `)).recordset.map(r => r.name);
    expect(columns).toHaveLength(6);

    await mockSqlPool.request()
      .input('snapshot', sql.NVarChar(sql.MAX), JSON.stringify(view))
      .query(`
        INSERT INTO dbo.PemsTaskInstances (Id, Status, ViewDefinitionId, ViewDefinitionSnapshot)
          VALUES ('task-real', 'IN_PROGRESS', 'view-v2', @snapshot),
                 ('task-other', 'IN_PROGRESS', 'view-v2', @snapshot);
        INSERT INTO dbo.PemsSubTasks (Id, TaskInstanceId, SortOrder, WorkflowPhaseKey)
          VALUES ('phase-real', 'task-real', 0, 'inventory');
        INSERT INTO dbo.PemsActivities
          (Id, TaskInstanceId, SubTaskId, StepNo, WorkflowActivityKey, ActivityType)
          VALUES ('source-real', 'task-real', 'phase-real', 1, 'source', 'SELECT_SOURCE'),
                 ('verify-real', 'task-real', 'phase-real', 2, 'verify', 'CHECKLIST');
      `);

    const save = (args = {}) => service.saveActivityOutput({
      taskId: 'task-real', activityId: 'source-real',
      actorId: 'dev-employee', actorName: 'Dev Employee',
      output: { source: 'RETAILOPS' }, expectedRevision: 0,
      ...args,
    });
    expect(await save()).toMatchObject({ revision: 1, alreadySaved: false });
    expect(await save()).toMatchObject({ revision: 1, alreadySaved: true });
    await expect(save({ output: { source: 'BRANDCENTRAL' } }))
      .rejects.toMatchObject({ code: 'ACTIVITY_REVISION_CONFLICT', status: 409 });
    await expect(save({ taskId: 'task-other' }))
      .rejects.toMatchObject({ code: 'ACTIVITY_NOT_FOUND', status: 404 });

    const state = await service.getWorkflowExecution('task-real');
    expect(state.phases[0].activities[0]).toMatchObject({
      key: 'source', activityId: 'source-real',
      output: { source: 'RETAILOPS' }, outputRevision: 1,
    });

    await service.saveActivityOutput({
      taskId: 'task-real', activityId: 'verify-real',
      actorId: 'dev-employee', actorName: 'Dev Employee',
      output: { checked: true }, expectedRevision: 0,
    });
    await expect(service.assertStepReady({ request: () => mockSqlPool.request() }, 'task-real', 'verify-real'))
      .rejects.toMatchObject({ code: 'ACTIVITY_OUTPUT_INVALID', status: 422 });

    await mockSqlPool.request().query(`
      INSERT INTO dbo.PemsEvidence (Id, TaskInstanceId, ActivityId)
        VALUES ('proof-real', 'task-real', 'verify-real')
    `);
    await expect(service.assertStepReady({ request: () => mockSqlPool.request() }, 'task-real', 'verify-real'))
      .resolves.toMatchObject({ activityKey: 'verify', output: { checked: true } });

    const auditCount = (await mockSqlPool.request().query(`
      SELECT COUNT(*) AS n FROM dbo.PemsTaskAuditLogs WHERE TaskInstanceId = 'task-real'
    `)).recordset[0].n;
    expect(auditCount).toBe(2);
  } finally {
    await mockSqlPool.request().query(`
      DROP TABLE IF EXISTS dbo.PemsTaskAuditLogs;
      DROP TABLE IF EXISTS dbo.PemsEvidence;
      DROP TABLE IF EXISTS dbo.PemsActivities;
      DROP TABLE IF EXISTS dbo.PemsSubTasks;
      DROP TABLE IF EXISTS dbo.PemsTaskInstances;
    `).catch(() => {});
    await mockSqlPool.request().query('DROP FUNCTION IF EXISTS dbo.GetEnvDate').catch(() => {});
    await mockSqlPool.close();
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}, 180000);
