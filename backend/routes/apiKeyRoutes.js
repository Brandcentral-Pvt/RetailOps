const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { authenticate: protect } = require('../middleware/auth');

router.use(protect); // Protect all routes

router.get('/', apiKeyController.getKeys);
router.post('/', apiKeyController.createKey);
router.put('/:id', apiKeyController.updateKey);
router.delete('/:id', apiKeyController.deleteKey);
router.get('/:id/reveal', apiKeyController.revealKey);

module.exports = router;
