/**
 * OOS Inventory Upload routes - handles dual-file upload (Vendor Central + BrandCentral)
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('../controllers/oosController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireOosRunAccess } = require('../middleware/oosTaskAccess');

const canManage = requirePermission('tasks_manage');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'text/plain'
  ];
  const ext = (file.originalname || '').toLowerCase();
  if (allowedMimes.includes(file.mimetype) || ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx, .xls) and CSV files are accepted'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB per file
  }
});

router.use(authenticate);

// Combined inventory upload: Vendor Central + BrandCentral in one request
router.post('/runs/:id/inventory-upload', requireOosRunAccess({ mode: 'act' }), upload.fields([
  { name: 'vendorCentralFile', maxCount: 1 },
  { name: 'brandCentralFile', maxCount: 1 }
]), controller.ingestInventoryUpload);

module.exports = router;