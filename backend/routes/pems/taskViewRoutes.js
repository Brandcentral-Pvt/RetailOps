const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('../../controllers/pems/taskViewController');
const { authenticate, requirePermission } = require('../../middleware/auth');

const canView = requirePermission('tasks_view');
const canManage = requirePermission('tasks_manage');

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
router.get('/instances/:id/oos/context', canView, controller.getOosContext);
router.get('/instances/:id/oos/sellers/:sellerId/runs', canView, controller.listOosRuns);
router.post('/instances/:id/oos/sellers/:sellerId/runs', canManage, controller.createOosRun);
router.post('/instances/:id/oos/runs/:runId/files', canManage, upload.single('file'), controller.uploadOosFile);
router.get('/instances/:id/oos/runs/:runId/files', canView, controller.listOosUploads);
router.get('/instances/:id/oos/imports/:importId/download', canView, controller.downloadOosImport);
router.post('/instances/:id/oos/runs/:runId/reconcile', canManage, controller.reconcileOosRun);
router.get('/instances/:id/oos/affected-asins', canView, controller.getAffectedAsins);
router.get('/instances/:id/oos/affected-asins/summary', canView, controller.getAffectedAsinsSummary);
router.get('/instances/:id/oos/affected-asins/:caseId', canView, controller.getAffectedAsinDetail);
router.post('/instances/:id/oos/runs/:runId/resync/:caseId', canManage, controller.requestResync);
router.get('/instances/:id/oos/runs/:runId/resync/:caseId', canView, controller.getResyncStatus);
router.post('/instances/:id/oos/runs/:runId/resync/:caseId/verify', canManage, controller.verifyResync);
router.patch('/instances/:id/oos/incidents/:caseId', canManage, controller.updateIncident);
router.post('/instances/:id/oos/incidents/:caseId/resolve', canManage, controller.resolveOosIncident);
router.post('/instances/:id/oos/exports', canManage, controller.buildExport);
router.get('/instances/:id/oos/exports', canView, controller.listExports);
router.get('/instances/:id/oos/exports/:exportId/download', canView, controller.downloadExport);
router.post('/instances/:id/oos/submit', canManage, controller.submitOos);
router.post('/instances/:id/oos/review', canManage, controller.reviewOos);

module.exports = router;