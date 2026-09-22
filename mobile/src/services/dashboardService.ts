import apiClient from './apiClient';
import { formatCurrency, formatNumber } from '../utils/formatters';
import type {
  DashboardActivity,
  DashboardAdvertising,
  DashboardAttentionItem,
  DashboardAttentionType,
  DashboardInventory,
  DashboardMarketplace,
  DashboardProduct,
  DashboardSalesPoint,
  DashboardTasks,
} from '../data/mockDashboard';

export interface DashboardApiKpi {
  id: string;
  title: string;
  value: string;
  icon?: string;
  trend?: number | null;
  trendType?: 'up' | 'down' | 'neutral' | null;
}

export interface DashboardApiRevenueSeries {
  name: string;
  data: number[];
}

export interface DashboardApiProductRow {
  rank?: number;
  id: string | number;
  sku: string;
  asin?: string;
  title: string;
  category?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  status?: string | null;
  availability?: string | null;
  sellerName?: string | null;
  marketplace?: string | null;
  currentPrice?: number;
  revenue?: number;
  units?: number;
  acos?: string;
  gmsRevenue?: number;
  gmsUnits?: number;
  prevGmsRevenue?: number;
  prevGmsUnits?: number;
  deltaPct?: number | null;
  unitsDeltaPct?: number | null;
}

export interface DashboardApiTaskStats {
  pending: number;
  inProgress: number;
  review: number;
  completed: number;
  total: number;
}

export interface DashboardApiAlert {
  id: string | number;
  type: string;
  message: string;
  time: string;
}

export interface DashboardApiStats {
  totalSellers: number;
  activeSellers: number;
  totalAsins: number;
  activeAsins: number;
  outOfStockAsins: number;
  newThisMonthAsins: number;
}

export interface DashboardApiPeriod {
  startDate: string;
  endDate: string;
  days: number;
  granularity: string;
  bucketKeys?: string[];
}

export interface DashboardApiGms {
  revenue: number;
  units: number;
  shippedRevenue: number;
  returns: number;
  returnRate: number;
  asp: number;
  prevRevenue: number;
  prevUnits: number;
  deltaPct: number | null;
  unitsDeltaPct: number | null;
  tacos: number;
  adShare: number;
  asinsWithSales: number;
  activeDays: number;
  series: number[];
  unitsSeries: number[];
  tacosSeries: number[];
  dailyAverage: number;
}

export interface DashboardApiAds {
  adSales: number;
  adSpend: number;
  orders: number;
  organicSales: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  acos: number;
  roas: number;
}

export interface DashboardApiPrevious {
  days: number;
  adSales: number;
  adSpend: number;
  orders: number;
  organicSales: number;
  gmsRevenue: number;
  gmsUnits: number;
}

export interface DashboardApiSellerShare {
  sellerId: string;
  sellerName: string;
  marketplace: string;
  revenue: number;
  units: number;
  prevRevenue: number;
  deltaPct: number | null;
  share: number;
  asinsWithSales: number;
}

export interface DashboardApiMarketplaceShare {
  name: string;
  revenue: number;
  units: number;
  prevRevenue: number;
  sellers: number;
  share: number;
}

export interface DashboardApiResponse {
  kpi: DashboardApiKpi[];
  revenue: DashboardApiRevenueSeries[];
  labels: string[];
  category: Array<{ name: string; data: number[]; color?: string }>;
  tableData: DashboardApiProductRow[];
  roas: string;
  dailySpend?: number;
  userStats: DashboardApiTaskStats;
  teamStats: DashboardApiTaskStats | null;
  alerts: DashboardApiAlert[];
  stats: DashboardApiStats;
  period: DashboardApiPeriod;
  gms: DashboardApiGms;
  ads: DashboardApiAds;
  previous: DashboardApiPrevious;
  gmsBySeller: DashboardApiSellerShare[];
  gmsByMarketplace: DashboardApiMarketplaceShare[];
}

export interface DashboardOverview {
  sales: { value: string; changePct: number };
  orders: { value: string; changePct: number };
  adSpend: { value: string; changePct: number };
  products: { value: string; issueCount: number };
}

export interface DashboardViewData {
  overview: DashboardOverview;
  attention: DashboardAttentionItem[];
  salesTrend: DashboardSalesPoint[];
  marketplaces: DashboardMarketplace[];
  topProducts: DashboardProduct[];
  advertising: DashboardAdvertising;
  inventory: DashboardInventory;
  tasks: DashboardTasks;
  recentActivity: DashboardActivity[];
}

function toPct(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.round(value * 10) / 10;
}

function positiveDelta(value: number, previous: number): number {
  if (!previous) return 0;
  return Math.round(((value - previous) / previous) * 1000) / 10;
}

