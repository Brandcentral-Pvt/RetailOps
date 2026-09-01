import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { marketSyncApi } from '../services/api';
import { apiClient } from '../lib/api-client';
import { db } from '../services/db';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useDashboardOrchestration } from './useDashboardOrchestration';
import { useTargetPermissions } from './useTargetPermissions';
import { useSocket } from '../contexts/SocketContext';

export interface DashboardFilters {
    sellerId: string;
    managerId: string;
    goalType: string;
    dateRange: { start: Date | null; end: Date | null };
}

export interface ModuleStats {
    targets: {
        total: number;
        onTrack: number;
        atRisk: number;
        completed: number;
        rate: number;
    };
    asins: {
        total: number;
        active: number;
        outOfStock: number;
        newThisMonth: number;
    };
    ads: {
        totalSpend: number;
        totalSales: number;
        acos: number;
        roas: number;
        campaigns: number;
    };
    tasks: {
        total: number;
        completed: number;
        pending: number;
        overdue: number;
        inProgress: number;
        todo: number;
    };
    alerts: {
        total: number;
        critical: number;
        warning: number;
        info: number;
        unread: number;
    };
    pipeline: {
        total: number;
        running: number;
        completed: number;
        failed: number;
        idle: number;
    };
}

export function useDashboardData(filters: DashboardFilters) {
    const { user } = useAuth();
    const { isBrandManager } = useTargetPermissions();
    const socket = useSocket();

    // Use existing orchestration hook - single source of truth
    const orch = useDashboardOrchestration({
        sellerId: filters.sellerId === 'all' ? undefined : filters.sellerId,
        managerId: filters.managerId === 'all' ? undefined : filters.managerId,
        startDate: filters.dateRange.start 
            ? format(filters.dateRange.start, 'yyyy-MM-dd') 
            : undefined,
        endDate: filters.dateRange.end 
            ? format(filters.dateRange.end, 'yyyy-MM-dd') 
            : undefined,
    });

    // Load optimization tasks with React Query caching
    const tasksQuery = useQuery({
        queryKey: ['tasks', 'optimization', filters.sellerId],
        queryFn: async () => {
            const params: any = {};
            if (filters.sellerId && filters.sellerId !== 'all') {
                params.sellerId = filters.sellerId;
            }
            const r = await apiClient.get('/tasks', { params });
            const tasks = (r as any).data?.data?.tasks || (r as any).data?.tasks || (r as any).data?.data || [];
            return Array.isArray(tasks) ? tasks : [];
        },
        staleTime: 300_000,
        gcTime: 300_000,
        refetchOnWindowFocus: true,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    const optimizationTasks = tasksQuery.data ?? [];

    // Compute module stats - using orchestration data with optimized memoization
    const moduleStats: ModuleStats = useMemo(() => {
        const targetsList = orch.targets || [];

        // Filter by selected seller/manager
        let filteredTargets = targetsList;
        if (filters.sellerId && filters.sellerId !== 'all') {
            filteredTargets = filteredTargets.filter((t: any) => 
                t.SellerId === filters.sellerId
            );
        }
        if (filters.managerId && filters.managerId !== 'all') {
            filteredTargets = filteredTargets.filter((t: any) => 
                t.BrandManager === filters.managerId
            );
        }
        if (filters.goalType && filters.goalType !== 'all') {
            filteredTargets = filteredTargets.filter((t: any) => 
                (t.GoalType || 'GMS').toUpperCase() === filters.goalType
            );
        }

        // Targets stats
        let totalTarget = 0;
        let totalAchieved = 0;
        let onTrack = 0;
        let atRisk = 0;
        let completed = 0;

        filteredTargets.forEach((t: any) => {
            totalTarget += (t.TotalTargetValue || 0);
            totalAchieved += (t.overallAchieved || 0);
            const pct = t.TotalTargetValue > 0 
                ? (t.overallAchieved / t.TotalTargetValue) * 100 
                : 0;
            if (pct >= 100) completed++;
            else if (pct >= 50) onTrack++;
            else atRisk++;
        });

        // Ads stats from dashboard raw
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        const adSalesData = adsPerf[0]?.data || [];
        const adSpendData = adsPerf[1]?.data || [];
        const totalAdSales = adSalesData.reduce((a: number, b: number) => a + b, 0);
        const totalAdSpend = adSpendData.reduce((a: number, b: number) => a + b, 0);

        // Get sellerIds for selected manager
        const managerSellers = new Set(
            targetsList
                .filter((t: any) => t.BrandManager === filters.managerId)
                .map((t: any) => t.SellerId)
        );

        // Tasks stats
        let tasks = optimizationTasks;
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        const taskCompleted = tasks.filter((t: any) => 
            t.status === 'COMPLETED' || t.status === 'completed'
        ).length;
        const taskPending = tasks.filter((t: any) => 
            t.status === 'PENDING' || t.status === 'pending'
        ).length;
        const taskOverdue = tasks.filter((t: any) => {
            if (t.status === 'COMPLETED' || t.status === 'completed') return false;
            if (t.dueDate) return new Date(t.dueDate) < new Date();
            return false;
        }).length;
        const taskInProgress = tasks.filter((t: any) => 
            t.status === 'IN_PROGRESS' || t.status === 'in_progress'
        ).length;
        const taskTodo = tasks.filter((t: any) => 
            t.status === 'TODO' || t.status === 'todo'
        ).length;

        // Pipeline stats from orchestration
        const scrapeTasks = orch.scrapeTasks || [];
        let finalScrapeTasks = scrapeTasks;
        if (filters.sellerId && filters.sellerId !== 'all') {
            finalScrapeTasks = finalScrapeTasks.filter((t: any) => t.sellerId === filters.sellerId);
        }
        if (filters.managerId && filters.managerId !== 'all') {
            finalScrapeTasks = finalScrapeTasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        const running = finalScrapeTasks.filter((t: any) => t.status === 'RUNNING').length;
        const pipeCompleted = finalScrapeTasks.filter((t: any) => t.status === 'COMPLETED').length;
        const failed = finalScrapeTasks.filter((t: any) => t.status === 'FAILED').length;
        const idle = finalScrapeTasks.filter((t: any) => 
            t.status === 'IDLE' || !t.status
        ).length;

        // Alerts stats from orchestration logs
        const activityLogs = orch.activityLogs || [];
        let finalLogs = activityLogs;
        if (filters.sellerId && filters.sellerId !== 'all') {
            finalLogs = finalLogs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || sId === filters.sellerId;
            });
        }
        if (filters.managerId && filters.managerId !== 'all') {
            finalLogs = finalLogs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || managerSellers.has(sId);
            });
        }
        const criticalLogs = finalLogs.filter((l: any) => {
            const t = (l.Type || l.type || '').toUpperCase();
            return t.includes('ERROR') || t.includes('FAILURE');
        }).length;
        const warningLogs = finalLogs.filter((l: any) => {
            const t = (l.Type || l.type || '').toUpperCase();
            return t.includes('DELETE') || t === 'UPDATE';
        }).length;

        return {
            targets: {
                total: filteredTargets.length,
                onTrack,
                atRisk,
                completed,
                rate: totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0,
            },
            asins: {
                total: orch.dashboardRaw?.stats?.totalAsins || 0,
                active: orch.dashboardRaw?.stats?.activeAsins || 0,
                outOfStock: orch.dashboardRaw?.stats?.outOfStockAsins || 0,
                newThisMonth: orch.dashboardRaw?.stats?.newThisMonthAsins || 0,
            },
            ads: {
                totalSpend: totalAdSpend,
                totalSales: totalAdSales,
                acos: totalAdSales > 0 ? (totalAdSpend / totalAdSales) * 100 : 0,
                roas: totalAdSpend > 0 ? totalAdSales / totalAdSpend : 0,
                campaigns: 0,
            },
            tasks: {
                total: tasks.length,
                completed: taskCompleted,
                pending: taskPending,
                overdue: taskOverdue,
                inProgress: taskInProgress,
                todo: taskTodo,
            },
            alerts: {
                total: finalLogs.length,
                critical: criticalLogs,
                warning: warningLogs,
                info: finalLogs.length - criticalLogs - warningLogs,
                unread: 0,
            },
            pipeline: {
                total: finalScrapeTasks.length,
                running,
                completed: pipeCompleted,
                failed,
                idle,
            },
        };
    }, [orch.targets, orch.dashboardRaw, optimizationTasks, 
        filters.sellerId, filters.managerId, filters.goalType]);

    const managerSellers = useMemo(() => {
        const targetsList = orch.targets || [];
        return new Set(
            targetsList
                .filter((t: any) => t.BrandManager === filters.managerId)
                .map((t: any) => t.SellerId)
        );
    }, [orch.targets, filters.managerId]);

    const filteredTasks = useMemo(() => {
        let tasks = optimizationTasks;
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        return tasks;
    }, [optimizationTasks, managerSellers, filters.managerId]);

    const filteredScrapeTasks = useMemo(() => {
        let tasks = orch.scrapeTasks || [];
        if (filters.sellerId && filters.sellerId !== 'all') {
            tasks = tasks.filter((t: any) => t.sellerId === filters.sellerId);
        }
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        return tasks;
    }, [orch.scrapeTasks, managerSellers, filters.sellerId, filters.managerId]);

    const filteredActivityLogs = useMemo(() => {
        let logs = (orch.activityLogs || []).slice(0, 50);
        if (filters.sellerId && filters.sellerId !== 'all') {
            logs = logs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || sId === filters.sellerId;
            });
        }
        if (filters.managerId && filters.managerId !== 'all') {
            logs = logs.filter((l: any) => {
                const sId = l.SellerId || l.sellerId;
                return !sId || managerSellers.has(sId);
            });
        }
        return logs;
    }, [orch.activityLogs, managerSellers, filters.sellerId, filters.managerId]);

    const filteredTopProducts = useMemo(() => {
        let list = orch.topProducts || [];
        if (filters.managerId && filters.managerId !== 'all') {
            list = list.filter((p: any) => managerSellers.has(p.sellerId || p.SellerId || p.brand));
        }
        return list;
    }, [orch.topProducts, managerSellers, filters.managerId]);

    return {
        // Raw & Filtered data
        sellers: [],  // Will be loaded from orchestration if needed
        userSellers: [],
        managers: [],
        activityLogs: filteredActivityLogs,
        scrapeTasks: filteredScrapeTasks,
        optimizationTasks: filteredTasks,
        topProducts: filteredTopProducts,
        
        // Orchestration data
        orch,
        
        // Computed
        moduleStats,
        
        // Loading states
        loading: orch.isLoadingKpis,
        isHydrated: orch.isHydrated,
        
        // Actions
        refresh: () => {
            orch.forceRefresh?.();
        },
    };
}
