import { useState, useCallback, useRef, useEffect } from 'react';
import { sellerApi } from '../../services/api';

/**
 * useSellersData — owns the sellers list fetch + pagination state.
 *
 * loadSellers(opts) calls sellerApi.getAll(cleanParams) and updates state.
 * cleanParams strips null/undefined/'' and `silent`.
 * `assignedManagersIds` is accepted from opts but not forwarded to the API
 * (preserves the original SellersPage behaviour).
 */
export function useSellersData({ addToast } = {}) {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const lastQueryRef = useRef(null);

  // Stable toast ref — mirrors the original toastRef pattern in SellersPage
  const toastRef = useRef(addToast);
  useEffect(() => { toastRef.current = addToast; }, [addToast]);

  const loadSellers = useCallback(async (opts = {}) => {
    const {
      page: p = 1,
      limit: l = 50,
      activeTab = 'all',
      marketplaceFilter = 'all',
      managerFilter = 'all',
      statusFilter = 'all',
      search = '',
      silent = false,
      // assignedManagersIds is accepted from opts but intentionally not forwarded
      // to the API — preserves the original SellersPage behaviour.
    } = opts;

    if (!silent) setLoading(true);
    try {
      const params = {
        page: p,
        limit: l,
        status: statusFilter !== 'all' ? statusFilter : activeTab !== 'all' ? activeTab : undefined,
        marketplace: marketplaceFilter !== 'all' ? marketplaceFilter : undefined,
        manager: managerFilter !== 'all' ? managerFilter : undefined,
        search: search || undefined,
      };

      // cleanParams strips null/undefined/'' and `silent`
      const cleanParams = Object.entries(params).reduce((acc, [key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          acc[key] = val;
        }
        return acc;
      }, {});

      lastQueryRef.current = cleanParams;
      const response = await sellerApi.getAll(cleanParams);

      let list = [];
      let total = 0;

      if (response?.success && response?.data) {
        list = response.data.sellers || (Array.isArray(response.data) ? response.data : []);
        total = response.data.pagination?.total ?? response.data.total ?? list.length;
      } else if (Array.isArray(response?.sellers)) {
        list = response.sellers;
        total = response.total ?? list.length;
      } else if (Array.isArray(response)) {
        list = response;
        total = list.length;
      } else if (Array.isArray(response?.data)) {
        list = response.data;
        total = list.length;
      }

      setSellers(list);
      setTotalItems(total);
      setError(null);
    } catch (err) {
      console.error('Failed to load sellers:', err);
      if (toastRef.current) toastRef.current('Network error: Could not connect to data service', 'error');
      setError('Failed to load sellers');
      setSellers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // stable forever — matches original loadSellers

  return {
    sellers,
    setSellers,
    totalItems,
    loading,
    error,
    page,
    limit,
    setPage,
    setLimit,
    loadSellers,
    lastQueryRef,
  };
}
