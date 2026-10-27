# OOS-RECON-001 G0/G1 unblock kit

**Prepared:** 2026-10-27T07:33Z (13:03 IST)<br>
**Branch:** `feat/oos-recon-001-remediation`; Phase 1 code at `17fd277`, with this kit as a docs-only follow-up<br>
**Base:** `main` at `316729a`<br>
**Status:** G0 and G1 remain **Open**. This is a runbook, not a gate sign-off.<br>
**Scope:** read-only checks, CI evidence capture, disposable-database rehearsal and decision preparation. It authorizes no production write, migration, seed, provider call or orphan repair.

> **Do not use this kit to change production.** The only approved production
> write remains `EX-001`, which set `OOS-RECON-001.IsActive = 0`. The template,
> its 7 instances, 188 runs, 188 orphan bindings and 44,223 decisions are
> evidence. `DLY-004` must not be modified, deactivated, overwritten or reseeded.

---

## 1. What is actually blocked

| Item | Current state | What is needed to close it |
|---|---|---|
| G1 local suite | Passes: 18-module import smoke, 10 registry tests, 4 browser tests, build | Nothing; keep as supporting evidence |
| G1 CI run | `.github/workflows/oos-regression.yml` is pushed; first run is not captured | GitHub Actions run log or authenticated access |
| G1 lint scope | Phase 1 touched files have 0 ESLint errors; repo-wide lint has 800 findings | Eng lead records whether G1 is OOS-scoped or repo-wide |
| G1 pre-fix proof | Tests pass on the fixed branch; no captured failure on the pre-fix source | Run the test overlay against `316729a` and capture failures |
| G0 post-deadline containment | OOS deactivated at `2026-10-27T01:02:06.840Z`; deadline is `2026-10-27T08:51:23.570Z` | Read-only SQL after the deadline |
| G0 restore | No production backup, no disposable SQL Server | Backup file, isolated SQL Server, restore report |
| G0 migration rehearsal | Migrations 035-039 do not exist yet; 032-034 are applied in production | Restored copy; 035-039 when implemented |
| G0 DLY-004 structural comparison | Production presence only | Restored baseline and post-rehearsal comparison |
| Orphan repair | 188 orphans preserved; repair unauthorized | Approved OOS-017 plan and a restored-copy rehearsal |
| D1-D10 | All open | Written owner decisions; see [decision brief](./OOS_RECON_001_DECISION_BRIEF.md) |

No production credential is stored in this repository or this document. The
local `backend/.env` points at `127.0.0.1`, not production.

---

## 2. G1 - close the compile/register/test gate

### 2.1 Local evidence to re-run

Run from the repository root on the remediation branch:

```powershell
npm ci
npm run test:oos-imports
npm run test:task-registry
npm run test:oos
npm run build
```

Expected:

| Command | Expected result |
|---|---|
| `npm run test:oos-imports` | `Transformed 18 local module(s); 0 failure(s).` |
| `npm run test:task-registry` | 10 tests pass |
| `npm run test:oos` | Smoke, 10 registry tests and 4 Playwright tests pass |
| `npm run build` | Exit 0; 10,131 modules transformed |

Targeted lint for the Phase 1 delta:

```powershell
$files = git diff --name-only 316729a..HEAD -- "*.js" "*.jsx" "*.ts" "*.tsx" |
  Where-Object { Test-Path $_ }
npx eslint $files --max-warnings=0
```

Expected: 0 errors and 0 warnings.

Local runs used Node `v24.19.0`/npm `11.17.0`; the workflows use Node 20. The
first green CI run is the Node 20 proof, so do not substitute local output for it.

### 2.2 Capture the `OOS Regression` run

Open the workflow run for `17fd277` or a later commit:

```text
https://github.com/Brandcentral-Pvt/RetailOps/actions/workflows/oos-regression.yml
```

Capture, in the task or a redacted text file:

- Run ID, head SHA, event and branch.
- Job conclusion and each step conclusion.
- The `Run OOS regression suite` log, including the 18-module line, 10 registry
  tests and 4 browser tests.
- Any downloaded Playwright artifact from `test-results/`.

If `gh` is available and authenticated:

```powershell
gh run list --workflow "OOS Regression" --branch feat/oos-recon-001-remediation --limit 5
gh run view <run-id> --log
gh run download <run-id> --dir "$env:TEMP\oos-regression-artifacts"
```

`gh` is not installed in the current environment. Do not install it or paste a
token into the repository just to satisfy this step; either authenticate on the
machine or capture the run from the GitHub UI. If a token is used, keep it in the
OS credential store or a process environment variable and never in a committed
file, command transcript or task comment.

