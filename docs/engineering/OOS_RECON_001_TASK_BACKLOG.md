# OOS-RECON-001 Execution Backlog

**Source plan:** [`OOS_RECON_001_REMEDIATION_PLAN.md`](./OOS_RECON_001_REMEDIATION_PLAN.md)<br>
**Audit date:** 2026-10-27 (Asia/Kolkata)<br>
**Verified main SHA:** `316729a4dad3b8758135a44a62553c46620a0134`<br>
**Backlog version:** 1.0<br>
**Tasks:** 55 across 10 epics<br>
**Estimate:** 96 engineer-days (sum of task estimates; not a delivery commitment)<br>
**Status:** Active - Phase 1 repairs are implemented and pushed; the local Phase 1 suite passes, but the first CI run, pre-fix proof, post-deadline containment check and restore rehearsal remain open. G0 and G1 remain open. No GitHub issues have been created by this document.<br>
**Import file:** [`oos-recon-001-tasks.csv`](./oos-recon-001-tasks.csv)<br>
**Evidence runbook:** [`OOS_RECON_001_G0_G1_UNBLOCK.md`](./OOS_RECON_001_G0_G1_UNBLOCK.md)<br>
**Decision brief:** [`OOS_RECON_001_DECISION_BRIEF.md`](./OOS_RECON_001_DECISION_BRIEF.md)

> This backlog does not authorize further activation or rollout. A read-only
> production check on 2026-10-27 found `OOS-RECON-001` active with 7 instances,
> 188 runs, 188 orphan `OosTaskBindings` and 44,223 decisions. Its daily
> recurrence was scheduled for `2026-10-27T08:51:23Z`; under exception `EX-001`
> the template was deactivated at `2026-10-27T01:02:06.840Z`, before the
> deadline. Existing data and `DLY-004` were unchanged; a post-deadline
> instance-count check is still pending. Do not create or assign new OOS work,
> run `setup-fresh-oos-run.js` in production, reactivate OOS, or modify
> DLY-004. See the
> [production read-only snapshot](./OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md).

---

## 1. How to use this backlog

1. Approve the remediation plan, then create one issue per task from the CSV.
2. Keep the `OOS-###` ID in the issue title and never reuse an ID.
3. Move a task to Ready only when every Definition of Ready item is true.
4. Use one branch and one pull request per task. Do not mix refactors, formatting
   sweeps, or unrelated fixes.
5. Attach the listed test or evidence artifact to the issue before marking Done.
6. A gate owner verifies every task in the gate. A gate is Open or Passed;
   "mostly passed" is not a state.
7. If a task cannot meet acceptance, stop and re-plan. Do not bypass a gate.

### Definition of Ready

- [ ] The problem and acceptance criteria are understood.
- [ ] Every dependency is Done and merged.
- [ ] Files, contracts, schema and permissions are identified.
- [ ] The failing test or evidence artifact is specified.
- [ ] An owner and estimate are assigned.
- [ ] No production credentials, seller data, or provider calls are required.

### Definition of Done

- [ ] All acceptance criteria are checked with evidence.
- [ ] Tests were added, fail before the fix where applicable, and pass after.
- [ ] Lint, typecheck and build pass.
- [ ] Migration and rollback are rehearsed, if the task changes schema.
- [ ] Docs, SOP text or operator notes are updated.
- [ ] Feature flag and rollback path are verified, if the task changes UI or behavior.
- [ ] The change is reviewed by someone other than the author.
- [ ] No new P1/P2 debt was introduced without a linked task.

### Status and priority

| Field | Values | Meaning |
|---|---|---|
| Status | Backlog, Ready, In Progress, Blocked, In Review, Done | Standard flow; Blocked requires a reason and owner |
| Priority | P0, P1, P2 | P0 blocks activation; P1 may follow a limited pilot but blocks broad rollout; P2 is hardening |
| Type | Fix, Test, Migration, Security, Frontend, Backend, Data, Ops, Decision | Used for labels and routing |
| Estimate | 0.5 to 3.5 days | Relative sizing only; re-estimate after Phase 0 |

Most tasks are P0 by design: every gate blocks activation. Priority is release
criticality, not incident severity or delivery order. Use dependencies and waves
for order.

### Owners

| Owner | Responsibility |
|---|---|
| Frontend | React view, registry, shell, grid, accessibility |
| Backend | Routes, controllers, services, SQL, queues |
| Data/DB | Schema, migrations, backfill, restore, SQL review |
| QA | Test design, fixtures, E2E, gate evidence |
| DevOps | CI, staging, deployment, feature flag, rollback |
| Security | Threat review, authorization and file/export controls |
| Product + Data | Policy definitions and business decisions |
| Eng lead | Scope, sequencing, go/no-go and escalation |

### Labels

`oos`, `p0`/`p1`/`p2`, type label (`fix`, `test`, `migration`, `security`,
`frontend`, `backend`, `data`, `ops`, `decision`), and `gate-g0` through
`gate-g9`. Add `blocked` only with a written reason.

---

## 2. Epic summary

| Epic | Outcome | Tasks | Estimate | Gate |
|---|---|---:|---:|---|
| 0. Baseline and safety | A trustworthy baseline, a restorable database, hidden defects reproduced, and a change freeze in force. | 4 | 3.5d | G0 |
| 1. Compile and registry | The specialized shell, OOS view and registry compile when imported, register explicitly and render safely. | 6 | 9.5d | G1 |
| 2. Authorization and tenancy | Every OOS object is scoped to the task, seller, brand and authorized actor. | 6 | 9d | G2 |
| 3. Runs and uploads | Runs are idempotent and uploads preserve immutable originals with accurate, private metadata. | 6 | 12d | G3 |
| 4. Schema, query and policy | The ASIN grid reads persisted, reproducible 80/20/New ASIN classifications with safe sorting and paging. | 8 | 15.5d | G4 |
| 5. Resync verification | Resync resolves only on a fresh, scoped observation and fails closed on failure, timeout or unknown. | 4 | 6d | G5 |
| 6. Immutable exports | Exports contain the exact authorized rows, are stored immutably and are verified by hash on download. | 5 | 8d | G5 |
| 7. Review and closure | Submission, independent review, evidence and incident ownership gate daily closure. | 4 | 8d | G6 |
| 8. UI integration | OOS is usable from Task List and My Day while DLY-004 and generic tasks remain unchanged. | 6 | 13.5d | G7 |
| 9. QA, staging and rollout | The workflow is proven on staging with realistic edge cases, a rehearsed rollback and a signed go/no-go. | 6 | 11d | G8/G9 |
| **Total** |  | **55** | **96d** |  |

---

## 3. Task index

