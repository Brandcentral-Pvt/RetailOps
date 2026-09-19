# Ads Manager Module — Deep Dive

**Date:** 2026-09-19
**Commit analysed:** `36252a6` (plus working-tree state on `arena/01a0b907-retailops`)
**Companion doc:** [`project-analysis.md`](./project-analysis.md) (whole-project + recent-changes analysis)
**Method:** full read of every ads-related file, plus **executable probes** — the controller was driven through a mocked MSSQL pool (`backend/testUtils/fakePool.js` pattern) to capture the exact SQL it builds, the parameters it binds, the payload it returns, and its CPU cost. Probe scripts: `/tmp/adsprobe/{probe,probe2,probe3,perf}.cjs` (throwaway, not committed). Nothing was run against a live database.

---

## 1. Executive summary

The Ads module is one of the **most complete feature areas** in RetailOps — ingestion, storage, aggregation, seven UI surfaces, background export, and AI-ish insight widgets — and it is **the least protected and least tested**. It is also **faster to break than any other module**: three of its defects are exploitable or user-visible today, and two are unrecoverable at scale.

**Ranked result of the dive:**

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | **No seller scoping on any ads read endpoint** — any user with `adsreport_view` can read (and filter by) *any* seller's ad data. Proven with a probe. | 🔴 P0 (broken access control) | Live |
| F2 | **`POST /api/export/start-ads` has no permission check at all** — any authenticated user can export the full ads dataset, all sellers, regardless of role/seller assignment. Plus the export is not filtered to `ReportType='daily'`, so **the file does not match the screen**. | 🔴 P0 (privilege escalation + wrong data) | Live |
| F3 | **Pagination is wired on the server and never switched on by the client** → every Ads Manager load fetches *all* matching ASIN groups + their full daily history, then filters it in JS. Measured: **30.3 s of blocking CPU** for 2,000 ASINs × 180 days; and >2,100 ASINs makes the history statement exceed SQL Server's 2,100-parameter limit → HTTP 500. | 🔴 P0 (availability) | Live |
| F4 | **"Executive KPIs" and "Insights" are computed from whatever page the table returned**, not the filtered scope; the scope-wide aggregates the backend *does* compute (`scope.topSpenders` / `wasteCount` / `organicWinsCount`) are fetched into hook state and **never rendered**. | 🟠 P1 (misleading numbers) | Live |
| F5 | **Five filter controls are decorative** — Manager, Category, Brand, Campaign Status, Performance are rendered but never sent to the API (Performance has no handler at all). | 🟠 P1 (UI lies) | Live |
| F6 | **Exported downloads never appear in the Downloads drawer** — `exportAdsController` stores `req.user.id`, but the auth middleware only sets `req.user.Id` / `req.user._id` → `UserId = NULL`; `getDownloads` filters by `_id`. | 🟠 P1 | Live |
| F7 | **Payload bloat**: `history` and `weekHistory` are the *same array* serialized twice per row; `monthlyStats` (with its own GmsTargets query) is computed for every row × every month and **is never read by any frontend file**; legacy `adsTarget`/`acosTarget` nulls still ship. | 🟠 P1 (cost) | Live |
| F8 | **No tests.** Zero ads-specific tests in `backend/__tests__` or `tests/`. The route-order/dashboard suites only touch ads incidentally. | 🟠 P1 | Live |
| F9 | **Upload path is unprotected and permissive**: `/upload/upload-ads` requires only `authenticate` (no permission, no seller check), accepts up to **200 MB**, and any authenticated user can upload rows against any seller. | 🟠 P1 | Live |
| F10 | **Day-key semantics differ between writer and readers** — the importer derives keys with `Date.UTC(...)`/`toISOString()` while the rest of the platform uses local (`Asia/Kolkata`) day keys via `dbo.GetEnvDate()`; the dashboard’s identical class of bug was fixed in #64, the ads path was not. | 🟡 P2 (data correctness) | Live |
| F11 | **Four different ads aggregations disagree**: dashboard (`ReportType='daily'`, GMS-joined), manager (`ReportType='daily'`), report (daily, JS-side), export (**no** ReportType filter). Same question, four answers. | 🟡 P2 | Live |
| F12 | **Dead code around the module**: `AdsFilters.jsx` + `useAdsFilters.js` + `useAdsChart.js` unreferenced; `AdsReportsPage.jsx` orphaned (and its `ReportExport` expects a `downloadUrl` the API never returns); `dataController.getAdsPerformance` has **no route**. | 🟡 P2 | Live |
| F13 | **Index/join fit is partial**: `Asins.AsinCode` is never a leading index key although every ads query joins on it unfiltered; the two ads covering indexes don't include `PageViews`/`Sessions`/`Conversions`/`SameSkuSales` that the manager SELECTs. | 🟡 P2 (performance) | Live |
| F14 | Minor correctness smells: `countQuery` re-aggregates the whole set separately; leading-wildcard `LIKE '%search%'` on `Title`; `Math.floor` on decimal uploads; `MAX(a.X)` metadata picks an arbitrary row when an ASIN exists under multiple sellers. | 🔵 P3 | Live |

