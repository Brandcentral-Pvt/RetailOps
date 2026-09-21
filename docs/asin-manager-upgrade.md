# ASIN Manager — Upgrade Program (step by step)

**Companion to:** [`docs/asin-manager-deep-dive.md`](./asin-manager-deep-dive.md) — the audit this plan is built from. Every finding id below (`F1`…`F15`) refers to that document.

**Status:** plan agreed in principle; nothing in this document has been implemented yet. Each step ships on its own, on branch `arena/01a0c253-retailops`, with tests, and ends in a review point.

---

## 1. What we are building

> **North star:** one workspace that knows the commercial, content and competitive state of every ASIN, trusts its own data, tells the team what changed and what to do, and can act on it at scale.

That decomposes into four pillars, in this order:

| Pillar | Question it answers | Why it comes at this position |
|---|---|---|
| **1. Trust** | *Can I believe this screen?* | Today the module leaks across sellers (F1–F3), the bulk-add flow is broken (F4), the "Managing N ASINs" count is wrong (F6) and the quality score contradicts itself (F7/F8). Any intelligence built on top of this inherits the errors. |
| **2. Signal** | *Is the data fresh, complete and comparable?* | Trends are computed from a 14-day window, week history exists only if a human wrote it, Sub-BSR has no writer at all (F10), and the repair job is a no-op. Analytics on hollow history is decoration. |
| **3. Decision** | *What is worth my attention and what should I do?* | Health score, change/anomaly feed, freshness SLAs, competitor and margin lenses, AI listing fixes — the "data driven" surface the team actually asked for. |
| **4. Scale** | *Does it hold at 100k ASINs and 10 operators?* | Virtualised table, server-side column projection, saved views, async import/export with dry-run and undo. |

Each step below moves one pillar forward and leaves the module **shippable** at the end of it.

---

## 2. Every sub-module inside ASIN Manager, and what "upgrade" means for it

The user requirement is explicit: *all modules inside ASIN Manager get upgraded, not just the page.* This is the full inventory, grouped, with the target state and the step that delivers it.

### A. Workspace shell

| # | Sub-module (files) | Today | Upgrade | Step |
|---|---|---|---|---|
| A1 | **KPI dashboard** — stats block in `AsinManagerPage.jsx`, `GET /asins/stats` (`getAsinStats` :1161) | 8 static counters from 5 queries, 60 s cache; no comparison, no trends, no freshness | Comparative KPI strip (vs previous period), data-coverage tiles (fresh / stale / never scraped / missing history), health distribution, every tile click-through to the filtered table | 4 (structural caching in 2) |
| A2 | **Filter bar** — 40+ filters, `GET /asins/filters` (`getAsinFilterOptions` :1660) | Plain selects built ad hoc; no counts; state lost on reload; filters duplicated between FE and BE | Faceted filters with live counts, grouped into Core / Price / Content / Competition / Data-health tabs, URL-synced, saved as segments | 3 |
| A3 | **Main table** — `AsinManagerPage.jsx` (raw `<table>`, 39 visible columns) | ~100-field payload per row, 10 queries per load, no virtualisation, trend sub-cells per day/month, inline styles | Virtualised rows, server-side column projection (`?fields=`), correct pagination, density control, pinned columns, skeleton loading | 3 (query fixes in 1–2) |
| A4 | **Column visibility** — `useColumnVisibility.js`, `ColumnVisibilityPanel.jsx` | localStorage only; LQS/CDQ columns commented out; catalog-manager restriction checks `displayName` which never exists | Server-persisted per-user views + role presets + share with team; quality columns properly re-enabled (Step 5) | 3, 5 |
| A5 | **Bulk operations toolbar** — bulk status/category/brand/price-dispute, bulk delete, bulk week-history | Writes with no dry-run, no diff, no undo; several handlers unscoped (F2) | Bulk Edit v2: preview diff, validate, run as an async job with progress, undo journal, always scope-checked | 1 (scope), 6 (job/undo) |
| A6 | **Parent view** — `GET /asins/parent-view` :3468, `ParentAsinReport.jsx` | JS-side sort/paginate, dead `ParentGmsMonthly` CTE, unbounded GMS joins, no seller on the GMS join | SQL-side pagination, correct month windows, variation-level contribution analytics, parent health rollup | 2, 4 |
| A7 | **Real-time updates** — 9 socket handlers in the page | Coarse "reload the page" reactions; no per-row patching; no job progress centre | Incremental row patch from socket deltas, unified job-progress centre, connection indicator | 3, 6 |

