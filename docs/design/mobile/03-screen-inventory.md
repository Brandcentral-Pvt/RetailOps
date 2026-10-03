# RetailOps Android — Screen Inventory

**Document ID:** `RO-MOB-DS-003` · **Version:** 1.0.0 · **Depends on:** `01-design-schema.md`

Every screen in the app, with its ID, surface, roles, and the states it must render.
This is the work breakdown for wireframes and the traceability list for QA.

---

## How to read this

| Column | Meaning |
|---|---|
| **ID** | Stable identifier. Never reused, never renumbered. Used in Figma page names, tickets, and analytics (`screen_view` events). |
| **Screen** | User-facing name as it appears in the app bar (internal) / plain-language name (seller). |
| **Surface** | `both` · `int` (internal only) · `sel` (seller only) |
| **Roles** | Which personas may reach it. `Σ` = every signed-in user; `Σ-int` = every internal user |
| **Perm** | Permission gate — `any-of` semantics per `01-design-schema.md` §4. `—` = no permission required beyond authentication |
| **Scope** | `all` · `assigned` · `own` — the data scope the screen must request |
| **States** | Which of the nine states from §11 apply. `B` = loading/empty/error/offline apply by default (baseline); letters below add specific ones |

**Auth screens (`AUTH-*`) use a flow vocabulary** — `idle`, `submitting`, `invalid`, `error`,
`locked`, `rate-limited`, `expired`, `resent` — rather than the letter codes below, because their
states are flow states, not data states. `agents/tools/build-registry.mjs` normalises both
vocabularies into one canonical list.

**State letters:** `L` loading-only variant matters · `E` true-empty needs teaching copy · `F` filtered-empty · `N` no-permission · `O` offline-cached · `S` stale/partial data · `X` error-recovery critical · `C` conflict · `B` bulk/selection mode · `U` upload/download progress

**Screen totals (unique IDs):** 13 auth · 10 internal Home · 15 Catalog · 21 Growth · 21 Ops ·
27 More/Admin · 26 seller · 7 system = **140 screens**

The distribution is itself a design finding: only 26 of 140 screens serve the seller surface.
The seller app is a focused product, not a stripped copy.

---

## 1. Authentication & session (`AUTH`)

Shared by both surfaces; the visual accent and the post-login landing differ.

| ID | Screen | Surface | Roles | Perm | States | Notes |
|---|---|---|---|---|---|---|
| AUTH-01 | Splash / bootstrap | both | Σ | — | X | Re-validates session via `GET /auth/me`; shows brand mark, never a blank screen |
| AUTH-02 | Sign in | both | Σ | — | X | Email + password. Branches to OTP or straight in (trusted device) |
| AUTH-03 | Verify code (OTP) | both | Σ | — | X | `tempToken`, masked `destination`, resend countdown, "trust this device" |
| AUTH-04 | Forgot password | both | Σ | — | X | Sends reset; always shows a neutral success (no account enumeration) |
| AUTH-05 | Reset password | both | Σ | — | X | Token from deep link; live strength meter; policy checklist |
| AUTH-06 | Set password (first login) | both | Σ | — | idle, submitting, invalid, error | When `MustChangePassword` / `IsFirstLogin` |
| AUTH-07 | Security policy consent | both | Σ | — | idle, submitting, error | When `SecurityPolicyAccepted = 0`; blocks the session until accepted |
| AUTH-08 | Trusted devices | both | Σ | — | E, X | List, revoke, revoke-all. Ties to `TrustedDevices` |
| AUTH-09 | Setup wizard | int | admin | `settings_manage` | E | When `SetupCompletedAt` is null |
| AUTH-10 | Welcome / onboarding | sel | seller_client | — | default, dismissed | 3-slide value tour + "what we need from you"; skippable, shown once |
| AUTH-11 | Biometric unlock | both | Σ | — | X | Opt-in; falls back to device credential; never a hard lockout |
| AUTH-12 | Session expired | both | Σ | — | idle, re-authenticating, error | Modal over the frozen screen; re-auth preserves the deep link |
| AUTH-13 | Account locked | both | Σ | — | locked, error | `LockUntil` set; shows unlock time and support contact |

## 2. Internal — Home (`INT-HM`)

