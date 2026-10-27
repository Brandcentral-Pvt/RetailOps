/*
  OOS-RECON-001 read-only evidence checks

  Purpose
    - Confirm post-deadline containment after 2026-10-27T08:51:23.570Z.
    - Capture the production anchors needed for the G0 restore comparison.
    - Re-run sections 0-8 against a restored disposable copy. Section 9 is
      anchored to post-EX-001 production; a backup taken before EX-001 will
      legitimately show OosTemplateInactive = FAIL. Record the difference; do
      not "fix" the restored copy to make the summary pass.

  Safety
    - SELECT statements only. No DDL, DML, MERGE, temp tables, or stored procedure calls.
    - Do not run this through backend/database/db.js: getPool() calls initUdf(), which can
      CREATE or ALTER dbo.GetEnvDate(). Use sqlcmd, Invoke-Sqlcmd, or a standalone mssql
      client that opens its own connection.
    - Use a read-only login where available. Do not record the login name or password in
      the output or in git.

  Expected post-EX-001 production values (captured 2026-10-27, before the deadline)
    OOS-RECON-001 template Id ............ cf7dc8fb89884a2383cdde38
    DLY-004 template Id .................. 86de4ce3372a4f3ea85f9e94
    OOS template IsActive ................ 0
    OOS NextScheduledDate ................ 2026-10-27T08:51:23.570
    OOS LastGeneratedAt .................. 2026-10-26T10:30:00.005
    OOS instances ........................ 7 (6 DRAFT, 1 ASSIGNED)
    OOS recurrence-log rows .............. 3 (occurrences 24, 25 and 26 October)
    OosRuns .............................. 188, all RECONCILED
    OosTaskBindings ...................... 188, all 188 orphaned (0 join to OosRuns)
    OosDecisions ......................... 44,223, all INSUFFICIENT_EVIDENCE
    Distinct decision ASINs .............. 43,942
    OosImports / OosObservations ......... 0 / 0
    OosIncidents / Exports / Resync ...... 0 / 0 / 0
    OosSubmissionReviews ................. 0
    DLY-004 IsActive ..................... 1
    DLY-004 ASSIGNED instances ........... 17
    DLY-004 UpdatedAt .................... 2026-09-30T11:24:58.300
    SchemaMigrations 032-034 applied ..... yes
    SchemaMigrations 035-039 applied ..... no

  A changed count is not automatically a failure. Preserve the output, stop, and compare
  against the approved baseline before taking any action. Never repair production in place.
*/

SET NOCOUNT ON;

DECLARE @OosTemplateId varchar(50) = 'cf7dc8fb89884a2383cdde38';
DECLARE @DlyTemplateId varchar(50) = '86de4ce3372a4f3ea85f9e94';
DECLARE @DeadlineLocalDate date = '2026-10-27'; -- next OOS occurrence date in Asia/Kolkata

/* -------------------------------------------------------------------------
   0. Context
   Record the database, server, clocks and client application name. Do not
   record the login name or any credential.
   ------------------------------------------------------------------------- */
SELECT
  DB_NAME() AS DatabaseName,
  @@SERVERNAME AS ServerName,
  SYSUTCDATETIME() AS UtcNow,
  SYSDATETIME() AS ServerLocalNow,
  APP_NAME() AS ApplicationName;

/* -------------------------------------------------------------------------
   1. Template anchors
   Expected:
     OOS-RECON-001  IsActive = 0, DAILY, AutoAssign = 0, AutoAssignEnabled = 0,
                    NextScheduledDate = 2026-10-27T08:51:23.570,
                    LastGeneratedAt = 2026-10-26T10:30:00.005
     DLY-004        IsActive = 1, DAILY, UpdatedAt = 2026-09-30T11:24:58.300
   ------------------------------------------------------------------------- */
SELECT
  TaskCode,
  Id,
  IsActive,
  Frequency,
  RunDays,
  DueTime,
  AutoAssign,
  AutoAssignEnabled,
  BrandMode,
  ReviewerId,
  AssigneeRole,
  LastGeneratedAt,
  NextScheduledDate,
  UpdatedAt
