# Production Readiness Audit — Loading States & Toast Alerts

## 1. Loading States Summary

### A. Page-Level Loaders (PageLoader component)

| Page | File | Status |
|---|---|---|
| ProfilePage | `src/pages/ProfilePage.jsx:194` | ✅ Working |
| AsinManagerPage | `src/pages/AsinManagerPage.jsx:2034` | ✅ Working |
| AsinTrackerPage | `src/pages/AsinTrackerPage.jsx:283` | ✅ Working |
| App (Suspense) | `src/App.jsx:163` | ✅ Working |

### B. Spin Loaders (Ant Design)

| Component | File | Status |
|---|---|---|
| LiveDataInspectorPage | `src/pages/LiveDataInspectorPage.jsx` | ✅ Working |
| LiveSyncTrackerPage | `src/pages/LiveSyncTrackerPage.jsx` | ✅ Working |
| PemsDashboard | `src/modules/pems/pages/PemsDashboard.jsx:296` | ✅ Working |
| ReviewQueuePage | `src/modules/pems/pages/ReviewQueuePage.jsx` | ✅ Working |
| TaskInstancesPage | `src/modules/pems/pages/TaskInstancesPage.jsx:256` | ✅ Working |
| TaskTemplatesPage | `src/modules/pems/pages/TaskTemplatesPage.jsx` | ✅ Working |
| TaskWorkspace | `src/modules/pems/components/TaskWorkspace.jsx:320` | ✅ Working |
| ReviewWorkspace | `src/modules/pems/components/ReviewWorkspace.jsx:235` | ✅ Working |
| NotificationCenter | `src/modules/pems/components/NotificationCenter.jsx:125` | ✅ Working |
| RightInsightsPanel | `src/modules/pems/components/RightInsightsPanel.jsx` | ✅ Working |
| Header (Notifications) | `src/components/Header.jsx:194` | ✅ Working |
| AddSellerModal | `src/components/sellers/AddSellerModal.jsx:238` | ✅ Working |

### C. setLoading State Variables (396+ occurrences)

**Pages with loading states:**

| Page | Loading Variables | Count |
|---|---|---|
| AsinManagerPage | `loading`, `loadingParent`, `aiAnalysisLoading` | 3 |
| GmsTrackerPage | `loading` | 1 |
| AsinTrackerPage | `loading` | 1 |
| LiveDataInspectorPage | `loading` | 1 |
| LiveSyncTrackerPage | `loading` | 1 |
| SellerAsinTrackerPage | `loading`, `syncing` | 2 |
| AlertsPage | `loading` | 1 |
| ProfilePage | `loading`, `saving` | 2 |
| TargetCreationPage | `loading`, `saving` | 2 |
| PemsDashboard | `loading` | 1 |
| ReviewQueuePage | `loading` | 1 |
| TaskInstancesPage | `loading` | 1 |
| TaskTemplatesPage | `loading` | 1 |

---

## 2. Toast/Alert Systems

The system uses **3 different toast systems**:

### A. Ant Design `message.*` (Primary — 105 occurrences)

**Success messages (26):**
- GMS Tracker: cleared, export started
- ASIN Manager: auto-tags complete, bulk operations
- LiveDataInspector: data fetched, exported
- PEMS: tasks created/updated/deleted, templates saved
- Alerts: acknowledged, purged
- SellerAsinTracker: sync complete, task created
- DownloadsDrawer: download complete
- ProfilePage: profile updated, password changed

**Error messages (35):**
- GMS Tracker: clear failed, export failed, upload failed
- ASIN Manager: auto-tags failed
- LiveDataInspector: fetch failed
- PEMS: load/create/update/delete failed
- Alerts: sync error, acknowledge failed, delete failed
- SellerAsinTracker: fetch failed, sync failed, task creation failed
- DownloadsDrawer: download failed
- ProfilePage: update failed, password change failed

**Warning messages (12):**
- LiveDataInspector: no ASINs, no metrics selected, no data to export
- TaskInstances: select template, enter task name
- BulkAction: no action selected, no status selected, no confirmation, no tasks selected
- ImportTargets: empty file, no valid rows

**Loading messages (4):**
- GMS Tracker: export preparing
- DownloadsDrawer: preparing file
- ASIN Manager: auto-tags running

**Info messages (3):**
- Alerts: info notification
- SellerAsinTracker: report generation info, configuration info
- EditTagsModal: no changes made

### B. Ant Design `notification.*` (8 occurrences)

| Location | Type | Message |
|---|---|---|
| useWorkflow.jsx:104 | open | Workflow notification |
| SubmitTaskModal.jsx:76 | warning | Audio file too large |
| SubmitTaskModal.jsx:131 | success | Task submitted |
| ReviewDecisionModal.jsx:53 | error | Feedback required |
| ReviewDecisionModal.jsx:66 | success | Decision submitted |
| TargetCreationPage.tsx:506 | error | Validation: select brand/seller |
| TargetCreationPage.tsx:512 | error | Validation: duplicate brands |
| TargetCreationPage.tsx:608 | error | Save targets failed |

### C. Custom Toast Context (80 occurrences)

| Component | Messages |
|---|---|
| SellersPage | Uses `addToast` from context |
| SellerAsinsModal | 15+ toast calls (match, select, update, delete, import) |
| TasksPage | 8+ toast calls (delete, save, reject, generate) |
| ImportSellerModal | File validation toasts |
| GlobalNotificationListener | Real-time socket notifications |
| WebhookSettingsPage | Custom toast rendering |

---

## 3. Issues Found

### Critical (Must Fix Before Deploy)

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | **3 different toast systems** | Global | Inconsistent UX, harder to maintain |
| 2 | **Missing error boundaries** | Multiple pages | App crashes on unhandled errors |
| 3 | **Silent catch blocks** | Multiple pages | Errors swallowed without user feedback |

### Medium (Should Fix)

| # | Issue | Location | Impact |
|---|---|---|---|
| 4 | **No loading timeout** | Multiple pages | Users stuck on infinite spinners |
| 5 | **Inconsistent error messages** | Multiple pages | Some show raw error, some hide it |
| 6 | **Missing retry mechanisms** | Multiple pages | Failed loads require manual refresh |

### Low (Nice to Have)

| # | Issue | Location | Impact |
|---|---|---|---|
| 7 | **No skeleton loaders** | Most pages | Flash of empty content |
| 8 | **No optimistic updates** | Forms | Delayed feedback on save |

---

## 4. Recommendations for Production

1. **Standardize toast system** — Use Ant Design `message` as primary, deprecate custom `addToast`
2. **Add Error Boundaries** — Wrap each page in error boundary
3. **Add loading timeouts** — Show error after 10s of loading
4. **Standardize error messages** — Show user-friendly messages, log details
5. **Add retry buttons** — On failed loads
