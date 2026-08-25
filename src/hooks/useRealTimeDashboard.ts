/**
 * Real-Time Dashboard Hook
 *
 * Subscribes to WebSocket events for dashboard-sensitive payloads and
 * translates them into:
 *  1. React Query invalidation broadcasts
 *  2. EVENT_BUS pub-sub notifications for downstream subscribers
 *  3. Zustand store connection-state writes
 *
 * Also manages the SSE fallback stream when the socket goes silent.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { EVENT_BUS } from '../store/eventBus';
import { useDashboardStore } from '../store/dashboardStore';
import { subscribe } from '../services/realtimeService';

// ─── Query-key maps ────────────────────────────────────────────────────────────

// Maps a socket event name → the RQ keys that are invalidated when it fires.
const INVALIDATION_MAP: Record<string, QueryKey[]> = {
    dataUpdate:    [['dashboard'], ['metrics-overview']],
    asinUpdated:   [['asins'], ['asinTable']],
    targetReached: [['goals'], ['targets', 'achievements']],
    alerts:        [['alerts'], ['notifications']],
    sellerSynced:  [['sellers'], ['asinTable', 'seller-asins']],
    taskUpdated:   [['tasks'], ['task-stats']],
};

// ─── SSE helpers ───────────────────────────────────────────────────────────────

function hasNativeEventSource(): boolean {
    return typeof EventSource !== 'undefined';
}

const RECONNECT_DELAY_MS = 2_000;
const HEALTH_OK_THRESHOLD_SEC = 15;

interface RealTimeDashboardOptions {
    /** Custom SSE endpoint for fallback (omit to disable SSE fallback). */
    sseEndpoint?:             string;
    /**
     * Seconds without a socket heartbeat before SSE fallback is activated.
     * Default: 15 s.
     */
    unhealthyAfterSeconds?:   number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRealTimeDashboard(options?: RealTimeDashboardOptions) {
    const { sseEndpoint, unhealthyAfterSeconds = HEALTH_OK_THRESHOLD_SEC } = options ?? {};

        const queryClient = useQueryClient();
    const setConnection = useDashboardStore((s) => s.setConnection);
    const setAlerts     = useDashboardStore((s) => s.setAlerts);
    const connection    = useDashboardStore((s) => s.connection);
    const lastBeatRef = useRef<number>(Date.now());

    // ── Event-bus → store connection state ────────────────────────────────────
    useEffect(() => {
        const bus = EVENT_BUS;

        const handlers: Array<{ evt: string; fn: (...a: unknown[]) => void }> = [
            { evt: 'realtime:connected',    fn: () => setConnection({ connected: true,         reconnecting: false, failedSince: null }) },
            { evt: 'realtime:disconnected', fn: () => setConnection({ connected: false,        reconnecting: true }) },
            { evt: 'realtime:error',        fn: () => setConnection({ connected: false,        failedSince: Date.now() }) },
            { evt: 'socket:asinUpdated',    fn: () => queryClient.invalidateQueries({ queryKey: ['asins'] }) },
            { evt: 'socket:targetReached',  fn: () => { queryClient.invalidateQueries({ queryKey: ['goals'] });
                                                             queryClient.invalidateQueries({ queryKey: ['metrics-overview'] }); } },
            { evt: 'socket:alerts',         fn: (data) => { queryClient.invalidateQueries({ queryKey: ['alerts'] });
                                                             if (data) setAlerts(data as any); } },
            { evt: 'socket:sellerSynced',   fn: () => queryClient.invalidateQueries({ queryKey: ['sellers'] }) },
            { evt: 'socket:taskUpdated',    fn: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }) },
        ];

        const unsub = handlers.map(({ evt, fn }) => {
            bus.on(evt, fn as EventListener);
            return () => bus.off(evt, fn as EventListener);
        });
        return () => { unsub.forEach((fn) => fn()); };
    }, [queryClient, setConnection, setAlerts]);

    // ── Socket-channels via realtimeService ─────────────────────────────────────
    useEffect(() => {
        const unsubs: Array<() => void> = [];

        Object.keys(INVALIDATION_MAP).forEach((channel: string) => {
            const off = subscribe(channel, () => {
                lastBeatRef.current = Date.now();
                setConnection({ connected: true, reconnecting: false });
                INVALIDATION_MAP[channel]?.forEach((key: QueryKey) =>
                    queryClient.invalidateQueries({ queryKey: key }),
                );
            });
            unsubs.push(off);
        });

        return () => { unsubs.forEach((fn) => fn()); };
    }, [queryClient, setConnection]);

    // ── SSE fallback ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!sseEndpoint) return;

        const checkHealth = () => {
            const elapsed = (Date.now() - lastBeatRef.current) / 1_000;
            if (elapsed > unhealthyAfterSeconds) openSse();
        };

        const id = window.setInterval(checkHealth, 10_000);
        return () => window.clearInterval(id);
    }, [sseEndpoint, unhealthyAfterSeconds]);

    const openSse = useCallback(async () => {
        if (!sseEndpoint) return;

        // SECURITY (audit #8): EventSource cannot send an Authorization header,
        // and appending the JWT as a query param (the old behavior here) leaks
        // credentials into browser history, proxies and server access logs.
        // The endpoint must arrive WITHOUT embedded credentials; if this
        // fallback is ever activated, SSE auth MUST use a cookie/one-time
        // ticket pattern negotiated via authenticated endpoints.
        if (/([?&])(token|access_token|jwt|auth)=/i.test(sseEndpoint)) {
            if (import.meta.env.DEV) {
                console.warn(
                    '[useRealTimeDashboard] sseEndpoint contains credential query params — refusing to open (audit #8). ' +
                    'Use the cookie/ticket auth pattern for SSE instead.',
                );
            }
            return;
        }
        const url = sseEndpoint;

        let es: EventSource | null;
        if (hasNativeEventSource()) {
            es = new EventSource(url);
        } else {
            // Graceful degradation: skip SSE and let polling handle it.
            console.warn('[useRealTimeDashboard] EventSource not supported — SSE disabled.');
            return;
        }

        [
            ['dataUpdate',   () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })],
            ['asinUpdated',  () => queryClient.invalidateQueries({ queryKey: ['asins'] })],
            ['targetReached',() => queryClient.invalidateQueries({ queryKey: ['goals'] })],
            ['alertTriggered',()=> queryClient.invalidateQueries({ queryKey: ['alerts'] })],
        ].forEach(([evt, fn]) => es!.addEventListener(evt as string, fn as any));

        es.addEventListener('error', () => {
            es?.close();
            setTimeout(openSse, RECONNECT_DELAY_MS);
        });

        (window as any)._dashSse = es;
    }, [sseEndpoint, queryClient]);

    // ── Return connection status surface ───────────────────────────────────────
    return {
        connection: connection,
        refetch:    (key?: string) =>
            key ? queryClient.invalidateQueries({ queryKey: [key] }) : queryClient.invalidateQueries(),
    } as any;
}
