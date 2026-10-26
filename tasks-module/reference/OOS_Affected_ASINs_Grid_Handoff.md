# OOS-RECON-001: Affected ASINs Grid and Excel Contract

**Status:** Design and implementation specification, not deployed.  
**GitHub reviewed:** `Brandcentral-Pvt/RetailOps`, `main` at `9cbee6385c72c27bb83884352de2e8574b7b9754`.  
**Legacy compatibility:** Preserve `DLY-004` and the generic `PemsTaskAsins` tab for other tasks.

## 1. Design decision

The `OOS-RECON-001` Task View should use a specialist `OosReconciliationGrid` in the **Affected ASINs** tab. It is hosted by `SharedTaskShell` and reads task-bound OOS decisions, observations, resync jobs, GMS priority and incidents, not only `PemsTaskAsins`. The same authorized canonical dataset backs the UI and the four-sheet Excel export. The in-drawer view is compact with horizontally scrollable columns; expanded view permits high-volume operation.

The underlying **DataGrid** UI primitive is reusable for future Task Views, while column schemas, row data, actions, filters and export formats are template-owned. Other templates do not inherit OOS-specific stock fields or resync controls.

## 2. Excel-style column dictionary

| Group | Fields | Formatting / evidence | Default view |
|---|---|---|---|
| Identity | Seller name and ID, marketplace, fulfillment channel, ASIN, SKU, product title | Sticky ASIN and seller identifiers; click ASIN opens full row evidence | Seller, ASIN, SKU |
| RetailOps | Raw availability, normalized state, stock if independently known, observation timestamp, age and freshness | Red for unavailable, amber for stale/unknown; read-only snapshot | Availability |
| BrandCentral | Quantity, source inventory status, file ID, upload version, source timestamp, mapped SKU | Missing is Unknown, never zero | Quantity |
| Vendor Central | Quantity, source status, applicability, file/version/timestamp | Vendor may be N/A based on channel policy; never combine incompatible stock scopes | Quantity |
| Performance | ASIN GMS, seller eligible-catalog GMS, contribution %, cumulative %, priority group (`80%` / `20%`), ASIN lifecycle (`NEW` / `EXISTING` / `UNKNOWN`), first-seen timestamp, GMS confidence, GMS date window | Seller-wide 80/20; display UNVERIFIED if missing | GMS + Pareto |
| Classification | Result, rule ID, confidence, exceptions, incident ID | CONFIRMED_CHANNEL_OOS, DISCREPANCY, INSUFFICIENT_EVIDENCE, RESYNC_VERIFIED, etc. | Classification |
| Resync | Eligibility, job status, request time, verified post-sync status and observation time | No client-entered recovery evidence and no auto-closure based on QUEUED | Job status |
| Follow-up | Owner, seller communication status, replenishment ETA, next follow-up, next action, remarks | Restricted edit capabilities and permanent audit events | Owner, follow-up, next action |

## 3. Interaction design

- Search ASIN/SKU/title/owner, seller- and channel-scoped filters, classification tabs, 80% group, 20% group, New ASINs, GMS-unverified, incident status, resync stage and overdue follow-up filters.
- Column presets: Essential, Inventory + GMS, Resolution & Follow-up, All details. Server-side pagination and sorting for real datasets; do not export only the rendered page inadvertently.
- Row selection and bulk export of authorized rows. Batch marketplace resync is a separate privileged operation, requires eligibility and audit, and may not be conflated with generic row selection.
- Click an ASIN for side-panel detail with exact source-file provenance, ingestion revision, reconciliation rule, timestamps, incident history, sync evidence and who took each decision.
- Counts for each filter tab must come from the same server-side task-scoped query as the table, not be computed from the page of results alone.
- On mobile, show a compact ASIN/card list; opening a row reveals all source details. Do not squeeze 22+ columns into the mobile viewport.
- Provide distinct export actions: `Download filtered CSV`, `Generate 4-sheet XLSX`, `Download latest XLSX`, and `Export history`, plus a clearly stated export scope.

## 4. Suggested task-bound API

```
GET  /api/pems/instances/:taskInstanceId/oos/affected-asins
  ?sellerId=&channel=&classification=&priorityGroup=&isNew=&gmsVerification=&resyncStatus=&incidentStatus=&ownerId=&search=&sortBy=&sortOrder=&page=&limit=
GET  /api/pems/instances/:taskInstanceId/oos/affected-asins/summary
GET  /api/pems/instances/:taskInstanceId/oos/affected-asins/:caseId
POST /api/pems/instances/:taskInstanceId/oos/exports
  body: { scope: 'ALL_AUTHORIZED'|'CURRENT_FILTER'|'SELECTED', filters?, caseIds?, format: 'XLSX'|'CSV' }
GET  /api/pems/instances/:taskInstanceId/oos/exports/:exportId/download
GET  /api/pems/instances/:taskInstanceId/oos/exports
```

These are **proposed endpoints**, not current GitHub routes. The existing `/api/oos` routes are building blocks but are not task-instance bound. All API requests must authorize the task instance, the requested seller/marketplace/channel and the workflow operation on the server. Do not send arbitrary seller IDs as trusted task scope.

