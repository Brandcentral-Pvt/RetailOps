/**
 * useDashboardData - Main hook for fetching complete dashboard snapshot
 * Uses React Query for caching, background refetching, and stale-while-revalidate
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { fetchDashboardSnapshot, subscribeToDashboardUpdates } from '../services/dashboardApi';
import type { DashboardFilters, DashboardSnapshot, DashboardState } from '../types';

const DEFAULT_REFRESH_INTERVAL = 60000; // 1 minute
const STALE_TIME = 30000; // 30 seconds

export function useDashboardData(
  initialFilters: DashboardFilters,
  options?: {
    refreshInterval?: number;
    autoRefresh?: boolean;
    enableStreaming?: boolean;
  }
) {
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    autoRefresh = true,
    enableStreaming = false,
  } = options || {};

  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [state, setState] = useState<DashboardState>({
    snapshot: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastSuccessfulFetch: null,
    refreshInterval,
    autoRefreshEnabled: autoRefresh,
  });

  const queryClient = useQueryClient();

  // Main query for dashboard snapshot
  const {
    data: snapshot,
    isLoading,
    isFetching,
    isRefetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['dashboard-v2', filters],
    queryFn: () => fetchDashboardSnapshot(filters),
    staleTime: STALE_TIME,
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  });

  // Update state when query results change
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      snapshot: snapshot || null,
      isLoading,
      isRefreshing: isFetching || isRefetching,
      error: error as Error | null,
      lastSuccessfulFetch: dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : prev.lastSuccessfulFetch,
    }));
  }, [snapshot, isLoading, isFetching, isRefetching, error, dataUpdatedAt]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled || !snapshot) return;

    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refreshInterval, refetch, snapshot]);

  // Real-time streaming updates
  useEffect(() => {
    if (!enableStreaming) return;

    const unsubscribe = subscribeToDashboardUpdates(
      (update) => {
        // Optimistically update cache based on stream update
        queryClient.setQueryData(['dashboard-v2', filters], (old: any) => {
          if (!old) return old;

          switch (update.type) {
            case 'kpis':
              return {
                ...old,
                kpis: update.action === 'update' 
                  ? old.kpis.map((k: any) => 
                      k.id === update.payload.id ? { ...k, ...update.payload.data } : k
                    )
                  : update.action === 'insert'
                  ? [...old.kpis, update.payload.data]
                  : old.kpis.filter((k: any) => k.id !== update.payload.id),
              };
            case 'alerts':
              return {
                ...old,
                alerts: update.action === 'insert'
                  ? [update.payload.data, ...old.alerts]
                  : old.alerts,
              };
            case 'tasks':
              return {
                ...old,
                tasks: update.action === 'update'
                  ? old.tasks.map((t: any) =>
                      t.id === update.payload.id ? { ...t, ...update.payload.data } : t
                    )
                  : old.tasks,
              };
            case 'goals':
              return {
                ...old,
                goals: update.action === 'update'
                  ? old.goals.map((g: any) =>
                      g.id === update.payload.id ? { ...g, ...update.payload.data } : g
                    )
                  : old.goals,
              };
            default:
              return old;
          }
        });
      },
      (streamError) => {
        console.error('[useDashboardData] Stream error:', streamError);
      }
    );

    return () => unsubscribe();
  }, [enableStreaming, filters, queryClient]);

  // Action handlers
  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isRefreshing: true }));
    try {
      await refetch();
    } finally {
      setState((prev) => ({ ...prev, isRefreshing: false }));
    }
  }, [refetch]);

  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-v2'] });
  }, [queryClient]);

  const toggleAutoRefresh = useCallback(() => {
    setState((prev) => ({ ...prev, autoRefreshEnabled: !prev.autoRefreshEnabled }));
  }, []);

  return {
    // State
    snapshot,
    isLoading,
    isRefreshing,
    error,
    lastSuccessfulFetch: state.lastSuccessfulFetch,
    autoRefreshEnabled: state.autoRefreshEnabled,

    // Data shortcuts
    kpis: snapshot?.kpis || [],
    goals: snapshot?.goals || [],
    tasks: snapshot?.tasks || [],
    alerts: snapshot?.alerts || [],
    products: snapshot?.topProducts || [],
    revenue: snapshot?.revenue,
    ads: snapshot?.ads,
    inventory: snapshot?.inventory,

    // Actions
    refresh,
    updateFilters,
    invalidateCache,
    toggleAutoRefresh,
    setFilters,

    // Metadata
    filters,
  };
}
