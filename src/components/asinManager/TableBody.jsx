import React from 'react';
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

export function TableBody({
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
  priceTrendExpanded: _priceTrendExpanded, // eslint-disable-line no-unused-vars
  bsrTrendExpanded: _bsrTrendExpanded,
  ratingTrendExpanded: _ratingTrendExpanded,
  reviewTrendExpanded: _reviewTrendExpanded,
  imageTrendExpanded: _imageTrendExpanded,
  ordersExpanded: _ordersExpanded,
  gmsRevenueExpanded: _gmsRevenueExpanded,
}) => {
  const normalizeDateStr = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
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

  if (filteredAsins.length === 0) {
    return null; // Parent handles empty state
  }

  return (
    <tbody>
      {filteredAsins.map((asin, idx) => {
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

        // Sticky column positions
        const isFirstCol = isVisible('checkbox');
        const isSecondCol = isVisible('asinCode');

        return (
          <tr key={asin._id || idx} className={rowClass}>
            {isVisible('checkbox') && (
              <td className={`asin-grid__sticky ${isFirstCol ? 'asin-grid__sticky--select' : ''}`} style={{
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

            {isVisible('releaseDate') && (
              <td style={{ ...tdStyle, width: '85px', textAlign: 'center' }}>
                {asin.releaseDate ? asin.releaseDate.split('T')[0] : '-'}
              </td>
            )}

            {isVisible('parentAsin') && (
              <td style={{ ...tdStyle, width: '110px' }}>
                {asin.parentAsin || '-'}
              </td>
            )}

            {isVisible('sellerBrand') && (
              <td style={{ ...tdStyle, width: '115px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 500 }}>{asin.sellerName || asin.SellerName || '-'}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{asin.brand || asin.Brand || '-'}</span>
                </div>
              </td>
            )}

            {isVisible('sku') && (
              <td style={{ ...tdStyle, width: '95px' }}>
                {asin.sku || asin.SKU || '-'}
              </td>
            )}

            {isVisible('title') && (
              <td style={{ ...tdStyle, width: '220px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

            {isVisible('category') && (
              <td style={{ ...tdStyle, width: '135px' }}>
                {asin.category || asin.Category || '-'}
              </td>
            )}

            {isVisible('tags') && (
              <td style={{ ...tdStyle, width: '100px' }}>
                <TagsCell tags={asin.Tags || asin.tags} maxVisible={3} />
              </td>
            )}

            {/* Deal & Manufacturer Columns */}
            {isVisible('manufacturer') && (
              <td style={{ ...tdStyle, width: '120px', textAlign: 'left' }}>
                {asin.manufacturer || '-'}
              </td>
            )}
            {isVisible('availabilityStatus') && (
              <td style={{ ...tdStyle, width: '100px', textAlign: 'center' }}>
                <span className={`badge ${isUnavailableStatus(asin) ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: '9px' }}>
                  {asin.availabilityStatus || '-'}
                </span>
              </td>
            )}
            {isVisible('ads') && (
              <td style={{ ...tdStyle, width: '60px', textAlign: 'center' }}>
                <span className={asin.Ads || asin.ads ? 'text-success' : 'text-muted'}>
                  {asin.Ads || asin.ads ? 'Yes' : 'No'}
                </span>
              </td>
            )}
            {isVisible('ads') && (
              <td style={{ ...tdStyle, width: '50px', textAlign: 'center' }}>
                <span className={asin.hasGms ? 'text-primary' : 'text-muted'}>
                  {asin.hasGms ? 'Yes' : 'No'}
                </span>
              </td>
            )}

            {/* Orders Columns */}
            {visibleOrdersCount > 0 && isVisible('totalOrders') && (
              <>
                {ordersExpanded && availableMonths.map((month, monthIdx) => (
                  <td key={`ord-${month}`} style={{
                    ...tdStyle,
                    textAlign: 'center',
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
                    ...tdStyle,
                    textAlign: 'center',
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

            {isVisible('dealBadge') && (
              <td style={{ ...tdStyle, width: '80px', textAlign: 'center' }}>
                {asin.dealBadge ? (
                  <TrendBadge value={asin.dealBadge} type="deal" />
                ) : '-'}
              </td>
            )}
            {isVisible('dealStartTime') && (
              <td style={{ ...tdStyle, width: '90px', textAlign: 'center' }}>
                {asin.dealStartTime ? asin.dealStartTime.split('T')[0] : '-'}
              </td>
            )}
            {isVisible('dealEndTime') && (
              <td style={{ ...tdStyle, width: '90px', textAlign: 'center' }}>
                {asin.dealEndTime ? asin.dealEndTime.split('T')[0] : '-'}
              </td>
            )}
            {isVisible('dealAccessType') && (
              <td style={{ ...tdStyle, width: '80px', textAlign: 'center' }}>
                {asin.dealAccessType || '-'}
              </td>
            )}
            {isVisible('currentBuybox') && (
              <td style={{ ...tdStyle, width: '140px', textAlign: 'left' }}>
                {asin.soldBy || asin.SoldBy || asin.buyBoxSeller || '-'}
              </td>
            )}

            {/* Price Columns */}
            {isVisible('mrp') && (
              <td style={{ ...tdStyle, width: '85px', textAlign: 'right' }}>
                {formatCurrency(asin.mrp || asin.MRP || asin.mrpPrice || asin.MrpPrice)}
              </td>
            )}
            {isVisible('price') && (
              <td style={{ ...tdStyle, width: '85px', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatCurrency(asin.currentPrice || asin.CurrentPrice || asin.uploadedPrice || asin.UploadedPrice)}
                  </span>
                  {asin.priceDispute && <AlertTriangle size={12} className="text-amber-500" title="Price Dispute" />}
                </div>
              </td>
            )}
            {isVisible('discountPercentage') && (
              <td style={{ ...tdStyle, width: '85px', textAlign: 'center' }}>
                {asin.discountPercentage ? `${asin.discountPercentage}%` : '-'}
              </td>
            )}
            {isVisible('priceDispute') && (
              <td style={{ ...tdStyle, width: '85px', textAlign: 'center' }}>
                {asin.priceDispute ? (
                  <span className="badge bg-amber-100 text-amber-800" style={{ fontSize: '9px' }}>Disputed</span>
                ) : '-'}
              </td>
            )}

            {/* Price Trend Columns */}
            {visiblePriceTrendCount > 0 && (
              <>
                {historyStructure.map(week =>
                  week.dates.map((date, dateIdx) => (
                    <td key={`pt-${date.label}`} style={{
                      ...tdStyle,
                      textAlign: 'center',
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
            {isVisible('mainBsr') && (
              <td style={{ ...tdStyle, width: '90px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {asin.bsr || asin.BSR ? (
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{formatNumber(asin.bsr || asin.BSR)}</span>
                  ) : '-'}
                  {asin.bsrTrend && <span className={getBsrTrendClass(asin.bsrTrend)} title={asin.bsrTrend}>{asin.bsrTrend === 'Grow' ? '↑' : asin.bsrTrend === 'Down' ? '↓' : '→'}</span>}
                </div>
              </td>
            )}
            {isVisible('subBsr') && (
              <td style={{ ...tdStyle, width: '110px', transition: 'all 0.3s ease' }}>
                {asin.subBsr || asin.SubBsr || '-'}
                {asin.subBsrCategory && <span className="text-muted" style={{ fontSize: '10px', display: 'block' }}>{asin.subBsrCategory}</span>}
              </td>
            )}
            {isVisible('bsrTrendStatus') && (
              <td style={{ ...tdStyle, width: '75px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                {asin.bsrTrend ? (
                  <span className={`badge ${asin.bsrTrend === 'Grow' ? 'bg-success' : asin.bsrTrend === 'Down' ? 'bg-danger' : 'bg-warning'}`} style={{ fontSize: '9px' }}>
                    {asin.bsrTrend}
                  </span>
                ) : '-'}
              </td>
            )}
            {visibleBsrTrendCount > 0 && (
              <>
                {historyStructure.map(week =>
                  week.dates.map((date, dateIdx) => (
                    <td key={`bst-${date.label}`} style={{
                      ...tdStyle,
                      textAlign: 'center',
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
            {isVisible('rating') && (
              <td style={{ ...tdStyle, width: '60px', textAlign: 'center', transition: 'all 0.3s ease' }}>
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
            {isVisible('reviewCount') && (
              <td style={{ ...tdStyle, width: '65px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  {formatNumber(asin.reviewCount || asin.ReviewCount)}
                  {asin.ratingTrend && <span className={getRatingTrendClass(asin.ratingTrend)} title={asin.ratingTrend}>{asin.ratingTrend === 'Grow' ? '↑' : asin.ratingTrend === 'Down' ? '↓' : '→'}</span>}
                </div>
              </td>
            )}
            {isVisible('ratingBreakdown') && (
              <td style={{ ...tdStyle, width: '120px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                {asin.ratingBreakdown ? renderRatingBreakdown(asin.ratingBreakdown) : '-'}
              </td>
            )}
            {isVisible('ratingTrendStatus') && (
              <td style={{ ...tdStyle, width: '75px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                {asin.ratingTrend ? (
                  <span className={`badge ${asin.ratingTrend === 'Grow' ? 'bg-success' : asin.ratingTrend === 'Down' ? 'bg-danger' : 'bg-warning'}`} style={{ fontSize: '9px' }}>
                    {asin.ratingTrend}
                  </span>
                ) : '-'}
              </td>
            )}
            {visibleRatingTrendCount > 0 && (
              <>
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
            {isVisible('reviewCount') && (
              <td style={{ ...tdStyle, width: '75px', textAlign: 'center', transition: 'all 0.3s ease' }} title="Reviews Trend Status">
                {asin.reviewTrend ? (
                  <span className={`badge ${asin.reviewTrend === 'Grow' ? 'bg-success' : asin.reviewTrend === 'Down' ? 'bg-danger' : 'bg-warning'}`} style={{ fontSize: '9px' }}>
                    {asin.reviewTrend}
                  </span>
                ) : '-'}
              </td>
            )}
            {visibleReviewTrendCount > 0 && (
              <>
                {historyStructure.map(week =>
                  week.dates.map((date, dateIdx) => (
                    <td key={`rvt-${date.label}`} style={{
                      ...tdStyle,
                      textAlign: 'center',
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
            {isVisible('video') && (
              <td style={{ ...tdStyle, width: '65px', textAlign: 'center', transition: 'all 0.3s ease' }} title="Video Present">
                {asin.VideoCount || asin.videoCount || 0}
              </td>
            )}
            {isVisible('imagesCount') && (
              <td style={{ ...tdStyle, width: '55px', textAlign: 'center', transition: 'all 0.3s ease' }}>
                {asin.ImagesCount || asin.imagesCount || 0}
              </td>
            )}
            {visibleImageTrendCount > 0 && (
              <>
                {historyStructure.map(week =>
                  week.dates.map((date, dateIdx) => (
                    <td key={`imt-${date.label}`} style={{
                      ...tdStyle,
                      textAlign: 'center',
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
            {isVisible('bulletPoints') && (
              <td style={{ ...tdStyle, width: '35px', textAlign: 'center' }}>
                {asin.BulletPoints || asin.bulletPoints?.length || 0}
              </td>
            )}
            {isVisible('hasAplus') && (
              <td style={{ ...tdStyle, width: '55px', textAlign: 'center' }}>
                {asin.HasAplus || asin.hasAplus ? <span className="text-success fw-bold">✓</span> : '-'}
              </td>
            )}
            {isVisible('aplusDays') && (
              <td style={{ ...tdStyle, width: '50px', textAlign: 'center' }}>
                {asin.AplusDays || asin.aplusDays || '-'}
              </td>
            )}

            {/* Actions Column */}
            <td style={{
              ...tdStyle,
              width: '60px',
              textAlign: 'center',
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
        ))}
    </tbody>
  );
}

export default TableBody;