### B. ASIN 360° surfaces

| # | Sub-module (files) | Today | Upgrade | Step |
|---|---|---|---|---|
| B1 | **ASIN detail** — `AsinDetailModal.jsx` (973) | Field dump in tabs; `SELECT a.*` then a JS scope check; no verdict, no next step | 360° panel: health score + why, top issues, price/BSR/rating/buy-box timeline, parent & sibling context, action buttons (sync, repair, task, export) | 4, 5 |
| B2 | **Trends** — `AsinTrendsModal.jsx` (394), `src/utils/asinHistory.jsx` | Week badges only (`W1`…`W5` from day-of-month), no charts, data limited to what history exists, 14-day window | Real charts (price, BSR, rating, reviews, buy-box, Sub-BSR), ranges 7/30/90/180 d, period comparison, event annotations (deal, content change, stock-out) | 2, 4 |
| B3 | **Price view** — `PriceViewModal.jsx` (34 KB) | Isolated price view; dispute logic recomputed client-invisibly; no competitor ladder | Price intelligence: ladder vs Buy-Box offers, MRP/ASP/2nd-ASP history, dispute explainer, undercut alerts | 4 |
| B4 | **BSR view + Sub-BSR** — `BSRViewModal.jsx`, `GET /:id/subbsr-trend`, `SubBsrHistory` | Sub-BSR series is always empty — the table has **no writer** (F10) | Writer in the sync path + backfill script; rank analytics: category rank, sub-category rank, rank velocity, sector position | 2, 4 |
| B5 | **Rating view** — `RatingViewModal.jsx` | Rating + review count trend; 7-vs-14-day delta hidden in the stats endpoint | Review velocity, rating distribution from `RatingBreakdown`, drop alerts, review-response signals | 4 |
| B6 | **Return %** — `ReturnPercentageModal.jsx`, `LossPerReturn` | Returns shown in isolation for selected ASINs | Returns risk lens: loss-per-return × velocity, margin impact alongside health | 4 |
| B7 | **Product details** — `ProductDetailsModal.jsx` | Raw attribute display | Content completeness checklist, A+ presence/absence history, image-set audit | 5 |

### C. Quality & content

| # | Sub-module (files) | Today | Upgrade | Step |
|---|---|---|---|---|
| C1 | **LQS / CDQ** — `backend/utils/lqs.js`, `src/utils/lqs.js`, `listingQualityService.js`, 4 analyzer files (~2,700 lines) | **Three different algorithms** (F7); columns disabled "per user request"; `recalculate-lqs` computes from unselected columns and zeroes component scores (F8); the analyzers are barely used | One canonical analyzer-based scoring service; component scores + weights exposed; score history; per-ASIN prioritised fix list; re-enable the columns | 1 (correctness), 5 (product) |
| C2 | **AI listing analysis** — `/actions/ai-listing-analysis`, `nvidiaAiService` | Ad-hoc endpoint; empty body analyses **every ASIN in the database** (F2-adjacent); no queue, no persistence | Scoped async job, persisted insights per ASIN, quantified suggestions, one-click → task/action | 1 (scope), 5 (product) |
| C3 | **Image generation** — `generateImages`, `imageGenerationService` | One-off generation per ASIN | Batch queue with review/approve workflow and generated-image history | 5 |
| C4 | **Tags family** — `TagsCell`, `EditTagsModal`, `BulkTagsModal`, `TagsHistoryModal`, predefined tags, auto-tags cron, CSV tags | Two implementations of the same handlers (`asinController` vs `tagController`, F11); CSV path unscoped; tags stored as a JSON blob queried with `LIKE`; auto-tags limited to Pareto + age | One tag service; scoped everywhere; rule-driven auto-tags v2 (user-defined rules, dry-run); tag coverage analytics; tag-driven segments | 1, 3, 5 |

### D. Data in

