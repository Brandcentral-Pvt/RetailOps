# RetailOps API Endpoint Reference

Generated from source. Two API surfaces exist:

1. **Express backend** (`backend/`, package `gms-backend`) — primary API, port **3001** (default), all routes mounted under `/api`.
2. **.NET API** (`dotnet/RetailOps.Api`, ASP.NET Core) — auth replatforming service.

---

## 1. Conventions (Express)

| Item | Detail |
|---|---|
| Base path | `/api` |
| Global middleware | `helmet`, `cors` (allowlist incl. `*.brandcentral.in`), rate limiter (`READ` tier), HTTPS redirect (prod), payload limits 10MB, `x-request-id` tracing, request guard, maintenance mode (503 when enabled), API-call logger |
| Auth middlewares | `authenticate` / `protect` / `auth` = JWT Bearer; `authenticate: protect` alias mixes; `checkSellerAccess` / `requireTaskAccess` = scoped access; `requireRole('admin' | ...)` = role gate; `requirePermission('x')` & `requireAnyPermission([...])` = RBAC permission gates |
| Rate-limiters | `createLimiter('READ'|'STRICT'|'BULK'|'AUTH')`; per-route `requestOtpLimiter`, `otpLimiter`, `batchLimiter`, `aiLimiter` |
| Validation | `validate('schemaName')` (Joi) |
| Caching | `cacheRoute(key, ttl)` / `invalidateCache(key)` |
| Uploads | `multer` via `upload.single('file')`, `upload.array('files', 20)` |
| Static mounts | `GET /uploads/*` (backend/uploads), `GET /tools/*` (backend/public) |
| Server timeouts | 10 min request / 610s keep-alive / 620s headers (large Octoparse ingests) |

---

## 2. Express Endpoints, by Mount

### 2.1 Health (defined in `server.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/health` | – | inline | DB (SQL Server) + Redis connectivity, memory, uptime, env |
| GET | `/api/health/liveness` | – | inline | Returns alive + uptime (process liveness) |
| GET | `/api/health/readiness` | – | inline | DB ping → 200 ready / 503 not-ready |

### 2.2 Data / Reports — `/api` (`routes/dataRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/master-revenue` | `skureport_view` | `controller.getMasterWithRevenue` | Master data enriched with revenue |
| GET | `/api/chart-data` | `dashboard_view` | `controller.getChartData` | Monthly revenue trend |
| GET | `/api/chart-size-bar` | `dashboard_view` | `controller.getRevenueBySize` | Revenue by size bar |
| GET | `/api/chart-size-pie` | `dashboard_view` | `controller.getSizeShare` | Size share pie |
| GET | `/api/data/ads-report` | `adsreport_view` | `controller.getAdsReport` | Ads report data |
| GET | `/api/data/ads-manager` | `adsreport_view` | `controller.getAdsManagerData` | Ads manager data |
| GET | `/api/data/sku-report` | `skureport_view` | `controller.getSkuReport` | SKU report |
| GET | `/api/data/parent-asin-report` | `parentreport_view` | `controller.getParentAsinReport` | Parent ASIN report |
| GET | `/api/data/month-wise-report` | `monthlyreport_view` | `controller.getMonthWiseReport` | Month-wise report |
| GET | `/api/categories` | – | `controller.getCategories` | Category filter options |
| GET | `/api/search` | – | `controller.globalSearch` | Global search |
| GET | `/api/dashboard` | `dashboard_view` OR `targets_view` | `dashboardController.getDashboardData` | Dashboard aggregate data |

### 2.3 Ads — `/api/ads` (`routes/adsRoutes.js`)

All require `authenticate`; most require `canViewAds`, AI review uses `aiLimiter`.

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/ads/meta` | `controller.getMeta` | Ads module metadata/options |
| GET | `/api/ads/overview` | `controller.getOverview` | Ads overview KPIs |
| GET | `/api/ads/series` | `controller.getSeries` | Time-series data |
| GET | `/api/ads/table` | `controller.getTable` | Tabular ads data |
| GET | `/api/ads/history` | `controller.getHistory` | Historical ads data |
| GET | `/api/ads/filter-options` | `controller.getFilterOptions` | Filter dropdown options |
| GET | `/api/ads/insights` | `controller.getInsights` | AI/derived insights |
| GET | `/api/ads/report` | `controller.getReport` | Generated ads report |
| POST | `/api/ads/ai-review` | `controller.postAiReview` | AI review of ads data |

### 2.4 Tasks — `/api/tasks` (`routes/taskRoutes.js`)

All require `auth`.

| Method | Path | Handler | Description |
|---|---|---|---|
| POST | `/api/tasks/generate` | `generateTasks` | Generate tasks (auto) |
| GET | `/api/tasks` | `getTasks` | List tasks (dashboard Tasks contract) |
| PUT | `/api/tasks/:id/status` | `updateTaskStatus` | Update task status |
| PUT | `/api/tasks/:id/assign` | `assignTask` | Assign task to user |
| DELETE | `/api/tasks/:id` | `deleteTask` | Delete task |

> Owner of `/api/tasks` — mounted before wildcard routers.

### 2.5 Upload — `/api` (`routes/uploadRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| POST | `/api/upload/upload-monthly` | `authenticate`, file | `uploadController.uploadMonthlyData` | Upload monthly data (multipart) |
| POST | `/api/upload/upload-ads` | `adsreport_import`, file | `uploadController.uploadAdsData` | Upload ads report |
| POST | `/api/upload/octoparse` | `authenticate`, file | `uploadController.uploadOctoparseData` | Upload Octoparse scrape |
| GET | `/api/upload/upload-stats` | `authenticate` | `uploadController.getUploadStats` | Upload status/stats |
| POST | `/api/upload/upload-gms` | `gms_tracker_import`, file | `uploadController.uploadGmsData` | Upload GMS tracker data |
| GET | `/api/upload/gms-data` | `gms_tracker_view` | `uploadController.getGmsData` | Get GMS data |
| GET | `/api/upload/gms-asins` | `gms_tracker_view` | `uploadController.getGmsAsins` | Get GMS ASINs |
| POST | `/api/upload/gms-clear` | `gms_tracker_export` | `uploadController.clearGmsData` | Clear GMS data |

### 2.6 Alerts — `/api` (`routes/alertsRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/alerts` | `DASHBOARD_ALERT_PERM` | `alertsController.getAlerts` | List alerts |
| GET | `/api/alerts/count` | `DASHBOARD_ALERT_PERM` | `alertsController.getUnreadAlertCount` | Unread count |
| PATCH | `/api/alerts/:id` | `DASHBOARD_ALERT_PERM` | `alertsController.acknowledgeAlert` | Acknowledge one alert |
| PATCH | `/api/alerts/acknowledge-all` | `DASHBOARD_ALERT_PERM` | `alertsController.acknowledgeAllAlerts` | Acknowledge all alerts |
| GET | `/api/alert-rules` | `rules_view` | `alertsController.getAlertRules` | List alert rules |
| POST | `/api/alert-rules` | `rules_manage` | `alertsController.createAlertRule` | Create alert rule |
| POST | `/api/execute-all-rules` | `rules_manage` | `alertsController.executeAllRules` | Execute all rules manually |
| PATCH | `/api/alert-rules/:id/toggle` | `rules_manage` | `alertsController.toggleAlertRule` | Enable/disable rule |
| POST | `/api/alert-rules/:id/execute` | `rules_manage` | `alertsController.executeRule` | Run one rule |
| GET | `/api/alert-rules/:id` | `rules_view` | `alertsController.getAlertRuleById` | Get one rule |
| PUT | `/api/alert-rules/:id` | `rules_manage` | `alertsController.updateAlertRule` | Update rule |
| DELETE | `/api/alert-rules/:id` | `rules_manage` | `alertsController.deleteAlertRule` | Delete rule |
| GET | `/api/health` | – | inline | Alerts router ping |

