import React, { memo } from 'react';
import { Package, Activity, Trophy, AlertTriangle, Zap, TrendingUp, BarChart2, Star, IndianRupee, Sparkles, TrendingDown, Award } from 'lucide-react';

const UNAVAILABLE_MARKERS = ['unavailable', 'out of stock', 'out_of_stock', 'currently unavailable'];

export const KPICards = memo(function KPICards({ stats, asins, onPriceClick, onRatingClick, onBsrClick, onReviewClick }) {
  if (stats) {
    const reviewChange = stats.reviewAnalysis?.currentVsPreviousChange || 0;
    const reviewTrend = reviewChange >= 0 ? '↑' : '↓';
    const reviewColor = reviewChange >= 0 ? 'var(--text-success)' : 'var(--text-danger)';
    const bestSeller = stats.bestSellingAsins?.[0];

    const totalNum = Number(stats.total) || 0;
    const activeNum = Number(stats.active) || 0;
    const uniqueParents = Number(stats.uniqueParents) || 1;
    const totalReviews = Number(stats.totalReviews) || 0;
    const avgReviewsPerParent = uniqueParents > 0 ? Math.round(totalReviews / uniqueParents) : 0;
    const avgPriceNum = parseFloat(stats.avgPrice) || 0;
    const avgLqsNum = parseFloat(stats.avgLQS) || 0;

    const kpis = [
      {
        label: 'ALL ASINS',
        value: totalNum.toLocaleString(),
        color: 'var(--text-brand)',
        icon: <Package size={14} />,
        sub: `${uniqueParents} parent groups`,
      },
      {
        label: 'ACTIVE ASINS',
        value: activeNum.toLocaleString(),
        color: 'var(--text-success)',
        icon: <Activity size={14} />,
        sub: `${totalNum - activeNum} inactive`,
      },
      {
        label: 'TOTAL REVIEWS',
        value: totalReviews.toLocaleString(),
        color: 'var(--color-secondary)',
        icon: <Star size={14} />,
        sub: `Avg ${avgReviewsPerParent.toLocaleString()}/parent`,
        onClick: onRatingClick,
      },
      {
        label: 'AVG RATING',
        value: `${stats.avgRating || '0.00'} ★`,
        color: 'var(--text-warning)',
        icon: <Trophy size={14} />,
        sub: `${stats.above4Star || 0} above 4★`,
        onClick: onRatingClick,
      },
      {
        label: 'BEST SELLER',
        value: bestSeller ? `#${(bestSeller.BSR || bestSeller.bsr || 0).toLocaleString()}` : '-',
        sub: bestSeller?.AsinCode || bestSeller?.asinCode || '',
        color: 'var(--text-brand)',
        icon: <Award size={14} />,
        onClick: onBsrClick,
      },
      {
        label: 'AVG PRICE',
        value: '₹' + avgPriceNum.toLocaleString(),
        color: 'var(--color-secondary)',
        icon: <IndianRupee size={14} />,
        onClick: onPriceClick,
      },
      {
        label: 'AVG LQS',
        value: avgLqsNum.toFixed(1) + '%',
        color: 'var(--color-secondary)',
        icon: <Sparkles size={14} />,
      },
      {
        label: 'REVIEWS (7D)',
        value: `${reviewTrend} ${Math.abs(reviewChange)}%`,
        color: reviewColor,
        icon: <TrendingUp size={14} />,
        sub: `${stats.reviewAnalysis?.currentWeek || 0} vs ${stats.reviewAnalysis?.previousWeek || 0}`,
        onClick: onReviewClick,
      },
    ];

    return (
      <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: '52px', transition: 'all 0.3s ease' }}>
        <div className="px-3 py-1 d-flex align-items-center gap-2 overflow-x-auto" style={{ width: '100%' }}>
          {kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="bg-white border shadow-sm d-flex align-items-center gap-2 px-3"
              style={{
                height: '32px',
                minWidth: 'max-content',
                flexShrink: 0,
                cursor: kpi.onClick ? 'pointer' : 'default',
                borderRadius: '6px',
                borderColor: 'var(--border-light)',
              }}
              onClick={kpi.onClick}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: kpi.color,
                  flexShrink: 0,
                }}
              />
              <span className="text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.03em', color: kpi.color, whiteSpace: 'nowrap' }}>
                {kpi.label}
              </span>
              <span className="fw-bolder ms-1" style={{ fontSize: 'var(--font-size-xs)', color: '#09090b' }}>
                {kpi.value}
              </span>
              {kpi.sub && (
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '2px' }}>
                  ({kpi.sub})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback when stats not available
  const total = asins?.length || 0;
  return (
    <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: '52px', transition: 'all 0.3s ease' }}>
      <div className="px-3 py-1 d-flex align-items-center gap-2 overflow-x-auto" style={{ width: '100%' }}>
        <div className="bg-white border shadow-sm d-flex align-items-center gap-2 px-3" style={{ height: '32px', minWidth: 'max-content', flexShrink: 0, borderRadius: '6px', borderColor: 'var(--border-light)' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-brand)', flexShrink: 0 }} />
          <span className="text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.03em', color: 'var(--text-brand)', whiteSpace: 'nowrap' }}>ALL ASINS</span>
          <span className="fw-bolder ms-1" style={{ fontSize: 'var(--font-size-xs)', color: '#09090b' }}>{total.toLocaleString()}</span>
        </div>
        <div className="bg-white border shadow-sm d-flex align-items-center gap-2 px-3" style={{ height: '32px', minWidth: 'max-content', flexShrink: 0, borderRadius: '6px', borderColor: 'var(--border-light)' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-success)', flexShrink: 0 }} />
          <span className="text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.03em', color: 'var(--text-success)', whiteSpace: 'nowrap' }}>ACTIVE</span>
          <span className="fw-bolder ms-1" style={{ fontSize: 'var(--font-size-xs)', color: '#09090b' }}>{asins.filter(a => a.status === 'Active').length}</span>
        </div>
      </div>
    </div>
  );
}

export default KPICards;