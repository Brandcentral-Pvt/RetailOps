# Ads Intelligence Phase 0: universal source contract and baseline

Status: source contract established from a supplied real product CSV; production schema/data reconciliation is pending. This change is documentation and read-only diagnostics only. It changes no API, ingestion, migration, permissions, data, or deployment configuration.

## Canonical template

[Versioned machine-readable contract](../../backend/contracts/ads-product-daily-v1.json) contains all 63 headers in their original order, types, observed percentage scales, nullability, source grain, and mapping against the current importer. Version 1 is the daily product CSV, not campaign, search-term, targeting, or monthly aggregate input. Different sellers and date ranges use the same schema. Header order may vary, but missing, duplicate and unknown headers must not be silently accepted or discarded. A new source variant requires a versioned adapter. Preserve every source field, including product snapshots and fields that are presently empty.

The authorized seller, marketplace and currency are external metadata. None is present in the 63 columns. Filename labels are hints only; do not guess an owner, assign to the latest seller, or use SKU as a required identifier. A daily fact has a seller/marketplace/report type/ASIN/calendar-date key. Reject mixed or unauthorized scope before any catalog or fact write. Shared ASINs across sellers must remain separate facts. Do not migrate existing rows until actual ownership and historical key semantics are verified.

Normalize the observed literal quote wrapping around dates/SKU after CSV decoding. All sample SKUs are the literal None placeholder and should normalize to null. Validate calendar dates strictly; no fallback for an invalid row date, no timezone shifting, no truncating fractional counts, no invalid-number-to-zero coercion. Blank is null, explicit zero is zero. Preserve signed adjustments. Preserve source-scale decimals before deriving display metrics.

## Actual sample structure (aggregate counts only)

The supplied daily report covers 30 dates, 3,230 ASINs and 96,900 records. All rows have 63 fields, all identifiers and calendar dates passed structural checks, every ASIN has 30 dates, and there were no duplicate ASIN/date keys. The report is sparse:

| Population | Rows |
|---|---:|
| Advertising spend and ad sales populated | 2,913 |
| Business totals populated | 12,160 |
| Both advertising and business totals populated | 2,747 |
| Advertising only | 166 |
| Business only | 9,413 |
| Neither advertising nor business totals populated | 84,574 |
| Product price populated | 53,730 |
| Best seller rank populated | 96,420 |
| SKU placeholder | 96,900 |

15 fields are blank on every row (budget fields, TOS impression share, buy-box, ordered-items session percentage, average offer count, negative feedback rate, profit/margin and AFN/MFN inventory fields). Blank does not prove zero or that the source will never supply those values. Do not infer advertising participation, fresh seller reports, profit or inventory from placeholder rows.

The raw report, filename seller label, ASINs, and monetary totals are intentionally not committed.

## Financial reconciliation (observed, not provider documentation)

* Explicit total sales equals ordered revenue, explicit total orders equals ordered orders, and total units equals units ordered for all 12,160 populated rows. Preserve both fields, reconcile disagreements and report coverage; do not silently substitute when one is missing.
* On 2,747 rows with both source families, total sales differs from ad sales plus organic sales in 199 rows, and total orders differs from ad orders plus organic orders in 186 rows. Ad sales exceed total sales on 202 rows. Across the entire file, the legacy reconstructed sales total is approximately 8% higher than the explicit source total. Never reconstruct these totals or clamp ad sales share to 100%. Attributed advertising sales and order-date business revenue can differ; the attribution window is not established by this CSV alone.
* The file contains 21 negative total-sales rows, 19 negative total-order rows and 18 negative total-unit rows. Preserve these signed values.
* Source ACoS, CTR and conversion rate are decimal fractions, not already multiplied percentages; NTB percentages are also fractional in observed rows. Total ACoS and ad sales percentage are percentage-point values. ROAS is a multiplier. Do not infer scales for fields that are entirely blank.
* The supplied CVR and AOV reconcile with conversions (not orders) at source precision, including one row where the two counts differ. Display conversion rate as conversions/clicks; define order-based rate separately. AOV should follow source conversions; order-based revenue per order must be separately labelled. CPO uses attributed orders.
* Derive ratios from additive totals, never sum or average percentages, and never divide by a nonpositive/unknown denominator. For portfolio ratios on incomplete populations, expose coverage, explicitly label partial totals and define the compatible numerator/denominator population; do not make a no-data result look like zero.
* Price, BSR, inventory, budgets, averages, percentages and profit/margin cannot automatically be summed across dates/ASINs. Product snapshots must stay date-specific. Unverified budget attribution and unavailable profitability data cannot drive recommendations.
* Daily rows can be rolled up into weeks and calendar months. Monthly aggregate inputs need a separate validated contract. Never mix daily and monthly rows in a total. Keep legacy monthly rows isolated pending a backfill decision.

