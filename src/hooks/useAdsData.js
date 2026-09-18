import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { adsApi } from '../services/api';
import { format } from 'date-fns';

export function deriveAdsMetrics(row = {}) {
  const metrics = Object.fromEntries(['spend', 'sales', 'orders', 'clicks', 'impressions', 'organicSales', 'organicOrders', 'pageViews'].map(key => [key, Number(row[key] || 0)]));
  const divide = (numerator, denominator, scale = 1) => denominator > 0 ? numerator / denominator * scale : null;
  metrics.totalSales = metrics.sales + metrics.organicSales;
  metrics.totalOrders = metrics.orders + metrics.organicOrders;
  return {
    ...row,
    ...metrics,
    acos: divide(metrics.spend, metrics.sales, 100),
    roas: divide(metrics.sales, metrics.spend),
    tacos: divide(metrics.spend, metrics.totalSales, 100),
    adSalesPct: divide(metrics.sales, metrics.totalSales, 100),
    ctr: divide(metrics.clicks, metrics.impressions, 100),
    cvr: divide(metrics.orders, metrics.clicks, 100),
    cpc: divide(metrics.spend, metrics.clicks),
    costPerOrder: divide(metrics.spend, metrics.orders)
  };
}

export function useAdsData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [globalChartData, setGlobalChartData] = useState([]);
  const [scope, setScope] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const requestIdRef = useRef(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchData = useCallback(async (params = {}, isFilterChange = false) => {
    clearTimeout(debounceRef.current);
    const requestId = ++requestIdRef.current;

    try {
      if (isFilterChange) {
        setFilterLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const queryParams = {
        groupBy: params.groupBy,
        search: params.search,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        sellerId: params.sellerId,
        startDate: params.startDate ? format(params.startDate, 'yyyy-MM-dd') : undefined,
        endDate: params.endDate ? format(params.endDate, 'yyyy-MM-dd') : undefined
      };

      // Server-side pagination + scope-wide aggregates for the Ads Manager page.
      // When paginated, the backend returns one page and we use it directly (no
      // client-side slicing). Scope aggregates power the KPI/insight widgets over
      // the full filtered set regardless of the current page.
      if (params.paginated) {
        queryParams.page = params.page || 1;
        queryParams.limit = params.pageSize || 50;
        queryParams.includeScope = '1';
      }

      Object.keys(queryParams).forEach(key => {
        if (queryParams[key] === undefined) delete queryParams[key];
      });

      const res = await adsApi.getAdsManagerData(queryParams);

      if (requestId !== requestIdRef.current) return;

      if (res.success) {
        setData(res.data || []);
        setTotalCount(res.total || res.data?.length || 0);
        setGlobalChartData(res.globalChartData || []);
        setScope(res.scope || null);
      } else {
        setError('Failed to load ads data');
        setData([]);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch ads data:', err);
      setError(err.message || 'Failed to load ads data');
      setData([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setFilterLoading(false);
      }
    }
  }, []);

  const debouncedFetch = useCallback((params) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(params, true);
    }, 300);
  }, [fetchData]);

  // Server-side pagination — data already represents the requested page.
  const paginatedData = data;

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
    sum.totalOrders = sum.orders + sum.organicOrders;
    return sum;
  }, [data]);

  return { 
    data, 
    paginatedData,
    loading, 
    filterLoading, 
    error, 
    totalCount,
    page, setPage,
    pageSize, setPageSize,
    globalChartData, 
    scope,
    summary, 
    fetchData, 
    debouncedFetch
  };
}