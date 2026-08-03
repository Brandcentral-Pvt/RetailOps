const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const ctrl = require('../../controllers/pems/pemsController');
const { cacheRoute, invalidateCache } = require('../../middleware/cache');

// ── Templates ──
router.get('/templates', auth, cacheRoute('pems:templates', 120), ctrl.getTemplates);
router.get('/templates/filters', auth, cacheRoute('pems:meta', 300), ctrl.getFilterOptions);
router.get('/templates/:id', auth, cacheRoute('pems:templates', 120), ctrl.getTemplateById);
router.post('/templates', auth, invalidateCache('route:/api/pems/templates*'), ctrl.createTemplate);
router.put('/templates/:id', auth, invalidateCache('route:/api/pems/templates*'), ctrl.updateTemplate);
router.delete('/templates/:id', auth, invalidateCache('route:/api/pems/templates*'), ctrl.deleteTemplate);

// ── Task Instances ──
router.get('/instances', auth, cacheRoute('pems:instances', 30), ctrl.getInstances);
router.get('/instances/:id', auth, cacheRoute('pems:instances', 60), ctrl.getInstanceById);
router.post('/instances', auth, invalidateCache('pems:instances'), ctrl.createInstance);
router.post('/instances/bulk/transition', auth, invalidateCache('pems:instances'), ctrl.bulkTransition);
router.post('/instances/:id/transition', auth, invalidateCache('pems:instances'), ctrl.transitionStatus);
router.put('/instances/:id/achievement', auth, invalidateCache('pems:instances'), ctrl.updateAchievement);

// ── Sub Tasks & Activities ──
router.post('/subtasks/:subTaskId/complete', auth, invalidateCache('pems:instances'), ctrl.completeSubTask);
router.post('/activities/:activityId/complete', auth, invalidateCache('pems:instances'), ctrl.completeActivity);

// ── Evidence ──
router.post('/evidence', auth, ctrl.uploadEvidence);

// ── Reviews ──
router.post('/reviews', auth, invalidateCache('pems:instances'), ctrl.submitReview);

// ── Dashboard ──
router.get('/dashboard/kpis', auth, cacheRoute('pems:dashboard', 120), ctrl.getDashboardKPIs);
router.get('/dashboard/seller-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getSellerPerformance);
router.get('/dashboard/department-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getDepartmentPerformance);
router.get('/dashboard/brand-manager-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getBrandManagerPerformance);
router.get('/dashboard/reviewer-performance', auth, cacheRoute('pems:dashboard', 120), ctrl.getReviewerPerformance);
router.get('/dashboard/risk-panel', auth, cacheRoute('pems:dashboard', 120), ctrl.getRiskPanel);
router.get('/dashboard/top-performers', auth, cacheRoute('pems:dashboard', 120), ctrl.getTopPerformers);
router.post('/dashboard/refresh-sla', auth, ctrl.refreshSLA);
router.post('/dashboard/check-escalations', auth, ctrl.checkEscalations);

// ── Enterprise Dashboard (3 consolidated endpoints) ──
const dc = require('../../controllers/pems/dashboardController');
router.get('/dashboard/summary', auth, cacheRoute('pems:dashboard', 60), dc.getSummary);
router.get('/dashboard/live-tasks', auth, cacheRoute('pems:dashboard', 30), dc.getLiveTasks);
router.get('/dashboard/activity-feed', auth, cacheRoute('pems:dashboard', 30), dc.getActivityFeed);

// ── V3: Template Detail + Assignment Rules ──
router.get('/templates/:id/detail', auth, cacheRoute('pems:templates', 120), ctrl.getTemplateDetail);
router.put('/templates/:templateId/assignment-rules', auth, invalidateCache('pems:templates'), ctrl.upsertAssignmentRules);
router.post('/recalculate-progress', auth, ctrl.recalculateProgress);

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

// ── Dynamic Data Sources ──
router.get('/sellers', auth, cacheRoute('pems:meta', 300), ctrl.getSellers);
router.get('/brand-managers', auth, cacheRoute('pems:meta', 300), ctrl.getBrandManagers);
router.get('/reviewers', auth, cacheRoute('pems:meta', 300), ctrl.getReviewers);

// ── Demo Seed ──
router.post('/seed-demo', auth, async (req, res) => {
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
