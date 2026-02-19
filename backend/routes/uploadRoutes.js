const express = require('express');
const multer = require('multer');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) are accepted'), false);
  }
};

const limits = {
  fileSize: 10 * 1024 * 1024 // 10MB
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits 
});

router.post('/upload-monthly', upload.single('file'), uploadController.uploadMonthlyData);
router.get('/upload-stats', uploadController.getUploadStats);

module.exports = router;
