import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Filter state management hook for ASIN Manager
 * Consolidates:
 * - filters: working draft state (from drawer)
 * - appliedFilters: currently applied filters (used for API calls)
 * - URL synchronization for shareable/bookmarkable filter state
 */
export function useAsinFilters({ selectedSeller, marketplaceFilter }) {
  // Default filter state
  const defaultFilters = useMemo(() => ({
    status: '',
    category: '',
    brand: '',
    scrapeStatus: '',
    parentAsin: '',
    tag: '',
    sku: '',
    minPrice: '',
    maxPrice: '',
    minBSR: '',
    maxBSR: '',
    minRating: '',
    maxRating: '',
    minReviewCount: '',
    maxReviewCount: '',
    minImagesCount: '',
    maxImagesCount: '',
    minBulletPoints: '',
    maxBulletPoints: '',
    subBsrCategory: '',
    buyBoxWin: '',
    hasAplus: '',
    hasVideo: '',
    hasDeal: '',
    ageFilter: '',
    selectedTags: [],
    minReleaseDate: '',
    maxReleaseDate: '',
    priceDispute: '',
    bsrTrend: '',
    ratingTrend: '',
    historyDays: '',
    ads: '',
    availabilityStatus: '',
    manufacturer: '',
    dealAccessType: '',
  }), []);

  // Load initial state from URL on mount
  const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlFilters = {};
        for (const [key, value] of params.entries()) {
          if (key.startsWith('filter_')) {
            const filterKey = key.replace('filter_', '');
            // Handle arrays (selectedTags)
            if (filterKey === 'selectedTags') {
              urlFilters[filterKey] = value.split(',').filter(Boolean);
            } else {
              urlFilters[filterKey] = value;
            }
          }
        }
        return { ...defaultFilters, ...urlFilters };
      } catch {
        return defaultFilters;
      }
    }
    return defaultFilters;
  });

  // Applied filters - only updated on explicit "Apply"
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter trigger for components that need to know when applied filters changed
  const [filterTrigger, setFilterTrigger] = useState(0);

  // Sync filters to URL (debounced)
  const syncToUrl = useCallback((filterState) => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    
    // Remove existing filter params
    for (const key of Array.from(params.keys())) {
      if (key.startsWith('filter_')) params.delete(key);
    }
    
    // Add current filters
    Object.entries(filterState).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined && 
          !(Array.isArray(value) && value.length === 0)) {
        if (Array.isArray(value)) {
          params.set(`filter_${key}`, value.join(','));
        } else {
          params.set(`filter_${key}`, value);
        }
      }
    });
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Debounced URL sync
  const debouncedSyncRef = useRef(null);
  const syncFiltersToUrl = useCallback((filterState) => {
    if (debouncedSyncRef.current) clearTimeout(debouncedSyncRef.current);
    debouncedSyncRef.current = setTimeout(() => syncToUrl(filterState), 300);
  }, [syncToUrl]);

  // Sync URL changes back to filters (e.g., back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlFilters = { ...defaultFilters };
      for (const [key, value] of params.entries()) {
        if (key.startsWith('filter_')) {
          const filterKey = key.replace('filter_', '');
          if (filterKey === 'selectedTags') {
            urlFilters[filterKey] = value.split(',').filter(Boolean);
          } else {
            urlFilters[filterKey] = value;
          }
        }
      }
      setFilters(urlFilters);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [defaultFilters]);

  // Update filters and sync to URL
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      syncFiltersToUrl(next);
      return next;
    });
  }, [syncFiltersToUrl]);

  // Update multiple filters at once
  const updateFilters = useCallback((updates) => {
    setFilters(prev => {
      const next = { ...prev, ...updates };
      syncFiltersToUrl(next);
      return next;
    });
  }, [syncFiltersToUrl]);

  // Apply filters - copies working state to applied state
  const applyFilters = useCallback(() => {
    setAppliedFilters(filters);
    setFilterTrigger(t => t + 1);
  }, [filters]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setAppliedSearchQuery('');
    setSearchQuery('');
    setFilterTrigger(t => t + 1);
    syncToUrl(defaultFilters);
  }, [defaultFilters, syncToUrl]);

  // Clear a specific filter
  const clearFilter = useCallback((key, value = null) => {
    setFilters(prev => {
      const next = { ...prev };
      if (key === 'selectedTags') {
        next.selectedTags = (next.selectedTags || []).filter(t => t !== value);
      } else {
        next[key] = '';
      }
      syncFiltersToUrl(next);
      return next;
    });
  }, [syncFiltersToUrl]);

  // Count of active filters for UI badges
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'selectedTags') return Array.isArray(value) && value.length > 0;
      return value !== '' && value !== null && value !== undefined;
    }).length;
  }, [filters]);

  // Computed: whether filters have unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  }, [filters, appliedFilters]);

  return {
    // State
    filters,
    appliedFilters,
    appliedSearchQuery,
    searchQuery,
    setSearchQuery,
    filterTrigger,
    activeFilterCount,
    hasUnsavedChanges,
    defaultFilters,
    
    // Actions
    setFilters,
    setAppliedFilters,
    setAppliedSearchQuery,
    updateFilter,
    updateFilters,
    applyFilters,
    resetFilters,
    clearFilter,
    syncToUrl,
  };
}

// Also export a URL sync helper for search query
export function useSearchQuerySync() {
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('search') || '';
    }
    return '';
  });

  const setSearchQuerySynced = useCallback((query) => {
    setSearchQuery(query);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (query) {
        params.set('search', query);
      } else {
        params.delete('search');
      }
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  return [searchQuery, setSearchQuerySynced];
}