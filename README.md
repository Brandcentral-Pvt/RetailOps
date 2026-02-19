# GMS Report Dashboard - Technical Documentation

A comprehensive Business Intelligence (BI) dashboard for Amazon sellers, featuring OKR tracking, task management, ASIN analytics, and AI-powered goal generation.

---

## 🛠️ System Architecture

The project follows a MERN stack architecture with a clear separation of concerns:
- **Backend**: Node.js/Express.js with MongoDB (Mongoose)
- **Frontend**: React 19 (Vite) with Bootstrap 5 and Tailwind CSS 4
- **Real-time**: Socket.io for notifications and Server-Sent Events (SSE) for task updates
- **AI**: Perplexity (Sonar model) for OKR and task suggestion

---

## 🧪 Function Documentation

### 👤 Authentication & User Management

#### `backend/models/User.js`
- **`comparePassword(candidatePassword)`**: Verifies if the provided password matches the hashed password in the database.
- **`incLoginAttempts()`**: Increments failed login counts and locks the account for 30 minutes after 5 failures.
- **`getPermissions()`**: Retrieves all permissions associated with the user's role.
- **`hasPermission(permissionName)`**: Checks if the user has a specific permission.
- **`hasAnyPermission(permissionNames)`**: Checks if the user has at least one of the specified permissions.

#### `backend/controllers/authController.js`
- **`generateTokens(userId)`**: Generates both Access and Refresh JWT tokens for a user session.
- **`register(req, res)`**: Handles user registration, role assignment (defaulting to 'viewer'), and token generation.
- **`login(req, res)`**: Validates credentials, checks for account locks, and establishes a session.
- **`refreshToken(req, res)`**: Validates a refresh token and issues a new access token.
- **`logout(req, res)`**: Invalidates the user's refresh token.
- **`getMe(req, res)`**: Returns the currently authenticated user's profile and permissions.

#### `backend/controllers/userController.js`
- **`getUsers(req, res)`**: Fetches users with pagination, search, and role filtering.
- **`getUser(req, res)`**: Retrieves a single user with populated role and assigned sellers.
- **`createUser(req, res)`**: Admin-only function to create new users with specific roles and seller access.
- **`updateUser(req, res)`**: Updates user details with hierarchical role checks (prevents low-level users from editing high-level ones).
- **`toggleUserStatus(req, res)`**: Activates or deactivates a user account.
- **`resetUserPassword(req, res)`**: Resets a user's password with administrative oversight.

---

### 📦 ASIN Tracking & Analytics

#### `backend/models/Asin.js`
- **`updateWeekHistory(weekData)`**: Adds or updates a weekly performance snapshot (Price, BSR, LQS). Keeps the last 12 weeks.
- **`getTrends()`**: Calculates week-on-week changes and percentage shifts for all core metrics.

#### `backend/controllers/asinController.js`
- **`getAsins(req, res)`**: Retrieves ASINs with pagination and data isolation (Brand Managers only see their assigned sellers).
- **`getAllAsinsWithHistory(req, res)`**: Special endpoint for dashboard visualizations, returning all ASINs with historical data.
- **`getAsinTrends(req, res)`**: Returns calculated WoW trends for a specific product.
- **`updateWeekHistory(req, res)`**: Manually triggers a week-snapshot update for an ASIN.
- **`getAsinStats(req, res)`**: Aggregates dashboard-level statistics (Avg Price, Avg LQS, Buy Box Won count).
- **`searchAsins(req, res)`**: Performs index-optimized searches across the ASIN catalog.

#### `backend/services/feeCalculationEngine.js`
- **`calculateFBAFee(weight, dimensions, category)`**: Logic for determining Amazon FBA fees based on size tier and product type.
- **`calculateReferralFee(price, category)`**: Determines percentage-based referral fees per category.

---

### 🎯 OKR & Strategic Management

#### `backend/services/ObjectiveService.js`
- **`createObjective(data, user)`**: Handles Objective creation. If marked as `MONTHLY`, it can trigger `generateWeeklyBreakdown`.
- **`generateWeeklyBreakdown(parentObjective, user)`**: Automatically splits a Monthly Objective into 4 Weekly Key Results with default execution tasks.
- **`getObjectivesHierarchy(filter, user)`**: Recursively fetches Objectives -> Key Results -> Actions with strict multi-tenancy isolation.
- **`refreshProgress(objectiveId)`**: Recalculates Objective progress (0-100%) based on the weighted completion of its Key Results.
- **`deleteObjective(id, userId)`**: Cascading delete for an objective and all its descendant KRs and Actions.

#### `backend/controllers/objectiveController.js`
- **`getObjectives(req, res)`**: Main entry point for the OKR tree view, handling complex visibility logic for non-admin users.
- **`createKeyResult(req, res)`**: Adds a measurable Key Result to an existing Objective and refreshes parent progress.
- **`updateKeyResult(req, res)`**: Updates KR metrics and triggers a progress refresh on the parent Objective.

---

### ✅ Action & Task Management

