# Keyword Research — Module Upgrade

Hand-off for the Keyword Research rebuild: what the module does now, how the
data is derived, where the honesty limits are, and what to check against the
real backend and Amazon Creators API.

**Scope decision (agreed before implementation): UI/UX + derived analytics, no
schema change.** No migration was written, no keyword table exists, and nothing
about a search is stored server-side. Saved lists, the watchlist and recent
searches live in `localStorage` (versioned, quota-safe, migrated from the old
ad-hoc keys). "Change since last check" is a local snapshot diff, not a server
feature.

---

## 1. What changed

| Area | Before | Now |
| --- | --- | --- |
| Page | `src/pages/KeywordResearchPage.jsx` — 755 lines of inline-styled antd `Card`s, 4 hand-rolled tabs, client-only stats | `src/pages/keywords/` — `KeywordResearchPage.jsx` + `panels.jsx` + `workspace.jsx` + `keywords.css`, built on the opsCenter design system |
| Data per search | raw product list | product list **+ market analytics + catalog link + rule-based signals** (one upstream call, all derived server-side) |
| Catalog link | none | every returned ASIN is checked against `Asins`/`Sellers`, seller-scoped, with price-vs-market, review gap and missing-title-term detail |
| Seller scope | none (module had no seller concept) | resolved per request and applied to every catalog read; a foreign `sellerId` is a 403 `forbidden_seller` |
| Batch | strictly sequential, 20 keywords, filters dropped | parallel-safe scheduler (starts stay 1.1 s apart), full filter passthrough, per-keyword errors, scheduling metadata |
| Cache | none — every search cost a paid API call | in-process snapshot cache, 10 min TTL, 300 entries, hit-rate exposed in `/meta`; `keywords_manage` can bypass or clear it |
| Export | client-side CSV `Blob` | server-rendered multi-sheet **XLSX** gated by `keywords_export` |
| Saved lists / watchlist | ad-hoc localStorage in the page | `src/pages/keywords/localStore.js` — versioned store, trimmed snapshots, change alerts, storage stats |
| AI | LLM only, on a spinner | unchanged LLM behaviour, now framed by deterministic numbers, catalog flags and the rule engine |

### Files

| Path | Role |
| --- | --- |
| `src/pages/keywords/KeywordResearchPage.jsx` | module shell: tabs, filters, compare runner, save/re-check flows |
| `src/pages/keywords/panels.jsx` | filter bar, market overview, insights, price/competition/brand/terms/catalog panels, product table |
| `src/pages/keywords/workspace.jsx` | compare table, saved lists, watchlist, AI panel, product drawer, XLSX button |
| `src/pages/keywords/localStore.js` | the whole persistence story (browser-local) |
| `src/pages/keywords/keywords.css` | module-specific styles, opsCenter tokens with literal fallbacks |
| `src/hooks/useKeywordResearch.js` | react-query data layer |
| `backend/services/keywordAnalytics.js` | pure analytics: market picture, catalog link, insight rules, opportunity score |
| `backend/services/keywordExportService.js` | XLSX workbook builder (no disk writes) |
| `backend/services/keywordResearchService.js` | upstream client — snapshot cache + parallel-safe rate limiter |
| `backend/services/keywordAnalysisService.js` | LLM call (unchanged) + `source` marker + full item passthrough |
| `backend/controllers/keywordController.js`, `keywordAnalysisController.js` | scope, enrichment, export, meta |
| `backend/routes/keywordRoutes.js`, `keywordAnalysisRoutes.js` | permissions and limiters |

---

## 2. API surface

| Endpoint | Permission | Notes |
| --- | --- | --- |
| `GET /api/keywords/search` | `keywords_view` | one keyword → `{ items, market, catalog, insights, raw, scope, capabilities }` |
| `POST /api/keywords/batch-search` | `keywords_view` + strict limiter | ≤20 keywords, newline-separated, all filters honoured, one catalog read for the whole batch |
| `GET /api/keywords/categories` | `keywords_view` | search-index options |
| `GET /api/keywords/meta` | `keywords_view` | limits, sort options, cache stats, caller capabilities, resolved scope |
| `POST /api/keywords/export` | `keywords_view` + `keywords_export` | posts the dataset the page is showing, returns an XLSX stream |
| `POST /api/keywords/cache/clear` | `keywords_view` + `keywords_manage` | drops every cached snapshot |
| `GET /api/keyword-analysis/analyze` | `keywords_view` + strict limiter | LLM plan + the same deterministic context, on the same product set |