### 2.7 Export — `/api/export` (`routes/exportRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| POST | `/api/export/start` | `auth` | `startExport` | Start async export job |
| POST | `/api/export/start-ads` | `adsreport_export` | `startAdsExport` | Start ads export |
| POST | `/api/export/start-gms` | `auth` | `startGmsExport` | Start GMS export |
| GET | `/api/export/downloads` | `auth` | `getDownloads` | List downloads |
| GET | `/api/export/status/:id` | `auth` | `getExportStatus` | Job status |
| GET | `/api/export/download/:id` | `auth` | `downloadFile` | Download export file |
| GET | `/api/export/fields` | `auth` | `getExportFields` | Available export fields |

### 2.8 Rulesets — `/api` (`routes/rulesetRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/rulesets` | `rules_view` | `rulesetController.getAllRulesets` | List rulesets |
| GET | `/api/rulesets/:id` | `rules_view` | `rulesetController.getRulesetById` | Get one ruleset |
| POST | `/api/rulesets` | `rules_manage` | `rulesetController.createRuleset` | Create ruleset |
| PUT | `/api/rulesets/:id` | `rules_manage` | `rulesetController.updateRuleset` | Update ruleset |
| DELETE | `/api/rulesets/:id` | `rules_manage` | `rulesetController.deleteRuleset` | Delete ruleset |
| PATCH | `/api/rulesets/:id/toggle` | `rules_manage` | `rulesetController.toggleRuleset` | Enable/disable |
| POST | `/api/rulesets/:id/execute` | `rules_manage` | `rulesetController.executeRuleset` | Execute ruleset |
| POST | `/api/rulesets/execute-for-asins` | `rules_manage` | `rulesetController.executeAllRulesetsForAsins` | Run rulesets across ASINs |
| POST | `/api/rulesets/:id/preview` | `rules_view` | `rulesetController.previewRuleset` | Dry-run preview |
| GET | `/api/rulesets/:id/history` | `rules_view` | `rulesetController.getRulesetHistory` | Execution history |
| GET | `/api/rulesets/history/:logId` | `rules_view` | `rulesetController.getExecutionDetails` | One execution detail |
| POST | `/api/rulesets/:id/duplicate` | `rules_manage` | `rulesetController.duplicateRuleset` | Duplicate ruleset |

### 2.9 Sellers — `/api/sellers` (`routes/sellerRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/sellers` | `seller_view` | `sellerController.getSellers` | List sellers |
| GET | `/api/sellers/stats` | `seller_view` | `sellerController.getSellerStats` | Seller stats |
| GET | `/api/sellers/:id` | `seller_view` + `checkSellerAccess` | `sellerController.getSeller` | Get seller |
| POST | `/api/sellers` | `seller_manage` | `sellerController.createSeller` | Create seller |
| PUT | `/api/sellers/:id` | `seller_manage` + `checkSellerAccess` | `sellerController.updateSeller` | Update seller |
| DELETE | `/api/sellers/:id` | `seller_manage` + `checkSellerAccess` | `sellerController.deleteSeller` | Delete seller |
| POST | `/api/sellers/import` | `seller_manage` | `sellerController.importSellers` | Bulk import sellers |

### 2.10 ASINs — `/api/asins` (`routes/asinRoutes.js`)