### 2.3 Capture the old failing CI run for G0

The original failure is run `40304737266` for `316729a`. Capture:

```text
https://github.com/Brandcentral-Pvt/RetailOps/actions/runs/40304737266
```

Required excerpt for OOS-001:

- Pre-deploy validation: the failing command and first error.
- Deploy to VPS: skipped.
- Rollback on Failure: failed (and why).
- Deployment Summary: summary job only, not a deployment proof.

### 2.4 Prove the tests fail on the pre-fix source

The test overlay was added with the fixes, so the parent commit does not contain
the harness. Use a throwaway worktree, overlay only the test files, and capture
the failure. Do not commit the worktree or change `main`.

```powershell
git worktree add ..\RetailOps-oos-prefix 316729a
$target = "..\RetailOps-oos-prefix"
Copy-Item scripts/oos-import-smoke.mjs "$target\scripts\" -Force
Copy-Item "tests\*" "$target\tests\" -Recurse -Force
Copy-Item src/modules/tasks/view-registry/__tests__ "$target\src\modules\tasks\view-registry\__tests__" -Recurse -Force
Copy-Item playwright.config.js "$target\playwright.config.js" -Force
New-Item -ItemType Junction -Path "$target\node_modules" -Target (Resolve-Path .\node_modules).Path

Push-Location $target
node scripts/oos-import-smoke.mjs
node --test src/modules/tasks/view-registry/__tests__/taskViewRegistry.test.js
npx playwright test tests/shell-render.spec.js tests/oos-view-render.spec.js tests/oos-grid-render.spec.js
Pop-Location
```

Expected pre-fix evidence: the smoke harness reports failures in
`SharedTaskShell`, `OosTaskView`, `OosAffectedAsinsGrid` and the OOS child
imports; at least one registry or browser check fails. Preserve the output.

Clean up:

```powershell
git worktree remove ..\RetailOps-oos-prefix --force
git worktree prune
```

If the gate strictly requires a **CI** failure on the pre-fix source, record that
as a scope gap. The current workflow only runs on `main`, `develop` and the
remediation branch. A temporary proof job can be added under OOS-051; do not
push broken source to `main` or open a production deploy to obtain the proof.

### 2.5 Decide the G1 lint scope

The literal gate text says "lint clean". The repository is not lint-clean
independent of Phase 1:

| Measurement | Result |
|---|---|
| Pre-Phase 1 `npm run lint` | 817 errors, 30 warnings, 142 files |
| Post-Phase 1 `npm run lint` | 771 errors, 29 warnings, 800 total, 131 files |
| Phase 1 reduction | 47 findings removed |
| Top post-Phase 1 rule | `no-dupe-keys` 386 |
| Next rules | `no-unused-vars` 166; `react-hooks/set-state-in-effect` 91; `react-hooks/exhaustive-deps` 29; `no-undef` 26 |
| `npm run typecheck` | 16 pre-existing errors in `dashboard-v2` TypeScript |

The 386 duplicate keys are concentrated in
`src/modules/tasks/services/tasksApi.js`; later definitions currently win, so the
duplicates are a maintenance and contract hazard rather than a compile break.
The 16 type errors are in dashboard-v2/watermelon files, not in OOS JSX.

Choose one and record it in the plan before marking G1:

**Option A - OOS-scoped G1 (recommended).** G1 passes on the dedicated
`OOS Regression` job plus targeted ESLint for the Phase 1 delta. Repo-wide lint
and typecheck remain pre-existing debt under OOS-051 (G8), with the measured
baseline above. This keeps unrelated dashboard and API-client cleanup out of the
OOS compile gate.

**Option B - literal repo-wide G1.** Do not mark G1 until `npm run lint` and
`npm run typecheck` both exit 0. Start with the 386 duplicate keys in
`tasksApi.js`, then the 414 remaining lint findings and 16 TypeScript errors.
This is a broad, behavior-preserving cleanup and should have its own reviewed
change, not be bundled with Phase 1.

**Option C - split gate.** Record G1a (OOS compile/register/tests) and G1b
(repo-wide quality gates) separately; G1a can pass on the dedicated job, G1b
must pass before G8. This is Option A with clearer evidence labels.

Recommended wording for Option A/C:

> G1 lint scope is the Phase 1 source and test delta. `npx eslint` on that delta
> exits 0. The repository-wide lint/typecheck baseline is recorded in the Phase 0
> baseline and is owned by OOS-051; it is not evidence that the OOS view fails to
> compile.

Do not silently redefine the gate. The Eng lead must record the choice, and the
plan's gate table, baseline and backlog must agree.

### 2.6 Closing G1

