# Octoparse Workflow Audit — Review Rating & A+ Data

Date: 2026-08-01
Scope: How the Octoparse scraping workflow captures, parses, and persists **review rating** (`Rating`, `ReviewCount`, `RatingBreakdown`) and **A+ content** (`HasAplus`, `AplusContent`, `AplusModuleCount`, `AplusAbsentSince`, `AplusPresentSince`) data.

---

## 1. Architecture — how Octoparse data reaches the DB

There are **two distinct ingestion paths**, and they behave differently for the same fields:

### Path A — Automated cloud sync (primary)
```
Octoparse Cloud (openapi.octoparse.com)
  → syncSellerAsinsToOctoparse()           backend/services/marketDataSyncService.js:155
  → injectUrls() / startCloudExtraction()
  → pollAndAutomate()                       backend/services/marketDataSyncService.js:~1120
  → retrieveResults()                       → marketDataSyncService.js:1715
  → processBatchResults(sellerId, rawData)  backend/services/marketDataSyncService.js:2490
  → updateAsinMetrics(asinId, rawData)      backend/services/marketDataSyncService.js:1924
  → UPDATE Asins SET ...                    backend/services/marketDataSyncService.js:2419-2446
```
Triggered by:
- Queue worker `type: 'octoparse'` → `jobs/processors.js:12`
- Scheduler recovery/pipeline → `backend/services/schedulerService.js:262`, `schedulerService.js:895`
- `marketDataSyncController`, `src/services/octoparseService.js:19`

### Path B — Manual file uploads
1. `/api/upload/octoparse` (txt/json/csv) → `uploadController.uploadOctoparseData` → `processBatchResults` (same Path A)
2. `/api/bulk/octoparse-json` → `bulkUploadController.octoparseJsonUpload` → `processBatchResults` (same Path A)
3. `/api/asins/upload-raw` and `/api/asins/upload-raw-text` → `AsinDataParser.bulkUpsertAsins` → **full MERGE into Asins** persisting *every* field (different behavior) → `backend/services/asinDataParser.js:495`, `controllers/asinController.js:2552`

**Key finding:** Path A (`processBatchResults → updateAsinMetrics`) persists **only** A+ fields, `RatingBreakdown`, and sync metadata. It computes `rating`/`reviewCount` but **never writes them**. Path B (AsinDataParser MERGE) persists `Rating`, `ReviewCount`, `RatingBreakdown`, and A+ fields.

`Rating` and `ReviewCount` are actually persisted by the **PA-API live sync** (`liveDataSyncService._updateAsinFromLiveSync`, which deliberately excludes A+ and `RatingBreakdown` — see comment at `liveDataSyncService.js:608-610`).

---

## 2. Review Rating data

### 2.1 What is persisted, and by whom

| Column | Path A (Octoparse cloud) | Path B (AsinDataParser MERGE) | Live sync (PA-API) |
|---|---|---|---|
| `Rating` | ❌ computed, not persisted | ✅ persisted | ✅ persisted |
| `ReviewCount` | ❌ computed, not persisted | ✅ persisted | ✅ persisted |
| `RatingBreakdown` | ✅ persisted | ✅ persisted | ❌ excluded (Octoparse-only) |
| `AsinHistory` rows | ❌ never written | ❌ | ✅ (rating+reviewCount) |

- `Rating`/`ReviewCount` are only used in Path A for local trend math (`marketDataSyncService.js:2276-2277`, `2385-2390`) and are dropped at the UPDATE.
- This means any ASIN that is covered by Octoparse but **not** by PA-API live sync will show stale/absent rating and review-count on the UI (AsinManagerPage, RatingViewModal, AsinDetailModal all read `asin.rating`, `asin.reviewCount`, `asin.ratingBreakdown`).

### 2.2 Parsing logic & field mapping

**Amazon (Path A)** — `marketDataSyncService.js:2110-2117`
```js
rating = parseFloat(rawData.avg_rating);                 // only avg_rating
reviewCount = _cleanReviewCount(_getFromRaw(rawData,
    ['review_count','Review_Count','Rating_Count','rating','RT'], '')) || asin.ReviewCount;
const ratingBreakdown = _parseRatingBreakdown(rawData.Rating || rawData.Field7 || rawData.Rating_breakdown || '');
finalRatingBreakdown = hasBreakdown ? ratingBreakdown : (asin.RatingBreakdown ? JSON.parse(...) : ratingBreakdown);
```
- `rating` reads **only** `avg_rating`; a typical Octoparse column named `Rating` (capital) or `Average Rating` is not read → `NaN → 0`.
- No clamp to `[0,5]` (minor).
- Field list has no `'review count'` (space) or `'Reviews'` variants, which are common Octoparse column names (see Path B below, which *does* match `'review count'`).

