export const ACTIONS_BY_TYPE = {
  ASIN: [
    { value: 'create_task', label: 'Create Task', hasValue: false, group: 'Tasks', icon: 'CheckSquare', description: 'Auto-create an actionable task for this ASIN' },
    { value: 'create_task_high', label: 'Create Urgent Task', hasValue: false, group: 'Tasks', icon: 'AlertTriangle', description: 'Create a high-priority urgent task' },
    { value: 'create_group_task', label: 'Create Group Task', hasValue: false, group: 'Tasks', icon: 'FolderOpen', description: 'Group all matched items into 1 main task with sub-tasks', hasConfig: true },

    { value: 'send_notification', label: 'Send Notification', hasValue: false, group: 'Alerts', icon: 'Bell', description: 'In-app notification to team members' },
    { value: 'send_email', label: 'Send Email Alert', hasValue: false, group: 'Alerts', icon: 'Mail', description: 'Email alert to configured recipients' },

    { value: 'add_tag', label: 'Add Tag', hasValue: true, unit: 'tag name', group: 'Labels', icon: 'Tag', description: 'Add a descriptive tag to the ASIN' },
    { value: 'remove_tag', label: 'Remove Tag', hasValue: true, unit: 'tag name', group: 'Labels', icon: 'TagOff', description: 'Remove a specific tag from the ASIN' },

    { value: 'flag_review', label: 'Flag for Review', hasValue: false, group: 'Listing', icon: 'Eye', description: 'Mark ASIN for manual review by team' },
  ],
};

export const GROUP_BY_OPTIONS = [
  { value: 'seller', label: 'Seller' },
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'bsrRange', label: 'BSR Range' },
  { value: 'priceRange', label: 'Price Range' },
];

export const SOP_PRESETS = {
  pricing: [
    { stepNo: 1, title: 'Review Affected ASINs', description: 'Identify all ASINs with pricing discrepancies.' },
    { stepNo: 2, title: 'Check Active Deals', description: 'Verify if any discrepancy is caused by an active deal badge.' },
    { stepNo: 3, title: 'Contact Channel Team', description: 'Raise a ticket with the channel/pricing team.' },
    { stepNo: 4, title: 'Update Prices', description: 'Update prices for all affected ASINs.' },
    { stepNo: 5, title: 'Verify Resolution', description: 'Confirm all ASINs now show correct prices.' },
    { stepNo: 6, title: 'Close Task', description: 'Mark all sub-tasks as completed and submit for review.' },
  ],
  listing: [
    { stepNo: 1, title: 'Review Affected ASINs', description: 'Identify all ASINs with listing quality issues.' },
    { stepNo: 2, title: 'Prioritize by Impact', description: 'Rank ASINs by BSR, revenue, or LQS score.' },
    { stepNo: 3, title: 'Create Optimization Plan', description: 'Define specific improvements for each ASIN.' },
    { stepNo: 4, title: 'Implement Changes', description: 'Update titles, images, bullets, descriptions.' },
    { stepNo: 5, title: 'Verify Improvements', description: 'Confirm LQS scores improved.' },
  ],
  inventory: [
    { stepNo: 1, title: 'Review Stock Levels', description: 'Check current stock levels for all affected ASINs.' },
    { stepNo: 2, title: 'Contact Supply Chain', description: 'Coordinate restocking.' },
    { stepNo: 3, title: 'Update Inventory', description: 'Update stock levels.' },
    { stepNo: 4, title: 'Monitor Restock', description: 'Track until items are back in stock.' },
  ],
  custom: [],
};

export const TASK_PRIORITIES = [
  { value: 'Critical', label: 'Critical', color: '#C62828' },
  { value: 'High', label: 'High', color: '#ED6C02' },
  { value: 'Medium', label: 'Medium', color: '#b45309' },
  { value: 'Low', label: 'Low', color: '#6b7280' },
];

export const TASK_DEADLINES = [
  { value: '1 day', label: 'Tomorrow' },
  { value: '3 days', label: 'In 3 days' },
  { value: '7 days', label: 'In 1 week' },
  { value: '14 days', label: 'In 2 weeks' },
  { value: '30 days', label: 'In 1 month' },
];

export default {
  ACTIONS_BY_TYPE,
  TASK_PRIORITIES,
  TASK_DEADLINES,
  GROUP_BY_OPTIONS,
  SOP_PRESETS,
};
