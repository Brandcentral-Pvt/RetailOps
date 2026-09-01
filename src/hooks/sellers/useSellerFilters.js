import { useState, useCallback } from 'react';
import { useDebounce } from '../useDebounce';

/**
 * useSellerFilters — owns filter state + derived debouncedSearch.
 *
 * debouncedSearch is derived via useDebounce(searchQuery, 400).
 */
export function useSellerFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const debouncedSearch = useDebounce(searchQuery, 400);

  const resetFilters = useCallback(() => {
    setActiveTab('all');
    setMarketplaceFilter('all');
    setManagerFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    marketplaceFilter,
    setMarketplaceFilter,
    managerFilter,
    setManagerFilter,
    statusFilter,
    setStatusFilter,
    debouncedSearch,
    resetFilters,
  };
}
