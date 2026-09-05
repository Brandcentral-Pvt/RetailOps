# RetailOps V2.1 - ASP.NET Core Migration Plan

**Version:** 2.1.0  
**Date:** September 3, 2026  
**Target:** Production deployment by Q1 2027

---

## 1. Migration Overview

### 1.1 Current State
- **Backend:** Node.js (Express 5) + Socket.IO + Bull Queues (Redis) + SQL Server
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS v4
- **Real-time:** Socket.IO (in-memory adapter)
- **Auth:** JWT + In-Memory Token Blacklist
- **Jobs:** node-cron (scheduler)

### 1.2 Target State
- **Backend:** ASP.NET Core 8 Web API + SignalR + Hangfire + EF Core 8
- **Frontend:** Next.js 16 (unchanged) → calls ASP.NET Core API
- **Real-time:** SignalR (Redis backplane)
- **Auth:** JWT + Redis Token Blacklist + ASP.NET Core Identity
- **Jobs:** Hangfire (Redis/SQL) + BackgroundService

### 1.3 Migration Strategy: Strangler Fig Pattern
```
Phase 1: New ASP.NET Core API runs alongside Node.js
         ├── API Gateway routes /api/v2/* to ASP.NET Core
         ├── Shared database (read/write both)
         └── Feature flags control traffic split

Phase 2: Migrate endpoints incrementally
         ├── Auth → Sellers → ASINs → Sync → PEMS → Real-time
         ├── Run both in parallel with contract tests
         └── Gradually shift traffic 10% → 50% → 100%

Phase 3: Decommission Node.js
         ├── Remove Node.js from infrastructure
         ├── Update DNS/load balancer
         └── Archive Node.js codebase
```

---

## 2. Detailed Phase Plan

### Phase 0: Foundation (Weeks 1-2)

| Task | Description | Owner | Dependencies |
|------|-------------|-------|--------------|
| 0.1 | Set up .NET 8 solution structure | DevOps | - |
| 0.2 | Configure CI/CD pipelines | DevOps | 0.1 |
| 0.3 | Set up SQL Server + Redis in staging | DevOps | - |
| 0.4 | Create EF Core migrations from existing schema | DBA | 0.3 |
| 0.5 | Implement shared kernel (DTOs, enums, constants) | Backend | 0.1 |
| 0.6 | Set up API gateway routing (v1=Node, v2=ASP.NET) | DevOps | 0.1 |
| 0.7 | Contract testing framework (Pact/Postman) | QA | 0.1 |

**Deliverable:** Running ASP.NET Core API with health checks, connected to staging DB/Redis

---

### Phase 1: Auth & Core Domain (Weeks 3-5)

| Task | Description | Owner | Dependencies |
|------|-------------|-------|--------------|
| 1.1 | Port User, Role, Permission entities | Backend | 0.5 |
| 1.2 | Implement EF Core configurations | Backend | 1.1 |
| 1.3 | Create repositories (User, Role, Permission) | Backend | 1.2 |
| 1.4 | Implement JWT authentication + Redis blacklist | Backend | 1.3 |
| 1.5 | Port OTP service (login, password reset) | Backend | 1.4 |
| 1.6 | Implement ASP.NET Core Identity integration | Backend | 1.4 |
| 1.7 | Create AuthController (login, refresh, logout, me) | Backend | 1.5 |
| 1.8 | Integration tests for auth flows | QA | 1.7 |
| 1.9 | Contract tests vs Node.js auth endpoints | QA | 1.8 |
| 1.10 | Feature flag: route 10% auth traffic to ASP.NET | DevOps | 1.9 |

**Deliverable:** Auth fully functional in ASP.NET Core, 10% production traffic

---

### Phase 2: Sellers & ASINs (Weeks 6-8)

