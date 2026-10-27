# OOS-RECON-001 Execution Backlog

**Source plan:** [`OOS_RECON_001_REMEDIATION_PLAN.md`](./OOS_RECON_001_REMEDIATION_PLAN.md)<br>
**Audit date:** 2026-10-27 (Asia/Kolkata)<br>
**Verified main SHA:** `316729a4dad3b8758135a44a62553c46620a0134`<br>
**Backlog version:** 1.0<br>
**Tasks:** 55 across 10 epics<br>
**Estimate:** 96 engineer-days (sum of task estimates; not a delivery commitment)<br>
**Status:** Proposed. No GitHub issues have been created by this document.<br>
**Import file:** [`oos-recon-001-tasks.csv`](./oos-recon-001-tasks.csv)

> This backlog does not authorize activation. The template remains inactive and
> DLY-004 must not be modified. Work starts only after the remediation plan is
> approved and Phase 0 is explicitly opened.

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

**Acceptance criteria**

- [ ] Run 40304737266 logs are captured for pre-deploy, deploy and rollback jobs.
- [ ] The exact failing command and first error are recorded in the task.
- [ ] Local baseline results for lint, tests, build and migration dry-run are attached.

**Test and evidence**

- CI log excerpt
- Command transcript
- Baseline report

> **Implementation note:** Do not treat a successful summary job as a successful deployment.

<a id="oos-002" name="oos-002"></a>

#### OOS-002 - Restore an isolated database and verify DLY-004

**Owner:** Data/DB | **Estimate:** 1d | **Priority:** P0 | **Type:** Data | **Gate:** G0 | **Wave:** 0<br>
**Depends on:** OOS-001<br>
**Findings:** TV-01; QA-01<br>
**Files:** backend/migrations/032_oos_reconciliation.js; backend/migrations/033_task_view_definitions_and_oos_bindings.js; backend/migrations/034_evidence_required_and_oos_bindings.js<br>

**Acceptance criteria**

- [ ] A recent production backup is restored to an isolated environment.
- [ ] OOS table row counts and template/instance/assignment snapshots are recorded.
- [ ] DLY-004 is confirmed present, active and structurally unchanged.
- [ ] No production writes or provider calls occur.

**Test and evidence**

- Restore report
- Read-only SQL output (redacted)

<a id="oos-003" name="oos-003"></a>

#### OOS-003 - Add orphan-import smoke tests and record hidden defects

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P0 | **Type:** Test | **Gate:** G0 | **Wave:** 0<br>
**Depends on:** OOS-001<br>
**Findings:** TV-02; TV-03; TV-04; TV-05<br>
**Files:** src/modules/tasks/components/SharedTaskShell.jsx; src/modules/tasks/views/oos/OosTaskView.jsx; src/modules/tasks/view-registry/taskViewRegistry.js<br>

**Acceptance criteria**

- [ ] A test imports SharedTaskShell, OosTaskView and the OOS registration module.
- [ ] The test reproduces the current compile/import defects before fixes.
- [ ] The test remains in CI as a regression guard.

**Test and evidence**

- Failing output before fix
- Passing output after OOS-005 through OOS-009

<a id="oos-004" name="oos-004"></a>

#### OOS-004 - Freeze OOS changes and define branch, flag and rollback ownership

**Owner:** Eng lead | **Estimate:** 0.5d | **Priority:** P0 | **Type:** Ops | **Gate:** G0 | **Wave:** 0<br>
**Depends on:** -<br>
**Findings:** -<br>
**Files:** docs/engineering/OOS_RECON_001_REMEDIATION_PLAN.md<br>

**Acceptance criteria**

- [ ] A feature branch is created from the verified main SHA.
- [ ] A written freeze covers template activation, seeds, provider calls and DLY-004.
- [ ] The feature flag name and rollback owner are recorded.

**Test and evidence**

- Branch SHA
- Freeze notice
- Flag and rollback note

### Epic 1 - Compile and registry

**Outcome:** The specialized shell, OOS view and registry compile when imported, register explicitly and render safely.<br>
**Gate:** G1 | **Tasks:** 6 | **Estimate:** 9.5d

<a id="oos-005" name="oos-005"></a>

#### OOS-005 - Repair SharedTaskShell structure, imports and hooks

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-003, OOS-004<br>
**Findings:** TV-02<br>
**Files:** src/modules/tasks/components/SharedTaskShell.jsx; src/modules/tasks/services/tasksApi.js<br>

