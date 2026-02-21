const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requirePermission, checkUserHierarchyAccess } = require('../middleware/auth');

router.get('/managers', authenticate, userController.getManagers);
router.get('/', authenticate, requirePermission('users_view'), userController.getUsers);
router.get('/:id', authenticate, checkUserHierarchyAccess, userController.getUser);
router.post('/', authenticate, requirePermission('users_create'), userController.createUser);
router.put('/:id', authenticate, checkUserHierarchyAccess, requirePermission('users_edit'), userController.updateUser);
router.delete('/:id', authenticate, checkUserHierarchyAccess, requirePermission('users_delete'), userController.deleteUser);
router.post('/:id/toggle-status', authenticate, checkUserHierarchyAccess, requirePermission('users_edit'), userController.toggleUserStatus);
router.post('/:id/reset-password', authenticate, checkUserHierarchyAccess, requirePermission('users_edit'), userController.resetUserPassword);

module.exports = router;
