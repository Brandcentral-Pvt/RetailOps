const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
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
  category: {
    type: String,
    enum: ['dashboard', 'reports', 'sellers', 'users', 'settings', 'scraping', 'actions', 'calculator', 'inventory'],
    default: 'reports',
  },
  action: {
    type: String,
    enum: ['view', 'create', 'edit', 'delete', 'export', 'manage'],
    required: true,
  },
}, { timestamps: true });

// Pre-defined permissions
const defaultPermissions = [
  // Dashboard
  { name: 'dashboard_view', displayName: 'View Dashboard', description: 'View dashboard overview', category: 'dashboard', action: 'view' },

  // Reports
  { name: 'reports_sku_view', displayName: 'View SKU Report', description: 'View SKU performance report', category: 'reports', action: 'view' },
  { name: 'reports_parent_view', displayName: 'View Parent ASIN Report', description: 'View parent ASIN performance report', category: 'reports', action: 'view' },
  { name: 'reports_monthly_view', displayName: 'View Monthly Report', description: 'View monthly performance report', category: 'reports', action: 'view' },
  { name: 'reports_ads_view', displayName: 'View Ads Report', description: 'View advertising performance report', category: 'reports', action: 'view' },
  { name: 'reports_profit_view', displayName: 'View Profit & Loss', description: 'View profit and loss report', category: 'reports', action: 'view' },
  { name: 'reports_inventory_view', displayName: 'View Inventory', description: 'View inventory report', category: 'reports', action: 'view' },
  { name: 'reports_export', displayName: 'Export Reports', description: 'Export report data', category: 'reports', action: 'export' },

  // Sellers
  { name: 'sellers_view', displayName: 'View Sellers', description: 'View seller list', category: 'sellers', action: 'view' },
  { name: 'sellers_create', displayName: 'Add Sellers', description: 'Add new sellers', category: 'sellers', action: 'create' },
  { name: 'sellers_edit', displayName: 'Edit Sellers', description: 'Edit seller information', category: 'sellers', action: 'edit' },
  { name: 'sellers_delete', displayName: 'Delete Sellers', description: 'Delete sellers', category: 'sellers', action: 'delete' },
  { name: 'sellers_manage_asins', displayName: 'Manage ASINs', description: 'Manage seller ASINs', category: 'sellers', action: 'manage' },

  // Users
  { name: 'users_view', displayName: 'View Users', description: 'View user list', category: 'users', action: 'view' },
  { name: 'users_create', displayName: 'Add Users', description: 'Add new users', category: 'users', action: 'create' },
  { name: 'users_edit', displayName: 'Edit Users', description: 'Edit user information', category: 'users', action: 'edit' },
  { name: 'users_delete', displayName: 'Delete Users', description: 'Delete users', category: 'users', action: 'delete' },
  { name: 'users_assign_roles', displayName: 'Assign Roles', description: 'Assign roles to users', category: 'users', action: 'manage' },

  // Roles & Permissions
  { name: 'roles_view', displayName: 'View Roles', description: 'View roles list', category: 'users', action: 'view' },
  { name: 'roles_create', displayName: 'Create Roles', description: 'Create new roles', category: 'users', action: 'create' },
  { name: 'roles_edit', displayName: 'Edit Roles', description: 'Edit role permissions', category: 'users', action: 'edit' },
  { name: 'roles_delete', displayName: 'Delete Roles', description: 'Delete roles', category: 'users', action: 'delete' },

  // Settings
  { name: 'settings_view', displayName: 'View Settings', description: 'View system settings', category: 'settings', action: 'view' },
  { name: 'settings_edit', displayName: 'Edit Settings', description: 'Edit system settings', category: 'settings', action: 'edit' },

  // Scraping
  { name: 'scraping_view', displayName: 'View Scraping', description: 'View scraping tasks', category: 'scraping', action: 'view' },
  { name: 'scraping_create', displayName: 'Create Tasks', description: 'Create scraping tasks', category: 'scraping', action: 'create' },
  { name: 'scraping_manage', displayName: 'Manage Scraping', description: 'Manage all scraping operations', category: 'scraping', action: 'manage' },

  // Actions (Task Management)
  { name: 'actions_view', displayName: 'View Actions', description: 'View actions and tasks', category: 'actions', action: 'view' },
  { name: 'actions_create', displayName: 'Create Actions', description: 'Create new actions', category: 'actions', action: 'create' },
  { name: 'actions_edit', displayName: 'Edit Actions', description: 'Edit existing actions', category: 'actions', action: 'edit' },
  { name: 'actions_delete', displayName: 'Delete Actions', description: 'Delete actions', category: 'actions', action: 'delete' },
  { name: 'actions_manage', displayName: 'Manage Actions', description: 'Assign and manage actions', category: 'actions', action: 'manage' },

  // Revenue Calculator
  { name: 'calculator_view', displayName: 'View Calculator', description: 'Use revenue calculator', category: 'calculator', action: 'view' },
  { name: 'calculator_bulk', displayName: 'Bulk Calculation', description: 'Use bulk calculation features', category: 'calculator', action: 'create' },
  { name: 'calculator_config', displayName: 'Configure Fees', description: 'Configure fee structures', category: 'calculator', action: 'manage' },

  // Inventory
  { name: 'inventory_view', displayName: 'View Inventory', description: 'View inventory levels', category: 'inventory', action: 'view' },
  { name: 'inventory_manage', displayName: 'Manage Inventory', description: 'Update inventory details', category: 'inventory', action: 'manage' },
];

const Permission = mongoose.model('Permission', permissionSchema);

// Static method to seed default permissions
Permission.seedDefaultPermissions = async function () {
  for (const permData of defaultPermissions) {
    await this.findOneAndUpdate(
      { name: permData.name },
      permData,
      { upsert: true, new: true }
    );
  }
};

module.exports = Permission;