function attentionTypeFor(message: string): DashboardAttentionType {
  const text = message.toLowerCase();
  if (/stock|inventory|availability/i.test(text)) return 'inventory';
  if (/price|pricing|margin|cost/i.test(text)) return 'pricing';
  if (/order/i.test(text)) return 'order';
  return 'listing';
}

function activityTypeFor(message: string): DashboardActivity['type'] {
  const text = message.toLowerCase();
  if (/stock|inventory|availability/i.test(text)) return 'inventory';
  if (/price|pricing|margin|cost/i.test(text)) return 'pricing';
  if (/order/i.test(text)) return 'order';
  if (/ad|spend|acos|roas/i.test(text)) return 'advertising';
  return 'listing';
}

function mapDashboardToView(data: DashboardApiResponse): DashboardViewData {
  const { gms, ads, stats, alerts, previous } = data;

  const attention: DashboardAttentionItem[] = [];

  if (stats.outOfStockAsins > 0) {
    attention.push({
      id: 'attention-inventory',
      type: 'inventory',
      count: stats.outOfStockAsins,
      title: 'Products are out of stock',
      description: `${stats.outOfStockAsins} of ${stats.totalAsins} catalogue items have no stock`,
    });
  }

  for (const alert of (Array.isArray(alerts) ? alerts : []).slice(0, 4)) {
    attention.push({
      id: `attention-alert-${alert.id ?? alert.time}`,
      type: attentionTypeFor(alert.message),
      count: 1,
      title: alert.message,
      description: `${alert.type} · ${alert.time}`,
    });
  }

  const series = Array.isArray(gms.series) ? gms.series : [];
  const labels = Array.isArray(data.labels) ? data.labels : [];

  const salesTrend: DashboardSalesPoint[] = labels.map((date, index) => ({
    date,
    value: series[index] ?? 0,
  }));

  const marketplaces: DashboardMarketplace[] = (
    Array.isArray(data.gmsByMarketplace) ? data.gmsByMarketplace : []
  ).map((mp) => ({
    id: mp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: mp.name,
    sales: mp.revenue,
    orders: mp.units,
    changePct: positiveDelta(mp.revenue, mp.prevRevenue),
  }));

  const topProducts: DashboardProduct[] = (
    Array.isArray(data.tableData) ? data.tableData : []
  )
    .slice(0, 5)
    .map((row) => ({
      id: String(row.id ?? row.asin ?? row.sku),
      title: row.title,
      sku: row.sku,
      marketplace: row.marketplace ?? 'Other',
      sales: row.gmsRevenue ?? row.revenue ?? 0,
      units: row.gmsUnits ?? row.units ?? 0,
      changePct: toPct(row.deltaPct),
      imageUrl: row.imageUrl ?? undefined,
    }));

  const advertising: DashboardAdvertising = {
    adSales: ads.adSales,
    spend: ads.adSpend,
    roas: ads.roas,
    acos: ads.acos,
  };

  const inventory: DashboardInventory = {
    total: stats.totalAsins,
    healthy: Math.max(0, stats.activeAsins - stats.outOfStockAsins),
    lowStock: 0,
    outOfStock: stats.outOfStockAsins,
  };

  const tasksSource = data.userStats ?? {
    pending: 0,
    inProgress: 0,
    review: 0,
  };

  const tasks: DashboardTasks = {
    pending: tasksSource.pending ?? 0,
    inProgress: tasksSource.inProgress ?? 0,
    review: tasksSource.review ?? 0,
  };

  const recentActivity: DashboardActivity[] = (
    Array.isArray(alerts) ? alerts : []
  )
    .slice(0, 5)
    .map((alert, index) => ({
      id: String(alert.id ?? `activity-alert-${index}`),
      type: activityTypeFor(alert.message),
      title: alert.message,
      description: `Alert · ${alert.type}`,
      timestamp: alert.time,
    }));

  return {
    overview: {
      sales: {
        value: formatCurrency(gms.revenue),
        changePct: toPct(gms.deltaPct),
      },
      orders: {
        value: formatNumber(ads.orders),
        changePct: toPct(positiveDelta(ads.orders, previous.orders)),
      },
      adSpend: {
        value: formatCurrency(ads.adSpend),
        changePct: toPct(positiveDelta(ads.adSpend, previous.adSpend)),
      },
      products: {
        value: formatNumber(stats.activeAsins || stats.totalAsins),
        issueCount: stats.outOfStockAsins,
      },
    },
    attention,
    salesTrend,
    marketplaces,
    topProducts,
    advertising,
    inventory,
    tasks,
    recentActivity,
  };
}

export const dashboardService = {
  async getDashboard(period: string): Promise<DashboardApiResponse> {
    const { data } = await apiClient.get<DashboardApiResponse>('/dashboard', {
      params: { period },
    });
    return data;
  },

  mapDashboardToView,
};

export default dashboardService;