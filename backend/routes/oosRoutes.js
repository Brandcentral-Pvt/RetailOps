/**
 * OOS reconciliation engine — mounted at /api/oos.
 *
 * Read paths require `tasks_view`; mutations require `tasks_manage`. Privileged
 * marketplace resync (request + verification) additionally requires
 * `scraping_manage`. Seller scope is enforced in the controller for every path
 * that can touch a seller or a run.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/oosController');
const { authenticate, requirePermission } = require('../middleware/auth');

const canView = requirePermission('tasks_view');
const canManage = requirePermission('tasks_manage');
const canResync = requirePermission('scraping_manage');

router.use(authenticate);

router.get('/policy', canView, controller.getPolicy);

router.post('/runs', canManage, controller.createRun);
router.get('/runs', canView, controller.listRuns);
router.get('/runs/:id', canView, controller.getRun);

router.post('/runs/:id/imports', canManage, controller.ingestUpload);
router.get('/runs/:id/imports', canView, controller.listImports);

router.post('/runs/:id/reconcile', canManage, controller.reconcile);
router.get('/runs/:id/decisions', canView, controller.listDecisions);
router.get('/runs/:id/incidents', canView, controller.listRunIncidents);

router.patch('/incidents/:id', canManage, controller.updateIncident);
router.post('/incidents/:id/resolve', canManage, controller.resolveIncident);

router.get('/sellers/:sellerId/pareto', canView, controller.getPareto);

router.post('/runs/:id/resync', canManage, canResync, controller.requestResync);
router.get('/runs/:id/resync', canView, controller.listResync);
router.post('/resync/:id/verify', canManage, canResync, controller.verifyResync);

router.post('/runs/:id/export', canManage, controller.buildExport);
router.get('/runs/:id/export', canView, controller.getLatestExport);
router.get('/runs/:id/export/download', canView, controller.downloadExport);

router.post('/runs/:id/submit', canManage, controller.submit);

module.exports = router;
