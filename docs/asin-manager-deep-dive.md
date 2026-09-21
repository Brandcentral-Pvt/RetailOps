# ASIN Manager Module — Deep Dive

**Scope:** the ASIN Manager as it exists on `main` @ `ad13de6` ("Ads Manager restructured") — frontend page + components, `/api/asins/*` (45 routes), the tag/LQS/table sub-surfaces that feed it, and the ingestion paths that write the `Asins` table.

**Method:** static analysis of the repo on this commit (`grep`/`sed`/`python3` over the source, exports census, write-path census, route/permission inventory, scope audit of every exported handler). Structured after `docs/ads-module-deep-dive.md`.

**Not verified:** no SQL Server, no `.env`, no `node_modules` in this environment — nothing here was executed against a live database. Query costs below are derived from the SQL text and the shape of the code, not from a query plan. Where a claim depends on runtime behaviour it is labelled *(unverified)*.

---

## 1. Executive summary

ASIN Manager is the product's **core catalogue surface**: it is where every tracked ASIN is listed, searched, filtered, tagged, scored, exported, repaired, and pushed into scraping. It is the largest module in the codebase and the one the most internal roles touch.

| Dimension | Size |
|---|---|
| Frontend | `src/pages/AsinManagerPage.jsx` **4,332 lines** (largest page in `src/`), plus 14 ASIN-named files (11,150 lines) and 8 lazy modals |
| Backend | `backend/controllers/asinController.js` **3,702 lines**, 42 exports; 5,667 lines across ASIN-named files |
| API | **45 routes** under `/api/asins`, `asinApi` client with **35 methods** |
| Storage | `Asins`, `AsinHistory`, `AsinWeekHistory`, `SubBsrHistory`, `PredefinedTags`, `TagsHistory` |
| Write paths into `Asins` | **20 files** (15 controllers/services + scrapers + sync services) |
| Tests | **0** for the module (11 backend suites exist repo-wide; none touch ASIN code) |

### What is healthy

- The **list path is properly paginated server-side** (`OFFSET/FETCH`) with an allow-listed sort map and bound parameters — no SQL injection through any of the ~45 filters, and no full-dataset fetch (the failure mode that made the ads module unusable).
- Seller scoping is implemented correctly in the highest-traffic handlers: `getAsins`, `getAsin`, `updateAsin`, `createAsin`, `getAsinStats`, `exportData`, `getParentView`.
- The import path runs in a transaction, resolves the seller's marketplace, and indexes existing ASINs per seller before upserting.
- Refresh is real: 9 socket events drive table updates (`scrape_data_ingested`, `scrape_batch_complete`, `repair_job_progress`, `liveSync:completed`, …), and the page guards against stale responses with a load token.
- Permissions are modelled at four levels (`asinmanager_view|manage|import|export`) and wired through `requirePermission` on every route.

### Top risks (in order)

