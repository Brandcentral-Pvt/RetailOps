import React from 'react';

export const generateHistoryStructure = (history) => {
  if (!history || history.length === 0) return [{ label: 'W1', dates: [{ label: 'N/A' }] }];
  const groups = {};
  [...history].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
    const weekLabel = item.week ? item.week.split('-')[0] : 'W?';
    if (!groups[weekLabel]) groups[weekLabel] = [];
    groups[weekLabel].push(item);
  });
  return Object.keys(groups).map(week => ({
    label: week,
    dates: groups[week].map(d => ({
      raw: d.date,
      label: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    }))
  }));
};

export const generateHistoryStructureFromDates = (sortedDates) => {
  if (!sortedDates || sortedDates.length === 0) return [{ label: 'W1', dates: [{ label: 'N/A' }] }];
  const recentDates = sortedDates.slice(-7);
  return [{
    label: 'Current Week',
    dates: recentDates.map(dateStr => {
      const date = new Date(`${dateStr}T00:00:00Z`);
      return {
        raw: dateStr,
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      };
    })
  }];
};

export const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

export const normalizeDateStr = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    return dateInput.substring(0, 10);
  }
  try {
    return new Date(dateInput).toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

export const getWeekHistoryBadge = (value, type, uploadedPrice = 0) => {
  if (value === undefined || value === null || value === '') return <span style={{ color: 'var(--text-muted)' }}>-</span>;

  if (type === 'price') {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center">
        <span style={{ fontWeight: 600, color: 'var(--text-success)', fontSize: '10.5px', lineHeight: 1 }}>
          ₹{value.toLocaleString()}
        </span>
      </div>
    );
  } else if (type === 'number') {
    return <span style={{ fontWeight: 600, color: 'var(--text-brand)', fontSize: '10.5px' }}>#{value.toLocaleString()}</span>;
  } else if (type === 'rating') {
    return <span style={{ fontWeight: 600, color: 'var(--text-warning)', fontSize: '10.5px' }}>{value.toFixed(1)}</span>;
  } else if (type === 'subBsr') {
    const clean = String(value).replace(/[^0-9]/g, '');
    if (!clean) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    const num = parseInt(clean, 10);
    if (isNaN(num)) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    return <span style={{ fontWeight: 600, color: 'var(--color-secondary)', fontSize: '10px' }}>#{num.toLocaleString()}</span>;
  }
  return value;
};

export const getReviewTrendStatus = (asin) => {
  if (asin.reviewTrendStatus) return asin.reviewTrendStatus;

  let history = [];
  try {
    history = asin.History ? (typeof asin.History === 'string' ? JSON.parse(asin.History) : asin.History) : [];
  } catch (e) {
    history = [];
  }

  if (!Array.isArray(history) || history.length < 2) return 'Stable';

  const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentReviews = asin.reviewCount || sortedHistory[sortedHistory.length - 1]?.reviews || sortedHistory[sortedHistory.length - 1]?.reviewCount || 0;

  const prevPoints = sortedHistory.slice(0, -1).filter(h => (h.reviews || h.reviewCount || 0) > 0);
  if (prevPoints.length === 0) return 'Stable';

  const baselineReviews = prevPoints[prevPoints.length - 1].reviews || prevPoints[prevPoints.length - 1].reviewCount || 0;

  if (currentReviews < baselineReviews) return 'Down';
  if (currentReviews > baselineReviews) return 'Grow';
  return 'Stable';
};
