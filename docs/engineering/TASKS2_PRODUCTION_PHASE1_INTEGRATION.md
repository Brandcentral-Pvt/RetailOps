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
