# BrandCentral RetailOps: Template-Driven Task View Rebuild

**Architecture status:** Proposed design for engineering implementation, not merged code.  
**Repo inspected:** `Brandcentral-Pvt/RetailOps`, `main` at `9cbee6385c72c27bb83884352de2e8574b7b9754`, checked October 23, 2026.  
**First pilot:** `OOS-RECON-001` (new template; legacy `DLY-004` remains untouched).

## 1. Executive decision

**Do not fork or copy `TaskWorkspace.jsx` for every template.** Rebuild it as a lightweight, reliable **shared task shell** that resolves a versioned **Task View Definition** and hosts a purpose-built workflow view. Each published task template owns its own definition of screens, actions, uploads, data bindings, evidence, and completion gates. Complex task types can register specialized React widgets, but reuse the shared task lifecycle, RBAC, events, audit, SLA, comments, evidence infrastructure, and reviews.

A new task may look different without creating a new task backend. The business workflow is data-driven where possible and intentionally specialized only where necessary. The backend, not the JSON definition or browser, authorizes and validates every operation.

## 2. Findings in current code

| Existing code | Verified behavior | Constraint or deficiency |
|---|---|---|
| `src/modules/tasks/components/TaskWorkspace.jsx` | ~1,270-line shared drawer; Overview, SOP, Resolve, Affected ASINs, Evidence, Discussion. | Same tabs for heterogeneous tasks; OOS-specific action only navigates to `/tasks/oos`, dropping current `taskId`. |
| `AffectedASINsPanel` in TaskWorkspace | Reads `GET /api/pems/instances/:id/asins` and shows `PemsTaskAsins` grouped by seller; remarks, resolve, waive. | Generic issue signals, not inventory reconciliations. Remarks handler passes row `record.id` to API method whose backend expects an ASIN code. |
| `PemsTaskAsins` migration 030 | Per-instance ASIN signal records and statuses. | Separate from OOS `OosDecisions` and `OosIncidents`; no canonical join to the OOS run. |
| `src/modules/oos/pages/OosWorkspacePage.jsx` | Separate workspace with seller selector, report upload, reconcile, Pareto, incidents, resync records, export and submit. | Task context is missing; auth for mutations is `tasks_manage`; currently has unsafe resync and approval paths. |
| `backend/migrations/032_oos_reconciliation.js` | 10 OOS tables including runs, imports, observations, decisions, incidents, resync, export, review. | `OosRuns` does not store task-instance association; daily uniqueness is `(RunDate, SellerId)`. |
| `backend/services/pems/oosReconTemplate.js` | New inactive draft with 6 phases/12 human outcomes. | Does not carry an executable Task View Definition. OOS outcomes currently represented as instructions. |
| `src/modules/tasks/components/TemplateBuilder.jsx` | Six builder sections and publish validation. | No registry-driven view builder; static SOP text cannot configure report widgets or dedicated screen workflow. |
| `backend/services/pems/pemsService.js` | PEMS tasks, activities, evidence links, review transitions. | Per-activity `evidenceRequired` is not persisted in created activity records. OOS evidence/run is not an enforced PEMS submission gate. |
| `backend/routes/oosRoutes.js` | Seller-scoped read/mutate routes; `tasks_manage` required for most actions and `scraping_manage` for resync. | Assigned executors may be unable to upload/reconcile; assign least-privilege domain permissions. |

Direct code links: [TaskWorkspace](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/components/TaskWorkspace.jsx), [OOS workspace](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/oos/pages/OosWorkspacePage.jsx), [OOS migrations](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/backend/migrations/032_oos_reconciliation.js), [OOS template](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/backend/services/pems/oosReconTemplate.js), [PEMS service](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/backend/services/pems/pemsService.js).

## 3. Target architecture

