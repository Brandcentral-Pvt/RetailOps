/**
 * Dashboard V2 - API Service Layer
 * Handles all data fetching with proper error handling, caching, and typing
 */

import { apiClient } from '../../../lib/api-client';
import type {
  DashboardSnapshot,
  DashboardFilters,
  KpiMetric,
  GoalProgress,
  Alert,
  OptimizedTask,
  ProductPerformance,
  AdsPerformance,
  InventoryHealth,
  DashboardApiResponse,
  StreamUpdate,
} from '../types';

// =====================================================
// API ENDPOINTS
// =====================================================

const ENDPOINTS = {
  DASHBOARD_SNAPSHOT: '/dashboard/v2/snapshot',
  KPIS: '/dashboard/v2/kpis',
  GOALS: '/goals',
  TASKS: '/tasks/optimized',
  ALERTS: '/alerts',
  PRODUCTS: '/analytics/products',
  ADS: '/ads/performance',
  INVENTORY: '/inventory/health',
  REVENUE: '/analytics/revenue',
  CONVERSION: '/analytics/conversion',
  LISTING_QUALITY: '/analytics/listing-quality',
  ANOMALIES: '/analytics/anomalies',
};

// =====================================================
// QUERY PARAMS BUILDER
// =====================================================

function buildQueryParams(filters: DashboardFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.dateRange.start) {
    params.startDate = filters.dateRange.start.toISOString().split('T')[0];
  }
  if (filters.dateRange.end) {
    params.endDate = filters.dateRange.end.toISOString().split('T')[0];
  }
  if (filters.sellerIds?.length) {
    params.sellerIds = filters.sellerIds.join(',');
  }
  if (filters.managerId) {
    params.managerId = filters.managerId;
  }
  if (filters.metricTypes?.length) {
    params.metricTypes = filters.metricTypes.join(',');
  }
  if (filters.categories?.length) {
    params.categories = filters.categories.join(',');
  }
  if (filters.asins?.length) {
    params.asins = filters.asins.join(',');
  }
  if (filters.includeProjections) {
    params.includeProjections = 'true';
  }
  if (filters.comparePreviousPeriod) {
    params.comparePreviousPeriod = 'true';
  }

  return params;
}

// =====================================================
// MAIN DASHBOARD FETCH
// =====================================================

export async function fetchDashboardSnapshot(
  filters: DashboardFilters
): Promise<DashboardSnapshot> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<DashboardApiResponse>(ENDPOINTS.DASHBOARD_SNAPSHOT, { params });
    
    if (!response.data.success) {
      throw new Error(response.data.meta?.processingTimeMs ? 'Dashboard fetch failed' : 'Unknown error');
    }

    return response.data.data;
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch snapshot:', error);
    throw error;
  }
}

// =====================================================
// INDIVIDUAL DATA FETCHERS
// =====================================================

export async function fetchKpis(filters: DashboardFilters): Promise<KpiMetric[]> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<{ success: boolean; data: KpiMetric[] }>(ENDPOINTS.KPIS, { params });
    return response.data.data || [];
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch KPIs:', error);
    return [];
  }
}

export async function fetchGoals(filters: DashboardFilters): Promise<GoalProgress[]> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<{ success: boolean; data: GoalProgress[] }>(ENDPOINTS.GOALS, { params });
    return response.data.data || [];
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch goals:', error);
    return [];
  }
}

export async function fetchTasks(filters: DashboardFilters): Promise<OptimizedTask[]> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<{ success: boolean; data: OptimizedTask[] }>(ENDPOINTS.TASKS, { params });
    return response.data.data || [];
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch tasks:', error);
    return [];
  }
}

export async function fetchAlerts(filters: DashboardFilters): Promise<Alert[]> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<{ success: boolean; data: Alert[] }>(ENDPOINTS.ALERTS, { params });
    return response.data.data || [];
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch alerts:', error);
    return [];
  }
}

