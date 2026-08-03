# PEMS Module — Architecture & Implementation Plan

> **Author role:** System Architect
> **Date:** 2026-08-03 · **Branch:** `arena/019fc604-retailops`
> **Input:** `docs/pems-backend-report.md` (17 verified findings, referenced as F1–F17 below)
> **Decisions locked with stakeholders:** Scope = correctness + complete automation · API contracts **aligned** to the frontend (no back-compat shims) · DB reachable — idempotent migrations applied & verified · Frontend touch-points included.

---

## 1. Vision & Goals

Make PEMS a dependable execution engine, not a scaffold:

1. **Correctness** — the data written is the data read: Department persisted, filters actually filter, completion timestamps accurate, cache never serves stale rows.
2. **Automation completeness** — the module's own promises work end-to-end without a human poking the API: recurring tasks materialize, SLA escalations fire on a schedule, emails reach inboxes.
3. **Contract truth** — backend responses match what the frontend consumes (`IsRuleTask`, `REWORK`, bulk transitions).
4. **Hardening** — no partial writes, no version collisions, no duplicate notifications, no auth holes.
5. **Verifiable** — every workstream lands with automated tests + a manual verification checklist.

Non-goals: new features beyond the module's intended behavior (no new analytics dashboards, no AI, no marketplace integrations).

---

## 2. Architectural Principles

| Principle | Consequence |
|---|---|
| **Layered, single-responsibility** | Controllers stay thin; logic in services; domain math in `workflowEngine`/new pure modules |
| **Idempotent, versioned migrations** | Every schema change ships as a numbered migration tracked in `SchemaMigrations`; auto-applied at startup, manually runnable via CLI |
| **Everything automatable is scheduled** | Recurrence, SLA escalation, notifications run on cron/queues — never only via POST handlers |
| **Writes are atomic** | Multi-row flows run in SQL transactions via a shared `withTransaction` helper |
| **Cache is a namespace** | Route caches are registered per namespace; invalidation deletes by namespace — key format bugs become impossible |
| **Align contracts, no shims** | The API returns what the UI needs; breaking changes are coordinated in one release (this plan) |
| **Fail soft on infra** | Email/SMTP down, Redis down, DB blips → logged, never fatal (existing global guards) |
| **Config over code** | Schedules, emails, RBAC toggle via env/SystemSettings with sane defaults |

---

## 3. Gap Map (Report Findings → Workstreams)

| # | Finding (report) | Severity | Workstream |
|---|---|---|---|
| F1 | `createInstance` drops Department | High | WS-1 |
| F2 | `getInstances` ignores department/frequency filters | High | WS-1 |
| F3 | `CompletedAt` never set (dead switch case) | High | WS-1 |
| F4 | Cache invalidation patterns don't match keys | Med-High | WS-0 (cache namespaces) |
| F5 | No recurring instance materialization | Med-High | WS-3 |
| F6 | `sla-escalation` queue never fed | Med-High | WS-3 |
| F7 | Email service dead code | Med | WS-3 |
| F8 | `_isRuleTask` vs `IsRuleTask` mismatch | Med | WS-2 |
| F9 | `REWORK` review decision collapsed | Med | WS-2 |
| F10 | Event-store version race | Med | WS-4 |
| F11 | Duplicate SLA notifications | Med | WS-3 |
| F12 | Duplicate `getFilterOptions` export | Low-Med | WS-2 |
| F13 | "Merged" notifications not merged | Low | WS-2 |
| F14 | Multi-insert flows not transactional | Low | WS-4 |
| F15 | `live-tasks` TOP 15 hardcoded | Low | WS-2 |
| F16 | live-data routes lack auth | Low | WS-4 |
| F17 | 1+N in `getInstanceById` | Info | WS-4 (bounded) |

---

## 4. Target Architecture

### 4.1 Request path (unchanged layering, corrected internals)

```
React (src/modules/pems) ── pemsApi.js ──► Express routes ──► controllers ──► services ──► SQL Server
        ▲                                        │  auth + requirePermission        │
        │                                        └── cache middleware (namespaces)  └── withTransaction
        └── Socket.IO (task_status_changed, pems-notification)
```

### 4.2 Background execution (new)