FROM dbo.PemsTaskTemplates
WHERE Id IN (@OosTemplateId, @DlyTemplateId)
ORDER BY TaskCode;

/* -------------------------------------------------------------------------
   2. OOS recurrence after containment
   Expected:
     OosRecurrenceRows = 3
     RowsOnOrAfterDeadlineDate = 0
     LatestOosOccurrence = 2026-10-26
   ------------------------------------------------------------------------- */
SELECT
  @DeadlineLocalDate AS DeadlineLocalDate,
  COUNT(*) AS OosRecurrenceRows,
  SUM(CASE WHEN OccurrenceFor >= @DeadlineLocalDate THEN 1 ELSE 0 END) AS RowsOnOrAfterDeadlineDate,
  MAX(OccurrenceFor) AS LatestOosOccurrence
FROM dbo.PemsRecurrenceLog
WHERE TemplateId = @OosTemplateId;

SELECT
  TemplateId,
  InstanceId,
  OccurrenceFor,
  Status,
  CreatedAt
FROM dbo.PemsRecurrenceLog
WHERE TemplateId = @OosTemplateId
ORDER BY OccurrenceFor;

/* -------------------------------------------------------------------------
   3. Instance counts and status distribution
   Expected:
     OOS-RECON-001  7 total: 6 DRAFT, 1 ASSIGNED, 0 COMPLETED/CANCELLED
     DLY-004       17 total: 17 ASSIGNED, 0 COMPLETED/CANCELLED
   ------------------------------------------------------------------------- */
SELECT
  t.TaskCode,
  i.Status,
  COUNT(*) AS InstanceCount,
  MIN(i.CreatedAt) AS FirstCreatedAt,
  MAX(i.CreatedAt) AS LastCreatedAt
FROM dbo.PemsTaskInstances i
JOIN dbo.PemsTaskTemplates t ON t.Id = i.TemplateId
WHERE i.TemplateId IN (@OosTemplateId, @DlyTemplateId)
GROUP BY t.TaskCode, i.Status
ORDER BY t.TaskCode, i.Status;

SELECT
  t.TaskCode,
  COUNT(*) AS TotalInstances,
  SUM(CASE WHEN i.Status = 'ASSIGNED' THEN 1 ELSE 0 END) AS AssignedInstances,
  SUM(CASE WHEN i.Status IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) AS ClosedInstances
FROM dbo.PemsTaskInstances i
JOIN dbo.PemsTaskTemplates t ON t.Id = i.TemplateId
WHERE i.TemplateId IN (@OosTemplateId, @DlyTemplateId)
GROUP BY t.TaskCode
ORDER BY t.TaskCode;

/* -------------------------------------------------------------------------
   4. OOS data inventory
   Expected:
     OosRuns = 188, OosTaskBindings = 188, OosDecisions = 44,223
     OosImports = 0, OosObservations = 0, OosIncidents = 0,
     OosExports = 0, OosResyncJobs = 0, OosSubmissionReviews = 0
   ------------------------------------------------------------------------- */
SELECT 'OosRuns' AS Entity, COUNT(*) AS RecordCount FROM dbo.OosRuns
UNION ALL
SELECT 'OosTaskBindings', COUNT(*) FROM dbo.OosTaskBindings
UNION ALL
SELECT 'OosDecisions', COUNT(*) FROM dbo.OosDecisions
UNION ALL
SELECT 'OosImports', COUNT(*) FROM dbo.OosImports
UNION ALL
SELECT 'OosObservations', COUNT(*) FROM dbo.OosObservations
UNION ALL
SELECT 'OosIncidents', COUNT(*) FROM dbo.OosIncidents
UNION ALL
SELECT 'OosExports', COUNT(*) FROM dbo.OosExports
UNION ALL
SELECT 'OosResyncJobs', COUNT(*) FROM dbo.OosResyncJobs
UNION ALL
SELECT 'OosSubmissionReviews', COUNT(*) FROM dbo.OosSubmissionReviews;

