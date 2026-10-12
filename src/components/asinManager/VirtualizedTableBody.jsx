import React, { useRef, useMemo, memo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Plus, Minus, Eye, Tag, Trash2, RefreshCw, Zap, Sparkles, AlertTriangle, PlayCircle, PlusCircle, ListChecks, Download, FileUp, MoreVertical, Image, Star, Award, BarChart2, LayoutGrid, IndianRupee, TrendingUp, Trophy, Package, Activity, Clock, ExternalLink, Video, PauseCircle, Edit3, Upload, Rows3, Search, Scan } from 'lucide-react';
import { Tooltip, Dropdown, Menu, Modal, Button, Popover, Tag as AntTag, message } from 'antd';
import TagsCell from '../asins/TagsCell';
import TrendBadge from '../asins/TrendBadge';

const UNAVAILABLE_MARKERS = ['unavailable', 'out of stock', 'out_of_stock', 'currently unavailable'];

function isUnavailableStatus(asin) {
  const status = (asin?.availabilityStatus || '').toLowerCase();
  return UNAVAILABLE_MARKERS.some(marker => status.includes(marker));
}

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

const formatCurrency = (val) => {
  if (!val && val !== 0) return '-';
  const num = Number(val);
  if (isNaN(num)) return '-';
  return '₹' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (val) => {
  if (!val && val !== 0) return '-';
  const num = Number(val);
  if (isNaN(num)) return '-';
  return num.toLocaleString();
};

const normalizeDateStr = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
};

const getBsrTrendClass = (trend) => {
  if (!trend) return '';
  if (trend === 'Grow') return 'text-success';
  if (trend === 'Down') return 'text-danger';
  return 'text-warning';
};

const getRatingTrendClass = (trend) => {
  if (!trend) return '';
  if (trend === 'Grow') return 'text-success';
  if (trend === 'Down') return 'text-danger';
  return 'text-warning';
};

