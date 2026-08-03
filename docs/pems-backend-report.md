# PEMS Module — Complete Backend Report

> **PEMS** = Performance & Execution Management System
> **Report date:** 2026-08-03 · **Branch:** `arena/019fc604-retailops`
> **Scope:** All backend code serving the PEMS module (tasks, templates, reviews, dashboards, notifications, live data). Findings verified by direct code inspection (`grep`/read) on the current checkout.

---

## 1. Executive Summary

PEMS is a **task-orchestration engine** with a 12-state workflow, SLA tracking, escalation rules, reviews/approvals, notifications (in-app + email), scorecards, and an enterprise command-center dashboard. The backend is a classic layered Node.js/Express + SQL Server stack:

```
Frontend (React, src/modules/pems/*)
   │  fetch/JSON via pemsApi.js
   ▼
Express routes  (backend/routes/pems/*)
   ▼
Controllers     (backend/controllers/pems/*, + legacy tasksPage/task/aiTask controllers)
   ▼
Services        (backend/services/pems/*)
   ▼
SQL Server      (Pems* tables + Actions/Objectives bridge)
```

**Strengths**
- Clean layering (routes → controllers → services), parameterized SQL throughout (no raw string-concat injection in PEMS paths).
- Solid domain model: workflow state machine, SLA math, weighted progress, event sourcing (append-only `PemsTaskEvents`), audit logs.
- Good operational ergonomics: Redis route caching, Bull-style queues, cron scheduler, socket-based live updates, email templates, seed/demo tooling, unit tests for the workflow engine.
- Rule-engine bridge lets automated `Actions` appear inside the PEMS task list.

**Critical gaps found (details in §13)**
1. `createInstance` **never writes `Department`** → every wizard-created task defaults to `Operations`; the department filter in the list view silently returns nothing meaningful.
2. `getInstances` **ignores the `department` and `frequency` filters** the frontend sends (params are bound but never used in the WHERE clause).
3. `transitionStatus` has a **dead switch case** → `CompletedAt` is **never set** on approval (timeline/analytics that rely on completion timestamps are wrong).
4. **Redis cache invalidation is broken** — invalidation patterns (`route:/api/pems:instances*`) don't match real cache keys (`route::api:pems:instances`), so GET list/dashboard data goes stale up to TTL (30–120 s).
5. **No recurring instance materialization** — `FREQUENCIES` are metadata only; nothing ever creates the next occurrence of a DAILY/WEEKLY… template.
6. **`sla-escalation` queue is never fed** — escalation checks run only when a human hits `POST /api/pems/dashboard/check-escalations`.
7. **Email notification service is dead code** — `emailNotificationService.js` is never imported; the six polished email templates are never sent.
8. Rule-task bridge mismatch: backend sets `_isRuleTask`, frontend checks `IsRuleTask` → **Auto badge/behaviour lost** for bridged rule tasks.
9. `submitReview` collapses `REWORK` decision into `REJECTED` (REWORK review decision exists but is unused).
10. Minor: duplicate `getFilterOptions` export, `getMergedNotifications` doesn't actually merge, eventStore version race, `checkEscalations` re-notifies on every run.

---

## 2. Backend File Inventory (PEMS surface)

### 2.1 Routes (mounted in `backend/server.js`)
| Mount | File | Role |
|---|---|---|
| `/api/pems` | `routes/pems/pemsRoutes.js` (89 ln) | Main PEMS API: templates, instances, transitions, reviews, evidence, dashboards, notifications, dynamic data, seed |
| `/api/pems/dashboard/…` | `routes/pems/dashboardRoutes.js` (10 ln) | 3 consolidated enterprise endpoints (summary / live-tasks / activity-feed) — also re-registered inside pemsRoutes |
| `/api/live-data` | `routes/pems/liveDataRoutes.js` (26 ln) | Live-data import jobs (fetch/upload/progress/results/download/cancel) + V2 variants |
| `/api/live-sync-tracker` | `routes/pems/liveSyncTrackerRoutes.js` (12 ln) | Seller live-sync overview/trigger |
| `/api/tasks` | `routes/taskRoutes.js` (16 ln) | **Legacy** task endpoints (generate, list, update-status, assign, delete) |

