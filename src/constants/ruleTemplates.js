/**
 * Pre-built rule templates.
 * Each template can be loaded with one click in the Rule Builder.
 */
export const RULE_TEMPLATES = [
  {
    id: 'low-lqs-alert',
    name: 'Low LQS Alert',
    category: 'Listing Quality',
    description: 'Flag ASINs with LQS below 70 for immediate optimization',
    icon: 'Shield',
    color: '#EF4444',
    rules: [
      {
        order: 0,
        name: 'LQS below 70',
        isActive: true,
        conditions: [
          { attribute: 'lqs', operator: '<', value: 70, value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'create_group_task', groupBy: 'seller', priority: 'High', sopPreset: 'listing' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Daily',
    runTime: '08 AM',
  },
  {
    id: 'buy-box-lost',
    name: 'Buy Box Lost',
    category: 'Pricing',
    description: 'Create urgent tasks when we lose the Buy Box',
    icon: 'Zap',
    color: '#F59E0B',
    rules: [
      {
        order: 0,
        name: 'Lost Buy Box',
        isActive: true,
        conditions: [
          { attribute: 'buyBoxWin', operator: '=', value: 'false', value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'create_task_high' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Daily',
    runTime: '09 AM',
  },
  {
    id: 'price-dispute',
    name: 'Price Dispute Detected',
    category: 'Pricing',
    description: 'Channel price differs from live marketplace price',
    icon: 'AlertTriangle',
    color: '#EF4444',
    rules: [
      {
        order: 0,
        name: 'Price mismatch detected',
        isActive: true,
        conditions: [
          { attribute: 'priceDispute', operator: '=', value: 'true', value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'create_group_task', groupBy: 'seller', priority: 'Critical', sopPreset: 'pricing' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Daily',
    runTime: '10 AM',
  },
  {
    id: 'out-of-stock',
    name: 'Out of Stock Alert',
    category: 'Inventory',
    description: 'Urgent tasks for ASINs that show Out of Stock on Amazon',
    icon: 'Package',
    color: '#DC2626',
    rules: [
      {
        order: 0,
        name: 'Stock at zero',
        isActive: true,
        conditions: [
          { attribute: 'stockLevel', operator: '=', value: 0, value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'create_group_task', groupBy: 'seller', priority: 'Critical', sopPreset: 'inventory' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Daily',
    runTime: '07 AM',
  },
  {
    id: 'low-inventory',
    name: 'Low Inventory (< 20 units)',
    category: 'Inventory',
    description: 'Restock ASINs before they go completely out of stock',
    icon: 'Package',
    color: '#F59E0B',
    rules: [
      {
        order: 0,
        name: 'Stock under 20 units',
        isActive: true,
        conditions: [
          { attribute: 'stockLevel', operator: 'between', value: 1, value2: 20, logicalOp: 'AND' },
        ],
        action: { actionType: 'create_group_task', groupBy: 'seller', priority: 'High', sopPreset: 'inventory' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Daily',
    runTime: '08 AM',
  },
  {
    id: 'bsr-dropping',
    name: 'BSR Dropping (Top 5K)',
    category: 'Performance',
    description: 'Catch BSR deterioration early for top-ranked ASINs',
    icon: 'TrendingDown',
    color: '#F97316',
    rules: [
      {
        order: 0,
        name: 'BSR under 5000 with downtrend',
        isActive: true,
        conditions: [
          { attribute: 'bsr', operator: '<', value: 5000, value2: '', logicalOp: 'AND' },
          { attribute: 'bsrTrend', operator: '=', value: 'Down', value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'create_task', priority: 'High' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Weekly',
    runTime: '09 AM',
  },
  {
    id: 'poor-rating',
    name: 'Low Rating Alert (< 3.5★)',
    category: 'Performance',
    description: 'Flag ASINs with ratings below 3.5 for review',
    icon: 'Star',
    color: '#DC2626',
    rules: [
      {
        order: 0,
        name: 'Rating below 3.5',
        isActive: true,
        conditions: [
          { attribute: 'rating', operator: '<', value: 3.5, value2: '', logicalOp: 'AND' },
          { attribute: 'reviewCount', operator: '>', value: 5, value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'create_task', priority: 'High' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Weekly',
    runTime: '10 AM',
  },
  {
    id: 'no-images',
    name: 'Missing Images (fewer than 5)',
    category: 'Listing Quality',
    description: 'ASINs with too few images suppress conversion',
    icon: 'Image',
    color: '#8B5CF6',
    rules: [
      {
        order: 0,
        name: 'Images below 5',
        isActive: true,
        conditions: [
          { attribute: 'imagesCount', operator: '<', value: 5, value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'create_group_task', groupBy: 'brand', priority: 'Medium', sopPreset: 'listing' },
      },
    ],
    isAutomated: false,
  },
  {
    id: 'missing-aplus',
    name: 'No A+ Content',
    category: 'Listing Quality',
    description: 'Tag ASINs missing A+ content for brand team',
    icon: 'FileText',
    color: '#6366F1',
    rules: [
      {
        order: 0,
        name: 'A+ content missing',
        isActive: true,
        conditions: [
          { attribute: 'hasAplus', operator: '=', value: 'false', value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'add_tag', value: 'Needs A+' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Weekly',
    runTime: '11 AM',
  },
  {
    id: 'high-discount',
    name: 'Heavy Discount (> 50%)',
    category: 'Pricing',
    description: 'ASINs discounting MRP by more than 50% — margin risk',
    icon: 'Percent',
    color: '#EC4899',
    rules: [
      {
        order: 0,
        name: 'Discount over 50%',
        isActive: true,
        conditions: [
          { attribute: 'discountPercentage', operator: '>', value: 50, value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'send_notification' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Daily',
    runTime: '06 PM',
  },
  {
    id: 'needs-review',
    name: 'Flag for Manual Review',
    category: 'Operations',
    description: 'ASINs with error status get flagged for operations team',
    icon: 'Eye',
    color: '#0EA5E9',
    rules: [
      {
        order: 0,
        name: 'Error status',
        isActive: true,
        conditions: [
          { attribute: 'asinStatus', operator: '=', value: 'Error', value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'flag_review' },
      },
    ],
    isAutomated: true,
    runFrequency: 'Daily',
    runTime: '08 AM',
  },
  {
    id: 'zero-reviews',
    name: 'Zero Reviews',
    category: 'Performance',
    description: 'New ASINs with no customer reviews yet',
    icon: 'MessageSquare',
    color: '#78716C',
    rules: [
      {
        order: 0,
        name: 'Review count is 0',
        isActive: true,
        conditions: [
          { attribute: 'reviewCount', operator: '=', value: 0, value2: '', logicalOp: 'AND' },
        ],
        action: { actionType: 'add_tag', value: 'No Reviews' },
      },
    ],
    isAutomated: false,
  },
];

export const RULE_CATEGORIES = [
  { id: 'Listing Quality', color: '#6366F1', icon: 'Shield' },
  { id: 'Pricing', color: '#EF4444', icon: 'DollarSign' },
  { id: 'Inventory', color: '#F59E0B', icon: 'Package' },
  { id: 'Performance', color: '#10B981', icon: 'TrendingUp' },
  { id: 'Operations', color: '#0EA5E9', icon: 'Settings' },
];

export default RULE_TEMPLATES;
