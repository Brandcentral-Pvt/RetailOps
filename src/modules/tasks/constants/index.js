export const WORKFLOW_STATUSES = {
  DRAFT: { label: 'Draft', color: '#64748b', bg: '#f1f5f9', antColor: 'default' },
  ASSIGNED: { label: 'Assigned', color: '#0288D1', bg: '#e0f2fe', antColor: 'processing' },
  ACCEPTED: { label: 'Accepted', color: '#9C27B0', bg: '#f5f3ff', antColor: 'purple' },
  IN_PROGRESS: { label: 'In Progress', color: '#1976D2', bg: '#eef2ff', antColor: 'processing' },
  SUBMITTED: { label: 'Submitted', color: '#ED6C02', bg: '#fff7ed', antColor: 'warning' },
  UNDER_REVIEW: { label: 'Under Review', color: '#9C27B0', bg: '#f5f3ff', antColor: 'purple' },
  APPROVED: { label: 'Approved', color: '#2E7D32', bg: '#ecfdf5', antColor: 'success' },
  REJECTED: { label: 'Rejected', color: '#D32F2F', bg: '#fef2f2', antColor: 'error' },
  REWORK: { label: 'Rework', color: '#E65100', bg: '#fff7ed', antColor: 'warning' },
  RESUBMITTED: { label: 'Resubmitted', color: '#0288D1', bg: '#e0f2fe', antColor: 'processing' },
  ESCALATED: { label: 'Escalated', color: '#D32F2F', bg: '#fef2f2', antColor: 'error' },
  CANCELLED: { label: 'Cancelled', color: '#94a3b8', bg: '#f8fafc', antColor: 'default' },
};

export const VALID_TRANSITIONS = {
  DRAFT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED', 'ESCALATED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  REJECTED: ['REWORK'],
  REWORK: ['RESUBMITTED'],
  RESUBMITTED: ['UNDER_REVIEW'],
  ESCALATED: ['IN_PROGRESS', 'UNDER_REVIEW', 'CANCELLED'],
};

export const SLA_STATUSES = {
  WITHIN_SLA: { label: 'Within SLA', color: '#2E7D32', bg: '#ecfdf5' },
  AT_RISK: { label: 'At Risk', color: '#ED6C02', bg: '#fff7ed' },
  BREACHED: { label: 'SLA Breached', color: '#D32F2F', bg: '#fef2f2' },
};

export const FREQUENCIES = [
  { value: 'ONE_TIME', label: 'One Time' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half Yearly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'CUSTOM', label: 'Custom Cron' },
];

export const DEPARTMENTS = [
  { value: 'Operations', label: 'Operations' },
  { value: 'Brand Managers', label: 'Brand Managers' },
  { value: 'Catalog Team', label: 'Catalog Team' },
];

export const CATEGORIES = [
  { value: 'LISTING', label: 'Listing' },
  { value: 'PRICING', label: 'Pricing' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'ADS', label: 'Ads' },
  { value: 'ANALYTICS', label: 'Analytics' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'GENERAL', label: 'General' },
];

export const PRIORITIES = {
  CRITICAL: { label: 'Critical', color: '#b91c1c', bg: '#fee2e2' },
  HIGH: { label: 'High', color: '#c2410c', bg: '#ffedd5' },
  MEDIUM: { label: 'Medium', color: '#b45309', bg: '#fef3c7' },
  LOW: { label: 'Low', color: '#475569', bg: '#f1f5f9' },
};

export const TARGET_TYPES = [
  { value: 'NUMERIC', label: 'Numeric' },
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'BOOLEAN', label: 'Yes/No' },
  { value: 'QUALITATIVE', label: 'Qualitative' },
];

export const COMPLEXITY_LEVELS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const APPROVAL_LEVELS = [
  { value: 'single', label: 'Single Approval' },
  { value: 'dual', label: 'Dual Approval' },
  { value: 'multi', label: 'Multi Approval' },
];

export const AUTO_ASSIGN_STRATEGIES = [
  { value: 'lowest_workload', label: 'Lowest Workload' },
  { value: 'department_based', label: 'Department Based' },
  { value: 'round_robin', label: 'Round Robin' },
];

// Task identities sourced from the Daily Operations Master workbook
// (backend/__tests__/fixtures/dailyOpsMaster.csv). DLY-004 was previously
// mislabelled "New Listing Creation" / LISTING; the master sheet defines it as
// "OOS Data Monitoring" / INVENTORY, which is also what the backend importer
// infers. The listing workflows live under DLY-0010A/B.
//
// NOTE: several other labels here are still offset from the current sheet
// (DLY-001, DLY-005..DLY-012). Reconciling them is tracked as a separate
// follow-up; only the entries the DLY-004 pilot depends on are corrected here.
export const DLY_TASK_CODES = {
  'DLY-001': { label: 'Top ASIN Performance Monitoring', category: 'PRICING', icon: 'DollarOutlined' },
  'DLY-002': { label: 'Buy Box Monitoring & Suppression Check', category: 'PRICING', icon: 'ShoppingCartOutlined' },
  'DLY-003': { label: 'ASP Monitoring & Mismatch Check', category: 'PRICING', icon: 'ArrowDownOutlined' },
  'DLY-004': { label: 'OOS Data Monitoring', category: 'INVENTORY', icon: 'WarningOutlined' },
  'DLY-005': { label: 'Order Management (DF)', category: 'INVENTORY', icon: 'ShoppingCartOutlined' },
  'DLY-006': { label: 'PO Related Activities', category: 'INVENTORY', icon: 'FileTextOutlined' },
  'DLY-007': { label: 'Ticket Raise & Follow-up', category: 'GENERAL', icon: 'EditOutlined' },
  'DLY-008': { label: 'Seller Communication & Query Resolution', category: 'GENERAL', icon: 'SafetyCertificateOutlined' },
  'DLY-009': { label: 'Priority Based Tasks', category: 'GENERAL', icon: 'CheckCircleOutlined' },
  'DLY-0010A': { label: 'Catalogue & Listing Optimization (Manual Process)', category: 'LISTING', icon: 'EditOutlined' },
  'DLY-0010B': { label: 'Catalogue & Listing Optimization (Bulk Process)', category: 'LISTING', icon: 'EditOutlined' },
  'DLY-0011': { label: 'GMS Analysis', category: 'ANALYTICS', icon: 'BarChartOutlined' },
  'DLY-0012': { label: 'Daily Business Report', category: 'ANALYTICS', icon: 'RiseOutlined' },
};