**Tier A: Shared Task Shell**, stable for all task types:
- task instance ID, code, due/SLA, ownership, priority, status, reviewer
- lifecycle actions / audit timeline / comments
- permission-aware navigation and save/error/empty/loading states
- generic evidence store, review handoff and status transitions
- responsive drawer + expand-to-workspace mode

**Tier B: Versioned Task View Definition**, tied to a published template version:
- `viewKey`, `viewSchemaVersion`, `definitionVersion`, `workflowKey`
- tab arrangement and specialized component IDs selected from an allowlist
- stage ordering, form fields, data dependencies and conditional visibility
- actions and API capabilities (display metadata only; NOT authorization)
- required outputs and server-verifiable acceptance rules
- role-specific views: executor, reviewer, manager (same instance, different capabilities)

**Tier C: Specialized Domain Workflow Modules**, like OOS:
- server-backed data sources, reconciliation, Pareto, incidents, resync, Excel
- workflow state, jobs, artifacts, authorization and evidence integrity
- components are registered in code and rendered via `viewKey` or `widgetKey`; template authors cannot inject arbitrary JavaScript, JSX, SQL or URL handlers

**Tier D: Process policy and business integration**:
- review and submission gates, locked publication versions, seller scope
- provider integrations, source timestamps, rollback/retry policy
- audit trail, notifications and escalation

### Important separation

**View definition is not task data.** A task instance is the durable execution object. A view definition tells the UI how to present and act on it. An OOS run is the durable domain-process object. A link table binds them without replacing PEMS. Business validation lives on the server, so switching views or forging a browser call cannot bypass gates.

## 4. Template-specific view registry

Every task template gets a view definition. `STANDARD_V1` handles straightforward checklist tasks. Complex templates use a known workflow view with configurable standard sections.

| View key | Task family | Main tabs/workspaces | Custom backend module |
|---|---|---|---|
| `STANDARD_V1` | Generic recurring task | Overview, SOP, Evidence, Review | PEMS only |
| `OOS_RECON_V1` | `OOS-RECON-001` | Overview, Data Sources, Affected ASINs, Follow-ups & Export, SOP, Review | OOS services |
| `BUYBOX_MONITOR_V1` | Planned Buy Box template | Overview, Lost Buy Box, Competitive Evidence, Actions, Review | To be designed |
| `ASP_MONITOR_V1` | Planned ASP template | Overview, Price Signals, Price Comparison, Cases, Review | To be designed |
| `ADS_MONITOR_V1` | Planned Ads template | Overview, Campaign Data, KPI Variance, Actions, Evidence & Review | To be designed |

Examples are **view design intentions**, not assertions that specialized modules for Buy Box, ASP or Ads already exist. Initially, unknown keys must fail closed or fall back explicitly to standard read-only view, with an admin-facing warning.

### Canonical runtime resolution

1. Employee opens a **PEMS task instance** from My Day / Tasks / Review Queue.
2. Server authenticates user, enforces seller scope and instance access, returns task + immutable view definition corresponding to the instance's template/version.
3. Client renders the shared shell; a **registered view resolver** mounts the specific view, not hard-coded branches for each code in `TaskWorkspace`.
4. Domain widgets fetch through permission-scoped APIs using the bound task-instance context.
5. Actions call server-side domain operations. Results update workflow state; audited evidence and gating flow back into PEMS.
6. Submission goes to PEMS review queue; **independent reviewer** chooses approve/reject; OOS incidents remain open across daily task closure.

## 5. OOS Task View, first production pilot

The new OOS view should use existing workflow services but never trust their current completion/resync mechanics until P0 defects are fixed.

### A. Shared task header (top, persistent)
Task `InstanceCode`, `OOS-RECON-001`, assigned user, selected seller/brand scope, due/SLA, workflow phase, task progress, reviewer, update age. Allow an expanded full-page view for thousands of ASINs. **Do not have employees choose arbitrary sellers; restrict to their task's assigned seller/brand checklist.**

