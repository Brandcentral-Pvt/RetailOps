# OOS-RECON-001 production read-only snapshot

**Captured:** 2026-10-27 (Asia/Kolkata; SQL Server time `2026-10-27T00:44:40Z`)<br>
**Host:** `31.97.62.95:1433`<br>
**Database:** `retailops`<br>
**Server:** `sqlserver`<br>
**Mode:** read-only `SELECT` queries only, application name `RetailOps-OOS-Phase0-ReadOnly`<br>
**Authorization:** production endpoint supplied by the user on 2026-10-27<br>
**Writes:** none. No migration, seed, template update, assignment, upload, provider call or data correction was performed.

> **Access-control finding:** the SQL login configured in the local backend
> environment holds the `sysadmin` server role. The login name and password are
> deliberately not recorded here. Read-only queries were issued despite the
> elevated grant; that grant should be replaced with a least-privilege account
> before any further database work.

## 1. Summary

The production database is **not** in the inactive state assumed by the source
audit. `OOS-RECON-001` is active and has generated data. The data is internally
inconsistent: every one of the 188 `OosTaskBindings` points at an `OosRunId` that
does not exist.

| Item | Observed value |
|---|---|
| `OOS-RECON-001` template | Active, `DAILY`, `AutoAssign` disabled |
| Next OOS schedule | `2026-10-27T08:51:23Z`; recurrence has already created three instances |
| OOS task instances | 7 total: 6 `DRAFT`, 1 `ASSIGNED` |
| OOS task instance holding the run data | `TASK-OOS-MVOUYS8Z`, `DRAFT`, no seller, no assignee, 188 bindings |
| Assigned OOS task instance | 1, with 0 run bindings |
| `OosRuns` | 188, all `RECONCILED` |
| Run scope | 188 sellers; 187 `amazon.in`, 1 `ajio` |
| Run date | `2026-10-25` for every run |
| `OosTaskBindings` | 188 |
| Bindings whose `OosRunId` matches an `OosRuns.Id` | **0** |
| `OosDecisions` | 44,223, all `INSUFFICIENT_EVIDENCE` |
| Decision scope | 43,942 distinct ASINs across 188 runs |
| `OosImports` / `OosObservations` | 0 / 0 |
| Incidents / exports / resync jobs / submission reviews | 0 / 0 / 0 / 0 |
| `DLY-004` | Active; 17 `ASSIGNED` instances, all due `2026-10-27T06:30:00Z` |
| Applied OOS migrations | `032`, `033`, `034` only |
| `OOS-RECON-001` view definition | `OOS_RECON_V1`, version 1, `PUBLISHED` |
| `DLY-004` view definition | `STANDARD_V1`, version 1, `PUBLISHED` |

## 2. Template and instance state

| Task code | Template Id | Frequency | Active | Instances |
|---|---|---|---|---:|
| `OOS-RECON-001` | `cf7dc8fb89884a2383cdde38` | `DAILY` | Yes | 7 |
| `DLY-004` | `86de4ce3372a4f3ea85f9e94` | `DAILY` | Yes | 17 |

OOS instance status:

| Status | Count | Notes |
|---|---:|---|
| `DRAFT` | 6 | One draft (`TASK-OOS-MVOUYS8Z`) owns all 188 run bindings; the other five have none |
| `ASSIGNED` | 1 | `TASK-0006`; no run bindings |
| `COMPLETED` / `CANCELLED` | 0 | None |

No assigned OOS task currently points at the reconciled run data. The only
assigned instance is empty, and the populated instance is an unassigned draft.

### 2.1 Recurrence is still scheduled

The active template has an automatic daily schedule:

| Field | Value |
|---|---|
| `Frequency` | `DAILY` |
| `RunDays` | `1,2,3,4,5,6` (Monday-Saturday) |
| `DueTime` | `12:00` |
| `IsActive` | `true` |
| `AutoAssign` / `AutoAssignEnabled` | `false` / `false` |
| `LastGeneratedAt` | `2026-10-26T10:30:00Z` |
| `NextScheduledDate` | `2026-10-27T08:51:23Z` |

`PemsRecurrenceLog` contains three `CREATED` rows for this template, covering
occurrences on 24, 25 and 26 October 2026, all with `AssigneeId = null`. The
scheduler is therefore still capable of creating another unassigned OOS
instance. That next occurrence is a containment deadline: obtain written
approval to stop the OOS schedule before `2026-10-27T08:51:23Z`. Do not change
the `DLY-004` schedule, which is independent and remains active.

## 3. Runs

