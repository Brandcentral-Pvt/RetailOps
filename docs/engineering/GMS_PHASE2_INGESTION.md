# GMS Tracker Phase 2 - Controlled ingestion rollout

## Contract

- CSV, XLS, XLSX; exactly one worksheet; 25 MB, 100,000 data rows, 64 columns per batch. The cap is intentional until memory/load benchmarks exist. Split larger reports.
- Only Amazon India (IN) daily snapshots are accepted; all six metrics and ASIN/date/brand/store headers are required. Missing or malformed values are rejected, not zero-filled. Currency adjustments may be signed; quantities are nonnegative integers.
- Preview uses a bounded worker thread, normalized rows persisted to SQL, and a snapshot of existing facts. No fact write occurs at preview.
- Identical duplicates collapse; different values for the same legacy ASIN/date within a report reject the entire batch. Mapping must be unique, active, authorized and Amazon India. Existing rows with conflicting owner/store are rejected. Ownerless historical facts are never overwritten with guessed attribution.
- A valid preview expires in 24 hours. Confirmation queues the persisted payload; repeated confirmation is idempotent. The server worker uses a transaction-owned SQL application lock, rechecks current access and mapping plus the snapshot, then commits facts and status in the same transaction. Terminal states clear the staged payload.
- History is owner-scoped, latest 50 batches; preview contains up to 20 accepted samples and first 200 validation issues. Issue report is JSON. History retention/paging beyond this is future work.
- Legacy immediate-write upload endpoint returns 409. Global clear is deliberately paused (409 for authorized global users) pending a coordinated administrative recovery/deletion workflow; pending batches can be cancelled.
- Migration 091 adds staging and missing compatibility columns, with no historical attribution or metric backfill. GMS read/export joins respect verified fact ownership when present. Other consumers still use legacy identity; do not introduce multi-seller/store facts until Phase 3 cross-module reconciliation.

## Release gates

1. GMS Phase 1 Regression, GMS Phase 2 Ingestion (unit, route, isolated SQL Server, build/browser) and cross-module regressions must pass.
2. Inspect the deployed fact schema, constraints, SQL compatibility level (OPENJSON requires 130+), and data quality in a staging database. Back up before applying migration. Exercise real Amazon reports and representative maximum-size reports.
3. Verify seller reassignment and existing ownerless fact conflicts, queue restart/recovery, scope revocation and explicit cancellation. Verify all consuming modules reconcile. Do not merge or deploy simply because a preview renders.
4. Existing OOS grid browser regression (missing seller name) remains separate and must be resolved or formally risk-assessed before release.

## Deferred

Multi-store/currency warehouse identity and historical owner reconciliation, true period comparisons, server-side pagination, larger report streaming and full history retention policy. No production records or deployment are modified by this branch.
