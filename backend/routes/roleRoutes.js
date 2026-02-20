const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/', authenticate, requirePermission('roles_view'), roleController.getRoles);
router.get('/permissions', authenticate, requirePermission('roles_view'), roleController.getPermissions);
router.get('/:id', authenticate, requirePermission('roles_view'), roleController.getRole);
router.post('/', authenticate, requirePermission('roles_create'), roleController.createRole);
router.put('/:id', authenticate, requirePermission('roles_edit'), roleController.updateRole);
router.delete('/:id', authenticate, requirePermission('roles_delete'), roleController.deleteRole);
router.post('/seed', authenticate, requirePermission('roles_edit'), roleController.seedRolesAndPermissions);

module.exports = router;