### B. Overview
Cards: assigned sellers coverage, last RetailOps observation, RetailOps unavailable, source freshness, number of open cases, 80% group affected counts, resync pending, uploaded report completeness, unresolved exceptions. Each metric identifies its date and source. If no data, show `Unknown`, never zero.

### C. Data Sources: automatic + employee uploads
For every relevant seller and channel, show:
- RetailOps snapshot (system-generated, readonly, provenance and timestamp)
- BrandCentral file upload: CSV/XLS/XLSX, original binary, checksum, mapped columns, report timestamp, validation summary and reject download
- Vendor Central file upload **only if applicable** for the relevant fulfillment scope; otherwise an audited `Not Applicable` decision with reason
- Uploaded file history and revision policy; reupload as a new source version, never silently replace old evidence
- Apply import-time row-level errors and SKU→ASIN mapping; preserve duplicate rows and ambiguity rather than silently selecting a winner
- Start reconciliation only with required fresh sources or an explicitly approved exception

**Current gap**: standalone OOS workspace parses the first spreadsheet sheet into JSON and server persists normalized observations and metadata; it does not constitute a secured original binary attachment repository.

### D. Affected ASINs: the primary business output
Single consolidated seller-scoped ASIN table, with saved filters and server pagination:

| Column | Notes |
|---|---|
| Seller / channel / ASIN / SKU | scope-qualified row identity |
| RetailOps availability & observed at | fresh timestamp required |
| BrandCentral quantity, status & file | independent evidence |
| Vendor Central quantity, status & file / N/A | independent evidence |
| Reconciliation class / rule & confidence | CONFIRMED_CHANNEL_OOS, DISCREPANCY, INSUFFICIENT_EVIDENCE, etc |
| 30-day GMS and revenue share | configurable period; null is unverified |
| Seller's Pareto tier | 80% / 20% / GMS_UNVERIFIED |
| Priority | formula and approved exception overrides, audit reason |
| Resync | eligible, queued, in progress, verified recovered, still open, blocked |
| Incident owner / seller communication / ETA / next follow-up | persistent case |
| Last action & evidence | traceable audit |

Filters: assigned seller, classification, 80% group, open/closed, resync state, missing data, owner, next follow-up. Bulk actions only when RBAC and scope allow them. Do not auto-mark `RESOLVED` on a sync request or a user-supplied timestamp.

**Export must appear in this tab**, accessible at top-right: `Preview report`, `Export affected ASINs`, `Download latest`, `Export history`.

Required XLSX sheets:
1. `01 Active OOS`
2. `02 Discrepancies`
3. `03 Resync Resolved`
4. `04 Summary & Sources`

Each contains flat usable columns, not giant nested JSON objects. Export artifact is immutable, tied to task + OOS run + seller/channel scope + source snapshots + policy version; store hash, version, creator and timestamp. Respect server-side filters only when clearly labeled: `Entire assigned scope` versus `Current filtered subset`.

### E. Follow-ups and resolution
Case list, assigned owner, replenishment timeline, communication approval/status, next action, follow-up date, critical escalation. Cases persist beyond a daily approved run. `Resolve` requires new verified marketplace observation or independently authorized manual evidence with reason and auditable authority. Employee cannot resolve by toggling a row.

### F. SOP and completion
Six template phases and 12 human confirmation activities remain visible and relevant, but steps that the system fulfills automatically should show `RUNNING / DONE / BLOCKED` from backend workflow evidence. Manual steps require their specific accepted file, justification or acknowledgment; no universal checkbox gate that can be bypassed by direct API calls.

### G. Review
Read-only evidence manifest, export/hash, open incidents with owner/next action, source gaps, resync evidence and exact task linkage. Executor submits to reviewer, does not approve. Reviewer can approve/reject in existing `ReviewQueuePage` after server rechecks the OOS-specific completion gate. **Task closure is not incident closure.**

## 6. Concrete data model changes (proposal; migration review required)

