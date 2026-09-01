import { Spinner } from "@/components/Spinner";

import React, {
  useState, useEffect, useMemo, useCallback,
  useRef, Suspense, lazy
} from 'react';
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
import { useSellersData } from '../hooks/sellers/useSellersData';
import { useSellerFilters } from '../hooks/sellers/useSellerFilters';
import { useSellerStats } from '../hooks/sellers/useSellerStats';
import { useSellerMutations } from '../hooks/sellers/useSellerMutations';
import { useSellerSync } from '../hooks/sellers/useSellerSync';

const AddSellerModal = lazy(() => import('../components/sellers/AddSellerModal'));
const ImportSellerModal = lazy(() => import('../components/sellers/ImportSellerModal'));
const SellerAsinsModal = lazy(() => import('../components/sellers/SellerAsinsModal'));
const PoolManagementModal = lazy(() => import('../components/sellers/PoolManagementModal'));
const BulkImportModal = lazy(() => import('../components/asins/BulkImportModal'));

const { Text } = Typography;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// Marketplace-based avatar colors — all sellers of same marketplace get same color
const MARKETPLACE_COLORS = {
  'amazon.in': { gradient: 'linear-gradient(135deg, var(--text-brand-dark, var(--bc-ro-600)), var(--text-brand, var(--bc-ro-500)))', color: 'var(--text-brand, var(--bc-ro-500))', bg: 'var(--bc-ro-50)' },
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

  const roleName = (currentUser?.role?.name || '').toString().toLowerCase();
  const userId = currentUser?._id || currentUser?.id;

  // ── Data state (via useSellersData) ────────────────────────────────────
  const {
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
  } = useSellersData({ addToast });

  // ── Filter state (via useSellerFilters) ────────────────────────────────
  const {
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
  } = useSellerFilters();

  // ── Stats (via useSellerStats) ─────────────────────────────────────────
  const { dbStats, statsLoading, refetch: refetchStats } = useSellerStats({
    roleName,
    userId,
    assignedManagersIds: undefined,
    activeTab,
    marketplaceFilter,
    managerFilter,
    statusFilter,
    debouncedSearch,
  });

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
  const [managersList, setManagersList] = useState([]);

  useEffect(() => {
    setPageMeta({
      title: 'Seller Management',
      subtitle: `Manage ${totalItems} storefronts`,
      breadcrumbs: [{ label: 'Global' }, { label: 'Sellers' }],
    });
  }, [setPageMeta, totalItems]);

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

  // Always-current filter state for socket handlers and intervals
  const filterParams = useMemo(() => ({
    page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, search: debouncedSearch,
  }), [page, limit, activeTab, marketplaceFilter, managerFilter, statusFilter, debouncedSearch]);

  const filterParamsRef = useRef(filterParams);
  useEffect(() => { filterParamsRef.current = filterParams; });

  // ── Mutations (via useSellerMutations) ─────────────────────────────────
  const {
    toggleStatus,
    togglePriority,
    deleteSeller,
    addSeller,
    importSellers,
    updateSeller,
  } = useSellerMutations({
    sellers,
    setSellers,
    setTotalItems: undefined, // totalItems is owned by useSellersData; we don't expose setTotalItems
    addToast,
    loadSellers,
    filterParams,
  });

  // ── Sync (via useSellerSync) ───────────────────────────────────────────
  const {
    syncingSellerIds,
    liveSyncingIds,
    syncStatus,
    bulkSyncing,
    globalSyncing,
    globalSyncStatus,
    syncSeller,
    liveSync,
    bulkSync,
    globalLiveSync,
    restartOctoparse,
    ingestAll,
  } = useSellerSync({
    roleName,
    userId,
    isGlobalUser,
    loadSellers,
    refetchStats,
    selectedSellerIds,
    setSelectedSellerIds,
    setLoading: setLoading,
    filterParams,
    addToast,
  });

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
      void loadSellersRef.current({ ...filterParamsRef.current, silent: true });
    };
    socket.on('SELLERS_UPDATED', handleSellersUpdated);
    return () => socket.off('SELLERS_UPDATED', handleSellersUpdated);
  }, [socket]);

  // Listen for live sync ASIN updates
  useEffect(() => {
    if (!socket) return;
    const handleAsinsUpdated = () => {
      void loadSellersRef.current({ ...filterParamsRef.current, silent: true });
    };
    const handleLiveSyncCompleted = (data) => {
      if (addToast) addToast(`Live sync complete: ${data.updatedAsins} ASINs updated in ${(data.duration / 1000).toFixed(1)}s`, 'success');
    };
    const handleLiveSyncAllCompleted = (data) => {
      if (addToast) addToast(`Global sync complete: ${data.success} sellers, ${data.totalAsinsUpdated} ASINs in ${(data.duration / 1000).toFixed(1)}s`, 'success');
      // globalSyncing is owned by useSellerSync; the hook's polling will clear it
    };
    socket.on('ASINS_UPDATED', handleAsinsUpdated);
    socket.on('liveSync:completed', handleLiveSyncCompleted);
    socket.on('liveSyncAll:completed', handleLiveSyncAllCompleted);
    return () => {
      socket.off('ASINS_UPDATED', handleAsinsUpdated);
      socket.off('liveSync:completed', handleLiveSyncCompleted);
      socket.off('liveSyncAll:completed', handleLiveSyncAllCompleted);
    };
  }, [socket, addToast]);

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

  // ── Wrapper: handleAddSeller (splits into addSeller / updateSeller) ────
  const handleAddSeller = useCallback(async (sellerData) => {
    try {
      if (editingSeller) {
        await updateSeller(editingSeller._id, sellerData);
      } else {
        await addSeller(sellerData);
      }
      setShowAddModal(false);
      setEditingSeller(null);
    } catch (error) {
      // Error already handled by the hook (toast shown)
    }
  }, [editingSeller, addSeller, updateSeller]);

  const handleEditSeller = useCallback((seller) => {
    setEditingSeller(seller);
    setShowAddModal(true);
  }, []);

  // ── Wrapper: handleImportSellers (closes modal on success) ─────────────
  const handleImportSellers = useCallback(async (sellersData) => {
    const result = await importSellers(sellersData);
    if (result) setShowImportModal(false);
    return result;
  }, [importSellers]);

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
  }, [setSellers]);

  const handleAddAsin = useCallback(async (asinData) => {
    if (!selectedSeller) return;
    try {
      await asinApi.create({ ...asinData, seller: selectedSeller._id, status: 'Active' });
      if (addToast) addToast(`Added ${asinData.asinCode}.`, 'success');
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to add ASIN:', error);
      if (addToast) addToast(error.message || 'Failed to add ASIN', 'error');
    }
  }, [selectedSeller, refreshAsinList, addToast]);

  const handleDeleteAsin = useCallback(async (asinId) => {
    if (!selectedSeller) return;
    try {
      await asinApi.delete(asinId);
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to delete ASIN:', error);
      if (addToast) addToast('Failed to delete ASIN: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList, addToast]);

  const handleToggleAsinStatus = useCallback(async (asinId, currentStatus) => {
    if (!selectedSeller) return;
    try {
      await asinApi.update(asinId, { status: currentStatus === 'Active' ? 'Paused' : 'Active' });
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to toggle ASIN status:', error);
      if (addToast) addToast('Failed to toggle ASIN status: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList, addToast]);

  const handleUpdateAsin = useCallback(async (asinId, data) => {
    if (!selectedSeller) return;
    try {
      await asinApi.update(asinId, data);
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      console.error('Failed to update ASIN:', error);
      if (addToast) addToast('Failed to update ASIN: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList, addToast]);

  const handleSyncAsin = useCallback(async (asinId) => {
    try {
      await marketSyncApi.syncAsin(asinId);
      if (addToast) addToast('ASIN sync triggered!', 'success');
    } catch (error) {
      console.error('Failed to sync ASIN:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — retry after ${error.response.headers?.['retry-after'] || 60}s`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — sync service may be down');
      }
      if (addToast) addToast(error.message, 'error');
    }
  }, [addToast]);

  const handleCatalogSync = useCallback((seller) => {
    const isAjio = seller.marketplace?.toLowerCase() === 'ajio';
    setBulkImportConfig({ sellerId: seller._id, tab: isAjio ? 'ajio_catalog' : 'catalog' });
    setShowBulkImportModal(true);
  }, []);

  // ── Badges ─────────────────────────────────────────────────────────────
  const getMarketplaceBadge = useCallback((marketplace) => {
    const m = marketplace?.toLowerCase();
    const configs = {
      'amazon.in': { label: 'AMZ', color: '#FF6200', bg: 'var(--bc-white)' },
      'ajio': { label: 'AJIO', color: '#2C2C2C', bg: '#FAF5E8' },
      'myntra': { label: 'MYNTRA', color: '#FF356E', bg: 'var(--bc-white)' },
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
    const isSyncing = syncingSellerIds.has(seller._id);

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
            icon={isSyncing ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 14 }} aria-hidden="true" /> : <RefreshCw size={14} />}
            loading={isSyncing}
            onClick={() => syncSeller(seller._id)}
            style={{ color: 'var(--text-muted, #94a3b8)' }} />
       </Tooltip>
        {seller.marketplace?.toLowerCase() === 'amazon.in' && (() => {
          const lsStatus = syncStatus[seller._id];
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
                onClick={() => liveSync(seller._id)}
                disabled={isLiveSyncing}
                style={{
                  borderRadius: 'var(--radius-md, 8px)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  background: isLiveSyncing ? 'var(--bc-ro-200)' : 'linear-gradient(135deg, var(--text-brand-dark, #1565C0), var(--text-brand, #1976D2))',
                  borderColor: isLiveSyncing ? 'var(--bc-ro-200)' : 'var(--text-brand-dark, #1565C0)',
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
              icon={<Star size={14} fill={seller.isPriority ? "var(--text-warning, #ED6C02)" : "none"} stroke={seller.isPriority ? "var(--text-warning, #ED6C02)" : "var(--text-secondary, var(--bc-slate-500))"} />}
              onClick={() => togglePriority(seller._id)}
              loading={seller._savingPriority}
            />
         </Tooltip>
        )}
        <Tooltip title={isActive ? 'Pause Store' : 'Resume Store'}>
          <Button
            type={isActive ? 'text' : 'primary'} size="small"
            icon={isActive ? <Pause size={14} /> : <Play size={14} />}
            onClick={() => toggleStatus(seller._id)}
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
            onConfirm={() => deleteSeller(seller._id)}
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
    isBrandManager, isGlobalUser, syncingSellerIds, liveSyncingIds, syncStatus,
    handleEditSeller, handleViewAsins, handleCatalogSync,
    syncSeller, liveSync, toggleStatus, togglePriority, deleteSeller, hasPermission
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
                <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary, #0f172a)' }}>{m.firstName} {m.lastName</Text>
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
            <Package size={14} color="var(--text-muted, var(--bc-slate-400))" />
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
        handleGlobalLiveSync={globalLiveSync}
        onRestartOctoparse={restartOctoparse}
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
        onIngestAll={ingestAll}
        sellersLength={sellers.length}
        totalItems={totalItems}
        onReset={resetFilters}
        hasActiveFilters={activeTab !== 'all' || marketplaceFilter !== 'all' || managerFilter !== 'all' || searchQuery}
      />

      {/* ── Global Live Sync Progress ──────────────────────────────── */}
      {globalSyncing && globalSyncStatus && (
        <div style={{
          padding: '10px 24px',
          background: 'linear-gradient(135deg, #FFEBEE, #EF9A9A)',
          borderBottom: '1px solid #EF9A9A',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 14, color: 'var(--text-danger, #D32F2F)' }} aria-hidden="true" />
          <Text style={{ color: 'var(--text-danger, #D32F2F)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
            Global Live Sync Running
         </Text>
          {globalSyncStatus.activeSyncs > 0 && (
            <Tag color="red">{globalSyncStatus.activeSyncs} sellers syncing</Tag>
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
              onConfirm={bulkSync}
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
                  description={<span style={{ fontWeight: 600, color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-sm)' }}>No storefront entries match your current query</span>}
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
