# GMS Tracker Phase 3 - Unified analytics contract

## Scope

The GMS Tracker and GMS matrix export now use the same backend calculation service, gmsAnalyticsService.js. The legacy raw data endpoint remains for existing clients. Ingestion, validation, unmatched fact storage and schema migrations from Phases 1-2 are unchanged.

- POST /api/upload/gms-analytics accepts startDate/endDate (inclusive calendar dates), level (asin or seller), sellerIds (null = no selection, [] = explicitly empty selection), and search. Both selected and historical records have the same effective RBAC and filter constraints. Manager filters resolve to the selected seller-ID intersection in the current UI; the backend independently enforces portfolio access. Legacy name-based export requests remain supported.
- KPIs are ordered revenue, ordered units, shipped revenue/units, shipped COGS, gross profit (shipped revenue less shipped COGS), gross margin, customer returns and return ratio. Money is accumulated in integer paise from SQL decimal text; output remains numeric within safe reporting precision. Signed values are retained. Legacy null metrics are unknown, not zero.
- A selected range is compared with the immediately preceding inclusive range of the same calendar-day length. If either range lacks an observed report day, comparison is unavailable, not zero. Observed-day coverage is a signal of possible missing data, not proof that every seller or ASIN report is complete.
- Change uses (current - prior) / abs(prior); zero and missing denominators return null. Return ratio and margin changes are percentage points. Margin and return ratio require positive denominators.
- Month/week/day matrix is calculated once on the server. ISO week-years use UTC calendar dates. A week crossing a month is split into non-overlapping month segments so totals add up. Segment WoW compares the same calendar weekdays seven days earlier; DoD uses the exact preceding date; MoM compares complete calendar months. Row-level trends require observed revenue for the relevant dates. No missing-day zero assumptions are made.
- Seller grouping uses SellerId, not seller name. Unmatched records remain in global totals, grouped by original sheet brand with DB seller displayed as a dash. The existing catalog apply helper resolves at most one catalog row per fact.
- Current page export uses the same seller-ID/manager intersection and search filter, selected date range, grouping and analytics rules. XLSX includes matrix and summary sheets (metrics, prior window and observed-day coverage); CSV contains the matrix. Exports are live queries, not a persisted snapshot of the page, so concurrent imports can change totals. Missing cells display as a dash, observed zero remains zero. XLSX failures do not create mislabeled CSV files.

## Release gates

- Run existing Phase 1/2 route, ingestion and SQL Server regressions plus Phase 3 analytics unit tests and Playwright UI regressions.
- Reconcile signed revenue, split-week and year-boundary subtotals, observed-zero versus absent-data cells, seller scope, manager/search filters, and unmatched values with real staging reports. Verify exported workbook values against screen selections with no concurrent imports.
- The earlier OOS browser regression is still an open release risk; do not mark it fixed based on GMS-only tests.

## Deferred to Phase 4 / Phase 6

The service reads scoped facts and aggregates in Node; server-side SQL aggregation/pagination, large export streaming, indexes, performance benchmarks, report completeness tracking and cross-module integration are not complete. Dashboard, revenue targets, OOS and other legacy readers have not been migrated to this service in this PR. No production data or database schema changes are performed.