/* -------------------------------------------------------------------------
   5. Orphan-binding proof
   Expected:
     Bindings = 188
     OrphanBindings = 188
     MatchedRunIds = 0
   ------------------------------------------------------------------------- */
SELECT
  COUNT(*) AS Bindings,
  SUM(CASE WHEN r.Id IS NULL THEN 1 ELSE 0 END) AS OrphanBindings,
  COUNT(DISTINCT b.OosRunId) AS DistinctBindingRunIds,
  COUNT(DISTINCT r.Id) AS MatchedRunIds
FROM dbo.OosTaskBindings b
LEFT JOIN dbo.OosRuns r ON r.Id = b.OosRunId;

/* Expected: TASK-OOS-MVOUYS8Z has 188 bindings, all orphaned; other instances have 0. */
SELECT
  i.InstanceCode,
  i.Status,
  COUNT(b.Id) AS Bindings,
  SUM(CASE WHEN b.Id IS NOT NULL AND r.Id IS NULL THEN 1 ELSE 0 END) AS OrphanBindings
FROM dbo.PemsTaskInstances i
LEFT JOIN dbo.OosTaskBindings b ON b.TaskInstanceId = i.Id
LEFT JOIN dbo.OosRuns r ON r.Id = b.OosRunId
WHERE i.TemplateId = @OosTemplateId
GROUP BY i.InstanceCode, i.Status
ORDER BY Bindings DESC, i.InstanceCode;

/* -------------------------------------------------------------------------
   6. OOS run and decision scope
   Expected:
     OosRuns: 188 RECONCILED, 188 distinct sellers, RunDate 2026-10-25
     OosDecisions: one category row, INSUFFICIENT_EVIDENCE, 44,223 rows,
                   43,942 ASINs, 188 runs, 188 sellers
   ------------------------------------------------------------------------- */
SELECT
  Status,
  COUNT(*) AS RunCount,
  COUNT(DISTINCT SellerId) AS DistinctSellers,
  MIN(RunDate) AS FirstRunDate,
  MAX(RunDate) AS LastRunDate
FROM dbo.OosRuns
GROUP BY Status
ORDER BY Status;

SELECT
  COUNT(*) AS RunsWithTaskInstance,
  COUNT(DISTINCT TaskInstanceId) AS DistinctTaskInstances
FROM dbo.OosRuns
WHERE TaskInstanceId IS NOT NULL;

SELECT
  Category,
  COUNT(*) AS DecisionCount,
  COUNT(DISTINCT AsinCode) AS DistinctAsins,
  COUNT(DISTINCT RunId) AS DistinctRuns,
  COUNT(DISTINCT SellerId) AS DistinctSellers
FROM dbo.OosDecisions
GROUP BY Category
ORDER BY Category;

/* -------------------------------------------------------------------------
   7. Migrations and published view definitions
   Expected:
     SchemaMigrations: 032, 033 and 034 only; 035-039 absent
     OOS-RECON-001: OOS_RECON_V1, version 1, PUBLISHED
     DLY-004: STANDARD_V1, version 1, PUBLISHED
   ------------------------------------------------------------------------- */
SELECT
  Name,
  AppliedAt
FROM dbo.SchemaMigrations
WHERE Name LIKE '03[2-9]%'
ORDER BY Name;

SELECT
  t.TaskCode,
  v.ViewKey,
  v.SchemaVersion,
  v.DefinitionVersion,
  v.Status,
  v.PublishedAt
FROM dbo.PemsTemplateViewDefinitions v
JOIN dbo.PemsTaskTemplates t ON t.Id = v.TemplateId
WHERE t.Id IN (@OosTemplateId, @DlyTemplateId)
ORDER BY t.TaskCode, v.DefinitionVersion DESC;

/* -------------------------------------------------------------------------
   8. DLY-004 structural anchors
   Record these values on the restored copy before any migration and again
   after the rehearsal. They are comparison anchors, not a claim that the
   production snapshot is a pre-change backup.
   Expected from the production snapshot:
     Instances = 17, Assigned = 17, UpdatedAt = 2026-09-30T11:24:58.300
   Brand and assignment-rule counts were not captured in the first snapshot;
   record them now and compare before and after the rehearsal.
   ------------------------------------------------------------------------- */
