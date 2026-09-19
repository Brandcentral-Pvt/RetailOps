/**
 * Ads Intelligence data layer.
 *
 * All reads go through the scoped `/api/ads` endpoints via react-query:
 * one cache entry per filter combination, no duplicate in-flight requests,
 * `placeholderData` so paginating the table never blanks the grid.
 *
 * The overview hook is the single source of truth for the Manager/Report
 * surfaces; the AI narrative is a *mutation* on purpose — it costs money and
 * only runs when the user asks for it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adsApi } from '../services/api';

const STALE_MS = 4 * 60 * 1000;          // matches the app-wide QueryClient default
const GC_MS = 15 * 60 * 1000;

/** Stable cache key — drops empty values so two equivalent filters share a cache line. */
const normalise = (filters = {}) => Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'auto')
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

export const adsKeys = {
    all: ['ads'],
    overview: (filters) => ['ads', 'overview', normalise(filters)],
    series: (filters) => ['ads', 'series', normalise(filters)],
    table: (filters) => ['ads', 'table', normalise(filters)],
    report: (filters) => ['ads', 'report', normalise(filters)],
    filterOptions: (filters) => ['ads', 'filter-options', normalise(filters)],
    history: (key, filters) => ['ads', 'history', key, normalise(filters)],
    meta: () => ['ads', 'meta'],
};

/** Unwrap the `{ success, data }` envelope and surface structured errors. */
const unwrap = (payload) => payload?.data ?? payload;

export function useAdsOverview(filters = {}, options = {}) {
    return useQuery({
        queryKey: adsKeys.overview(filters),
        queryFn: async () => unwrap(await adsApi.getOverview(filters)),
        staleTime: STALE_MS,
        gcTime: GC_MS,
        retry: 1,
        ...options,
    });
}

export function useAdsSeries(filters = {}, options = {}) {
    return useQuery({
        queryKey: adsKeys.series(filters),
        queryFn: async () => unwrap(await adsApi.getSeries(filters)),
        staleTime: STALE_MS,
        gcTime: GC_MS,
        ...options,
    });
}

export function useAdsTable(filters = {}, options = {}) {
    return useQuery({
        queryKey: adsKeys.table(filters),
        queryFn: async () => unwrap(await adsApi.getTable(filters)),
        staleTime: 60 * 1000,
        gcTime: GC_MS,
        placeholderData: (previous) => previous,   // keep the old page visible while the next loads
        ...options,
    });
}

export function useAdsReport(filters = {}, options = {}) {
    return useQuery({
        queryKey: adsKeys.report(filters),
        queryFn: async () => unwrap(await adsApi.getReport(filters)),
        staleTime: STALE_MS,
        gcTime: GC_MS,
        ...options,
    });
}

export function useAdsFilterOptions(filters = {}, options = {}) {
    return useQuery({
        queryKey: adsKeys.filterOptions(filters),
        queryFn: async () => unwrap(await adsApi.getFilterOptions(filters)),
        staleTime: 10 * 60 * 1000,
        gcTime: GC_MS,
        ...options,
    });
}

/** Drill-down history — only runs once a row is opened. */
export function useAdsHistory(key, filters = {}, options = {}) {
    return useQuery({
        queryKey: adsKeys.history(key, filters),
        queryFn: async () => unwrap(await adsApi.getHistory({ ...filters, key })),
        enabled: !!key,
        staleTime: STALE_MS,
        gcTime: GC_MS,
        ...options,
    });
}

export function useAdsMeta(options = {}) {
    return useQuery({
        queryKey: adsKeys.meta(),
        queryFn: async () => unwrap(await adsApi.getMeta()),
        staleTime: Infinity,
        ...options,
    });
}

/**
 * On-demand AI narrative.
 * Resolves `{ data }` on success; on failure the thrown error carries
 * `.code` ('ai_unavailable' | 'no_data' | 'forbidden_seller' | …) and, for
 * 'ai_unavailable', `.details.fallback` with the deterministic insights the
 * user can still read.
 */
export function useAiReview() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body) => unwrap(await adsApi.generateAiReview(body)),
        onSuccess: () => {
            // Rules may have shifted with the same window — refresh the cheap layer.
            queryClient.invalidateQueries({ queryKey: adsKeys.all, refetchType: 'none' });
        },
    });
}

/** Queued XLSX export. */
export function useAdsExport() {
    return useMutation({
        mutationFn: async (params) => adsApi.exportData(params),
    });
}

/** Ads workbook upload. */
export function useAdsUpload() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (formData) => adsApi.uploadData(formData),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: adsKeys.all }),
    });
}

export { normalise as normaliseAdsFilters };
