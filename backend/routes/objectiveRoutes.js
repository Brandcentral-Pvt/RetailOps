const express = require('express');
const router = express.Router();
const objectiveController = require('../controllers/objectiveController');
const { authenticate: protect, requireRole } = require('../middleware/auth');

// Validates that the user is logged in
router.use(protect);

router.post('/', objectiveController.createObjective);
router.get('/', objectiveController.getObjectives);
router.put('/:id', objectiveController.updateObjective);
router.delete('/:id', objectiveController.deleteObjective);

router.post('/key-results', objectiveController.createKeyResult);
router.put('/key-results/:id', objectiveController.updateKeyResult);
router.delete('/key-results/:id', objectiveController.deleteKeyResult);
router.delete('/actions/:id', objectiveController.deleteAction);

// Admin: bulk delete all objectives + KRs + actions
router.delete('/bulk-delete-all', requireRole('admin'), objectiveController.deleteAllObjectives);

module.exports = router;
