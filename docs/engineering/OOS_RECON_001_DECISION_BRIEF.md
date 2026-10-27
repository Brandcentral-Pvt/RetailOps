# OOS-RECON-001 decision brief (D1-D10)

**Prepared:** 2026-10-27<br>
**Status:** Draft for owner decision. No decision below is approved.<br>
**Purpose:** Give each owner a concrete default, the consequence of delay and the
task that consumes the decision, so Phase 2-8 work does not start on assumptions.

> These are engineering recommendations, not business, finance, security or
> compliance rulings. The named owner must record the actual decision, including
> any change from the recommendation. Until then, the dependent task stays
> blocked and production remains contained with `OOS-RECON-001` inactive.

## 1. Decision table

| ID | Decision | Recommended default | Why / consequence | Owner | Needed before |
|---|---|---|---|---|---|
| D1 | New ASIN definition and first-seen source | Use the first persisted catalog observation (`FirstSeenAt`) from the seller catalog; 30-day window; Asia/Kolkata; inclusive boundary; persist source and rule version. If no catalog observation exists, fall back to the provider launch date and mark the provenance. Never infer new-ASIN status from an OOS run. | Auditable and reproducible; avoids treating a missing provider date as "new". Delay blocks the 80/20/New policy and grid tests. | Product + Data | OOS-026 / Phase 4 |
| D2 | GMS source, window, currency and denominator | Seller-level GMS from the finance-approved source; trailing 30 complete days; INR; denominator is the full eligible seller catalog, not only OOS cases; unknown GMS is excluded from the 80% numerator and remains `GMS_UNVERIFIED`; persist source, window, denominator and classification version. | Makes 80/20 reproducible and prevents missing GMS being treated as zero. Delay blocks the metrics model and policy. | Product + Finance | OOS-023 / OOS-026 |
| D3 | Vendor report applicability and channel mapping | Apply Vendor Central only to eligible `amazon.in` sellers with report access. Map VC rows by ASIN; use SKU only when it resolves uniquely within the seller catalog; reject unmatched or ambiguous rows with a reason; never guess a mapping. | Prevents cross-seller/ASIN contamination and false reconciliation. Delay blocks merge rules and fixtures. | Product + Ops | OOS-026 / Phase 4 |
| D4 | Reviewer independence and delegation | The submitter cannot approve. The reviewer must be a different active user with the review capability and task/brand scope. Delegation is allowed only to an equally scoped reviewer, must be recorded, and cannot be self-delegation. | Enforces independent review; affects submission and closure gates. Delay blocks OOS-040 and the review E2E. | Ops + HR/Compliance | OOS-040 / Phase 7 |
| D5 | Export sheet columns, retention and PII | Freeze the four sheet names: `01 Active OOS`, `02 Discrepancies`, `03 Resync Resolved`, `04 Summary & Sources`. Product approves columns per sheet. Store generated files privately outside the web root; retain bytes for 90 days and audit metadata for 13 months, or the company records-retention period if longer. No public URLs; no seller/customer data in logs. | Defines the export contract and storage model; avoids PII sprawl. Delay blocks migration 038 and export tests. | Product + Security | OOS-035 / Phase 5-6 |
| D6 | Upload limit and storage backend | 50 MB hard cap; private staging disk or private object storage; 10,000 data rows per sheet and 20 sheets per workbook; reject oversize, wrong type, spoofed extension/MIME and excess worksheets. Lower to 20 MB only if Ops confirms the smaller limit is sufficient. | Bounds memory/disk use and parser cost; supports immutable originals. Delay blocks upload transport and validation. | Platform + Security | OOS-018 / Phase 3 |
| D7 | Brandless multi-brand access semantics | Assignment-only by default. Brand scope is granted only explicitly. A reviewer sees only tasks they are assigned to review. No global "all brands" access merely because a task is brandless. | Conservative authorization; prevents a brandless task becoming a cross-tenant leak. Delay blocks OOS-013. | Product + Security | OOS-013 / Phase 2 |
| D8 | Resync SLA and rate budget | 30-second request timeout; at most 2 retries with exponential backoff; one concurrent resync per seller; respect the shared provider rate gate and daily budget. On timeout/failure, leave the incident open and surface retry state; never resolve on elapsed time. | Prevents false recovery and provider abuse. Delay blocks resync scheduling and failure tests. | Ops + Data | OOS-032 / Phase 5 |
| D9 | Incident waiver authority | Ops lead may waive with Compliance approval; written reason and evidence; maximum 7-day expiry; no self-waiver; waivers are visible on the task and audited. Expired waivers do not permit closure. | Keeps closure defensible and auditable. Delay blocks OOS-042 and closure-gate tests. | Ops + Compliance | OOS-042 / Phase 7 |
| D10 | Cutover mode, pilot and fallback | Per-template and per-task feature flag, default off. Pilot one non-critical seller for 14 days after G7/G8. Keep `TaskWorkspace` as the immediate fallback; the flag-off path must restore it without a deploy. No production activation before G9. | Limits blast radius and gives a tested rollback. Delay blocks OOS-044 and the Phase 8 integration. | Product + Engineering | OOS-044 / Phase 8 |