- `PemsTemplateViewDefinitions`: `(Id, TemplateId, ViewKey, SchemaVersion, DefinitionVersion, DefinitionJson, Status, PublishedAt, CreatedBy, ...)`; published definitions are immutable.
- `PemsTaskInstances`: add a `ViewDefinitionId` or immutable snapshot key linked at task creation. Do not silently migrate existing instances to latest view definition.
- `PemsWorkflowLinks`: `(TaskInstanceId, WorkflowType, WorkflowRunId, SellerId, Channel, State, CreatedAt, ...)`; supports **one PEMS multi-brand task → multiple seller OOS runs**. Unique scoped mapping and idempotent get-or-create; prevent attaching another user's run.
- `PemsActivities`: add persistence for `EvidenceRequired`, `CompletionPolicyKey` and result references, or use separately versioned activity acceptance rules. New gates apply on submit/resubmit and on completion where required.
- OOS upload file metadata: original-file object storage references, checksum computed server-side, scan status, authenticated download, timestamp provenance and import version.
- Domain event/outbox: `OOS_RUN_STARTED`, `SOURCE_UPLOADED`, `RECONCILED`, `RESYNC_REQUESTED`, `RESYNC_VERIFIED`, `INCIDENT_UPDATED`, `EXPORT_CREATED`, `OOS_SUBMITTED`, `OOS_APPROVED`, preserving actor/task/run/source IDs.

**Never delete/modify `DLY-004` as part of the new OOS template rollout.**

## 7. API design (proposal)

Shared:
```
GET  /api/pems/instances/:id/view
GET  /api/pems/instances/:id/workflows
POST /api/pems/instances/:id/submit  // existing transition, extended server gate
```

Task-bound OOS routes (can wrap the existing `/api/oos` service):
```
GET  /api/pems/instances/:id/oos/summary
POST /api/pems/instances/:id/oos/runs             // idempotent for each assigned seller/day
POST /api/pems/instances/:id/oos/runs/:runId/files // multipart, server checksum
GET  /api/pems/instances/:id/oos/runs/:runId/files
POST /api/pems/instances/:id/oos/runs/:runId/reconcile
GET  /api/pems/instances/:id/oos/affected-asins?filters&page&limit
POST /api/pems/instances/:id/oos/resync/:caseId   // delegated to authorized sync executor
GET  /api/pems/instances/:id/oos/resync/:caseId
PATCH /api/pems/instances/:id/oos/incidents/:caseId
POST /api/pems/instances/:id/oos/export
GET  /api/pems/instances/:id/oos/exports
GET  /api/pems/instances/:id/oos/exports/:version/download
```

Requests derive seller scope from task associations; never trust a client-supplied `sellerId` when it conflicts with the task. Reuse existing `/api/oos` functions under a task-bound service layer rather than double-maintain business logic.

## 8. Permissions and ownership

| Role | Task view | Upload/reconcile | Request resync | Approve | Configure templates |
|---|---|---|---|---|---|
| Assigned executor | Own assigned task | Yes for assigned scope | Request only | No | No |
| OOS domain operator | Scoped OOS task | Yes | Run approved scoped sync | No | No |
| Independent reviewer | Assigned review task | Read evidence | No unless separately authorized | Yes | No |
| Template admin | Authorized template views | Not automatically | Not automatically | Not automatically | Yes |
| Global system admin | Audit/oversight | Restricted by policy | Restricted by policy | Segregation of duties still applies | Yes |

Recommend dedicated capabilities such as `oos_run_execute`, `oos_upload`, `oos_resync_request`, `oos_resync_execute`, `oos_review` rather than giving all Brand Managers broad `tasks_manage` or `scraping_manage`. All permissions are enforced by backend authorization with task/seller scope. Audit every override.

## 9. Migration and rollout steps

