# RetailOps Tasks 2.0: Phase 1 Development Completion

**Milestone:** Phase 1 backend correctness  
**Development status:** P1 and P2 fixes verified by Phase 1 CI; independent re-audit pending  
**Repository:** `Brandcentral-Pvt/RetailOps`  
**Branch:** `fix/tasks-phase1-correctness`  
**PR:** #210  
**Base:** `26ffa0c5423501e5ddaf96f9b45c363b4cdcd472`

This record defines development scope only. It makes no claim that production has been deployed, historical task data backfilled, a production database tested, or experimental OOS reconciliation activated. The phase-readiness query was executed against an ephemeral SQL Server 2022 container.

## 0. Response to independent re-audit of commit 826699ab

The earlier Phase 1 completion claim was withdrawn. Three P1 defects were confirmed and fixed on the same PR:

| Finding | Source fix | Regression evidence |
| --- | --- | --- |
| Cross-seller activity and phase completion using a forged taskInstanceId | `pemsAccess.resolveTaskId` resolves the real PemsActivities / PemsSubTasks parent first, rejects mismatched body claims, then checks the actual task's seller and executor scope | `pemsChildAuthorization.test.js` covers forged body IDs, missing child, legitimate calls, and strict gates both on and off |
| SQL Server aggregate of a correlated subquery inside SUM(CASE ...) | `taskExecutionGates.assertPhaseReady` uses OUTER APPLY TOP(1) evidence lookup and aggregates ordinary scalar columns | `taskExecutionGates.test.js` plus `pemsPhaseGateSqlServer.test.js` against disposable SQL Server 2022 with missing, duplicate and valid evidence |
| Generated fallback view has invalid definitionVersion: 0 | `taskInstanceSnapshot.DEFAULT_VIEW` now uses 1, and `taskViewDefinitionService` permits only the exact old generated v0 shape without a published ViewDefinitionId | `taskViewDefinitionLegacy.test.js` checks round trip, old fallback compatibility and invalid/malicious v0 rejection |

All three corrections are independent of production activation flags. No production data modifications or OOS template activation were made.

**Verification:** GitHub Actions run `41023867794`, commit `62c51ce6d787133ef09283e1409f860f34cbae6c`: 13 backend suites, 156 tests passed, frontend Vite build passed, task registry 10 tests passed, and the isolated SQL Server integration job passed.

**Important separate repository problem:** Both `main` and this PR contain an inconsistent backend `package-lock.json` graph for `jsonwebtoken` that omits `jws`. SQL Server integration uses an isolated `mssql` installation to test the actual query despite that pre-existing packaging defect. This does not validate the full production database stack; track the lockfile issue separately and do not confuse the green scoped checks with a full deployment qualification.

## P2. Publication metadata identity audit (October 30)

An independent re-audit at `d72e07e` confirmed that the three previous P1 blockers
were fixed but reproduced a P2 issue: view creation accepted outer metadata
`definitionVersion=2` with JSON `definitionVersion=1`; publication accepted the
draft; subsequent instance pinning returned `409 TASK_VIEW_INVALID`.

**Correction in this PR:**
- One pure `validateDefinitionIdentity` helper combines JSON schema checks and
  exact equality of `viewKey`, `schemaVersion`, and `definitionVersion`.
- `createViewDefinition()` rejects mismatched metadata with HTTP 400
  `INVALID_DEFINITION_IDENTITY` *before any SQL write*.
- `publishViewDefinition()` locks the stored row with `UPDLOCK, HOLDLOCK` in
  the same transaction as publication, validates persisted JSON against the SQL
  metadata, and rejects mismatched drafts with HTTP 409
  `INVALID_DEFINITION_IDENTITY` without updating status.
- Even an already-published but inconsistent historical definition does not pass
  through the idempotent publication path; corrupted rows must be reviewed
  separately rather than silently rewritten.
- Task pinning and reading a pinned definition without a snapshot reuse this
  identity validation, including `schemaVersion`.
- Publication checks the state is `DRAFT` and checks its affected row count.
  Its response now agrees on `Status` and `status`.

**Regression:** `backend/__tests__/unit/taskViewPublicationIdentity.test.js`
executes the concrete create → publish → pin sequence and checks each mismatch
independently, malformed JSON, corrupted already-published definitions, an
idempotent valid publish, invalid status, and a lost-update conflict. The
existing snapshot and creation fixtures use the real shared validator and
complete SQL row metadata.

No migration, task rescheduling, OOS activation, or production data change was
performed. Existing inconsistent published definitions, if any, are deliberately
not mutated by this PR and remain subject to a later read-only data audit.

**Final development verification for this P2 fix:** GitHub Actions run
`41030288966` against `4f295bec6f690d2c98035d206215d476923eef81`
passed both Phase 1 jobs: 14 backend Jest suites (171 tests), one isolated
SQL Server integration test, the frontend Vite build, and 10 task view registry
tests. The separate OOS regression lane remains failing, and unrelated
Dashboard V2 TypeScript diagnostics remain visible but non-blocking for Tasks
Phase 1. No independent re-audit has yet approved the P2 change.


## 1. Existing implementation rebuilt, not duplicated

All Phase 1 work extends existing PEMS services and Tasks pages. No parallel task database, duplicate execution API, or replacement backend workflow engine has been introduced.

### Backend functionality implemented