`protect` + ASIN-manager permission gates + occasional `checkSellerAccess`. Merge of `asinController` and `tagController`.

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/asins/health-check/tags` | – | inline | Router ping |
| GET | `/api/asins/:asinId/tags-history` | `asinmanager_view` | `getTagsHistory` | Tag change history |
| GET | `/api/asins/:asinId/tags-summary` | `asinmanager_view` | `getTagsSummary` | Tag summary |
| PUT | `/api/asins/:asinId/tags` | `asinmanager_manage` | `tagController.updateAsinTags` | Update ASIN tags |
| POST | `/api/asins/:id/generate-images` | `asinmanager_manage` | `asinController.generateImages` | Generate images |
| GET | `/api/asins/search` | `asinmanager_view` | `asinController.searchAsins` | Search ASINs |
| GET | `/api/asins/stats` | `asinmanager_view` | `asinController.getAsinStats` | ASIN stats |
| GET | `/api/asins/filters` | `asinmanager_view` | `asinController.getAsinFilterOptions` | Filter options |
| GET | `/api/asins/brands` | `asinmanager_view` | `asinController.getAsinBrands` | Brand list |
| GET | `/api/asins/lqs-top` | `asinmanager_view` | `asinController.getAsinsByLQS` | Top by LQS |
| GET | `/api/asins/parent-view` | `asinmanager_view` | `asinController.getParentView` | Parent ASIN view |
| GET | `/api/asins/parent-view/children/:parentAsin` | `asinmanager_view` | `asinController.getParentChildren` | Children of parent |
| POST | `/api/asins/auto-tags/run` | `asinmanager_manage` | `asinController.runAutoTags` | Run auto-tagging |
| GET | `/api/asins` | `asinmanager_view` | `asinController.getAsins` | List ASINs |
| GET | `/api/asins/all` | `asinmanager_view` | `asinController.getAllAsinsWithHistory` | All ASINs + history |
| GET | `/api/asins/seller/:sellerId` | `asinmanager_view` + `checkSellerAccess` | `asinController.getAsinsBySeller` | ASINs by seller |
| GET | `/api/asins/repair-status/:sellerId` | `asinmanager_view` + `checkSellerAccess` | `asinController.getRepairJobStatus` | Repair job status |
| POST | `/api/asins/repair/:sellerId` | `asinmanager_manage` + `checkSellerAccess` | `asinController.repairIncompleteAsins` | Repair incomplete ASINs |
| GET | `/api/asins/:id/trends` | `asinmanager_view` | `asinController.getAsinTrends` | Trend data |
| GET | `/api/asins/:id/subbsr-trend` | `asinmanager_view` | `asinController.getSubBsrTrend` | Sub-BSR trend |
| PUT | `/api/asins/:id/week-history` | `asinmanager_manage` | `asinController.updateWeekHistory` | Update week history |
| POST | `/api/asins` | `asinmanager_manage` + `checkSellerAccess` | `asinController.createAsin` | Create ASIN |
| POST | `/api/asins/match` | `asinmanager_view` | `asinController.matchAsins` | Match ASINs |
| POST | `/api/asins/bulk` | `asinmanager_manage` + `checkSellerAccess` | `asinController.createAsins` | Bulk create |
| POST | `/api/asins/bulk-delete` | `asinmanager_manage` | `asinController.bulkDeleteAsins` | Bulk delete |
| POST | `/api/asins/bulk-update` | `asinmanager_manage` | `asinController.bulkUpdateAsins` | Bulk update |
| POST | `/api/asins/bulk-week-history` | `asinmanager_manage` | `asinController.bulkUpdateWeekHistory` | Bulk week-history |
| POST | `/api/asins/import-csv` | `asinmanager_import`, file | `asinController.importFromCsv` | CSV import |
| POST | `/api/asins/bulk-upload-all-sellers` | `asinmanager_import`, file | `asinController.bulkUploadAllSellers` | Bulk upload all sellers |
| POST | `/api/asins/recalculate-lqs` | `asinmanager_manage` | `asinController.recalculateLqs` | Recalculate LQS |
| POST | `/api/asins/upload-raw` | `asinmanager_manage` | `asinController.uploadRawAsins` | Upload raw ASIN rows |
| POST | `/api/asins/parse-test` | `asinmanager_manage` | `asinController.testParseRaw` | Test raw parse |
| POST | `/api/asins/export` | `asinmanager_export` | `asinController.exportData` | Export ASIN data |
| GET | `/api/asins/full-export` | `asinmanager_export` | `asinController.fullExport` | Full export |
| GET | `/api/asins/tags` | `asinmanager_view` | `tagController.getTags` | List tags |
| GET | `/api/asins/tags/template` | `asinmanager_view` | `tagController.downloadTagsTemplate` | Tags import template |
| POST | `/api/asins/bulk-tags` | `asinmanager_manage` | `tagController.bulkUpdateTags` | Bulk update tags |
| POST | `/api/asins/tags/bulk` | `asinmanager_import`, file | `tagController.bulkUpdateTagsCSV` | Bulk tags via CSV |
| GET | `/api/asins/predefined-tags` | `asinmanager_view` | `tagController.getPredefinedTags` | Predefined tags |
| POST | `/api/asins/predefined-tags` | `asinmanager_manage` | `tagController.addPredefinedTag` | Add predefined tag |
| PUT | `/api/asins/predefined-tags/:id` | `asinmanager_manage` | `tagController.updatePredefinedTag` | Update predefined tag |
| DELETE | `/api/asins/predefined-tags/:id` | `asinmanager_manage` | `tagController.deletePredefinedTag` | Delete predefined tag |
| GET | `/api/asins/:id` | `asinmanager_view` | `asinController.getAsin` | Get ASIN |
| PUT | `/api/asins/:id` | `asinmanager_manage` | `asinController.updateAsin` | Update ASIN |
| DELETE | `/api/asins/:id` | `asinmanager_manage` | `asinController.deleteAsin` | Delete ASIN |

> Route-ordering note: static segments (`/stats`, `/search`, `/filters`, `/brands`, `/tags`, `/all`, `/seller/:sellerId`, ...) are declared before `/:id` so they are not swallowed.

### 2.11 Auth — `/api/auth` (`routes/authRoutes.js`) — rate-limited AUTH tier

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | – | inline | **Disabled** — returns 403 |
| POST | `/api/auth/login` | – | `authController.login` | Email/password login |
| POST | `/api/auth/request-otp` | `requestOtpLimiter` | `authController.requestOtp` | Request OTP |
| POST | `/api/auth/verify-otp` | `otpLimiter` | `authController.verifyOtp` | Verify OTP + login |
| POST | `/api/auth/resend-otp` | `otpLimiter` | `authController.resendOtp` | Resend OTP |
| POST | `/api/auth/refresh-token` | – | `authController.refreshToken` | Rotate tokens |
| POST | `/api/auth/logout` | `authenticate` | `authController.logout` | Logout / invalidate |
| GET | `/api/auth/me` | `authenticate` | `authController.getMe` | Current user profile |
| PUT | `/api/auth/profile` | `authenticate` | `authController.updateProfile` | Update profile |
| POST | `/api/auth/request-password-change` | `authenticate` | `authController.requestPasswordChange` | Request password change |
| PUT | `/api/auth/change-password` | `authenticate` | `authController.changePassword` | Change password |
| PUT | `/api/auth/change-password-with-otp` | `authenticate` | `authController.changePasswordWithOtp` | Password change w/ OTP |
| POST | `/api/auth/forgot-password` | – | `authController.forgotPassword` | Initiate reset |
| GET | `/api/auth/validate-reset-token` | – | `authController.validateResetToken` | Validate reset token |
| POST | `/api/auth/reset-password` | – | `authController.resetPassword` | Complete reset |

### 2.12 Users — `/api/users` (`routes/userRoutes.js`) — strict limiter

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/users/roles` | `authenticate` | `userController.getAvailableRoles` | Assignable roles |
| GET | `/api/users/sellers` | `authenticate` | `userController.getSellersForAssignment` | Sellers for assignment |
| GET | `/api/users/managers` | `authenticate` | `userController.getManagers` | Manager list |
| GET | `/api/users/permissions` | `authenticate` | `userController.getGroupedPermissions` | Grouped RBAC permissions |
| GET | `/api/users` | `users_view` | `userController.getUsers` | List users |
| POST | `/api/users` | `users_manage` | `userController.createUser` | Create user |
| GET | `/api/users/:id` | `authenticate` | `userController.getUser` | Get user |
| PUT | `/api/users/:id` | `users_manage` | `userController.updateUser` | Update user |
| DELETE | `/api/users/:id` | `users_manage` | `userController.deleteUser` | Delete user |
| PUT | `/api/users/:id/toggle-status` | `users_manage` | `userController.toggleUserStatus` | Activate/deactivate |
| PUT | `/api/users/:id/reset-password` | `users_manage` | `userController.resetUserPassword` | Admin password reset |
| POST | `/api/users/:id/force-password-reset` | `users_manage` | `userController.forcePasswordReset` | Force reset flag |
| POST | `/api/users/send-email` | `users_manage` | `userController.sendEmailToUser` | Email a user |
| POST | `/api/users/:id/send-credentials` | `users_manage` | `userController.sendCredentials` | Email credentials |

### 2.13 Roles — `/api/roles` (`routes/roleRoutes.js`) — strict limiter

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/roles` | `roles_view` | `roleController.getRoles` | List roles |
| GET | `/api/roles/permissions` | `roles_view` | `roleController.getPermissions` | List permissions |
| GET | `/api/roles/:id` | `roles_view` | `roleController.getRole` | Get role |
| POST | `/api/roles` | `roles_create` | `roleController.createRole` | Create role |
| PUT | `/api/roles/:id` | `roles_edit` | `roleController.updateRole` | Update role |
| DELETE | `/api/roles/:id` | `roles_delete` | `roleController.deleteRole` | Delete role |
| POST | `/api/roles/seed` | `roles_edit` | `roleController.seedRolesAndPermissions` | Seed default roles |

### 2.14 Seed — `/api/seed` (`routes/seedRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/seed/dashboard` | `authenticate` | `seedController.getDashboardSummary` | Seed status summary |
| POST | `/api/seed/seed-all` | `authenticate` | `seedController.seedAll` | Seed all demo data |

### 2.15 Revenue Calculator — `/api/revenue` (`routes/revenueCalculatorRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| POST | `/api/revenue/auth/login` | – | `authController.login` | Calculator login |
| GET | `/api/revenue/fees/:type` | `calculator_view` | inline | Get fee table by type |
| POST | `/api/revenue/fees/:type` | `calculator_manage` | inline | Create fee entry |
| DELETE | `/api/revenue/fees/:type/:id` | `calculator_manage` | inline | Delete fee entry |
| GET | `/api/revenue/mappings` | `calculator_view` | inline | Get category mappings |
| POST | `/api/revenue/mappings` | `calculator_manage` | inline | Create/update mapping |
| GET | `/api/revenue/nodemaps` | `calculator_view` | inline | Node maps |
| GET | `/api/revenue/asins` | `calculator_view` | inline | Calculator ASINs |
| POST | `/api/revenue/asins/bulk` | `calculator_manage` | inline | Bulk load ASINs |
| DELETE | `/api/revenue/asins/:id` | `calculator_manage` | inline | Remove ASIN |
| GET | `/api/revenue/health` | – | inline | Router ping |
| POST | `/api/revenue/calculate` | `calculator_manage` | inline | Run revenue calculation |

