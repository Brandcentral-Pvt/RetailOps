import { Spinner, LoadingIndicator } from "@/components/Spinner";
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef } from 'react';
import { Drawer, Button, Input, Select, Space, Typography, Badge, Segmented, Tooltip, Dropdown, Menu, Modal, Form, Tag, message } from 'antd';
const { Text, Title } = Typography;
const TablePagination = lazy(() => import('@mui/material/TablePagination'));
import styles from './AsinManager.module.css';
import KPICard from '../components/KPICard';
import ProgressBar from '../components/common/ProgressBar';
import EmptyState from '../components/common/EmptyState';
import { LoadError } from '../components/LoadError';
import { AsinManagerSkeleton } from '../components/ui/PageSkeletons';
import { db } from '../services/db';
import { asinApi, marketSyncApi, sellerApi, taskApi, rulesetApi } from '../services/api';
import InfiniteScrollSelect from '../components/common/InfiniteScrollSelect';
import { useSocket } from '../contexts/SocketContext';
import {
  Package,
  Activity,
  Trophy,
  AlertTriangle,
  Zap,
  TrendingUp,
  BarChart2,
  Star,
  Plus,
  PlusCircle,
  Table,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Search,
  Scan,
  IndianRupee,
  ChevronRight,
  ChevronsUp,
  ChevronLeft,
  TrendingDown,
  Trash2,
  Sparkles,
  Image,
  Eye,
  ListChecks,
  FileUp,
  LayoutGrid,
  AlertCircle,
  Clock,
  ExternalLink,
  Video,
  PlayCircle,
  PauseCircle,
  Award,
  Filter,
  Tag as TagIcon,
  SlidersHorizontal,
  Megaphone,
  MoreVertical,
  MoreHorizontal,
  Edit3,
  Upload,
  Rows3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useHeader } from '../contexts/HeaderContext';

const AsinDetailModal = lazy(() => import('../components/AsinDetailModal'));
const AsinTrendsModal = lazy(() => import('../components/AsinTrendsModal'));
const PriceViewModal = lazy(() => import('../components/PriceViewModal'));
const BSRViewModal = lazy(() => import('../components/BSRViewModal'));
const RatingViewModal = lazy(() => import('../components/RatingViewModal'));
const ExportAsinModal = lazy(() => import('../components/asins/ExportAsinModal'));
const EditTagsModal = lazy(() => import('../components/asins/EditTagsModal'));
const BulkImportModal = lazy(() => import('../components/asins/BulkImportModal'));
import TagsCell from '../components/asins/TagsCell';
import BulkTagsModal from '../components/asins/BulkTagsModal';
import TrendBadge from '../components/asins/TrendBadge';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import ColumnVisibilityPanel from '../components/asins/ColumnVisibilityPanel';
import AppliedFilterBadges from '../components/asins/AppliedFilterBadges';
import { useAsinData } from '../hooks/useAsinData';
import { useParentChildren } from '../hooks/useParentChildren';
import {
  generateHistoryStructureFromDates,
  normalizeDateStr,
  getWeekHistoryBadge,
  getReviewTrendStatus
} from '../utils/asinHistory.jsx';

import Popover from '../components/common/Popover';

const UNAVAILABLE_MARKERS = [
  'unavailable',
  'out of stock',
  'out_of_stock',
  'currently unavailable'
];

const DENSITY_ORDER = ['compact', 'comfortable', 'roomy'];

const DENSITY_LABELS = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  roomy: 'Roomy'
};

function isUnavailableStatus(asin) {
  const status = (asin?.availabilityStatus || '').toLowerCase();
  return UNAVAILABLE_MARKERS.some(marker => status.includes(marker));
}

const AsinManagerPage = () => {
    const { isAdmin, hasPermission } = useAuth();
    const [showDashboard, setShowDashboard] = useState(true);
    const [newAsin, setNewAsin] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showManualTaskModal, setShowManualTaskModal] = useState(false);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskPriority, setTaskPriority] = useState('MEDIUM');
    const [taskCategory, setTaskCategory] = useState('GENERAL_OPTIMIZATION');
