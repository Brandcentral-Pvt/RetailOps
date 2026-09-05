# RetailOps V2.1 - API Specification (OpenAPI 3.0)

**Version:** 2.1.0  
**Date:** September 3, 2026  
**Base URL:** `https://api.retailops.com/v1`  
**Format:** JSON  
**Auth:** Bearer Token (JWT)

---

## 1. Authentication

### 1.1 Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": {
      "id": "role_admin",
      "name": "admin",
      "displayName": "Administrator",
      "permissions": ["sellers_read", "sellers_write", "pipeline_run", "pems_manage"]
    }
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 1.2 Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 1.3 Logout

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

### 1.4 Get Current User

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

### 1.5 Change Password

```http
POST /api/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```

### 1.6 Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 1.7 Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newSecurePassword123"
}
```

---

## 2. Sellers API

### 2.1 List Sellers

```http
GET /api/sellers?page=1&limit=20&search=acme&marketplace=amazon&isActive=true
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| search | string | - | Search by name/email |
| marketplace | string | - | Filter: amazon, ajio, both |
| isActive | boolean | - | Filter by active status |

**Response 200:**
```json
{
  "data": [
    {
      "id": "sel_abc123",
      "name": "Acme Corp",
      "email": "contact@acme.com",
      "phone": "+91-9876543210",
      "marketplace": "amazon",
      "octoparseId": "octo_123",
      "octoparseMarketplace": "amazon",
      "isActive": true,
      "lastScrapedAt": "2026-09-01T10:30:00Z",
      "asinCount": 1250,
      "createdAt": "2026-01-15T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 150,
    "totalPages": 8
  }
}
```

### 2.2 Get Seller

```http
GET /api/sellers/{id}
Authorization: Bearer <access_token>
```

### 2.3 Create Seller

```http
POST /api/sellers
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "New Seller Inc",
  "email": "seller@newinc.com",
  "phone": "+91-9876543210",
  "marketplace": "amazon",
  "octoparseId": "octo_456",
  "octoparseMarketplace": "amazon"
}
```

### 2.4 Update Seller

```http
PUT /api/sellers/{id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Seller Name",
  "phone": "+91-9876543211",
  "isActive": true
}
```

### 2.5 Delete Seller

```http
DELETE /api/sellers/{id}
Authorization: Bearer <access_token>
```

### 2.6 Get Seller ASINs

```http
GET /api/sellers/{id}/asins?page=1&limit=50&status=active
Authorization: Bearer <access_token>
```

### 2.7 Get Seller Stats

```http
GET /api/sellers/{id}/stats?period=30d
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "totalAsins": 1250,
  "activeAsins": 1180,
  "totalRevenue": 1250000.50,
  "totalOrders": 3420,
  "avgRating": 4.3,
  "avgLqsScore": 78.5,
  "revenueGrowth": 12.5,
  "ordersGrowth": 8.2
}
```

---

## 3. ASINs API

### 3.1 List ASINs

```http
GET /api/asins?page=1&limit=50&sellerId=sel_abc123&status=active&search=B08
Authorization: Bearer <access_token>
```

### 3.2 Get ASIN Details

```http
GET /api/asins/{id}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "asin_xyz789",
  "sellerId": "sel_abc123",
  "asinCode": "B08N5WRWNW",
  "title": "Wireless Bluetooth Headphones",
  "description": "Premium noise-cancelling...",
  "price": 2999.00,
  "mrp": 4999.00,
  "bsr": 1250,
  "subBsr": 45,
  "rating": 4.5,
  "reviewCount": 1250,
  "isBuyBoxWinner": true,
  "availability": "In Stock",
  "category": "Electronics > Audio > Headphones",
  "imagesCount": 7,
  "mainImageUrl": "https://images.amazon.com/...",
  "bulletPointCount": 5,
  "titleLength": 65,
  "lqsScore": 85.5,
  "lqsGrade": "A",
  "lqsTitle": 90.0,
  "lqsBullets": 85.0,
  "lqsImages": 82.0,
  "lqsIssues": [],
  "lqsSource": "ai",
  "status": "active",
  "lastSyncedAt": "2026-09-02T10:30:00Z",
  "images": [
    "https://images.amazon.com/img1.jpg",
    "https://images.amazon.com/img2.jpg"
  ],
  "bullets": [
    "Active Noise Cancellation",
    "30-hour battery life"
  ]
}
```

### 3.3 Sync ASIN

