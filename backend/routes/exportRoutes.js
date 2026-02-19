const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.post('/export/xlsx', exportController.exportToExcel);
router.post('/export/csv', exportController.exportToCSV);

module.exports = router;
