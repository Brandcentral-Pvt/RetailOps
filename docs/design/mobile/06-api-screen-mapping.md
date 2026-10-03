# RetailOps Android — Screen → API Mapping

**Document ID:** `RO-MOB-DS-006` · **Version:** 1.0.0 · **Depends on:** `03-screen-inventory.md`

What each screen calls, what it gets back, and what the backend must add.
Sourced from `docs/api-endpoints.md` and verified against `backend/routes/*`.

Legend: ✅ endpoint exists and is usable by mobile as-is · ⚠️ exists but needs a change ·
❌ does not exist, backend work required.

---

## 1. Client contract

### 1.1 Request conventions

| Concern | Rule |
|---|---|
| Base URL | `EXPO_PUBLIC_API_URL` (default `https://data.brandcentral.in/api`) |
| Auth | `Authorization: Bearer <accessToken>`; single-flight refresh on 401 via `POST /auth/refresh-token` |
| Scope | Screens pass `sellerId` **only** as a filter. The server must resolve and enforce scope from `UserSellers` — never trust the client |
| Pagination | `?page=&limit=25`; response `{ data: [], meta: { page, limit, total, hasMore } }`. Screens use infinite scroll with an explicit "Load more" past 200 rows |
| Date range | `?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Asia/Kolkata` — the client always sends the timezone |
| Sorting | `?sort=<field>&dir=asc|desc` — single active sort |
| Filtering | Flat query params per facet; array facets comma-separated |
| Idempotency | Write requests carry `Idempotency-Key` (UUID v4) so offline retries cannot double-create |
| Tracing | Client reads and surfaces the `x-request-id` response header in every error state |
| Rate limits | `READ` / `STRICT` / `AUTH` / `AI` tiers per route; on 429 the client shows a retry countdown, never a silent failure |

### 1.2 Freshness envelope (required — see §4, GAP-1)