const renderRatingBreakdown = (breakdown) => {
  if (!breakdown || (!breakdown.fiveStar && !breakdown.fourStar && !breakdown.threeStar && !breakdown.twoStar && !breakdown.oneStar)) {
    return <span style={{ color: 'var(--text-muted)' }}>-</span>;
  }

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

// Memoized virtual row component - only re-renders when its specific props change
const VirtualRow = memo(function VirtualRow({
  asin,
  index,
  visibleColumns,
  viewMode,
  marketplaceFilter,
  historyStructure,
  expandedParents,
  toggleParentExpand,
  withExpandedChildren,
  selectedIds,
  handleToggleSelectRow,
  handleViewAsin,
  handleViewTrends,
  handleViewPrice,
  handleViewBsr,
  handleViewRating,
  handleIndividualScrape,
  handleDeleteAsin,
  handleToggleAsinStatus,
  scrapingIds,
  handleBulkSyncSelected,
  setShowBulkTagsModal,
  handleBulkPriceDispute,
  handleRunRulesets,
  handleOpenTaskModal,
  handleSelectedCreateActions,
  handleAiListingAnalysis,
  clearSelection,
  aiAnalysisLoading,
  syncing,
  loading,
  priceTrendExpanded,
  bsrTrendExpanded,
  ratingTrendExpanded,
  reviewTrendExpanded,
  imageTrendExpanded,
  ordersExpanded,
  gmsRevenueExpanded,
  availableMonths,
  visibleHistoryCols,
  formatMonthHeader,
  getTransitionStyle,
  isFirstCol,
  isSecondCol,
}) {
  const historyMap = useMemo(() => {
    const map = {};
    asin.history?.forEach(h => map[normalizeDateStr(h.date)] = h);
    return map;
  }, [asin.history]);

  const weekHistoryMap = useMemo(() => {
    const map = {};
    asin.weekHistory?.forEach(w => map[normalizeDateStr(w.date)] = w);
    return map;
  }, [asin.weekHistory]);

  const subBsrHistoryMap = useMemo(() => {
    const map = {};
    asin.subBsrHistory?.forEach(h => map[normalizeDateStr(h.date)] = h);
    return map;
  }, [asin.subBsrHistory]);

  const rowClass = useMemo(() => [
    'asin-grid__row',
    isUnavailableStatus(asin) ? 'asin-grid__row--unavailable' : '',
    asin._isChild ? 'asin-row--child' : '',
    selectedIds.has(asin._id) ? 'is-selected' : ''
  ].filter(Boolean).join(' '), [asin, selectedIds]);

  // Helper to check if column is visible
  const colVisible = (key) => visibleColumns.some(c => c.key === key);
  
  // Helper to get column style
  const getColStyle = (key, extraStyle = {}) => {
    const col = visibleColumns.find(c => c.key === key);
    if (!col) return { display: 'none' };
    const baseStyle = { ...tdStyle, width: `${col.width}px`, minWidth: `${col.width}px`, maxWidth: `${col.width}px` };
    if (col.sticky && col.stickyLeft !== undefined) {
      baseStyle.position = 'sticky';
      baseStyle.left = `${col.stickyLeft}px`;
      baseStyle.zIndex = col.zIndex || 5;
    }
    if (col.sticky && col.stickyRight !== undefined) {
      baseStyle.position = 'sticky';
      baseStyle.right = `${col.stickyRight}px`;
      baseStyle.zIndex = col.zIndex || 25;
    }
    return { ...baseStyle, ...extraStyle };
  };

  return (
    <tr className={rowClass}>
      {isVisible('checkbox') && (
        <td className={`asin-grid__sticky ${isFirstColCheck ? 'asin-grid__sticky--select' : ''}`} style={{
          ...tdStyle,
          width: '40px',
          position: 'sticky',
          left: 0,
          zIndex: 6,
          textAlign: 'center',
          padding: 0,
          background: asin._isParent ? 'var(--bg-secondary)' : 'white'
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
            paddingLeft: asin._isChild ? '18px' : undefined,
            background: asin._isParent ? 'var(--bg-secondary)' : 'white'
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
                  className="btn btn-ghost p-0 d-flex align-items-center justify-content-center"
                  style={{ minWidth: '20px', height: '20px', borderRadius: '4px' }}
                >
                  {expandedParents.has(asin.asinCode) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
              {asin.asinCode || asin.AsinCode}
            </span>
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
          </div>
        </td>
      )}

      {colVisible('releaseDate') && (
        <td style={getColStyle('releaseDate', { textAlign: 'center' })}>
          {asin.releaseDate ? asin.releaseDate.split('T')[0] : '-'}
        </td>
      )}

      {colVisible('parentAsin') && (
        <td style={getColStyle('parentAsin')}>
          {asin.parentAsin || '-'}
        </td>
      )}

      {colVisible('sellerBrand') && (
        <td style={getColStyle('sellerBrand')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 500 }}>{asin.sellerName || asin.SellerName || '-'}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{asin.brand || asin.Brand || '-'}</span>
          </div>
        </td>
      )}

      {colVisible('sku') && (
        <td style={getColStyle('sku')}>
          {asin.sku || asin.SKU || '-'}
        </td>
      )}

      {colVisible('title') && (
        <td style={getColStyle('title', { maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {asin.imageUrl && (
              <img src={asin.imageUrl} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
            )}
            <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {asin.title || asin.Title || '-'}
            </span>
          </div>
        </td>
      )}

      {colVisible('category') && (
        <td style={getColStyle('category')}>
          {asin.category || asin.Category || '-'}
        </td>
      )}

      {colVisible('tags') && (
        <td style={getColStyle('tags')}>
          <TagsCell tags={asin.Tags || asin.tags} maxVisible={3} />
        </td>
      )}

      {/* Deal & Manufacturer Columns */}
      {colVisible('manufacturer') && (
        <td style={getColStyle('manufacturer', { textAlign: 'left' })}>
          {asin.manufacturer || '-'}
        </td>
      )}
      {colVisible('availabilityStatus') && (
        <td style={getColStyle('availabilityStatus', { textAlign: 'center' })}>
          <span className={`badge ${isUnavailableStatus(asin) ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: '9px' }}>
            {asin.availabilityStatus || '-'}
          </span>
        </td>
      )}
      {colVisible('ads') && (
        <td style={getColStyle('ads', { textAlign: 'center' })}>
          <span className={asin.Ads || asin.ads ? 'text-success' : 'text-muted'}>
            {asin.Ads || asin.ads ? 'Yes' : 'No'}
          </span>
        </td>
      )}
      {colVisible('gms') && (
        <td style={getColStyle('gms', { textAlign: 'center' })}>
          <span className={asin.hasGms ? 'text-primary' : 'text-muted'}>
            {asin.hasGms ? 'Yes' : 'No'}
          </span>
        </td>
      )}

      {/* Orders Columns */}
      {colVisible('totalOrders') && (
        <>
          {ordersExpanded && availableMonths.map((month, monthIdx) => (
            <td key={`ord-${month}`} style={{
              ...getColStyle(`ord-${month}`, { textAlign: 'center' }),
              ...getTransitionStyle(ordersExpanded, monthIdx, availableMonths.length + 1, '70px')
            }}>
              <div style={{
                width: ordersExpanded ? 'auto' : '0px',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}>
                {asin.monthlyOrders?.[month] || 0}
              </div>
            </td>
          ))}
          {ordersExpanded && (
            <td style={{
              ...getColStyle('orders-total', { textAlign: 'center' }),
              fontWeight: 700,
              ...getTransitionStyle(ordersExpanded, availableMonths.length, availableMonths.length + 1, '70px')
            }}>
              <div style={{
                width: ordersExpanded ? 'auto' : '0px',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}>
                {asin.totalOrders || 0}
              </div>
            </td>
          )}
        </>
      )}

      {colVisible('dealBadge') && (
        <td style={getColStyle('dealBadge', { textAlign: 'center' })}>
          {asin.dealBadge ? (
            <TrendBadge value={asin.dealBadge} type="deal" />
          ) : '-'}
        </td>
      )}
      {colVisible('dealStartTime') && (
        <td style={getColStyle('dealStartTime', { textAlign: 'center' })}>
          {asin.dealStartTime ? asin.dealStartTime.split('T')[0] : '-'}
        </td>
      )}
      {colVisible('dealEndTime') && (
        <td style={getColStyle('dealEndTime', { textAlign: 'center' })}>
          {asin.dealEndTime ? asin.dealEndTime.split('T')[0] : '-'}
        </td>
      )}
      {colVisible('dealAccessType') && (
        <td style={getColStyle('dealAccessType', { textAlign: 'center' })}>
          {asin.dealAccessType || '-'}
        </td>
      )}
      {colVisible('currentBuybox') && (
        <td style={getColStyle('currentBuybox', { textAlign: 'left' })}>
          {asin.soldBy || asin.SoldBy || asin.buyBoxSeller || '-'}
        </td>
      )}

      {/* Price Columns */}
      {colVisible('mrp') && (
        <td style={getColStyle('mrp', { textAlign: 'right' })}>
          {formatCurrency(asin.mrp || asin.MRP || asin.mrpPrice || asin.MrpPrice)}
        </td>
      )}
      {colVisible('price') && (
        <td style={getColStyle('price', { textAlign: 'right' })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatCurrency(asin.currentPrice || asin.CurrentPrice || asin.uploadedPrice || asin.UploadedPrice)}
            </span>
            {asin.priceDispute && <AlertTriangle size={12} className="text-amber-500" title="Price Dispute" />}
          </div>
        </td>
      )}
      {colVisible('discountPercentage') && (
        <td style={getColStyle('discountPercentage', { textAlign: 'center' })}>
          {asin.discountPercentage ? `${asin.discountPercentage}%` : '-'}
        </td>
      )}
      {colVisible('priceDispute') && (
        <td style={getColStyle('priceDispute', { textAlign: 'center' })}>
          {asin.priceDispute ? (
            <span className="badge bg-amber-100 text-amber-800" style={{ fontSize: '9px' }}>Disputed</span>
          ) : '-'}
        </td>
      )}

      {/* Price Trend Columns */}
      {visibleHistoryCols > 0 && (
        <>
          {historyStructure.map(week =>
            week.dates.map((date, dateIdx) => (
              <td key={`pt-${date.label}`} style={{
                ...getColStyle(`pt-${date.label}`, { textAlign: 'center' }),
                ...getTransitionStyle(priceTrendExpanded, dateIdx, week.dates.length)
              }}>
                <div style={{
                  width: (priceTrendExpanded || dateIdx === week.dates.length - 1) ? 'auto' : '0px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}>
                  {historyMap[date.label]?.price != null ? formatCurrency(historyMap[date.label].price) : '-'}
                </div>
              </td>
            ))
          )}
        </>
      )}

      {/* BSR Columns */}
      {colVisible('mainBsr') && (
        <td style={getColStyle('mainBsr', { textAlign: 'center', transition: 'all 0.3s ease' })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {asin.bsr || asin.BSR ? (
              <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{formatNumber(asin.bsr || asin.BSR)}</span>
            ) : '-'}
            {asin.bsrTrend && <span className={getBsrTrendClass(asin.bsrTrend)} title={asin.bsrTrend}>{asin.bsrTrend === 'Grow' ? '↑' : asin.bsrTrend === 'Down' ? '↓' : '→'}</span>}
          </div>
        </td>
      )}
      {colVisible('subBsr') && (
        <td style={getColStyle('subBsr', { transition: 'all 0.3s ease' })}>
          {asin.subBsr || asin.SubBsr || '-'}
          {asin.subBsrCategory && <span className="text-muted" style={{ fontSize: '10px', display: 'block' }}>{asin.subBsrCategory}</span>}
        </td>
      )}
      {colVisible('bsrTrendStatus') && (
        <td style={getColStyle('bsrTrendStatus', { textAlign: 'center', transition: 'all 0.3s ease' })}>
          {asin.bsrTrend ? (
            <span className={`badge ${asin.bsrTrend === 'Grow' ? 'bg-success' : asin.bsrTrend === 'Down' ? 'bg-danger' : 'bg-warning'}`} style={{ fontSize: '9px' }}>
              {asin.bsrTrend}
            </span>
          ) : '-'}
        </td>
      )}
      {visibleHistoryCols > 0 && (
        <>
          {historyStructure.map(week =>
            week.dates.map((date, dateIdx) => (
              <td key={`bst-${date.label}`} style={{
                ...getColStyle(`bst-${date.label}`, { textAlign: 'center' }),
                ...getTransitionStyle(bsrTrendExpanded, dateIdx, week.dates.length)
              }}>
                <div style={{
                  width: (bsrTrendExpanded || dateIdx === week.dates.length - 1) ? 'auto' : '0px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}>
                  {historyMap[date.label]?.bsr ? formatNumber(historyMap[date.label].bsr) : '-'}
                </div>
              </td>
            ))
          )}
        </>
      )}

      {/* Rating Columns */}
      {colVisible('rating') && (
        <td style={getColStyle('rating', { textAlign: 'center', transition: 'all 0.3s ease' })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {asin.rating != null ? (
              <>
                <span style={{ fontWeight: 600 }}>{Number(asin.rating).toFixed(1)}</span>
                <Star size={12} style={{ color: '#fbbf24' }} />
              </>
            ) : '-'}
          </div>
        </td>
      )}
      {colVisible('reviewCount') && (
        <td style={getColStyle('reviewCount', { textAlign: 'center', transition: 'all 0.3s ease' })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {formatNumber(asin.reviewCount || asin.ReviewCount)}
            {asin.ratingTrend && <span className={getRatingTrendClass(asin.ratingTrend)} title={asin.ratingTrend}>{asin.ratingTrend === 'Grow' ? '↑' : asin.ratingTrend === 'Down' ? '↓' : '→'}</span>}
          </div>
        </td>
      )}
      {colVisible('ratingBreakdown') && (
        <td style={getColStyle('ratingBreakdown', { textAlign: 'center', transition: 'all 0.3s ease' })}>
          {asin.ratingBreakdown ? renderRatingBreakdown(asin.ratingBreakdown) : '-'}
        </td>
      )}
      {colVisible('ratingTrendStatus') && (
        <td style={getColStyle('ratingTrendStatus', { textAlign: 'center', transition: 'all 0.3s ease' })}>
          {asin.ratingTrend ? (
            <span className={`badge ${asin.ratingTrend === 'Grow' ? 'bg-success' : asin.ratingTrend === 'Down' ? 'bg-danger' : 'bg-warning'}`} style={{ fontSize: '9px' }}>
              {asin.ratingTrend}
            </span>
          ) : '-'}
        </td>
      )}
          {historyStructure.map(week =>
            week.dates.map((date, dateIdx) => (
              <td key={`rt-${date.label}`} style={{
                ...tdStyle,
                textAlign: 'center',
                ...getTransitionStyle(ratingTrendExpanded, dateIdx, week.dates.length)
              }}>
                <div style={{
                  width: (ratingTrendExpanded || dateIdx === week.dates.length - 1) ? 'auto' : '0px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}>
                  {historyMap[date.label]?.rating != null ? Number(historyMap[date.label].rating).toFixed(1) : '-'}
                </div>
              </td>
            ))
          )}
        </>
      )}
      {colVisible('reviewCount') && (
        <td style={getColStyle('reviewCount', { textAlign: 'center', transition: 'all 0.3s ease' })} title="Reviews Trend Status">
          {asin.reviewTrend ? (
            <span className={`badge ${asin.reviewTrend === 'Grow' ? 'bg-success' : asin.reviewTrend === 'Down' ? 'bg-danger' : 'bg-warning'}`} style={{ fontSize: '9px' }}>
              {asin.reviewTrend}
            </span>
          ) : '-'}
        </td>
      )}
      {visibleHistoryCols > 0 && (
        <>
          {historyStructure.map(week =>
            week.dates.map((date, dateIdx) => (
              <td key={`rvt-${date.label}`} style={{
                ...getColStyle(`rvt-${date.label}`, { textAlign: 'center' }),
                ...getTransitionStyle(reviewTrendExpanded, dateIdx, week.dates.length)
              }}>
                <div style={{
                  width: (reviewTrendExpanded || dateIdx === week.dates.length - 1) ? 'auto' : '0px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}>
                  {historyMap[date.label]?.reviewCount ? formatNumber(historyMap[date.label].reviewCount) : '-'}
                </div>
              </td>
            ))
          )}
        </>
      )}

      {/* Visuals & Content Columns */}
      {colVisible('video') && (
        <td style={getColStyle('video', { textAlign: 'center', transition: 'all 0.3s ease' })} title="Video Present">
          {asin.VideoCount || asin.videoCount || 0}
        </td>
      )}
      {colVisible('imagesCount') && (
        <td style={getColStyle('imagesCount', { textAlign: 'center', transition: 'all 0.3s ease' })}>
          {asin.ImagesCount || asin.imagesCount || 0}
        </td>
      )}
      {visibleHistoryCols > 0 && (
        <>
          {historyStructure.map(week =>
            week.dates.map((date, dateIdx) => (
              <td key={`imt-${date.label}`} style={{
                ...getColStyle(`imt-${date.label}`, { textAlign: 'center' }),
                ...getTransitionStyle(imageTrendExpanded, dateIdx, week.dates.length)
              }}>
                <div style={{
                  width: (imageTrendExpanded || dateIdx === week.dates.length - 1) ? 'auto' : '0px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}>
                  {historyMap[date.label]?.imagesCount != null ? historyMap[date.label].imagesCount : '-'}
                </div>
              </td>
            ))
          )}
        </>
      )}
      {colVisible('bulletPoints') && (
        <td style={getColStyle('bulletPoints', { textAlign: 'center' })}>
          {asin.BulletPoints || asin.bulletPoints?.length || 0}
        </td>
      )}
      {colVisible('hasAplus') && (
        <td style={getColStyle('hasAplus', { textAlign: 'center' })}>
          {asin.HasAplus || asin.hasAplus ? <span className="text-success fw-bold">✓</span> : '-'}
        </td>
      )}
      {colVisible('aplusDays') && (
        <td style={getColStyle('aplusDays', { textAlign: 'center' })}>
          {asin.AplusDays || asin.aplusDays || '-'}
        </td>
      )}

      {/* Actions Column */}
      <td style={getColStyle('actions', {
        textAlign: 'center',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-light)',
        padding: '4px 2px'
      })}>
        background: 'var(--bg-secondary)',
        position: 'sticky',
        right: 0,
        zIndex: 25,
        borderLeft: '1px solid var(--border-light)',
        padding: '4px 2px'
      }}>
        <div className="d-flex align-items-center justify-content-center gap-1" style={{ flexWrap: 'wrap' }}>
          <Tooltip title="View Details" placement="top">
            <Button size="small" type="text" icon={<Eye size={12} />} onClick={() => handleViewAsin(asin)} className="p-1" />
          </Tooltip>
          <Tooltip title="View Trends" placement="top">
            <Button size="small" type="text" icon={<BarChart2 size={12} />} onClick={() => handleViewTrends(asin)} className="p-1" />
          </Tooltip>
          <Tooltip title="Price History" placement="top">
            <Button size="small" type="text" icon={<IndianRupee size={12} />} onClick={(e) => handleViewPrice(asin, e)} className="p-1" />
          </Tooltip>
          <Tooltip title="BSR History" placement="top">
            <Button size="small" type="text" icon={<Trophy size={12} />} onClick={(e) => handleViewBsr(asin, e)} className="p-1" />
          </Tooltip>
          <Tooltip title="Rating History" placement="top">
            <Button size="small" type="text" icon={<Star size={12} />} onClick={(e) => handleViewRating(asin, e)} className="p-1" />
          </Tooltip>
          {scrapingIds?.has(asin._id) ? (
            <span className="icon-[svg-spinners--eclipse] text-primary" style={{ fontSize: 14 }} aria-hidden="true" />
          ) : (
            <Tooltip title="Force Sync" placement="top">
              <Button size="small" type="text" icon={<RefreshCw size={12} />} onClick={() => handleIndividualScrape(asin._id)} className="p-1" />
            </Tooltip>
          )}
          <Tooltip title="Delete ASIN" placement="top">
            <Button size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => handleDeleteAsin(asin._id)} className="p-1" />
          </Tooltip>
          <Tooltip title={asin.Status === 'Active' ? 'Deactivate' : 'Activate'} placement="top">
            <Button size="small" type="text" icon={asin.Status === 'Active' ? <PauseCircle size={12} /> : <PlayCircle size={12} />} onClick={() => handleToggleAsinStatus(asin._id, asin.Status)} className="p-1" />
          </Tooltip>
        </div>
      </td>
    </tr>
  );
});

export function VirtualizedTableBody({
  filteredAsins,
  selectableRows,
  selectedIds,
  isVisible,
  viewMode,
  marketplaceFilter,
  historyStructure,
  expandedParents,
  toggleParentExpand,
  withExpandedChildren,
  handleToggleSelectRow,
  handleViewAsin,
  handleViewTrends,
  handleViewPrice,
  handleViewBsr,
  handleViewRating,
  handleIndividualScrape,
  handleDeleteAsin,
  handleToggleAsinStatus,
  scrapingIds,
  handleBulkSyncSelected,
  setShowBulkTagsModal,
  handleBulkPriceDispute,
  handleRunRulesets,
  handleOpenTaskModal,
  handleSelectedCreateActions,
  handleAiListingAnalysis,
  clearSelection,
  aiAnalysisLoading,
  syncing,
  loading,
  priceTrendExpanded,
  bsrTrendExpanded,
  ratingTrendExpanded,
  reviewTrendExpanded,
  imageTrendExpanded,
  ordersExpanded,
  gmsRevenueExpanded,
  availableMonths,
  visibleHistoryCols,
  formatMonthHeader,
  getTransitionStyle,
  containerRef: externalContainerRef,
  style,
  className,
  ...restProps
}) {
  const parentRef = useRef(null);
  const containerRef = externalContainerRef || parentRef;

  // Build visible column list once
  const visibleColumns = useMemo(() => {
    const cols = [];
    if (isVisible('checkbox')) cols.push({ key: 'checkbox', width: 40, sticky: true, stickyLeft: 0 });
    if (isVisible('asinCode')) cols.push({ key: 'asinCode', width: 110, sticky: true, stickyLeft: isVisible('checkbox') ? 40 : 0 });
    if (isVisible('releaseDate')) cols.push({ key: 'releaseDate', width: 85 });
    if (isVisible('parentAsin')) cols.push({ key: 'parentAsin', width: 110 });
    if (isVisible('sellerBrand')) cols.push({ key: 'sellerBrand', width: 115 });
    if (isVisible('sku')) cols.push({ key: 'sku', width: 95 });
    if (isVisible('title')) cols.push({ key: 'title', width: 220 });
    if (isVisible('category')) cols.push({ key: 'category', width: 135 });
    if (isVisible('tags')) cols.push({ key: 'tags', width: 100 });
    if (isVisible('manufacturer')) cols.push({ key: 'manufacturer', width: 120 });
    if (isVisible('availabilityStatus')) cols.push({ key: 'availabilityStatus', width: 100 });
    if (isVisible('ads')) cols.push({ key: 'ads', width: 60 });
    if (isVisible('ads')) cols.push({ key: 'gms', width: 50 }); // GMS column
    
    // Orders columns
    if (ordersExpanded && isVisible('totalOrders') && availableMonths.length) {
      availableMonths.forEach((month, idx) => {
        cols.push({ key: `ord-${month}`, width: 70 });
      });
      cols.push({ key: 'orders-total', width: 70 });
    } else if (isVisible('totalOrders')) {
      cols.push({ key: 'orders-total', width: 70 });
    }
    
    if (isVisible('dealBadge')) cols.push({ key: 'dealBadge', width: 80 });
    if (isVisible('dealStartTime')) cols.push({ key: 'dealStartTime', width: 90 });
    if (isVisible('dealEndTime')) cols.push({ key: 'dealEndTime', width: 90 });
    if (isVisible('dealAccessType')) cols.push({ key: 'dealAccessType', width: 80 });
    if (isVisible('currentBuybox')) cols.push({ key: 'currentBuybox', width: 140 });
    if (isVisible('mrp')) cols.push({ key: 'mrp', width: 85 });
    if (isVisible('price')) cols.push({ key: 'price', width: 85 });
    if (isVisible('discountPercentage')) cols.push({ key: 'discountPercentage', width: 85 });
    if (isVisible('priceDispute')) cols.push({ key: 'priceDispute', width: 85 });
    
    // Price trend
    if (visibleHistoryCols > 0) {
      historyStructure.forEach(week => {
        week.dates.forEach(date => {
          cols.push({ key: `pt-${date.label}`, width: 42 });
        });
      });
    }
    
    if (isVisible('mainBsr')) cols.push({ key: 'mainBsr', width: 90 });
    if (isVisible('subBsr')) cols.push({ key: 'subBsr', width: 110 });
    if (isVisible('bsrTrendStatus')) cols.push({ key: 'bsrTrendStatus', width: 75 });
    if (visibleHistoryCols > 0) {
      historyStructure.forEach(week => {
        week.dates.forEach(date => {
          cols.push({ key: `bst-${date.label}`, width: 42 });
        });
      });
    }
    
    if (isVisible('rating')) cols.push({ key: 'rating', width: 60 });
    if (isVisible('reviewCount')) cols.push({ key: 'reviewCount', width: 65 });
    if (isVisible('ratingBreakdown')) cols.push({ key: 'ratingBreakdown', width: 120 });
    if (isVisible('ratingTrendStatus')) cols.push({ key: 'ratingTrendStatus', width: 75 });
    if (visibleHistoryCols > 0) {
      historyStructure.forEach(week => {
        week.dates.forEach(date => {
          cols.push({ key: `rt-${date.label}`, width: 42 });
        });
      });
    }
    if (isVisible('reviewCount')) cols.push({ key: 'reviewTrend', width: 75 });
    if (visibleHistoryCols > 0) {
      historyStructure.forEach(week => {
        week.dates.forEach(date => {
          cols.push({ key: `rvt-${date.label}`, width: 42 });
        });
      });
    }
    
    if (isVisible('video')) cols.push({ key: 'video', width: 65 });
    if (isVisible('imagesCount')) cols.push({ key: 'imagesCount', width: 55 });
    if (visibleHistoryCols > 0) {
      historyStructure.forEach(week => {
        week.dates.forEach(date => {
          cols.push({ key: `imt-${date.label}`, width: 42 });
        });
      });
    }
    
    if (isVisible('bulletPoints')) cols.push({ key: 'bulletPoints', width: 35 });
    if (isVisible('hasAplus')) cols.push({ key: 'hasAplus', width: 55 });
    if (isVisible('aplusDays')) cols.push({ key: 'aplusDays', width: 50 });
    
    // Actions column (always visible, sticky right)
    cols.push({ key: 'actions', width: 60, sticky: true, stickyRight: 0 });
    
    return cols;
  }, [
    isVisible, ordersExpanded, availableMonths, visibleHistoryCols,
    historyStructure, priceTrendExpanded, bsrTrendExpanded,
    ratingTrendExpanded, reviewTrendExpanded, imageTrendExpanded
  ]);

  // Column virtualizer for horizontal scrolling
  const columnVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => visibleColumns[index]?.width || 100,
    overscan: 3,
    direction: 'horizontal',
  });
  
  // Parent ref for the container that handles both vertical and horizontal scroll
  const parentRef = useRef(null);
  const containerRef = externalContainerRef || parentRef;

  // Row height measurement for dynamic sizing
  const rowVirtualizer = useVirtualizer({
    count: filteredAsins.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 52,
    overscan: 5,
    measureElement: (element) => {
      if (element) {
        const height = element.getBoundingClientRect().height;
        return height;
      }
      return 52;
    },
  });

  // Sticky column positions (computed from visibleColumns)
  const isFirstCol = visibleColumns.find(c => c.key === 'checkbox');
  const isSecondCol = visibleColumns.find(c => c.key === 'asinCode');

  // Memoize all callbacks to prevent unnecessary re-renders of virtual rows
  const rowProps = useMemo(() => ({
    isVisible,
    viewMode,
    marketplaceFilter,
    historyStructure,
    expandedParents,
    toggleParentExpand,
    withExpandedChildren,
    selectedIds,
    handleToggleSelectRow,
    handleViewAsin,
    handleViewTrends,
    handleViewPrice,
    handleViewBsr,
    handleViewRating,
    handleIndividualScrape,
    handleDeleteAsin,
    handleToggleAsinStatus,
    scrapingIds,
    handleBulkSyncSelected,
    setShowBulkTagsModal,
    handleBulkPriceDispute,
    handleRunRulesets,
    handleOpenTaskModal,
    handleSelectedCreateActions,
    handleAiListingAnalysis,
    clearSelection,
    aiAnalysisLoading,
    syncing,
    loading,
    priceTrendExpanded,
    bsrTrendExpanded,
    ratingTrendExpanded,
    reviewTrendExpanded,
    imageTrendExpanded,
    ordersExpanded,
    gmsRevenueExpanded,
    availableMonths,
    visibleHistoryCols,
    formatMonthHeader,
    getTransitionStyle,
    isFirstCol,
    isSecondCol,
  }), [
    isVisible, viewMode, marketplaceFilter, historyStructure, expandedParents,
    toggleParentExpand, withExpandedChildren, selectedIds, handleToggleSelectRow,
    handleViewAsin, handleViewTrends, handleViewPrice, handleViewBsr,
    handleViewRating, handleIndividualScrape, handleDeleteAsin,
    handleToggleAsinStatus, scrapingIds, handleBulkSyncSelected,
    setShowBulkTagsModal, handleBulkPriceDispute, handleRunRulesets,
    handleOpenTaskModal, handleSelectedCreateActions, handleAiListingAnalysis,
    clearSelection, aiAnalysisLoading, syncing, loading, priceTrendExpanded,
    bsrTrendExpanded, ratingTrendExpanded, reviewTrendExpanded,
    imageTrendExpanded, ordersExpanded, gmsRevenueExpanded,
    availableMonths, visibleHistoryCols, formatMonthHeader, getTransitionStyle,
    isFirstCol, isSecondCol
  ]);

  // Empty state
  if (filteredAsins.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={80} style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-muted)' }}>No ASINs found matching current filters</div>
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'auto',
        ...style,
      }}
      className={className}
      {...restProps}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: `${visibleColumns.reduce((sum, c) => sum + c.width, 0)}px`,
          position: 'relative',
        }}
      >
        {/* Header row for column virtualization context */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '0', visibility: 'hidden', pointerEvents: 'none' }}>
          <table style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {visibleColumns.map((col, idx) => (
                  <th key={col.key} style={{ width: `${col.width}px`, minWidth: `${col.width}px`, maxWidth: `${col.width}px` }} />
                ))}
              </tr>
            </thead>
          </table>
        </div>
        
        {/* Virtualized rows */}
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const asin = filteredAsins[virtualRow.index];
          if (!asin) return null;

          return (
            <VirtualRow
              key={asin._id || virtualRow.index}
              asin={asin}
              index={virtualRow.index}
              visibleColumns={visibleColumns}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${visibleColumns.reduce((sum, c) => sum + c.width, 0)}px`,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              {...rowProps}
            />
          );
        })}
      </div>
    </div>
  );
}

export default VirtualizedTableBody;