`refresh=true` (cache bypass) is only honoured for `keywords_manage` holders —
a forced refresh costs a paid upstream call for everyone.

### New permissions

`keywords_export` and `keywords_manage` were added to
`defaultPermissions` (category `Marketplace`). `keywords_export` is granted to
`brand_manager`, `catalog_manager` and `listing_team` alongside `keywords_view`;
`keywords_manage` goes to `admin` and `operational_manager` only.
Seeding requires `POST /api/roles/seed` (see §6).

---

## 3. Derived analytics — and their honesty limits

Everything in `backend/services/keywordAnalytics.js` is pure and testable.

- **Sample block**: `{ products, priced, rated, ranked, totalResultCount }`
  travels with every response and the UI prints it next to the numbers. The
  upstream API returns one page, so all statistics describe *that page*, never
  the keyword universe.
- **Price**: min/max/mean/median/p25/p75, average MRP and discount, discounted
  share, and six bands with per-band count, share, average rating, median
  reviews, average BSR and cheapest listing.
- **Ratings & moat**: average, review-weighted average, total reviews, rating
  distribution, top-3 share of reviews, the leading listing, and the share of
  the page that is under 4★ or under 50 reviews (the "beatable" definition).
- **Demand proxy**: median/best/worst BSR and the ≤10k / ≤50k share — labelled
  as a proxy, never as sales or search volume.
- **Brands**: per-brand listings, share, review share, average price/rating,
  best BSR, plus HHI and top-3 share for concentration.
- **Sellers**: distinct sellers, share, out-of-stock share, buy-box share.
- **Title language**: words / bigrams / trigrams with a stop list, requiring at
  least two occurrences so a single odd title cannot define a trend.
- **Opportunity score (0–100)**: weighted blend of four *named* components —
  demand proxy (0.35), review moat (0.30), brand concentration (0.20), listing
  quality gap (0.15). Components are returned with their notes so the UI can
  show the working; a component with no data is reported as `null` rather than
  scored as zero, and the score is `null` when nothing measurable is available.
  **It is not a search-volume estimate** and the payload says so.

### Catalog link

`fetchCatalogMatches` reads `Asins` joined to `Sellers`, chunked at 200 ASINs,
with the caller's seller predicate bound by `backend/utils/sellerScope.js`.
`linkCatalog` then adds, per returned ASIN: `inCatalog`, our listings (seller,
SKU, status, stock, price, BSR, rating, reviews, LQS, buy box), price delta vs
the market median, review gap to the top three, and the market terms missing
from our own title. If the database is unreachable the module still returns the
market analytics and marks `raw.catalogAvailable: false` — it never fakes a
"you sell this" flag.

### Insight rules

Deterministic, ranked, each quoting only numbers present in the payload:
thin sample, review moat, open field, weak listings, discount war, price-band
crowding, brand dominance, demand proxy, catalog present/absent, price
above/below market. Tones are `pos | neg | warn | info`; `target` is the panel
to jump to.

---

## 4. Batch scheduling and caching

The upstream limit is one call per 1.1 s per API key. The previous
implementation awaited the delay *after* reading the last request time, so
concurrent callers computed the same wait and fired together — which is why
batch had to be a sequential loop. `_acquireSlot()` now serialises the
*reservation* (a promise queue) and sleeps outside it, so starts stay exactly
1.1 s apart while the HTTP calls overlap; `batchSearchItems` fans out through a
bounded promise pool (default 4, `KEYWORD_BATCH_CONCURRENCY`), keeps caller
order, and isolates per-keyword failures.

The cache is a `Map` keyed on every search parameter, TTL 10 min
(`KEYWORD_CACHE_TTL_MS`), max 300 entries (`KEYWORD_CACHE_MAX`), LRU-ish eviction
by insertion order, failures never cached. `GET /meta` exposes entries / hits /
misses / hit rate.

The frontend runs a comparison in chunks of 5 keywords with 2 chunks in flight,
which surfaces progress without ever exceeding the server-side spacing.

---

## 5. UI

Corporate opsCenter language: `ops-head`, `ops-grid` (12 columns), `Panel`,
`MiniState`, `Delta`, `Segmented`, `SortHeader`, `ShareBar`, `Sparkline`,
`TrendChart`, `Bars`, `Ring` — the same primitives the dashboard and ads module
use. Highlights:

- **Search**: summary strip (products, median price, average discount, top-3
  review share, leading brand, your listings, opportunity), opportunity ring
  with component breakdown, signal rail, price bands (clickable → filters the
  table), competition/commerce panels, brand concentration, title-language
  chips (click → new search), catalog overlap with missing terms, and a
  sortable product table with watchlist stars.