0. Snapshot existing GitHub `main`, migrations, DLY-004, OOS-RECON-001; review existing database state before changes.
1. Extract shared shell from `TaskWorkspace.jsx` while retaining original generic view by default, with compatibility tests.
2. Implement server-owned versioned view definitions, schema allowlist validation, and frontend view registry.
3. Implement task-bound workflow associations, including multiple sellers per task instance and correct seller permissions.
4. Port OOS controls from `/tasks/oos` into an `OosTaskView` / `OosAffectedAsinsTab` without duplicating service functions. Keep full-screen mode for large tables.
5. Fix critical source reconciliation and resync defects, especially client-provided verification and unconditional incident closure. Integrate actual sync worker.
6. Add original-file storage, uploaded report validation, a true Vendor N/A policy, GMS priority in affected case rows and the approved four-sheet export.
7. Add OOS completion gate to PEMS status transition and independent review; make task reviews use the canonical PEMS review queue.
8. Unit, API integration, UI and browser tests with multiple sellers, stale sources, invalid files, stale sync and malicious out-of-scope requests.
9. Pilot only with `OOS-RECON-001` inactive/shadow, obtain operations + security + reviewer signoff, then controlled activate; keep DLY-004 history untouched.
10. Demonstrate second distinct template (e.g. Buy Box) using registry to prove architecture is generic, without implementing its external integrations prematurely.

## 10. Minimum acceptance criteria

1. A new template selects its view by published definition/version, not `if (TemplateCode === X)` in the global drawer.
2. Standard tasks render identically to prior production flow; no regression to My Day, reviewers, or task history.
3. View cannot access or act on sellers not assigned to the task and user.
4. OOS tab opens directly from task instance, preserving task ID and seller scope.
5. All required uploaded original files have server-computed SHA-256, owner, parser version, upload timestamp and stored provenance.
6. Unknown/blank and invalid source values remain unknown, not stock zero or available.
7. Report channel applicability (especially Vendor) is explicit and auditable.
8. Three-source reconciliation supports zero-stock rows that appear only in source reports.
9. Seller-wide eligible-catalog GMS denominator is used; affected ASINs get tier and amount, missing GMS is UNVERIFIED.
10. Export of affected ASINs is inside the OOS Affected ASINs tab and has four correct flat sheets.
11. Resync jobs actually execute under permission/quotas; accepted/queued is not recovery.
12. No client-origin timestamp or status may automatically resolve an OOS incident.
13. Task submission is blocked when required sources, dispositions, export evidence or follow-ups are missing; open owned incidents do not block daily monitoring completion.
14. Independent logged-in reviewer decides approval/rejection in PEMS; executor cannot approve their own work.
15. Existing DLY-004 definition, instances and historical evidence are unchanged.
16. Second template can have a different tab set without duplicating the whole TaskWorkspace.

## 11. Architectural tradeoffs and anti-patterns

**Avoid:** one giant component with task-code conditionals; copying task-workspace pages per template; user-written JavaScript/SQL in template definitions; trusting tab completion as workflow completion; arbitrary seller selection inside a task; client-origin state and timestamps as verification; broad manager permissions to execute sync; automatic closure of unresolved seller incidents; changing already-created tasks when SOP is republished.

**Prefer:** a component registry with explicit contract, versioned immutable view definitions, case-specific backend services, typed action capabilities, provenance-rich evidence, domain events and a common audit/review engine.

## 12. Verification caveats

This is a **source-code architecture audit and an implementation design**. It is not a deployed code change, a passing CI report, a database migration assessment, or a security signoff. Before implementation, compare against the latest `main` again and inspect live DB shape and runtime permissions in staging.


## 12. Detailed Excel-style affected ASIN register (October 23 clarification)

The **Affected ASINs** tab is the operator's primary workspace, not merely a list of identifiers. Use a responsive, virtualized, server-paginated **data grid**, with a one-click full-screen mode and horizontal scrolling in the drawer. The same workflow dataset powers the downloadable Excel report.

### Grid columns