| # | Sub-module (files) | Today | Upgrade | Step |
|---|---|---|---|---|
| D1 | **CSV / XLSX import** — `BulkImportModal.jsx`, `importFromCsv` :1763 | Whole file in one transaction, 2–3 sequential statements per row, header-alias guessing, no dry-run, no undo, seller from body (F2/F3) | Import v2: validate → preview diff → commit → per-row error report → undo; batched idempotent upserts; scope enforced | 1 (scope), 6 (v2) |
| D2 | **All-sellers bulk upload** — `bulkUploadAllSellers` :1956 | Sellers matched **by name string**, unmatched rows only mentioned in an `errors` array, not user-scoped | Explicit seller-ID mapping with a review step, dry-run, audit trail of who imported what | 1, 6 |
| D3 | **Raw scrape upload / parse test** — `uploadRawAsins`, `asinDataParser.js` | Sequential `MERGE` per row, no payload validation, an unrouted duplicate (`uploadRawText`, F11) | Schema contract + validation report, batched upserts, dead code removed | 1 (dead code), 2 (contract) |
| D4 | **Scrape / sync operations** — repair UI, `marketSyncApi`, Octoparse pipeline, `liveDataSyncService` | Manual sync and repair; the 6-hourly `integrityRepair` cron is a **no-op**; no freshness SLA | Freshness SLA per ASIN, stale-first automatic repair queue, per-ASIN sync history, coverage + scrape-success KPIs | 2, 4 |
| D5 | **Seller ASIN tracker** — `SellerAsinTrackerPage.jsx` (1612), `/api/seller-tracker/*` | Separate page; inserts ASINs as `PENDING`; gated on seller permissions, not ASIN permissions | Decide: unify into the ASIN Manager workspace (recommended) or align permissions/scope; show tracker state per seller in the main table | 3 |

### E. Data out

| # | Sub-module (files) | Today | Upgrade | Step |
|---|---|---|---|---|
| E1 | **Export** — `ExportAsinModal.jsx` (988), `exportData` :2651 | Big field picker, synchronous CSV/XLSX, scoped; heavy | Async export jobs with progress + download, saved export templates, "export exactly what I'm looking at" (filters + columns + sort) | 6 |
| E2 | **Full export** — `fullExport` :3329 | **Unscoped** (F2); builds a ≤200k-row workbook in memory | Scope it now; retire in favour of E1 v2 with streaming | 1, 6 |
| E3 | **Tags template / CSV round-trip** — `tagController` | Template built from ASINs, unscoped; no validation on re-upload | Scoped template, validated round-trip with a diff preview | 6 |

### F. Platform (what makes all of the above safe to build on)

| # | Item | Today | Upgrade | Step |
|---|---|---|---|---|
| F-p1 | **Schema as code** | `Asins`, `AsinHistory`, `AsinWeekHistory` have **no migration** — they exist only in the production DB | Additive, idempotent migrations + the indexes the hot queries need (list filters, GMS joins, history windows) | 2 |
| F-p2 | **Tests** | **0** covering the module, while `fakePool` + supertest harness already exists | Scope-matrix suite first, then per-step regression tests; every fix in this program ships with one | 1 → 6 |
| F-p3 | **Performance budget** | 10 statements + 2 unbounded scans per list request (F5); stats cache cleared on every write (F12) | Query budget on `/api/asins` (target ≤5 statements, no unscoped scans), per-scope cache invalidation, slow-query logging | 2, 6 |
| F-p4 | **Orphan surfaces** | `/api/asins-table` (permission-less, unscoped, F1); `/api/listing-quality/*` (authenticate only) | Decide per surface: delete or promote to a supported, scoped API | 1 |
| F-p5 | **Docs** | Deep dive written | This program is updated as each step lands, mirroring `docs/ads-module-upgrade.md` (verification → deliberately-not-done → live-review checklist) | every step |

---

## 3. Audit finding → step that fixes it

| Finding | Summary | Step |
|---|---|---|
| F1 | `/api/asins-table` unscoped, permission-less orphan | 1 |
| F2 | 21 routes without seller scope | 1 (all ASIN routes) |
| F3 | `checkSellerAccess` blind to request bodies | 1 |
| F4 | Bulk add cannot attribute a seller | 1 |
| F5 | 10 statements / 2 unbounded scans per list load | 2 |
| F6 | `pagination.total` is the unfiltered count | 1 |
| F7 | Three LQS implementations | 1 (collapse), 5 (product) |
| F8 | `recalculate-lqs` degraded + zeroes component scores | 1 |
| F9 | No tests | 1 → 6 |
| F10 | `SubBsrHistory` has no writer | 2 |
| F11 | Duplicated/dead handlers | 1 |
| F12 | Stats cache invalidated on every write | 2 |
| F13 | Week-history semantics (non-ISO, mixed clocks) | 2 |
| F14 | Frontend weight / no virtualisation | 3 |
| F15 | Import performance and silent skips | 6 |

