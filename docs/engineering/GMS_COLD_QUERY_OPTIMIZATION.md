# GMS cold-query optimization and profiling

## Verified previous release

PR 280 (head 673f105313342f772da3303997edac83921087d3) passed both GMS workflows and real disposable Redis/SQL integration. The 100k fixture measured 1933 ms first uncached query and 15 ms cached adjacent page; the 500k fixture measured 2866 ms first uncached query and 15 ms cached adjacent page. These are backend fixture timings, not end-user production latency. The OOS regression remains unrelated and failing.

## Cold-query changes

- Migration 097 checks for a usable date-leading covering rowstore index on the GMS fact table. A date-leading clustered index or an existing complete covering nonclustered index is reused. Otherwise create IX_GmsDailyPerformance_Date_ReportCover with all fields needed by the no-search financial query, excluding the potentially large report-title LOB. No existing index or financial row is removed or altered. Index creation may consume disk/log space and block writers; inspect the existing inventory and deploy in a controlled maintenance window. This adds a write/storage cost on systems lacking a complete index.
- Cluster the temporary normalized-key and ASIN/owner mapping tables for targeted joins; cluster the scoped fact table on entity, date descending, ASIN and fact ID to support grouped and page metadata access. Index selected page entity keys.
- Select the bounded ranked page using OFFSET/FETCH and stable null-last/entity-key ordering rather than materializing the complete ranked entity list in a second temporary table. Page clamp and total counts remain authoritative. All financial calculations, historical comparison windows, title search and scope rules are unchanged.
- Keep the previous query shape accessible via server-only GMS_QUERY_STRATEGY=baseline. Never accept SQL strategy or expressions from HTTP clients. This fallback is for query-plan regression investigation; it does not remove the permanent covering index. Cached results remain revision checked.

## Measure before asserting improvements

The disposable 100k/500k fixture runs both implementations in alternating order against identical tables/indexes, checks full response equality and logs SQL, composition and wall-clock time. There is no hardware-dependent performance assertion. Integration tests compare every supported sort in both directions, page bounds, seller/ASIN grouping, scoped filters and title search, and verify index migration idempotency. Extra temp-index construction can outweigh its benefits on some workloads; use the measured result to decide whether to retain the optimized query shape. The A/B comparison isolates query shape, not the separate effect of the permanent index.

## Read-only production/staging profile

From the backend directory on the target server (prefer staging first, run off-peak):

```bash
node scripts/profileGmsQuery.js --start 2026-11-01 --end 2026-11-27 --all-sellers --strategy compare --repeats 2
```

Use a representative actual reporting window. For a narrower portfolio replace --all-sellers with one or more --seller-id options. Optional --level asin|seller, --page, --page-size (1-100). Dates limited to 90 days; repetitions limited to three. The script uses the existing DB connection configuration with optional GMS_PROFILE_DB_USER/GMS_PROFILE_DB_PASSWORD overrides for a read-only account. It opens a separate connection, reads index definitions, executes only the report SELECT/temporary-table workload with STATISTICS IO/TIME, prints wall-clock SQL/composition milliseconds, response byte count and aggregated table logical/physical/LOB reads. It compares actual report outputs privately and prints an equality flag only when committed revisions remained stable. It does not emit source records, revenue figures, credentials, seller names, or raw query plans. No persistent writes or index changes are performed by this script. It still consumes resources and should not be run repeatedly during peak traffic. Use SQL Server Query Store/actual plans in the authorized database administration environment to investigate remaining scans, spills and missing-index suggestions; this CLI does not capture actual plans.

## Deferred

A persistent ASIN/day rollup is not automatically useful here because the canonical facts are already ASIN/date records, and the remaining seller mapping, search, date coverage and prior-period computations depend on mutable metadata and effective scope. Introduce a persisted aggregate only if production plans/measurements demonstrate a meaningful bottleneck and prove reconciliation across all invalidation paths. Cross-sort cached ranking reuse, full source-streamed historical exports, concurrent import/catalog-write benchmarking, live desktop Excel acceptance and actual production p50/p95 remain release work. Do not promise production load times from synthetic fixtures.
