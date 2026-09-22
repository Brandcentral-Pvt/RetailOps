export type DashboardAttentionType =
  | 'listing'
  | 'inventory'
  | 'pricing'
  | 'order';

export interface DashboardMetric {
  value: number;
  changePct: number;
}

export interface DashboardAttentionItem {
  id: string;
  type: DashboardAttentionType;
  count: number;
  title: string;
  description: string;
}

export interface DashboardSalesPoint {
  date: string;
  value: number;
}

export interface DashboardMarketplace {
  id: string;
  name: string;
  sales: number;
  orders: number;
  changePct: number;
}

export interface DashboardProduct {
  id: string;
  title: string;
  sku: string;
  marketplace: string;
  sales: number;
  units: number;
  changePct: number;
  imageUrl?: string;
}

export interface DashboardAdvertising {
  adSales: number;
  spend: number;
  roas: number;
  acos: number;
}

export interface DashboardInventory {
  total: number;
  healthy: number;
  lowStock: number;
  outOfStock: number;
}

export interface DashboardTasks {
  pending: number;
  inProgress: number;
  review: number;
}

export interface DashboardActivity {
  id: string;
  type:
    | 'listing'
    | 'inventory'
    | 'pricing'
    | 'order'
    | 'advertising';
  title: string;
  description: string;
  timestamp: string;
}

export interface MockDashboardData {
  greeting: string;

  period: {
    key: '7d' | '30d' | '3m' | '1y';
    label: string;
  };

  overview: {
    sales: DashboardMetric;
    orders: DashboardMetric;
    adSpend: DashboardMetric;
    products: {
      value: number;
      issueCount: number;
    };
  };

  attention: DashboardAttentionItem[];

  salesTrend: DashboardSalesPoint[];

  marketplaces: DashboardMarketplace[];

  topProducts: DashboardProduct[];

  advertising: DashboardAdvertising;

  inventory: DashboardInventory;

  tasks: DashboardTasks;

  recentActivity: DashboardActivity[];
}

export const MOCK_DASHBOARD: MockDashboardData = {
  greeting: 'Good morning',

  period: {
    key: '30d',
    label: 'Last 30 days',
  },

  overview: {
    sales: {
      value: 2426800,
      changePct: 12.4,
    },

    orders: {
      value: 1284,
      changePct: 8.2,
    },

    adSpend: {
      value: 182400,
      changePct: -3.1,
    },

    products: {
      value: 438,
      issueCount: 12,
    },
  },

  attention: [
    {
      id: 'attention-listings',
      type: 'listing',
      count: 8,
      title: 'Listings need attention',
      description: 'Incomplete content or missing attributes',
    },
    {
      id: 'attention-inventory',
      type: 'inventory',
      count: 3,
      title: 'Products are out of stock',
      description: 'Potential sales impact detected',
    },
    {
      id: 'attention-pricing',
      type: 'pricing',
      count: 5,
      title: 'Pricing issues detected',
      description: 'Products outside your configured price range',
    },
    {
      id: 'attention-orders',
      type: 'order',
      count: 2,
      title: 'Orders require attention',
      description: 'Action may be required',
    },
  ],

  salesTrend: [
    { date: 'Sep 01', value: 68200 },
    { date: 'Sep 03', value: 71500 },
    { date: 'Sep 05', value: 74800 },
    { date: 'Sep 07', value: 73100 },
    { date: 'Sep 09', value: 77600 },
    { date: 'Sep 11', value: 79200 },
    { date: 'Sep 13', value: 82400 },
    { date: 'Sep 15', value: 85600 },
    { date: 'Sep 17', value: 83800 },
    { date: 'Sep 19', value: 88400 },
    { date: 'Sep 21', value: 91400 },
    { date: 'Sep 23', value: 94200 },
    { date: 'Sep 25', value: 92600 },
    { date: 'Sep 27', value: 97800 },
    { date: 'Sep 29', value: 102400 },
  ],

  marketplaces: [
    {
      id: 'amazon',
      name: 'Amazon',
      sales: 1426000,
      orders: 1024,
      changePct: 14.2,
    },
    {
      id: 'myntra',
      name: 'Myntra',
      sales: 512400,
      orders: 162,
      changePct: 8.4,
    },
    {
      id: 'ajio',
      name: 'Ajio',
      sales: 284600,
      orders: 64,
      changePct: -2.8,
    },
    {
      id: 'flipkart',
      name: 'Flipkart',
      sales: 203400,
      orders: 34,
      changePct: 11.6,
    },
  ],

  topProducts: [
    {
      id: 'product-1',
      title: 'Premium Cotton Oversized T-Shirt',
      sku: 'BC-TS-001',
      marketplace: 'Amazon',
      sales: 482600,
      units: 1284,
      changePct: 18.2,
    },
    {
      id: 'product-2',
      title: 'Classic Regular Fit Cotton Shirt',
      sku: 'BC-SH-014',
      marketplace: 'Myntra',
      sales: 391200,
      units: 942,
      changePct: 7.4,
    },
    {
      id: 'product-3',
      title: 'Slim Fit Casual Trousers',
      sku: 'BC-TR-008',
      marketplace: 'Amazon',
      sales: 328400,
      units: 721,
      changePct: -2.1,
    },
    {
      id: 'product-4',
      title: 'Relaxed Fit Linen Shirt',
      sku: 'BC-SH-021',
      marketplace: 'Ajio',
      sales: 286800,
      units: 604,
      changePct: 11.8,
    },
    {
      id: 'product-5',
      title: 'Everyday Essential Polo',
      sku: 'BC-PO-007',
      marketplace: 'Flipkart',
      sales: 218600,
      units: 512,
      changePct: 4.6,
    },
  ],

  advertising: {
    adSales: 2460000,
    spend: 182400,
    roas: 13.48,
    acos: 7.41,
  },

  inventory: {
    total: 438,
    healthy: 391,
    lowStock: 34,
    outOfStock: 13,
  },

  tasks: {
    pending: 8,
    inProgress: 3,
    review: 2,
  },

  recentActivity: [
    {
      id: 'activity-1',
      type: 'listing',
      title: 'Listing updated',
      description: 'Premium Cotton Oversized T-Shirt was updated on Amazon',
      timestamp: '12 min ago',
    },
    {
      id: 'activity-2',
      type: 'inventory',
      title: 'Low stock detected',
      description: 'Classic Regular Fit Cotton Shirt has reached its stock threshold',
      timestamp: '38 min ago',
    },
    {
      id: 'activity-3',
      type: 'pricing',
      title: 'Price changed',
      description: 'Slim Fit Casual Trousers price was updated on Amazon',
      timestamp: '1 hr ago',
    },
    {
      id: 'activity-4',
      type: 'order',
      title: 'Order requires attention',
      description: '2 orders are waiting for action',
      timestamp: '2 hrs ago',
    },
    {
      id: 'activity-5',
      type: 'advertising',
      title: 'Advertising performance updated',
      description: 'ROAS increased to 13.48x for the selected period',
      timestamp: '3 hrs ago',
    },
  ],
};

export default MOCK_DASHBOARD;