## Current main branch gaps (baseline b83bc744)

* [Legacy importer](../../backend/controllers/uploadController.js#L181-L521) reads 28 source headers, recomputes 5 rather than preserving source values, and does not read 30. It ignores explicit total orders, ordered revenue aliases, new-to-brand metrics, and product details; it converts blanks/bad numerics to zero and uses last-row-wins. It accepts daily/monthly but merges by ASIN/date or ASIN/month without seller identity. Selected seller validation does not validate every existing ASIN owner. Skeleton catalog insertion, fact merge and ad flags are separate operations.
* [Analytics](../../backend/services/adsAnalytics.js) derives total sales and total orders from ad plus organic, uses orders for CVR/AOV, filters monthly rows on Date, groups by ASIN or parent without seller as part of the key, and joins catalog on ASIN only. A shared ASIN may multiply facts or attribute them to the wrong seller; this is a correctness and authorization risk.
* [Initial SQL schema](../../init-database.sql#L349-L524) declares a unique catalog key on (AsinCode,SellerId), a required AdsPerformance.SellerId and a non-null Date. It differs materially from the legacy importer's expected extended columns, generated keys and monthly-null Date handling. The bootstrap script is not proof of the deployed database structure.
* [Export](../../backend/controllers/exportAdsController.js) separately reconstructs financial values, omits some active filters and writes formatted strings into a single worksheet. All reads, exports and AI must eventually use the canonical fact/metric contract.
* [Existing index migrations](../../backend/migrations/024_dashboard_date_range_indexes.js) include a Date/ReportType covering index; inspect real index inventory before adding one.

## Production verification (release gate for Phase 0)

Run [ads_phase0_readonly_checks.sql](sql/ads_phase0_readonly_checks.sql) using an authorized read-only database login, staging first. Metadata checks do not modify data. Optional data checks require explicit seller and <=31-day range and can still consume database resources. Record only aggregate/sanitized results in the engineering discussion.

1. Inspect actual columns, nullability/defaults, constraints, triggers, uniqueness and indexes for AdsPerformance, Asins, Sellers and GmsDailyPerformance. Compare against the importer and the v1 mapping.
2. Confirm actual seller identity, marketplace, currency and ownership semantics; investigate shared ASINs and orphan/ambiguous historical facts without guessing their seller.
3. Determine whether legacy Date or Month is authoritative, whether monthly rows can exist, and how report types are populated. Never run a destructive backfill as part of this audit.
4. Privately compare the original sample's known totals and field-level coverage against the existing seller's database records and matching GMS business figures for the same date range, marketplace, attribution and currency. Differences must be explained rather than forced to match.
5. Inventory all legacy consumers (dashboard, old ads routes, exports, insights) before changing semantics; confirm the current permission/assignment state. Identify which historical fields were never stored and cannot be recovered without the source reports.
6. Write a migration plan with an owner-aware key, nullable typed facts, source lineage, reconciliation, rollback and a safe migration strategy. Re-import historical reports only after validation and explicit approval.

## Next phase acceptance

Phase 1 must fix owner-aware ingestion and reads, exact totals/conversions and null semantics, validated report types/dates, safe pagination and target scoping, and add real SQL integration/regression tests for duplicate catalog ownership, mixed seller files, sparse rows, signed corrections and daily/monthly isolation. A later import-job phase should preserve every source field, preflight errors, job history, transactional writes and revision-aware cache invalidation. No live writes, runtime parser or schema migrations are introduced in Phase 0. Completion requires actual database verification; repository contract approval alone does not prove production readiness.
