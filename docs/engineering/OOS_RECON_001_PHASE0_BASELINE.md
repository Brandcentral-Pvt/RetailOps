# OOS-RECON-001 Phase 0 baseline and safety record

**Date:** 2026-10-27<br>
**Branch:** `feat/oos-recon-001-remediation`<br>
**Base code SHA:** `316729a4dad3b8758135a44a62553c46620a0134` (`main`)<br>
**Branch start point:** `1955fde` (docs-only commits after the base code SHA)<br>
**Gate:** G0<br>
**Status:** In progress; G0 is not passed.

**Scope:** This record contains read-only diagnosis, a test-only import harness and
process controls. No application code, schema, migration, seed, template
activation, assignment or provider call was changed. This work did **not**
activate `OOS-RECON-001`; a later read-only production check found that it was
already active. Under exception `EX-001`, the OOS template was deactivated after
the snapshot to stop recurrence; no other production data was changed.
`DLY-004` is untouched. See the
[production read-only snapshot](./OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md)
for the discovered state, the orphan-binding defect and the containment record.

## 1. Branch and protection

| Item | Value |
|---|---|
| Feature branch | `feat/oos-recon-001-remediation` |
| Base code SHA | `316729a` |
| Docs commits carried onto the branch | `ea9ce5b`, `1955fde` |
| Production branch | `main` remains at `316729a`; do not push implementation directly to `main` |
| Change freeze | See [`OOS_RECON_001_PHASE0_FREEZE.md`](./OOS_RECON_001_PHASE0_FREEZE.md) |
| Rollback owner | Eng lead approves; DevOps executes; Product signs off any business-facing rollback |

The branch was created from `main` and fast-forwarded to the docs-only plan
commits so the plan and backlog are available in the working tree. No
application code differs from `316729a` at this point.

## 2. Failed CI run capture

**Run:** `40304737266`<br>
**Status:** Not captured. This is a G0 blocker.

`gh` is not installed, and neither `GITHUB_TOKEN` nor `GH_TOKEN` is set in the
local environment. The repository is private, so the run log is not readable
without authenticated access. Capture the `pre-deploy`, `deploy` and `rollback`
jobs through the GitHub UI or install and authenticate `gh`, then store a
redacted excerpt with this record.

Do not infer the run result from a green summary job. The exact first failing
command must come from the run log.

### Local CI-path findings

The workflow has several independent failure paths. They explain why a local
baseline cannot be treated as a CI pass, but they do not replace the missing run
log.

| Workflow step | Local result | Consequence |
|---|---|---|
| Frontend `npm run lint` | Fail: 817 errors, 30 warnings, 142 files | First frontend failure locally |
| Frontend `npm run typecheck` | Fail: 16 TypeScript errors | Typecheck never reaches the build |
| Frontend `npm run test -- --run --reporter=verbose` | Fail: root `package.json` has no `test` script | The workflow's test step cannot pass as written |
| Frontend `npm run build` | Pass: 10,121 modules transformed | Does not cover the orphaned OOS modules |
| Backend `npm test` | Fails on Windows because the script invokes the POSIX `.bin/jest` shim through `node` | Local environment issue; use `npx jest` or the CI runner |
| Backend Jest suite (`npx jest`) | 5 failed suites, 38 passed; 3 failed tests, 621 passed | OOS service tests do not run at all |
| Security audit | Not rerun here; GitHub reports 48 advisories | Separate release blocker tracked in the plan |
| Migration dry run | Not run | No disposable database is configured |
| Database restore and row-count verification | Not run | No backup artifact, restore credentials or isolated database |

The first confirmed frontend blocker is `npm run lint`, but the missing `test`
script and typecheck failures also block the same workflow. CI uses Node 20;
the local baseline ran on Node `v24.19.0` and npm `11.17.0`. Re-run the baseline
on Node 20 before treating environment-specific results as release evidence.

## 3. Local baseline detail

### 3.1 Frontend lint

```text
npm run lint
exit 1
142 files with issues
817 errors
30 warnings
```

Top rule counts:

| Rule | Count |
|---|---:|
| `no-dupe-keys` | 386 |
| `no-unused-vars` | 192 |
| `react-hooks/set-state-in-effect` | 97 |
| `no-undef` | 34 |
| `react-hooks/exhaustive-deps` | 30 |
| `no-useless-assignment` | 21 |
| `react-hooks/static-components` | 17 |
| `no-empty` | 17 |
| `react-hooks/immutability` | 16 |

The OOS files contribute parse errors, unused variables and hook warnings, not
just style noise. Examples:

- `SharedTaskShell.jsx`: `STATUS_COLORS` is declared twice; ESLint stops at the
  parse error.