| ID | Screen | Roles | Perm | Scope | States |
|---|---|---|---|---|---|
| INT-HM-01 | Dashboard | Σ-int | `dashboard_view` **or** `targets_view` | all/assigned | E, O, S, X |
| INT-HM-02 | Alerts inbox | Σ-int | alert perms | all/assigned | E, F, O, S |
| INT-HM-03 | Alert detail | Σ-int | alert perms | all/assigned | O, X |
| INT-HM-04 | Alert rules | admin, ops_mgr | `rules_view` | all | E, X |
| INT-HM-05 | Alert rule editor | admin, ops_mgr | `rules_manage` | all | C, X |
| INT-HM-06 | Notifications centre | Σ-int | — | own | E, F, O |
| INT-HM-07 | Global search | Σ-int | — | all/assigned | F, E |
| INT-HM-08 | Seller switcher | Σ-int | — | all/assigned | E, F |
| INT-HM-09 | Customise dashboard | Σ-int | `dashboard_view` | own | E |
| INT-HM-10 | KPI detail / metric drilldown | Σ-int | `dashboard_view` | all/assigned | O, S, X |

## 3. Internal — Catalog (`INT-CT`)

| ID | Screen | Roles | Perm | Scope | States |
|---|---|---|---|---|---|
| INT-CT-01 | ASIN Manager — list | Σ-int | `asinmanager_view` | all/assigned | E, F, B, O, S |
| INT-CT-02 | ASIN detail | Σ-int | `asinmanager_view` | all/assigned | O, S, X |
| INT-CT-03 | ASIN edit | admin, ops_mgr, brand_mgr | `asinmanager_manage` | all/assigned | C, X |
| INT-CT-04 | ASIN import (CSV/XLSX) | admin, ops_mgr | `asinmanager_import` | all/assigned | U, C, X |
| INT-CT-05 | ASIN export | Σ-int | `asinmanager_export` | all/assigned | U, X |
| INT-CT-06 | Bulk action sheet | Σ-int | `asinmanager_manage` | all/assigned | B, X |
| INT-CT-07 | Filter & sort sheet | Σ-int | `asinmanager_view` | — | E |
| INT-CT-08 | ASIN Tracker — list | Σ-int | `asintracker_view` | all/assigned | E, F, O, S |
| INT-CT-09 | ASIN Tracker — history | Σ-int | `asintracker_view` | all/assigned | O, S, X |
| INT-CT-10 | Listing Quality — list | Σ-int | `asinmanager_view` | all/assigned | E, F, O |
| INT-CT-11 | Listing Quality — audit | Σ-int | `asinmanager_view` | all/assigned | O, X |
| INT-CT-12 | Keyword Research — search | Σ-int | `keywords_view` | all/assigned | E |
| INT-CT-13 | Keyword results | Σ-int | `keywords_view` | all/assigned | E, F, O, S |
| INT-CT-14 | Keyword set detail | Σ-int | `keywords_view` | all/assigned | O, S |
| INT-CT-15 | Keyword export | Σ-int | `keywords_export` | all/assigned | U |

## 4. Internal — Growth (`INT-GR`)