| Task | Description | Owner | Dependencies |
|------|-------------|-------|--------------|
| 2.1 | Port Seller, Asin entities + configurations | Backend | 1.2 |
| 2.2 | Create SellerRepository, AsinRepository | Backend | 2.1 |
| 2.3 | Implement Seller CRUD commands/queries | Backend | 2.2 |
| 2.4 | Implement ASIN CRUD + LQS queries | Backend | 2.2 |
| 2.5 | Port LQS service (Title, Bullets, Images analyzers) | Backend | 2.3 |
| 2.6 | Create SellersController + AsinsController | Backend | 2.4 |
| 2.7 | Implement search, filtering, pagination | Backend | 2.6 |
| 2.8 | Integration tests for Sellers/ASINs | QA | 2.7 |
| 2.9 | Contract tests vs Node.js endpoints | QA | 2.8 |
| 2.10 | Feature flag: route 25% Seller/ASIN traffic | DevOps | 2.9 |

**Deliverable:** Sellers & ASINs fully functional, 25% production traffic

---

### Phase 3: Marketplace Sync (Weeks 9-12)

| Task | Description | Owner | Dependencies |
|------|-------------|-------|--------------|
| 3.1 | Port ScheduledRun, ScheduledRunDetail entities | Backend | 1.2 |
| 3.2 | Create PipelineService (core orchestration) | Backend | 3.1 |
| 3.3 | Port OctoparseService (API client) | Backend | 2.5 |
| 3.4 | Port KeepaService (API client) | Backend | 2.5 |
| 3.5 | Port AmazonPAAPIService (OAuth + PA-API) | Backend | 2.5 |
| 3.6 | Port MarketDataSyncService (orchestration) | Backend | 3.2 |
| 3.7 | Port LiveDataSyncService (PA-API + batching) | Backend | 3.5 |
| 3.8 | Implement Hangfire job scheduling | Backend | 3.6 |
| 3.9 | Create MarketSyncController + PipelineController | Backend | 3.6 |
| 3.10 | Port self-healing recovery logic | Backend | 3.6 |
| 3.11 | Integration tests for full pipeline | QA | 3.10 |
| 3.12 | Contract tests vs Node.js sync endpoints | QA | 3.11 |
| 3.13 | Feature flag: route 50% sync traffic | DevOps | 3.12 |

**Deliverable:** Full sync pipeline functional, 50% production traffic

---

### Phase 4: PEMS (Weeks 13-16)

| Task | Description | Owner | Dependencies |
|------|-------------|-------|--------------|
| 4.1 | Port all PEMS entities (20+ tables) | Backend | 1.2 |
| 4.2 | Create PEMS repositories (Task, Template, SubTask) | Backend | 4.1 |
| 4.2 | Port PemsService (core workflow engine) | Backend | 4.2 |
| 4.4 | Port RecurrenceService (cron generation) | Backend | 4.3 |
| 4.5 | Port EscalationService (SLA monitoring) | Backend | 4.3 |
| 4.6 | Port NotificationService (in-app + email) | Backend | 4.3 |
| 4.7 | Port WorkflowEngine (state transitions) | Backend | 4.3 |
| 4.8 | Create PemsController (Templates, Tasks, SubTasks) | Backend | 4.4 |
| 4.9 | Implement SignalR PemsHub | Backend | 4.8 |
| 4.10 | Port Dashboard queries | Backend | 4.8 |
| 4.11 | Integration tests for full PEMS workflow | QA | 4.10 |
| 4.12 | Contract tests vs Node.js PEMS endpoints | QA | 4.11 |
| 4.13 | Feature flag: route 75% PEMS traffic | DevOps | 4.12 |

**Deliverable:** Full PEMS functional, 75% production traffic

---

### Phase 5: Real-time & Communication (Weeks 17-19)

