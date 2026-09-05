# RetailOps V2.1 - Business Requirements Document

**Version:** 2.1.0  
**Date:** September 3, 2026  
**Status:** Approved for Development

---

## 1. Executive Summary

RetailOps is a **multi-tenant marketplace operations platform** for Amazon and Ajio sellers. It automates catalog synchronization, listing quality analysis, task management (PEMS), and real-time team collaboration.

**Core Value Proposition:** Reduce manual marketplace operations by 80% through intelligent automation, AI-powered listing optimization, and centralized team workflows.

---

## 2. Stakeholders & User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Super Admin** | Platform owner, full access | All permissions, user management, system config |
| **Admin** | Team administrator | Seller management, user roles, settings |
| **Manager** | Operations lead | Pipeline scheduling, task assignment, reports |
| **Analyst** | Data analyst | Dashboard access, export, read-only seller data |
| **Operator** | Task executor | Assigned tasks, live sync, CometChat |
| **Viewer** | Read-only access | Dashboard, reports |

---

## 3. Core Business Capabilities

### 3.1 Marketplace Synchronization (Amazon/Ajio)

| Capability | Description | Priority | SLA |
|------------|-------------|----------|-----|
| **Octoparse Pipeline** | Full catalog sync via Octoparse cloud tasks | Critical | Daily 00:00 IST |
| **Keepa Sync** | New ASIN discovery from Keepa API | High | On-demand |
| **Live Data Sync** | Real-time PA-API data (price, BSR, reviews) | Critical | Scheduled + On-demand |
| **Self-Healing Recovery** | Detect & re-sync missing/incomplete ASINs | High | Post-pipeline |
| **Multi-Marketplace** | Amazon.in, Amazon.com, Ajio support | Critical | Per marketplace |

**Business Rules:**
- Small sellers first (by ASIN count) to maximize throughput
- Concurrency: 10-20 workers (configurable per marketplace)
- Stop all tasks after completion to prevent Octoparse conflicts
- Self-healing runs automatically post-pipeline

### 3.2 Listing Quality System (LQS)

| Component | Description | AI/Rule-Based |
|-----------|-------------|---------------|
| **Title Analysis** | Length, keywords, brand placement | Rule + AI |
| **Bullet Points** | Count, quality, feature coverage | Rule + AI |
| **Images** | Count, main image, white background | Rule + AI Vision |
| **LQS Score** | 0-100 weighted score (Title 30%, Bullets 25%, Images 25%, Description 20%) | Computed |
| **Grade** | A+ to F based on score thresholds | Computed |

**Quality Gates:**
- Minimum 5 bullets, 150 chars each
- Minimum 5 images, main image white background
- Title: 60-200 chars, brand in first 5 words
- A+ content detection

### 3.3 PEMS (Project/Task Management)

| Feature | Description |
|---------|-------------|
| **Task Templates** | Reusable definitions with categories, priorities, SLA |
| **Recurrence Engine** | Hourly cron generates due occurrences from templates |
| **Workflow States** | CREATED → ASSIGNED → SUBMITTED → APPROVED/REJECTED → COMPLETED |
| **SLA Tracking** | Escalation every 30 min, auto-escalate on breach |
| **Sub-tasks** | Hierarchical decomposition with independent status |
| **Notifications** | In-app + Email (assignment, SLA breach, approval) |
| **Audit Trail** | Immutable event log for compliance |

**Business Rules:**
- Only assigned user or global role can transition
- Rejection requires feedback, returns to ASSIGNED
- Escalation notifies assignee + reviewer + manager
- Templates support auto-assign by role/round-robin

### 3.4 Real-Time Collaboration

| Feature | Description |
|---------|-------------|
| **Chat** | CometChat integration (1:1, groups, threads) |
| **Voice/Video Calls** | WebRTC via CometChat SDK |
| **Presence** | Online/offline, last seen |
| **Typing Indicators** | Per-conversation |
| **Message Reactions** | Emoji reactions |
| **Read Receipts** | Per-message |

### 3.5 Analytics & Reporting

| Report | Frequency | Audience |
|--------|-----------|----------|
| **Dashboard Overview** | Real-time | All roles |
| **Revenue & Orders** | Daily/Weekly | Manager, Admin |
| **LQS Distribution** | Daily | Analyst, Manager |
| **Pipeline Status** | Per run | Operator, Manager |
| **Seller Performance** | Weekly | Manager, Admin |
| **PEMS KPIs** | Daily | Manager, Admin |
| **Live Sync Tracker** | Per job | Operator |

---

## 4. External Integrations

| Integration | Purpose | Auth | Rate Limits |
|-------------|---------|------|-------------|
| **Octoparse API** | Task management, data extraction | API Key | 100 req/min |
| **Keepa API** | Product data, price history | API Key | 1 req/sec |
| **Amazon PA-API** | Live catalog data (price, BSR, reviews) | OAuth 2.0 | 1 req/sec |
| **Amazon Creators API** | Enhanced content, A+ | OAuth 2.0 | 1 req/sec |
| **Keepa API** | ASIN discovery, price tracking | API Key | 1 req/sec |
| **CometChat** | Chat, calls, presence | App ID + Auth Key | Per plan |
| **Email (SMTP)** | Notifications, OTP | SMTP credentials | Provider limits |
| **SQL Server** | Primary data store | SQL Auth | Connection pool |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | API p95 latency | < 500ms |
| **Performance** | Pipeline throughput | 500+ sellers/hour |
| **Availability** | Uptime | 99.9% |
| **Scalability** | Max sellers | 10,000+ |
| **Security** | Data encryption | TLS 1.3 + AES-256 at rest |
| **Security** | Auth | JWT + Refresh, MFA ready |
| **Compliance** | Audit logging | All mutations logged |
| **Reliability** | Error rate | < 0.1% |
| **Observability** | Logging | Structured JSON, 30-day retention |

---

## 6. Data Retention & Privacy

| Data Type | Retention | Deletion Policy |
|-----------|-----------|-----------------|
| **OTP Codes** | 24 hours | Auto-cleanup daily |
| **Chat Messages** | 2 years | Soft delete, admin purge |
| **Task Audit Logs** | 7 years | Compliance hold |
| **Pipeline Logs** | 2 years | Archive after 90 days |
| **Live Sync Results** | 90 days | Auto-expire |
| **User Sessions** | 7 days (refresh) | Token expiry |
| **PII (Email, Phone)** | Account lifetime | Delete on account removal |

---

## 7. Success Metrics (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Pipeline Success Rate** | > 95% | Completed sellers / Total sellers |
| **Data Freshness** | < 24 hours | Last sync timestamp |
| **LQS Improvement** | +15% avg score | Pre/post optimization |
| **Task Completion Rate** | > 90% | Completed / Assigned |
| **SLA Compliance** | > 95% | On-time / Total |
| **User Adoption** | > 80% DAU/MAU | Active users |
| **API Error Rate** | < 0.5% | 5xx / Total requests |

---

## 8. Future Enhancements (Roadmap)

| Phase | Feature | Effort |
|-------|---------|--------|
| **Q1 2027** | Multi-marketplace (Walmart, Flipkart) | Large |
| **Q1 2027** | AI-powered pricing recommendations | Medium |
| **Q2 2027** | Advanced inventory forecasting | Large |
| **Q2 2027** | Mobile app (React Native) | Medium |
| **Q3 2027** | White-label partner portal | Large |

---

*Document Owner: Product Team*  
*Review Cycle: Quarterly*  
*Next Review: December 2026*