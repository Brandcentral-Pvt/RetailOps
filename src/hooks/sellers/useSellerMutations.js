import { useCallback, useRef, useEffect } from 'react';
import { sellerApi } from '../../services/api';

/**
 * useSellerMutations — owns optimistic seller mutations.
 *
 * Each mutation does an optimistic update on `sellers` (passed via
 * { sellers, setSellers }). On error, the original SellersPage behaviour
 * is preserved exactly (rollback for toggle/delete, silent refresh for
 * update, no rollback for create/import).
 */
export function useSellerMutations({
  sellers,
  setSellers,
  setTotalItems,
  addToast,
  loadSellers,
  filterParams,
}) {
  // Stable toast ref — mirrors the original toastRef pattern in SellersPage
  const toastRef = useRef(addToast);
  useEffect(() => { toastRef.current = addToast; }, [addToast]);

  // ── OPTIMISTIC: Toggle status (instant — no refetch) ──────────────────
  const toggleStatus = useCallback(async (sellerId) => {
    let previousStatus;
    setSellers(prev => {
      const seller = prev.find(s => s._id === sellerId);
      if (!seller) return prev;
      previousStatus = seller.status;
      const newStatus = seller.status === 'Active' ? 'Paused' : 'Active';
      sellerApi.update(sellerId, { status: newStatus })
        .then(() => {
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, _saving: false } : s));
        })
        .catch((e) => {
          console.error('Failed to update status:', e);
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, status: previousStatus, _saving: false } : s));
          if (toastRef.current) toastRef.current('Failed to update status', 'error');
        });
      return prev.map(s => s._id === sellerId ? { ...s, status: newStatus, _saving: true } : s);
    });
  }, [setSellers]);

  // ── OPTIMISTIC: Toggle Priority ────────────────────────────────────────
  const togglePriority = useCallback(async (sellerId) => {
    let previousPriority;
    setSellers(prev => {
      const seller = prev.find(s => s._id === sellerId);
      if (!seller) return prev;
      previousPriority = seller.isPriority;
      const newPriority = !seller.isPriority;
      sellerApi.update(sellerId, { isPriority: newPriority })
        .then(() => {
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, _savingPriority: false } : s));
          if (toastRef.current) toastRef.current(newPriority ? 'Marked as High Priority' : 'Removed from High Priority', 'success');
        })
        .catch((e) => {
          console.error('Failed to update priority:', e);
          setSellers(p => p.map(s => s._id === sellerId ? { ...s, isPriority: previousPriority, _savingPriority: false } : s));
          if (toastRef.current) toastRef.current('Failed to update priority', 'error');
        });
      return prev.map(s => s._id === sellerId ? { ...s, isPriority: newPriority, _savingPriority: true } : s);
    });
  }, [setSellers]);

  // ── OPTIMISTIC: Delete seller (instant — no refetch) ──────────────────
  const deleteSeller = useCallback(async (sellerId) => {
    let snapshot;
    setSellers(prev => {
      snapshot = prev.find(s => s._id === sellerId);
      return prev.filter(s => s._id !== sellerId);
    });
    if (setTotalItems) setTotalItems(prev => prev - 1);
    try {
      await sellerApi.delete(sellerId);
      if (toastRef.current) toastRef.current('Seller deleted.', 'success');
    } catch (error) {
      console.error('Failed to delete seller:', error);
      if (snapshot) setSellers(prev => [snapshot, ...prev]);
      if (setTotalItems) setTotalItems(prev => prev + 1);
      if (toastRef.current) toastRef.current('Failed to delete: ' + error.message, 'error');
    }
  }, [setSellers, setTotalItems]);

  // ── Create seller (no optimistic patch — prepend returned record) ──────
  const addSeller = useCallback(async (sellerData) => {
    try {
      const res = await sellerApi.create(sellerData);
      const newSeller = res?.data || res?.seller || { ...sellerData, _id: `tmp_${Date.now()}` };
      setSellers(prev => [newSeller, ...prev]);
      if (setTotalItems) setTotalItems(prev => prev + 1);
      if (toastRef.current) toastRef.current('Seller added.', 'success');
    } catch (error) {
      console.error('Failed to add seller:', error);
      if (toastRef.current) toastRef.current('Failed to save: ' + error.message, 'error');
      throw error;
    }
  }, [setSellers, setTotalItems]);

  // ── Update seller (optimistic patch + silent refresh on error) ────────
  const updateSeller = useCallback(async (sellerId, sellerData) => {
    setSellers(prev => prev.map(s =>
      s._id === sellerId ? { ...s, ...sellerData, _saving: true } : s
    ));
    try {
      await sellerApi.update(sellerId, sellerData);
      setSellers(prev => prev.map(s =>
        s._id === sellerId ? { ...s, _saving: false } : s
      ));
      if (toastRef.current) toastRef.current('Seller updated.', 'success');
    } catch (error) {
      console.error('Failed to update seller:', error);
      if (loadSellers) {
        void loadSellers({ ...filterParams, silent: true });
      }
      if (toastRef.current) toastRef.current('Failed to save: ' + error.message, 'error');
      throw error;
    }
  }, [setSellers, loadSellers, filterParams]);

  // ── Import sellers (batch add — silent refresh to get server IDs) ──────
  const importSellers = useCallback(async (sellersData) => {
    try {
      const response = await sellerApi.import(sellersData);
      if (response.success) {
        if (toastRef.current) toastRef.current(`${sellersData.length} storefronts onboarded.`, 'success');
        if (loadSellers) {
          void loadSellers({ ...filterParams, page: 1, silent: true });
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to import sellers:', error);
      if (toastRef.current) toastRef.current(error.message || 'Check CSV format and try again.', 'error');
    }
    return false;
  }, [loadSellers, filterParams]);

  return {
    toggleStatus,
    togglePriority,
    deleteSeller,
    addSeller,
    importSellers,
    updateSeller,
  };
}
