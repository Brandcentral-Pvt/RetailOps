import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { marketSyncApi, userApi } from '../services/api';
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
    const [sellers, setSellers] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [scrapeTasks, setScrapeTasks] = useState<any[]>([]);

    const matchesManagerFilter = useCallback((target: any, managerId: string) => {
        if (!managerId || managerId === 'all') return true;
        if (String(target?.UserId || '') === String(managerId)) return true;
        const mgr = managers.find((m: any) => String(m.id) === String(managerId));
        if (mgr) {
            return String(target?.BrandManager || '').toLowerCase() === String(mgr.name || '').toLowerCase();
        }
        return String(target?.BrandManager || '').toLowerCase() === String(managerId).toLowerCase();
    }, [managers]);

    // ✅ Seller filters may be a comma-separated id list (manager → seller
    // resolution produces lists) — compare against every id, not the raw string.
    const matchesSellerFilter = useCallback((target: any, sellerId: string) => {
        if (!sellerId || sellerId === 'all') return true;
        const ids = String(sellerId).split(',').map((s: string) => s.trim()).filter(Boolean);
        if (ids.length === 0) return true;
        return ids.includes(String(target?.SellerId ?? ''));
    }, []);

    // Use existing orchestration hook
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

    // Load sellers
    useEffect(() => {
        api.sellerApi.getAll({ page: 1, limit: 500 })
            .then((res: any) => {
                const list = res?.data?.sellers || res?.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            })
            .catch(console.error);
    }, []);

    // Filter sellers list based on user role (RBAC)
    const userSellers = useMemo(() => {
        if (!user) return [];
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase().trim();
        const isMgr = roleName === 'brand manager' || roleName === 'brand_manager' || isBrandManager;

        if (isMgr) {
            const assigned = user.assignedSellers || [];
            return assigned.map((s: any) => {
                const sid = s.sellerId || s.SellerId || s._id || s.Id || s;
                const match = sellers.find(x => (x._id || x.id) === sid);
                return {
                    id: sid,
                    name: match?.name || s.name || s.SellerName || sid
                };
            });
        }

        return sellers.map(s => ({
            id: s._id || s.id,
            name: s.name || s.SellerName || s._id || s.id
        }));
    }, [user, sellers, isBrandManager]);

    // Load real managers from the user API; fall back to targets-derived names
    useEffect(() => {
        let cancelled = false;
        const mgrMap = new Map<string, string>();

        const load = async () => {
            try {
                const r: any = await userApi.getManagers();
                const data = r?.data?.data ?? r?.data ?? r ?? [];
                const list: any[] = Array.isArray(data) ? data : data?.users || [];
                (list || []).forEach((m: any) => {
                    const mid = m._id || m.id;
                    if (!mid) return;
                    const firstName = m.firstName || m.FirstName || '';
                    const lastName = m.lastName || m.LastName || '';
                    const name = `${firstName} ${lastName}`.trim() || m.displayName || m.name || m.email || mid;
                    if (!mgrMap.has(String(mid))) mgrMap.set(String(mid), name);
                });
            } catch (err) {
                console.warn('Failed to load managers:', err);
            }

            const targetsList = orch.targets || [];
            targetsList.forEach((t: any) => {
                if (t.BrandManager && !mgrMap.has(String(t.BrandManager))) {
                    mgrMap.set(String(t.BrandManager), String(t.BrandManager));
                }
            });

            if (cancelled) return;
            setManagers(Array.from(mgrMap.entries()).map(([id, name]) => ({ id, name })));
        };

        load();
        return () => { cancelled = true; };
    }, [orch.targets]);

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
        staleTime: 2 * 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    });

    const optimizationTasks = tasksQuery.data ?? [];

    // Load activity logs
    // ✅ Envelope fix: /logs returns { success, data: [...] } but this hook
    // checked Array.isArray on the whole payload, so activity logs NEVER
    // rendered. Unwrap the envelope and tolerate both shapes.
    const loadLogs = useCallback(async () => {
        try {
            const res: any = await db.getSystemLogs();
            const payload = Array.isArray(res)
                ? res
                : res?.data ?? res?.logs ?? [];
            if (Array.isArray(payload)) {
                setActivityLogs(payload.slice(0, 10));
            }
        } catch (err) {
            console.error('Failed to load logs:', err);
        }
    }, []);

    // Load pipeline tasks
    const loadPipeline = useCallback(async () => {
        try {
            const res = await marketSyncApi.getSyncTasks();
            setScrapeTasks(res?.tasks || []);
        } catch (err) {
            console.error('Failed to load pipeline:', err);
        }
    }, []);

    // Real-time socket sync for activity logs
    useEffect(() => {
        if (!socket) return;

        const handleNewLog = (data: any) => {
            if (!data) return;
            const normalized = {
                ...data,
                _id: data._id || data.id || data.Id,
                createdAt: data.createdAt || data.CreatedAt,
                type: data.type || data.Type || '',
                entityType: data.entityType || data.EntityType || '',
                entityTitle: data.entityTitle || data.EntityTitle || '',
                description: data.description || data.Description || '',
                metadata: data.metadata || data.Metadata || null,
                user: data.user || null,
            };
            setActivityLogs(prev => {
                const next = [normalized, ...prev];
                return next.slice(0, 10);
            });
        };

        socket.on('new_system_log', handleNewLog);
        return () => socket.off('new_system_log', handleNewLog);
    }, [socket]);

    useEffect(() => {
        loadLogs();
        loadPipeline();
        const interval = setInterval(() => {
            loadPipeline();
        }, 30000);
        return () => clearInterval(interval);
    }, [loadLogs, loadPipeline]);

    // Compute module stats
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
                matchesManagerFilter(t, filters.managerId)
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

        // Get sellerIds for selected manager (match UserId OR BrandManager name)
        const managerSellers = new Set(
            targetsList
                .filter((t: any) => matchesManagerFilter(t, filters.managerId))
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
        const taskPending = tasks.filter((t: any) => {
            const s = String(t.status || '').toLowerCase();
            // ✅ Status-source fix: Tasks-table statuses are 'To-Do', legacy
            // Actions used 'PENDING' — count both so "pending" stays accurate.
            return s === 'pending' || s === 'to-do' || s === 'todo';
        }).length;
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

        // Pipeline stats
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

        // Alerts stats (Filter by manager and seller if mapping exists)
        let finalLogs = activityLogs;
        // Search logs for matches
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
        activityLogs, scrapeTasks, filters, matchesManagerFilter]);

    const managerSellers = useMemo(() => {
        const targetsList = orch.targets || [];
        return new Set(
            targetsList
                .filter((t: any) => matchesManagerFilter(t, filters.managerId))
                .map((t: any) => t.SellerId)
        );
    }, [orch.targets, filters.managerId, matchesManagerFilter]);

    const filteredTasks = useMemo(() => {
        let tasks = optimizationTasks;
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        return tasks;
    }, [optimizationTasks, managerSellers, filters.managerId]);

    const filteredScrapeTasks = useMemo(() => {
        let tasks = scrapeTasks;
        if (filters.sellerId && filters.sellerId !== 'all') {
            tasks = tasks.filter((t: any) => matchesSellerFilter(t, filters.sellerId));
        }
        if (filters.managerId && filters.managerId !== 'all') {
            tasks = tasks.filter((t: any) => managerSellers.has(t.sellerId));
        }
        return tasks;
    }, [scrapeTasks, managerSellers, filters.sellerId, filters.managerId, matchesSellerFilter]);

    const filteredActivityLogs = useMemo(() => {
        let logs = activityLogs;
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
    }, [activityLogs, managerSellers, filters.sellerId, filters.managerId]);

    const filteredTopProducts = useMemo(() => {
        let list = orch.topProducts || [];
        if (filters.managerId && filters.managerId !== 'all') {
            list = list.filter((p: any) => managerSellers.has(p.sellerId || p.SellerId || p.brand));
        }
        return list;
    }, [orch.topProducts, managerSellers, filters.managerId]);

    return {
        // Raw & Filtered data
        sellers,
        userSellers,
        managers,
        activityLogs: filteredActivityLogs,
        scrapeTasks: filteredScrapeTasks,
        optimizationTasks: filteredTasks,
        topProducts: filteredTopProducts,
        
        // Orchestration data
        orch,
        
        // Computed
        moduleStats,
        
        // Loading
        loading: orch.isLoadingKpis,
        isHydrated: orch.isHydrated,
        
        // Helpers
        matchesManagerFilter,
        matchesSellerFilter,
        
        // Actions
        refresh: () => {
            orch.forceRefresh?.();
            loadLogs();
            loadPipeline();
        },
        loadPipeline,
    };
}