```
node-cron (schedulerService)
 ├─ hourly   ──► PEMS recurrence job ──► recurrenceService.generateDueOccurrences()   [new]
 ├─ */30 min ─► SLA escalation job   ──► queueService.add(SLA_ESCALATION) ──► processor ──► pemsService.checkEscalations() + emails
 ├─ (existing pipelines / backups / auto-tags unchanged)
 └─ eventBus ──► eventHandlers ──► PEMS_NOTIFICATION queue ──► createNotification + emailNotificationService (re-wired)
```

### 4.3 Cache (namespace registry)

```
cacheRoute('pems:instances', 30)          → registers keys under namespace
invalidateNamespace('pems:instances')     → deletes every key in namespace (Redis scan OR in-memory registry)
eventHandlers / routes call namespaces, never hand-written patterns
```

### 4.4 Data model additions (migration `004_pems_v4`)

```
PemsTaskTemplates   + LastGeneratedAt, NextScheduledDate        (recurrence)
PemsTaskInstances   + LastSlaWarningAt, LastSlaBreachAt          (dedup)
PemsRecurrenceLog   (Id, TemplateId, InstanceId, OccurrenceFor, Status, UNIQUE(TemplateId, OccurrenceFor))
PemsTaskEvents      + UNIQUE INDEX (TaskInstanceId, Version)
SchemaMigrations    (Id, Name, AppliedAt)                        (migration tracking)
Indexes: IX_PemsInstances_FrequencyStatus (Frequency, Status)
         IX_PemsTemplates_FrequencyActive (Frequency, IsActive)
```

---

## 5. Workstreams

### WS-0 — Foundations (enables everything)

**Files:** `backend/database/migrate.js` (new), `backend/migrations/004_pems_v4.js` (new), `backend/services/cacheService.js`, `backend/middleware/cache.js`, `backend/database/db.js`, `backend/__tests__/unit/…`

1. **Migration runner**
   - New `SchemaMigrations(Id, Name, AppliedAt)` table.
   - `backend/database/migrate.js` — runs all `backend/migrations/0*.js` in order, skipping applied; idempotent; safe to re-run.
   - Wired into `server.js` startup after DB connect, gated by `RUN_MIGRATIONS_ON_STARTUP !== 'false'`; also exposed as `node backend/scripts/runMigrations.js` for manual/dev use.
2. **Transaction helper** — `withTransaction(async (tx) => …)` in `db.js` (mssql `pool.transaction()` with begin/commit/rollback + logger).
3. **Cache namespaces** — `cacheService.registerNamespace(name)`, `cacheService.invalidateNamespace(name)`; `cacheRoute(name, ttl)` uses `key('route', name, path)`; invalidations become namespace calls. Fixes F4 structurally (no hand-written patterns). Keep `delPattern` for legacy callers but migrate PEMS off it.
4. **Test harness** — backend already has jest + supertest. Add `backend/__tests__/integration/` support with a dedicated `DB_NAME=retailops_test` (env-driven) and a `beforeAll` that runs migrations + seeds a fixture set. Verify `npm test` green before/after every WS.

### WS-1 — Data integrity & API correctness (F1, F2, F3)

**Files:** `backend/services/pems/pemsService.js`, `backend/services/pems/workflowEngine.js` (no change), tests.

1. **F1 — Department persisted.** `createInstance`: add `department` input → `Department` column. Source priority: explicit payload → template's `Department` → `'Operations'`. Also backfill note: existing rows keep default; no mass update needed.
2. **F2 — Filters actually filter.** `getInstances`:
   - Add `AND i.Department = @department` branch (input already bound in `applyFilterInputs`).
   - Add `AND i.Frequency = @frequency` branch + binding (currently absent).
   - Extend the sort whitelist with `Department`, `Frequency` (cheap win).
   - Document supported filters in the route comments.
3. **F3 — Completion timestamps.** Rewrite the `switch` in `transitionStatus` with explicit `if` blocks:
   - `APPROVED` → `ReviewedAt = now, CompletedAt = now, ReviewStatus = 'APPROVED'`
   - `REJECTED` → `ReviewedAt = now, CompletedAt = NULL, ReviewStatus = 'REJECTED'`
   - `UNDER_REVIEW` → `ReviewedAt = now`
   - Add a unit test asserting `CompletedAt` set only on APPROVED.
4. **Tests:** unit tests for `createInstance` (Department fallback), `getInstances` WHERE-builder (department/frequency), `transitionStatus` timestamp matrix.

### WS-2 — Contract alignment (F8, F9, F12, F13, F15)

