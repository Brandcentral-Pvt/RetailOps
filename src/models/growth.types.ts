/**
 * E-commerce Growth Execution System - Type Definitions
 * Supports: GMS, Ads Spend, Ad Revenue, ACoS, PO Fulfillment, Listing Score, CVR, Return Rate, Inventory Health
 */

// =====================================================
// METRIC TYPES
// =====================================================

export type MetricType =
    | 'GMS'
    | 'ADS_SPEND'
    | 'AD_REVENUE'
    | 'ACOS'
    | 'PO_FULFILLMENT'
    | 'LISTING_SCORE'
    | 'CVR'
    | 'RETURNS'
    | 'INVENTORY_HEALTH';

export type GoalStatus = 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'PENDING';
export type ScopeType = 'BRAND' | 'ASIN' | 'GLOBAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface MetricUnit {
    symbol: string;
    format: 'currency' | 'percentage' | 'number';
}

export const METRIC_CONFIG: Record<MetricType, { label: string; unit: MetricUnit; icon: string; color: string }> = {
    GMS: { label: 'Gross Merchandise Sales', unit: { symbol: '₹', format: 'currency' }, icon: 'TrendingUp', color: '#10b981' },
    ADS_SPEND: { label: 'Ads Spend', unit: { symbol: '₹', format: 'currency' }, icon: 'DollarSign', color: '#f59e0b' },
    AD_REVENUE: { label: 'Ad Revenue', unit: { symbol: '₹', format: 'currency' }, icon: 'Wallet', color: '#8b5cf6' },
    ACOS: { label: 'Advertising Cost of Sales', unit: { symbol: '%', format: 'percentage' }, icon: 'Target', color: '#ef4444' },
    PO_FULFILLMENT: { label: 'PO Fulfillment Rate', unit: { symbol: '%', format: 'percentage' }, icon: 'Package', color: '#3b82f6' },
    LISTING_SCORE: { label: 'Listing Quality Score', unit: { symbol: '', format: 'number' }, icon: 'Star', color: '#ec4899' },
    CVR: { label: 'Conversion Rate', unit: { symbol: '%', format: 'percentage' }, icon: 'Percent', color: '#06b6d4' },
    RETURNS: { label: 'Return Rate', unit: { symbol: '%', format: 'percentage' }, icon: 'RotateCcw', color: '#f97316' },
    INVENTORY_HEALTH: { label: 'Inventory Health', unit: { symbol: '%', format: 'percentage' }, icon: 'Warehouse', color: '#84cc16' },
};

// =====================================================
// GOAL MODEL
// =====================================================

export interface Goal {
    id: string;
    title: string;
    metricType: MetricType;
    targetValue: number;
    currentValue: number;
    startValue: number;
    unit: string;
    gap: number;
    runRateRequired: number;
    projectedValue: number;

    scopeType: ScopeType;
    scopeIds: string[];
    resolvedAsins: string[];

    startDate: string;
    endDate: string;
    healthStatus: GoalStatus;
    progressPercentage: number;

    drivers: string[];
    createdAt: string;
    updatedAt: string;
}

export interface GoalWithProgress extends Goal {
    daysElapsed: number;
    daysRemaining: number;
    requiredDailyRate: number;
    isOnTrack: boolean;
    trend: 'up' | 'down' | 'stable';
}

// =====================================================
// TASK MODEL
// =====================================================

export interface Task {
    id: string;
    title: string;
    description: string;
    recommendation?: string;
    hints: string[];

    type: string;
    metricType: MetricType;
    priority: TaskPriority;
    status: TaskStatus;
    impactScore: number;
    isAISuggested: boolean;
    isAIGenerated: boolean;

    scopeType: ScopeType;
    scopeIds: string[];
    resolvedAsins: string[];

    goalId?: string;

    assignedTo?: string;
    createdBy: string;
    deadline?: string;

    timeTracking?: {
        startedAt?: string;
        completedAt?: string;
        actualDuration?: number;
    };

    createdAt: string;
    updatedAt: string;
}

export interface TaskCreateInput {
    title: string;
    description: string;
    recommendation?: string;
    hints?: string[];
    type: string;
    metricType: MetricType;
    priority: TaskPriority;
    scopeType: ScopeType;
    scopeIds?: string[];
    resolvedAsins?: string[];
    goalId?: string;
    deadline?: string;
}