**One-line verdict:** the module's *server-side* capability is ahead of its *client wiring* and far ahead of its *authorisation* — the fixes are mostly small, but F1/F2/F3 have to be fixed in that order.

---

## 2. Module map

### 2.1 Files

| Layer | Path | Size | Role |
|---|---|---|---|
| Page (live) | `src/pages/AdsManagerPage.jsx` | 386 | Ads Manager — KPI strip, insights, filters, chart, table, import modal |
| Page (legacy) | `src/pages/AdsReport.jsx` | 996 | Ads Report — client-side aggregated report with compare mode |
| Page (orphan) | `src/pages/AdsReportsPage.jsx` | 112 | Nothing routes to it |
| Components | `src/components/ads/{ExecutiveKPIs,InsightPanel,AdsTable,AdsImportModal,AdsFilters}.jsx` | 193/166/358/320/185 | Only the first four are used; `AdsFilters` is dead |
| Components | `src/components/ads/reports/{ReportSummary,ReportCharts,MarketplaceComparison,ReportExport}.jsx` | 116/146/123/98 | Only reachable from the orphan page |
| Hooks | `src/hooks/useAdsData.js` / `useAdsChart.js` / `useAdsFilters.js` | 157/136/94 | `useAdsData` is live; the other two are dead |
| API client | `src/services/api.js` → `adsApi` (l.1879-1894) | — | `getAdsManagerData`, `exportAdsManagerData` (undefined/null/'' params stripped) |
| Routes | `backend/routes/dataRoutes.js` (l.12-13), `exportRoutes.js` (l.15), `uploadRoutes.js` (l.47,49) | — | 5 ads-touching endpoints |
| Controllers | `backend/controllers/dataController.js` (`getAdsReport` l.63, `getAdsManagerData` l.685, `getAdsPerformance` l.1062 — unrouted) | 1152 | All ads reads |
| Controllers | `backend/controllers/exportAdsController.js` | 177 | Background export job |
| Controllers | `backend/controllers/uploadController.js` (`uploadAdsData` l.177) | 929 | XLSX/CSV → temp table → MERGE |
| Other readers | `dashboardController.js` (§ads, l.218/335/343), `targetController.js`, `alertService.js`, `revenueService.js`, `goalService.js`, `dataAggregationEngine.js` | — | Consume `AdsPerformance` without going through this module |

### 2.2 Endpoints

| Method | Path | Middleware | Seller check? | Permission |
|---|---|---|---|---|
| GET | `/api/data/ads-manager` | `authenticate`, `requirePermission('adsreport_view')` | ❌ none | `adsreport_view` |
| GET | `/api/data/ads-report` | `authenticate`, `requirePermission('adsreport_view')` | ❌ none | `adsreport_view` |
| POST | `/api/export/start-ads` | `authenticate` only | ❌ none | **none** |
| POST | `/api/upload/upload-ads` | `authenticate` only (+ multer 200 MB) | ❌ none | **none** |
| GET | `/api/upload/upload-stats` | `authenticate` | n/a (MonthlyPerformance, not ads) | none |

