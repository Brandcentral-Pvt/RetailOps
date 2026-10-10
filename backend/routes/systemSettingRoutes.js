const express = require('express');
const router = express.Router();
const systemSettingController = require('../controllers/systemSettingController');
const { auth, requirePermission } = require('../middleware/auth');

// GET settings: any authenticated user can read (needed for ASIN optimization rules etc.)
router.get('/', auth, systemSettingController.getSettings);
router.get('/schedule-config', auth, systemSettingController.getScheduleConfig);
router.get('/octoparse-automation', auth, systemSettingController.getOctoparseAutomation);
router.post('/octoparse-automation', auth, requirePermission('settings_manage'), systemSettingController.toggleOctoparseAutomation);

router.get('/:key', auth, systemSettingController.getSettingByKey);

// Write routes are capability-gated. A role name is not an authorization bypass.
router.post('/update', auth, requirePermission('settings_manage'), systemSettingController.updateSettings);
router.post('/test-email', auth, requirePermission('settings_manage'), systemSettingController.testEmail);

module.exports = router;
