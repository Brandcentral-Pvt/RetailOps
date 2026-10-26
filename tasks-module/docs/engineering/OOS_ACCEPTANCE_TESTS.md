# OOS-RECON-001 Task View: mandatory acceptance matrix

Record each test as **PASS, FAIL, BLOCKED** with source file, test file, command, observation and artifact. A manually asserted PASS without reproducible evidence does not satisfy release readiness. P0 failures block activation.

## Task view architecture and existing task regression

| ID | Level | Scenario and acceptance criterion |
|---|---|---|
| TV-01 | P0 | A task whose saved definition is OOS_RECON_V1 renders the specialized OOS view in the SAME PEMS task context. |
| TV-02 | P0 | A generic task still renders the original generic tabs, SOP, evidence, statuses and reviews. |
| TV-03 | P0 | View resolution is based on the template/version association, not a chain of TemplateCode string comparisons in TaskWorkspace. |
| TV-04 | P0 | Unknown/untrusted widget key falls back read-only, never evaluates code or exposes privileged action. |
| TV-05 | P0 | Editing a template after task creation does not change that task's view definition, evidence requirements or historical data. |
| TV-06 | P0 | Task view opened from My Day, Task List and Review Queue preserves the same instance ID and active seller scope. |
| TV-07 | P0 | One multi-brand task links to all and only its assigned seller/channel runs; reopening is idempotent. |
| TV-08 | P1 | Existing generic affected-ASIN remarks updates the intended code/signal and does not access foreign sellers. |
| TV-09 | P1 | Task View handles loading, empty, stale, error, rejected, review and no-permission states without crashes. |
| TV-10 | P1 | Accessible keyboard, focus, responsive mobile layout and stable large-grid scroll behavior. |

## Uploads and reconciliation

| ID | Level | Scenario and acceptance criterion |
|---|---|---|
| UP-01 | P0 | Assigned executor can upload actual BrandCentral original file bytes via the OOS task; out-of-scope executor cannot. |
| UP-02 | P0 | Vendor upload required ONLY when the correctly scoped channel/fulfillment policy says applicable; N/A requires stored policy/reason. |
| UP-03 | P0 | Server calculates original file checksum; client-provided SHA/hash cannot override the server digest. |
| UP-04 | P0 | Missing quantity remains NULL/UNKNOWN, not zero; actual zero is OOS_ZERO. |
| UP-05 | P0 | Duplicate ASIN with multiple SKUs, duplicate rows and ambiguous seller-channel joins are surfaced, never silently overwritten by positive quantity. |
| UP-06 | P0 | Re-upload creates versioned evidence or an idempotent duplicate, never erases original report/history. |
| UP-07 | P0 | Invalid type/size/row count/schema rejects with explicit reason and no partial corrupt run; accepted/rejected rows are reproducible. |
| UP-08 | P0 | Marketplace unavailable + independent positive stock does not become IN_STOCK without marketplace verification. |
| UP-09 | P0 | The candidate union finds RetailOps-unavailable AND report-only zero-stock ASINs. |
| UP-10 | P0 | Missing/stale sources do not become confirmed OOS or resync eligible; exception and provenance retained. |
| UP-11 | P0 | Two sellers with same ASIN and distinct channel reports never exchange stock, status or file data. |
| UP-12 | P1 | Every accepted file has source timestamp, checksum, uploader identity, mapping, revision and rejected rows for auditing. |

## GMS 80%/20% and New ASIN business rules

| ID | Level | Scenario and acceptance criterion |
|---|---|---|
| GM-01 | P0 | Pareto denominator uses seller's WHOLE eligible active catalog, not only affected OOS records. |
| GM-02 | P0 | Smallest cumulative 80% cohort selected on descending GMS; the boundary crossing ASIN is included, tie ordering deterministic. |
| GM-03 | P0 | Existing ASIN in mathematical top cohort is visibly `80%`; verified other existing ASINs are visibly `20%`. |
| GM-04 | P0 | A verified New ASIN ALWAYS has visible group `20%`, separate New label and authoritative first-seen/launch evidence. |
| GM-05 | P0 | High-GMS New ASIN still shows `20%` but preserves calculated top-80 membership and a high-GMS New exception. |
| GM-06 | P0 | Missing GMS for an existing ASIN shows Priority Pending/GMS Unverified, not 20%. |
| GM-07 | P0 | Unknown age does not mean New. Age policy is explicit/versioned; no hardcoded newness threshold silently accepted. |
| GM-08 | P0 | Source GMS joins never double-count across sellers, marketplace or time window. |
| GM-09 | P0 | API table, summary counts, CSV and four-sheet XLSX show the same frozen group, New flag and rule. |
| GM-10 | P1 | Filters `80%`, `20%`, `New ASINs (20%)`, `GMS unverified` produce correct server counts across pagination. |

