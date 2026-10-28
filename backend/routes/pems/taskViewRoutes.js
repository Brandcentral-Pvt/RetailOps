const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('../../controllers/pems/taskViewController');
const { authenticate, requirePermission } = require('../../middleware/auth');
const { requireOosRunAccess, requireOosIncidentAccess, requireOosExportAccess } = require('../../middleware/oosTaskAccess');

const canView = requirePermission('tasks_view');
const canManage = requirePermission('tasks_manage');
const canExecute = requirePermission('tasks_execute');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = file.originalname.toLowerCase();
  if (['.csv', '.xls', '.xlsx'].some(ext => file.originalname.toLowerCase().endsWith(ext))) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV, XLS, XLSX files are accepted'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticate);

router.get('/instances/:id/view', canView, controller.getTaskView);
router.get('/instances/:id/oos/context', canView, requireOosRunAccess({ mode: 'view' }), controller.getOosContext);
router.get('/instances/:id/oos/sellers/:sellerId/runs', canView, controller.listOosRuns);
router.post('/instances/:id/oos/sellers/:sellerId/runs', canExecute, controller.createOosRun);
router.post('/instances/:id/oos/runs/:runId/files', canExecute, requireOosRunAccess({ mode: 'act' }), upload.single('file'), controller.uploadOosFile);
router.get('/instances/:id/oos/runs/:runId/files', canView, requireOosRunAccess({ mode: 'view' }), controller.listOosUploads);
router.get('/instances/:id/oos/imports/:importId/download', canView, requireOosRunAccess({ mode: 'view' }), controller.downloadOosImport);
router.post('/instances/:id/oos/runs/:runId/reconcile', canExecute, requireOosRunAccess({ mode: 'act' }), controller.reconcileOosRun);
router.get('/instances/:id/oos/affected-asins', canView, requireOosRunAccess({ mode: 'view' }), controller.getAffectedAsins);
router.get('/instances/:id/oos/affected-asins/summary', canView, requireOosRunAccess({ mode: 'view' }), controller.getAffectedAsinsSummary);
router.get('/instances/:id/oos/affected-asins/:caseId', canView, controller.getAffectedAsinDetail);
router.post('/instances/:id/oos/runs/:runId/resync/:caseId', canManage, requireOosRunAccess({ mode: 'act' }), controller.requestResync);
router.get('/instances/:id/oos/runs/:runId/resync/:caseId', canView, requireOosRunAccess({ mode: 'view' }), controller.getResyncStatus);
router.post('/instances/:id/oos/runs/:runId/resync/:caseId/verify', canManage, requireOosRunAccess({ mode: 'act' }), controller.verifyResync);
router.patch('/instances/:id/oos/incidents/:caseId', canManage, requireOosIncidentAccess({ mode: 'act' }), controller.updateIncident);
router.post('/instances/:id/oos/incidents/:caseId/resolve', canManage, requireOosIncidentAccess({ mode: 'act' }), controller.resolveOosIncident);
router.post('/instances/:id/oos/exports', canManage, requireOosRunAccess({ mode: 'act' }), controller.buildExport);
router.get('/instances/:id/oos/exports', canView, requireOosRunAccess({ mode: 'view' }), controller.listExports);
router.get('/instances/:id/oos/exports/:exportId/download', canView, requireOosExportAccess({ mode: 'view' }), controller.downloadExport);
router.post('/instances/:id/oos/submit', canExecute, controller.submitOos);
router.post('/instances/:id/oos/review', canManage, controller.reviewOos);

module.exports = router;