| Task | Description | Owner | Dependencies |
|------|-------------|-------|--------------|
| 5.1 | Port Conversation, Message entities | Backend | 1.2 |
| 5.2 | Implement SignalR ChatHub | Backend | 5.1 |
| 5.3 | Port CometChat integration service | Backend | 5.2 |
| 5.4 | Implement CallLogs (WebRTC signaling) | Backend | 5.2 |
| 5.5 | Port real-time event broadcasting | Backend | 5.2 |
| 5.6 | Migrate Socket.IO clients to SignalR client | Frontend | 5.5 |
| 5.7 | Integration tests for real-time features | QA | 5.6 |
| 5.8 | Feature flag: route 100% real-time traffic | DevOps | 5.7 |

**Deliverable:** Real-time fully on SignalR, 100% traffic

---

### Phase 6: Remaining Features & Cutover (Weeks 20-22)

| Task | Description | Owner | Dependencies |
|------|-------------|-------|--------------|
| 6.1 | Port Dashboard analytics queries | Backend | 2.5 |
| 6.2 | Port Alerts & System Settings | Backend | 1.2 |
| 6.3 | Port Webhooks, Downloads, Files | Backend | 1.2 |
| 6.4 | Port Auto-tagging service | Backend | 2.5 |
| 6.5 | Port Keepa sync + revenue calculators | Backend | 3.5 |
| 6.6 | Full integration test suite | QA | 6.5 |
| 6.7 | Performance testing (load, stress) | QA | 6.6 |
| 6.8 | Security audit (penetration test) | Security | 6.6 |
| 6.9 | Feature flag: route 100% all traffic | DevOps | 6.8 |
| 6.10 | Monitor 48h at 100% | All | 6.9 |
| 6.11 | Decommission Node.js services | DevOps | 6.10 |

**Deliverable:** 100% on ASP.NET Core, Node.js decommissioned

---

## 3. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| EF Core migration issues | High | High | Run in staging first; keep rollback scripts; test with production data subset |
| SignalR vs Socket.IO parity | Medium | High | Implement feature flags; run both in parallel; automated diff testing |
| Hangfire job scheduling | Medium | Medium | Test all cron expressions in staging; monitor job dashboard |
| Redis connection handling | Low | High | Implement circuit breaker + fallback to in-memory |
| Team learning curve | High | Medium | Pair programming; code reviews; architecture decision records |
| Data consistency during migration | Medium | High | Use transactional outbox pattern; verify with checksums |
| Performance regression | Medium | High | Continuous benchmarking; APM monitoring; load tests each phase |

---

## 4. Testing Strategy

### 4.1 Test Pyramid

```
                    E2E Tests (5%)
                  /              \
           Integration Tests (25%)
        /                          \
   Unit Tests (70%) - Fast, isolated
```

### 4.2 Contract Testing

```csharp
// Example: Pact contract test for Sellers API
[Fact]
public async Task GetSellers_ReturnsExpectedSchema()
{
    var pact = new PactBuilder()
        .ServiceConsumer("Frontend")
        .HasPactWith("Sellers API")
        .Given("sellers exist")
        .UponReceiving("a request for sellers")
        .With(req => req
            .Method(HttpMethod.Get)
            .Path("/api/sellers")
            .Query("page=1&limit=20"))
        .WillRespondWith(resp => resp
            .Status(200)
            .Body(new
            {
                data = EachLike(new { id = "sel_123", name = "Test" }),
                pagination = new { page = 1, limit = 20, totalItems = 100 }
            }));
    
    await pact.VerifyAsync(async ctx => {
        var response = await _client.GetAsync("/api/sellers?page=1&limit=20");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    });
}
```

### 4.3 Load Testing Targets

| Endpoint | Target RPS | p95 Latency | Error Rate |
|----------|------------|-------------|------------|
| `GET /api/sellers` | 500 | < 200ms | < 0.1% |
| `GET /api/asins` | 300 | < 200ms | < 0.1% |
| `POST /api/market-sync/trigger` | 50 | < 500ms | < 0.5% |
| `GET /api/pems/tasks` | 200 | < 150ms | < 0.1% |
| SignalR connections | 10,000 concurrent | < 100ms | < 0.1% |

---

## 5. Data Migration

