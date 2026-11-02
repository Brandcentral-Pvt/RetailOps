# Phase 0 Audit Report: Tasks 2.0 Baseline

**Base SHA:** `1abc9801` (main, PR #209 merged)  
**Current Branch:** `feat/rule-sets-index-redesign` (dirty working tree)  
**Audit Date:** 2026-10-30  
**Mode:** STRICT READ-ONLY — No files created, edited, deleted, or committed

---

## A. Architecture Inventory

### Backend (PEMS + OOS)
| Module | Path | Responsibility |
|--------|------|----------------|
| Task CRUD | `backend/routes/taskRoutes.js` → `taskController.js` | Legacy `Tasks` + `Actions` tables (dual-write) |
| PEMS Templates | `backend/services/pems/pemsService.js` | `PemsTaskTemplates`, `PemsTaskInstances`, subtasks, activities |
| PEMS Workflow | `backend/services/pems/workflowEngine.js` | Statuses, transitions, SLA, progress, timestamps |
| PEMS Views | `backend/services/pems/taskViewDefinitionService.js` | Versioned view definitions, publishing, snapshots |
| OOS Core | `backend/routes/oosRoutes.js` → `oosController.js` | Runs, imports, reconciliation, incidents, resync, export, submit |
| OOS Task-bound | `backend/routes/pems/taskViewRoutes.js` → `taskViewController.js` | Task-instance-scoped OOS ops (run bind, upload, reconcile, ASINs, export, review) |
| OOS Upload | `backend/routes/oosInventoryUploadRoutes.js` | Dual-file (VC + BC) combined upload endpoint |
| OOS Services | `backend/services/oos/*.js` | Monitoring, upload, reconciliation, pareto, sync, incidents, export, submission |
| OOS Auth | `backend/middleware/oosTaskAccess.js` | Run/incident/export access via `OosTaskBindings` |
| Seller Scope | `backend/services/pems/sellerScope.js` | Global vs restricted user seller filtering |

### Frontend (Tasks Module)
| Component | Path | Role |
|-----------|------|------|
| Task List | `src/modules/tasks/pages/TaskInstancesPage.jsx` | "Task Execution Center" — unified list, KPIs, wizard, views |
| My Day | `src/modules/tasks/pages/MyDayPage.jsx` | Personal daily plan with timeline, defer, reviews |
| Review Queue | `src/modules/tasks/pages/ReviewQueuePage.jsx` | Reviewer inbox with bulk approve/reject |
| Task Drawer | `src/modules/tasks/components/TaskWorkspace.jsx` | Legacy generic drawer (Overview, SOP, Resolve, ASINs, etc.) |
| OOS Drawer | `src/modules/tasks/views/oos/OosTaskView.jsx` | OOS-specific 5-tab view (Overview, Sources, ASINs, Follow-ups, Review) |
| Shell/Resolver | `SharedTaskShell.jsx`, `TaskViewResolver.jsx` | Feature-flagged shell selection (`oos_recon_v1_enabled`) |
| View Registry | `src/modules/tasks/view-registry/taskViewRegistry.js` | Trusted local view/widget registration + validation |
| API Client | `src/modules/tasks/services/tasksApi.js` | **Single canonical contract** — but 4× duplicated OOS method blocks (lines 106-1312) |
| Templates | `TemplateBuilder.jsx` | 6-section builder with live validation + preview |
| Constants | `src/modules/tasks/constants/index.js` | Statuses, transitions, DLY codes, categories, metrics |

### Database Schema (Key Tables)
- `Tasks` / `Actions` — legacy dual-write (taskController.js:92-145)
- `PemsTaskTemplates` — template definitions (activities, subtaskDefs, brandMode)
- `PemsTaskInstances` — instances with `ViewDefinitionId`, `ViewDefinitionSnapshot`
- `PemsSubTasks` / `PemsActivities` — SOP steps with evidence requirements
- `PemsTaskBrands` — multi-brand checklist rows
- `PemsTemplateViewDefinitions` — versioned, publishable view definitions
- `OosRuns` / `OosImports` / `OosObservations` / `OosDecisions` — OOS data
- `OosIncidents` / `OosResyncJobs` / `OosExports` — OOS workflow
- `OosTaskBindings` — task↔run↔seller↔channel binding (auth backbone)

---

## B. Template-to-Task-View Capability Matrix

| Template Code | Current View Key | View Resolved Via | Activities Source | Evidence Gates | Brand Checklist | Specialized Panels |
|---------------|------------------|-------------------|-------------------|----------------|-----------------|-------------------|
| DLY-001..012 | `STANDARD_V1` (fallback) | `TaskWorkspace` | `SubTaskDefinitions` JSON | Per-activity `evidenceRequired` | `BrandMode=CHECKLIST` | None (generic ASIN panel) |
| OOS-RECON-001 | `OOS_RECON_V1` (flag-gated) | `OosTaskView` via `SharedTaskShell` | Hardcoded 5 tabs | None (no activity schema) | Decorative checkboxes only | `OosAffectedAsinsGrid`, `OosSourceUploader`, `OosExportPanel` |
| Custom | `STANDARD_V1` | `TaskWorkspace` | Template JSON | Per-activity | Optional | None |

**Critical Gap:** No template publishes a versioned `viewDefinition` with phases/steps/conditions. All tasks fall back to either the generic `TaskWorkspace` (hardcoded 4 tabs) or the OOS `OosTaskView` (hardcoded 5 tabs). The `taskViewRegistry` validates definitions but **no template in production has a published definition**.

---

## C. Existing API Contract Matrix

### Backend Routes (Registered)
| Method | Path | Controller | Auth |
|--------|------|------------|------|
| GET | `/api/pems/instances/:id/view` | `taskViewController.getTaskView` | `tasks_view` |
| GET | `/api/pems/instances/:id/oos/context` | `getOosContext` | `tasks_view` + `requireOosRunAccess(view)` |
| GET | `/api/pems/instances/:id/oos/sellers/:sellerId/runs` | `listOosRuns` | `tasks_view` |
| POST | `/api/pems/instances/:id/oos/sellers/:sellerId/runs` | `createOosRun` | `tasks_execute` |
| POST | `/api/pems/instances/:id/oos/runs/:runId/files` | `uploadOosFile` | `tasks_execute` + `requireOosRunAccess(act)` |
| GET | `/api/pems/instances/:id/oos/runs/:runId/files` | `listOosUploads` | `tasks_view` + `requireOosRunAccess(view)` |
| GET | `/api/pems/instances/:id/oos/imports/:importId/download` | `downloadOosImport` | `tasks_view` + `requireOosRunAccess(view)` |
| POST | `/api/pems/instances/:id/oos/runs/:runId/reconcile` | `reconcileOosRun` | `tasks_execute` + `requireOosRunAccess(act)` |
| GET | `/api/pems/instances/:id/oos/affected-asins` | `getAffectedAsins` | `tasks_view` + `requireOosRunAccess(view)` |
| GET | `/api/pems/instances/:id/oos/affected-asins/summary` | `getAffectedAsinsSummary` | `tasks_view` + `requireOosRunAccess(view)` |
| GET | `/api/pems/instances/:id/oos/affected-asins/:caseId` | `getAffectedAsinDetail` | `tasks_view` |
| POST | `/api/pems/instances/:id/oos/runs/:runId/resync/:caseId` | `requestResync` | `tasks_manage` + `requireOosRunAccess(act)` |
| PATCH | `/api/pems/instances/:id/oos/incidents/:caseId` | `updateIncident` | `tasks_manage` + `requireOosIncidentAccess(act)` |
| POST | `/api/pems/instances/:id/oos/incidents/:caseId/resolve` | `resolveOosIncident` | `tasks_manage` + `requireOosIncidentAccess(act)` |
| POST | `/api/pems/instances/:id/oos/exports` | `buildExport` | `tasks_manage` + `requireOosRunAccess(act)` |
| GET | `/api/pems/instances/:id/oos/exports` | `listExports` | `tasks_view` + `requireOosRunAccess(view)` |
| GET | `/api/pems/instances/:id/oos/exports/:exportId/download` | `downloadExport` | `tasks_view` + `requireOosExportAccess(view)` |
| POST | `/api/pems/instances/:id/oos/submit` | `submitOos` | `tasks_execute` |
| POST | `/api/pems/instances/:id/oos/review` | `reviewOos` | `tasks_manage` |

### Frontend `tasksApi.js` — **Defects Found**
1. **Massive duplication**: OOS methods repeated 4× (lines 106-1312) — `getTaskView`, `getOosContext`, `getOosRuns`, `createOosRun`, `uploadOosFile`, `getOosUploads`, `downloadOosImport`, `reconcileOosRun`, `uploadInventory`, `syncRetailOpsAvailability`, `getColumnConfig`, `getAffectedAsins`, `getAffectedAsinSummary`, `getAffectedAsinDetail`, `requestResync`, `getResyncStatus`, `verifyResync`, `resolveIncident`, `updateIncident`, `buildExport`, `downloadExport`, `listExports`, `submitOos`, `reviewOos` — each defined 4 times
2. **Non-existent endpoints called**:
   - `uploadInventory` → `/pems/instances/:id/oos/runs/:runId/inventory-upload` (not registered in `taskViewRoutes.js`)
   - `syncRetailOpsAvailability` → `/pems/instances/:id/oos/runs/:runId/sync-retailops` (not registered)
   - `getColumnConfig` → `/pems/instances/:id/oos/runs/:runId/columns` (not registered)
3. **Contract mismatches**:
   - `buildExport(taskInstanceId, body)` expects `body` but `OosAffectedAsinsTab` passes `activeRun` (runId string) directly
   - `downloadExport` returns `Blob` but some callers treat as `Response` (e.g., line 64: `if (!res2.ok)`)
   - `downloadOosImport` returns `Response` but callers may expect `Blob`

---

## D. P0/P1/P2 Defect Register

| ID | Severity | File:Line | Description | Root Cause |
|----|----------|-----------|-------------|------------|
| D-001 | P0 | `tasksApi.js` (entire file) | 4× duplicate OOS method definitions — last wins, earlier dead code | Copy-paste without dedup |
| D-002 | P0 | `tasksApi.js:152-171` | `uploadInventory` calls unregistered `/inventory-upload` route | Route exists only in `oosInventoryUploadRoutes.js` (mounted at `/api/oos`, not `/api/pems`) |
| D-003 | P0 | `tasksApi.js:173-174` | `syncRetailOpsAvailability` calls unregistered `/sync-retailops` route | Same — only in `oosRoutes.js` at `/api/oos/runs/:id/sync-retailops` |
| D-004 | P0 | `tasksApi.js:176-177` | `getColumnConfig` calls unregistered `/columns` route | Same — only in `oosRoutes.js` at `/api/oos/runs/:id/columns` |
| D-005 | P0 | `OosAffectedAsinsTab.jsx:60` | `buildExport(taskInstanceId, activeRun)` passes runId string, API expects body object | Contract mismatch |
| D-006 | P0 | `OosAffectedAsinsTab.jsx:64` | `res2.ok` check on `Response` but `downloadExport` returns `Blob` | Type confusion |
| D-007 | P0 | `OosAffectedAsinsTab.jsx:176` | `dayjs(activeRun).format(...)` formats runId as date | `activeRun` is runId (UUID), not a date |
| D-008 | P1 | `oosTaskAccess.js:93-104` | Legacy/unbound runs bypass task binding for `view` mode | `requireOosRunAccess` allows seller-scope fallback for reads |
| D-009 | P1 | `oosTaskAccess.js:141-156` | `requireOosIncidentAccess` finds binding by seller/channel only — no taskInstanceId verification | Incident may not belong to the task's run |
| D-010 | P1 | `taskViewController.js:465-470` | `buildExport` accepts `runId` from query OR body — ambiguous | Should require body |
| D-011 | P1 | `taskController.js:91-118` | `generateTasks` dual-writes to `Tasks` AND `Actions` with different schemas | Legacy compatibility, creates drift |
| D-012 | P1 | `pemsService.js:227-398` | `createInstance` accepts `status` from client — can create `APPROVED`/`SUBMITTED` directly | No server-side initial-state validation |
| D-013 | P2 | `OosAffectedAsinsTab.jsx:191-230` | Buttons nested in `{canResync && (<>...{canResync && (...)})}` — double conditional | Copy-paste artifact |
| D-014 | P2 | `TaskWorkspace.jsx:59-73` | `AffectedASINsPanel` loads via `getInstanceAsins` which routes to `getOosAffectedAsins` for OOS-RECON-001 — but that queries `Asins` table (RetailOps scrapes), not `OosDecisions` (reconciliation results) | Wrong data source for OOS |
| D-015 | P2 | `constants.js:105-119` | `DLY_TASK_CODES` labels partially offset from dailyOpsMaster.csv (only DLY-004 corrected) | Incomplete reconciliation |
| D-016 | P2 | `workflowEngine.js` | `VALID_TRANSITIONS` allows `DRAFT→ASSIGNED` but `createInstance` can set `status: 'ASSIGNED'` directly | No gate on initial status |
| D-017 | P2 | `taskViewDefinitionService.js:3-6` | `ALLOWED_VIEW_KEYS` only `STANDARD_V1`, `OOS_RECON_V1` — no extensibility for new templates | Hardcoded allowlist |

---

## E. PR Dependency & Conflict Report

| PR/Branch | Head SHA | Status | Key Changes | Conflict Risk |
|-----------|----------|--------|-------------|---------------|
| `#209` (main) | `1abc9801` | Merged | Phase 0 baseline docs, legacy cutover gates | Baseline — no conflict |
| `feat/oos-recon-001-remediation` | `60646b40` | Draft (remote) | Phases 2-9 OOS remediation, E2E tests | **HIGH** — modifies `OosTaskView`, `OosAffectedAsinsTab`, `taskViewRegistry`, adds test file |
| `feat/tasks-data-driven-metrics` | `17082fc4` | Draft (remote) | KPI server aggregates, MyDay, ReviewQueue, rule-task integration | **MEDIUM** — touches `TaskInstancesPage`, `MyDayPage`, `ReviewQueuePage`, `pemsService.getInstances` |
| Current (`feat/rule-sets-index-redesign`) | Working tree dirty | Local | Rule-set index UI, package.json bumps | Low — unrelated modules |

**Critical Finding:** The spec references PR #210 and #212 as stacked drafts. These do **not** exist as remote branches. The closest matches are:
- `feat/oos-recon-001-remediation` → likely PR #212 (OOS Phases 2-9)
- `feat/tasks-data-driven-metrics` → likely PR #210 (worklist/UI changes + Phase 2.1/2.2)

**Action Required:** Before Phase 1, reconcile these two remote branches against `main`. They both modify `TaskInstancesPage`, `MyDayPage`, `ReviewQueuePage`, and `tasksApi.js`. Merge order matters: `tasks-data-driven-metrics` (worklist) should land first, then `oos-recon-001-remediation` (OOS-specific) on top.

---

## F. Protected Production Data & Legacy Compatibility List

| Asset | Protection Rule | Location |
|-------|-----------------|----------|
| DLY-004 (OOS Data Monitoring) | **Never modify, reseed, or activate new schedule** | `PemsTaskTemplates` where `TaskCode='DLY-004'` |
| OOS-RECON-001 workflow | **Remain inactive/contained** unless explicit production authorization | Template `TaskCode='OOS-RECON-001'`, feature flag `oos_recon_v1_enabled` |
| Historical `PemsTaskInstances` | Preserve `ViewDefinitionSnapshot`, `Status`, `AssignedTo`, `ReviewerId`, `auditLogs` | All instance rows |
| `Tasks` / `Actions` legacy tables | Read-only for migration; no new writes after cutover | `taskController.generateTasks` dual-write |
| `OosRuns` / `OosImports` / `OosDecisions` / `OosIncidents` | Immutable history — no backfill, no deletion | OOS services |
| Deep links `/tasks/tasks/:id` | Must resolve to correct drawer (legacy or new) | `TaskViewResolver` |
| Review decisions (`PemsTaskReviews`) | Immutable — no overwrite | `pemsService.submitReviewAndTransition` |

---

## G. Proposed Implementation File Ownership by Phase

| Phase | Workstream | Files to Create/Modify | Owner |
|-------|------------|------------------------|-------|
| 0 | Audit | (this report) | Architect |
| 1 | Security/Lifecycle | `taskController.js` (initial status gate), `pemsService.js` (createInstance validation), `oosTaskAccess.js` (binding enforcement), `tasksApi.js` (dedup + fix contracts), `workflowEngine.js` (V2 gate checks) | Backend Lead |
| 2 | V2.3 Conditional Engine | `workflowEngine.js` (conditional states), `pemsService.js` (transitionStatus with conditions), new `taskWorkflowV2Execution.js` | Backend Lead |
| 3 | Guided Task Views | `TaskViewResolver.jsx` (pinned def resolution), `SharedTaskShell.jsx` (primary action), `taskViewRegistry.js` (renderer lib), new activity renderers (`ChecklistRenderer`, `FormRenderer`, `TableReviewRenderer`, `FileUploadRenderer`, `EvidenceReviewRenderer`), `GenericTaskView.jsx` (fallback) | Frontend Lead |
| 4 | OOS Upload Integration | `tasksApi.js` (consolidate + fix contracts), `taskViewController.js` (uploadOosFile), `oosUploadService.js` (validation), `OosSourceUploader.jsx` (UI) | Full-stack |
| 5 | Affected ASINs Workspace | `taskViewController.js` (getAffectedAsins fixes), `oosReconciliationService.js` (pareto, classification), `OosAffectedAsinsTab.jsx` (source intake panel + grid), `OosAffectedAsinsGrid.jsx` | Full-stack |
| 6 | OOS End-to-End | `oosIncidentService.js`, `oosExportService.js`, `oosSubmissionService.js`, `OosFollowupsTab.jsx`, `OosReviewTab.jsx` | Full-stack |
| 7 | Employee/Manager UX | `MyDayPage.jsx` (rebuild), `TaskInstancesPage.jsx` (split employee/manager), new `OperationsCenterPage.jsx`, `ReviewQueuePage.jsx` (refine) | Frontend Lead |
| 8 | Release/Cutover | Feature flags, migration scripts, import-graph analysis, legacy removal | DevOps + Architect |

---

## H. Test Baseline (Including Failing OOS Regression Tests)

| Test File | Status | Coverage |
|-----------|--------|----------|
| `src/modules/tasks/view-registry/__tests__/taskViewRegistry.test.js` | **PASS** (12 tests) | Registry validation, registration, resolution, fallback |
| `src/modules/tasks/utils/__tests__/dayPlanner.test.js` | **PASS** | Plan building, deferral, workday config |
| Backend unit tests | **UNKNOWN** — no test runner configured in `backend/package.json` | — |
| OOS regression tests | **MISSING** — spec requires: forged IDs, cross-seller access, review self-approval, invalid initial statuses, disabled V2 flags, legacy V1 regression, OOS UI smoke | Must create in Phase 1 |

**No integration/E2E tests exist for OOS workflow.** The `feat/oos-recon-001-remediation` branch mentions "E2E test preconditions" but no test files visible in main.

---

## I. Open Business Decision Register (D1–D10)

| ID | Decision | Status | Owner |
|----|----------|--------|-------|
| D1 | New ASIN definition & authoritative first-seen source | **UNAPPROVED** — draft in `docs/oos-recon-001-remediation-plan` | Product |
| D2 | Seller GMS source, date window, denominator for Pareto | **UNAPPROVED** | Finance + Product |
| D3 | Vendor Central applicability rules per channel | **UNAPPROVED** | Ops |
| D4 | Independent reviewer eligibility & delegation | **UNAPPROVED** | Security + HR |
| D5 | Export columns (4 sheets), retention, naming convention | **UNAPPROVED** | Compliance |
| D6 | Upload limits (50MB current), storage quotas, virus scan | **UNAPPROVED** | Infra + Security |
| D7 | Multi-brand task access model (cross-seller visibility) | **UNAPPROVED** | Product |
| D8 | Resync quotas, retries, rate limits, provider contracts | **UNAPPROVED** | Ops + Vendor |
| D9 | Incident waiver authority & conditions | **UNAPPROVED** | Legal + Ops |
| D10 | Pilot cohort, rollout sequence, rollback criteria | **UNAPPROVED** | PM + Leadership |

**Note:** The `docs/oos-recon-001-remediation-plan` branch exists but **none of these decisions are approved**. They are documented recommendations only.

---

## J. Phase 1 Acceptance Criteria

| Criterion | Verification Method |
|-----------|---------------------|
| **1.1** Client-supplied terminal statuses (`APPROVED`, `SUBMITTED`, `UNDER_REVIEW`, `REJECTED`, `REWORK`, `RESUBMITTED`, `CANCELLED`) rejected at `createInstance` | Unit test: POST `/api/pems/instances` with `status: 'APPROVED'` → 400 |
| **1.2** Client-supplied `reviewStatus` ignored; server sets `NOT_REVIEWED` | Unit test: verify DB row |
| **1.3** `requireOosRunAccess` denies `act` mode for unbound runs (non-global) | Integration test: restricted user POST `/api/pems/instances/:id/oos/runs/:runId/files` → 403 |
| **1.4** `requireOosIncidentAccess` verifies incident belongs to task's bound run | Integration test: cross-task incident PATCH → 403 |
| **1.5** `requireOosExportAccess` verifies export belongs to task's bound run | Integration test: cross-task export download → 403 |
| **1.6** All V2 mutations (`transitionStatus`, `completeSubTask`, `completeActivity`, `setBrandCheck`, `submitReview`) return 409/403 when `V2_WORKFLOW_ENABLED` flag off | Feature flag test matrix |
| **1.7** `tasksApi.js` deduplicated to single OOS method block; all callers updated | Lint + manual trace |
| **1.8** `uploadInventory`, `syncRetailOpsAvailability`, `getColumnConfig` either removed or pointed to correct `/api/oos` routes | Contract test |
| **1.9** `buildExport` accepts body `{ runId }`; `downloadExport` returns `Blob` consistently | Type check + integration test |
| **1.10** Run ID formatting fixed — use `run.RunDate` not `runId` | UI smoke test |
| **1.11** Task creation + review flow works on real SQL Server (staging) | Staging deployment + smoke |
| **1.12** Legacy V1 regression: `TaskWorkspace` opens for non-OOS tasks, deep links work | Manual + automated |
| **1.13** OOS UI smoke: create run → upload BC → reconcile → ASINs visible → export → submit → review | E2E script |

---

## Final Assessment

**PASS** — Baseline established. Ready for Phase 1 implementation.

**Blockers for Phase 1:**
1. PR dependency reconciliation: `feat/tasks-data-driven-metrics` must be merged before `feat/oos-recon-001-remediation`
2. Business decisions D1–D10 unapproved — Phase 4+ will block on D1, D2, D3, D6, D8
3. No backend test runner — need `npm test` script in `backend/package.json` before Phase 1.6

**Rollback Method:** `git checkout main` — all Phase 0 work is read-only.

---

*Report generated per Phase 0 prompt requirements. No files modified.*