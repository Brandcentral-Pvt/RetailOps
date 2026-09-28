import { useCallback, useRef, useState } from 'react';
import { asinApi } from '../services/api';

const EMPTY_PAGINATION = { page: 1, limit: 25, total: 0, totalPages: 0 };

/**
 * Owns the ASIN list: rows, aggregate stats, pagination and load state.
 *
 * Two things here are load-bearing and easy to break:
 *
 * 1. Stats are scoped aggregates, so they are only refetched when the
 *    seller/marketplace scope changes — not on paging, sorting, searching
 *    or filtering. Paging through results keeps reusing the cached stats.
 *
 * 2. A monotonically increasing token guards against out-of-order responses.
 *    Rapid paging/sorting would otherwise let a slow earlier request
 *    overwrite a fast later one and leave the table showing stale rows.
 */
export function useAsinData({
  selectedSeller,
  marketplaceFilter,
  appliedSearchQuery,
  appliedFilters,
  sortBy,
  sortOrder,
  limit
}) {
  const [asins, setAsins] = useState([]);
  const [globalHistoryDates, setGlobalHistoryDates] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ ...EMPTY_PAGINATION, limit });
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const loadTokenRef = useRef(0);
  const lastStatsScopeRef = useRef(null);
  const lastStatsRef = useRef(null);

  const loadData = useCallback(
    async (page = 1, pageLimit = limit, seller = selectedSeller, marketplace = marketplaceFilter) => {
      const token = ++loadTokenRef.current;
      setLoading(true);

      const scopedMarketplace = marketplace && marketplace !== 'all' ? marketplace : undefined;
      const statsScope = `${seller || ''}|${scopedMarketplace || ''}`;
      const needsStats = lastStatsScopeRef.current !== statsScope || !lastStatsRef.current;

      const statsPromise = needsStats
        ? asinApi
            .getStats({ seller, marketplace: scopedMarketplace })
            .catch(err => {
              // Stats are supplementary: a failure must not blank the table.
              console.warn('Stats fetch failed:', err);
              return null;
            })
        : Promise.resolve(lastStatsRef.current);

      try {
        const [asinRes, statsRes] = await Promise.all([
          asinApi.getAll({
            page,
            limit: pageLimit,
            seller,
            marketplace: scopedMarketplace,
            search: appliedSearchQuery,
            ...appliedFilters,
            historyDays: appliedFilters.historyDays,
            sortBy,
            sortOrder
          }),
          statsPromise
        ]);

        if (token !== loadTokenRef.current) return;

        setInitialLoadComplete(true);
        setAsins(asinRes?.asins || []);
        setGlobalHistoryDates(asinRes?.globalHistoryDates || []);
        setAvailableMonths(asinRes?.months || []);
        setPagination(asinRes?.pagination || { page: 1, limit: pageLimit, total: 0, totalPages: 0 });
        lastStatsScopeRef.current = statsScope;
        lastStatsRef.current = statsRes;
        setStats(statsRes);
        setError(null);
      } catch (err) {
        if (token !== loadTokenRef.current) return;
        console.error('Error fetching ASINs:', err);
        setError(err.message);
        setAsins([]);
      } finally {
        if (token === loadTokenRef.current) setLoading(false);
      }
    },
    [limit, selectedSeller, appliedSearchQuery, appliedFilters, marketplaceFilter, sortBy, sortOrder]
  );

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    loadData();
  }, [loadData]);

  return {
    asins,
    setAsins,
    globalHistoryDates,
    availableMonths,
    setAvailableMonths,
    loading,
    setLoading,
    error,
    setError,
    stats,
    pagination,
    setPagination,
    initialLoadComplete,
    loadData,
    retry
  };
}
