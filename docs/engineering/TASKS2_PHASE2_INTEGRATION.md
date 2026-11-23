# RetailOps Tasks 2.0 Phase 2 Integration

Date: 2026-11-23

## Branch and review
- Base: `feat/tasks2-production-phase1-20261123`, PR #250.
- This implementation: `feat/tasks2-production-phase2-20261123`, PR #252.
- These are stacked drafts. Do not merge the Phase 2 branch directly into main while Phase 1 is pending independent review.

## Implemented scope

Phase 2.1: a bounded, declarative `schemaVersion: 2.0` workflow format with trusted activity types, validators, field constraints, previous-field conditional references and a read-only workflow validation endpoint. Uses existing PEMS templates and published view-definition metadata.

Phase 2.2: migration `042_pems_workflow_v2_activity_outputs.js` is additive and idempotent. Existing `PemsSubTasks` and `PemsActivities` receive stable workflow keys, typed output JSON and optimistic output revision fields. There is no second workflow table. When explicitly activated on a migrated test database, `createInstance` pins the published workflow and materializes all steps within the existing task creation transaction. Clients cannot replace the pinned SOP with arbitrary request steps.

Existing endpoints:
- `POST /api/pems/templates/workflow/validate`: `tasks_manage` only, no database mutation.
- `GET /api/pems/instances/:id/workflow`: task view permission and seller scope.
- `PUT /api/pems/instances/:id/activities/:activityId/output`: executor permission, task and child identity validation, typed validation, expected revision, transactional audit.

Completion checks validate persisted output and activity-linked evidence. Server-side V2 writes fail closed when execution flags are disabled. The existing guided task registry is extended only for trusted local activity renderers. Existing OOS and legacy task flows must remain intact.

## Flag and migration gates

Before enabling V2 on a disposable/staging SQL Server, confirm successful application of migrations **033, 034, 035 and 042** and run a new snapshot and permission verification. All flags default off:

```env
PEMS_PIN_VIEW_SNAPSHOTS=false
PEMS_STRICT_ACTIVITY_GATES=false
PEMS_V2_EXECUTION_ENABLED=false
```

Enable them together only for isolated staging acceptance. Do not activate against production on this branch.

## Unsupported in this increment

- Conditional V2 workflows that contain `visibleWhen` are **preview-only** and deliberately rejected at publication and execution. They must not be represented as executable templates until Phase 2.3 implements atomic visibility, skip, reopen, and correct progress semantics.
- A guided task UI for typed V2 outputs is **not yet implemented**. The main-line `GUIDED_V1` components exist but have a different contract. Phase 2.4 must integrate the typed V2 contract into first-party activity renderers, with save conflict recovery and responsive interaction.
- The adaptive employee worklist from historical PR #213 is not copied over the current Operations Center without further acceptance testing.
- No staging database migration, backfill, seller data change, or production release occurred.

## Acceptance and test expectations

- Publish only valid, executable unconditional V2 layouts when all gates are enabled.
- Verify frozen view identity, legacy fallbacks, seller isolation, role-specific authorization and activity-linked evidence.
- Verify idempotent revision updates, two concurrent writers, duplicate retry, malformed output, and cross-task forged activity IDs.
- Run `.github/workflows/tasks2-phase2.yml` with backend route/unit tests, registry tests, Vite production build, and an isolated real SQL Server integration for migration 042.
- Also rerun the Phase 1 acceptance suites and OOS browser regressions before production merge.
- After Phase 2.3 and 2.4, require browser E2E for at least two distinct workflow categories, approval through review and rollback rehearsal.

## Status

Phase 2.1 and 2.2 development integration passed targeted CI at run `45124493401`:
- 11/11 backend Jest suites, 89/89 tests.
- 1/1 real SQL Server integration test.
- Frontend registry and Vite build.

Registry follow-up commit adds explicit local renderer registration and its unit test, requiring a fresh CI run. This document does not constitute production approval.

## Final expanded integration regression

At Phase 2 code commit `aadef310e4c183525d6269d10bad832985e303fc`, [workflow run 45124907603](https://github.com/Brandcentral-Pvt/RetailOps/actions/runs/45124907603) passed both jobs. Backend: **18/18 suites and 195/195 tests passed** (including Phase 1 route/authorization regressions and Phase 2 typed-output tests). Frontend registry: **11 tests passed**. Vite production build: **passed**. Disposable SQL Server: **1/1 migration and CAS integration test passed**. PR #252 remains a draft stacked on PR #250; neither was deployed.