### 2.16 Actions — `/api/actions` (`routes/actionRoutes.js`) — includes SSE stream

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/actions` | `actions_view`/`actions_manage` | `actionController.getActions` | List actions |
| POST | `/api/actions` | `actions_create`/`actions_manage` | `actionController.createAction` | Create action |
| GET | `/api/actions/templates` | `protect` | `actionController.getTemplates` | Action templates |
| POST | `/api/actions/templates` | `actions_manage` | `actionController.createTemplate` | Create template |
| PUT | `/api/actions/templates/:id` | `actions_manage` | `actionController.updateTemplate` | Update template |
| DELETE | `/api/actions/templates/:id` | `actions_manage` | `actionController.deleteTemplate` | Delete template |
| GET | `/api/actions/goal-templates` | `protect` | `actionController.getGoalTemplates` | Goal templates |
| POST | `/api/actions/goal-templates` | `actions_manage` | `actionController.createGoalTemplate` | Create goal template |
| PUT | `/api/actions/goal-templates/:id` | `actions_manage` | `actionController.updateGoalTemplate` | Update goal template |
| DELETE | `/api/actions/goal-templates/:id` | `actions_manage` | `actionController.deleteGoalTemplate` | Delete goal template |
| POST | `/api/actions/bulk-from-analysis` | `actions_create`/`actions_manage` | `actionController.bulkCreateFromAnalysis` | Bulk actions from analysis |
| POST | `/api/actions/bulk` | `actions_create`/`actions_manage` | inline | Bulk create actions |
| GET | `/api/actions/stream` | `protect` | inline | **SSE** live action stream |
| DELETE | `/api/actions/bulk-delete-all` | `admin` | inline | Delete all actions |
| POST | `/api/actions/:id/start` | `actions_edit`/`actions_manage` | inline | Start action |
| POST | `/api/actions/:id/submit-review` | `actions_edit`/`actions_manage` + `upload.single('audio')` | inline | Submit review w/ audio |
| POST | `/api/actions/:id/review-action` | `admin`/`super_admin`/`developer`/`operational_manager` | inline | Review action |
| DELETE | `/api/actions/:id` | `admin` | inline | Delete action |
| POST | `/api/actions/analyze-asin/:asinId` | `actions_create`/`actions_manage` | inline | Analyze ASIN for actions |
| POST | `/api/actions/ai-listing-analysis/:asinId` | `actions_create`/`actions_manage` | inline | AI listing analysis |
| POST | `/api/actions/create-from-analysis/:asinId` | `actions_create`/`actions_manage` | inline | Create actions from analysis |
| POST | `/api/actions/:id/subtasks/:subIdx/complete` | `actions_edit`/`actions_manage` | inline | Complete subtask |
| POST | `/api/actions/:id/complete` | `actions_edit`/`actions_manage` | inline | Complete action |
| POST | `/api/actions/:id/upload-audio` | `actions_edit`/`actions_manage` + `upload.single('audio')` | inline | Attach audio note |
| GET | `/api/actions/:id/history` | `protect` | inline | Action history |
| GET | `/api/actions/reports/overdue` | `actions_view`/`actions_manage` | inline | Overdue report |
| GET | `/api/actions/reports/by-stage` | `actions_view`/`actions_manage` | inline | By-stage report |
| GET | `/api/actions/reports/goal-achievement` | `actions_view`/`actions_manage` | inline | Goal achievement report |
| GET | `/api/actions/:id/instructions` | `protect` | `actionController.getActionInstructions` | Action instructions |
| GET | `/api/actions/:id` | `protect` | `actionController.getAction` | Get action |
| PUT | `/api/actions/:id` | `protect` | `actionController.updateAction` | Update action |
| DELETE | `/api/actions/:id` | `admin` | `actionController.deleteAction` | Delete action |

> Note: `/stream` (SSE) is declared before `/:id/...` routes; static report segments before `/:id`.

### 2.17 Files — `/api/files` (`routes/fileRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| POST | `/api/files/upload` | `authenticate`, `upload.array('files', 20)` | `fileController.uploadFiles` | Upload files (≤20) |
| GET | `/api/files` | `authenticate` | `fileController.listFiles` | List files |
| GET | `/api/files/asin-folders` | `authenticate` | `fileController.listAsinFolders` | ASIN folders |
| GET | `/api/files/asin-folders/:asin` | `authenticate` | `fileController.getAsinFiles` | Files in ASIN folder |
| PATCH | `/api/files/:id/star` | `authenticate` | `fileController.toggleStar` | Star/unstar |
| PATCH | `/api/files/:id/trash` | `authenticate` | `fileController.trashFile` | Move to trash |
| PATCH | `/api/files/:id/rename` | `authenticate` | `fileController.renameFile` | Rename |
| DELETE | `/api/files/:id` | `authenticate` | `fileController.deleteFile` | Delete |

### 2.18 API Keys — `/api/keys` (`routes/apiKeyRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/keys` | – | `apiKeyController.getKeys` | List keys |
| POST | `/api/keys` | – | `apiKeyController.createKey` | Create key |
| PUT | `/api/keys/:id` | – | `apiKeyController.updateKey` | Update key |
| DELETE | `/api/keys/:id` | – | `apiKeyController.deleteKey` | Delete key |
| GET | `/api/keys/:id/reveal` | – | `apiKeyController.revealKey` | Reveal plaintext key |

### 2.19 Teams — `/api/teams` (`routes/teamRoutes.js`) — `router.use(authenticate)`

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/teams` | `getTeams` | List teams |
| POST | `/api/teams` | `createTeam` | Create team |
| PUT | `/api/teams/:id` | `updateTeam` | Update team |
| DELETE | `/api/teams/:id` | `deleteTeam` | Delete team |
| GET | `/api/teams/:id/members` | `getTeamMembers` | Team members |
| POST | `/api/teams/:id/members` | `addMember` | Add member |
| PUT | `/api/teams/:id/members/:userId` | `updateMember` | Update member role |
| DELETE | `/api/teams/:id/members/:userId` | `removeMember` | Remove member |

### 2.20 Objectives — `/api/objectives` (`routes/objectiveRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| DELETE | `/api/objectives/bulk-delete-all` | `admin` | `objectiveController.deleteAllObjectives` | Delete all objectives |
| POST | `/api/objectives` | – | `objectiveController.createObjective` | Create objective |
| GET | `/api/objectives` | – | `objectiveController.getObjectives` | List objectives |
| PUT | `/api/objectives/:id` | – | `objectiveController.updateObjective` | Update objective |
| DELETE | `/api/objectives/:id` | – | `objectiveController.deleteObjective` | Delete objective |
| POST | `/api/objectives/key-results` | `protect` | `objectiveController.createKeyResult` | Create key result |
| PUT | `/api/objectives/key-results/:id` | `protect` | `objectiveController.updateKeyResult` | Update key result |
| DELETE | `/api/objectives/key-results/:id` | `protect` | `objectiveController.deleteKeyResult` | Delete key result |
| POST | `/api/objectives/key-results/:id/sync` | `protect` | `objectiveController.syncKeyResult` | Sync key result |
| GET | `/api/objectives/overview` | – | `tasksPageController.getOverview` | Tasks overview |

