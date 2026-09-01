import { useState, useCallback, useRef, useEffect } from 'react';
import { marketSyncApi } from '../../services/api';

/**
 * useSellerSync — owns sync state + polling.
 *
 * Owns:
 *   - syncingSellerIds (Set)        — row-level sync in flight
 *   - liveSyncingIds (Set)          — live sync in flight (exposed for renderActions)
 *   - syncStatus[sellerId]          — per-seller live sync status
 *   - bulkSyncing (bool)            — bulk sync in flight
 *   - globalSyncing (bool)          — global sync in flight
 *   - globalSyncStatus (object)     — global sync progress
 *
 * Handles:
 *   - 8s polling for live-sync status
 *   - manual sync per row (syncSeller)
 *   - bulk sync (bulkSync)
 *   - global live sync (globalLiveSync)
 *   - restart octoparse (restartOctoparse)
 *   - ingest-all (ingestAll)
 *
 * Takes { roleName, userId, isGlobalUser, loadSellers, refetchStats,
 *         selectedSellerIds, setSelectedSellerIds, setLoading,
 *         filterParams }.
 */
export function useSellerSync({
  roleName,
  userId,
  isGlobalUser,
  loadSellers,
  refetchStats,
  selectedSellerIds,
  setSelectedSellerIds,
  setLoading,
  filterParams,
  addToast,
}) {
  // Stable toast ref — mirrors the original toastRef pattern in SellersPage
  const toastRef = useRef(addToast);
  useEffect(() => { toastRef.current = addToast; }, [addToast]);

  const [syncingSellerIds, setSyncingSellerIds] = useState(new Set());
  const [liveSyncingIds, setLiveSyncingIds] = useState(new Set());
  const [syncStatus, setSyncStatus] = useState({});
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [globalSyncStatus, setGlobalSyncStatus] = useState(null);

  // Refs for the polling interval (stable interval, reads from refs)
  const liveSyncingIdsRef = useRef(liveSyncingIds);
  liveSyncingIdsRef.current = liveSyncingIds;

  const filterParamsRef = useRef(filterParams);
  filterParamsRef.current = filterParams;

  const globalSyncPollRef = useRef(null);

  // ── Row-level sync (no global loading flash) ──────────────────────────
  const syncSeller = useCallback(async (sellerId) => {
    setSyncingSellerIds(prev => new Set(prev).add(sellerId));
    try {
      const res = await marketSyncApi.syncSellerAsins(sellerId, false);
      if (res.success) {
        if (toastRef.current) toastRef.current(res.message || 'Sync triggered!', 'success');
      } else {
        if (toastRef.current) toastRef.current(res.error || res.hint || 'Sync failed', 'error');
      }
    } catch (error) {
      console.error('Failed to sync seller:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — retry after ${error.response.headers?.['retry-after'] || 60}s`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — sync worker may be overloaded');
      }
      const msg = error.message || 'Sync failed';
      const hint = msg.includes('No sync method') ? 'Use Bulk Import for catalog data or configure Live Sync' : '';
      if (toastRef.current) toastRef.current(hint ? `${msg}\n${hint}` : msg, 'error');
    } finally {
      setSyncingSellerIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
    }
  }, []);

  // ── Live Sync (PA-API) trigger ─────────────────────────────────────────
  const liveSync = useCallback(async (sellerId) => {
    setLiveSyncingIds(prev => new Set(prev).add(sellerId));
    setSyncStatus(prev => ({ ...prev, [sellerId]: { status: 'STARTING' } }));
    try {
      const res = await marketSyncApi.triggerLiveSync(sellerId);
      if (res.success) {
        if (res.status === 'IN_PROGRESS') {
          if (toastRef.current) toastRef.current('Live sync already running. Showing progress...', 'info');
        } else {
          if (toastRef.current) toastRef.current('Live sync started. Updates will appear within minutes.', 'success');
        }
        setSyncStatus(prev => ({ ...prev, [sellerId]: { status: 'RUNNING', progress: res.progress || null } }));
      } else {
        if (toastRef.current) toastRef.current(res.error || 'Failed to start live sync', 'error');
        setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
        setSyncStatus(prev => ({ ...prev, [sellerId]: { status: 'ERROR', error: res.error } }));
      }
    } catch (error) {
      console.error('Failed to start live sync:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — too many live sync requests`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — PA-API service may be down');
      }
      if (toastRef.current) toastRef.current(error.message, 'error');
      setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
      setSyncStatus(prev => ({ ...prev, [sellerId]: { status: 'ERROR', error: error.message } }));
    }
  }, []);

  // ── Live Sync status polling (stable interval using refs) ──────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentIds = liveSyncingIdsRef.current;
      if (currentIds.size === 0) return;

      for (const sellerId of currentIds) {
        try {
          const status = await marketSyncApi.getSellerSyncStatus(sellerId);
          const syncStatusValue = status.liveSync?.status;

          if (syncStatusValue === 'RUNNING') {
            setSyncStatus(prev => ({
              ...prev,
              [sellerId]: {
                status: 'RUNNING',
                progress: status.liveSync.progress
              }
            }));
          } else if (syncStatusValue === 'FAILED') {
            setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
            setSyncStatus(prev => ({
              ...prev,
              [sellerId]: {
                status: 'ERROR',
                error: status.liveSync.error || 'Sync failed',
                lastRun: status.liveSync.lastRun
              }
            }));
            if (toastRef.current) toastRef.current(`Live sync failed: ${status.liveSync.error || 'Unknown error'}`, 'error');
          } else {
            // Sync finished (IDLE or COMPLETED)
            setLiveSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
            setSyncStatus(prev => ({
              ...prev,
              [sellerId]: {
                status: 'COMPLETE',
                lastResult: status.liveSync.lastResult,
                lastRun: status.liveSync.lastRun
              }
            }));
            if (status.liveSync.lastResult) {
              const r = status.liveSync.lastResult;
              if (toastRef.current) toastRef.current(`Live sync complete: ${r.success}/${r.totalAsins} ASINs updated in ${(r.duration / 1000).toFixed(1)}s`, 'success');
            } else {
              if (toastRef.current) toastRef.current('Live sync complete.', 'success');
            }
            // Refresh seller list to show updated metrics
            if (loadSellers) {
              void loadSellers({ ...filterParamsRef.current, silent: true });
            }
          }
        } catch (e) {
          console.error('Live sync poll error:', e);
        }
      }
    }, 8000); // Poll every 8 seconds
    return () => clearInterval(interval);
  }, [loadSellers]); // loadSellers is stable (empty deps in caller)

  // ── Bulk sync ──────────────────────────────────────────────────────────
  const bulkSync = useCallback(async () => {
    if (!selectedSellerIds || !selectedSellerIds.length) return;
    setBulkSyncing(true);
    let ok = 0, fail = 0;
    try {
      await Promise.all(selectedSellerIds.map(async (id) => {
        try { await marketSyncApi.syncSellerAsins(id, false); ok++; }
        catch (e) { console.error(`Sync failed for seller ${id}:`, e); fail++; }
      }));
      if (toastRef.current) toastRef.current(`Synced ${ok}${fail ? `, ${fail} failed` : ''}`, fail ? 'warning' : 'success');
      if (setSelectedSellerIds) setSelectedSellerIds([]);
    } catch (err) {
      console.error('Bulk sync failed:', err);
      if (toastRef.current) toastRef.current(err.message, 'error');
    } finally {
      setBulkSyncing(false);
    }
  }, [selectedSellerIds, setSelectedSellerIds]);

  // ── Restart All Octoparse Tasks ─────────────────────────────────────────
  const restartOctoparse = useCallback(async () => {
    if (!window.confirm('This will STOP all running Octoparse tasks, clear all locks, and restart fresh scraping for every active seller. Continue?')) return;
    try {
      setGlobalSyncing(true);
      if (toastRef.current) toastRef.current('Restarting all Octoparse tasks...', 'info');
      const res = await marketSyncApi.restartAllOctoparse();
      if (res.success) {
        if (toastRef.current) toastRef.current(res.message, 'success');
        if (loadSellers) {
          void loadSellers({ ...filterParams, silent: true });
        }
      } else {
        if (toastRef.current) toastRef.current(res.error || 'Restart failed', 'error');
      }
    } catch (error) {
      console.error('Failed to restart Octoparse:', error);
      if (error?.response?.status === 429) {
        console.error(`[429] Rate limit exceeded — too many restart requests`);
      } else if (error?.response?.status === 500) {
        console.error('[500] Internal server error — Octoparse service unreachable');
      }
      if (toastRef.current) toastRef.current(error.message || 'Restart failed', 'error');
    } finally {
      setGlobalSyncing(false);
    }
  }, [loadSellers, filterParams]);

  // ── Global Live Sync All ──────────────────────────────────────────────
  const globalLiveSync = useCallback(async () => {
    setGlobalSyncing(true);
    setGlobalSyncStatus({ status: 'STARTING', sellers: 0, asins: 0 });
    try {
      const res = await marketSyncApi.triggerLiveSyncAll();
      if (res.success) {
        if (toastRef.current) toastRef.current('Global live sync started for all brands', 'success');
        // Start polling for status
        if (globalSyncPollRef.current) clearInterval(globalSyncPollRef.current);
        globalSyncPollRef.current = setInterval(async () => {
          try {
            const status = await marketSyncApi.getLiveSyncAllStatus();
            setGlobalSyncStatus({
              status: status.isRunning ? 'RUNNING' : 'COMPLETE',
              activeSyncs: status.activeSyncs || 0,
              syncs: status.syncs || []
            });
            if (!status.isRunning && status.activeSyncs === 0) {
              clearInterval(globalSyncPollRef.current);
              setGlobalSyncing(false);
              if (toastRef.current) toastRef.current('Global live sync completed!', 'success');
              if (loadSellers) {
                void loadSellers({ ...filterParamsRef.current, silent: true });
              }
            }
          } catch (e) {
            console.error('Global sync poll error:', e);
          }
        }, 10000);
      } else {
        if (toastRef.current) toastRef.current(res.error || 'Failed to start global sync', 'error');
        setGlobalSyncing(false);
      }
    } catch (error) {
      console.error('Failed to start global live sync:', error);
      if (toastRef.current) toastRef.current(error.message, 'error');
      setGlobalSyncing(false);
    }
  }, [loadSellers, filterParams]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (globalSyncPollRef.current) clearInterval(globalSyncPollRef.current);
    };
  }, []);

  // ── Ingest All ─────────────────────────────────────────────────────────
  const ingestAll = useCallback(async () => {
    if (setLoading) setLoading(true);
    try {
      await marketSyncApi.ingestAllResults();
      if (toastRef.current) toastRef.current('Global ingestion started.', 'info');
    } catch (error) {
      console.error('Failed to start ingestion:', error);
      if (toastRef.current) toastRef.current(error.message, 'error');
    } finally {
      if (setLoading) setLoading(false);
    }
  }, [setLoading]);

  return {
    // State
    syncingSellerIds,
    liveSyncingIds,
    syncStatus,
    bulkSyncing,
    globalSyncing,
    globalSyncStatus,
    // Actions
    syncSeller,
    liveSync,
    bulkSync,
    globalLiveSync,
    restartOctoparse,
    ingestAll,
  };
}
