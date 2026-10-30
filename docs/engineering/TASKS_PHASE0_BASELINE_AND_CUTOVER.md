# RetailOps Tasks Phase 0: Baseline, Rebuild and Legacy Cutover Contract

Status: **Phase 0 source audit completed, runtime baseline pending**  
Repository: `Brandcentral-Pvt/RetailOps` (private)  
Audited base: `26ffa0c5423501e5ddaf96f9b45c363b4cdcd472`  
Working branch: `chore/tasks-phase0-baseline`  
Scope: Tasks and PEMS only. No application code, SQL schema, production data, permissions or active task definitions changed in Phase 0.

## 1. Product intent and non-negotiable constraints

Rebuild existing task modules in place, rather than introduce a parallel task application. The final employee experience is a clean assigned-work queue and guided execution view. Administrators and operations managers get a distinct oversight experience over the SAME PEMS records and business rules. Each template has its own steps, activities, evidence, input requirements and outcome validation, rendered by shared trusted activity components.

"Zero traces of legacy" means no reachable Ant Design, Bootstrap, old task drawer, stale task CSS selectors, duplicated UI implementations, placeholder actions or parallel authorization rules **within the completed Tasks frontend scope**. This is an end-state cutover gate, NOT an instruction to delete database history, active workflow definitions, files still in use, or other teams' legacy UI while migration is ongoing. Historical task and review records must remain available.

Do not use the migration to activate or reconcile `OOS-RECON-001`. Preserve `DLY-004` and the October 27 OOS containment/forensic records until separate explicit authorization and staging validation.

## 2. Verified active routes and consumers

All listed below are active in `src/App.jsx` at the audited base.

| Route | Current page | Future responsibility | Strategy |
| --- | --- | --- | --- |
| `/tasks/my-day` | `MyDayPage.jsx` | Employee landing | Rebuild file in place |
| `/tasks/tasks` | `TaskInstancesPage.jsx` | Employee task queue | Rebuild file in place, remove manager noise |
| `/tasks/dashboard` | `TaskPerformanceDashboard.jsx` | Manager analytics | Preserve route during staged cutover |
| `/tasks/reviews` | `ReviewQueuePage.jsx` | Independent review | Rebuild in place |
| `/tasks/templates` | `TaskTemplatesPage.jsx` | Template governance | Rebuild in place |
| `/tasks/templates/:id` | `TemplateDetailPage.jsx` | Template details | Rebuild in place |
| `/tasks/analytics` | `TaskAnalyticsPage.jsx` | Manager reporting | Rebuild in place |
| `/tasks/operations` | Not present | Separate manager control center | Add only in later approved phase |

The `/pems/*` routes are compatibility redirects, and existing task IDs, query parameters and deep links must continue working.

## 3. Existing code inventory and migration ownership

| Current file/service | Audited size | Reuse / refactor plan | Removal condition |
| --- | --- | --- | --- |
| `TaskInstancesPage.jsx` | 1,663 lines | Refactor same page to a simple employee queue | Legacy KPIs, OKR view switching, manager toolbars and unused styles retired after manager view exists |
| `TaskWorkspace.jsx` | 1,270 lines | Replace current seven-tab drawer behavior with guided execution inside existing task module | Remove generic drawer implementation only after all active templates have parity |
| `TaskViewResolver.jsx` | 46 lines | Evolve into server-validated versioned workflow resolution | Remove localStorage-only task view selection on cutover |
| `SharedTaskShell.jsx` | 253 lines | Reuse valid shell/service contracts while migrating to shadcn | Remove redundant legacy shell once the canonical runner covers consumers |
| `TemplateBuilder.jsx` | 549 lines | Extend existing editor with typed activities and server validation | Remove Ant Design and old form markup when migrated |
| `MyDayPage.jsx` | 342 lines | Keep API and planning logic; simplify presentation | Remove dead CSS and duplicate task-view patterns |
| `ReviewQueuePage.jsx` | 442 lines | Retain review workflow; update presentation after server gates | Remove legacy review UI when contract regression tests pass |
| `taskViewRegistry.js` | 186 lines | Reuse safe local component registry | Extend for trusted activity renderers, do not create parallel registries |
| `taskViewDefinitionService.js` | 231 lines | Reuse published view definitions and snapshots | Enforce immutable instance binding and schema validation |
| `pemsService.js` | 2,980 lines | Keep PEMS persistence and workflow logic; refactor focused functions | No wholesale replacement |
| `workflowEngine.js` | 195 lines | Retain canonical lifecycle states | Separate state transitions from activity/business outcome semantics |
| `tasksApi.js` | 1,932 lines | Correct and consolidate endpoints in place | No duplicate API client for new UI |
| `tasks.css`, `myday.css` | Legacy stylesheet surfaces | Audit selectors and migrate incrementally | Delete only after final graph/CSS coverage proves no consumers |