When the run is green and the lint scope is recorded:

- Mark OOS-003 Done, including the 18-module CI output.
- Mark OOS-010 Done, including the pre-fix failure and the green run.
- Update the plan gate table and the baseline Phase 1 record from "first run
  pending" to the run ID/URL and conclusion.
- Keep G1 Open if the run is missing, failed, or the lint scope is unsigned.

If the run fails, capture the first failing step before changing code. Triage in
this order: `npm ci`/lockfile, Chromium install, Vite dev server start, import
smoke, registry test, browser render. Do not "fix" a CI failure by deleting a
test or weakening an assertion.

---

## 3. G0 - post-deadline containment check

### 3.1 Preconditions

- Current UTC is after `2026-10-27T08:51:23.570Z`.
- You have a read-only production login, or explicit approval to run `SELECT`
  statements with the existing login.
- You use `sqlcmd`, `Invoke-Sqlcmd` or a standalone `mssql` client.
- You do **not** use `backend/database/db.js`: its `getPool()` calls `initUdf()`,
  which can `CREATE` or `ALTER dbo.GetEnvDate()`. That is a write even when the
  rest of the script is read-only.
- You do not put the password on the command line, in this document or in git.

### 3.2 Run the read-only checks

```powershell
sqlcmd -S "31.97.62.95,1433" -d retailops -U "<readonly-login>" -C -b `
  -i docs/engineering/sql/oos_readonly_checks.sql `
  -o "$env:TEMP\oos-containment-20261027.txt" -W -s "|"
```

Omit `-P` so the client prompts for the password. If `sqlcmd` is unavailable,
use an equivalent client with the same SQL file and a read-only login. The file
contains only `SELECT` statements and `DECLARE` variables.

### 3.3 Required result

| Check | Expected |
|---|---|
| `OOS-RECON-001.IsActive` | `0` |
| OOS instances | 7 total: 6 `DRAFT`, 1 `ASSIGNED`, 0 closed |
| OOS recurrence rows | 3; none on or after `2026-10-27` |
| `NextScheduledDate` | `2026-10-27T08:51:23.570` retained |
| `LastGeneratedAt` | `2026-10-26T10:30:00.005` |
| `DLY-004.IsActive` | `1` |
| DLY-004 `ASSIGNED` instances | 17 |
| `DLY-004.UpdatedAt` | `2026-09-30T11:24:58.300` |
| `OosRuns` | 188, all `RECONCILED` |
| `OosTaskBindings` | 188 |
| Bindings joining `OosRuns` | 0 (all 188 orphaned) |
| `OosDecisions` | 44,223 across 43,942 ASINs |
| Imports / observations | 0 / 0 |

The summary result set at the end of the SQL file reports `PASS`/`FAIL` for the
key counts. A single `FAIL` is a stop condition.

On a restored copy, run sections 0-8 and compare them with the backup timestamp.
The section 9 summary is anchored to post-`EX-001` production: a backup taken
before `2026-10-27T01:02:06.840Z` is expected to show `OosTemplateInactive = FAIL`
because the backup still has the template active. Do not "repair" the restored
copy to make that line pass.

### 3.4 If a check fails

Do not write, repair, reseed or reactivate anything to make it pass. Preserve the
full output, record the observed values and escalate to the Eng lead and Data/DB
owner. A new OOS instance means the scheduler did not honour `IsActive = 0`; a
changed `DLY-004` count means an independent regression. Both require a new
investigation and, for any production change, a new written exception.

Record the output in the production snapshot or a linked evidence file, with
seller names/ASINs redacted if any appear. The provided SQL returns aggregate
counts and dates only.

---

## 4. G0 - restore and migration rehearsal

### 4.1 Prerequisites

Do not start until all of these are true:

- A recent production backup file exists, with its date, size and SHA-256.
- The backup can be verified with `RESTORE VERIFYONLY`.
- An isolated SQL Server 2022 instance is running, reachable only on localhost.
- The target database is a **new** name, not `retailops` and not a production
  instance.
- Disk space is sufficient for the backup, data, log and at least two restored
  copies (baseline and migration target).
- The Data/DB owner has confirmed the restore target in writing.
- The backup predates any change being evaluated. If it does not, record that
  limitation; do not call the comparison a pre-change baseline.

The local `127.0.0.1:1433` SQL Server and Docker daemon were both stopped at the
last check. Starting a shared local instance is an environment decision. The
committed `docker-compose.db.yml` contains a sample SA password and binds port
1433 on all interfaces; do not reuse that password or expose the port publicly.
Prefer an ad-hoc container bound to `127.0.0.1` with a unique local-only password,
or a dedicated local SQL Server instance.

