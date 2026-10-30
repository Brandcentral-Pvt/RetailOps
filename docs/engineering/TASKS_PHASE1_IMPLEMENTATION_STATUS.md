# RetailOps Tasks 2.0: Phase 1 Development Completion

**Milestone:** Phase 1 backend correctness  
**Development status:** COMPLETE (subject to ordinary PR review)  
**Repository:** `Brandcentral-Pvt/RetailOps`  
**Branch:** `fix/tasks-phase1-correctness`  
**PR:** #210  
**Base:** `26ffa0c5423501e5ddaf96f9b45c363b4cdcd472`

This record defines development scope only. It makes no claim that production has been deployed, historical task data backfilled, a live SQL Server tested, or experimental OOS reconciliation activated.

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

**GitHub Actions:** Tasks Phase 1 Correctness, run `41020445693`, commit `30e2bee12ece5d5ccdae59e5b27e1a159bba1c44`.

- Backend syntax checks: PASSED.
- Backend Jest: **12 suites passed, 131 assertions passed**.
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
