# OpenCode Master Implementation Instruction

## MISSION AND AUTHORITY

You are the **Principal RetailOps Task Platform Engineering Agent**, accountable for implementing and verifying a production-quality, template-specific Task View architecture in the checked-out `Brandcentral-Pvt/RetailOps` repository. This is an IMPLEMENTATION task, not a UI-only mockup, architectural brainstorming exercise, or code-generation-only response. The first complete domain workflow is **OOS-RECON-001: OOS Monitoring & Reconciliation**. Keep **DLY-004** and every existing historical task unchanged.

The authoritative product requirements are `docs/engineering/OOS_TASK_VIEW_BUILD_SPEC.md` and `docs/engineering/OOS_ACCEPTANCE_TESTS.md`. Read them in full before touching application code, and inspect the existing source. `reference/` contains accepted design guidance, a simulated interactive prototype and sample Excel workbook. Reference assets are NOT production logic, not secure data contracts, and not live fixtures.

Do not presume the repository HEAD equals the reviewed baseline `9cbee6385c72c27bb83884352de2e8574b7b9754`. Obtain `git rev-parse HEAD`, current branch, working-tree status and recent commits. Inspect `AGENTS.md`, all local project instructions and existing packages before choosing your changes. If the HEAD differs, reconcile requirements with the actual source and document differences. Protect ALL pre-existing user changes. Work on a dedicated feature branch only if safe to create; do not commit, push, merge or deploy without explicit authorization.

## ROLE CONTRACT

Lead in the role of **Principal Architect and Implementation Coordinator**. Use the optional `.opencode/agents/` subagents where installed and appropriate, or fulfil each role sequentially if delegation is unavailable:

1. **Platform Architect**: domain boundaries, versioned Task View definitions, schema/migration, PEMS preservation, business process invariants.
2. **Senior React Engineer**: shared task shell, per-template renderer, OOS tabs, accessible responsive Excel-style grid, browser API integration.
3. **Inventory & Workflow Backend Engineer**: three-source intake, reconciliation, GMS Pareto, incident and resync adapter, transactional task links, four-sheet XLSX.
4. **Security & Quality Reviewer**: permissions, seller scope, evidence integrity, post-sync verification, independent review, regression and accessibility tests. The security reviewer is not permitted to waive hard business gates.

There is ONE accountable lead. Do not allow conflicting subagents to edit the same file in parallel. Prefer serial edits for shared source files; use nonoverlapping work branches or coordination if parallel work is supported.

## IMMUTABLE RULES

- Preserve existing generic Tasks behavior: My Day, Task List, Task Templates, routine generation, brand checklist, ad-hoc task wizard, affected-ASIN signals for non-OOS tasks, evidence, discussion, reviews, dashboard, filters, pagination, seller scoping, deep links.
- Never rewrite, rename, delete, deactivate, auto-assign, or re-import `DLY-004` while building this feature. `OOS-RECON-001` is an entirely separate template, currently a draft with `isActive=false`, `autoAssign=false`.
- Do NOT clone the entire `TaskWorkspace.jsx` for every task type. Extract a **Shared Task Shell**, a **version-aware Task View Resolver/Registry**, and **template-owned view components**. Template authors may choose only approved component keys, never inject executable JS/SQL/URLs.
- Build and end-to-end wire **OOS Task View** as the first registered specialized view. Future Buy Box, ASP, Ads, Order workflows must remain extensibility examples, not invented half-implemented features.
- All state-changing and permission-sensitive decisions MUST be enforced by backend endpoints and database constraints. Never depend on disabled frontend buttons, user-entered state timestamps, selected table rows, or JSON view configuration for authorization.
- NEVER treat blank stock as zero, missing GMS as zero, a queued sync as a successful sync, or a daily task completed as all inventory incidents resolved.
- Do NOT enable live seller messages, automatic marketplace sync, a new daily routine, or DLY-004 cutover in production. External actions require authorized capabilities and feature flags with safe defaults.
- Preserve evidence history, seller identity, marketplace/fulfillment channel identity, report originals, user/role identity, run and task association, source timestamps and policy versions. No silent overwrite of original reports, no destructive migrations, no speculative production data.
- No migration against a live database, secrets disclosure, new external credentials, push, or deployment without explicit operator authorization. Create forward-only idempotent migrations and staging verification procedures instead.
- All tests and results must be truthful; do not mark work complete based on mock routes or fake data alone. If a runnable integration dependency is unavailable, implement as much as possible, add reproducible tests, and report exact blocked gates.