// Task codes whose submission carries an AI listing-health gate. Kept as an
// explicit set so the check never depends on a single hard-coded DLY-004 string.
export const LISTING_HEALTH_GATED_CODES = ['DLY-0010A', 'DLY-0010B'];
export const isListingHealthGated = (code) =>
  LISTING_HEALTH_GATED_CODES.some((c) => String(code || '').includes(c));

export const TASK_ISSUE_SOURCES = {
  PRICING: [
    { value: 'marketplace_glitch', label: 'Marketplace Glitch' },
    { value: 'brand_pricing_error', label: 'Brand Pricing Error' },
    { value: 'competitor_action', label: 'Competitor Action' },
    { value: 'system_calculation', label: 'System Calculation Error' },
  ],
  LISTING: [
    { value: 'missing_content', label: 'Missing Content' },
    { value: 'image_non_compliant', label: 'Image Non-Compliant' },
    { value: 'brand_guideline', label: 'Brand Guideline Change' },
    { value: 'ai_quality_flag', label: 'AI Quality Flag' },
  ],
  INVENTORY: [
    { value: 'vendor_delay', label: 'Vendor Delay' },
    { value: 'warehouse_miscount', label: 'Warehouse Miscount' },
    { value: 'supply_chain', label: 'Supply Chain Disruption' },
    { value: 'forecast_error', label: 'Forecast Error' },
  ],
  ADS: [
    { value: 'budget_cap', label: 'Budget Cap Hit' },
    { value: 'bid_adjustment', label: 'Bid Adjustment Needed' },
    { value: 'targeting_issue', label: 'Targeting Issue' },
  ],
  COMPLIANCE: [
    { value: 'document_expired', label: 'Document Expired' },
    { value: 'regulation_change', label: 'Regulation Change' },
    { value: 'certification_missing', label: 'Certification Missing' },
  ],
  GENERAL: [
    { value: 'manual_review', label: 'Manual Review Required' },
    { value: 'system_error', label: 'System Error' },
    { value: 'other', label: 'Other' },
  ],
};

export const CATEGORY_METRIC_CONFIG = {
  PRICING: {
    compareLabel: 'Live Price vs Approved ASP',
    metrics: ['SellingPrice', 'StandardPrice'],
    badge: { icon: 'DollarOutlined', color: '#0891B2' },
  },
  LISTING: {
    compareLabel: 'AI Health Score (Actual vs Target)',
    metrics: ['AIHealthScore', 'TargetScore'],
    badge: { icon: 'SafetyCertificateOutlined', color: '#2563EB' },
  },
  INVENTORY: {
    compareLabel: 'Available Stock vs Min Threshold',
    metrics: ['AvailableStock', 'MinStockThreshold'],
    badge: { icon: 'WarningOutlined', color: '#7C3AED' },
  },
  ADS: {
    compareLabel: 'Actual Spend vs Budget',
    metrics: ['ActualSpend', 'Budget'],
    badge: { icon: 'BarChartOutlined', color: '#EA580C' },
  },
  COMPLIANCE: {
    compareLabel: 'Docs Valid vs Required',
    metrics: ['ValidDocs', 'RequiredDocs'],
    badge: { icon: 'SafetyCertificateOutlined', color: '#DC2626' },
  },
  GENERAL: {
    compareLabel: 'Progress',
    metrics: ['ProgressPct'],
    badge: { icon: 'InfoCircleOutlined', color: '#64748B' },
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Task-list column grid (single source of truth for the list view).
   Must match the grid used by PremiumTaskRow's root row element.
   ───────────────────────────────────────────────────────────────────────────── */

// Task list row layout. Kept in one place because the page header row and
// PremiumTaskRow both render it and a mismatch visibly breaks the columns.
//
// Consolidated to 9 columns on purpose: an 11-column variant left the two
// flexible tracks (task + details) with only a few dozen pixels on a ~1000px
// card, so every cell wrapped and rows grew to ~400px. SLA is now a dot inside
// the Due cell and priority is a tag inside the Task cell, which is what freed
// up the width. The row is given a min-width and scrolls horizontally instead of
// crushing, so narrow desktops degrade to a scrollbar rather than a mess.
//
// [checkbox, task, seller, details, assignee, progress, status, due+sla, actions]
export const TASK_LIST_GRID = '34px minmax(0,2.1fr) 132px minmax(0,1.7fr) 158px 96px 92px 92px minmax(122px, auto)';

// Below this the columns stop being readable, so the card scrolls sideways.
export const TASK_LIST_MIN_WIDTH = 1180;
