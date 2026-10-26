# BrandCentral RetailOps | OOS Task View Integration Audit

**Audit ID:** BC-OPS-OOS-TV-001  
**Date:** 23 October 2026  
**Repository:** [Brandcentral-Pvt/RetailOps](https://github.com/Brandcentral-Pvt/RetailOps) (private)  
**Revision inspected:** [`9cbee6385c72c27bb83884352de2e8574b7b9754`](https://github.com/Brandcentral-Pvt/RetailOps/commit/9cbee6385c72c27bb83884352de2e8574b7b9754), `main`  
**Scope:** Existing task drawer, generic Affected ASINs tab, evidence model, new OOS workspace, associated APIs and persistence  
**Assessment type:** Static source-code audit; no repository changes, migration execution, live environment, or test runs

## 1. Executive decision

**Decision: REDESIGN THE OOS TASK VIEW INTEGRATION, NOT THE GENERAL TASK MODULE.**

The shared Task View drawer is operational for generic PEMS tasks. Its Affected ASINs tab reads `PemsTaskAsins`, groups signals by seller, and lets operators edit remarks or resolve/waive a signal. The new OOS service is a separate application at `/tasks/oos` with file intake, reconciliation, incidents, resync, and a four-sheet XLSX exporter. There is no authoritative, persisted binding between the current PEMS task instance and the relevant OOS run(s). The Task View button simply navigates to `/tasks/oos` without the instance ID.

**Target:** For the new inactive `OOS-RECON-001` template only, replace the generic *Affected ASINs* tab content with an **OOS Task Operations panel** that includes (1) RetailOps snapshot, (2) BrandCentral and applicable Vendor Central file uploads, (3) reconciled affected ASINs with GMS Pareto, (4) eligible targeted resync and verified outcome, (5) incident follow-up, and (6) workbook export and audit evidence. Keep the generic panel unchanged for all other templates. Retain `DLY-004` as-is.

**Release state:** BLOCKED for live OOS use. Source code contains safety and workflow integration gaps. It does not establish that migration 032 is installed or that tests pass in deployment.

## 2. Current Task View: source-derived anatomy

| Surface / flow | Existing implementation | Evidence | OOS suitability |
|---|---|---|---|
| Entry | Tasks list / My Day opens `TaskWorkspace` drawer for an instance ID | [`TaskInstancesPage.jsx`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/pages/TaskInstancesPage.jsx), [`MyDayPage.jsx`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/pages/MyDayPage.jsx) | Keep |
| Drawer tabs | Overview; SOP/checklist; resolution; Affected ASINs; Evidence; Discussion; additional content per task | [`TaskWorkspace.jsx#L796-L1030`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/components/TaskWorkspace.jsx#L796-L1030) | Keep shell; customize OOS affected tab |
| Generic Affected ASINs | Fetches `GET /api/pems/instances/:id/asins`, seller-grouped signal, severity, numeric/string value, remarks, status, Resolve/Waive | [`TaskWorkspace.jsx#L59-L285`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/components/TaskWorkspace.jsx#L59-L285) | Not an OOS reconciliation view |
| Generic Affected ASINs persistence | `PemsTaskAsins`, signal codes and manual status changes | [`pemsService.js#L1190-L1329`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/backend/services/pems/pemsService.js#L1190-L1329), [migration 030](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/backend/migrations/030_pems_task_asins.js) | Retain for generic signals; do not duplicate OOS incidents as source of truth |
| Evidence tab | Adds an evidence *link* with name, URL, remarks to `PemsEvidence` | [`TaskWorkspace.jsx#L991-L1021`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/components/TaskWorkspace.jsx#L991-L1021) | Not a binary inventory-file upload path |
| OOS entry point | `OOS-RECON-001` shows an `OOS workspace` button that navigates to `/tasks/oos` | [`TaskWorkspace.jsx#L1126-L1135`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/components/TaskWorkspace.jsx#L1126-L1135) | Loses task-instance context |
| OOS standalone workspace | Seller and run-date selector; BrandCentral / Vendor Central upload; source manifest; decisions; incidents; resync; export; submit | [`OosWorkspacePage.jsx`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/oos/pages/OosWorkspacePage.jsx) | Can be reused as component logic, not as detached workflow |
| Task review | PEMS transitions and review queue | [`ReviewWorkspace.jsx`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/src/modules/tasks/components/ReviewWorkspace.jsx), [`pemsService.js#L1431-L1471`](https://github.com/Brandcentral-Pvt/RetailOps/blob/main/backend/services/pems/pemsService.js#L1431-L1471) | Reuse after OOS submission gate and authenticated review are bound |

### 2.1 What the generic Affected ASINs tab actually stores

The generic tab is a signal/issue tracker, not an inventory observation store. A row carries `AsinCode`, `SellerId`, `SignalCode`, `SignalLabel`, `Severity`, `NumericValue`, `StringValue`, `Remarks`, `Status`, `Resolution`, `WaiveReason` and audit fields. It has no BrandCentral file ID, Vendor Central file ID, RetailOps snapshot reference, GMS tier, resync job, OOS decision revision, or exported workbook version. Those are represented separately in the new OOS tables.

### 2.2 Current OOS upload path

`OosWorkspacePage.jsx` parses the **first sheet** using SheetJS in the browser and sends parsed JSON (`{sourceType, fileName, rows}`) to `POST /api/oos/runs/:id/imports`. `oosUploadService.js` normalizes ASIN/quantity/status/timestamp, persists import metadata and observations, and rejects invalid ASIN rows. The **original uploaded binary is not persisted by that path** and the UI does not provide file-mapping preview or explicit per-seller Vendor Central N/A evidence. File integrity is currently based on row content, not verifiable storage of the original workbook.

### 2.3 Current OOS export path

`oosExportService.js` creates XLSX sheets named `Seller Summary`, `Source Manifest`, `Incidents & Follow-ups`, `Resolved Audit`, and `OosWorkspacePage.jsx` places the download under `Review, export & close`. This does **not** meet the agreed task UX requirement to export **from Affected ASINs** or the agreed flat operational workbook layout (`Active OOS`, `Discrepancies`, `Resync Resolved`, `Summary & Sources`).

## 3. Agreed process vs current implementation

| # | Agreed workflow obligation | Present in source | Exact gap / proposed Task View behavior | Severity |
|---|---|---|---|---|
| 1 | Open an assigned OOS task and see its own seller scope | Task drawer loads PEMS task; OOS page loads independent seller list | Task ID is not propagated, OOS run is not associated with PEMS task or brand checklist | **P0** |
| 2 | Gather RetailOps currently-unavailable data before employee uploads | Run manifest summarizes active ASINs/unavailable counts; reconciliation queries current live ASIN rows | Need snapshot ID, frozen membership/values/timestamp, per-seller freshness and audit trail, not only aggregate counts | P1 |
| 3 | Upload BrandCentral inventory report for each assigned seller | OOS page has BrandCentral upload card | Must be inside the task's Affected ASINs, scoped to current seller/run, with original file retention and mapping preview | P1 |
| 4 | Upload Vendor Central report where applicable | OOS page has Vendor Central upload card | Need verified applicability per seller/fulfillment channel; explicit N/A reason and associated evidence, no forced upload across unrelated channels | P1 |
| 5 | Validate uploaded files | API validates ASINs/quantities and stores rejected counts | Needs SKU-only mapping, duplicate/ambiguous handling, record-level rejected-row review, file checksum server-calculated, authoritative report timestamp | P1 |
| 6 | Compare three sources and classify affected ASINs | Reconciliation policy R0-R6; service stores `OosDecisions` | Enforce freshness before authoritative classification, capture policy version; distinguish unknown, mismatches and channel-level OOS | **P0** |
| 7 | Apply GMS 80/20 based on seller's eligible complete catalog | `getSellerPareto` reads GMS data | Tier/GMS is not materialized into each affected row or export; verify seller-account scoping of GMS | P1 |
| 8 | Run authorized targeted resync for eligible mismatches | Creates `OosResyncJobs` with `QUEUED` status | No OOS service dispatcher to existing marketplace live sync | **P0** |
| 9 | Resolve only after verified fresh marketplace result | `verifyResync` stores a supplied state/timestamp | Caller supplies observation; service invokes incident resolution even when result is not recovered | **P0** |
| 10 | Export affected cases from Affected ASINs | OOS exporter exists separately | Move export control to tab; use flat actionable sheets and attach hash/version to task evidence | P1 |
| 11 | Keep unresolved incidents with owner, communication, ETA and follow-up | `OosIncidents` and edit UI | Link incidents to PEMS task/run and enforce handover; manual resolution must not bypass recovery policy | P1 |
| 12 | Independent review before daily monitoring closure | PEMS has independent review workflow | OOS `submitRun` immediately labels submission `APPROVED`/`CLOSED` based on submitted reviewer ID, without reviewer decision | **P0** |
| 13 | Employee can perform assigned work without managing templates | OOS write endpoints use `tasks_manage` | Separate execution authorization from template administration; resync remains privileged | **P0** |

## 4. Confirmed code defects and risks

### P0-01 | Broken task identity and audit chain

- **Observed:** `TaskWorkspace.jsx` navigates to `/tasks/oos` without passing the PEMS instance. `OosRuns` has seller/date/channel fields but no PEMS task-instance link (migration 032). Standalone workspace selects seller and date independently.
- **Effect:** Uploads, resyncs, cases, workbook exports, and daily task reviewer decisions cannot be securely and automatically attributed to the exact assigned task.
- **Fix:** Bind `TaskInstanceId` to one or more OOS runs through a dedicated link table or equivalent audited association, and derive permitted sellers from `PemsTaskBrands` and task ownership. Do not rely on URL parameters alone.
- **Important cardinality:** A single PEMS daily task may cover multiple assigned sellers; a seller/day OOS run may be shared by multiple authorized tasks. Support a **many-to-many association** where necessary, rather than forcing one OOS run per task and duplicating seller-day incidents.

### P0-02 | Resync job is queued but not executed

- **Observed:** `oosSyncService.requestResync` performs eligibility, idempotency, and database insert, but does not dispatch the job to `liveDataSyncService` or another marketplace-sync adapter.
- **Fix:** Implement a durable worker with explicit `QUEUED → RUNNING → FINISHED/FAILED/TIMED_OUT`, scoped ASIN IDs, rate limiting, retry/cooldown and audit IDs. Reuse existing `POST /api/market-sync/sync-asins-live` implementation or the underlying service via an authorized server-side adapter.

### P0-03 | Unsafe recovery verification and incident closure

- **Observed:** `oosSyncService.verifyResync` accepts `verification.state` and `observationTime` from the HTTP request; `incidents.resolveForAsin()` is invoked whether `outcome.resolved` is true or false (lines 154-161).
- **Fix:** Read the post-sync observation from an authoritative server-side source, verify timestamp > job start, match seller + channel + ASIN, and call `resolveForAsin` **only** on verified recovery. Failed/unchanged/timeouts remain open. Remove default `IN_STOCK` from the verification modal.

### P0-04 | OOS review bypasses independent approval

- **Observed:** `oosSubmissionService.submitRun` accepts a reviewer ID supplied during submission, inserts an OOS review as `APPROVED` when its checklist passes, and directly changes `OosRuns` to `CLOSED`. No separately authenticated reviewer performs the approval.
- **Fix:** Employee action becomes `SUBMITTED`; reviewer opens task via Review Queue and approves/rejects using existing PEMS review API. Close OOS run only after successful independent PEMS approval and any OOS-specific gate.

### P0-05 | Role model blocks employee execution

- **Observed:** OOS upload, reconcile, incident update, export and submit endpoints require `tasks_manage`, while many executors have only `tasks_view`. Resync also requires `scraping_manage`.
- **Fix:** Introduce a server-enforced executor policy tied to the current `TaskInstanceId` and assigned brands for non-privileged actions. Keep template administration with `tasks_manage`, reviewer decisions with reviewer authorization, and marketplace execution with the privileged sync executor. Do not grant all Brand Managers `tasks_manage`.

### P0-06 | Reconciliation decision can use stale RetailOps evidence

- **Observed:** `oosReconciliationService` calculates `retailFresh` and attaches it to the intermediate object, but `oosPolicy.reconcileCase` does not use that freshness flag when declaring `CONFIRMED_CHANNEL_OOS`. Report timestamps are likewise not required by that decision branch.
- **Fix:** Define policy-based freshness gates for every authoritative classification; missing or stale required evidence results in `INSUFFICIENT_EVIDENCE` or a named verification-needed category, never a confirmed stockout by default.

### P1-07 | Generic Affected ASINs remarks pass the wrong identifier

- **Observed:** `TaskWorkspace.jsx` passes `record.id` to `updateAsinRemarks` as `asinCode`, but `pemsService.updateAsinRemarks` matches `WHERE AsinCode = @asinCode`.
- **Fix:** Pass `record.asinCode` or use an ASIN signal-row-ID based API. Check affected row count and enforce identity/ownership server-side. Do not duplicate this behavior in OOS task view.

### P1-08 | "Total Open" count includes resolved signals

- **Observed:** Generic `AffectedASINsPanel` sums seller `counts.total`; backend increments this for all returned PEMS ASIN rows regardless of status.
- **Fix:** Use separate total, open, resolved and waived counts; do not represent all-time signal count as open count.

### P1-09 | OOS upload is not an original-file evidence system

- **Observed:** Browser parses upload into rows and sends JSON; original `.csv/.xlsx` bytes are not persisted via the OOS service. A supplied `fileHash` is accepted in the service signature. Duplicate ASIN rows are reduced to one record, potentially masking SKU-level distinctions.
- **Fix:** Secure binary storage, server-generated SHA-256, MIME/size checks, report date, seller/channel verification, row mapping, quarantine for invalid rows, rejection table, deterministic versioning, role-based retrieval. Preserve exact source files and row provenance.

### P1-10 | GMS Pareto not attached to affected cases

- **Observed:** `getSellerPareto()` derives a `tierMap`, but OOS decisions and the export do not store/render `GMS`, tier, cohort date range and impact for affected ASINs.
- **Fix:** Join a frozen, seller-scoped GMS snapshot to every affected ASIN and show `GMS`, `GMS Rank`, `Pareto Tier`, `Cumulative %`, `Priority`, and `GMS_UNVERIFIED` cases. Verify the GMS join cannot combine same ASIN across seller accounts.

### P1-11 | Incorrect export layout and placement

- **Observed:** Existing sheets are `Seller Summary`, `Source Manifest`, `Incidents & Follow-ups`, `Resolved Audit`. Export UI is outside Affected ASINs. A report's `decisions` in Seller Summary are nested JSON rather than a flat per-ASIN action list.
- **Fix:** Inside Affected ASINs provide `Preview export`, `Export XLSX`, latest version/hash, and auditable snapshot. Sheets: `01 Active OOS`, `02 Discrepancies`, `03 Resync Resolved`, `04 Summary & Sources`.

### P1-12 | OOS task completion cannot use generic checkbox gates

- **Observed:** Template `evidenceRequired` is defined but `PemsActivities` insertion does not persist it. `completeActivity` simply sets `IsCompleted`; no evidence lookup. The existing ASIN submission gate lists selected DLY codes, not OOS-RECON-001.
- **Fix:** Do not add a hardcoded `OOS-RECON-001` exception that blocks on every *open stock incident*. Instead add a domain-specific **monitoring completeness** gate: assigned seller coverage, applicable uploaded sources or approved exceptions, all cases dispositioned, resync evidence where necessary, immutable export, open incidents owned/follow-up, independent reviewer. Open incidents may survive daily completion.

### P1-13 | Manual OOS incident resolution can bypass marketplace proof

- **Observed:** `POST /api/oos/incidents/:id/resolve` accepts a manual resolution note and calls incident resolution with no fresh marketplace verification, and the UI has a `Mark resolved` button.
- **Fix:** Separate `RECOVERED_VERIFIED` (requires authoritative newer evidence) from `WAIVED`/administratively closed (authorized role, reason, approval). Preserve incidents and event history.

### P1-14 | Seller-day run identity and multi-channel scope

- **Observed:** `OosRuns` unique index `(RunDate, SellerId)` does not include channel while the entity stores a `Channel` column. A run on a second channel that day can collide with the first.
- **Fix:** Verify whether one seller can have multiple monitored channels. If yes, move uniqueness and idempotency to `(RunDate, SellerId, Channel)` with tested migration and keep old data compatible.

## 5. Target task-view UX: Affected ASINs (only OOS-RECON-001)

**Presentation principle:** The Task View drawer remains the home for a task. The OOS tab must be actionable without navigating away. A `Expand workspace` action may open a full-page layout **with the same instance context** for datasets too large for a drawer.

### 5.1 Proposed information hierarchy

**Task drawer header (existing):** Task code, assigned user, due time, task status, selected brand coverage, progress, reviewer. Show `OOS-RECON-001` badge and a concise workflow readiness state.

**Affected ASINs tab (new OOS-only body):**

1. **Run context and source readiness:** Selected brand (from assigned sellers), monitoring date, channel, RetailOps observation timestamp, GMS window, source freshness badges, `Run / Resume` state. Multi-brand tasks get a separate completion status for each assigned brand.
2. **Upload all required reports:** RetailOps snapshot (read-only system generated), BrandCentral inventory report (upload), Vendor Central report (upload or formally supported N/A). Each card shows filename, imported time, report timestamp, accepted/rejected rows, original-file hash, validation status, and replace/version policy. Show field-mapping preview and `View rejected rows`.
3. **Reconciliation and prioritization:** `Run reconciliation` only when required sources are validated or a permitted exception is recorded. KPI strip shows confirmed channel OOS, discrepancies, insufficient evidence, verified recovered, and Tier 1 GMS impact. A single affected-ASIN table is the operational source of truth.
4. **Affected-ASIN action table:** Seller/brand, fulfillment channel, ASIN, SKU, RetailOps availability/time, BrandCentral stock/time, Vendor stock/time or N/A, GMS/rank/tier, classification, severity/priority, resync job/state, owner, seller communication, replenishment ETA, follow-up, action. Expand a row for source evidence and audit history. Filters for `Active OOS`, `Discrepancies`, `Needs verification`, `Recovered`, `Tier 1`, `My follow-ups`.
5. **Controlled resolution:** Eligible mismatches display `Request targeted resync`; only authorized executor can start it. Show queued/running/failed/verified statuses and before/after marketplace evidence. Ordinary employees can escalate or request resync without receiving raw `scraping_manage` permission.
6. **Export and handover:** `Preview workbook`, **`Export affected ASINs`**, `Download latest`, version/hash, generated time, responsible actor; four flat agreed sheets. Every open incident must have an owner, communication state, next action and follow-up date. Export is attached automatically to PEMS evidence (with hash/run identity), not copied as an unverifiable hyperlink.
7. **Completion and review gate:** Show `Ready for review` checklist. Employee submits, reviewer independently approves/rejects, and the PEMS task closes. Outstanding OOS incidents stay open and carry over to subsequent days.

### 5.2 Recommended display states

- `NOT_STARTED`: No OOS run linked, show current assigned seller scope.
- `AWAITING_UPLOADS`: RetailOps snapshot ready; missing BrandCentral or applicable Vendor report.
- `INPUT_ERROR`: File rejected or unresolved field/SKU mapping; expose corrective action.
- `READY_TO_RECONCILE`: Sources accepted/fresh, or exception formally logged.
- `ANALYSING`: Server reconciliation job running, show progress.
- `ACTIONS_REQUIRED`: OOS/mismatch cases found, priority and owners required.
- `RESYNC_PENDING`: One or more eligible jobs queued/running; no assumed recovery.
- `READY_TO_EXPORT`: All cases dispositioned; workbook may be generated.
- `READY_FOR_REVIEW`: Seller coverage, evidence, export and incident handover pass server validation.
- `SUBMITTED` / `REWORK` / `APPROVED`: Controlled by PEMS reviewer, not by a freely editable OOS status field.

### 5.3 Role and action rights

| Actor | See assigned data | Upload BC/VC | Reconcile | Request resync | Execute marketplace sync | Export | Submit task | Approve |
|---|---|---|---|---|---|---|---|---|
| Assigned Brand Manager | Yes | Yes | Yes | Yes (request) | No | Yes | Yes | No |
| Authorized operations sync role | Scoped | As assigned | As assigned | Yes | Yes | As assigned | As assigned | No, unless also reviewer and independent |
| Independent reviewer | Yes | Read-only by default | Read-only | No by default | No | Download | No | Yes |
| Task/template administrator | Policy-scoped | For support only | For support only | For support only | Separate authorization | For support | No impersonation | Only as separately authorized reviewer |

All permissions must be enforced by backend task-instance and seller scope, not by hiding a frontend button. These are **proposed rights**, not evidence that current API routes already provide them.

## 6. Suggested architecture and API contracts (proposal, NOT existing routes)

**Domain separation:** PEMS owns *task lifecycle and reviewer decisions*. OOS owns *observations, decisions, resync, incidents and XLSX*. A central OOS task binding service resolves the two and enforces scope. This avoids dual competing approval systems.

### 6.1 Persistence

- Introduce `OosRunTaskLinks` (or equivalent), linking `RunId`, `TaskInstanceId`, `SellerId`, `Channel`, and association metadata. Enforce unique combinations and seller scope. A PEMS instance may link to many seller/channel runs; a seller/day run may be associated with multiple authorized task instances.
- Add versioned storage metadata for original uploaded binary: `StorageKey`, `Sha256`, `FileSize`, `MimeType`, `ReportAsOf`, `SourceIdentity`, `UploadedBy`, `Version`, `ValidationState`, `RejectedRowsFileId` or row-level import errors. Do not trust client-supplied hashes.
- Add immutable `RunSnapshot` capturing applicable ASIN universe, source raw availability, timestamp, GMS period, policy version, and case generation revision.
- Persist GMS priority per affected-case revision with source snapshot identity; never recalculate historical priority silently when GMS data changes.
- Store `ExportId`, `Version`, `Sha256`, `RunId`, `TaskInstanceId`, generation timestamp and download permission, and mirror the record into PEMS evidence automatically.
- Preserve one authoritative OOS incident per `(seller, channel, ASIN, episode)` and link incident events to the daily run and PEMS task. Do not duplicate case status into `PemsTaskAsins` as a separately editable authority.

### 6.2 Suggested instance-scoped routes

| Proposed endpoint | Role/guard | Purpose |
|---|---|---|
| `GET /api/pems/instances/:id/oos-context` | Task view + seller scope | Resolve template type, linked seller runs, user actions, source state and summary |
| `POST /api/pems/instances/:id/oos-runs` | Assigned executor | Create/load today’s seller-scoped OOS run, idempotent |
| `POST /api/pems/instances/:id/oos-runs/:runId/uploads` | Assigned executor + allowed seller | Secure original-file intake and parsed data/validation |
| `GET /api/pems/instances/:id/oos-runs/:runId/affected` | Task view + seller scope | Paginated, normalized decision/incident/GMS/resync table |
| `POST /api/pems/instances/:id/oos-runs/:runId/reconcile` | Assigned executor | Start audited reconciliation on frozen snapshot |
| `POST /api/pems/instances/:id/oos-runs/:runId/resync-requests` | Assigned executor | Request scoped sync, queue for privileged worker |
| `GET /api/pems/instances/:id/oos-runs/:runId/exports` | Task view | List versions and hashes, export readiness |
| `POST /api/pems/instances/:id/oos-runs/:runId/exports` | Assigned executor | Generate the approved four-sheet XLSX with task attribution |
| `GET /api/pems/instances/:id/oos-runs/:runId/exports/:exportId/download` | Task view | Permission-checked, content-fixed export download |
| `GET /api/pems/instances/:id/oos-submit-readiness` | Executor/reviewer | Server-calculated readiness, missing evidence, per-brand blockers |
| `POST /api/pems/instances/:id/transition` | Existing route, enhanced gate | Submit task to PEMS review only if all linked runs pass completeness |
| `POST /api/pems/reviews` | Existing reviewer route | Reviewer decides; OOS run closes only after approved PEMS transition |

Prefer reusing OOS services through an **instance-scoped façade** rather than duplicating endpoints and data. New routes and tables are proposals, not yet present in the repository.

### 6.3 Export contract: 4 sheets

1. `01 Active OOS`: seller ID/name, channel, ASIN, SKU, source statuses and quantities/timestamps, GMS window/value/rank, Pareto tier, priority, OOS category, incident ID, owner, communication state, ETA, next action, next follow-up, evidence reference.
2. `02 Discrepancies`: source mismatch type, RetailOps/BC/VC evidence, freshness, resync eligibility, job ID/status, authoritative last observation, escalation owner and next step.
3. `03 Resync Resolved`: seller/channel/ASIN, pre-status and time, sync job ID/trigger, post-status/time, verified server evidence, resolution date/actor, audit link.
4. `04 Summary & Sources`: seller and channel coverage, counts by classification and Pareto tier, policy version, source file manifest with hash/version, snapshot timestamp, GMS period, generated by/on, reviewer and report version.

**Workbook must be a per-row actionable operational export, not nested JSON in cells.** Counts reconcile to decision and incident records. Export content is immutable per version, with versioned regeneration after data changes.

## 7. Implementation sequence and dependencies

| Phase | Priority | Engineering work | Release gate / acceptance |
|---|---|---|---|
| 0: Baseline | P0 | Inspect deployed migration 032, draft template and actual user RBAC; capture current task state | Live DB matches source assumptions; template still inactive |
| 1: Identity & scope | P0 | Link PEMS instance to seller/channel OOS runs; build OOS tab under TaskWorkspace | No cross-task or cross-seller data access; multi-brand and repeated-day behavior correct |
| 2: UX and file intake | P0 | OOS-specific Affected tab, upload cards, mapping preview, original files and validation | Uploads belong to exact task/run; rejected rows not silent |
| 3: Classification & Pareto | P0 | Freeze source/GMS snapshot, implement freshness gates, join GMS to every affected ASIN | Correct affected results and seller full-catalog Pareto; unknown remains unknown |
| 4: Resync safety | P0 | Queue dispatcher + server-fetched verification + incident-resolution fix | Failed/mismatched observations never close incidents |
| 5: Export & evidence | P1 | Four agreed sheets, task-scoped export, immutable hash, automatic PEMS evidence link | Download in Affected tab, rows reconcilable, version tracked |
| 6: Submit & review | P0 | Domain completeness validator and real independent PEMS approval | Neither unchecked brands nor missing reports bypass gate; open OOS incidents survive approval |
| 7: Quality & rollout | P1 | Unit/API/UI/e2e/security tests, shadow runs, audit, staged role-based activation | Critical tests pass, rollback ready, old DLY-004 unaffected |

For safe incremental delivery: complete baseline, identity and safety fixes before activating file intake for real users. UI work can be developed in parallel, but do not publish the new template or route around missing server checks.

## 8. Acceptance tests (minimum)

| ID | Scenario | Expected result |
|---|---|---|
| TV-01 | Open `OOS-RECON-001` assigned instance | Affected tab renders OOS-specific panel with the same task ID |
| TV-02 | Open any non-OOS template task | Existing generic Affected ASINs remains unchanged |
| TV-03 | Assigned employee has three brands | Three seller statuses; per-brand run identity; no unrelated seller data |
| TV-04 | Another employee assigned same seller/day | Idempotent shared OOS run; no duplicated incident; permissions enforced |
| TV-05 | BrandCentral report uploaded | Original file saved, server SHA-256, mapping/row count, source timestamp shown |
| TV-06 | Vendor Central not applicable | Explicit N/A with policy/reason, not silently missing or zero |
| TV-07 | Upload wrong seller or unknown SKU | Reject or quarantine; no cross-seller merge |
| TV-08 | Upload missing quantity | `UNKNOWN`, never zero, no confirmed stockout from blank alone |
| TV-09 | RetailOps data stale | `INSUFFICIENT_EVIDENCE`, resync eligibility blocked |
| TV-10 | RetailOps unavailable; BC and applicable Vendor positive | `DISCREPANCY`, targeted resync request permitted |
| TV-11 | Resync queue accepted | Case remains open while queued/running |
| TV-12 | Sync fails or marketplace still unavailable | Incident remains open, status and reason recorded |
| TV-13 | Client submits false `IN_STOCK` status | Cannot resolve without authoritative newer server observation |
| TV-14 | Newer authoritative in-stock observation | Verified recovered, before/after evidence recorded, eligible incident closed |
| TV-15 | Seller full-catalog GMS 80/20 | Correct Tier 1 on affected row; no tier if GMS unverified |
| TV-16 | Download export from Affected tab | Four agreed sheets, flat rows, matching count, immutable version/hash |
| TV-17 | Missing uploaded report or mandatory disposition | Task submission blocked with exact missing item |
| TV-18 | Open OOS incident with owner and next follow-up | Daily task may be approved, incident remains open |
| TV-19 | Executor supplies somebody else's reviewer ID | No automatic approval or run closure |
| TV-20 | Actual independent reviewer approves via PEMS | Correct task transition and linked run closure; audit actor recorded |
| TV-21 | Re-import legacy DLY master | New `OOS-RECON-001` unchanged; `DLY-004` not touched by this work |
| TV-22 | Generic signal remarks on another task | Uses real ASIN code/row ID and verifies successful update |

## 9. Responsibility matrix

| Capability | Operations Owner | Assigned Brand Manager | Sync Operator | Reviewer | Engineering |
|---|---|---|---|---|---|
| Approve report/source policies | A | C | C | C | R (implementation) |
| Upload and validate reports | I | R | I | I | A (platform) |
| Confirm ambiguous cases | A | R | C | C | I |
| Request resync | A | R | C | I | I |
| Execute rate-gated sync | I | I | R | I | A (platform) |
| Follow-up and replenishment ETA | A | R | I | I | I |
| Verify export/complete handover | A | R | I | C | I |
| Independently approve daily task | I | I | I | A/R | I |
| Keep open incidents after approval | A | R | I | I | A (platform) |

R = responsible for doing work, A = accountable, C = consulted, I = informed. This is a proposed responsibility policy subject to organizational approval.

## 10. Engineering file map

**Modify / extract:** `src/modules/tasks/components/TaskWorkspace.jsx`, `src/modules/tasks/services/tasksApi.js`, `src/modules/tasks/components/ReviewWorkspace.jsx`, `backend/routes/pems/pemsRoutes.js`, `backend/services/pems/pemsService.js`, `backend/services/oos/oosSubmissionService.js`.

**Reuse:** `src/modules/oos/services/oosApi.js`, `src/modules/oos/pages/OosWorkspacePage.jsx` (extract reusable subcomponents), `backend/services/oos/oosMonitoringService.js`, `oosUploadService.js`, `oosReconciliationService.js`, `oosParetoService.js`, `oosIncidentService.js`, `oosExportService.js`, `oosSyncService.js`, existing marketplace sync/rate gate.

**Proposed new components:** `OosAffectedAsinsTab`, `OosRunContext`, `OosSourceUploadCards`, `OosUploadValidationDrawer`, `OosAffectedTable`, `OosResyncStatus`, `OosExportPanel`, `OosSubmissionReadiness`.

**Proposed persistence:** `OosRunTaskLinks`, immutable source file storage/snapshot records, approved reviewer transition linkage, per-case Pareto/recovery provenance. Use additive migrations and tests.

## 11. Open policy decisions before enabling live use

1. Exact fulfillment channel mapping for each seller, and when Vendor Central is truly applicable.
2. Authoritative stock source freshness thresholds for RetailOps, BrandCentral and Vendor Central.
3. Whether a run is shared by multiple employees assigned to one seller and which employee owns submissions/communications.
4. Official GMS revenue measure, trailing window, seller scope, currency, and zero/no-data handling.
5. Who can request marketplace sync versus who may execute it, and approved quotas/cooldowns.
6. Recovery evidence and permitted administrative waiver policy.
7. Required source-file retention, allowed formats, maximum sizes and sensitive-data classification.
8. Final report columns and whether summary requires cross-seller consolidated export.

## 12. Conclusion

**Existing Task View:** a sound generic PEMS task drawer, but its Affected ASINs tab is not the right model for a three-source OOS workflow.  
**Existing OOS workspace:** a useful service and UI foundation, but disconnected from the assigned task and not safe to activate.  
**Recommended next development unit:** `OosAffectedAsinsTab` integrated through instance-scoped APIs, with upload + validation + in-tab export, followed immediately by verified resync and true independent review.  
**Status:** Architecture plan only. No source code has been changed, no migration has been run, no deployed environment or CI has been verified.
