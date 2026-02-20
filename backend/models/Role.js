const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  isSystem: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
  }],
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  color: {
    type: String,
    default: '#4F46E5',
  },
}, { timestamps: true });

// Pre-defined roles
const defaultRoles = [
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access with all permissions',
    isSystem: true,
    level: 100,
    color: '#DC2626',
  },
  {
    name: 'manager',
    displayName: 'Manager',
    description: 'Can manage sellers and view all reports',
    isSystem: true,
    level: 80,
    color: '#D97706',
  },
  {
    name: 'analyst',
    displayName: 'Analyst',
    description: 'Can view reports and dashboards',
    isSystem: true,
    level: 50,
    color: '#0891B2',
  },
  {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to dashboards and reports',
    isSystem: true,
    level: 10,
    color: '#6B7280',
  },
];

const Role = mongoose.model('Role', roleSchema);

// Static method to seed default roles
Role.seedDefaultRoles = async function (permissionModel) {
  // First, seed default permissions
  if (permissionModel && permissionModel.seedDefaultPermissions) {
    await permissionModel.seedDefaultPermissions();
  }

  const Permission = require('./Permission');
  const allPermissions = await Permission.find();

  for (const roleData of defaultRoles) {
    const existingRole = await this.findOne({ name: roleData.name });
    let rolePermissions;
    if (roleData.name === 'admin') {
      rolePermissions = allPermissions.map(p => p._id);
    } else if (roleData.name === 'manager') {
      rolePermissions = allPermissions
        .filter(p => ['dashboard', 'reports', 'sellers', 'scraping', 'actions', 'calculator', 'inventory'].includes(p.category))
        .map(p => p._id);
    } else if (roleData.name === 'analyst') {
      rolePermissions = allPermissions
        .filter(p => ['dashboard', 'reports', 'actions', 'calculator', 'inventory'].includes(p.category))
        .map(p => p._id);
    } else {
      rolePermissions = allPermissions
        .filter(p => p.action === 'view' && p.category !== 'settings')
        .map(p => p._id);
    }

    if (!existingRole) {
      await this.create({ ...roleData, permissions: rolePermissions });
    } else if (existingRole.isSystem) {
      // Refresh permissions and other metadata for system roles
      await this.findByIdAndUpdate(existingRole._id, {
        ...roleData,
        permissions: rolePermissions
      });
    }
  }
};

module.exports = Role;
