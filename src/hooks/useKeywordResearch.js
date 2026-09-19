/**
 * Keyword Research data layer.
 *
 * Reads go through react-query against the scoped `/api/keywords` endpoints —
 * one cache line per filter set, no duplicate in-flight requests, and the
 * server's own snapshot cache behind that. The LLM analysis stays a *mutation*
 * on purpose: it costs money per run and must only fire when the user asks.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { keywordApi, keywordAnalysisApi } from '../services/api';

const STALE_MS = 5 * 60 * 1000;      // the server caches snapshots for 10 minutes
const GC_MS = 20 * 60 * 1000;

/** Stable cache key — drops empty values so equivalent filters share a cache line. */
export const normalizeFilters = (filters = {}) => Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

export const keywordKeys = {
    all: ['keywords'],
    meta: () => ['keywords', 'meta'],
    categories: () => ['keywords', 'categories'],
    search: (params) => ['keywords', 'search', normalizeFilters(params)],
};

export function useKeywordMeta(options = {}) {
    return useQuery({
        queryKey: keywordKeys.meta(),
        queryFn: () => keywordApi.getMeta(),
        staleTime: 5 * 60 * 1000,
        gcTime: GC_MS,
        retry: 1,
        ...options,
    });
}

export function useKeywordCategories(options = {}) {
    return useQuery({
        queryKey: keywordKeys.categories(),
        queryFn: () => keywordApi.getCategories(),
        staleTime: 60 * 60 * 1000,       // the search-index list is effectively static
        gcTime: GC_MS,
        ...options,
    });
}

/**
 * Live keyword search. Disabled until there is a keyword to search for, so an
 * empty box never costs an upstream call.
 */
export function useKeywordSearch(params = {}, options = {}) {
    const hasKeyword = Boolean(String(params.keywords || '').trim());
    return useQuery({
        queryKey: keywordKeys.search(params),
        queryFn: () => keywordApi.search(params),
        enabled: hasKeyword,
        staleTime: STALE_MS,
        gcTime: GC_MS,
        retry: 0,                        // retries would re-spend the API quota
        ...options,
    });
}

/**
 * Multi-keyword comparison. A mutation rather than a query because the page
 * runs it in explicit chunks to make progress visible and to stay inside the
 * upstream rate limit.
 */
export function useKeywordBatchSearch(options = {}) {
    return useMutation({
        mutationFn: (payload) => keywordApi.batchSearch(payload),
        retry: 0,
        ...options,
    });
}

/** AI analysis — user-triggered, LLM-backed, with a deterministic fallback server-side. */
export function useKeywordAnalysis(options = {}) {
    return useMutation({
        mutationFn: (params) => keywordAnalysisApi.analyze(params),
        retry: 0,
        ...options,
    });
}

/**
 * XLSX export. The workbook is built from the dataset the user is looking at,
 * so nothing is re-fetched and the file matches the screen exactly.
 */
export function useKeywordExport(options = {}) {
    return useMutation({
        mutationFn: (payload) => keywordApi.export(payload),
        retry: 0,
        ...options,
    });
}

export function useKeywordCacheClear(options = {}) {
    return useMutation({
        mutationFn: () => keywordApi.clearCache(),
        retry: 0,
        ...options,
    });
}

/** Save a blob from an export response as a download. */
export function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
