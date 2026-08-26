import dayjs from 'dayjs';
import { ADMIN_ROLES } from '../../constants/permissions';

export const TASK_TYPES = [
  { value: 'A+_CONTENT', label: 'A+ Content' },
  { value: 'IMAGES', label: 'Images' },
  { value: 'BULLET_POINTS', label: 'Bullet Points' },
  { value: 'REVIEWS', label: 'Reviews' },
  { value: 'PRICING', label: 'Pricing' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'KEYWORDS', label: 'Keywords' },
  { value: 'PPC', label: 'PPC' },
  { value: 'TITLE', label: 'Title' },
  { value: 'BACKEND_KEYWORDS', label: 'Backend Keywords' },
  { value: 'LISTING_QUALITY', label: 'Listing Quality' },
  { value: 'BRAND_REGISTRY', label: 'Brand Registry' },
  { value: 'GENERAL', label: 'General' },
];

export const ACTION_TYPES = [
  { value: 'GENERAL_OPTIMIZATION', label: 'General Optimization' },
  { value: 'LISTING_ENHANCEMENT', label: 'Listing Enhancement' },
  { value: 'AD_CAMPAIGN', label: 'Ad Campaign' },
  { value: 'INVENTORY_MANAGEMENT', label: 'Inventory Management' },
  { value: 'REVIEW_MANAGEMENT', label: 'Review Management' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do', color: 'var(--bc-slate-500)', bg: 'var(--bc-slate-100)' },
  { value: 'PENDING', label: 'Pending', color: '#E65100', bg: 'var(--bc-amber-100)' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'var(--bc-ro-500)', bg: 'var(--bc-indigo-50)' },
  { value: 'REVIEW', label: 'Review', color: 'var(--bc-purple-500)', bg: 'var(--bc-violet-50)' },
  { value: 'COMPLETED', label: 'Completed', color: '#2E7D32', bg: '#ecfdf5' },
  { value: 'REJECTED', label: 'Rejected', color: '#e11d48', bg: '#fff1f2' },
];

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low', color: 'var(--bc-slate-500)', bg: 'var(--bc-slate-100)', icon: 'ArrowDownOutlined' },
  { value: 'MEDIUM', label: 'Medium', color: '#E65100', bg: 'var(--bc-amber-100)', icon: 'MinusOutlined' },
  { value: 'HIGH', label: 'High', color: '#ED6C02', bg: '#fff7ed', icon: 'ArrowUpOutlined' },
  { value: 'CRITICAL', label: 'Critical', color: '#D32F2F', bg: 'var(--bc-red-50)', icon: 'ExclamationCircleOutlined' },
];

const ROLES = {
  SUPERADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  ANALYST: 'analyst',
  USER: 'user',
};

const PERMISSIONS = {
  create_task: ['super_admin', 'admin', 'manager', 'analyst'],
  create_objective: ['super_admin', 'admin', 'manager'],
  edit_any_task: ['super_admin', 'admin', 'manager'],
  edit_own_task: ['super_admin', 'admin', 'manager', 'analyst', 'user'],
  delete_task: ['super_admin', 'admin'],
  delete_objective: ['super_admin', 'admin'],
  assign_users: ['super_admin', 'admin', 'manager'],
  set_priority: ['super_admin', 'admin', 'manager', 'analyst'],
  set_reviewer: ['super_admin', 'admin', 'manager'],
  approve_reject: ['super_admin', 'admin', 'manager'],
  view_all_tasks: ['super_admin', 'admin', 'manager', 'analyst'],
  view_assigned_only: ['user'],
  change_status: ['super_admin', 'admin', 'manager', 'analyst', 'user'],
  view_analytics: ['super_admin', 'admin', 'manager', 'analyst'],
  bulk_operations: ['super_admin', 'admin'],
};