## 5. Excel output schema

One immutable versioned `.xlsx` per export, containing these four worksheets:

1. `01 Active OOS`: Active, confirmed channel-specific stockouts with source comparison, GMS/priority and replenishment owner.
2. `02 Discrepancies`: Stock mismatches and insufficient-evidence cases, including resync results and unresolved actions.
3. `03 Resync Resolved`: Recovered cases, with before/after marketplace observations and verified recovery evidence.
4. `04 Summary & Sources`: Per-seller counts, complete-catalog GMS denominator, extraction/report file manifest, validation exceptions, policy and export provenance.

All sheets must have flat row-oriented fields, Excel filters, frozen headings, currency/percentage/date formats, and explicit `Unknown` or blank values for missing source data. Never stuff serialized evidence JSON into a single cell as a substitute for the needed row fields. Prevent formula injection in CSV/XLSX strings beginning with `=`, `+`, `-`, `@`.

For implementation, place `taskInstanceId`, `runId`, export scope, seller/channel set, source hashes, policy version, window dates, generated-by, generated-at, version and checksum in an immutable export manifest; expose this in UI metadata and auditor detail. The sample workbook provided here contains **fictional data only**.

## 6. Blocking dependencies

1. Build durable PEMS task-instance ↔ OOS run links, including one multi-brand task mapping to multiple seller runs.
2. Fix resync execution: queued OOS jobs must use the existing scoped live-sync engine and rate gate.
3. Fix resync verification: fetch independent post-sync evidence server-side, and resolve incidents *only* on verified recovery.
4. Implement genuine independent reviewer action via PEMS Review Queue, not a preparer-supplied reviewer ID.
5. Enforce source applicability, freshness and validation of uploaded originals before classification and export.
6. Persist per-affected-ASIN 80% / 20% priority group, with a verified New ASIN override and full-catalog denominator for a frozen snapshot.
7. Add permission-scoped row mutation, export manifest, versioned original upload storage and tests for exports beyond one table page.
8. Retain historical view/column schema snapshots by template version. Do not retroactively change existing task execution evidence when a template is edited.

## 7. Prototype/testing scope

- `prototype/Template_Specific_Task_View_Preview.html`: interactive local-only illustration with search, filters, column presets, sorting, pagination, ASIN evidence drilldown and CSV demo export.
- `prototype/OOS_Affected_ASINs_Illustrative_Example.xlsx`: four sheet sample workbook with fictional ASINs and correctly separated source quantities; Seller GMS share uses Excel formulas.
- This prototype is **not connected to the actual RetailOps backend** and does not trigger uploads, sync, immutable production XLSX or approval.

## 8. Revised priority policy (approved display terminology)

**Visible priority groups: `80%` and `20%`.** Never display `Tier 1`, `Tier 2` or `STANDARD` as customer-facing priority group labels. Distinguish these groups from `GMS_UNVERIFIED`, which is a **data-quality flag**, not a third Pareto group.

1. Compute the 80% GMS cohort independently for each seller using that seller's **whole eligible active catalog**, in descending GMS order. Do not calculate it solely from OOS ASINs.
2. Existing ASINs in the verified 80% cumulative-GMS cohort belong to the **80% group**. Other existing ASINs with verified GMS are **20%**.
3. **All verified New ASINs are classified in the 20% group**, including new listings with absent or zero GMS, per the business rule. Preserve an independent `isNew` or `asinLifecycle` flag, an authoritative `firstSeenAt` / launch date, and an `asinNewRuleApplied` flag. The threshold/definition of *new* must be approved as a configurable policy; the example dates are fictional and not a production threshold.
4. When an existing ASIN has missing GMS, keep `GMS_UNVERIFIED`; do not falsely label it 20% on the assumption it sold little. The user-facing grid can show **Priority pending** and a separate GMS-verification flag until corrected.
5. If a verified New ASIN contributes enough GMS to enter the mathematically computed top-80% cohort, retain the computed `pareto80Member` for audit, apply the New ASIN **20% display override**, and surface an exception so significant new products are not silently deprioritized.
6. Filters must expose **80%**, **20%**, **New ASINs (20%)**, and **GMS unverified**. CSV and all four XLSX tabs must use the same server-frozen priority decision and expose `ASIN type`, `First seen`, `GMS verification`, `Priority group` and `Priority rule`.

Suggested normalization (on the backend, not client):

```js
const computedPareto80Member = verifiedGms && top80AsinSet.has(asin);
const priorityGroup = isVerifiedNewAsin
  ? '20%'
  : !verifiedGms ? null
  : computedPareto80Member ? '80%' : '20%';
const priorityRule = isVerifiedNewAsin ? 'NEW_ASIN_TO_20'
  : !verifiedGms ? 'GMS_UNVERIFIED'
  : computedPareto80Member ? 'GMS_TOP_80' : 'GMS_REMAINDER_20';
```

**Implementation note:** Current repository code still uses `TIER_1`, `STANDARD` and `GMS_UNVERIFIED` internally. This revised policy is a design requirement, **not a claim that GitHub behavior already changed**. Migration must update the server-side projection and export, not only rename a badge.