| ID | Screen | Roles | Perm | Scope | States |
|---|---|---|---|---|---|
| INT-GR-01 | Ads — overview | Σ-int | `adsreport_view` | all/assigned | E, O, S, X |
| INT-GR-02 | Ads — trend series | Σ-int | `adsreport_view` | all/assigned | O, S |
| INT-GR-03 | Ads — campaign table | Σ-int | `adsreport_view` | all/assigned | E, F, B, O |
| INT-GR-04 | Ads — AI review | Σ-int | `adsreport_view` | all/assigned | E, X |
| INT-GR-05 | Ads — import workbook | admin, ops_mgr | `adsreport_import` | all/assigned | U, C, X |
| INT-GR-06 | Ads — report/export | Σ-int | `adsreport_export` | all/assigned | U |
| INT-GR-07 | Targets — dashboard | Σ-int | `targets_view` | all/assigned | E, O, S |
| INT-GR-08 | Target detail vs achievement | Σ-int | `targets_view` | all/assigned | O, S |
| INT-GR-09 | Target create/edit | admin, ops_mgr, brand_mgr | `targets_create`/`_edit` | all/assigned | C, X |
| INT-GR-10 | GMS Tracker | Σ-int | `gms_tracker_view` | all/assigned | E, O, S |
| INT-GR-11 | GMS import | admin, ops_mgr | `gms_tracker_import` | all/assigned | U, X |
| INT-GR-12 | Reports hub | Σ-int | any `*report_view` | all/assigned | E |
| INT-GR-13 | SKU report | Σ-int | `skureport_view` | all/assigned | E, F, O |
| INT-GR-14 | Parent ASIN report | Σ-int | `parentreport_view` | all/assigned | E, F, O |
| INT-GR-15 | Monthly trends | Σ-int | `monthlyreport_view` | all/assigned | E, O |
| INT-GR-16 | P&L report | Σ-int | `pnlreport_view` | all/assigned | E, O, S |
| INT-GR-17 | Inventory report | Σ-int | `inventoryreport_view` | all/assigned | E, O, S |
| INT-GR-18 | Goals report | Σ-int | `goalsreport_view` | all/assigned | E, O |
| INT-GR-19 | Revenue calculator | Σ-int | `calculator_view` | all/assigned | E, X |
| INT-GR-20 | Report viewer (generic) | Σ-int | per report | all/assigned | O, S, X |
| INT-GR-21 | Report export | Σ-int | per report `_export` | all/assigned | U |

## 5. Internal — Ops (`INT-OP`)

| ID | Screen | Roles | Perm | Scope | States |
|---|---|---|---|---|---|
| INT-OP-01 | Tasks hub (my / team / all) | Σ-int | `tasks_view` | all/assigned | E, F, B, O |
| INT-OP-02 | Task detail | Σ-int | `tasks_view` | all/assigned | O, C, X |
| INT-OP-03 | Task create | Σ-int | `tasks_manage` | all/assigned | C, X |
| INT-OP-04 | Task comments & activity | Σ-int | `tasks_view` | all/assigned | E, O |
| INT-OP-05 | Task templates | admin, ops_mgr | `templates_manage` | all | E |
| INT-OP-06 | Task template detail | admin, ops_mgr | `templates_manage` | all | C |
| INT-OP-07 | Approval queue | reviewer, admin | `tasks_manage` | all/assigned | E, F |
| INT-OP-08 | Escalations | admin, ops_mgr | `tasks_view` | all | E, S |
| INT-OP-09 | SLA policies | admin | `tasks_manage` | all | E |
| INT-OP-10 | PEMS daily routine | Σ-int | `tasks_view` | all/assigned | E, O |
| INT-OP-11 | Scorecards | admin, ops_mgr | `tasks_view` | all | E, O |
| INT-OP-12 | Action Center — list | Σ-int | `actions_view` | all/assigned | E, F, B |
| INT-OP-13 | Action detail | Σ-int | `actions_view` | all/assigned | O, X |
| INT-OP-14 | Rulesets — list | Σ-int | `rules_view` | all | E, F |
| INT-OP-15 | Ruleset detail | Σ-int | `rules_view` | all | O |
| INT-OP-16 | Ruleset run summary | Σ-int | `rules_view` | all | E, S |
| INT-OP-17 | Scheduled runs | Σ-int | `scraping_view` | all | E, F, O |
| INT-OP-18 | Run detail & logs | Σ-int | `scraping_view` | all | O, X |
| INT-OP-19 | Scraper tasks | Σ-int | `scraping_view` | all | E, O, S |
| INT-OP-20 | Scraper task detail | Σ-int | `scraping_view` | all | O, X |
| INT-OP-21 | Live sync monitor | Σ-int | `scraping_view` | all | O, S |

## 6. Internal — More (`INT-MR`)

