# Ads Intelligence — Module Upgrade

**Date:** 2026-09-19
**Branch:** `arena/01a0b907-retailops`
**Preceded by:** [`ads-module-deep-dive.md`](./ads-module-deep-dive.md) (the audit this upgrade implements) and [`project-analysis.md`](./project-analysis.md)
**Scope approved by the user:** rebuild Ads Manager + absorb/retire Ads Report + add an AI Analyst view; fix the P0 findings (F1/F2/F3) and the dead-filter family (F5); AI = deterministic rules on every load **plus** an on-demand LLM review; review against real data (no demo mode).

---

## 1. What exists now

| Surface | Route | Was | Is |
|---|---|---|---|
| Ads Manager | `/ads-manager` | `src/pages/AdsManagerPage.jsx` (client-side everything) | `src/pages/ads/AdsManagerPage.jsx` — tabbed module (Performance / Efficiency / ASIN table / Report / AI Analyst) over one scoped API |
| Ads Report | `/ads-report` | `src/pages/AdsReport.jsx` (separate page, separate data path, different numbers) | **retired** — now a `<Navigate>` redirect to `/ads-manager`; its month-vs-target table lives in the Report tab of the same module |
| AI Analyst | — | ad-hoc `InsightPanel` widgets fed by whatever page of rows the table happened to hold | server-side rules engine (always on) + button-triggered LLM narrative grounded in the rule digest |

Navigation label changed **Ads Manager → Ads Intelligence** (`src/hooks/useNavigationItems.js`). Permission gate is unchanged (`adsreport_view`), so nobody gains or loses access.

### Files

**New (backend)**
- `backend/utils/sellerScope.js` — the single seller-authorisation primitive: `resolveSellerScope()`, `bindSellerFilter()`, `parseSellerIds()`.
- `backend/services/adsAnalytics.js` — every ads read query, all scoped and `ReportType`-pinned.
- `backend/services/adsInsights.js` — deterministic rules engine (pure functions, no network).
- `backend/services/adsAiService.js` — on-demand LLM narrative (digest → strict JSON → normaliser).
- `backend/controllers/adsController.js`, `backend/routes/adsRoutes.js` — the `/api/ads/*` surface.
- `backend/__tests__/unit/adsModule.test.js` (30 tests), `backend/__tests__/routes/adsRoutes.test.js` (16 tests), `backend/testUtils/adsFixtures.js` (shared fake-pool fixtures).

**New (frontend)**
- `src/pages/ads/AdsManagerPage.jsx` — module shell: filter bar, tabs, drill-downs, export/import.
- `src/pages/ads/panels.jsx` — KPI strip, trend, mix, movers, efficiency bands, targets, freshness, ASIN table, AI analyst, report, drill modal.
- `src/pages/ads/ads.css` — only the pieces opsCenter's stylesheet does not own (same CSS variables).
- `src/hooks/useAdsModule.js` — react-query hooks (one cache entry per filter set, `placeholderData` for pagination).

**Changed:** `src/services/api.js` (`adsApi` namespace with structured errors), `src/App.jsx` (routes + redirect), `backend/routes/exportRoutes.js`, `backend/routes/uploadRoutes.js`, `backend/controllers/exportAdsController.js`, `backend/controllers/uploadController.js`, `backend/controllers/roleController.js` (new permission), `backend/server.js` (`/api/ads` mount), `backend/testUtils/fakePool.js` (SQL type factories).

**Deleted (dead or superseded):** `src/pages/AdsManagerPage.jsx`, `src/pages/AdsReport.jsx`, `src/pages/AdsReportsPage.jsx`, `src/components/ads/{AdsFilters,AdsTable,ExecutiveKPIs,InsightPanel}.jsx`, `src/components/ads/reports/*`, `src/hooks/{useAdsData,useAdsChart,useAdsFilters}.js`. Kept: `src/components/ads/AdsImportModal.jsx` (reused by the new module).

---

## 2. Fixes, mapped to the audit