## 2. Decision record template

Copy this block into the tracker for each decision:

```text
Decision ID:
Decision (one sentence):
Owner:
Decision date:
Approved by:
Rationale:
Alternatives considered:
Affected task / phase:
Implementation constraint:
Evidence or source of truth:
Review/expiry date (if any):
Link to written approval:
```

## 3. Minimum sequence

| Order | Decisions | Why |
|---|---|---|
| 1 | D7, D6 | Phase 2 authorization and Phase 3 upload work start first |
| 2 | D1, D2, D3 | Phase 4 policy and metrics need all three before implementation |
| 3 | D5, D8 | Phase 5/6 export and resync contracts |
| 4 | D4, D9 | Phase 6/7 review and waiver gates |
| 5 | D10 | Phase 8 cutover; last, because it depends on the earlier gates |

If an owner cannot decide by the needed-by point, record the delay and keep the
dependent task blocked. Do not implement a placeholder policy and call it
approved. The production default remains: no new OOS work, no activation, no
orphan repair, no `DLY-004` change.

## 4. Open questions owners should answer explicitly

- D1: Is a 30-day window from first catalog observation the business definition,
  or does the business use launch date? What happens when the catalog has no
  first-seen value?
- D2: Which finance source is authoritative for GMS, and does the denominator
  include ASINs with no OOS case and no stock observation? Are returns/credits
  netted?
- D3: Which sellers actually have Vendor Central access, and is Ajio in scope for
  vendor data or only RetailOps/Brand Central?
- D4: Which role is allowed to review when the task owner is the only person with
  the brand scope? Is external/agency review allowed?
- D5: Does the business need the workbook bytes retained, or only the audit
  metadata and row counts? Are seller names or customer data present in any
  source sheet?
- D6: What is the largest real report size and row count observed in the last 90
  days? Is object storage available in the target environment?
- D7: For brandless tasks, should a manager with brand scope see all assigned
  brands, or only the brands explicitly attached to the task?
- D8: What is the provider's actual per-account daily budget and the acceptable
  user-facing wait for a resync?
- D9: Who may waive outside business hours, and what is the maximum waiver
  duration Finance/Compliance will accept?
- D10: Which seller is safe for a pilot, and what is the business rollback
  trigger (error rate, stale data, user report)?

## 5. Evidence of a valid decision

A decision is recorded only when all of the following exist:

- The named owner has written the decision in the tracker or an approved memo.
- The decision states the source of truth, window/scope and any exclusions.
- The dependent task has updated its acceptance criteria to match.
- The plan, backlog and CSV do not contradict the decision.
- Any security or PII impact has a named reviewer.
- The decision date and reviewer are recorded; an undated chat message is not a
  decision.

Until then, the decision remains **Open**.
