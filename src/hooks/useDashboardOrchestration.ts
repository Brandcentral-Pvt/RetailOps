/**
 * useDashboardOrchestration.ts — fully fixed
 */

import {
    useCallback, useEffect, useMemo
} from 'react';
import {
    useQuery, useQueryClient, type QueryKey
} from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useDashboardStore } from '../store/dashboardStore';
import { EVENT_BUS } from '../store/eventBus';

import { useRealTimeDashboard } from './useRealTimeDashboard';
import { useOptimisticMutation } from './useOptimisticMutation';
import { useAuth } from '../contexts/AuthContext';
import { dashboardPrincipal,canDashboardPermission,matchesDashboardScope } from '../utils/dashboardScope.mjs';
import {dashboardRangeError,dashboardErrorText,matchesDashboardPeriod,sameDashboardScope} from '../utils/dashboardRange.mjs';

// ─── Segment enum ─────────────────────────────────────────────────────────────

export enum DashboardSegment {
    KPIS = 'kpis',
    REVENUE_SERIES = 'revenueSeries',
    ADS_PERFORMANCE = 'adsPerformance',
    CATEGORIES = 'categories',
    TOP_PRODUCTS = 'topProducts',
    ALERTS = 'alerts',
    TARGETS = 'targets',
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface OrchestrationConfig {
    pollIntervalSeconds?: number;
    sseEndpoint?: string;
    sseSilenceThresholdSeconds?: number;
    defaultRetryAttempts?: number;
    backoffBaseMs?: number;
    sellerId?: string;
    managerId?: string;
    startDate?: string;
    endDate?: string;
    period?: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────
// ✅ Fix 11: all keys use `as const` for type consistency

const QK_DASHBOARD = ['dashboard'] as const;
const QK_ALERTS = ['alerts'] as const;
const QK_TARGETS = ['targets'] as const;

// ─── Fix 10: backoff factory defined OUTSIDE hook — stable reference ──────────

function makeBackoffFn(baseMs: number) {
    return (attempt: number) => Math.min(Math.floor(baseMs * 2 ** attempt), 32_000);
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useDashboardOrchestration(cfg: OrchestrationConfig = {}) {
    const {
        pollIntervalSeconds: pollInt = 60, // ✅ default polling ON (60s) — dashboard was static before
        sseEndpoint,
        sseSilenceThresholdSeconds: sseSilence = 15,
        defaultRetryAttempts: rawRetries = 3,
        backoffBaseMs: rawBaseMs = 1_000,
        sellerId,
        managerId,
        startDate,
        endDate,
        period,
    } = cfg;

    const retries = Math.max(rawRetries, 1);
    const baseMs = Math.max(rawBaseMs, 100);

    const qc = useQueryClient();
    const relay = EVENT_BUS; // module singleton — stable reference

    // ── Stable backoff functions (created once per hook invocation) ───────────
    const dashboardBackoff = useMemo(() => makeBackoffFn(baseMs), [baseMs]);
    const alertsBackoff = useMemo(() => makeBackoffFn(500), []);
    const targetsBackoff = useMemo(() => makeBackoffFn(baseMs), [baseMs]);

    const {user}=useAuth();
    const principal=dashboardPrincipal(user);
    const connection=useDashboardStore(s=>s.connection);
    const canTargets=canDashboardPermission(user,'targets_view');
    useRealTimeDashboard({sseEndpoint,unhealthyAfterSeconds:sseSilence});
    // No placeholder data or progressive snapshots across authorization keys.
    // Each request is independently authorized by its endpoint.
    const filters={sellerId,managerId,startDate,endDate,period};
    const rangeError=dashboardRangeError(startDate,endDate);
    const retryTransient=(count:number,error:any)=>count<1&&![400,401,403,404,422,429,502,504].includes(error?.response?.status)&&error?.code!=='ECONNABORTED';
    const dashboardQuery=useQuery({
        queryKey:[...QK_DASHBOARD,'scoped',principal,sellerId??'all',managerId??'all',startDate,endDate,period],
        enabled:!!principal&&!rangeError,
        queryFn:async({signal})=>{
            const data=(await apiClient.get('/dashboard',{params:{...filters,mode:'overview'},signal,timeout:45000})).data;
            if(!data?.scope||typeof data.scope.empty!=='boolean'||typeof data.scope.unrestricted!=='boolean'||!Array.isArray(data.scope.sellerIds))throw Error('Dashboard scope unavailable');
            if(!matchesDashboardPeriod(data,startDate,endDate))throw Error('Dashboard response date range mismatch');
            return data;
        },
        staleTime:60_000,gcTime:0,placeholderData:undefined,refetchOnWindowFocus:false,refetchOnReconnect:true,
        retry:retryTransient,
        retryDelay:dashboardBackoff,refetchInterval:pollInt>0?pollInt*1000:false,
    });
    const dashData=rangeError||dashboardQuery.isError?null:dashboardQuery.data??null;
    const scope=dashData?.scope;
    const scopeKey=scope?JSON.stringify([scope.unrestricted,scope.empty,scope.sellerIds]):'unresolved';
    const scopedEnabled=!!principal&&!!scope&&!scope.empty;
    const productsQuery=useQuery({
        queryKey:[...QK_DASHBOARD,'products',principal,sellerId??'all',managerId??'all',startDate,endDate,period,scopeKey],
        enabled:scopedEnabled,
        queryFn:async({signal})=>{
            const data=(await apiClient.get('/dashboard',{params:{...filters,mode:'products'},signal,timeout:45000})).data;
            if(!matchesDashboardPeriod(data,startDate,endDate)||!sameDashboardScope(data.scope,scope)||!Array.isArray(data.tableData))throw Error('Dashboard product response scope or date range mismatch');
            return data;
        },
        staleTime:60_000,gcTime:0,placeholderData:undefined,refetchOnWindowFocus:false,refetchOnReconnect:true,
        retry:retryTransient,retryDelay:dashboardBackoff,
    });
    const targetsQuery=useQuery({
        queryKey:[...QK_TARGETS,'dashboard',principal,sellerId??'all',managerId??'all',scopeKey,startDate,endDate],
        enabled:scopedEnabled&&canTargets,
        queryFn:async({signal})=>{
            const r=await apiClient.get('/targets',{params:{sellerId,managerId,dashboardFrom:dashData?.period?.startDate,dashboardTo:dashData?.period?.endDate},signal});
            return r.data?.data??r.data;
        },
        staleTime:60_000,gcTime:0,placeholderData:undefined,refetchOnWindowFocus:false,
        retry:(count,error:any)=>![400,401,403,404,422].includes(error?.response?.status)&&count<retries,
        retryDelay:targetsBackoff,
    });
    const alertsQuery=useQuery({
        queryKey:[...QK_ALERTS,'dashboard',principal,sellerId??'all',managerId??'all',scopeKey],
        enabled:scopedEnabled,
        queryFn:async({signal})=>{
            const r=await apiClient.get('/alerts',{params:{sellerId,managerId},signal});
            return r.data?.data??r.data;
        },
        staleTime:60_000,gcTime:0,placeholderData:undefined,refetchOnWindowFocus:false,
        retry:(count,error:any)=>![400,401,403,404,422].includes(error?.response?.status)&&count<2,
        retryDelay:alertsBackoff,
    });

    // ── 7 · Event bus → React Query bridge ───────────────────────────────────
    // ✅ Fix 8: cleanup returned directly — no unsubBridge ref needed
    useEffect(() => {
        const onInvalidate = (evt: any) => {
            if (evt?.queryKey) void qc.invalidateQueries({ queryKey: evt.queryKey });
        };
        const onGlobal = () => {
            void qc.invalidateQueries({ queryKey: QK_DASHBOARD as unknown as QueryKey, exact: false });
        };

        relay.on('realtime:dataUpdated', onInvalidate);
        relay.on('realtime:invalidateAll', onGlobal);

        return () => {
            relay.off('realtime:dataUpdated', onInvalidate);
            relay.off('realtime:invalidateAll', onGlobal);
        };
    }, [qc, relay]);

    // ── 8 · Optimistic mutations ──────────────────────────────────────────────

    const { mutate: mutateAsinTag } = useOptimisticMutation(
        (id: string, payload: { tags: string[] }) =>
            apiClient.put(`/asins/${id}/tags`, payload).then((r: any) => r.data),
        {
            cacheKey: ['asins'],
            itemKey: 'id',
            mutationType: 'asin-tag-update',
            applyOptimistic: (cur: any, { tags }: any) => ({ ...cur, tags }),
            onSuccessEvent: 'socket:asinUpdated',
        },
    );

    const { mutate: mutateAck } = useOptimisticMutation(
        (id: string) =>
            apiClient.patch(`/alerts/${id}`, { acknowledged: true }).then((r: any) => r.data),
        {
            cacheKey: ['alerts'],
            itemKey: 'id',
            mutationType: 'alert-ack-toggle',
            applyOptimistic: (cur: any) => ({ ...cur, acknowledged: true }),
            onSuccessEvent: 'socket:alerts',
        },
    );

    const { mutate: mutateTaskReassign } = useOptimisticMutation(
        (id: string, payload: { userId: string }) =>
            apiClient.put(`/tasks/${id}/assign`, payload).then((r: any) => r.data),
        {
            cacheKey: ['tasks'],
            itemKey: 'id',
            mutationType: 'task-reassign',
            applyOptimistic: (cur: any, { userId }: any) => ({ ...cur, assignedTo: userId }),
            onSuccessEvent: 'socket:taskUpdated',
        },
    );

    // ── 9 · Public action helpers ─────────────────────────────────────────────
    // ✅ Fix 2: async helpers now correctly await mutation completion
    // Previously: new Promise((done) => { void mutate(); done(); })
    // = promise resolved BEFORE mutation finished — fake async

    const refetch = useCallback(
        () => qc.invalidateQueries({
            queryKey: QK_DASHBOARD as unknown as QueryKey,
            exact: false
        }),
        [qc],
    );

    const forceRefresh = useCallback(async () => {
        // ✅ Race fix: previously called loader.reset() BEFORE refetching,
        // throwing every section back to skeleton mid-fetch (flash + sections
        // stuck unresolved if a refetch failed). Now we only invalidate and
        // refetch — React Query keeps showing current data until fresh data
        // lands, and the progressive loader updates in place.
        if(rangeError)return;
        await Promise.all([dashboardQuery.refetch(),...(scopedEnabled?[productsQuery.refetch(),alertsQuery.refetch(),...(canTargets?[targetsQuery.refetch()]:[])]:[])]);
    }, [dashboardQuery.refetch,productsQuery.refetch,alertsQuery.refetch,targetsQuery.refetch,scopedEnabled,canTargets,rangeError]);

    // ✅ Fix 2 + Fix 14: correct mutation call signature + real async wait
    const updateAsinTag = useCallback(
        (id: string, tags: string[]): Promise<void> =>
            new Promise((resolve, reject) => {
                mutateAsinTag(
                    id,
                    { tags },
                    {
                        onSuccess: () => resolve(),
                        onError: (e: any) => reject(e),
                    } as any
                );
            }),
        [mutateAsinTag],
    );

    const toggleAlertAck = useCallback(
        (id: string): Promise<void> =>
            new Promise((resolve, reject) => {
                mutateAck(
                    id,
                    undefined as any,
                    {
                        onSuccess: () => resolve(),
                        onError: (e: any) => reject(e),
                    } as any
                );
            }),
        [mutateAck],
    );

    const reassignTask = useCallback(
        (id: string, userId: string): Promise<void> =>
            new Promise((resolve, reject) => {
                mutateTaskReassign(
                    id,
                    { userId },
                    {
                        onSuccess: () => resolve(),
                        onError: (e: any) => reject(e),
                    } as any
                );
            }),
        [mutateTaskReassign],
    );

    const kpisData=dashData?.kpi??null;
    const alertsData2=scopedEnabled&&!alertsQuery.isError?(alertsQuery.data??[]).filter(a=>matchesDashboardScope(scope,a.SellerId??a.sellerId??a.seller?._id)):[];
    const targetsData2=scopedEnabled&&canTargets&&!targetsQuery.isError?(targetsQuery.data??[]).filter(t=>matchesDashboardScope(scope,t.SellerId??t.sellerId)):[];
    const productsData=scopedEnabled&&!productsQuery.isError&&sameDashboardScope(productsQuery.data?.scope,scope)?productsQuery.data:null;
    const topProductsData=productsData?.tableData??[];
    const dashStatus=rangeError||dashboardQuery.isError?'error':dashData?'ready':'loading';
    const productStatus=dashStatus==='error'?'error':scope?.empty?'ready':productsQuery.isError?'error':productsData?'ready':'loading';
    const sectionStatus={
        kpis:dashStatus,revenueSeries:dashStatus,adsPerformance:dashStatus,categories:dashStatus,topProducts:productStatus,
        alerts:!scope?'loading':scope.empty?'ready':alertsQuery.isError?'error':alertsQuery.isSuccess?'ready':'loading',
        targets:!canTargets?'forbidden':!scope?'loading':scope.empty?'ready':targetsQuery.isError?'error':targetsQuery.isSuccess?'ready':'loading',
    };
    const errors:Record<string,string>={};
    if(rangeError||dashboardQuery.isError)errors.kpis=rangeError||dashboardErrorText(dashboardQuery.error);
    if(scopedEnabled&&productsQuery.isError)errors.topProducts=dashboardErrorText(productsQuery.error);
    if(scopedEnabled&&alertsQuery.isError)errors.alerts='Alerts unavailable';
    if(scopedEnabled&&canTargets&&targetsQuery.isError)errors.targets='Targets unavailable';

    // ── 11 · Stable return surface ─────────────────────────────────────────────
    return {
        // Per-section load status ('loading' | 'ready' | 'error')
        sectionStatus,
        scope,
        principal,
        // Section data
        kpis: kpisData,
        alerts: alertsData2,
        targets: targetsData2,
        topProducts: topProductsData,

        // ✅ Fix 6: dashboardRaw comes from React Query cache directly — never stale
        dashboardRaw: dashData,
        productsRevenue:productsData?.gmsRevenue??null,

        // Loading states
        isLoadingKpis: !rangeError&&dashboardQuery.isPending,
        isLoadingAlerts: scopedEnabled&&alertsQuery.isPending,
        isLoadingTargets: scopedEnabled&&canTargets&&targetsQuery.isPending,

        // Orchestration state
        errors,
        isHydrated: !!rangeError||!dashboardQuery.isPending,
        priorityFlood: false,

        // Actions
        updateAsinTag,
        toggleAlertAck,
        reassignTask,
        isMutating: dashboardQuery.isFetching,

        // Refresh controls
        refetch,
        forceRefresh,
        forceReload: forceRefresh,  // alias

        // Sync metadata
        syncTimestamp: dashData?new Date(dashboardQuery.dataUpdatedAt).toISOString():null,
        connectionStatus: connection.connected
            ? 'connected'
            : connection.reconnecting
                ? 'reconnecting'
                : 'offline',
    } as const;
}