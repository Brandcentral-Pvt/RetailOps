# GMS Tracker final release checklist

Baseline: main 4a93249d244c15b01588f5c3c6e0b04c7361f939 (merged PR 274). Verified prior CI: GMS Phase 1 backend passed; GMS Phase 2 disposable SQL passed; production frontend build passed; 85/87 backend tests and 9/11 browser tests passed. Two streamed workbook failures and two browser locator failures remained. The independent OOS grid seller-label regression remains outside GMS scope.

## Required automated checks

| Area | Required evidence |
|---|---|
| Schema | Additive repair of migrations 091-095 and read-only schema check, idempotency, nullable seller and original title storage |
| Security | View/import/export permissions, owner-scoped import history and downloads, seller restrictions, bound dates/search/sorts, private static export guard, no global clear bypass |
| Import | Real XLS/CSV validation, blank metrics become zero, negative values preserved, missing ASIN accepted for global importer, duplicate/conflict checks, explicit confirmation, stale-preview rejection, atomic commit, title retention, 100,001-row XLSX/CSV fixtures |
| Error reports | All detected issues with source row and ASIN, understandable correction remarks, CSV formula protection, real Excel output CRC/row verification, owner-only downloads |
| Analytics | Exact signed monetary totals, nine financial metrics, previous calendar period, observed-day coverage, null/zero distinction, ISO week boundaries, seller grouping, unmatched facts and late catalog assignment |
| Matrix | Full-filter totals independent of pagination, global sort keys, month/year bounds, full metrics and row details, latest observed-date action, filter reset, mobile overflow |
| Export | Full selected detail plus all analytical sheets, previous period data, same scoped search as UI, real signed values, verified conventional and compressed streaming XLSX, exact binary HTTP download, truncated/mislabeled/tampered ZIP rejection, raw CSV |
| Frontend | Build, native presentation and download integrity unit tests, all Playwright GMS scenarios with real assertion targets |
| Scale | Two independent disposable SQL integration jobs, 100,000 and 500,000 synthetic financial facts. Compare full record count, signed total, page boundary, response size and measured query time. This is not a production concurrency or max-size import benchmark. |

## Streaming XLSX compatibility correction
The locked ExcelJS 3.10.0 stack uses archiver 4.0.2, compress-commons 3.0.0 and crc32-stream 3.0.1. Its buffered DEFLATE entry path passes the final buffer directly to end(buffer), while the checksum/size accounting lives in an overridden write(). Modern Node Writable.end(buffer) bypasses that override. A native DeflateRaw reproduction confirmed that end(buffer) reports 0 counted bytes for 9 decompressed bytes, whereas write(buffer); end() correctly reports 9. This explains the previous CI size/CRC failure path. The actual original corrupt production file was not available.

Use a workbook-local compatibility adapter: store buffered OPC metadata entries (including initial constructor entries) without compression, while retaining compressed worksheet streams. No global monkey patches or checksum bypass. Both GMS workbook output and import error reports use this adapter. The existing integrity gate remains mandatory. Regression checks read a complete streamed workbook back, confirm the metadata/worksheet compression methods, inspect the last wide-sheet cell, and verify all error rows. Reassess/remove the adapter when upgrading the locked ExcelJS/archive dependencies.

## Manual release acceptance (do not mark passed without evidence)

- Merge only when the latest PR's automated checks pass. Confirm deployed commit and GET /api/health/gms on the target environment.
- With an authorized global user, open GMS, select an actual uploaded date, compare all nine totals against the approved source report. Confirm unmatched records remain in global totals. Check a restricted account independently without sharing its credentials.
- Generate a fresh complete Excel workbook and CSV, download through the authenticated Downloads drawer, open the Excel file in Microsoft Excel desktop (no repair/extension warnings), verify all sheets, signed numeric values and row counts; generate a rejected-report Excel/CSV and verify remarks and ASINs.
- Check desktop and mobile production shell layout, date/filter controls, matrix pagination, row drawer, chart gaps, import/history and export forms.
- Benchmark production-representative concurrent reads, imports and exports on staging; inspect query plans, tempdb, disk, worker memory and download timings. Historical complete exports still materialize facts/matrix in Node. A 500k SQL analytics fixture does not prove 500k-file ingestion or historical export capacity.
- Keep Phase 6 separate until release acceptance is complete. Do not modify financial records to satisfy a test. No live production access is assumed.

The checks in this document are release requirements, not assertions that the new PR passed. Record the final workflow run IDs, benchmark outputs, desktop Excel result and deployed commit before signing off.
