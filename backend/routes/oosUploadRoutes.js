/**
 * OOS upload routes with proper file handling
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
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

router.use(authenticate);

// Upload with file buffer
router.post('/runs/:id/upload', requireOosRunAccess({ mode: 'act' }), upload.single('file'), controller.ingestUpload);

module.exports = router;