export async function fetchTopProducts(filters: DashboardFilters): Promise<ProductPerformance[]> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<{ success: boolean; data: ProductPerformance[] }>(ENDPOINTS.PRODUCTS, { params });
    return response.data.data || [];
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch products:', error);
    return [];
  }
}

export async function fetchAdsPerformance(filters: DashboardFilters): Promise<AdsPerformance> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<{ success: boolean; data: AdsPerformance }>(ENDPOINTS.ADS, { params });
    return response.data.data;
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch ads performance:', error);
    throw error;
  }
}

export async function fetchInventoryHealth(filters: DashboardFilters): Promise<InventoryHealth> {
  try {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<{ success: boolean; data: InventoryHealth }>(ENDPOINTS.INVENTORY, { params });
    return response.data.data;
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch inventory health:', error);
    throw error;
  }
}

// =====================================================
// ACTION MUTATIONS
// =====================================================

export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
  try {
    await apiClient.post(`${ENDPOINTS.ALERTS}/${alertId}/acknowledge`, {
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Dashboard API] Failed to acknowledge alert:', error);
    throw error;
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  completedBy?: string
): Promise<void> {
  try {
    await apiClient.patch(`${ENDPOINTS.TASKS}/${taskId}`, {
      status,
      ...(completedBy && { completedBy }),
      ...(status === 'COMPLETED' && { completedAt: new Date().toISOString() }),
    });
  } catch (error) {
    console.error('[Dashboard API] Failed to update task status:', error);
    throw error;
  }
}

// DISABLED (2026-10-21): legacy Actions module removed — POST /actions/execute never
// existed on the backend and this helper had no callers. Kept as reference only.
// export async function executeAction(actionType: string, payload: any): Promise<any> {
//   try {
//     const response = await apiClient.post('/actions/execute', {
//       actionType,
//       payload,
//       executedAt: new Date().toISOString(),
//     });
//     return response.data;
//   } catch (error) {
//     console.error('[Dashboard API] Failed to execute action:', error);
//     throw error;
//   }
// }

// =====================================================
// REAL-TIME SUBSCRIPTION (WebSocket/SSE)
// =====================================================

let eventSource: EventSource | null = null;

export function subscribeToDashboardUpdates(
  onUpdate: (update: StreamUpdate) => void,
  onError?: (error: Event) => void
): () => void {
  if (!window.EventSource) {
    console.warn('[Dashboard API] Server-Sent Events not supported');
    return () => {};
  }

  const url = `${import.meta.env.VITE_API_BASE_URL || ''}/dashboard/v2/stream`;
  eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const update: StreamUpdate = JSON.parse(event.data);
      onUpdate(update);
    } catch (error) {
      console.error('[Dashboard API] Failed to parse stream update:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('[Dashboard API] Stream error:', error);
    onError?.(error);
  };

  return () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

export function unsubscribeFromUpdates(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

// =====================================================
// DATA TRANSFORM UTILITIES
// =====================================================

export function transformRawKpiToMetric(raw: any): KpiMetric {
  return {
    id: raw.id || raw._id,
    metricType: raw.metricType,
    label: raw.label || raw.metricType,
    currentValue: raw.currentValue ?? 0,
    previousValue: raw.previousValue ?? 0,
    targetValue: raw.targetValue,
    unit: raw.unit || '',
    format: raw.format || 'number',
    trend: raw.trend || 'stable',
    changePercent: raw.changePercent ?? 0,
    changeAbsolute: raw.changeAbsolute ?? 0,
    status: raw.status || 'PENDING',
    sparkline: raw.sparkline || [],
    isLoaded: true,
  };
}

export function calculateDataFreshness(lastUpdated: string): {
  stalenessSeconds: number;
  status: 'ok' | 'delayed' | 'failed';
} {
  const now = new Date();
  const lastUpdate = new Date(lastUpdated);
  const diffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

  let status: 'ok' | 'delayed' | 'failed' = 'ok';
  if (diffSeconds > 300) status = 'failed';
  else if (diffSeconds > 60) status = 'delayed';

  return { stalenessSeconds: diffSeconds, status };
}
