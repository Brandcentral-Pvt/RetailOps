const express = require('express');
const router = express.Router();
const controller = require('../../controllers/pems/oosTaskAssignmentController');
const { authenticate, requirePermission } = require('../../middleware/auth');

const canView = requirePermission('tasks_view');
const canManage = requirePermission('tasks_manage');

router.use(authenticate);

router.post('/oos/monitoring-tasks', canManage, controller.createOosMonitoringTask);
router.get('/oos/monitoring-tasks', canView, controller.previewAssignment);
router.get('/oos/sellers', canView, controller.getSellersWithUnavailableASINs);
router.get('/oos/managers', canView, controller.getAvailableBrandManagers);
router.get('/instances/:id/oos/context', canView, controller.getOosTaskContext);

module.exports = router;