**Acceptance criteria**

- [ ] Single default export; no duplicate export statements.
- [ ] All imports resolve, including the canonical tasks API module.
- [ ] Undefined symbols are implemented or removed.
- [ ] All hooks run before conditional returns.
- [ ] Shell renders with mocked task data and no console errors.

**Test and evidence**

- Unit render test
- ESLint import and rules-of-hooks check
- Import smoke test

<a id="oos-006" name="oos-006"></a>

#### OOS-006 - Repair OosTaskView and OOS child imports

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-003, OOS-004<br>
**Findings:** TV-03<br>
**Files:** src/modules/tasks/views/oos/OosTaskView.jsx; src/modules/tasks/views/oos/components/<br>

**Acceptance criteria**

- [ ] All OOS child imports resolve.
- [ ] Typography.Text replaces antd Text.
- [ ] All antd components match the installed major version.
- [ ] The view renders with mocked task and viewDefinition data.

**Test and evidence**

- Unit render test
- Module-resolution test

<a id="oos-007" name="oos-007"></a>

#### OOS-007 - Repair affected-ASIN grid rendering

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-003<br>
**Findings:** TV-04<br>
**Files:** src/modules/tasks/views/oos/components/OosAffectedAsinsGrid.jsx<br>

**Acceptance criteria**

- [ ] Invalid {80%} JSX is removed.
- [ ] The server priorityGroup renders exactly as 80%, 20% or GMS_UNVERIFIED.
- [ ] New ASIN badge appears only when isNewAsin is true.
- [ ] One default export; no duplicate definitions.
- [ ] Sort and filter props pass through without client-side recomputation.

**Test and evidence**

- Snapshot tests for all groups
- New ASIN badge test

<a id="oos-008" name="oos-008"></a>

#### OOS-008 - Register the OOS view explicitly at boot

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-005, OOS-006, OOS-007<br>
**Findings:** TV-05<br>
**Files:** src/modules/tasks/views/oos/index.js; src/modules/tasks/view-registry/taskViewRegistry.js<br>

**Acceptance criteria**

- [ ] Application boot explicitly imports the OOS registration module.
- [ ] getRegisteredViews() includes OOS_RECON_V1 after boot.
- [ ] No unreachable side-effect registration remains.
- [ ] Duplicate registration logs and fails safely.

**Test and evidence**

- Registry unit test
- Boot-order test

<a id="oos-009" name="oos-009"></a>

#### OOS-009 - Normalize view definitions and add safe fallbacks

**Owner:** Frontend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Frontend | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-008<br>
**Findings:** TV-05<br>
**Files:** src/modules/tasks/view-registry/taskViewRegistry.js; src/modules/tasks/components/SharedTaskShell.jsx<br>

**Acceptance criteria**

- [ ] View definitions are schema-validated for viewKey, version, tabs and widgets.
- [ ] Unknown keys fall back to STANDARD_V1 with a visible warning.
- [ ] Remote code or unvalidated JSON is rejected.
- [ ] The resolved definition is pinned to the instance snapshot version.

**Test and evidence**

- Malformed JSON test
- Unknown view test
- Fallback test

<a id="oos-010" name="oos-010"></a>

#### OOS-010 - Add frontend unit and registry regression tests

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Test | **Gate:** G1 | **Wave:** 1<br>
**Depends on:** OOS-005, OOS-006, OOS-007, OOS-008, OOS-009<br>
**Findings:** TV-02; TV-03; TV-04; TV-05; QA-01<br>
**Files:** src/modules/tasks/; tests/<br>

**Acceptance criteria**

- [ ] Tests cover shell fallback, OOS render, grid groups, invalid definition and duplicate registration.
- [ ] Tests run in CI and fail on the pre-fix branch.

**Test and evidence**

- Unit test suite
- CI job output

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
**Findings:** RUN-01<br>
**Files:** backend/services/oos/oosMonitoringService.js; backend/controllers/pems/taskViewController.js; backend/migrations/035_oos_task_scoped_runs.js<br>

**Acceptance criteria**

- [ ] createOrGetRun is exported and idempotent inside a transaction.
- [ ] Migration 035 adds task-scoped uniqueness and handles legacy null bindings.
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

**Acceptance criteria**