| ID | Screen | Roles | Perm | Scope | States |
|---|---|---|---|---|---|
| INT-MR-01 | Sellers — list | Σ-int | `seller_view` | all | E, F |
| INT-MR-02 | Seller detail | Σ-int | `seller_view` | all | O, S |
| INT-MR-03 | Seller create/edit | admin, ops_mgr | `seller_manage` | all | C, X |
| INT-MR-04 | Teams — list | admin, ops_mgr | `teams_manage` | all | E |
| INT-MR-05 | Team detail | admin, ops_mgr | `teams_manage` | all | C |
| INT-MR-06 | Conversations | Σ-int | `chat_view` | own | E, F, O |
| INT-MR-07 | Conversation | Σ-int | `chat_view` | own | E, O, C, U |
| INT-MR-08 | Shared media | Σ-int | `chat_view` | own | E, U |
| INT-MR-09 | New conversation / group | Σ-int | `chat_view` | all/assigned | F |
| INT-MR-10 | Active call | Σ-int | `chat_view` | own | X |
| INT-MR-11 | Call history | Σ-int | `chat_view` | own | E, O |
| INT-MR-12 | Call detail | Σ-int | `chat_view` | own | O |
| INT-MR-13 | Users — list | admin | `users_view` | all | E, F |
| INT-MR-14 | User detail/edit | admin | `users_manage` | all | C, X |
| INT-MR-15 | Roles & permissions | admin | `roles_view` | all | E |
| INT-MR-16 | Role detail / permission editor | admin | `roles_manage` | all | C, X |
| INT-MR-17 | API keys | admin | `apikeys_manage` | all | E, X |
| INT-MR-18 | System settings | admin | `settings_manage` | all | C, X |
| INT-MR-19 | Activity log | admin, ops_mgr | `activitylogs_view` | all | E, F, O |
| INT-MR-20 | File manager | admin, ops_mgr | `files_manage` | all | E, U |
| INT-MR-21 | Upload / export queue | Σ | — | own | U, X |
| INT-MR-22 | Profile | both | — | own | E |
| INT-MR-23 | Security | both | — | own | E, X |
| INT-MR-24 | Notification preferences | both | — | own | E |
| INT-MR-25 | Appearance & accessibility | both | — | own | E |
| INT-MR-26 | About & diagnostics | both | — | own | E |
| INT-MR-27 | Help & support | both | — | own | E |

## 7. Seller surface (`SEL`)

| ID | Screen | Perm | Scope | States |
|---|---|---|---|---|
| SEL-HM-01 | Home — snapshot | `dashboard_view` | own | E, O, S, X |
| SEL-HM-02 | What changed | `dashboard_view` | own | E, O |
| SEL-HM-03 | Needs your input | `tasks_view` | own | E, O |
| SEL-PF-01 | Performance overview | `dashboard_view` | own | E, O, S |
| SEL-PF-02 | Sales / GMS | `gms_tracker_view` | own | E, O, S |
| SEL-PF-03 | Advertising | `adsreport_view` | own | E, O, S |
| SEL-PF-04 | Campaign detail | `adsreport_view` | own | O, S |
| SEL-PF-05 | Target vs achievement | `targets_view` | own | E, O |
| SEL-PF-06 | Reports library | `skureport_view` etc. | own | E |
| SEL-PF-07 | Report viewer | per report | own | O, S |
| SEL-PF-08 | Report export | `*_export` | own | U, X |
| SEL-PR-01 | My Products — list | `asinmanager_view` | own | E, F, O, S |
| SEL-PR-02 | Product detail | `asinmanager_view` | own | O, S, X |
| SEL-PR-03 | Listing quality | `asinmanager_view` | own | E, O |
| SEL-PR-04 | Price & rank history | `asintracker_view` | own | O, S |
| SEL-PR-05 | Keyword visibility | `keywords_view` | own | E, F, O |
| SEL-RQ-01 | Requests — open | `tasks_view` | own | E, F, O |
| SEL-RQ-02 | Request detail | `tasks_view` | own | O, C, X |
| SEL-RQ-03 | Raise a request | `tasks_view` | own | C, U, X |
| SEL-RQ-04 | Waiting on you (approvals) | `tasks_view` | own | E, F |
| SEL-RQ-05 | Completed requests | `tasks_view` | own | E, F, O |
| SEL-MR-01 | Chat with account team | `chat_view` | own | E, O, C, U |
| SEL-MR-02 | Account manager | — | own | E |
| SEL-MR-03 | Account & preferences | — | own | E |
| SEL-MR-04 | Help & support | — | own | E |
| SEL-MR-05 | Onboarding checklist | — | own | E |

## 8. System (`SYS`)

