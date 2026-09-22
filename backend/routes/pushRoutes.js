const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authenticate: protect } = require('../middleware/auth');

router.post('/register', protect, pushController.registerToken);
router.delete('/unregister', protect, pushController.unregisterToken);

module.exports = router;