**Files:** `backend/services/pems/pemsService.js`, `backend/controllers/pems/pemsController.js`, `backend/routes/pems/pemsRoutes.js`, `backend/services/pems/notificationMergeService.js`, `backend/controllers/pems/dashboardController.js`, tests.

1. **F8 — Rule-task contract.** Bridge rows get `IsRuleTask: true` (keep `_isRuleTask` for internal use). Frontend `PremiumTaskRow` badge + "hide transitions" logic now works without frontend change.
2. **F9 — REWORK honored.** `submitReview`: `decision === 'REWORK'` → `transitionStatus(…, 'REWORK', …, feedback)` (sets `ReviewStatus='REJECTED'`, increments `ReworkCount`). Add test: review decision matrix.
3. **F12 — dedupe export.** Remove the second `getFilterOptions` (line ~357); keep the v3 one (with departments/targetTypes/…). Route behavior unchanged.
4. **F13 — real merge.** `getMergedNotifications`: `UNION` PEMS notifications with legacy `Notifications` table (existing source — `notificationController`), `Source = 'PEMS' | 'LEGACY'`, order by `CreatedAt DESC`, apply `TOP @limit` after union. Unread count from both.
5. **F15 — live-tasks pagination.** `GET /dashboard/live-tasks?limit=`: default 15, max 50, validated integer.
6. **New: bulk transition endpoint (enables frontend bulk bar).**
   - `POST /api/pems/instances/bulk/transition` — body `{ ids: string[], toStatus, details? }`.
   - Service `bulkTransition(ids, toStatus, actor…)`: for each id — validate `canTransition`, transition, collect `{ id, ok }` / `{ id, skipped, reason }`; returns `{ updated, skipped }`.
   - Route registered **before** `/instances/:id` to avoid path shadowing.
   - Frontend `pemsApi.bulkTransition()` + `TaskInstancesPage` bulk Approve/Reject uses it (WS-5).
7. **Tests:** review-decision matrix, merged-notifications union, bulk transition partial-success semantics.

### WS-3 — Automation engine (F5, F6, F7, F11)

**Files:** `backend/services/pems/recurrenceService.js` (new), `backend/services/schedulerService.js`, `backend/jobs/queueDefinitions.js`, `backend/jobs/processors.js`, `backend/services/pems/pemsService.js`, `backend/services/pems/emailNotificationService.js`, `backend/emails/index.js`, migration `004`, tests.

1. **F5 — Recurrence engine.**
   - `recurrenceService.generateDueOccurrences(now)`:
     - Select active templates where `Frequency != 'ONE_TIME'` and (`NextScheduledDate IS NULL OR NextScheduledDate <= now`).
     - For each: compute `occurrenceFor = NextScheduledDate ?? getNextDueDate(frequency, customCron, template.CreatedAt)`.
     - Guard: skip if `PemsRecurrenceLog` already has `(TemplateId, OccurrenceFor)` (idempotent).
     - `createInstance` from template defaults (title, priority, SLA, reviewer, sub-tasks) inside one transaction; write `PemsRecurrenceLog` row + set `Template.NextScheduledDate = getNextDueDate(…)` (customCron parsed with **`cron-parser`** — new dependency, tiny & pure).
     - Batch cap per run (e.g., 100) to bound cost.
   - Scheduler: hourly `0 * * * *` job in `schedulerService` → `recurrenceService.generateDueOccurrences()` (try/catch, logged).
   - Config: `PEMS_RECURRENCE_ENABLED !== 'false'` (default on).
2. **F6 — SLA escalation on schedule.**
   - Scheduler: `*/30 * * * *` → `queueService.add(QUEUES.SLA_ESCALATION, {})` (the processor already exists — this is the missing producer).
   - Gate: `PEMS_SLA_ESCALATION_ENABLED !== 'false'`.
3. **F11 — Notification dedup.**
   - `checkEscalations` reads `LastSlaWarningAt` / `LastSlaBreachAt`:
     - Warning to assignee only if `LastSlaWarningAt` older than 12 h (or NULL).
     - Breach to assignee only if `LastSlaBreachAt` older than 24 h (or NULL).
   - Update the columns after notifying; store in same transaction as notification insert.