- [ ] Migration 037 adds request, dispatch, provider, completion and failure metadata.
- [ ] Existing jobs are backfilled without inventing timestamps.
- [ ] A rollback script is present.

**Test and evidence**

- Migration forward/rollback
- Backfill report

<a id="oos-032" name="oos-032"></a>

#### OOS-032 - Fix resync verification and incident resolution

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-031, OOS-027<br>
**Findings:** SY-01<br>
**Files:** backend/services/oos/oosSyncService.js; backend/services/oos/oosIncidentService.js<br>

**Acceptance criteria**

- [ ] @channel is bound and row access is correct.
- [ ] Freshness requires observation time greater than persisted request time.
- [ ] Scope includes seller, channel, ASIN and marketplace.
- [ ] D8 resync timeout, retry and rate-budget values are recorded.
- [ ] Failure, timeout or unknown leaves the incident open.
- [ ] Resolution is idempotent and recorded once.

**Test and evidence**

- Stale/equal/fresh tests
- Provider failure test
- Duplicate verify test

<a id="oos-033" name="oos-033"></a>

#### OOS-033 - Show real resync states and actions in the UI

**Owner:** Frontend | **Estimate:** 1d | **Priority:** P1 | **Type:** Frontend | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-032<br>
**Findings:** UX-01<br>
**Files:** src/modules/tasks/views/oos/components/<br>

**Acceptance criteria**

- [ ] UI shows queued, running, verified, open, failed and timeout states.
- [ ] Request and verify actions are permission-aware.
- [ ] Failure reason and timestamps are visible.
- [ ] No placeholder actions remain.

**Test and evidence**

- Component tests for each state

<a id="oos-034" name="oos-034"></a>

#### OOS-034 - Add resync evidence and failure tests

**Owner:** QA | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Test | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-032, OOS-033<br>
**Findings:** SY-01; QA-01<br>
**Files:** backend/__tests__/; tests/<br>

**Acceptance criteria**

- [ ] Stale, equal, fresh, failure, timeout and duplicate tests pass.
- [ ] An unbound-channel regression test exists.
- [ ] No false recovery occurs across sellers or channels.

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

**Acceptance criteria**

- [ ] Four sheet names and columns are approved: 01 Active OOS, 02 Discrepancies, 03 Resync Resolved, 04 Summary & Sources.
- [ ] D5 export scope, retention, storage location and PII handling are recorded.
- [ ] Audit fields are specified.

**Test and evidence**

- Signed contract

<a id="oos-036" name="oos-036"></a>

#### OOS-036 - Store immutable exports and task binding (migration 038)

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Migration | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-035<br>
**Findings:** EX-01<br>
**Files:** backend/migrations/038_oos_export_storage.js; backend/services/oos/oosExportService.js<br>

**Acceptance criteria**

- [ ] Migration 038 adds safe storage metadata and non-null task binding after backfill.
- [ ] Exports persist immutable bytes or complete serialized rows.
- [ ] File hash, size, name and path are accurate; taskInstanceId is inserted and validated.
- [ ] Version allocation awaits the pool and is race-safe.

**Test and evidence**

- Migration forward/rollback
- Persistence integration test

<a id="oos-037" name="oos-037"></a>

#### OOS-037 - Fix export download by authorized export ID and verify hash

**Owner:** Backend | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G5 | **Wave:** 3<br>
**Depends on:** OOS-036<br>
**Findings:** EX-01<br>
**Files:** backend/services/oos/oosExportService.js; backend/controllers/pems/taskViewController.js<br>

**Acceptance criteria**

- [ ] Download looks up by authorized exportId and task binding.
- [ ] Stored bytes are streamed without rebuilding placeholders.
- [ ] Hash is verified before send.
- [ ] Cross-task or export-ID substitution is denied.

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

**Acceptance criteria**

- [ ] Formula injection is neutralized for CSV and XLSX.
- [ ] Cell length and sheet-name limits are enforced.
- [ ] Export audit records actor, filters, hash and version.
- [ ] CSV and XLSX buttons perform real downloads.

**Test and evidence**

- Formula-injection test
- Audit assertion
- UI action test

<a id="oos-039" name="oos-039"></a>

#### OOS-039 - Add export byte, hash and scope tests

**Owner:** QA | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Test | **Gate:** G5 | **Wave:** 4<br>
**Depends on:** OOS-036, OOS-037, OOS-038<br>
**Findings:** EX-01; QA-01<br>
**Files:** backend/__tests__/; tests/<br>

