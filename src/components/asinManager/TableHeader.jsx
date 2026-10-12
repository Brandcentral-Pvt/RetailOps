import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

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
  zIndex: 10,
  borderBottom: '1px solid var(--bc-border-subtle)',
  whiteSpace: 'nowrap',
  borderRight: '1px solid var(--bc-border-subtle)',
};

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
    whiteSpace: 'nowrap',
  };
};

const formatMonthHeader = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export function TableHeader({
  isVisible,
  marketplaceFilter,
  sortBy,
  sortOrder,
  handleSort,
  renderSortableHeader,
  viewMode,
  historyStructure,
  priceTrendExpanded,
  setPriceTrendExpanded,
  bsrTrendExpanded,
  setBsrTrendExpanded,
  ratingTrendExpanded,
  setRatingTrendExpanded,
  reviewTrendExpanded,
  setReviewTrendExpanded,
  imageTrendExpanded,
  setImageTrendExpanded,
  ordersExpanded,
  setOrdersExpanded,
  gmsRevenueExpanded,
  setGmsRevenueExpanded,
  availableMonths,
  visibleHistoryCols,
  visibleOrdersCount,
  visiblePriceTrendCount,
  visibleBsrTrendCount,
  visibleRatingTrendCount,
  visibleReviewTrendCount,
  visibleImageTrendCount,
}) => {
  return (
    <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
      <tr>
        {isVisible('checkbox') && (
          <th rowSpan={2} style={{ ...thStyle, width: '40px', left: 0, zIndex: 22, background: 'var(--bg-secondary)', textAlign: 'center', borderBottom: '2px solid var(--border-light)' }}>
            <input
              type="checkbox"
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

        {/* Deal & Manufacturer Columns */}
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
              {ordersExpanded ? <span>ORDERS</span> : renderSortableHeader('ORDERS', 'totalOrders', 'center')}
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

        {/* Price Columns */}
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
          <th colSpan={visiblePriceTrendCount} style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
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

        {/* BSR Columns */}
        {isVisible('mainBsr') && (
          <th rowSpan={2} style={{ ...thStyle, width: '90px', textAlign: 'center', transition: 'all 0.3s ease' }}>
            {renderSortableHeader('MAIN BSR', 'bsr', 'center')}
          </th>
        )}
        {isVisible('subBsr') && <th rowSpan={2} style={{ ...thStyle, width: '110px', transition: 'all 0.3s ease' }}>SUB BSR</th>}
        {isVisible('bsrTrendStatus') && <th rowSpan={2} style={{ ...thStyle, width: '75px', textAlign: 'center', transition: 'all 0.3s ease' }}>BSR TR</th>}
        {visibleBsrTrendCount > 0 && (
          <th colSpan={visibleBsrTrendCount} style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
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

        {/* Rating Columns */}
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
          <th colSpan={visibleRatingTrendCount} style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
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
          <th colSpan={visibleReviewTrendCount} style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
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

        {/* Visuals & Content Columns */}
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
          <th colSpan={visibleImageTrendCount} style={{ ...thStyle, textAlign: 'center', transition: 'all 0.3s ease' }}>
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

        {/* Actions column */}
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

      {/* Second row for expanded columns */}
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
  );
}

export default TableHeader;