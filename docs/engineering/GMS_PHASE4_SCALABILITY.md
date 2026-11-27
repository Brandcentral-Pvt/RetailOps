# GMS Tracker Phase 4 - Scalability and performance

## Scope and API

POST /api/upload/gms-analytics now returns a bounded matrix page by default (50 entities; 1-100 accepted). The existing startDate, endDate, level, sellerIds and search filters remain. New options: page (1-based), pageSize and sort {key,direction}. Responses include pagination {page,pageSize,totalRows} and sort. The server clamps an out-of-range page after filters or data changes. KPIs, prior-period comparison, reporting coverage, daily trends and month/week groups describe the entire matching data set, not the visible page.

The default order is selected-period ordered revenue descending, nulls last, with a deterministic entity-key tie breaker. Static identifier columns, ordered units, period revenue, daily revenue, month totals and month-clipped ISO-week totals support global sorting. Multi-valued brand/store sorts use the first label; trend columns remain read-only rather than applying misleading local sorts to a partial page. The interactive date window is limited to 3,660 days; longer historical reports remain available through export. SQL validates all sort keys and binds all user-controlled values.

## Database path

A single parameterized SQL batch materializes the required current/history fact range, prefilters known owners, resolves catalog ownership/title once per distinct stored ASIN/owner pair, applies existing role scope and selected seller IDs, and applies literal text search. All global daily aggregates and counts come from the same scoped temporary dataset. SQL ranks entity groups before selecting the requested page; only selected entity/day aggregates and page metadata are returned to Node. Existing Phase 3 integer-paise and calendar calculations assemble the output. Null financial metrics remain unknown; signed values and unmatched facts retain existing semantics. No new revenue rows are created or historical facts modified.

Migration 094 reuses any usable date-leading rowstore fact index. It creates a covering index only if none exists, and uses a transaction-owned application lock for idempotent concurrent migrations. Creating a missing index may block writes or consume disk/log space: inspect the production plan and index inventory before applying during a maintenance window. No index is dropped. Analytics requests cancel SQL when the client closes an obsolete response. A configurable per-worker GMS_ANALYTICS_CONCURRENCY limit (default 8, range 1-32) bounds concurrent interactive work. This is not a distributed concurrency limit.

## Frontend

The existing spreadsheet matrix requests pages of 25/50/100 rows; filter changes reset page and sort, server sorting replaces local comparators, and the selected-period revenue column is visible. Full-filter summary remains visible during same-filter page navigation. The import modal and error report functionality remain unchanged.

## Complete financial export

Excel contains Complete Data (one row per stored ASIN/date fact), Executive Summary, ASIN Analytics, Seller Analytics, Daily Analytics, Weekly Analytics, Monthly Analytics, optional Prior Period Data for bounded selections, and the GMS Matrix. Complete Data retains the original report's eleven headings in their original order: ASIN, Product Title, Brand, Ordered Revenue, Ordered Units, Shipped Revenue, Shipped COGS, Shipped Units, Customer Returns, Date, storeCode. Seller ID/name, mapping status, catalog product title and title source are additional fields. CSV includes all selected daily facts and the same complete headings; it does not create analysis worksheets. Both formats respect the chosen date/seller/search scope and never use interactive page limits.

Migration 095 stores optional uploaded Product Title separately from the catalog title. Historical reports cannot reconstruct titles that were not saved by the old importer: the original title cell remains blank and the separate catalog column is labelled accordingly. A later authorized import containing the original title can populate it; a title-less reimport does not erase it. No automatic historical backfill or invented product titles.

All workbook analytics use the same scoped fact retrieval and exact aggregation contract. Selected and prior records are separated; prior-only entities are included in comparison sheets without inventing zero sales. Current/previous/change fields cover all six uploaded metrics, gross profit, margin, and return ratio. Percentage-point changes for ratios, exact prior calendar days, same week segments, full calendar months and coverage checks preserve Phase 3 semantics. All-time selection has no equal-length prior window; daily/weekly/monthly comparisons still use available history. Missing stored metrics are blank rather than silently zero-filled.

The export is a styled snapshot with readable headers, widths, frozen headers, filters, signed money/unit formats and distinct percentage formats. Excel's hard row and column limits are handled by splitting long sheets and wide matrix sections. Raw row-count reconciliation prevents silent omission. The selected daily row count is stored in Downloads. CSV uses backpressure-aware writing and ExcelJS streams workbook generation, without a second sheetRows array or full ZIP buffer. Format is correct from job creation. A temporary partial file is published only after successful generation; cooperative timeout and two concurrent export jobs per worker remain.

Important: full SQL-source streaming is NOT complete. Excel's selected and historical fact set and computed analytical structures still reside in Node memory before file output. Very large historical requests require staging load tests, and may need a narrower range. Interactive queries materialize scoped data in SQL tempdb and recompute full-filter summary on each page. Shared cache/invalidation, durable export jobs and production query-plan optimization remain follow-up work.

## Validation gates

- Existing Phase 1, Phase 2, Phase 3 and error-report regressions must pass.
- Phase 4 unit/route tests validate sorting, filter parameterization, cancellation, global summary vs page totals, and real streamed CSV/XLSX files.
- Disposable SQL Server integration verifies index idempotency, signed totals, duplicate catalog mappings, page boundary/clamping, scoped permissions, literal search, and reconciliation against the Phase 3 engine.
- Optional GMS Phase 2 Ingestion workflow_dispatch input gms_scale_rows: 100000 or 500000 creates synthetic facts exclusively on the disposable localhost CI database; asserts exact revenue, full record count, distinct page keys and logs measured first/second page latency and response bytes. Default regular CI uses the small integration fixture. No production SLA is claimed.
- Verify real plans, tempdb/log usage, concurrent imports and analytics, representative date ranges and historical exports in staging. The separate OOS regression is still a release risk.
