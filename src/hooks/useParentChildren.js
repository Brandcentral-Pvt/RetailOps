import { useCallback, useMemo, useState } from 'react';
import { asinApi } from '../services/api';

/**
 * Normalises a child ASIN into the same shape the grid already renders.
 *
 * The parent-view endpoints return raw SQL column names (AsinCode, Mrp, ...)
 * while the grid reads camelCase, and they omit most of the optional fields
 * the grid touches. Missing values are filled with neutral defaults so a
 * child row never renders "undefined".
 */
function normaliseChild(row, parentAsin) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    return undefined;
  };

  return {
    _id: pick('Id', 'id', '_id'),
    _isChild: true,
    asinCode: pick('AsinCode', 'asinCode') || '',
    parentAsin: pick('ParentAsin', 'parentAsin') || parentAsin,
    title: pick('Title', 'title') || '',
    brand: pick('Brand', 'brand') || '',
    sku: pick('Sku', 'sku', 'SKU') || '',
    status: pick('Status', 'status') || 'Active',
    sellerName: pick('sellerName', 'SellerName') || '',
    currentPrice: pick('CurrentPrice', 'currentPrice') || 0,
    mrp: pick('Mrp', 'mrp', 'MRP') || 0,
    uploadedPrice: pick('UploadedPrice', 'uploadedPrice') || 0,
    bsr: pick('BSR', 'bsr', 'MainBsr') || 0,
    rating: pick('Rating', 'rating') || 0,
    reviewCount: pick('ReviewCount', 'reviewCount') || 0,
    lqs: pick('LQS', 'lqs') || 0,
    buyBoxWin: pick('BuyBoxWin', 'buyBoxWin') || 0,
    hasAplus: pick('HasAplus', 'hasAplus') || 0,
    soldBy: pick('SoldBy', 'soldBy') || '',
    availabilityStatus: pick('AvailabilityStatus', 'availabilityStatus') || '',
    imagesCount: pick('ImagesCount', 'imagesCount') || 0,
    tags: pick('Tags', 'tags') || '[]',
    releaseDate: pick('ReleaseDate', 'releaseDate') || null,
    updatedAt: pick('UpdatedAt', 'updatedAt') || null,

    // Fields the grid reads but the children query does not return.
    totalOrders: 0,
    imageUrl: '',
    dealBadge: '',
    dealStartTime: null,
    dealEndTime: null,
    dealAccessType: null,
    priceDispute: false,
    discountPercentage: 0,
    secondAsp: 0,
    aspDifference: 0,
    manufacturer: '',
    priceType: '',
    subBsr: null,
    video: false,
    bulletPoints: 0,
    aplusAbsentSince: null,
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
    bsrTrend: '',
    ratingTrend: '',
    soldBySec: '',
    monthlyOrders: {},
    monthlyGmsRevenue: {},
    monthlyGmsUnits: {}
  };
}

/**
 * Drives parent -> child drill-down in parent view.
 *
 * Children are fetched lazily on first expand and then cached for the
 * session, so re-expanding is instant and repeat expansions cost nothing.
 */
export function useParentChildren() {
  const [expandedParents, setExpandedParents] = useState(() => new Set());
  const [childrenByParent, setChildrenByParent] = useState({});
  const [loadingParents, setLoadingParents] = useState(() => new Set());

  const toggleParentExpand = useCallback(async (parentAsin) => {
    if (!parentAsin) return;

    const willExpand = !expandedParents.has(parentAsin);

    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentAsin)) next.delete(parentAsin);
      else next.add(parentAsin);
      return next;
    });

    if (!willExpand || childrenByParent[parentAsin]) return;

    setLoadingParents(prev => new Set(prev).add(parentAsin));
    try {
      const res = await asinApi.getParentChildren(parentAsin);
      if (res.success) {
        setChildrenByParent(prev => ({
          ...prev,
          [parentAsin]: (res.data || []).map(child => normaliseChild(child, parentAsin))
        }));
      }
    } catch (err) {
      console.error('Error fetching parent children:', err);
    } finally {
      setLoadingParents(prev => {
        const next = new Set(prev);
        next.delete(parentAsin);
        return next;
      });
    }
  }, [expandedParents, childrenByParent]);

  const collapseAll = useCallback(() => {
    setExpandedParents(new Set());
  }, []);

  /**
   * Interleaves expanded children directly beneath their parent so the grid
   * can keep rendering one flat list of rows. Parents in ASIN view (which
   * have no _isParent marker) are returned untouched.
   */
  const withExpandedChildren = useCallback(
    rows => {
      if (expandedParents.size === 0) return rows;

      const out = [];
      for (const row of rows) {
        out.push(row);
        if (!row._isParent) continue;

        const key = row.parentAsin || row.asinCode;
        if (!expandedParents.has(key)) continue;

        if (loadingParents.has(key)) {
          out.push({ _id: `${key}__loading`, _isChild: true, _isChildLoading: true, asinCode: 'Loading children…' });
          continue;
        }

        const children = childrenByParent[key];
        if (children?.length) out.push(...children);
      }
      return out;
    },
    [expandedParents, childrenByParent, loadingParents]
  );

  const expandedCount = useMemo(() => expandedParents.size, [expandedParents]);

  return {
    expandedParents,
    childrenByParent,
    loadingParents,
    expandedCount,
    toggleParentExpand,
    collapseAll,
    withExpandedChildren
  };
}
