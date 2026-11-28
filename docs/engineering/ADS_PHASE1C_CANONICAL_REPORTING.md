# Ads Phase 1C: canonical reporting cutover, first increment

Depends on the corrected Phase 1B writer PR #285. This PR is based on its head while #285 is still open. Merge #285 first after its CI passes; then refresh and review this PR. No production import is enabled.

## Canonical read path

GET /api/ads/canonical-report and GET /api/ads/canonical-options require adsreport_view and authenticate. Report scope is applied directly to persisted fact SellerId, using strict rejection of mixed unauthorized selections. Date ranges must be valid, ordered and at most 366 days. Prior period uses the immediately preceding equal-length calendar days, not chart buckets. Daily facts are the only source; weekly and monthly are display granularity, not separate source report types.

A serializable read transaction materializes one bounded date/seller/filter scope in connection-local temp tables. Seller/marketplace/currency/entity grouping prevents shared ASIN collisions. Catalog lookup is correlated on seller and ASIN and collapses duplicate catalog matches without multiplying facts; ambiguous/unmapped metadata is null, counted, and parent grouping falls back to the fact ASIN when no valid parent is mapped. If the parent column is absent, explicit parent grouping is rejected. Brand/category filters apply to the same scoped fact population across totals, prior period, series, and table. Search matches literal ASIN, SKU, title and selected entity. Options are scoped even on an empty database.

Currency groups remain separate. Exact aggregate text, nullable metrics and paired coverage reuse the Phase 1B projection and shaper. Prior-only entities remain in the table, with current data null; there is no zero fill. SQL pagination uses authoritative count, page clamp, stable tie order and null-last allowlisted additive sorting. Ratio sorting, flags, target allocation, revision cache, complete workbook, and advanced analytics remain subsequent work. Sorting all currencies together compares nominal numeric values only; use a currency filter for meaningful financial ranking. Drill-down requires explicit authorized seller, marketplace, currency and entity. No raw source records are exposed by these endpoints.

## Frontend

The existing /ads-manager route renders the new canonical workspace by default; the legacy workspace is retained behind an explicit navigation button with a warning that its data and exports are separate. Uses existing Ant Design components and global date picker; displays current/prior summaries per currency, history buckets, seller/brand/category/currency filters, ASIN/parent/seller grouping, server-paged table, drill-down and validation modal. Exact numeric strings are not converted to JavaScript Number. Coverage status is displayed for summary and table metrics. No sample data is fabricated.

## Release gates / outstanding

This is not a completed Phase 1C activation. The existing legacy endpoints, dashboard cards, target reporting, export and AI are not switched to canonical facts yet. The live write endpoint remains disabled; no import or catalog update is added. An explicit second cutover must migrate or retire those consumers, validate actual catalog/seller ownership and production schema, connect the permission-gated writer with confirmation, and reconcile the supplied report end to end. Use a disposable SQL database for integration. Tests cover strict filters, shared ownership, duplicate catalog mapping, prior-only entities, null and signed amounts, stable page clamp, currency separation, and granularity. Frontend CI runs a build; live browser acceptance and production performance are still pending.