**Ajio (Path A)** — `marketDataSyncService.js:2073-2078`
```js
rating = parseFloat(_getFromRaw(rawData, ['Rating','rating','avg_rating'], 0));
reviewCount = _cleanReviewCount(_getFromRaw(rawData, ['Review_count','review_count','ReviewCount','rating_count'], 0)) || 0;
```
- **`finalRatingBreakdown` is never computed in the Ajio branch** (initialized to zeros at line 1967) but is still written on every sync (line 2427). Every Ajio Octoparse sync therefore **overwrites existing breakdown with `{"fiveStar":0,"fourStar":0,"threeStar":0,"twoStar":0,"oneStar":0}`**.

**Path B (AsinDataParser)** — `asinDataParser.js:306-314`
```js
const rawRating = parsed.Rating || parsed.rating || parsed.avg_rating || '';
const rating = parseRating(rawRating);                    // parseFloat, clamped 0-5
const rawReviews = parsed['review count'] || parsed.Review_count || parsed.review_count || parsed.ReviewCount || '';
const reviewCount = parseReviewCount(rawReviews);         // str.match(/(\d+)/)  ← BUG
```

### 2.3 Known review-count parsing bugs

**R1 (High) — Production `_cleanReviewCount` is outdated vs. a tested fix.**
Production (`marketDataSyncService.js:3182-3205`) removes `"out of 5"` / `"N stars"` noise, then takes the **first** numeric run:

```js
const numMatch = s.match(/([\d,]+)/);
if (numMatch) { const val = parseInt(numMatch[1].replace(/,/g,'')); if (val>0 && val<10000000) return val; }
```

Trace on the real Amazon "smashed" histogram
`"4.2 out of 5 stars1,234 global ratings5 star63%4 star22%3 star9%2 star3%1 star3%"`
→ after noise removal → `"4.1,234 global ratings63%22%9%3%3%"`
→ first numeric run is `4` → **reviewCount = 4** (should be 1,234).

The repo contains *ad-hoc* test files proving a more robust version was prototyped but **never integrated**:
- `backend/services/test_rating_logic.js` (adds `global ratings` match + smart numeric scan → 424 ✓)
- `backend/services/test_final.js`, `test_final_v2.js`, `test_debug.js`
The production file still has the old implementation.

**R2 (High) — `asinDataParser.parseReviewCount` breaks comma-formatted counts.**
`asinDataParser.js:125-129`:
```js
static parseReviewCount(str) {
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}
```
- `"(2,441)"` → first run is `2` → **2** (should be 2,441)
- `"89 reviews"` → 89 ✓ (only works when the first digit run is the full count)

**R3 (Medium) — Field-name coverage is inconsistent between paths.**
- Path A Amazon review count does not match `"review count"` (space) / `"Reviews"`.
- Path A Amazon rating matches only `avg_rating`; Path B matches `Rating|rating|avg_rating`.
- If the Octoparse workflow uses a different column label than the hard-coded guesses, data silently maps to `0`.

**R4 (Medium) — Ajio sync zeroes out `RatingBreakdown`** (see §2.2).

---

## 3. A+ Content data

### 3.1 What is persisted

Both paths persist A+ fields; only Octoparse provides them (PA-API live sync deliberately excludes them):

| Column | Path A | Path B | Live sync (PA-API) |
|---|---|---|---|
| `HasAplus` | ✅ | ✅ | ❌ |
| `AplusContent` | ✅ (only from `A_plus`/`aplus_content`/`aplus`) | ✅ (same fields) | ❌ |
| `AplusModuleCount` | ✅ | ✅ (`aplusContent ? 1 : 0`) | ❌ |
| `AplusAbsentSince` / `AplusPresentSince` | ✅ | ✅ (`AplusPresentSince` only when hasAplus) | ❌ |

Path A persistence: `marketDataSyncService.js:2419-2434`. Path B: `asinDataParser.js:394-396`, `412-413`.

`AplusAbsentSince`/`AplusPresentSince` logic (Path A, `marketDataSyncService.js:2063-2070` / `2144-2152`): on a sync where A+ is not detected, `AplusAbsentSince` is set to now (if not already) and `AplusPresentSince` cleared, and vice-versa. Because these are set on **every** Octoparse sync, a task that simply doesn't capture the A+ field will mark listings as "A+ missing since today."

### 3.2 Detection logic — `_detectAplusContent` (`marketDataSyncService.js:2898-2980`)

Priority 1: explicit fields `has_aplus | A_plus | aplus | hasAplus | isAplus` (boolean / number>0 / non-empty object / boolean-like or JSON string).
Priority 2: content fields `A_plus | aplus_content | aplus | product_description` scanned for A+ markers, HTML, or length.