### 5.1 Strategy: Zero-Downtime Migration

```sql
-- 1. Create EF Core migration history table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '__EFMigrationsHistory')
BEGIN
    CREATE TABLE __EFMigrationsHistory (
        MigrationId NVARCHAR(150) NOT NULL PRIMARY KEY,
        ProductVersion NVARCHAR(32) NOT NULL
    );
END

-- 2. No schema changes needed initially (existing schema compatible)
-- 3. Add computed columns for LQS
ALTER TABLE Asins ADD LqsScoreComputed AS (
    (ISNULL(LqsTitle,0) * 0.30 + ISNULL(LqsBullets,0) * 0.25 + ISNULL(LqsImages,0) * 0.25) / 0.80
) PERSISTED;

-- 4. Add missing indexes for EF Core performance
CREATE INDEX IX_Asins_Seller_Status_Synced ON Asins(SellerId, Status, LastSyncedAt DESC)
    INCLUDE (AsinCode, Title, Price, Bsr, LqsScore, LqsGrade);

-- 5. Run EF Core migrations
-- dotnet ef database update --project src/RetailOps.Infrastructure --startup-project src/RetailOps.Api
```

### 5.2 Data Validation

```csharp
// Validation script run post-migration
public class DataValidationService
{
    public async Task<ValidationReport> ValidateAsync()
    {
        var report = new ValidationReport();
        
        // Count validation
        report.SellerCount = await _sql.CountAsync<Seller>();
        report.AsinCount = await _sql.CountAsync<Asin>();
        report.UserCount = await _sql.CountAsync<User>();
        report.TaskInstanceCount = await _sql.CountAsync<PemsTaskInstance>();
        
        // Referential integrity
        report.OrphanAsins = await _sql.CountAsync<Asin>(a => !_sql.Exists<Seller>(s => s.Id == a.SellerId));
        report.OrphanTasks = await _sql.CountAsync<PemsTaskInstance>(t => !_sql.Exists<PemsTaskTemplate>(tp => tp.Id == t.TemplateId));
        
        // Checksums for critical tables
        report.SellerChecksum = await ComputeChecksumAsync("Sellers");
        report.AsinChecksum = await ComputeChecksumAsync("Asins");
        
        return report;
    }
}
```

---

## 6. Monitoring & Observability

### 6.1 Key Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| API p95 latency | Application Insights | > 500ms |
| Error rate | Application Insights | > 0.5% |
| SignalR connections | Custom metric | > 8000 |
| Hangfire queue length | Hangfire dashboard | > 100 |
| DB connection pool usage | SQL Server | > 80% |
| Redis memory usage | Redis | > 80% |
| Hangfire job failure rate | Hangfire | > 5% |

### 6.2 Health Checks

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddDbContextCheck<RetailOpsDbContext>("database")
    .AddRedis(builder.Configuration.GetConnectionString("Redis")!)
    .AddHangfire()
    .AddCheck<ExternalApiHealthCheck>("octoparse")
    .AddCheck<ExternalApiHealthCheck>("keepa")
    .AddCheck<ExternalApiHealthCheck>("amazon-paapi")
    .AddCheck<ExternalApiHealthCheck>("cometchat");