SELECT
  COUNT(*) AS DlyInstances,
  SUM(CASE WHEN Status = 'ASSIGNED' THEN 1 ELSE 0 END) AS DlyAssigned,
  SUM(CASE WHEN Status IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) AS DlyClosed,
  MIN(DueDate) AS MinDueDate,
  MAX(DueDate) AS MaxDueDate,
  COUNT(DISTINCT AssignedTo) AS DistinctAssignees
FROM dbo.PemsTaskInstances
WHERE TemplateId = @DlyTemplateId;

SELECT
  COUNT(*) AS DlyBrandRows,
  COUNT(DISTINCT pb.SellerId) AS DlyDistinctSellers
FROM dbo.PemsTaskBrands pb
JOIN dbo.PemsTaskInstances i ON i.Id = pb.TaskInstanceId
WHERE i.TemplateId = @DlyTemplateId;

SELECT
  COUNT(*) AS DlyAssignmentRules
FROM dbo.PemsAssignmentRules
WHERE TemplateId = @DlyTemplateId;

/* -------------------------------------------------------------------------
   9. Post-deadline containment summary (post-EX-001 production anchor)
   Any FAIL requires investigation and escalation. Do not write, repair,
   reseed, or reactivate anything to make a check pass. On a restored backup,
   compare with the backup date; a pre-EX-001 backup is expected to show
   OosTemplateInactive = FAIL because the backup predates containment.
   ------------------------------------------------------------------------- */
SELECT
  CASE WHEN ISNULL((SELECT IsActive FROM dbo.PemsTaskTemplates WHERE Id = @OosTemplateId), -1) = 0
       THEN 'PASS' ELSE 'FAIL' END AS OosTemplateInactive,
  CASE WHEN (SELECT COUNT(*) FROM dbo.PemsTaskInstances WHERE TemplateId = @OosTemplateId) = 7
       THEN 'PASS' ELSE 'FAIL' END AS OosInstancesStill7,
  CASE WHEN (SELECT COUNT(*) FROM dbo.PemsRecurrenceLog WHERE TemplateId = @OosTemplateId) = 3
       THEN 'PASS' ELSE 'FAIL' END AS OosRecurrenceRowsStill3,
  CASE WHEN (SELECT COUNT(*) FROM dbo.PemsRecurrenceLog
             WHERE TemplateId = @OosTemplateId AND OccurrenceFor >= @DeadlineLocalDate) = 0
       THEN 'PASS' ELSE 'FAIL' END AS NoOosOccurrenceOnDeadlineDate,
  CASE WHEN ISNULL((SELECT IsActive FROM dbo.PemsTaskTemplates WHERE Id = @DlyTemplateId), -1) = 1
       THEN 'PASS' ELSE 'FAIL' END AS DlyTemplateActive,
  CASE WHEN (SELECT COUNT(*) FROM dbo.PemsTaskInstances
             WHERE TemplateId = @DlyTemplateId AND Status = 'ASSIGNED') = 17
       THEN 'PASS' ELSE 'FAIL' END AS DlyAssignedStill17,
  CASE WHEN (SELECT COUNT(*) FROM dbo.OosTaskBindings) = 188
       THEN 'PASS' ELSE 'FAIL' END AS OosBindingsStill188,
  CASE WHEN (SELECT COUNT(*) FROM dbo.OosTaskBindings b
             LEFT JOIN dbo.OosRuns r ON r.Id = b.OosRunId
             WHERE r.Id IS NULL) = 188
       THEN 'PASS' ELSE 'FAIL' END AS OrphanBindingsStill188,
  CASE WHEN (SELECT COUNT(*) FROM dbo.OosRuns) = 188
       THEN 'PASS' ELSE 'FAIL' END AS OosRunsStill188,
  CASE WHEN (SELECT COUNT(*) FROM dbo.OosDecisions) = 44223
       THEN 'PASS' ELSE 'FAIL' END AS OosDecisionsStill44223;