| ID | Screen | Trigger | States |
|---|---|---|---|
| SYS-01 | No access (403) | Permission or scope denial, deep link to a denied route | — |
| SYS-02 | You're offline | Connectivity lost with no cache | — |
| SYS-03 | Maintenance | Backend returns 503 (maintenance mode middleware) | — |
| SYS-04 | Update required | Minimum version gate / force-update flag | — |
| SYS-05 | Rate limited (429) | Limiter rejection; shows retry countdown | — |
| SYS-06 | Something went wrong | Unhandled 5xx; shows `x-request-id` for support | — |
| SYS-07 | Sync failed | Octoparse/scheduled run failure surfaced to the user | — |

---

## Critical screen specifications

Twelve screens carry the product — they are marked **★ critical** in the prompt files and are
generated and validated first (wave 0/1 in `07-stitch-setup-and-workflow.md` §5):

`AUTH-02` Sign in · `INT-HM-01` Dashboard · `INT-CT-01` ASIN Manager list ·
`INT-GR-01` Ads overview · `INT-GR-20` Report viewer · `INT-OP-01` Tasks hub ·
`INT-OP-02` Task detail · `INT-MR-07` Conversation · `SYS-01` No access ·
`SEL-HM-01` Seller Home · `SEL-PF-01` Performance overview · `SEL-MR-01` Seller chat

Ten of them are specified in detail below. The other two — `INT-GR-01` and `SEL-MR-01` — are
covered by their prompts in files `09` and `11` and by the component library. Everything else
is a variation of these.

---

### AUTH-02 · Sign in

**Surface:** both (accent varies) · **Entry:** app launch with no session

```
┌─────────────────────────────────────────┐
│                                         │
│              [ BrandCentral ]            │
│               RetailOps                  │
│        ┌───────────────────────┐        │  ← seller surface shows the
│        │  Email                │        │    "Seller workspace" chip here
│        └───────────────────────┘        │
│        ┌───────────────────────┐        │
│        │  Password        👁   │        │
│        └───────────────────────┘        │
│        Forgot password?                  │
│                                         │
│        ┌───────────────────────────┐    │
│        │        Sign in            │    │
│        └───────────────────────────┘    │
│                                         │
│        🔒 Secured by device trust        │
└─────────────────────────────────────────┘
```

| Element | Component | Notes |
|---|---|---|
| Brand mark | `BrandLogo` | Existing asset |
| Surface chip | `StatusChip` | Only when launched from a seller invite deep link |
| Email | `ROTextField` | `keyboardType=email`, autofill, autofocus off |
| Password | `ROTextField` | Visibility toggle; autofill |
| Submit | `ROButton` (filled, large) | Disabled until both fields non-empty; inline loading |
| Error | `InlineBanner` | "Email or password is incorrect" — never says which |
| Lockout | `InlineBanner` (danger) | Countdown when `LockUntil` is set |

**States:** idle · submitting · invalid credentials · locked (`LockUntil`) · rate-limited
(`AUTH` limiter, 429) · network error · force-password-reset redirect · OTP redirect.
**Endpoints:** `POST /auth/login` → `{requiresOtp, tempToken, destination}` or
`{user, accessToken, refreshToken}`.
**A11y:** both fields labelled; error announced via live region; submit reachable by
keyboard with the IME action set to `done`.
**Analytics:** `auth_login_submit`, `auth_login_success`, `auth_login_failure{reason}`.

---

### INT-HM-01 · Dashboard

**Surface:** int · **Roles:** Σ-int · **Perm:** `dashboard_view` or `targets_view` · **Scope:** all/assigned