export const can = (currentUser, action) => {
  if (!currentUser) return false;
  let role = (currentUser?.role?.name || currentUser?.role || '').toLowerCase();

  // Normalize to permission keys — EXACT matches only (substring matching
  // let roles like 'supervisor' escalate to super_admin).
  // ADMIN_ROLES: ['admin', 'super_admin', 'supert admin'] — see constants/permissions.js
  if (role !== 'admin' && ADMIN_ROLES.includes(role)) {
    role = 'super_admin';
  } else if (role === 'admin' || role === 'developer') {
    role = 'admin';
  } else if (role.includes('operational') || role.includes('operation') || role === 'manager') {
    role = 'manager';
  } else if (role.includes('brand') || role.includes('catalog') || role.includes('listing')) {
    role = 'analyst';
  } else if (role.includes('analyst')) {
    role = 'analyst';
  } else if (role.includes('viewer')) {
    role = 'user';
  }
  
  return (PERMISSIONS[action] || []).includes(role);
};

export const formatUserName = (user) => {
  if (!user) return 'Unknown';
  if (user.firstName || user.lastName) return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return user.email || user.name || 'Unknown';
};

export const buildUserSelectOptions = (users, roleFilter = null) => {
  if (!users) return [];
  let filtered = users;
  if (roleFilter) {
    const roles = Array.isArray(roleFilter) ? roleFilter : [roleFilter];
    filtered = users.filter(u => {
      const role = (u?.role?.name || u?.role || '').toLowerCase();
      return roles.includes(role);
    });
  }
  return filtered.map(u => ({
    value: u._id || u.id,
    label: formatUserName(u),
    role: u?.role?.name || u?.role || '',
    email: u.email || '',
  }));
};

export const getStatusStyle = (status) => {
  const s = STATUS_OPTIONS.find(opt => opt.value === (status || '').toUpperCase());
  if (!s) return { color: 'var(--bc-slate-500)', bg: 'var(--bc-slate-100)', border: 'var(--bc-slate-200)' };
  return { color: s.color, bg: s.bg, border: s.color + '30' };
};

export const getPriorityStyle = (priority) => {
  const p = PRIORITY_OPTIONS.find(opt => opt.value === (priority || '').toUpperCase());
  if (!p) return { color: 'var(--bc-slate-500)', bg: 'var(--bc-slate-100)', border: 'var(--bc-slate-200)' };
  return { color: p.color, bg: p.bg, border: p.color + '30' };
};

export const validateForm = async (values, rules) => {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = values[field];
    for (const rule of fieldRules) {
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors[field] = rule.message || `${field} is required`;
        break;
      }
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        errors[field] = rule.message || `Minimum ${rule.minLength} characters`;
        break;
      }
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        errors[field] = rule.message || `Maximum ${rule.maxLength} characters`;
        break;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors[field] = rule.message || 'Invalid format';
        break;
      }
      if (rule.custom) {
        const err = rule.custom(value, values);
        if (err) {
          errors[field] = err;
          break;
        }
      }
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
};

export const MODAL_STYLES = {
  headerStyle: { borderBottom: '1px solid var(--bc-slate-100)', padding: '16px 24px' },
  bodyStyle: { padding: '20px 24px' },
  footerStyle: { borderTop: '1px solid var(--bc-slate-100)', padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 },
  primaryBtn: { height: 36, borderRadius: 8, fontWeight: 600, background: 'var(--bc-ro-500)', border: 'none', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' },
  dangerBtn: { height: 36, borderRadius: 8, fontWeight: 600 },
  cancelBtn: { height: 36, borderRadius: 8 },
  labelStyle: { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' },
  inputStyle: { height: 34, borderRadius: 8, fontSize: 13 },
  sectionDivider: { fontSize: 11, fontWeight: 700, color: 'var(--bc-slate-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 12 },
};

export const getReviewerCandidates = (users) => {
  if (!users) return [];
  return users.filter(u => can(u, 'approve_reject'));
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};