### 2.21 Notifications — `/api/notifications` (`routes/notificationRoutes.js`) — `protect`

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/notifications` | `notificationController.getNotifications` | List notifications |
| PUT | `/api/notifications/read` | `notificationController.markAsRead` | Mark all read |
| DELETE | `/api/notifications/:id` | `notificationController.deleteNotification` | Delete notification |

### 2.22 Chat — `/api/chat` (`routes/chatRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| POST | `/api/chat/webhook` | – | `chatWebhookController.handleCometChatWebhook` | CometChat webhook |
| GET | `/api/chat/users` | `authenticate` | `chatController.getUsersForChat` | Chat-able users |
| GET | `/api/chat/sellers` | `authenticate` | `chatController.getSellersForChat` | Chat-able sellers |
| GET | `/api/chat/conversations` | `authenticate` | `chatController.getConversations` | List conversations |
| POST | `/api/chat/conversations` | `authenticate` | `chatController.getOrCreateConversation` | Get-or-create conversation |
| GET | `/api/chat/messages/:conversationId` | `authenticate` | `chatController.getMessages` | Messages of conversation |
| POST | `/api/chat/messages/:conversationId/read` | `authenticate` | `chatController.markAsRead` | Mark conversation read |
| POST | `/api/chat/upload` | `authenticate`, chat upload mw | `chatUploadController.uploadChatFile` | Upload chat file |
| POST | `/api/chat/send` | `authenticate` | `chatController.sendMessage` | Send message |
| GET | `/api/chat/search` | `authenticate` | `chatController.searchMessages` | Search messages |
| PUT | `/api/chat/messages/:messageId` | `authenticate` | `chatController.editMessage` | Edit message |
| DELETE | `/api/chat/messages/:messageId` | `authenticate` | `chatController.deleteMessage` | Delete message |
| PUT | `/api/chat/messages/:messageId/pin` | `authenticate` | `chatController.togglePinMessage` | Pin/unpin |
| POST | `/api/chat/messages/forward` | `authenticate` | `chatController.forwardMessage` | Forward message |
| GET | `/api/chat/messages/:messageId/receipts` | `authenticate` | `chatController.getMessageReadReceipts` | Read receipts |
| GET | `/api/chat/link-preview` | `authenticate` | `chatController.getLinkPreview` | Link preview |
| POST | `/api/chat/messages/:messageId/vote` | `authenticate` | `chatController.votePoll` | Vote on poll |
| POST | `/api/chat/messages/poll` | `authenticate` | `chatController.createPoll` | Create poll |
| POST | `/api/chat/groups` | `authenticate` | `chatController.createGroup` | Create group |
| POST | `/api/chat/groups/:conversationId/members` | `authenticate` | `chatController.addGroupMembers` | Add members |
| POST | `/api/chat/groups/:conversationId/members/remove` | `authenticate` | `chatController.removeGroupMember` | Remove member |
| PUT | `/api/chat/groups/:conversationId/role` | `authenticate` | `chatController.updateMemberRole` | Change member role |
| GET | `/api/chat/groups/:conversationId/media` | `authenticate` | `chatController.getSharedMedia` | Shared media |

### 2.23 Market Sync (Octoparse) — `/api/market-sync` (`routes/marketDataSyncRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/market-sync/status` | `authenticate` | `marketSyncController.getSyncStatus` | Global sync status |
| GET | `/api/market-sync/sync/status/:sellerId` | `authenticate` + `checkSellerAccess` | `marketSyncController.getSellerSyncStatus` | Seller sync status |
| POST | `/api/market-sync/sync/live/:sellerId` | `scraping_manage` + `checkSellerAccess` | `marketSyncController.triggerLiveSync` | Trigger live sync |
| GET | `/api/market-sync/ping` | – | inline | Router ping |
| POST | `/api/market-sync/sync/:id` | `scraping_manage` | `marketSyncController.syncAsin` | Sync one ASIN |
| POST | `/api/market-sync/sync-all` | `scraping_manage` | `marketSyncController.syncAllAsins` | Sync all ASINs |
| POST | `/api/market-sync/sync-all/:sellerId` | `scraping_manage` + `checkSellerAccess` | `marketSyncController.syncSellerAsins` | Sync seller ASINs |
| POST | `/api/market-sync/fetch-results/:sellerId` | `scraping_manage` + `checkSellerAccess` | `marketSyncController.fetchAndApplyResults` | Fetch + apply results |
| POST | `/api/market-sync/ingest-task` | `scraping_manage` | `marketSyncController.ingestTaskResults` | Ingest task results |
| POST | `/api/market-sync/ingest-all` | `scraping_manage` | `marketSyncController.syncAllSellersResults` | Ingest all sellers |
| POST | `/api/market-sync/setup-task/:sellerId` | `scraping_manage` + `checkSellerAccess` | `marketSyncController.setupSellerTask` | Setup Octoparse task |
| POST | `/api/market-sync/update` | `scraping_manage` | `marketSyncController.handleSyncComplete` | Handle sync completion |
| GET | `/api/market-sync/pool-status` | `scraping_manage` | `marketSyncController.getPoolStatus` | Task pool status |
| POST | `/api/market-sync/pool-tasks` | `scraping_manage` | `marketSyncController.uploadTaskPool` | Upload task pool |
| POST | `/api/market-sync/sync-pool` | `scraping_manage` | `marketSyncController.syncTaskPool` | Sync task pool |
| GET | `/api/market-sync/tasks` | `scraping_view` | `marketSyncController.getGlobalSyncTasks` | Global sync tasks |
| POST | `/api/market-sync/bulk-update-tasks` | `scraping_manage` | `marketSyncController.bulkUpdateSellerTasks` | Bulk update seller tasks |
| POST | `/api/market-sync/bulk-inject-asins` | `scraping_manage` | `marketSyncController.bulkInjectAsinsToTasks` | Bulk inject ASINs |
| POST | `/api/market-sync/start-task/:sellerId` | `scraping_manage` + `checkSellerAccess` | `marketSyncController.startTask` | Start seller task |
| POST | `/api/market-sync/bulk-inject-json` | `scraping_manage` | `marketSyncController.bulkInjectJson` | Bulk inject JSON |
| POST | `/api/market-sync/repair` | `scraping_manage` | `marketSyncController.triggerRepair` | Trigger repair |
| POST | `/api/market-sync/sync-all-live` | `scraping_manage` | `marketSyncController.syncAllLiveSync` | Sync all live |
| GET | `/api/market-sync/sync-all-live/status` | `scraping_manage` | `marketSyncController.getGlobalLiveSyncStatus` | Global live-sync status |
| POST | `/api/market-sync/restart-all` | `scraping_manage` | `marketSyncController.restartAllOctoparseTasks` | Restart all Octoparse tasks |

