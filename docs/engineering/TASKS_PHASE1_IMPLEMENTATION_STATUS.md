# Tasks Phase 1: Implementation and Release Gate Report

Branch: `fix/tasks-phase1-correctness`  
Draft pull request: #210  
Base commit: `26ffa0c5423501e5ddaf96f9b45c363b4cdcd472`  
Status: **Source implementation substantially complete; not merged, not deployed, not authorized for production activation.**

## Implemented within existing RetailOps PEMS architecture

1. Transaction-scoped activity evidence validation, mandatory step checks, phase readiness, brand and submission gates, task-level locking, idempotent completions, and consistent persisted progress.
2. Reused existing `pemsService`, `PemsTaskInstances`, `PemsActivities`, `PemsSubTasks`, `PemsEvidence`, `PemsTaskBrands` and audit records rather than creating a second engine.
3. Existing task instance creation can pin a published template view definition and frozen snapshot in its creation transaction; `PEMS_PIN_VIEW_SNAPSHOTS` defaults to off pending migration 033 and staging compatibility checks.
4. Executor, reviewer and direct transition authorization separated at the backend access layer; standalone review-status transitions are denied; review decisions use the atomic review service.
5. Corrected frontend task API contract mismatches for status transitions, brand completion, ASIN remarks/resolution, and bulk transition.
6. Corrected frontend task-specific RBAC implicit category wildcard escalation.
7. Standardized structured PEMS validation error details in relevant controller responses.
8. Replaced Jest 25 with Jest 29 in backend dependencies and committed a matching package lockfile for deterministic `npm ci`.

## Verification evidence

GitHub Actions run `41017796747` (Jest 29 test runner, before final committed lockfile):
- Eight selected PEMS correctness and route suites passed.
- **114 assertions passed, 0 test assertion failures**.
- Backend syntax checks and dependency installation passed.
- Frontend typecheck subsequently failed on pre-existing TypeScript errors in `DataVisualizationCharts.tsx`, `useDashboardOrchestration.ts`, and `DashboardV2.tsx`, none of which this PR changes.

OOS regression job `41017796907`:
- OOS smoke/registry and three browser tests passed.
- One OOS grid browser test failed: the fixture's root remained empty; expected `Nova Retail LLC`. Preserve this failure for investigation. No OOS production state was changed.
- This does not establish that the OOS experimental template is ready for activation.

The final PR head must be rechecked in Actions for full reproducibility after lockfile update. Do not claim full CI green or production readiness.

## Feature flags and compatibility

`PEMS_STRICT_ACTIVITY_GATES=true` enables strict evidence, phase, submission, and transactional progress rules. Disabled by default.

`PEMS_PIN_VIEW_SNAPSHOTS=true` pins published view definitions to newly created task instances. Disabled by default until schema/application compatibility is verified.

**Do not enable either flag in production without a staging restore, representative active-task regression tests, and an approved rollout plan.**

Legacy task-level evidence is not automatically equivalent to required activity-level evidence. If proof is stored without `ActivityId`, strict checks may block a legitimate task until evidence is properly linked. The template schema's conditional and optional activity semantics are deferred to the versioned workflow engine. Do not silently waive evidence requirements.

## Remaining release blockers, not silent TODOs

1. Verify final-commit GitHub Actions run, including the committed lockfile.
2. Resolve or explicitly baseline existing unrelated frontend TypeScript failures via a separate focused PR; do not weaken typechecking to claim success.
3. Diagnose the failing OOS grid regression separately; the contained `OOS-RECON-001` remains deactivated, and `DLY-004` unchanged.
4. Obtain local/staging database evidence that migration 033 and 034 exist and that all read/write/permission paths work under representative existing templates.
5. Reconcile historical tasks that have missing activity-linked evidence, stale phase flags, or no view snapshots before enabling strict gates.
6. Complete a staging dry run of employee submit, reviewer approval/reject, multi-brand routine, concurrent activity writes, rollback and feature-flag toggles.
7. Confirm no unauthorized task or seller access and that no task data, assignments, reviewer decisions, or audit events were lost.

**Release decision:** Remain a draft PR. Phase 1 implementation can be reviewed, but it is not safely releasable until the checks above pass.

## Phase 2 exclusion

No Task Management 2.0 UI redesign, dedicated manager workspace, conditional renderer engine, OOS activation, production backfill, or legacy frontend deletion is part of this PR. Those remain subsequent phases.