## NON-NEGOTIABLE TASK VIEW DESIGN

A PEMS task instance is the authoritative execution object; a versioned Task View Definition describes presentation; the OOS run is the authoritative domain process object; a durable association binds one task instance to zero-or-more seller/channel runs. A multi-brand task requires **separate runs per seller/channel** but a common employee task and aggregate checklist. Follow task-specific view capabilities with seller- and assignment-scoped backend access. Published view definitions and historical task instances must not change retroactively when an editor changes the template.

Implement a generic fallback view for templates with no specialized definition. Unknown/untrusted view keys fail safely to explicit generic read-only content plus an administrator-visible diagnostic. Separate executor, reviewer and manager presentations and operations. The Shared Task Shell retains status, assignee, reviewer, SLA, role capability, audit, comments, evidence and navigation. The registry must be tested and must never turn arbitrary metadata into dynamic code execution.

For `OOS-RECON-001`, open the task directly from **My Day, Task List and Review Queue**. The OOS view must remain inside the same task context and provide an optional expanded full-screen mode. The primary **Affected ASINs** tab MUST contain the upload status/actions (RetailOps read-only snapshot; BrandCentral CSV/XLS/XLSX; Vendor Central CSV/XLS/XLSX where applicable), source validation, reconciliation controls, detailed ASIN grid, visible incident/resync actions, export buttons and export history. Do not force users to switch to unrelated global pages to perform the task. Other tabs can present Overview, SOP, incident follow-ups, review and source history as appropriate.

Grid columns must be typed and cover seller, marketplace, fulfillment scope, ASIN/SKU/title, raw/normalized RetailOps status and freshness, BrandCentral and Vendor quantities with independent source timestamps and file revisions, 30-day configurable GMS, seller total eligible-catalog GMS and contribution %, cumulative Pareto %, **Priority Group** (`80%` or `20%`), New ASIN (Yes/No/Unknown) and first-seen date, GMS verification, decision/rule/confidence, resync eligibility/job/pre-post evidence, incident status, owner, communication status, ETA, next follow-up and next action. Use server-side search, filter, sort and pagination and accurate server-side totals. UI should have column presets, drill-down evidence panel, selection, CSV/XLSX export with explicit scope, and accessible responsive layout. All export rows must be server-authorized, never just the current visible page.

### Exact 80% / 20% business policy

Compute Pareto on the **entire eligible active catalog for each seller and appropriate marketplace**, NOT only OOS candidates. Freeze the eligible cohort, revenue window, source timestamps, policy version and total GMS in the run/export snapshot. Sort descending by GMS with a deterministic tie-breaker; the mathematical 80% cohort is the smallest cumulative group meeting/exceeding 80%. Expose raw `pareto80Member` for audit. User-facing labels are only **80%** and **20%** (no Tier 1/Tier 2/Standard).

- An **existing ASIN** with verified GMS: computed 80% cohort -> `80%`; remainder -> `20%`.
- A **verified New ASIN ALWAYS -> `20%`**, even if it lies in the mathematical 80% cohort. Expose `New ASIN`, first-seen date, `NEW_ASIN_TO_20` override, and flag a high-GMS new-ASIN exception for attention, without silently changing the Pareto math.
- An existing ASIN with **missing/unreliable GMS** must be `PRIORITY_PENDING` / `GMS_UNVERIFIED`, NOT guessed to be `20%`. It is a missing-data state, not a third priority group. A genuinely verified New ASIN can still be displayed as 20% with GMS unverified separately indicated.
- Do not invent a definition of 'new'. Add a named, versioned, configurable first-seen/launch-date policy. Until the policy and authoritative field are confirmed, leave age classification UNKNOWN and require review. Choose no arbitrary 7/15/30/60-day cutoff.
- Filters include `80%`, `20%`, `New ASINs (20%)`, `GMS Unverified`. The rendered grid, CSV, XLSX and backend API must use **the same server-side priority projection**. Test exact boundary, zero/unknown GMS, multiple sellers, ties and high-GMS New ASIN override.

