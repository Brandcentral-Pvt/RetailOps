# Implementation specification: Template-specific Task Views + OOS-RECON-001

**Status:** Approved functional design; engineering implementation required. **No production activation authorized.**  
**GitHub baseline inspected:** `Brandcentral-Pvt/RetailOps`, `main` SHA `9cbee6385c72c27bb83884352de2e8574b7b9754`, October 23, 2026. Verify the checkout before working.

## 1. Objective

Rebuild the Task View rendering architecture so **each task template has its own workflow-specific view**, while preserving a shared secure task lifecycle. The first specialized view is `OOS-RECON-001`. The old `DLY-004` is separate and immutable for this project. `OOS-RECON-001` stays inactive, non-autoassigning until a later explicitly approved cutover.

**Required user journey:** Employee opens assigned OOS task from My Day / Tasks. The same task View displays the correct assigned sellers. Inside **Affected ASINs**, the employee can view the automatically acquired RetailOps unavailable snapshot, upload each required original BrandCentral and applicable Vendor Central report, validate/reconcile three sources, inspect a detailed Excel-style table with 80%/20% priority and New ASIN indicator, dispatch authorized resync, track discrepancies/owners/ETAs, and generate/download the four-sheet resolution workbook. Submission leads to an independent reviewer; completed daily monitoring does not erase unresolved OOS incidents.

This is not a static mockup. All controls require persisted server behavior, correct authorization and evidence.

## 2. Existing source map (verify at current HEAD)

| Concern | Existing files | Observed limitation |
|---|---|---|
| Shared drawer | `src/modules/tasks/components/TaskWorkspace.jsx` | One large generic renderer; OOS hardcoded navigation to `/tasks/oos` without task ID |
| Generic affected ASIN | `TaskWorkspace.jsx` `AffectedASINsPanel`, `backend/services/pems/pemsService.js` | Reads `PemsTaskAsins`, not OOS reconciliation decisions/incidents; remarks call passes record ID rather than ASIN code |
| Template lifecycle | `src/modules/tasks/components/TemplateBuilder.jsx`, `backend/services/pems/pemsService.js` | Static SOP builder and draft/publish checks; no immutable view definition version snapshot |
| PEMS tasks | `backend/routes/pems/pemsRoutes.js`, `pemsController.js`, `pemsService.js`, `backend/services/pems/workflowEngine.js` | Use existing assignment/review and seller scope; OOS-specific server submission gate missing |
| Multi-brand routine | `backend/services/pems/recurrenceService.js`, `PemsTaskBrands` | One person task + brand checklist, which must map to many scoped OOS runs |
| OOS workspace | `src/modules/oos/pages/OosWorkspacePage.jsx` | Standalone OOS workflows, uploads/export, but not task-context bound |
| OOS domain | `backend/services/oos/*.js`, `backend/routes/oosRoutes.js`, `backend/controllers/oosController.js` | Skeleton services exist; critical resync, evidence, approval and export gaps |
| SQL migrations | `backend/migrations/030_pems_task_asins.js`, `032_oos_reconciliation.js` | Separate task ASIN issues and OOS decisions; OOS runs lack direct task-binding |
| Tests | `backend/__tests__/unit/oos*.test.js`, `tests/task-oos-workspace.spec.js`, `tests/task-workspace-drawer.spec.js` | New dedicated task-bound integration tests not present |

Existing root scripts: `npm run lint`, `npm run typecheck`, `npm run build`; backend has Jest `npm --prefix backend test` and Playwright tests under `tests/`. No live test execution performed in the creation of this spec.

## 3. Target architecture and versioning

- **SharedTaskShell** displays task identity, owner, reviewer, status, deadlines, SLA, evidence, comments, immutable audit timeline and role-allowed lifecycle controls. Its rendering and APIs must remain compatible with generic existing tasks.
- **View definition** is versioned per template and contains `viewKey`, `schemaVersion`, `definitionVersion`, allowed widget keys, tab definitions, field layout, evidence/automation bindings, accessible labels and role capability references. No executable component name construction, dynamic import paths, script contents, SQL or arbitrary endpoint paths from untrusted definition.
- **Task view registry** maps allowlisted keys to vetted React components; it accepts an explicit saved view-definition version for each task instance. Unknown key -> safe read-only generic fallback, not crash/accidental action enablement.
- **Domain workflow** is registered separately, e.g. `OOS_RECON_V1`. It persists its own runs and decisions and is not a replacement for PEMS. Published template changes create new versions, never modify the display contract or required evidence of in-flight historical tasks.
- **Editor** can select approved task-view type and configure supported widgets/fields. Drafts may be edited. Only a complete, validated, explicitly published view becomes selectable for new work. UI validation must be mirrored on backend with clear error codes.