### 2.2 Controllers
| File | Lines | Role |
|---|---|---|
| `controllers/pems/pemsController.js` | 406 | All main PEMS CRUD/transitions/dashboards/notifications |
| `controllers/pems/dashboardController.js` | 284 | Enterprise dashboard: `getSummary`, `getLiveTasks`, `getActivityFeed` (single-pass aggregate SQL) |
| `controllers/pems/liveDataController.js` | 681 | Live-data import engine (XLSX/CSV/fetch, Redis job store, V2) |
| `controllers/pems/liveSyncTrackerController.js` | 245 | Per-seller sync status/activity/trigger |
| `controllers/taskController.js` | 334 | **Legacy** ASIN-based task generation via `TaskAnalyzer` |
| `controllers/tasksPageController.js` | 323 | **Legacy** Objectives/Actions overview (`/api/pems/overview` era) — still consumed by the frontend Objectives view |
| `controllers/aiTaskController.js` | 121 | AI intent → enriched task creation (writes `Actions`, not `PemsTaskInstances`) |

### 2.3 Services
| File | Lines | Role |
|---|---|---|
| `services/pems/pemsService.js` | 1175 | **Core business logic** — templates, instances, transitions, subtasks, evidence, reviews, SLA, escalations, KPIs, notifications, assignment rules, weighted progress |
| `services/pems/workflowEngine.js` | 163 | Pure domain model: statuses, transitions, SLA calc, achievement/variance, next-due-date, escalation levels |
| `services/pems/eventStore.js` | 203 | Append-only event log (`PemsTaskEvents`) with versioned folding to current state |
| `services/pems/emailNotificationService.js` | 154 | **Dead code** — email templates exist but service is never imported |
| `services/pems/notificationMergeService.js` | 26 | "Merged" notifications endpoint (currently PEMS-only) |
| `services/pems/seedDemo.js` | 279 | Demo data seeding (templates + instances + SOP) |
| `services/eventBus.js` | 87 | In-process event emitter (task transitions, SLA, pipeline, auth events) |
| `services/recurringTaskScheduler.js` | — | **Legacy** hourly recurring generator for `Actions` (not PEMS templates) |
| `services/schedulerService.js` | 914 | Cron master: enterprise pipelines, live sync, backups, auto-tags, Octoparse recovery |

### 2.4 Jobs / Queues (`backend/jobs/`)
| File | Role |
|---|---|
| `queueDefinitions.js` | 7 queues: market-sync, keepa-sync, pipeline-run, auto-tag, **sla-escalation**, **pems-notification**, webhook-delivery |
| `processors.js` | Worker implementations (notification insert, escalation check, market/keepa sync, pipelines, auto-tags, webhooks) |
| `eventHandlers.js` | Event-bus listeners: cache invalidation, queue notifications, Socket.IO `task_status_changed` |

### 2.5 Migrations (SQL Server DDL, run idempotently)
| File | Content |
|---|---|
| `migrations/001_pems_schema.js` | Core tables: `PemsTaskTemplates`, `PemsTaskInstances`, `PemsSubTasks`, `PemsActivities`, `PemsEvidence`, `PemsTaskReviews`, `PemsTaskAuditLogs` |
| `migrations/002_pems_v2_schema.js` | Departments, progress columns, `PemsEscalationRules`, `PemsNotifications`, `PemsScorecards`, indexes |
| `migrations/003_pems_v3_schema.js` | Template v3 fields (version, complexity, auto-assign, criticality…), `PemsAssignmentRules`, weighted progress, approval-level fields |

### 2.6 Supporting
- `backend/emails/templates/pems/*` — 6 HTML email templates (assigned, submitted, approved, rejected, SLA breach, escalated).
- `backend/scripts/seed-tasks.js` — standalone CLI seeding of instances from 7 templates × 5 sellers.
- `backend/__tests__/unit/workflowEngine.test.js` — unit tests for transitions/SLA/achievement/progress.
- `backend/middleware/cache.js`, `backend/services/cacheService.js` — Redis route cache + invalidation.
- `backend/middleware/rateLimiter.js` — per-tier rate limits (recently fixed for express-rate-limit v8 IPv6 validation).