| Field | Value |
|---|---|
| Count | 188 |
| Status | `RECONCILED` for all 188 |
| Distinct sellers | 188 |
| Channels | `amazon.in` (187), `ajio` (1) |
| `RunDate` / `MonitoredDate` | `2026-10-25` for all runs |
| `CreatedBy` | `system` for all runs |
| Created at | `2026-10-26T00:41:08Z` to `2026-10-26T00:41:45Z` |
| Task instance | All 188 runs store `TaskInstanceId = d73f5da2b19347359e4a5b4c` (`TASK-OOS-MVOUYS8Z`, `DRAFT`) |

The run status is `RECONCILED` even though there are no import or observation
rows and every persisted decision is `INSUFFICIENT_EVIDENCE`. That status does
not mean the run had sufficient evidence; it needs separate state semantics in
the remediation.

## 4. Orphan bindings

`OosTaskBindings` has 188 rows:

- 188 have a non-null `OosRunId`.
- 188 have a non-null `TaskInstanceId` (`d73f5da2b19347359e4a5b4c`).
- **0** join to `OosRuns` on `OosRunId`.
- All 188 are therefore orphaned for any read path that joins through the
  binding.

The shape is consistent with `backend/scripts/setup-fresh-oos-run.js`: it
inserts `OosRuns.Id` from one generated value and writes a different `runId`
into `OosTaskBindings.OosRunId`. The script must not be run against production
again. The orphan rows must be preserved until a restore and an approved repair
plan exist.

This is a production-data manifestation of the orphan-import/binding class of
defect, not merely a frontend import problem.

## 5. Decisions

| Field | Value |
|---|---|
| Count | 44,223 |
| Category | `INSUFFICIENT_EVIDENCE` for all rows |
| Distinct ASINs | 43,942 |
| Distinct runs | 188 |
| Distinct sellers | 188 |

No `OosImports` or `OosObservations` rows exist. The persisted decisions are
therefore not supported by uploaded or captured evidence in this snapshot.
Whether they came from the RetailOps fallback path or from a bulk seed must be
established on a restored copy before any cleanup.

## 6. `DLY-004`

`DLY-004` is present and active. It has 17 `ASSIGNED` instances, all open and due
`2026-10-27T06:30:00Z`. No `DLY-004` row, template, instance, assignment or view
definition was changed by this read-only check.

A structural comparison against the pre-change baseline still requires a
restored copy. This snapshot proves presence and active state only.

## 7. Schema and view state

Applied migrations relevant to OOS:

```text
032_oos_reconciliation.js                 2026-10-23T09:08:08Z
033_task_view_definitions_and_oos_bindings.js 2026-10-23T11:42:46Z
034_evidence_required_and_oos_bindings.js 2026-10-23T12:32:34Z
```

Migrations `035` through `039` are **not** applied. The production schema is
therefore at the audited pre-remediation state, plus the production data defect
above.

Published view definitions:

| Task | View key | Version | Status |
|---|---|---|---:|---|
| `DLY-004` | `STANDARD_V1` | 1 | `PUBLISHED` |
| `OOS-RECON-001` | `OOS_RECON_V1` | 1 | `PUBLISHED` |

Publishing the view definition did not make the specialized view reachable from
the active drawer. The UI wiring finding remains separate.

## 8. Required containment

1. Stop the OOS recurrence under a written exception before
   `2026-10-27T08:51:23Z`; do not touch the independent `DLY-004` schedule.
2. Do not run `backend/scripts/setup-fresh-oos-run.js` against production.
3. Do not create or assign more OOS instances, runs or bindings while the freeze
   is in force.
4. Do not deactivate, overwrite or reseed `OOS-RECON-001` or `DLY-004` without a
   written exception and a restore plan.
5. Preserve the 188 orphan bindings and 44,223 decisions as evidence. Do not
   delete or "repair" them in place.
6. Rehearse the orphan inventory, binding repair and run-status correction on a
   restored copy before proposing any production correction.
7. Replace the `sysadmin` application login with a least-privilege account for
   future checks and application traffic.

## 9. Limitations

- This is a point-in-time snapshot, not a restore.
- No migration forward/rollback was run.
- No structural diff of `DLY-004` was possible without a pre-change restore.
- No CI log or application runtime was exercised.
- The production data may change after this capture; the counts are evidence for
  the capture time only.

## 10. Query method

Only `SELECT` statements were issued. The checks covered:

- `sys.databases`, `sys.tables`, `sys.indexes` and `SchemaMigrations` metadata.
- `PemsTaskTemplates`, `PemsTaskInstances`, `PemsTaskBrands`,
  `PemsRecurrenceLog`.
- `OosWorkflowPolicies`, `OosRuns`, `OosTaskBindings`, `OosDecisions`,
  `OosImports`, `OosObservations`, `OosIncidents`, `OosIncidentEvents`,
  `OosExports`, `OosResyncJobs`, `OosSubmissionReviews`.
- `PemsTemplateViewDefinitions`.

No `INSERT`, `UPDATE`, `DELETE`, `MERGE`, DDL, migration, seed, template update,
assignment change or provider request was executed.
