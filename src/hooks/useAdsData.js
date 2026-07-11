import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { adsApi } from '../services/api';
import { format } from 'date-fns';
import { deduplicatedGet, cachedFetch, invalidateCache } from '../services/apiCache';

export function useAdsData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [globalChartData, setGlobalChartData] = useState([]);
  const abortControllerRef = useRef(null);
  const lastFetchKeyRef = useRef('');

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchData = useCallback(async (params = {}, isFilterChange = false) => {
    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Generate cache key from params
    const cacheKey = `ads:${JSON.stringify(params)}`;
    
    // Skip if same request is already in flight
    if (lastFetchKeyRef.current === cacheKey && !isFilterChange) {
      return;
    }
    lastFetchKeyRef.current = cacheKey;

    try {
      if (isFilterChange) {
        setFilterLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const queryParams = {};
      if (params.groupBy) queryParams.groupBy = params.groupBy;
      if (params.search) queryParams.search = params.search;
      if (params.page) queryParams.page = params.page;
      if (params.limit) queryParams.limit = params.limit;
      if (params.sortBy) queryParams.sortBy = params.sortBy;
      if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
      if (params.sellerId) queryParams.sellerId = params.sellerId;
      if (params.startDate) queryParams.startDate = format(params.startDate, 'yyyy-MM-dd');
      if (params.endDate) queryParams.endDate = format(params.endDate, 'yyyy-MM-dd');

      // Use cached fetch with 2 minute TTL for initial load
      const ttl = isFilterChange ? 0 : 2 * 60 * 1000;
      const res = await cachedFetch(cacheKey, () => adsApi.getAdsManagerData(queryParams), ttl);
      
      if (res.success) {
        setData(res.data || []);
        setTotalCount(res.total || 0);
        setGlobalChartData(res.globalChartData || []);
      } else {
        setError('Failed to load ads data');
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // Request was cancelled
      console.error('Failed to fetch ads data:', err);
      setError(err.message || 'Failed to load ads data');
    } finally {
      setLoading(false);
      setFilterLoading(false);
    }
  }, []);

  // Debounced filter change handler
  const debouncedFetch = useMemo(() => {
    let timeoutId;
    return (params) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        invalidateCache('ads:');
        fetchData(params, true);
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
    totalCount, 
    globalChartData, 
    summary, 
    fetchData, 
    debouncedFetch 
  };
}