---

## 3. Database Schema

All PEMS tables are prefixed `Pems*` and created idempotently by the migration scripts (executed via `schedulerService` startup + `server.js`).

### 3.1 Core tables & relationships
```
PemsTaskTemplates (1) ──< (N) PemsTaskInstances ──< (N) PemsSubTasks ──< (N) PemsActivities
                              │   │   │                          │
                              │   │   └── PemsEvidence (per task/subtask/activity)
                              │   └────── PemsTaskReviews (per task, N reviews)
                              └────────── PemsTaskAuditLogs (per task, N logs)
PemsTaskInstances ──< PemsNotifications   (task-scoped notifications per user)
PemsTaskTemplates ──< PemsAssignmentRules (1:1 auto-assign config)
PemsScorecards — entity-level (seller/department/manager) rollups
PemsTaskEvents — append-only event log (event sourcing)
```

### 3.2 Key columns
**PemsTaskTemplates** — Id, TaskCode (unique `TPL-####`), Name, Description, Category, Department, Frequency, CustomCron, SLAHours (default 48), TATHours (default 24), Priority, TargetType, DefaultTarget, ExpectedOutput, ReviewerId, AssigneeRole, Activities (JSON), SubTaskDefinitions (JSON), Tags (JSON), IsActive, CreatedBy, TemplateVersion, ExecutionComplexity, EstimatedExecutionMinutes, AutoAssignEnabled, ReviewRequired, EscalationHours, CriticalityScore, AutomationEligible, TemplateOwnerId.