```http
POST /api/asins/{id}/sync
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "forceRefresh": false
}
```

### 3.4 Bulk Sync ASINs

```http
POST /api/asins/bulk-sync
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sellerId": "sel_abc123",
  "asins": ["B08N5WRWNW", "B09XYZ123"],
  "options": {
    "forceRefresh": false,
    "onlyMissing": true
  }
}
```

### 3.5 Get ASIN History

```http
GET /api/asins/{id}/history?page=1&limit=20
Authorization: Bearer <access_token>
```

### 3.6 Get ASIN LQS Details

```http
GET /api/asins/{id}/lqs
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "overall": {
    "score": 85.5,
    "grade": "A",
    "source": "ai"
  },
  "title": {
    "score": 90.0,
    "issues": [],
    "length": 65,
    "hasBrand": true,
    "brandPosition": 1
  },
  "bullets": {
    "score": 85.0,
    "issues": ["Bullet 3 is too short"],
    "count": 5,
    "avgLength": 120
  },
  "images": {
    "score": 82.0,
    "issues": ["Image 3 background not white"],
    "count": 7,
    "mainImageCompliance": true,
    "whiteBackground": true
  }
}
```

---

## 4. Marketplace Sync API

### 4.1 Trigger Sync

```http
POST /api/market-sync/trigger
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sellerId": "sel_abc123",
  "type": "octoparse",
  "options": {
    "concurrency": 1,
    "maxRetries": 2,
    "fullSync": false
  }
}
```

**Types:** `octoparse`, `live`, `keepa`

### 4.2 Trigger Pipeline

```http
POST /api/market-sync/pipeline/run
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "marketplace": "amazon",
  "options": {
    "resumeRunId": "run_abc123",
    "existingDetails": []
  }
}
```

### 4.3 Get Pipeline Status

```http
GET /api/market-sync/pipeline/status/{runId}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "run_abc123",
  "marketplace": "amazon",
  "status": "RUNNING",
  "startTime": "2026-09-02T00:00:00Z",
  "endTime": null,
  "totalSellers": 250,
  "successfulSellers": 180,
  "failedSellers": 5,
  "currentSeller": "sel_xyz789",
  "progressPct": 74,
  "details": [
    {
      "sellerId": "sel_abc123",
      "sellerName": "Acme Corp",
      "status": "COMPLETED",
      "asinsCount": 1250,
      "processedCount": 1250,
      "startTime": "2026-09-02T00:05:00Z",
      "endTime": "2026-09-02T00:45:00Z"
    }
  ]
}
```

### 4.4 Get Pipeline History

```http
GET /api/market-sync/pipeline/history?page=1&limit=20&marketplace=amazon
Authorization: Bearer <access_token>
```

### 4.5 Get Job Status

```http
GET /api/market-sync/jobs/{jobId}/status
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "jobId": "job_abc123",
  "sellerId": "sel_abc123",
  "type": "live",
  "status": "PROCESSING",
  "progressPct": 65,
  "totalAsins": 1250,
  "processedAsins": 812,
  "successfulAsins": 798,
  "failedAsins": 14,
  "startedAt": "2026-09-02T10:00:00Z",
  "estimatedCompletionAt": "2026-09-02T10:15:00Z"
}
```

### 4.5 Keepa Sync

```http
POST /api/market-sync/keepa/sync
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sellerId": "sel_abc123"
}
```

### 4.6 Octoparse Task Management

```http
GET /api/market-sync/octoparse/tasks?sellerId=sel_abc123
Authorization: Bearer <access_token>

POST /api/market-sync/octoparse/tasks/{taskId}/trigger
Authorization: Bearer <access_token>

POST /api/market-sync/octoparse/tasks/{taskId}/stop
Authorization: Bearer <access_token>

GET /api/market-sync/octoparse/tasks/{taskId}/status
Authorization: Bearer <access_token>

GET /api/market-sync/octoparse/tasks/{taskId}/data
Authorization: Bearer <access_token>
```

---

## 5. Live Data Sync API

### 5.1 Trigger Live Sync

```http
POST /api/live-data/sync
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sellerId": "sel_abc123",
  "asins": ["B08N5WRWNW", "B09XYZ123"],
  "options": {
    "triggerScrape": true,
    "fullSync": true,
    "onlyMissing": false,
    "concurrency": 2
  }
}
```

### 5.2 Get Job Progress