---

## 4. The steps

Each step is one reviewable increment: code + tests + a short "what changed / how it was verified" section appended to this document. Nothing in a later step depends on an earlier one being *merged*, only on it being *correct*.

### Step 1 — Trust the module ✅ **delivered** *(correctness + security; no UI change)*

> Results, file list and verification: §7. F1, F2, F3, F4, F6, F7, F8 and F11 are now repaired in code.

**Do**
1. **Scope everywhere on `/api/asins/*`**: extend `checkSellerAccess` to consider `body.sellerId`; apply `resolveSellerScope` (`backend/utils/sellerScope.js`, already used by ads/data/keyword controllers) to every body-carried seller — `POST /`, `/bulk`, `/match`, `/import-csv`, `/bulk-upload-all-sellers`, `/upload-raw`, `bulk-update`, `:id/week-history`, `bulk-week-history`; add `loadAsinInScope(req, id)` and apply it to `getAsinTrends`, `getSubBsrTrend`, `getParentChildren`, tag writes, `recalculate-lqs(ids)`.
2. **`/api/asins-table`**: delete route + controller + service, or gate with `asinmanager_view` + scope — decision needed (§6 Q4).
3. **Bulk add fixed**: per-item `sellerId` (accept `sellerId || seller`), validated against scope, marketplace default, `{insertedCount, duplicatesCount}` response, same post-insert side effects as single create.
4. **Honest pagination**: filtered `pagination.total` + optional `scopeTotal` for the header.
5. **One LQS write path**: `recalculate-lqs` delegates to `listingQualityService.analyzeAndSaveFull`; component scores are no longer zeroed; the disabled frontend heuristic is marked deprecated.
6. **Dead code**: remove unrouted `uploadRawText` and the duplicated tag exports in `asinController` (routes already use `tagController`).
7. **Tests** (`backend/__tests__/routes/asinScope.test.js`, `asinBulkCreate.test.js`, `asinListContract.test.js`, `asinLqs.test.js`) built on `testUtils/fakePool.js`.

**Acceptance:** a scoped user gets 403 (never silent rows) for every foreign seller/ASIN access path; bulk add creates correctly attributed rows; totals match the applied filters; `recalculate-lqs` preserves component scores; `npm run test` green in `backend/`.

### Step 2 — Trust the data *(freshness, history, schema)*

**Do:** remove the two unbounded scans and cache the months list; bound week-history reads; write `AsinWeekHistory` + `SubBsrHistory` from the sync path (plus a one-off backfill script); add a freshness model (`LastScrapedAt` SLA, "stale" filter, stale-first repair queue replacing the no-op `integrityRepair`); add migrations for `Asins` / `AsinHistory` / `AsinWeekHistory` + indexes for the hot paths; compute week keys in SQL (ISO) and store UTC-consistent dates; scope-invalidate the stats cache; validate the raw-payload contract in `asinDataParser`.

**Acceptance:** list request costs ≤5 statements with no unscoped scan; a fresh environment can be provisioned from migrations; Sub-BSR and week-history surfaces return real rows; the KPI strip can show "% fresh".

### Step 3 — The workspace *(table, filters, views)*

**Do:** virtualise the table and project only the visible columns server-side; faceted filters with counts and URL-synced state; **saved views/segments** (new table, per user/team, incl. column + sort + filter sets); per-user column persistence server-side; socket-driven incremental row patching + job progress centre; unify or align the Seller ASIN Tracker surface.

**Acceptance:** a 50k-ASIN seller scrolls smoothly; a filtered view can be saved, shared and restored exactly; no full-page reload on socket events.

### Step 4 — Data-driven intelligence *(the core of "powerful")*

