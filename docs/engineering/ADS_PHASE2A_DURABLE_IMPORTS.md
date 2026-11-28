# Ads Phase 2A: durable previews and history

Stacked on production recovery PR #288. Deploy and verify 098 first.

## Scope

Migration 099 adds AdsImportJobs. The authenticated owner and current seller assignment are required for listing, detail, confirmation, cancellation and error downloads. Global roles may see their own jobs only. New previews validate the original 63-field CSV and check selected-seller catalog mapping. A valid preview stores the exact source bytes privately in SQL for up to 24 hours, and its SHA-256 and validation summary in the history record. Failed validation stores the detected issues but no source payload. The UI shows up to 100 issues, and the downloadable workbook retains up to 10,000; larger reports explicitly disclose this cap. Fatal parsing errors stop scanning. Catalog mapping errors are one issue per affected ASIN, not per repeated date.

READY can become COMPLETED, FAILED, CANCELLED or EXPIRED. REJECTED is terminal. The existing transactional writer locks the job before staging, then verifies its source hash, seller and context. Facts and COMPLETED status are committed atomically. Identical historical facts are unchanged; conflicts reject the entire transaction. Connection failures leave READY available for safe retry if the transaction rolled back; history is authoritative if a response is lost. Repeated confirmation of a completed job returns the stored result. No raw source bytes appear in API responses. Terminal states clear source bytes; a primary-worker sweep expires abandoned previews each minute. The pending capacity is three per owner and 50 globally, maximum 32 MiB each. Terminal summary/error retention has no automated deletion in this increment.

The previous one-shot confirm endpoint returns 409; clients must update. Validation remains possible with ADS_CANONICAL_IMPORT_ENABLED=false. Job confirmation remains synchronous in this increment, so a long operation can block the request; history refresh/retry reconciles the final result. No fake processing percentages. Durable background queue, worker leases/recovery, per-stage progress, full streaming issue retention, retention policy and load testing are Phase 2B.

## Release checklist

Merge 288 first, then 289 after required checks. Verify /api/health/ads and /api/health/ads-imports return 200. Validate the real 96,900-row report against the correct seller with writes disabled. Confirm catalog ownership and configured marketplace/currency. Enable imports only after production acceptance. First import must reconcile all 63 fields and source totals; replay must insert zero new facts. Test cancellation, expiry, forbidden access, invalid CSV, and XLSX errors. No production database or real report import has been executed by this PR.