4. **F7 — Email pipeline.**
   - Extend `PEMS_NOTIFICATION` queue payload with `{ taskId }` (worker fetches task row).
   - Processor: after `createNotification(...)`, call `emailNotificationService.triggerNotification(type, task, userId, { message, actionUrl })` fire-and-forget with `.catch(log)`.
   - Gate `PEMS_EMAIL_ENABLED === 'true'` + SMTP config present; otherwise log "email skipped (not configured)" once.
   - Wire the same for SLA breach/warning path (assignee + reviewer/manager per existing logic).
5. **Tests:** recurrence next-occurrence math (incl. customCron), idempotency (log-guard), dedup window logic, processor email call (mocked `emailService`).

### WS-4 — Hardening (F10, F14, F16, F17)

**Files:** `backend/database/db.js`, `backend/services/pems/pemsService.js`, `backend/services/pems/eventStore.js`, `backend/routes/pems/liveDataRoutes.js`, `backend/middleware/requirePermission.js` (new), `backend/controllers/pems/pemsController.js`, tests.

1. **F14 — Transactions.**
   - `createInstance`: wrap instance + subtasks + activities + counts + audit + recurrence-log write in `withTransaction`.
   - `completeSubTask`: wrap update + progress recompute + event-store append.
   - `submitReview`: wrap review insert + transition.
2. **F10 — Event-store version safety.**
   - `append` runs inside a transaction with `SELECT MAX(Version) … WITH (UPDLOCK, HOLDLOCK)` on the task's event rows, then insert.
   - Migration adds `UNIQUE (TaskInstanceId, Version)`; on duplicate-key error, retry once (or log + skip — event is best-effort today).
3. **F16 — live-data auth.**
   - Add `auth` middleware to all `/api/live-data/*` routes (they expose file/job endpoints; align with the rest of the module). Frontend already attaches tokens via pemsApi defaults — verify `fetchLiveData` API calls include credentials; if the UI hits these, no break.
4. **F17 — bounded N+1.**
   - `getInstanceById`: replace per-subtask activity queries with a single `WHERE SubTaskId IN (…)` fetch + in-memory grouping. Evidence/reviews/audit stay single queries (already are).
5. **RBAC (beyond findings, aligned with locked scope "hardening").**
   - `backend/middleware/requirePermission.js` — `requirePermission('tasks_manage')` etc., keyed to existing permission names used in `App.jsx` routes (`tasks_view`, `tasks_manage`).
   - Enforce on write routes: create/update/delete template → `tasks_manage`; transition/submit-review → authenticated + entity rule (assignee, reviewer, or `isGlobalUserRole(req.user.role)`); read routes → `tasks_view`.
   - Policy helpers in `backend/services/pems/pemsPolicy.js` (new, pure, unit-testable).
   - Frontend `rbac.js` already gates buttons — backend enforcement is additive; no UI regression expected.
6. **Tests:** policy matrix, event-store concurrent append (two parallel appends → distinct versions), createInstance rollback on forced failure.

### WS-5 — Frontend alignment

**Files:** `src/modules/pems/services/pemsApi.js`, `src/modules/pems/pages/TaskInstancesPage.jsx`.

1. `pemsApi.js`: add `bulkTransition(ids, toStatus, details)` → `POST /api/pems/instances/bulk/transition`.
2. `TaskInstancesPage.jsx`: bulk bar Approve/Reject calls `bulkTransition` once, then `message.success('X of N tasks updated')` using the response `{ updated, skipped }` (replace the current `Promise.allSettled` loop).
3. Confirm no other frontend deltas needed: `IsRuleTask` badge now lights up automatically; department/frequency chips already send params that will now actually filter; `PremiumTaskRow` unchanged.

---

## 6. Data Model — Migration `004_pems_v4` (DDL sketch)