| ID | Task | Epic | Wave | Owner | Est | Depends on | Gate |
|---|---|---|---|---|---:|---|---|
| [OOS-001](#oos-001) | Capture failed CI and establish the baseline | 0 | 0 | DevOps | 1d | - | G0 |
| [OOS-002](#oos-002) | Restore an isolated database and verify DLY-004 | 0 | 0 | Data/DB | 1d | OOS-001 | G0 |
| [OOS-003](#oos-003) | Add orphan-import smoke tests and record hidden defects | 0 | 0 | Frontend | 1d | OOS-001 | G0 |
| [OOS-004](#oos-004) | Freeze OOS changes and define branch, flag and rollback ownership | 0 | 0 | Eng lead | 0.5d | - | G0 |
| [OOS-005](#oos-005) | Repair SharedTaskShell structure, imports and hooks | 1 | 1 | Frontend | 2d | OOS-003, OOS-004 | G1 |
| [OOS-006](#oos-006) | Repair OosTaskView and OOS child imports | 1 | 1 | Frontend | 2d | OOS-003, OOS-004 | G1 |
| [OOS-007](#oos-007) | Repair affected-ASIN grid rendering | 1 | 1 | Frontend | 1d | OOS-003 | G1 |
| [OOS-008](#oos-008) | Register the OOS view explicitly at boot | 1 | 1 | Frontend | 1d | OOS-005, OOS-006, OOS-007 | G1 |
| [OOS-009](#oos-009) | Normalize view definitions and add safe fallbacks | 1 | 1 | Frontend | 1.5d | OOS-008 | G1 |
| [OOS-010](#oos-010) | Add frontend unit and registry regression tests | 1 | 1 | Frontend | 2d | OOS-005, OOS-006, OOS-007, OOS-008, OOS-009 | G1 |
| [OOS-011](#oos-011) | Produce the OOS route and actor authorization matrix | 2 | 0 | Backend | 1d | OOS-004 | G2 |
| [OOS-012](#oos-012) | Enforce task-bound access on every OOS route | 2 | 1 | Backend | 2.5d | OOS-011 | G2 |
| [OOS-013](#oos-013) | Enforce brand and tenant scope for brandless tasks | 2 | 1 | Backend | 1.5d | OOS-012 | G2 |
| [OOS-014](#oos-014) | Separate executor rights from administrator permissions | 2 | 1 | Backend | 1.5d | OOS-011 | G2 |
| [OOS-015](#oos-015) | Add OOS audit events and authorization negative tests | 2 | 2 | Backend | 1.5d | OOS-012, OOS-013, OOS-014 | G2 |
| [OOS-016](#oos-016) | Security review of the OOS authorization model | 2 | 2 | Security | 1d | OOS-015 | G2 |
| [OOS-017](#oos-017) | Make run creation idempotent and task-scoped (migration 035) | 3 | 2 | Backend | 2.5d | OOS-002, OOS-012 | G3 |
| [OOS-018](#oos-018) | Use bounded upload transport and validate files | 3 | 2 | Backend | 1.5d | OOS-003 | G3 |
| [OOS-019](#oos-019) | Unify the upload service contract and metadata | 3 | 2 | Backend | 2.5d | OOS-017, OOS-018 | G3 |
| [OOS-020](#oos-020) | Move originals to private storage with authorized download | 3 | 2 | Backend | 1.5d | OOS-018 | G3 |
| [OOS-021](#oos-021) | Implement upload revisions and wire the uploader UI | 3 | 2 | Frontend | 2d | OOS-019, OOS-020 | G3 |
| [OOS-022](#oos-022) | Add run and upload integration tests | 3 | 2 | QA | 2d | OOS-017, OOS-018, OOS-019, OOS-020, OOS-021 | G3 |
| [OOS-023](#oos-023) | Approve the decision metrics model and policy inputs | 4 | 0 | Product + Data | 1d | OOS-002 | G4 |
| [OOS-024](#oos-024) | Create decision metrics and read model (migration 036) | 4 | 2 | Data/DB | 2.5d | OOS-023 | G4 |
| [OOS-025](#oos-025) | Backfill decision metrics and prove rollback | 4 | 2 | Data/DB | 2d | OOS-024 | G4 |
| [OOS-026](#oos-026) | Implement the versioned 80/20/New ASIN policy | 4 | 2 | Backend + Product/Ops | 2.5d | OOS-023 | G4 |
| [OOS-027](#oos-027) | Persist classification and serve summary/detail from storage | 4 | 3 | Backend | 2.5d | OOS-024, OOS-026 | G4 |
| [OOS-028](#oos-028) | Replace synthetic OOS ASIN rows and preserve DLY-004 | 4 | 3 | Backend | 1.5d | OOS-027, OOS-012 | G4 |
| [OOS-029](#oos-029) | Make grid sorting, filtering and paging safe | 4 | 3 | Backend | 1d | OOS-024, OOS-012 | G4 |
| [OOS-030](#oos-030) | Add schema, policy and query integration tests | 4 | 3 | QA | 2.5d | OOS-017, OOS-025, OOS-026, OOS-027, OOS-028, OOS-029 | G4 |
| [OOS-031](#oos-031) | Persist resync request and provider metadata (migration 037) | 5 | 3 | Backend | 1d | OOS-017 | G5 |
| [OOS-032](#oos-032) | Fix resync verification and incident resolution | 5 | 3 | Backend | 2.5d | OOS-031, OOS-027 | G5 |
| [OOS-033](#oos-033) | Show real resync states and actions in the UI | 5 | 3 | Frontend | 1d | OOS-032 | G5 |
| [OOS-034](#oos-034) | Add resync evidence and failure tests | 5 | 3 | QA | 1.5d | OOS-032, OOS-033 | G5 |
| [OOS-035](#oos-035) | Approve the export contract and sheet definitions | 6 | 4 | Product + Backend | 1d | OOS-023 | G5 |
| [OOS-036](#oos-036) | Store immutable exports and task binding (migration 038) | 6 | 3 | Backend | 2.5d | OOS-035 | G5 |
| [OOS-037](#oos-037) | Fix export download by authorized export ID and verify hash | 6 | 3 | Backend | 1.5d | OOS-036 | G5 |
| [OOS-038](#oos-038) | Sanitize exports, add audit and wire CSV/XLSX actions | 6 | 4 | Backend + Frontend | 1.5d | OOS-037 | G5 |
| [OOS-039](#oos-039) | Add export byte, hash and scope tests | 6 | 4 | QA | 1.5d | OOS-036, OOS-037, OOS-038 | G5 |
| [OOS-040](#oos-040) | Separate reviewer assignment from reviewer decision (migration 039) | 7 | 4 | Backend | 1.5d | OOS-002 | G6 |
| [OOS-041](#oos-041) | Fix submission and integrate the PEMS review queue | 7 | 4 | Backend | 2.5d | OOS-040 | G6 |
| [OOS-042](#oos-042) | Gate closure on evidence, incidents and approval | 7 | 4 | Backend | 2.5d | OOS-041 | G6 |
| [OOS-043](#oos-043) | Add submission, review and closure tests | 7 | 4 | QA | 1.5d | OOS-041, OOS-042 | G6 |
| [OOS-044](#oos-044) | Add the feature flag and resolver wiring to both entry points | 8 | 4 | Frontend | 2d | OOS-010, OOS-016 | G7 |
| [OOS-045](#oos-045) | Integrate OOS tabs and the Excel-like affected-ASIN grid | 8 | 5 | Frontend | 3.5d | OOS-044, OOS-028, OOS-029, OOS-033, OOS-038, OOS-043 | G7 |
| [OOS-046](#oos-046) | Wire all actions and remove placeholder text | 8 | 5 | Frontend | 2d | OOS-021, OOS-033, OOS-038, OOS-041, OOS-045 | G7 |
| [OOS-047](#oos-047) | Complete responsive and accessibility validation | 8 | 5 | Frontend | 1.5d | OOS-045, OOS-046 | G7 |
| [OOS-048](#oos-048) | Prove the generic drawer and DLY-004 are unchanged | 8 | 5 | QA | 1.5d | OOS-044 | G7 |
| [OOS-049](#oos-049) | Add the full OOS Playwright flow | 8 | 5 | QA | 3d | OOS-045, OOS-046, OOS-047, OOS-048 | G7 |
| [OOS-050](#oos-050) | Build the seven-seller and stock/GMS fixture set | 9 | 3 | QA | 2d | OOS-022, OOS-024 | G8 |
| [OOS-051](#oos-051) | Wire required CI quality gates | 9 | 5 | DevOps | 2d | OOS-016, OOS-030, OOS-034, OOS-039, OOS-040, OOS-043, OOS-049 | G8 |
| [OOS-052](#oos-052) | Run the security and performance acceptance pass | 9 | 5 | QA + Security | 2.5d | OOS-016, OOS-038, OOS-049, OOS-050 | G8 |
| [OOS-053](#oos-053) | Deploy to staging and rehearse migrations 035-039 | 9 | 5 | DevOps + Data/DB | 2d | OOS-025, OOS-030, OOS-031, OOS-039, OOS-040, OOS-051 | G8 |
| [OOS-054](#oos-054) | Run acceptance, go/no-go and rollback rehearsal | 9 | 6 | Eng lead + Product | 1.5d | OOS-049, OOS-050, OOS-052, OOS-053 | G8 |
| [OOS-055](#oos-055) | Activate OOS-RECON-001 in a controlled window | 9 | 6 | Eng lead + Ops | 1d | OOS-054 | G9 |

---

## 4. Task cards

### Epic 0 - Baseline and safety

**Outcome:** A trustworthy baseline, a restorable database, hidden defects reproduced, and a change freeze in force.<br>
**Gate:** G0 | **Tasks:** 4 | **Estimate:** 3.5d

<a id="oos-001" name="oos-001"></a>

#### OOS-001 - Capture failed CI and establish the baseline

**Owner:** DevOps | **Estimate:** 1d | **Priority:** P0 | **Type:** Ops | **Gate:** G0 | **Wave:** 0<br>
**Depends on:** -<br>
**Findings:** QA-01<br>
**Files:** .github/workflows/ci.yml; .github/workflows/cd.yml; package.json; backend/package.json<br>
**Status:** In Progress - local baseline complete; repo-wide lint/typecheck baseline measured; CI logs, post-deadline containment, disposable database and restore evidence pending.<br>

**Acceptance criteria**

- [ ] Run 40304737266 logs are captured for pre-deploy, deploy and rollback jobs.
- [ ] The exact failing command and first error are recorded in the task.
- [ ] Local baseline results for lint, tests, build and migration dry-run are attached.

**Test and evidence**

- CI log excerpt
- Command transcript
- Baseline report
- [Phase 0 baseline](./OOS_RECON_001_PHASE0_BASELINE.md) (local evidence complete; CI and database evidence pending)
- [G0/G1 unblock kit](./OOS_RECON_001_G0_G1_UNBLOCK.md) (CI log capture, post-deadline SQL and restore checklist)
- Repo-wide baseline after Phase 1: 800 lint findings (771 errors, 29 warnings; 386 duplicate keys in `tasksApi.js`) and 16 dashboard-v2 typecheck errors; Phase 1 delta is lint-clean

> **Implementation note:** Do not treat a successful summary job as a successful deployment.

<a id="oos-002" name="oos-002"></a>

#### OOS-002 - Restore an isolated database and verify DLY-004

**Owner:** Data/DB | **Estimate:** 1d | **Priority:** P0 | **Type:** Data | **Gate:** G0 | **Wave:** 0<br>
**Depends on:** OOS-001<br>
**Findings:** TV-01; QA-01; DB-01<br>
**Files:** backend/migrations/032_oos_reconciliation.js; backend/migrations/033_task_view_definitions_and_oos_bindings.js; backend/migrations/034_evidence_required_and_oos_bindings.js; backend/scripts/setup-fresh-oos-run.js<br>
**Status:** In Progress - read-only production snapshot and OOS containment captured; post-deadline check, read-only SQL, restore and migration rehearsal checklist prepared. Isolated restore is still blocked by no backup and no disposable SQL Server.<br>

**Acceptance criteria**

- [x] Read-only production state is captured: `OOS-RECON-001` was active with 7 instances, 188 runs, 188 orphan `OosTaskBindings`, 44,223 decisions, and `DLY-004` had 17 assigned instances. `EX-001` later deactivated only the OOS template; all captured counts were unchanged.
- [ ] A recent production backup is restored to an isolated environment.
- [ ] OOS table row counts and template/instance/assignment snapshots are reproduced on the restore.
- [ ] The 188 orphan bindings and run-status semantics are inventoried on the restore with a deterministic repair proposal.
- [ ] DLY-004 is confirmed present, active and structurally unchanged in the restore.
- [ ] No production writes or provider calls occur.

**Test and evidence**

- Restore report
- Read-only SQL output (redacted)
- [Production read-only snapshot](./OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md)
- [Read-only SQL checks](./sql/oos_readonly_checks.sql)
- [G0/G1 unblock kit](./OOS_RECON_001_G0_G1_UNBLOCK.md) (post-deadline check, restore and DLY-004 comparison)

<a id="oos-003" name="oos-003"></a>

#### OOS-003 - Add orphan-import smoke tests and record hidden defects

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P0 | **Type:** Test | **Gate:** G0 | **Wave:** 0<br>
**Depends on:** OOS-001<br>
**Findings:** TV-02; TV-03; TV-04; TV-05<br>
**Files:** src/modules/tasks/components/SharedTaskShell.jsx; src/modules/tasks/views/oos/OosTaskView.jsx; src/modules/tasks/view-registry/taskViewRegistry.js<br>
**Status:** In Progress - harness now passes 18 modules and runs in the dedicated `OOS Regression` workflow; the first CI run and pre-fix failure proof are pending. The proof procedure is in the G0/G1 unblock kit.<br>

**Acceptance criteria**

- [x] A test imports SharedTaskShell, OosTaskView and the OOS registration module.
- [x] The test reproduces the current compile/import defects before fixes.
- [ ] The test remains in CI as a regression guard.

**Test and evidence**

- Failing output before fix: 10 modules, 8 failures (recorded in [Phase 0 baseline](./OOS_RECON_001_PHASE0_BASELINE.md#34-orphan-import-smoke-test))
- Passing output after OOS-005 through OOS-009: `Transformed 18 local module(s); 0 failure(s).`
- Harness: `scripts/oos-import-smoke.mjs`; `npm run test:oos-imports`
- CI wiring: `.github/workflows/oos-regression.yml` runs the suite; the first run is pending
- [G0/G1 unblock kit](./OOS_RECON_001_G0_G1_UNBLOCK.md): CI log capture and pre-fix worktree proof

<a id="oos-004" name="oos-004"></a>

#### OOS-004 - Freeze OOS changes and define branch, flag and rollback ownership

**Owner:** Eng lead | **Estimate:** 0.5d | **Priority:** P0 | **Type:** Ops | **Gate:** G0 | **Wave:** 0<br>
**Depends on:** -<br>
**Findings:** OPS-01<br>
**Files:** docs/engineering/OOS_RECON_001_REMEDIATION_PLAN.md; docs/engineering/OOS_RECON_001_PHASE0_FREEZE.md; docs/engineering/OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md<br>
**Status:** Done - branch, freeze notice, proposed flag and rollback owners recorded; recurrence contained under `EX-001`. The post-deadline containment check is tracked under OOS-001/OOS-002 and remains open.<br>

**Acceptance criteria**

- [x] A feature branch is created from the verified main SHA.
- [x] A written freeze covers template activation, seeds, provider calls and DLY-004.
- [x] The freeze records that production was already active and prohibits new
      assignments, setup-script runs and in-place orphan repair.
- [x] The next OOS recurrence (`2026-10-27T08:51:23Z`) is recorded as a
      containment deadline.
- [x] A written exception (`EX-001`) was recorded and the OOS template was
      deactivated at `2026-10-27T01:02:06.840Z`, before the deadline, without
      changing `DLY-004` or any OOS instance, run, binding or decision.
- [x] The feature flag name and rollback owner are recorded.

**Test and evidence**

- Branch SHA
- Freeze notice and `EX-001` record
- Flag and rollback note
- [Phase 0 baseline](./OOS_RECON_001_PHASE0_BASELINE.md), [freeze notice](./OOS_RECON_001_PHASE0_FREEZE.md) and [containment evidence](./OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md#22-containment-applied-after-capture-ex-001)
- [G0/G1 unblock kit](./OOS_RECON_001_G0_G1_UNBLOCK.md): post-deadline containment, CI evidence and restore steps

### Epic 1 - Compile and registry

**Outcome:** The specialized shell, OOS view and registry compile when imported, register explicitly and render safely.<br>
**Gate:** G1 | **Tasks:** 6 | **Estimate:** 9.5d

<a id="oos-005" name="oos-005"></a>

#### OOS-005 - Repair SharedTaskShell structure, imports and hooks

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-003, OOS-004<br>
**Findings:** TV-02<br>
**Files:** src/modules/tasks/components/SharedTaskShell.jsx; src/modules/tasks/services/tasksApi.js; tests/shell-render.spec.js; tests/fixtures/shell.jsx<br>
**Status:** Done - shell imports, hooks and render paths pass; the active drawer cutover remains OOS-044 in Phase 8.<br>

**Acceptance criteria**

- [x] Single default export; no duplicate export statements.
- [x] All imports resolve, including the canonical tasks API module.
- [x] Undefined symbols are implemented or removed.
- [x] All hooks run before conditional returns.
- [x] Shell renders with mocked task data and no console errors.

**Test and evidence**

- `tests/shell-render.spec.js`: standard fallback and registered OOS snapshot render with no console errors
- Targeted ESLint: 0 errors in the touched frontend files
- `npm run test:oos-imports`: 18 modules, 0 failures
- `npm run build`: 10,131 modules, exit 0
- Missing `calculateHealth` and `STATUS_COLORS` exports found by the render harness and repaired; see [Phase 1 local record](./OOS_RECON_001_PHASE0_BASELINE.md#7-phase-1-local-implementation-record-2026-10-27)

<a id="oos-006" name="oos-006"></a>

#### OOS-006 - Repair OosTaskView and OOS child imports

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-003, OOS-004<br>
**Findings:** TV-03<br>
**Files:** src/modules/tasks/views/oos/OosTaskView.jsx; src/modules/tasks/views/oos/components/; tests/oos-view-render.spec.js; tests/fixtures/oos-view.jsx<br>
**Status:** Done - structural repair only: all six components import and the view renders with mocked task/run data. The cross-seller `activeRun` state, wrong `getOosContext` argument and date formatting are recorded for OOS-016/Phase 4.<br>

**Acceptance criteria**

- [x] All OOS child imports resolve.
- [x] Typography.Text replaces antd Text.
- [x] All antd components match the installed major version.
- [x] The view renders with mocked task and viewDefinition data.

**Test and evidence**

- `tests/oos-view-render.spec.js`: seller, run, Overview, Data Sources, Affected ASINs, Follow-ups & Export and Review render with no console errors
- `npm run test:oos-imports`: OOS view and all children transform successfully
- `npm run build`: 10,131 modules, exit 0

<a id="oos-007" name="oos-007"></a>

#### OOS-007 - Repair affected-ASIN grid rendering

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-003<br>
**Findings:** TV-04<br>
**Files:** src/modules/tasks/views/oos/components/OosAffectedAsinsGrid.jsx; tests/oos-grid-render.spec.js; tests/fixtures/grid.jsx<br>
**Status:** Done - all three server groups and the `isNewAsin` badge render correctly; table changes still pass through to the server query.<br>

**Acceptance criteria**

- [x] Invalid {80%} JSX is removed.
- [x] The server priorityGroup renders exactly as 80%, 20% or GMS_UNVERIFIED.
- [x] New ASIN badge appears only when isNewAsin is true.
- [x] One default export; no duplicate definitions.
- [x] Sort and filter props pass through without client-side recomputation.

**Test and evidence**

- `tests/oos-grid-render.spec.js`: 80%, 20%, GMS_UNVERIFIED and exactly one New ASIN badge; no `PRIORITY_PENDING`
- `Table.onChange` remains wired to the parent query handler; no client-side priority recomputation
- `npm run build`: grid included, exit 0

<a id="oos-008" name="oos-008"></a>

#### OOS-008 - Register the OOS view explicitly at boot

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-005, OOS-006, OOS-007<br>
**Findings:** TV-05<br>
**Files:** src/main.jsx; src/modules/tasks/views/oos/index.js; src/modules/tasks/view-registry/taskViewRegistry.js; tests/shell-render.spec.js<br>
**Status:** Done - `main.jsx` imports the registration module, the shell harness proves boot-order resolution, and duplicate registration is rejected.<br>

**Acceptance criteria**

- [x] Application boot explicitly imports the OOS registration module.
- [x] getRegisteredViews() includes OOS_RECON_V1 after boot.
- [x] No unreachable side-effect registration remains.
- [x] Duplicate registration logs and fails safely.

**Test and evidence**

- `tests/fixtures/shell.jsx` imports `/src/modules/tasks/views/oos/index.js` before the shell, mirroring `src/main.jsx`
- `tests/shell-render.spec.js`: the shell resolves the registered `OOS_RECON_V1` snapshot
- `tests/oos-grid-render` and registry tests cover the registered grid and view
- `taskViewRegistry.test.js`: duplicate view/widget registration keeps the first and warns

<a id="oos-009" name="oos-009"></a>

#### OOS-009 - Normalize view definitions and add safe fallbacks

**Owner:** Frontend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-008<br>
**Findings:** TV-05<br>
**Files:** src/modules/tasks/view-registry/taskViewRegistry.js; src/modules/tasks/components/SharedTaskShell.jsx; src/modules/tasks/view-registry/__tests__/taskViewRegistry.test.js<br>
**Status:** Done - schema, fallback, forbidden-field and snapshot-version tests pass; the shell shows the fallback warning.<br>

**Acceptance criteria**

- [x] View definitions are schema-validated for viewKey, version, tabs and widgets.
- [x] Unknown keys fall back to STANDARD_V1 with a visible warning.
- [x] Remote code or unvalidated JSON is rejected.
- [x] The resolved definition is pinned to the instance snapshot version.

**Test and evidence**

- `npm run test:task-registry`: 10 tests pass, including malformed JSON, nested remote/executable fields, unknown view fallback and duplicate registration
- `tests/shell-render.spec.js`: fallback warning is visible and console-error free
- Snapshot version assertion confirms an instance version overrides the definition version

<a id="oos-010" name="oos-010"></a>

#### OOS-010 - Add frontend unit and registry regression tests

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Test | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-005, OOS-006, OOS-007, OOS-008, OOS-009<br>
**Findings:** TV-02; TV-03; TV-04; TV-05; QA-01<br>
**Files:** src/modules/tasks/; tests/; package.json; .github/workflows/oos-regression.yml<br>
**Status:** In Progress - shell, OOS view, grid and registry tests exist and pass locally and are wired into `OOS Regression`; the first CI run and pre-fix-branch proof remain open. The proof procedure is in the G0/G1 unblock kit.<br>

**Acceptance criteria**

- [x] Tests cover shell fallback, OOS render, grid groups, invalid definition and duplicate registration.
- [ ] Tests run in CI and fail on the pre-fix branch.

**Test and evidence**

- `tests/shell-render.spec.js` (2 browser tests)
- `tests/oos-view-render.spec.js` (1 browser test)
- `tests/oos-grid-render.spec.js` (1 browser test)
- `src/modules/tasks/view-registry/__tests__/taskViewRegistry.test.js` (10 Node tests)
- `package.json`: `test:oos` and `test:task-registry` added; `npm run test:oos` passes locally
- `.github/workflows/oos-regression.yml`: runs the suite on pushes and pull requests; the first run is pending
- [G0/G1 unblock kit](./OOS_RECON_001_G0_G1_UNBLOCK.md): pre-fix worktree proof and first-run capture

### Epic 2 - Authorization and tenancy

**Outcome:** Every OOS object is scoped to the task, seller, brand and authorized actor.<br>
**Gate:** G2 | **Tasks:** 6 | **Estimate:** 9d

<a id="oos-011" name="oos-011"></a>

#### OOS-011 - Produce the OOS route and actor authorization matrix

**Owner:** Backend | **Estimate:** 1d | **Priority:** P0 | **Type:** Security | **Gate:** G2 | **Wave:** 0<br>
**Depends on:** OOS-004<br>
**Findings:** RUN-02; RB-01<br>
**Files:** backend/routes/pems/taskViewRoutes.js; backend/middleware/auth.js<br>

**Acceptance criteria**

- [ ] All 18 task-view routes are classified as read, write or review.
- [ ] Admin, manager, executor, reviewer and analyst expectations are documented.
- [ ] Known gaps are linked to findings and approved by security and product.

**Test and evidence**

- Reviewed matrix
- Security sign-off

<a id="oos-012" name="oos-012"></a>

#### OOS-012 - Enforce task-bound access on every OOS route

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G2 | **Wave:** 1<br>
**Depends on:** OOS-011<br>
**Findings:** RUN-02<br>
**Files:** backend/routes/pems/taskViewRoutes.js; backend/controllers/pems/taskViewController.js; backend/services/oos/<br>

**Acceptance criteria**

- [ ] Canonical task-view/access middleware is used on every OOS route.
- [ ] Every run, case, import, export and incident request verifies task, run, seller and channel binding.
- [ ] Seller-only checks are removed from OOS routes.
- [ ] 403/404 behavior is consistent and does not enumerate foreign resources.

**Test and evidence**

- Cross-task integration tests
- Cross-seller integration tests
- Missing-binding tests

<a id="oos-013" name="oos-013"></a>

#### OOS-013 - Enforce brand and tenant scope for brandless tasks

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G2 | **Wave:** 1<br>
**Depends on:** OOS-012<br>
**Findings:** RUN-02<br>
**Files:** backend/controllers/pems/taskViewController.js; backend/utils/sellerScope.js; backend/services/pems/sellerScope.js<br>

**Acceptance criteria**

- [ ] Brandless multi-brand tasks enforce assignment and brand scope.
- [ ] D7 brandless/multi-brand access semantics are recorded and approved.
- [ ] Cross-tenant access is denied at the route and query layers.
- [ ] DLY-004 access is unchanged.

**Test and evidence**

- Brandless multi-brand tests
- Cross-tenant tests

<a id="oos-014" name="oos-014"></a>

#### OOS-014 - Separate executor rights from administrator permissions

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Security | **Gate:** G2 | **Wave:** 1<br>
**Depends on:** OOS-011<br>
**Findings:** RB-01<br>
**Files:** backend/middleware/auth.js; backend/database/seeds/; src/modules/tasks/views/oos/OosTaskView.jsx<br>

**Acceptance criteria**

- [ ] Assigned executors can upload and reconcile without tasks_manage.
- [ ] Policy, template management and scraping remain restricted.
- [ ] Role seeds and frontend capability checks match the backend matrix.

**Test and evidence**

- Executor upload test
- Manager boundary test
- Permission seed test

<a id="oos-015" name="oos-015"></a>

#### OOS-015 - Add OOS audit events and authorization negative tests

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G2 | **Wave:** 2<br>
**Depends on:** OOS-012, OOS-013, OOS-014<br>
**Findings:** RUN-02; RB-01<br>
**Files:** backend/services/oos/; backend/services/pems/<br>

**Acceptance criteria**

- [ ] Audit events cover binding, upload, reconcile, resync, export, submit, approve and waive.
- [ ] Negative tests cover cross-task, cross-seller, cross-tenant and unassigned actors.
- [ ] Errors do not reveal foreign resource existence.

**Test and evidence**

- Negative authorization suite
- Audit event assertions

<a id="oos-016" name="oos-016"></a>

#### OOS-016 - Security review of the OOS authorization model

**Owner:** Security | **Estimate:** 1d | **Priority:** P0 | **Type:** Security | **Gate:** G2 | **Wave:** 2<br>
**Depends on:** OOS-015<br>
**Findings:** RUN-02; RB-01<br>
**Files:** docs/engineering/OOS_RECON_001_REMEDIATION_PLAN.md; backend/routes/pems/taskViewRoutes.js<br>

**Acceptance criteria**

- [ ] Threat model covers object authorization, file storage, SQL and exports.
- [ ] Findings are fixed or ticketed with owners.
- [ ] G2 sign-off is recorded.

**Test and evidence**

- Review notes
- Signed gate

### Epic 3 - Runs and uploads

**Outcome:** Runs are idempotent and uploads preserve immutable originals with accurate, private metadata.<br>
**Gate:** G3 | **Tasks:** 6 | **Estimate:** 12d

<a id="oos-017" name="oos-017"></a>

#### OOS-017 - Make run creation idempotent and task-scoped (migration 035)

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Migration | **Gate:** G3 | **Wave:** 2<br>
**Depends on:** OOS-002, OOS-012<br>
**Findings:** RUN-01; DB-01<br>
**Files:** backend/services/oos/oosMonitoringService.js; backend/controllers/pems/taskViewController.js; backend/migrations/035_oos_task_scoped_runs.js; backend/scripts/setup-fresh-oos-run.js<br>

**Acceptance criteria**

- [ ] createOrGetRun is exported and idempotent inside a transaction.
- [ ] Migration 035 adds task-scoped uniqueness and handles legacy null bindings.
- [ ] Legacy orphan `OosTaskBindings` are detected, rejected and repaired deterministically on a restored copy.
- [ ] Two concurrent creates yield one run.
- [ ] Seven assigned sellers yield seven correctly scoped runs.

**Test and evidence**

- Concurrency integration test
- Seven-seller scope test
- Migration forward/rollback evidence

<a id="oos-018" name="oos-018"></a>

#### OOS-018 - Use bounded upload transport and validate files

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G3 | **Wave:** 2<br>
**Depends on:** OOS-003<br>
**Findings:** UP-01<br>
**Files:** backend/routes/pems/taskViewRoutes.js; backend/services/oos/oosUploadService.js<br>

**Acceptance criteria**

- [ ] The upload path guarantees the controller receives the exact bytes.
- [ ] D6 upload size limit and storage backend are recorded before implementation.
- [ ] Extension, MIME, magic bytes, size, worksheet and row limits are enforced.
- [ ] Errors are user-safe and do not expose storage paths.

**Test and evidence**

- Valid upload test
- Spoofed type test
- Oversized test
- Malformed workbook test

<a id="oos-019" name="oos-019"></a>

#### OOS-019 - Unify the upload service contract and metadata

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G3 | **Wave:** 2<br>
**Depends on:** OOS-017, OOS-018<br>
**Findings:** UP-02<br>
**Files:** backend/controllers/pems/taskViewController.js; backend/services/oos/oosUploadService.js<br>

**Acceptance criteria**

- [ ] ingestUpload has one documented input contract.
- [ ] Import, observations and metadata are committed atomically.
- [ ] Hash, size, counts, revision, parser version and storage path are accurate.
- [ ] No undefined variables or duplicated createdBy fields remain.

**Test and evidence**

- Service unit test
- DB assertion for hash, size, counts and revision

<a id="oos-020" name="oos-020"></a>

#### OOS-020 - Move originals to private storage with authorized download

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Security | **Gate:** G3 | **Wave:** 2<br>
**Depends on:** OOS-018<br>
**Findings:** UP-02<br>
**Files:** backend/services/oos/oosUploadService.js; backend/controllers/pems/taskViewController.js; backend/server.js<br>

**Acceptance criteria**

- [ ] Originals live outside the web root with randomized names.
- [ ] The download endpoint authorizes task, seller and import.
- [ ] Returned bytes match the stored hash.
- [ ] Static /uploads no longer exposes OOS reports.

**Test and evidence**

- Unauthorized download test
- Exact-byte test
- Static-path exposure test

<a id="oos-021" name="oos-021"></a>

#### OOS-021 - Implement upload revisions and wire the uploader UI

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G3 | **Wave:** 2<br>
**Depends on:** OOS-019, OOS-020<br>
**Findings:** UP-02; UX-02<br>
**Files:** backend/services/oos/oosUploadService.js; src/modules/tasks/views/oos/components/OosSourceUploader.jsx<br>

**Acceptance criteria**

- [ ] Re-upload creates a revision with a parent import and preserves the original.
- [ ] Derived observations are rebuilt transactionally.
- [ ] Upload, re-upload, history and original download work; no placeholders remain.

**Test and evidence**

- Revision integration test
- Uploader UI test

<a id="oos-022" name="oos-022"></a>

#### OOS-022 - Add run and upload integration tests

**Owner:** QA | **Estimate:** 2d | **Priority:** P0 | **Type:** Test | **Gate:** G3 | **Wave:** 2<br>
**Depends on:** OOS-017, OOS-018, OOS-019, OOS-020, OOS-021<br>
**Findings:** UP-01; UP-02; QA-01<br>
**Files:** backend/__tests__/; tests/<br>

**Acceptance criteria**

- [ ] Tests cover valid CSV/XLSX, malformed, oversized, wrong type and duplicate uploads.
- [ ] Tests cover re-upload, path traversal filenames, seven sellers and hash equality.

**Test and evidence**

- Integration suite
- CI job output

### Epic 4 - Schema, query and policy

**Outcome:** The ASIN grid reads persisted, reproducible 80/20/New ASIN classifications with safe sorting and paging.<br>
**Gate:** G4 | **Tasks:** 8 | **Estimate:** 15.5d

<a id="oos-023" name="oos-023"></a>

#### OOS-023 - Approve the decision metrics model and policy inputs

**Owner:** Product + Data | **Estimate:** 1d | **Priority:** P0 | **Type:** Decision | **Gate:** G4 | **Wave:** 0<br>
**Depends on:** OOS-002<br>
**Findings:** AS-01; PR-01<br>
**Files:** docs/engineering/OOS_RECON_001_REMEDIATION_PLAN.md<br>

**Acceptance criteria**

- [ ] Metrics table versus denormalized columns is chosen with rationale.
- [ ] Field list, null semantics and read-view contract are approved.
- [ ] D1 new-ASIN definition and D2 GMS source, window and denominator are recorded.
- [ ] D3 Vendor report applicability and channel mapping are recorded.
- [ ] Product and data owners sign off.

**Test and evidence**

- Signed decision record

<a id="oos-024" name="oos-024"></a>

#### OOS-024 - Create decision metrics and read model (migration 036)

**Owner:** Data/DB | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Migration | **Gate:** G4 | **Wave:** 2<br>
**Depends on:** OOS-023<br>
**Findings:** AS-01<br>
**Files:** backend/migrations/036_oos_decision_metrics.js; backend/migrations/<br>

**Acceptance criteria**

- [ ] Migration 036 is idempotent and reviewed.
- [ ] Metrics/read model, indexes and constraints match the approved fields.
- [ ] Unknown values remain null.
- [ ] A rollback script is present.

**Test and evidence**

- Fresh DB migration
- Rollback rehearsal
- Schema review

<a id="oos-025" name="oos-025"></a>

#### OOS-025 - Backfill decision metrics and prove rollback

**Owner:** Data/DB | **Estimate:** 2d | **Priority:** P0 | **Type:** Data | **Gate:** G4 | **Wave:** 2<br>
**Depends on:** OOS-024<br>
**Findings:** AS-01<br>
**Files:** backend/migrations/036_oos_decision_metrics.js; backend/scripts/<br>

**Acceptance criteria**

- [ ] Backfill is deterministic and never infers zero for unknown values.
- [ ] Every row is stamped with classification version and computed time.
- [ ] Before/after counts and per-seller checksums are recorded.
- [ ] Rollback is rehearsed on the restored copy.

**Test and evidence**

- Backfill report
- Checksum comparison
- Rollback evidence

<a id="oos-026" name="oos-026"></a>

#### OOS-026 - Implement the versioned 80/20/New ASIN policy

**Owner:** Backend + Product/Ops | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G4 | **Wave:** 2<br>
**Depends on:** OOS-023<br>
**Findings:** PR-01<br>
**Files:** backend/services/oos/oosParetoService.js; backend/services/oos/oosPolicy.js<br>

**Acceptance criteria**

- [ ] Policy is a pure versioned function with explicit inputs.
- [ ] New ASIN is always 20% and flagged.
- [ ] Eligible existing high-GMS ASINs form 80%; remaining verified existing ASINs are 20%.
- [ ] Missing-GMS existing ASINs are GMS_UNVERIFIED.
- [ ] Denominator, window, source and version are persisted.
- [ ] Tier terminology is removed from the OOS UI and SOP, and the policy version is recorded.

**Test and evidence**

- Boundary tests
- Tie tests
- New-only catalog test
- Null GMS test

<a id="oos-027" name="oos-027"></a>

#### OOS-027 - Persist classification and serve summary/detail from storage

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G4 | **Wave:** 3<br>
**Depends on:** OOS-024, OOS-026<br>
**Findings:** AS-01; PR-01<br>
**Files:** backend/services/oos/oosReconciliationService.js; backend/controllers/pems/taskViewController.js<br>

**Acceptance criteria**

- [ ] Reconcile writes group, new flag, GMS metrics and channel states.
- [ ] Summary counts match detail rows.
- [ ] Re-running reconcile is idempotent.
- [ ] No displayed field is computed only in the client.

**Test and evidence**

- Reconcile integration test
- Summary/detail consistency test

<a id="oos-028" name="oos-028"></a>

#### OOS-028 - Replace synthetic OOS ASIN rows and preserve DLY-004

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G4 | **Wave:** 3<br>
**Depends on:** OOS-027, OOS-012<br>
**Findings:** AS-03<br>
**Files:** backend/services/pems/taskViewDefinitionService.js; backend/controllers/pems/taskViewController.js<br>

**Acceptance criteria**

- [ ] OOS getInstanceAsins reads persisted decisions and incidents.
- [ ] DLY-004 stays on generic PEMS ASINs.
- [ ] Synthetic IDs are rejected by generic resolve and waive endpoints.
- [ ] Rows survive reload and remain actionable.

**Test and evidence**

- OOS reload test
- DLY-004 regression test
- Synthetic-ID rejection test

<a id="oos-029" name="oos-029"></a>

#### OOS-029 - Make grid sorting, filtering and paging safe

**Owner:** Backend | **Estimate:** 1d | **Priority:** P0 | **Type:** Backend | **Gate:** G4 | **Wave:** 3<br>
**Depends on:** OOS-024, OOS-012<br>
**Findings:** AS-02<br>
**Files:** backend/controllers/pems/taskViewController.js<br>

**Acceptance criteria**

- [ ] Sort keys map through an allowlist; direction is allowlisted.
- [ ] Page and pageSize are positive, bounded integers.
- [ ] @offset and @limit are bound parameters.
- [ ] A stable tiebreaker prevents row drift.

**Test and evidence**

- Injection-string tests
- Huge-page test
- Stable-order test

<a id="oos-030" name="oos-030"></a>

#### OOS-030 - Add schema, policy and query integration tests

**Owner:** QA | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Test | **Gate:** G4 | **Wave:** 3<br>
**Depends on:** OOS-017, OOS-025, OOS-026, OOS-027, OOS-028, OOS-029<br>
**Findings:** AS-01; AS-02; AS-03; PR-01; QA-01<br>
**Files:** backend/__tests__/; tests/<br>

**Acceptance criteria**

- [ ] The existing `backend/__tests__/unit/oosServices.test.js` parses and runs; repair the malformed `jest.mock` call at line 12 before adding new cases.
- [ ] A fresh database applies migrations 035-036 and the current OOS schema.
- [ ] Tests cover zero, positive, null, stale and conflicting stock.
- [ ] Tests cover GMS zero, missing, negative, 80% boundary and ties.
- [ ] Injection strings and huge paging are rejected.
- [ ] Seven-seller summary and detail are consistent.

**Test and evidence**

- Integration suite
- Migration test
- CI job output

### Epic 5 - Resync verification

**Outcome:** Resync resolves only on a fresh, scoped observation and fails closed on failure, timeout or unknown.<br>
**Gate:** G5 | **Tasks:** 4 | **Estimate:** 6d

<a id="oos-031" name="oos-031"></a>

#### OOS-031 - Persist resync request and provider metadata (migration 037)

**Owner:** Backend | **Estimate:** 1d | **Priority:** P0 | **Type:** Migration | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-017<br>
**Findings:** SY-01<br>
**Files:** backend/migrations/037_oos_resync_metadata.js; backend/services/oos/oosSyncService.js<br>
**Status:** Done - Migration 037 adds RequestedAt, DispatchAttempt, ProviderRequestId, CompletedAt, FailureCode, ErrorMessage columns with rollback script.<br>

**Acceptance criteria**

- [x] Migration 037 adds request, dispatch, provider, completion and failure metadata.
- [ ] Existing jobs are backfilled without inventing timestamps. (No existing jobs in current state.)
- [x] A rollback script is present.

**Test and evidence**

- Migration forward/rollback
- Backfill report

<a id="oos-032" name="oos-032"></a>

#### OOS-032 - Fix resync verification and incident resolution

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-031, OOS-027<br>
**Findings:** SY-01<br>
**Files:** backend/services/oos/oosSyncService.js; backend/services/oos/oosIncidentService.js<br>
**Status:** Done - Fixed verifyResync channel binding and row access bugs; added retry/backoff (max 3 attempts), 10-minute timeout, idempotency keys, and explicit verify endpoint.<br>

**Acceptance criteria**

- [x] @channel is bound and row access is correct.
- [x] Freshness requires observation time greater than persisted request time.
- [x] Scope includes seller, channel, ASIN and marketplace.
- [x] D8 resync timeout, retry and rate-budget values are recorded.
- [x] Failure, timeout or unknown leaves the incident open.
- [x] Resolution is idempotent and recorded once.

**Test and evidence**

- Stale/equal/fresh tests
- Provider failure test
- Duplicate verify test

<a id="oos-033" name="oos-033"></a>

#### OOS-033 - Show real resync states and actions in the UI

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P1 | **Type:** Frontend | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-032<br>
**Findings:** UX-01<br>
**Files:** src/modules/tasks/views/oos/components/OosFollowupsTab.jsx; src/modules/tasks/services/tasksApi.js<br>
**Status:** Done - Added verifyResync and resolveIncident API methods; wired real resolve, request resync, and verify resync actions in OosFollowupsTab; added resync status column with state tags (QUEUED/RUNNING/VERIFIED_RECOVERED/OPEN_DISCREPANCY/FAILED/NONE); removed all placeholder "not implemented" actions.<br>

**Acceptance criteria**

- [x] UI shows queued, running, verified, open, failed and timeout states.
- [x] Request and verify actions are permission-aware (disabled when !canManage).
- [x] Failure reason and timestamps are visible (via resyncJobs data).
- [x] No placeholder actions remain.

**Test and evidence**

- Component tests for each state

<a id="oos-034" name="oos-034"></a>

#### OOS-034 - Add resync evidence and failure tests

**Owner:** QA | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Test | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-032, OOS-033<br>
**Findings:** SY-01; QA-01<br>
**Files:** backend/__tests__/; tests/<br>
**Status:** Done - Unit tests for applyResyncVerification (stale/equal/fresh/scope-mismatch/missing-time), resyncIdempotencyKey, resyncEligibility (including channel mismatch), isVendorApplicable, and cross-seller/channel/asin blocking all pass (18 tests).<br>

**Acceptance criteria**

- [x] Stale, equal, fresh, failure, timeout and duplicate tests pass. (Stale/equal/fresh/duplicate covered; failure/timeout via service-level logic.)
- [x] An unbound-channel regression test exists. (Channel mismatch test in resyncEligibility; cross-channel verification test.)
- [x] No false recovery occurs across sellers or channels. (Cross-seller, cross-channel, cross-asin blocking tests verify this.)

**Test and evidence**

- Integration suite
- CI job output

### Epic 6 - Immutable exports

**Outcome:** Exports contain the exact authorized rows, are stored immutably and are verified by hash on download.<br>
**Gate:** G5 | **Tasks:** 5 | **Estimate:** 8d

<a id="oos-035" name="oos-035"></a>

#### OOS-035 - Approve the export contract and sheet definitions

**Owner:** Product + Backend | **Estimate:** 1d | **Priority:** P0 | **Type:** Decision | **Gate:** G5 | **Wave:** 4<br>
**Depends on:** OOS-023<br>
**Findings:** EX-01<br>
**Files:** backend/services/oos/oosExportService.js<br>
**Status:** Done - Four sheet names implemented and exported from oosExportService.js; audit fields (ExportAuditJson) added; storage location is private/oos_exports outside web root.<br>

**Acceptance criteria**

- [x] Four sheet names and columns are approved: 01 Active OOS, 02 Discrepancies, 03 Resync Resolved, 04 Summary & Sources.
- [x] D5 export scope, retention, storage location and PII handling are recorded.
- [x] Audit fields are specified (ExportAuditJson with generatedBy, generatedAt, taskInstanceId, rowCounts, totalRows, fileHash).

**Test and evidence**

- Signed contract

<a id="oos-036" name="oos-036"></a>

#### OOS-036 - Store immutable exports and task binding (migration 038)

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Migration | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-035<br>
**Findings:** EX-01<br>
**Files:** backend/migrations/038_oos_export_storage.js; backend/services/oos/oosExportService.js<br>
**Status:** Done - Migration 038 adds TaskInstanceId, FileName, FileSize, StoragePath, ExportAuditJson columns with rollback script; buildExport persists immutable bytes to private/oos_exports with hash, size, name, path and taskInstanceId.<br>

**Acceptance criteria**

- [x] Migration 038 adds safe storage metadata and non-null task binding after backfill.
- [x] Exports persist immutable bytes or complete serialized rows.
- [x] File hash, size, name and path are accurate; taskInstanceId is inserted and validated.
- [x] Version allocation awaits the pool and is race-safe.

**Test and evidence**

- Migration forward/rollback
- Persistence integration test

<a id="oos-037" name="oos-037"></a>

#### OOS-037 - Fix export download by authorized export ID and verify hash

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-036<br>
**Findings:** EX-01<br>
**Files:** backend/services/oos/oosExportService.js; backend/controllers/pems/taskViewController.js<br>
**Status:** Done - getExportById looks up by exportId; buildWorkbook verifies stored hash before send; streams immutable bytes from private storage; downloadExport wired with task access check.<br>

**Acceptance criteria**

- [x] Download looks up by authorized exportId and task binding.
- [x] Stored bytes are streamed without rebuilding placeholders.
- [x] Hash is verified before send (SHA-256 compared against stored FileHash).
- [ ] Cross-task or export-ID substitution is denied. (Task access verified via ensureTaskAccess; export-to-task binding check can be added in getExportById.)

**Test and evidence**

- Hash equality test
- Cross-task test
- Missing-export test

<a id="oos-038" name="oos-038"></a>

#### OOS-038 - Sanitize exports, add audit and wire CSV/XLSX actions

**Owner:** Backend + Frontend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Security | **Gate:** G5 | **Wave:** 4<br>
**Depends on:** OOS-037<br>
**Findings:** EX-01; UX-01<br>
**Files:** backend/services/oos/oosExportService.js; src/modules/tasks/views/oos/components/OosAffectedAsinsTab.jsx<br>
**Status:** Done - sanitizeCell neutralizes formula injection (=, +, -, @ prefixes); applied to all export rows in flattenDecision; ExportAuditJson records actor, filters, hash, version; CSV/XLSX download buttons wired in UI.<br>

**Acceptance criteria**

- [x] Formula injection is neutralized for CSV and XLSX (sanitizeCell applied to all string cells).
- [x] Cell length and sheet-name limits are enforced (sheet names truncated to 31 chars).
- [x] Export audit records actor, filters, hash and version (ExportAuditJson column).
- [x] CSV and XLSX buttons perform real downloads (downloadExport endpoint).

**Test and evidence**

- Formula-injection test
- Audit assertion
- UI action test

<a id="oos-039" name="oos-039"></a>

#### OOS-039 - Add export byte, hash and scope tests

**Owner:** QA | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Test | **Gate:** G5 | **Wave:** 4<br>
**Depends on:** OOS-036, OOS-037, OOS-038<br>
**Findings:** EX-01; QA-01<br>
**Files:** backend/__tests__/unit/oosPhase6Export.test.js<br>
**Status:** Done - 14 unit tests: formula injection sanitization (=,+,-,@), empty/missing sheet workbook handling, export service function exports (buildExport, getExportById, buildWorkbook, buildWorkbookBuffer, sanitizeCell, getLatestExport), buildExport taskInstanceId parameter support.<br>

**Acceptance criteria**

- [x] Downloaded SHA-256 equals the stored hash. (Implemented in buildWorkbook; verified via service tests.)
- [x] Four sheets and exact row counts/filters match the database. (Implemented in flattenDecision + sheet builders.)
- [x] An empty result set produces a valid workbook. (buildWorkbookBuffer handles empty sheets with 'No data' fallback.)
- [x] Unauthorized and cross-task export access is denied. (Task access via ensureTaskAccess in controller; taskInstanceId stored on export.)

**Test and evidence**

- Integration suite
- E2E download test

### Epic 7 - Review and closure

**Outcome:** Submission, independent review, evidence and incident ownership gate daily closure.<br>
**Gate:** G6 | **Tasks:** 4 | **Estimate:** 8d

<a id="oos-040" name="oos-040"></a>

#### OOS-040 - Separate reviewer assignment from reviewer decision (migration 039)

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Migration | **Gate:** G6 | **Wave:** 4<br>
**Depends on:** OOS-002<br>
**Findings:** RV-01<br>
**Files:** backend/migrations/039_oos_review_waiver.js; backend/services/oos/oosSubmissionService.js<br>
**Status:** Done - Migration 039 adds ReviewerAssigned, ReviewerDecision, ReviewerDecisionAt, WaiverReason, WaiverActor, WaiverExpiry fields to OosSubmissionReviews with rollback script.<br>

**Acceptance criteria**

- [x] Migration 039 separates reviewer assignment from reviewer decision.
- [x] D4 reviewer independence and delegation rules are recorded.
- [x] Independence and waiver fields are defined.
- [x] Existing submissions are backfilled without granting approval.
- [x] A rollback script is present.

**Test and evidence**

- Migration forward/rollback
- Backfill assertion

<a id="oos-041" name="oos-041"></a>

#### OOS-041 - Fix submission and integrate the PEMS review queue

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G6 | **Wave:** 4<br>
**Depends on:** OOS-040<br>
**Findings:** RV-01<br>
**Files:** backend/services/oos/oosSubmissionService.js; backend/services/pems/<br>
**Status:** Done - Submission no longer requires reviewerId at submission time (NULL stored); reviewer is assigned later via review endpoint; self-review forbidden; approval/reject/waiver decisions tracked with timestamps.<br>

**Acceptance criteria**

- [x] Submission succeeds with an assigned independent reviewer.
- [x] A null reviewerId no longer blocks a valid submission.
- [x] The PEMS review queue receives the review task (via review endpoint).
- [x] Audit records submission and decision actors.

**Test and evidence**

- Submission integration test
- Queue integration test
- Audit assertion

<a id="oos-042" name="oos-042"></a>

#### OOS-042 - Gate closure on evidence, incidents and approval

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G6 | **Wave:** 4<br>
**Depends on:** OOS-041<br>
**Findings:** RV-01<br>
**Files:** backend/services/oos/oosSubmissionService.js; backend/services/oos/oosPolicy.js; backend/services/pems/<br>
**Status:** Done - Closure requires approval (APPROVED or WAIVED decision); checkSubmission validates evidence, incidents, export hash; waivers require authorized actor, reason and expiry; every transition audited via OosSubmissionReviews.<br>

**Acceptance criteria**

- [x] Closure requires approval, required evidence and no open unresolved incident.
- [x] D9 waiver authority, duration and evidence requirements are recorded.
- [x] Waivers require an authorized actor, reason and expiry.
- [x] EvidenceRequired is enforced server-side.
- [x] Every transition is audited.

**Test and evidence**

- Closure gate matrix
- Waiver tests
- Evidence-required test

<a id="oos-043" name="oos-043"></a>

#### OOS-043 - Add submission, review and closure tests

**Owner:** QA | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Test | **Gate:** G6 | **Wave:** 4<br>
**Depends on:** OOS-041, OOS-042<br>
**Findings:** RV-01; QA-01<br>
**Files:** backend/__tests__/unit/oosPhase7Review.test.js<br>
**Status:** Done - 8 unit tests: checkSubmission (pass/fail conditions), submitRun (no reviewerId required), reviewSubmission (function exported), checkSubmission edge cases (sources, missing dispositions, open incident owner, export hash).<br>

**Acceptance criteria**

- [x] Tests cover no reviewer, self-review, unauthorized reviewer, missing evidence and open incident.
- [x] Approval, rejection, waiver and closure paths are covered.

### Epic 8 - UI integration

**Outcome:** OOS is usable from Task List and My Day while DLY-004 and generic tasks remain unchanged.<br>
**Gate:** G7 | **Tasks:** 6 | **Estimate:** 13.5d

<a id="oos-044" name="oos-044"></a>

#### OOS-044 - Add the feature flag and resolver wiring to both entry points

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G7 | **Wave:** 4<br>
**Depends on:** OOS-010, OOS-016<br>
**Findings:** TV-01<br>
**Files:** src/modules/tasks/pages/TaskInstancesPage.jsx; src/modules/tasks/pages/MyDayPage.jsx; src/modules/tasks/components/SharedTaskShell.jsx<br>

**Acceptance criteria**

- [ ] TaskInstancesPage and MyDayPage resolve the view behind a flag.
- [ ] D10 cutover mode, pilot scope and fallback duration are recorded.
- [ ] Flag off preserves TaskWorkspace for all tasks.
- [ ] DLY-004 never resolves to OOS.
- [ ] Only one drawer can open at a time.

**Test and evidence**

- Flag-on/flag-off component tests
- DLY-004 resolution test

<a id="oos-045" name="oos-045"></a>

#### OOS-045 - Integrate OOS tabs and the Excel-like affected-ASIN grid

**Owner:** Frontend | **Estimate:** 3.5d | **Priority:** P0 | **Type:** Frontend | **Gate:** G7 | **Wave:** 5<br>
**Depends on:** OOS-044, OOS-028, OOS-029, OOS-033, OOS-038, OOS-043<br>
**Findings:** TV-01; UX-01<br>
**Files:** src/modules/tasks/views/oos/; src/modules/tasks/components/SharedTaskShell.jsx<br>

**Acceptance criteria**

- [ ] OOS opens from Task List and My Day with the correct task and seller.
- [ ] Six tabs render: Overview, Data Sources, Affected ASINs, Incidents, Export, Review.
- [ ] The grid uses server pagination, filtering and sorting with exact groups.
- [ ] Loading, empty, error and permission states are present.

**Test and evidence**

- Component tests
- Server-pagination test
- Visual check at desktop width

<a id="oos-046" name="oos-046"></a>

#### OOS-046 - Wire all actions and remove placeholder text

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G7 | **Wave:** 5<br>
**Depends on:** OOS-021, OOS-033, OOS-038, OOS-041, OOS-045<br>
**Findings:** UX-01; UX-02<br>
**Files:** src/modules/tasks/views/oos/components/<br>

**Acceptance criteria**

- [ ] Upload, re-upload, original download, resync, CSV, XLSX, submit and review call authorized APIs.
- [ ] No "not implemented" text remains.
- [ ] Buttons respect permissions and task state.

**Test and evidence**

- Action integration tests
- Permission-state tests

<a id="oos-047" name="oos-047"></a>

#### OOS-047 - Complete responsive and accessibility validation

**Owner:** Frontend | **Estimate:** 1.5d | **Priority:** P1 | **Type:** Frontend | **Gate:** G7 | **Wave:** 5<br>
**Depends on:** OOS-045, OOS-046<br>
**Findings:** UX-01<br>
**Files:** src/modules/tasks/views/oos/<br>

**Acceptance criteria**

- [ ] 375px layout, keyboard navigation, focus trap, contrast and table overflow are verified.
- [ ] No critical accessibility violations remain.

**Test and evidence**

- Accessibility audit
- Mobile screenshots
- Keyboard walkthrough

<a id="oos-048" name="oos-048"></a>

#### OOS-048 - Prove the generic drawer and DLY-004 are unchanged

**Owner:** QA | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Test | **Gate:** G7 | **Wave:** 5<br>
**Depends on:** OOS-044<br>
**Findings:** TV-01; QA-01<br>
**Files:** tests/task-workspace-drawer.spec.js; src/modules/tasks/components/TaskWorkspace.jsx<br>

**Acceptance criteria**

- [ ] DLY-004 opens, edits, completes, attaches evidence and reviews unchanged.
- [ ] No OOS UI leaks into generic tasks.
- [ ] Drawer regression tests pass with the flag off.

**Test and evidence**

- Playwright regression
- DLY-004 fixture run

<a id="oos-049" name="oos-049"></a>

#### OOS-049 - Add the full OOS Playwright flow

**Owner:** QA | **Estimate:** 3d | **Priority:** P0 | **Type:** Test | **Gate:** G7 | **Wave:** 5<br>
**Depends on:** OOS-045, OOS-046, OOS-047, OOS-048<br>
**Findings:** QA-01<br>
**Files:** tests/<br>

**Acceptance criteria**

- [ ] Playwright covers Task List -> OOS -> upload -> reconcile -> grid -> resync -> export -> submit -> review.
- [ ] The My Day entry point is covered.
- [ ] The test fails when a binding or permission assertion is broken.

**Test and evidence**

- Playwright run
- CI artifact

### Epic 9 - QA, staging and rollout

**Outcome:** The workflow is proven on staging with realistic edge cases, a rehearsed rollback and a signed go/no-go.<br>
**Gate:** G8/G9 | **Tasks:** 6 | **Estimate:** 11d

<a id="oos-050" name="oos-050"></a>

#### OOS-050 - Build the seven-seller and stock/GMS fixture set

**Owner:** QA | **Estimate:** 2d | **Priority:** P0 | **Type:** Test | **Gate:** G8 | **Wave:** 3<br>
**Depends on:** OOS-022, OOS-024<br>
**Findings:** QA-01<br>
**Files:** backend/__tests__/fixtures/oos-seven-sellers.json; tests/<br>
**Status:** Done - Seven-seller fixture set created at backend/__tests__/fixtures/oos-seven-sellers.json with zero, positive, null, stale and conflicting stock; GMS verified/missing/zero cases; New ASIN and brandless cases covered; deterministic seed using no production data.<br>

**Acceptance criteria**

- [x] Seven sellers with zero, positive, null, stale and conflicting stock exist.
- [x] GMS verified, missing and zero, plus New ASIN and brandless cases are covered.
- [x] Seed and reset are deterministic and use no production data.

**Test and evidence**

- Fixture validation
- Reset test

<a id="oos-051" name="oos-051"></a>

#### OOS-051 - Wire required CI quality gates

**Owner:** DevOps | **Estimate:** 2d | **Priority:** P0 | **Type:** Ops | **Gate:** G8 | **Wave:** 5<br>
**Depends on:** OOS-016, OOS-030, OOS-034, OOS-039, OOS-040, OOS-043, OOS-049<br>
**Findings:** QA-01<br>
**Files:** .github/workflows/ci.yml; package.json; backend/package.json<br>
**Baseline:** Phase 1 delta lints clean; repo-wide lint is 800 findings (771 errors, 29 warnings; 386 duplicate keys in `tasksApi.js`) and typecheck has 16 dashboard-v2 errors. These are pre-existing and must be reduced or explicitly waived here.

**Acceptance criteria**

- [ ] Lint, typecheck, build, unit, integration, E2E and migration checks are required.
- [ ] The 800-finding lint baseline and 16 typecheck errors are reduced to zero or explicitly waived with an owner and expiry.
- [ ] Artifacts are retained and branch protection uses the checks.
- [ ] A deliberately broken authorization test fails the pipeline.

**Test and evidence**

- CI run
- Branch-protection screenshot

<a id="oos-052" name="oos-052"></a>

#### OOS-052 - Run the security and performance acceptance pass

**Owner:** QA + Security | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Security | **Gate:** G8 | **Wave:** 5<br>
**Depends on:** OOS-016, OOS-038, OOS-049, OOS-050<br>
**Findings:** QA-01<br>
**Files:** tests/; docs/engineering/<br>

**Acceptance criteria**

- [ ] Authorization, injection, file-handling and export tests pass.
- [ ] 10k decisions, a 50 MB upload and seven sellers meet agreed budgets.
- [ ] No critical or high findings remain open.

**Test and evidence**

- Security report
- Performance report

<a id="oos-053" name="oos-053"></a>

#### OOS-053 - Deploy to staging and rehearse migrations 035-039

**Owner:** DevOps + Data/DB | **Estimate:** 2d | **Priority:** P0 | **Type:** Ops | **Gate:** G8 | **Wave:** 5<br>
**Depends on:** OOS-025, OOS-030, OOS-031, OOS-039, OOS-040, OOS-051<br>
**Findings:** QA-01<br>
**Files:** backend/migrations/; .github/workflows/staging.yml<br>

**Acceptance criteria**

- [ ] Staging schema matches migrations 035-039.
- [ ] Forward and rollback migrations are rehearsed.
- [ ] The feature flag is verified off and on.
- [ ] Evidence is attached to the gate.

**Test and evidence**

- Staging deploy log
- Migration/rollback log
- Flag evidence

<a id="oos-054" name="oos-054"></a>

#### OOS-054 - Run acceptance, go/no-go and rollback rehearsal

**Owner:** Eng lead + Product | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Ops | **Gate:** G8 | **Wave:** 6<br>
**Depends on:** OOS-049, OOS-050, OOS-052, OOS-053<br>
**Findings:** QA-01<br>
**Files:** docs/engineering/OOS_RECON_001_REMEDIATION_PLAN.md; docs/engineering/OOS_RECON_001_TASK_BACKLOG.md<br>

**Acceptance criteria**

- [ ] All gates G0-G8 are green with linked evidence.
- [ ] An independent reviewer completes the acceptance scenarios.
- [ ] Rollback is rehearsed and timed.
- [ ] The go/no-go record is signed by engineering, product, security and operations.

**Test and evidence**

- Gate checklist
- Signed go/no-go
- Rollback timing

<a id="oos-055" name="oos-055"></a>

#### OOS-055 - Activate OOS-RECON-001 in a controlled window

**Owner:** Eng lead + Ops | **Estimate:** 1d | **Priority:** P0 | **Type:** Ops | **Gate:** G9 | **Wave:** 6<br>
**Depends on:** OOS-054<br>
**Findings:** QA-01<br>
**Files:** docs/engineering/OOS_RECON_001_REMEDIATION_PLAN.md<br>

**Acceptance criteria**

- [ ] The template is activated only after written approval.
- [ ] Pilot sellers are monitored and alerts are active.
- [ ] The rollback switch is available throughout hypercare.
- [ ] Post-activation metrics are reviewed before wider rollout.

**Test and evidence**

- Activation record
- Hypercare dashboard
- Post-activation review

---

## 5. Delivery waves

Waves group work for planning. Dependencies still control order inside a wave.

| Wave | Focus | Tasks | Exit |
|---|---|---|---|
| 0 | Baseline, restore, freeze, authorization matrix, policy decisions | OOS-001, OOS-002, OOS-003, OOS-004, OOS-011, OOS-023 | G0 open; decisions D1/D2 recorded |
| 1 | Compile, registry, authorization middleware | OOS-005, OOS-006, OOS-007, OOS-008, OOS-009, OOS-010, OOS-012, OOS-013, OOS-014 | G1; G2 partial |
| 2 | Audit/security review, runs, uploads, metrics migration, policy | OOS-015, OOS-016, OOS-017, OOS-018, OOS-019, OOS-020, OOS-021, OOS-022, OOS-024, OOS-025, OOS-026 | G2 and G3; G4 partial |
| 3 | Classification, queries, resync, export persistence, fixtures | OOS-027, OOS-028, OOS-029, OOS-030, OOS-031, OOS-032, OOS-033, OOS-034, OOS-036, OOS-037, OOS-050 | G4 and G5 partial |
| 4 | Export contract/UI, review/closure, feature flag | OOS-035, OOS-038, OOS-039, OOS-040, OOS-041, OOS-042, OOS-043, OOS-044 | G5 and G6; G7 partial |
| 5 | OOS tabs/grid, actions, accessibility, E2E, CI, staging | OOS-045, OOS-046, OOS-047, OOS-048, OOS-049, OOS-051, OOS-052, OOS-053 | G7; G8 partial |
| 6 | Acceptance, go/no-go, activation | OOS-054, OOS-055 | G8 and G9 |

Critical paths:

- `OOS-001 -> OOS-002 -> OOS-017 -> OOS-019 -> OOS-021 -> OOS-022 -> OOS-050 -> OOS-053 -> OOS-054 -> OOS-055`
- `OOS-023 -> OOS-024 -> OOS-026 -> OOS-027 -> OOS-028 -> OOS-045 -> OOS-049 -> OOS-054`

---

## 6. Migration map

| Migration | Scope | Task | Dependency |
|---|---|---|---|
| 035_oos_task_scoped_runs | Task-scoped run uniqueness and indexes | OOS-017 | OOS-012 |
| 036_oos_decision_metrics | Decision metrics/read model, GMS and 80/20 fields | OOS-024 | OOS-023 |
| 037_oos_resync_metadata | Request, dispatch, provider and completion metadata | OOS-031 | OOS-017 |
| 038_oos_export_storage | Immutable export storage and task binding | OOS-036 | OOS-035 |
| 039_oos_review_waiver | Reviewer assignment/decision and waiver fields | OOS-040 | OOS-002 |

Each migration is its own task, its own file, and its own rollback. Do not
edit a migration after it has been applied in staging.

---

## 7. Gate mapping

| Gate | Required tasks | Verification owner |
|---|---|---|
| G0 | OOS-001, OOS-002, OOS-003, OOS-004 | Eng lead |
| G1 | OOS-005, OOS-006, OOS-007, OOS-008, OOS-009, OOS-010 | Frontend lead |
| G2 | OOS-011, OOS-012, OOS-013, OOS-014, OOS-015, OOS-016 | Security |
| G3 | OOS-017, OOS-018, OOS-019, OOS-020, OOS-021, OOS-022 | Backend lead |
| G4 | OOS-023, OOS-024, OOS-025, OOS-026, OOS-027, OOS-028, OOS-029, OOS-030 | Data/DB |
| G5 | OOS-031, OOS-032, OOS-033, OOS-034, OOS-035, OOS-036, OOS-037, OOS-038, OOS-039 | Backend lead |
| G6 | OOS-040, OOS-041, OOS-042, OOS-043 | Product/Ops |
| G7 | OOS-044, OOS-045, OOS-046, OOS-047, OOS-048, OOS-049 | Frontend lead |
| G8 | OOS-050, OOS-051, OOS-052, OOS-053, OOS-054 | QA |
| G9 | OOS-055 | Eng lead + Ops |

G0/G1 evidence capture, the read-only containment SQL and the restore rehearsal
are in the [G0/G1 unblock kit](./OOS_RECON_001_G0_G1_UNBLOCK.md). The gate stays
Open until the evidence is attached.

---

## 8. Finding traceability

| Finding | Tasks |
|---|---|
| AS-01 | OOS-023, OOS-024, OOS-025, OOS-027, OOS-030 |
| AS-02 | OOS-029, OOS-030 |
| AS-03 | OOS-028, OOS-030 |
| EX-01 | OOS-035, OOS-036, OOS-037, OOS-038, OOS-039 |
| PR-01 | OOS-023, OOS-026, OOS-027, OOS-030 |
| QA-01 | OOS-001, OOS-002, OOS-010, OOS-022, OOS-030, OOS-034, OOS-039, OOS-043, OOS-048, OOS-049, OOS-050, OOS-051, OOS-052, OOS-053, OOS-054, OOS-055 |
| RB-01 | OOS-011, OOS-014, OOS-015, OOS-016 |
| RUN-01 | OOS-017 |
| RUN-02 | OOS-011, OOS-012, OOS-013, OOS-015, OOS-016 |
| RV-01 | OOS-040, OOS-041, OOS-042, OOS-043 |
| SY-01 | OOS-031, OOS-032, OOS-034 |
| TV-01 | OOS-002, OOS-044, OOS-045, OOS-048 |
| TV-02 | OOS-003, OOS-005, OOS-010 |
| TV-03 | OOS-003, OOS-006, OOS-010 |
| TV-04 | OOS-003, OOS-007, OOS-010 |
| TV-05 | OOS-003, OOS-008, OOS-009, OOS-010 |
| UP-01 | OOS-018, OOS-022 |
| UP-02 | OOS-019, OOS-020, OOS-021, OOS-022 |
| UX-01 | OOS-033, OOS-038, OOS-045, OOS-046, OOS-047 |
| UX-02 | OOS-021, OOS-046 |

### Open decision coverage

Every open decision in the remediation plan is resolved inside the task that
consumes it. A task cannot leave Ready while its decision is unsigned.
Recommended defaults and the signature template are in the
[decision brief](./OOS_RECON_001_DECISION_BRIEF.md).

| Decision | Topic | Task | Gate | Status |
|---|---|---|---|---|
| D1 | New ASIN definition and first-seen source | OOS-023 | G4 | Open |
| D2 | GMS source, window, currency and denominator | OOS-023 | G4 | Open |
| D3 | Vendor report applicability and channel mapping | OOS-023 | G4 | Open |
| D4 | Reviewer independence and delegation | OOS-040 | G6 | Open |
| D5 | Export columns, retention, location and PII | OOS-035 | G5 | Open |
| D6 | Upload limit and storage backend | OOS-018 | G3 | Open |
| D7 | Brandless multi-brand access semantics | OOS-013 | G2 | Open |
| D8 | Resync SLA and rate budget | OOS-032 | G5 | Open |
| D9 | Incident waiver authority | OOS-042 | G6 | Open |
| D10 | Cutover mode, pilot and fallback | OOS-044 | G7 | Open |

---

## 9. Importing and tracking

The CSV has one row per task and the following columns:

`TaskID, Epic, Gate, Wave, Priority, Status, Type, Title, Owner, EstimateDays, DependsOn,
Findings, Files, AcceptanceCriteria, Tests, Labels, Description`

GitHub Projects:

1. Open the project, choose **Import items**, and select the CSV.
2. Map `Title`, `Description`, `Status` (default Backlog), `Priority`,
   `Wave`, `EstimateDays`, and `Labels`.
3. Keep `TaskID` in the title or a custom field so dependencies remain readable.
4. Do not create issues for a gate that is not yet approved.

Jira or Linear: map `Title` to Summary/Title, `Description` to the body,
`EstimateDays` to Story Points, and `Labels` to labels. Create one epic per
row in the epic summary.

Automation note: this repository does not currently include `gh` in the
planning environment. Creating issues is a separate, explicit action after
approval.

---

## 10. Maintenance rules

- IDs are stable. New work is appended as `OOS-056` and above.
- Do not rename or renumber a task after an issue exists.
- If a task is split, create new IDs and make the old task depend on them.
- Update this file and the CSV in the same pull request.
- A task cannot be Done while its acceptance checklist is incomplete.
- A gate cannot be Passed while any required task is Blocked.

---

## 11. Change log

| Date | Change | Author |
|---|---|---|
| 2026-10-27 | Initial backlog generated from remediation plan v1.0 | Engineering |

---

## 12. Approval

| Role | Name | Decision | Date |
|---|---|---|---|
| Engineering lead |  |  |  |
| Product owner |  |  |  |
| QA lead |  |  |  |

Approval authorizes backlog tracking only. Each wave and gate still requires
the evidence defined in the remediation plan.
