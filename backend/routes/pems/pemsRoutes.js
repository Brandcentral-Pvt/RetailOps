const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../../middleware/auth');
const { requireTaskAccess, requireTaskView, requireTaskExecutor, requireTaskReviewer, requireTaskTransition, requireGlobalPemsRole } = require('../../middleware/pemsAccess');
const ctrl = require('../../controllers/pems/pemsController');
const { cacheRoute, invalidateCache } = require('../../middleware/cache');

// ── Templates ──
router.get('/templates', auth, cacheRoute('pems:templates', 120), ctrl.getTemplates);
router.get('/templates/filters', auth, cacheRoute('pems:meta', 300), ctrl.getFilterOptions);
// Static template routes must be declared before `/templates/:id`, otherwise
// Express treats 'validate'/'config' as a template id.
router.get('/templates/summary', auth, cacheRoute('pems:templates', 60), ctrl.getTemplateSummary);
router.post('/templates/validate', auth, requirePermission('tasks_manage'), ctrl.validateTemplate);
router.post('/templates/workflow/validate', auth, requirePermission('tasks_manage'), ctrl.validateWorkflowV2);
router.post('/templates/config', auth, requirePermission('tasks_manage'), invalidateCache('pems:templates'), ctrl.saveTemplateConfiguration);
router.put('/templates/config/:id', auth, requirePermission('tasks_manage'), invalidateCache('pems:templates'), ctrl.saveTemplateConfiguration);
router.get('/templates/:id', auth, cacheRoute('pems:templates', 120), ctrl.getTemplateById);
router.post('/templates', auth, requirePermission('tasks_manage'), invalidateCache('pems:templates'), ctrl.createTemplate);
router.put('/templates/:id', auth, requirePermission('tasks_manage'), invalidateCache('pems:templates'), ctrl.updateTemplate);
router.delete('/templates/:id', auth, requirePermission('tasks_manage'), invalidateCache('pems:templates'), ctrl.deleteTemplate);

// ── Brand checklist on multi-brand routines (brandId omitted = all brands) ──
router.put('/instances/:id/brands', auth, requireTaskExecutor, ctrl.setBrandCheck);
router.put('/instances/:id/brands/:brandId', auth, requireTaskExecutor, ctrl.setBrandCheck);

// ── Daily routine ──
router.post('/routine/import', auth, requirePermission('tasks_manage'), invalidateCache('pems:templates'), ctrl.importDailyOps);
router.post('/routine/generate', auth, requirePermission('tasks_manage'), ctrl.generateRoutineToday);

// ── Task Instances ──
// getInstanceById uses the *view* level check: you may read a task in your
// sellers even if it is assigned to someone else. Every write below uses the
// stricter 'act' check (seller scope AND assigned to / reviewing you).
router.get('/instances', auth, cacheRoute('pems:instances', 30), ctrl.getInstances);
router.get('/instances/:id', auth, requireTaskView, cacheRoute('pems:instances', 60), ctrl.getInstanceById);
router.post('/instances', auth, requirePermission('tasks_manage'), invalidateCache('pems:instances'), ctrl.createInstance);
router.post('/instances/bulk/transition', auth, invalidateCache('pems:instances'), ctrl.bulkTransition);
router.post('/instances/:id/transition', auth, requireTaskTransition, invalidateCache('pems:instances'), ctrl.transitionStatus);
// Phase 2.2: same PEMS identity and seller-scoped permissions as existing task routes.
router.get('/instances/:id/workflow', auth, requireTaskView, ctrl.getWorkflowExecution);
router.put('/instances/:id/activities/:activityId/output', auth, requireTaskExecutor, invalidateCache('pems:instances'), ctrl.saveWorkflowActivityOutput);
router.post('/instances/:id/comments', auth, requireTaskAccess, invalidateCache('pems:instances'), ctrl.addComment);
router.post('/instances/:id/verify-fix', auth, requireTaskExecutor, ctrl.verifyFix);
router.put('/instances/:id/achievement', auth, requireTaskExecutor, invalidateCache('pems:instances'), ctrl.updateAchievement);

// ── Sub Tasks & Activities ──
router.post('/subtasks/:subTaskId/complete', auth, requireTaskExecutor, invalidateCache('pems:instances'), ctrl.completeSubTask);
router.post('/activities/:activityId/complete', auth, requireTaskExecutor, invalidateCache('pems:instances'), ctrl.completeActivity);

