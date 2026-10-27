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
const { requireOosRunAccess } = require('../middleware/oosTaskAccess');

const canView = requirePermission('tasks_view');
const canManage = requirePermission('tasks_manage');
const canResync = requirePermission('scraping_manage');

router.use(authenticate);

router.get('/policy', canView, controller.getPolicy);

router.post('/runs', canManage, controller.createRun);
router.get('/runs', canView, controller.listRuns);
router.get('/runs/:id', canView, requireOosRunAccess({ mode: 'view' }), controller.getRun);

router.post('/runs/:id/imports', requireOosRunAccess({ mode: 'act' }), controller.ingestUpload);
router.get('/runs/:id/imports', canView, requireOosRunAccess({ mode: 'view' }), controller.listImports);

router.post('/runs/:id/reconcile', requireOosRunAccess({ mode: 'act' }), controller.reconcile);
router.get('/runs/:id/decisions', canView, requireOosRunAccess({ mode: 'view' }), controller.listDecisions);
router.get('/runs/:id/incidents', canView, requireOosRunAccess({ mode: 'view' }), controller.listRunIncidents);

router.patch('/incidents/:id', requirePermission('tasks_manage'), require('./../middleware/oosTaskAccess').requireOosIncidentAccess({ mode: 'act' }), controller.updateIncident);
router.post('/incidents/:id/resolve', requirePermission('tasks_manage'), require('./../middleware/oosTaskAccess').requireOosIncidentAccess({ mode: 'act' }), controller.resolveIncident);

router.get('/sellers/:sellerId/pareto', canView, controller.getPareto);

router.post('/runs/:id/resync', requireOosRunAccess({ mode: 'act' }), canResync, controller.requestResync);
router.get('/runs/:id/resync', canView, requireOosRunAccess({ mode: 'view' }), controller.listResync);
router.post('/resync/:id/verify', requireOosRunAccess({ mode: 'act' }), canResync, controller.verifyResync);

router.post('/runs/:id/export', requireOosRunAccess({ mode: 'act' }), controller.buildExport);
router.get('/runs/:id/export', canView, requireOosRunAccess({ mode: 'view' }), controller.getLatestExport);
router.get('/runs/:id/export/download', canView, require('./../middleware/oosTaskAccess').requireOosExportAccess({ mode: 'view' }), controller.downloadExport);

router.post('/runs/:id/submit', requireOosRunAccess({ mode: 'act' }), controller.submit);

module.exports = router;
