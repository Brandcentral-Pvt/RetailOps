# Tasks 2.0: Production Phase 1 Integration Contract

Date: 2026-11-23

## Scope and baseline

This branch starts at main commit `33a01c3258bb0ce4f963b6bc2e276396dc83e40b`. It is an integration safety baseline, **not** a claim that Tasks 2.0 has been merged or is ready for production.

Protect all current main-line behavior: Operations Center routes, guided task renderers, OOS source upload/resync/export APIs, seller authorization, existing task records, and live sync services.

## Actual branch status (verified by GitHub comparison)

- PR #210 (`fix/tasks-phase1-correctness`) is still draft and diverged from main: 84 commits ahead, 4 behind.
- PR #212 (`feat/tasks-phase2-template-engine`) is stacked on #210 and is still draft.
- PR #213 adaptive worklist was merged into the #212 feature branch, not directly into main.
- Current main already includes `GuidedTaskView.jsx`, eight local activity renderers, and `backend/migrations/035_conditional_workflow_v2.js`. **Do not copy older versions over these.**
- Shared modification hotspots: `backend/services/pems/pemsService.js`, `backend/services/pems/taskViewDefinitionService.js`, `src/modules/tasks/services/tasksApi.js`, and `src/modules/tasks/view-registry/taskViewRegistry.js`.

## Phase 1 release gates

1. Resolve all overlapping code against current main, not against an older main commit.
2. Restore/verify parent-child authorization, SQL Server phase gates, immutable task-view snapshots, and matched view publication metadata from PR #210.
3. Bring in the Phase 2 workflow schema and output persistence **only after** Phase 1 has passed independent review.
4. Preserve the main-line guided view and compare it against the Phase 2 activity renderer contract instead of creating a second task engine.
5. Re-run backend unit/route suites, task registry, planner, Vite build, SQL Server migration tests, and browser integration tests.
6. Confirm additive migrations 033, 034, 035 and 042 are ordered and idempotent; test on disposable/staging SQL Server before activation.
7. Keep `PEMS_PIN_VIEW_SNAPSHOTS`, `PEMS_STRICT_ACTIVITY_GATES`, and `PEMS_V2_EXECUTION_ENABLED` off until required migrations and explicit staging acceptance.
8. No backfill, production data deletion, feature-flag activation, or deployment in this phase.
9. Verify all task access through seller-scoped backend authorization, including cross-task identifiers and user-submitted evidence.
10. Explicitly test cross-version frozen snapshots, old V1 tasks, OOS task rendering, conditional progress, and save conflicts.

## Security blocker discovered during integration audit

The **public** repository currently tracks files under `private/oos_uploads/`. Treat these as potentially sensitive seller uploads pending classification. Restrict public access/rotate affected secrets if needed, inventory file contents with authorized security staff, remove tracked uploads from the index and history via an approved incident response, and prevent future commits. Adding a .gitignore entry by itself **does not unpublish or untrack** existing files. Do not copy their contents into audit logs, PR comments, or CI artifacts.

## CI note

`.github/workflows/tasks2-integration-baseline.yml` introduces reproducible build and existing-task test gates on relevant PRs. Its own check results, when available, must be inspected before approving any merge. A green baseline alone is **not** a production sign-off.

## Intended follow-on sequence

1. Reconcile Phase 1 against current main with targeted source edits and regression coverage.
2. Integrate Phase 2 activity persistence and schema with the already-present guided UI.
3. Resolve remaining conditional execution, progress and snapshot correctness.
4. Run staging E2E and make a separate production rollout decision.


## Phase 1 source reconciliation: implementation and CI verification

**Implementation branch:** `feat/tasks2-production-phase1-20261123`. **Review PR:** #250, still draft. The Phase 1 application code was ported onto contemporary `main`, retaining main-line `GUIDED_V1`, OOS views, and the newer conditional workflow code.

Implemented and regression-tested:
- Strict-mode parent-child authorization derived from database task parent; separate executor/reviewer/transition gates, including bulk paths.
- Published task view identity validation on create, transactionally locked publish, and direct-publish rejection. Existing `GUIDED_V1` registry support retained.
- Immutable view snapshot pinning during task creation; invalid/missing explicit pins rejected and historical unpinned tasks remain on legacy behavior until opted in.
- Transaction-scoped activity, phase, brand, review and submission gates; evidence ownership checks and idempotent evidence retries.
- Backend Jest upgraded to 29.7.0 for Node 22 and Express 5 compatibility; `puppeteer-extra` upgraded to 3.3.6 and backend npm lockfile regenerated and clean-install verified.
- Frontend OOS browser fixture contracts corrected to mount Radix TooltipProvider and mock the actual server response envelope. No production OOS logic was changed by these fixture fixes.
- Temporary workflow with contents-write permission used to regenerate the lockfile was removed immediately afterward.

### Verified GitHub Actions evidence

At code commit `6e6b657a08a7808ffadf2186d88e2a930cb972ee`:
- [Tasks 2 Production Integration Baseline, run 45122870915](https://github.com/Brandcentral-Pvt/RetailOps/actions/runs/45122870915): **frontend SUCCESS, backend SUCCESS, SQL Server SUCCESS**.
- Backend route and unit regressions: **12/12 suites, 150/150 tests passed**, also confirmed on the previous successful code commit, run 45122536401.
- Disposable SQL Server integration: **1/1 passed**.
- Frontend: dependency installation, task registry checks, planner checks and Vite production build passed.
- [OOS Regression, run 45122870952](https://github.com/Brandcentral-Pvt/RetailOps/actions/runs/45122870952): **SUCCESS**, including OOS import, registry and browser render checks.

### Release boundary after Phase 1

Phase 1 branch implementation and automated CI validation are complete. This does **not** represent a production rollout or approval to enable strict gates. The PR stays draft pending an independent source review, safe staging database migration, operational approval and production rollback drill.

Follow-on operational gates before release:
1. Recompare the branch against latest `main` (which has moved since this integration started), resolve any new changes without overwriting app code.
2. Verify real staging migration state and replay task creation, conditional activity, evidence, review and legacy task flows on staging data.
3. Triage the previously committed `private/oos_uploads/` seller files exposed in the public Git history through an authorized security incident process. A .gitignore rule prevents newly untracked uploads only, not existing commits.
4. Do not merge PR #212 or enable `PEMS_V2_EXECUTION_ENABLED` until Phase 2 workflow schema/output contracts are independently integrated and tested against the current main-line guided renderer.