**Acceptance criteria**

- [ ] Downloaded SHA-256 equals the stored hash.
- [ ] Four sheets and exact row counts/filters match the database.
- [ ] An empty result set produces a valid workbook.
- [ ] Unauthorized and cross-task export access is denied.

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

**Acceptance criteria**

- [ ] Migration 039 separates reviewer assignment from reviewer decision.
- [ ] D4 reviewer independence and delegation rules are recorded.
- [ ] Independence and waiver fields are defined.
- [ ] Existing submissions are backfilled without granting approval.
- [ ] A rollback script is present.

**Test and evidence**

- Migration forward/rollback
- Backfill assertion

<a id="oos-041" name="oos-041"></a>

#### OOS-041 - Fix submission and integrate the PEMS review queue

**Owner:** Backend | **Estimate:** 2.5d | **Priority:** P0 | **Type:** Backend | **Gate:** G6 | **Wave:** 4<br>
**Depends on:** OOS-040<br>
**Findings:** RV-01<br>
**Files:** backend/services/oos/oosSubmissionService.js; backend/services/pems/<br>

**Acceptance criteria**

- [ ] Submission succeeds with an assigned independent reviewer.
- [ ] A null reviewerId no longer blocks a valid submission.
- [ ] The PEMS review queue receives the review task.
- [ ] Audit records submission and decision actors.

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

**Acceptance criteria**

- [ ] Closure requires approval, required evidence and no open unresolved incident.
- [ ] D9 waiver authority, duration and evidence requirements are recorded.
- [ ] Waivers require an authorized actor, reason and expiry.
- [ ] EvidenceRequired is enforced server-side.
- [ ] Every transition is audited.

**Test and evidence**

- Closure gate matrix
- Waiver tests
- Evidence-required test

<a id="oos-043" name="oos-043"></a>

#### OOS-043 - Add submission, review and closure tests

**Owner:** QA | **Estimate:** 1.5d | **Priority:** P0 | **Type:** Test | **Gate:** G6 | **Wave:** 4<br>
**Depends on:** OOS-041, OOS-042<br>
**Findings:** RV-01; QA-01<br>
**Files:** backend/__tests__/; tests/<br>

**Acceptance criteria**

- [ ] Tests cover no reviewer, self-review, unauthorized reviewer, missing evidence and open incident.
- [ ] Approval, rejection, waiver and closure paths are covered.

**Test and evidence**

- Integration suite
- E2E review scenario

### Epic 8 - UI integration

**Outcome:** OOS is usable from Task List and My Day while DLY-004 and generic tasks remain unchanged.<br>
**Gate:** G7 | **Tasks:** 6 | **Estimate:** 13.5d

<a id="oos-044" name="oos-044"></a>

#### OOS-044 - Add the feature flag and resolver wiring to both entry points

**Owner:** Frontend | **Estimate:** 2d | **Priority:** P0 | **Type:** Frontend | **Gate:** G7 | **Wave:** 4<br>
**Depends on:** OOS-010, OOS-016<br>
**Findings:** TV-01<br>
**Files:** src/pages/TaskInstancesPage.jsx; src/pages/MyDayPage.jsx; src/modules/tasks/components/SharedTaskShell.jsx<br>

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
**Files:** backend/__tests__/fixtures/; tests/<br>

**Acceptance criteria**

- [ ] Seven sellers with zero, positive, null, stale and conflicting stock exist.
- [ ] GMS verified, missing and zero, plus New ASIN and brandless cases, are covered.
- [ ] Seed and reset are deterministic and use no production data.

**Test and evidence**

- Fixture validation
- Reset test

<a id="oos-051" name="oos-051"></a>

#### OOS-051 - Wire required CI quality gates

**Owner:** DevOps | **Estimate:** 2d | **Priority:** P0 | **Type:** Ops | **Gate:** G8 | **Wave:** 5<br>
**Depends on:** OOS-016, OOS-030, OOS-034, OOS-039, OOS-040, OOS-043, OOS-049<br>
**Findings:** QA-01<br>
**Files:** .github/workflows/ci.yml; package.json; backend/package.json<br>

**Acceptance criteria**

- [ ] Lint, typecheck, build, unit, integration, E2E and migration checks are required.
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
