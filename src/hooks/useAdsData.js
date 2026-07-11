import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { adsApi } from '../services/api';
import { format } from 'date-fns';
import { deduplicatedGet, cachedFetch, invalidateCache } from '../services/apiCache';

export function useAdsData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [globalChartData, setGlobalChartData] = useState([]);
  const abortControllerRef = useRef(null);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchData = useCallback(async (params = {}, isFilterChange = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (isFilterChange) {
        setFilterLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const queryParams = {
        page: params.page || 1,
        limit: params.limit || 50,
        groupBy: params.groupBy,
        search: params.search,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        sellerId: params.sellerId,
        startDate: params.startDate ? format(params.startDate, 'yyyy-MM-dd') : undefined,
        endDate: params.endDate ? format(params.endDate, 'yyyy-MM-dd') : undefined
      };

      // Remove undefined values
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key] === undefined) delete queryParams[key];
      });

      const cacheKey = `ads:${JSON.stringify(queryParams)}`;
      const ttl = isFilterChange ? 0 : 2 * 60 * 1000;
      
      const res = await cachedFetch(cacheKey, () => adsApi.getAdsManagerData(queryParams), ttl);
      
      if (res.success) {
        setData(res.data || []);
        setPagination({
          page: res.page || 1,
          limit: res.limit || 50,
          total: res.total || 0,
          totalPages: Math.ceil((res.total || 0) / (res.limit || 50))
        });
        setGlobalChartData(res.globalChartData || []);
        initialLoadRef.current = true;
      } else {
        setError('Failed to load ads data');
        setData([]);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch ads data:', err);
      setError(err.message || 'Failed to load ads data');
      setData([]);
    } finally {
      setLoading(false);
      setFilterLoading(false);
    }
  }, []);

  const debouncedFetch = useMemo(() => {
    let timeoutId;
    return (params) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        invalidateCache('ads:');
        fetchData({ ...params, page: 1 }, true);
      }, 300);
    };
  }, [fetchData]);

  const summary = useMemo(() => {
    const sum = { 
      spend: 0, sales: 0, orders: 0, impressions: 0, clicks: 0, 
      organicSales: 0, organicOrders: 0, totalOrders: 0, pageViews: 0 
    };
    data.forEach(d => {
      sum.spend += Number(d.spend || 0);
      sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0);
      sum.impressions += Number(d.impressions || 0);
      sum.clicks += Number(d.clicks || 0);
      sum.organicSales += Number(d.organicSales || 0);
      sum.organicOrders += Number(d.organicOrders || 0);
      sum.pageViews += Number(d.pageViews || 0);
    });
    sum.totalSales = sum.sales + sum.organicSales;
    sum.acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;
    sum.roas = sum.spend > 0 ? sum.sales / sum.spend : 0;
    sum.cvr = sum.clicks > 0 ? (sum.orders / sum.clicks) * 100 : 0;
    sum.cpc = sum.clicks > 0 ? sum.spend / sum.clicks : 0;
    sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
    sum.tacos = sum.totalSales > 0 ? (sum.spend / sum.totalSales) * 100 : 0;
    sum.adSalesPct = sum.totalSales > 0 ? (sum.sales / sum.totalSales) * 100 : 0;
    sum.totalOrders = sum.orders + sum.organicOrders;
    return sum;
  }, [data]);

  return { 
    data, 
    loading, 
    filterLoading, 
    error, 
    pagination,
    globalChartData, 
    summary, 
    fetchData, 
    debouncedFetch,
    initialLoadRef
  };
}