- **Compare**: keyword table sorted by opportunity/price/reviews/yours, band
  filter, progress bar with elapsed time, per-keyword drill-down, product table
  across all keywords.
- **Saved & watchlist**: saved lists with snapshots, "N changes since …" diff
  chips (market moves, new entrants, drop-outs, price/review/position moves),
  re-check, rename, delete, XLSX export; watchlist with price/rating/review/BSR
  series sparklines, movement chips, notes, "check for changes"; a banner
  surfaces alerts after any search that covers watched ASINs. Local storage
  usage and a "clear local data" action are shown explicitly.
- **AI analysis**: seed input with top-N and cache controls, model summary,
  suggestion cards (type/volume/competition/score/rationale), gap and adjacent
  category lists, trending terms — all clickable to search — plus the
  deterministic market panels and the product set the model read.
- **Product drawer**: full extracted fields, our listings for that ASIN, title
  gaps, watch toggle, Amazon link.

Every panel exposes its own loading/error/empty state; a failed query shows a
retry, not a zero.

---

## 6. Deploy notes

1. **Seed the new permissions** (no migration, but `Permissions` rows are
   created by the seeder):
   `POST /api/roles/seed` with an admin/super_admin token. Without it,
   `keywords_export` / `keywords_manage` do not exist and export returns 403 /
   the buttons stay hidden.
2. No schema change, no migration, no backfill. Nothing is written to the
   database by this module.
3. Optional environment variables (defaults shown):
   `KEYWORD_REQUEST_DELAY_MS=1100`, `KEYWORD_BATCH_CONCURRENCY=4`,
   `KEYWORD_CACHE_TTL_MS=600000`, `KEYWORD_CACHE_MAX=300`.
4. Caching is per Node process. Behind multiple instances each process keeps
   its own snapshots — that is fine (the cache is an optimisation, never a
   source of truth).
5. Saved lists/watchlist are per browser, by design. Clearing site data clears
   them; the UI states this.

---

## 7. Verification performed

- `cd backend && npx jest` → **236 passed / 1 failed**; the single failure is the
  pre-existing `nvidiaAiService` env-cache test (was 181/182 before this work,
  so no regression).
- New: `backend/__tests__/unit/keywordModule.test.js` (40 tests) and
  `backend/__tests__/routes/keywordRoutes.test.js` (15 tests) — 55 new tests
  covering the analytics maths, catalog linking and scope, insight rules, cache
  hit/miss/refresh/clear, scheduler spacing and overlap, controller enrichment,
  403-on-foreign-seller, XLSX bytes and sheet contents, and the route
  permission matrix.
- `npx vite build` → success (≈6 s). `npx eslint src/pages/keywords
  src/hooks/useKeywordResearch.js` → clean.
- Not verified here: real upstream responses and the rendered UI (this
  environment has no database, no Amazon credentials and no browser). See §8.

## 8. Live review checklist

- [ ] `POST /api/roles/seed` run; Admin → Roles shows `keywords_export` and
      `keywords_manage` in the `Marketplace` category.
- [ ] Search a real keyword: the sample line reads "N of M reported results
      analysed" and matches the product count in the table.
- [ ] An ASIN you genuinely sell shows the green "You sell this" line with the
      right seller/SKU; an ASIN you do not sell never shows it.
- [ ] Sign in as a brand/catalog manager: only their assigned sellers' listings
      can ever be flagged, and `?sellerId=<other>` is refused.
- [ ] Second identical search: the header hit-rate rises and the panel meta
      shows the result was served from cache (no new upstream call in logs).
- [ ] `Force refresh` (manage permission) re-queries upstream; without the
      permission the control is hidden and `refresh=true` is ignored.
- [ ] Compare 12–15 keywords: progress advances, total wall time is roughly
      1.1 s × keywords (plus one round trip), and no 429s appear in logs.
- [ ] Export XLSX from each tab: sheets carry the numbers shown on screen, and
      the hidden `_meta` sheet lists the seller scope used.
- [ ] Save a list, re-check it after changing a price upstream (or after a few
      days): the diff chips describe exactly what moved.
- [ ] Watch an ASIN, run a search that covers it, and confirm the alert banner
      and watchlist chips.
- [ ] AI analysis: with the LLM reachable, `source` is `llm` and the export has
      the AI sheets; force a model failure and confirm the fallback still
      renders with `source: fallback`.
