# RetailOps Tasks 2.0: Phase 2 Template Workflow Engine

**Branch:** `feat/tasks-phase2-template-engine`  
**PR:** stacked on `fix/tasks-phase1-correctness` (Phase 1 PR #210)  
**Current development stage:** Phase 2.1, workflow contract and safe preview, **not** the complete execution engine.

## Purpose

Reuse PEMS task instances, activity records, template view definitions, the
existing task view registry and the existing Tasks API client. Do **not**
introduce a second task database, a parallel workflow engine, or a completely
different task application. The destination is a single server-authoritative
versioned template engine with template-specific steps and typed activity
outputs. The separate employee UI and operations manager UI are later phases.

## Implemented in Phase 2.1

- `backend/services/pems/templateWorkflow.js`:
  - Safe JSON-only schema `2.0` with ordered phases, stable keys and typed
    activities.
  - Trusted activity types: `CHECKLIST`, `FORM_INPUT`, `SELECT_SOURCE`,
    `DATA_REVIEW`, `TABLE_REVIEW`, `FILE_UPLOAD`, `COMMUNICATION`,
    `EVIDENCE_REVIEW`.
  - Explicit input fields: `text`, `number`, `boolean`, `select`, `date`,
    `url`. Defined bounds and enum options enforced by the server.
  - Validators: `FIELDS_VALID`, `BOOLEAN_CONFIRMED`, `NONEMPTY_TEXT`,
    `SOURCE_SELECTED`, `EVIDENCE_LINKED`.
  - Conditional visibility using a small, non-executable DSL
    (`equals`, `notEquals`, `in`, `truthy`) referencing only previously
    declared activity fields. States: `VISIBLE`, `HIDDEN`, `WAITING`.
  - Pure output validation. Evidence is counted from trusted backend context,
    never from client-submitted fake counters.
  - Bounded size and maximum field/activity/phase counts, safe local keys,
    no remote components, no executable template scripts.
  - Safe materialization helper that can build the existing SOP definition
    shape without a parallel PEMS table.

- `taskViewDefinitionService.js` now validates the optional `workflow` field
  inside the existing `PemsTemplateViewDefinitions.DefinitionJson` column
  when `viewKey: STANDARD_V1` and `schemaVersion: 2.0`. Legacy V1/OOS
  definitions without workflows remain supported.

- `POST /api/pems/templates/workflow/validate` on the existing PEMS router,
  under `auth` + `tasks_manage`, returns a read-only validated preview. It
  creates no task rows, uploads no files, and has no marketplace side effects.

- `src/modules/tasks/services/tasksApi.js` adds `validateWorkflowV2()`.
  The existing `taskViewRegistry.js` has an allow-listed local
  `registerActivityRenderer()` extension. Component implementations are
  explicitly NOT fetched or executed from the template payload.

- An inventory workflow fixture shows source selection and conditional
  branches without turning on or changing `DLY-004` or `OOS-RECON-001`:
  `backend/__tests__/fixtures/taskWorkflowV2.inventory.sample.json`.

## Publication safety while the engine is being built

This **first increment is draft/preview only**.

- Creating a view definition containing `workflow` with status
  `PUBLISHED` returns `409 WORKFLOW_V2_NOT_ACTIVATED`.
- `publishViewDefinition()` rejects V2 workflows until activity-level
  persistence and conditional completion logic are ready.
- `taskInstanceSnapshot.resolveViewPin()` fails closed if a published V2
  workflow is found by the instance creation path, rather than creating a
  task whose SOP cannot be executed correctly.

This is intentional. A previewable schema is not yet a complete executable
workflow. Do **not** turn off the guards to simulate successful completion.

## Illustrative API shape

```http
POST /api/pems/templates/workflow/validate
Content-Type: application/json
Authorization: Bearer <authorised user token>

{ "workflow": { "schemaVersion": "2.0", "phases": [ ... ] } }
```

Success: `{success:true,data:{validation,preview,legacySopPreview,phaseCount,activityCount}}`.
Invalid schema: `422 INVALID_WORKFLOW_V2` with field-level errors.

## Next Phase 2 increments (not yet implemented)

**Phase 2.2, execution persistence.**
Add an additive idempotent PEMS migration for stable phase/activity keys,
activity type, typed output JSON, revisions, and conditional skip records.
Create activity rows from the pinned published workflow within the existing
`pemsService.createInstance()` transaction. Add seller-scoped, executor-only
output and validation endpoints, with server-side evidence verification and
idempotent writes. Maintain per-instance immutable template snapshots.

**Phase 2.3, conditional execution invariants.**
Re-evaluate conditional visibility from persisted, validated outputs;
apply skip/reopen decisions within the same task lock; prevent hidden steps
from being completed; reconcile activity/brand progress and submission
requirements without counting skipped conditional steps. Add tests for
concurrent updates, rejected evidence, alternate sources and legacy tasks.

**Phase 2.4, trusted UI renderer contract.**
Register first-party, shadcn-based activity renderers in the existing task
registry and expose task-specific steps through the existing view resolver.
Do not perform the broad employee or manager page redesign yet. Maintain
existing navigation and deep links until the later verified cutover.

## Acceptance standards for the *entire* Phase 2

1. Published V2 template can be executed from start through accepted review
   using existing PEMS records, with no unverified or client-only transitions.
2. Source/ASIN/task data permissions are server-enforced and never trusted
   from template JSON or client-provided parent IDs.
3. The task instance continues using its pinned workflow after new template
   versions are published.
4. Conditional and optional work is accounted for without false progress or
   false completion. Evidence must bind to the correct activity and seller.
5. At least two distinct task categories render through the same trusted
   engine and validation contracts.
6. Existing legacy tasks and protected OOS workflows remain unchanged.
7. Jest, registry tests, Vite build and relevant SQL Server integration tests
   pass; any external unrelated diagnostics are reported, not concealed.

**Do not mark Phase 2 complete based only on Phase 2.1 tests.**

## Phase 2.1 CI evidence

GitHub Actions [run 41033157763](https://github.com/Brandcentral-Pvt/RetailOps/actions/runs/41033157763)
at implementation commit `4aee6dd00e5d450fa981e55838fc901ff3e47d7a`
completed successfully:

- 7 backend Jest suites, **69 tests passed** (including the new example-fixture branch test).
- Existing task view registry, **11 tests passed**.
- Vite frontend build, **passed**.
- No live database, production template, or historical task was changed.

This verification closes only Phase 2.1, not Phase 2.2 through 2.4.