### 2.24 Live Data — `/api/live-data` (`routes/pems/liveDataRoutes.js`) — `auth`

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/live-data/metrics` | `ctrl.getMetrics` | Live-data metrics |
| POST | `/api/live-data/fetch` | `ctrl.fetchLiveData` | Fetch live data job (v1) |
| POST | `/api/live-data/upload` | `upload.single('file')` → `ctrl.uploadAndProcess` | Upload + process (v1) |
| GET | `/api/live-data/progress/:jobId` | `ctrl.getProgress` | Job progress |
| GET | `/api/live-data/results/:jobId` | `ctrl.getResults` | Job results |
| GET | `/api/live-data/download/:jobId` | `ctrl.downloadResults` | Download results |
| POST | `/api/live-data/cancel/:jobId` | `ctrl.cancelJob` | Cancel job |
| GET | `/api/live-data/creds-stats` | inline | Credentials pool stats |
| POST | `/api/live-data/v2/fetch` | `ctrl.fetchLiveDataV2` | Fetch live data (v2) |
| POST | `/api/live-data/v2/upload` | `upload.single('file')` → `ctrl.uploadAndProcessV2` | Upload + process (v2) |
| GET | `/api/live-data/v2/progress/:jobId` | `ctrl.getProgressV2` | Job progress (v2) |
| GET | `/api/live-data/v2/results/:jobId` | `ctrl.getResultsV2` | Job results (v2) |
| GET | `/api/live-data/v2/download/:jobId` | `ctrl.downloadResultsV2` | Download results (v2) |
| POST | `/api/live-data/v2/cancel/:jobId` | `ctrl.cancelJobV2` | Cancel job (v2) |

> Dead code note: the same v1 paths are registered a second time with `ctrl.disabledV1`; because Express matches first-registration-first, the active handlers (above) win and the `disabledV1` duplicates are unreachable.

### 2.25 Scraper — `/api/scraper` (`routes/scraperRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/scraper/health` | – | inline | Router ping |
| POST | `/api/scraper/test` | `scraping_manage` | inline | Connectivity test |
| POST | `/api/scraper/scrape/start` | `scraping_manage` + `checkSellerAccess` | inline | Start scrape job |
| POST | `/api/scraper/scrape/start-bulk` | `scraping_manage` | inline | Bulk scrape start |
| GET | `/api/scraper/scrape/status/:jobId` | `scraping_view` | inline | Job status |
| POST | `/api/scraper/scrape/cancel/:jobId` | `scraping_manage` | inline | Cancel job |
| POST | `/api/scraper/scrape/retry/:jobId` | `scraping_manage` | inline | Retry job |
| GET | `/api/scraper/jobs` | `scraping_view` | inline | List jobs |
| GET | `/api/scraper/jobs/:jobId/details` | `scraping_view` | inline | Job details |
| GET | `/api/scraper/stats` | `scraping_view` | inline | Scraper stats |
| GET | `/api/scraper/sellers/summary` | `scraping_view` | inline | Seller summary |
| POST | `/api/scraper/sync-seller/:sellerId` | `scraping_manage` + `checkSellerAccess` | inline | Sync seller |
| GET | `/api/scraper/sync-status/:sellerId` | `scraping_view` + `checkSellerAccess` | inline | Sync status |

### 2.26 System Logs — `/api/logs` (`routes/systemLogRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/logs` | – | `systemLogController.getLogs` | Query system logs |

> Note: `GET /api/logs` has no inline auth guard on the route itself — confirm access policy in the controller.

### 2.27 Security — `/api/security` (`routes/securityRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/security/otp-logs` | `authenticate` | inline | OTP audit logs |
| GET | `/api/security/trusted-devices` | `authenticate` | inline | Trusted devices |
| DELETE | `/api/security/trusted-devices/all` | `authenticate` | inline | Clear all devices |
| DELETE | `/api/security/trusted-devices/:deviceId` | `authenticate` | inline | Remove device |

### 2.28 Setup Wizard — `/api/setup-wizard` (`routes/setupWizardRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/setup-wizard/status` | `authenticate` | `setupWizardController.getStatus` | Wizard progress |
| POST | `/api/setup-wizard/step/:stepName/complete` | `authenticate` | `setupWizardController.completeStep` | Complete a step |
| POST | `/api/setup-wizard/password` | `authenticate` | `setupWizardController.changePassword` | Set password |
| POST | `/api/setup-wizard/complete` | `authenticate` | `setupWizardController.completeWizard` | Finish wizard |

### 2.29 Settings — `/api/settings` (`routes/systemSettingRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/settings` | `auth` | `systemSettingController.getSettings` | All settings |
| GET | `/api/settings/schedule-config` | `auth` | `systemSettingController.getScheduleConfig` | Schedule config |
| GET | `/api/settings/octoparse-automation` | `auth` | `systemSettingController.getOctoparseAutomation` | Automation flag |
| POST | `/api/settings/octoparse-automation` | `isAdmin` | `systemSettingController.toggleOctoparseAutomation` | Toggle automation |
| GET | `/api/settings/:key` | `auth` | `systemSettingController.getSettingByKey` | One setting |
| POST | `/api/settings/update` | `isAdmin` | `systemSettingController.updateSettings` | Update settings |
| POST | `/api/settings/test-email` | `isAdmin` | `systemSettingController.testEmail` | Send test email |

### 2.30 AI / Strategy — `/api/strategy` (`routes/aiRoutes.js`) — `authenticate`

| Method | Path | Handler | Description |
|---|---|---|---|
| POST | `/api/strategy/goals/ai-preview` | `aiGoalController.getPreview` | AI goal preview |
| POST | `/api/strategy/goals/ai-create` | `aiGoalController.createFullStrategy` | AI full strategy |
| POST | `/api/strategy/tasks/ai-create` | `aiTaskController.createEnrichedTask` | AI-enriched task |
| POST | `/api/strategy/generate-recovery-tasks` | `aiTaskController.generateRecoveryTasks` | Auto recovery tasks |
| POST | `/api/strategy/product/analyze-image` | inline | AI image analysis |
| POST | `/api/strategy/product/analyze-listing` | inline | AI listing analysis |
| POST | `/api/strategy/product/analyze-pricing` | inline | AI pricing analysis |
| POST | `/api/strategy/product/analyze-inventory` | inline | AI inventory analysis |
| POST | `/api/strategy/product/audit-image/:asinId` | inline | AI image audit |
| POST | `/api/strategy/product/batch-audit-images` | inline | Batch image audit |

### 2.31 Seller Tracker — `/api/seller-tracker` (`routes/sellerAsinTrackerRoutes.js`)

Permission gates: `sellers_view` OR `sellers_manage` (reads), `sellers_manage` / `sellers_manage_asins` (writes).

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/seller-tracker` | `ctrl.getTrackerList` | Tracker list |
| GET | `/api/seller-tracker/:sellerId/asins` | `ctrl.getSellerAsins` | Seller ASINs |
| GET | `/api/seller-tracker/:sellerId/inventory-status` | inline | Inventory status |
| POST | `/api/seller-tracker/inventory/sync` | inline | Sync all inventory |
| POST | `/api/seller-tracker/inventory/sync/:sellerId` | inline | Sync seller inventory |
| GET | `/api/seller-tracker/inventory/token-status` | inline | Token status |
| POST | `/api/seller-tracker/sync/:sellerId` | `ctrl.syncSeller` | Sync seller data |
| POST | `/api/seller-tracker/sync-all` | `ctrl.syncAll` | Sync all sellers |
| GET | `/api/seller-tracker/:sellerId/activities` | `ctrl.getSellerActivities` | Seller activities |
| GET | `/api/seller-tracker/:sellerId/tasks` | `ctrl.getSellerTasks` | Seller tasks |
| POST | `/api/seller-tracker/:sellerId/tasks` | `ctrl.createSellerTask` | Create seller task |

### 2.32 Revenue Engine — `/api/revenue-engine` (`routes/revenueRoutes.js`) — `protect`

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/revenue-engine/summary` | `revenueController.getSummary` | Revenue summary. Query: `asin`, `startDate`, `endDate`, optional `month`, `period` |

### 2.33 Goals — `/api/goals` (`routes/goalRoutes.js`) — `protect`

| Method | Path | Handler | Description |
|---|---|---|---|
| POST | `/api/goals` | `goalController.createGoal` | Create + auto-attach goal |
| GET | `/api/goals/:id/progress` | `goalController.getProgress` | Get/refresh progress |
| GET | `/api/goals` | `goalController.getGoals` | List goals |
| GET | `/api/goals/brand/:brandId` | `goalController.getBrandGoals` | Goals by brand |

### 2.34 ASIN Table — `/api/asins-table` (`routes/asinTableRoutes.js`) — `protect`

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/asins-table` | `asinTableController.getAsinTable` | ASIN table data |