| Finding | Fix |
|---|---|
| **F1** no seller scoping anywhere | `resolveSellerScope()` runs before every query. Non-global user with no selection → filtered to their assigned sellers; explicit foreign seller → **403 `forbidden_seller`** (never a silent widen or narrow); no assignments → empty payload, no query. `bindSellerFilter()` is failure-closed (`AND 1 = 0`). Applied to overview, series, table, history, filter-options, report, insights, AI review. |
| **F2a** export endpoint had no permission | `POST /api/export/start-ads` now requires **`adsreport_export`**. |
| **F2b** export ignored `ReportType` → file ≠ screen | Export pins `p.ReportType = @reportType` (default `daily`), and the workbook gained organic sales/orders, page views, units, brand, category, seller, TACoS/ROAS/CTR/CVR columns. |
| **F2c** `Downloads.UserId` written from `req.user.id` (undefined) | Now `req.user.Id \|\| req.user._id \|\| req.userId`, so exports appear in the caller's downloads and only theirs. |
| **F3** no pagination / 2,100-parameter blowups | The table is paginated **in SQL** (`COUNT(*) OVER ()` + `OFFSET … FETCH NEXT`), limit clamped to ≤200; footer totals are a second whole-set aggregate. Sparklines/drill-downs are fetched only for the keys on screen, chunked at 400 parameters per statement. |
| **F5** decorative filters | Manager/brand/category/flag/search/group-by/sort/page-size all hit the server. Sellers and brands come from a **scope-aware** options endpoint. |
| **F9** upload unprotected and cross-seller | `POST /api/upload/upload-ads` now requires **`adsreport_import`** and validates the seller: an explicit out-of-scope seller is 403, and when no seller is given the ASIN owner is inferred and then checked (the old "newest seller in the table" fallback is gone for scoped users). |
| **F11** four disagreeing ads aggregations | One query layer, one `ReportType` rule, one window resolver — the new module is the only UI consumer. |
| **F10** UTC/local day-key drift between writer and readers | Reads bind dates as `YYYY-MM-DD` strings and `CAST` in SQL, so no JS `Date` → IST shift. (The writer-side fix belongs with the importer and is listed under *not done*.) |
| **F12** dead ads code | Deleted (see §1). Frontend lint dropped 516 → 473 problems as a side effect. |
| **F4** KPIs computed from the visible page | KPIs, mixes, movers and efficiency bands are all whole-scope SQL aggregates; the table's footer totals come from their own aggregate, not from the rendered rows. |
| **F8** no ads tests | 46 new tests (unit + HTTP), all green. |

---

## 3. API surface (`/api/ads/*`)

All routes: `authenticate` → `requirePermission('adsreport_view')` (except `/meta`), then seller-scope resolution inside the controller.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/ads/overview` | KPIs, series (current + aligned previous), mixes, movers + sparklines, efficiency bands/scatter/waste, target attainment, freshness, **rule insights** |
| GET | `/api/ads/series` | chart series only (granularity switches) |
| GET | `/api/ads/table` | paginated/sorted/filtered ASIN or parent table + whole-set totals + per-page sparklines |
| GET | `/api/ads/history?key=` | daily drill-down for one ASIN/parent |
| GET | `/api/ads/filter-options` | scope-aware sellers/brands/categories |
| GET | `/api/ads/report` | month-by-month actuals vs ADS target, per-seller attainment, ACoS target gap |
| GET | `/api/ads/insights` | rules only (free, no LLM) |
| POST | `/api/ads/ai-review` | on-demand LLM narrative (`STRICT` rate limiter) |
| GET | `/api/ads/meta` | thresholds/sort keys/flag vocabulary |

Common query params: `startDate`, `endDate`, `sellerId`, `brand`, `category`, `reportType` (`daily`\|`monthly`), `granularity` (`auto`\|`day`\|`week`\|`month`), plus table params `page`, `limit`, `sortBy`, `sortOrder`, `flag`, `search`, `groupBy` (`asin`\|`parent`).

Errors are structured: `{ success: false, code, message, … }` with `forbidden_seller` (403), `key_required` (400), `no_data`/`no_scope` (422), `ai_unavailable` (502, includes `fallback.insights`).

**Permissions:** `adsreport_view` (module), `adsreport_export` (export), **`adsreport_import`** (new — upload). Role seed updated: `admin` and `operational_manager` receive all three; the explicit brand/catalog/listing allow-lists were deliberately left untouched so this upgrade does not silently widen anyone's access.

---

## 4. The AI design

Two layers, exactly as agreed:

1. **Deterministic rules — always rendered, zero cost.** `backend/services/adsInsights.js` evaluates the payload built from the same scoped queries the UI displays. Each insight is `{id, tone, priority, text, detail, metrics, target, rows?}`; `target` is the DOM id the UI scrolls to. Rules cover data trust (no rows, stale end date, gap days), targets (ACoS over/under, ADS budget pacing vs calendar), period-over-period (ACoS points moved, sales growth vs spend growth, spend spikes without sales), waste (zero-sales spend, >40% ACoS band, unadvertised sellers), traffic quality (low CTR, low CVR with cost-per-order), concentration and mix, and the top mover in each direction. Every figure quoted is read from the payload — the engine cannot invent a metric, and it emits nothing but the "no data" warning when rows are absent.
2. **LLM narrative — only when the button is pressed.** `POST /api/ads/ai-review` **recomputes the overview server-side from the caller's own scope** (a crafted request body cannot feed the model fabricated numbers), reduces it to a numeric digest (`buildAiDigest`: totals, deltas, targets, freshness, bands, mixes, movers, top rule ids — no titles, SKUs or raw rows), then asks NVIDIA NIM first and Perplexity second, in parallel-safe sequence with a 45 s timeout. The reply must be strict JSON (`headline`, `summary`, `findings[]`, `risks[]`, `actions[]`, `confidence`), is normalised and clamped, and any provider/timeout/parse failure returns `502 ai_unavailable` **with the rule findings attached** — the analyst page keeps working because the rules layer is the product, and the LLM is an annotation.

Configure with the existing provider keys (`NVIDIA_NIM_API_KEY`, `PERPLEXITY_API_KEY`); optional `ADS_AI_TIMEOUT_MS`.

---

## 5. UI / UX

- Corporate, data-dense layout built entirely from the opsCenter design system: same tokens (`--ops-bg #f4f6f8`, `--ops-accent #1349c6`), `.ops-num` tabular numerals, `Panel`/`Tile`/`Delta`/`Chip`/`Segmented`/`ShareBar`/`SortHeader` primitives and the dependency-free SVG `TrendChart`/`Sparkline`/`Bars`/`Ring`.
- **Filter bar:** seller (scope-aware), brand, category, daily/monthly, quick ranges (7/30/90/180 D), custom range (shared app date picker), refresh, export.
- **Performance tab:** 8 KPI tiles with sparklines and period-over-period deltas → multi-mode trend chart (Sales / Spend / Efficiency / Traffic / Orders) with the previous window overlaid as dashed series → brand/seller/category mix → movers with mini-trends.
- **Efficiency tab:** ACoS band distribution (spend-weighted), zero-sales spend, spend-vs-sales scatter, target attainment ring + ACoS headroom, data-coverage panel, blended read (ad share, cost/order, CPM/CPC).
- **ASIN table:** server pagination, sortable across 11 metrics, flag filters (rising/falling/waste/high ACoS/no sales/low CTR), search, per-row sparkline, chips, ASIN/parent grouping, footer totals for the whole filtered set, click-to-drill daily history.
- **AI Analyst tab:** rule findings with priority, thresholds and quoted metrics; optional free-text question; the generated review rendered as headline → summary → findings/risks/actions cards with impact chips and confidence; provider + latency + grounding count.
- **Honesty rules in the UI:** unknown ratios render `—` (never `0%`), deltas show "no prior data" instead of `+100%`, a failed section shows its own retry state, and gaps in coverage are called out where the totals are affected.