Reasonable starting structures (agent must assess repository patterns before creating):

```
src/modules/tasks/components/SharedTaskShell.jsx
src/modules/tasks/view-registry/taskViewRegistry.js
src/modules/tasks/views/GenericTaskView.jsx
src/modules/tasks/views/oos/OosTaskView.jsx
src/modules/tasks/views/oos/components/{OosAffectedAsinsTab,SourceUploader,AffectedAsinGrid,AsinDetailDrawer,ResyncStatus,ExportPanel}.jsx
backend/services/pems/taskViewDefinitionService.js
backend/services/pems/taskViewExecutionGate.js
backend/services/oos/{...existing domain services...}
backend/migrations/033_...forward_only...
```

Use stable, explicit instance and domain association:

```
PemsTaskInstance.Id (authoritative task)
   -> OosTaskBindings.TaskInstanceId (unique per task/seller/channel/scope)
   -> OosRuns.Id (seller/channel/date/workflow run)
   -> OosImports / OosObservations / OosDecisions / OosIncidents /
      OosResyncJobs / OosExports / OosSubmissionReviews
```

This is a **logical relationship contract**, not an unconditional schema mandate. Migration must account for the existing `UX_OosRuns_Date_Seller` unique index and other constraints without silent data loss. Repeated open/runs remain idempotent. A single multi-brand task may have a complete checklist of seller runs, each with its own file history and channel policy.

## 4. OOS Task View information architecture

**Persistent header**: task instance code, template code and version, assigned employee, due/SLA, reviewer, task status, seller coverage progress, last source freshness, and an expand-to-workspace control. All counts and seller context must come from the authorized task scope.

**Overview**: eligible ASINs (seller-specific), RetailOps unavailable, uploaded sources, confirmed OOS, discrepancies, 80% affected ASINs, 20% affected ASINs, New ASINs (20%), GMS-unverified, queued/failed/resolved resyncs, open incidents, late follow-ups. Empty/unknown values are distinct from true zero. Counts must include provenance/time.

**Affected ASINs (primary working tab)**: first row of controls is seller and channel (bounded by task assignment), automatic RetailOps read-only snapshot with timestamp, BrandCentral file uploader, applicable Vendor Central file uploader and N/A reason control, source freshness/validation chips, `Reconcile` button, `Export CSV` and `Generate/Download XLSX` actions. Then a high-density data grid with typed filters and source evidence. Filtered counts must be server-derived; the Excel export must include more than one page where applicable.

**ASIN detail panel**: raw source values, file ID/hash/column mapping/timestamp, exact SKU mapping, reconciliation rule and decision revisions, frozen seller GMS denominator/priority rule, first-seen provenance, resync request/provider job and later observed status, incidents, owner and communication/follow-up timeline.

**SOP/Execution**: the six phases and twelve human outcome checks may appear on a configured tab. Automated operations advance from verified domain results; cannot be advanced by arbitrary ticks. Activities needing evidence must link actual run-specific artifact IDs, not general link count alone.

**Review**: executor sees readiness checklist, unresolved exceptions, immutable export manifest and `Submit for independent review`; reviewer sees the same source evidence and a real `Approve` or `Reject/Return for Rework` action bound to their identity. Never combine Submit and Approve.

**Full page mode** may render a larger grid but must preserve the same `taskInstanceId` / source state and authorization as the drawer.

### Affected ASIN table columns

| Data group | Required server-backed columns |
|---|---|
| Identity | seller ID/name, marketplace, fulfillment channel, ASIN, SKU, product title, active/archived marker |
| RetailOps | raw availability remark, normalized status, independently observed stock (nullable), observation time, freshness and source |
| BrandCentral | raw/status/quantity (nullable), file version/checksum, original report timestamp, row/key mapping |
| Vendor Central | raw/status/quantity (nullable), applicability flag and reason, file version, source timestamp |
| GMS | configurable window, seller eligible active catalog GMS denominator, ASIN GMS, seller share %, cumulative %, mathematically computed Pareto cohort, visible group `80%`/`20%`/pending, first seen, lifecycle New/Existing/Unknown, verification confidence and priority rule |
| Reconciliation | classification, rule ID, confidence/exception, last decision revision, incident ID and stage |
| Resync | eligibility and reason, job ID, state, request time, provider correlation ID, new observation source/time/status, recover confirmation |
| Follow-up | owner, communication status and approval event, replenishment ETA, next action, next follow-up, resolution evidence |