Frontend gating: `/ads-manager` and `/ads-report` are `ProtectedRoute permission="adsreport_view"` (`src/App.jsx:137,140`); the sidebar shows Ads Manager for `adsreport_view` or admin/global roles (`src/hooks/useNavigationItems.js:103-107`). `adsreport_view` is defined in the permission catalogue (`roleController.js:290`).

### 2.3 Storage

* **Table:** `AdsPerformance` — **37 columns** (35 written by the importer + `Id`, `UploadedAt`), see `dotnet/RetailOps.Domain/Entities/AdsPerformance.cs` (no `CREATE TABLE` migration exists; the .NET entity is the de-facto schema reference).
* **Key semantics:** unique-ish per (`Asin`,`Date`,`ReportType='daily'`) or (`Asin`,`Month`,`ReportType='monthly'`); enforced only by the `MERGE … WITH (HOLDLOCK)` in the importer — **there is no unique constraint or index backing that key**.
* **Indexes:** `IX_AdsPerformance_Asin_Date_Covering` (`Asin`,`Date DESC`; includes AdSales, AdSpend, Orders, OrganicSales, Impressions, Clicks, ReportType) from migration `008`; `IX_AdsPerformance_Date_ReportType_Covering` (`Date`,`ReportType`; includes Asin, AdSales, AdSpend, Orders, OrganicSales, Impressions, Clicks) from migration `024`.
* **Joins:** every ads query `LEFT JOIN Asins a ON p.Asin = a.AsinCode` — `Asins.AsinCode` is **not** a leading key in any Asins index (they lead with `SellerId`/`Category`), so the unfiltered join cannot seek.

---

## 3. Data flow — read path (Ads Manager, live)

```
AdsManagerPage (state: groupBy, searchQuery, selectedSeller, date range, sortBy/sortOrder)
   │  l.136 handleRefresh + l.140 useEffect → fetchData({ groupBy, search, sellerId, startDate, endDate, sortBy, sortOrder })
   │  l.144 debouncedFetch(same params)                  (300 ms debounce on filter changes)
   ▼
useAdsData.fetchData                                     src/hooks/useAdsData.js:44
   │  params.paginated is never set by the page → page/limit/includeScope are NOT added (l.68-74)
   │  GET /api/data/ads-manager?groupBy=…&sellerId=…&startDate=…&endDate=…&sortBy=…&sortOrder=…
   ▼
dataController.getAdsManagerData                         backend/controllers/dataController.js:685-1027
   │  whereClause = ReportType='daily' + date window (default last 30 d via DATEADD(day,-30,dbo.GetEnvDate()))
   │               + optional search LIKE / sellerId = @sellerId        ← no user context consulted
   │  1) global chart      : SUM(...) GROUP BY CONVERT(varchar, Date, 23)
   │  2) count             : COUNT(DISTINCT p.Asin | ISNULL(ParentAsin,Asin))   ← second full aggregation
   │  3) paged aggregation : GROUP BY groupKey, ORDER BY <whitelisted metric> [+ OFFSET/FETCH **only if limit was sent**]
   │  4) history           : GROUP BY groupKey, Date WHERE groupKey IN (@gk_0…@gk_n)   ← n = every returned row
   │     └ targets         : GmsTargets/GmsTargetBreakdowns (GoalType IN ('ADS','ACOS')) → monthlyStats
   │  5) scope (opt-in)    : TOP 5 spenders, wasteCount, organicWinsCount   ← only when includeScope=1
   ▼
response { success, total, page, limit, data[], scope, globalChartData[] }
   │  each row: 25 scalar metrics + monthlyStats + history + weekHistory (same array) + adsTarget:null + acosTarget:null
   ▼
AdsManagerPage renders:
   ExecutiveKPIs data={data}      ← page-scoped, not scope-scoped
   InsightPanel data={data}       ← page-scoped
   Chart      globalChartData     ← correct (whole filtered window)
   AdsTable   data={paginatedData} (= data, unsliced) + MUI TablePagination(count=total)
```