const [sortBy, setSortBy] = useState('lastLiveSyncAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [_scrapingIds, setScrapingIds] = useState(new Set());
  const { setPageMeta } = useHeader();

  const [scrapeProgress, setScrapeProgress] = useState(null);
  const socket = useSocket();
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [, setFilterTrigger] = useState(0);
  const [, setShowActionsDropdown] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTrendsModal, setShowTrendsModal] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsinForPrice, setSelectedAsinForPrice] = useState(null);
  const [rowDensity, setRowDensity] = useState(() => {
    try {
      const stored = localStorage.getItem('asin-table-density');
      return DENSITY_ORDER.includes(stored) ? stored : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const [selectedAsinForBsr, setSelectedAsinForBsr] = useState(null);
  const [selectedAsinForRating, setSelectedAsinForRating] = useState(null);
  const [showAllPriceHistory, setShowAllPriceHistory] = useState(false);
  const [showAllBsrHistory, setShowAllBsrHistory] = useState(false);
  const [showAllRatingHistory, setShowAllRatingHistory] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(() => localStorage.getItem('selectedSeller') || '');
  // Persist seller selection
  useEffect(() => {
    localStorage.setItem('selectedSeller', selectedSeller);
  }, [selectedSeller]);

  const [marketplaceFilter, setMarketplaceFilter] = useState(() => {
    const v = localStorage.getItem('selectedMarketplace');
    return v && v !== 'undefined' && v !== '' ? v : 'all';
  });
  // Persist marketplace selection
  useEffect(() => {
    localStorage.setItem('selectedMarketplace', marketplaceFilter);
  }, [marketplaceFilter]);

  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  useEffect(() => {
    if (!canAccessAmazon && !canAccessMyntra && canAccessAjio && marketplaceFilter !== 'ajio') {
      setMarketplaceFilter('ajio');
    } else if (!canAccessAmazon && !canAccessAjio && canAccessMyntra && marketplaceFilter !== 'myntra') {
      setMarketplaceFilter('myntra');
    } else if (canAccessAmazon && !canAccessAjio && !canAccessMyntra && (marketplaceFilter === 'ajio' || marketplaceFilter === 'myntra' || marketplaceFilter === 'all')) {
      setMarketplaceFilter('amazon.in');
    }
  }, [canAccessAmazon, canAccessAjio, canAccessMyntra, marketplaceFilter]);

const [repairStatus, setRepairStatus] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [activeEditAsin, setActiveEditAsin] = useState(null);
    const isFirstRenderRef = useRef(true);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const {
    visibleColumns,
    isVisible: baseIsVisible,
    updateVisibleColumns,
    allColumns,
    columnCategories
  } = useColumnVisibility();

  const isVisible = useCallback((key) => {
    // Removed restriction for marketplaceFilter === 'ajio' to ensure parity with Amazon datatable.

    // For Amazon/General datatables: Show Deal Badge, but hide Discount Percentage as requested.
    // For Ajio: show the Discount % column since scraped discounts are core data there.
    if (key === 'discountPercentage') return marketplaceFilter === 'ajio';
    if (key === 'dealBadge') return true;

    return baseIsVisible(key);
  }, [baseIsVisible, marketplaceFilter]);

const [showColumnPanel, setShowColumnPanel] = useState(false);
    const [showBulkTagsModal, setShowBulkTagsModal] = useState(false);

    const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
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
    dealAccessType: ''
  });
  const {
    asins, setAsins,
    globalHistoryDates,
    availableMonths, setAvailableMonths,
    loading, setLoading,
    error,
    stats,
    pagination, setPagination,
    initialLoadComplete,
    loadData, retry
  } = useAsinData({
    selectedSeller,
    marketplaceFilter,
    appliedSearchQuery,
    appliedFilters,
    sortBy,
    sortOrder,
    limit: 25
  });

  useEffect(() => {
    setPageMeta({
      title: 'ASIN Manager',
      subtitle: `Managing ${pagination.total} ASINs`,
      breadcrumbs: [{ label: 'Workspace' }, { label: 'ASIN Manager' }],
    });
  }, [setPageMeta, pagination.total]);

  const historyStructure = useMemo(() => {
    if (globalHistoryDates && globalHistoryDates.length > 0) {
      // Lexical sort on YYYY-MM-DD gives chronological order (Oldest -> Newest)
      // Reverse if needed, but generateHistoryStructureFromDates takes sorted Oldest -> Newest
      const sortedDates = [...globalHistoryDates].sort();
      return generateHistoryStructureFromDates(sortedDates);
    }
    return [{ label: 'W1', dates: [{ label: 'N/A' }] }];
  }, [globalHistoryDates]);

  const visibleHistoryCols = useMemo(() => {
    if (!historyStructure) return 0;
    // Since we now always show exactly the entries in historyStructure (7 days)
    return historyStructure.reduce((sum, w) => sum + w.dates.length, 0);
  }, [historyStructure]);

  const [priceTrendExpanded, setPriceTrendExpanded] = useState(false);
  const [bsrTrendExpanded, setBsrTrendExpanded] = useState(false);
  const [ratingTrendExpanded, setRatingTrendExpanded] = useState(false);
  const [reviewTrendExpanded, setReviewTrendExpanded] = useState(false);
  const [imageTrendExpanded, setImageTrendExpanded] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [gmsRevenueExpanded, _setGmsRevenueExpanded] = useState(false);

  const formatMonthHeader = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  const visibleOrdersCount = useMemo(() => {
    if (!isVisible('totalOrders')) return 0;
    return ordersExpanded ? availableMonths.length + 1 : 1;
  }, [isVisible, ordersExpanded, availableMonths]);

  const visiblePriceTrendCount = useMemo(() => {
    if (!isVisible('priceTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleBsrTrendCount = useMemo(() => {
    if (!isVisible('bsrTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleRatingTrendCount = useMemo(() => {
    if (!isVisible('ratingTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleReviewTrendCount = useMemo(() => {
    if (!isVisible('reviewTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const visibleImageTrendCount = useMemo(() => {
    if (!isVisible('imageTrend')) return 0;
    return visibleHistoryCols;
  }, [isVisible, visibleHistoryCols]);

  const getTransitionStyle = (isExpanded, index, totalCount, baseWidth = '42px') => {
    const isLast = index === totalCount - 1;
    const isVisible = isExpanded || isLast;
    return {
      width: isVisible ? baseWidth : '0px',
      minWidth: isVisible ? baseWidth : '0px',
      maxWidth: isVisible ? baseWidth : '0px',
      opacity: isVisible ? 1 : 0,
      padding: isVisible ? '2px 4px' : '0px',
      borderLeftWidth: isVisible ? '1px' : '0px',
      borderRightWidth: isVisible ? '1px' : '0px',
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: isVisible ? 'auto' : 'none',
      whiteSpace: 'nowrap'
    };
  };

  const [tagSearch, setTagSearch] = useState('');
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  // Parent view state
  const [viewMode, setViewMode] = useState('asin'); // 'asin' | 'parent'
  const [parentData, setParentData] = useState([]);
  const [parentPagination, setParentPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const {
    expandedParents,
    expandedCount,
    loadingParents,
    toggleParentExpand,
    collapseAll,
    withExpandedChildren
  } = useParentChildren();
  const [filters, setFilters] = useState({
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
    dealAccessType: ''
  });

  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    brands: [],
    scrapeStatuses: [],
    statuses: [],
    tags: []
  });

  // Explicit Apply Handlers
  const handleApplySearch = () => {
    setSelectedIds(new Set()); // Reset selection on new search
    setAppliedSearchQuery(searchQuery);
  };

  // Dynamic dispute calculation — computed at render time
  const isDealActive = (asin) => {
    if (!asin.dealBadge || asin.dealBadge === 'No deal found' || asin.dealBadge === '') return false;
    if (asin.dealStartTime && asin.dealEndTime) {
      const now = new Date();
      return new Date(asin.dealStartTime) <= now && now <= new Date(asin.dealEndTime);
    }
    return false;
  };

  const computeDynamicDispute = (asin) => {
    // If there's an active deal, no dispute
    if (isDealActive(asin)) return false;
    // If uploaded price and current price exist and differ > ₹5, dispute
    const uploaded = asin.uploadedPrice || asin.UploadedPrice || 0;
    const current = asin.currentPrice || asin.CurrentPrice || 0;
    if (uploaded > 0 && current > 0 && Math.abs(uploaded - current) > 5) return true;
    return false;
  };

  const cycleRowDensity = useCallback(() => {
    setRowDensity((prev) => {
      const current = DENSITY_ORDER.indexOf(prev);
      const next = DENSITY_ORDER[(current + 1) % DENSITY_ORDER.length];
      try {
        localStorage.setItem('asin-table-density', next);
      } catch {
        // Persistence is best-effort; density still applies for this session.
      }
      return next;
    });
  }, []);

  const resetAllFilters = useCallback(() => {
    const resetState = {
      category: '', brand: '', scrapeStatus: '',
      parentAsin: '', sku: '', subBsrCategory: '',
      minPrice: '', maxPrice: '', minBSR: '', maxBSR: '',
      minRating: '', maxRating: '',
      selectedTags: [],
      buyBoxWin: '', hasAplus: '', hasVideo: '', hasDeal: '',
      ageFilter: '', minReleaseDate: '', maxReleaseDate: '',
      minReviewCount: '', maxReviewCount: '', minImagesCount: '', maxImagesCount: '',
      minBulletPoints: '', maxBulletPoints: '',
      bsrTrend: '', ratingTrend: '', historyDays: '', ads: '',
      availabilityStatus: '', manufacturer: '', dealAccessType: ''
    };
    setFilters(resetState);
    setAppliedFilters(resetState);
    setSearchQuery('');
    setAppliedSearchQuery('');
    setFilterPanelOpen(false);
    setFilterTrigger(t => t + 1);
  }, []);

  const removeAppliedFilter = useCallback((key, value = null) => {
    setAppliedFilters(prev => {
      const next = { ...prev };
      if (key === 'selectedTags') {
        next.selectedTags = (next.selectedTags || []).filter(t => t !== value);
      } else {
        next[key] = '';
      }
      return next;
    });
    // Also sync the drawer filters state
    setFilters(prev => {
      const next = { ...prev };
      if (key === 'selectedTags') {
        next.selectedTags = (next.selectedTags || []).filter(t => t !== value);
      } else {
        next[key] = '';
      }
      return next;
    });
    setFilterTrigger(t => t + 1);
  }, []);


  const handleApplyFilters = () => {    setSelectedIds(new Set());
    setAppliedFilters(filters);
    setFilterPanelOpen(false);
  };

  // Fetch filter options when seller changes
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await asinApi.getFilters(selectedSeller ? { seller: selectedSeller } : {});
        if (res.success) setFilterOptions(res.data);
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    fetchFilters();
  }, [selectedSeller]);

  // Fetch all sellers once for badge labels
  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await sellerApi.getAll({ page: 1, limit: 1000 });
        if (res.success) setSellers(res.data.sellers || []);
      } catch (err) {
        console.error('Error fetching sellers for labels:', err);
      }
    };
    fetchSellers();
  }, []);

  // CSV Upload handler
  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSellerId) {
      message.warning('Please select a file and seller');
      return;
    }

    setUploading(true);
    try {
      const result = await asinApi.importCsv(file, selectedSellerId);
      message.success(`Imported ${result.inserted} ASINs. ${result.duplicates} duplicates skipped.`);
      setShowUploadModal(false);
      loadData();
    } catch (err) {
      message.error('Import failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleViewAsin = (asin) => {
    setSelectedAsin(asin);
    setShowDetailModal(true);
  };

  const handleToggleSelectRow = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);


  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleViewTrends = (asin) => {
    setSelectedAsin(asin);
    setShowTrendsModal(true);
  };

  const handleViewPrice = (asin, e) => {
    e.stopPropagation();
    setSelectedAsinForPrice(asin);
  };

  const handleViewBsr = (asin, e) => {
    e.stopPropagation();
    setSelectedAsinForBsr(asin);
  };

  const handleViewRating = (asin, e) => {
    e.stopPropagation();
    setSelectedAsinForRating(asin);
  };

  const handleBulkPriceDispute = async (isDispute) => {
    if (selectedIds.size === 0) {
      message.warning('Please select at least one ASIN');
      return;
    }

    const confirmed = await new Promise(resolve => {
      Modal.confirm({ title: 'Confirm', content: `Mark ${selectedIds.size} ASINs as ${isDispute ? 'Disputed' : 'Resolved'}?`, onOk: () => resolve(true), onCancel: () => resolve(false) });
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await asinApi.bulkUpdate(Array.from(selectedIds), { priceDispute: isDispute });
      if (res.success) {
        // toast or notification here
        loadData(pagination.page);
        setSelectedIds(new Set());
      }
    } catch (err) {
      message.error('Bulk update failed: ' + err.message);
    } finally {
      setLoading(false);
      setShowActionsDropdown(false);
    }
  };

  const handleRunRulesets = async () => {
    if (selectedIds.size === 0) {
      message.warning('Please select at least one ASIN');
      return;
    }

    const selectedAsinCodes = asins
      .filter(a => selectedIds.has(a._id || a.Id))
      .map(a => a.asinCode || a.AsinCode);

    if (selectedAsinCodes.length === 0) {
      message.warning('No valid ASIN codes found in selection.');
      return;
    }

    const confirmed = await new Promise(resolve => {
      Modal.confirm({ title: 'Confirm', content: `Are you sure you want to run active rulesets on ${selectedAsinCodes.length} selected ASIN(s)?`, onOk: () => resolve(true), onCancel: () => resolve(false) });
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await rulesetApi.executeForAsins(selectedAsinCodes);
      if (res.success) {
        message.success(`Successfully evaluated active rulesets and generated tasks!`);
        setSelectedIds(new Set());
      } else {
        message.error('Ruleset execution failed: ' + (res.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Ruleset execution error:', err);
      message.error('Error running rulesets: ' + err.message);
    } finally {
      setLoading(false);
      setShowActionsDropdown(false);
    }
  };

  const handleOpenTaskModal = () => {
    if (selectedIds.size === 0) {
      message.warning('Please select at least one ASIN');
      return;
    }
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('MEDIUM');
    setTaskCategory('GENERAL_OPTIMIZATION');
    setShowManualTaskModal(true);
    setShowActionsDropdown(false);
  };

  const handleCreateManualTask = async () => {
    if (!taskTitle.trim()) {
      message.warning('Please enter a task title');
      return;
    }

    const selectedAsinCodes = asins
      .filter(a => selectedIds.has(a._id || a.Id))
      .map(a => a.asinCode || a.AsinCode);

    if (selectedAsinCodes.length === 0) {
      message.warning('No valid ASIN codes found in selection.');
      return;
    }

    const firstSelectedAsin = asins.find(a => selectedIds.has(a._id || a.Id));
    const sellerId = firstSelectedAsin?.sellerId || firstSelectedAsin?.SellerId || null;

    setLoading(true);
    try {
      const payload = {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        type: taskCategory,
        asins: selectedAsinCodes,
        sellerId: sellerId
      };

      const res = await db.createAction(payload);
      if (res && (res.success || res.data)) {
        message.success(`✅ Successfully created task for ${selectedAsinCodes.length} ASIN(s)!`);
        setSelectedIds(new Set());
        setShowManualTaskModal(false);
      } else {
        message.error('Failed to create task: ' + (res?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Task creation error:', err);
      message.error('Error creating task: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Removed client-side filteredAsins useMemo as we now use server-side search
  // Parent view interleaves lazily-loaded children beneath their parent row;
  // ASIN view has no parent markers so this is a pass-through.
  const filteredAsins = useMemo(
    () => withExpandedChildren(viewMode === 'parent' ? parentData : asins),
    [withExpandedChildren, viewMode, parentData, asins]
  );

  // Parent rows stay selectable (their _id is a real Asins row); only the
  // interleaved child and loading placeholders are excluded.
  const selectableRows = useMemo(
    () => filteredAsins.filter(a => a._id && !a._isChild && !a._isChildLoading),
    [filteredAsins]
  );

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === selectableRows.length && selectableRows.length > 0) {
        return new Set();
      }
      return new Set(selectableRows.map(a => a._id));
    });
  }, [selectableRows]);

  // Parent View data loading — transforms parent data into ASIN-shaped rows
  // so the SAME table rendering code works for both views
  const loadParentData = useCallback(async (page = 1, limit = 50) => {
    try {
      const res = await asinApi.getParentView({
        sellerId: selectedSeller,
        search: appliedSearchQuery,
        sortBy,
        sortOrder,
        page,
        limit,
      });
      if (res.success) {
        // Transform parent data into ASIN-shaped rows so the same table works
        const asinShaped = (res.data || []).map(p => ({
          _id: p.parentAsin,
          _isParent: true,
          asinCode: p.parentAsin,
          parentAsin: p.parentAsin,
          title: p.title || '',
          brand: p.brand || '',
          sku: '',
          status: 'Active',
          sellerName: p.sellerName || '',
          childCount: p.childCount || 0,
          // Map GMS data to standard ASIN fields
          bsr: p.bestBsr || 0,
          rating: p.avgRating || 0,
          reviewCount: p.totalReviews || 0,
          lqs: p.avgLqs || 0,
          currentPrice: p.avgPrice || 0,
          mrp: 0,
          uploadedPrice: 0,
          totalOrders: 0, // Parent data doesn't have AdsPerformance orders
          hasGms: p.hasGms || false,
          hasAds: p.hasAds || false,
          // GMS data stored separately — NOT in monthlyOrders
          monthlyGmsRevenue: p.monthlyGms || {},
          monthlyGmsUnits: Object.fromEntries(
            Object.entries(p.monthlyGms || {}).map(([k, v]) => [k, v.units || 0])
          ),
          // Placeholder fields to prevent undefined errors in existing columns
          buyBoxWin: p.buyboxWins > 0 ? 1 : 0,
          hasAplus: p.withAplus > 0 ? 1 : 0,
          availabilityStatus: '',
          Tags: '[]',
          tags: '[]',
          imageUrl: '',
          priceDispute: false,
          dealBadge: '',
          dealStartTime: null,
          dealEndTime: null,
          dealAccessType: null,
          dealPercentClaimed: null,
          manufacturer: '',
          priceType: '',
          discountPercentage: 0,
          secondAsp: 0,
          aspDifference: 0,
          bsrTrend: '',
          ratingTrend: '',
          soldBy: '',
          soldBySec: '',
          buyBoxes: [],
          allOffers: [],
          history: [],
          weekHistory: [],
          subBsrHistory: [],
          priceTrend: [],
          bsrTrendHistory: [],
          ratingTrendHistory: [],
          reviewTrendHistory: [],
          imageTrendHistory: [],
          releaseDate: null,
          ImagesCount: 0,
          VideoCount: 0,
          BulletPoints: 0,
        }));
        setParentData(asinShaped);
        // Extract available months from the GMS monthly data
        const allMonths = new Set();
        asinShaped.forEach(a => {
          if (a.monthlyOrders && typeof a.monthlyOrders === 'object') {
            Object.keys(a.monthlyOrders).forEach(m => allMonths.add(m));
          }
        });
        setAvailableMonths([...allMonths].sort());
        setParentPagination(res.pagination || { page: 1, limit, total: 0, totalPages: 0 });
      }
    } catch (err) {
      console.error('Error fetching parent view:', err);
      setParentData([]);
    } finally {
      // noop
    }
  }, [selectedSeller, appliedSearchQuery, sortBy, sortOrder, setAvailableMonths]);


  // Switch view mode and load appropriate data.
  // On first render skip the list branch — the [loadData, refreshCount] effect
  // below already performs the initial list load, avoiding a wasted duplicate request.
  useEffect(() => {
    if (viewMode === 'parent') {
      loadParentData(parentPagination.page, parentPagination.limit);
    } else if (!isFirstRenderRef.current) {
      loadData(pagination.page, pagination.limit);
    }
    isFirstRenderRef.current = false;
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (field) => {
    const nextOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(nextOrder);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const renderSortableHeader = (label, field, align = 'between') => {
    const active = sortBy === field;
    const justify = align === 'right' ? 'justify-content-end' : align === 'center' ? 'justify-content-center' : 'justify-content-between';
    return (
      <button
        type="button"
        className={`asin-grid__sort d-flex align-items-center ${justify}`}
        onClick={() => handleSort(field)}
        aria-label={`Sort by ${label}`}
        aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span className={justify === 'justify-content-end' ? 'me-1' : ''}>{label}</span>
        <span className={`asin-grid__sort-icon${active ? ' asin-grid__sort-icon--active' : ''}`} style={{ fontSize: '7px', gap: '-3px', minWidth: '10px' }}>
          <ChevronUp size={8} strokeWidth={4} style={{ color: active && sortOrder === 'asc' ? 'var(--text-brand)' : 'var(--bc-text-muted)', marginBottom: '-2px' }} />
          <ChevronDown size={8} strokeWidth={4} style={{ color: active && sortOrder === 'desc' ? 'var(--text-brand)' : 'var(--bc-text-muted)' }} />
        </span>
      </button>
    );
  };

  const handleRecalculateLQS = async () => {
    const selectedArray = Array.from(selectedIds);
    const msg = selectedArray.length > 0
      ? `Recalculate LQS for ${selectedArray.length} selected ASINs?`
      : 'Recalculate LQS for all ASINs in your current view/scope?';

    const confirmed = await new Promise(resolve => {
      Modal.confirm({ title: 'Confirm', content: msg, onOk: () => resolve(true), onCancel: () => resolve(false) });
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await asinApi.recalculateLQS(selectedArray);
      if (response.success) {
        message.success(`Successfully recalculated LQS for ${response.processedCount} ASINs`);
        loadData(pagination.page, pagination.limit);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Recalculate LQS error:', err);
      message.error('Error recalculating LQS: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    // MUI uses 0-indexed pages, API uses 1-indexed
    loadData(newPage + 1, pagination.limit);
  };

  const handleChangeRowsPerPage = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    // Reset to first page when limit changes
    loadData(1, newLimit);
  };

  const { refreshCount } = useRefresh();

  useEffect(() => {
    loadData();
  }, [loadData, refreshCount]);

  // Track pending updates for debouncing
  const pendingRefreshRef = useRef(null);
  const updatedAsinIdsRef = useRef(new Set());

  useEffect(() => {
    if (!socket) return;

    socket.on('scrape_progress', (data) => {
      setScrapeProgress(data);
      if (data.status === 'Complete') {
        setTimeout(() => {
          setScrapeProgress(null);
          loadData(pagination.page);
        }, 3000);
      }
    });

    // BATCH UPDATES: Collect all updated ASIN IDs and refresh once
    socket.on('scrape_data_ingested', (data) => {
      // If we're already handling a batch complete event, we might want to skip individual ones
      // But for real-time feel, we keep the debounce
      updatedAsinIdsRef.current.add(data.asinCode);

      // Clear existing timeout
      if (pendingRefreshRef.current) clearTimeout(pendingRefreshRef.current);

      // Wait 3 seconds for more updates, then refresh once
      pendingRefreshRef.current = setTimeout(() => {
        console.log(`📬 Batch refresh: Updating table after ${updatedAsinIdsRef.current.size} ASINs changed via socket`);
        updatedAsinIdsRef.current.clear();
        loadData(pagination.page);
        pendingRefreshRef.current = null;
      }, 3000); // Increased batch window to 3 seconds for stability
    });

    socket.on('scrape_batch_complete', (data) => {
      console.log(`📬 Batch update: ${data.count} ASINs processed for seller ${data.sellerId}`);
      // Refresh the table once for the entire batch
      loadData(pagination.page);
    });

    socket.on('repair_job_progress', (data) => {
      console.log('🛠️ Repair progress:', data);
      setRepairStatus({ running: true, ...data });
    });

    socket.on('repair_job_finished', (data) => {
      console.log('✅ Repair finished:', data);
      setRepairStatus(null);
      message.info(`Data repair completed! Processed: ${data.processed}, Failed: ${data.failed}`);
      loadData();
    });

    // Live Sync events - auto-refresh ASIN data with toast notifications
    socket.on('ASINS_UPDATED', (data) => {
      console.log('⚡ ASINS_UPDATED received:', data);
      loadData(pagination.page);
    });

    socket.on('liveSync:completed', (data) => {
      console.log('⚡ Live sync completed:', data);
      message.success({
        content: `Live sync completed — ${data.updatedAsins} ASINs updated for seller`,
        icon: <Zap size={16} style={{ color: 'var(--color-secondary)' }} />,
        duration: 4
      });
      loadData(pagination.page);
    });

    socket.on('liveSyncAll:completed', (data) => {
      console.log('⚡ Global live sync completed:', data);
      message.success({
        content: `Global live sync completed — ${data.totalAsinsUpdated} ASINs updated across ${data.totalSellers} sellers`,
        icon: <Zap size={16} style={{ color: 'var(--color-secondary)' }} />,
        duration: 5
      });
      loadData(pagination.page);
    });

    socket.on('SELLERS_UPDATED', (data) => {
      console.log('📡 Sellers updated:', data);
      loadData(pagination.page);
    });

    return () => {
      socket.off('scrape_progress');
      socket.off('scrape_data_ingested');
      socket.off('scrape_batch_complete');
      socket.off('repair_job_progress');
      socket.off('repair_job_finished');
      socket.off('ASINS_UPDATED');
      socket.off('liveSync:completed');
      socket.off('liveSyncAll:completed');
      socket.off('SELLERS_UPDATED');
      if (pendingRefreshRef.current) clearTimeout(pendingRefreshRef.current);
    };
  }, [socket, loadData, pagination.page]);

  const fetchSellerDropdownData = useCallback(async (page = 1, search = '') => {
    try {
      const params = { page, limit: 1000, search };
      if (marketplaceFilter && marketplaceFilter !== 'all') {
        params.marketplace = marketplaceFilter;
      }
      const response = await sellerApi.getAll(params);
      if (response.success) {
        return {
          data: response.data.sellers || [],
          hasMore: response.data.pagination.page < response.data.pagination.totalPages
        };
      }
      return { data: [], hasMore: false };
    } catch (err) {
      console.error('Error fetching sellers for dropdown:', err);
      return { data: [], hasMore: false };
    }
  }, [marketplaceFilter]);

  const kpis = useMemo(() => {
    if (stats) {
      const reviewChange = stats.reviewAnalysis?.currentVsPreviousChange || 0;
      const reviewTrend = reviewChange >= 0 ? '↑' : '↓';
      const reviewColor = reviewChange >= 0 ? 'var(--text-success)' : 'var(--text-danger)';
      const bestSeller = stats.bestSellingAsins?.[0];

      // Compute derived values not directly in API response
      const totalNum = Number(stats.total) || 0;
      const activeNum = Number(stats.active) || 0;
      const uniqueParents = Number(stats.uniqueParents) || 1;
      const totalReviews = Number(stats.totalReviews) || 0;
      const avgReviewsPerParent = uniqueParents > 0 ? Math.round(totalReviews / uniqueParents) : 0;
      const avgPriceNum = parseFloat(stats.avgPrice) || 0;
      const avgLqsNum = parseFloat(stats.avgLQS) || 0;

      return [
        {
          label: 'ALL ASINS', value: totalNum.toLocaleString(), color: 'var(--text-brand)', icon: <Package size={14} />,
          sub: `${uniqueParents} parent groups`
        },
        {
          label: 'ACTIVE ASINS', value: activeNum.toLocaleString(), color: 'var(--text-success)', icon: <Activity size={14} />,
          sub: `${totalNum - activeNum} inactive`
        },
        {
          label: 'TOTAL REVIEWS',
          value: totalReviews.toLocaleString(),
          color: 'var(--color-secondary)',
          icon: <Star size={14} />,
          sub: `Avg ${avgReviewsPerParent.toLocaleString()}/parent`,
          onClick: () => { setShowAllRatingHistory(true); }
        },
        {
          label: 'AVG RATING',
          value: `${stats.avgRating || '0.00'} ★`,
          color: 'var(--text-warning)',
          icon: <Trophy size={14} />,
          sub: `${stats.above4Star || 0} above 4★`,
          onClick: () => { setShowAllRatingHistory(true); }
        },
        {
          label: 'BEST SELLER',
          value: bestSeller ? `#${(bestSeller.BSR || bestSeller.bsr || 0).toLocaleString()}` : '-',
          sub: bestSeller?.AsinCode || bestSeller?.asinCode || '',
          color: 'var(--text-brand)',
          icon: <Award size={14} />,
          onClick: () => { setShowAllBsrHistory(true); }
        },
        {
          label: 'AVG PRICE',
          value: '₹' + avgPriceNum.toLocaleString(),
          color: 'var(--color-secondary)',
          icon: <IndianRupee size={14} />,
          onClick: () => { setShowAllPriceHistory(true); }
        },
        {
          label: 'AVG LQS',
          value: avgLqsNum.toFixed(1) + '%',
          color: 'var(--color-secondary)',
          icon: <Sparkles size={14} />
        },
        {
          label: 'REVIEWS (7D)',
          value: `${reviewTrend} ${Math.abs(reviewChange)}%`,
          color: reviewColor,
          icon: <TrendingUp size={14} />,
          sub: `${stats.reviewAnalysis?.currentWeek || 0} vs ${stats.reviewAnalysis?.previousWeek || 0}`
        },
      ];
    }

    // Fallback when stats not available
    const total = asins?.length || 0;
    return [
      { label: 'ALL ASINS', value: total.toLocaleString(), color: 'var(--text-brand)', icon: <Package size={14} /> },
      { label: 'ACTIVE', value: asins.filter(a => a.status === 'Active').length, color: 'var(--text-success)', icon: <Activity size={14} /> },
    ];
  }, [asins, stats]);


  const handleSync = useCallback(async () => {
    if (!newAsin.trim()) {
      message.warning('Please enter at least one ASIN');
      return;
    }

    if (!selectedSellerId) {
      message.warning('Please select a target seller association first.');
      return;
    }

    setSyncing(true);
    try {
      const asinList = newAsin.split(/[,\s]+/).map(a => a.trim().toUpperCase()).filter(a => a.length > 0);

      if (asinList.length === 0) {
        message.warning('No valid ASINs found.');
        setSyncing(false);
        return;
      }

      const asinsPayload = asinList.map(code => ({
        asinCode: code,
        status: 'Active',
        sellerId: selectedSellerId
      }));

      // Call the bulk API method
      await asinApi.createBulk(asinsPayload);

      // Refresh list
      await loadData();

      message.success(`Successfully added ${asinList.length} ASIN(s) to the tracking pool.`);
      setNewAsin('');
      setSelectedSellerId('');
      setShowAddModal(false);

    } catch (error) {
      console.error('Failed to add ASINs:', error);
      message.error('Failed to add ASINs: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }, [newAsin, loadData, selectedSellerId]);

  const handleIndividualScrape = async (asinId) => {
    try {
      setScrapingIds(prev => new Set(prev).add(asinId));
      await marketSyncApi.syncAsin(asinId);
      message.success('Scraping initiated successfully!');
      loadData();
    } catch (err) {
      console.error('Scrape failed:', err);
      message.error('Failed to start scraping: ' + err.message);
    } finally {
      setScrapingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(asinId);
        return newSet;
      });
    }
  };

  const handleDeleteAsin = async (asinId) => {
    const confirmed = await new Promise(resolve => {
      Modal.confirm({ title: 'Confirm', content: 'Are you sure you want to completely delete this ASIN from the database? This action cannot be undone.', onOk: () => resolve(true), onCancel: () => resolve(false) });
    });
    if (!confirmed) return;
    try {
      setSyncing(true);
      await asinApi.delete(asinId);
      message.success('✅ ASIN deleted successfully from the database.');
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
      message.error('Failed to delete ASIN: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAsinStatus = async (asinId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
      await asinApi.update(asinId, { status: newStatus });
      message.success(`ASIN ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully.`);
      loadData();
    } catch (error) {
      console.error('Failed to toggle ASIN status:', error);
      message.error('Failed to toggle status: ' + error.message);
    }
  };

  const handleBulkScrape = async () => {
    const totalCount = stats?.total || asins.length;

    // Quick confirmation for global heavy action
    const confirmed = await new Promise(resolve => {
      Modal.confirm({ title: 'Confirm', content: `Force-sync and refresh all ${totalCount} ASINs? This starts concurrent Octoparse tasks in the background.`, onOk: () => resolve(true), onCancel: () => resolve(false) });
    });
    if (!confirmed) return;

    try {
      setSyncing(true);

      // 1. Trigger concurrent background scrapes in Octoparse
      await marketSyncApi.syncAll();

      // 2. Refresh current local database data in UI
      await loadData(pagination.page);

      message.success(`✅ Success: Sync initiated for all ${totalCount} ASINs. Background scrapes are now running concurrently.`);
    } catch (err) {
      console.error('Bulk scrape failed:', err);
      message.error('❌ Failed to start bulk scraping: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkCreateActions = async () => {
    try {
      const totalCount = stats?.total || asins.length;
      const confirmed = await new Promise(resolve => {
        Modal.confirm({ title: 'Confirm', content: `Auto-generate optimization tasks for ALL ${totalCount} ASINs? This will analyze every ASIN in the current filter.`, onOk: () => resolve(true), onCancel: () => resolve(false) });
      });
      if (!confirmed) return;

      setSyncing(true);
      const res = await db.createBulkActionsFromAnalysis();
      if (res && res.count > 0) {
        message.success(`✅ Successfully generated ${res.count} bulk optimization tasks!`);
      } else if (res && res.success === false) {
        message.error(`❌ Error: ${res.message || 'Failed to create tasks'}`);
      } else {
        message.info('Analysis complete. All ASINs look good! No optimization actions needed.');
      }
    } catch (err) {
      console.error('Bulk task creation failed:', err);
      message.error('Failed to create bulk tasks: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectedCreateActions = async () => {
    try {
      const selectedAsinIds = Array.from(selectedIds);
      if (selectedAsinIds.length === 0) {
        message.warning('Please select at least one ASIN first.');
        return;
      }

      const confirmed = await new Promise(resolve => {
        Modal.confirm({ title: 'Confirm', content: `Analyze ${selectedAsinIds.length} ASINs and generate optimization tasks?`, onOk: () => resolve(true), onCancel: () => resolve(false) });
      });
      if (!confirmed) return;

      setSyncing(true);
      const res = await taskApi.generate(selectedAsinIds);

      if (res.success) {
        message.success(`✅ Generated ${res.savedCount} optimization tasks from ${res.summary.analyzed} ASINs!\n\n` +
          `By Category: ${JSON.stringify(res.summary.byCategory)}\n` +
          `High Priority: ${res.summary.byPriority.High} | Medium: ${res.summary.byPriority.Medium}`);
        clearSelection();
      } else if (res && res.success === false) {
        message.error(`❌ Error: ${res.message || 'Failed to create tasks'}`);
      } else {
        message.info('Selected ASINs analyzed. No immediate optimizations required for these specific items.');
      }
    } catch (err) {
      console.error('Selected task creation failed:', err);
      message.error('Failed to create selected tasks: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);

  const handleAiListingAnalysis = async () => {
    const selectedAsinIds = Array.from(selectedIds);
    if (selectedAsinIds.length === 0) { message.warning('Please select ASINs first.'); return; }
    if (selectedAsinIds.length > 5) { message.warning('AI analysis supports max 5 ASINs at a time for quality results.'); return; }

    setAiAnalysisLoading(true);
    setShowAiAnalysisModal(true);
    setAiAnalysisResult(null);

    try {
      const results = [];
      for (const asinId of selectedAsinIds) {
        const res = await db.analyzeListing(asinId, false);
        if (res?.success && res.data) {
          results.push({ asinId, ...res.data });
        }
      }
      setAiAnalysisResult(results);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiAnalysisResult([{ error: err.message || 'Analysis failed' }]);
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const handleAiCreateTasks = async (asinId) => {
    try {
      setSyncing(true);
      const res = await db.analyzeListing(asinId, true);
      if (res?.success && res.data?.createdTasks) {
        message.success(`✅ Created ${res.data.tasksCount} optimization tasks`);
        setShowAiAnalysisModal(false);
        clearSelection();
      }
    } catch (err) {
      message.error('Failed to create tasks: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkSyncSelected = async () => {
    const selectedAsinIds = Array.from(selectedIds);
    if (selectedAsinIds.length === 0) return;

    const confirmed = await new Promise(resolve => {
      Modal.confirm({ title: 'Confirm', content: `Force-sync and refresh data for the ${selectedAsinIds.length} selected ASINs?`, onOk: () => resolve(true), onCancel: () => resolve(false) });
    });
    if (!confirmed) return;

    try {
      setSyncing(true);
      // For each selected, trigger individual sync (or if there's a bulk sync by ID, use that)
      // Since there is no bulk-sync-by-id api, we'll loop or just call syncAll if many?
      // Better: Use a Promise.all or similar for selection

      setScrapingIds(prev => new Set([...prev, ...selectedAsinIds]));

      const syncPromises = selectedAsinIds.map(id => marketSyncApi.syncAsin(id));
      await Promise.allSettled(syncPromises);

      await loadData(pagination.page);
      message.success(`✅ Sync initiated for ${selectedAsinIds.length} selected items.`);
      clearSelection();
    } catch (err) {
      console.error('Selected sync failed:', err);
      message.error('❌ Failed to start sync for some items: ' + err.message);
    } finally {
      setSyncing(false);
      setScrapingIds(new Set());
    }
  };

  const renderRatingBreakdown = (breakdown) => {
    if (!breakdown || (!breakdown.fiveStar && !breakdown.fourStar && !breakdown.threeStar && !breakdown.twoStar && !breakdown.oneStar)) {
      return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    }

    // Mini horizontal bar chart showing star distribution
    const stars = [
      { key: 'fiveStar', label: '5', color: 'var(--text-success)' },
      { key: 'fourStar', label: '4', color: '#84cc16' },
      { key: 'threeStar', label: '3', color: '#eab308' },
      { key: 'twoStar', label: '2', color: 'var(--text-warning)' },
      { key: 'oneStar', label: '1', color: 'var(--text-danger)' }
    ];

    return (
      <div className="d-flex flex-column gap-1" style={{ width: '100px' }}>
        {stars.map(star => {
          const pct = breakdown[star.key] || 0;
          return (
            <div key={star.key} className="d-flex align-items-center gap-1">
              <span className="text-muted" style={{ fontSize: '0.6rem', width: '12px', textAlign: 'right' }}>{star.label}</span>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="#fbbf24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <div style={{ flex: 1, height: '5px', backgroundColor: 'var(--bg-active)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: star.color, borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', width: '22px', textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Collapsible Section Component - Zinc Redesign
  const CollapsibleSection = ({ title, icon: Icon, isOpen, onToggle, children, badge }) => (
    <div className="bg-white border border-zinc-200 rounded-4 shadow-sm mb-4 overflow-hidden">
      <div
        onClick={onToggle}
        className={`px-4 py-3 d-flex align-items-center justify-content-between cursor-pointer ${styles.transitionAll}`}
        style={{ background: isOpen ? '#fff' : '#fcfcfc', borderBottom: isOpen ? '1px solid var(--bg-secondary)' : 'none' }}
      >
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center justify-content-center rounded-2" style={{
            width: '28px', height: '28px',
            background: 'var(--bg-secondary)', color: 'var(--text-muted)'
          }}>
            <Icon size={14} />
          </div>
          <span className="smallest fw-bold text-zinc-900 text-uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span className="badge rounded-pill bg-zinc-900 text-white smallest px-2">
              {badge}
            </span>
          )}
        </div>
        <div className="text-zinc-400">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {isOpen && <div className="p-4" style={{ background: '#fff' }}>{children}</div>}
    </div>
  );

  if (!initialLoadComplete && loading && asins.length === 0) {
    return <Spinner />;
  }

  if (error && !loading && asins.length === 0) {
    return <LoadError message={error} onRetry={retry} />;
  }

  const thStyle = {
    fontSize: 'var(--bc-text-2xs)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--bc-text-secondary)',
    padding: 'var(--asin-head-pad-y) var(--asin-head-pad-x)',
    background: 'var(--bc-surface-muted)',
    position: 'sticky',
    top: 0,
    borderBottom: '1px solid var(--bc-border-subtle)',
    whiteSpace: 'nowrap',
    borderRight: '1px solid var(--bc-border-subtle)',
    zIndex: 10
  };

  const tdStyle = {
    padding: 'var(--asin-row-pad-y) var(--asin-row-pad-x)',
    fontSize: 'var(--bc-text-sm)',
    borderBottom: '1px solid var(--bc-border-subtle)',
    verticalAlign: 'middle',
    color: 'var(--bc-text-body)',
    borderRight: '1px solid transparent',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums'
  };

  return (
    <div className={styles.pageContainer}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* [Filter Sidebar/Drawer Overlay] — PREMIUM FULL-HEIGHT DRAWER */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <div style={{ background: 'var(--bg-active)', padding: 7, borderRadius: "var(--radius-md)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={16} style={{ color: '#3f3f46' }} />
            </div>
            <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Filters</span>
          </div>
        }
        placement="right"
        onClose={() => setFilterPanelOpen(false)}
        open={filterPanelOpen}
        width={400}
        styles={{
          header: { borderBottom: '1px solid var(--bg-active)', padding: '12px 20px' },
          body: { padding: 0, display: 'flex', flexDirection: 'column', background: '#fff' }
        }}
        extra={
          <Button type="link" size="small" onClick={resetAllFilters} style={{ fontSize: 12, color: 'var(--text-danger)', fontWeight: 600, padding: 0 }}>
            Reset All
          </Button>
        }
      >
        {/* Content - Scrollable */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

          {/* SEARCH & BASIC */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Identity & Search</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>SKU</div>
                <Input size="small" placeholder="Enter SKU..." value={filters.sku} onChange={(e) => setFilters({ ...filters, sku: e.target.value })} allowClear style={{ borderRadius: "var(--radius-md)" }} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Parent ASIN</div>
                <Input size="small" placeholder="Enter Parent ASIN..." value={filters.parentAsin} onChange={(e) => setFilters({ ...filters, parentAsin: e.target.value })} allowClear style={{ borderRadius: "var(--radius-md)" }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* ATTRIBUTES */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Product Attributes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Scrape Status</div>
                <Select size="small" placeholder="All Statuses" value={filters.scrapeStatus || undefined} onChange={(v) => setFilters({ ...filters, scrapeStatus: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={(filterOptions.scrapeStatuses || []).map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Brand</div>
                <Select size="small" placeholder="All Brands" value={filters.brand || undefined} onChange={(v) => setFilters({ ...filters, brand: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={filterOptions.brands.map(b => ({ value: b, label: b }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Category</div>
                <Select size="small" placeholder="All Categories" value={filters.category || undefined} onChange={(v) => setFilters({ ...filters, category: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={filterOptions.categories.map(c => ({ value: c, label: c }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Sub BSR Category</div>
                <Select size="small" placeholder="All Sub BSR Categories" value={filters.subBsrCategory || undefined} onChange={(v) => setFilters({ ...filters, subBsrCategory: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={(filterOptions.subBsrCategories || []).map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Manufacturer</div>
                <Input size="small" placeholder="Search manufacturer..." value={filters.manufacturer} onChange={(e) => setFilters({ ...filters, manufacturer: e.target.value })} allowClear style={{ borderRadius: "var(--radius-md)" }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* QUICK FLAGS */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Quick Flags</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BuyBox</div>
                <Select size="small" placeholder="All" value={filters.buyBoxWin || undefined} onChange={(v) => setFilters({ ...filters, buyBoxWin: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Won (Own)' }, { value: 'false', label: 'Lost (Other)' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>A+ Content</div>
                <Select size="small" placeholder="All" value={filters.hasAplus || undefined} onChange={(v) => setFilters({ ...filters, hasAplus: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Video</div>
                <Select size="small" placeholder="All" value={filters.hasVideo || undefined} onChange={(v) => setFilters({ ...filters, hasVideo: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Active Deal</div>
                <Select size="small" placeholder="All" value={filters.hasDeal || undefined} onChange={(v) => setFilters({ ...filters, hasDeal: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Ads Active</div>
                <Select size="small" placeholder="All" value={filters.ads || undefined} onChange={(v) => setFilters({ ...filters, ads: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Availability</div>
                <Select size="small" placeholder="All" value={filters.availabilityStatus || undefined} onChange={(v) => setFilters({ ...filters, availabilityStatus: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'In Stock', label: 'In Stock' }, { value: 'Out of Stock', label: 'Out of Stock' }, { value: 'Available', label: 'Available' }, { value: 'Currently unavailable.', label: 'Unavailable' }, { value: 'ADD TO BAG', label: 'Add to Bag' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Deal Type</div>
                <Select size="small" placeholder="All" value={filters.dealAccessType || undefined} onChange={(v) => setFilters({ ...filters, dealAccessType: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'ALL', label: 'ALL' }, { value: 'PRIME', label: 'PRIME' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Price Dispute</div>
                <Select size="small" placeholder="All ASINs" value={filters.priceDispute || undefined} onChange={(v) => setFilters({ ...filters, priceDispute: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Disputed Only' }, { value: 'false', label: 'Non-Disputed' }]} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* TRENDS & HISTORY */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Performance Trends</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BSR Trend</div>
                <Select size="small" placeholder="All Trends" value={filters.bsrTrend || undefined} onChange={(v) => setFilters({ ...filters, bsrTrend: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'Grow', label: 'Growing' }, { value: 'Down', label: 'Down' }, { value: 'Stable', label: 'Stable' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Rating Trend</div>
                <Select size="small" placeholder="All Trends" value={filters.ratingTrend || undefined} onChange={(v) => setFilters({ ...filters, ratingTrend: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'Grow', label: 'Growing' }, { value: 'Down', label: 'Down' }, { value: 'Stable', label: 'Stable' }]} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>History Data Range</div>
              <Select size="small" placeholder="Default: 14 Days" value={filters.historyDays || undefined} onChange={(v) => setFilters({ ...filters, historyDays: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: '1', label: 'Today Only' }, { value: '7', label: 'Last 7 Days' }, { value: '14', label: 'Last 14 Days' }, { value: '30', label: 'Last 30 Days' }, { value: '90', label: 'Last 90 Days' }]} />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* RANGES */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Metrics & Ranges</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Price Range (₹)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" placeholder="Min" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                  <Input size="small" type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BSR Range</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" placeholder="Min" value={filters.minBSR} onChange={(e) => setFilters({ ...filters, minBSR: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                  <Input size="small" type="number" placeholder="Max" value={filters.maxBSR} onChange={(e) => setFilters({ ...filters, maxBSR: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Rating Range</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" step="0.1" placeholder="Min" value={filters.minRating} onChange={(e) => setFilters({ ...filters, minRating: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                  <Input size="small" type="number" step="0.1" placeholder="Max" value={filters.maxRating} onChange={(e) => setFilters({ ...filters, maxRating: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* TAGS */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Tags</div>
            <Input.Search size="small" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} style={{ borderRadius: "var(--radius-md)", marginBottom: 10 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filterOptions.tags
                .filter(t => typeof t === 'string' && t.toLowerCase().includes(tagSearch.toLowerCase()))
                .map(tag => {
                  const active = filters.selectedTags.includes(tag);
                  return (
                    <Tag
                      key={tag}
                      style={{ cursor: 'pointer', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 10px', margin: 0, border: active ? '1px solid var(--text-primary)' : '1px solid var(--border-light)', background: active ? 'var(--text-primary)' : 'var(--bg-active)', color: active ? '#fff' : '#52525b' }}
                      onClick={() => {
                        const newTags = active ? filters.selectedTags.filter(t => t !== tag) : [...filters.selectedTags, tag];
                        setFilters({ ...filters, selectedTags: newTags });
                      }}
                    >
                      {tag}
                    </Tag>
                  );
                })}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* AGE FILTER */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Listing Age</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[
                { label: 'New (<30D)', value: '30' },
                { label: '30-60D', value: '60' },
                { label: '60-90D', value: '90' },
                { label: '90-180D', value: '180' },
                { label: '180-365D', value: '365' },
                { label: '365+ Days', value: '365+' }
              ].map(opt => (
                <Tag
                  key={opt.value}
                  style={{ cursor: 'pointer', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 10px', margin: 0, border: filters.ageFilter === opt.value ? '1px solid var(--text-primary)' : '1px solid var(--border-light)', background: filters.ageFilter === opt.value ? 'var(--text-primary)' : 'var(--bg-active)', color: filters.ageFilter === opt.value ? '#fff' : '#52525b' }}
                  onClick={() => setFilters({ ...filters, ageFilter: filters.ageFilter === opt.value ? '' : opt.value })}
                >
                  {opt.label}
                </Tag>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Release Date Range</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input size="small" type="date" value={filters.minReleaseDate} onChange={(e) => setFilters({ ...filters, minReleaseDate: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                <Input size="small" type="date" value={filters.maxReleaseDate} onChange={(e) => setFilters({ ...filters, maxReleaseDate: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bg-active)', background: '#fafafa', display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button size="small" block onClick={resetAllFilters} style={{ borderRadius: "var(--radius-md)", fontWeight: 600, height: 32 }}>Reset</Button>
          <Button size="small" type="primary" block onClick={handleApplyFilters} style={{ borderRadius: "var(--radius-md)", fontWeight: 600, height: 32, background: 'var(--text-primary)', borderColor: 'var(--text-primary)' }}>Apply Filters</Button>
        </div>
      </Drawer>

      {/* Relocated header actions to Table Toolbar for dense view UI */}

      {/* ANALYTICS MODULE AREA - RECTANGULAR PILLS STYLE */}
      <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: showDashboard ? '52px' : '0px', transition: 'all 0.3s ease', opacity: showDashboard ? 1 : 0, pointerEvents: showDashboard ? 'auto' : 'none' }}>
        <div className={`px-3 py-1 d-flex align-items-center gap-2 overflow-x-auto ${styles.customScrollbar}`} style={{ width: '100%' }}>
          {kpis.map((kpi, idx) => (
            <Tooltip key={idx} title={kpi.sub || null} placement="bottom" mouseEnterDelay={0.3}>
              <div
                className={`bg-white border shadow-sm d-flex align-items-center gap-2 px-3 ${styles.hoverUpMild}`}
                style={{
                  height: '32px',
                  minWidth: 'max-content',
                  flexShrink: 0,
                  cursor: kpi.onClick ? 'pointer' : 'default',
                  borderRadius: '6px',
                  borderColor: 'var(--border-light)'
                }}
                onClick={kpi.onClick}
              >
                {/* Status Dot */}
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: kpi.color,
                    flexShrink: 0
                  }}
                />

                {/* Label */}
                <span className="text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.03em', color: kpi.color, whiteSpace: 'nowrap' }}>
                  {kpi.label}
                </span>

                {/* Value */}
                <span className="fw-bolder ms-1" style={{ fontSize: 'var(--font-size-xs)', color: '#09090b' }}>
                  {kpi.value}
                </span>

                {/* Inline sub hint */}
                {kpi.sub && (
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '2px' }}>
                    ({kpi.sub})
                  </span>
                )}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Repair Progress simplified */}
      {repairStatus && (
        <div className="mt-2 py-1 px-3 bg-amber-50 border border-amber-100 rounded-2 d-flex align-items-center gap-3">
          <span className="icon-[svg-spinners--eclipse] text-amber-500" style={{ fontSize: 12 }} aria-hidden="true" />
          <span className="smallest text-amber-900 fw-bold text-uppercase tracking-wider" style={{ fontSize: '9px' }}>Data Repair</span>
          <div className="flex-grow-1" style={{ height: '4px', background: '#fef3c7', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--text-warning)', width: `${repairStatus.percentage}%`, transition: 'width 0.4s ease' }} />
          </div>
          <span className="smallest text-amber-600 fw-bold" style={{ fontSize: '9px' }}>{repairStatus.processed}/{repairStatus.total}</span>
        </div>
      )}

      <div className="page-content flex-grow-1 d-flex flex-column overflow-hidden px-3 pb-3" style={{ minHeight: 0 }}>
        {/* Alerts & Errors row */}
        {error && (
          <div className="alert alert-danger border-0 shadow-sm rounded-3 py-2 px-3 mb-3 d-flex align-items-center gap-2" role="alert">
            <AlertTriangle size={14} className="text-danger" />
            <span className="fw-medium small text-danger-emphasis">{error}</span>
          </div>
        )}

        {/* ELEVATED MODULE CONTAINER */}
        <div className="bg-white shadow-sm rounded-4 overflow-hidden flex-grow-1 d-flex flex-column border border-light-subtle position-relative">

          {/* Table Toolbar */}
          <div className={`${styles.toolbar} border-bottom bg-white`}>
            <div className={`${styles.toolbarLeft} d-flex align-items-center gap-2 flex-grow-1`} style={{ flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }} className="text-uppercase d-flex align-items-center gap-1">
                Inventory
                <span className="bg-light border text-secondary px-1.5 rounded-pill fw-semibold" style={{ fontSize: '10px', lineHeight: '18px' }}>
                  {pagination.total.toLocaleString()}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost p-0 ms-1 rounded-circle text-secondary d-flex align-items-center justify-content-center"
                  onClick={() => setShowDashboard(!showDashboard)}
                  style={{ width: '20px', height: '20px', border: 'none', background: 'transparent' }}
                  title={showDashboard ? 'Collapse Overview' : 'Expand Overview'}
                >
                  {showDashboard ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </span>

              {/* MARKETPLACE SWITCHER */}
              <Segmented
                size="small"
                value={marketplaceFilter === 'amazon.in' || (marketplaceFilter === 'all' && !canAccessAjio && !canAccessMyntra) ? 'amazon.in' : marketplaceFilter}
                onChange={(val) => {
                  setMarketplaceFilter(val);
                  loadData(1, pagination.limit, selectedSeller, val);
                }}
                options={[
                  {
                    value: 'amazon.in',
                    label: (
                      <span className="d-flex align-items-center justify-content-center" style={{ height: '20px', padding: '0 4px' }}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" style={{ height: '10px', width: 'auto', objectFit: 'contain', filter: marketplaceFilter === 'amazon.in' ? 'none' : 'grayscale(100%)' }} alt="Amazon" />
                      </span>
                    )
                  },
                  {
                    value: 'ajio',
                    label: (
                      <span className="d-flex align-items-center justify-content-center" style={{ height: '20px', padding: '0 4px' }}>
                        <img src="https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1776791426160" style={{ height: '9px', width: 'auto', objectFit: 'contain', filter: marketplaceFilter === 'ajio' ? 'none' : 'grayscale(100%)' }} alt="Ajio" />
                      </span>
                    )
                  },
                  ...(canAccessMyntra ? [{
                    value: 'myntra',
                    label: (
                      <span className="d-flex align-items-center justify-content-center" style={{ height: '20px', padding: '0 4px' }}>
                        <img src="https://cdn.brandfetch.io/idDW82Qwj2/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1772274333492" style={{ height: '10px', width: 'auto', objectFit: 'contain', filter: marketplaceFilter === 'myntra' ? 'none' : 'grayscale(100%)' }} alt="Myntra" />
                      </span>
                    )
                  }] : [])
                ]}
                style={{ background: 'var(--bg-active)', padding: '2px', borderRadius: '6px', flexShrink: 0 }}
              />

              <Input.Search
                placeholder="Search ASIN, SKU, Title..."
                size="small"
                enterButton="Find"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleApplySearch}
                className={`antd-dense-search ${styles.searchInput}`}
              />
              <div className={styles.sellerSelectWrapper}>
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSeller}
                  onSelect={(val) => {
                    setSelectedSeller(val);
                    loadData(1, pagination.limit, val);
                  }}
                  placeholder="All Sellers"
                />
              </div>

              {/* ACTIONS DROPDOWN */}
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'filters-grp',
                      type: 'group',
                      label: 'QUICK FILTERS',
                      children: [
                        {
                          key: 'price-dispute',
                          label: appliedFilters.priceDispute === 'true' ? 'Show All Products' : 'Show Dispute Only',
                          icon: <AlertTriangle size={14} className={appliedFilters.priceDispute === 'true' ? "text-amber-600" : "text-amber-400"} />,
                          onClick: () => {
                            const newFilters = { ...appliedFilters, priceDispute: appliedFilters.priceDispute === 'true' ? '' : 'true' };
                            setAppliedFilters(newFilters);
                            setFilters(newFilters);
                            setFilterTrigger(t => t + 1);
                          }
                        },
                        {
                          key: 'bsr-trend',
                          label: appliedFilters.bsrTrend === 'Down' ? 'Clear BSR Filter' : 'Show Falling BSR',
                          icon: <TrendingDown size={14} className={appliedFilters.bsrTrend === 'Down' ? "text-rose-600" : "text-rose-400"} />,
                          onClick: () => {
                            const newFilters = { ...appliedFilters, bsrTrend: appliedFilters.bsrTrend === 'Down' ? '' : 'Down' };
                            setAppliedFilters(newFilters);
                            setFilters(newFilters);
                            setFilterTrigger(t => t + 1);
                          }
                        },
                        {
                          key: 'rating-trend',
                          label: appliedFilters.ratingTrend === 'Down' ? 'Clear Rating Filter' : 'Show Falling Ratings',
                          icon: <Star size={14} className={appliedFilters.ratingTrend === 'Down' ? "text-amber-600" : "text-amber-400"} />,
                          onClick: () => {
                            const newFilters = { ...appliedFilters, ratingTrend: appliedFilters.ratingTrend === 'Down' ? '' : 'Down' };
                            setAppliedFilters(newFilters);
                            setFilters(newFilters);
                            setFilterTrigger(t => t + 1);
                          }
                        }
                      ]
                    },
                    { type: 'divider' },
                    {
                      key: 'views-grp',
                      type: 'group',
                      label: 'QUICK VIEWS',
                      children: [
                        {
                          key: 'bsr-matrix',
                          label: 'BSR Ranking Matrix',
                          icon: <BarChart2 size={14} />,
                          onClick: () => setShowAllBsrHistory(true)
                        },
                        {
                          key: 'rating-analytics',
                          label: 'Rating Analytics',
                          icon: <LayoutGrid size={14} />,
                          onClick: () => setShowAllRatingHistory(true)
                        }
                      ]
                    },
                    { type: 'divider' },
                    {
                      key: 'bulk-grp',
                      type: 'group',
                      label: (
                        <div className="d-flex justify-content-between align-items-center w-100">
                          <span>BULK ACTIONS</span>
                          {selectedIds.size === 0 && <Tag style={{ fontSize: '9px', borderRadius: 'var(--radius-sm)' }}>SELECT ROWS</Tag>}
                        </div>
                      ),
                      children: [
                        {
                          key: 'mark-dispute',
                          label: 'Mark as Price Dispute',
                          icon: <AlertTriangle size={14} className="text-amber-500" />,
                          disabled: selectedIds.size === 0,
                          onClick: () => handleBulkPriceDispute(true)
                        },
                        {
                          key: 'resolve-dispute',
                          label: 'Resolve Dispute',
                          icon: <RefreshCw size={14} className="text-emerald-500" />,
                          disabled: selectedIds.size === 0,
                          onClick: () => handleBulkPriceDispute(false)
                        },
                        {
                          key: 'run-rulesets',
                          label: 'Run Rulesets on Selected',
                          icon: <PlayCircle size={14} />,
                          disabled: selectedIds.size === 0,
                          onClick: handleRunRulesets
                        },
                        {
                          key: 'create-task',
                          label: 'Create Task for Selected',
                          icon: <PlusCircle size={14} className="text-emerald-500" />,
                          disabled: selectedIds.size === 0,
                          onClick: handleOpenTaskModal
                        }
                      ]
                    }
                  ]
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  icon={<MoreVertical size={14} />}
                  style={{
                    height: '32px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)'
                  }}
                  className="d-flex align-items-center gap-1 shadow-sm"
                >
                  Actions
                </Button>
              </Dropdown>

              {/* Scrape Progress */}
              {scrapeProgress && (
                <div className="bg-light border rounded-2 px-2 d-flex align-items-center gap-2" style={{ height: '32px', borderColor: 'var(--border-light)' }}>
                  <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 12, color: 'var(--text-danger)' }} aria-hidden="true" />
                  <span className="fw-bold font-monospace small" style={{ color: 'var(--text-primary)' }}>{scrapeProgress.processed}/{scrapeProgress.total}</span>
                </div>
              )}

              {/* Spacer */}
              <div style={{ flex: '1 1 0', minWidth: 0 }} />

              <div className="d-flex align-items-center gap-2" style={{ flexShrink: 0 }}>
                <Segmented
                  size="small"
                  value={viewMode}
                  onChange={(val) => setViewMode(val)}
                  options={[
                    { label: 'ASINs', value: 'asin' },
                    { label: 'Parents', value: 'parent' }
                  ]}
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
                <Button
                  icon={syncing ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 14 }} aria-hidden="true" /> : <RefreshCw size={14} />}
                  onClick={handleBulkScrape}
                  disabled={syncing}
                  style={{
                    height: '32px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)'
                  }}
                  className="d-flex align-items-center gap-2 shadow-sm"
                >
                  Sync
                </Button>

                {hasPermission('asinmanager_manage') && (
                  <Tooltip title="Auto-tag: Pareto 80/20, Top 20 By GMS, Price Dispute, Age tags">
                    <Button
                      icon={<Sparkles size={14} />}
                      onClick={async () => {
                        try {
                          message.loading({ content: 'Running auto-tags...', key: 'auto-tags' });
                          const res = await asinApi.runAutoTags();
                          if (res.success) {
                            const d = res.data || {};
                            const pareto = d.pareto || {};
                            const top20 = d.top20ByGms || {};
                            const pd = d.priceDispute || {};
                            const age = d.ageTags || {};
                            message.success({
                              content: `Auto-tags done. Pareto: ${pareto.updated || 0} | Top20: ${top20.updated || 0} | PriceDispute: ${pd.updated || 0} | Age: ${age.updated || 0}`,
                              key: 'auto-tags',
                              duration: 5
                            });
                            loadData(pagination.page);
                          }
                        } catch (err) {
                          message.error({ content: 'Auto-tags failed: ' + err.message, key: 'auto-tags', duration: 4 });
                        }
                      }}
                      style={{ height: '32px', fontSize: 'var(--font-size-xs)', fontWeight: 600, borderRadius: 'var(--radius-md)' }}
                      className="d-flex align-items-center gap-2 shadow-sm"
                    >
                      Auto Tags
                    </Button>
                  </Tooltip>
                )}

                <Button
                  onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                  type={filterPanelOpen ? 'primary' : 'default'}
                  icon={<ListChecks size={14} />}
                  style={{
                    height: '32px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)'
                  }}
                  className="d-flex align-items-center gap-2 shadow-sm"
                >
                  {(() => {
                    const count = Object.values(appliedFilters).filter(v =>
                      v !== '' && (!Array.isArray(v) || v.length > 0)
                    ).length;
                    return `Filters ${count > 0 ? `(${count})` : ''}`;
                  })()}
                </Button>

                <div className="position-relative">
                  <Button
                    onClick={() => setShowColumnPanel(!showColumnPanel)}
                    type={showColumnPanel ? 'primary' : 'default'}
                    icon={<LayoutGrid size={14} />}
                    style={{
                      height: '32px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)'
                    }}
                    className="d-flex align-items-center gap-2 shadow-sm"
                  >
                    Columns
                  </Button>

                  <ColumnVisibilityPanel
                    isOpen={showColumnPanel}
                    onClose={() => setShowColumnPanel(false)}
                    visibleColumns={visibleColumns}
                    onApply={updateVisibleColumns}
                    allColumns={allColumns}
                    columnCategories={columnCategories}
                  />
                </div>

                <Tooltip title={`Row density: ${rowDensity}`} placement="top">
                  <Button
                    onClick={cycleRowDensity}
                    type="default"
                    icon={<Rows3 size={14} />}
                    style={{
                      height: '32px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)'
                    }}
                    className="d-flex align-items-center gap-2 shadow-sm"
                  >
                    {DENSITY_LABELS[rowDensity]}
                  </Button>
                </Tooltip>

                <div className="vr mx-1 text-secondary opacity-25" style={{ height: '20px' }} />

                {hasPermission('asinmanager_manage') && (
                  <Tooltip title="Bulk Optimization">
                    <Button
                      onClick={handleBulkCreateActions}
                      disabled={asins.length === 0 || syncing}
                      icon={<Zap size={14} style={{ color: 'var(--text-danger)' }} />}
                      style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}

                {hasPermission('asinmanager_export') && (
                  <Tooltip title="Export">
                    <Button
                      onClick={() => setShowExportModal(true)}
                      icon={<Download size={14} style={{ color: 'var(--text-primary)' }} />}
                      style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}

                {viewMode === 'parent' && expandedCount > 0 && (
                  <Tooltip title="Collapse all parents">
                    <Button
                      onClick={collapseAll}
                      aria-label="Collapse all parent ASINs"
                      icon={<ChevronsUp size={14} className="text-zinc-500" />}
                      style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}

                {hasPermission('asinmanager_manage') && (
                  <Tooltip title="Recalculate LQS">
                    <Button
                      onClick={handleRecalculateLQS}
                      disabled={loading}
                      aria-label="Recalculate LQS"
                      icon={<RefreshCw size={14} className={loading ? 'text-zinc-400' : 'text-sky-600'} />}
                      style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}

                {hasPermission('asinmanager_import') && (
                  <Tooltip title="Import">
                    <Button
                      onClick={() => setShowBulkImportModal(true)}
                      icon={<FileUp size={14} className="text-emerald-600" />}
                      style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)' }}
                      className="d-flex align-items-center justify-content-center shadow-sm"
                    />
                  </Tooltip>
                )}
                {hasPermission('asinmanager_manage') && (
                  <Tooltip title="Add ASIN">
                    <Button
                      onClick={() => setShowAddModal(true)}
                      icon={<Plus size={14} className="text-indigo-600" />}
                      style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)' }}
                      className="d-flex align-items-center justify-content-center shadow-sm ms-1"
                    />
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* SELECTION BAR - HIGHLIGHT MODE */}
          {selectedIds.size > 0 && (
            <div className="bg-indigo-50 px-3 py-2 border-bottom d-flex align-items-center gap-3 animate-in slide-in-from-top-2 duration-200" style={{ flexShrink: 0 }}>
              <div className="d-flex align-items-center gap-2">
                <div className="bg-indigo-600 text-white fw-bold rounded-circle d-flex align-items-center justify-content-center" style={{ width: '20px', height: '20px', fontSize: '10px' }}>
                  {selectedIds.size}
                </div>
                <span className="small fw-bold text-indigo-900">items selected</span>
              </div>
              <div className="vr bg-indigo-200 opacity-50" style={{ height: '16px' }}></div>
              <div className="d-flex align-items-center gap-2">
                <button
                  className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={() => setShowBulkTagsModal(true)}
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  <TagIcon size={12} /> Tag
                </button>
                <button
                  className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={handleBulkSyncSelected}
                  disabled={syncing}
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  {syncing ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 12 }} aria-hidden="true" /> : <RefreshCw size={12} />} Sync
                </button>
                <button
                  className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={handleSelectedCreateActions}
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  <Zap size={12} className="fill-indigo-700" /> Tasks
                </button>
                <button
                  className="btn btn-sm btn-white border shadow-sm fw-bold rounded-2 d-flex align-items-center gap-1.5"
                  onClick={handleAiListingAnalysis}
                  disabled={aiAnalysisLoading}
                  style={{ fontSize: 'var(--font-size-xs)', borderColor: '#c4b5fd', color: '#6d28d9', backgroundColor: '#f5f3ff' }}
                >
                  <Sparkles size={12} /> {aiAnalysisLoading ? 'Analyzing...' : 'AI Analyze'}
                </button>
              </div>
              <button
                className="btn btn-link text-indigo-600 fw-bold text-decoration-none ms-auto p-0"
                style={{ fontSize: 'var(--font-size-xs)' }}
                onClick={clearSelection}
              >
                Deselect All
              </button>
            </div>
          )}

          {/* APPLIED FILTERS BADGES */}
          {(Object.values(appliedFilters).some(v => v !== '' && (!Array.isArray(v) || v.length > 0)) || appliedSearchQuery || selectedSeller) && (
            <div className="border-bottom d-flex align-items-center flex-wrap gap-3" style={{ flexShrink: 0, padding: '8px 24px', backgroundColor: 'var(--bg-secondary)' }}>
              <span className="text-secondary fw-bold text-uppercase tracking-wider" style={{ fontSize: '9px' }}>
                Active Filters
              </span>
              <AppliedFilterBadges
                appliedFilters={appliedFilters}
                appliedSearchQuery={appliedSearchQuery}
                selectedSeller={selectedSeller}
                sellerName={sellers.find(s => s._id === selectedSeller)?.name}
                onClearFilter={key => removeAppliedFilter(key)}
                onClearTag={tag => removeAppliedFilter('selectedTags', tag)}
                onClearSearch={() => { setAppliedSearchQuery(''); setSearchQuery(''); }}
                onClearSeller={() => setSelectedSeller('')}
              />
              <button
                className="btn btn-link text-danger text-decoration-none ms-auto fw-bold p-0"
                style={{ fontSize: 'var(--font-size-xs)' }}
                onClick={resetAllFilters}
              >
                Clear All
              </button>
            </div>
          )}


          {/* Scrollable Table Container */}
          <div className={`asin-grid-scroll asin-grid-scroll--${rowDensity}`}>
            <table className="asin-grid" style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr>
                  {isVisible('checkbox') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '40px', left: 0, zIndex: 22, background: 'var(--bg-secondary)', textAlign: 'center', borderBottom: '2px solid var(--border-light)' }}>
                      <input
                        type="checkbox"
                        checked={selectableRows.length > 0 && selectableRows.every(a => selectedIds.has(a._id))}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all ASINs on this page"
                        style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                      />
                    </th>
                  )}
                  {isVisible('asinCode') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '110px', left: isVisible('checkbox') ? '40px' : '0px', zIndex: 21, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-light)', borderBottom: '2px solid var(--border-light)' }}>
                      {renderSortableHeader(marketplaceFilter === 'ajio' ? 'JIOCODE' : 'ASIN ID', 'asinCode')}
                    </th>
                  )}
                  {isVisible('releaseDate') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'center', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-light)' }}>
                      {renderSortableHeader('RELEASED', 'releaseDate', 'center')}
                    </th>
                  )}
                  {isVisible('parentAsin') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '110px', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-light)' }}>
                      {renderSortableHeader('PARENT ASIN', 'parentAsin')}
                    </th>
                  )}
                  {isVisible('sellerBrand') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '115px', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-light)' }}>
                      {renderSortableHeader('SELLER / BRAND', 'sellerBrand')}
                    </th>
                  )}
                  {isVisible('sku') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '95px', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-light)' }}>
                      {renderSortableHeader('SKU', 'sku')}
                    </th>
                  )}
                  {isVisible('title') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '220px', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-light)' }}>
                      {renderSortableHeader('PRODUCT TITLE', 'title')}
                    </th>
                  )}
                  {isVisible('category') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '135px', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-light)' }}>
                      {renderSortableHeader('CATEGORY', 'category')}
                    </th>
                  )}
                  {isVisible('tags') && <th rowSpan={2} style={{ ...thStyle, width: '100px', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-light)' }}>TAGS</th>}

                  {/* ===== DEAL & MANUFACTURER COLUMNS (Slate Palette) ===== */}
                  {isVisible('manufacturer') && <th rowSpan={2} style={{ ...thStyle, width: '120px', textAlign: 'left', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>MANUFACTURER</th>}
                  {isVisible('availabilityStatus') && <th rowSpan={2} style={{ ...thStyle, width: '100px', textAlign: 'center', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>AVAILABILITY</th>}

                  {isVisible('ads') && <th rowSpan={2} style={{ ...thStyle, width: '60px', textAlign: 'center', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>ADS</th>}
                  {isVisible('ads') && <th rowSpan={2} style={{ ...thStyle, width: '50px', textAlign: 'center' }}>GMS</th>}
                  {visibleOrdersCount > 0 && (
                    <th
                      rowSpan={ordersExpanded ? 1 : 2}
                      colSpan={ordersExpanded ? (availableMonths.length + 1) : 1}
                      style={{ ...thStyle, background: 'var(--bg-secondary)', textAlign: 'center', borderBottom: '2px solid var(--border-medium)', transition: 'all 0.3s ease' }}
                    >
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 600 }}>
                        {ordersExpanded ? (
                          <span>ORDERS</span>
                        ) : (
                          renderSortableHeader('ORDERS', 'totalOrders', 'center')
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setOrdersExpanded(!ordersExpanded); }}
                          className="asin-grid__group-toggle btn btn-sm p-0 d-inline-flex align-items-center justify-content-center ms-1"

                          title={ordersExpanded ? "Collapse to Total" : "Expand to Monthly Orders"}
                        >
                          {ordersExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}
                  {isVisible('dealBadge') && <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'center', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>DEAL</th>}
                  {isVisible('dealStartTime') && <th rowSpan={2} style={{ ...thStyle, width: '90px', textAlign: 'center', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>DEAL START</th>}
                  {isVisible('dealEndTime') && <th rowSpan={2} style={{ ...thStyle, width: '90px', textAlign: 'center', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>DEAL END</th>}
                  {isVisible('dealAccessType') && <th rowSpan={2} style={{ ...thStyle, width: '80px', textAlign: 'center', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>DEAL TYPE</th>}
                  {isVisible('currentBuybox') && <th rowSpan={2} style={{ ...thStyle, width: '140px', textAlign: 'left', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-medium)' }}>BUYBOX</th>}

                  {/* ===== PRICE COLUMNS (MRP, Price, Dispute, Price Trend) (Indigo Palette) ===== */}
                  {isVisible('mrp') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'right' }}>
                      {renderSortableHeader('MRP', 'mrp', 'right')}
                    </th>
                  )}
                  {isVisible('price') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'right' }}>
                      {renderSortableHeader(marketplaceFilter === 'ajio' ? 'PRICE' : 'CHANNEL PRICE', 'uploadedPrice', 'right')}
                    </th>
                  )}
                  {isVisible('discountPercentage') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'center' }}>
                      {renderSortableHeader('DISCOUNT %', 'discountPercentage', 'center')}
                    </th>
                  )}
                  {isVisible('priceDispute') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '85px', textAlign: 'center' }}>
                      {renderSortableHeader('DISPUTE', 'priceDispute', 'center')}
                    </th>
                  )}
                  {visiblePriceTrendCount > 0 && (
                    <th colSpan={visiblePriceTrendCount}
                      style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 600 }}>
                        <span>{priceTrendExpanded ? 'Price Trend' : 'Price'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPriceTrendExpanded(!priceTrendExpanded); }}
                          className="asin-grid__group-toggle btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"

                          title={priceTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {priceTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}

                  {isVisible('mainBsr') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '90px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('MAIN BSR', 'bsr', 'center')}
                    </th>
                  )}
                  {isVisible('subBsr') && <th rowSpan={2} style={{ ...thStyle, width: '110px', transition: 'all 0.3s ease' }}>SUB BSR</th>}
                  {isVisible('bsrTrendStatus') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', transition: 'all 0.3s ease' }}>BSR TR</th>}
                  {visibleBsrTrendCount > 0 && (
                    <th colSpan={visibleBsrTrendCount}
                      style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 600 }}>
                        <span>{bsrTrendExpanded ? 'SUB-BSR TREND' : 'Sub BSR'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setBsrTrendExpanded(!bsrTrendExpanded); }}
                          className="asin-grid__group-toggle btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"

                          title={bsrTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {bsrTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}

                  {/* ===== RATING COLUMNS (Amber Palette) ===== */}
                  {isVisible('rating') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '60px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('RT', 'rating', 'center')}
                    </th>
                  )}
                  {isVisible('reviewCount') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '65px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('CNT', 'reviewCount', 'center')}
                    </th>
                  )}
                  {isVisible('ratingBreakdown') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '120px', textAlign: 'center', transition: 'all 0.3s ease', fontSize: '10px', fontWeight: 600 }}>
                      DISTRIBUTION
                    </th>
                  )}
                  {isVisible('ratingTrendStatus') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', transition: 'all 0.3s ease' }}>RATING TR</th>}
                  {visibleRatingTrendCount > 0 && (
                    <th colSpan={visibleRatingTrendCount}
                      style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 600 }}>
                        <span>{ratingTrendExpanded ? 'RATING TREND' : 'RT'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRatingTrendExpanded(!ratingTrendExpanded); }}
                          className="asin-grid__group-toggle btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"

                          title={ratingTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {ratingTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}
                  {isVisible('reviewCount') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', transition: 'all 0.3s ease' }} title="Reviews Trend Status">REV TR</th>}
                  {visibleReviewTrendCount > 0 && (
                    <th colSpan={visibleReviewTrendCount}
                      style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 600 }}>
                        <span>{reviewTrendExpanded ? 'REVIEWS TREND' : 'REV'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReviewTrendExpanded(!reviewTrendExpanded); }}
                          className="asin-grid__group-toggle btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"

                          title={reviewTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {reviewTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}

                  {/* ===== VISUALS & CONTENT COLUMNS (Video, Images, Bullet Points, A+) (Pink Palette) ===== */}
                  {isVisible('video') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '65px', textAlign: 'center', transition: 'all 0.3s ease' }} title="Video Present">
                      {renderSortableHeader('Video', 'videoCount', 'center')}
                    </th>
                  )}
                  {isVisible('imagesCount') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '55px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                      {renderSortableHeader('IMG', 'imagesCount', 'center')}
                    </th>
                  )}
                  {visibleImageTrendCount > 0 && (
                    <th colSpan={visibleImageTrendCount}
                      style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
                      <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '10px', fontWeight: 600 }}>
                        <span>{imageTrendExpanded ? 'IMG TREND' : 'IMG'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setImageTrendExpanded(!imageTrendExpanded); }}
                          className="asin-grid__group-toggle btn btn-sm p-0 d-inline-flex align-items-center justify-content-center"

                          title={imageTrendExpanded ? "Collapse to Latest" : "Expand to 7 Days"}
                        >
                          {imageTrendExpanded ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </div>
                    </th>
                  )}
                  {isVisible('bulletPoints') && <th rowSpan={2} style={{ ...thStyle, width: '35px', textAlign: 'center' }}>B</th>}
                  {isVisible('hasAplus') && (
                    <th rowSpan={2} style={{ ...thStyle, width: '55px', textAlign: 'center' }}>
                      {renderSortableHeader('A+', 'hasAplus', 'center')}
                    </th>
                  )}
                  {isVisible('aplusDays') && <th rowSpan={2} style={{ ...thStyle, width: '50px', textAlign: 'center' }}>A+ DAYS</th>}
                  <th rowSpan={2} style={{
                    ...thStyle,
                    width: '60px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    position: 'sticky',
                    right: 0,
                    zIndex: 25,
                    borderLeft: '1px solid var(--border-light)',
                    borderBottom: '2px solid var(--border-light)'
                  }}>
                    ACTIONS
                  </th>
                </tr>

                <tr>
                  {/* Orders Expanded Monthly Columns */}
                  {ordersExpanded && isVisible('totalOrders') && availableMonths.map((month, idx) => (
                    <th key={`ord-m-${idx}`} style={{
                      ...thStyle,
                      ...getTransitionStyle(ordersExpanded, idx, availableMonths.length + 1, '70px'),
                      fontSize: 9,
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)'
                    }}>
                      <div style={{
                        width: ordersExpanded ? 'auto' : '0px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease'
                      }}>
                        {formatMonthHeader(month)}
                      </div>
                    </th>
                  ))}
                  {ordersExpanded && isVisible('totalOrders') && (
                    <th style={{
                      ...thStyle,
                      ...getTransitionStyle(ordersExpanded, availableMonths.length, availableMonths.length + 1, '70px'),
                      fontSize: 9,
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      fontWeight: 800,
                      color: 'var(--text-secondary)'
                    }}>
                      <div style={{
                        width: ordersExpanded ? 'auto' : '0px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease'
                      }}>
                        TOTAL
                      </div>
                    </th>
                  )}

                  {/* GMS Revenue Expandable Monthly Columns */}
                  {gmsRevenueExpanded && availableMonths.map((month, idx) => (
                    <th key={`gms-m-${idx}`} style={{
                      ...thStyle,
                      ...getTransitionStyle(gmsRevenueExpanded, idx, availableMonths.length + 1, '70px'),
                      fontSize: 9,
                      textAlign: 'center',
                      

                    }}>
                      <div style={{
                        width: gmsRevenueExpanded ? 'auto' : '0px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease'
                      }}>
                        ₹{month}
                      </div>
                    </th>
                  ))}
                  {gmsRevenueExpanded && (
                    <th style={{
                      ...thStyle,
                      ...getTransitionStyle(gmsRevenueExpanded, availableMonths.length, availableMonths.length + 1, '70px'),
                      fontSize: 9,
                      textAlign: 'center',
                      background: 'var(--bc-surface-card)',
                      fontWeight: 800,
                    }}>
                      <div style={{
                        width: gmsRevenueExpanded ? 'auto' : '0px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease'
                      }}>
                        GMS TOTAL
                      </div>
                    </th>
                  )}

                  {/* Price Trend Dates */}
                  {isVisible('priceTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`p-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(priceTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        

                      }}>
                        <div style={{
                          width: (priceTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* BSR Trend Dates */}
                  {isVisible('bsrTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`b-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(bsrTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        

                      }}>
                        <div style={{
                          width: (bsrTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* Rating Trend Dates */}
                  {isVisible('ratingTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`r-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(ratingTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        

                      }}>
                        <div style={{
                          width: (ratingTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* Review Trend Dates */}
                  {isVisible('reviewTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`rev-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(reviewTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        

                      }}>
                        <div style={{
                          width: (reviewTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}

                  {/* Image Trend Dates */}
                  {isVisible('imageTrend') && historyStructure.map(week => (
                    week.dates.map((date, idx) => (
                      <th key={`i-h-${idx}`} style={{
                        ...thStyle,
                        ...getTransitionStyle(imageTrendExpanded, idx, week.dates.length),
                        fontSize: 9,
                        textAlign: 'center',
                        

                      }}>
                        <div style={{
                          width: (imageTrendExpanded || idx === week.dates.length - 1) ? 'auto' : '0px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}>
                          {date.label}
                        </div>
                      </th>
                    ))
                  ))}
                </tr>

              </thead>
              <tbody>
                {filteredAsins.length === 0 ? (
                  <tr>
                      <td colSpan={56} style={{ padding: '60px 0' }}>
                      <EmptyState
                        icon={Package}
                        title="No ASINs Found"
                        description="There are no ASINs matching the current filters or seller selection."
                        action={hasPermission('asinmanager_manage') ? { label: 'Add ASINs', onClick: () => setShowAddModal(true) } : null}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredAsins.map((asin, idx) => {
                    const historyMap = {};
                    asin.history?.forEach(h => historyMap[normalizeDateStr(h.date)] = h);

                    const weekHistoryMap = {};
                    asin.weekHistory?.forEach(w => weekHistoryMap[normalizeDateStr(w.date)] = w);

                    const subBsrHistoryMap = {};
                    asin.subBsrHistory?.forEach(h => subBsrHistoryMap[normalizeDateStr(h.date)] = h);

                    const rowClass = [
                      'asin-grid__row',
                      isUnavailableStatus(asin) ? 'asin-grid__row--unavailable' : '',
                      asin._isChild ? 'asin-row--child' : '',
                      selectedIds.has(asin._id) ? 'is-selected' : ''
                    ].filter(Boolean).join(' ');

                    return (
                      <tr key={asin._id || idx} className={rowClass}>
                        {isVisible('checkbox') && (
                          <td className="asin-grid__sticky asin-grid__sticky--select" style={{
                            ...tdStyle,
                            width: '40px',
                            position: 'sticky',
                            left: 0,
                            zIndex: 6,
                            textAlign: 'center',
                            padding: 0
                          }}>
                            {asin._isChildLoading ? (
                              <span className="asin-inline-spinner" aria-hidden="true" />
                            ) : asin._isChild ? null : (
                              <>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(asin._id)}
                                  onChange={() => handleToggleSelectRow(asin._id)}
                                  aria-label={`Select ASIN ${asin.asinCode}`}
                                  style={{ cursor: 'pointer', verticalAlign: 'middle', width: '13px', height: '13px' }}
                                />
                                {asin._isParent && (
                                  <span
                                    aria-hidden="true"
                                    title={`${asin.childCount || 0} child ASINs`}
                                    style={{
                                      display: 'inline-block',
                                      marginTop: 1,
                                      fontSize: '8px',
                                      lineHeight: 1.2,
                                      color: 'var(--text-muted)'
                                    }}
                                  >
                                    {asin.childCount || 0}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                        )}
                        {isVisible('asinCode') && (
                          <td
                            className={`asin-grid__sticky ${isVisible('checkbox') ? 'asin-grid__sticky--asin' : 'asin-grid__sticky--select-only'}`}
                            style={{
                              ...tdStyle,
                              fontWeight: 600,
                              color: 'var(--text-brand)',
                              position: 'sticky',
                              width: '110px',
                              left: isVisible('checkbox') ? '40px' : '0px',
                              zIndex: 5,
                              borderRight: '2px solid var(--border-light)',
                              paddingLeft: asin._isChild ? '18px' : undefined
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                                {asin._isParent && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); toggleParentExpand(asin.asinCode); }}
                                    aria-expanded={expandedParents.has(asin.asinCode)}
                                    aria-label={`${expandedParents.has(asin.asinCode) ? 'Collapse' : 'Expand'} children of ${asin.asinCode}`}
                                    title={`${asin.childCount || 0} child ASINs`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flex: 'none',
                                      width: 16,
                                      height: 16,
                                      padding: 0,
                                      border: '1px solid var(--border-light)',
                                      borderRadius: '3px',
                                      background: 'var(--bg-secondary)',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {loadingParents.has(asin.asinCode)
                                      ? <span className="asin-inline-spinner" aria-hidden="true" />
                                      : expandedParents.has(asin.asinCode)
                                        ? <ChevronDown size={11} strokeWidth={3} />
                                        : <ChevronRight size={11} strokeWidth={3} />}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleViewAsin(asin)}
                                  title="View ASIN detail"
                                  style={{
                                    border: 0,
                                    background: 'transparent',
                                    padding: 0,
                                    font: 'inherit',
                                    fontWeight: 600,
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {asin.asinCode}
                                </button>
                              </span>
                              <a
                                href={(asin.marketplace === 'ajio' || marketplaceFilter === 'ajio') ? (asin.pageUrl || `https://www.ajio.com/p/${asin.asinCode}`) : (asin.marketplace === 'myntra' || marketplaceFilter === 'myntra') ? (asin.pageUrl || 'https://www.myntra.com') : `https://www.amazon.in/dp/${asin.asinCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={asin.marketplace === 'ajio' || marketplaceFilter === 'ajio' ? "Open on Ajio" : "Open on Amazon"}
                                style={{
                                  color: 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  marginLeft: '4px',
                                  transition: 'color 0.2s'
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-brand)'}
                                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </td>
                        )}
                        {/* ===== RELEASE DATE ===== */}
                        {isVisible('releaseDate') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.releaseDate ? (
                              <div className="d-flex align-items-center justify-content-center gap-2" style={{ whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600 }}>
                                  {new Date(asin.releaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                                <span className="badge bg-light text-zinc-500 border border-light" style={{ fontSize: '8px', padding: '2px 4px' }}>
                                  {(() => {
                                    const days = Math.floor((Date.now() - new Date(asin.releaseDate)) / (1000 * 60 * 60 * 24));
                                    if (days <= 30) return `${days}d`;
                                    if (days <= 60) return `${days}d⚡`;
                                    return `${Math.floor(days / 30)}m`;
                                  })()}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>-</span>
                            )}
                          </td>
                        )}
                        {/* ===== PARENT ASIN ===== */}
                        {isVisible('parentAsin') && (
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              {(() => {
                                const pAsin = asin.parentAsin || asin.ParentAsin;
                                if (!pAsin) return <span style={{ color: '#d1d5db' }}>-</span>;
                                return (
                                  <>
                                    <span style={{ fontWeight: 600, color: 'var(--text-brand)' }}>{pAsin}</span>
                                    <a
                                      href={(asin.marketplace === 'ajio' || marketplaceFilter === 'ajio') ? `https://www.ajio.com/p/${pAsin}` : (asin.marketplace === 'myntra' || marketplaceFilter === 'myntra') ? 'https://www.myntra.com' : `https://www.amazon.in/dp/${pAsin}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={asin.marketplace === 'ajio' || marketplaceFilter === 'ajio' ? "Open Parent on Ajio" : "Open Parent on Amazon"}
                                      style={{
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginLeft: '4px',
                                        transition: 'color 0.2s'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-brand)'}
                                      onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        )}
                        {isVisible('sellerBrand') && (
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {asin.seller?.name || asin.seller || 'Global'}
                              </span>
                              {asin.soldBy && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>• {asin.soldBy}</span>}
                            </div>
                          </td>
                        )}
                        {isVisible('sku') && <td style={tdStyle}>{asin.sku || '-'}</td>}
                        {isVisible('title') && (
                          <td style={{ ...tdStyle, width: '220px', maxWidth: '220px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                              {asin.imageUrl && (
                                <img src={asin.imageUrl} alt="" style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
                              )}
                              <span style={{
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                fontSize: '10.5px',
                                cursor: 'pointer',
                                maxWidth: '180px',
                                fontWeight: 500
                              }} onClick={() => handleViewAsin(asin)} title={asin.title}>
                                {asin.title}
                              </span>
                            </div>
                          </td>
                        )}
                        {isVisible('category') && (
                          <td style={tdStyle}>
                            <div className="d-flex flex-column" style={{ overflow: 'hidden' }}>
                              <span style={{
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                fontSize: '10.5px',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden'
                              }} title={asin.category?.replace(/&amp;/g, '&')}>
                                {(asin.category || '').replace(/&amp;/g, '&').split(/[›>]/).pop()?.trim() || '-'}
                              </span>
                            </div>
                          </td>
                        )}
                        {isVisible('tags') && (
                          <td style={tdStyle}>
                            <TagsCell asin={asin} onRefresh={loadData} />
                          </td>
                        )}
                        {isVisible('manufacturer') && (
                          <td style={{ ...tdStyle, textAlign: 'left' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', maxWidth: '110px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asin.manufacturer || ''}>
                              {asin.manufacturer || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                            </span>
                          </td>
                        )}
                        {isVisible('availabilityStatus') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.availabilityStatus ? (
                              (() => {
                                const s = (asin.availabilityStatus || '').toLowerCase();
                                const isUnavailable = s.includes('unavailable') || s.includes('out of stock') || s.includes('out_of_stock') || s.includes('currently unavailable');
                                const isInStock = s.includes('in stock') || s.includes('add to bag') || s.includes('add to cart') || s === 'available';
                                const bgColor = isUnavailable ? 'var(--bg-danger-subtle)' : isInStock ? 'var(--bg-success-subtle)' : 'var(--bg-secondary)';
                                const textColor = isUnavailable ? 'var(--text-danger)' : isInStock ? 'var(--text-success)' : 'var(--text-secondary)';
                                const borderColor = isUnavailable ? 'var(--bg-danger-subtle)' : isInStock ? 'var(--bc-border-success)' : 'var(--border-light)';
                                return (
                                  <Tooltip title={asin.availabilityStatus} placement="top" styles={{ root: { fontSize: 'var(--font-size-xs)' } }}>
                                    <span className="badge" style={{
                                      backgroundColor: bgColor,
                                      color: textColor,
                                      border: `1px solid ${borderColor}`,
                                      fontWeight: 600, fontSize: '0.65rem', padding: '2px 6px', borderRadius: 'var(--radius-sm)', maxWidth: '90px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default'
                                    }}>
                                      {asin.availabilityStatus}
                                    </span>
                                  </Tooltip>
                                );
                              })()
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>-</span>}
                          </td>
                        )}

                        {isVisible('ads') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.Ads ? (
                              <div className="d-flex align-items-center justify-content-center gap-1" title="Advertising Active">
                                <span className="badge d-flex align-items-center gap-1 shadow-sm" style={{ backgroundColor: 'var(--bg-success-subtle)', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 6px', fontSize: '0.65rem', fontWeight: 800, borderRadius: 'var(--radius-sm)' }}>
                                  <Megaphone size={10} />
                                  YES
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                            )}
                          </td>
                        )}
                        {isVisible('ads') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.hasGms ? (
                              <span className="badge d-flex align-items-center justify-content-center gap-1 shadow-sm" style={{ backgroundColor: 'var(--bg-success-subtle)', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 6px', fontSize: '0.65rem', fontWeight: 800, borderRadius: 'var(--radius-sm)' }}>
                                YES
                              </span>
                            ) : (
                              <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                            )}
                          </td>
                        )}
                        {/* Orders Monthly Cells */}
                        {isVisible('totalOrders') && ordersExpanded && availableMonths.map((month, mIdx) => {
                          const monthOrders = asin.monthlyOrders ? asin.monthlyOrders[month] : 0;
                          return (
                            <td key={`ord-c-${mIdx}`} style={{
                              ...tdStyle,
                              ...getTransitionStyle(ordersExpanded, mIdx, availableMonths.length + 1, '70px'),
                              textAlign: 'center'
                            }}>
                              <div style={{
                                width: ordersExpanded ? 'auto' : '0px',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease'
                              }}>
                                {monthOrders > 0 ? (
                                  <span className="text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>
                                    {monthOrders.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        {/* Orders Total Cell */}
                        {isVisible('totalOrders') && (
                          <td style={{
                            ...tdStyle,
                            ...getTransitionStyle(ordersExpanded, availableMonths.length, availableMonths.length + 1, '70px'),
                            textAlign: 'center',
                            background: ordersExpanded ? 'var(--bg-secondary)' : 'transparent'
                          }}>
                            <div style={{
                              width: 'auto',
                              overflow: 'hidden',
                              transition: 'all 0.3s ease'
                            }}>
                              {asin.totalOrders !== undefined && asin.totalOrders > 0 ? (
                                <span className="fw-bold text-zinc-700" style={{ fontSize: 'var(--font-size-xs)' }}>
                                  {asin.totalOrders.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                              )}
                            </div>
                          </td>
                        )}
                        {/* GMS Revenue Monthly Cells */}
                        {gmsRevenueExpanded && availableMonths.map((month, mIdx) => {
                          const gmsData = asin.monthlyGmsRevenue?.[month] || {};
                          const monthRevenue = gmsData.revenue || asin.monthlyGmsRevenue?.[month] || 0;
                          // Handle both flat numbers and objects with .revenue
                          const revenue = typeof monthRevenue === 'object' ? (monthRevenue.revenue || 0) : monthRevenue;
                          return (
                      <td className="asin-grid__cell--trend-revenue" key={`gms-c-${mIdx}`} style={{
                        ...tdStyle,
                        ...getTransitionStyle(gmsRevenueExpanded, mIdx, availableMonths.length + 1, '70px'),
                        textAlign: 'center'
                      }}>
                              <div style={{
                                width: gmsRevenueExpanded ? 'auto' : '0px',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease'
                              }}>
                                {revenue > 0 ? (
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#059669' }}>
                                    ₹{revenue.toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        {/* GMS Revenue Total Cell */}
                        {gmsRevenueExpanded && (
                      <td className="asin-grid__cell--trend-revenue-total" style={{
                        ...tdStyle,
                        ...getTransitionStyle(gmsRevenueExpanded, availableMonths.length, availableMonths.length + 1, '70px'),
                        textAlign: 'center',
                        fontWeight: 600
                      }}>
                            <div style={{
                              width: 'auto',
                              overflow: 'hidden',
                              transition: 'all 0.3s ease'
                            }}>
                              {(asin.totalOrders || 0) > 0 ? (
                                <span className="fw-bold" style={{ fontSize: 'var(--font-size-xs)', color: '#065f46' }}>
                                  ₹{(asin.totalOrders || 0).toLocaleString('en-IN')}
                                </span>
                              ) : (
                                <span className="text-zinc-300" style={{ fontSize: '10px' }}>—</span>
                              )}
                            </div>
                          </td>
                        )}
                        {isVisible('dealBadge') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealBadge && asin.dealBadge !== 'No deal found' && asin.dealBadge !== '' && asin.dealStartTime && asin.dealEndTime && isDealActive(asin) ? (
                              <Tooltip title={`${asin.dealBadge} — ${new Date(asin.dealStartTime).toLocaleDateString('en-IN')} to ${new Date(asin.dealEndTime).toLocaleDateString('en-IN')}`} placement="top" styles={{ root: { fontSize: 'var(--font-size-xs)' } }}>
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: 'var(--bg-danger-subtle)',
                                    color: 'var(--text-danger)',
                                    border: '1px solid var(--bg-danger-subtle)',
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    padding: '2px 6px',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'inline-block',
                                    maxWidth: '75px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'default'
                                  }}
                                >
                                  {asin.dealBadge}
                                </span>
                              </Tooltip>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>-</span>
                            )}
                          </td>
                        )}
                        {isVisible('dealStartTime') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealStartTime ? (
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {new Date(asin.dealStartTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>-</span>}
                          </td>
                        )}
                        {isVisible('dealEndTime') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealEndTime ? (
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {new Date(asin.dealEndTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>-</span>}
                          </td>
                        )}
                        {isVisible('dealAccessType') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.dealAccessType ? (
                              <span className="badge" style={{
                                backgroundColor: asin.dealAccessType === 'ALL' ? 'var(--bg-success-subtle)' : '#eff6ff',
                                color: asin.dealAccessType === 'ALL' ? 'var(--text-success)' : 'var(--text-brand)',
                                border: `1px solid ${asin.dealAccessType === 'ALL' ? '#a7f3d0' : '#bfdbfe'}`,
                                fontWeight: 600, fontSize: '0.6rem', padding: '2px 5px', borderRadius: 'var(--radius-sm)'
                              }}>
                                {asin.dealAccessType}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>-</span>}
                          </td>
                        )}
                        {/* ===== CURRENT BUYBOX ===== */}
                        {isVisible('currentBuybox') && (
                          <td style={{ ...tdStyle, width: '110px', padding: '4px 8px' }}>
                            {(() => {
                              const buyBoxes = asin.buyBoxes || [];
                              const winner = buyBoxes.find(b => b.isBuyBoxWinner) || buyBoxes[0];
                              const seller = winner?.seller || asin.soldBy || null;
                              const price = winner?.priceAmount || 0;
                              const mrp = winner?.mrpAmount || 0;
                              const savings = winner?.savingsAmount || 0;
                              const savingsPct = winner?.savingsPercentage || 0;
                              const condition = winner?.condition?.value || '';
                              const availability = winner?.availability || '';

                              if (!seller && !price) return <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>-</span>;

                              return (
                                <Tooltip title={
                                  <div style={{ fontSize: 'var(--font-size-xs)' }}>
                                    <div><b>Seller:</b> {seller || 'Unknown'}</div>
                                    <div><b>Price:</b> ₹{price.toLocaleString()}</div>
                                    {mrp > 0 && <div><b>MRP:</b> ₹{mrp.toLocaleString()}</div>}
                                    {savings > 0 && <div><b>Savings:</b> ₹{savings.toLocaleString()} ({savingsPct}% OFF)</div>}
                                    {condition && <div><b>Condition:</b> {condition}</div>}
                                    {availability && <div><b>Avail:</b> {availability}</div>}
                                  </div>
                                } placement="left" styles={{ root: { fontSize: 'var(--font-size-xs)' } }}>
                                  <div className="d-flex flex-column gap-1">
                                    <span className="fw-bold text-zinc-800 text-truncate" style={{ fontSize: '10px' }} title={seller || 'Unknown'}>
                                      {seller || 'Unknown'}
                                    </span>
                                    <span className="fw-bold text-indigo-600" style={{ fontSize: 'var(--font-size-xs)' }}>
                                      ₹{price.toLocaleString()}
                                    </span>
                                    {savings > 0 && (
                                      <span style={{ fontSize: '8px', color: 'var(--text-success)', fontWeight: 600 }}>
                                        {savingsPct}% OFF
                                      </span>
                                    )}
                                  </div>
                                </Tooltip>
                              );
                            })()}
                          </td>
                        )}

                        {isVisible('mrp') && (
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '10.5px' }}>
                            ₹{(asin.mrp || 0).toLocaleString()}
                          </td>
                        )}
                        {isVisible('price') && (
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, cursor: 'pointer' }}
                            onClick={(e) => handleViewPrice(asin, e)}
                            title="View Price Trend Matrix">
                            <div className="d-flex flex-column align-items-end">
                              {(() => {
                                const isDisputed = computeDynamicDispute(asin);
                                // Price column: uploaded channel price when present, else the
                                // scraped discounted price (Ajio), else MRP as a last resort.
                                const uploadedPrice = asin.uploadedPrice || 0;
                                const displayedPrice = uploadedPrice > 0
                                  ? uploadedPrice
                                  : (asin.currentPrice > 0 ? asin.currentPrice : (asin.mrp || 0));
                                return (
                                  <>
                                    <span style={{ color: isDisputed ? 'var(--text-danger)' : 'var(--text-success)' }}>
                                      ₹{displayedPrice.toLocaleString()}
                                    </span>
                                    {isDisputed && (
                                      <span className="badge mt-1 shadow-sm" style={{
                                        fontSize: '8px',
                                        padding: '2px 6px',
                                        fontWeight: 800,
                                        backgroundColor: 'var(--text-danger)',
                                        color: '#fff',
                                        borderRadius: 'var(--radius-sm)',
                                        textTransform: 'uppercase'
                                      }}>
                                        PRICE DISPUTE
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        )}
                        {isVisible('discountPercentage') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <span className="badge bg-danger bg-opacity-10 text-danger" style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                              {asin.discountPercentage ? `${asin.discountPercentage}% OFF` : '-'}
                            </span>
                          </td>
                        )}
                        {isVisible('priceDispute') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {(() => {
                              const isDisputed = computeDynamicDispute(asin);
                              return (
                                <Tooltip title={isDisputed ? 'Channel price differs from current price by >₹5' : 'No price dispute'} placement="top" styles={{ root: { fontSize: 'var(--font-size-xs)' } }}>
                                  <span className="badge" style={{
                                    backgroundColor: isDisputed ? 'var(--bg-danger-subtle)' : 'var(--bg-success-subtle)',
                                    color: isDisputed ? 'var(--text-danger)' : 'var(--text-success)',
                                    border: `1px solid ${isDisputed ? 'var(--bg-danger-subtle)' : '#a7f3d0'}`,
                                    fontWeight: 600, fontSize: '0.65rem', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                    cursor: 'default'
                                  }}>
                                    {isDisputed ? 'DISPUTED' : 'No Dispute'}
                                  </span>
                                </Tooltip>
                              );
                            })()}
                          </td>
                        )}
                        {isVisible('priceTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            const currentOrUploadedPrice = asin.currentPrice;
                            let priceVal = (wData && wData.price !== undefined && wData.price !== null && wData.price !== 0)
                              ? wData.price
                              : null;

                            // Fallback removed to expose data integrity gaps

                            return (
                                <td className="asin-grid__cell--trend-bsr" key={`p-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewPrice(asin, e)}
                                title="View Price Trend Matrix"
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(priceTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (priceTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {priceVal ? getWeekHistoryBadge(priceVal, 'price', currentOrUploadedPrice) : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('mainBsr') && (
                          <td className="asin-grid__cell--trend-bsr" style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={(e) => handleViewBsr(asin, e)}>
                            <div className="d-flex flex-column align-items-center">
                              <div style={{ fontWeight: 600, color: 'var(--color-secondary)', fontSize: 'var(--font-size-xs)' }}>
                                {asin.bsr ? `#${asin.bsr.toLocaleString()}` : '-'}
                              </div>
                              {asin.bsr && asin.category && (
                                <span className="text-zinc-400 text-truncate" style={{ fontSize: '8px', maxWidth: '75px' }} title={asin.category}>
                                  in {asin.category}
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {isVisible('subBsr') && (
                          <td style={{ ...tdStyle, width: '120px' }}>
                            {(() => {
                              const subBsrValue = (asin.subBsr && asin.subBsr !== '0' && asin.subBsr !== 0) ? asin.subBsr : ((Array.isArray(asin.subBSRs) && asin.subBSRs[0]) || '');
                              const hasMultiple = Array.isArray(asin.subBSRs) && asin.subBSRs.length > 1;
                              let rank = subBsrValue;
                              let category = '';
                              if (typeof subBsrValue === 'string' && subBsrValue.includes(' in ')) {
                                const parts = subBsrValue.split(' in ');
                                rank = parts[0];
                                category = parts.slice(1).join(' in ');
                              }

                              return subBsrValue && subBsrValue !== '0' ? (
                                <div className="d-flex flex-column gap-1">
                                  <div className="d-flex align-items-center gap-1">
                                    <span style={{
                                      fontSize: '10px',
                                      color: 'var(--text-secondary)',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: hasMultiple ? '85px' : '110px'
                                    }} title={rank}>
                                      {rank}
                                    </span>
                                    {hasMultiple && (
                                      <span
                                        className="badge rounded-pill bg-zinc-100 text-zinc-500 border border-zinc-200"
                                        style={{ fontSize: '8px', padding: '1px 4px' }}
                                        title={asin.subBSRs.slice(1).join('\n')}
                                      >
                                        +{asin.subBSRs.length - 1}
                                      </span>
                                    )}
                                  </div>
                                  {category && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: 'var(--text-secondary)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '110px'
                                    }} title={category}>
                                      {category}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              );
                            })()}
                          </td>
                        )}
                        {isVisible('bsrTrendStatus') && (
                          <td
                            style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => handleViewTrends(asin, 'bsr')}
                          >
                            <TrendBadge status={asin.bsrTrend} />
                          </td>
                        )}
                        {isVisible('bsrTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const hDate = date.raw;
                            const subBsrPoint = subBsrHistoryMap[hDate];
                            const displayVal = subBsrPoint?.rank ?? asin.subBsr;
                            return (
                              <td className="asin-grid__cell--trend-bsr" key={`b-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewBsr(asin, e)}
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(bsrTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (bsrTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {displayVal ? getWeekHistoryBadge(displayVal, 'subBsr') : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('rating') && (
                          <td style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={(e) => handleViewRating(asin, e)}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                              <Star size={10} className="text-warning fill-warning" />
                              <span style={{ fontWeight: 600 }}>
                                {typeof asin.rating === 'number' ? asin.rating.toFixed(1) : (asin.rating || '-')}
                              </span>
                            </div>
                          </td>
                        )}
                        {isVisible('reviewCount') && (
                          <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {asin.reviewCount !== null && asin.reviewCount !== undefined ? asin.reviewCount.toLocaleString() : '-'}
                          </td>
                        )}
                        {isVisible('ratingBreakdown') && (
                          <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }}>
                            {renderRatingBreakdown(asin.ratingBreakdown)}
                          </td>
                        )}
                        {isVisible('ratingTrendStatus') && (
                          <td
                            style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => handleViewTrends(asin, 'rating')}
                          >
                            <TrendBadge status={asin.ratingTrend} />
                          </td>
                        )}
                        {isVisible('ratingTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            const ratingVal = (wData && wData.rating !== undefined && wData.rating !== null) ? wData.rating : asin.rating;
                            return (
                              <td className="asin-grid__cell--trend-rating" key={`r-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewRating(asin, e)}
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(ratingTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (ratingTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {(ratingVal !== undefined && ratingVal !== null && ratingVal !== '') ? getWeekHistoryBadge(ratingVal, 'rating') : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('reviewCount') && (
                          <td
                            style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => handleViewTrends(asin, 'reviews')}
                          >
                            <TrendBadge status={getReviewTrendStatus(asin)} />
                          </td>
                        )}
                        {isVisible('reviewTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            const reviewsVal = (wData && wData.reviews !== undefined && wData.reviews !== null) ? wData.reviews : (wData?.reviewCount !== undefined && wData?.reviewCount !== null ? wData.reviewCount : asin.reviewCount);
                            return (
                              <td className="asin-grid__cell--trend-rating" key={`rev-${week.label}-${dIdx}`}
                                onClick={(e) => handleViewRating(asin, e)}
                                style={{
                                  ...tdStyle,
                                  ...getTransitionStyle(reviewTrendExpanded, dIdx, week.dates.length),
                                  textAlign: 'center',
                                  cursor: 'pointer'
                                }}>
                                <div style={{
                                  width: (reviewTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {(reviewsVal !== undefined && reviewsVal !== null && reviewsVal !== '') ? <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 600 }}>{reviewsVal.toLocaleString()}</span> : '-'}
                                </div>
                              </td>
                            );
                          })
                        ))}
                        {isVisible('video') && (
                          <td style={{ ...tdStyle, width: '50px', textAlign: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: asin.videoCount > 0 ? 'var(--text-success)' : '#6b7280',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}
                            >
                              {asin.videoCount > 0 ? 'Yes' : 'No'}
                            </span>
                          </td>
                        )}
                        {isVisible('imagesCount') && <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{asin.imagesCount || 0}</td>}

                        {isVisible('imageTrend') && historyStructure.map(week => (
                          week.dates.map((date, dIdx) => {
                            const wData = weekHistoryMap[date.raw] || historyMap[date.raw];
                            return (
                                <td className="asin-grid__cell--trend-visual" key={`i-${week.label}-${dIdx}`}
                                  style={{
                                    ...tdStyle,
                                    ...getTransitionStyle(imageTrendExpanded, dIdx, week.dates.length),
                                    textAlign: 'center'
                                  }}>
                                <div style={{
                                  width: (imageTrendExpanded || dIdx === week.dates.length - 1) ? 'auto' : '0px',
                                  overflow: 'hidden',
                                  transition: 'all 0.3s ease'
                                }}>
                                  <span style={{ fontSize: '10px', color: '#db2777', fontWeight: 600 }}>
                                    {wData?.imageCount !== undefined ? wData.imageCount : (asin.imagesCount || '-')}
                                  </span>
                                </div>
                              </td>
                            );
                          })
                        ))}

                        {isVisible('bulletPoints') && (
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                            {asin.bulletPoints || asin.bulletPointsText?.length || 0}
                          </td>
                        )}

                        {isVisible('hasAplus') && (
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {asin.status === 'Scraping' ? (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: asin.hasAplus ? 'var(--text-success)' : '#6b7280',
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.75rem'
                                }}
                              >
                                {asin.hasAplus ? 'Yes' : 'No'}
                              </span>
                            )}
                          </td>
                        )}

                        {isVisible('aplusDays') && (
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--text-danger)' }}>
                            {asin.aplusAbsentSince && !asin.hasAplus
                              ? Math.floor((Date.now() - new Date(asin.aplusAbsentSince)) / (1000 * 60 * 60 * 24))
                              : '-'}
                          </td>
                        )}
                        {/* ===== ROW ACTIONS ===== */}
                        <td className="asin-grid__sticky asin-grid__sticky--actions" style={{
                          ...tdStyle,
                          width: '60px',
                          textAlign: 'center',
                          position: 'sticky',
                          right: 0,
                          zIndex: 6,
                          borderLeft: '1px solid var(--border-light)',
                          padding: '4px'
                        }}>
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'view',
                                  label: 'View Details',
                                  icon: <Eye size={14} className="text-blue-500" />,
                                  onClick: () => handleViewAsin(asin)
                                },
                                {
                                  key: 'trends',
                                  label: 'View Trends',
                                  icon: <TrendingUp size={14} className="text-indigo-500" />,
                                  onClick: () => handleViewTrends(asin)
                                },
                                {
                                  key: 'sync',
                                  label: 'Sync Marketplace',
                                  icon: <RefreshCw size={14} className="text-emerald-500" />,
                                    onClick: () => handleIndividualScrape(asin._id)
                                },
                                {
                                    key: 'edit',
                                    label: 'Edit ASIN',
                                    icon: <Edit3 size={14} className="text-amber-500" />,
                                    onClick: () => {
                                        setActiveEditAsin(asin);
                                    }
                                },
                                {
                                  key: 'toggle',
                                  label: asin.status === 'Active' ? 'Deactivate' : 'Activate',
                                  icon: asin.status === 'Active' ? <PauseCircle size={14} className="text-zinc-500" /> : <PlayCircle size={14} className="text-emerald-500" />,
                                  onClick: () => handleToggleAsinStatus(asin._id, asin.status)
                                },
                                isAdmin ? { type: 'divider' } : null,
                                isAdmin ? {
                                  key: 'delete',
                                  label: 'Delete ASIN',
                                  icon: <Trash2 size={14} className="text-rose-500" />,
                                  danger: true,
                                  onClick: () => handleDeleteAsin(asin._id)
                                } : null
                              ].filter(Boolean)
                            }}
                            trigger={['click']}
                            placement="bottomRight"
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<MoreHorizontal size={16} color="var(--text-muted)" />}
                              className="hover-bg-zinc-100 rounded-circle"
                              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            />
                          </Dropdown>
                        </td>
                      </tr>
                    );
                  }))}
              </tbody>
            </table>
          </div>

          {/* [F] Pagination Footer */}
          <div style={{
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)',
            flexShrink: 0
          }}>
            <Suspense fallback={<div className="h-10 w-full animate-pulse bg-zinc-100" />}>
              <TablePagination
                component="div"
                count={viewMode === 'parent' ? (parentPagination.total || 0) : (pagination.total || 0)}
                page={(viewMode === 'parent' ? (parentPagination.page || 1) : (pagination.page || 1)) - 1}
                onPageChange={viewMode === 'parent' 
                  ? (_, newPage) => { const pg = newPage + 1; setParentPagination(p => ({ ...p, page: pg })); loadParentData(pg, parentPagination.limit); }
                  : handleChangePage
                }
                rowsPerPage={viewMode === 'parent' ? (parentPagination.limit || 50) : (pagination.limit || 25)}
                onRowsPerPageChange={viewMode === 'parent'
                  ? (e) => { const newLimit = parseInt(e.target.value); setParentPagination(p => ({ ...p, page: 1, limit: newLimit })); loadParentData(1, newLimit); }
                  : handleChangeRowsPerPage
                }
                rowsPerPageOptions={[25, 50, 100, 200]}
                sx={{
                  fontSize: 'var(--font-size-xs)',
                  minHeight: '36px',
                  '.MuiToolbar-root': {
                    minHeight: '36px',
                    height: '36px',
                    paddingLeft: '12px',
                    paddingRight: '12px'
                  },
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    margin: 0
                  },
                  '.MuiTablePagination-select': {
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600
                  },
                  '.MuiTablePagination-actions': {
                    marginLeft: '8px',
                    '& .MuiIconButton-root': {
                      padding: '4px'
                    }
                  }
                }}
              />
            </Suspense>
          </div>
        </div>

        {/* [M] Modals Consolidated */}
        <Suspense fallback={<div />}>

          {activeEditAsin && (
            <EditTagsModal
              isOpen={!!activeEditAsin}
              asin={activeEditAsin}
              onClose={() => setActiveEditAsin(null)}
              onUpdate={(asinId, newTags) => {
                setAsins(prev => prev.map(a =>
                  a._id === asinId ? { ...a, tags: newTags } : a
                ));
              }}
            />
          )}
        </Suspense>

        {/* MODERNIZED ADD ASIN MODAL */}
        <Modal
          title={
            <div className="d-flex align-items-center gap-2">
              <PlusCircle size={18} className="text-primary" />
              <span style={{ fontWeight: 600 }}>Add New ASINs</span>
            </div>
          }
          open={showAddModal}
          onCancel={() => setShowAddModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={syncing}
              onClick={handleSync}
              style={{ fontWeight: 600 }}
            >
              {syncing ? 'Adding...' : 'Add ASINs'}
            </Button>
          ]}
          width={480}
          centered
          styles={{
            header: { borderBottom: '1px solid #f0f0f0', paddingBottom: 12 },
            footer: { borderTop: '1px solid #f0f0f0', paddingTop: 12 }
          }}
        >
          <div className="py-2">
            <Form layout="vertical">
              <Form.Item
                label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>ASIN LIST (COMMA SEPARATED)</span>}
              >
                <Input.TextArea
                  value={newAsin}
                  onChange={(e) => setNewAsin(e.target.value)}
                  placeholder="B0XXXXXXX, B0YYYYYYY"
                  rows={4}
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
              </Form.Item>
              <Form.Item
                label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>SELECT SELLER</span>}
              >
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSellerId}
                  onSelect={setSelectedSellerId}
                  placeholder="Select Seller..."
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>

        {/* MODERNIZED MANUAL TASK MODAL */}
        <Modal
          title={
            <div>
              <div className="d-flex align-items-center gap-2">
                <PlusCircle size={18} className="text-emerald-500" />
                <span style={{ fontWeight: 800 }}>Create Task for Selected ASINs</span>
              </div>
              <p className="m-0 mt-1 text-zinc-500 fw-medium" style={{ fontSize: 'var(--font-size-xs)' }}>
                Assigning a custom task category-wise for {selectedIds.size} selected ASIN(s)
              </p>
            </div>
          }
          open={showManualTaskModal}
          onCancel={() => setShowManualTaskModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowManualTaskModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={loading}
              onClick={handleCreateManualTask}
              style={{ background: 'var(--text-success)', borderColor: 'var(--text-success)', fontWeight: 600 }}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          ]}
          width={540}
          centered
          styles={{
            header: { borderBottom: '1px solid #f0f0f0', paddingBottom: 16 },
            footer: { borderTop: '1px solid #f0f0f0', paddingTop: 16 }
          }}
        >
          <div className="py-3">
            <Form layout="vertical">
              <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Task Title</span>}>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Update listing bullet points"
                  style={{ borderRadius: 'var(--radius-md)', padding: '8px 12px' }}
                />
              </Form.Item>
              <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Task Description</span>}>
                <Input.TextArea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Describe the steps or requirements for this task..."
                  rows={3}
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
              </Form.Item>
              <div className="row">
                <div className="col-md-6">
                  <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Priority</span>}>
                    <Select
                      value={taskPriority}
                      onChange={setTaskPriority}
                      style={{ height: '40px' }}
                    >
                      <Select.Option value="LOW">Low</Select.Option>
                      <Select.Option value="MEDIUM">Medium</Select.Option>
                      <Select.Option value="HIGH">High</Select.Option>
                      <Select.Option value="CRITICAL">Critical</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
                <div className="col-md-6">
                  <Form.Item label={<span className="fw-bold text-zinc-600 text-uppercase tracking-wider" style={{ fontSize: '10px' }}>Task Category</span>}>
                    <Select
                      value={taskCategory}
                      onChange={setTaskCategory}
                      style={{ height: '40px' }}
                    >
                      <Select.Option value="TITLE_OPTIMIZATION">Title Optimization</Select.Option>
                      <Select.Option value="IMAGE_OPTIMIZATION">Image Optimization</Select.Option>
                      <Select.Option value="DESCRIPTION_OPTIMIZATION">Description Optimization</Select.Option>
                      <Select.Option value="A_PLUS_CONTENT">A+ Content Optimization</Select.Option>
                      <Select.Option value="GENERAL_OPTIMIZATION">Listing Quality (LQS)</Select.Option>
                      <Select.Option value="GENERAL">Custom General Task</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
              </div>
            </Form>
          </div>
        </Modal>

        {/* MODERNIZED UPLOAD MODAL */}
        <Modal
          title={
            <div className="d-flex align-items-center gap-2">
              <Upload size={18} className="text-emerald-600" />
              <span style={{ fontWeight: 600 }}>Upload CSV</span>
            </div>
          }
          open={showUploadModal}
          onCancel={() => setShowUploadModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={uploading}
              disabled={!selectedSellerId}
              onClick={() => document.querySelector('input[type="file"]')?.click()}
              style={{ background: 'var(--text-success)', borderColor: 'var(--text-success)', fontWeight: 600 }}
            >
              {uploading ? 'Uploading...' : 'Import CSV'}
            </Button>
          ]}
          width={450}
          centered
        >
          <div className="py-3">
            <Form layout="vertical">
              <Form.Item label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>SELECT SELLER</span>}>
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSellerId}
                  onSelect={setSelectedSellerId}
                  placeholder="Select Seller..."
                />
              </Form.Item>
              <Form.Item label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>CSV FILE</span>}>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>
      </div>

      {/* [N] Secondary Modals - Lazy Loaded */}
      <Suspense fallback={null}>
        <AsinDetailModal
          asin={selectedAsin}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
        />
        <AsinTrendsModal
          asin={selectedAsin}
          isOpen={showTrendsModal}
          onClose={() => setShowTrendsModal(false)}
        />
        <PriceViewModal
          isOpen={!!selectedAsinForPrice || showAllPriceHistory}
          onClose={() => { setSelectedAsinForPrice(null); setShowAllPriceHistory(false); }}
          filters={appliedFilters}
          searchQuery={appliedSearchQuery}
          sellerId={selectedSeller}
        />
        <BSRViewModal
          isOpen={!!selectedAsinForBsr || showAllBsrHistory}
          onClose={() => { setSelectedAsinForBsr(null); setShowAllBsrHistory(false); }}
          filters={appliedFilters}
          searchQuery={appliedSearchQuery}
          sellerId={selectedSeller}
        />
        <RatingViewModal
          isOpen={!!selectedAsinForRating || showAllRatingHistory}
          onClose={() => { setSelectedAsinForRating(null); setShowAllRatingHistory(false); }}
          filters={appliedFilters}
          searchQuery={appliedSearchQuery}
          sellerId={selectedSeller}
        />
        <ExportAsinModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          currentFilters={appliedFilters}
          searchQuery={appliedSearchQuery}
          selectedSeller={selectedSeller}
          selectedIds={Array.from(selectedIds)}
        />
        <BulkImportModal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onComplete={loadData}
        />
      </Suspense>
      {/* Bulk Tags Modal */}
      {showBulkTagsModal && (
        <BulkTagsModal
          isOpen={showBulkTagsModal}
          onClose={() => setShowBulkTagsModal(false)}
          selectedAsins={asins.filter(a => selectedIds.has(a._id || a.Id))}
          onComplete={() => {
            setShowBulkTagsModal(false);
            clearSelection();
            loadData(pagination.page, pagination.limit);
          }}
        />
      )}

      {/* AI Listing Analysis Modal */}
      {showAiAnalysisModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !aiAnalysisLoading && setShowAiAnalysisModal(false)}>
          <div style={{ background: '#fff', borderRadius: "var(--radius-xl)", width: '90%', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: 'linear-gradient(135deg, #6d28d9, #1976D2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>AI Listing Quality Analysis</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Amazon policy compliance & optimization recommendations</div>
                </div>
              </div>
              <button onClick={() => setShowAiAnalysisModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 120px)' }}>
              {aiAnalysisLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--border-light)', borderTopColor: '#6d28d9', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>AI is analyzing your listings against Amazon policies...</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>This may take 15-30 seconds per ASIN</div>
                </div>
              )}
              {!aiAnalysisLoading && aiAnalysisResult && aiAnalysisResult.map((result, idx) => (
                <div key={idx} style={{ marginBottom: 20, border: '1px solid var(--border-light)', borderRadius: "var(--radius-lg)", overflow: 'hidden' }}>
                  {result.error ? (
                    <div style={{ padding: 20, background: 'var(--bg-danger-subtle)', color: 'var(--text-danger)', fontSize: 12 }}>Error: {result.error}</div>
                  ) : (
                    <>
                      <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Score: {result.overallScore}/100</span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>{result.summary}</span>
                        </div>
                        <button onClick={() => handleAiCreateTasks(result.asinId)}
                          disabled={syncing}
                          style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: '4px 12px', borderRadius: 6, background: 'var(--text-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {syncing ? 'Creating...' : 'Create Tasks'}
                        </button>
                      </div>
                      {result.issues?.length > 0 && (
                        <div style={{ padding: 12 }}>
                          {result.issues.map((issue, i) => (
                            <div key={i} style={{ padding: '8px 12px', background: issue.severity === 'critical' ? 'var(--bg-danger-subtle)' : issue.severity === 'high' ? 'var(--bg-warning-subtle)' : 'var(--bg-secondary)', borderLeft: `3px solid ${issue.severity === 'critical' ? 'var(--text-danger)' : issue.severity === 'high' ? 'var(--text-warning)' : 'var(--text-brand)'}`, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: 10 }}>{issue.field} · {issue.severity}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: issue.priority === 'HIGH' ? 'var(--text-danger)' : 'var(--text-muted)' }}>{issue.priority}</span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{issue.issue}</div>
                              <div style={{ color: 'var(--text-success)', fontSize: 'var(--font-size-xs)' }}>→ {issue.recommendation}</div>
                              {issue.amazonPolicy && <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>Policy: {issue.amazonPolicy}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsinManagerPage;