**Do:** **ASIN Health Score** (composite of content quality, price competitiveness, demand trend, review velocity, Buy-Box win, data freshness) — materialised, sortable, filterable, explained in the detail modal; **change/anomaly feed** (price drops, BSR jumps, rating drops, Buy-Box loss, A+ removed, stock-outs) materialised as events with severity and filters; **watchlists + alert subscriptions** (socket + email); historical depth (retention + backfill to 180 days) powering real charts; **data-quality dashboard** (freshness, coverage, scrape success); competitor/Buy-Box benchmarking; profit/return lens from `FeePreview` + `LossPerReturn`.

**Acceptance:** opening the module answers "what changed since yesterday, which ASINs are at risk, what needs attention" without running a report; every number is drill-through to the filtered table.

### Step 5 — Decisions & automation

**Do:** AI listing optimisation rebuilt on the existing analyzer services with quantified, prioritised fixes → one-click task/action; re-enable LQS/CDQ columns against the canonical service; rule-driven automation (anomaly → action, auto-tags v2 with custom rules and dry-run); auto-repair triggers from the freshness queue; image-generation batch workflow.

**Acceptance:** the module not only surfaces problems but proposes the next action and can execute it, with an audit trail.

### Step 6 — Scale, import/export, hardening

**Do:** async streaming export jobs + templates; import v2 (validate → diff → commit → error report → undo) with batched upserts; bulk-edit job runner with undo; query-budget tests and load profile; finish the module test suite (scope, import, export, bulk, LQS, sync).

**Acceptance:** a 10 MB import completes without long lock time and can be undone; a 200k-row export streams without memory spikes; query budget enforced in CI.

---

## 5. How each step is verified (in this environment and on staging)

| Layer | Here (sandbox) | On your staging |
|---|---|---|
| Backend | `npm ci` in `backend/`; Jest with `testUtils/fakePool.js` (no DB needed) — the same harness the ads/dashboard suites use; supertest route suites for the scope matrix | Run the route checks against the real DB |
| Frontend | `npm ci` + `npm run build`; logic-level checks (no Playwright browsers here) | Manual pass through the workspace |
| Database | Migration files authored and reviewed; **cannot be executed here** (no SQL Server) | `npm run migrate` + the live-review checklist (as in `docs/ads-module-upgrade.md` §9) |
| Every step | Test suite + build + a written "what changed / how verified / deliberately not done" section in this document | — |

No step will be called done on my side unless the tests I can run are green; DB-dependent verification is explicitly listed as pending for your environment.

---

## 6. Open decisions

1. **Starting point** — recommended: Step 1, because every later step multiplies the exposure of the scope holes and because intelligent features sitting on wrong totals erode trust in the whole module. Alternative: start at Step 3 or 4 if visible product change is needed first.
2. **Meaning of "data driven"** — insights in the UI vs data accuracy/freshness vs automation/decisions (the plan covers all three, in the order Trust → Signal → Decision → Scale).
3. **Review pace** — one step per review, or run two steps before checking in.
4. **`/api/asins-table`** — delete it, or gate and keep it as a supported ledger API? (Needs to know whether anything outside this repo calls it.)
5. **Seller ASIN Tracker** — fold into the ASIN Manager workspace, or keep as a separate page with aligned scope?


---

## 7. Step 1 results (delivered)

**Goal:** make the module's numbers and its access rules trustworthy before anything is built on top of them.

### What changed