```sql
-- Migration tracking
IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
  CREATE TABLE SchemaMigrations (Id VARCHAR(50) PRIMARY KEY, Name NVARCHAR(200) NOT NULL, AppliedAt DATETIME2 DEFAULT dbo.GetEnvDate());

-- Recurrence
ALTER TABLE PemsTaskTemplates ADD LastGeneratedAt DATETIME2 NULL, NextScheduledDate DATETIME2 NULL;
CREATE TABLE PemsRecurrenceLog (
  Id VARCHAR(50) PRIMARY KEY,
  TemplateId VARCHAR(50) NOT NULL,
  InstanceId VARCHAR(50) NOT NULL,
  OccurrenceFor DATETIME2 NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'CREATED',
  CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
  CONSTRAINT UQ_PemsRecurrence UNIQUE (TemplateId, OccurrenceFor)
);

-- SLA notification dedup
ALTER TABLE PemsTaskInstances ADD LastSlaWarningAt DATETIME2 NULL, LastSlaBreachAt DATETIME2 NULL;

-- Event-store integrity
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PemsTaskEvents_TaskVersion')
  CREATE UNIQUE INDEX UX_PemsTaskEvents_TaskVersion ON PemsTaskEvents(TaskInstanceId, Version);

-- Query support
CREATE INDEX IX_PemsInstances_FrequencyStatus ON PemsTaskInstances(Frequency, Status) INCLUDE (Department, DueDate);
CREATE INDEX IX_PemsTemplates_FrequencyActive ON PemsTaskTemplates(Frequency, IsActive) INCLUDE (NextScheduledDate);
```

All statements idempotent (`IF NOT EXISTS` / column-existence guards), matching the existing migration style.

---

## 7. API Change Spec

| Endpoint | Change |
|---|---|
| `GET /api/pems/instances` | `department` and `frequency` query params now filter (was silently ignored) |
| `POST /api/pems/instances/bulk/transition` | **New** — `{ ids[], toStatus, details? }` → `{ updated: number, skipped: [{ id, reason }] }`; `400` if `ids` empty/`toStatus` unknown |
| `POST /api/pems/reviews` | `decision: 'REWORK'` now transitions to `REWORK` (was REJECTED) |
| `GET /api/pems/dashboard/live-tasks` | `?limit=` (1–50, default 15) |
| `GET /api/pems/notifications/merged` | Now returns `Source: 'PEMS' \| 'LEGACY'` union |
| `GET /api/pems/instances` (rule tasks) | Bridged rows now carry `IsRuleTask: true` (plus `_isRuleTask`) |
| `POST /api/pems/instances/:id/transition` | `CompletedAt` set on APPROVED (timestamp contract fix) |
| `POST /api/live-data/*` | Now behind `auth` |
| Templates/instances write routes | Now behind `requirePermission` (`tasks_manage` / entity rules) |

Breaking-change callers: none in-repo besides the frontend (which we update in WS-5) — verified `pemsApi.js` is the only consumer of these endpoints.

---

## 8. Scheduler Additions (schedulerService)

| Job | Cron | Action | Gate |
|---|---|---|---|
| `jobs.pemsRecurrence` | `0 * * * *` | `recurrenceService.generateDueOccurrences()` | `PEMS_RECURRENCE_ENABLED !== 'false'` |
| `jobs.pemsSlaEscalation` | `*/30 * * * *` | `queueService.add(QUEUES.SLA_ESCALATION, {})` | `PEMS_SLA_ESCALATION_ENABLED !== 'false'` |

Both registered in `scheduleJobs()` alongside existing jobs; guarded try/catch; logged at debug level when disabled. No new queues required (SLA_ESCALATION exists; recurrence runs inline in the cron like the legacy recurring scheduler).

---

## 9. Testing Strategy

| Layer | What | Tooling |
|---|---|---|
| Unit | workflowEngine (exists) · recurrence math · dedup windows · policy matrix · transition timestamps · cache namespace builder | jest |
| Integration (DB-backed) | migration runner idempotency · createInstance Department + rollback · getInstances filters · bulk transition partial success · merged notifications · live-tasks limit | jest + supertest + `retailops_test` DB |
| Event-store concurrency | parallel appends → unique versions | jest |
| Manual (checklist, §13) | full PEMS flows through the UI | browser + curl |

Add `"test:integration"` script (jest config split) so `npm test` stays fast (unit only) and integration runs on demand / CI with `DB_NAME=retailops_test`.

---

## 10. Rollout & Deployment

1. **Branch & review** — all WSs land on `arena/019fc604-retailops` in order WS-0 → WS-5, each with tests green (`npm test` + lint).
2. **Dev DB** — `node backend/scripts/runMigrations.js` → verify `SchemaMigrations` rows; run integration suite against `retailops_test`.
3. **Staging** — deploy backend + frontend together (contract-aligned release). Set env: `RUN_MIGRATIONS_ON_STARTUP=true`, `PEMS_EMAIL_ENABLED=false` (until SMTP verified), recurrence + SLA escalation on.
4. **Verification** — run manual checklist (§13); watch logs for `PEMS recurrence` / `SLA escalation` job lines; confirm emails after enabling SMTP.
5. **Rollback** — migrations are additive (new columns/tables only; no destructive changes) → rollback = revert code, keep schema (safe). Feature gates let ops disable recurrence/escalation/email instantly without redeploy.