## Resync and incident lifecycle

| ID | Level | Scenario and acceptance criterion |
|---|---|---|
| SY-01 | P0 | Insufficient or stale positive report evidence blocks any resync request. |
| SY-02 | P0 | Out-of-scope or unauthorized resync returns 403, and cannot trigger any provider call. |
| SY-03 | P0 | A queued job is dispatched via existing provider adapter; idempotency collapses duplicates. |
| SY-04 | P0 | QUEUED/RUNNING state cannot close an incident or be labeled recovered. |
| SY-05 | P0 | Wrong seller/marketplace/ASIN, older timestamps, FAILED/timeout, unchanged OOS observation all leave incident OPEN. |
| SY-06 | P0 | Client-submitted `state=IN_STOCK` + recent timestamp never resolves by itself. Only backend-fetched, later authoritative observation can. |
| SY-07 | P0 | Only actual verified later in-stock observation results in VERIFIED_RECOVERED + atomic incident resolution. |
| SY-08 | P0 | Manual incident resolve/waive requires authorized identity, evidence/reason and audit, cannot mask still-unavailable stock. |
| SY-09 | P1 | Simultaneous attempts under clustered workers and quota/lock contention do not dispatch duplicate live-sync jobs. |
| SY-10 | P1 | Retry/failure/status displayed from persisted durable job, not in-memory success/toast. |

## Excel-style ASIN grid, exports and review

| ID | Level | Scenario and acceptance criterion |
|---|---|---|
| GR-01 | P0 | Affected ASINs tab includes original-source upload, validation, full source comparison, resync and export without leaving task context. |
| GR-02 | P0 | Server sort/filter/page returns accurate total and exact authorized task/seller scope. |
| GR-03 | P0 | Filtered/selected/full export contains exact scope including matches outside currently visible page, never foreign seller data. |
| GR-04 | P0 | XLSX contains EXACT sheets `01 Active OOS`, `02 Discrepancies`, `03 Resync Resolved`, `04 Summary & Sources`. |
| GR-05 | P0 | All four sheets contain usable flat columns with source quantities, GMS group, New flag, cases, follow-ups and provenance; not giant JSON fields. |
| GR-06 | P0 | Untrusted string starting `=`, `+`, `-`, `@` is neutralized in CSV/XLSX to prevent formula injection. |
| GR-07 | P0 | Immutable export stores version, server digest/hash, task/run association, source hash manifest, generated by/on and filter/scope. |
| GR-08 | P0 | Task submission with missing uploads, unclassified candidates, no export or unowned open incidents is blocked on backend. |
| GR-09 | P0 | Executor's Submit cannot set APPROVED/CLOSED; only authenticated independent PEMS reviewer decision can. |
| GR-10 | P0 | API forging reviewerId, same-user self-review or calling generic direct transitions cannot bypass reviewer requirement. |
| GR-11 | P0 | Reviewer-approved daily monitoring may close while open incidents with owner, communications and follow-up remain OPEN. |
| GR-12 | P0 | A failed/rejected review leaves task editable for rework and preserves earlier evidence/history. |
| GR-13 | P1 | Mobile users can open all source detail and download controlled exports, no inaccessible horizontal controls. |
| GR-14 | P1 | Large-catalog pagination/export remains stable and does not load entire seller dataset into browser memory. |

## Release and operational gates

| ID | Level | Scenario and acceptance criterion |
|---|---|---|
| RL-01 | P0 | `DLY-004` code, active status, SOP, history and routine creation logic unchanged. |
| RL-02 | P0 | `OOS-RECON-001` remains INACTIVE and AutoAssign OFF by default after implementation. |
| RL-03 | P0 | No implicit production API call, seller email, automated resync or migration triggered by tests/build. |
| RL-04 | P0 | Forward migration succeeds on staging and is safe to re-run; historical data remains intact. |
| RL-05 | P0 | No cross-tenant data leakage from task, OOS run, source upload, incident, export or review endpoints. |
| RL-06 | P1 | Root lint/typecheck/build, backend Jest, targeted Playwright and relevant regression tests run; failures and missing infra fully documented. |
| RL-07 | P1 | Feature rollout, rollback and logging/monitoring notes reviewed before real seller/policy activation. |

**Release classification:** P0 not passed -> NOT READY. P0 passed only under mocks -> ENGINEERING COMPLETE / INTEGRATION UNVERIFIED, not production ready. Live adapter, database migration, reviewer identity and first-seen policy require staging evidence and independent approval before activation.