export interface TaskUpdateInput {
    title?: string;
    description?: string;
    recommendation?: string;
    hints?: string[];
    priority?: TaskPriority;
    status?: TaskStatus;
    scopeType?: ScopeType;
    scopeIds?: string[];
    deadline?: string;
}

export interface TaskStatusUpdate {
    status: TaskStatus;
    remarks?: string;
    audioUrl?: string;
}

// =====================================================
// METRIC SNAPSHOT MODEL
// =====================================================

export interface MetricSnapshot {
    brandId: string;
    asin?: string;
    date: string;

    gms: number;
    orders: number;
    returns: number;

    adSpend: number;
    adRevenue: number;
    acos: number;

    inventoryLevel: number;
    daysOfInventory: number;

    listingScore: number;
    conversionRate: number;
}

export interface MetricOverview {
    metricType: MetricType;
    currentValue: number;
    previousValue: number;
    targetValue?: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
    status?: GoalStatus;
}

// =====================================================
// INSIGHT MODEL
// =====================================================

export type InsightType = 'STOCK' | 'ADS' | 'LISTING' | 'REVENUE' | 'OPPORTUNITY';

export interface Insight {
    id: string;
    type: InsightType;
    metricType: MetricType;
    title: string;
    message: string;
    reasoning: string;

    affectedAsins: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';

    suggestedTask?: {
        title: string;
        description: string;
        recommendation: string;
        hints: string[];
        priority: TaskPriority;
    };

    createdAt: string;
}

// =====================================================
// PERFORMANCE CHART DATA
// =====================================================

export interface ChartDataPoint {
    date: string;
    actualValue?: number;
    targetValue?: number;
    projectedValue?: number;
}

export interface PerformanceChartData {
    metricType: MetricType;
    data: ChartDataPoint[];
    currentValue: number;
    targetValue: number;
    projectedValue: number;
    gap: number;
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

export interface GoalFilter {
    metricType?: MetricType;
    scopeType?: ScopeType;
    status?: GoalStatus;
    brandId?: string;
    asin?: string;
}

export interface TaskFilter {
    status?: TaskStatus;
    priority?: TaskPriority;
    metricType?: MetricType;
    scopeType?: ScopeType;
    goalId?: string;
    brandId?: string;
    asin?: string;
    isAISuggested?: boolean;
    search?: string;
}

export interface MetricFilter {
    brandId?: string;
    asin?: string;
    dateRange?: {
        start: string;
        end: string;
    };
    metricTypes?: MetricType[];
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface GoalsResponse extends PaginatedResponse<Goal> { }
export interface TasksResponse extends PaginatedResponse<Task> { }
export interface InsightsResponse extends PaginatedResponse<Insight> { }

// =====================================================
// UI STATE TYPES
// =====================================================

export interface ViewState {
    activeTab: 'strategic' | 'operations';
    selectedMetric: MetricType;
    searchQuery: string;
    filters: {
        status?: TaskStatus;
        priority?: TaskPriority;
        metricType?: MetricType;
    };
}

export interface ChartViewState {
    selectedMetric: MetricType;
    dateRange: '7d' | '30d' | '90d' | 'ytd';
    showProjection: boolean;
}

// =====================================================
// ACTION TYPES FOR TASK LIFECYCLE
// =====================================================

export type TaskActionType =
    | 'START'
    | 'BLOCK'
    | 'UNBLOCK'
    | 'SUBMIT_REVIEW'
    | 'COMPLETE'
    | 'REJECT'
    | 'EDIT'
    | 'DELETE';

export interface TaskAction {
    type: TaskActionType;
    taskId: string;
    payload?: {
        remarks?: string;
        audioUrl?: string;
        reviewDecision?: 'APPROVE' | 'REJECT';
        reviewComments?: string;
    };
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type ValueOf<T> = T[keyof T];

export interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    color?: string;
}

export interface DashboardCardData {
    title: string;
    value: string | number;
    previousValue?: string | number;
    change?: number;
    changeType?: 'positive' | 'negative' | 'neutral';
    target?: number;
    status?: GoalStatus;
    icon: React.ReactNode;
    color: string;
}