- `OosTaskView.jsx`: six errors, including unused `useMemo`, `viewDefinition`
  and `onAction`.
- `OosAffectedAsinsGrid.jsx`: `Unexpected token }`.
- `OosSourceUploader.jsx`: `Unexpected token <`.
- `OosExportPanel.jsx`: `Unexpected token >`.
- `OosFollowupsTab.jsx`, `OosReviewTab.jsx`, `OosOverviewTab.jsx`: unused auth
  and permission values plus hook dependency warnings.

These findings are broader than the audit's named examples. Phase 1 must treat
all OOS child components as in scope, not only `SharedTaskShell.jsx`,
`OosTaskView.jsx` and `OosAffectedAsinsGrid.jsx`.

### 3.2 Frontend typecheck

```text
npm run typecheck
exit 1
16 errors
```

The errors are in dashboard-v2 TypeScript files (`DataVisualizationCharts.tsx`
and `useDashboardData.ts`), not in the OOS JSX files. The orphaned OOS modules
are JavaScript/JSX and are not reached by `tsc`, so typecheck is not evidence
that the OOS view is sound.

### 3.3 Frontend build

```text
npm run build
exit 0
10,121 modules transformed
```

The build passes because the OOS shell and view are orphaned. A green build is
therefore **not** evidence that the specialized UI compiles, registers or
renders.

### 3.4 Orphan-import smoke test

A test-only harness was added at `scripts/oos-import-smoke.mjs` and exposed as:

```text
npm run test:oos-imports
```

It asks Vite to transform the three OOS entry points and every local module they
import. It does not mount React and does not require a browser. The pre-fix result
was:

```text
Transformed 10 local module(s); 8 failure(s).
exit 1
```

| Module | Pre-fix failure |
|---|---|
| `SharedTaskShell.jsx` | `[PARSE_ERROR] Expected corresponding JSX closing tag for 'div'.` |
| `OosTaskView.jsx` | Cannot resolve `../../../../../contexts/AuthContext`. |
| `OosAffectedAsinsGrid.jsx` | `[PARSE_ERROR] Unexpected token`. |
| `OosSourceUploader.jsx` | `[PARSE_ERROR] Expected '>' but found '<'`. |
| `OosExportPanel.jsx` | `[PARSE_ERROR] Unexpected token >`. |
| `OosFollowupsTab.jsx` | Cannot resolve `../../../../../../contexts/AuthContext`. |
| `OosReviewTab.jsx` | Cannot resolve `../../../../../../contexts/AuthContext`. |
| `OosOverviewTab.jsx` | Cannot resolve `../../../../../../contexts/AuthContext`. |

After the Phase 1 repairs the same harness passes:

```text
Transformed 18 local module(s); 0 failure(s).
OOS import smoke test passed.
exit 0
```

The harness still must be wired into CI after those tasks pass; that part of
OOS-003 is still open.

### 3.5 Backend tests

The package script is not portable to this Windows checkout:

```text
cd backend
npm test
# node --experimental-vm-modules node_modules/.bin/jest ...
# SyntaxError in the POSIX .bin/jest shim
```

Running Jest directly gives a usable baseline:

```text
cd backend
$env:NODE_OPTIONS='--experimental-vm-modules'
npx jest --forceExit --detectOpenHandles --ci
```

Result:

```text
Test Suites: 5 failed, 38 passed, 43 total
Tests:       3 failed, 621 passed, 624 total
Time:        22.001 s
```

Failing suites:

| Suite | Reason |
|---|---|
| `__tests__/unit/oosServices.test.js` | Syntax error at line 12; malformed `jest.mock(...)` call, so no OOS service test runs. |
| `__tests__/unit/recurrenceService.test.js` | Timezone-dependent expectation: expected `0`, received `30`. |
| `__tests__/unit/authRefreshTokenContract.test.js` | Refresh-token call argument mismatch. |
| `__tests__/unit/nvidiaAiService.test.js` | `NVIDIA_NIM_API_KEY not configured`. |
| `__tests__/__mocks__/services/liveDataSyncService.js` | Jest treats the mock helper as a suite; it contains no tests. |

The OOS service syntax error is a new baseline finding. Repairing the test
harness belongs to OOS-030 and must happen before any backend OOS result is
trusted. The other four failures are pre-existing or environment-dependent and
must be classified separately from OOS defects.

### 3.6 Migrations and database restore

No migration command was run. `backend/scripts/runMigrations.js` applies
migrations to the database configured in `backend/.env`; it has no dry-run mode.
That database is production, so the dry run remains blocked until a disposable
restore exists.

An isolated local database was attempted without touching production:

```text
target database: RetailOps_OOS_Phase0_20261027
result: Failed to connect to 127.0.0.1:1433 - Could not connect (sequence)
Docker daemon: not running
```

The local SQL Server and Docker daemon are both stopped. Starting a shared local
instance is an environment decision, not a baseline action, so no container was
started and no credentials were changed.

The corrected production endpoint was then checked read-only:

```text
host: 31.97.62.95
port: 1433
TCP result: succeeded
mode: SELECT only, application name RetailOps-OOS-Phase0-ReadOnly
```

The configured SQL login has `sysadmin`; the login name and password are not
recorded. No write was made during the read-only check. After the check, the
user approved exception `EX-001`, which changed only `OOS-RECON-001.IsActive`
from `1` to `0` and its `UpdatedAt`; no migration, seed, assignment, upload or
provider call was made. Full evidence is in the
[production read-only snapshot](./OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md).

Production findings that change the baseline:

| Item | Observed |
|---|---|
| `OOS-RECON-001` template | **Active at capture**, not inactive as the source audit assumed; deactivated after capture under `EX-001` |
| OOS schedule | `DAILY`, Monday-Saturday, `AutoAssign` disabled; next run was `2026-10-27T08:51:23Z`; recurrence log has three `CREATED` rows |
| OOS containment | `EX-001` set `IsActive = 0` at `2026-10-27T01:02:06.840Z`, before the deadline; `NextScheduledDate`, `LastGeneratedAt`, instances, runs, bindings and decisions were not changed |
| OOS instances | 7: 6 `DRAFT`, 1 `ASSIGNED`; no completed or cancelled; unchanged by `EX-001` |
| Populated instance | `TASK-OOS-MVOUYS8Z`, `DRAFT`, unassigned, no seller, 188 bindings |
| Assigned OOS instance | `TASK-0006`, 0 bindings |
| `OosRuns` | 188, all `RECONCILED`; 188 sellers; 187 `amazon.in`, 1 `ajio` |
| `OosTaskBindings` | 188; **0** join to `OosRuns` on `OosRunId` |
| `OosDecisions` | 44,223, all `INSUFFICIENT_EVIDENCE`; 43,942 ASINs |
| Imports / observations | 0 / 0 |
| `DLY-004` | Active and unchanged; 17 `ASSIGNED` open instances due `2026-10-27T06:30:00Z` |
| Applied OOS migrations | 032, 033, 034 only; 035-039 absent |
| OOS view definition | `OOS_RECON_V1` version 1, `PUBLISHED` |

The OOS recurrence was stopped at `2026-10-27T01:02:06.840Z`, before the
`2026-10-27T08:51:23Z` deadline. The scheduler filters `IsActive = 1`, so the
inactive template is excluded. A post-deadline check is still required to
confirm that no new OOS instance was created and that `DLY-004` remains at 17
open instances. The independent `DLY-004` schedule was not changed.

The 188 bindings are consistent with `backend/scripts/setup-fresh-oos-run.js`
using one generated value for `OosRuns.Id` and a different `runId` for
`OosTaskBindings.OosRunId`. That script must not be run against production again.
The orphan rows and all 44,223 decisions must be preserved until a restored copy
and an approved repair plan exist.

No backup was restored and no migration dry run was executed. The following G0
evidence is still missing:

- A restored isolated copy and restore report.
- Migration forward/rollback rehearsal against that copy.
- `DLY-004` structural comparison against the pre-change baseline.
- Confirmation that a proposed orphan-binding repair is deterministic and safe.

Read-only production queries are not a substitute for a restore. Do not use
production for writes, migrations, seeds, backfills or data correction.

## 4. Plan corrections discovered during baseline

| Item | Correction |
|---|---|
| Task page paths | The active pages are `src/modules/tasks/pages/TaskInstancesPage.jsx` and `src/modules/tasks/pages/MyDayPage.jsx`, not `src/pages/...`. OOS-044 and the plan's inventory table were corrected. |
| OOS child scope | Parse and import defects exist in `OosSourceUploader`, `OosExportPanel`, `OosFollowupsTab`, `OosReviewTab` and `OosOverviewTab`, not only the files named in the audit. OOS-006 already owns the child directory; its acceptance should be read literally. |
| Backend OOS tests | `backend/__tests__/unit/oosServices.test.js` does not parse. OOS-030 must repair it before adding new cases. |
| CI test step | The root `package.json` has no `test` script, yet `.github/workflows/ci.yml` invokes `npm run test`. Correct this under the CI task, not by adding an unrelated test runner. |
| Production OOS state | The source audit assumed `OOS-RECON-001` was inactive. The read-only check found it active with 7 instances, 188 runs and 188 orphan bindings; it was later deactivated under `EX-001` to stop recurrence. `DB-01` records the orphan state as a P0 finding; OOS-002 and OOS-017 cover inventory and repair rehearsal. |