### 2.35 Listing Quality — `/api/listing-quality` (`routes/listingQualityRoutes.js`) — `router.use(authenticate)`

| Method | Path | Handler | Description |
|---|---|---|---|
| POST | `/api/listing-quality/analyze/:asinId` | `listingQualityController.analyzeAsin` | Analyze listing quality |
| POST | `/api/listing-quality/analyze-batch` | `listingQualityController.analyzeBatch` | Batch quality analysis |
| POST | `/api/listing-quality/analyze-title/:asinId` | `analyzeAsin` (title focus) | Title quality |
| POST | `/api/listing-quality/analyze-bullets/:asinId` | `analyzeAsin` (bullets focus) | Bullets quality |
| POST | `/api/listing-quality/analyze-images/:asinId` | `analyzeAsin` (images focus) | Images quality |
| POST | `/api/listing-quality/analyze-description/:asinId` | `analyzeAsin` (description focus) | Description quality |
| POST | `/api/listing-quality/analyze-titles-batch` | `analyzeBatch` | Batch titles |
| POST | `/api/listing-quality/analyze-bullets-batch` | `analyzeBatch` | Batch bullets |
| POST | `/api/listing-quality/analyze-images-batch` | `analyzeBatch` | Batch images |
| POST | `/api/listing-quality/analyze-descriptions-batch` | `analyzeBatch` | Batch descriptions |
| GET | `/api/listing-quality/analysis/:asinId` | `listingQualityController.getAnalysis` | Get stored analysis |
| GET | `/api/listing-quality/title/:asinId` | `getAnalysis` (back-compat) | Alias of analysis |

### 2.36 Bulk — `/api/bulk` (`routes/bulkRoutes.js`) — `protect` + BULK rate tier, multer file

| Method | Path | Handler | Description |
|---|---|---|---|
| POST | `/api/bulk/catalog-sync` | `catalogSync` | Catalog sync from file |
| POST | `/api/bulk/ajio-catalog-sync` | `ajioBulkImport` | Ajio catalog import |
| POST | `/api/bulk/tags-import` | `tagsImport` | Tags import from file |
| POST | `/api/bulk/octoparse-json` | `octoparseJsonUpload` | OCToparse JSON ingest |
| GET | `/api/bulk/catalog-template` | `downloadCatalogTemplate` | Download import template |

### 2.37 Scheduled Runs — `/api/scheduled-runs` (`routes/scheduledRunRoutes.js`) — `protect`

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/scheduled-runs` | `ScheduledRunController.getScheduledRuns` | List scheduled runs |
| GET | `/api/scheduled-runs/seller-logs/:sellerId` | `getSellerLogs` | Seller run logs |
| GET | `/api/scheduled-runs/seller-metrics` | `getSellerMetrics` | Seller metrics |
| GET | `/api/scheduled-runs/:id` | `getScheduledRunDetails` | Run details |
| POST | `/api/scheduled-runs/trigger` | `triggerScheduledRun` | Trigger a run |

### 2.38 Targets — `/api/targets` (`routes/targetRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/targets` | `targets_view` | `controller.getTargets` | List targets |
| POST | `/api/targets` | `targets_create` | `controller.createTargets` | Create targets |
| PUT | `/api/targets` | `targets_edit` | `controller.updateTarget` | Update targets |
| PUT | `/api/targets/achievements` | `targets_edit` | `controller.updateAchievements` | Update achievements |
| POST | `/api/targets/import-achievements` | `targets_create` | `controller.importAchievements` | Import achievements |
| DELETE | `/api/targets/bulk` | `targets_delete` | `controller.deleteTargetsBulk` | Bulk delete |
| DELETE | `/api/targets/:id` | `targets_delete` | `controller.deleteTarget` | Delete target |

### 2.39 Webhooks — `/api/webhooks` (`routes/webhookRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/webhooks/events` | `dashboard_view` | `webhookController.getEventTypes` | Event types |
| GET | `/api/webhooks/logs` | `dashboard_view` | `webhookController.getWebhookLogs` | Delivery logs |
| GET | `/api/webhooks` | `dashboard_view` | `webhookController.getWebhooks` | List webhooks |
| POST | `/api/webhooks` | `rules_manage` | `webhookController.createWebhook` | Create webhook |
| POST | `/api/webhooks/:id/test` | `rules_manage` | `webhookController.testWebhookById` | Test delivery |
| PUT | `/api/webhooks/:id` | `rules_manage` | `webhookController.updateWebhook` | Update webhook |
| DELETE | `/api/webhooks/:id` | `rules_manage` | `webhookController.deleteWebhook` | Delete webhook |

### 2.40 PEMS — `/api/pems` (`routes/pems/pemsRoutes.js`) — `auth`

Additional gates: `tasks_manage` (template & assignment write), `requireTaskAccess` (instance/subtask/evidence/review), `cacheRoute`/`invalidateCache` on many.

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/pems/templates` | `ctrl.getTemplates` | List PEMS templates |
| GET | `/api/pems/templates/filters` | `ctrl.getFilterOptions` | Template filters |
| GET | `/api/pems/templates/:id` | `ctrl.getTemplateById` | Template by id |
| POST | `/api/pems/templates` | `ctrl.createTemplate` | Create template |
| PUT | `/api/pems/templates/:id` | `ctrl.updateTemplate` | Update template |
| DELETE | `/api/pems/templates/:id` | `ctrl.deleteTemplate` | Delete template |
| GET | `/api/pems/instances` | `ctrl.getInstances` | List instances |
| GET | `/api/pems/instances/:id` | `ctrl.getInstanceById` | Instance by id |
| POST | `/api/pems/instances` | `ctrl.createInstance` | Create instance |
| POST | `/api/pems/instances/bulk/transition` | `ctrl.bulkTransition` | Bulk status transition |
| POST | `/api/pems/instances/:id/transition` | `ctrl.transitionStatus` | Transition status |
| PUT | `/api/pems/instances/:id/achievement` | `ctrl.updateAchievement` | Update achievement |
| POST | `/api/pems/subtasks/:subTaskId/complete` | `ctrl.completeSubTask` | Complete subtask |
| POST | `/api/pems/activities/:activityId/complete` | `ctrl.completeActivity` | Complete activity |
| POST | `/api/pems/evidence` | `ctrl.uploadEvidence` | Upload evidence |
| POST | `/api/pems/reviews` | `ctrl.submitReview` | Submit review |
| GET | `/api/pems/dashboard/kpis` | `ctrl.getDashboardKPIs` | Dashboard KPIs |
| GET | `/api/pems/dashboard/seller-performance` | `ctrl.getSellerPerformance` | Seller performance |
| GET | `/api/pems/dashboard/department-performance` | `ctrl.getDepartmentPerformance` | Department performance |
| GET | `/api/pems/dashboard/brand-manager-performance` | `ctrl.getBrandManagerPerformance` | Brand manager perf |
| GET | `/api/pems/dashboard/reviewer-performance` | `ctrl.getReviewerPerformance` | Reviewer performance |
| GET | `/api/pems/dashboard/risk-panel` | `ctrl.getRiskPanel` | Risk panel |
| GET | `/api/pems/dashboard/top-performers` | `ctrl.getTopPerformers` | Top performers |
| POST | `/api/pems/dashboard/refresh-sla` | `ctrl.refreshSLA` | Recompute SLAs |
| POST | `/api/pems/dashboard/check-escalations` | `ctrl.checkEscalations` | Run escalation checks |
| GET | `/api/pems/dashboard/summary` | `dc.getSummary` | Dashboard summary |
| GET | `/api/pems/dashboard/live-tasks` | `dc.getLiveTasks` | Live tasks |
| GET | `/api/pems/dashboard/activity-feed` | `dc.getActivityFeed` | Activity feed |
| GET | `/api/pems/templates/:id/detail` | `ctrl.getTemplateDetail` | Template detail |
| PUT | `/api/pems/templates/:templateId/assignment-rules` | `ctrl.upsertAssignmentRules` | Assignment rules |
| POST | `/api/pems/recalculate-progress` | `ctrl.recalculateProgress` | Recalc progress |
| GET | `/api/pems/notifications` | `ctrl.getNotifications` | PEMS notifications |
| POST | `/api/pems/notifications/:id/read` | `ctrl.markNotificationRead` | Mark one read |
| POST | `/api/pems/notifications/read-all` | `ctrl.markAllNotificationsRead` | Mark all read |
| GET | `/api/pems/notifications/merged` | inline | Merged notifications |
| GET | `/api/pems/sellers` | `ctrl.getSellers` | PEMS seller list |
| GET | `/api/pems/brand-managers` | `ctrl.getBrandManagers` | Brand managers |
| GET | `/api/pems/reviewers` | `ctrl.getReviewers` | Reviewers |
| POST | `/api/pems/seed-demo` | inline | Seed demo data |

