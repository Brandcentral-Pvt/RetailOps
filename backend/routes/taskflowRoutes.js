/**
 * TaskFlow Routes
 * REST API routes for the new TaskFlow system
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/auth');
const ctrl = require('./taskflowController');
const { cacheRoute } = require('../../middleware/cache');

// ============================================================
// SLA POLICIES
// ============================================================
router.get('/sla/policies', auth, cacheRoute('taskflow:sla:policies', 120), ctrl.getSlaPolicies);
router.get('/sla/policies/:id', auth, cacheRoute('taskflow:sla:policies', 120), ctrl.getSlaPolicyById);
router.post('/sla/policies', auth, requirePermission('tasks_manage'), ctrl.createSlaPolicy);
router.put('/sla/policies/:id', auth, requirePermission('tasks_manage'), ctrl.updateSlaPolicy);
router.delete('/sla/policies/:id', auth, requirePermission('tasks_manage'), ctrl.deleteSlaPolicy);

// ============================================================
// TASK TEMPLATES
// ============================================================
router.get('/templates', auth, cacheRoute('taskflow:templates', 120), ctrl.getTemplates);
router.get('/templates/:id', auth, cacheRoute('taskflow:templates', 120), ctrl.getTemplateById);
router.post('/templates', auth, requirePermission('tasks_manage'), ctrl.createTemplate);
router.put('/templates/:id', auth, requirePermission('tasks_manage'), ctrl.updateTemplate);
router.delete('/templates/:id', auth, requirePermission('tasks_manage'), ctrl.deleteTemplate);

// ============================================================
// TASK INSTANCES
// ============================================================
router.get('/', auth, cacheRoute('taskflow:tasks', 30), ctrl.getTasks);
router.get('/:id', auth, cacheRoute('taskflow:tasks', 60), ctrl.getTaskById);
router.post('/', auth, ctrl.createTask);
router.put('/:id', auth, ctrl.updateTask);
router.delete('/:id', auth, ctrl.deleteTask);

// ============================================================
// STATUS TRANSITIONS
// ============================================================
router.post('/:id/transition', auth, ctrl.transitionStatus);
router.post('/bulk/transition', auth, ctrl.bulkTransition);

// ============================================================
// SUBTASKS
// ============================================================
router.get('/:id/subtasks', auth, cacheRoute('taskflow:subtasks', 60), ctrl.getSubTasks);
router.post('/:id/subtasks', auth, ctrl.createSubTask);
router.put('/subtasks/:id', auth, ctrl.updateSubTask);
router.post('/subtasks/:id/complete', auth, ctrl.completeSubTask);

// ============================================================
// ACTIVITIES
// ============================================================
router.get('/subtasks/:subTaskId/activities', auth, cacheRoute('taskflow:activities', 60), ctrl.getActivities);
router.post('/subtasks/:subTaskId/activities', auth, ctrl.createActivity);
router.post('/activities/:id/complete', auth, ctrl.completeActivity);

// ============================================================
// ATTACHMENTS (EVIDENCE)
// ============================================================
router.post('/:taskId/attachments', auth, ctrl.uploadAttachment);
router.get('/:taskId/attachments', auth, cacheRoute('taskflow:attachments', 60), ctrl.getAttachments);
router.delete('/attachments/:id', auth, ctrl.deleteAttachment);

// ============================================================
// COMMENTS
// ============================================================
router.get('/:taskId/comments', auth, cacheRoute('taskflow:comments', 30), ctrl.getComments);
router.post('/:taskId/comments', auth, ctrl.addComment);
router.delete('/comments/:id', auth, ctrl.deleteComment);

// ============================================================
// AUDIT LOGS
// ============================================================
router.get('/:taskId/audit', auth, cacheRoute('taskflow:audit', 60), ctrl.getAuditLogs);

// ============================================================
// WATCHERS
// ============================================================
router.post('/:taskId/watchers', auth, ctrl.addWatcher);
router.delete('/:taskId/watchers/:userId', auth, ctrl.removeWatcher);
router.get('/:taskId/watchers', auth, cacheRoute('taskflow:watchers', 60), ctrl.getWatchers);

// ============================================================
// DASHBOARD KPIs
// ============================================================
router.get('/dashboard/kpis', auth, cacheRoute('taskflow:dashboard', 60), ctrl.getDashboardKPIs);

// ============================================================
// RECURRENCE
// ============================================================
router.post('/recurrence/trigger', auth, requirePermission('tasks_manage'), ctrl.triggerRecurrence);

module.exports = router;