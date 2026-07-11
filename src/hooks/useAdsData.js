import { useState, useCallback, useMemo } from 'react';
import { adsApi } from '../services/api';
import { format } from 'date-fns';

export function useAdsData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [globalChartData, setGlobalChartData] = useState([]);

  const fetchData = useCallback(async (params = {}) => {
    try {
      setLoading(true);
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

      const res = await adsApi.getAdsManagerData(queryParams);
      if (res.success) {
        setData(res.data || []);
        setTotalCount(res.total || 0);
        setGlobalChartData(res.globalChartData || []);
      } else {
        setError('Failed to load ads data');
      }
    } catch (err) {
      console.error('Failed to fetch ads data:', err);
      setError(err.message || 'Failed to load ads data');
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { data, loading, error, totalCount, globalChartData, summary, fetchData };
}