Import reachability and runtime use must be confirmed before deleting files. Do not delete other application modules simply because their names look old. Use the project shadcn/ui and Tailwind CSS 4 foundations and Lucide icons for migrated Tasks UI.

## 4. Verified backend contracts and gaps

Current persistence entities: `PemsTaskTemplates`, `PemsTaskInstances`, `PemsSubTasks`, `PemsActivities`, `PemsTaskBrands`, `PemsEvidence`, `PemsTaskReviews`, `PemsTaskAuditLogs`, and `PemsTemplateViewDefinitions`.

Current view definition service allows `STANDARD_V1` and `OOS_RECON_V1`. It supports immutable snapshot columns, but `createInstance()` currently inserts the task and derived subtasks/activities without pinning the complete view definition in the same transaction. The view reader falls back to the latest published version when no snapshot exists. Correct this in Phase 1, preserving historical instance behavior.

**Blocking defects identified from code:**

| ID | Evidence | Why Phase 1 must address it |
| --- | --- | --- |
| P0-01 | `pemsService.completeActivity()` sets `IsCompleted=1` without checking `EvidenceRequired` or output validation | A step can appear complete without required proof |
| P0-02 | `pemsService.completeSubTask()` unconditionally marks the phase complete | Phase state can disagree with required activity completion |
| P0-03 | `pemsService.transitionStatus()` checks an ASIN gate but not a generic template activity/evidence gate | Submission may bypass template-specific requirements |
| P0-04 | Normal task creation lacks atomic workflow-definition snapshot pinning | Old tasks can resolve against changed templates |
| P0-05 | `src/modules/tasks/utils/rbac.js` treats any category permission as category-wide via `permission.startsWith(p.split('.')[0] + '.')` | Frontend permission checks can be excessively broad |
| P1-01 | Generic `verifyFix()` returns success when all subtasks are checked | Checklist completion is not business-outcome verification |
| P1-02 | Brand check is a simple completion bit; evidence and per-brand source status are not required by that operation | Multi-brand monitoring can claim completion without verification |
| P1-03 | Task list is one large component mixing user execution, managerial KPIs, objectives and creation tooling | Hard to maintain and learn |
| P1-04 | Generic TaskWorkspace has seven tabs, repeated metadata, fake/irrelevant zero-value performance metrics and long prose SOPs | High cognitive load for employees |
| P1-05 | `TaskViewResolver` uses a browser localStorage flag for the OOS view | Cannot be authoritative for production workflow rollout |

These are code-supported findings. Actual live incident frequency, authentication behavior and SQL record counts on October 30 have not been checked in Phase 0.

## 5. Canonical states and permission boundaries

Keep three different state domains:

1. **Lifecycle:** DRAFT, ASSIGNED, ACCEPTED, IN_PROGRESS, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, REWORK, RESUBMITTED, ESCALATED, CANCELLED.
2. **Activity execution:** pending, in progress, blocked, validated complete, skipped by approved conditional policy.
3. **Business outcome:** template-specific observations such as unknown inventory, verified no issue, open OOS, and verified recovery. Never automatically equate task activity completion with successful stock recovery.

Server authorization remains authoritative: seller scope, assigned executor capabilities, reviewer capabilities, admin/operations-manager scope, reviewer independence and audit attribution. A new screen is NOT a new permission boundary. Do not grant access based only on a title or visual role switcher. Review the broad wildcard in task-local RBAC and reuse the canonical backend permission service.

## 6. Cutover policy: no legacy traces in completed Tasks UI

Once every template and route has migrated, the following must be true:

- The active Tasks frontend module has zero imports of `antd`, `@ant-design/icons`, `@mui/*`, `bootstrap`, `reactstrap` or `rsuite`.
- The active Tasks routes do not render `TaskWorkspace` seven-tab legacy UI, inactive generic shell variants or placeholder actions.
- Legacy Tasks CSS selectors and unused custom UI primitives have no reachable consumers and are deleted.
- There is one canonical task execution resolver, one task API client contract, one task lifecycle system and one backend permission model.
- Existing task instance IDs, deep links, comments, evidence, assignment, SLA state, audit trail, reviewer decisions and historical records still work.
- Legacy read compatibility is provided for old task definitions; do not delete source data to make the UI look clean.
- New manager overview may be added at `/tasks/operations`, but do not duplicate PEMS task storage or backend workflow engines.

Do not declare zero legacy traces until a repository-wide module import graph, literal search, build, E2E route tests and CSS coverage pass. During staged migration, pre-cutover legacy code can remain as a controlled, measured fallback only.

## 7. Existing production OOS safety boundary

The October 27 read-only production snapshot reports:

- `DLY-004` was active with 17 assigned instances at capture.
- `OOS-RECON-001` was found active at capture and then deactivated under approved containment `EX-001`.
- There were 188 orphan `OosTaskBindings` and 44,223 insufficient-evidence decisions at capture.
- These are historic point-in-time findings, not current production counts.
- No direct change, backfill, cleanup, reseed, activation, new OOS run or OOS data migration is authorized as part of the Tasks UI work.

Reference: `docs/engineering/OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md`, `OOS_RECON_001_PHASE0_FREEZE.md`.

## 8. Phase 0 runtime validation still needed

This GitHub source audit cannot inspect uncommitted local changes, capture authenticated runtime interactions, query live production task rows or run the tests in the deployment environment.

Before Phase 1 writes, an engineer should execute on a clean local/staging checkout:

~~~bash
git status --short
git rev-parse HEAD
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:task-registry
npx playwright test tests/task-list-columns.spec.js tests/task-workspace-drawer.spec.js tests/task-templates-library.spec.js tests/task-templates-css.spec.js
cd backend
npm ci
npm test -- --runInBand __tests__/routes/pemsInstances.test.js __tests__/routes/pemsSellerScope.test.js __tests__/unit/pemsPolicy.test.js
~~~

Also collect screenshots at 390, 768, 1024, 1440 and 1920 pixels for employee task queue, task drawer, My Day, review queue and template builder. Record outcome, commit SHA and failing test details for each.

Recommended read-only DB snapshot: template counts by code/status, task counts by lifecycle, assigned/reviewer distributions, DLY-004 instances, active workflow-definition IDs, missing snapshots, evidence counts, and task/phase/activity progress mismatch counts. Use least-privilege read credentials. No writes or destructive cleanup.

## 9. Acceptance gate and next phase

**Phase 0 source gate:** complete when baseline inventory, protected tables/routes, known defects, zero-legacy cutover contract and test checklist are recorded in GitHub.  
**Phase 0 runtime gate:** pending until staging/local test output and safe live data baseline are attached. Do not claim the running system is verified without that evidence.

**Next authorized phase, not included in this PR:** Phase 1 backend correctness. Priorities are evidence validation, phase completion invariants, complete-and-submit gates, snapshot pinning, progress consistency and permission corrections. Do not start UI refactoring or change `DLY-004` in Phase 0.

## 10. Source reference index

- `src/App.jsx`
- `src/modules/tasks/pages/TaskInstancesPage.jsx`
- `src/modules/tasks/pages/MyDayPage.jsx`
- `src/modules/tasks/pages/ReviewQueuePage.jsx`
- `src/modules/tasks/components/TaskWorkspace.jsx`
- `src/modules/tasks/components/TaskViewResolver.jsx`
- `src/modules/tasks/components/SharedTaskShell.jsx`
- `src/modules/tasks/components/TemplateBuilder.jsx`
- `src/modules/tasks/services/tasksApi.js`
- `src/modules/tasks/utils/rbac.js`
- `src/modules/tasks/view-registry/taskViewRegistry.js`
- `backend/services/pems/pemsService.js`
- `backend/services/pems/workflowEngine.js`
- `backend/services/pems/taskViewDefinitionService.js`
- `backend/services/pems/pemsPolicy.js`
- `backend/middleware/pemsAccess.js`
- `backend/migrations/001_pems_schema.js`
- `backend/migrations/033_task_view_definitions_and_oos_bindings.js`
- `docs/engineering/OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md`
- `docs/engineering/OOS_RECON_001_PHASE0_FREEZE.md`