Every data response should carry a freshness block so `FreshnessChip` works everywhere:

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": { "page": 1, "total": 12480, "hasMore": true },
  "freshness": {
    "lastSyncedAt": "2026-10-03T04:12:00+05:30",
    "source": "octoparse",
    "state": "fresh",
    "staleAfterMinutes": 360
  }
}
```

`state` is one of `fresh | aged | stale | syncing | failed | partial`. Until this exists,
the client falls back to no freshness indicator — **it must not invent one**.

### 1.3 Error envelope

```json
{ "success": false, "message": "Human-readable cause", "code": "FORBIDDEN", "requestId": "..." }
```

Client mapping: `401` → refresh, then AUTH-12 · `403` → `SYS-01` (or hide, if a gate should
have prevented the call) · `404` → screen-level "not found" state · `409` → conflict sheet ·
`422` → inline field errors · `429` → retry countdown · `5xx` → `SYS-06` with the request id.

---

## 2. Screen → endpoint map

### 2.1 Authentication

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| AUTH-01 bootstrap | `GET /api/auth/me` | ✅ | Must return `permissions[]` and `sellers[]` — the app cannot compose navigation without both in one call |
| AUTH-02 sign in | `POST /api/auth/login` | ✅ | Returns either `{requiresOtp, tempToken, destination}` or `{user, accessToken, refreshToken}` |
| AUTH-03 OTP | `POST /api/auth/verify-otp` | ✅ | Body `{tempToken, otp, trustDevice}` |
| AUTH-03 resend | `POST /api/auth/resend-otp` | ✅ | Subject to `requestOtpLimiter` |
| AUTH-04 forgot | `POST /api/auth/forgot-password` | ✅ | Always neutral response |
| AUTH-05 reset | `POST /api/auth/reset-password` | ✅ | Deep-linked token |
| AUTH-06 first login | `POST /api/auth/change-password` | ✅ | Enforces `MustChangePassword` |
| AUTH-08 trusted devices | `GET|DELETE /api/security/trusted-devices` | ⚠️ | Verify the exact shape under `/api/security`; needs "revoke all" |
| AUTH-12 session expired | `POST /api/auth/refresh-token` | ✅ | Single-flight in `apiClient` |
| Push registration | `POST /api/push/register`, `DELETE /api/push/unregister` | ✅ | Call on login, on token rotation, and on logout |
| — | `GET /api/auth/logout` (or `/logout`) | ⚠️ | Needed to invalidate the refresh token server-side on sign-out |

### 2.2 Home

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| INT-HM-01 dashboard | `GET /api/dashboard` | ⚠️ | Must accept `sellerId`, `range`, and honour scope. Add a `summary` shape sized for mobile |
| INT-HM-01 trend | `GET /api/chart-data` | ⚠️ | Needs `range` + `sellerId` params |
| INT-HM-01 size mix | `GET /api/chart-size-pie`, `/api/chart-size-bar` | ✅ | |
| INT-HM-02 alerts | `GET /api/alerts`, `GET /api/alerts/count` | ✅ | Guard is `dashboard_view` OR `targets_view`; decouple with `alerts_view` (G-7) |
| INT-HM-03 acknowledge | `PATCH /api/alerts/:id`, `PATCH /api/alerts/acknowledge-all` | ✅ | Optimistic; revert on failure |
| INT-HM-04/05 alert rules | `GET|POST|PUT|DELETE /api/alert-rules`, `POST /api/execute-all-rules`, `PATCH /api/alert-rules/:id/toggle` | ✅ | |
| INT-HM-06 notifications | `GET /api/notifications`, `PUT /api/notifications/read`, `DELETE /api/notifications/:id` | ✅ | Needs unread count + cursor pagination |
| INT-HM-07 global search | `GET /api/search` | ⚠️ | Returns data rows only; needs module/seller/task/person hits for the app |
| INT-HM-08 seller switcher | `GET /api/sellers` | ✅ | Must return only in-scope sellers for `assigned`/`self` |

### 2.3 Catalog

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| INT-CT-01/02 ASIN Manager | `GET /api/asins`, `GET /api/asins/search`, `GET /api/asins/:id` | ✅ | `asinmanager_view`; needs pagination + sort parity with the web table |
| INT-CT-01 table variant | `GET /api/asins-table` | ⚠️ | Verify pagination; this is the dense table behind the list |
| INT-CT-03 edit | `PUT /api/asins/:asinId/tags`, `POST /api/asins/:id/generate-images` | ✅ | `asinmanager_manage` |
| INT-CT-04 import | `POST /api/upload/octoparse`, `POST /api/bulk/*` | ✅ | BULK rate tier; multer multipart |
| INT-CT-05 export | `POST /api/export/start` → `GET /api/export/status/:id` → `GET /api/export/download/:id` | ✅ | **Already async** — the app polls/notifies then downloads. No backend change needed |
| INT-CT-01 filters | `GET /api/asins/filters`, `GET /api/asins/brands`, `GET /api/categories` | ✅ | |
| INT-CT-01/02 stats | `GET /api/asins/stats`, `GET /api/asins/lqs-top` | ✅ | |
| INT-CT-02 parent family | `GET /api/asins/parent-view`, `/api/asins/parent-view/children/:parentAsin` | ✅ | |
| INT-CT-07/08 ASIN Tracker | `GET /api/seller-tracker`, `GET /api/seller-tracker/:sellerId/asins`, `/inventory-status` | ❌ | **Blocked by G-10** — routes guard on unseeded `sellers_view`/`sellers_manage` |
| INT-CT-08 history | `GET /api/asins/:asinId/tags-history` | ⚠️ | Price/BSR history series not exposed; needed for the tracker chart |
| INT-CT-10/11 Listing Quality | `POST /api/listing-quality/analyze/:asinId`, `analyze-batch`, `analyze-{title,bullets,images,description}` | ✅ | AI limiter applies; batch calls need a progress affordance |
| INT-CT-12/13 Keywords | `GET /api/keywords`, `GET /api/keyword-analysis` | ⚠️ | Confirm export parity for `keywords_export` |
| INT-CT-14/15 keyword export | `POST /api/export/start` | ✅ | |

### 2.4 Growth

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| INT-GR-01/03 Ads | `GET /api/ads/overview`, `/api/ads/meta`, `/api/ads/filter-options` | ✅ | |
| INT-GR-02 trends | `GET /api/ads/series` | ✅ | Needs `range` param parity |
| INT-GR-03 table | `GET /api/ads/table` | ✅ | |
| INT-GR-04 AI review | `POST /api/ads/ai-review` | ✅ | `aiLimiter`; show a long-running state and cost warning |
| INT-GR-05 import | `POST /api/upload/upload-ads` | ✅ | `adsreport_import` |
| INT-GR-06 export | `POST /api/export/start-ads` → status → download | ✅ | |
| INT-GR-07/08 Targets | `GET /api/targets`, `GET /api/goals` | ✅ | Needs per-target progress computed server-side |
| INT-GR-09 target CRUD | `POST|PUT|DELETE /api/targets/*` | ✅ | `targets_create|edit|delete` |
| INT-GR-10 GMS Tracker | `GET /api/upload/gms-data`, `/api/upload/gms-asins` | ⚠️ | Route shape is `upload`-namespaced; verify pagination for large sellers |
| INT-GR-11 GMS import | `POST /api/upload/upload-gms` | ✅ | `gms_tracker_import` |
| INT-GR-12–18 Reports | `GET /api/data/sku-report`, `/data/parent-asin-report`, `/data/month-wise-report`, `GET /api/master-revenue`, `GET /api/revenue-engine/*` | ⚠️ | These return report-sized payloads. Add pagination or a summary/aggregate endpoint before using them on a phone |
| INT-GR-01 dashboard KPI | `GET /api/dashboard` | ⚠️ | Same endpoint as INT-HM-01 |
| INT-GR-19 Revenue Calculator | `GET /api/revenue/*` | ✅ | |
| INT-GR-20/21 report viewer / export | `POST /api/export/start` + `GET /api/export/fields` | ✅ | |

### 2.5 Ops

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| INT-OP-01 tasks hub | `GET /api/tasks` | ⚠️ | Needs `status`, `assignee`, `sellerId`, `sla`, `sort`, `page` filters server-side |
| INT-OP-01 PEMS instances | `GET /api/pems/instances` | ✅ | |
| INT-OP-02 detail | `GET /api/tasks/:id`, `GET /api/pems/instances/:id` | ✅ | Must include subtasks, watchers, SLA, and permissions-for-this-task |
| INT-OP-02 status | `PUT /api/tasks/:id/status` | ✅ | Needs optimistic-concurrency (`If-Unmodified-Since` or `version`) → §11 conflict state |
| INT-OP-02 assign | `PUT /api/tasks/:id/assign` | ✅ | |
| INT-OP-03 create | `POST /api/tasks`, `POST /api/pems/instances` | ✅ | `tasks_manage` |
| INT-OP-04 comments/activity | `GET /api/tasks/:id/activity`, comments endpoints, `TaskComments` | ⚠️ | Verify exact comment routes exist |
| INT-OP-05/06 templates | `/api/pems/templates` CRUD | ✅ | `tasks_manage` |
| INT-OP-07 approvals | `GET /api/tasks?status=REVIEW` + approve endpoints | ⚠️ | Verify the approval action route |
| INT-OP-08 escalations | Task escalation policies / `TaskEscalations` | ❌ | Read model for escalations not exposed |
| INT-OP-10 daily routine | `POST /api/pems/routine/generate`, `GET /api/pems/routine/*` | ✅ | |
| INT-OP-11 scorecards | `PemsScorecards` | ❌ | No read endpoint |
| INT-OP-12/13 Action Center | `GET /api/actions`, `POST /api/actions`, `/api/actions/templates` | ✅ | SSE stream exists for live updates — socket channel preferred on mobile |
| INT-OP-14/15 Rulesets | `GET /api/rulesets` | ✅ | |
| INT-OP-16 run summary | Ruleset execution summary | ✅ | Migration 026 added the summary table |
| INT-OP-17–21 scrapers/runs | `GET /api/scheduled-runs`, `GET /api/market-sync/*`, `GET /api/scraper/*`, `GET /api/live-sync-tracker/*` | ✅ | Needs a per-run progress field for the live monitor |
| INT-OP-19 notifications | `GET /api/pems/notifications`, `POST /api/pems/notifications/:id/read` | ✅ | |

### 2.6 People, Chat, Calls

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| INT-MR-01/02 Sellers | `GET /api/sellers`, `GET /api/sellers/:id` | ✅ | `seller_view` |
| INT-MR-03 seller CRUD | `POST|PUT|DELETE /api/sellers/*` | ✅ | `seller_manage` |
| INT-MR-04/05 Teams | `/api/teams` | ✅ | |
| INT-MR-06–09 Chat | `GET /api/chat/conversations`, `POST /api/chat/conversations`, `GET /api/chat/messages/:conversationId`, `POST /api/chat/send`, `POST /api/chat/upload`, `PUT /api/chat/messages/:messageId`, `POST /api/chat/messages/:messageId/vote`, `POST /api/chat/groups`, `GET /api/chat/groups/:conversationId/media`, `GET /api/chat/link-preview`, `GET /api/chat/search` | ✅ | Rich and complete — including polls, forwarding, receipts, pins |
| INT-MR-06 chat people | `GET /api/chat/users`, `GET /api/chat/sellers` | ✅ | **Must be scope-filtered for `seller_client`** so a seller can only reach their own account team |
| INT-MR-07 realtime | Socket.IO (`socketService`) | ✅ | Needs a documented event contract: `message:new`, `message:read`, `typing`, `task:updated`, `alert:new` |
| INT-MR-10–12 Calls | Call signalling + `CallLogs` table | ⚠️ | Mobile carries `react-native-callkeep` + `react-native-webrtc`; confirm the signalling API surface and call-history endpoint |
| INT-MR-19 activity | `GET /api/logs/*` | ✅ | `activitylogs_view` |

### 2.7 Admin & account

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| INT-MR-13/14 Users | `GET|POST|PUT /api/users` | ✅ | STRICT limiter; exclude from offline cache |
| INT-MR-15/16 Roles | `GET|POST|PUT /api/roles`, permissions list | ✅ | |
| INT-MR-17 API keys | `/api/keys` | ✅ | Never cache; mask values, reveal on demand only |
| INT-MR-18 settings | `/api/settings` | ✅ | |
| INT-MR-20 files | `/api/files` | ✅ | |
| INT-MR-22 profile | `GET|PUT /api/users/me` (or `/auth/me`) | ⚠️ | Confirm the profile-update route and avatar upload |
| INT-MR-23 security | `/api/security/*` | ⚠️ | Confirm device/session listing routes |
| INT-MR-24 notification prefs | `/api/notifications/preferences` (`UserNotificationPreferences`) | ⚠️ | Verify read/write routes |
| INT-MR-26 diagnostics | `GET /api/health` | ✅ | Show app version, API version, last sync, and device id |

### 2.8 Seller surface (new work)

| Screen | Method & path | Status | Notes |
|---|---|---|---|
| SEL-HM-01/02/03 home | `GET /api/dashboard?sellerId=me&range=` | ⚠️ | Reuse the internal endpoint with server-enforced self-scope, or add `/api/seller-portal/home` returning a curated, pre-computed payload |
| SEL-PF-01/02 performance | `GET /api/dashboard`, `GET /api/upload/gms-data` | ⚠️ | Needs `self` scope enforcement |
| SEL-PF-03/04 advertising | `GET /api/ads/*` | ⚠️ | Seller-safe subset only — never expose internal cost/margin fields |
| SEL-PF-05 targets | `GET /api/targets` | ⚠️ | Return only the targets that concern this seller |
| SEL-PF-06/07/08 reports | `GET /api/data/*`, `POST /api/export/start` | ⚠️ | Seller-scoped, report subset only |
| SEL-PR-01/02 products | `GET /api/asins`, `GET /api/asins/:id` | ⚠️ | `self` scope |
| SEL-PR-03 quality | `POST /api/listing-quality/analyze/:asinId` | ⚠️ | Rate-limit per seller |
| SEL-PR-04 history | Price/BSR series | ❌ | Same gap as INT-CT-08 |
| SEL-PR-05 keywords | `GET /api/keywords` | ⚠️ | `self` scope, read-only |
| SEL-RQ-01–05 requests | `GET /api/tasks`, `POST /api/tasks` | ⚠️ | Seller must read only their tasks and create **requests** — needs `tasks_submit` (G-8) and a distinct request type |
| SEL-RQ-04 approvals | Approve/reject endpoints | ❌ | No seller-approval capability exists today |
| SEL-MR-01 chat | `/api/chat/*` | ⚠️ | Must be limited to the seller's own conversations |
| SEL-MR-02 account manager | — | ❌ | Needs an endpoint returning the assigned internal owner for a seller |
| Push (both) | `POST /api/push/register` | ✅ | Add per-event-type preferences for sellers (G-5 / P-5) |

---

## 3. Realtime contract (Socket.IO)

Existing channels are consumed by `mobile/src/services/socketService.ts`. For the app, the
following event contract is required and must be documented, versioned, and scope-filtered
server-side:

| Event | Payload | Drives |
|---|---|---|
| `alert:new` | alert object + scope | INT-HM-01/02 badge, list prepend |
| `alert:acknowledged` | `{ id, byUserId }` | List update, cross-device consistency |
| `task:updated` | task summary + scope | INT-OP-01/02, badges |
| `task:comment` | `{ taskId, comment }` | INT-OP-04 |
| `message:new` | message + conversation | INT-MR-06–09, SEL-MR-01 |
| `message:read` | receipts | Read-state rendering |
| `typing` | `{ conversationId, userId }` | Composer indicator |
| `sync:status` | `{ module, state, at }` | `FreshnessChip` live updates |
| `call:incoming` / `call:state` | call payload | CallKeep / WebRTC |

Rules: every event carries its scope so the client can drop out-of-scope events; the client
must re-fetch on reconnect (sockets are a delta channel, never the source of truth); no
badge counts from sockets alone — they reconcile against `GET /api/alerts/count` and
notification counts.

---

## 4. Backend gaps to close before mobile build

| # | Gap | Blocks | Effort |
|---|---|---|---|
| **GAP-1** | Freshness metadata (`lastSyncedAt`, `state`, `staleAfterMinutes`) on data responses | Every `FreshnessChip`, the whole §10 model | S–M |
| **GAP-2** | Mobile-sized dashboard `summary` shape + `range`/`sellerId` params | Home for all roles | M |
| **GAP-3** | Cursor pagination on `/api/notifications`, `/api/alerts`, `/api/chat/*` | Long lists, badges | S |
| **GAP-4** | Seller-scoped access enforcement (`self`) across every seller-facing route | The entire seller surface; a security requirement | M–L |
| **GAP-5** | `seller_client` role + permission set (§5 of doc 05) | The seller surface | S–M |
| **GAP-6** | `alerts_view`, `tasks_submit`, `tasks_approve` permissions | Seller alerts and requests | S |
| **GAP-7** | Fix `sellers_view` → `seller_view` mismatch (G-10) | Seller Tracker module | S |
| **GAP-8** | Price/BSR history time series endpoint | Tracker charts, product history | M |
| **GAP-9** | Escalations + scorecards read endpoints | Two Ops screens | S–M |
| **GAP-10** | Seller's assigned account manager endpoint | SEL-MR-02, and the "who do I ask" affordance | S |
| **GAP-11** | Optimistic-concurrency token on task writes | Conflict handling (§11 state 9) | S |
| **GAP-12** | Documented Socket.IO event contract with scope filtering | Realtime, badges, freshness | M |
| **GAP-13** | Push notification taxonomy + per-role event preferences | Notification centre grouping, deep links | M |
| **GAP-14** | Report endpoints that tolerate phone-sized payloads (or aggregate variants) | 14 report screens | M–L |
| **GAP-15** | Call signalling API surface confirmation | Calls module | M |

Sizing is relative (S ≤ 1 week, M ≤ 3 weeks, L > 3 weeks of one engineer's time) — an
estimate to sequence the work, not a commitment.

---

## 5. Caching and offline keys

Client cache keys must include **user id**, **surface**, **seller scope**, and **filters**, so
a scope or account switch can never surface another seller's cached data.

```
cache key = `${surface}:${userId}:${sellerScope}:${route}:${hash(filters, sort, range)}`
```

Eviction: 7-day TTL, LRU above 150 MB, immediate purge of the whole store on sign-out and
on permission revocation. Never cached: `/api/users`, `/api/roles`, `/api/keys`,
`/api/settings`, `/api/logs`, and any export download URL.

A cached response may only render when its `freshness.lastSyncedAt` is present; otherwise
the screen shows the offline banner with the cache timestamp from the device, clearly
labelled as device-cached rather than server-synced.
