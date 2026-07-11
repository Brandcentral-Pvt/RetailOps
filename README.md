<div align="center">

# RetailOps

### Enterprise E-Commerce Intelligence Platform

[![Version](https://img.shields.io/badge/Version-2.5.0-blue?style=flat-square)](https://github.com/Brandcentral-Pvt/RetailOps)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](#license)
[![Production](https://img.shields.io/badge/Production-Live-brightgreen?style=flat-square)](https://data.brandcentral.in)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![SQL Server](https://img.shields.io/badge/Microsoft_SQL_Server-2022-CC2927?style=flat-square&logo=microsoft&logoColor=white)](https://www.microsoft.com/en-us/sql-server)

---

RetailOps is a full-stack e-commerce operations platform built for high-volume Amazon marketplace management. It provides real-time ASIN tracking, advertising analytics, automated data ingestion, AI-driven strategy generation, and team collaboration — all in a single dashboard.

**[Production](https://data.brandcentral.in)** · **[Documentation](#documentation)** · **[Getting Started](#getting-started)** · **[Architecture](#architecture)**

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Authentication & Security](#authentication--security)
- [Database Schema](#database-schema)
- [CI/CD Pipeline](#cicd-pipeline)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

RetailOps centralizes every aspect of Amazon marketplace operations into a unified platform:

- **Track** 100K+ ASINs across multiple seller accounts with real-time price, BSR, and rating monitoring
- **Analyze** advertising spend, ROAS, ACoS, and campaign performance with attribution engine
- **Automate** marketplace data scraping through Octoparse cloud integration with self-healing loops
- **Strategize** with AI-powered OKR decomposition that breaks business goals into executable weekly plans
- **Collaborate** through built-in real-time chat, task management (PEMS), and role-based team hierarchy

Built by **BrandCentral** for managing complex, multi-seller Amazon operations at scale.

---

## Key Features

### ASIN Intelligence
- Central ASIN manager with 110+ tracked data points per product
- Real-time Buy Box monitoring and price history visualization
- Historical trend analysis with configurable time ranges (daily, weekly, monthly)
- Listing Quality Score (LQS) tracking with automated threshold alerts
- Bulk import/export via CSV and Excel

### Advertising Analytics
- Campaign-level performance tracking (spend, sales, impressions, clicks, orders)
- Automated ROAS, ACoS, CTR, AOV calculation
- Multi-seller ad data aggregation with case-insensitive header mapping
- Visual campaign performance dashboards

### Automated Data Pipeline
- Octoparse OpenAPI v1.0 integration for cloud-based marketplace scraping
- Scheduled cron jobs for nightly data extraction
- Live data sync via Amazon Creators API with credential rotation
- Self-healing scrape loops with anomaly detection
- Proxy support (SOCKS5/HTTPS) for reliable data extraction

### AI-Powered Strategy
- **OKR Engine**: LLM-driven decomposition of business goals into 4-week execution plans
- **Image Optimization**: NVIDIA NIM integration for automated product lifestyle image generation
- Perplexity AI integration for market intelligence

### Task Management (PEMS)
- Performance Execution Management System with template-based task creation
- SLA tracking, TAT monitoring, and frequency-based scheduling
- Review workflows with approval chains
- Task analytics and completion metrics

### Team & Communication
- Real-time team chat powered by CometChat with Socket.IO
- Voice and video calling capabilities
- Role-based access control (RBAC) with granular permissions
- User hierarchy with supervisor relationships
- Seller-level access control (users only see assigned sellers)

### Alert & Rule Engine
- Configurable alert rules with condition builders
- Rule set management with nested logic
- Webhook integration for external notifications
- System-wide audit logging

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 19 with JSX + TypeScript |
| Build Tool | Vite 8 |
| Routing | React Router DOM v7 |
| State Management | Zustand 5, TanStack React Query v5, React Context (9 providers) |
| UI Libraries | Ant Design 6, MUI v9, Bootstrap 5, RSuite 6 |
| Styling | Tailwind CSS v4, SASS |
| Charts | ApexCharts, Recharts, Chart.js, MUI X-Charts |
| Real-time | Socket.IO Client |
| Chat | CometChat UIKit React + Calls SDK |
| Animation | Framer Motion |
| Icons | Lucide React, Tabler Icons, React Icons, MUI Icons |

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Database | Microsoft SQL Server (mssql, connection pooling) |
| Caching / Pub-Sub | Redis (ioredis, Socket.IO adapter) |
| Authentication | Custom JWT (access + refresh tokens) with OTP verification |
| Process Manager | PM2 (cluster mode) |
| Validation | Joi |
| Security | Helmet, bcryptjs, express-rate-limit, CORS, token blacklisting |
| AI | OpenAI, Perplexity, NVIDIA NIM |
| Scraping | Octoparse OpenAPI, Puppeteer (stealth plugin) |
| Email | Nodemailer (SMTP) |
| Excel | ExcelJS, SheetJS |
| Scheduling | node-cron, custom scheduler service |

### Infrastructure

| Layer | Technology |
|---|---|
| CI/CD | GitHub Actions |
| Deployment | SSH + PM2 (staging/production) |
| CDN | Vercel (frontend analytics) |
| Version Control | Git (GitFlow branching strategy) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│  React 19 + Vite + Ant Design + Tailwind + ApexCharts      │
│  47 pages │ 44+ components │ 14 hooks │ 9 context providers │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────┴──────────────────────────────────────┐
│                       Backend                               │
│  Express 5 + Node.js 20 │ 38 routes │ 49 services          │
│  JWT Auth + OTP + RBAC │ Rate Limiting │ Audit Logging      │
└────┬─────────────┬─────────────┬───────────────────────────┘
     │             │             │
┌────┴────┐  ┌─────┴─────┐  ┌───┴────────────┐
│ SQL     │  │  Redis    │  │  External APIs  │
│ Server  │  │  Cache +  │  │  Octoparse      │
│ (MSSQL) │  │  Pub/Sub  │  │  OpenAI         │
│         │  │  Sessions │  │  NVIDIA NIM     │
└─────────┘  └───────────┘  │  Amazon APIs    │
                             └─────────────────┘
```

### Data Flow

1. **Ingestion**: Octoparse scrapes Amazon listings on schedule → Backend parses and stores in SQL Server
2. **Real-time Sync**: Live data inspector pulls from Amazon Creators API with credential rotation
3. **Processing**: Services calculate LQS, fee previews, ROAS, and other derived metrics
4. **Presentation**: React frontend renders dashboards, reports, and alerts via REST + WebSocket
5. **Automation**: Rule engine evaluates conditions and triggers alerts/webhooks
6. **Strategy**: AI layer decomposes goals into actionable tasks via PEMS

---

## Project Structure

```
retail-ops/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Redis, auth configuration
│   │   ├── controllers/     # 47 route handlers
│   │   ├── database/        # SQL Server connection pool
│   │   ├── middleware/       # Auth, RBAC, rate limiting, logging
│   │   ├── migrations/      # PEMS schema migrations
│   │   ├── routes/          # 38 API route modules
│   │   ├── services/        # 49 business logic services
│   │   ├── templates/       # Email templates (auth, admin, PEMS, sellers)
│   │   └── utils/           # Helpers, validators, formatters
│   ├── scripts/             # Database migration & utility scripts
│   └── server.js            # Entry point
├── src/                     # React frontend
│   ├── components/          # 44+ reusable components
│   │   ├── application/     # Layout, loading, auth guards
│   │   ├── dashboard/       # Dashboard widgets
│   │   ├── asin/            # ASIN management components
│   │   ├── chat/            # CometChat integration
│   │   └── ui/              # Design system primitives
│   ├── contexts/            # 9 React context providers
│   ├── hooks/               # 14 custom hooks
│   ├── pages/               # 47 page components
│   │   ├── modules/pems/    # PEMS task management module
│   │   └── *.jsx            # Individual page components
│   ├── services/            # API client modules
│   ├── theme/               # Ant Design theme configuration
│   └── utils/               # Helpers, formatters, constants
├── .github/
│   ├── workflows/           # CI/CD pipeline definitions
│   ├── ISSUE_TEMPLATE/      # Bug report & feature request templates
│   └── PULL_REQUEST_TEMPLATE/
├── mobile/                  # React Native mobile app (Expo)
├── CONTRIBUTING.md          # Development guidelines
├── CHANGELOG.md             # Version history
└── package.json             # Frontend dependencies
```

---

## Getting Started

### Prerequisites

- **Node.js** 20 or later
- **npm** 9 or later
- **Microsoft SQL Server** 2019+ (or Azure SQL)
- **Redis** 6+ (for caching and Socket.IO pub/sub)
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/Brandcentral-Pvt/RetailOps.git
cd RetailOps

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Configuration

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env

# Edit the environment files with your configuration
# See Environment Variables section below
```

### Run Development Servers

```bash
# Start backend (port 3001)
cd backend
npm run dev

# In a separate terminal, start frontend (port 5173)
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port | Yes |
| `DATABASE_URL` | SQL Server connection string | Yes |
| `REDIS_URL` | Redis connection URL | Yes |
| `JWT_SECRET` | Secret for JWT token signing | Yes |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing | Yes |
| `SMTP_HOST` | Email SMTP host | Yes |
| `SMTP_PORT` | Email SMTP port | Yes |
| `SMTP_USER` | Email SMTP username | Yes |
| `SMTP_PASS` | Email SMTP password | Yes |
| `OCTOPARSE_API_KEY` | Octoparse API key for scraping | Optional |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Optional |
| `PERPLEXITY_API_KEY` | Perplexity API key for OKR engine | Optional |
| `NIM_API_KEY` | NVIDIA NIM API key for image generation | Optional |

### Frontend (`.env`)

| Variable | Description | Required |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | Yes |
| `VITE_WS_URL` | WebSocket server URL | Yes |

---

## Development

### Branching Strategy

We follow **GitFlow**:

| Branch | Purpose | Deploys To |
|---|---|---|
| `main` | Production-ready code | Production |
| `develop` | Integration branch | Staging |
| `feature/*` | New features | — |
| `fix/*` | Bug fixes | — |
| `hotfix/*` | Emergency fixes | — |
| `release/*` | Release preparation | — |

### Making Changes

```bash
# Create a feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature

# Make changes, then commit with conventional format
git commit -m "feat(asin): add bulk export functionality"

# Push and create a pull request
git push -u origin feature/your-feature
```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

feat:      New feature
fix:       Bug fix
docs:      Documentation changes
style:     Code style changes (formatting, no logic change)
refactor:  Code refactoring
test:      Adding or updating tests
chore:     Maintenance tasks
perf:      Performance improvements
ci:        CI/CD changes
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend dev server |
| `npm run build` | Build frontend for production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `cd backend && npm run dev` | Start backend with nodemon |
| `cd backend && npm start` | Start backend in production mode |

---

## Deployment

### Staging

Merges to `develop` automatically deploy to staging:

1. GitHub Actions runs lint, typecheck, and build
2. Frontend build is deployed via `rsync`
3. Backend is pulled, dependencies installed, PM2 restarted

### Production

Version tags (`v*`) trigger production deployment:

```bash
# Create a release
git checkout main
git tag v2.5.0
git push origin v2.5.0
```

This triggers:
1. Full CI pipeline (lint, test, build)
2. Deployment to production server
3. Automatic GitHub Release creation with changelog

### Production URL

**https://data.brandcentral.in**

---

## API Reference

All API endpoints are prefixed with `/api/`.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Email + password login |
| POST | `/api/auth/verify-otp` | Verify OTP code |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate session |
| POST | `/api/auth/change-password` | Change password |

### ASIN Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/asins` | List ASINs with pagination and filters |
| GET | `/api/asins/:id` | Get ASIN details |
| POST | `/api/asins/sync` | Trigger Octoparse sync |
| POST | `/api/upload/bulk-import` | Bulk ASIN import via CSV |

### Ads & Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ads` | List advertising performance data |
| POST | `/api/upload/ads-data` | Upload ads CSV data |
| GET | `/api/dashboard` | Aggregated dashboard metrics |

### Task Management (PEMS)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pems/tasks` | List task instances |
| POST | `/api/pems/tasks` | Create task instance |
| PUT | `/api/pems/tasks/:id` | Update task status |
| GET | `/api/pems/analytics` | Task completion analytics |

### Administration

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List users |
| GET | `/api/roles` | List roles and permissions |
| GET | `/api/sellers` | List seller accounts |
| GET | `/api/activity-logs` | Audit trail |

> Full API documentation available at `/api/docs` in development mode.

---

## Authentication & Security

### Authentication Flow

1. User submits email + password
2. Backend validates credentials via bcrypt comparison
3. If valid, a 6-digit OTP is sent via email
4. User verifies OTP (or trusted device bypasses this step)
5. Dual JWT tokens are issued:
   - **Access Token**: 2-hour expiry
   - **Refresh Token**: 7-day expiry

### Security Features

- **Password Policy**: Minimum 12 characters, zxcvbn strength validation (score ≥ 3), 90-day expiry, last 5 passwords remembered
- **Account Lockout**: 5 failed attempts triggers 15-minute lock
- **Rate Limiting**: Progressive IP-based and per-account rate limiting via Redis
- **Token Blacklisting**: Tokens invalidated on logout and password change
- **RBAC**: Granular permission system with per-user overrides
- **Trusted Devices**: Device fingerprinting to skip OTP on recognized devices
- **Audit Logging**: All user actions tracked with IP and timestamp

---

## Database Schema

**Primary**: Microsoft SQL Server (`retailops` database)

### Core Tables

| Table | Purpose |
|---|---|
| `Users` | User accounts with auth fields, roles, permissions |
| `Roles` | Role definitions with hierarchy levels |
| `Permissions` | Granular permission entries |
| `RolePermissions` | Role-to-permission mapping |
| `Sellers` | Marketplace seller accounts |
| `UserSellers` | User-to-seller access assignments |
| `PemsTaskTemplates` | Reusable task templates with SLA/TAT |
| `PemsTaskInstances` | Individual task instances |
| `PemsTaskReviews` | Review workflow entries |
| `CallLogs` | Voice/video call history |
| `Messages` | Chat message persistence |
| `OtpVerifications` | OTP storage with bcrypt hashing |
| `PasswordHistory` | Password reuse prevention |

### Performance

- Compound indexes on `asinCode + seller` for sub-100ms queries
- Connection pooling (5–50 connections) via `mssql` package
- Redis caching for frequently accessed data

---

## CI/CD Pipeline

### Workflows

| Workflow | Trigger | Actions |
|---|---|---|
| **CI** | Push/PR to `main` or `develop` | ESLint, TypeScript check, tests, build, artifact upload |
| **Deploy Staging** | Push to `develop` | Build, rsync to staging server, PM2 restart |
| **Deploy Production** | Push tag `v*` | Build, rsync to production, PM2 restart, GitHub Release |
| **Release** | Push to `main` | Semantic versioning, changelog generation, GitHub Release |

### Quality Gates

All pull requests must pass:
- [ ] ESLint (zero warnings)
- [ ] TypeScript type checking
- [ ] Frontend build
- [ ] Backend startup verification
- [ ] At least 1 code review approval

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Setting up the development environment
- Branching and naming conventions
- Commit message format
- Pull request process
- Code style requirements

---

## License

Proprietary and Confidential.

Copyright © 2026 BrandCentral (Easysell Projects). All Rights Reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.