### 4.2 Verify and restore the backup

Run these against the disposable instance only. Replace placeholders with the
values from `RESTORE FILELISTONLY`; do not guess logical file names.

```sql
RESTORE VERIFYONLY
FROM DISK = N'<backup-path>'
WITH CHECKSUM;

RESTORE HEADERONLY
FROM DISK = N'<backup-path>';

RESTORE FILELISTONLY
FROM DISK = N'<backup-path>';
```

Restore to a new database:

```sql
RESTORE DATABASE [RetailOps_OOS_G0_Baseline_20261027]
FROM DISK = N'<backup-path>'
WITH
  MOVE N'<logical-data-name>' TO N'<data-path>\RetailOps_OOS_G0_Baseline_20261027.mdf',
  MOVE N'<logical-log-name>'  TO N'<log-path>\RetailOps_OOS_G0_Baseline_20261027_log.ldf',
  RECOVERY,
  STATS = 10;
```

Do not use `WITH REPLACE` for this new database. If the name already exists,
choose a new name; do not drop a database on a shared instance to make room.

Create a second copy for migration rehearsal, either by restoring the backup
again or by taking a copy of the baseline database through the approved
disposable-instance method. Name it `RetailOps_OOS_G0_Migration_20261027`.

### 4.3 Validate the restore

Run the read-only checks against the baseline copy:

```powershell
sqlcmd -S "127.0.0.1,1433" -d "RetailOps_OOS_G0_Baseline_20261027" `
  -U "<local-login>" -C -b `
  -i docs/engineering/sql/oos_readonly_checks.sql `
  -o "$env:TEMP\oos-g0-baseline.txt" -W -s "|"
