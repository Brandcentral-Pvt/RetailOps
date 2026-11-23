'use strict';

/**
 * Optional real SQL Server smoke test. Only runs against an isolated development
 * SQL Server instance when PEMS_SQLSERVER_SMOKE=1. The GitHub Actions job runs
 * this against its own disposable SQL Server container (tempdb).
 *
 * This executes the actual assertPhaseReady query, rather than trusting a
 * regex or fake pool to validate SQL Server's aggregate/subquery rules.
 */
// Keep the SQL dialect test independent of unrelated application imports.
 // The isolated driver in CI has its full dependency tree, even when the
 // repository's pre-existing backend lockfile has incomplete JWT metadata.
jest.mock('../../database/db', () => ({
  sql: require(process.env.PEMS_TEST_MSSQL_MODULE || 'mssql'),
}));
const mssql = require(process.env.PEMS_TEST_MSSQL_MODULE || 'mssql');
const gates = require('../../services/pems/taskExecutionGates');

let pool = null;

async function connectWhenReady() {
  const connection = {
    server: process.env.PEMS_TEST_SQLSERVER_HOST || '127.0.0.1',
    port: Number(process.env.PEMS_TEST_SQLSERVER_PORT || '1433'),
    user: process.env.PEMS_TEST_SQLSERVER_USER || 'sa',
    password: process.env.PEMS_TEST_SQLSERVER_PASSWORD,
    database: 'tempdb',
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 3000,
    requestTimeout: 15000,
  };
  if (!connection.password) throw new Error('PEMS_TEST_SQLSERVER_PASSWORD is required for SQL smoke tests');
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = new mssql.ConnectionPool(connection);
    try {
      await candidate.connect();
      return candidate;
    } catch (error) {
      await candidate.close().catch(() => {});
      if (attempt === 39) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('SQL Server did not start');
}

const smokeTest = process.env.PEMS_SQLSERVER_SMOKE === '1' ? test : test.skip;

smokeTest('phase readiness SQL executes on SQL Server and counts evidence without duplicates', async () => {
  pool = await connectWhenReady();
  try {
    // Isolated tempdb instance provisioned by the CI job. No production writes.
    await pool.request().query(`
      CREATE TABLE dbo.PemsTaskInstances (Id VARCHAR(50) PRIMARY KEY, Status VARCHAR(30) NOT NULL);
      CREATE TABLE dbo.PemsSubTasks (Id VARCHAR(50) PRIMARY KEY, TaskInstanceId VARCHAR(50), IsCompleted BIT NOT NULL);
      CREATE TABLE dbo.PemsActivities (
        Id VARCHAR(50) PRIMARY KEY, TaskInstanceId VARCHAR(50), SubTaskId VARCHAR(50),
        IsMandatory BIT NOT NULL, IsCompleted BIT NOT NULL, EvidenceRequired BIT NOT NULL
      );
      CREATE TABLE dbo.PemsEvidence (Id VARCHAR(50) PRIMARY KEY, TaskInstanceId VARCHAR(50), ActivityId VARCHAR(50));
      INSERT INTO dbo.PemsTaskInstances (Id, Status) VALUES ('task-smoke', 'IN_PROGRESS');
      INSERT INTO dbo.PemsSubTasks (Id, TaskInstanceId, IsCompleted)
        VALUES ('phase-smoke', 'task-smoke', 0);
      INSERT INTO dbo.PemsActivities (Id, TaskInstanceId, SubTaskId, IsMandatory, IsCompleted, EvidenceRequired)
        VALUES ('activity-1', 'task-smoke', 'phase-smoke', 1, 1, 1);
    `);

    await expect(gates.assertPhaseReady(pool, 'phase-smoke'))
      .rejects.toMatchObject({
        code: 'PHASE_INCOMPLETE', gate: { pendingRequired: 0, missingEvidence: 1 },
      });

    await pool.request().query(`
      INSERT INTO dbo.PemsEvidence (Id, TaskInstanceId, ActivityId) VALUES
        ('evidence-1', 'task-smoke', 'activity-1'),
        ('evidence-2', 'task-smoke', 'activity-1');
    `);
    await expect(gates.assertPhaseReady(pool, 'phase-smoke'))
      .resolves.toMatchObject({ TaskInstanceId: 'task-smoke', Id: 'phase-smoke' });

    await pool.request().query(`
      INSERT INTO dbo.PemsActivities (Id, TaskInstanceId, SubTaskId, IsMandatory, IsCompleted, EvidenceRequired)
        VALUES ('activity-2', 'task-smoke', 'phase-smoke', 1, 0, 1);
    `);
    await expect(gates.assertPhaseReady(pool, 'phase-smoke'))
      .rejects.toMatchObject({
        code: 'PHASE_INCOMPLETE', gate: { pendingRequired: 1, missingEvidence: 1 },
      });
  } finally {
    await pool.request().query(`
      DROP TABLE IF EXISTS dbo.PemsEvidence;
      DROP TABLE IF EXISTS dbo.PemsActivities;
      DROP TABLE IF EXISTS dbo.PemsSubTasks;
      DROP TABLE IF EXISTS dbo.PemsTaskInstances;
    `).catch(() => {});
    await pool.close();
    pool = null;
  }
}, 180000);
