/**
 * Dashboard V2 - Data-Driven Type Definitions
 * Enterprise-grade types for real-time analytics dashboard
 */

import { MetricType, GoalStatus, TaskStatus, TaskPriority } from '../../../models/growth.types';

// =====================================================
// CORE DATA MODELS
// =====================================================

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface ComparativeTimeSeries {
  current: TimeSeriesDataPoint[];
  previous?: TimeSeriesDataPoint[];
  target?: TimeSeriesDataPoint[];
  projection?: TimeSeriesDataPoint[];
}

export interface KpiMetric {
  id: string;
  metricType: MetricType;
  label: string;
  currentValue: number;
  previousValue: number;
  targetValue?: number;
  unit: string;
  format: 'currency' | 'percentage' | 'number' | 'ratio';
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  changeAbsolute: number;
  status: GoalStatus;
  sparkline?: TimeSeriesDataPoint[];
  isLoaded: boolean;
}

export interface RevenueBreakdown {
  totalRevenue: number;
  organicRevenue: number;
  adsRevenue: number;
  otherRevenue: number;
  breakdown: Array<{
    source: string;
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

export interface AdsPerformance {
  spend: number;
  revenue: number;
  acos: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  campaigns: {
    total: number;
    active: number;
    paused: number;
    archived: number;
  };
  topCampaigns: Array<{
    id: string;
    name: string;
    spend: number;
    revenue: number;
    acos: number;
    status: 'active' | 'paused';
  }>;
}

export interface InventoryHealth {
  totalSkuCount: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockCount: number;
  inventoryValue: number;
  daysOfInventory: number;
  sellThroughRate: number;
  stockoutLossEstimate: number;
  items: Array<{
    asin: string;
    title: string;
    sku: string;
    quantity: number;
    status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock';
    daysRemaining: number;
    recommendedAction: string;
  }>;
}

export interface ListingQuality {
  averageScore: number;
  totalListings: number;
  excellentCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  factors: Array<{
    factor: 'images' | 'title' | 'bullets' | 'description' | 'keywords' | 'reviews';
    score: number;
    weight: number;
    issues: string[];
  }>;
  improvementOpportunities: Array<{
    asin: string;
    currentScore: number;
    potentialScore: number;
    actions: string[];
    estimatedImpact: number;
  }>;
}

export interface ConversionMetrics {
  overallCvr: number;
  sessionCount: number;
  unitSessionPercentage: number;
  pageViews: number;
  buyBoxPercentage: number;
  cartAddRate: number;
  purchaseRate: number;
  byAsin: Array<{
    asin: string;
    title: string;
    cvr: number;
    sessions: number;
    units: number;
    rank: number;
  }>;
}

// =====================================================
// GOAL & TARGET TRACKING
// =====================================================

export interface GoalProgress {
  id: string;
  title: string;
  metricType: MetricType;
  targetValue: number;
  currentValue: number;
  startValue: number;
  progressPercent: number;
  gap: number;
  gapPercent: number;
  runRateRequired: number;
  projectedValue: number;
  projectedAchievement: number;
  isOnTrack: boolean;
  daysElapsed: number;
  daysRemaining: number;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  trend: 'accelerating' | 'on pace' | 'decelerating' | 'stalled';
  contributors: Array<{
    asin?: string;
    sellerId?: string;
    contribution: number;
    contributionPercent: number;
  }>;
}

export interface TargetVsActual {
  period: string;
  metric: MetricType;
  target: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'ahead' | 'on track' | 'behind' | 'critical';
}

// =====================================================
// ALERTS & ANOMALIES
// =====================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertCategory = 'inventory' | 'ads' | 'listing' | 'sales' | 'competitor' | 'system';

export interface Alert {
  id: string;
  type: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  description?: string;
  affectedEntities: Array<{
    type: 'asin' | 'campaign' | 'seller' | 'keyword';
    id: string;
    name: string;
  }>;
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolution?: string;
  recommendedActions: string[];
  metadata?: Record<string, any>;
}

export interface AnomalyDetection {
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  deviationPercent: number;
  confidence: number;
  direction: 'spike' | 'drop' | 'unusual_pattern';
  possibleCauses: string[];
  impactedMetrics: string[];
}

// =====================================================
// TASKS & ACTIONS
// =====================================================

export interface OptimizedTask {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  type: 'optimization' | 'fix' | 'opportunity' | 'maintenance';
  metricType: MetricType;
  priority: TaskPriority;
  status: TaskStatus;
  impactScore: number;
  effortLevel: 'low' | 'medium' | 'high';
  estimatedImpact: {
    metric: MetricType;
    currentValue: number;
    projectedValue: number;
    uplift: number;
    confidence: number;
  };
  relatedGoals: string[];
  relatedAsins: string[];
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  aiGenerated: boolean;
  aiReasoning?: string;
}

export interface ActionItem {
  id: string;
  taskId?: string;
  title: string;
  actionType: 'update_listing' | 'adjust_bid' | 'reorder_inventory' | 'pause_campaign' | 'create_content';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo: string;
  dueDate: string;
  completedAt?: string;
  result?: any;
}

// =====================================================
// PRODUCT & ASIN ANALYTICS
// =====================================================

export interface ProductPerformance {
  asin: string;
  parentAsin?: string;
  title: string;
  brand: string;
  category: string;
  sellerId: string;
  metrics: {
    gms: number;
    units: number;
    revenue: number;
    orders: number;
    returns: number;
    refundRate: number;
  };
  ads: {
    spend: number;
    revenue: number;
    acos: number;
    attributedUnits: number;
  };
  ranking: {
    bsr: number;
    bsrCategory: string;
    keywordRankings: Array<{
      keyword: string;
      position: number;
      change: number;
    }>;
  };
  inventory: {
    quantity: number;
    daysOfInventory: number;
    status: 'in_stock' | 'low' | 'out' | 'overstock';
  };
  listing: {
    qualityScore: number;
    reviewCount: number;
    averageRating: number;
    buyBoxPercentage: number;
  };
  trend: {
    gmsTrend: 'up' | 'down' | 'stable';
    gmsChangePercent: number;
    rankTrend: 'up' | 'down' | 'stable';
    rankChange: number;
  };
}

export interface CompetitorAnalysis {
  asin: string;
  yourProduct: {
    price: number;
    rating: number;
    reviewCount: number;
    bsr: number;
  };
  competitors: Array<{
    asin: string;
    title: string;
    price: number;
    priceDifference: number;
    rating: number;
    reviewCount: number;
    bsr: number;
    isBuyBoxWinner: boolean;
    strengths: string[];
    weaknesses: string[];
  }>;
  recommendations: string[];
}

// =====================================================
// DASHBOARD COMPOSITE TYPES
// =====================================================

export interface DashboardSnapshot {
  timestamp: string;
  period: {
    start: string;
    end: string;
    label: string;
  };
  filters: {
    sellerIds?: string[];
    managerId?: string;
    metricTypes?: MetricType[];
  };
  kpis: KpiMetric[];
  revenue: RevenueBreakdown;
  ads: AdsPerformance;
  inventory: InventoryHealth;
  listing: ListingQuality;
  conversion: ConversionMetrics;
  goals: GoalProgress[];
  alerts: Alert[];
  anomalies: AnomalyDetection[];
  tasks: OptimizedTask[];
  topProducts: ProductPerformance[];
  dataFreshness: {
    lastUpdated: string;
    nextUpdate: string;
    stalenessSeconds: number;
    sources: Array<{
      name: string;
      lastSync: string;
      status: 'ok' | 'delayed' | 'failed';
    }>;
  };
}

export interface DashboardState {
  snapshot: DashboardSnapshot | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  lastSuccessfulFetch: string | null;
  refreshInterval: number;
  autoRefreshEnabled: boolean;
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

export interface DashboardFilters {
  dateRange: {
    start: Date;
    end: Date;
    preset?: 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'mtd' | 'qtd' | 'ytd';
  };
  sellerIds?: string[];
  managerId?: string;
  metricTypes?: MetricType[];
  categories?: string[];
  asins?: string[];
  includeProjections?: boolean;
  comparePreviousPeriod?: boolean;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface DashboardApiResponse {
  success: boolean;
  data: DashboardSnapshot;
  meta: {
    requestId: string;
    generatedAt: string;
    processingTimeMs: number;
    cacheHit: boolean;
  };
}

export interface StreamUpdate {
  type: 'kpis' | 'alerts' | 'tasks' | 'goals';
  action: 'update' | 'insert' | 'delete';
  payload: any;
  timestamp: string;
}

// =====================================================
// UI CONFIGURATION TYPES
// =====================================================

export interface WidgetConfig {
  id: string;
  type: 'kpi_card' | 'chart' | 'table' | 'alert_feed' | 'task_list' | 'goal_tracker';
  title: string;
  isVisible: boolean;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { row: number; col: number };
  dataSources: string[];
  refreshRate?: number;
  config?: Record<string, any>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
}