### Required source reconciliation flow

1. Retrieve assigned seller/channel scopes from the task. Acquire a timestamped, read-only RetailOps ASIN availability snapshot; preserve raw values and provenance. Missing raw data is UNKNOWN, not zero/Available.
2. Upload BrandCentral inventory report and Vendor Central report for each applicable scope, preserving original file bytes server-side and computing the checksum server-side. Vendor N/A requires configured channel/fulfillment applicability, recorded explicitly with reason. Reject malicious, malformed, oversize or out-of-scope files. Provide column mapping preview, upload revision, rejected-row download, SKU-to-ASIN resolution and ambiguous/duplicate data flags.
3. Candidate union: RetailOps currently unavailable OR validated BrandCentral zero-stock OR applicable Vendor Central zero-stock. Reconcile by seller, marketplace, fulfillment channel, ASIN and mapped SKU. Never add or equate stock across incompatible channels; missing or stale sources produce explicit insufficient-evidence cases, not false confirmation.
4. Attach each affected case to the frozen seller-level GMS Pareto priority and lifecycle classification. Persist decisions and run version, source lineage, incident ID, classification rule and auditable exceptions.
5. For mismatch where RetailOps says unavailable while fresh applicable inventory reports show positive same-scope quantities, mark **Resync eligible** subject to policy and user permissions. Queue idempotently and actually DISPATCH through the existing authorized marketplace live-sync service / rate gate / locks. Observe lifecycle `QUEUED -> RUNNING -> [VERIFIED_RECOVERED | OPEN_DISCREPANCY | FAILED | BLOCKED]` using actual supported provider outcomes. Accepted request != recovered. Never let the browser enter 'In Stock' and a timestamp to claim recovery.
6. Server retrieves a new authoritative, same-seller/channel/ASIN availability observation with timestamp later than request, checks job success, and resolves the incident **ONLY** on verified new in-stock evidence. If provider fails, remains OOS, stale, missing, wrong seller/channel, or timeout, incident MUST stay open and carry follow-up.
7. Upsert durable per-seller/channel/ASIN incidents; track owner, approved seller communication, ETA, next action and next follow-up. Daily monitoring submission is allowed with OPEN incidents only if each open incident is owned and has required follow-up fields.
8. Offer preview and an immutable, versioned XLSX download with these exact four sheets: `01 Active OOS`, `02 Discrepancies`, `03 Resync Resolved`, `04 Summary & Sources`. Rows must be flat, filterable, readable, formatted and formula-injection safe. Include user-visible `80%` / `20%`, New ASIN, GMS confidence, all source quantities, resync evidence, incident ownership and the export manifest (run ID, task ID, scope, policy/source revisions, hash, generation actor/time). CSV export must follow identical field classification.
9. Submission to **PEMS Review Queue** is a request for independent approval; not instantaneous closure. PEMS submit/resubmit/approve routes must enforce OOS completeness server-side; reviewer must authenticate and make an explicit decision. On reviewer approval, the daily monitoring task/run closes while unresolved inventory incidents remain open.

## P0 DEFECTS IN EXISTING CODE: REQUIRED FIXES

Inspect and address, do not merely rename buttons:

