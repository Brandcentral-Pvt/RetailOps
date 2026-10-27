# OOS-RECON-001 Phase 0 baseline and safety record

**Date:** 2026-10-27<br>
**Branch:** `feat/oos-recon-001-remediation`<br>
**Base code SHA:** `316729a4dad3b8758135a44a62553c46620a0134` (`main`)<br>
**Branch start point:** `1955fde` (docs-only commits after the base code SHA)<br>
**Gate:** G0<br>
**Status:** In progress; G0 is not passed.

**Scope:** This record contains read-only diagnosis, a test-only import harness and
process controls. No application code, schema, migration, seed, template
activation, assignment or provider call was changed. `OOS-RECON-001` remains
inactive and `DLY-004` is untouched.

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
import. It does not mount React and does not require a browser. Current result:

```text
Transformed 10 local module(s); 8 failure(s).
exit 1
```

| Module | Current failure |
|---|---|
| `SharedTaskShell.jsx` | `[PARSE_ERROR] Expected corresponding JSX closing tag for 'div'.` |
| `OosTaskView.jsx` | Cannot resolve `../../../../../contexts/AuthContext`. |
| `OosAffectedAsinsGrid.jsx` | `[PARSE_ERROR] Unexpected token`. |
| `OosSourceUploader.jsx` | `[PARSE_ERROR] Expected '>' but found '<'`. |
| `OosExportPanel.jsx` | `[PARSE_ERROR] Unexpected token >`. |
| `OosFollowupsTab.jsx` | Cannot resolve `../../../../../../contexts/AuthContext`. |
| `OosReviewTab.jsx` | Cannot resolve `../../../../../../contexts/AuthContext`. |
| `OosOverviewTab.jsx` | Cannot resolve `../../../../../../contexts/AuthContext`. |

The harness is intentionally failing until OOS-005 through OOS-009 are complete.
It must be wired into CI after those tasks pass; that part of OOS-003 is still
open.

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
That database was treated as non-disposable. The plan requires a disposable
target, so the dry run remains blocked.

An isolated local database was attempted without touching the configured
database:

```text
target database: RetailOps_OOS_Phase0_20261027
result: Failed to connect to 127.0.0.1:1433 - Could not connect (sequence)
Docker daemon: not running
```

The local SQL Server and Docker daemon are both stopped. Starting a shared local
instance is an environment decision, not a baseline action, so no container was
started and no credentials were changed.

No backup was restored and no read-only SQL was executed. The following G0
evidence is therefore missing:

- OOS table row counts.
- Template, instance and assignment snapshots.
- `OOS-RECON-001` activation state in the restored copy.
- `DLY-004` presence, active state and structural comparison.
- Migration forward/rollback rehearsal against the restored copy.

Do not connect to the configured production database to fill these gaps.

## 4. Plan corrections discovered during baseline

| Item | Correction |
|---|---|
| Task page paths | The active pages are `src/modules/tasks/pages/TaskInstancesPage.jsx` and `src/modules/tasks/pages/MyDayPage.jsx`, not `src/pages/...`. OOS-044 and the plan's inventory table were corrected. |
| OOS child scope | Parse and import defects exist in `OosSourceUploader`, `OosExportPanel`, `OosFollowupsTab`, `OosReviewTab` and `OosOverviewTab`, not only the files named in the audit. OOS-006 already owns the child directory; its acceptance should be read literally. |
| Backend OOS tests | `backend/__tests__/unit/oosServices.test.js` does not parse. OOS-030 must repair it before adding new cases. |
| CI test step | The root `package.json` has no `test` script, yet `.github/workflows/ci.yml` invokes `npm run test`. Correct this under the CI task, not by adding an unrelated test runner. |

## 5. G0 exit checklist

| Exit criterion | Status | Evidence |
|---|---|---|
| CI failure explained by a specific command and error | Partial | Local reproductions exist; run `40304737266` logs are not captured. |
| Hidden frontend defects reproduced by an import test | Yes | 8 failures across 10 modules. |
| A restorable backup exists and has been restored once | No | No backup or isolated target available. |
| `DLY-004` confirmed present and unchanged in the restored copy | No | Blocked by restore. |
| No application behavior changed | Yes | Only docs and a test script; no app, schema or seed edits. |

## 6. Blocking inputs needed

1. Authenticated access to run `40304737266`, or a pasted redacted log.
2. A running disposable SQL Server and a recent production backup.
3. Written confirmation of the restore target and permission to read production
   backup media. The local SQL Server at `127.0.0.1:1433` and the Docker daemon
   are currently stopped.
4. Owners for data/database and DevOps work.
5. Decisions D1-D10 before the phases that depend on them.

Until items 1-3 are supplied, Phase 0 can only be marked **partially complete**.
Do not start production-facing cutover work from this baseline.
