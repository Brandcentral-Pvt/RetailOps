import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'asin-datatable-columns';
const STORAGE_VERSION = 2;

// Curated default: identity + the signals a merchandiser triages on.
// Everything else is one click away in ColumnVisibilityPanel.
const CURATED_DEFAULT_KEYS = [
  'checkbox',
  'asinCode',
  'title',
  'sellerBrand',
  'sku',
  'price',
  'priceDispute',
  'rating',
  'reviewCount',
  'mainBsr',
  'bsrTrendStatus',
  'currentBuybox'
];

// Snapshot of the pre-v2 default set. Used to migrate users who have never
// customised their columns: we drop the old noisy defaults but keep anything
// they explicitly switched ON, so deliberate choices survive the upgrade.
const LEGACY_DEFAULT_KEYS = [
  'checkbox', 'asinCode', 'sellerBrand', 'parentAsin', 'sku', 'title', 'category', 'tags',
  'price', 'priceDispute', 'mrp', 'dealBadge', 'priceTrend', 'mainBsr', 'subBsr',
  'bsrTrendStatus', 'rating', 'reviewCount', 'ratingTrendStatus', 'totalOrders',
  'availability', 'availabilityStatus', 'manufacturer', 'dealStartTime', 'dealEndTime',
  'currentBuybox', 'otherBuybox', 'imagesCount', 'bulletPoints', 'hasAplus', 'aplusDays'
];

// Define all available columns with their keys, labels, and default visibility
export const ALL_COLUMNS = [
  { key: 'checkbox', label: 'Select', defaultVisible: true, required: true, category: 'Core' },
  { key: 'asinCode', label: 'ASIN ID', defaultVisible: true, required: true, category: 'Core' },
  { key: 'sellerBrand', label: 'Seller / Brand', defaultVisible: true, category: 'Core' },
  { key: 'parentAsin', label: 'Parent ASIN', defaultVisible: false, category: 'Core' },
  { key: 'sku', label: 'SKU', defaultVisible: true, category: 'Core' },
  { key: 'title', label: 'Product Title', defaultVisible: true, required: true, category: 'Core' },
  { key: 'category', label: 'Category', defaultVisible: false, category: 'Core' },
  { key: 'tags', label: 'Tags', defaultVisible: false, category: 'Core' },
  { key: 'releaseDate', label: 'Release Date', defaultVisible: false, category: 'Core' },
  
  // LQS columns disabled per user request
  // { key: 'titleScore', label: 'Title Score (TTL)', defaultVisible: true, category: 'LQS' },
  // { key: 'bulletScore', label: 'Bullet Score (BLT)', defaultVisible: true, category: 'LQS' },
  // { key: 'imageScore', label: 'Image Score (IMG)', defaultVisible: true, category: 'LQS' },
  // { key: 'descriptionScore', label: 'Desc Score (DSC)', defaultVisible: true, category: 'LQS' },
  // { key: 'lqs', label: 'Total LQS', defaultVisible: true, category: 'LQS' },
  // CDQ columns disabled per user request
  // { key: 'cdq', label: 'CDQ', defaultVisible: false, category: 'LQS' },
  // { key: 'cdqGrade', label: 'CDQ Grade', defaultVisible: false, category: 'LQS' },
  
  { key: 'price', label: 'Price', defaultVisible: true, category: 'Pricing' },
  { key: 'priceDispute', label: 'Price Dispute', defaultVisible: true, category: 'Pricing' },
  { key: 'mrp', label: 'MRP', defaultVisible: false, category: 'Pricing' },
  { key: 'dealBadge', label: 'Deal', defaultVisible: false, category: 'Pricing' },
  { key: 'discountPercentage', label: 'Discount %', defaultVisible: false, category: 'Pricing' },
  
  { key: 'priceTrend', label: 'Price Trend (7D)', defaultVisible: false, category: 'Trends' },
  { key: 'mainBsr', label: 'Main BSR', defaultVisible: true, category: 'Rankings' },
  { key: 'subBsr', label: 'Sub BSR', defaultVisible: false, category: 'Rankings' },
  { key: 'video', label: 'Video', defaultVisible: false, category: 'Rankings' },
  { key: 'bsrTrendStatus', label: 'BSR Trend', defaultVisible: true, category: 'Trends' },
  { key: 'bsrTrend', label: 'BSR History (7D)', defaultVisible: false, category: 'Trends' },
  
  { key: 'rating', label: 'Rating', defaultVisible: true, category: 'Reviews' },
  { key: 'reviewCount', label: 'Reviews Count', defaultVisible: true, category: 'Reviews' },
  { key: 'ratingTrendStatus', label: 'Rating Trend', defaultVisible: false, category: 'Trends' },
  { key: 'ratingTrend', label: 'Rating History (7D)', defaultVisible: false, category: 'Trends' },
  { key: 'reviewTrend', label: 'Review History (7D)', defaultVisible: false, category: 'Trends' },
  
  { key: 'totalOrders', label: 'Total Orders', defaultVisible: false, category: 'Info' },
  { key: 'availability', label: 'Availability', defaultVisible: false, category: 'Info' },
  { key: 'availabilityStatus', label: 'Availability Status', defaultVisible: false, category: 'Info' },
  { key: 'manufacturer', label: 'Manufacturer', defaultVisible: false, category: 'Info' },
  { key: 'dealStartTime', label: 'Deal Start', defaultVisible: false, category: 'Pricing' },
  { key: 'dealEndTime', label: 'Deal End', defaultVisible: false, category: 'Pricing' },
  { key: 'dealAccessType', label: 'Deal Type', defaultVisible: false, category: 'Pricing' },
  { key: 'currentBuybox', label: 'Current BuyBox', defaultVisible: true, category: 'BuyBox' },
  { key: 'otherBuybox', label: 'Other BuyBox', defaultVisible: false, category: 'BuyBox' },
  
  { key: 'imagesCount', label: 'Images (I)', defaultVisible: false, category: 'Content' },
  { key: 'imageTrend', label: 'Image Trend (7D)', defaultVisible: false, category: 'Trends' },
  { key: 'bulletPoints', label: 'Bullet Points (B)', defaultVisible: false, category: 'Content' },
  { key: 'hasAplus', label: 'A+ Content', defaultVisible: false, category: 'Content' },
  { key: 'aplusDays', label: 'A+ Days Absent', defaultVisible: false, category: 'Content' },
];