Use column presets `Essential`, `Inventory & GMS`, `Resolution`, `All details`. Search ASIN/SKU/title/owner. Filters: seller, channel, `80%`, `20%`, `New ASINs (20%)`, GMS Unverified, confirmed OOS, discrepancy, insufficient evidence, resync stage, follow-up overdue. Server-side pagination with stable sort; header identifiers sticky where practical; accessible narrow-screen layout with drill-down instead of squashed 25-column table.

## 5. Inventory input and decision requirements

**RetailOps is first**: snapshot all relevant actively listed ASINs, specifically CURRENTLY UNAVAILABLE and explicit OOS statuses. Capture raw availability fields + actual source timestamp, distinct from DB `UpdatedAt`. No fabricated `Available` default for missing data, no loss of currently unavailable signal merely because a stock-count field is positive. Snapshot available catalog too when needed for GMS denominator and joins.

**Uploads**: original file content is stored (not only frontend JSON rows). Recompute checksum server-side. Validate actual file size/type/content and authorization, format (CSV/XLS/XLSX where supported), row cap, sheet choice, headers, source time and seller/channel identity. Show per-file accepted/rejected/ambiguous counts. Preserve duplicates for investigation; never silently choose one SKU with positive inventory among incompatible rows. Version reuploads without overwriting originals; no blind `(RunId,Channel,SourceType)` overwrite. Missing column/record/status is unknown, not zero. Vendor applicability is an explicit policy decision per channel and fulfillment, not the old blanket Amazon default.

**Reconciliation**: union of RetailOps unavailable + BrandCentral zero + applicable Vendor zero. Join on authorized seller + marketplace + fulfillment channel + normalized verified ASIN/SKU. Positive BrandCentral plus positive Vendor with RetailOps unavailable = resync candidate; positive BrandCentral but Vendor zero = conflicting channel-specific evidence that must not be collapsed. Stale/missing source -> insufficient evidence/manual verification with reason. Persist decisions and audit metadata.

**GMS**: compute seller-wide Pareto using all eligible active ASINs in the selected 30-day default **pending business approval** or configured window, with no cross-seller leakage or double-counts. Sort nonnegative verified GMS descending with deterministic tie. Mathematical 80% boundary is the smallest set meeting/exceeding 80%. Expose cumulative GMS share and group. Existing verified cohort member = 80%, verified remainder = 20%; **all verified new ASINs = 20% display override**. 'New' defined by versioned, authorized first-seen/launch-date policy, not inferred from missing GMS; fallback Unknown. Existing unknown GMS = priority pending/GMS_UNVERIFIED, not 20%. Flag high-revenue New ASIN override for special operational attention. The override does NOT retroactively change the original mathematical cohort or denominator.

**Resync**: eligibility from fresh same-channel positive stock + current unavailable signal. Request is only job queue creation. Actually dispatch with existing `liveDataSyncService`/Creators API rate gate and seller locks (only supported marketplaces), not custom separate throttler. Broker is durable across PM2 workers; record provider attempt outcome and explicit failures. Browser cannot mark recovered by supplying in-stock state/timestamp; a backend lookup must read a newer authoritative observation and verify same seller/channel/ASIN. Resolve matching incident within an atomic transition only if outcome is verified recovered. No automatic seller communication.

**Incidents**: unique open incident per seller/channel/ASIN episode; maintain owner, communication approval/status, replenishment ETA, follow-up date/next action, evidence trail. Unresolved incidents remain open even after daily task approved. Manual resolution/waive requires authorized evidence and reason; no one-click generic resolve for OOS.

## 6. Export contract

The primary Affected ASINs tab exposes:
- `Download filtered CSV` with explicit filters and export row count.
- `Generate 4-sheet XLSX` on all authorized affected ASINs or an explicitly chosen saved-filter/selected scope.
- `Download latest XLSX`, export version/history, generated by/on, source hashes and policy version.

Exact sheet names:

