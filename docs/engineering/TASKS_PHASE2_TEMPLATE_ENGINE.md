# RetailOps Tasks 2.0: Phase 2 Template Workflow Engine

**Branch:** `feat/tasks-phase2-template-engine`  
**PR:** stacked on `fix/tasks-phase1-correctness` (Phase 1 PR #210)  
**Current development stage:** Phase 2.2 implemented and development-tested; Phase 2.3 conditional execution and Phase 2.4 trusted guided rendering remain.

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

## Phase 2.2: Activity output persistence

Phase 2.2 adds an **idempotent, additive migration** to existing PEMS tables:

- `backend/migrations/042_pems_workflow_v2_activity_outputs.js` adds
  `WorkflowPhaseKey` to `PemsSubTasks`, and `WorkflowActivityKey`,
  `ActivityType`, `OutputJson`, `OutputRevision`, `OutputUpdatedAt`,
  and `OutputUpdatedBy` to `PemsActivities`.
- Legacy records retain NULL workflow keys and zero output revisions.
  Two filtered per-instance unique indexes prevent duplicate template
  step keys. Migration 042 can be rerun without overwriting old data.
- `pemsService.createInstance()` materializes phase/activity rows from the
  **pinned published workflow snapshot inside its existing transaction**,
  ignoring caller-supplied SOP overrides for V2 tasks.
- `taskWorkflowV2Execution.js` stores typed activity output JSON using
  the original task's frozen definition. Every write serializes on the
  task parent, checks the child belongs to that parent, enforces the
  assigned executor route, and increments `OutputRevision` through
  compare-and-swap. Identical retries are idempotent; stale conflicting
  writers receive `409 ACTIVITY_REVISION_CONFLICT`.
- `completeActivity()` uses the actual persisted output plus activity-linked
  evidence before marking V2 work complete. Evidence need not already
  exist when saving a typed output, but is mandatory at completion.
- All updates create task audit records without logging confidential output
  values; saved results and revision numbers are returned via a read-only
  task execution endpoint, authorized by existing seller-scope middleware.
- Strict-gate disablement is **fail closed** on existing V2 child completion,
  submission and review paths. Legacy V1 task behavior is preserved.

### Developer activation

```env
PEMS_PIN_VIEW_SNAPSHOTS=true
PEMS_STRICT_ACTIVITY_GATES=true
PEMS_V2_EXECUTION_ENABLED=true
```

All three must be explicitly enabled on a migrated, isolated development
database, including migrations 033, 034 and 042. The default remains
`false`, and V2 snapshots cannot be published or executed without all flags.

**Phase 2.2 supports only unconditional V2 workflows for execution.**
V2 definitions with `visibleWhen` remain valid for draft editing and preview,
but cannot be published or pinned to executable instances until Phase 2.3
implements conditional skip, re-open and progress semantics. This protects
users from false 100% completion or unfinishable tasks. The dedicated test
fixture `taskWorkflowV2.inventory.sample.json` illustrates a conditional
draft, NOT an executable Phase 2.2 template.

### Endpoint contract

```http
GET /api/pems/instances/:id/workflow
Authorization: Bearer <authorized reader>
```

Returns pinned phases and activities with immutable schema, stable keys,
`activityId`, stored `output`, `outputRevision` and `isCompleted`.
Requires seller-scoped task-view access.

```http
PUT /api/pems/instances/:id/activities/:activityId/output
Authorization: Bearer <authorized executor>
Content-Type: application/json

{ "output": { "source": "RETAILOPS" }, "expectedRevision": 0 }
```

Returns the next revision and an idempotency marker, or structured validation
errors. Requires seller-scoped task execution permission and a child activity
that actually belongs to the route's task. The client must **never** specify
the schema, task owner, or proof count; those come from backend records.

## Illustrative API shape

```http
POST /api/pems/templates/workflow/validate
Content-Type: application/json
Authorization: Bearer <authorised user token>

{ "workflow": { "schemaVersion": "2.0", "phases": [ ... ] } }
```

Success: `{success:true,data:{validation,preview,legacySopPreview,phaseCount,activityCount}}`.
Invalid schema: `422 INVALID_WORKFLOW_V2` with field-level errors.

## Remaining Phase 2 increments

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

**Do not mark Phase 2 complete based only on Phase 2.1 or Phase 2.2 tests.**

## Phase 2.1 CI evidence

GitHub Actions [run 41033157763](https://github.com/Brandcentral-Pvt/RetailOps/actions/runs/41033157763)
at implementation commit `4aee6dd00e5d450fa981e55838fc901ff3e47d7a`
completed successfully:

- 7 backend Jest suites, **69 tests passed** (including the new example-fixture branch test).
- Existing task view registry, **11 tests passed**.
- Vite frontend build, **passed**.
- No live database, production template, or historical task was changed.

This verification closes only Phase 2.1. Phase 2.2 is verified separately below when its CI evidence is available.

## Phase 2.2 tests and release boundary

Phase 2.2 adds unit and route regressions for pinned V2 materialization,
output schema validation, optimistic revisions, idempotent retries,
activity-level evidence, conditional-template rejection, and access control.
The CI configuration runs a separate disposable SQL Server 2022 integration
test to verify the migration and output persistence SQL, rather than trusting
fake database responses alone.

**Phase 2.2 developer verification passed.** GitHub Actions
[run 41036232130](https://github.com/Brandcentral-Pvt/RetailOps/actions/runs/41036232130)
on implementation commit `a2f79a6a1485d5bf618ce9364e2900ed8ab6aba7` reports:

- **11 backend Jest suites, 94 tests passed** including output revisions,
  validation failures, identity scoping, and Phase 1 regression coverage.
- **One real disposable SQL Server 2022 integration test passed** validating
  migration 042 run twice, typed output writes, stale edit rejection,
  cross-task resource isolation and linked evidence.
- **11 task view registry tests passed** and the frontend Vite build passed.

**Phase 2.2 is complete as a scoped development increment, subject to PR
review.** Conditional skip/reopen, a guided task UI, and production rollout
are not complete. No production data or OOS workflow has been changed.
PR #212 remains Draft and stacked on Phase 1 PR #210.