```

Compare with the production snapshot:

| Anchor | Production baseline |
|---|---|
| OOS instances | 7 (6 `DRAFT`, 1 `ASSIGNED`) |
| OOS recurrence rows | 3 |
| OOS runs | 188, all `RECONCILED` |
| OOS bindings | 188, all orphaned |
| OOS decisions | 44,223 across 43,942 ASINs |
| Imports / observations | 0 / 0 |
| DLY-004 | Active; 17 `ASSIGNED`; `UpdatedAt = 2026-09-30T11:24:58.300` |
| Applied migrations | 032, 033, 034 only |
| View definitions | `OOS_RECON_V1` v1 and `STANDARD_V1` v1, both `PUBLISHED` |

Record exact differences. A restore that is newer than the snapshot may legitimately
have different counts; state that explicitly instead of treating the snapshot as
immutable truth.

### 4.4 Capture the DLY-004 structural anchors

Run section 8 of `oos_readonly_checks.sql` against the baseline copy **before**
any migration. Record:

- Template fields: `IsActive`, `Frequency`, `RunDays`, `DueTime`, `AutoAssign`,
  `AutoAssignEnabled`, reviewer/assignee fields, `LastGeneratedAt`,
  `NextScheduledDate`, `UpdatedAt`.
- Instance count, status distribution, due-date range and distinct assignees.
- `PemsTaskBrands` row count and distinct seller count for DLY-004 instances.
- `PemsAssignmentRules` row count for DLY-004.
- Published view definition.

Then run the same queries against the migration copy after the rehearsal. The
two outputs must match. Do not run
`backend/scripts/restore-dly004.js`: it writes the template and deletes an
assignment-rules row. It is not a G0 comparison tool and must not be used on
production; on a disposable copy it still requires a separate approval.

If the available backup was taken after the earlier DLY-004 pilot edit, the
comparison proves only that the rehearsal did not change DLY-004 relative to that
backup. It does not prove the row matches the importer original. Record that
limitation and obtain a pre-change backup before claiming the stronger result.

### 4.5 Migration rehearsal

Migrations 035-039 are proposed, not implemented. Do not create placeholder
migrations or apply nonexistent files to satisfy G0. The current rehearsal has
two parts:

1. **Runner idempotency.** Against the migration copy, run:

   ```powershell
   $env:DB_SERVER = "127.0.0.1"
   $env:DB_PORT = "1433"
   $env:DB_NAME = "RetailOps_OOS_G0_Migration_20261027"
   $env:DB_USER = "<local-login>"
   $env:DB_PASSWORD = "<local-password>"
   $env:DB_ENCRYPT = "true"
   $env:DB_TRUST_SERVER_CERT = "true"
   node backend/scripts/runMigrations.js --quiet
   ```

   `backend/database/db.js` loads `backend/.env`, but dotenv does not override
   variables already set in the process. Confirm the target database in the
   runner output before trusting it. Never run this against production.

   Expected: pending existing migrations apply in order; a second run reports
   `0 applied` and skips everything. Any failure stops the run; capture the file
   and error.

2. **035-039 forward/rollback.** Blocked until the migrations and their rollback
   scripts exist. When they do, apply them only to the migration copy, capture
   `SchemaMigrations`, table/index/constraint changes and row counts, then exercise
   the paired rollback and re-run the checks. The runner has no built-in down
   migration; rollback must be a reviewed script or a restore from the baseline
   copy.

Do not use production as the migration target, even for an "idempotent" or
"dry-run" flag. The runner has no dry-run mode.

### 4.6 Orphan repair rehearsal

Still unauthorized. When OOS-017 is approved, rehearse on the restored copy:

- Inventory the 188 bindings and their `OosRunId` values.
- Prove the deterministic mapping from each binding to a real run, or classify
  it as unrepairable without inventing a run.
- Preserve the original rows in an archive table before any update/delete.
- Run inside a transaction; capture before/after counts and join results.
- Verify all 44,223 decisions remain queryable and no decision is silently
  reassigned.
- Re-run the containment checks and DLY-004 anchors after the rehearsal.

Do not run `backend/scripts/setup-fresh-oos-run.js` against production. It is the
known source of the split run ID. On a disposable copy, run it only as part of an
approved OOS-017 experiment with a transaction and cleanup plan; do not use it to
"fix" the existing rows.

---

## 5. Decision D1-D10

The recommendations and signature table are in
[`OOS_RECON_001_DECISION_BRIEF.md`](./OOS_RECON_001_DECISION_BRIEF.md). The
minimum unblock order is:

| Decision | Blocks | Needed before |
|---|---|---|
| D7 brandless access semantics | OOS-013 | Phase 2 |
| D6 upload limit and storage backend | OOS-018 | Phase 3 |
| D1 New ASIN definition | OOS-026 | Phase 4 |
| D2 GMS source/window/currency/denominator | OOS-026 | Phase 4 |
| D3 Vendor applicability and mapping | OOS-026 | Phase 4 |
| D5 export columns/retention/PII | OOS-035 | Phase 5/6 |
| D8 resync SLA and rate budget | OOS-032 | Phase 5 |
| D4 reviewer independence | OOS-040 | Phase 6/7 |
| D9 incident waiver authority | OOS-042 | Phase 6/7 |
| D10 cutover mode/pilot/fallback | OOS-044 | Phase 8 |

Until a decision is recorded, do not create, assign or expose more OOS work and
do not activate the dependent phase. Production remains contained.

---

## 6. Evidence register

Copy this into the task or release record and fill it only with verified output.

### G1

| Field | Value |
|---|---|
| Branch / head SHA | |
| `npm run test:oos` local result | |
| Build modules / exit | |
| Targeted ESLint result | |
| `OOS Regression` run ID / URL | |
| CI job conclusion | |
| Pre-fix failure captured | |
| Lint scope decision (A/B/C) | |
| Eng lead approval | |

### G0 containment

| Field | Value |
|---|---|
| Check UTC time | |
| SQL file version | |
| OOS `IsActive` | |
| OOS instances | |
| OOS recurrence rows / latest occurrence | |
| DLY-004 `IsActive` / assigned count / `UpdatedAt` | |
| Bindings / orphan bindings | |
| Runs / decisions | |
| Summary PASS/FAIL | |
| Output location (redacted) | |

### G0 restore

| Field | Value |
|---|---|
| Backup file / date / SHA-256 | |
| `RESTORE VERIFYONLY` result | |
| Disposable server / database name | |
| Baseline restore result | |
| OOS anchors match | |
| DLY-004 anchors before / after | |
| Migration runner first / second run | |
| 035-039 forward/rollback result | |
| Orphan inventory result | |
| Limitations | |

---

## 7. Do not do these

- Do not mark G1 Passed on local tests alone, or without recording the lint-scope
  decision.
- Do not clear the 800 repo-wide lint findings as an unreviewed side effect of
  closing G1.
- Do not run `backend/database/db.js` against production for a "read-only" check;
  its connection initializer performs DDL.
- Do not run the migration runner against production.
- Do not run `setup-fresh-oos-run.js` against production.
- Do not run `restore-dly004.js` against production or treat it as a G0 check.
- Do not delete or rewrite the 188 orphan bindings or 44,223 decisions.
- Do not modify `DLY-004`.
- Do not reactivate, reseed or overwrite `OOS-RECON-001` without a new written
  exception and a restore plan.
- Do not paste credentials, tokens, seller names or ASIN-level data into the
  repository, task comments or this document.