**What the probe showed for the page's actual first request** (`groupBy=asin`, 30-day window, no `limit`):

```
row count returned : all matching groups (no server-side page)
OFFSET/FETCH present in paginated query : false
server-side scoping to the caller's assigned sellers : false
ReportType filter applied : true
queries executed : 3   (6 when includeScope=1)
```

With `limit=50&page=2&includeScope=1` sent instead, the same endpoint produces `OFFSET 50 ROWS FETCH NEXT 50 ROWS ONLY` plus a populated `scope` object — **the server-side implementation is correct; only the client never asks for it.**

### 3.1 Measured cost of the broken pagination (pure Node CPU, DB excluded)

| ASIN groups | Window | History rows fetched | Rows returned | Controller CPU |
|---:|---:|---:|---:|---:|
| 200 | 90 d | 18,000 | 200 | 84 ms |
| 500 | 90 d | 45,000 | 500 | 806 ms |
| 1,000 | 90 d | 90,000 | 1,000 | 1.47 s |
| 2,000 | 180 d | 360,000 | 2,000 | **30.3 s** |

Two causes, both in the response-builder: `pagedRows.map(row => historyRows.filter(h => h.groupKey === row.groupKey))` (O(rows × history)) and `historyMonths.forEach(… history.filter …)` per row. Parameter ceiling: at 2,500 groups the history statement binds **2,501 parameters** in one batch — SQL Server's limit is 2,100 → driver error → HTTP 500.

---

## 4. Data flow — read path (Ads Report, legacy)

`AdsReport.jsx` calls `GET /api/data/ads-report` (twice when compare mode is on: current window + previous window) and receives **four** datasets: `data` (per-ASIN totals), `hierarchicalData` (parent rollups), `dailyData` (per-day totals) **and `allDailyRows`** — the latter being every raw `AdsPerformance` row for the window, `SELECT p.*` plus asin metadata, `ORDER BY p.Date DESC`. There is no `TOP`, no paging, and the aggregation for `data`/`hierarchicalData`/`dailyData` happens in JS after the fact (`dataController.js:63-275`). The page then paginates client-side (`TABLE_PAGE_SIZE`, `AdsReport.jsx:411`).

Consequences: a 12-month, all-seller window ships the entire fact table to the browser twice (current + previous) and re-derives every KPI in JS; the server does the same work for a request that only needs one number. This is the same anti-pattern as the Ads Manager history query, one level worse (no aggregation at all in SQL).

---

## 5. Data flow — write path (import)

```
AdsImportModal (or AdsReport.jsx l.464)
  │  POST /upload/upload-ads   multipart: file, date (required), marketplace, sellerId?
  │  route: authenticate only; multer 200 MB; mime/ext allow-list (csv, xlsx, xls, json)
  ▼
uploadController.uploadAdsData (l.177-450)
  │  1. XLSX.readFile → sheet_to_json
  │  2. 35-column spec; CREATE TABLE ##TempAds_<ts>_<rand> (NVARCHAR(MAX) fallbacks)
  │  3. per row: header alias lookup (findValue) → parseNum (strip ₹/,/%/) → Math.floor on ints
  │  4. dedupe in a Map keyed `${asin}|${reportType}|${toISOString-or-UTC-month}` ("last wins")
  │  5. pool.request().bulk(table)  (server-side bulk copy into the global temp table)
  │  6. auto-heal: INSERT skeleton Asins rows for unknown ASINs (sellerId inferred from the data,
  │     else the newest Seller row) — note: this writes to Asins from the ads flow
  │  7. MERGE AdsPerformance WITH (HOLDLOCK) … WHEN MATCHED UPDATE / WHEN NOT MATCHED INSERT
  │  8. UPDATE Asins SET Ads = 1 for advertised children + their parents
  │  9. DROP temp table, delete upload file
  ▼
{ success, processed, skipped, duplicatesCondensed, errors }
```

