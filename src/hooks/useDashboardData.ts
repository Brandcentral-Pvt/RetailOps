import { useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { dashboardDateKey,sameDashboardScope } from '../utils/dashboardRange.mjs';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardOrchestration } from './useDashboardOrchestration';
import { dashboardPrincipal,matchesDashboardScope,isDashboardGlobal,canDashboardPermission } from '../utils/dashboardScope.mjs';
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
        rate: number|null;
    };
    asins: {
        total: number;
        active: number;
        outOfStock: number;
        newThisMonth: number;
    };
    ads: {
        totalSpend: number|null;
        totalSales: number|null;
        acos: number|null;
        roas: number|null;
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
    const {user,refreshUser}=useAuth();
    const principal=dashboardPrincipal(user);
    const socket=useSocket();
    const orch=useDashboardOrchestration({
        sellerId:filters.sellerId==='all'?undefined:filters.sellerId,
        managerId:filters.managerId==='all'?undefined:filters.managerId,
        startDate:dashboardDateKey(filters.dateRange.start),
        endDate:dashboardDateKey(filters.dateRange.end),
    });
    const scope=orch.scope;
    // A role change invalidates authorization, not just a chart. Reload the
    // authenticated profile; the principal-keyed dashboard then remounts.
    useEffect(()=>{
        if(!socket||!principal)return;
        let active=true;let controller:AbortController|null=null;
        const revalidate=async()=>{
            controller?.abort();const request=new AbortController();controller=request;
            try{const r=await apiClient.get('/auth/me',{signal:request.signal});const next=r.data?.data;
                if(active&&!request.signal.aborted&&next&&String(next.Id??next.id??next._id)===String(user.Id??user.id??user._id))refreshUser(next);
            }catch{if(active&&!request.signal.aborted)void orch.forceRefresh();}
        };
        socket.on('access_profile_changed',revalidate);
        return ()=>{active=false;controller?.abort();socket.off('access_profile_changed',revalidate);};
    },[socket,principal,refreshUser,orch.forceRefresh]);
    const scopeKey=scope?JSON.stringify([scope.unrestricted,scope.empty,scope.sellerIds]):'unresolved';
    const canTasks=canDashboardPermission(user,'tasks_view');
    const canPipeline=canDashboardPermission(user,'scraping_view');
    // Logs are system-wide, not seller/date filtered. Never request them for
    // a filtered or restricted dashboard even if the user has the permission.
    const canLogs=!!principal&&isDashboardGlobal(user)&&canDashboardPermission(user,'activitylogs_view')&&!!scope?.unrestricted;
    const optionsQuery=useQuery({
        queryKey:['dashboard','options',principal],
        enabled:!!principal,
        queryFn:async({signal})=>(await apiClient.get('/dashboard/options',{signal})).data.data,
        staleTime:60_000,gcTime:0,placeholderData:undefined,
        retry:false,
    });
    const sellers=optionsQuery.isError?[]:optionsQuery.data?.sellers??[];
    const userSellers=sellers;
    const managers=optionsQuery.isError?[]:optionsQuery.data?.managers??[];
    const matchesManagerFilter=useCallback((target:any,managerId:string)=>{
        if(!managerId||managerId==='all')return true;
        // Manager filter denotes current seller portfolio, not historic target creator.
        return scope?.managerId===managerId&&matchesDashboardScope(scope,target?.SellerId??target?.sellerId);
    },[scope]);
    const matchesSellerFilter=useCallback((target:any,sellerId:string)=>{
        if(!sellerId||sellerId==='all')return true;
        return String(sellerId).split(',').includes(String(target?.SellerId??target?.sellerId??''));
    },[]);
    // Load tasks from the task workspace (/tasks/tasks) — the single task
    // source the task workspace itself uses, so the dashboard's task counts
    // always match what users see when they click through.
    // ✅ Source-consistency fix: the dashboard previously read the `Tasks`
    // table while the workspace renders TaskInstances.
    const tasksQuery = useQuery({
        queryKey: ['tasks','dashboard',principal,scopeKey,filters.managerId,filters.sellerId],
        enabled:!!principal&&!!scope&&!scope.empty&&canTasks,
        queryFn: async ({signal}) => {
            const params={sellerId:filters.sellerId==='all'?undefined:filters.sellerId,managerId:filters.managerId==='all'?undefined:filters.managerId};
            const r=await apiClient.get('/dashboard/tasks',{params,signal});
            const body: any = (r as any).data ?? r ?? {};
            const list = body?.data?.instances ?? body?.instances ?? body?.data ?? [];
            if(!Array.isArray(list)||!sameDashboardScope(body.scope,scope)||!body.summary)throw Error('Dashboard task scope or summary mismatch');

            // Normalize the task instance contract (PascalCase + workflow
            // statuses) to the dashboard's task shape. Status mapping keeps
            // the card labels truthful: ASSIGNED (not yet started) -> PENDING,
            // DRAFT -> TODO, REVIEW -> IN_REVIEW, APPROVED -> COMPLETED.
            const STATUS_MAP: Record<string, string> = {
                DRAFT: 'TODO',
                TODO: 'TODO',
                ASSIGNED: 'PENDING',
                ACCEPTED: 'IN_PROGRESS',
                IN_PROGRESS: 'IN_PROGRESS',
                REVIEW: 'IN_REVIEW',
                IN_REVIEW: 'IN_REVIEW',
                COMPLETED: 'COMPLETED',
                APPROVED: 'COMPLETED',
                CANCELLED: 'CANCELLED',
                REJECTED: 'CANCELLED',
            };
            const instances=list.map((inst: any) => {
                const rawStatus = String(inst.Status || inst.status || '').toUpperCase();
                return {
                    id: inst.Id || inst.id,
                    title: inst.Title || inst.title || 'Untitled task',
                    status: inst.DashboardStatus||STATUS_MAP[rawStatus] || rawStatus || 'OTHER',
                    rawStatus,
                    priority: inst.Priority || inst.priority || 'MEDIUM',
                    category: inst.TemplateCategory || inst.Category || inst.category || 'General',
                    sellerId: inst.SellerId || inst.sellerId,
                    sellerName: inst.SellerName || inst.sellerName,
                    assignedTo: inst.AssignedTo || inst.assignedTo,
                    assigneeName: inst.AssignedToName || inst.assigneeName || null,
                    dueDate: inst.DueDate || inst.dueDate || null,
                    createdAt: inst.CreatedAt || inst.createdAt,
                    slaStatus: inst.SLAStatus || null,
                    source: 'tasks',
                };
            });
            return {instances,summary:body.summary};
        },
        staleTime: 60_000,
        gcTime:0,placeholderData:undefined,
        refetchOnWindowFocus: false,
    });

    const taskSummary=canTasks&&scope&&!scope.empty&&!tasksQuery.isError?tasksQuery.data?.summary??null:null;
    const optimizationTasks=canTasks&&scope&&!scope.empty&&!tasksQuery.isError?(tasksQuery.data?.instances??[]).filter(t=>matchesDashboardScope(scope,t.sellerId)):[];
    // ✅ Explicit task-section state so the dashboard can render an
    // unavailable state instead of a silent zero count.
    const tasksLoading=canTasks&&!!scope&&!scope.empty&&tasksQuery.isPending;
    const tasksError = tasksQuery.isError
        ? ((tasksQuery.error as any)?.message ?? 'Tasks failed to load')
        : null;

    const logsQuery=useQuery({
        queryKey:['dashboard','activity',principal],
        enabled:canLogs,
        queryFn:async({signal})=>{
            const r=await apiClient.get('/logs',{params:{limit:10},signal});
            return r.data?.data??[];
        },
        staleTime:30_000,gcTime:0,placeholderData:undefined,retry:false,
    });
    const pipelineQuery=useQuery({
        queryKey:['dashboard','pipeline',principal,scopeKey,filters.sellerId,filters.managerId],
        enabled:!!principal&&!!scope&&!scope.empty&&canPipeline,
        queryFn:async({signal})=>{
            const r=await apiClient.get('/market-sync/tasks',{params:{sellerId:filters.sellerId==='all'?undefined:filters.sellerId,managerId:filters.managerId==='all'?undefined:filters.managerId},signal});
            return r.data?.tasks??[];
        },
        staleTime:30_000,gcTime:0,placeholderData:undefined,refetchInterval:30_000,retry:false,
    });
    const activityLogs=canLogs&&!logsQuery.isError?logsQuery.data??[]:[];
    const scrapeTasks=canPipeline&&scope&&!scope.empty&&!pipelineQuery.isError?(pipelineQuery.data??[]).filter(t=>matchesDashboardScope(scope,t.sellerId)):[];
    const loadLogs=useCallback(()=>canLogs?logsQuery.refetch():Promise.resolve(),[canLogs,logsQuery.refetch]);
    const loadPipeline=useCallback(()=>canPipeline&&scope&&!scope.empty?pipelineQuery.refetch():Promise.resolve(),[canPipeline,scope,pipelineQuery.refetch]);
    useEffect(()=>{
        if(!socket||!canLogs)return;
        const invalidate=()=>{void loadLogs();};
        socket.on('system_log_changed',invalidate);
        return ()=>{socket.off('system_log_changed',invalidate);};
    },[socket,canLogs,loadLogs]);

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

        const completed=filteredTargets.filter(t=>t.status==='met'||(t.closed&&t.status==='within_limit')).length;
        const atRisk=filteredTargets.filter(t=>['below_target','over_limit'].includes(t.status)).length;
        const onTrack=filteredTargets.filter(t=>!t.closed&&t.status==='within_limit').length;
        const classified=filteredTargets.filter(t=>!['unknown','not_started','in_progress'].includes(t.status)).length;
        const rate=classified?completed/classified*100:null;
        const ad=orch.dashboardRaw?.ads;
        const totalAdSales=ad?.adSales??null,totalAdSpend=ad?.adSpend??null;
        const managerSellers=new Set(scope?.sellerIds??[]);

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
                rate,
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
                acos:ad?.acos??null,
                roas:ad?.roas??null,
                campaigns: 0,
            },
            tasks: {
                total: taskSummary?.total??0,
                completed: taskSummary?.counts?.COMPLETED??0,
                pending: taskSummary?.counts?.PENDING??0,
                overdue: taskSummary?.overdue??0,
                inProgress: taskSummary?.counts?.IN_PROGRESS??0,
                todo: taskSummary?.counts?.TODO??0,
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
        activityLogs, scrapeTasks, filters, matchesManagerFilter,scope,taskSummary]);

    const filteredTasks=optimizationTasks;
    const filteredScrapeTasks=scrapeTasks;
    const filteredActivityLogs=activityLogs;
    const filteredTopProducts=scope&&!scope.empty?(orch.topProducts??[]).filter(p=>matchesDashboardScope(scope,p.sellerId)):[];
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
        tasksLoading,
        tasksError,taskSummary,
        canTasks,canPipeline,canLogs,
        optionsError:optionsQuery.isError,
        pipelineStatus:scope?.empty?'ready':pipelineQuery.isError?'error':pipelineQuery.isPending?'loading':'ready',
        activityStatus:logsQuery.isError?'error':logsQuery.isPending?'loading':'ready',
        sectionStatus: orch.sectionStatus,
        
        // Helpers
        matchesManagerFilter,
        matchesSellerFilter,
        
        // Actions
        refresh:async()=>{
            await Promise.all([orch.forceRefresh?.(),loadLogs(),loadPipeline(),optionsQuery.refetch(),...(canTasks&&scope&&!scope.empty?[tasksQuery.refetch()]:[])]);
        },
        loadPipeline,
    };
}
