# RetailOps — Full Project & Recent-Changes Analysis

**Date:** 2026-09-19
**Analysed commit:** `36252a6` — *Merge pull request #64 from Brandcentral-Pvt/arena/01a0b8b9-retailops*
**Branch used for analysis:** `arena/01a0b907-retailops`
**Method:** repository inventory + `gh` history/PR/CI inspection + local execution of the project's own verification commands (lint, typecheck, build, backend test suite, npm audit). Every claim below is backed by a command result or a file/line reference.

---

## 1. Executive summary

**What the project is.** RetailOps (package name `gms-dashboard`, product name *RetailOps — Amazon Seller Intelligence Platform*, production at `data.brandcentral.in`) is a full-stack, single-tenant-instance **Amazon marketplace operations platform** built by BrandCentral. It tracks ASINs across sellers, ingests marketplace data (Octoparse/Playwright scrapers + Amazon Creators API), computes ads/GMS/target analytics, runs an OKR + AI strategy layer, and hosts a large task-management engine (**PEMS** = Performance & Execution Management System) plus chat/calling (CometChat). It is a real production system, not a scaffold.

**Scale (measured on this checkout).**

| Area | Files | LOC | Notes |
|---|---:|---:|---|
| Frontend (`src/`) | 660 | **106,424** (js/jsx/ts/tsx) | React 19 + Vite 8 + TS/JSX mix |
| Backend (`backend/`) | 360 | **73,646** (js) | Express 5, raw SQL (mssql) |
| .NET port (`dotnet/`) | 121 | **8,090** (C#) | net10.0, auth-only vertical slice |
| Route registrations | 44 modules | 431 endpoints | — |
| Migrations | 25 files | — | `001` → `024` (gaps/dupes: no `011`, two `004`) |
| Backend tests | 11 suites / 133 tests | — | 132 pass locally |

**Recent activity (last 6 weeks, from PR/commit history).** The last six weeks show two clusters — 2026-08-04 → 09-16 (scrapers / Live Data Inspector) and a **burst on 09-18 → 09-19**, where almost everything landed. The dominant workstreams in that burst are: (a) a **brand-new Operations Command Center dashboard** (dashboard PRs #61, #63, #64 plus the design-v1 PRs #37/#38/#39), (b) **PEMS correctness + seller-scope access control** (#63), (c) **auth/OTP login rebuild**, (d) **mobile navigation fix** (#61), (e) a **CI/CD overhaul** front-loaded the same day, and (f) **~20 Dependabot dependency bumps** (#41–#60) merged in a single hour. The repo has 64 PRs total and **zero open PRs/issues**.

**The headline problems (all verified, not inferred):**

1. 🔴 **CI has never run — not once.** `.github/workflows/ci.yml` line 142 is invalid YAML, so GitHub rejects the whole workflow ("*This run likely failed because of a workflow file issue*"). Every `ci.yml` run shows **0s duration** (workflow file rejected before a job starts). This means **the entire "CI/CD overhaul" that was merged on 2026-09-19 is non-functional.**
2. 🔴 **`npm run typecheck` checks nothing.** `tsconfig.json` sets `baseUrl`, which was removed in TypeScript 7 (`error TS5102`). `tsc` aborts at config parse, so **not a single `.ts/.tsx` file in the repo is type-checked** — and the repo now runs `typescript@^7.0.2`.
3. 🔴 **Production CD is failing and cannot deploy.** *Deploy to Production* fails at **Pre-deploy Validation → Validate secrets** (SSH secrets missing), the deploy job is skipped, and the **rollback job also fails** (it runs even when deploy never started). The deployed production build must therefore be manual/out-of-band.
4. 🟠 **Lint is red (472 errors / 44 warnings)** → `npm run lint` (`--max-warnings=0`) fails, so CI could not pass on main even after fixing the YAML.
5. 🟠 **CI's frontend test step is broken by design** — it calls `npm run test`, but `package.json` only defines `test:auth` (Playwright). The two Playwright specs in `tests/` are never executed in CI.
6. 🟠 **Production dependency vulnerabilities:** backend `npm audit --omit=dev` = **1 critical (`xmldom`) + 7 high + 3 moderate**; frontend = 1 high (`xlsx`, no fix available). Both `xmldom` and `xlsx` parse **untrusted uploaded files / scraped HTML** (see §6 P1-4).
7. 🟠 **Configuration drift**: `SMTP_PASS` vs `SMTP_PASSWORD`, `NIM_API_KEY` vs `NVIDIA_NIM_API_KEY`, and a stale `.env.production.example` that still documents Clerk and `DATABASE_URL` (neither is used).
8. 🟡 **Substantial dead code**: ~31 orphaned files/components, including **four parallel dashboard implementations** (`OpsCenter`, `Dashboard`, `DashboardV2`, `corp/CorpDashboardPage` + two component libraries).
9. 🟡 **Repo hygiene**: a 527 KB raw AI-session transcript (`session.md`) at the repo root, a first line of `` ``` `` committed into `.gitignore`, a vendored `backend/superagent-10.3.0.tgz`, a scratch file inside `backend/controllers/`, and `.windsurfrules` / `.obolus/rules` that describe a **Next.js App Router** project (this is React + Vite).

**Bottom line.** The product surface is broad and actively developed, but **the safety net is missing**: no working CI, no working type check, a red lint, no frontend unit tests, and a deploy pipeline that can't deploy. The most valuable next move is not a new feature — it is restoring the pipeline (`ci.yml` one-line fix → typecheck config → lint baseline → test script) and then consolidating the dashboard/legacy code.

---

## 2. How this was verified

| Check | Command | Result |
|---|---|---|
| Frontend build | `npm run build` | ✅ **PASS** — 6.74 s, `dist/` produced |
| Backend tests | `cd backend && npm test -- --ci` | ⚠️ **132 / 133 pass**, 1 pre-existing failure (`nvidiaAiService`) |
| Frontend lint | `npm run lint` | ❌ **FAIL** — 516 problems (472 errors, 44 warnings) |
| Frontend typecheck | `npm run typecheck` | ❌ **FAIL** — `tsconfig.json(24,9): error TS5102: Option 'baseUrl' has been removed` (0 files analysed) |
| CI status | `gh run list` / `gh run view` | ❌ `ci.yml` runs fail in **0 s** (invalid workflow file); `cd.yml` prod runs fail at secrets validation |
| CD status | `gh run view <cd-run>` | ❌ Pre-deploy **secrets validation fails**; rollback also fails |
| Dependency audit | `npm audit --omit=dev` (root + backend) | ❌ backend 1 critical / 7 high / 3 moderate; root 1 high |
| Workflow YAML | `js-yaml` parse of `.github/workflows/*.yml` | ❌ `ci.yml:142` fails to parse; `cd.yml`, `staging.yml`, `security.yml` OK |
| Dev server | `npm run dev -- --host 0.0.0.0 --port 5173` | ✅ Serves `/login` (HTTP 200); `/api` proxies to `localhost:3001` |
| Dead-code scan | cross-reference of every page/component basename | ~31 orphan files (see §6 P2-1) |

Not verifiable in this sandbox (no MSSQL/Redis/credentials): the runtime behaviour of the API, SQL correctness, scraper runs, and the dashboard's live data.

---

## 3. Recent updates — what actually changed

### 3.1 Timeline (from `gh api .../commits` + PR list)

| Date | PR / commit | Theme | Substance |
|---|---|---|---|
| 09-19 | **#64** `OpsCenter: GMS-ranked top products + deep-data, interactive dashboard` | Dashboard | Top products re-ranked by **GMS per ASIN** instead of ads orders; period-over-period deltas; bucket-aligned trends; drill-downs; CSV export; new `period` / `gms` / `ads` / `previous` payload blocks; timezone-safe day keys; migration `024` covering indexes for date-window aggregates. |
| 09-19 | **#63** `fix(dashboard): repair data binding, route shadowing, permissions, and realtime wiring…` | Dashboard + PEMS | Single owner for `/api/tasks` (route-shadowing fix), seller-scope enforcement on task mutations, realtime via one authenticated socket, `SectionState` empty/error states, `targetMetrics.ts`, ~850 lines of new backend tests (dashboard access, PEMS instances, task routes, route order). |
| 09-19 | **#61** `fix(mobile-nav): restore hamburger toggle and harden mobile drawer` | UX | Sidebar drawer on small viewports. |
| 09-19 | *feat(auth): rebuild RetailOps login and OTP verification experience* | Auth | New login + OTP flow. |
| 09-19 | *ci: overhaul CI/CD pipelines with tests, security, staging, rollback* | Infra | Added `ci.yml`, `cd.yml`, `staging.yml`, `security.yml`, `dependabot.yml`, `.releaserc.json` — **but `ci.yml` is syntactically invalid (§6.1)**. |
| 09-19 | **#41–#60** (~20 Dependabot PRs, all merged between 05:58–07:08) | Deps | React Query 5.102, CometChat UIKit 7.2, ApexCharts 7.4, Express-rate-limit 8.7, ExcelJS 4.4, node-cron 4.6, puppeteer 25.11, helmet 8.3, PM2 7.0.3, etc. |
| 09-18 | #37/#38/#39 + design commits | Dashboard v1 | Corporate flat design system, `CorpDashboardPage`, `DashboardV2` (widgets/charts/hooks), accordion + seller-landscape views. |
| 09-18 | misc | Hardening | Lazy-load CometChat, trusted-device revoke, first-hop IP handling, OOS detection, Playwright scraper concurrency + circuit breakers, keyword-research RBAC gate, bulk import scripts, schema-sync/RBAC migrations (`012`–`020`). |
| 09-16 | #36 | Live Data Inspector | Unified rating/review metrics + scrape cache. |
| 09-14 | #35/#34 | Scrapers | Playwright scraper stack replaces Octoparse for A+ content + rating; sub-BSR from `browseNode` `salesRank`. |
| 08-04 | #… | AI LQS | AI-assisted Listing Quality Score in Live Data Inspector. |

### 3.2 What the recent dashboard work actually is

* Live dashboard = **`src/pages/opsCenter/*`** (7 files, ~2,840 LOC) mounted at **both `/` and `/dashboard`** (`src/App.jsx:130-131`), behind permission `dashboard_view`.
* It is backed by **`GET /api/dashboard`** → `backend/controllers/dashboardController.js` (~1,700 lines, single `getDashboardData` handler with 8+ numbered sections) with an in-process cache (`backend/middleware/cache.js`).
* `src/pages/Dashboard.jsx` (legacy), `src/pages/DashboardV2.tsx` + `src/components/dashboard-v2/*`, and `src/pages/corp/CorpDashboardPage.jsx` + `src/components/corp/*` all still exist; only `DashboardV2` is still routed (at `/dashboard-v2`), and **`CorpDashboardPage.jsx` is orphaned**.
* `src/components/dashboard/*` (24 components) is used **only by the legacy `Dashboard.jsx`**, which is imported by `App.jsx` but no longer routed.

> ⚠️ The GMS ranking, period-over-period deltas, and drill-downs in #64 are explicitly **unverified against a live MSSQL** (the PR says so). Treat the dashboard's numbers as "shipped, code-reviewed, not data-verified".

---

## 4. Product & feature map

| Domain | Frontend | Backend | Maturity |
|---|---|---|---|
| **Ops dashboard** | `pages/opsCenter/*` (live), `Dashboard.jsx`, `DashboardV2.tsx`, `corp/*` | `dashboardController`, `dataRoutes` | Live, over-duplicated |
| **ASIN intelligence** | `AsinManagerPage.jsx` (4.3k LOC), `AsinDetailModal`, `ExportAsinModal`, `SellerAsinTrackerPage` | `asinController.js` (3.7k LOC), `asinCompleteController`, `asinTableController` | Very mature / very large |
| **Marketplace data ingestion** | `LiveSyncPage`, `ScrapeTasksPage`, `ScraperDashboardPage`, `ScheduledRunsPage` | Octoparse service, Playwright scraper + runner, `creatorsapi-sdk` (vendored), `marketDataSyncService` (161 KB!) | Mature, mid-migration Octoparse → Playwright |
| **Ads analytics** | `AdsReport`, `AdsManagerPage`, hooks `useAds*` | `adsApi`, `exportAdsController`, `feeCalculationEngine`, attribution | Mature |
| **GMS / targets / OKR** | `GmsTrackerPage`, `TargetVsAchievement*`, `TargetCreationPage`, `GoalAchievementReport`, `RevenueCalculatorPage` | `targetController`, `goalController`, `objectiveController`, `growthExecutionController`, `revenueController` | Mature |
| **PEMS (tasks)** | `modules/pems/*` (6 pages, 6.5k LOC) | `controllers/pems/*`, `services/pems/*`, migrations `001`–`003`, `009`, `010`, `015` | Mature engine; 12-state workflow, SLA, escalation, reviews |
| **Auth / RBAC** | `LoginPage` (rebuilt), OTP, `RolesPage`, `TeamManagementPage`, `UsersPage`, `Unauthorized` | `authController` (718 LOC), `roleController`, `middleware/auth.js`, `loginRateLimiter`, token blacklist, trusted devices | Mature; **also being ported to .NET** |
| **Chat & calling** | `src/CometChat/*` (vendored UIKit fork, 2289-line `CometChatHome.tsx`), `ChatContainer` | CometChat service, `chatController`, webhooks | Mature but heavy (2.4 MB chunk) |
| **AI layer** | (surfaced inside LDI/insights) | OpenAI, Perplexity, **NVIDIA NIM** (LQS + vision + image gen), `aiGoalService`, `aiTaskService` | Working, partially env-misconfigured |
| **Files / exports / alerts** | `FileManagerPage`, `UploadExport`, `AlertRulesPage`, `RuleSetsPage`, `WebhookSettingsPage`, `ActivityLog` | rule engine, `rulesetController`, `webhookController`, `exportController`, audit logging | Mature |
| **Onboarding / settings** | `SetupWizardPage` (1.5k LOC), `SettingsPage`, `ApiKeysPage`, `ProfilePage`, `UnderMaintenance` | `setupWizardController`, `systemSettingController`, `apiKeyController`, `maintenanceMode` | Mature |

---

## 5. Architecture

### 5.1 Frontend

* **Stack:** React 19, Vite 8, React Router 7, Tailwind 4 (CSS-first, no `tailwind.config`), Ant Design 6 + MUI 9 + Bootstrap 5 + RSuite 6 (four UI kits in one app), ApexCharts + Recharts + Chart.js + MUI X-Charts (four chart libs), Zustand + TanStack Query + 9 React contexts.
* **Routing:** single `src/App.jsx` (`AppRoutes`) with ~50 lazy routes, each wrapped in `<ProtectedRoute permission="…">` (e.g. `dashboard_view`, `gms_tracker_view`, `tasks_manage`). Route→meta mapping in `components/layout/RoutePageMeta`.
* **Provider stack (nested):** `ErrorBoundary → Refresh → Auth → Onboarding → Socket → Sidebar → DateRange → PageTitle → Toast → Antd ConfigProvider → AntdApp`.
* **Data access:** `src/services/api.js` (2,220 LOC, ~25 exported API namespaces) + `src/lib/api-client.ts` + `src/services/apiCache.js` + `src/services/db.js` + React Query. **Two HTTP layers coexist** (`api.js` axios instance and `lib/api-client.ts`), which is a real source of drift — `useDashboardData.ts` imports both.
* **Realtime:** `contexts/SocketContext.jsx` + `services/realtimeService.ts` (single authenticated socket, per #63).
* **Build characteristics:** manual chunking produces 3.3 MB `vendor_core` (961 kB gzip), 2.4 MB `vendor_chat`, 1.45 MB `vendor_antd`, 1.0 MB `vendor_charts`; Vite warns about >1 MB chunks. First-load JS on the dashboard route is heavy.

### 5.2 Backend

* **Entry point:** `backend/server.js` (775 lines) — helmet, CORS allow-list (localhost + `FRONTEND_URL`), tiered rate limiters (`READ`/`AUTH`/`STRICT`/`BULK`), HTTPS redirect, `express.json({limit:'10mb'})`, request-id ALS, api-call logger, structured request logging, process-level `unhandledRejection`/`uncaughtException` guards, memory watchdog.
* **Route mounting order is load-bearing and commented as such:** specific routers first, wildcard `growthExecutionRoutes` **last** (`server.js:224-232`) to avoid shadowing `/api/tasks`. A unit test (`__tests__/unit/serverRouteOrder.test.js`) guards this — a genuinely good pattern.
* **Layering:** `routes → controllers (52) → services (65) → database/db.js (mssql pool)`. No ORM; **all SQL is hand-written**.
* **Persistence:** MSSQL with a **primary + optional read replica** pool (`DB_READER_*`), `useUTC:false` + `TZ=Asia/Kolkata` (the source of the timezone bugs fixed in #64), pool `max:200/min:10` in `database/db.js` **vs** `max:50/min:5` in `config/env.js` — duplicated config that can disagree.
* **Schema:** 25 migration files run by `scripts/runMigrations.js` (`npm run migrate`), all idempotent-ish with "skip on missing table" contracts.
* **Realtime/jobs:** Socket.IO (+ Redis adapter/sticky), BullMQ-style queue definitions in `backend/jobs/`, `otpCleanup`, cron `ScheduledRuns`.
* **Vendored code:** `backend/lib/creatorsapi-sdk` — 95 files / 13.8k LOC Amazon SDK, used by `liveDataSyncService` and `keywordResearchService`.

### 5.3 Security & multi-tenancy

* JWT access (2 h) + refresh (7 d), token blacklist, per-user blacklist (session invalidation), password expiry, OTP + trusted devices, login rate limiting, `roles` + `ExtraPermissions`/`ExcludedPermissions` per user, **seller-scope filtering** (users see only assigned sellers) — enforced in `middleware/auth.js` and, as of #63, on task mutations.
* RBAC permissions are seeded by migrations `016`/`017`; frontend gates routes with the same permission strings.
* No secrets are committed (only test fixtures). `.env*` are git-ignored.

### 5.4 The .NET port (`dotnet/`)

* 4 projects (Api / Application / Domain / Infrastructure), **net10.0**, EF Core 10, Serilog, BCrypt, MailKit.
* **Domain is complete-ish:** 75 entity classes, all mapped in `RetailOpsDbContext.cs` (116 KB).
* **Only the auth vertical is implemented:** `AuthService`, `OtpService`, `PasswordResetService`, `TrustedDeviceService`, `SystemLogService` + `AuthController`. `WeatherForecastController.cs` (template leftover) is still present.
* **No tests, no CI job, no porting plan committed** — `docs/` has PEMS/Octoparse docs but nothing on the .NET migration, and the only record of the work is the raw transcript in `session.md`. This is ~1 of ~50 controllers ported; it is a **parallel, unmanaged codebase** today.

### 5.5 Deployment & infrastructure

* **Frontend:** Vite build → static; `vercel.json` (SPA rewrite) and `nginx.conf` (gzip, upstream `backend:3001`, static caching) both exist.
* **Backend:** `Dockerfile.backend` (multi-stage, non-root), `docker-compose.yml` (backend + nginx), PM2 `ecosystem.config.js`, deploy scripts on the VPS `/var/www/retail-ops` with `pm2 restart brand-central-api`.
* **CI/CD:** 4 workflows — `ci.yml` (frontend/backend/security/docker-build), `cd.yml` (prod SSH deploy + rollback + summary), `staging.yml` (develop branch), `security.yml` (weekly audit + CodeQL + Trivy + secret scan). Branch protection is not enforced; PRs are merged with failing/absent checks; there is a `develop` branch and 14 other stale remote branches (`feat/*`, `fix/*`, `arena/*`, `dashboard-design-*`).

---

## 6. Findings (severity-ranked, with evidence)

### 🔴 P0-1 — CI is dead: invalid YAML in `ci.yml`

`.github/workflows/ci.yml:142`:

```yaml
      - uses: actions/setup-node@v4
        with: { node-version: ${{ env.NODE_VERSION }} }
```

The flow mapping `{ … }` contains `${{ … }}`; the inner `{` opens a nested flow map, so YAML parsing fails (`missed comma between flow collection entries`, verified with `js-yaml`). GitHub consequently can't load the workflow: `gh run view 35434882265` → *"X This run likely failed because of a workflow file issue"*, every run 0 s. **Consequence: no lint, no typecheck, no tests, no docker build, no security audit has ever run on `main` — and nobody noticed for the whole day, because the merged PRs also had red checks.**

**Fix (3 lines, block style is the convention everywhere else in the same file):**

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
```

### 🔴 P0-2 — Type checking is a no-op

`tsconfig.json:24` sets `"baseUrl": "."`, removed in TS 7; the repo pins `typescript@^7.0.2`. `npm run typecheck` → `error TS5102` and **zero files checked**. Fix: drop `baseUrl` and make `paths` relative (`"@/*": ["./src/*"]`), then **triage the real errors that surface for the first time** (expect a large batch, since `strict:false` and the app has many `.ts/.tsx` files).

### 🔴 P0-3 — Production deploy cannot succeed

`cd.yml` *Pre-deploy Validation* fails at **Validate secrets** ⇒ `SSH_PRIVATE_KEY` / `DEPLOY_HOST` / `DEPLOY_USER` are not configured. `Deploy to VPS` is skipped, and the `rollback` job (`if: failure()`, `needs: deploy`) *also fails* while trying to open SSH. Secondary defects in the same file: the rollback has no `checkout`, health-checks `https://$DEPLOY_HOST/api/health` (assumes the host is a DNS name), and the deploy resets `origin/main` even for a `workflow_dispatch` of another ref.

### 🟠 P1-1 — Lint baseline is red: 472 errors / 44 warnings

Top rules: `no-unused-vars` **256**, `react-hooks/set-state-in-effect` **94**, `react-hooks/exhaustive-deps` **44**, `no-empty` 25, `react-hooks/static-components` 17, `react-hooks/immutability` 17, `no-undef` 16, `react-hooks/refs` 13. Several are `no-undef` on Node globals in `vite.config.js` (`process`, `__dirname`) — i.e. the ESLint config doesn't cover config files with Node globals. Until the count reaches 0, `--max-warnings=0` guarantees a red CI.

### 🟠 P1-2 — CI's frontend test step can't work

`ci.yml` runs `npm run test`, but `package.json` defines only `dev, build, lint, typecheck, preview, test:auth`. The `if … | grep -q "No tests found"` guard doesn't catch npm's *"Missing script"* error. The real Playwright suite (`tests/auth/authentication.spec.js`, `tests/mobile-nav.spec.js`) is not run anywhere, though `playwright.config.js` even self-hosts Vite on 5173.

### 🟠 P1-3 — Backend lint step is silently skipped

The step only runs if `backend/eslint.config.js` / `.eslintrc*` exists — **there is no backend ESLint config**, so 73.6k LOC of backend code is unlinted. (Combined with the missing CI, backend style is entirely unenforced.)

### 🟠 P1-4 — Vulnerable production dependencies

`npm audit --omit=dev`:

| Scope | Severity | Package | Fix | Exposure |
|---|---|---|---|---|
| backend | **critical** | `xmldom` | none | `services/directScraperService.js` parses **scraped third-party HTML** with `DOMParser` |
| backend | high | `xlsx` | none | parses **user-uploaded** spreadsheets in 7 controllers (bulk upload / imports) |
| backend | high | `@clerk/clerk-sdk-node`, `@clerk/shared`, `js-cookie` | major downgrade | **dead dependency** — zero `clerk` references in code |
| backend | high | `@socket.io/pm2`, `pm2`, `js-yaml` | major downgrade | cluster/tooling |
| backend | moderate | `bull`, `exceljs`, `uuid` | major downgrade | queues/exports |
| frontend | high | `xlsx` | none | `BSRViewModal` + export flows |

`xlsx` and `xmldom` have **no upstream fix** — mitigation means replacing or sandboxing the parsers, or at minimum rejecting/limiting uploads. Removing Clerk is free (it's still in `dependencies` and the CI security job would flag it).

### 🟠 P1-5 — Env & config drift

| Documented / read here | Actually read there | Impact |
|---|---|---|
| `SMTP_PASS` (`backend/.env.example`, `config/env.js:85`) | `SMTP_PASSWORD` (`services/emailService.js:9`) | Email auth may be silently unauthenticated/undefined depending on which name is deployed |
| `NIM_API_KEY` (`config/env.js:95`) | `NVIDIA_NIM_API_KEY` (all 5 AI services) | `config.ai.nimKey` is always undefined; dead config |
| `.env.production.example` (Clerk, `DATABASE_URL`, `PORT=3000`, `GMS_API_KEY`, `api.yourdomain.com`) | nothing uses these | Actively misleading deployment doc |
| Root `.env.example` (LIVE_SYNC_*, DB_HOST) vs `backend/.env.example` (DB_SERVER) | DB_* names differ between the two templates | Two incompatible ways to configure the same DB |

### 🟠 P1-6 — No verification against real data

The newest, highest-visibility feature (OpsCenter dashboard) is validated by build + ESLint + jsdom harness + backend unit tests only; **#64 explicitly states it was never run against a live MSSQL**. Its SQL (CTEs, `EXISTS` join, `GROUP BY Date` over 2× windows) and its index migration `024` are unproven in production.

### 🟡 P2-1 — Four dashboards, two component libraries, 31 orphans

| Artifact | Routes to it | Status |
|---|---|---|
| `pages/opsCenter/*` | `/`, `/dashboard` | **live** |
| `pages/DashboardV2.tsx` + `components/dashboard-v2/*` | `/dashboard-v2` | reachable but unlinked |
| `pages/Dashboard.jsx` + `components/dashboard/*` (24 files) | none | legacy, still compiled by Vite |
| `pages/corp/CorpDashboardPage.jsx` (975 LOC) + `components/corp/CorpLayout.jsx` | **none** | orphaned |

Also orphaned: `AlertsPage.jsx`, `AdsReportsPage.jsx`, `RegisterPage.jsx`, `components/actions/*` (17 files), `PermissionGate.jsx`, `UserSettings.jsx`, `pems/components/{BoardView,CalendarView}.jsx`, and more (full list reproducible with the scan in Appendix B). Two dead lazy imports exist in `App.jsx`: `LiveSyncTrackerPage` and `LiveDataInspectorPage` are imported but all three live-sync routes render `LiveSyncPage`.

### 🟡 P2-2 — Repo hygiene

* `session.md` — **527 KB** raw AI session transcript committed at the repo root (the largest tracked file).
* `.gitignore` begins with a stray ```` ``` ```` line (a markdown fence accidentally committed) and ignores `backend/test_*.js` while `backend/controllers/test_bulk.js` is tracked.
* `backend/superagent-10.3.0.tgz` — 159 KB vendored tarball.
* `backend/run_full_sync.js`, `backend/sync_all_sellers.js` — ad-hoc scripts at backend root.
* `.windsurfrules` and `.obolus/rules/01-nextjs-stack.mdc` mandate **Next.js App Router / Server Components / `app/` directory** conventions, and three of five Obolus rules mandate an MCP tool (`read_optimized_file`) that is not available here. These actively mislead any agent/dev working on this Vite SPA.
* `README.md` structure block references a `mobile/` React-Native app that **does not exist** in the repo, and hard-codes counts ("47 pages / 38 routes / 49 services") that have drifted (54 pages, 44 route modules, 65 services).
* 15 remote branches linger (5 `arena/*`, 7 `feat/*` + `feature/*` + `fix/*`, `develop`, `dashboard-design-from-repository-4b034`).

### 🟡 P2-3 — Test coverage is thin relative to the blast radius

11 backend suites / 133 tests for 431 endpoints and 73.6k LOC (the newest dashboard tests are good, focused regression tests; the rest of the surface is untested). **Zero** frontend unit tests; Playwright specs exist but are excluded from CI; no integration test touches MSSQL. `__tests__/unit/nvidiaAiService.test.js` has been failing since it was written (the service caches `process.env.NVIDIA_NIM_API_KEY` in its constructor, so the test's `beforeEach` env change has no effect) — a red test that everyone has learned to ignore, which is worse than no test.

### 🟡 P2-4 — Frontend weight & library sprawl

Four component kits (antd, MUI, Bootstrap, RSuite) + four chart libs + two HTTP clients + a vendored CometChat UIKit fork in-tree. `vendor_core` alone is 3.3 MB raw / 961 kB gzip; `vendor_chat` 2.4 MB / 691 kB gzip. Every extra kit is also a supply-chain and upgrade tax (visible in the ~20 Dependabot PRs merged in one hour).

---

## 7. Risk register

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | Regressions reach production unnoticed (no CI, red lint, no typecheck, no frontend tests) | High | **Certain (already happening)** | Fix `ci.yml`, then `tsconfig`, then lint baseline; add Playwright to CI |
| R2 | A dependency CVE is exploited via the upload/scrape surface (`xmldom`, `xlsx`) | High | Medium | Replace/sandbox parsers; add file-type + size limits; keep CodeQL/Trivy green |
| R3 | Production deploy pipeline is unusable; manual deploys bypass migrations | High | High | Either configure the SSH secrets and fix the rollback job, or delete `cd.yml` and document the manual path honestly |
| R4 | Dashboard numbers are wrong in ways only SQL tests catch | Medium | Medium | Verify #64 against a staging MSSQL; add integration tests for `/api/dashboard` |
| R5 | Two backends (Node + .NET) diverge silently | Medium | Medium | Decide the .NET port's scope: commit a plan doc or archive `dotnet/`; never leave it half-migrated |
| R6 | Config-name drift (SMTP/NIM) breaks email/AI silently in some environment | Medium | Medium | Single source of truth (`config/env.js`) + fail-fast validation of optional keys |
| R7 | Contributors/agents follow `.windsurfrules` (Next.js) and produce wrong architecture | Medium | High | Rewrite `.windsurfrules`/`.obolus` for React+Vite+Express, or delete them |
| R8 | Legacy dashboards/components keep being imported by mistake | Low | Medium | Delete-or-quarantine pass on the 31 orphans + legacy dashboard |

---

## 8. Recommended plan (ordered by value ÷ effort)

**Phase 0 — restore the safety net (hours, no product risk)**
1. Fix `ci.yml:142` (block-style `with:`) → CI starts running immediately.
2. Fix `tsconfig.json` (`remove baseUrl`) → real typecheck; triage errors, decide on `strict` incrementally.
3. Add the missing `test` script (`vite`/`vitest` if unit tests are desired, or alias to `test:auth`) and wire Playwright into CI with `PLAYWRIGHT_BROWSERS_PATH` cache.
4. Add `backend/eslint.config.js` (or extend the root config to `backend/**` with Node globals) and lint config files (`vite.config.js`, `playwright.config.js`).
5. Either configure the CD secrets + fix the rollback job (`if: failure() && needs.deploy.result != 'skipped'`, add checkout, make health-check URL configurable) or disable `cd.yml` until it can work.
6. Remove `@clerk/clerk-sdk-node` (unused), plan replacements for `xmldom`/`xlsx`.

**Phase 1 — correctness & config truth**
7. Reconcile env names: `SMTP_PASSWORD` ⇄ `SMTP_PASS`, `NVIDIA_NIM_API_KEY` ⇄ `NIM_API_KEY`; rewrite `.env.production.example`/`.env.staging.example` to the real variable set; add a startup validator that warns (does not crash) on optional-but-misnamed keys.
8. Unify DB pool config (`database/db.js` vs `config/env.js`) behind one source.
9. Verify the OpsCenter dashboard against staging data; add backend integration tests for the dashboard CTEs and migration `024`.
10. Fix or delete the `nvidiaAiService` test (make the service read the key lazily — that also makes runtime key rotation possible).

**Phase 2 — reduce surface**
11. Pick one dashboard: delete `pages/Dashboard.jsx`, `DashboardV2.tsx`, `corp/CorpDashboardPage.jsx`, `components/corp/CorpLayout.jsx` (and their exclusive components) or move them to a `legacy/` folder that is excluded from the build.
12. Delete the 31 orphans (regenerate the list with the scan in Appendix B) and the two dead lazy imports in `App.jsx`.
13. Repo hygiene: remove `session.md`, the `.gitignore` ``` fence, `backend/superagent-10.3.0.tgz`, `controllers/test_bulk.js`; move sync scripts to `scripts/`.
14. Rewrite `.windsurfrules`/`.obolus/rules` for this stack.
15. Update `README.md` (drop `mobile/`, refresh counts, document the real branch/PR flow).
16. Decide the .NET port's fate (§5.4).

---

## 9. Open questions for the team

1. **Deployment reality:** how is production actually deployed today (manual SSH? different repo?) — and should `cd.yml` be fixed or removed? *(Determine before touching P0-3.)*
2. **TypeScript 7:** is the upgrade intentional? `strict:false` means even a fixed typecheck will surface mostly import/JSX-level noise first. What's the target?
3. **Dashboard consolidation:** is `OpsCenter` now the single source of truth (implying `Dashboard`/`DashboardV2`/`Corp` can be deleted), and should `/dashboard-v2` stay routed?
4. **.NET migration:** is it an active program of work (needing a plan doc, tests, CI job) or an experiment to archive?
5. **Playwright in CI:** the specs intercept auth and need no DB — should they gate PRs?
6. **`xlsx`/`xmldom`:** acceptable to swap for maintained parsers (e.g. `@xmldom/xmldom`, SheetJS' current distribution or `exceljs`) given uploaded-file exposure?

---

## Appendix A — Inventory metrics

```
Frontend   660 files | 106,424 LOC | 54 pages (+7 stylesheets) | 183 components | 19 hooks | 9 contexts | 14 services
Backend    360 files |  73,646 LOC | 52 controllers (26.5k) | 65 services (18.1k) | 44 route modules (2.8k)
                                     | 11 middleware (1.1k) | 4 jobs | 25 migrations | 95-file vendored Creators SDK (13.8k)
.NET       121 files |   8,090 LOC | 75 entities | 1 feature controller | net10.0 | no tests
Tests      backend 11 suites / 133 tests (132 pass) | frontend Playwright 2 specs (not in CI) | 0 frontend unit tests
API        431 route registrations across 44 modules
Build      vite build 6.74 s · vendor_core 3.3 MB (961 kB gz) · vendor_chat 2.4 MB (691 kB gz)
Git        64 PRs (all merged, 0 open) · 0 open issues · 15 remote branches · shallow clone (1 commit locally)
CI         all workflows failing · cd.yml prod deploy failing on secrets · security.yml weekly (never green in practice)
```

## Appendix B — Reproducing this analysis

```bash
# verification
npm ci && npm run build && npm run lint && npm run typecheck
cd backend && npm ci && npm test -- --ci
npm audit --omit=dev --json                 # root
cd backend && npm audit --omit=dev --json   # backend

# CI / history
gh run list --limit 15
gh run view <run-id>                        # "workflow file issue"
gh api repos/Brandcentral-Pvt/RetailOps/commits?per_page=100

# workflow YAML validation (js-yaml installed in a scratch dir)
node -e "const y=require('js-yaml'),f=require('fs');y.load(f.readFileSync('.github/workflows/ci.yml','utf8'))"  # → YAMLException at 142:32

# dead-code scan (orphans = basename never referenced elsewhere in src/)
for f in $(find src/pages src/modules src/components -name '*.jsx' -o -name '*.tsx'); do
  b=$(basename "$f" | sed 's/\.[jt]sx$//')
  [ "$(grep -rl "$b" src --include=*.{js,jsx,ts,tsx} | grep -v "^$f$" | wc -l)" -eq 0 ] && echo "ORPHAN: $f"
done

# local preview (no DB required to render the login page)
npm run dev -- --host 0.0.0.0 --port 5173   # http://localhost:5173/login → 200
```

## Appendix C — Key files for orientation

| Purpose | File |
|---|---|
| Frontend entry / routing / providers | `src/App.jsx` |
| Live dashboard | `src/pages/opsCenter/{OpsCenter,panels,charts,topProducts,primitives}.jsx`, `insights.js`, `ops.css` |
| Dashboard API | `backend/controllers/dashboardController.js` (`GET /api/dashboard` via `backend/routes/dataRoutes.js:22`) |
| Backend entry / route order | `backend/server.js` |
| Auth & RBAC | `backend/middleware/auth.js`, `backend/controllers/authController.js`, `backend/services/tokenBlacklistService.js` |
| DB pools | `backend/database/db.js`, `backend/config/env.js` |
| Migrations | `backend/migrations/*`, runner `backend/scripts/runMigrations.js` |
| PEMS | `backend/controllers/pems/*`, `backend/services/pems/*`, `src/modules/pems/*` |
| Realtime | `src/contexts/SocketContext.jsx`, `src/services/realtimeService.ts` |
| CI/CD | `.github/workflows/{ci,cd,staging,security}.yml` |
| Prompts drift | `.windsurfrules`, `.obolus/rules/*` |
