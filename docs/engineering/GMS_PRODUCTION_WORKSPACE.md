# GMS production workspace stabilization

## Product decisions
The report defaults to the revenue matrix. A compact summary and coverage indicator replace the oversized KPI/warning stack. Detailed metric trends and current/prior financial comparison are in Financial analysis. A single observed metric value gets a snapshot instead of a misleading chart. An explicit latest-observed-day button changes the date selection only when clicked. No missing date is filled with artificial zero.

The matrix uses combined ASIN and title cells, separate DB seller and sheet brand, selectable financial columns, full-period totals, server-side sorting, and a row-detail drawer. Monthly columns are bounded to one observed year and weekly/daily columns to one observed month. Calendar controls change presentation, not the report date range. The existing server pages and complete report export contract are preserved.

## Backend
- The existing analytics response adds every selected-period financial metric plus row-level baseline, changes and observed-day coverage. SQL sorting supports all nine metric keys, keeps nulls last, and uses a stable entity key tie-breaker. No new financial formula or fact migration.
- Interactive analytics and export queries use the same bound literal text-search predicate; large seller scopes use a single JSON parameter instead of one SQL parameter per seller. Interactive requests have a 120-second cooperative timeout.
- Streaming XLSX package verification reads each entry's exact compressed range from central-directory metadata, checks local header identity, then decompresses and verifies uncompressed size, CRC and XML. Retain sheet/row checks and atomic file publication. A failed integrity check must not publish a workbook. This addresses the observed streaming validation failure path; the original corrupt production file has not been inspected.
- Deny access to generated export files through the public upload mount. GMS progress events target the owner room; the authenticated download route still enforces ownership.
- Explicit accessible action labels distinguish template, error reports, export and import history. Preserve staged imports and complete Excel/CSV exports.

## Release gates
GMS Phase 1 and Phase 2 CI must pass, including existing conventional/streamed workbook tests, tampered CRC, scope and SQL reconciliation, mobile layout and dialog/browser tests. Check the actual production shell at desktop and mobile widths. Generate fresh Excel and CSV files in staging and open the Excel file in desktop Excel. Reconcile every stored metric with the selected report and full export. Run the 100k/500k disposable SQL benchmark and representative production-concurrency tests before asserting capacity. Historical export calculations still materialize facts in Node; the output writer is bounded but full source streaming remains outstanding. OOS regression is separate and Phase 6 is deliberately postponed. No production deployment or data change is performed by this PR.
