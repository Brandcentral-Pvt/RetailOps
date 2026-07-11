import { useState, useCallback, useEffect } from 'react';
import { useDateRange } from '../contexts/DateRangeContext';
import { sellerApi } from '../services/api';

export function useAdsFilters() {
  const { startDate, endDate, updateDateRange } = useDateRange();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState('asin');
  const [selectedSeller, setSelectedSeller] = useState(() => localStorage.getItem('selectedSeller') || '');
  const [sortBy, setSortBy] = useState('sales');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeFilters, setActiveFilters] = useState([]);

  useEffect(() => {
    localStorage.setItem('selectedSeller', selectedSeller);
  }, [selectedSeller]);

  useEffect(() => {
    setGroupBy('asin');
    setPage(1);
  }, [selectedSeller, startDate, endDate]);

  const fetchSellerDropdownData = useCallback(async (page = 1, search = '') => {
    try {
      const response = await sellerApi.getAll({ page, limit: 1000, search });
      if (response.success) {
        return { 
          data: response.data.sellers || [], 
          hasMore: response.data.pagination?.page < response.data.pagination?.totalPages 
        };
      }
      return { data: [], hasMore: false };
    } catch (err) { 
      return { data: [], hasMore: false }; 
    }
  }, []);

  const fetchSellerItem = useCallback(async (id) => {
    try {
      const response = await sellerApi.getById(id);
      if (response.success && response.seller) return response.seller;
      return null;
    } catch (err) { 
      return null; 
    }
  }, []);

  const handleDateChange = useCallback((dates) => {
    if (dates && dates[0] && dates[1]) {
      updateDateRange({
        startDate: dates[0].toDate(),
        endDate: dates[1].toDate(),
        rangeType: 'custom'
      });
    }
  }, [updateDateRange]);

  const getFilterParams = useCallback(() => ({
    groupBy,
    search: searchQuery,
    page,
    limit: pageSize,
    sortBy,
    sortOrder,
    sellerId: selectedSeller || undefined,
    startDate,
    endDate
  }), [groupBy, searchQuery, page, pageSize, sortBy, sortOrder, selectedSeller, startDate, endDate]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setGroupBy('asin');
    setSelectedSeller('');
    setSortBy('sales');
    setSortOrder('desc');
    setPage(1);
    setPageSize(50);
    setActiveFilters([]);
  }, []);

  return {
    searchQuery, setSearchQuery,
    groupBy, setGroupBy,
    selectedSeller, setSelectedSeller,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    page, setPage,
    pageSize, setPageSize,
    startDate, endDate,
    activeFilters, setActiveFilters,
    fetchSellerDropdownData,
    fetchSellerItem,
    handleDateChange,
    getFilterParams,
    resetFilters
  };
}