---

## 6. Verification performed

- `npx vite build` → **✓ built in 6.5 s**.
- `backend: npx jest` → **178/179 pass** (the single failure is the pre-existing `nvidiaAiService` constructor-caches-env test, red before this upgrade).
- `npx eslint` on the new module files → clean; repo-wide lint improved 516 → 473 problems because the dead ads files were deleted.
- 46 new tests assert: scope contract (foreign seller 403, empty scope returns nothing, global users may filter), `ReportType` on every ads query, dates bound as strings, SQL `OFFSET/FETCH` with real totals, sort-key allow-listing (no injection), sparkline chunking ≤400 params, insight maths and suppression, AI JSON normalisation, 401/403 access paths, export/upload permission wiring, and job ownership.
- **Not verified (no browser and no database in this environment):** visual rendering and live queries. Playwright could not install Chromium in the sandbox, so the UI is verified by build + the panel logic being pure functions over the API payload. See §8 for the live review checklist.

---

## 7. Deliberately not done

- **Writer-side day-key alignment (F10 tail)** — the importer still derives `Date` keys with `Date.UTC(...)`. Changing it needs a backfill decision (existing rows are already keyed) and is a data migration, not a code change; flag it before touching.
- **Index tuning (F13)** — the audit's index recommendations are unchanged and still worth doing, but they need a maintenance window and a real query store, not this sandbox.
- **`dataController.getAdsManagerData` / `getAdsReport`** — left in place and still routed at `/api/data/*` for backward compatibility (and now that scope/`ReportType` are enforced in the new module, the old endpoints are the remaining unscoped path — see the checklist item 6 below).
- **Dashboard ads card** — untouched; it reads ads rows through its own (already scoped) path.
- **Demo/sample data** — none, by request.

---

## 8. Live review checklist (against the real database)

1. `/ads-manager` loads with the global date range; KPI numbers equal the previous Ads Manager for the same window, and now equal the Report tab for the same window.
2. Change seller/brand/category/daily-monthly/flags/search → the network tab shows one `/api/ads/*` request per change, and every request carries `sellerId` (for scoped users) and `reportType`.
3. Paginate to page 5+ and sort by ACoS/TACoS → instant, no full-dataset fetch; footer totals stay constant across pages.
4. As a brand-manager account, open the module → only assigned sellers appear; append `&sellerId=<someone else>` to an `/api/ads/overview` request → **403 `forbidden_seller`**.
5. Export → the file now appears in your downloads, matches the on-screen window and report type, and includes organic/ACoS/TACoS columns.
6. Try `GET /api/data/ads-manager?sellerId=<other seller>` with a scoped account → this legacy route is *not* scoped; retire it (two-line change in `dataRoutes.js`) once the new module is confirmed in production.
7. Press **Generate AI review** on the Analyst tab → a narrative appears with quoted figures; pull the network cable / unset the AI key and press it again → the rules remain and the banner explains the AI failure.
8. Upload a daily workbook as a scoped user including an ASIN owned by another seller → 403 with the resolved seller named.
