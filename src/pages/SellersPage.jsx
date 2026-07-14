import { Spinner } from "@/components/Spinner";

import React, {
  useState, useEffect, useMemo, useCallback,
  useRef, Suspense, lazy
} from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { sellerApi, userApi, asinApi, marketSyncApi } from '../services/api';
import {
  Table, Button, Space,
  Tag, Typography, Tooltip, Avatar, Empty,
  Badge, Card, Popconfirm
} from 'antd';
import {
  Package, FileUp,
  Clock, Trash2, Play, Pause,
  RefreshCw, Edit3, Star, Zap
} from 'lucide-react';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { LoadError } from '@/components/LoadError';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useHeader } from '../contexts/HeaderContext';
import { useSocket } from '../contexts/SocketContext';
import SellerPageHeader from '../components/sellers/SellerPageHeader';
import SellerStatsStrip from '../components/sellers/SellerStatsStrip';
import SellerToolbar from '../components/sellers/SellerToolbar';
import styles from './Sellers.module.css';
import { PERMISSIONS } from '../constants/permissions';

const AddSellerModal = lazy(() => import('../components/sellers/AddSellerModal'));
const ImportSellerModal = lazy(() => import('../components/sellers/ImportSellerModal'));
const SellerAsinsModal = lazy(() => import('../components/sellers/SellerAsinsModal'));
const PoolManagementModal = lazy(() => import('../components/sellers/PoolManagementModal'));
const BulkImportModal = lazy(() => import('../components/asins/BulkImportModal'));

const { Text } = Typography;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// Marketplace-based avatar colors — all sellers of same marketplace get same color
const MARKETPLACE_COLORS = {
  'amazon.in': { gradient: 'linear-gradient(135deg, var(--text-brand-dark, #1565C0), var(--text-brand, #1976D2))', color: 'var(--text-brand, #1976D2)', bg: '#E3F2FD' },
  'ajio': { gradient: 'linear-gradient(135deg, #C2185B, #E91E63)', color: '#E91E63', bg: '#FCE4EC' },
  'myntra': { gradient: 'linear-gradient(135deg, #E65100, #FF5722)', color: '#FF5722', bg: '#FBE9E7' },
};
const DEFAULT_MARKETPLACE = { gradient: 'linear-gradient(135deg, #455A64, #607D8B)', color: '#607D8B', bg: '#ECEFF1' };