```
┌───────────────────────────────────────────────┐
│ [▾ All sellers]        🔍   🔔•3    (AK)      │ ← app bar + ScopeIndicator
├───────────────────────────────────────────────┤
│ ⟳ Updated 12 min ago                    [↻]   │ ← FreshnessChip
├───────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐              │
│  │ Revenue     │ │ Units       │              │  ← KPI grid 2-up compact,
│  │ ₹12.5L      │ │ 8,420       │              │    4-up expanded
│  │ ▲ +12.4%    │ │ ▲ +3.1%     │              │
│  │ ~~~~~~~spark│ │ ~~~~~~~spark│              │
│  └─────────────┘ └─────────────┘              │
│  ┌─────────────┐ ┌─────────────┐              │
│  │ ACoS        │ │ Alerts      │              │
│  │ 18.30%      │ │ 12 open     │              │
│  │ ▲ +1.2% ⚠   │ │ 3 breached  │              │
│  └─────────────┘ └─────────────┘              │
├───────────────────────────────────────────────┤
│  Needs attention                           →  │  ← AlertFeed, max 5
│  ┌─────────────────────────────────────────┐  │
│  │ ⛔ Price dropped 22% — B0XXXXXXX        │  │
│  │    Amazon · Seller A · 2 h ago          │  │
│  ├─────────────────────────────────────────┤  │
│  │ ⚠  BSR fell out of top 100 — B0YYYY  │  │
│  └─────────────────────────────────────────┘  │
├───────────────────────────────────────────────┤
│  Revenue trend           [7d] [30d] [90d]     │  ← SegmentedButton
│  ┌─────────────────────────────────────────┐  │
│  │            (area chart)                 │  │  ← has table view toggle
│  └─────────────────────────────────────────┘  │
├───────────────────────────────────────────────┤
│  My tasks today                           →   │
│  • 4 open · 1 at risk                         │
└───────────────────────────────────────────────┘
│  🏠Home  📦Catalog  📈Growth  ✅Ops  ⋯More    │
```

| Region | Component | Rule |
|---|---|---|
| App bar | `ROAppBar` + `SellerSwitcher` + `ScopeIndicator` | Scope always visible |
| Freshness | `FreshnessChip` | Uses `domain.freshness.thresholds` |
| KPI grid | `KpiCard` × 4 | Card order is user-customisable (INT-HM-09); defaults above |
| Alert feed | `AlertRow` × ≤5 | Tapping opens INT-HM-03; "→" opens INT-HM-02 |
| Trend | `MetricChart` + `SegmentedButton` | Chart requires a table alternative |
| Task summary | `SummaryRow` | Only when `tasks_view` is held |
| Pull-to-refresh | — | Re-fetches dashboard + alerts + counts |

**States:** first load → KPI skeletons + chart skeleton · refresh → top `LinearProgress`
with content interactive · true empty (no sellers assigned) → "No sellers are assigned
to you yet. Ask an admin to add you to a seller." · stale → per-block `Stale` chip ·
error → inline card with request ID · offline → cached with banner.

**Permission shaping:** KPI tiles are themselves permission-gated. A user with
`targets_view` but not `dashboard_view` sees the target tiles and no revenue tiles — the
screen composes rather than being all-or-nothing.

**Endpoints:** `GET /api/dashboard`, `GET /api/chart-data`, `GET /api/alerts?limit=5`,
`GET /api/alerts/count`, `GET /api/tasks?...&assignee=me&limit=5`.
**A11y:** each KPI announced as `"{label}, {value}, {delta} versus previous period"`;
the trend chart exposes `View as table`; skeletons have `aria-busy` equivalents via
`accessibilityLiveRegion="polite"` on the container.

---

### INT-CT-01 · ASIN Manager — list

**Surface:** int · **Perm:** `asinmanager_view` · **Scope:** all/assigned

```
┌───────────────────────────────────────────────┐
│ ‹ ASIN Manager                  ⋮             │
│ [▾ Seller A]  ·  1,24,802 ASINs               │
├───────────────────────────────────────────────┤
│ 🔍 Search ASIN, SKU, title, parent            │
│ [Amazon ×] [Active ×] [BSR < 500 ×]  Clear    │ ← FilterChips
│ Sort: BSR ▲                    [⊞] [☰]        │ ← sort + density toggle
├───────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐ │
│ │ B0XXXXXXXXXX            🔴 Price −22%     │ │
│ │ Nike Air Zoom Pegasus 40                  │ │
│ │ Amazon · Seller A · FBA                   │ │
│ │ BSR 142  ▼  ₹4,499  ▼  ★ 4.3 (1.2K)      │ │
│ └───────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────┐ │
│ │ B0YYYYYYYYYY                          —   │ │
│ │ …                                         │ │
│ └───────────────────────────────────────────┘ │
│              Load more (25 of 12,480)         │
└───────────────────────────────────────────────┘
```