```http
GET /api/live-data/jobs/{jobId}/progress
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "jobId": "job_live_abc123",
  "sellerId": "sel_abc123",
  "status": "PROCESSING",
  "progressPct": 65,
  "totalAsins": 1250,
  "processedAsins": 812,
  "successfulAsins": 798,
  "failedAsins": 14,
  "currentBatch": 82,
  "totalBatches": 125,
  "currentAsin": "B08N5WRWNW",
  "startedAt": "2026-09-02T10:00:00Z",
  "estimatedCompletionAt": "2026-09-02T10:15:00Z",
  "errors": [
    {
      "asin": "B09XYZ123",
      "error": "Rate limited by PA-API",
      "retryAt": "2026-09-02T10:05:00Z"
    }
  ]
}
```

### 5.3 Get Job Results

```http
GET /api/live-data/jobs/{jobId}/results?page=1&limit=50
Authorization: Bearer <access_token>
```

### 5.4 Download Results

```http
GET /api/live-data/jobs/{jobId}/download
Authorization: Bearer <access_token>
```

### 5.5 Cancel Job

```http
POST /api/live-data/jobs/{jobId}/cancel
Authorization: Bearer <access_token>
```

### 5.6 Get Seller Live Data

```http
GET /api/live-data/sellers/{sellerId}/asins?page=1&limit=50
Authorization: Bearer <access_token>
```

### 5.7 Live Sync Tracker

```http
GET /api/live-sync-tracker/runs?page=1&limit=20&sellerId=sel_abc123
Authorization: Bearer <access_token>

GET /api/live-sync-tracker/runs/{runId}
Authorization: Bearer <access_token>

GET /api/live-sync-tracker/runs/{runId}/asins?page=1&limit=50
Authorization: Bearer <access_token>
```

---

## 6. PEMS API (Task Management)

### 6.1 Task Templates

```http
GET /api/pems/templates?page=1&limit=20&category=GENERAL&isActive=true
Authorization: Bearer <access_token>

GET /api/pems/templates/{id}
Authorization: Bearer <access_token>

POST /api/pems/templates
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Monthly Inventory Audit",
  "description": "Complete inventory count for all active ASINs",
  "category": "INVENTORY",
  "priority": "HIGH",
  "type": "AUDIT",
  "timeLimit": 120,
  "autoAssignEnabled": true,
  "autoAssignStrategy": "least_loaded",
  "approvalLevel": 2,
  "activities": [
    {
      "title": "Count Physical Inventory",
      "description": "Count all physical units in warehouse",
      "orderIndex": 1,
      "isRequired": true,
      "timeLimit": 60
    },
    {
      "title": "Reconcile with System",
      "description": "Compare physical count with system records",
      "orderIndex": 2,
      "isRequired": true,
      "timeLimit": 60
    }
  ],
  "recurrence": {
    "frequency": "MONTHLY",
    "interval": 1,
    "dayOfMonth": 1,
    "startDate": "2026-10-01T00:00:00Z",
    "timeZone": "Asia/Kolkata"
  }
}

PUT /api/pems/templates/{id}
DELETE /api/pems/templates/{id}
```

### 6.2 Task Instances

```http
GET /api/pems/tasks?page=1&limit=20&status=ASSIGNED&assigneeId=usr_abc123&startDate=2026-09-01&endDate=2026-09-30
Authorization: Bearer <access_token>

GET /api/pems/tasks/{id}
Authorization: Bearer <access_token>

POST /api/pems/tasks
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "templateId": "tpl_abc123",
  "assigneeId": "usr_xyz789",
  "reviewerId": "usr_mgr001",
  "dueDate": "2026-09-15T23:59:00Z",
  "priority": "HIGH"
}

PUT /api/pems/tasks/{id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Updated Task Title",
  "description": "Updated description",
  "priority": "CRITICAL",
  "dueDate": "2026-09-20T23:59:00Z"
}

DELETE /api/pems/tasks/{id}
Authorization: Bearer <access_token>
```

### 6.3 Task Transitions

```http
POST /api/pems/tasks/{id}/transition
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "toStatus": "SUBMITTED",
  "feedback": "All items counted and reconciled"
}
```

**Valid Transitions:**
| From Status | To Status | Required Role |
|-------------|-----------|---------------|
| CREATED | ASSIGNED | Manager |
| ASSIGNED | IN_PROGRESS | Assignee |
| IN_PROGRESS | SUBMITTED | Assignee |
| SUBMITTED | APPROVED | Reviewer |
| SUBMITTED | REJECTED | Reviewer |
| REJECTED | ASSIGNED | Reviewer |
| * | ESCALATED | System (auto) |