### 3.3 Known A+ bugs / risks

**A1 (High) — `product_description` is treated as A+ content (false positives).**
`marketDataSyncService.js:2931` includes `product_description` in the candidate list. A plain HTML product description that is `>100` chars with `<div>/<img>/<section>` (line 2963) or `>50` chars with any HTML tags (line 2968) is flagged `hasAplus = true`. Amazon/Ajio rich-text descriptions routinely match this → listings without A+ get `HasAplus=1`.

**A2 (Medium) — any non-empty `A_plus`/`aplus_content` string > 10 chars is treated as present.**
`marketDataSyncService.js:2972-2975`: `if (aplusContent.length > 10) return true;` — a scraped value like `"No A+ content found"` or `"A+ not available"` (>10 chars) → `HasAplus=1`.

**A3 (Medium) — `hasAplus` and stored `AplusContent` can disagree.**
`hasAplus` may become true via `product_description` (A1) while `AplusContent` is stored only from `A_plus|aplus_content|aplus` (`marketDataSyncService.js:2395`). Result: `HasAplus=1` but `AplusContent=null` and `AplusModuleCount=0` — inconsistent row.

**A4 (Medium) — the `"A+"` column label is not matched.**
`A_plus`, `aplus`, etc. are matched, but `"A+"` / `"A Plus"` (common Octoparse column names) are not in any field list (`marketDataSyncService.js:2395`, `2902`, `2931`; `asinDataParser.js:312`). Detection then relies on the fuzzy rules above (A1/A2) instead of the explicit field.

**A5 (Low-Medium) — Ajio "A+" semantics are ambiguous.**
Ajio pages don't have Amazon A+; the code falls back to `product_description`/rich content (A1), so `HasAplus` for Ajio sellers mostly reflects description length, not real A+ presence.

**A6 (Medium) — Path B `asinDataParser.hasAplus` also has a loose rule.**
`asinDataParser.js:189`: `return textContent.length > 50 || ...` — plain-text content >50 chars in the `A_plus` field counts as present.

---

## 4. Cross-cutting issues

- **C1 (High) — Divergent parsers for the same "Octoparse data".** The two paths (Path A `marketDataSyncService` helpers vs. Path B `AsinDataParser`) have *different* field-name lists, different review-count parsing, and different A+ rules. The same Octoparse file imported through `/upload/octoparse` (Path A) vs `/asins/upload-raw-text` (Path B) can yield different results.
- **C2 — No automated tests.** The robust parsers exist only in ad-hoc scripts (`test_rating_logic.js`, `test_final*.js`, `test_debug.js`). `backend/__tests__` contains no coverage for rating/review/A+ mapping.
- **C3 — `allowCreation` behavior.** Path A skips ASINs not already in the DB unless `allowCreation` is passed (upload JSON passes it; scheduler recovery does not) — relevant when the workflow is used for discovery.
- **C4 — `processBatchResults` requires a parseable ASIN** (`_extractAsinFromData`, `marketDataSyncService.js:3439`); records without a recognizable ASIN/URL are counted as `skippedNoCode` and never contribute rating/A+ data.

---

## 5. Recommended fixes (priority order)

1. **Persist `Rating`/`ReviewCount` from Path A** (`updateAsinMetrics`, `marketDataSyncService.js:2419`) — add the already-computed values to the `updates` object so Octoparse data is not lost for non-live-synced ASINs.
2. **Integrate the robust `_cleanReviewCount`** (from `test_rating_logic.js:46-71`) into `marketDataSyncService.js:3182` and fix `asinDataParser.parseReviewCount` (`asinDataParser.js:125`) to strip commas and handle `(count)`/`global ratings` formats.
3. **Compute `finalRatingBreakdown` in the Ajio branch** (`marketDataSyncService.js:2073`) or skip updating `RatingBreakdown` when no breakdown was parsed, to stop zeroing existing data.
4. **Remove `product_description` from `_detectAplusContent` candidates** (`marketDataSyncService.js:2931`) and add `"A+"`/`"A Plus"` to the explicit field lists in both paths; tighten rule A2 (require A+ markers, not just length).
5. **Align `AplusContent` with `hasAplus`** so they are always consistent.
6. **Add unit tests** for `parseRating`, `parseReviewCount`, `_cleanReviewCount`, `_parseRatingBreakdown`, `_detectAplusContent` covering the Octoparse exported formats (smashed histogram, `(1,234)`, `A+` column, HTML description).
7. **Document the Octoparse output schema** (exact column names) and pin `processBatchResults` field lists to it, so both ingestion paths parse identically.