| Group | Fields | Source and integrity rule |
|---|---|---|
| Product identity | Seller ID/name, marketplace, channel/fulfillment scope, ASIN, SKU, title, listing status | Seller-scoped; join on validated seller/channel/ASIN, preserve SKU mapping exceptions |
| RetailOps | Availability classification and raw status, stock if known, observed at, freshness | System snapshot captured for the run; missing status remains UNKNOWN |
| BrandCentral | Uploaded file ID/version, quantity, raw inventory status, source timestamp, report validity | Original-file reference and ingest decisions retained |
| Vendor Central | Same fields as BrandCentral plus applicable/N/A | Never add quantities across incompatible channels |
| Performance | Trailing-window GMS, seller catalog GMS, ASIN share %, cumulative %, Pareto tier | Full eligible seller catalog denominator, not OOS-only |
| Reconciliation | Classification, rule ID, confidence, incident ID, status, evidence freshness | Read-only derived classification, auditable manual override separately |
| Marketplace sync | Eligibility reason, job ID, requested at, completion, before/after availability, observation timestamp | Job accepted does not imply recovery; server-observed post-sync only |
| Handover | Owner, communication status, replenishment ETA, next follow-up, action, remarks | Permission-controlled workflow mutations and immutable event trail |

### Grid behaviors and acceptance requirements

- Task-specific presets: **Essential**, **Inventory Comparison**, **GMS & Priority**, **Resolution & Follow-up**, **All Details**; saved per user if permitted.
- Search ASIN/SKU/title; filters by assigned seller, channel, confirmed OOS/discrepancy/insufficient/resolved, Pareto tier, incident status, owner, sync state, freshness and follow-up due date. Sorting and filtering must execute on the server when datasets are large.
- Fixed seller/ASIN column, sticky header, expandable row drawer containing full source evidence, issue history and resync event chronology.
- Case row identity: `(taskInstanceId, runId, sellerId, marketplace, channel, asin)`; ensure deduplication policy does not conflate fulfillment channels.
- Numeric GMS formatted in INR with explicit window and currency; null data displays **Unverified** rather than 0. All quantities retain source identity, last-observed timestamps and original raw data.
- Per-row action controls such as request sync, update follow-up and resolve must be authorized and backed by evidence checks; never allow bulk incident closure without verification.
- Top toolbar exports **Entire assigned scope**, **Current filtered results**, or **Selected rows** with an explicit indication of the export scope.
- **Download as CSV** may be provided for quick analysis. **Generate 4-sheet XLSX** creates the approved immutable domain workbook and returns version, hash and authenticated link. It must never simply export the first page of currently rendered rows.
- Excel workbook sheets: `01 Active OOS`, `02 Discrepancies`, `03 Resync Resolved`, `04 Summary & Sources`. The data must be row-oriented, not nested JSON. Ensure CSV/XLSX export is protected against spreadsheet formula injection.
- Status counts must be computed for the server-filtered total, not only the current page. A filtered report must clearly label the filters and snapshot.
- No hidden data is assumed: include a `Data issue` status when source files are stale, mapping is unresolved or GMS is missing.

### Reference implementation handoff

Existing `PemsTaskAsins` is not the canonical OOS reconciliation dataset. Create a task-bound `GET /api/pems/instances/:id/oos/affected-asins` joining authorized OOS decisions, raw observations, GMS ranking and durable incidents. Keep PEMS ASIN signals as a cross-task summary and link by stable domain case ID where needed. Existing `/api/oos/runs/:id/export/download` can be reused only after task linkage and workbook alignment.

An interactive demo grid and a four-tab XLSX sample accompany this spec. **Both contain fictional illustration data only.**


### Priority groups follow-up update
The OOS grid and exports use **80%** and **20%** priority groups, never Tier 1/Tier 2. New ASINs enter the 20% group via a separately audited, configurable new-ASIN flag, with GMS verification and business exceptions retained. See `OOS_Affected_ASINs_Grid_Handoff.md` §8 for rules and precedence.