Correctly handled: multi-format/serial dates, currency symbols, alias headers, dedupe before insert, atomic MERGE, cleanup in `finally`, temp table name generated server-side (not injectable).

Gaps: no `ReportType` sent by any caller (so the `monthly` branch is unreachable from the UI), no server-side permission/seller check, `sellerId` is trusted from the request body, 200 MB uploads are parsed fully in memory (`sheet_to_json` on the whole file), and the date key uses UTC (`parseDate` returns `Date.UTC(...)`; month keys use `Date.UTC(y, m, 1)`; composite keys use `toISOString()`), while the rest of the platform stores local-day keys.

---

## 6. Data flow — export path

```
ReportExport (orphan page) → adsApi.exportAdsManagerData (api.js:1887) → POST /export/start-ads
  │  body: { sellerId, startDate, endDate, search, groupBy, format='xlsx' }
  ▼
startAdsExport (exportAdsController.js:40)
  │  userId = req.user ? req.user.id : 'system'      ← req.user has Id/_id, never .id → undefined → NULL
  │  INSERT Downloads (Id, UserId=NULL, …, Status='pending'); respond immediately
  ▼ (detached)
processAdsExportJob (l.71)
  │  whereClause = date window + optional search/sellerId  ← **no ReportType filter**
  │  GROUP BY Asin | COALESCE(ParentAsin, Asin)  → 11 columns
  │  ExcelJS workbook → uploads/exports/<id>_<name>.xlsx
  │  Downloads.Status: pending → processing(10/20/40/70) → completed(100) + SocketService.emitExportUpdate
  ▼
DownloadsDrawer → GET /export/downloads → WHERE UserId = @userId   ← never matches NULL rows
```

So: the export can be triggered by anyone, silently aggregates daily **and** monthly rows together (inflating Spend/Sales versus the Manager screen, which filters `ReportType='daily'`), and the finished file is invisible to the very user who requested it. `ReportExport` additionally expects `{ downloadUrl }` in the response, which the API does not return (`{ downloadId, message }`) — dead code, but a good illustration that this surface was never exercised end-to-end.

---

## 7. Findings in detail

### F1 🔴 No seller scoping on ads reads (broken access control)
*Evidence:* `dataRoutes.js:12-13` attach only `authenticate` + `requirePermission('adsreport_view')`; there is **no `checkSellerAccess`** and `dataController.js` contains **zero `req.user` references** (grep). Probe: a `brand_manager` whose `assignedSellers = ['seller-A']` requesting `?sellerId=seller-B` gets **HTTP 200 with seller-B rows**; omitting `sellerId` returns every seller's data.
*Contrast:* the same codebase already has the correct pattern — `dashboardController.getDashboardData` intersects requested ids with `req.user.assignedSellers` before binding `@dashSeller_*` (`dashboardController.js:46-80`), and `middleware/auth.js:206 checkSellerAccess` exists (used by `asinRoutes`); `targetController` has its own scoped helper.
*Compounding:* `AdsManagerPage` seeds its seller filter from `localStorage.getItem('selectedSeller')` — a key **shared with `AsinManagerPage`** — so a seller selected elsewhere silently becomes the ads filter.
*Fix:* in `getAdsManagerData`/`getAdsReport` (and the export), compute `allowedSellers = req.user.assignedSellers` (bypass for global roles), intersect with the requested `sellerId`, bind `a.SellerId IN (@sellerScope_i…)`, and 403 when an explicit request is outside the allow-list. Mirror the dashboard helper so there is one implementation.