---

## 11. Milestones & Sequencing

| Milestone | Workstreams | Rough size | Exit criteria |
|---|---|---|---|
| **M0** | WS-0 foundations | S | Migrations tracked; `withTransaction`; cache namespaces; integration harness runs |
| **M1** | WS-1 | S | Department/filters/CompletedAt fixed; unit tests green |
| **M2** | WS-2 | M | Contracts aligned; bulk endpoint; merged notifications; live-tasks limit |
| **M3** | WS-3 | L | Recurrence + SLA cron + emails live on dev; idempotency proven |
| **M4** | WS-4 | M | Transactions, event-store uniqueness, auth, RBAC; integration suite green |
| **M5** | WS-5 | S | Frontend uses bulk endpoint; end-to-end manual checklist passes |
| **M6** | Rollout | S | Migrations applied to dev/staging; gates configured; docs updated |

Dependencies: M0 → everything; M1/M2 independent after M0 (can parallelize); M3 needs M1 (createInstance correctness) and M0; M4 independent; M5 needs M2.

---

## 12. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Migration auto-apply breaks startup on prod | Low-Med | `RUN_MIGRATIONS_ON_STARTUP` env gate; migrations idempotent; dry-run CLI flag |
| Recurrence job creates duplicate instances | Med | `PemsRecurrenceLog` unique constraint + pre-check inside transaction |
| Email pipeline spams on misconfig | Med | `PEMS_EMAIL_ENABLED` gate + SMTP presence check + dedup windows |
| RBAC locks legitimate users out | Med | Default-open for existing roles (`isGlobalUserRole`), permission names already in route config; staged rollout with audit log |
| `cron-parser` dependency | Low | Tiny pure lib; fallback = existing `getNextDueDate` switch if customCron parse fails |
| Integration tests need DB in CI | Med | Tests skip gracefully when `DB_NAME=retailops_test` unreachable (documented) |
| Contract change breaks other consumers | Low | Verified only consumer is in-repo frontend; release frontend+backend together |

---

## 13. Manual Verification Checklist (end of M5/M6)

- [ ] `POST /api/pems/instances` with `department:'Catalog Team'` → row has Department; `GET /instances?department=Catalog Team` returns it
- [ ] `GET /instances?frequency=WEEKLY` returns only weekly instances
- [ ] Transition task to APPROVED → `CompletedAt` populated; `ReviewedAt` populated; timeline shows "Done"
- [ ] Transition REJECTED → `CompletedAt` NULL
- [ ] Review with `REWORK` → status `REWORK`, `ReworkCount` +1
- [ ] Select 3 tasks (one in non-transitionable state) → bulk Approve → `updated:2, skipped:1`
- [ ] Create/edit/delete template → list refreshes immediately (cache namespace invalidation)
- [ ] Bridged rule task shows "Auto" badge; no Start/Submit buttons
- [ ] Wait for hourly cron (or trigger) → next occurrence of a DAILY template created; running it twice creates nothing new
- [ ] Set a task due in <24 h → SLA warning notification; rerun escalation 1 h later → no duplicate warning
- [ ] `/dashboard/live-tasks?limit=5` returns ≤5
- [ ] `/api/live-data/metrics` without token → 401
- [ ] Non-`tasks_manage` user cannot create template (403)
- [ ] `npm test` green; integration suite green on `retailops_test`

---

## 14. Decision Log / Open Items

| # | Decision | Status |
|---|---|---|
| D1 | Scope = correctness + automation (locked) | ✅ |
| D2 | Contracts aligned, no shims (locked) | ✅ |
| D3 | Migrations auto-applied at startup + CLI (locked) | ✅ |
| D4 | Recurrence runs inline in hourly cron (no new queue) | Proposed — OK? |
| D5 | Add `cron-parser` dependency for CustomCron | Proposed — OK? |
| D6 | RBAC: `requirePermission` on write routes + entity rules | Proposed — OK? |
| D7 | Email gate default OFF until SMTP verified | Proposed — OK? |
| D8 | Integration tests target `retailops_test` DB, skip when unreachable | Proposed — OK? |

Proposed items are flagged for a quick sign-off; nothing blocks M0/M1.