// ── Evidence ──
router.post('/evidence', auth, requireTaskExecutor, ctrl.uploadEvidence);

// ── Affected ASINs (per task instance) ──
router.get('/instances/:id/asins', auth, requireTaskView, ctrl.getInstanceAsins);
router.put('/instances/:id/asins/remarks', auth, requireTaskExecutor, invalidateCache('pems:instances'), ctrl.updateAsinRemarks);
router.post('/instances/:id/asins/:asinId/resolve', auth, requireTaskExecutor, invalidateCache('pems:instances'), ctrl.resolveAsin);

// ── Reviews ──
router.post('/reviews', auth, requireTaskReviewer, invalidateCache('pems:instances'), ctrl.submitReview);
router.post('/reviews/bulk', auth, invalidateCache('pems:instances'), ctrl.bulkReview);
router.get('/reviews/stats', auth, ctrl.getReviewStats);
router.get('/my-day', auth, ctrl.getMyDay);

// ── Dashboard ──
router.get('/dashboard/kpis', auth, cacheRoute('pems:dashboard', 120), ctrl.getDashboardKPIs);
router.get('/dashboard/seller-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getSellerPerformance);
router.get('/dashboard/department-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getDepartmentPerformance);
router.get('/dashboard/brand-manager-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getBrandManagerPerformance);
router.get('/dashboard/reviewer-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getReviewerPerformance);
router.get('/dashboard/risk-panel', auth, cacheRoute('pems:dashboard', 120), ctrl.getRiskPanel);
router.get('/dashboard/top-performers', auth, cacheRoute('pems:dashboard', 120), ctrl.getTopPerformers);
router.post('/dashboard/refresh-sla', auth, requireGlobalPemsRole, ctrl.refreshSLA);
router.post('/dashboard/check-escalations', auth, requireGlobalPemsRole, ctrl.checkEscalations);

// ── Enterprise Dashboard (3 consolidated endpoints) ──
const dc = require('../../controllers/pems/dashboardController');
router.get('/dashboard/summary', auth, cacheRoute('pems:dashboard', 60), dc.getSummary);
router.get('/dashboard/live-tasks', auth, cacheRoute('pems:dashboard', 30), dc.getLiveTasks);
router.get('/dashboard/activity-feed', auth, cacheRoute('pems:dashboard', 30), dc.getActivityFeed);

// ── V3: Template Detail + Assignment Rules ──
router.get('/templates/:id/detail', auth, cacheRoute('pems:templates', 120), ctrl.getTemplateDetail);
router.put('/templates/:templateId/assignment-rules', auth, requirePermission('tasks_manage'), invalidateCache('pems:templates'), ctrl.upsertAssignmentRules);
router.post('/recalculate-progress', auth, requireGlobalPemsRole, ctrl.recalculateProgress);

// ── Notifications ──
router.get('/notifications', auth, cacheRoute('pems:notifications', 15), ctrl.getNotifications);
router.post('/notifications/:id/read', auth, ctrl.markNotificationRead);
router.post('/notifications/read-all', auth, ctrl.markAllNotificationsRead);

// ── Merged Notifications ──
const { getMergedNotifications } = require('../../services/pems/notificationMergeService');
router.get('/notifications/merged', auth, cacheRoute('pems:notifications', 15), async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id;
    if (!userId) return res.json({ success: true, data: [], unreadCount: 0 });
    const pems = await getMergedNotifications(userId, 20);
    res.json({ success: true, data: pems, unreadCount: pems.filter(n => !n.IsRead).length });
  } catch (err) {
    res.json({ success: true, data: [], unreadCount: 0 });
  }
});

// ── Automation (ruleset) stats ──
router.get('/automation-stats', auth, cacheRoute('pems:instances', 30), ctrl.getAutomationStats);

// ── Dynamic Data Sources ──
router.get('/sellers', auth, cacheRoute('pems:meta', 300), ctrl.getSellers);
router.get('/brand-managers', auth, cacheRoute('pems:meta', 300), ctrl.getBrandManagers);
router.get('/reviewers', auth, cacheRoute('pems:meta', 300), ctrl.getReviewers);

// ── Demo Seed ──
router.post('/seed-demo', auth, requireGlobalPemsRole, async (req, res) => {
  try {
    const { seedDemo } = require('../../services/pems/seedDemo');
    const result = await seedDemo();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
