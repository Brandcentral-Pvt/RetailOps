# Ads Phase 1C: consumer cutover and controlled activation

Baseline: main 6fe1c88, prior canonical report deployed. This PR adds confirmed import, scoped full-entity XLSX export, canonical seller/month targets, and retires legacy Ads HTTP paths and workspace. The report is daily v1 only. No historical legacy rows are copied or deleted.

## Activation

Default is fail-closed: set ADS_CANONICAL_IMPORT_ENABLED=true in the backend runtime only after CI, schema verification (migration 098), catalog ownership and seller currency verification. Use the existing JWT_SECRET for domain-separated confirmation signatures. Validation requires every source ASIN to match exactly one catalog entry for the selected seller. The report itself does not prove seller origin; the operator must select the correct seller. Confirm reuploads the same bytes, uses a short-lived actor/seller/hash/context-bound server signature, and repeats strict validation, catalog ownership and context checks inside the writer. The old unconfirmed upload stays blocked. An identical replay is safe; differing historical facts reject the entire transaction. No automatic catalog creation. Persistent import jobs/history and downloadable issue reports remain Phase 2.

## Export

Authenticated view + export permission; direct private temporary XLSX download, no public path. One SQL transaction reads the same population as report; ignores UI page and returns all matching entities, up to 5,000; rejects above the bound rather than truncating. Summary, scope, current/prior entities and history sheets include numeric values and coverage; exact values outside Excel precision remain text. All 63 raw source fields and durable export job/history/streaming source rows are Phase 5. Sorts group currencies before monetary values.

## Targets

Seller/month targets scoped using fact ownership and authorized seller selection. Explicit monthly target overrides yearly month allocation; same-priority duplicates are marked conflict, not summed. Seller marketplace/currency verified from configured context. No attainment on partial months, unknown or partial coverage, or zero target; ACoS lower is better. Seller targets are not compared against filtered subsets. Targets with no facts still appear.

## Legacy retirement

Old Ads overview/table/series/history/report/filter-options/insights/AI and /data/ads-manager, /data/ads-report, /export/start-ads return 410 after permission checks. The canonical workspace is the only routed Ads UI; external/mobile clients using retired payloads must migrate. Saved views/preferences remain stored, advanced AI remains Phase 7. Main dashboard/target achievement compatibility migration is tracked in the companion changes. Other non-Ads report/goal consumers of the legacy table need their own scope/contract review before being switched; do not point them at canonical facts via ASIN-only joins.

## Verification

Disposable tests for token mismatch, ownership, exact replay, target precedence/coverage, workbook numeric values and all matching entities. Production data and live browser acceptance have not been verified. Deployment does not enable imports automatically.