| Sheet | Rows / mandatory purpose |
|---|---|
| `01 Active OOS` | All active confirmed channel OOS cases (not only first grid page), with seller, ASIN/SKU/title, source quantities/times, New/Existing flag, 80/20/priority pending, GMS, incident owner, ETA and next action |
| `02 Discrepancies` | Unresolved mismatches and insufficient-evidence cases, decision rule, channel, original evidence, resync stage/next action |
| `03 Resync Resolved` | Only server-verified marketplace recovered cases with job/provider evidence, before/after states, timestamps and incident closure |
| `04 Summary & Sources` | Per seller/category/priority counts, full-catalog GMS denominator and period, source manifest, original filename/hash, validation exceptions, policy version, export generation provenance |

Flat Excel rows, headers, AutoFilters, frozen header, appropriate number/date/currency formatting and no formula injection (`=`, `+`, `-`, `@` prefix values must be neutralized in all untrusted text). No JSON blobs where users need structured columns. File checksum generated server-side and immutable versioned record. Pagination may NOT truncate output.

## 7. Security and review controls

- All routes require authenticated task access; server verifies target TaskInstanceId belongs to `OOS-RECON-001` and contains requested seller+channel scope. Read/act/review are separate permissions; no broad `tasks_manage` grant to ordinary executors.
- Authorized assigned executors may upload/inspect/reconcile/annotate their task. Reviewer may inspect full evidence and approve/reject in PEMS; privileged resync requires approved domain permission, existing `scraping_manage` gate or tightly scoped delegated capability; template admin is separate.
- For 403/404 out-of-scope record lookups, never leak foreign seller labels, filenames, or row counts. Export filters and downloadable link IDs must be scoped and re-checked on the server.
- For every OOS run, PEMS SUBMITTED/RESUBMITTED transition checks each assigned seller's required report or approved applicability exception, complete decision disposition, no fabricated freshness, immutable export, and all open incidents fully owned/follow-up. Once submitted, record `SUBMITTED`, not `APPROVED`.
- Reviewer independently calls existing PEMS review system under authenticated identity, with no review-by-assignee (including global roles unless separately authorized audited override). Approval is atomic and evidence-gated. Reject/rework path returns to employee.
- Protect all generic non-OOS tasks, previous instances, review comments, historical evidence, recurrence and dashboard behavior.

## 8. Suggested task-bound endpoint contract (PROPOSED, not present)

```
GET  /api/pems/instances/:instanceId/task-view
GET  /api/pems/instances/:instanceId/oos/context
GET  /api/pems/instances/:instanceId/oos/sellers/:sellerId/runs
POST /api/pems/instances/:instanceId/oos/sellers/:sellerId/runs
POST /api/pems/instances/:instanceId/oos/runs/:runId/uploads
GET  /api/pems/instances/:instanceId/oos/runs/:runId/uploads
POST /api/pems/instances/:instanceId/oos/runs/:runId/reconcile
GET  /api/pems/instances/:instanceId/oos/affected-asins?search=&page=&limit=&sortBy=&priorityGroup=&isNew=&...
GET  /api/pems/instances/:instanceId/oos/affected-asins/summary
GET  /api/pems/instances/:instanceId/oos/affected-asins/:caseId
POST /api/pems/instances/:instanceId/oos/runs/:runId/resync
GET  /api/pems/instances/:instanceId/oos/runs/:runId/resync
POST /api/pems/instances/:instanceId/oos/exports
GET  /api/pems/instances/:instanceId/oos/exports/:exportId/download
POST /api/pems/instances/:instanceId/oos/submit
```

Adapt endpoint naming to repo conventions. Do not create duplicate business logic controllers for existing services. Runtime schema must preserve stable response envelope, exact instance/seller scope, source timestamps and error codes. Do not expose an endpoint that accepts client-authored post-sync recovered claims.

## 9. Migration, deployment and rollback boundaries

Design forward-only migrations and indexes for view definitions/instances, task run mapping, original uploads, revisions, priority snapshots, resync provider evidence and review association. Existing migrations 030 and 032 must remain intact in-place; inspect migration engine and make a new ID. Handle preexisting data and unique indexes with data checks. Provide a migration dry-run procedure, operations rollback instructions (feature disable + backward-compatible schema), and cleanup only after explicit release approval. Feature-flag live sync and publish activation default OFF.

## 10. Completion and non-goals

Done only if backend, frontend, tests and deployment handoff all correspond to the specification and acceptance matrix. Screenshots alone and green mocked UI tests do not establish end-to-end validity.

Non-goals: shipping a full custom Buy Box/ASP/Ads workflow now; running real seller notifications; modifying DLY-004; renaming legacy ASIN signal types wholesale; enabling production OOS automation; inventing seller GMS or source observation results.