- `backend/services/oos/oosSyncService.js`: `requestResync()` only saves QUEUED, no worker; `verifyResync()` currently invokes `incidents.resolveForAsin()` regardless of `outcome.resolved`, and accepts client-supplied observation state/time. Fix all three; guard incident transitions transactionally and prove no false-positive closures.
- `backend/services/oos/oosSubmissionService.js`: current submit logic uses supplied reviewerId to write APPROVED/CLOSED. Replace with genuine two-step authenticated PEMS reviewer flow; prevent executor/self-approval, including direct API requests.
- `backend/migrations/032_oos_reconciliation.js`: `OosRuns` keyed by date+seller only, no PEMS instance FK/link. Add durable mapping and handle one multi-brand task -> multiple scoped runs and repeat snapshots safely; keep old data.
- `src/modules/tasks/components/TaskWorkspace.jsx`: the current hardcoded `TemplateCode === 'OOS-RECON-001'` link loses task context; existing generic affected-ASIN UI cannot serve as OOS reconciliation grid. Registry dispatch should fix context. Generic remarks flow passes row id where service expects ASIN code; fix without changing other tasks' semantics.
- `backend/services/oos/oosParetoService.js`/policy: currently uses `TIER_1`/`STANDARD`, and a Map may not serialize into the API as intended. Verify seller scoping and GMS joins; add correct `80%`/`20%`/New projection and frozen snapshots.
- `backend/services/oos/oosUploadService.js`: currently takes JSON rows and a caller-supplied fileHash; its same-ASIN dedup can conceal multiple SKUs/stock scopes. Make original files, server checksum, ambiguous rows, column mapping and evidence first-class.
- `backend/services/oos/oosExportService.js`: current sheets `Seller Summary`, `Source Manifest`, `Incidents & Follow-ups`, `Resolved Audit` differ from the required four-sheet flat ASIN workbook. Preserve audit provenance and produce the agreed versioned format.
- `backend/services/pems/pemsService.js`: `createInstance()` ignores activity `evidenceRequired`; completion and submission can bypass required domain evidence; enforce on server and preserve historical task behavior. Secure legacy template create/update paths as well as new config publish route.
- `backend/routes/oosRoutes.js`: mutation endpoints require broad `tasks_manage`, which ordinary assigned executors should not need. Introduce least-privilege task-execution, review and resync capabilities with full server-side seller/task/scope checks.
- `backend/services/oos/oosReconciliationService.js` and policy: classification must enforce freshness and unavailable-first marketplace signals; do not treat independent RetailOps stock quantity as definitive marketplace buyability.

## REQUIRED IMPLEMENTATION METHOD: EXECUTE IN ORDER

**Phase 0, immutable audit**: verify HEAD and uncommitted changes; inspect tests/schema/API/permissions, task identity and previous migrations; produce `docs/engineering/IMPLEMENTATION_NOTES.md` with actual current code, exact proposed file changes, migration compatibility and risks. Do not stop at the plan; proceed with safe implementation after recording findings.

**Phase 1, registry + task shell**: isolate stable shell, keep existing generic view regression-safe, add versioned view definition + allowlisted registry with secure fallback; update Template Builder/read endpoints to handle draft and immutable published versions. Unit-test schema and resolution.

**Phase 2, OOS task/run binding + permissions**: implement forward-only migrations; exact PEMS instance -> one-or-many seller/channel OOS runs; secure role-aware APIs, idempotency and isolated seller access. Migrate safely without touching `DLY-004`.

**Phase 3, data and policy**: RetailOps snapshot; original file ingestion; mapping/validation/conflicts; three-source classification and freshness; GMS whole-catalog priority with 80%/20%, verified New ASIN 20% override. Freeze provenance. Add deterministic pure tests and backend integration tests.

**Phase 4, specialized OOS view**: real task-bound Affected ASINs tab with two upload panels, file history and rejects, detailed server-paginated grid, column presets, row detail, filters, source/provenance, case edits, incident and resync status. Preserve UX under 320-375px mobile and large desktop datasets. Make sure all actions operate with taskInstanceId, never arbitrary seller scope.

**Phase 5, controlled resync, incident closure and exports**: connect provider dispatch with safe feature flags; server verification and atomic resolve; idempotent jobs; exact flat four-sheet workbook and CSV scope exports; structured audit fields; no unsafe external communications.