1. **`GET /api/asins-table` has no permission check and no seller scope** — any authenticated user can page through *every seller's* ASINs, `SELECT *` including BuyBox/offer JSON. It also has **no caller in the frontend**: an orphan endpoint with a hole in it. ([F1](#f1-))
2. **Seller scope is missing on a long tail of ASIN endpoints** — trends, sub-BSR, parent children, match, bulk update, week-history writes, `import-csv`, `bulk-upload-all-sellers`, `upload-raw`, `full-export`. The shared `checkSellerAccess` middleware cannot see a `sellerId` sent in a request **body**, so every body-carried seller silently passes. ([F2](#f2-), [F3](#f3-))
3. **`POST /api/asins/bulk` cannot attribute ASINs to a seller** — all three callers nest `seller`/`sellerId` per item, the controller reads it from the top level, and node-mssql converts `undefined` → `NULL` (`mssql@12.7.2 lib/base/request.js:132`). The bulk "Add ASINs" flow therefore inserts with a null seller, or is rejected outright. ([F4](#f4-))
4. **The list request costs 10 SQL statements, two of which are unbounded table scans** (`SELECT DISTINCT FORMAT(Date,'yyyy-MM') FROM GmsDailyPerformance`, `SELECT DISTINCT TOP 7 Date FROM AsinHistory`) plus a correlated `SUM(OrderedUnits)` subquery per returned row. ([F5](#f5-))
5. **Pagination metadata is wrong by construction** — `pagination.total` is the *unfiltered* count, so the page's "Managing N ASINs" subtitle and page count lie whenever a filter, search, status or tag is applied. ([F6](#f6-))
6. **Three different LQS algorithms** write/display the same score, and `POST /recalculate-lqs` computes it from columns it never selected while zeroing the component scores. ([F7](#f7-), [F8](#f8-))
7. **Zero tests** on ~8,000 lines of the module's own code. ([F9](#f9-))
8. **`SubBsrHistory` is read by 3 endpoints and the UI, and written by nothing** in this repository. ([F10](#f10-))

---

## 2. Module map

### 2.1 Files

| Layer | File | Lines | Role |
|---|---|---|---|
| FE page | `src/pages/AsinManagerPage.jsx` | 4,332 | Dashboard KPIs + table + parent view + all bulk actions |
| FE style | `src/pages/AsinManager.module.css` | 153 | Table/filter chrome |
| FE hook | `src/hooks/useColumnVisibility.js` | 222 | 39 visible columns (46 defined, 7 LQS/CDQ entries commented out) across 8 categories, localStorage-persisted, catalog-manager allow-list |
| FE utils | `src/utils/asinHistory.jsx` | 103 | Week/date structure, trend badges (renders JSX) |
| FE utils | `src/utils/lqs.js` | 77 | **A third LQS implementation** (subtractive heuristic, different inputs) |
| FE modals | `src/components/AsinDetailModal.jsx` (973), `AsinTrendsModal.jsx` (394), `PriceViewModal.jsx` (34 KB), `BSRViewModal.jsx` (32 KB), `RatingViewModal.jsx` (33 KB), `asins/ExportAsinModal.jsx` (988), `asins/EditTagsModal.jsx`, `asins/BulkImportModal.jsx`, `asins/BulkTagsModal.jsx`, `asins/ColumnVisibilityPanel.jsx`, `TagsHistoryModal.jsx`, `ReturnPercentageModal.jsx`, `ProductDetailsModal.jsx` | ~4,000 | Lazy-loaded detail/edit/export surfaces |
| FE cells | `src/components/asins/TagsCell.jsx`, `TrendBadge.jsx` | ~400 | In-table widgets |
| BE routes | `backend/routes/asinRoutes.js` | 100 | 45 routes, multer (10 MB, csv/txt/xlsx) |
| BE routes | `backend/routes/asinTableRoutes.js` | 14 | `GET /api/asins-table` — **authenticate only** |
| BE controller | `backend/controllers/asinController.js` | 3,702 | 42 exports: list/detail/CRUD/import/export/tags/repair/LQS/parent |
| BE controller | `backend/controllers/tagController.js` | ~600 | Tags CRUD + CSV bulk tags (routes take this file) |
| BE controller | `backend/controllers/tagsHistoryController.js` | 231 | Tag audit trail |
| BE controller | `backend/controllers/asinTableController.js` + `services/asinTableService.js` | 50 + 168 | Parallel "high-performance ledger" read path |
| BE controllers | `asinCompleteController.js` (176), `sellerAsinTrackerController.js` (504) | 680 | "Complete ASIN" + seller/Keepa tracker |
| BE service | `backend/services/asinDataParser.js` | 497 | Raw-text → `Asins` upsert (Octoparse payloads) |
| BE service | `backend/services/listingQualityService.js` | 157 | Weighted LQS (analyzers) — **the score other services store** |
| BE utils | `backend/utils/lqs.js` (149) + `titleAnalyzer/bulletPointsAnalyzer/imageAnalyzer/descriptionAnalyzer` | ~2,700 | Second LQS implementation |
| BE tests | — | 0 | Nothing covers the module |

### 2.2 Endpoint surface (45 routes, all under `/api/asins`)

| # | Route | Permission | Seller scope enforced? |
|---|---|---|---|
| 1 | `GET /health-check/tags` | none | n/a (static) |
| 2–3 | `GET /:asinId/tags-history`, `/tags-summary` | view | ❌ (audit trail of any ASIN) |
| 4 | `PUT /:asinId/tags` | manage | ❌ |
| 5 | `POST /:id/generate-images` | manage | ✅ in handler |
| 6–10 | `GET /search`, `/stats`, `/filters`, `/brands`, `/lqs-top` | view | ✅ |
| 11–12 | `GET /parent-view`, `/parent-view/children/:parentAsin` | view | ✅ / ❌ |
| 13 | `POST /auto-tags/run` | manage | global by design (whole-tenant recompute) |
| 14–15 | `GET /`, `/all` | view | ✅ |
| 16–18 | `GET /seller/:sellerId`, `/repair-status/:sellerId`, `POST /repair/:sellerId` | view / manage | ✅ `checkSellerAccess` (param) |
| 19–20 | `GET /:id/trends`, `/:id/subbsr-trend` | view | ❌ |
| 21 | `PUT /:id/week-history` | manage | ❌ |
| 22 | `POST /` (create) | manage | ✅ in handler |
| 23 | `POST /match` | view | ❌ (body `sellerId`) |
| 24 | `POST /bulk` (create many) | manage | ❌ body-blind + **null seller** (F4) |
| 25–26 | `POST /bulk-delete`, `/bulk-update` | manage | ❌ (admin-only by handler / none) |
| 27 | `POST /bulk-week-history` | manage | ❌ |
| 28 | `POST /import-csv` | import | ❌ body `sellerId` |
| 29 | `POST /bulk-upload-all-sellers` | import | ❌ **all sellers by design, no user-scope check** |
| 30 | `POST /recalculate-lqs` | manage | ⚠️ scoped without `ids`, ❌ with `ids` |
| 31–32 | `POST /upload-raw`, `/parse-test` | manage | ❌ body `sellerId` |
| 33–34 | `POST /export`, `GET /full-export` | export | ✅ / ❌ **no scope at all** |
| 35–38 | `GET /tags`, `/tags/template`, `POST /bulk-tags`, `/tags/bulk` | view/manage/import | ❌ (see F11) |
| 39–42 | `GET/POST/PUT/DELETE /predefined-tags` | view/manage | tenant-wide tag vocabulary |
| 43 | `GET /:id` | view | ✅ in handler |
| 44 | `PUT /:id` | manage | ✅ in handler |
| 45 | `DELETE /:id` | manage | admin-only by handler |

Sibling surfaces that read the same tables: `GET /api/asins-table` (**authenticate only**, no permission), `POST|GET /api/listing-quality/*` (**authenticate only**), `GET /api/seller-tracker/:sellerId/asins` (permission-gated, `sellerId` from the path, no `checkSellerAccess`).

### 2.3 Who writes `Asins`

20 files issue `INSERT INTO Asins` / `UPDATE Asins` / `MERGE INTO Asins`:

| Producer | Entry point | Writes |
|---|---|---|
| Manual UI add | `asinController.createAsin` / `createAsins` | row (bulk path broken — F4) |
| CSV/XLSX import | `asinController.importFromCsv` (:1904), `bulkUploadAllSellers` (:2097) | rows + `AsinHistory` |
| Catalog/tag imports | `bulkUploadController.catalogSync/tagsImport/ajioBulkImport` | rows + `AsinHistory` |
| Raw scrape upload | `asinController.uploadRawAsins`/`uploadRawText` → `asinDataParser` (`MERGE` :434) | metrics |
| Live sync (Creators API + Playwright) | `liveDataSyncService` | metrics + `AsinHistory` MERGE (:606) |
| Octoparse ingestion | `marketDataSyncService` (:2481, :2608) | metrics, A+/rating breakdown; **no history** |
| Keepa tracker | `sellerAsinTrackerController` (:165) | new rows |
| LQS | `listingQualityService`, `recalculateLqs` | scores/grades |
| Tags/auto-tags | `tagController`, `autoTagService` (`UPDATE` ×7) | `Tags` |
| Side effects | `imageGenerationService`, `feeCalculationEngine`, `rulesetEngineService`, `nvidiaAiService`, `sellerController`, `liveDataController` | columns |

---

## 3. Data model

No migration in `backend/migrations/` creates `Asins`, `AsinHistory` or `AsinWeekHistory` — their DDL exists **only in the production database**. Migrations 020/023 add the satellite tables and one column:

| Table | Created by | Notes |
|---|---|---|
| `Asins` | *nothing in-repo* | Core catalogue. ~110 columns observed: identity (`Id`, `AsinCode`, `SellerId`, `Sku`, `ParentAsin`, `Marketplace`, `Status`, `ScrapeStatus`), pricing (`CurrentPrice`, `UploadedPrice`, `Mrp`, `SecondAsp`, `AspDifference`, `DiscountPercentage`, `PriceDispute`), demand (`BSR`, `SubBsr`, `SubBSRCategory`), trust (`Rating`, `ReviewCount`, `RatingBreakdown`), content (`Title`, `Images`, `ImagesCount`, `BulletPoints`, `BulletPointsText`, `VideoCount`, `ProductDescription`, `HasAplus`, `AplusModuleCount`, `AplusPresentSince`, `AplusAbsentSince`), quality (`LQS`, `LQSGrade`, `TitleScore`, `BulletScore`, `ImageScore`, `DescriptionScore`, `Cdq`, `LqsDetails`, `CdqComponents`), deals (`DealBadge`, `DealType`, `DealStartTime`, `DealEndTime`, `DealAccessType`), buy box (`SoldBy`, `SoldBySec`, `BuyBoxWin`, `BuyBoxStatus`, `BuyBoxes`, `AllOffers`, `AvailabilityStatus`, `StockLevel`), finance (`FeePreview`, `LossPerReturn`), trend flags (`BsrTrend`, `RatingTrend`), JSON `Tags`, sync (`LastScrapedAt`, `LastSyncSource`), audit (`CreatedAt`, `UpdatedAt`) |
| `AsinHistory` | *not in-repo* (023 adds `Mrp`) | Daily snapshot per ASIN. Written by `liveDataSyncService._upsertAsinHistory` (`MERGE`, :606) and by the two import controllers. Only writer of the *enrichment* variant (`UPDATE h SET …`) can update an existing row — it never inserts. |
| `AsinWeekHistory` | *not in-repo* | Weekly aggregates (`WeekStartDate`, `AvgPrice`, `AvgBSR`, `AvgRating`, `TotalReviews`, `AvgLQS`). Written **only** by `updateWeekHistory`/`bulkUpdateWeekHistory` (rows must already exist) — nothing in the ingestion path creates week rows. |
| `SubBsrHistory` | `020_missing_tables.js:176` | `AsinId`, `Date`, `SubBsrCategory`, `SubBsrRank`, index `(AsinId, Date DESC)`. **No writer anywhere in the repo** (F10). |
| `PredefinedTags`, `TagsHistory` | `020_missing_tables.js` | Tag vocabulary + audit (writers: `tagController`, `tagsHistoryController`). |

Two schema-level consequences: (a) the module's schema is undocumented in-repo, so a fresh environment cannot be provisioned from migrations; (b) `AsinWeekHistory`/`SubBsrHistory` can only ever hold rows a human created.

---

## 4. Read paths

### 4.1 The list (`GET /api/asins` → `getAsins`, `asinController.js:134-925`)

**Filters accepted** (all bound as parameters, `applyInputs` :161-235): status, category, brand, search, min/max price, min/max BSR, min/max LQS, scrapeStatus, buyBoxWin (own-seller list hard-coded: `ETrade Online`, `Cocoblu Retail`, `Clicktech Retail Private Ltd`, `RetailEz`), hasAplus, priceDispute, parentAsin, tag, selectedTags (multi), sku, subBsrCategory, rating/reviewCount/imagesCount/bulletPoints ranges, releaseDate range, bsrTrend, ratingTrend, ads, hasVideo, availabilityStatus, manufacturer, dealAccessType, hasDeal, title/bullet/image/description score ranges, ageFilter (30/60/90/180/365/365+ via `dbo.GetEnvDate()`), marketplace, historyDays.

**Scope:** non-global users are restricted to `assignedSellers`; a seller filter outside that set returns an **empty payload** (not 403); an unassigned user gets an empty payload. Global roles are `admin`, `super_admin`, `developer`, `operational_manager`.

**Statements per request — 10:**

| # | Statement | Cost concern |
|---|---|---|
| 1 | `COUNT(*)` with all filters (joins `Sellers`) | index-dependent |
| 2 | `COUNT(*)` **without** the status filter — the "raw" total | second scan of the same set |
| 3 | page query: `SELECT a.*, s.Name … (SELECT SUM(ISNULL(OrderedUnits,0)) FROM GmsDailyPerformance WHERE Asin = a.AsinCode) AS TotalOrders … OFFSET/FETCH` | **correlated subquery per row**, unindexed by seller, `NOLOCK` |
| 4 | `AsinHistory` for the page's ASINs, last `historyDays` (default 14) | fine |
| 5 | `AsinWeekHistory` for the page's ASINs — **no date bound** | grows forever; every list request reads the full week history of the visible rows |
| 6 | `SubBsrHistory`, last 14 days | fine, but table is never written (F10) |
| 7 | `SELECT DISTINCT FORMAT(Date,'yyyy-MM') FROM GmsDailyPerformance` — **no WHERE at all** | full scan + distinct + sort of the whole GMS table **per list request** |
| 8–9 | monthly orders + monthly revenue grouped by `FORMAT(Date,'yyyy-MM')` for the page's ASINs | non-sargable grouping |
| 10 | `SELECT DISTINCT TOP 7 Date FROM AsinHistory ORDER BY Date DESC` — **unscoped, tenant-wide** | full scan + distinct; also leaks global activity dates to every user |

The data-path queries run `WITH (NOLOCK)` (dirty reads accepted) and the whole handler is wrapped in `executeWithRetry`.

**Row shaping (JS):** each row is rebuilt into ~100 camelCase fields with 11 `JSON.parse` calls (`AllOffers`, `SubBSRs`, `SubBsrCategories`, `Images`, `BulletPointsText`, `RatingBreakdown`, `LqsDetails`, `BuyBoxes`, `CdqComponents`, `FeePreview`, `History`) guarded by try/catch, plus derived logic: BuyBox fallback offers, `priceDispute` recomputation (> ₹5 delta and no "proper" deal badge, regex-allow-listed), `hasDeal`, trend flags.

**Response:** `{ asins, months, globalHistoryDates, pagination }` — history arrays are embedded **per row**, so payload grows with `limit`. `GET /all` calls the same handler with `limit=1000`.

### 4.2 Detail (`GET /:id` → `getAsin`, :926-1095)
`SELECT a.*` joined to `Sellers`, then a scope check on the fetched row (404 before 403 — an unassigned user can distinguish "missing" from "forbidden"). Same JSON parsing/mapping as the list. This is the data source for `AsinDetailModal`, which additionally calls `GET /:id/subbsr-trend`.

### 4.3 Trends & sub-BSR (:1096-1160, :3203-3291)
`getAsinTrends` returns week history + current values and computes deltas in SQL-adjacent JS; `getSubBsrTrend` returns per-category rank series for the last N days. **Both are unscoped** (F2): any `asinmanager_view` holder can read any ASIN's history by id.

### 4.4 Stats (`GET /stats` → `getAsinStats`, :1161-1367)
Five statements: basic counts, a `ParentAgg` CTE (group by parent) producing averages/ratios, status breakdown, top-5 by BSR, and a 7-vs-14-day review delta from `AsinHistory`. Cached in-process for **60 s** keyed by `{seller, marketplace, roleName, userId, assignedSellers}`. `clearAsinStatsCache()` (called on **every** ASIN write via `updateSellerAsinCount` :1338 and directly in `updateAsin`) clears the whole map and also clears the seller cache — bulk imports therefore invalidate the cache repeatedly.

### 4.5 Parent view (`GET /parent-view`, :3468-3660)
Three CTEs (`ParentCatalog`, `ParentGms`, `ParentGmsMonthly`) aggregate `Asins` + `GmsDailyPerformance`, then **a second query re-computes the monthly breakdown** (the `ParentGmsMonthly` CTE is dead code — it is never selected from), then the handler **sorts and paginates in JS** with `parents.slice(...)`. There is no date bound on the GMS joins despite the "last 3 months" comment, so every page load aggregates all history for all parents in scope.

### 4.6 Filters/brands/search (:1569-1732)
`getAsinFilterOptions` and `getAsinBrands` are scoped to `assignedSellers` and used to populate the filter bar; `searchAsins` is a scoped `LIKE` search.

### 4.7 Parallel/orphan read surfaces
- `GET /api/asins-table` → `asinTableService.getAsinTableData` — `SELECT * FROM Asins` with `OFFSET/FETCH`, honouring `sellerId` **only if the caller passes one**; the route has `authenticate` and nothing else. No frontend caller (`grep` finds none). **F1**
- `POST /api/listing-quality/analyze/:asinId`, `analyze-batch`, `GET /analysis/:asinId` — `authenticate` only; `analyze-batch` with neither `asinIds` nor `sellerId` builds `SELECT Id, AsinCode FROM Asins` with no WHERE, i.e. analyse the entire catalogue, and writes the results back to every row.

---

## 5. Write paths

| Action | Handler | Notes |
|---|---|---|
| Add one ASIN | `createAsin` :1368 | Scope-checked against `assignedSellers`; fires Octoparse sync; 201 |
| Add many ASINs | `createAsins` :2259 | **Reads `sellerId` from the body root; every caller nests it per item → binds NULL** (F4). No scope check, no marketplace default, no history, no Octoparse trigger, single transaction |
| Import CSV/XLSX | `importFromCsv` :1763-1955 | Header-alias search across the first 30 rows; existing ASINs looked up **scoped to the seller**; per row: 1 upsert + 1 `AsinHistory` upsert; commits, deletes temp file, updates counts, triggers Octoparse. Row-by-row (~2-3 statements/row), all in one transaction |
| Import for all sellers | `bulkUploadAllSellers` :1956-2162 | Maps rows to sellers **by seller name string**, batches 1000/transaction, reports unmatched sellers in `errors`. Not user-scoped: any `asinmanager_import` holder can write rows for any seller |
| Raw scrape upload | `uploadRawAsins` :2539 / `uploadRawText` :2605 | Body `{sellerId, data[]}`; calls `asinDataParser.bulkUpsertAsins` which loops `upsertAsinFromRaw` **sequentially** then emits `scrape_batch_complete`. Also inflates `Sellers.ScrapeUsed`. `uploadRawText` is an unreferenced duplicate (no route) |
| Bulk status/category/brand/price-dispute | `bulkUpdateAsins` :2297-2383 | `UPDATE Asins SET … WHERE Id IN (…)` from client ids, **no scope check**; recomputes counts; handles the `Price Dispute` tag via JSON append/`STRING_AGG` rebuild |
| Mark/unmark price dispute (single) | `updateAsin` :1416-1511 | `COALESCE` update + tag maintenance in the same batch; scope-checked; triggers Octoparse when status changes |
| Week history | `updateWeekHistory` :2187, `bulkUpdateWeekHistory` :2483 | Upsert `IF EXISTS … UPDATE ELSE INSERT` keyed on `(AsinId, WeekStartDate)`; no scope check; date normalised with local-time `setHours(0,0,0,0)` |
| Tags | `tagController.updateAsinTags/bulkUpdateTags/bulkUpdateTagsCSV` | Writes `Tags` + `TagsHistory`; `bulkUpdateTagsCSV` accepts an upload and is not scope-checked |
| LQS | `recalculateLqs` :2384-2482, `listingQualityService`, `liveDataSyncService` | three implementations (F7/F8) |
| Auto-tags | `autoTagService.runAllAutoTags` (`POST /auto-tags/run`, daily 03:00 cron) | Pareto 80/20 + age tags across the tenant |
| Delete | `deleteAsin` :1512, `bulkDeleteAsins` :1538 | Post-permission role check: only a role literally named `admin` — the auth middleware masks `super_admin`→`admin`, so both pass; the message ("Only Super Administrators…") and `isAdmin` helper from `middleware/auth` are not used |
| Repair scrape | `repairIncompleteAsins`/`getRepairJobStatus` :1733-1762 | Thin wrappers over `scraperRunner` jobs; route-level `checkSellerAccess` is effective here because `sellerId` is a **param** |
| Images | `generateImages` :2234 | Delegates to `imageGenerationService` (NVIDIA NIM) |

---

## 6. Ingestion & scheduling (what actually keeps `Asins` fresh)

| Job | Trigger | Effect |
|---|---|---|
| Live Data Sync (`liveDataSyncService`) | `LIVE_SYNC_ENABLED` + `LIVE_SYNC_SCHEDULE_TIME` cron, or `marketSyncApi.triggerLiveSync*` | Amazon Creators API batches per seller → `Asins` metrics, `MERGE AsinHistory` for today, then `_applyScrapeEnrichment` (rating/reviews/A+) and `_applyFullScrape` for API-inaccessible ASINs, then `listingQualityService.analyzeAndSaveFull` |
| Amazon/Ajio enterprise pipeline | cron (`AUTOMATION_*` settings) → queue `PIPELINE_RUN` | Octoparse task pool → results → `marketDataSyncService.processBatchResults` → `updateAsinMetrics` (`:2481`), skeleton `INSERT` for unknown ASINs only when `allowCreation` |
| Keepa tracker | `POST /api/seller-tracker/sync/:sellerId` / `sync-all` | Inserts missing ASINs for a seller |
| Auto-tags | cron 02:00 (age) / 03:00 (full) | `UPDATE Asins` tag columns |
| Integrity repair | cron every 6 h | **no-op** (logs "skipped (Refactoring in progress)") — `repairIncompleteAsins` is the manual equivalent |
| Weekly backup | cron Sun 00:00 | `backup_db.cjs` |

Socket events emitted on write: `scrape_data_ingested` (per ASIN), `scrape_batch_complete` (per batch, from both sync services and the parser), `SELLERS_UPDATED` (from `updateSellerAsinCount`). The page subscribes to these plus `scrape_progress`, `repair_job_progress`, `ASINS_UPDATED`, `liveSync:completed`, `liveSyncAll:completed`.

---

## 7. Export paths

| Path | Handler | Scope | Shape |
|---|---|---|---|
| `POST /export` | `exportData` :2651-2981 | ✅ non-global users are intersected with `assignedSellers`; a fully-denied selection falls back to *all allowed sellers* (never widens beyond scope, but also never 403s) | Field-selected CSV/XLSX via `ExportAsinModal` (988 lines) |
| `GET /full-export` | `fullExport` :3329-3467 | ❌ **none** — `sellerId` honoured if supplied, otherwise every seller; `limit` clamped to 200,000 | Full-width XLSX built **in memory** (`XLSX.utils.json_to_sheet` → `write` → `res.send`), BuyBox JSON flattened into 5 extra columns |
| `GET /tags/template` | `tagController.downloadTagsTemplate` | ⚠️ builds a template from ASINs, not scope-checked | XLSX |

---

## 8. Access control

**Permission definitions** (`roleController.js:309-312`): `asinmanager_view`, `asinmanager_manage`, `asinmanager_import`, `asinmanager_export` (category *Marketplace*).

**Role grants** (`roleController.js:448-450`):
- `brand_manager`, `catalog_manager`: `asinmanager_view` + `asinmanager_export` (+ seller, tracker, keywords, tasks…)
- `listing_team`: `asinmanager_view`
- `operational_manager`: everything except settings/users/roles/keys → **manage + import + export**, and it counts as a *global* role
- `admin`: all permissions; `super_admin` is normalised to `admin` by the auth middleware (`middleware/auth.js:141-143`)

**The scoping contract** is centralised in `backend/utils/sellerScope.js` — `resolveSellerScope` / `bindSellerFilter`, with an explicit contract: global roles unrestricted, a requested seller outside the allow-list must produce **403, never a silent widen or narrow**, no assignment → empty payload. It is used by `dataController`, `exportAdsController`, `keywordController`, `keywordAnalysisController`, `growthExecutionController` — and **not by a single ASIN handler**. `asinController` re-implements a weaker variant inline in 12 places with three different spellings of the role check (`role?.name || role`, `role?.Name || role?.name || role`) and two different "global" lists (a literal array vs `isGlobalUserRole`).

**Why body-carried sellers escape:** `checkSellerAccess` (`middleware/auth.js:206-222`) reads
`req.params.id || req.params.sellerId || req.query.sellerId` — never `req.body`. Any route whose seller arrives in the body (`POST /`, `/bulk`, `/match`, `/import-csv`, `/upload-raw`, `/bulk-upload-all-sellers`) therefore passes the middleware untouched, and only the handler's own check (if any) protects it.

---

## 9. Findings

Severity: 🔴 high (data exposure / broken core function) · 🟠 medium (correctness, cost, maintainability) · 🟡 low.

> **Repair status:** F1, F2, F3, F4, F6, F7, F8 and F11 were fixed in Step 1 of [`docs/asin-manager-upgrade.md`](./asin-manager-upgrade.md) (§7); F5, F10, F12, F13 and F15 were fixed in Step 2 (§8: one aggregate instead of two counts, one round trip for history, cached month list, derived date list, freshness SLA + repair queue, one history writer for all ingestion paths, ISO weeks from SQL, scoped stats-cache invalidation, raw-payload contract). Step 3 (§9) added server-side column projection, facet counts with click-through, saved views + server-side column preferences, URL-carried workspace state, the Seller ASIN Tracker fold-in and incremental socket row patching — table virtualisation is deliberately deferred (no browser in this environment; paging already bounds the DOM). The findings below are kept as written — they describe the audit of `ad13de6`, not the current state.

### F1 🔴 `GET /api/asins-table` — unauthenticated-by-permission, unscoped catalogue dump

- Route: `backend/routes/asinTableRoutes.js:12` — `router.get('/', protect, asinTableController.getAsinTable);` (no `requirePermission`, no `checkSellerAccess`).
- Controller passes `sellerId` straight through (`asinTableController.js:14-30`); service applies it only if present (`asinTableService.js:26-40`) and issues `SELECT * FROM Asins`.
- **Effect:** any holder of a valid token — including roles with *no* ASIN permission — can page the entire `Asins` table for every seller, including `BuyBoxes`/`AllOffers` competitor JSON and `FeePreview` fee estimates. There is **no frontend caller** (dead surface with an open door).
- **Fix:** delete the route+controller+service, or add `requirePermission('asinmanager_view')` + `resolveSellerScope`/`bindSellerFilter` and a test asserting a foreign `sellerId` gets 403.

### F2 🔴 Long tail of unscoped ASIN reads/writes

Handlers that take an ASIN id (or a seller/`parentAsin` from the body) and never consult `req.user.assignedSellers`:

| Handler | Route | Exposure |
|---|---|---|
| `getAsinTrends` :1096 | `GET /:id/trends` | full week history + current price/BSR/rating of any ASIN |
| `getSubBsrTrend` :3203 | `GET /:id/subbsr-trend` | sub-BSR history of any ASIN |
| `getParentChildren` :3661 | `GET /parent-view/children/:parentAsin` | every child row (price, MRP, BSR, rating, tags, seller name) for any parent |
| `matchAsins` :3292 | `POST /match` | maps arbitrary ASIN codes to ids **for any seller** |
| `fullExport` :3329 | `GET /full-export` | all sellers' catalogue as XLSX (≤200 k rows) |
| `bulkUpdateAsins` :2297 | `POST /bulk-update` | writes status/category/brand/price-dispute on **any** ASIN ids |
| `updateWeekHistory` :2187 / `bulkUpdateWeekHistory` :2483 | `PUT /:id/week-history`, `POST /bulk-week-history` | writes week history for any ASIN |
| `importFromCsv` :1763 | `POST /import-csv` | creates/updates ASINs for any seller (`sellerId` from body) |
| `bulkUploadAllSellers` :1956 | `POST /bulk-upload-all-sellers` | creates/updates rows for **every** seller in the file |
| `uploadRawAsins` :2539 / `uploadRawText` :2605 | `POST /upload-raw` | writes scraped metrics into any seller, inflates their `ScrapeUsed` |
| `tagController.updateAsinTags` / `bulkUpdateTags` / `bulkUpdateTagsCSV` | `PUT /:asinId/tags`, `POST /bulk-tags`, `/tags/bulk` | rewrites tags on any ASIN, writes `TagsHistory` |
| `recalculateLqs` :2384 | `POST /recalculate-lqs` | when `ids` are supplied, recomputes and writes LQS for any ASIN (correctly scoped only in the "no ids" branch) |

- **Effect:** the roles that hold these permissions are exactly the seller-scoped ones (`brand_manager`, `catalog_manager`, `listing_team`), so cross-seller read and write is available to ordinary business users by changing an id or a `sellerId`.
- **Fix:** route body-carried sellers through `resolveSellerScope` (403 on `denied`) and give every id-based handler the same pattern `getAsin` uses — load the row, compare `SellerId` to scope, 403 — or centralise it in a `loadAsinInScope(req, id)` helper.

### F3 🔴 `checkSellerAccess` is blind to request bodies

`middleware/auth.js:206-222` derives the seller from `params.id || params.sellerId || query.sellerId`. Every ASIN route that carries the seller in the body (`POST /`, `/bulk`, `/match`, `/import-csv`, `/bulk-upload-all-sellers`, `/upload-raw`) therefore passes the check unconditionally — the middleware *looks* like protection on `/bulk` (`asinRoutes.js:70`) but is a no-op there. `POST /` is saved only by `createAsin`'s own check.
**Fix:** read `req.body?.sellerId` as a last resort (and make the middleware fail closed when a route declares it needs a seller), or stop putting a seller in the body.

### F4 🔴 `POST /asins/bulk` cannot attribute ASINs to a seller

- Callers nest the seller per item: `AsinManagerPage.jsx:1327-1331` (`sellerId: selectedSellerId`), `SellerAsinsModal.jsx:240-244` (`seller: seller._id`), `OnboardingWizard.jsx:75-79` (`seller: createdSeller._id`). `asinApi.createBulk` (`api.js:319`) posts `{asins}` only.
- Server: `createAsins` :2259-2296 destructures `const { asins, sellerId } = req.body` → **`sellerId` is `undefined`** → node-mssql coerces it to `NULL` (`mssql@12.7.2 lib/base/request.js:132`, verified in the published tarball) → `INSERT INTO Asins (… SellerId …) VALUES (… @sellerId …)`.
- **Effect:** either the insert fails (if `Asins.SellerId` is `NOT NULL`) and the "Add ASINs" flow reports a 500, or the rows land with no seller and are invisible to the list query (which `JOIN Sellers`). `updateSellerAsinCount(undefined)` is a no-op, so no socket refresh either, and the handler returns `{ success, createdCount }` (:2288) while `SellerAsinsModal` reads `insertedCount`/`duplicatesCount` — fields this endpoint never returns.
- **Fix:** read `sellerId` from each item (accept `sellerId || seller`), verify it against `resolveSellerScope`, default `Marketplace`, return `{insertedCount, duplicatesCount}`, and add the same post-insert side effects as `createAsin`.

### F5 🟠 The list request is 10 statements, two of which are unbounded scans

`asinController.js:470-560` and `:530-560` (queries 7 and 10 above): `SELECT DISTINCT FORMAT(Date,'yyyy-MM') FROM GmsDailyPerformance` and `SELECT DISTINCT TOP 7 Date FROM AsinHistory` run on **every** page/search/sort/filter change, with no WHERE. On a production GMS table this is the module's dominant cost; the second also exposes tenant-wide activity dates to scoped users.
**Fix:** cache the months list (it changes monthly), constrain the dates query to the user's seller scope with a bounded window, add covering indexes for the GMS/revenue joins, and drop query #2 (the raw count) or fold it into the first with `SUM(CASE …)`. The two scans are `asinController.js:534-539` (months) and `:888-893` (last-7-dates).

### F6 🟠 `pagination.total` is the unfiltered count

`getAsins` computes the filtered `total` (:402-407) and then responds with `total: rawTotal` (:909, and :489 on the empty-page branch), where `rawTotal` deliberately ignores every filter except seller/marketplace. The page uses `pagination.total` in the header subtitle ("Managing N ASINs", `AsinManagerPage.jsx:119`) and for the pager, so any active filter shows the wrong total and wrong page count.
**Fix:** return the filtered count (and, if the header needs it, a separate `scopeTotal`).

### F7 🟠 Three LQS implementations

| Implementation | Used by | Algorithm |
|---|---|---|
| `backend/utils/lqs.js` | `recalculateLqs`, `asinDataParser` | `calculateLQS({titleLength, hasAplus, bulletCount, imageCount, descriptionLength, hasEbc, price, rating, reviews})` + `getGrade` |
| `backend/services/listingQualityService.js:11-70` | live sync, market sync, `/api/listing-quality/*` | weighted `titleAnalyzer*0.30 + bulletPoints*0.25 + images*0.25 + description*0.20`, writes `TitleScore/BulletScore/ImageScore/DescriptionScore` + grades |
| `src/utils/lqs.js` | imported by `AsinManagerPage.jsx:17` | subtractive heuristic from 100 using different inputs (`imagesCSV`, `mrp`, …) |

The three produce different numbers for the same ASIN, and the stored `LQS`/`LQSGrade` therefore depends on which writer ran last.
**Fix:** pick the analyzer-based service as canonical, expose one shared scoring contract, and delete the other two (the frontend should display the server value).

### F8 🟠 `POST /recalculate-lqs` writes degraded values and erases component scores

`:2390` selects `Id, Title, BulletPoints, ImagesUrls, HasAplus, Category, SellerId`, then computes `LQS.calculateLQS({ …, price: asin.CurrentPrice, rating: asin.Rating, reviews: asin.ReviewCount })` — **none of those three columns were selected**, so price/rating/reviews are always 0 → the score is computed from an incomplete input set. The `UPDATE` then writes `TitleScore = 0, BulletScore = 0, ImageScore = 0, DescriptionScore = 0` (:2449-2452), destroying the analyzer output written by `listingQualityService`. With `ids` supplied there is no scope check (F2).
**Fix:** select the columns the scorer consumes (or reuse `listingQualityService.analyzeAndSaveFull` per ASIN), stop zeroing component scores, and add the scope guard. Add a regression test that asserts a recalculated row keeps non-zero component scores.

### F9 🟠 No tests

`backend/__tests__` has 11 suites (ads, keyword, pems, dashboard, event store, workflow, market-data parser, nvidia). **None** references `asinController`, `tagController`, `listingQualityService`, `autoTagService`, `asinDataParser` or `/api/asins`. The frontend has Playwright specs for auth and mobile nav only. There is no fixture, no contract test, and no test that would have caught F4 or F8.
**Fix:** start with the four highest-value suites (see §13). Even route-level tests using the existing `supertest` pattern would cover the scope matrix in F1/F2.

### F10 🟡 `SubBsrHistory` has no writer

Read by `GET /:id/subbsr-trend` (:3229), `getAsins` (:527), `sellerController` (:709) and rendered as a trend column (`COLUMN_CATEGORIES` → *Rankings/Sub BSR*). `grep` for `INSERT|MERGE|UPDATE … SubBsrHistory` across the repo returns nothing; the only reference to the table outside readers is migration 020, which creates it.
**Effect:** the Sub-BSR trend is permanently empty (or hand-populated).
**Fix:** either add the writer in the ingestion path (the scrapers already capture `SubBsr`/`SubBSRCategory`) or remove the table, endpoints and column.

### F11 🟡 Duplicated handlers and dead code inside the module

- `asinController` also exports tag handlers (`updateAsinTags`, `getAllTags`, `downloadTagsTemplate`, `bulkUploadTags`, `updateTags`, `getTags`) that `asinRoutes.js` does **not** use — the routes point at `tagController`. Two implementations of the same behaviour, one of them untested and unreachable.
- `uploadRawText` (:2605) is an unreferenced near-duplicate of `uploadRawAsins` (:2539).
- `getAsinsByLQS`, `getAllAsinsWithHistory`, `getAsinsBySeller` are one-line re-entries into `getAsins`.
- `getParentView`'s `ParentGmsMonthly` CTE is computed and never selected; the monthly data is fetched again by a second query.
- `runAutoTags` and the daily cron both run the same tenant-wide recompute.
**Fix:** delete the unreachable exports after a usage check, and let routes reference one tag implementation.

### F12 🟡 Stats cache is invalidated far too aggressively

`clearAsinStatsCache()` clears the **entire** per-user stats map (and the seller cache) and is called from `updateSellerAsinCount` — i.e. on every create, update-with-status-change, import, delete and repair — plus directly in `updateAsin`. A 5,000-row import therefore clears it thousands of times. The cache key already includes `userId` + `assignedSellers`, so per-scope invalidation is available.
**Fix:** invalidate by seller scope (`clearAsinStatsCache(sellerId)`) and skip repeated clears inside a batch (`clearAsinStatsCache(undefined, {defer:true})` at import start/end).

### F13 🟡 Week-history semantics differ from daily history

Daily history uses `CAST(dbo.GetEnvDate() AS DATE)` (DB clock) while `updateWeekHistory`/`bulkUpdateWeekHistory` use JS `new Date().setHours(0,0,0,0)` (server local time) and `sql.DateTime`; week labels are then derived on the server as `W{ceil(dayOfMonth / 7)}` (`asinController.js:584`, `:1117`) — not an ISO week — and the frontend groups rows by that label (`src/utils/asinHistory.jsx:6`), although a correct ISO `getWeekNumber` helper exists and is unused for labels.
**Fix:** compute the bucket in SQL (`DATEPART(iso_week, …)`) or send the DB-generated key, and store UTC-consistent dates.

### F14 🔵 Frontend weight and render cost

`AsinManagerPage.jsx` is a 4,332-line component holding dashboard, filter bar, table, parent view and 30+ handlers; the table is a raw `<table>` (:2580) rendered for all visible rows (default page size 25) with **no virtualisation**, up to 39 columns, and trend columns that fan out into one sub-cell per day (7) or per month (up to 12) — thousands of DOM nodes per page, with inline style objects. Eight lazy modals plus MUI's `TablePagination` are pulled into an otherwise antd page (9 `lazy()` imports). Row identity is by `_id`; selection state is a `Set` re-created on each toggle.
**Fix:** extract the table into its own memoised component (row-level `React.memo`), cap the expanded trend sub-columns, virtualise when the visible column count or row count exceeds a threshold, and move inline styles into the existing CSS module.

### F15 🔵 Import performance and silent skips

- `importFromCsv`/`bulkUploadAllSellers`: 2-3 sequential statements per row inside one transaction; a 10 MB XLSX (the multer ceiling) can be tens of thousands of rows → long transactions and lock time on `Asins`/`AsinHistory`.
- `bulkUploadAllSellers` matches sellers by **name string** and quietly records unmatched rows in an `errors` array that is only surfaced in the response body.
- `uploadRawAsins` → `asinDataParser.bulkUpsertAsins` loops one `MERGE` per row, with no batching and no transaction.
**Fix:** chunk into batched `MERGE`/table-valued inserts (the ads importer already demonstrates the pattern), report unmatched sellers as a blocking warning, and stream the export instead of serialising an in-memory workbook.

---

## 10. Performance summary (static estimate)

| Path | Statements | Unbounded work |
|---|---|---|
| `GET /asins` (page) | 10 | months scan (GMS), `TOP 7 Date` scan (AsinHistory), week history, correlated orders subquery per row |
| `GET /asins/stats` | 5 + nested CTE | `ParentAgg` over the scoped catalogue; cached 60 s |
| `GET /asins/parent-view` | 2 heavy CTE queries + JS sort/paginate | GMS aggregation for all parents, all time |
| `GET /asins/:id` | 1 (`SELECT a.*`) | 12 JSON parses + ~100-field mapping |
| `POST /asins/import-csv` | 2-3 × rows | one transaction for the whole file |
| `GET /asins/full-export` | 1 (≤200 k rows) | full XLSX built in memory |

The module is *not* structurally slow like the pre-upgrade ads module (it paginates and binds parameters), but it pays three fixed costs per list request — an unbounded months aggregation, an unbounded global date query, and per-row correlated order sums — and it writes far too much per row in JS.

---

## 11. Test coverage

| Suite | Covers ASIN Manager? |
|---|---|
| `adsRoutes`, `adsModule` | no |
| `dashboardAccess`, `dashboardTopAsins` | reads `Asins` indirectly through the dashboard |
| `keywordRoutes`, `keywordModule` | reads `Asins` for catalogue matching |
| `pemsInstances`, `tasksRoute`, `pemsPolicy`, `recurrenceService`, `workflowEngine`, `eventStore`, `marketDataParser`, `nvidiaAiService`, `serverRouteOrder` | no |
| Frontend Playwright (`tests/auth`, `tests/mobile-nav.spec.js`) | no |

Consequently every finding above is unguarded by tests, including the two that break core flows (F4 bulk add, F8 LQS recalculation).

---

## 12. Fix plan

**Phase 0 — close the holes (hours, no product change)**
1. Delete `asinTableRoutes`/`asinTableController`/`asinTableService` + the `app.use('/api/asins-table', …)` mount (**F1**) *or* add permission + scope; either way add a route test.
2. Extend `checkSellerAccess` to consider the body (fail-closed) and apply `resolveSellerScope` to the body-seller routes: `import-csv`, `bulk-upload-all-sellers`, `upload-raw`, `match`, `bulk-update`, `bulk-week-history`, `week-history` (**F2**, **F3**).
3. Add `loadAsinInScope(req, id)` and use it in `getAsinTrends`, `getSubBsrTrend`, `getParentChildren`, `updateWeekHistory`, `updateAsinTags`, `bulkUpdateTagsCSV`, `recalculateLqs(ids)` (**F2**).
4. Fix `createAsins` to read the per-item seller, validate it, and return the fields the UI expects (**F4**).

**Phase 1 — correctness**
5. Return the filtered total as `pagination.total`; add `scopeTotal` for the header (**F6**).
6. Rebuild `recalculateLqs` on `listingQualityService.analyzeAndSaveFull`, stop zeroing component scores, add a score-invariance test (**F8**); then collapse to one LQS implementation (**F7**).
7. Constrain the two unbounded list queries and cache the month list (**F5**); make the last-7-dates query respect scope.
8. Decide the Sub-BSR story: writer or removal (**F10**), and delete the unreachable duplicate exports (**F11**).

**Phase 2 — cost & clarity**
9. Batch/stream the imports and raw uploads; report unmatched sellers loudly (**F15**).
10. Per-scope stats invalidation (**F12**); ISO-week keys from SQL (**F13**).
11. Split `AsinManagerPage.jsx` (table + filters + parent view + modals), memoise rows, virtualise (**F14**).
12. Migrations for `Asins`/`AsinHistory`/`AsinWeekHistory` so a fresh environment can be provisioned.

---

## 13. Test plan (concrete first assertions)

1. **Scope matrix (`backend/__tests__/routes/asinScope.test.js`)** — for each route in §2.2 marked ❌, a scoped user passing a foreign seller/ASIN id must receive 403 and zero rows: `/trends`, `/subbsr-trend`, `/parent-view/children/:parentAsin`, `/match`, `/bulk-update`, `/:id/week-history`, `/bulk-week-history`, `/import-csv`, `/bulk-upload-all-sellers`, `/upload-raw`, `/full-export`, `PUT /:asinId/tags`, `/recalculate-lqs`.
2. **`/api/asins-table`** — no token → 401; token without `asinmanager_view` → 403; scoped user with `sellerId=other` → 403 (or the route is gone).
3. **Bulk add (`asinBulkCreate.test.js`)** — post three items each with `sellerId`, assert three rows carry that seller, `insertedCount` is returned, duplicate ASINs are counted not thrown, and a foreign seller yields 403.
4. **LQS invariance** — insert an ASIN with known title/bullets/images/description, run `POST /recalculate-lqs`, assert the score equals `listingQualityService` output and that `TitleScore/BulletScore/ImageScore/DescriptionScore` remain non-zero.
5. **List contract** — with `status=Active` on a mixed fixture, `pagination.total` equals the filtered count; `GET /asins/all` never exceeds the documented cap; sort allow-list rejects `sortBy=Title;DROP`.
6. **Import** — CSV with an existing ASIN for seller A and a new one: exactly one update + one insert + one `AsinHistory` upsert each, counts returned, temp file removed; a scoped user importing into seller B gets 403.
7. **Parent view** — monthly map keys match the parent rows, and the second query is not run when the first CTE is unused (post-refactor assertion).

---

## 14. Open questions

1. **`/api/asins-table`** — is it referenced by anything outside this repo (mobile app, script, partner)? If not, delete it; if yes, scope it before the next release.
2. **Is `Asins.SellerId` nullable?** That decides whether F4 currently produces orphan rows or hard failures — and whether existing production data already contains unattributed ASINs.
3. **Sub-BSR**: should the scrapers start writing `SubBsrHistory` (the data is already collected in `SubBsr`/`SubBSRCategory`), or is the trend feature being retired?
4. **Which LQS is authoritative** for reporting and client conversations — the analyzer-weighted service or the legacy `utils/lqs.js`?
5. **Week buckets**: which day starts a week for the business (calendar ISO week vs "last 7 days" rolling window the UI currently implies)?
6. **Seller attribution in bulk flows**: should `POST /bulk` accept a single `sellerId` for the batch (and the per-item field be ignored), or per-item sellers in one request?
7. **Data volume**: how many ASINs per seller, and how many rows in `GmsDailyPerformance`/`AsinHistory`, to size F5's index and caching work?

---

## Appendix A — inventory metrics (this commit)

| Metric | Value |
|---|---|
| Frontend ASIN files / lines | 14 / 11,150 |
| Largest frontend file | `src/pages/AsinManagerPage.jsx` — 4,332 lines |
| Backend ASIN files / lines | 12 / 5,667 |
| Largest backend file | `backend/controllers/asinController.js` — 3,702 lines, 42 exports |
| Routes | 45 in `asinRoutes.js` + 1 in `asinTableRoutes.js` |
| Client methods | `asinApi` — 35 |
| Columns exposed in the table | 39 visible (46 defined; 7 LQS/CDQ entries commented out) across 8 categories |
| Socket events consumed by the page | 9 |
| Files writing `Asins` | 20 |
| Routes with no seller-scope check | 21 of 46 (see §2.2), plus one partially scoped (`recalculate-lqs`) |
| Tests covering the module | 0 |

## Appendix B — reproducing this analysis

```bash
# inventory
find src -iname '*asin*' | xargs wc -l | sort -rn
find backend -iname '*asin*' -not -path '*/node_modules/*' | xargs wc -l | sort -rn

# routes + permissions
grep -n "^router\." backend/routes/asinRoutes.js

# exports census (function name, line span, scope flags, SQL verbs)
python3 - <<'PY'
import re
lines = open('backend/controllers/asinController.js').read().split('\n')
starts = [(i, m.group(1)) for i, l in enumerate(lines) if (m := re.match(r'exports\.(\w+)\s*=', l))]
starts.append((len(lines), 'END'))
for (i, n), (j, _) in zip(starts, starts[1:]):
    body = '\n'.join(lines[i:j])
    print(f"{n:<28}{j-i:>6}  {'scoped' if 'assignedSellers' in body else 'NO-SCOPE'}")
PY

# who writes the core table
grep -rn "INSERT INTO Asins\|UPDATE Asins\|MERGE INTO Asins" backend --include=*.js | grep -v __tests__

# tables with readers but no writers
grep -rn "SubBsrHistory" backend --include=*.js | grep -iE "insert|merge|update"
```