function getMarketplaceColor(marketplace) {
  const m = (marketplace || '').toLowerCase();
  return MARKETPLACE_COLORS[m] || DEFAULT_MARKETPLACE;
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────

const SellersPage = () => {
  const { user: currentUser, isAdmin, isGlobalUser, hasPermission } = useAuth();
  const { addToast } = useToast();
  const { setPageMeta } = useHeader();
  const socket = useSocket();

  const isBrandManager = useMemo(() => {
    const role = (currentUser?.role?.name || currentUser?.role?.displayName || '').toString().toLowerCase();
    return role === 'brand manager';
  }, [currentUser?.role]);

  const canViewEmail = useMemo(() => {
    const role = (currentUser?.role?.name || '').toString().toLowerCase();
    return role === 'super_admin' || role === 'admin' || role === 'operation manager' || role === 'operation_manager';
  }, [currentUser?.role]);

  // ── Data state ─────────────────────────────────────────────────────────
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    setPageMeta({
      title: 'Seller Management',
      subtitle: `Manage ${totalItems} storefronts`,
      breadcrumbs: [{ label: 'Global' }, { label: 'Sellers' }],
    });
  }, [setPageMeta, totalItems]);

  // ── Filter state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [managersList, setManagersList] = useState([]);
  const [dbStats, setDbStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Modal / UI state ───────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showAsinModal, setShowAsinModal] = useState(false);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [editingSeller, setEditingSeller] = useState(null);
  const [sellerAsins, setSellerAsins] = useState([]);
  const [asinPagination, setAsinPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loadingAsins, setLoadingAsins] = useState(false);
  const [selectedSellerIds, setSelectedSellerIds] = useState([]);
  const [bulkImportConfig, setBulkImportConfig] = useState({ sellerId: '', tab: 'catalog' });
  const [poolStats, setPoolStats] = useState({ total: 0, assigned: 0, available: 0 });
  const [syncingIds, setSyncingIds] = useState(new Set());
  const [liveSyncingIds, setLiveSyncingIds] = useState(new Set());
  const [liveSyncStatuses, setLiveSyncStatuses] = useState({});

  // Stable toast ref
  const toastRef = useRef(addToast);
  useEffect(() => { toastRef.current = addToast; }, [addToast]);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // Always-current filter state for socket handlers and intervals
  const filterStateRef = useRef({ page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch });
  useEffect(() => { filterStateRef.current = { page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch }; });

  const canAccessAmazon = isAdmin || hasPermission(PERMISSIONS.MARKETPLACE_AMAZON);
  const canAccessAjio = isAdmin || hasPermission(PERMISSIONS.MARKETPLACE_AJIO);
  const canAccessMyntra = isAdmin || hasPermission(PERMISSIONS.MARKETPLACE_MYNTRA);

  // Init marketplace filter once
  const marketplaceInitRef = useRef(false);
  useEffect(() => {
    if (marketplaceInitRef.current) return;
    marketplaceInitRef.current = true;
    if (!canAccessAmazon && canAccessAjio) setMarketplaceFilter('ajio');
    else if (canAccessAmazon && !canAccessAjio) setMarketplaceFilter('amazon.in');
  }, []); // eslint-disable-line

  // Fetch managers list for filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await userApi.getManagers();
        if (res.success) setManagersList(res.data || []);
      } catch (err) { console.error('Failed to fetch managers:', err); }
    })();
  }, []);

  // ── Core fetch (stable — never changes) ────────────────────────────────
  const loadSellers = useCallback(async (params = {}) => {
    const {
      page: p = 1, limit: l = 50,
      activeTab: tab = 'all',
      marketplaceFilter: mf = 'all',
      managerFilter: mgr = 'all',
      statusFilter: sf = 'all',
      search: q = '',
      silent = false
    } = params;

    if (!silent) setLoading(true);
    try {
      const response = await sellerApi.getAll({
        page: p, limit: l,
        status: sf !== 'all' ? sf : tab !== 'all' ? tab : undefined,
        marketplace: mf !== 'all' ? mf : undefined,
        manager: mgr !== 'all' ? mgr : undefined,
        search: q || undefined,
      });

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
    } catch (error) {
      console.error('Failed to load sellers:', error);
      toastRef.current('Network error: Could not connect to data service', 'error');
      setError('Failed to load sellers');
      setSellers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // stable forever

  // Fetch aggregated stats from backend whenever filters change
  useEffect(() => {
    (async () => {
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
      } catch (err) { console.error('Failed to fetch seller stats:', err); }
      finally { setStatsLoading(false); }
    })();
  }, [activeTab, marketplaceFilter, managerFilter, statusFilter, debouncedSearch]);

  // Trigger on filter change
  useEffect(() => {
    setPage(1);
    void loadSellers({ page: 1, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch });
  }, [activeTab, marketplaceFilter, managerFilter, statusFilter, debouncedSearch, loadSellers]);

  // Trigger on page/limit change only (skip initial render — already handled above)
  const isFirstPageRender = useRef(true);
  useEffect(() => {
    if (isFirstPageRender.current) { isFirstPageRender.current = false; return; }
    void loadSellers({ page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch });
  }, [page, limit]); // eslint-disable-line

  // Socket: silent refresh via ref
  const loadSellersRef = useRef(loadSellers);
  useEffect(() => { loadSellersRef.current = loadSellers; });

  useEffect(() => {
    if (!socket) return;
    const handleSellersUpdated = () => {
      void loadSellersRef.current({ ...filterStateRef.current, silent: true });
    };
    socket.on('SELLERS_UPDATED', handleSellersUpdated);
    return () => socket.off('SELLERS_UPDATED', handleSellersUpdated);
  }, [socket]);

  // Listen for live sync ASIN updates
  useEffect(() => {
    if (!socket) return;
    const handleAsinsUpdated = () => {
      void loadSellersRef.current({ ...filterStateRef.current, silent: true });
    };
    const handleLiveSyncCompleted = (data) => {
      toastRef.current(`Live sync complete: ${data.updatedAsins} ASINs updated in ${(data.duration / 1000).toFixed(1)}s`, 'success');
    };
    const handleLiveSyncAllCompleted = (data) => {
      toastRef.current(`Global sync complete: ${data.success} sellers, ${data.totalAsinsUpdated} ASINs in ${(data.duration / 1000).toFixed(1)}s`, 'success');
      setGlobalSyncing(false);
    };
    socket.on('ASINS_UPDATED', handleAsinsUpdated);
    socket.on('liveSync:completed', handleLiveSyncCompleted);
    socket.on('liveSyncAll:completed', handleLiveSyncAllCompleted);
    return () => {
      socket.off('ASINS_UPDATED', handleAsinsUpdated);
      socket.off('liveSync:completed', handleLiveSyncCompleted);
      socket.off('liveSyncAll:completed', handleLiveSyncAllCompleted);
    };
  }, [socket]);

  // Pool stats
  const fetchPoolStats = useCallback(async () => {
    try {
      const res = await marketSyncApi.getPoolStatus();
      if (res.success) setPoolStats(res.stats);
    } catch (err) { console.error('Failed to fetch pool stats:', err); }
  }, []);

  useEffect(() => {
    if (isGlobalUser) fetchPoolStats();
  }, [isGlobalUser, fetchPoolStats]);

  useEffect(() => {
    setSelectedSellerIds([]);
  }, [page, activeTab, marketplaceFilter, managerFilter, debouncedSearch]);

  // ── OPTIMISTIC: Toggle status (instant — no refetch) ──────────────────
  const handleToggleStatus = useCallback(async (sellerId) => {
    let previousStatus;
    // ① Instant UI — read current state from prev
    setSellers(prev => {
      const seller = prev.find(s => s._id === sellerId);
      if (!seller) return prev;
      previousStatus = seller.status;
      const newStatus = seller.status === 'Active' ? 'Paused' : 'Active';
      // Fire API call outside setState (async)
      sellerApi.update(sellerId, { status: newStatus })
        .then(() => {
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, _saving: false } : s));
        })
        .catch((e) => {
          console.error('Failed to update status:', e);
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, status: previousStatus, _saving: false } : s));
          toastRef.current('Failed to update status', 'error');
        });
      return prev.map(s => s._id === sellerId ? { ...s, status: newStatus, _saving: true } : s);
    });
  }, []);

  // ── OPTIMISTIC: Toggle Priority ─────────────────────────────────────────
  const handleTogglePriority = useCallback(async (sellerId) => {
    let previousPriority;
    setSellers(prev => {
      const seller = prev.find(s => s._id === sellerId);
      if (!seller) return prev;
      previousPriority = seller.isPriority;
      const newPriority = !seller.isPriority;
      sellerApi.update(sellerId, { isPriority: newPriority })
        .then(() => {
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, _savingPriority: false } : s));
          toastRef.current(newPriority ? 'Marked as High Priority' : 'Removed from High Priority', 'success');
        })
        .catch((e) => {
          console.error('Failed to update priority:', e);
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, isPriority: previousPriority, _savingPriority: false } : s));
          toastRef.current('Failed to update priority', 'error');
        });
      return prev.map(s => s._id === sellerId ? { ...s, isPriority: newPriority, _savingPriority: true } : s);
    });
  }, []);

  // ── OPTIMISTIC: Delete seller (instant — no refetch) ──────────────────
  const handleDeleteSeller = useCallback(async (sellerId) => {
    let snapshot;
    // ① Remove instantly
    setSellers(prev => {
      snapshot = prev.find(s => s._id === sellerId);
      return prev.filter(s => s._id !== sellerId);
    });
    setTotalItems(prev => prev - 1);
    try {
      await sellerApi.delete(sellerId);
      toastRef.current('Seller deleted.', 'success');
    } catch (error) {
      console.error('Failed to delete seller:', error);
      // ② Rollback
      if (snapshot) setSellers(prev => [snapshot, ...prev]);
      setTotalItems(prev => prev + 1);
      toastRef.current('Failed to delete: ' + error.message, 'error');
    }
  }, []);

  // ── OPTIMISTIC: Add / Edit seller ─────────────────────────────────────
  const handleAddSeller = useCallback(async (sellerData) => {
    try {
      if (editingSeller) {
        // ① Patch locally right away
        setSellers(prev => prev.map(s =>
          s._id === editingSeller._id ? { ...s, ...sellerData, _saving: true } : s
        ));
        await sellerApi.update(editingSeller._id, sellerData);
        // ② Confirm
        setSellers(prev => prev.map(s =>
          s._id === editingSeller._id ? { ...s, _saving: false } : s
        ));
        toastRef.current('Seller updated.', 'success');
      } else {
        // For creates: call API, then prepend returned record
        const res = await sellerApi.create(sellerData);
        const newSeller = res?.data || res?.seller || { ...sellerData, _id: `tmp_${Date.now()}` };
        setSellers(prev => [newSeller, ...prev]);
        setTotalItems(prev => prev + 1);
        toastRef.current('Seller added.', 'success');
      }
      setShowAddModal(false);
      setEditingSeller(null);
    } catch (error) {
      console.error('Failed to save seller:', error);
      if (editingSeller) {
        void loadSellers({ page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch, silent: true });
      }
      toastRef.current('Failed to save: ' + error.message, 'error');
    }
  }, [editingSeller, page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, debouncedSearch, loadSellers]);

  const handleEditSeller = useCallback((seller) => {
    setEditingSeller(seller);
    setShowAddModal(true);
  }, []);

  // ── Import sellers (batch add to local state) ─────────────────────────
  const handleImportSellers = useCallback(async (sellersData) => {
    try {
      const response = await sellerApi.import(sellersData);
      if (response.success) {
        toastRef.current(`${sellersData.length} storefronts onboarded.`, 'success');
        // Silent refresh to get server-assigned IDs
        void loadSellers({ page: 1, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch, silent: true });
        setShowImportModal(false);
        return true;
      }
    } catch (error) {
      console.error('Failed to import sellers:', error);
      toastRef.current(error.message || 'Check CSV format and try again.', 'error');
    }
    return false;
  }, [limit, activeTab, marketplaceFilter, managerFilter, statusFilter, debouncedSearch, loadSellers]);

  // ── ASIN management ────────────────────────────────────────────────────
  const handleViewAsins = useCallback(async (seller, pageNum = 1) => {
    setSelectedSeller(seller);
    setShowAsinModal(true);
    setLoadingAsins(true);
    if (pageNum === 1) setSellerAsins([]);
    try {
      const result = await asinApi.getBySeller(seller._id || seller.id, { page: pageNum, limit: 50 });
      if (pageNum === 1) setSellerAsins(result.asins || []);
      else setSellerAsins(prev => [...prev, ...(result.asins || [])]);
      setAsinPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      console.error('Failed to load ASINs:', err);
      if (pageNum === 1) setSellerAsins([]);
    } finally {
      setLoadingAsins(false);
    }
  }, []);

  const handleLoadMoreAsins = useCallback(() => {
    if (asinPagination.page < asinPagination.totalPages && !loadingAsins && selectedSeller) {
      void handleViewAsins(selectedSeller, asinPagination.page + 1);
    }
  }, [asinPagination, loadingAsins, selectedSeller, handleViewAsins]);

  // ASIN mutations — patch seller's asin count locally, no full reload
  const refreshAsinList = useCallback(async (sellerId) => {
    try {
      const result = await asinApi.getBySeller(sellerId, { page: 1, limit: 50 });
      setSellerAsins(result.asins || []);
      setAsinPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
      setSellers(prev => prev.map(s =>
        s._id === sellerId ? { ...s, totalAsins: result.pagination?.total ?? s.totalAsins } : s
      ));
    } catch (err) {
      console.error('Failed to refresh ASINs:', err);
    }
  }, []);

  const handleAddAsin = useCallback(async (asinData) => {
    if (!selectedSeller) return;
    try {
      await asinApi.create({ ...asinData, seller: selectedSeller._id, status: 'Active' });
      toastRef.current(`Added ${asinData.asinCode}.`, 'success');
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to add ASIN:', error);
      toastRef.current(error.message || 'Failed to add ASIN', 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleDeleteAsin = useCallback(async (asinId) => {
    if (!selectedSeller) return;
    try {
      await asinApi.delete(asinId);
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to delete ASIN:', error);
      toastRef.current('Failed to delete ASIN: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleToggleAsinStatus = useCallback(async (asinId, currentStatus) => {
    if (!selectedSeller) return;
    try {
      await asinApi.update(asinId, { status: currentStatus === 'Active' ? 'Paused' : 'Active' });
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to toggle ASIN status:', error);
      toastRef.current('Failed to toggle ASIN status: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleUpdateAsin = useCallback(async (asinId, data) => {
    if (!selectedSeller) return;
    try {
      await asinApi.update(asinId, data);
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to update ASIN:', error);
      toastRef.current('Failed to update ASIN: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleSyncAsin = useCallback(async (asinId) => {
    try {
      await marketSyncApi.syncAsin(asinId);
      toastRef.current('ASIN sync triggered!', 'success');
    } catch (error) {
      console.error('Failed to sync ASIN:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — retry after ${error.response.headers?.['retry-after'] || 60}s`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — sync service may be down');
      }
      toastRef.current(error.message, 'error');
    }
  }, []);

  // ── Row-level sync (no global loading flash) ──────────────────────────
  const handleSyncSeller = useCallback(async (sellerId) => {
    setSyncingIds(prev => new Set(prev).add(sellerId));
    try {
      const res = await marketSyncApi.syncSellerAsins(sellerId, false);
      if (res.success) toastRef.current(res.message || 'Sync triggered!', 'success');
      else toastRef.current(res.error || res.hint || 'Sync failed', 'error');
    } catch (error) {
      console.error('Failed to sync seller:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — retry after ${error.response.headers?.['retry-after'] || 60}s`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — sync worker may be overloaded');
      }
      const msg = error.message || 'Sync failed';
      const hint = msg.includes('No sync method') ? 'Use Bulk Import for catalog data or configure Live Sync' : '';
      toastRef.current(hint ? `${msg}\n${hint}` : msg, 'error');
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
    }
  }, []);

  // ── Live Sync (PA-API) trigger ─────────────────────────────────────────
  const handleLiveSync = useCallback(async (sellerId) => {
    setLiveSyncingIds(prev => new Set(prev).add(sellerId));
    setLiveSyncStatuses(prev => ({ ...prev, [sellerId]: { status: 'STARTING' } }));
    try {
      const res = await marketSyncApi.triggerLiveSync(sellerId);
      if (res.success) {
        if (res.status === 'IN_PROGRESS') {
          toastRef.current('Live sync already running. Showing progress...', 'info');
        } else {
          toastRef.current('Live sync started. Updates will appear within minutes.', 'success');
        }
        setLiveSyncStatuses(prev => ({ ...prev, [sellerId]: { status: 'RUNNING', progress: res.progress || null } }));
      } else {
        toastRef.current(res.error || 'Failed to start live sync', 'error');
        setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
        setLiveSyncStatuses(prev => ({ ...prev, [sellerId]: { status: 'ERROR', error: res.error } }));
      }
    } catch (error) {
      console.error('Failed to start live sync:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — too many live sync requests`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — PA-API service may be down');
      }
      toastRef.current(error.message, 'error');
      setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
      setLiveSyncStatuses(prev => ({ ...prev, [sellerId]: { status: 'ERROR', error: error.message } }));
    }
  }, []);

  // ── Live Sync status polling (stable interval using refs) ──────────────
  const liveSyncingIdsRef = useRef(liveSyncingIds);
  liveSyncingIdsRef.current = liveSyncingIds;

  useEffect(() => {
    const interval = setInterval(async () => {
      const currentIds = liveSyncingIdsRef.current;
      if (currentIds.size === 0) return;

      for (const sellerId of currentIds) {
        try {
          const status = await marketSyncApi.getSellerSyncStatus(sellerId);
          const syncStatus = status.liveSync?.status;

          if (syncStatus === 'RUNNING') {
            setLiveSyncStatuses(prev => ({
              ...prev,
              [sellerId]: {
                status: 'RUNNING',
                progress: status.liveSync.progress
              }
            }));
          } else if (syncStatus === 'FAILED') {
            // Sync failed
            setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
            setLiveSyncStatuses(prev => ({
              ...prev,
              [sellerId]: {
                status: 'ERROR',
                error: status.liveSync.error || 'Sync failed',
                lastRun: status.liveSync.lastRun
              }
            }));
            toastRef.current(`Live sync failed: ${status.liveSync.error || 'Unknown error'}`, 'error');
          } else {
            // Sync finished (IDLE or COMPLETED)
            setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
            setLiveSyncStatuses(prev => ({
              ...prev,
              [sellerId]: {
                status: 'COMPLETE',
                lastResult: status.liveSync.lastResult,
                lastRun: status.liveSync.lastRun
              }
            }));
            if (status.liveSync.lastResult) {
              const r = status.liveSync.lastResult;
              toastRef.current(`Live sync complete: ${r.success}/${r.totalAsins} ASINs updated in ${(r.duration / 1000).toFixed(1)}s`, 'success');
            } else {
              toastRef.current('Live sync complete.', 'success');
            }
            // Refresh seller list to show updated metrics
            void loadSellersRef.current({ ...filterStateRef.current, silent: true });
          }
        } catch (e) {
          console.error('Live sync poll error:', e);
        }
      }
    }, 8000); // Poll every 8 seconds
    return () => clearInterval(interval);
  }, []); // Empty deps - interval runs forever, reads from ref

  const handleCatalogSync = useCallback((seller) => {
    const isAjio = seller.marketplace?.toLowerCase() === 'ajio';
    setBulkImportConfig({ sellerId: seller._id, tab: isAjio ? 'ajio_catalog' : 'catalog' });
    setShowBulkImportModal(true);
  }, []);

  // ── Bulk sync ──────────────────────────────────────────────────────────
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const handleBulkSync = useCallback(async () => {
    if (!selectedSellerIds.length) return;
    setBulkSyncing(true);
    let ok = 0, fail = 0;
    try {
      await Promise.all(selectedSellerIds.map(async (id) => {
        try { await marketSyncApi.syncSellerAsins(id, false); ok++; }
        catch (e) { console.error(`Sync failed for seller ${id}:`, e); fail++; }
      }));
      toastRef.current(`Synced ${ok}${fail ? `, ${fail} failed` : ''}`, fail ? 'warning' : 'success');
      setSelectedSellerIds([]);
    } catch (err) {
      console.error('Bulk sync failed:', err);
      toastRef.current(err.message, 'error');
    } finally {
      setBulkSyncing(false);
    }
  }, [selectedSellerIds]);

  // ── Global Live Sync All ──────────────────────────────────────────────
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [globalSyncProgress, setGlobalSyncProgress] = useState(null);
  const globalSyncPollRef = useRef(null);

  // ── Restart All Octoparse Tasks ─────────────────────────────────────────
  const handleRestartOctoparse = useCallback(async () => {
    if (!window.confirm('This will STOP all running Octoparse tasks, clear all locks, and restart fresh scraping for every active seller. Continue?')) return;
    try {
      setGlobalSyncing(true);
      toastRef.current('Restarting all Octoparse tasks...', 'info');
      const res = await marketSyncApi.restartAllOctoparse();
      if (res.success) {
        toastRef.current(res.message, 'success');
        void loadSellers({ page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch, silent: true });
      } else {
        toastRef.current(res.error || 'Restart failed', 'error');
      }
    } catch (error) {
      console.error('Failed to restart Octoparse:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — too many restart requests`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — Octoparse service unreachable');
      }
      toastRef.current(error.message || 'Restart failed', 'error');
    } finally {
      setGlobalSyncing(false);
    }
  }, [page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, debouncedSearch, loadSellers]);

  const handleGlobalLiveSync = useCallback(async () => {
    setGlobalSyncing(true);
    setGlobalSyncProgress({ status: 'STARTING', sellers: 0, asins: 0 });
    try {
      const res = await marketSyncApi.triggerLiveSyncAll();
      if (res.success) {
        toastRef.current('Global live sync started for all brands', 'success');
        // Start polling for status
        if (globalSyncPollRef.current) clearInterval(globalSyncPollRef.current);
        globalSyncPollRef.current = setInterval(async () => {
          try {
            const status = await marketSyncApi.getLiveSyncAllStatus();
            setGlobalSyncProgress({
              status: status.isRunning ? 'RUNNING' : 'COMPLETE',
              activeSyncs: status.activeSyncs || 0,
              syncs: status.syncs || []
            });
            if (!status.isRunning && status.activeSyncs === 0) {
              clearInterval(globalSyncPollRef.current);
              setGlobalSyncing(false);
              toastRef.current('Global live sync completed!', 'success');
              void loadSellersRef.current({ ...filterStateRef.current, silent: true });
            }
          } catch (e) {
            console.error('Global sync poll error:', e);
          }
        }, 10000);
      } else {
        toastRef.current(res.error || 'Failed to start global sync', 'error');
        setGlobalSyncing(false);
      }
    } catch (error) {
      console.error('Failed to start global live sync:', error);
      toastRef.current(error.message, 'error');
      setGlobalSyncing(false);
    }
  }, [page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, debouncedSearch]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (globalSyncPollRef.current) clearInterval(globalSyncPollRef.current);
    };
  }, []);

  const handleIngestAll = useCallback(async () => {
    setLoading(true);
    try {
      await marketSyncApi.ingestAllResults();
      toastRef.current('Global ingestion started.', 'info');
    } catch (error) {
      console.error('Failed to start ingestion:', error);
      toastRef.current(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Badges ─────────────────────────────────────────────────────────────
  const getMarketplaceBadge = useCallback((marketplace) => {
    const m = marketplace?.toLowerCase();
    const configs = {
      'amazon.in': { label: 'AMZ', color: '#FF6200', bg: '#FFFFFF' },
      'ajio': { label: 'AJIO', color: '#2C2C2C', bg: '#FAF5E8' },
      'myntra': { label: 'MYNTRA', color: '#FF356E', bg: '#FFFFFF' },
    };
    const cfg = configs[m] || { label: (m || '??').toUpperCase().slice(0, 4), color: 'var(--text-secondary, #64748b)', bg: 'var(--bg-secondary, #f8fafc)' };
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.05em',
        width: 'auto', height: 18, borderRadius: "var(--radius-sm)",
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}30`,
        padding: '0 8px',
      }}>
        {cfg.label}
      </span>
    );
  }, []);

  const getStatusBadge = useCallback((status) => (
    <Tag color={status === 'Active' ? 'green' : 'default'} style={{
      fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-md, 8px)', padding: '0 8px', lineHeight: '18px'
    }}>
      {status?.toUpperCase() || 'UNKNOWN'}
    </Tag>
  ), []);

  // ── Row actions ────────────────────────────────────────────────────────
  const renderActions = useCallback((seller) => {
    const isActive = seller.status === 'Active';
    const isSyncing = syncingIds.has(seller._id);

    if (isBrandManager) {
      return (
        <Space size={4}>
          <Tooltip title="View ASINs">
            <Button type="text" size="small" icon={<Package size={14} />}
              onClick={() => handleViewAsins(seller)} style={{ color: 'var(--text-secondary, #64748b)' }} />
          </Tooltip>
        </Space>
      );
    }

    return (
      <Space size={4}>
        {isGlobalUser && (
          <Tooltip title="Edit Details">
            <Button type="text" size="small" icon={<Edit3 size={14} />}
              onClick={() => handleEditSeller(seller)} style={{ color: 'var(--text-muted, #94a3b8)' }} />
          </Tooltip>
        )}
        <Tooltip title="Manage Catalog">
          <Button type="text" size="small" icon={<Package size={14} />}
            onClick={() => handleViewAsins(seller)} style={{ color: 'var(--text-muted, #94a3b8)' }} />
        </Tooltip>
        <Tooltip title="Catalog Sync">
          <Button type="text" size="small" icon={<FileUp size={14} />}
            onClick={() => handleCatalogSync(seller)} style={{ color: 'var(--text-muted, #94a3b8)' }} />
        </Tooltip>
        <Tooltip title="Sync Store">
          <Button type="text" size="small"
            icon={<RefreshCw size={14} className={isSyncing ? styles.spin : ''} />}
            loading={isSyncing}
            onClick={() => handleSyncSeller(seller._id)}
            style={{ color: 'var(--text-muted, #94a3b8)' }} />
        </Tooltip>
        {seller.marketplace?.toLowerCase() === 'amazon.in' && (() => {
          const lsStatus = liveSyncStatuses[seller._id];
          const isLiveSyncing = liveSyncingIds.has(seller._id);
          const progressText = isLiveSyncing && lsStatus?.progress
            ? `${lsStatus.progress.processed}/${lsStatus.progress.total}`
            : null;
          return (
            <Tooltip title={isLiveSyncing ? `Live Sync Running${progressText ? ` (${progressText})` : '...'}` : 'Live Sync'}>
              <Button
                size="small"
                icon={<Zap size={13} />}
                loading={isLiveSyncing}
                onClick={() => handleLiveSync(seller._id)}
                disabled={isLiveSyncing}
                style={{
                  borderRadius: 'var(--radius-md, 8px)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  background: isLiveSyncing ? '#90CAF9' : 'linear-gradient(135deg, var(--text-brand-dark, #1565C0), var(--text-brand, #1976D2))',
                  borderColor: isLiveSyncing ? '#90CAF9' : 'var(--text-brand-dark, #1565C0)',
                  color: isLiveSyncing ? 'var(--text-brand-dark, #1565C0)' : '#fff',
                  boxShadow: isLiveSyncing ? 'none' : '0 1px 3px rgba(25,118,210,0.3)',
                  height: 26,
                  padding: '0 8px',
                }}
              >
                {isLiveSyncing ? (progressText || 'Syncing') : 'Live'}
              </Button>
            </Tooltip>
          );
        })()}
        {isGlobalUser && (
          <Tooltip title={seller.isPriority ? 'Remove High Priority' : 'Set as High Priority'}>
            <Button
              type="text" size="small"
              icon={<Star size={14} fill={seller.isPriority ? "var(--text-warning, #ED6C02)" : "none"} stroke={seller.isPriority ? "var(--text-warning, #ED6C02)" : "var(--text-secondary, #64748b)"} />}
              onClick={() => handleTogglePriority(seller._id)}
              loading={seller._savingPriority}
            />
          </Tooltip>
        )}
        <Tooltip title={isActive ? 'Pause Store' : 'Resume Store'}>
          <Button
            type={isActive ? 'text' : 'primary'} size="small"
            icon={isActive ? <Pause size={14} /> : <Play size={14} />}
            onClick={() => handleToggleStatus(seller._id)}
            loading={seller._saving}
            style={{
              borderRadius: 'var(--radius-md, 8px)',
              ...(isActive
                ? { color: 'var(--text-secondary, #64748b)' }
                : { background: 'var(--text-success, #2E7D32)', borderColor: 'var(--text-success, #2E7D32)', color: '#fff' })
            }}
          />
        </Tooltip>
        {hasPermission(PERMISSIONS.SELLER_DELETE) && (
          <Popconfirm
            title="Delete this seller?"
            description="All ASINs will also be permanently deleted."
            onConfirm={() => handleDeleteSeller(seller._id)}
            okText="Delete" cancelText="Cancel"
            okButtonProps={{ danger: true }} placement="left"
          >
            <Tooltip title="Delete Store">
              <Button type="text" size="small" danger
                icon={<Trash2 size={14} />} style={{ color: 'var(--text-danger, #D32F2F)' }} />
            </Tooltip>
          </Popconfirm>
        )}
      </Space>
    );
  }, [
    isBrandManager, isGlobalUser, syncingIds, liveSyncingIds, liveSyncStatuses,
    handleEditSeller, handleViewAsins, handleCatalogSync,
    handleSyncSeller, handleLiveSync, handleToggleStatus, handleTogglePriority, handleDeleteSeller, hasPermission
  ]);

  // ── Table columns ──────────────────────────────────────────────────────
  const staticColumns = useMemo(() => [
    {
      title: 'STORE DETAILS', dataIndex: 'name', key: 'name', width: 320,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (_, seller) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "var(--radius-md)", flexShrink: 0,
            background: getMarketplaceColor(seller.marketplace).gradient,
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: 'var(--font-size-xs)'
          }}>
            {seller.name?.slice(0, 3).toUpperCase() || 'SEL'}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary, #0f172a)' }}>{seller.name}</Text>
              {seller.isPriority && <Star size={12} fill="var(--text-warning, #ED6C02)" stroke="var(--text-warning, #ED6C02)" style={{ marginTop: '-2px' }} />}
            </div>
            {seller.email && canViewEmail && (
              <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', display: 'block', marginTop: 1, lineHeight: 1.3 }}>
                {seller.email}
              </Text>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {getMarketplaceBadge(seller.marketplace)}
              {seller.sellerId && (
                <Text style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', background: 'var(--bg-secondary, #f8fafc)', padding: '1px 4px', borderRadius: "var(--radius-sm)", color: 'var(--text-muted, #94a3b8)' }}>
                  {seller.sellerId}
                </Text>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'ACCOUNT MANAGER', dataIndex: 'managers', key: 'managers', width: 220,
      render: (managers) => {
        if (!managers?.length) return <Text type="secondary" italic style={{ fontSize: 'var(--font-size-xs)' }}>Unassigned</Text>;
        return (
          <Space wrap size={2}>
            {managers.map((m) => (
              <span key={m._id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--bg-secondary, #f8fafc)', padding: '2px 6px', borderRadius: "var(--radius-lg)", border: '1px solid var(--border-light, #d9e6e9)'
              }}>
                <Avatar size={18} style={{ backgroundColor: '#D1D5DB', color: 'var(--text-primary, #0f172a)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  {m.firstName?.charAt(0)}{m.lastName?.charAt(0)}
                </Avatar>
                <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary, #0f172a)' }}>{m.firstName} {m.lastName}</Text>
              </span>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'INVENTORY', dataIndex: 'totalAsins', key: 'totalAsins', width: 140,
      render: (total, seller) => (
        <Button type="link" onClick={() => handleViewAsins(seller)}
          style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary, #0f172a)', height: 'auto' }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 8px)', backgroundColor: 'var(--bg-secondary, #f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={14} color="var(--text-muted, #94a3b8)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
            <Text strong style={{ fontSize: 'var(--font-size-xs)' }}>{total || 0} ASINs</Text>
            <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)' }}>
              Click to manage
            </Text>
          </div>
        </Button>
      )
    },
    {
      title: 'LAST ACTIVITY', dataIndex: 'lastScraped', key: 'lastScraped', width: 150,
      render: (lastScraped) => (
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} style={{ color: 'var(--text-muted, #94a3b8)' }} />
            {formatTimeAgo(lastScraped)}
          </div>
          {lastScraped && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', paddingLeft: 15 }}>
              {new Date(lastScraped).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status', align: 'center', width: 100,
      render: (status) => getStatusBadge(status)
    },
  ], [getMarketplaceBadge, getStatusBadge, handleViewAsins]);

  const actionColumn = useMemo(() => ({
    title: 'ACTIONS', key: 'actions', fixed: 'right', width: 180, align: 'right',
    render: (_, seller) => renderActions(seller)
  }), [renderActions]);

  const columns = useMemo(() => [...staticColumns, actionColumn], [staticColumns, actionColumn]);

  const rowSelection = useMemo(() => ({
    selectedRowKeys: selectedSellerIds,
    onChange: (keys) => setSelectedSellerIds(keys),
    getCheckboxProps: (record) => ({ name: record.name }),
  }), [selectedSellerIds]);

  if (loading && sellers.length === 0) {
    return <Spinner />;
  }

  if (error && !loading && sellers.length === 0) {
    return <LoadError message={error} onRetry={() => { setError(null); setLoading(true); loadSellers(); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* ── Row 1: Page Header ───────────────────────────────────── */}
      <SellerPageHeader
        totalItems={totalItems}
        onOpenAddStore={() => setShowAddModal(true)}
        onOpenCsvImport={() => setShowImportModal(true)}
        globalSyncing={globalSyncing}
        handleGlobalLiveSync={handleGlobalLiveSync}
        onRestartOctoparse={handleRestartOctoparse}
        isBrandManager={isBrandManager}
      />

      {/* ── Row 2: Stats Strip ────────────────────────────────────── */}
      <SellerStatsStrip
        dbStats={dbStats}
        statsLoading={statsLoading}
        onStatClick={(type, value) => {
          if (type === 'status') {
            setActiveTab(value);
            setStatusFilter('all');
          }
        }}
      />

      {/* ── Row 3: Toolbar ────────────────────────────────────────── */}
      <SellerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        marketplaceFilter={marketplaceFilter}
        onMarketplaceChange={setMarketplaceFilter}
        managerFilter={managerFilter}
        onManagerChange={setManagerFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        canAccessAmazon={canAccessAmazon}
        canAccessAjio={canAccessAjio}
        canAccessMyntra={canAccessMyntra}
        managersList={managersList}
        onRefresh={() => loadSellers({ page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch })}
        loading={loading}
        isBrandManager={isBrandManager}
        isGlobalUser={isGlobalUser}
        poolStats={poolStats}
        onOpenPool={() => setShowPoolModal(true)}
        onOpenBulkImport={() => { setBulkImportConfig({ sellerId: '', tab: 'catalog' }); setShowBulkImportModal(true); }}
        onIngestAll={handleIngestAll}
        sellersLength={sellers.length}
        totalItems={totalItems}
        onReset={() => { setActiveTab('all'); setMarketplaceFilter('all'); setManagerFilter('all'); setStatusFilter('all'); setSearchQuery(''); }}
        hasActiveFilters={activeTab !== 'all' || marketplaceFilter !== 'all' || managerFilter !== 'all' || searchQuery}
      />

      {/* ── Global Live Sync Progress ──────────────────────────────── */}
      {globalSyncing && globalSyncProgress && (
        <div style={{
          padding: '10px 24px',
          background: 'linear-gradient(135deg, #FFEBEE, #EF9A9A)',
          borderBottom: '1px solid #EF9A9A',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <Zap size={14} className={styles.spin} style={{ color: 'var(--text-danger, #D32F2F)' }} />
          <Text style={{ color: 'var(--text-danger, #D32F2F)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
            Global Live Sync Running
          </Text>
          {globalSyncProgress.activeSyncs > 0 && (
            <Tag color="red">{globalSyncProgress.activeSyncs} sellers syncing</Tag>
          )}
          <Text style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-xs)' }}>
            Updates appear within minutes. You can continue using the app.
          </Text>
        </div>
      )}

      {/* ── Bulk action bar ───────────────────────────────────────── */}
      {selectedSellerIds.length > 0 && (
        <div className={styles.slideDown} style={{
          padding: '8px 24px', background: 'var(--text-primary, #0f172a)', color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Text strong style={{ color: '#fff', fontSize: 'var(--font-size-xs)' }}>
            <Badge count={selectedSellerIds.length} style={{ backgroundColor: 'var(--text-danger, #D32F2F)', border: 'none', fontWeight: 700 }} /> Storefronts Selected
          </Text>
          <Space size={8}>
            <Popconfirm
              title={`Sync ${selectedSellerIds.length} seller(s)?`}
              description="This triggers scraping for all ASINs under these sellers."
              onConfirm={handleBulkSync}
              okText="Sync" cancelText="Cancel"
            >
              <Button size="small" type="primary" icon={<RefreshCw size={12} />}
                loading={bulkSyncing}
                style={{ borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, background: 'var(--text-danger, #D32F2F)', borderColor: 'var(--text-danger, #D32F2F)' }}>
                Sync Selected
              </Button>
            </Popconfirm>
            <Button size="small" type="text" onClick={() => setSelectedSellerIds([])}
              style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-xs)' }}>
              Clear
            </Button>
          </Space>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', flex: 1, background: 'var(--bg-secondary, #f8fafc)' }}>
        <Card styles={{ body: { padding: 0 } }}
          style={{ borderRadius: "var(--radius-lg)", border: '1px solid var(--border-light, #d9e6e9)', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <Table
            columns={columns}
            dataSource={sellers}
            rowKey="_id"
            loading={loading}
            rowSelection={rowSelection}
            size="middle"
            className={styles.premiumSellerTable}
            pagination={{
              current: page,
              pageSize: limit,
              total: totalItems,
              showSizeChanger: true,
              pageSizeOptions: ['25', '50', '100'],
              onChange: (p, ps) => { setPage(p); setLimit(ps); },
              showTotal: (total, range) => (
                <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', paddingLeft: 16 }}>
                  Viewing {range[0]}-{range[1]} of {total} stores
                </Text>
              ),
            }}
            scroll={{ x: 1120 }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ fontWeight: 600, color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-sm)' }}>No storefront entries match your current query.</span>}
                />
              )
            }}
          />
        </Card>
      </div>

      <Suspense fallback={null}>
        {showAddModal && (
          <AddSellerModal
            onClose={() => { setShowAddModal(false); setEditingSeller(null); }}
            onSave={handleAddSeller}
            isAdmin={isAdmin}
            isGlobalUser={isGlobalUser}
            initialData={editingSeller}
          />
        )}
        {showImportModal && (
          <ImportSellerModal onClose={() => setShowImportModal(false)} onImport={handleImportSellers} />
        )}
        {showAsinModal && selectedSeller && (
          <SellerAsinsModal
            seller={selectedSeller}
            asins={sellerAsins}
            onClose={() => { setShowAsinModal(false); setSelectedSeller(null); }}
            onAddAsin={handleAddAsin}
            onDeleteAsin={handleDeleteAsin}
            onToggleStatus={handleToggleAsinStatus}
            onUpdateAsin={handleUpdateAsin}
            onSyncAsin={handleSyncAsin}
            isAdmin={isAdmin}
            isGlobalUser={isGlobalUser}
            onRefresh={() => handleViewAsins(selectedSeller, 1)}
            pagination={asinPagination}
            onLoadMore={handleLoadMoreAsins}
            loading={loadingAsins}
          />
        )}
        {showPoolModal && (
          <PoolManagementModal stats={poolStats} onClose={() => setShowPoolModal(false)} onRefresh={fetchPoolStats} />
        )}
        <BulkImportModal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onComplete={() => loadSellers({ page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch, silent: true })}
          initialSellerId={bulkImportConfig.sellerId}
          initialTab={bulkImportConfig.tab}
        />
      </Suspense>
    </div>
  );
};

export default React.memo(SellersPage);