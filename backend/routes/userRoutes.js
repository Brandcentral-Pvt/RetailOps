const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/', authenticate, requirePermission('users_view'), userController.getUsers);
router.get('/:id', authenticate, requirePermission('users_view'), userController.getUser);
router.post('/', authenticate, requirePermission('users_create'), userController.createUser);
router.put('/:id', authenticate, requirePermission('users_edit'), userController.updateUser);
router.delete('/:id', authenticate, requirePermission('users_delete'), userController.deleteUser);
router.post('/:id/toggle-status', authenticate, requirePermission('users_edit'), userController.toggleUserStatus);
router.post('/:id/reset-password', authenticate, requirePermission('users_edit'), userController.resetUserPassword);

module.exports = router;
