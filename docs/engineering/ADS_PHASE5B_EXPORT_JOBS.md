# Ads Phase 5B export jobs

## Architecture

The Ads export configuration submits an asynchronous job. The primary backend worker claims a SQL lease, revalidates permissions and seller access, generates the canonical report, verifies it, and publishes the artifact as private SQL chunks. Downloads revalidate access and verify SHA-256. Existing synchronous canonical export remains available for legacy clients. No external queue or object storage dependency is introduced.

The API supports POST/GET `/api/ads/export-jobs`, GET `/api/ads/export-jobs/:id`, POST `/api/ads/export-jobs/:id/retry`, POST `/api/ads/export-jobs/:id/cancel`, and GET `/api/ads/export-jobs/:id/download`. Jobs belong to their creator. UI stages reflect actual worker state rather than estimated percentages.

## Deployment

Deploy migration `105_ads_export_jobs.js` using the normal backend migration process and verify `dbo.AdsExportJobs` and `dbo.AdsExportChunks` exist. Start the primary backend worker with the normal Ads worker startup configuration. Verify both view and export permissions on test users. `ADS_EXPORT_RETENTION_DAYS` defaults to seven days (allowed range 1–30). Expired artifacts and orphan chunks are cleaned by the worker; metadata remains for history. Monitor SQL storage and transaction log growth, worker logs, job age and failures, and temporary filesystem capacity.

Background limits: 50 active jobs globally, three per owner, two concurrent leases, three processing attempts, 30 minute processing deadline, 2 million raw daily rows, 250,000 comparison or ASIN analytical entities, and 512 MiB per artifact. Excel worksheets partition at 1,048,575 data rows plus header. These are enforced ceilings, not throughput guarantees. Synchronous limits remain unchanged.

## Report semantics

XLSX includes the existing canonical workbook and full portfolio, segment, concentration, product rank, opportunities, reconciliation, data quality, budget, target and manifest sheets. CSV includes full daily source records and exact numeric text. All history uses actual stored bounds and no invented prior period. Custom dated ranges remain limited to 366 days. Seller-wide budget and target analytics use their own month-to-date cutoff and are not applicable to all-history or product-filtered scopes; the workbook explicitly labels this. The canonical export snapshot is acquired at processing time, not enqueue time. Retrying a job can capture newer data. Reconciliation retains complete counts with bounded discrepancy examples.

## Release verification

Run the Ads workflow, including canonical workbook tests, SQL export-job lifecycle tests and Playwright Ads layout tests. In staging, submit both formats and check current filters, multiple sellers, custom dates and all history. Confirm the Download Center survives refresh, retry and cancellation work, revoked access is rejected, expired files are unavailable, and totals agree with canonical reporting. Open the resulting workbook in desktop Excel without repair warnings. Exercise partition boundaries and benchmark representative 10k, 100k, 250k, 500k and 1m-row workloads against production-like SQL and disk resources before raising capacity or rolling out unrestricted access. Record runtime, peak memory, SQL/tempdb impact and artifact size. These production-like benchmarks and desktop Excel checks are not established by the small CI fixtures.

## Rollback

Revert the application PR and deploy the prior frontend/backend together. Stop the export worker before any schema maintenance. Leave the additive tables intact to preserve job metadata and artifacts; do not drop them during application rollback. The legacy synchronous canonical export path is retained. Investigate queued or leased jobs before resuming the worker.