## 5. G0 exit checklist

| Exit criterion | Status | Evidence |
|---|---|---|
| CI failure explained by a specific command and error | Partial | Local reproductions exist; run `40304737266` logs are not captured. |
| Hidden frontend defects reproduced by an import test | Yes | 8 failures across 10 modules. |
| Production OOS state captured read-only | Yes | [Production read-only snapshot](./OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md). |
| A restorable backup exists and has been restored once | No | No backup or isolated target available. |
| `DLY-004` confirmed present and active | Yes | Read-only snapshot: 17 assigned open instances. |
| `DLY-004` structurally unchanged in a restored copy | No | Blocked by restore. |
| Production OOS containment approved and recurrence stopped | Yes | `EX-001` set `IsActive = 0` at `2026-10-27T01:02:06.840Z`; post-deadline instance-count check still pending. |
| Orphan repair approved | No | 188 orphan bindings and 44,223 decisions require an approved plan; no in-place repair is authorized. |
| No application behavior changed during Phase 0 | Yes | Only docs and a test script at baseline capture; the Phase 1 frontend delta is recorded in section 7. |

G0 remains **not passed**: restore, migration rehearsal, structural DLY-004
comparison, the CI log and the post-deadline OOS containment check are still
outstanding.

## 6. Blocking inputs needed

1. Authenticated access to run `40304737266`, or a pasted redacted log.
2. A running disposable SQL Server and a recent production backup.
3. Written confirmation of the restore target and permission to read production
   backup media. The local SQL Server at `127.0.0.1:1433` and the Docker daemon
   are currently stopped.
4. Owners for data/database and DevOps work.
5. Decisions D1-D10 before the phases that depend on them.
6. An approved orphan-repair decision for the 188 production `OosTaskBindings`
   and 44,223 decisions found in the read-only snapshot. Containment is complete;
   repair is not authorized.
7. **Completed:** written approval to stop the OOS recurrence before
   `2026-10-27T08:51:23Z` was recorded as `EX-001`; the template was deactivated
   at `2026-10-27T01:02:06.840Z` without changing the `DLY-004` schedule.

Until items 1-3 are supplied, Phase 0 can only be marked **partially complete**.
Do not start production-facing cutover work from this baseline.

## 7. Phase 1 local implementation record (2026-10-27)

Phase 1 source repairs are on `feat/oos-recon-001-remediation` only. Nothing in
this section is merged to `main`, deployed, or applied to production.

| Check | Local result |
|---|---|
| Import smoke | `Transformed 18 local module(s); 0 failure(s).` |
| Targeted ESLint | 0 errors across the changed source and new test files |
| Combined suite | `npm run test:oos` runs smoke, 10 registry tests and 4 browser tests |
| Production build | `10,131 modules transformed`; exit 0 |
| Registry tests | 10 Node tests pass |
| Browser render tests | 4 pass: shell fallback, shell OOS resolution, OOS view, grid groups |

Discoveries made during Phase 1:

| Item | Action |
|---|---|
| `SharedTaskShell` imported `calculateHealth` and `STATUS_COLORS` from `constants`, which exports neither. The transform-only smoke test cannot detect missing named exports. | Fixed by importing `calculateHealth` from `utils/taskHealth` and defining the existing status colour map locally. The browser render harness now catches this class of defect. |
| `src/modules/tasks/services/tasksApi.js` contains repeated object keys such as `getTaskView`, `getOosContext`, `getOosRuns`, `getAffectedAsins`, `buildExport`, `listExports` and `getSellers`. Later definitions win, so behaviour is currently stable, but the duplicates are a maintenance hazard. | Recorded for the API cleanup/refactor task; no behaviour change was made. |
| `OosTaskView` keeps `activeRun` when the seller changes and passes that run ID to `getOosContext(..., sellerId)`; `OosOverviewTab` and `OosSourceUploader` also format the run ID as a date. | Functional/data-contract defects, not compile defects; tracked under OOS-016 (Phase 4) and the run/upload work in OOS-017 to OOS-022. |
| The active `TaskInstancesPage` and `MyDayPage` still mount `TaskWorkspace`. `SharedTaskShell` and the boot-registered OOS view are therefore not user-visible yet. | Expected and unchanged; the cutover belongs to OOS-044 in Phase 8 behind the D10 flag decision. |

G1 remains **Open**: CI does not yet run the smoke, registry or browser tests,
and the repository-wide lint baseline still has pre-existing errors. G0 remains
**Open** for the reasons recorded in section 5.