// Endpoints
app.MapHealthChecks("/api/health");
app.MapHealthChecks("/api/health/liveness", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/api/health/readiness", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });
```

---

## 7. Rollback Plan

### 7.1 Per-Phase Rollback

| Phase | Rollback Trigger | Rollback Action | RTO |
|-------|------------------|-----------------|-----|
| 1 (Auth) | > 1% auth failures | Disable feature flag; route 100% to Node | < 5 min |
| 2 (Sellers) | > 1% 5xx on Seller API | Disable feature flag | < 5 min |
| 3 (Sync) | Pipeline failure rate > 5% | Disable sync feature flag; manual runs via Node | < 10 min |
| 4 (PEMS) | Task transition failures > 2% | Disable PEMS feature flag | < 5 min |
| 5 (Real-time) | SignalR connection drops > 10% | Route WebSocket to Node.js | < 5 min |
| 6 (Full) | Critical production issue | Blue-green swap to Node.js | < 15 min |

### 7.2 Database Rollback

```bash
# EF Core rollback to previous migration
dotnet ef database update PreviousMigrationName --project src/RetailOps.Infrastructure --startup-project src/RetailOps.Api

# Or restore from backup
# 1. Stop ASP.NET Core API
# 2. Restore SQL Server from pre-migration backup
# 3. Restart Node.js API
# 4. Verify data integrity
```

---

## 8. Team Structure & Communication

### 8.1 Team Roles

| Role | Responsibilities |
|------|------------------|
| **Tech Lead** | Architecture decisions, code reviews, unblocking |
| **Backend Engineers (4)** | Domain, Application, Infrastructure layers |
| **Frontend Engineer (1)** | SignalR migration, API client updates |
| **DevOps Engineer (1)** | CI/CD, infrastructure, feature flags, monitoring |
| **QA Engineer (2)** | Contract tests, integration tests, load tests |
| **DBA (1)** | Migrations, performance tuning, rollback scripts |
| **Security Engineer (1)** | Auth review, penetration testing, compliance |

### 8.2 Ceremonies

| Ceremony | Frequency | Participants |
|----------|-----------|--------------|
| Daily Standup | Daily | All engineers |
| Sprint Planning | Bi-weekly | All |
| Architecture Review | Weekly | Tech Lead + Backend |
| Migration Sync | 2x/week | Tech Lead + DevOps + DBA |
| Retrospective | Bi-weekly | All |
| Demo | End of sprint | All + Stakeholders |

---

## 9. Definition of Done (Per Phase)

- [ ] All endpoints implemented with contract tests passing
- [ ] Unit test coverage > 80% for new code
- [ ] Integration tests passing in staging
- [ ] Load test meets targets
- [ ] Security scan passes (no critical/high)
- [ ] Documentation updated (API specs, runbooks)
- [ ] Feature flag tested at 100% in staging
- [ ] Rollback tested and documented
- [ ] Monitoring/alerts configured
- [ ] Team knowledge transfer completed

---

## 10. Budget & Resources

| Category | Estimate |
|----------|----------|
| Engineering (6 FTE × 22 weeks) | $350,000 |
| DevOps/Infra (1 FTE × 22 weeks) | $60,000 |
| QA (2 FTE × 18 weeks) | $100,000 |
| Security Audit | $25,000 |
| Load Testing Tools | $10,000 |
| Staging Environment (3 months) | $15,000 |
| **Total** | **~$560,000** |

---

## 11. Success Criteria

| Metric | Target |
|--------|--------|
| API p95 latency | < 200ms (improvement from 500ms) |
| Error rate | < 0.1% |
| Deployment frequency | Daily (vs weekly) |
| MTTR | < 30 min |
| Test coverage | > 80% |
| Zero critical security findings | Yes |
| Zero data loss during migration | Yes |
| Team satisfaction | > 4/5 |

---

*Document Owner: Architecture Team*  
*Review Cycle: Sprint Planning*  
*Approved By: [CTO/VP Engineering]*

---

## Appendix: Feature Flag Configuration

```json
{
  "featureFlags": {
    "auth_aspnet": { "enabled": true, "rollout": 10 },
    "sellers_aspnet": { "enabled": false, "rollout": 0 },
    "asins_aspnet": { "enabled": false, "rollout": 0 },
    "sync_aspnet": { "enabled": false, "rollout": 0 },
    "pems_aspnet": { "enabled": false, "rollout": 0 },
    "realtime_aspnet": { "enabled": false, "rollout": 0 },
    "dashboard_aspnet": { "enabled": false, "rollout": 0 }
  }
}
```

Rollout increments: 10% → 25% → 50% → 75% → 100% (minimum 48h at each step)