| Element | Rule |
|---|---|
| Density toggle | `⊞` cards (default) ↔ `☰` compact rows (44 dp, 3 columns, tabular figures) |
| Row primary | ASIN (mono, middle-ellipsis) + title (2 lines max) |
| Row metrics | BSR · price · rating — each with its own delta arrow |
| Status chip | Only when the ASIN has an active alert; opens the alert |
| Selection | Long-press enters selection mode; contextual app bar replaces the normal one with `n selected`, share, export, bulk edit |
| Infinite scroll | 25 per page; explicit `Load more` beyond 200 loaded rows |

**States:** baseline + filtered-empty ("No ASINs match these filters" + `Clear filters`) ·
true-empty ("No ASINs are tracked for this seller yet" + import CTA if permitted) ·
stale (per-row dimming when the row's price/BSR exceeds the `asinPriceBsr` threshold) ·
offline (cached list + banner) · no-permission (SYS-01 when reached by deep link).

**Endpoints:** `GET /api/asin-table` (paginated, filtered, sorted),
`GET /api/sellers`, `GET /api/categories`, `POST /api/export`.
**A11y:** each card announced as `"{title}, {asin}, BSR {bsr}, price {price}"`; density
toggle labelled; the compact table exposes row/column semantics.

---

### INT-OP-01 · Tasks hub

**Surface:** int · **Perm:** `tasks_view` · **Scope:** all/assigned

Tabs: **My tasks** · **Team** · **Overdue** · **All** (tabs filter server-side).

- Filter sheet: status, priority, assigned role, seller, brand, template, SLA state, due window.
- Sort sheet: SLA remaining (default), priority, created, updated.
- Each `TaskCard`: title, seller/brand chip, priority dot, assignee avatar, SLA pill,
  due timestamp, subtask progress (`2/5`).
- Swipe actions: **snackbar-confirmed** `Mark in progress` and `Snooze` only — no swipe-to-delete.
- FAB: `New task` (only with `tasks_manage`).
- Bulk: via long-press → assign, change status, change priority.
- Badge on the Ops nav slot = overdue count for the current scope.

**States:** baseline; filtered-empty; true-empty ("Nothing assigned to you. 🎉" while the
Team tab shows work in flight); stale (SLA pill recomputed on resume); conflict (task
edited elsewhere → banner "This task changed. Review the latest.").

**Endpoints:** `GET /api/tasks`, `GET /api/pems/instances`, `POST /api/tasks`,
`PATCH /api/tasks/:id`, `GET /api/tasks/:id/activity`.

---

### INT-OP-02 · Task detail

Structure: header (`title`, status pill, priority, seller) → SLA countdown strip →
description → checklist/subtasks → attachments → activity & comments →
sticky bottom action bar (`Start`, `Complete`, contextual).

| Rule | Detail |
|---|---|
| SLA strip | Colour + icon + word + countdown; recomputed on resume and on socket events |
| Actions | Gated by `tasks_manage` **and** assignment (mirrors `requireTaskAccess`) |
| Comments | Optimistic send, `Pending` state, retry on failure, socket-driven updates |
| Attachments | Camera / file picker / existing files; upload progress per item |
| Conflict | 409 or newer `UpdatedAt` → `ConflictDialog` with `Keep mine` / `Use latest` |
| Watchers | Visible, read-only unless permitted |

**Endpoints:** `GET /api/tasks/:id`, `PATCH /api/tasks/:id`, `GET|POST /api/tasks/:id/comments`,
`POST /api/tasks/:id/attachments`, `GET /api/tasks/:id/activity`.

---

### INT-MR-07 · Conversation

- Message list: text, image, file, poll, system events; day separators; delivery and
  read receipts; pinned message bar.
- Composer: attach, camera, voice (if enabled), send; grows to 6 lines.
- Reactions: long-press → reaction row + reply/forward/pin/edit/delete per permission.
- Offline: send queues with `Pending`; tap a pending message to retry or discard.
- New messages while scrolled up → "Jump to latest" chip with unread count.
- Ties to `GET /api/chat/messages/:conversationId` + Socket.IO.

---

### SEL-HM-01 · Seller Home — snapshot

**Surface:** sel · **Scope:** own · Merchant language throughout.

```
┌───────────────────────────────────────────────┐
│  Good morning, Rahul                          │
│  Seller A · Amazon India      [Seller chip]   │
├───────────────────────────────────────────────┤
│  ⟳ Updated 12 min ago                         │
├───────────────────────────────────────────────┤
│  ┌───────────────┐ ┌───────────────┐          │
│  │ Sales (GMS)   │ │ Ad spend      │          │
│  │ ₹12.5L        │ │ ₹1.2L         │          │
│  │ ▲ +12.4%      │ │ ▲ +4.0% ⚠     │          │
│  └───────────────┘ └───────────────┘          │
│  ┌─────────────────────────────────┐          │
│  │ This month vs target            │          │
│  │ ████████████████░░░░  78%       │          │
│  │ ₹12.5L of ₹16L  ·  9 days left  │          │
│  └─────────────────────────────────┘          │
├───────────────────────────────────────────────┤
│  ⚡ Needs your input (2)                   →  │
│  • Approve price change for 3 products        │
│  • Share Diwali stock plan by 8 Oct           │
├───────────────────────────────────────────────┤
│  What changed                             →   │
│  • 4 products lost Buy Box                    │
│  • BSR improved on 12 products                │
├───────────────────────────────────────────────┤
│  Your account manager                         │
│  ┌──┐ Priya Sharma · online   [Chat] [Call]   │
│  └──┘ Replies within 2 hours                  │
└───────────────────────────────────────────────┘
```

Key differences from the internal dashboard: **no** seller switcher, **no** "All sellers",
no internal jargon, target progress in human terms ("9 days left"), and a direct line to a
named human. "Needs your input" is the primary call to action — it is the reason a seller
opens the app.

**Permission shaping:** every block degrades independently. A seller without
`adsreport_view` simply has no ad tile; the layout closes rather than showing `--`.

---

### SEL-PF-01 · Performance overview

Segmented range (`7d / 30d / 90d / custom`) → KPI row → trend chart with table view →
top movers (up and down) → channel split → export action.

Rules: no metric without a comparison (previous period or target); every chart has a
table alternative; every "why" links to a plain-language explanation sheet rather than
internal terminology.

---

### INT-GR-20 · Report viewer (generic)

Used by 14 report screens. Contract:

| Region | Rule |
|---|---|
| Header | Report name, range, seller scope, freshness chip |
| Controls | Range picker, group-by, compare-to, filters, `View as chart / table / sheet` |
| Chart | Max 5 series; legend required above 1 series; table alternative mandatory |
| Table | Sticky header + sticky first column; horizontal scroll permitted **here only** |
| Summary | 3–5 auto-derived sentences at the top ("Revenue up 12.4% led by 3 SKUs") |
| Export | Produces XLSX/CSV via an async job; notifies on completion |
| Empty | "No data for this period" + nearest range with data ("Try 90 days") |

---

### SYS-01 · No access (403)

```
┌─────────────────────────────────────────┐
│                                         │
│                  🚫                      │
│         You don't have access            │
│                                          │
│   "Users" needs the users_view           │
│   permission. Ask an administrator       │
│   if you need it.                        │
│                                          │
│        [ Go back ]  [ Go home ]          │
└─────────────────────────────────────────┘
```

Rules: never a blank screen, never an infinite spinner, never a crash. Triggered by a
deep link or a permission revoked mid-session. Crucially, a denied destination is also
**removed from the navigation registry on the next refresh**, so a user does not keep
tapping into a wall.

---

## Cross-screen conventions

| Convention | Rule |
|---|---|
| Pull-to-refresh | Every list and dashboard. Refreshes data, not layout. |
| Skeleton | Mirrors the final layout's block structure; never a bare spinner for primary content |
| App bar | Small variant on scroll; title collapses to the parent module name on detail screens ("ASIN Manager · B0XXX") |
| Back | System back and header back do the same thing; back from a root tab goes to Home, not out of the app |
| Long-press | Reveals secondary actions everywhere; the only way to enter selection mode |
| Overflow `⋮` | Holds rare and destructive actions; destructive items use the danger token and sit last |
| Empty state | Illustration + one sentence + one action. Never "No data". |
| Error state | Plain language + what to do + request ID for support |
| Numbers | Per §9.2 of the schema; tabular figures in all metric contexts |
| Timestamps | Relative under 24 h, absolute beyond, always Asia/Kolkata |
| Search | Global search (INT-HM-07) indexes modules, sellers, ASINs, tasks, and people; offline it searches only cached entities |
