# RetailOps

RetailOps is Brand Central's internal marketplace operations platform for Amazon and Ajio. It combines ASIN and catalog intelligence, advertising analytics, GMS and commercial reporting, marketplace data synchronisation, a rules-and-automation engine, and the PEMS task system (including the OOS reconciliation workspace) in one application.

The product is a single-page React application served by an Express 5 API on SQL Server, with Redis for caching, queues, and shared rate limiting, and Socket.IO for real-time updates. It is deployed on a Linux VPS behind Nginx and run as a PM2 cluster.

---

## Table of contents

- [Feature overview](#feature-overview)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [API overview](#api-overview)
- [Data synchronisation and integrations](#data-synchronisation-and-integrations)
- [Tasks, PEMS, and OOS reconciliation](#tasks-pems-and-oos-reconciliation)
- [Access control](#access-control)
- [Testing and quality](#testing-and-quality)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Feature overview

### Operations and reporting

- **Ops Center dashboard** - consolidated operations view with KPI cards, marketplace aggregates, and real-time refresh over authenticated Socket.IO.
- **GMS Tracker** - gross merchandise sales ingestion (CSV upload or API sync), ordered-unit metrics, and period-over-period tracking.
- **Commercial reports** - SKU report, Parent ASIN report, month-wise report, profit and loss, inventory, and target-vs-achievement dashboards.
- **Ads intelligence** - multi-marketplace advertising analytics with ASIN and parent views, historical and weekly granularity, campaign targets, and scheduled Excel exports.
- **Exports** - queued, background Excel generation with progress tracking over WebSockets, plus manifest and status polling endpoints.

### Catalog and ASIN intelligence

- **ASIN Manager** - server-side paginated ASIN grid with marketplace switching, tag management, trend indicators, BSR and sub-BSR history, buy-box tracking, and parent-level drill-down.
- **Seller views** - seller configuration, seller-scoped ASIN tracking, and per-seller sync status.
- **Listing quality (LQS)** - rule-based plus AI-assisted content scoring for titles, bullets, and images, with review and rating trend history.
- **Keyword research** - Creators API backed keyword and catalog analysis, gated behind RBAC permissions.
- **Bulk operations** - ASIN, seller, user, and user-seller import pipelines with validation and normalisation.

### Data acquisition

- **Live Sync** - Amazon Creators API ingestion for price, availability, rating, reviews, BSR, and offers, driven by a global account-wide rate gate.
- **Live Data Inspector** - on-demand, versioned inspection jobs with queueing, ETA reporting, partial results, and caching.
- **Playwright scraper stack** - adaptive concurrency, circuit breakers, memory safeguards, and per-seller caps for fields the API does not expose (A+ content, review breakdowns, Ajio pages).
- **Scheduled runs** - cron-driven sync and scrape jobs with Redis-gated triggers so only one PM2 worker executes each sweep.

### Automation

- **Rule sets** - visual ruleset builder with a SQL-pushdown rule engine, scheduling, and task generation actions.
- **Alert rules and activity log** - configurable alerting with audit trail and IP tracking.
- **Webhooks** - outbound webhook management with CRUD operations and delivery history.
- **Notifications** - in-app notifications, push notifications, and a chat/messaging surface for the mobile client.

### Tasks and workflow (PEMS)

- **Task templates and instances** - template builder, versioned view definitions, task generation, and per-seller sub-tasks.
- **My Day** - prioritised daily planner for every employee.
- **Task Workspace** - review queue, evidence capture, comments, verification, and fix workflows.
- **Task performance dashboard** - throughput, SLA, and quality analytics.
- **OOS reconciliation (OOS-RECON-001)** - four-phase out-of-stock workflow: source upload, reconciliation against live data, independent review, and submission/export.

### Platform

- **Authentication** - email/password with JWT access and refresh tokens in httpOnly cookies, OTP verification, mobile OTP flow, password reset, and setup wizard.
- **RBAC** - permission-based route guards on the frontend and matching middleware on the backend, with users, roles, and team management.
- **Maintenance mode** - env-gated Under Maintenance screen plus API `503` responses.
- **Observability** - `/api/health`, `/api/health/liveness`, and `/api/health/readiness`, structured request logging, and a system activity log.

---

## Architecture

```text
Browser (React 19 SPA)
   |  HTTPS  +  WSS
   v
Nginx  ---- serves dist/  ----  reverse proxy /api, /socket.io
   |
   v
PM2 cluster (4 x Express 5 API, port 3001)
   |            |                 |
   v            v                 v
SQL Server   Redis           Socket.IO
(primary)    cache/queues    (redis adapter)
             Bull / rate gate
   |
   +--> Amazon Creators API        (live sync, inspector, keywords)
   +--> Playwright / Puppeteer     (scrapers)
   +--> SMTP                       (transactional email)
   +--> OpenAI / NVIDIA NIM        (AI chat, listing analysis)
```

The frontend is a static bundle; all business logic lives in the API. Long-running work (exports, syncs, scrapes, AI analyses) is queued and reported back through Socket.IO events or polling endpoints.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Ant Design 6, Tailwind CSS 4, TanStack Query 5, Recharts, ApexCharts, MUI X, Socket.IO client |
| Backend | Node.js 20+, Express 5, Joi validation, JWT + httpOnly cookies, bcrypt, Helmet, express-rate-limit, Winston |
| Data | SQL Server (mssql driver, 36 migrations), Redis (ioredis, Bull queues, distributed locks, rate gate) |
| Realtime | Socket.IO with Redis adapter and PM2 sticky sessions |
| Integrations | Amazon Creators API, Playwright, Puppeteer (stealth), ExcelJS, Nodemailer, OpenAI, NVIDIA NIM |
| Quality | ESLint 10, TypeScript typecheck, Jest 30 + Supertest (backend), node:test and Playwright (frontend) |
| Delivery | GitHub Actions (CI, CD, staging, security, design system), Docker, PM2, Nginx |

---

## Repository layout

```text
retail-ops/
|-- src/                     React application
|   |-- pages/               Route-level screens (ASIN, Ads, GMS, Sellers, Admin, Reports)
|   |-- modules/tasks/       PEMS task module: pages, views, registry, services, My Day
|   |-- components/          Shared UI, layout, charts, dashboards
|   |-- context(s)/          Auth, theme, socket, and permission providers
|   |-- hooks/  services/    Data hooks and API clients
|   |-- styles/  theme/      Design tokens and global styles
|   `-- App.jsx              Route table with permission guards
|-- backend/                 Express API
|   |-- routes/              Feature routers (45 modules) mounted under /api
|   |-- controllers/         Request handlers and validation
|   |-- services/            Domain logic: sync, scraping, rules, PEMS, OOS, AI, exports
|   |-- database/            SQL Server pool and query helpers
|   |-- migrations/          Idempotent, ordered schema migrations (36 files, numbered 001-034)
|   |-- middleware/          Auth, RBAC, rate limits, logging, maintenance mode
|   |-- sockets/  jobs/      Socket handlers and scheduled jobs
|   `-- server.js            App bootstrap, mounts, and health endpoints
|-- docs/                    Engineering, API, module, and design documentation
|-- tests/                   Frontend and end-to-end specs
|-- scripts/                 Repo tooling (design tokens, git flow)
|-- .github/workflows/       CI/CD pipelines
|-- nginx.conf               Production reverse-proxy configuration
|-- Dockerfile.backend       Multi-stage backend image
`-- init-database.sql        Bootstrap schema for a fresh database
```

---

## Getting started

### Prerequisites

| Requirement | Version |
| --- | --- |
| Node.js | 20 LTS or newer (CI targets 20) |
| npm | 10+ |
| SQL Server | 2019+ (or Azure SQL) |
| Redis | 6+ |
| Git | 2.30+ |

`redis-server` must be reachable for queues, the account-wide Creators rate gate, and Socket.IO scaling. Without it, rate limiting degrades to per-process and is unsafe in a cluster.

### 1. Clone

```bash
git clone https://github.com/Brandcentral-Pvt/RetailOps.git
cd RetailOps
```

### 2. Frontend environment

```bash
cp .env.example .env
```

Set at minimum:

```dotenv
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### 3. Backend environment

```bash
cp backend/.env.example backend/.env
```

Required keys (the server exits if any is missing): `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `JWT_SECRET`.

> **Note:** the backend reads `DB_SERVER`, while the root `.env.example` labels the same setting `DB_HOST`. Use `backend/.env.example` as the source of truth for backend keys.

### 4. Install dependencies

```bash
npm install
npm --prefix backend install
```

### 5. Create and migrate the database

```bash
# Fresh database (optional): create the schema from scratch
sqlcmd -S <server> -U <user> -P <password> -d <database> -i init-database.sql

# Apply pending migrations (required on every environment)
npm --prefix backend run migrate
```

Migrations are ordered, idempotent, and tracked in a registry table, so re-running is safe.

### 6. Run in development

```bash
# Terminal 1 - API (nodemon, port 3001)
npm --prefix backend run dev

# Terminal 2 - Vite dev server (port 5173, proxies /api and /socket.io to 3001)
npm run dev
```

Open <http://localhost:5173>. Verify the API with <http://localhost:3001/api/health>.

There is no synthetic demo dataset. Seed data is created through the setup wizard, the `/api/seed` routes, and the import scripts under `backend/scripts/` once real credentials are configured.

---

## Configuration

Configuration lives in two files: `.env` at the repository root (frontend, baked at build time) and `backend/.env` (server, read at boot). Never commit either file.

### Frontend (`.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL including `/api` |
| `VITE_SOCKET_URL` | Socket.IO origin |
| `VITE_MAINTENANCE_MODE` | Show only the Under Maintenance screen |
| `VITE_MAINTENANCE_TITLE`, `_MESSAGE`, `_ETA`, `_EMAIL`, `_LOGO` | Maintenance screen copy and branding |

### Backend (`backend/.env`)

| Group | Variables |
| --- | --- |
| Server | `NODE_ENV`, `PORT`, `MAINTENANCE_MODE`, `FRONTEND_URL`, `DASHBOARD_URL`, `APP_URL` |
| Database | `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERT`, `DB_POOL_MAX`, `DB_POOL_MIN`, reader replica via `DB_READER_*` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET` |
| Redis | `REDIS_URL` |
| Creators API | `LIVE_SYNC_CLIENT_ID`, `LIVE_SYNC_CLIENT_SECRET`, `LIVE_SYNC_PARTNER_TAG`, `LIVE_SYNC_MARKETPLACE`, `LIVE_SYNC_ENABLED`, `LIVE_SYNC_SCHEDULE_TIME`, `CREATORS_API_CLIENT_ID_2/_3` and matching secrets |
| Creators rate gate | `CREATORS_RATE_INTERVAL_MS`, `CREATORS_RATE_TPS`, `CREATORS_RATE_TPD`, `CREATORS_RATE_TPD_BUFFER`, `CREATORS_RATE_MAX_WAIT_MS`, `CREATORS_RATE_SHARE_ACCOUNT`, `CREATORS_RATE_REQUIRE_REDIS` |
| Live Data Inspector | `LIVE_DATA_V1_ENABLED`, `LIVE_SYNC_BATCH_SIZE`, `LIVE_SYNC_BATCH_DELAY_MS`, `LIVE_SYNC_MAX_CONCURRENT_JOBS`, `LIVE_SYNC_MAX_FETCH_ASINS`, `LIVE_SYNC_MAX_UPLOAD_ASINS`, `LIVE_SYNC_AI_*` |
| Scraper | `SCRAPER_BASE_CONCURRENT_PAGES`, `SCRAPER_MIN_CONCURRENT_PAGES`, `SCRAPER_MAX_CONCURRENT_PAGES`, `SCRAPER_MAX_ASIN_FAILURES`, `SCRAPER_MAX_CONSECUTIVE_FAILURES`, `SCRAPER_BACKOFF_*` |
| Automation | `AUTOMATION_ENABLED`, `AUTOMATION_SCHEDULE_TIME`, `AUTOMATION_AMAZON_ENABLED`, `AUTOMATION_AJIO_ENABLED` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| AI | `OPENAI_API_KEY`, `NIM_API_KEY`, `NVIDIA_NIM_API_KEY` |
| Legacy integrations | `MARKET_SYNC_*`, `OCTOPARSE_API_KEY` (only used by deprecated paths) |

Every variable is documented inline in `backend/.env.example`, including the rate-gate reasoning. Read that file before tuning throughput.

---

## Scripts

### Frontend (repository root)

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:auth` | Playwright authentication suite |
| `npm run test:planner` | Unit tests for the My Day planner |

### Backend (`backend/`)

| Script | Description |
| --- | --- |
| `npm run dev` | Nodemon API server |
| `npm start` | Production server (4 GB heap) |
| `npm run start-cluster` | PM2 cluster via `ecosystem.config.js` |
| `npm run migrate` | Apply pending SQL migrations |
| `npm test` | Jest suite |
| `npm run test:coverage` | Jest with coverage |
| `npm run force-sync` | Trigger a full sync pass |

---

## API overview

All endpoints are served under `/api`. Authentication uses httpOnly cookies; protected routes require a valid access token and a permission grant. Requests are rate limited per route class (`AUTH`, `BULK`, `strict`, `global`) and logged with actor and IP attribution.

Full endpoint reference: [docs/api-endpoints.md](docs/api-endpoints.md).

| Mount | Domain |
| --- | --- |
| `/api/auth` | Login, OTP, refresh, logout, password reset |
| `/api/asins`, `/api/asins-table` | ASIN grid, detail, tags, trend, history |
| `/api/ads` | Advertising analytics, targets, exports |
| `/api/sellers`, `/api/seller-tracker` | Seller management and ASIN tracking |
| `/api/tasks`, `/api/pems`, `/api/oos` | Task templates, instances, workspaces, OOS reconciliation |
| `/api/live-data`, `/api/market-sync`, `/api/live-sync-tracker` | Live sync and inspector jobs |
| `/api/scraper`, `/api/scheduled-runs` | Scraper control and cron schedules |
| `/api/rulesets` (via `/api`), `/api/webhooks`, `/api/alerts` | Automation, alerting, and outbound hooks |
| `/api/keywords`, `/api/keyword-analysis` | Keyword research |
| `/api/export`, `/api/files`, `/api/bulk` | Exports, file manager, bulk uploads |
| `/api/users`, `/api/roles`, `/api/teams`, `/api/keys` | Identity and access administration |
| `/api/ai`, `/api/ai/chat` | AI assistant and listing analysis |
| `/api/logs`, `/api/security`, `/api/settings` | Observability and configuration |
| `/api/health`, `/api/health/liveness`, `/api/health/readiness` | Probes (unauthenticated) |

Socket.IO is mounted on the same origin and carries sync progress, export progress, task updates, and notification events.

---

## Data synchronisation and integrations

### Amazon Creators API

Every Creators API caller - live sync, the Live Data Inspector, and keyword research - passes through `creatorsApiRateGate`. Pacing and the daily budget are per Amazon account, and the gate is shared across all PM2 workers through Redis, so the account never exceeds one request per interval or the daily quota. Callers wait for a slot, or fail fast with `CREATORS_THROTTLED` when the wait exceeds `CREATORS_RATE_MAX_WAIT_MS`.

If multiple credentials belong to the same Amazon Associate account, leave `CREATORS_RATE_SHARE_ACCOUNT=true`; otherwise they only consume the same budget. Set it to `false` only when each credential is a genuinely separate account.

### Scrapers

The Playwright stack replaces the legacy Octoparse flow. It applies adaptive concurrency, per-ASIN and consecutive-failure circuit breakers, a global page cap, memory guards, and no-overwrite protection so an empty scrape can never erase good data. Scheduled scrapes run through the scrape-job history runner with per-seller caps.

### Sync scheduling

Cron jobs are registered at boot. Triggers are Redis-gated so only one instance in the cluster executes each sweep. Scheduler state can be overridden in the database and is surfaced on the Scheduled Runs screen.

---

## Tasks, PEMS, and OOS reconciliation

The task system is the operational core:

1. **Templates** define the task shape, ruleset bindings, evidence requirements, and a view definition.
2. **Instances** are generated manually, on a schedule, or by the rule engine, and can fan out into per-seller sub-tasks.
3. **Views** are resolved from a versioned registry (`STANDARD_V1`, `OOS_RECON_V1`) with a snapshot stored on the instance, so publishing a new view never rewrites in-flight work.
4. **Workspace** handles assignment, comments, evidence, independent review, and verification.

The OOS reconciliation template (`OOS-RECON-001`) implements out-of-stock recovery end to end: upload Brand Central / Vendor Central files, reconcile against live catalog data, triage affected ASINs and incidents, run an independent review, then export or submit. Backend support lives in `backend/services/oos/`, with migrations `032`-`034`.

Task-domain documentation: [docs/pems-tasks-module.md](docs/pems-tasks-module.md) and [docs/engineering/IMPLEMENTATION_NOTES.md](docs/engineering/IMPLEMENTATION_NOTES.md).

---

## Access control

Authentication issues a short-lived access token and a refresh token as httpOnly cookies. OTP verification is required for sensitive flows, and password resets are emailed with single-use links.

Authorisation is permission-based, not role-based at the route level:

- The frontend guards every route with `ProtectedRoute permission="..."` in `src/App.jsx`.
- The backend enforces the same permission keys through middleware, plus seller-scope resolution so a user only sees data for the sellers they own or supervise.
- Roles aggregate permissions; teams model supervisor assignments.

When adding a screen, add the permission to the role seed, the route guard, and the API middleware together - a frontend-only guard is not access control.

---

## Testing and quality

```bash
# Frontend
npm run lint
npm run typecheck
npm run test:planner
npm run test:auth

# Backend
npm --prefix backend test
npm --prefix backend run test:coverage
```

CI runs lint, typecheck, unit tests, a production build, a backend syntax and import check, `npm audit` for high/critical findings, and a Docker image build with a `/api/health` smoke test. Keep `npm run lint` at zero warnings; it is enforced with `--max-warnings=0`.

Backend tests use Jest with `--experimental-vm-modules` and cover OOS policy, reconciliation, templates, and task-view resolution.

---

## Deployment

Production runs on a Linux VPS from `/var/www/retail-ops`:

| Path | Purpose |
| --- | --- |
| `/var/www/retail-ops/dist` | Built frontend served by Nginx |
| `/var/www/retail-ops/backend` | API process working directory |
| `/var/www/retail-ops/logs` | PM2 and application logs |

```bash
# Build and deploy
npm ci && npm run build
npm --prefix backend ci
npm --prefix backend run migrate

# Restart the cluster (4 instances, cluster mode)
cd backend && pm2 start ecosystem.config.js && pm2 save
```

Nginx terminates TLS, serves `dist/`, proxies `/api` and `/socket.io`, and must forward WebSocket upgrades. Configuration: `nginx.conf`. Container alternative: `Dockerfile.backend` (multi-stage, production target).

Operational notes:

- Health probes: `/api/health` (detailed), `/api/health/liveness` (process), `/api/health/readiness` (database check).
- Do not run more than one scheduler instance without the Redis gate - it is enabled by default.
- Migrations must be applied before restarting the API; the runner is lock-protected.
- Set `CREATORS_RATE_REQUIRE_REDIS=true` in production so a Redis outage fails closed instead of multiplying real request throughput by the worker count.

Pipelines: `.github/workflows/ci.yml` (pull requests), `cd.yml` (release), `staging.yml`, `security.yml`, and `design-system.yml`.

---

## Documentation

| Document | Contents |
| --- | --- |
| [docs/api-endpoints.md](docs/api-endpoints.md) | Endpoint reference by mount, plus Socket.IO events |
| [docs/project-analysis.md](docs/project-analysis.md) | System analysis and module inventory |
| [docs/pems-tasks-module.md](docs/pems-tasks-module.md) | Task module design |
| [docs/pems-backend-plan.md](docs/pems-backend-plan.md), [docs/pems-backend-report.md](docs/pems-backend-report.md) | Backend delivery plan and report |
| [docs/engineering/IMPLEMENTATION_NOTES.md](docs/engineering/IMPLEMENTATION_NOTES.md) | OOS task-view audit and decisions |
| [docs/engineering/IMPLEMENTATION_SUMMARY.md](docs/engineering/IMPLEMENTATION_SUMMARY.md) | OOS implementation status |
| [docs/ads-module-deep-dive.md](docs/ads-module-deep-dive.md), [docs/ads-module-upgrade.md](docs/ads-module-upgrade.md) | Advertising module design |
| [docs/keyword-research-upgrade.md](docs/keyword-research-upgrade.md) | Keyword research architecture |
| [docs/octoparse-aplus-rating-audit.md](docs/octoparse-aplus-rating-audit.md) | A+ content and rating audit (legacy flow) |
| [docs/design/](docs/design/) | Ruleset design tokens, accessibility, and mobile design system |

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. In short:

1. Branch from `develop` using `feat/`, `fix/`, `refactor/`, `docs/`, or `chore/` prefixes.
2. Keep commits conventional (`feat(scope): summary`, `fix(scope): summary`).
3. Run `npm run lint`, `npm run typecheck`, and the relevant test suites before pushing.
4. Open the pull request against `develop`, not `main`. `main` is the production branch and only receives merged releases.

Never commit `.env` files, credentials, uploads, or generated logs. If you need to sync with a shared branch, use `git pull --ff-only`; rebasing `main` rewrites published history and forces everyone else to reset.

---

## License

Internal, proprietary software of Brand Central Pvt Ltd. Not licensed for redistribution or external use. All rights reserved.