| # | Change | Files |
|---|---|---|
| 1 | **One scope implementation for ASINs** — new `utils/asinScope.js` (`scopeFor`, `requireSellerScope`, `loadAsinInScope`, `assertSellersInScope`, `assertAsinsInScope`, `forbidden`, `cleanupUpload`) built on the existing `utils/sellerScope.js`, so ASIN behaves like ads/data/keywords | `backend/utils/asinScope.js` *(new)* |
| 2 | **`checkSellerAccess` sees body sellers**, accepts a single id / array / list, tolerates object `assignedSellers`, and fails closed with `forbidden_seller` (this was the hole F3 described) | `backend/middleware/auth.js` |
| 3 | **Every id-addressed read is scoped**: trends, sub-BSR trend, parent children (SQL predicate) | `backend/controllers/asinController.js` |
| 4 | **Every id-addressed write is scoped**: week-history (single + bulk), bulk update, tag write, bulk tags, `recalculate-lqs(ids)` | `asinController.js`, `backend/controllers/tagController.js` |
| 5 | **Every body-carried seller is scoped**: `import-csv` (now also 400s without a seller), `upload-raw`, `match`, `full-export`; **all-sellers import is global-only** | `asinController.js` |
| 6 | **Tag surface scoped end-to-end**: tag vocabulary, tag CSV import (query per row restricted), tags template | `tagController.js` |
| 7 | **Bulk add fixed (F4)** — per-item `sellerId`/`seller` with a top-level default, scope-checked, seller marketplace applied, duplicates counted, `{insertedCount, createdCount, duplicatesCount}` returned, seller counts + Octoparse sync triggered like the single-ASIN path | `asinController.js` |
| 8 | **Honest pagination (F6)** — `pagination.total` = filters applied, new `pagination.scopeTotal` = unfiltered scope count; the header uses `scopeTotal`, the pager uses `total` | `asinController.js`, `src/pages/AsinManagerPage.jsx` |
| 9 | **One LQS write path (F7/F8)** — `recalculate-lqs` delegates to `listingQualityService.analyzeAndSaveFull`; component scores are no longer zeroed; the frontend heuristic is marked deprecated | `asinController.js`, `src/utils/lqs.js` |
| 10 | **Ledger endpoint gated and scoped (F1)** — `/api/asins-table` requires `asinmanager_view` and carries the caller's sellers in both the count and the page query | `backend/routes/asinTableRoutes.js`, `backend/controllers/asinTableController.js`, `backend/services/asinTableService.js` |
| 11 | **Dead code removed (F11)** — the unrouted `uploadRawText` and the duplicate tag handlers in `asinController` (routes use `tagController`) | `asinController.js` |
| 12 | **"All sellers" import hidden** from users who cannot use it, instead of failing after upload | `src/components/asins/BulkImportModal.jsx` |

### How it was verified

`backend/` — `npm test` (Jest 30 + the existing `testUtils/fakePool.js` harness, no database needed):

| Suite | Tests | What it pins |
|---|---|---|
| `__tests__/routes/asinScope.test.js` | 20 | 401/403 wiring; foreign ASIN id → 403 with **no** history/week/tag query; bulk week-history and bulk-update refuse a batch (rollback, nothing written); body-carried sellers on import/match/raw/all-sellers/full-export; `checkSellerAccess` unit; ledger endpoint permission + scope; an assigned seller still succeeds |
| `__tests__/unit/asinListContract.test.js` | 3 | `total` = filtered count (carries the WHERE clause), `scopeTotal` = unfiltered count (carries the scope binds), empty page honest |
| `__tests__/unit/asinBulkCreate.test.js` | 5 | per-item seller attribution, batch default, 403 for a foreign seller (no writes, no sync), 400 instead of a NULL-seller row, duplicates counted, marketplace applied |
| `__tests__/unit/asinLqsRecalculate.test.js` | 4 | explicit ids go through the analyzer service, no ids → scoped query, foreign ids → 403, **component scores are never zeroed** (regression for F8) |

Result: **32 new tests, all passing** (268 passing / 269 total in `backend/`; the single failure is the pre-existing `nvidiaAiService` suite, which needs `NVIDIA_NIM_API_KEY` and is untouched by this step).

Frontend: `npm ci && npm run build` → **✓ built** (only pre-existing third-party warnings).

### Deliberately not done in this step

- **`/api/asins-table` was gated, not deleted** — kept per your call; it is now permission-checked and scoped.
- **The two unbounded list queries and the stats-cache churn (F5/F12)** — Step 2, where the indexes land with them.
- **`SubBsrHistory` writer, week-history semantics (F10/F13)** — Step 2.
- **LQS product work** (re-enabling the columns, per-ASIN fix lists) — Step 5.
- **Delete-permission wording** — `deleteAsin`/`bulkDeleteAsins` still gate on a role literally named `admin` (super_admin is normalised to it, so admins still pass); the misleading "Only Super Administrators" message is left for the permission pass in Step 4.

### Pending in your environment (needs the real database)

1. Run the four suites against staging data and confirm the 403 paths behave for the real role set (brand_manager / catalog_manager / listing_team).
2. Confirm `Asins.SellerId` nullability — if it is nullable, check for existing rows with `SellerId IS NULL` produced by the old bulk-add path and decide whether to quarantine or delete them.
3. Watch the import path once: `POST /import-csv` now rejects a missing seller with 400 by design.