### 2.41 Live Sync Tracker — `/api/live-sync-tracker` (`routes/pems/liveSyncTrackerRoutes.js`) — `auth`

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/live-sync-tracker/overview` | `ctrl.getOverview` | Tracker overview |
| GET | `/api/live-sync-tracker/sellers` | `ctrl.getSellers` | Seller list |
| GET | `/api/live-sync-tracker/seller/:sellerId` | `ctrl.getSellerDetail` | Seller detail |
| GET | `/api/live-sync-tracker/activity` | `ctrl.getActivity` | Activity log |
| POST | `/api/live-sync-tracker/trigger` | `ctrl.triggerSync` | Trigger sync |

### 2.42 Keywords — `/api/keywords` (`routes/keywordRoutes.js`) — `authenticate` + `canView`

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/keywords/search` | `canView` | `keywordController.search` | Keyword search |
| POST | `/api/keywords/batch-search` | `canView` + `batchLimiter` | `keywordController.batchSearch` | Batch keyword search |
| GET | `/api/keywords/categories` | `canView` | `keywordController.getCategories` | Keyword categories |
| GET | `/api/keywords/meta` | `canView` | `keywordController.getMeta` | Meta info |
| POST | `/api/keywords/export` | `canView` + `canExport` | `keywordController.exportResults` | Export results |
| POST | `/api/keywords/cache/clear` | `canView` + `canManage` | `keywordController.clearCache` | Clear cache |

### 2.43 Keyword Analysis — `/api/keyword-analysis` (`routes/keywordAnalysisRoutes.js`)

| Method | Path | Guard | Handler | Description |
|---|---|---|---|---|
| GET | `/api/keyword-analysis/analyze` | `authenticate` + `keywords_view` + STRICT limiter | `keywordAnalysisController.analyze` | Analyze keywords |

### 2.44 Growth Execution — `/api` wildcard (`routes/growthExecutionRoutes.js`) — `router.use(protect)`

Mounted **last** so it does not shadow any specific routers.

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/goals/current` | `growthExecutionController.getCurrentGoal` | Current goal contract |
| GET | `/api/analytics/performance` | `getPerformanceAnalytics` | Performance analytics |
| GET | `/api/insights` | `getIntelligenceInsights` | Intelligence insights |

---

## 3. Orphaned / Not-Mounted Routers

| File | Routes defined | Status |
|---|---|---|
| `backend/routes/targets.js` | `POST /import-achievements` (`authMiddleware`) | **Dead** — not required by `server.js`; superseded by `/api/targets/import-achievements` |
| `backend/routes/pems/dashboardRoutes.js` | `GET /summary`, `GET /live-tasks`, `GET /activity-feed` | **Dead** — required by `server.js` but never mounted; functionality re-served via `/api/pems/dashboard/*` in `pemsRoutes.js` |

---

## 4. Socket.IO Events (`server.js`)

Handshake requires a valid JWT in `socket.handshake.auth.token`.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join_room` | `{ roomId }` | Join a room |
| `update_role_permissions` | `{ roleId, permissions[] }` | Replace role permissions |
| `typing` | `{ conversationId, senderId, isTyping }` | Typing indicator |
| `send_message` | `{ conversationId, senderId, content, type, fileUrl, replyTo }` | Persist + broadcast message |
| `add_reaction` | `{ messageId, emoji, userId }` | Add emoji reaction |
| `message_read` | `{ messageId, userId }` | Mark read |
| `invite_to_call` | `{ conversationId, callerId, type, receiverId }` | Start call |
| `accept_call` | `{ callId }` | Accept call |
| `reject_call` | `{ callId }` | Reject call |
| `end_call` | `{ callId }` | End call |
| `disconnect` | – | Update online status |

### Server → Client

| Event | Payload |
|---|---|
| `user_status_change` | `{ userId, status }` |
| `role_permissions_updated` | formatted role |
| `typing` | `{ conversationId, senderId, isTyping }` |
| `receive_message` | populated message |
| `message_reaction_updated` | `{ messageId, reactions[] }` |
| `incoming_call` | `{ callId, conversationId, callerId, type, status }` |
| `call_initiated` | call object |
| `call_accepted` | call object (with names) |
| `call_rejected` | `{ callId }` |
| `call_ended` | `{ callId, duration }` |

Rooms: personal `{userId}`, seller `seller:{sellerId}`, and any joined via `join_room`.

---

## 5. .NET API (`dotnet/RetailOps.Api`) — ASP.NET Core

JWT Bearer auth, CORS allowlist, OpenAPI in Development. Rate-limit middleware applied per-attribute.

### AuthController — `[Route("api/auth")]`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/api/auth/login` | – | Login (rate-limited AUTH scope: 20/60s) |
| POST | `/api/auth/request-otp` | – | Request OTP (OTP_REQUEST scope: 3/300s) |
| POST | `/api/auth/verify-otp` | – | Verify OTP (OTP scope: 5/300s) |
| POST | `/api/auth/resend-otp` | – | Resend OTP (OTP scope) |
| POST | `/api/auth/refresh-token` | – | Refresh access token |
| POST | `/api/auth/logout` | Authorize | Logout (blacklists access token) |
| GET | `/api/auth/me` | Authorize | Current user |
| PUT | `/api/auth/profile` | Authorize | Update profile |
| POST | `/api/auth/request-password-change` | Authorize | Request password change |
| PUT | `/api/auth/change-password` | Authorize | Change password |
| PUT | `/api/auth/change-password-with-otp` | Authorize | Change password with OTP |
| POST | `/api/auth/forgot-password` | – | Forgot password |
| GET | `/api/auth/validate-reset-token` | – | Validate reset token (`?token=`) |
| POST | `/api/auth/reset-password` | – | Reset password |

### WeatherForecastController — `[Route("WeatherForecast")]`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/WeatherForecast` | – | Sample/placeholder entity (5-day forecast) |