### F2 🔴 Export endpoint: no permission check, wrong data, invisible result
*Evidence:* `exportRoutes.js:15` = `router.post('/start-ads', auth, startAdsExport)` — no `requirePermission`; `processAdsExportJob` builds `whereClause` without `ReportType` (l.78-96), unlike every read path; `userId = req.user.id` (l.31) is `undefined` because `auth.js` sets `req.user.Id` / `req.user._id` only (mssql converts `undefined` → `NULL`, so the `Downloads` row is written with `UserId = NULL`), while `getDownloads` filters `WHERE UserId = @userId` with `req.user._id` (`exportController.js:1017`).
*Fix:* add `requirePermission('adsreport_view')` + seller allow-list; filter `p.ReportType = @reportType` (default `daily`); use `req.user._id || req.user.Id` (and add `id` to the auth user object for compatibility); verify the file lands by testing the drawer end-to-end.

### F3 🔴 Broken pagination → full scans, quadratic JS, 500s
*Evidence:* `useAdsData.js:68-74` adds `page`/`limit`/`includeScope` **only if `params.paginated`**; `AdsManagerPage` never passes it (only callers are `l.137`, `l.140`, `l.144`); therefore `limit` is absent → `hasLimit=false` → no `OFFSET/FETCH`; the table then shows all rows while the "Showing X of Y" label and the antd pagination offer a pager that changes `page` state which nothing consumes. Measurements in §3.1; parameter-ceiling proof (2,501 params at 2,500 groups) in §3.1.
*Fix (small):* always pass `paginated: true, page, pageSize` from the page (and refetch on page/pageSize change), keeping `includeScope=1` for the KPI strip. *Fix (proper):* move the per-row history/`monthlyStats` assembly into SQL (one `GROUP BY groupKey, Date` query joined on the page's keys only — it already is scoped, so this is mostly about not running it for unpaged sets), drop `monthlyStats` entirely (F7), and cap `IN` lists (chunk by 1,000) so the 2,100-parameter limit can never be hit.

### F4 🟠 KPIs and insights describe the wrong population
`<ExecutiveKPIs data={data} />` and `<InsightPanel data={data} />` receive the current page. Today, because pagination is off, they *accidentally* describe the full filtered set; the moment F3 is fixed they will silently describe 50 rows. Meanwhile the backend already computes exactly what they need (`scope.topSpenders`, `scope.wasteCount`, `scope.organicWinsCount`, gated at `dataController.js:959`) and `useAdsData` stores it in `scope` — no component reads it.

### F5 🟠 Five decorative filters
`selectedManager`, `selectedCategory`, `selectedBrand`, `selectedStatus` are `useState` values wired to `<Select onChange>` and never sent to the API; the "Performance" select has **no `onChange` at all**. Manager/Category/Brand data is fetched (users + all sellers) purely to populate no-op dropdowns.

### F6 🟠 Downloads invisible (see F2) — also affects the orphan `ReportExport` flow that expects `downloadUrl`.

### F7 🟠 Payload and CPU waste
`history` and `weekHistory` hold the same array (`dataController.js:950-951`) → every history row is serialized twice (~2× payload). `monthlyStats` (l.~905-925) is built per row per month with `.filter()` scans plus a `GmsTargets` query, and **no frontend file references `monthlyStats`** (grep over `src/`). `adsTarget`/`acosTarget` are hard-coded `null` with a "remove usage later" comment.

### F8 🟠 No tests
`backend/__tests__` has 11 suites, none ads-specific; `tests/` has 2 Playwright specs (auth, mobile nav). A regression harness is easy here: `testUtils/fakePool.js` + `jest.mock('../../database/db')` (the pattern used by `dashboardTopAsins.test.js`) is enough to assert the SQL contract (ReportType filter, seller allow-list binding, OFFSET/FETCH presence, `IN` chunking, response shape).

### F9 🟠 Unprotected, permissive ingestion
`uploadRoutes.js:47` = `authenticate` only; 200 MB limit; `sellerId` accepted from the body with no allow-list check; ASIN skeleton rows are **created** in `Asins` for unknown ASINs (with the seller inferred from the data or the newest seller row). The ads importer is therefore also a write path into the ASIN master table.

### F10 🟡 Day-key semantics
Importer keys: `parseDate` → `Date.UTC(...)`; month key `Date.UTC(y, m, 1)`; composite `toISOString().slice(0,10)`. Readers: `CONVERT(varchar, p.Date, 23)` over `Date` columns with the pool running `useUTC:false` and `TZ=Asia/Kolkata`, i.e. **local** day boundaries (the exact mismatch fixed for the dashboard in PR #64). An `.xlsx`/CSV whose date column is a plain string is parsed as UTC midnight, which under IST is the same calendar date — but Excel-serial and `Date`-typed values, and the dedupe/merge key, are computed in UTC; the month key can land on the previous day (e.g. `2026-03-01T00:00Z` → IST `2026-03-01 05:30`, fine) while `toISOString()` on a locally-constructed date can shift. This needs a single, tested day-key helper shared with the GMS path.

### F11 🟡 Four aggregations, four answers
| Consumer | ReportType filter | Seller scope | Window default | Notes |
|---|---|---|---|---|
| Dashboard (`dashboardController` §ads) | `'daily'` (l.218/343) | ✅ intersected allow-list | 30 d | GMS EXISTS-joined |
| Ads Manager (`getAdsManagerData`) | `'daily'` | ❌ | 30 d | full history payload |
| Ads Report (`getAdsReport`) | `'daily'` (param default) | ❌ | none (all data) | returns raw rows |
| Export (`processAdsExportJob`) | **none** | ❌ | 30 d | daily + monthly mixed |

### F12 🟡 Dead code (module-local)
`src/components/ads/AdsFilters.jsx` (185 ln), `src/hooks/useAdsFilters.js` (94), `src/hooks/useAdsChart.js` (136) — zero references; `src/pages/AdsReportsPage.jsx` + `src/components/ads/reports/*` — no route; `dataController.getAdsPerformance` (l.1062, `SELECT *` with no paging) — no route. `ReportExport.jsx` also awaits a `downloadUrl` the API never returns.

### F13 🟡 Index/join fit
`IX_AdsPerformance_Date_ReportType_Covering` is a good match for the manager's date+reportType filter, but the `LEFT JOIN Asins ON p.Asin = a.AsinCode` has no supporting index (no index leads with `AsinCode`), and the SELECT list (`PageViews`, `Sessions`, `Conversions`, `SameSkuSales`, budgets) is mostly outside both covering indexes → key lookups. Also **no unique index** enforces the (`Asin`,`Date`,`ReportType`) merge key.

### F14 🔵 Minor
Separate `COUNT(DISTINCT …)` aggregation (the paged query could carry a `COUNT(*) OVER ()`); `LIKE '%search%'` on `a.Title` (non-SARGable, expected for substring search but worth knowing); `Math.floor` applied to decimal metrics on import; `MAX(a.Sku)`, `MAX(a.SellerId)`, `MAX(a.Title)` pick an arbitrary row when an ASIN is tracked under two sellers (silent merge, same class of caveat flagged in PR #64 for GMS).

---

## 8. Fix plan

**Phase 1 — authorisation (hours, no UI risk)**
1. Add a shared `resolveSellerScope(user, requestedSellerId)` helper (extract from `dashboardController`) returning `{ isGlobal, sellerIds }`.
2. `getAdsManagerData` + `getAdsReport`: reject/ignore out-of-scope `sellerId`, and always apply `a.SellerId IN (…)` for non-global users.
3. `POST /export/start-ads`: add `requirePermission('adsreport_view')` + the same scope helper; add `ReportType` filter; fix `userId` (`req.user._id || req.user.Id`).
4. `POST /upload/upload-ads`: add `requirePermission('adsreport_manage'|'gms_tracker_import'` — pick one) + scope check on `sellerId`; consider lowering the 200 MB cap or streaming the parse.
5. Regression tests for each rule (fakePool harness; one test per endpoint asserting the bound seller params and 403 behaviour).

**Phase 2 — correctness of what the user sees**
6. Turn on server-side pagination in `AdsManagerPage` (`paginated: true`, refetch on `page`/`pageSize` change) and remove the misleading "Showing N of M" when unpaged.
7. Feed `ExecutiveKPIs` and `InsightPanel` from `scope` (+ `globalChartData` for sparklines) instead of the page; show "—" rather than 0 when scope is absent.
8. Either implement the five filters (Manager/Category/Brand/Status/Performance) server-side or delete them from the UI — no third option.
9. Normalise day keys: one `toDayKey()`/`parseLocalDate()` helper used by the importer, the manager and the dashboard (PR #64's helper is a good template).

**Phase 3 — performance**
10. Drop `monthlyStats` (unused) and stop duplicating `history` as `weekHistory`; return one array.
11. Chunk `IN` lists (`buildInClause` in batches ≤ 1,000) so the 2,100-parameter ceiling can't be hit.
12. Replace the O(rows × history) filter with a `Map` keyed by `groupKey` (one pass) — this alone turns the 30 s case into ~1 s.
13. Add `IX_Asins_AsinCode` (or make `AsinCode` the leading key of an existing index) and a unique index on `AdsPerformance(Asin, Date, ReportType)`.
14. Rework `getAdsReport` to aggregate in SQL (it currently ships `allDailyRows` raw); keep `allDailyRows` behind an explicit opt-in for the export/analysis UI.

**Phase 4 — hygiene**
15. Delete `AdsFilters.jsx`, `useAdsFilters.js`, `useAdsChart.js`, `AdsReportsPage.jsx`, `ads/reports/*` (or route them intentionally), and the unrouted `getAdsPerformance`.
16. Decide the future of `AdsReport.jsx` (996 ln) vs `AdsManagerPage.jsx` — two overlapping ads pages is how the four-aggregation problem (F11) started.

---

## 9. Test plan (concrete)

| Test | Asserts |
|---|---|
| `adsScope.test.js` (routes) | non-global user with `sellerId=other` → 403; no `sellerId` → only assigned sellers bound; global role unaffected |
| `adsManagerQuery.test.js` (unit, fakePool) | `ReportType` always bound; `OFFSET/FETCH` present iff `limit` sent; `includeScope=1` → exactly 3 extra queries; **no `monthlyStats`/`weekHistory` keys in the payload**; `IN` chunked at ≤1,000 |
| `adsExport.test.js` | permission enforced; `UserId` = caller id; SQL contains `ReportType`; job writes a row and emits progress |
| `adsUpload.test.js` | permission + seller check; MERGE clause matches the report type; dedupe keeps last row; unknown ASINs create skeleton rows only when authorised |
| `useAdsData.test.js` | page/pageSize changes trigger a refetch with `paginated: true` (this is the regression that caused F3) |

---

## 10. Open questions

1. **Who is allowed to see ads data?** Is `adsreport_view` meant to imply "all sellers" (as it does today) or is seller assignment supposed to constrain it, as it does on the dashboard? (F1's fix depends on the answer.)
2. **Who may import/export ads?** Is there an `adsreport_export`/`adsreport_manage` permission intended (`skureport_export` etc. exist, ads has only `_view`)?
3. **Should exported files include monthly report rows?** Today they do; the screen does not.
4. **Is the Ads Report page (`/ads-report`) still wanted?** If not, deleting it removes the heaviest query in the module.
5. **Does anything depend on `monthlyStats`/`weekHistory` outside `src/`** (mobile app, external consumer)? No references were found in this repo.
6. **Data volume in production:** how many ASINs × days does a typical 30-day ads query cover? That number decides whether F3 is "slow" or "down".