export const COLUMN_CATEGORIES = [...new Set(ALL_COLUMNS.map(c => c.category))];

function readStoredColumns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { legacy: parsed };
    if (parsed && Array.isArray(parsed.keys)) {
      return { legacy: null, keys: parsed.keys, version: parsed.v };
    }
    return null;
  } catch {
    return null;
  }
}

function persistColumns(keys) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, keys }));
  } catch {
    // Storage unavailable (private mode / quota) — column choice stays in-memory.
  }
}

function resolveInitialColumns(allowedCategories) {
  const stored = readStoredColumns();
  const defaults = CURATED_DEFAULT_KEYS.filter(
    k => !allowedCategories || allowedCategories.includes(ALL_COLUMNS.find(c => c.key === k)?.category)
  );

  if (!stored) return defaults;

  // v2 payload — already curated, honour it as-is.
  if (stored.legacy === null) return stored.keys.filter(k => ALL_COLUMNS.some(c => c.key === k));

  // Legacy bare array — drop the old noisy defaults, but keep columns the
  // user explicitly enabled beyond them.
  const extras = stored.legacy.filter(k => !LEGACY_DEFAULT_KEYS.includes(k));
  return [...new Set([...defaults, ...extras])];
}

export function useColumnVisibility() {
  const { user } = useAuth();
  
  const isCatalogManager = useMemo(() => {
    const roleName = (user?.role?.name || '').toString().toLowerCase();
    const roleDisp = (user?.role?.displayName || '').toString().toLowerCase();
    return roleName === 'catalog manager' || roleDisp === 'catalog manager' || roleName === 'catalog_manager';
  }, [user]);

  const allowedCategoriesForCatalogManager = useMemo(() => ['Core', 'Content', 'LQS'], []);

  const [visibleColumns, setVisibleColumns] = useState(() =>
    resolveInitialColumns(isCatalogManager ? allowedCategoriesForCatalogManager : null)
  );

  // Filter columns and categories dynamically for Catalog Manager
  const filteredAllColumns = useMemo(() => {
    if (isCatalogManager) {
      return ALL_COLUMNS.filter(c => allowedCategoriesForCatalogManager.includes(c.category));
    }
    return ALL_COLUMNS;
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const filteredCategories = useMemo(() => {
    if (isCatalogManager) {
      return COLUMN_CATEGORIES.filter(cat => allowedCategoriesForCatalogManager.includes(cat));
    }
    return COLUMN_CATEGORIES;
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const isVisible = useCallback((key) => {
    if (isCatalogManager) {
      const col = ALL_COLUMNS.find(c => c.key === key);
      if (!col || !allowedCategoriesForCatalogManager.includes(col.category)) return false;
    }
    return visibleColumns.includes(key);
  }, [visibleColumns, isCatalogManager, allowedCategoriesForCatalogManager]);

  const toggleColumn = useCallback((key) => {
    if (isCatalogManager) {
      const col = ALL_COLUMNS.find(c => c.key === key);
      if (!col || !allowedCategoriesForCatalogManager.includes(col.category)) return;
    }
    setVisibleColumns(prev => {
      const column = ALL_COLUMNS.find(c => c.key === key);
      if (column?.required) return prev; // Don't toggle required columns
      
      const next = prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key];
      
      persistColumns(next);
      return next;
    });
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const toggleCategory = useCallback((category, makeVisible) => {
    if (isCatalogManager && !allowedCategoriesForCatalogManager.includes(category)) return;
    setVisibleColumns(prev => {
      const categoryKeys = ALL_COLUMNS
        .filter(c => c.category === category && !c.required)
        .map(c => c.key);
      
      let next;
      if (makeVisible) {
        next = [...new Set([...prev, ...categoryKeys])];
      } else {
        next = prev.filter(k => !categoryKeys.includes(k));
      }
      
      persistColumns(next);
      return next;
    });
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const resetToDefaults = useCallback(() => {
    const allowed = isCatalogManager ? allowedCategoriesForCatalogManager : null;
    const defaults = CURATED_DEFAULT_KEYS.filter(
      k => !allowed || allowed.includes(ALL_COLUMNS.find(c => c.key === k)?.category)
    );
    setVisibleColumns(defaults);
    persistColumns(defaults);
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const selectAll = useCallback(() => {
    let all = ALL_COLUMNS.map(c => c.key);
    if (isCatalogManager) {
      all = ALL_COLUMNS
        .filter(c => allowedCategoriesForCatalogManager.includes(c.category))
        .map(c => c.key);
    }
    setVisibleColumns(all);
    persistColumns(all);
  }, [isCatalogManager, allowedCategoriesForCatalogManager]);

  const updateVisibleColumns = useCallback((newKeys) => {
    const requiredKeys = ALL_COLUMNS.filter(c => c.required).map(c => c.key);
    const finalKeys = [...new Set([...newKeys, ...requiredKeys])];
    
    setVisibleColumns(finalKeys);
    persistColumns(finalKeys);
  }, []);

  const finalVisibleColumns = useMemo(() => {
    if (isCatalogManager) {
      return visibleColumns.filter(key => {
        const col = ALL_COLUMNS.find(c => c.key === key);
        return col && allowedCategoriesForCatalogManager.includes(col.category);
      });
    }
    return visibleColumns;
  }, [visibleColumns, isCatalogManager, allowedCategoriesForCatalogManager]);

  return {
    visibleColumns: finalVisibleColumns,
    isVisible,
    toggleColumn,
    toggleCategory,
    resetToDefaults,
    selectAll,
    updateVisibleColumns,
    visibleCount: finalVisibleColumns.length,
    totalCount: filteredAllColumns.length,
    allColumns: filteredAllColumns,
    columnCategories: filteredCategories,
    isCatalogManager
  };
}
