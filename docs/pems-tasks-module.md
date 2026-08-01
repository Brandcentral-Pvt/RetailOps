# PEMS Tasks Module — Complete Documentation

> **PEMS** = Performance & Execution Management System

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Workflow State Machine](#3-workflow-state-machine)
4. [Backend Routes](#4-backend-routes)
5. [Backend Service Layer](#5-backend-service-layer)
6. [Frontend Pages & Components](#6-frontend-pages--components)
7. [Frontend API Service](#7-frontend-api-service)
8. [Review Queue](#8-review-queue)
9. [Dashboard & KPIs](#9-dashboard--kpis)
10. [Ruleset Integration](#10-ruleset-integration)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐    │
│  │TaskInstances │ │ReviewQueue   │ │PemsDashboard       │    │
│  │Page         │ │Page          │ │                   │    │
│  └──────┬──────┘ └──────┬───────┘ └────────┬──────────┘    │
│         │               │                   │               │
│  ┌──────┴───────────────┴───────────────────┴──────────┐   │
│  │              pemsApi.js (fetch + auth)               │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP / JSON
┌─────────────────────────┼───────────────────────────────────┐
│  Backend (Node.js/Express)                                  │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │            pemsRoutes.js (router + auth middleware)     │  │
│  └──────────────────────┬───────────────────────────────┘   │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │        pemsController.js (request/response handling)    │ │
│  └──────────────────────┬───────────────────────────────┘   │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │         pemsService.js (business logic/SQL)            │  │
│  └──────────────────────┬───────────────────────────────┘   │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │   workflowEngine.js  │  emailNotificationService.js   │  │
│  └──────────────────────┴───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                   ┌──────┴──────┐
                   │  SQL Server  │
                   └─────────────┘
```

The PEMS module is a dedicated task management system with its own schema, API, and UI. It is independent from the older `Actions`-based task system (used by rulesets), though a bridge (`includeRuleTasks`) exists to display ruleset-created tasks within the PEMS UI.

---

## 2. Database Schema

### Core Tables (7)

#### `PemsTaskTemplates`
Template definitions that tasks are created from.

| Column | Type | Default | Notes |
|---|---|---|---|
| `Id` | VARCHAR(50) PK | | GUID |
| `TaskCode` | VARCHAR(20) UNIQUE | | Auto-generated `TPL-XXXX` |
| `Name` | NVARCHAR(200) | | |
| `Description` | NVARCHAR(MAX) | | |
| `Category` | NVARCHAR(50) | `'GENERAL'` | LISTING, PRICING, INVENTORY, ADS, etc. |
| `Department` | NVARCHAR(50) | `'Operations'` | V2 migration |
| `Frequency` | NVARCHAR(20) | `'ONE_TIME'` | |
| `SLAHours` | INT | `48` | |
| `Priority` | NVARCHAR(20) | `'MEDIUM'` | |
| `Activities` | NVARCHAR(MAX) | | JSON array of SOP activity definitions |
| `SubTaskDefinitions` | NVARCHAR(MAX) | | JSON array of sub-task definitions |
| `IsActive` | BIT | `1` | |
| `CreatedAt` | DATETIME2 | `dbo.GetEnvDate()` | |
| `UpdatedAt` | DATETIME2 | `dbo.GetEnvDate()` | |

> Full column list in `backend/migrations/001_pems_schema.js` (22 columns + 3 V2 additions).

#### `PemsTaskInstances`
Individual task instances (the core entity).

| Column | Type | Default | Notes |
|---|---|---|---|
| `Id` | VARCHAR(50) PK | | GUID |
| `InstanceCode` | VARCHAR(30) UNIQUE | | Auto-generated `TASK-XXXX` |
| `TemplateId` | VARCHAR(50) FK | | → `PemsTaskTemplates` |
| `SellerId` | VARCHAR(50) | | |
| `SellerName` | NVARCHAR(200) | | |
| `AssignedTo` | VARCHAR(50) | | User ID |
| `AssigneeName` | NVARCHAR(200) | | |
| `ReviewerId` | VARCHAR(50) | | User ID |
| `ReviewerName` | NVARCHAR(200) | | |
| `Status` | NVARCHAR(30) | `'DRAFT'` | Workflow state |
| `ReviewStatus` | NVARCHAR(30) | `'NOT_REVIEWED'` | |
| `Frequency` | NVARCHAR(20) | `'ONE_TIME'` | |
| `Title` | NVARCHAR(500) | | |
| `Priority` | NVARCHAR(20) | `'MEDIUM'` | |
| `Target` | DECIMAL(18,2) | `0` | |
| `Achievement` | DECIMAL(18,2) | `0` | |
| `AchievementPct` | DECIMAL(7,2) | `0` | |
| `SLAStatus` | NVARCHAR(20) | `'WITHIN_SLA'` | |
| `SLAHours` | INT | `48` | |
| `DueDate` | DATETIME2 | | |
| `SubTaskCount` | INT | `0` | V2 |
| `ActivityCount` | INT | `0` | V2 |
| `CompletedSubTasks` | INT | `0` | V2 |
| `ProgressPct` | DECIMAL(5,2) | `0` | V2 |
| `CreatedAt` | DATETIME2 | `dbo.GetEnvDate()` | |
| `UpdatedAt` | DATETIME2 | `dbo.GetEnvDate()` | |

> Full column list in `backend/migrations/001_pems_schema.js` (28 columns + 5 V2 additions). Contains timestamp tracking for each workflow step (`AssignedAt`, `AcceptedAt`, `StartedAt`, `SubmittedAt`, `ReviewedAt`, `CompletedAt`).

#### `PemsSubTasks`
Sub-tasks (SOP execution steps) within a task instance.

| Key Column | Type | Notes |
|---|---|---|
| `Id` | VARCHAR(50) PK | GUID |
| `TaskInstanceId` | VARCHAR(50) FK | CASCADE delete |
| `SubTaskCode` | VARCHAR(30) | |
| `Title` | NVARCHAR(300) | |
| `Status` | NVARCHAR(30) | `'PENDING'` |
| `SortOrder` | INT | |
| `IsCompleted` | BIT | |

#### `PemsActivities`
Activities (individual SOP steps) within each sub-task.

| Key Column | Type | Notes |
|---|---|---|
| `Id` | VARCHAR(50) PK | GUID |
| `SubTaskId` | VARCHAR(50) FK | CASCADE delete |
| `TaskInstanceId` | VARCHAR(50) FK | CASCADE delete |
| `StepNo` | INT | |
| `Title` | NVARCHAR(300) | |
| `Instructions` | NVARCHAR(MAX) | |
| `IsMandatory` | BIT | `1` |
| `IsCompleted` | BIT | |

#### `PemsEvidence`
Uploaded evidence files linked to tasks/sub-tasks/activities.

#### `PemsTaskReviews`
Review records when a task is approved/rejected.

| Key Column | Type | Notes |
|---|---|---|
| `Decision` | NVARCHAR(20) | `'APPROVE'` or `'REJECT'` |
| `QualityScore` | INT | |
| `Feedback` | NVARCHAR(MAX) | |
| `ReviewChecklist` | NVARCHAR(MAX) | JSON array |
| `ReviewDurationMinutes` | INT | |

#### `PemsTaskAuditLogs`
Complete audit trail of all status transitions and actions.

### V2 Additional Tables

- **`PemsEscalationRules`** — Rules for auto-escalation (trigger hours, notify role, channel)
- **`PemsNotifications`** — In-app notifications tied to task instances
- **`PemsScorecards`** — Periodic performance scorecards by seller/manager
- **`PemsAssignmentRules`** — Per-template auto-assignment rules (V3)

### Key Indexes (14+)
- `IX_PemsInstance_Status` — INCLUDE SellerId, AssignedTo, DueDate
- `IX_PemsInstance_Seller` — INCLUDE Status, DueDate
- `IX_PemsInstance_Reviewer` — INCLUDE Status, DueDate
- `IX_PemsInstance_DueDate` — INCLUDE Status

---

## 3. Workflow State Machine

### Statuses

```
DRAFT ───────────→ ASSIGNED ───────→ ACCEPTED ───────→ IN_PROGRESS ──────→ SUBMITTED ─────→ UNDER_REVIEW ────→ APPROVED (terminal)
  │                     │                                │                     │                    │
  └──→ CANCELLED (terminal)     └──→ CANCELLED           │                     │              ┌────┴────┐
                                                         │                     │              │         │
                                                         │                     │           REJECTED    APPROVED
                                                         │                     │              │
                                                         └──→ ESCALATED ───────┤              │
                                                                  │            │           REWORK ──→ RESUBMITTED ──→ UNDER_REVIEW
                                                                  │            │
                                                              IN_PROGRESS   UNDER_REVIEW
                                                                  │
                                                              CANCELLED
```

### Allowed Transitions

| From | To |
|---|---|
| `DRAFT` | `ASSIGNED`, `CANCELLED` |
| `ASSIGNED` | `ACCEPTED`, `IN_PROGRESS`, `CANCELLED` |
| `ACCEPTED` | `IN_PROGRESS` |
| `IN_PROGRESS` | `SUBMITTED`, `ESCALATED` |
| `SUBMITTED` | `UNDER_REVIEW` |
| `UNDER_REVIEW` | `APPROVED`, `REJECTED` |
| `REJECTED` | `REWORK` |
| `REWORK` | `RESUBMITTED` |
| `RESUBMITTED` | `UNDER_REVIEW` |
| `ESCALATED` | `IN_PROGRESS`, `UNDER_REVIEW`, `CANCELLED` |

### Transition Side Effects

| Target Status | Side Effects |
|---|---|
| `ASSIGNED` | Sets `AssignedAt`, sends TASK_ASSIGNED notification |
| `ACCEPTED` | Sets `AcceptedAt` |
| `IN_PROGRESS` | Sets `StartedAt`, checks SLA breach |
| `SUBMITTED` | Sets `SubmittedAt`, sets `ReviewStatus='PENDING_REVIEW'`, sends TASK_SUBMITTED to reviewer |
| `UNDER_REVIEW` | Sets `ReviewedAt` |
| `APPROVED` | Sets `CompletedAt` + `ReviewedAt`, sets `ReviewStatus='APPROVED'`, sends TASK_APPROVED |
| `REJECTED` | Sets `ReviewedAt`, sets `ReviewStatus='REJECTED'`, sends TASK_REJECTED |
| `REWORK` | Increments `ReworkCount` |
| `ESCALATED` | Sends TASK_ESCALATED notification |

### SLA Statuses

Calculated by `workflowEngine.calculateSLAStatus(dueDate, slaHours)`:

- `WITHIN_SLA` — > 25% of SLA time remaining (green)
- `AT_RISK` — < 25% of SLA time remaining (orange)
- `BREACHED` — Past due date (red)

### Validation

Both frontend (`constants/index.js`) and backend (`workflowEngine.js`) maintain identical `VALID_TRANSITIONS` maps. Backend validates transitions server-side in `transitionStatus()` before executing.

---

## 4. Backend Routes

Base path: `/api/pems` (mounted in `server.js`)

All routes require `auth` middleware (JWT token).

### Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/templates` | Paginated template list with filters |
| `GET` | `/templates/filters` | Returns all filter options for dropdowns |
| `GET` | `/templates/:id` | Single template by ID |
| `POST` | `/templates` | Create template |
| `PUT` | `/templates/:id` | Update template |
| `DELETE` | `/templates/:id` | Delete template |
| `GET` | `/templates/:id/detail` | Template + analytics + assignment rules (V3) |
| `PUT` | `/templates/:templateId/assignment-rules` | Update assignment rules (V3) |

### Task Instances

| Method | Path | Description |
|---|---|---|
| `GET` | `/instances` | Paginated list with filters, optional sub-tasks & rule tasks |
| `GET` | `/instances/:id` | Full detail with sub-tasks, activities, evidence, reviews, audit logs |
| `POST` | `/instances` | Create instance (requires `templateId`) |
| `POST` | `/instances/:id/transition` | Transition status |
| `PUT` | `/instances/:id/achievement` | Update achievement value |
| `POST` | `/recalculate-progress` | Batch recalculate weighted progress (V3) |

### Sub Tasks & Activities

| Method | Path | Description |
|---|---|---|
| `POST` | `/subtasks/:subTaskId/complete` | Mark sub-task complete + recalculate progress |
| `POST` | `/activities/:activityId/complete` | Mark activity complete |

### Evidence & Reviews

| Method | Path | Description |
|---|---|---|
| `POST` | `/evidence` | Upload evidence record |
| `POST` | `/reviews` | Submit review (auto-transitions to APPROVED/REJECTED) |

### Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/summary` | Enterprise summary — KPIs, pipeline, departments, top performers, workload, risk |
| `GET` | `/dashboard/live-tasks` | Top 15 active tasks by priority & due date |
| `GET` | `/dashboard/activity-feed` | Latest 20 audit log entries |
| `GET` | `/dashboard/kpis` | Legacy KPI aggregates |
| `GET` | `/dashboard/seller-performance` | Top 20 sellers by completion |
| `POST` | `/dashboard/refresh-sla` | Batch recalculate SLA statuses |
| `GET` | `/dashboard/department-performance` | Per-department aggregates |
| `GET` | `/dashboard/brand-manager-performance` | Top 20 managers |
| `GET` | `/dashboard/reviewer-performance` | Reviewer metrics from reviews |
| `GET` | `/dashboard/risk-panel` | SLA breaches, overdue, pending reviews |
| `GET` | `/dashboard/top-performers` | Top 5 sellers + top 5 managers |
| `POST` | `/dashboard/check-escalations` | Check & trigger escalations |

### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | User's notifications |
| `POST` | `/notifications/:id/read` | Mark single read |
| `POST` | `/notifications/read-all` | Mark all read |

### Dynamic Data

| Method | Path | Description |
|---|---|---|
| `GET` | `/sellers` | Active sellers |
| `GET` | `/brand-managers` | Users with brand_manager/admin roles |
| `GET` | `/reviewers` | Users with reviewer/admin roles |

---

## 5. Backend Service Layer

### `pemsService.js` — Exported Functions (36 total)

#### Templates (5)
| Function | Description |
|---|---|
| `createTemplate(data)` | Creates template with auto-generated code, stores Activities/SubTaskDefinitions as JSON |
| `getTemplates(filters)` | Paginated, filterable list (category, frequency, search, isActive) |
| `getTemplateById(id)` | Single template with JSON fields parsed |
| `updateTemplate(id, data)` | Partial update of any template fields |
| `deleteTemplate(id)` | Delete template |

#### Task Instances (3)
| Function | Description |
|---|---|
| `createInstance(data)` | Creates instance + auto-generates code + copies SubTaskDefinitions into PemsSubTasks & PemsActivities rows + updates counts + audit log |
| `getInstances(filters)` | Paginated, sortable list with JOIN to templates. Filters: status (single or CSV via LIKE), sellerId, assignedTo, reviewerId, priority, SLA, due dates, search, templateId. Optional: `includeSubtasks=true` (batch-fetches PemsSubTasks), `includeRuleTasks=true` (fetches from Actions table) |
| `getInstanceById(id)` | Full detail: sub-tasks → activities (with SupportDocuments), evidence, reviews, audit logs |

#### Workflow (1)
| Function | Description |
|---|---|
| `transitionStatus(id, toStatus, actorId, actorName, actorRole, details)` | Validates via `canTransition()`, sets timestamps per target status, updates Status/ReviewStatus, increments ReworkCount on rework, writes audit log, triggers email notifications |

#### Sub Tasks & Activities (2)
| Function | Description |
|---|---|
| `completeSubTask(subTaskId, actorId, actorName)` | Marks done, recalculates ProgressPct & WeightedProgressPct |
| `completeActivity(activityId, actorId, actorName)` | Marks done with CompletedBy |

#### Evidence & Reviews (2)
| Function | Description |
|---|---|
| `uploadEvidence(data)` | Inserts evidence record |
| `submitReview(data)` | Creates PemsTaskReviews row |

#### Achievement & SLA (2)
| Function | Description |
|---|---|
| `updateAchievement(id, achievement)` | Updates value + recalculates pct/variance |
| `refreshSLAStatuses()` | Batch recalculate SLA for all non-terminal instances |

#### Dashboard (15)
| Function | Description |
|---|---|
| `getDashboardKPIs(filters)` | Single-query aggregate: counts by status, breaches, pending reviews |
| `getSellerPerformance(filters)` | Top 20 sellers by completed tasks |
| `getDepartmentPerformance(filters)` | Per-department aggregates |
| `getBrandManagerPerformance(filters)` | Top 20 managers by completed |
| `getReviewerPerformance(filters)` | Reviewer metrics from PemsTaskReviews |
| `getRiskPanel()` | SLA breaches, overdue, pending, rejected counts |
| `getTopPerformers()` | Top 5 sellers + top 5 managers |
| `checkEscalations()` | Batch escalate in chunks of 500, 4 notification levels |
| `getSummary(filters)` | Consolidated: KPI + pipeline + status distribution + departments + top performers + workload + risk |
| `getLiveTasks(filters)` | Top 15 active tasks |
| `getActivityFeed()` | Latest 20 audit logs |
| `createNotification(data)` | Insert notification |
| `getNotifications(userId, unreadOnly)` | User's top 100 notifications |
| `markNotificationRead(id)` | Mark single read |
| `markAllRead(userId)` | Mark all read |

#### Dynamic Data Sources (3)
| Function | Description |
|---|---|
| `getSellersForPEMS(marketplace)` | Active sellers |
| `getBrandManagersForPEMS()` | Users with brand manager roles |
| `getReviewersForPEMS()` | Users with reviewer roles |

#### V3: Assignment & Analytics (4)
| Function | Description |
|---|---|
| `upsertAssignmentRules(templateId, data)` | Upsert PemsAssignmentRules |
| `getAssignmentRules(templateId)` | Get rules |
| `getTemplateAnalytics(templateId)` | Template-level stats |
| `recalculateAllWeightedProgress()` | Batch recalculate weighted progress |

---

## 6. Frontend Pages & Components

### Pages (`src/modules/pems/pages/`)

| Page | Purpose | Key Features |
|---|---|---|
| `TaskTemplatesPage.jsx` | Template CRUD | List, create, edit, delete templates |
| `TaskInstancesPage.jsx` | Task execution center | List/Board/Calendar/Seller/Objectives views, create wizard, filter panel, bulk actions, PremiumTaskRow with Start/Submit/Stop buttons |
| `ReviewQueuePage.jsx` | Review queue | Quick filters (All/Critical/Overdue/High Priority/My Reviews), bulk approve, expandable rows with evidence & sub-tasks |
| `PemsAnalyticsPage.jsx` | Analytics | Seller and department performance data |
| `PemsDashboard.jsx` | Command center dashboard | Top sellers, pending reviews, risk panel |
| `TemplateDetailPage.jsx` | Template detail | Template info + analytics + assignment rules |

### Components (`src/modules/pems/components/`)

| Component | Used In | Purpose |
|---|---|---|
| `TaskWorkspace.jsx` | TaskInstancesPage | Full workspace drawer — evidence upload, sub-task completion, comments, audit timeline, achievement update |
| `ReviewWorkspace.jsx` | ReviewQueuePage | Full review drawer — quality scoring, approve/reject/escalate, evidence review, timeline |
| `BoardView.jsx` | TaskInstancesPage | Kanban board (columns by status) |
| `CalendarView.jsx` | TaskInstancesPage | Calendar view of task due dates |
| `CommandCenterKpis.jsx` | TaskInstancesPage | KPI metric strip |
| `ReviewExecutiveKpis.jsx` | ReviewQueuePage | Executive KPI summary |
| `PremiumTaskRow.jsx` | TaskInstancesPage | Enhanced task row with Start/Submit/Stop buttons, health indicator, progress bar |
| `MobileTaskCard.jsx` | TaskInstancesPage | Mobile-friendly card layout |
| `RightInsightsPanel.jsx` | TaskInstancesPage | Right sidebar with quick stats |
| `LiveActivityFeed.jsx` | TaskInstancesPage | Real-time activity feed |
| `NotificationCenter.jsx` | (Header) | Notification bell dropdown |

### View Modes (TaskInstancesPage)

| View | Description |
|---|---|
| **List** | Traditional table/row layout with PremiumTaskRow |
| **Board** | Kanban board with status columns |
| **Calendar** | Month calendar with task dots |
| **Seller** | Tasks grouped by seller, each task expandable to show sub-tasks |
| **Objectives** | OKR-style view: sellers → objectives → tasks (fetched from local IndexedDB) |

### Create Task Wizard (TaskInstancesPage)

4-step drawer:
1. **Basic Info** — Template, Task Name, Department, Priority
2. **Assignments** — Seller, Brand Manager, Reviewer
3. **Performance** — Target, Frequency
4. **Timeline** — Due Date picker
5. **Preview** — Summary card with all values

---

## 7. Frontend API Service

All methods in `src/modules/pems/services/pemsApi.js` use `fetch` with `Authorization: Bearer` header from `localStorage('authToken')`. Base URL from `VITE_API_URL || '/api'`.

```
pemsApi = {
  // Templates (6)
  getTemplates(params), getTemplateById(id),
  createTemplate(data), updateTemplate(id, data), deleteTemplate(id),
  getFilterOptions(),
  
  // Instances (5)
  getInstances(params),   // supports includeSubtasks, includeRuleTasks
  getInstanceById(id),
  createInstance(data),   // requires templateId
  transitionStatus(id, toStatus, details),
  updateAchievement(id, achievement),
  
  // Subtasks & Activities (2)
  completeSubTask(subTaskId),
  completeActivity(activityId),
  
  // Evidence (1)
  uploadEvidence(data),
  
  // Reviews (1)
  submitReview(data),
  
  // Dashboard — Legacy (3)
  getDashboardKPIs(params),
  getSellerPerformance(params),
  refreshSLA(),
  
  // Dashboard — V2 (7)
  getDepartmentPerformance(params),
  getBrandManagerPerformance(params),
  getReviewerPerformance(params),
  getRiskPanel(),
  getTopPerformers(),
  checkEscalations(),
  
  // Dashboard — Consolidated (3)
  getDashboardSummary(params),
  getLiveTasks(params),
  getActivityFeed(),
  
  // Dynamic Data (3)
  getSellers(params),
  getBrandManagers(),
  getReviewers(),
  
  // V3 (3)
  getTemplateDetail(id),
  upsertAssignmentRules(templateId, data),
  recalculateProgress(),
}
```

---

## 8. Review Queue

**Page:** `ReviewQueuePage.jsx`
**Component:** `ReviewWorkspace.jsx`

### Quick Filters

| Filter | Backend Params |
|---|---|
| ALL | `status=SUBMITTED,UNDER_REVIEW` |
| Critical | `status=SUBMITTED,UNDER_REVIEW` + `priority=CRITICAL` |
| High Priority | `status=SUBMITTED,UNDER_REVIEW` + `priority=HIGH` |
| Overdue | `status=SUBMITTED,UNDER_REVIEW` → client-side filter by `isOverdue()` |
| My Reviews | `status=SUBMITTED,UNDER_REVIEW` + `reviewerId=<currentUser.id>` |

### Table Columns

Checkbox | Task (expandable name + code) | Seller | Category | Priority | Submitted By | Review Age | Evidence count | Due Date | SLA | Actions

### Expanded Row

3-column grid:
- **Task Info:** Seller, Reviewer, Achievement %, Due Date
- **Evidence:** Top 3 evidence files with icons
- **Sub-Tasks:** Top 4 sub-tasks with completion status

### ReviewWorkspace Drawer

Full-height drawer (90vw) with 2-column layout:
- **Left:** Task details, Performance (target/achievement/progress), Sub-tasks with progress bars, Evidence cards, Timeline
- **Right:** Comments thread, Review panel with:
  - `ReviewInsights` — 4 checks → recommendation
  - Quality Assessment — 4 Rate components → overall score
  - Review Decision — feedback textarea + Approve/Reject buttons
  - `ReviewerAnalytics` card

### Bulk Actions
- **Bulk Approve:** Iterates over selected IDs, calls `submitReview('APPROVE')` + `transitionStatus('APPROVED')` for each.

---

## 9. Dashboard & KPIs

### Consolidated Endpoint: `GET /dashboard/summary`

Returns in a single response:

| Section | Contents |
|---|---|
| `kpi` | totalTasks, activeTasks, pendingReviews, approvedTasks, avgAchievementPct, completionRate, slaCompliance, overdueTasks |
| `pipeline` | Counts per status from draft to approved |
| `statusDistribution` | All statuses with counts |
| `departments[]` | Per dept: totalTasks, completedTasks, completedRate, avgAchievementPct, avgProgress, slaCompliance |
| `topPerformers` | Top 10 sellers + Top 10 managers with avgAchievement, slaCompliance |
| `workload` | Grouped by department, assignee: assigned, inProgress, review, rework counts |
| `risk` | slaBreached, slaAtRisk, overdue, pendingReviews, staleReviews, highPriorityDelays |

### Activity Feed: `GET /dashboard/activity-feed`

Latest 20 `PemsTaskAuditLogs` entries joined with instances for InstanceCode, Title, Department.

### Escalation Engine

Background batch process that:
1. Processes open instances in chunks of 500
2. Recalculates SLA status
3. Triggers notification at 4 levels based on hours before due:
   - **24h** → Assignee notified
   - **12h** → Reviewer notified
   - **Breach** → Manager notified
   - **24h post-breach** → Admin notified

---

## 10. Ruleset Integration

### The Problem

Rulesets and the dispute engine create tasks in the **Actions** table (legacy system), not in `PemsTaskInstances`. These tasks were invisible in the PEMS UI.

### Solution: `includeRuleTasks=true`

Added to `pemsService.getInstances()`. When set:

1. Queries `Actions` table with `Status IN ('PENDING','IN_PROGRESS')` AND `Type = 'automated'`
2. Joins with `Sellers` for `SellerName`
3. Maps each action to a synthetic PEMS-like object:
   - ID prefixed `rule_<actionId>`
   - `InstanceCode` = `[RULESET]`
   - Status: `PENDING → ASSIGNED`, `IN_PROGRESS → IN_PROGRESS`
   - Priority: uppercased, fallback `'MEDIUM'`
   - `SLAStatus` = `'WITHIN_SLA'`, `AchievementPct` = `0`
   - Flagged with `_isRuleTask: true`
4. Prepends to instances array (appear before normal tasks)
5. Also respects `sellerId` and `priority` filters when provided

**Frontend:** `TaskInstancesPage.buildParams()` always sets `includeRuleTasks=true`.

---

## Appendix: Key Utilities

### `backend/services/pems/workflowEngine.js`

| Function | Description |
|---|---|
| `canTransition(from, to)` | Checks VALID_TRANSITIONS map |
| `getNextTransitions(status)` | Returns allowed next statuses |
| `calculateSLAStatus(dueDate, slaHours)` | WITHIN_SLA / AT_RISK / BREACHED |
| `calculateAchievement(achievement, target)` | Percentage calculation |
| `calculateVariance(achievement, target)` | Difference |
| `calculateProgress(subTasks)` | Count-based progress % |
| `getNextDueDate(frequency)` | Next due date from frequency |
| `getEscalationLevel(dueDate, slaHours)` | null / assignee / reviewer / manager / admin |

### `src/modules/pems/constants/index.js`

Exports: `WORKFLOW_STATUSES`, `VALID_TRANSITIONS`, `SLA_STATUSES`, `FREQUENCIES`, `DEPARTMENTS`, `CATEGORIES`, `PRIORITIES`, `TARGET_TYPES`, `COMPLEXITY_LEVELS`, `APPROVAL_LEVELS`, `AUTO_ASSIGN_STRATEGIES`

### `src/modules/pems/utils/taskHealth.js`

| Function | Description |
|---|---|
| `calculateHealth(task)` | Returns `{ score, label, color }` based on SLA, progress, priority |
| `isOverdue(task)` | Boolean — past DueDate and not terminal |
| `getDueDateLabel(task)` | Returns `{ text, color }` for DueDate column |

### `src/modules/pems/utils/exportUtils.js`

- `exportTasksToExcel(instances)` — Exports task list to Excel
- `exportReviewQueueToExcel(instances)` — Exports review queue to Excel

### `src/modules/pems/utils/rbac.js`

- `hasPermission(user, permission)` — Checks permission string against user's role/permissions
