# Ads Phase 1B: canonical writer and metric engine

Baseline: Phase 0 and Phase 1A are merged. This increment implements internal services and an isolated read-only diagnostic. It does not enable the legacy upload endpoint or switch the existing page to the new tables. No production facts are written by deployment.

## Transactional writer

`ingestCanonicalReport({pool,sql,user,sellerId,reportType,input})` receives a trusted authenticated principal from an eventual permission-gated controller; it is not an exposed import endpoint. It requires one explicitly authorized seller, a valid actor, daily v1 and a bounded CSV Buffer. It copies bytes, runs complete validation, then replays the same parser and SHA-256 verified bytes into a connection-local SQL staging table in 1,000-row JSON batches. Source numeric strings are converted directly by SQL Server into the contract's exact DECIMAL(28,10)/BIGINT fields; no JS floating-point intermediate.

A serializable transaction and per-seller transaction-owned application lock protect concurrent writes. The selected seller and marketplace/currency configuration are rechecked inside the transaction. Every ASIN must have exactly one catalog mapping for the selected seller, including legitimately shared ASINs. Unknown, foreign-only and ambiguous catalog keys reject the whole report. No ASIN is automatically created and no catalog flags are changed. The report lacks its own account identifier; this is catalog ownership verification, not proof of the external report's origin.

Existing identical normalized facts are no-ops and preserve original lineage, even when a different source file repeats them. A differing existing value, including null-vs-zero, rejects the entire report. A changed currency for an existing seller/marketplace also rejects. There is no automatic historical replacement or blank-overwrite policy. Before commit, every staged row must match persisted fields and currency; any failure rolls the transaction back. The writer does not retry ambiguous commit outcomes automatically; a subsequent identical replay is safe. This service requires SQL Server OPENJSON support (compatibility level >=130). Existing AdsPerformance remains unchanged.

## Canonical metrics

GET /api/ads/canonical-summary?startDate=2026-04-01&endDate=2026-04-30&sellerId=... is an isolated, authenticated adsreport_view diagnostic over daily canonical facts, not the existing overview. It requires an ordered, valid calendar range of at most 366 days. Every requested seller must be authorized; no assigned sellers yields no query. Seller scope is applied directly to fact SellerId. No catalog joins are needed for this summary. Group by currency, never mix currencies. No rows yields an empty currencies array, not fabricated zero metrics.

Explicit TotalSales, TotalOrders and TotalUnits are independent from ad/organic and ordered aliases. CVR and AOV use Conversions; order rate and revenue per order are separate. SUMs are exact SQL decimal text; counts are integer strings; ratios are signed, rounded to six decimal places, and computed using BigInt fixed-point arithmetic. Missing and signed values remain distinct.

Each metric exposes populated/missing counts and status (complete/partial/unknown). Ratios expose value, observedValue (ratio of all available marginal sums), matchedValue (ratio on co-present rows), pairedRows, and status. A ratio is decision-eligible only when observed numerator and denominator refer to the same row population and denominator is positive; incomplete but aligned coverage remains marked partial. If populations differ, value is null and the observed/matched diagnostics must not be presented as full-coverage portfolio performance. In particular, pairwise TACoS may exclude organic-only business rows and is not a substitute for a verified portfolio TACoS. A later UI must label these distinctions.

## Verification and activation gate

Dedicated Node tests cover shared parser replay, precision, strict scope, coverage and financial semantics. Disposable SQL Server tests exercise actual writer, shared ASIN isolation, exact lineage, replay, conflict rollback, concurrent identical submissions, null and currency segregation. No live database or production data is used by CI.

Remaining before import activation: canonical paginated product/parent/seller analytics, time-series and comparisons, target scoping, full filter contract, dashboard/legacy/export consumers, frontend display of exact metrics/coverage, and a permission-gated transactional import or persistent import-job confirmation endpoint. Legacy write remains 409 by design. No runtime modifications to GMS, OOS or Tasks. Actual seller catalog completeness and marketplace/currency configuration must be checked before importing the source file.
