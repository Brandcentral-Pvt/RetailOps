# RetailOps V2.1 - Documentation Index

**Version:** 2.1.0  
**Date:** September 3, 2026  
**Status:** Complete - Ready for ASP.NET Core Migration

---

## Documentation Suite

| Document | Purpose | Audience | Status |
|----------|---------|----------|--------|
| [BUSINESS_REQUIREMENTS.md](./BUSINESS_REQUIREMENTS.md) | Business capabilities, user roles, success metrics | Product, Stakeholders | Complete |
| [TECHNICAL_SPEC_ASPNET.md](./TECHNICAL_SPEC_ASPNET.md) | ASP.NET Core architecture, domain models, API contracts | Engineering | Complete |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Complete SQL schema with indexes, partitioning, procedures | DBA, Backend | Complete |
| [API_SPECIFICATION.md](./API_SPECIFICATION.md) | OpenAPI 3.0 contracts for all endpoints | Frontend, QA, Partners | Complete |
| [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) | 22-week phased migration plan with risk mitigation | Tech Lead, Management | Complete |
| [RETAILOPS_V2.1_ARCHITECTURE_REPORT.md](../RETAILOPS_V2.1_ARCHITECTURE_REPORT.md) | Knowledge graph analysis of current codebase | Architecture Team | Complete |

---

## Architecture Summary

### Current Stack (Node.js)
- **Frontend:** Next.js 16 + React 19 + Tailwind v4
- **Backend:** Express 5 + Socket.IO + Bull (Redis) + SQL Server
- **Auth:** JWT + In-Memory Blacklist
- **Jobs:** node-cron
- **Real-time:** Socket.IO (in-memory)

### Target Stack (ASP.NET Core)
- **Frontend:** Next.js 16 (unchanged)
- **Backend:** ASP.NET Core 8 + SignalR + Hangfire + EF Core 8
- **Auth:** JWT + Redis Blacklist + Identity
- **Jobs:** Hangfire (Redis/SQL)
- **Real-time:** SignalR (Redis backplane)
- **Architecture:** Clean Architecture + Vertical Slice + CQRS

---

## Knowledge Graph Insights

From graphify analysis of 854 code files:

| Metric | Value |
|--------|-------|
| Total Nodes | 7,544 |
| Total Edges | 13,107 |
| Communities | 440 |
| God Nodes | getPool() (570), RetailOpsDbContext (164), Asins (125) |

**Key Hubs:**
- backend/database/db.js - Central database access
- backend/services/pems/pemsService.js - PEMS workflow engine
- backend/services/marketDataSyncService.js - Sync orchestration
- backend/services/liveDataSyncService.js - PA-API integration

---

## Migration Quick Reference

### Phase Timeline (22 Weeks)

| Phase | Weeks | Focus | Traffic Split |
|-------|-------|-------|---------------|
| 0 | 1-2 | Foundation | 0% |
| 1 | 3-5 | Auth & Core | 10% |
| 2 | 6-8 | Sellers & ASINs | 25% |
| 3 | 9-12 | Marketplace Sync | 50% |
| 4 | 13-16 | PEMS | 75% |
| 5 | 17-19 | Real-time | 100% |
| 6 | 20-22 | Cutover | 100% |

### Key Technical Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Architecture | Clean Architecture + Vertical Slice | Testability, maintainability |
| ORM | EF Core 8 | Type safety, migrations, LINQ |
| Real-time | SignalR + Redis backplane | Native .NET, scales horizontally |
| Jobs | Hangfire | Reliable, dashboard, retries |
| Auth | JWT + Redis + Identity | Standards-compliant, scalable |
| API Style | REST + CQRS | Clear separation, testability |
| Validation | FluentValidation | Declarative, composable |

---

## Critical Success Factors

1. **Contract Testing First** - Every endpoint validated against Node.js before cutover
2. **Feature Flags** - Gradual rollout with instant rollback capability
3. **Shared Database** - Zero-downtime migration with dual-write period
4. **Observability** - APM, health checks, structured logging from day 1
5. **Team Pairing** - Knowledge transfer during migration

---

## Quick Links

### For Developers
- [Technical Spec](./TECHNICAL_SPEC_ASPNET.md) - Start here for implementation
- [API Specification](./API_SPECIFICATION.md) - Contract reference
- [Database Schema](./DATABASE_SCHEMA.md) - Entity relationships

### For QA
- [Migration Plan](./MIGRATION_PLAN.md#4-testing-strategy) - Test strategy
- [API Specification](./API_SPECIFICATION.md) - Contract testing

### For DevOps
- [Migration Plan](./MIGRATION_PLAN.md) - Phase timeline
- [Technical Spec](./TECHNICAL_SPEC_ASPNET.md#10-deployment) - Docker/K8s configs

### For Management
- [Business Requirements](./BUSINESS_REQUIREMENTS.md) - Scope & KPIs
- [Migration Plan](./MIGRATION_PLAN.md) - Timeline, budget, risks

---

## Next Steps

1. **Week 1:** Approve migration plan, assign team roles
2. **Week 1:** Set up .NET 8 solution, CI/CD, staging environment
3. **Week 2:** Create EF Core migrations, implement shared kernel
3. **Week 3:** Begin Phase 1 (Auth) implementation
4. **Sprint 1 Review:** Validate approach with contract tests

---

## Contacts

| Role | Slack | Email |
|------|-------|-------|
| Tech Lead | #retailops-tech-lead | tech-lead@retailops.com |
| Backend Team | #retailops-backend | backend@retailops.com |
| Frontend Team | #retailops-frontend | frontend@retailops.com |
| DevOps | #retailops-devops | devops@retailops.com |
| QA Lead | #retailops-qa | qa@retailops.com |
| DBA | #retailops-dba | dba@retailops.com |

---

*Last Updated: September 3, 2026*  
*Next Review: Sprint Planning (Week 1)*