| Contract | File(s) | Development acceptance |
| --- | --- | --- |
| Activity completion | `taskExecutionGates.js`, `pemsService.js` | Checks task status, mandatory evidence and activity ID; updates idempotently inside a transaction |
| Phase completion | Same | Prevents mandatory-incomplete phases from being marked done |
| Submission and resubmission | Same | Blocks pending required activities, phases, assigned brands and missing activity proof |
| Review approval | `pemsService.js`, `pemsPolicy.js` | Prevents self-review, checks independent reviewer authority and validates completeness in strict mode |
| Review rejection | Same | Permits an authorized reviewer to send incomplete work back for rework |
| Progress consistency | `taskExecutionGates.js`, `pemsService.js` | Counts mandatory activities and assigned brands; respects weighted phase progress; administrative rebuild shares the algorithm in strict mode |
| Concurrency and retries | Same | Locks parent task for strict writes, guards duplicate activity/phase completion and evidence upload |
| Evidence ownership | `pemsService.js`, `pemsController.js` | Requires task/phase/activity linkage and prevents cross-task evidence binding |
| Template view versioning | `taskInstanceSnapshot.js`, `taskViewDefinitionService.js` | Pins published view JSON with new task instances in the creation transaction, validates reads and keeps historical unpinned instances on a safe fallback |
| Role separation | `pemsAccess.js`, `pemsPolicy.js`, `pemsRoutes.js` | Executor writes and reviewer decisions are separate capabilities; direct review-state bypass is disallowed |
| API contracts | `tasksApi.js`, `pemsController.js` | Correct transition, brand checklist, bulk review, ASIN remarks and resolve request paths and payloads |
| Task UI compatibility | `TaskWorkspace.jsx` | Existing drawer can link evidence to individual activities, display structured validation errors and show persisted zero-safe progress |
| Frontend RBAC | `rbac.js` | Removes accidental category-wide wildcard escalation |

These are Phase 1 **generic execution invariants**, not template-specific business outcome validators. A checklist completion does not establish an ASIN's inventory recovery or marketplace success.

### Development switches

```env
PEMS_STRICT_ACTIVITY_GATES=false
PEMS_PIN_VIEW_SNAPSHOTS=false
```

Explicitly set either switch to `true` on an appropriately migrated development database to exercise the new behavior. The strict flag remains opt-in because existing task-level evidence may lack an `ActivityId`. That is a rollout compatibility constraint, not an incomplete development function.

Migrations `033` and `034` must already exist for the snapshot and EvidenceRequired columns. Phase 1 does not add new schema or mutate historical task records.

## 2. Verified development CI

**GitHub Actions:** Tasks Phase 1 Correctness, run `41023867794`, commit `62c51ce6d787133ef09283e1409f860f34cbae6c`.

- Backend syntax checks: PASSED.
- Backend Jest: **13 suites passed, 156 tests passed**.
- Real ephemeral SQL Server 2022 phase-gate query and evidence scenarios: PASSED.
- Frontend `npm run build`: PASSED (Vite 8.3.5).
- Task registry `npm run test:task-registry`: **10 tests passed**.
- Main Phase 1 check: **SUCCESS**.
- Full repository `npm run typecheck`: still reports existing Dashboard V2 chart and orchestration type errors outside `src/modules/tasks`. This diagnostic remains visible but does not gate the Tasks-specific correctness milestone.
- OOS Regression runs are an independent test lane. Historical OOS experimental workflow problems remain excluded from this PEMS Phase 1 change.

The CI workflow is scoped to Tasks correctness, without suppressing the repository's unrelated TypeScript errors.

## 3. Development acceptance matrix

| Invariant | Evidence |
| --- | --- |
| Missing evidence blocks completion | `pemsPhase1Evidence.test.js`, `taskExecutionGates.test.js` |
| Complete activity and phase work is idempotent | `taskExecutionGates.test.js` and scoped service guards |
| Incomplete submission blocks | `taskExecutionGates.test.js` |
| Incomplete approval blocks; rejection can return work | `pemsPhase1ReviewGate.test.js` |
| Executor cannot approve own task | `pemsPolicy.test.js`, `pemsExecutionRoles.test.js` |
| Cross-seller and cross-task writes are rejected | `pemsExecutionRoles.test.js`, `pemsPhase1Evidence.test.js`, `pemsSellerScope.test.js` |
| New instances bind published view definition | `taskInstanceSnapshot.test.js`, `pemsPhase1Instance.test.js` |
| Old tasks do not silently inherit new published views | `taskViewDefinitionLegacy.test.js` |
| Partial task and brand progress does not reset to zero | `taskExecutionGates.test.js`, `pemsProgressRebuild.test.js` |
| Frontend integrates without compile errors | Vite build and task registry run |

## 4. Phase 1 out-of-scope, not blockers for development completion

The following are explicitly reserved for later phases or rollout validation, rather than being mislabeled as unfinished Phase 1 code:

- **Phase 2:** Declarative activity types, conditional branches, allowed `validatorKey` catalog, typed activity outputs, reusable template execution schema and official guided renderer.
- **Phase 3 onward:** Employee My Work redesign, manager operations workspace, final shadcn-only cutover, and deletion of legacy Tasks UI and CSS after migration parity.
- **OOS work:** No activation or source/data repair of `OOS-RECON-001`, no modification to `DLY-004`, and no changes to the historical OOS evidence and binding artifacts.
- **Deployment:** Staging database rehearsal, real production flag activation, historical data compatibility/backfill, infrastructure monitoring and operational sign-off.
- **Other modules:** Dashboard V2 TypeScript errors and separate OOS fixture browser tests require independent work.

## 5. Handoff to Phase 2

Phase 2 must extend the existing `TemplateBuilder`, `taskViewRegistry`, `taskViewDefinitionService`, `TaskViewResolver`, and PEMS APIs rather than introducing a parallel engine.

Implement the typed, versioned template schema; renderer registry; output validation catalog; conditional/optional activities; immutable execution snapshots; and developer test fixtures. Preserve the existing lifecycle and evidence records.

**No Phase 2 implementation or UI-wide deletion is part of PR #210.**
