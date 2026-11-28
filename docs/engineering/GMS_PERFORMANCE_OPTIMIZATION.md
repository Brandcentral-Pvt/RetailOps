# GMS performance stabilization

## Baseline audit

The merged Phase 4 engine pages results but still materializes and aggregates the entire scoped report on each request. Before this change, its correlated normalized catalog lookup could repeatedly scan the ASIN master. The initial browser report also awaited the enriched Sellers API and manager directory. The enriched Sellers API performs ASIN counts, manager joins and returns integration settings unnecessary for GMS filters. Large product-title columns were carried through temporary fact datasets even when search was empty. Charts were imported eagerly.

## Implemented

- A normalized-key temporary catalog lookup, one set-based catalog scan and indexed matching. The unique-owner test keeps blank/conflicting owners unmatched and preserves verified stored owners, the existing restricted-user catalog rule and signed fact totals. No catalog or fact schema changes. On the no-search path, titles are fetched only for the chosen page; financial data is still taken from the materialized scoped dataset. Search retains title matching.
- GET /api/upload/gms-filters returns minimal seller IDs/names and manager labels with authorized seller associations. It requires gms_tracker_view; restricted users only receive their seller scope and relevant manager associations. It does not call the enriched Sellers API or transmit integration settings. No arbitrary 1000 seller truncation. Global users retain all directory associations. The browser starts this independent request and analytics concurrently; only manager-filtered reports await current directory assignments. Import completion refreshes financial data.
- Lazy ApexCharts import when a multi-observation chart is actually rendered.
- Server-Timing response headers for pool acquisition, SQL, response composition and controller total, with numeric-only slow query diagnostics. The controller timings exclude preceding authentication and network/serialization time. Use browser Network timing and response headers alongside server logs; never log filter values, financial contents or secrets.

## Release checks

Run the GMS Phase 1 and Phase 2 workflows on the latest head. Real SQL fixture includes normalized and conflicting ASINs, comparison with the existing canonical query, scoped directory and title search. Scale fixtures now include 50,000 irrelevant catalog rows plus catalog matches for half the report entities; both 100k and 500k financial fact jobs measure latency and response size. These are disposable synthetic fixtures, not production measurements. Browser test holds the directory response and checks that the report renders without it; manager selection must remain scoped. Modal geometry checks wait for finite entrance animation completion, without dropping the scrolling assertions.

## Still required

1. Capture production cold/warm timings for the GMS analytics request, filter directory, authentication, response download and render. Measure p50/p95 with representative date windows and user concurrency. Inspect actual SQL execution plans, logical reads, tempdb and existing index definitions (migration 094 may reuse a date-leading index that does not cover all fields). Only introduce a permanent normalized catalog index or additional fact index when plans justify it; account for catalog write cost.
2. Reuse expensive report-wide summary/ranking across page changes through a bounded, scope-aware and revision-aware report snapshot or cache. A page-specific response cache alone does not eliminate new page queries. Invalidation must cover committed imports and changes to ASIN ownership, catalog metadata, sellers and effective user access across workers. Do not serve cached data to an expired/revoked scope. Keep exports tied to authoritative data or explicitly identified snapshots. No stale financial-data cache has been introduced in this PR.
3. Consider a materialized ASIN/day rollup or seller/day aggregates if historical windows remain slow. Preserve exact signed and null semantics, compare date coverage and unmatched/late ownership rules.
4. Large historical export still holds the fact set and analytical structures in Node memory. Streaming query-to-file and durable export orchestration remain separate work.
5. Actual production visual and concurrency checks, desktop Excel acceptance and the independent OOS regression remain release obligations.

Suggested acceptance targets (not measured promises): typical cold report first useful data within 2 seconds, subsequent page navigation within 500 ms, no unnecessary requests on visual-only controls, and exact reconciliation with source data. Establish actual deployment-specific thresholds after profiling. No database migration or live production mutation in this PR.
