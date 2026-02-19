const express = require('express');
const router = express.Router();
const systemSettingController = require('../controllers/systemSettingController');
const { auth, isAdmin } = require('../middleware/auth');

// All settings routes protected by auth and restricted to admins
router.use(auth, isAdmin);

router.get('/', systemSettingController.getSettings);
router.post('/update', systemSettingController.updateSettings);
router.post('/test-email', systemSettingController.testEmail);
router.get('/:key', systemSettingController.getSettingByKey);

module.exports = router;