### 6.4 Sub Tasks

```http
GET /api/pems/tasks/{id}/subtasks
Authorization: Bearer <access_token>

POST /api/pems/tasks/{id}/subtasks
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Count Warehouse A",
  "description": "Count all items in Warehouse A",
  "orderIndex": 1,
  "isRequired": true,
  "assigneeId": "usr_xyz789"
}

PUT /api/pems/subtasks/{id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

### 6.5 Task Reviews

```http
POST /api/pems/tasks/{id}/review
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "decision": "APPROVED",
  "feedback": "All counts match system records",
  "qualityScore": 95,
  "checklist": {
    "physicalCountDone": true,
    "systemReconciled": true,
    "discrepanciesResolved": true
  }
}
```

### 6.6 Task Events & Evidence

```http
GET /api/pems/tasks/{id}/events
Authorization: Bearer <access_token>

POST /api/pems/tasks/{id}/evidence
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <binary>
description: "Photo of counted inventory"
subTaskId: "sub_abc123" (optional)

GET /api/pems/tasks/{id}/evidence
Authorization: Bearer <access_token>
```

### 6.6 PEMS Dashboard

```http
GET /api/pems/dashboard?assigneeId=usr_abc123
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "summary": {
    "assigned": 12,
    "inProgress": 5,
    "submitted": 3,
    "overdue": 2,
    "escalated": 1
  },
  "myTasks": [
    {
      "id": "tsk_abc123",
      "title": "Monthly Inventory Audit",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "dueDate": "2026-09-15T23:59:00Z",
      "slaHoursRemaining": 4,
      "progressPct": 60
    }
  ],
  "teamTasks": [...],
  "escalations": [...]
}
```

---

## 7. Notifications API

```http
GET /api/notifications?page=1&limit=20&isRead=false
Authorization: Bearer <access_token>

PUT /api/notifications/{id}/read
Authorization: Bearer <access_token>

PUT /api/notifications/read-all
Authorization: Bearer <access_token>

GET /api/notifications/unread-count
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "notif_abc123",
      "type": "TASK_ASSIGNED",
      "title": "New Task Assigned",
      "message": "You have been assigned: Monthly Inventory Audit",
      "actionUrl": "/pems/tasks/tsk_abc123",
      "isRead": false,
      "createdAt": "2026-09-02T10:00:00Z"
    }
  ],
  "unreadCount": 5
}
```

---

## 8. Dashboard & Analytics API

### 8.1 Dashboard Overview

```http
GET /api/dashboard/overview?sellerId=sel_abc123&period=30d
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "revenue": {
    "total": 1250000.50,
    "growth": 12.5,
    "period": "30d"
  },
  "orders": {
    "total": 3420,
    "growth": 8.2
  },
  "asins": {
    "total": 1250,
    "active": 1180,
    "growth": 5.3
  },
  "sellers": {
    "total": 50,
    "active": 48
  },
  "lqsDistribution": {
    "A": 450,
    "B": 380,
    "C": 200,
    "D": 120,
    "F": 50
  }
}
```

### 8.2 Revenue Data

```http
GET /api/dashboard/revenue?sellerId=sel_abc123&period=30d&granularity=daily
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "date": "2026-09-01",
      "revenue": 45000.00,
      "orders": 120
    }
  ],
  "summary": {
    "totalRevenue": 1250000.50,
    "avgDailyRevenue": 41666.68,
    "peakDay": "2026-09-15"
  }
}
```

### 8.3 Top Products

```http
GET /api/dashboard/top-products?sellerId=sel_abc123&limit=10&period=30d
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "asin": "B08N5WRWNW",
      "title": "Wireless Bluetooth Headphones",
      "revenue": 150000.00,
      "units": 50,
      "rating": 4.5,
      "lqsScore": 85.5,
      "lqsGrade": "A"
    }
  ]
}
```

### 8.4 Seller Performance

```http
GET /api/dashboard/seller-performance?page=1&limit=20&period=30d
Authorization: Bearer <access_token>
```

---

## 9. Real-time (SignalR Hubs)

### 9.1 PEMS Hub

```javascript
// Connection
const connection = new signalR.HubConnectionBuilder()
  .withUrl("/hubs/pems", { accessTokenFactory: () => getAccessToken() })
  .withAutomaticReconnect()
  .build();