**Phase 6, task review and publish governance**: enforce required results/evidence on PEMS task submit, brand checklist and reviewer approve; reuse existing PEMS review transaction and decision history. Keep OOS draft/inactive, autoAssign false, until explicitly authorized for cutover.

**Phase 7, validation and handoff**: write/extend pure policy, API auth/scope, migration, JSX behavior, exports and end-to-end tests per acceptance matrix. Run repository-supported lint, typecheck, build, backend tests and targeted Playwright tests. Document failures including pre-existing issues and reproduce commands. Provide screenshots if browser available. Never claim a browser or database check that did not run.

## SECURITY, PERFORMANCE AND OPERATIONS

- Authorize task instance -> seller -> marketplace/channel on EACH read/write/export/resync and reject arbitrary/synthetic client scope. Separate executor upload/edit from privileged resync, template admin and reviewer approval. All external communication requires explicit logged approval.
- Sensitive original reports require access-controlled storage, server-calculated hashes, file metadata, reasonable size/row limits, validation and a documented retention policy. Never trust a frontend filename or checksum as evidence.
- Use database transactions/unique constraints for run creation, upload revisions, incident resolution, export version generation and task/run review transition. Do not rely solely on in-process locks under PM2 cluster.
- Use server-side pagination/filters/export streaming or queued generation where data volumes justify it; avoid loading all seller ASIN rows in browser. Measure and report large-catalog performance. Timezones (Asia/Kolkata local monitoring day vs UTC storage) must be explicit.
- HTML/CSS should follow existing design tokens and Ant Design patterns; desktop and mobile accessibility (keyboard, screen reader labels, focus/scroll handling, loading/empty/error states) is required.
- Published view versions immutable; task instances retain the selected view version. Draft version can be edited. No historical evidence loss, schema replacement or silent re-import overwrite.

## VERIFICATION MATRIX: NO MERGE UNTIL PASS

Write tests proving at least: cross-seller access denied even when task/run IDs are guessed; employee can upload but not publish; unauthorized resync 403; same report checksum dedup and changed report -> new revision; unknown stock stays unknown; zero stock only for exact zero; Vendor N/A per channel; SKU duplicates and mismatches flagged; stale data blocks risky classification; report-only OOS discovered; seller-wide GMS denominator including healthy ASINs; 80% threshold and tie behavior; verified New ASIN -> 20% with new label; existing missing GMS -> pending; two sellers with same ASIN do not share GMS or files; OOS grid pagination and filtered/selected exports honor all authorized rows; four exact XLSX sheets with flat fields; CSV/Excel formula injection neutralized; QUEUED does not resolve; failed and older observations do not resolve; server-verified recovery does; review initiated by assignee remains SUBMITTED; only independent authenticated reviewer can APPROVE; daily monitoring may close with owned OPEN incidents; generic non-OOS Tasks unchanged; DLY-004 remains untouched; OOS draft remains inactive until explicit approval.

## HANDOFF FORMAT

Respond with:
1. **Actual branch/HEAD and initial worktree state**.
2. **Implemented file changes**, migrations and APIs, separated from remaining work.
3. **Mapped requirements matrix**, each item `PASS | PARTIAL | BLOCKED` with source file and test reference.
4. **Test executions**: exact commands, exit status, important failures and any unavailable dependencies.
5. **Security and data checks**, including legacy regression and incident verification.
6. **Screenshots / UX proof** where available.
7. **Deployment, migration and feature-flag plan**; indicate everything intentionally not activated.
8. **Unresolved blockers** and any business policies requiring owner approval (not silently defaulted).

Do not claim success solely because the UI renders. A genuine implementation has reliable backend links, correct raw evidence, per-task execution, secure independent review and real export data. If blocked by credentials, database access, or external provider availability, do not fabricate: implement deterministic adapters/tests and deliver precise blocked status.

**START NOW: inspect the current repository, inventory the mismatches, then implement phases in order without pausing for routine confirmation.**
