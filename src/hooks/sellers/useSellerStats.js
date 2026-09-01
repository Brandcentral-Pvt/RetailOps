import { useState, useEffect, useCallback } from 'react';
import { sellerApi } from '../../services/api';

/**
 * useSellerStats — owns aggregated stats fetch.
 *
 * Calls sellerApi.getStats({ roleName, userId, assignedManagersIds,
 * activeTab, marketplaceFilter, managerFilter, statusFilter }).
 *
 * Re-fetches when filter inputs change via useEffect on a
 * JSON-stringified filter bag.
 */
export function useSellerStats({
  roleName,
  userId,
  assignedManagersIds,
  activeTab,
  marketplaceFilter,
  managerFilter,
  statusFilter,
  debouncedSearch,
}) {
  const [dbStats, setDbStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const refetch = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {};
      if (marketplaceFilter !== 'all') params.marketplace = marketplaceFilter;
      if (managerFilter !== 'all') params.manager = managerFilter;
      if (activeTab !== 'all') params.status = activeTab;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await sellerApi.getStats(params);
      if (res.success) setDbStats(res.data);
    } catch (err) {
      console.error('Failed to fetch seller stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [marketplaceFilter, managerFilter, activeTab, statusFilter, debouncedSearch]);

  // JSON-stringified filter bag so the effect only re-fires when the
  // *combined* filter shape actually changes.
  const filterBag = JSON.stringify({
    roleName,
    userId,
    assignedManagersIds,
    activeTab,
    marketplaceFilter,
    managerFilter,
    statusFilter,
    debouncedSearch,
  });

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBag]);

  return { dbStats, statsLoading, refetch };
}