#### `backend/models/Action.js`
- **`startTask()`**: Transitions status to `IN_PROGRESS` and initializes time tracking.
- **`submitForReview(data)`**: Moves task to `REVIEW` stage, captures remarks, and stops the active timer.
- **`completeTask(data)`**: Finalizes the task, updating status to `COMPLETED` and recording final metrics.
- **`reviewTask(reviewerId, decision, comments)`**: Admin function to Approve or Reject a task. Rejection resets the status to `PENDING`.
- **`calculateNextOccurrence()`**: For recurring tasks, determines the next scheduled date based on the set interval.
- **`createRecurringInstance(parentAction)`**: Static method that spawns a new `Action` based on a completed recurring task.

#### `backend/routes/actionRoutes.js` (Route Handlers)
- **`POST /:id/complete`**: Validates task state and calls `action.completeTask()`. Handles recurring logic if enabled.
- **`POST /:id/submit-review`**: Supports multipart/form-data for audio file uploads and transitions task to `REVIEW`.
- **`POST /analyze-asin/:asinId`**: Uses industry logic to suggest relevant optimization tasks for a specific product.
- **`GET /reports/goal-achievement`**: Generates a duration analysis report comparing estimated vs actual task completion times.

---

### 🤖 AI Services

#### `backend/services/AIService.js`
- **`generateOKR(prompt, type, industry)`**: Communicates with Perplexity AI to turn a simple goal (e.g., "Improve electronics sales") into a structured OKR tree.
- **`suggestTasks(context)`**: Generates 5 high-priority improvement tasks based on a specific Objective or Key Result title.
- **`_cleanJSON(text)`**: Helper function to resiliently parse JSON from LLM responses, stripping markdown artifacts.

---

### � Real-time Services

#### `backend/services/socketService.js`
- **`init(server)`**: Initializes the Socket.io instance with CORS configuration.
- **`emitToUser(userId, event, data)`**: Targeted real-time delivery to specific users (e.g., Notifications).
- **`emitToRoom(room, event, data)`**: Broadcasts updates to shared contexts like Task Chats.

#### `backend/services/cometChatService.js`
- **`syncUserToCometChat(user)`**: Syncs MongoDB users to CometChat for messaging.
- **`syncSellerToCometChat(seller)`**: Creates CometChat users for Sellers to enable vendor communication.
- **`sanitizeUid(id)`**: Utility to ensure UIDs are compatible with CometChat's strict format.

---

### �🔗 Frontend Data Layer (`src/services/db.js`)

The `DatabaseService` class acts as the single source for all API interactions.

- **`request(path, options, fallback)`**: Standardized wrapper for `fetch` that handles JWT header injection, 401 redirection, and error logging.
- **`login(email, password)`**: Handles authentication and persists user session to `localStorage`.
- **`getAsins(params)`**: Fetches ASIN data with support for filtering by seller or category.
- **`startAction(id)`**: Triggers the backend task timer.
- **`submitActionForReview(id, formData)`**: Submits task completion data, handling both JSON and multipart (audio) payloads.
- **`reviewAction(id, decision, comments)`**: Submits admin approval/rejection for a task in review.
- **`generateAIOKR(params)`**: Bridge to the backend AI generation endpoint.
- **`getSystemLogs()`**: Fetches administrative activity logs for the audit trail.

---

## �️ Scripts & Utilities

#### Data Synchronization
- **`node backend/scripts/sync_all.js`**: 
  - **Purpose**: Full sync of all Users and Sellers from MongoDB to CometChat.
  - **Usage**: Run manually after bulk database updates or migrations.

#### Data Integrity
- **`node backend/scripts/fix_linkage.js`**: 
  - **Purpose**: Scans and repairs broken relationships between ASINs and Sellers.
  - **Usage**: Run if ASINs disappear from the dashboard.

---

## �🚦 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB v5+

### Installation
1.  **Backend**: `cd backend && npm install`
2.  **Frontend**: `cd gms-dashboard && npm install`

### Run
1.  **Backend**: `npm start` (Runs on port 3001)
2.  **Frontend**: `npm run dev` (Runs on port 5173)

### ⚙️ Environment Variables

Ensure your `.env` file includes the following for full functionality:

```env
# Database
MONGO_URI=mongodb://localhost:27017/easysell

# Authentication
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# AI Service
PERPLEXITY_API_KEY=pplx-xxxxxxxx

# CometChat (Messaging)
COMETCHAT_APP_ID=your_app_id
COMETCHAT_REGION=your_region
COMETCHAT_AUTH_KEY=your_auth_key
COMETCHAT_API_KEY=your_api_key
```

---

## 🔒 Security & RBAC

The system employs a hierarchical Role-Based Access Control system:
- **Level 100 (Admin)**: Full access to all sellers, user management, and task approval.
- **Level 50 (Brand Manager)**: Restricted to assigned sellers. Can create/manage tasks within their scope.
- **Level 10 (Researcher/Assignee)**: Can only see their assigned tasks and progress.

All write operations are guarded by the `protect` and `requirePermission` middlewares in the backend.
