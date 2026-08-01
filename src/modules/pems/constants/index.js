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

export const DLY_TASK_CODES = {
  'DLY-001': { label: 'Price Mismatch Detection', category: 'PRICING', icon: 'DollarOutlined' },
  'DLY-002': { label: 'BuyBox Loss Alert', category: 'PRICING', icon: 'ShoppingCartOutlined' },
  'DLY-003': { label: 'Competitor Price Drop', category: 'PRICING', icon: 'ArrowDownOutlined' },
  'DLY-004': { label: 'New Listing Creation', category: 'LISTING', icon: 'FileTextOutlined' },
  'DLY-005': { label: 'Listing Quality Audit', category: 'LISTING', icon: 'SafetyCertificateOutlined' },
  'DLY-006': { label: 'Image Compliance Check', category: 'LISTING', icon: 'EyeOutlined' },
  'DLY-007': { label: 'Content Optimization', category: 'LISTING', icon: 'EditOutlined' },
  'DLY-008': { label: 'Stock Replenishment Alert', category: 'INVENTORY', icon: 'WarningOutlined' },
  'DLY-009': { label: 'Inventory Accuracy Check', category: 'INVENTORY', icon: 'CheckCircleOutlined' },
  'DLY-010': { label: 'Overstock Clearance', category: 'INVENTORY', icon: 'ArrowDownOutlined' },
  'DLY-011': { label: 'Ad Spend Anomaly', category: 'ADS', icon: 'BarChartOutlined' },
  'DLY-012': { label: 'Campaign Performance Review', category: 'ADS', icon: 'RiseOutlined' },
  'DLY-013': { label: 'Compliance Documentation', category: 'COMPLIANCE', icon: 'FileTextOutlined' },
  'DLY-014': { label: 'Regulatory Update Check', category: 'COMPLIANCE', icon: 'SafetyCertificateOutlined' },
};

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