// Join task room
await connection.invoke("JoinTaskGroup", "tsk_abc123");

// Listen for events
connection.on("TaskStatusChanged", (data) => {
  console.log("Task status changed:", data);
  // { taskInstanceId, fromStatus, toStatus, actorName, timestamp }
});

connection.on("TaskAssigned", (data) => {
  console.log("New task assigned:", data);
  // { taskInstanceId, title, assigneeId, dueDate }
});

connection.on("TaskEscalated", (data) => {
  console.log("Task escalated:", data);
});

connection.on("NotificationCreated", (notification) => {
  console.log("New notification:", notification);
});

await connection.start();
```

### 9.2 Chat Hub

```javascript
const chatConnection = new signalR.HubConnectionBuilder()
  .withUrl("/hubs/chat", { accessTokenFactory: () => getAccessToken() })
  .withAutomaticReconnect()
  .build();

chatConnection.on("ReceiveMessage", (message) => {
  // { id, conversationId, senderId, type, content, fileUrl, replyToId, createdAt }
});

chatConnection.on("Typing", (data) => {
  // { conversationId, senderId, isTyping }
});

chatConnection.on("UserStatusChange", (data) => {
  // { userId, status: 'online' | 'offline' }
});

// Send message
await chatConnection.invoke("SendMessage", {
  conversationId: "conv_abc123",
  content: "Hello!",
  type: "TEXT"
});

// Join conversation
await chatConnection.invoke("JoinConversation", "conv_abc123");

// Typing indicator
await chatConnection.invoke("Typing", { conversationId: "conv_abc123", isTyping: true });
```

### 9.3 Live Sync Hub

```javascript
const liveSyncConnection = new signalR.HubConnectionBuilder()
  .withUrl("/hubs/live-sync", { accessTokenFactory: () => getAccessToken() })
  .withAutomaticReconnect()
  .build();

liveSyncConnection.on("JobProgress", (data) => {
  // { jobId, sellerId, status, progressPct, processedAsins, totalAsins, currentAsin }
});

liveSyncConnection.on("JobCompleted", (data) => {
  // { jobId, sellerId, status, totalAsins, successfulAsins, failedAsins }
});

liveSyncConnection.on("JobError", (data) => {
  // { jobId, asin, error, retryAt }
});

await liveSyncConnection.start();
```

---

## 10. Error Responses

### 10.1 Standard Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ],
    "requestId": "req_abc123"
  }
}
```

### 10.2 Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service down |

### 10.3 Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1693651200
Retry-After: 60
```

---

## 11. Pagination

All list endpoints support pagination:

```http
GET /api/resource?page=1&limit=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

## 12. Filtering & Sorting

```http
GET /api/sellers?search=acme&marketplace=amazon&isActive=true&sortBy=name&sortOrder=asc
```

| Parameter | Description |
|-----------|-------------|
| `search` | Full-text search |
| `sortBy` | Field to sort by |
| `sortOrder` | `asc` or `desc` |
| `filter[field]` | Exact match filter |
| `filter[field][gte]` | Greater than or equal |
| `filter[field][lte]` | Less than or equal |

---

## 13. Webhooks

### 13.1 Register Webhook

```http
POST /api/webhooks
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Order Sync Webhook",
  "url": "https://partner.example.com/webhooks/retailops",
  "events": ["pipeline.completed", "task.approved", "sync.completed"],
  "description": "Sync pipeline results to partner system"
}
```

### 13.2 Webhook Payload

```json
{
  "event": "pipeline.completed",
  "timestamp": "2026-09-02T10:30:00Z",
  "payload": {
    "runId": "run_abc123",
    "marketplace": "amazon",
    "totalSellers": 250,
    "successfulSellers": 240,
    "failedSellers": 10
  }
}
```

### 13.3 Webhook Events

| Event | Description |
|-------|-------------|
| `pipeline.started` | Pipeline run started |
| `pipeline.completed` | Pipeline run completed |
| `pipeline.failed` | Pipeline run failed |
| `sync.started` | Live sync job started |
| `sync.completed` | Live sync job completed |
| `sync.failed` | Live sync job failed |
| `task.created` | Task instance created |
| `task.assigned` | Task assigned |
| `task.submitted` | Task submitted |
| `task.approved` | Task approved |
| `task.rejected` | Task rejected |
| `task.escalated` | Task escalated |
| `sla.breached` | SLA breached |

---

*Document Owner: API Team*  
*Review Cycle: Per Release*  
*Next Review: Sprint Review*