**PemsTaskInstances** — Id, InstanceCode (unique `TASK-####`), TemplateId (FK), SellerId/Name, AssignedTo/AssigneeName, ReviewerId/ReviewerName, Status, ReviewStatus, Department (default `Operations` — see bug #1), Frequency, Title, Description, Priority, Target, Achievement, AchievementPct, Variance, SLAStatus, SLAHours, DueDate, lifecycle timestamps (AssignedAt, AcceptedAt, StartedAt, SubmittedAt, ReviewedAt, CompletedAt), ReworkCount, SubmissionRemarks, ReviewRemarks, Tags, Attachments, SubTaskCount, ActivityCount, CompletedSubTasks, ProgressPct, WeightedProgressPct, ApprovalLevel, BackupReviewerId, ApproverCount, RequiredApprovals.

**PemsSubTasks / PemsActivities** — SOP decomposition with SortOrder/StepNo, IsMandatory, IsCompleted, CompletedAt/By, WeightagePct (v3 weighted progress), ReviewRequired, OwnerType.

**PemsEvidence** — FileName, FileUrl, FileType, FileSize, MimeType, Remarks, UploadedBy/Name, UploadedAt.

**PemsTaskReviews** — Decision (APPROVE/REJECT/REWORK), QualityScore, Feedback, ReviewChecklist (JSON), ReviewDurationMinutes.

**PemsTaskAuditLogs** — Action, FromStatus, ToStatus, ActorId/Name, Details, Metadata.

**PemsTaskEvents** — EventType, From/ToStatus, ActorId/Name, Payload (JSON), Version (per-task sequence).

---

## 4. API Reference

All endpoints require `auth` (JWT). `cacheRoute(n)` = Redis-cached GET for n seconds. `invalidateCache(pattern)` is applied on writes (see bug #4 — patterns currently don't match).

### 4.1 Templates — `/api/pems/templates`
| Method & Path | Controller fn | Notes |
|---|---|---|
| GET `/templates` | `getTemplates` | Paginated + filters (category, frequency, search, isActive) |
| GET `/templates/filters` | `getFilterOptions` | Enums (frequencies, categories, priorities, statuses, departments, target types, complexity, approval levels, auto-assign strategies) — note duplicate export, §13.10 |
| GET `/templates/:id` | `getTemplateById` | Full template incl. activities/subtask JSON |
| POST `/templates` | `createTemplate` | Generates `TPL-####` code |
| PUT `/templates/:id` | `updateTemplate` | |
| DELETE `/templates/:id` | `deleteTemplate` | |
| GET `/templates/:id/detail` | `getTemplateDetail` | Template + analytics + assignment rules (v3) |
| PUT `/templates/:templateId/assignment-rules` | `upsertAssignmentRules` | Auto-assign config (v3) |

### 4.2 Task instances — `/api/pems/instances`
| Method & Path | Controller fn | Notes |
|---|---|---|
| GET `/instances` | `getInstances` | Paginated; filters: status (incl. comma list), sellerId, assignedTo, reviewerId, priority, slaStatus, reviewStatus, dueBefore/After, search, templateId; `includeSubtasks=true`, `includeRuleTasks=true` (bridges `Actions`). **department & frequency filters ignored** (bug #2) |
| GET `/instances/:id` | `getInstanceById` | Instance + subtasks + activities + evidence + reviews + audit logs (N+1 reads) |
| POST `/instances` | `createInstance` | Creates instance + subtasks + activities from template SOP; **drops Department** (bug #1) |
| POST `/instances/:id/transition` | `transitionStatus` | Validates via `canTransition`; updates timestamps/ReviewStatus; audit + event-store + event-bus |
| PUT `/instances/:id/achievement` | `updateAchievement` | Sets Achievement/AchievementPct/Variance |
| POST `/recalculate-progress` | `recalculateProgress` | Recomputes `WeightedProgressPct` for all open instances |

### 4.3 Subtasks / Activities / Evidence / Reviews
| Method & Path | Notes |
|---|---|
| POST `/subtasks/:subTaskId/complete` | Marks complete, recomputes ProgressPct + WeightedProgressPct, event `SUBTASK_COMPLETED` |
| POST `/activities/:activityId/complete` | Marks activity complete |
| POST `/evidence` | Uploads evidence metadata (file storage handled upstream by multer/upload middleware) |
| POST `/reviews` | Inserts `PemsTaskReviews` **and** auto-transitions APPROVED/REJECTED (REWORK collapsed, bug #9) |

### 4.4 Dashboards
| Method & Path | Notes |
|---|---|
| GET `/dashboard/summary` | One-pass aggregates: 8 KPIs, department performance, top performers, risk panel, pipeline, status distribution (defaults to last 90 days) |
| GET `/dashboard/live-tasks` | TOP 15 open tasks ordered by priority + due date |
| GET `/dashboard/activity-feed` | Latest 20 audit-log entries |
| GET `/dashboard/kpis` | KPI block (legacy, from pemsService) |
| GET `/dashboard/seller-performance` / `department-performance` / `brand-manager-performance` / `reviewer-performance` | Scorecards |
| GET `/dashboard/risk-panel` | SLA breaches, overdue, pending reviews, rejected |
| GET `/dashboard/top-performers` | Leaderboard |
| POST `/dashboard/refresh-sla` | Recomputes SLAStatus for open tasks |
| POST `/dashboard/check-escalations` | Runs escalation checks (manual only — bug #6) |

### 4.5 Notifications
| Method & Path | Notes |
|---|---|
| GET `/notifications` | TOP 100 per user + unreadCount |
| GET `/notifications/merged` | Same as above via `notificationMergeService` (not actually merged — bug #10) |
| POST `/notifications/:id/read` · `/notifications/read-all` | Mark read |

### 4.6 Dynamic data & misc
| Method & Path | Notes |
|---|---|
| GET `/sellers` · `/brand-managers` · `/reviewers` | Dropdown sources (cache 300 s) |
| POST `/seed-demo` | Seeds demo templates/instances (idempotent guard: ≥3 instances → skip) |

### 4.7 Live data — `/api/live-data` (not auth-wrapped — see §12)
`/metrics`, `/fetch`, `/upload` (multer, 10 MB), `/progress/:jobId`, `/results/:jobId`, `/download/:jobId`, `/cancel/:jobId`, `/creds-stats`, plus `/v2/*` variants. Jobs stored in Redis (`ldi:job:*`, TTL 2 h) with file fallback.

### 4.8 Live sync tracker — `/api/live-sync-tracker`
`/overview`, `/sellers`, `/seller/:sellerId`, `/activity`, `/trigger` (all `auth`).

### 4.9 Legacy / adjacent
- `/api/tasks` — `POST /generate` (ASIN→tasks via `TaskAnalyzer`), `GET /`, `PUT /:id/status`, `PUT /:id/assign`, `DELETE /:id` — writes the old `Tasks` table.
- `/api/tasks/ai-create` + `/api/ai/generate-recovery-tasks` (`aiTaskController`) — AI intent → enriched `Actions` rows.
- `tasksPageController.getOverview` — Objectives/Actions hierarchy for the frontend **Objectives** view (SQL `Objectives`/`KeyResults`/`Actions`), role-scoped by `loadObjectives/loadActions` (admin/super_admin/operational_manager see global scope).

---

## 5. Workflow Engine (`services/pems/workflowEngine.js`)

**12 states:** DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED → REWORK → RESUBMITTED → (ESCALATED, CANCELLED any time).

**Transition table:**
```
DRAFT: [ASSIGNED, CANCELLED]
ASSIGNED: [ACCEPTED, IN_PROGRESS, CANCELLED]
ACCEPTED: [IN_PROGRESS]
IN_PROGRESS: [SUBMITTED, ESCALATED]
SUBMITTED: [UNDER_REVIEW]
UNDER_REVIEW: [APPROVED, REJECTED]
REJECTED: [REWORK]
REWORK: [RESUBMITTED]
RESUBMITTED: [UNDER_REVIEW]
ESCALATED: [IN_PROGRESS, UNDER_REVIEW, CANCELLED]
APPROVED / CANCELLED: terminal
```

**SLA logic**
- `calculateSLAStatus(dueDate, slaHours)`: BREACHED if past due; AT_RISK if remaining ≤ 25 % of SLA window; else WITHIN_SLA.
- `getEscalationLevel`: ≤24 h → assignee; ≤12 h → reviewer; <0 h → manager; <−24 h → admin.

**Progress/achievement**
- `calculateAchievement = achievement/target ×100`, `calculateVariance = achievement − target`.
- `calculateProgress` (count-based) and `calculateWeightedProgress` (sum of completed `WeightagePct` / total weight, fallback to count).

**Next due date:** DAILY+1d, WEEKLY+7d, BI_WEEKLY+14d, MONTHLY+1mo, QUARTERLY+3mo, HALF_YEARLY+6mo, YEARLY+1y, default +7d. *(Used only at creation — no scheduler materializes recurrences, bug #5.)*

---

## 6. Service Layer Deep Dive (`pemsService.js`)

| Function | Behavior |
|---|---|
| `createTemplate` / `getTemplates` / `getTemplateById` / `updateTemplate` / `deleteTemplate` | CRUD with JSON columns (Activities, SubTaskDefinitions, Tags) and unique `TPL-####` codes |
| `createInstance` | Insert + SOP materialization (subtasks → activities) + counts + audit `CREATED` + `TASK_CREATED` event-store append. **Drops Department.** No transaction wrapper (partial failure possible across inserts) |
| `getInstances` | Paginated query, safe-sort whitelist, subtask hydration, **rule-task bridge** (Actions `type='automated'` mapped to pseudo-instances with `_isRuleTask:true`, `InstanceCode:'[RULESET]'`) |
| `getInstanceById` | Full hydration (subtasks, activities, evidence, reviews, audit logs) — 1 + N queries |
| `transitionStatus` | Validates transition, stamps lifecycle timestamps, ReviewStatus side-effects, rework counter, audit log, event-store append, event-bus emit. **CompletedAt never set (bug #3)** |
| `completeSubTask` / `completeActivity` | Mark complete; recompute `ProgressPct` + `WeightedProgressPct`; `SUBTASK_COMPLETED` event |
| `uploadEvidence` / `submitReview` / `updateAchievement` | Evidence rows; review insert + auto-transition (REWORK→REJECTED bug); achievement math |
| `refreshSLAStatuses` | Bulk recompute for open tasks |
| `checkEscalations` | Batched (500) scan; updates SLAStatus; fires SLA_WARNING / SLA_BREACH notifications. **No dedup → duplicate notifications on repeated runs (bug #11)** |
| `getDashboardKPIs`, `getSellerPerformance`, `getDepartmentPerformance`, `getBrandManagerPerformance`, `getReviewerPerformance`, `getRiskPanel`, `getTopPerformers` | Aggregate SQL analytics |
| `getNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllRead` | In-app notifications |
| `calculateWeightedProgress`, `upsertAssignmentRules`, `getAssignmentRules`, `getTemplateAnalytics`, `recalculateAllWeightedProgress` | V3 features |
| `getSellersForPEMS`, `getBrandManagersForPEMS`, `getReviewersForPEMS` | Dynamic dropdowns |

---

## 7. Events, Queues & Real-time

**Event bus (`services/eventBus.js`)** — in-process `EventEmitter` (max 100 listeners), events: `pems:task:created/transitioned/approved/rejected`, `pems:subtask:completed`, `pems:sla:updated/breached`, `pems:notification:created`, pipeline/system/auth events. `emitAsync` runs handlers with `Promise.allSettled` (failures logged, not fatal).

**Event store (`services/pems/eventStore.js`)** — append-only `PemsTaskEvents` with per-task versioning; `getCurrentState` folds events back into a state object (status, reviewStatus, SLA, counts, reworkCount…). Used for audit/history. *Version computed via `MAX(Version)+1` without transaction — race-prone under concurrency (bug #10).*

**Queues (`backend/jobs/`)** — queueService (Bull-style) queues:
- `pems-notification` (limiter 50/1s, 3 attempts) — worker calls `pemsService.createNotification`.
- `sla-escalation` (3 attempts) — worker calls `pemsService.checkEscalations`, **but nothing ever enqueues** → dead queue (bug #6).
- market-sync / keepa-sync / pipeline-run / auto-tag / webhook-delivery — cross-module.

**Real-time** — `eventHandlers.js` emits `task_status_changed` to Socket.IO room `task:{id}` and invalidates caches (patterns broken, bug #4); `LiveActivityFeed` frontend polls `/dashboard/activity-feed` (30 s).

---

## 8. Scheduler & Automation (`services/schedulerService.js`, `recurringTaskScheduler.js`)

| Job | Schedule | Notes |
|---|---|---|
| Amazon enterprise pipeline | daily (configurable) | `PIPELINE_RUN` queue |
| Ajio enterprise pipeline | daily | same |
| Live data sync | 06:00 (configurable) | `MARKET_SYNC` type `live` |
| Database integrity repair | every 6 h | currently a no-op ("refactoring in progress") |
| Weekly DB backup | Sunday 00:00 | |
| Auto-tags (age / full) | daily 02:00 / 03:00 | `AUTO_TAG` queue |
| Octoparse task recovery | on startup | `runOctoparseTaskRecovery` — the code that crashed the process in the Node 26 incident |
| **PEMS SLA escalation** | **— none —** | bug #6 |
| **PEMS recurring instances** | **— none —** | bug #5 |
| Legacy `Actions` recurring | hourly (`recurringTaskScheduler.js`) | clones completed Actions with `Recurring` JSON; unrelated to `PemsTaskTemplates` |

---

## 9. Notifications & Email

- **In-app:** `PemsNotifications` rows created via queue worker on transitions (ASSIGNED/SUBMITTED/APPROVED/REJECTED/ESCALATED) and by `checkEscalations` (SLA_WARNING/SLA_BREACH). Read/unread via API. `NotificationCenter` (frontend) polls `/notifications/merged`.
- **Email:** `backend/emails/templates/pems/*` provides 6 polished HTML templates; `emailNotificationService.triggerNotification` wires them to `emailService.send` **but the service is never imported anywhere** — emails are configured but never sent (bug #7).

---

## 10. Integrations

1. **Ruleset bridge** — `getInstances?includeRuleTasks=true` merges `Actions` rows (`Status IN (PENDING,IN_PROGRESS) AND Type='automated'`) into the PEMS list as pseudo-tasks (`Id: rule_{id}`, `InstanceCode:'[RULESET]'`, `_isRuleTask:true`). Frontend mismatch on the flag (bug #8); note these bridged rows are **not** transitionable via PEMS endpoints.
2. **Live data import** (`liveDataController`) — fetch/upload marketplace data (XLSX/CSV), async jobs with Redis/file storage, progress/results/download/cancel, V2 credential-locked variant.
3. **Market/Keepa sync** — seller ASIN discovery, Octoparse status checks (`schedulerService` startup recovery).
4. **AI task enrichment** (`aiTaskService`/`aiTaskController`) — intent → enriched `Actions` (PEMS templates not involved).

---

## 11. Security, Auth & Rate Limiting

- All `/api/pems*` routes (except `/api/live-data` — **no `auth` middleware on live-data routes**, worth confirming intended) are behind `auth` (JWT).
- Role scoping exists in the legacy `tasksPageController` (admin/super_admin/operational_manager → global) and `isGlobalUserRole` helpers; **main PEMS controllers do not enforce per-role scoping** — any authenticated user can transition any task (frontend gates via `rbac.js`).
- Rate limiting: tiered (`READ` 300/min global, `STRICT` 30, `BULK` 10, `IMPORT` 5, `AUTH` 20, `WRITE` 50); recently fixed for express-rate-limit v8 (`ipKeyGenerator(req.ip)`) — was returning 500 on all requests.
- SQL: parameterized queries throughout; sort-column whitelist in `getInstances`.
- `server.js` now has global `unhandledRejection`/`uncaughtException` guards (added during the Node 26 incident) — DB/Redis outages log instead of killing the process.

---

## 12. Testing & Tooling

- `backend/__tests__/unit/workflowEngine.test.js` — covers transitions (valid/invalid), SLA status boundaries, achievement/variance, progress, next-due-date, escalation levels.
- `backend/__tests__/unit/eventStore.test.js` — event-store behavior.
- `backend/scripts/seed-tasks.js` — CLI seed (7 templates × 5 sellers, varied statuses/due dates).
- `backend/services/pems/seedDemo.js` — richer demo via `POST /api/pems/seed-demo` (sellers + brand managers with assignments).
- No integration/e2e tests; no automated migration test.

---

## 13. Verified Findings (bugs & risks)

| # | Severity | Location | Finding |
|---|---|---|---|
| 1 | **High** | `pemsService.js` `createInstance` (INSERT, ~line 190) | **`Department` never inserted** (column exists, default `Operations`). Wizard `department` is silently dropped → department filter/analytics meaningless for created tasks |
| 2 | **High** | `pemsService.js` `getInstances` | **`department` & `frequency` filters ignored** — `applyFilterInputs` binds `@department` but WHERE never references it; frequency has no branch at all |
| 3 | **High** | `pemsService.js` `transitionStatus` (~line 425) | **`CompletedAt` never written** — the `case 'APPROVED'/'REJECTED': timeFields.CompletedAt…` is unreachable (preceding grouped case matches first). Completion timestamps/analytics wrong |
| 4 | **Medium-High** | `pemsRoutes.js` invalidation patterns + `cache.js` key format | **Cache invalidation broken**: real keys are `retailops:route::api:pems:instances` (slashes→colons, leading colon), patterns are `route:/api/pems:instances*` → never match. GET list/dashboard stale up to TTL 30–120 s after writes |
| 5 | **Medium-High** | whole module | **Recurring instances never materialize** — `FREQUENCIES` only used at creation; no cron clones DAILY/WEEKLY… templates |
| 6 | **Medium-High** | `jobs/` + scheduler | **`sla-escalation` queue never fed** → SLA escalation only when manually triggered via `POST /dashboard/check-escalations` |
| 7 | **Medium** | `services/pems/emailNotificationService.js` | **Dead code** — never imported; 6 email templates never sent |
| 8 | **Medium** | `pemsService.js` rule bridge vs frontend | Backend sets `_isRuleTask`, frontend checks `IsRuleTask`/`source==='ACTION_RULE'`/code `startsWith('R')` → bridged rule tasks lose the "Auto" badge & skip rules (e.g., transition buttons still show) |
| 9 | **Medium** | `pemsController.js` `submitReview` | `REWORK` decision collapses into `REJECTED` transition (REVIEW_DECISIONS has REWORK; engine supports REWORK path) |
| 10 | **Medium** | `eventStore.js` `append` | Version = `MAX(Version)+1` without transaction → concurrent writes can collide on `(TaskInstanceId, Version)` |
| 11 | **Medium** | `pemsService.js` `checkEscalations` | Re-runs create **duplicate SLA notifications** on every invocation (no last-notified tracking) |
| 12 | **Low-Med** | `pemsController.js:62 & 357` | Duplicate `getFilterOptions` export (second wins; first is dead code) |
| 13 | **Low** | `notificationMergeService.js` | Named "merged" but returns only PEMS notifications |
| 14 | **Low** | `pemsService.js` `createInstance`/`completeSubTask` | Multi-insert flows (instance→subtasks→activities) are not wrapped in a transaction → partial writes on failure |
| 15 | **Low** | `dashboardController.js` `getLiveTasks` | `TOP 15` hardcoded — no pagination/limit param |
| 16 | **Low** | `liveDataRoutes.js` | No `auth` middleware on live-data endpoints (verify intended; data-import surface is otherwise internal) |
| 17 | **Info** | `getInstanceById` | 1+N query pattern per subtask (fine at low volume) |

---

## 14. Recommendations (prioritized)

**P0 — correctness**
1. `createInstance`: add `Department` (from payload, else template's) to the INSERT.
2. `getInstances`: add `AND i.Department = @department` and `AND i.Frequency = @frequency` branches; remove the dead `applyFilterInputs` binding mismatch.
3. `transitionStatus`: fix switch so `APPROVED`/`REJECTED` set `ReviewedAt` **and** `CompletedAt` (approval) — e.g. explicit `if` blocks.
4. Cache invalidation: align patterns with the real key format — e.g. `invalidateCache('route::api:pems:instances*')` (or change `cacheRoute` to build keys from the route path). Then verify with Redis `scan` on a live env.

**P1 — automation completeness**
5. Add a cron (hourly, like `recurringTaskScheduler`) that materializes next occurrences for `Frequency != ONE_TIME` PEMS templates (respect CustomCron where set).
6. Feed `SLA_ESCALATION` queue from the scheduler (e.g. every 15–30 min) or call `checkEscalations` from a cron directly; add notification dedup (store last `SLA_WARNING` time per task).
7. Wire `emailNotificationService` into the transition/notification pipeline (or remove the dead code), and honor `SLA_STATUSES` on `SUBMITTED` emails.

**P2 — polish & hardening**
8. Align rule-bridge contract: return `IsRuleTask: true` (and keep `_isRuleTask` for back-compat) so the frontend Auto badge works.
9. Handle `REWORK` decision in `submitReview` → transition to `REWORK` (and set `ReviewStatus='REJECTED'`).
10. Wrap `createInstance`/subtask creation in an SQL transaction; add a unique constraint on `(TaskInstanceId, Version)` in `PemsTaskEvents` and use `MERGE`/serializable read for version increments.
11. Remove duplicate `getFilterOptions`; implement a real merge in `notificationMergeService` or rename it.
12. Add `auth` to live-data routes (if internal) and pagination to `/dashboard/live-tasks`.
13. Consider RBAC enforcement at the PEMS API layer (today it's frontend-gated only).

---

## 15. Appendix — Quick file map

```
backend/
├── controllers/
│   ├── pems/  pemsController.js · dashboardController.js · liveDataController.js · liveSyncTrackerController.js
│   ├── taskController.js · tasksPageController.js · aiTaskController.js   (legacy/adjacent)
├── routes/
│   ├── pems/  pemsRoutes.js · dashboardRoutes.js · liveDataRoutes.js · liveSyncTrackerRoutes.js
│   └── taskRoutes.js
├── services/
│   ├── pems/  pemsService.js · workflowEngine.js · eventStore.js · emailNotificationService.js ·
│   │          notificationMergeService.js · seedDemo.js
│   ├── eventBus.js · schedulerService.js · recurringTaskScheduler.js
├── jobs/      queueDefinitions.js · processors.js · eventHandlers.js
├── migrations/ 001_pems_schema.js · 002_pems_v2_schema.js · 003_pems_v3_schema.js
├── emails/templates/pems/  taskAssigned · taskSubmitted · taskApproved · taskRejected · slaBreach · taskEscalated
├── scripts/   seed-tasks.js
└── __tests__/unit/  workflowEngine.test.js · eventStore.test.js
```
