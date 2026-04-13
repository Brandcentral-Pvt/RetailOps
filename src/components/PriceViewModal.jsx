import React, { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Filter, ArrowRight, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { createPortal } from 'react-dom';

const PriceViewModal = ({ asins, selectedAsin, isOpen, onClose }) => {
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [showComparison, setShowComparison] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, customStartDate, customEndDate, searchQuery]);

  // Skeleton effect
  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const asinsToProcess = selectedAsin ? [selectedAsin] : (Array.isArray(asins) ? asins : []);

  const getWeekComparison = (item, week, wIdx, weeks) => {
    if (!showComparison || wIdx <= 0) return null;

    const currentWeekPrices = [];
    const prevWeekPrices = [];

    week.dates.forEach(d => {
      const currPrice = item.weekData?.[week.weekKey]?.[d.dateKey];
      if (currPrice !== undefined) currentWeekPrices.push(currPrice);
    });

    const prevWeek = weeks[wIdx - 1];
    prevWeek.dates.forEach(d => {
      const prevPrice = item.weekData?.[prevWeek.weekKey]?.[d.dateKey];
      if (prevPrice !== undefined) prevWeekPrices.push(prevPrice);
    });

    if (currentWeekPrices.length > 0 && prevWeekPrices.length > 0) {
      const avgCurr = currentWeekPrices.reduce((a, b) => a + b, 0) / currentWeekPrices.length;
      const avgPrev = prevWeekPrices.reduce((a, b) => a + b, 0) / prevWeekPrices.length;
      const change = avgCurr - avgPrev;
      const percent = avgPrev > 0 ? (change / avgPrev) * 100 : 0;

      return { avgCurr, avgPrev, change, percent };
    }
    return null;
  };

  const handleExportCSV = (data, weeks) => {
    const headers = ['ASIN', 'Title', 'Uploaded Price', 'Live Price'];
    const dateColumns = [];
    weeks.forEach(w => w.dates.forEach(d => dateColumns.push(d.dateKey)));

    const csvContent = [
      [...headers, ...dateColumns].join(','),
      ...data.map(item => [
        item.asinCode,
        `"${item.title.replace(/"/g, '""')}"`,
        item.uploadedPrice,
        item.currentPrice,
        ...dateColumns.map(dKey => {
          const wKey = Object.keys(item.weekData).find(wk => item.weekData[wk][dKey] !== undefined);
          return wKey ? item.weekData[wKey][dKey] : '';
        })
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `price_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFilteredDates = () => {
    const now = new Date();
    let startDate = null;
    let endDate = now;

    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else if (dateFilter === '7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '14days') {
      startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '30days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  };

  const handleCustomDateChange = (field, value) => {
    const selectedDate = new Date(value);
    const today = new Date();
    const diffDays = Math.ceil((today - selectedDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return;

    if (field === 'startDate') {
      setCustomStartDate(value);
      if (customEndDate) {
        const endDate = new Date(customEndDate);
        const daysDiff = Math.ceil((endDate - selectedDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          const maxStartDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          setCustomStartDate(maxStartDate.toISOString().split('T')[0]);
        }
      }
    } else {
      setCustomEndDate(value);
      if (customStartDate) {
        const startDate = new Date(customStartDate);
        const daysDiff = Math.ceil((selectedDate - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          const minEndDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          setCustomEndDate(minEndDate.toISOString().split('T')[0]);
        }
      }
    }
  };

  const maxDate = new Date().toISOString().split('T')[0];
  const minDate = new Date(new Date().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const processPriceData = useMemo(() => {
    if (!asinsToProcess || asinsToProcess.length === 0) return { weeks: [], asins: [] };

    console.log('Processing ASINs:', asinsToProcess.slice(0, 2).map(a => ({
      asinCode: a.asinCode,
      hasWeekHistory: !!a.weekHistory,
      weekHistoryLength: a.weekHistory?.length,
      weekHistorySample: a.weekHistory?.[0]
    })));

    const { startDate, endDate } = getFilteredDates();

    const allDates = new Map();

    asinsToProcess.forEach(asin => {
      const history = asin.weekHistory || asin.history || [];
      history.forEach(h => {
        const date = new Date(h.date || h.week);
        if (startDate && date < startDate) return;
        if (endDate && date > endDate) return;
        const dateKey = date.toISOString().split('T')[0];
        if (!allDates.has(dateKey)) {
          allDates.set(dateKey, date);
        }
      });
    });

    const sortedDates = Array.from(allDates.keys()).sort();

    const weekMap = new Map();
    sortedDates.forEach(dateKey => {
      const date = new Date(dateKey);
      const weekNum = getWeekNumber(date);
      const weekKey = `W${weekNum}`;
      const year = date.getFullYear();
      const fullWeekKey = `${year}-${weekKey}`;

      if (!weekMap.has(fullWeekKey)) {
        weekMap.set(fullWeekKey, {
          weekKey: fullWeekKey,
          shortKey: weekKey,
          year,
          dates: []
        });
      }
      weekMap.get(fullWeekKey).dates.push({
        dateKey,
        date
      });
    });

    const weeks = Array.from(weekMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return parseInt(a.shortKey.slice(1)) - parseInt(b.shortKey.slice(1));
    });

    const asinsData = asinsToProcess
      .filter(asin => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return asin.asinCode?.toLowerCase().includes(query) ||
          asin.title?.toLowerCase().includes(query);
      })
      .map(asin => {
        const history = asin.weekHistory || asin.history || [];
        const historyMap = new Map();
        history.forEach(h => {
          // Fix for date/week and price/currentPrice keys
          const dateVal = h.date || h.week || h.timestamp;
          if (!dateVal) return;
          const dateKey = new Date(dateVal).toISOString().split('T')[0];
          const priceVal = h.price !== undefined ? h.price : (h.currentPrice !== undefined ? h.currentPrice : 0);
          historyMap.set(dateKey, priceVal);
        });

        const weekData = {};
        weeks.forEach(week => {
          week.dates.forEach(d => {
            const price = historyMap.get(d.dateKey);
            if (price !== undefined) {
              if (!weekData[week.weekKey]) weekData[week.weekKey] = {};
              weekData[week.weekKey][d.dateKey] = price;
            }
          });
        });

        return {
          asinCode: asin.asinCode,
          title: asin.title || 'Untitled Product',
          uploadedPrice: asin.uploadedPrice !== undefined ? asin.uploadedPrice : (asin.price || 0),
          currentPrice: asin.currentPrice !== undefined ? asin.currentPrice : (asin.price || 0),
          weekData
        };
      });

    return { weeks, asins: asinsData };
  }, [asins, selectedAsin, dateFilter, customStartDate, customEndDate, searchQuery, asinsToProcess]);

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  const toggleWeek = (weekKey) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  if (!isOpen) return null;

  const { weeks, asins: asinsData } = processPriceData;

  console.log('PriceViewModal debug:', {
    isOpen,
    asinsLength: asins?.length,
    asinsToProcessLength: asinsToProcess.length,
    weeksLength: weeks.length,
    asinsDataLength: asinsData.length
  });

  // Pagination
  const totalItems = asinsData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAsins = asinsData.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return createPortal(
    <div
      className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-2"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .price-modal-fade { animation: priceModalFade 0.25s ease-out; }
        @keyframes priceModalFade { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .week-toggle { cursor: pointer; user-select: none; transition: all 0.2s; }
        .week-toggle:hover { background-color: #f1f5f9; }
        .day-cell { font-size: 0.75rem; border-left: 1px solid #e2e8f0; color: #334155; }
        .week-header { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
        .day-header { background: #ffffff; color: #64748b; font-weight: 600; }
        .sticky-col-1 { position: sticky; left: 0; z-index: 10; background: white; width: 160px; min-width: 160px; border-right: 2px solid #f1f5f9; }
        .sticky-col-2 { position: sticky; left: 160px; z-index: 10; background: white; width: 100px; min-width: 100px; }
        .sticky-col-3 { position: sticky; left: 260px; z-index: 10; background: white; width: 100px; min-width: 100px; border-right: 2px solid #f1f5f9; }
        thead tr:first-child th.sticky-col-1,
        thead tr:first-child th.sticky-col-2,
        thead tr:first-child th.sticky-col-3 { z-index: 20; background: #f1f5f9; }
        .skeleton-row { height: 60px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.5s infinite; }
        @keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        
        /* Zebra-striping for better row tracking */
        tbody tr:nth-child(even) td { background-color: #fcfcfd; }
        tbody tr:nth-child(even) .sticky-col-1, 
        tbody tr:nth-child(even) .sticky-col-2, 
        tbody tr:nth-child(even) .sticky-col-3 { background-color: #fcfcfd; }
        
        .price-text-stable { color: #1e293b; font-weight: 500; } /* Slate 800 */
        .price-text-positive { color: #065f46; font-weight: 700; } /* Dark Emerald 800 */
        .price-text-negative { color: #991b1b; font-weight: 700; } /* Dark Red 800 */
        .price-text-live { color: #1d4ed8; font-weight: 700; } /* Bold Blue 700 */
        .comparison-cell { background-color: #fffbeb !important; border-left: 1px solid #fef3c7; }
      `}</style>

      <div
        className="bg-white rounded-3 shadow-lg overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '100vw',
          maxHeight: '95vh',
          animation: 'priceModalFade 0.25s ease-out'
        }}
      >
        <div className="p-4 border-bottom bg-gradient-to-r from-emerald-50 to-teal-50 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp size={24} className="text-emerald-600" />
            </div>
            <div>
              <h4 className="mb-0 fw-bold text-slate-800">Price History - Day Wise</h4>
              <p className="mb-0 text-muted small">Week-over-week price tracking by day</p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-grow-1 mx-4">
            <div className="input-group input-group-sm" style={{ maxWidth: '300px' }}>
              <span className="input-group-text bg-white border-end-0"><Filter size={14} className="text-muted" /></span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search ASIN or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
              onClick={() => handleExportCSV(asinsData, weeks)}
            >
              Export CSV
            </button>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="form-check form-switch d-flex align-items-center gap-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="comparisonToggle"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
              />
              <label className="form-check-label small text-muted" htmlFor="comparisonToggle">
                Show Comparison
              </label>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="position-relative d-flex align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{ width: '150px' }}
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="14days">Last 14 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
                {dateFilter === 'custom' && (
                  <div className="badge bg-light text-dark border p-1" title="Max range is 7 days">
                    <TrendingUp size={12} className="text-info" />
                    <span className="ms-1 fw-normal" style={{ fontSize: '0.65rem' }}>Max 7d</span>
                  </div>
                )}
              </div>
              {dateFilter === 'custom' && (
                <div className="d-flex align-items-center gap-1 ms-2">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={customStartDate}
                    onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                    min={minDate}
                    max={maxDate}
                    style={{ width: '130px' }}
                  />
                  <span className="text-muted">to</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={customEndDate}
                    onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                    min={customStartDate || minDate}
                    max={maxDate}
                    style={{ width: '130px' }}
                  />
                </div>
              )}
            </div>
            <button onClick={onClose} className="btn btn-light rounded-circle p-2">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 'calc(95vh - 80px)' }}>
          <table className="table table-bordered table-hover mb-0" style={{ minWidth: '1200px' }}>
            <thead className="position-sticky top-0 bg-white z-index-1">
              <tr>
                <th rowSpan={2} className="px-3 py-3 sticky-col-1">
                  ASIN
                </th>
                <th rowSpan={2} className="px-3 py-3 text-center sticky-col-2">
                  Uploaded Price
                </th>
                <th rowSpan={2} className="px-3 py-3 text-center sticky-col-3">
                  Live Price
                </th>
                {weeks.map(week => {
                  const isExpanded = expandedWeeks[week.weekKey] !== false; // Default to true if undefined
                  return (
                    <React.Fragment key={week.weekKey}>
                      <th
                        colSpan={isExpanded ? (week.dates.length + (showComparison ? 1 : 0)) : 1}
                        className="px-2 py-2 text-center week-header week-toggle"
                        onClick={() => toggleWeek(week.weekKey)}
                        style={{ minWidth: isExpanded ? `${(week.dates.length + (showComparison ? 1 : 0)) * 80}px` : '100px' }}
                      >
                        <div className="d-flex align-items-center justify-content-center gap-1">
                          {week.shortKey} {isExpanded ? '▼' : '▶'}
                          {!isExpanded && <span className="badge bg-white text-dark small" style={{ fontSize: '0.6rem' }}>Avg</span>}
                        </div>
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
              <tr>
                {weeks.map((week, wIdx) => {
                  const isExpanded = expandedWeeks[week.weekKey] !== false;
                  if (!isExpanded) return null;
                  return (
                    <React.Fragment key={`${week.weekKey}-days`}>
                      {week.dates.map(d => (
                        <th
                          key={d.dateKey}
                          className="px-1 py-1 text-center day-header day-cell"
                          style={{ minWidth: '70px', fontSize: '0.7rem' }}
                        >
                          {d.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </th>
                      ))}
                      {showComparison && wIdx > 0 && (
                        <th className="px-1 py-1 text-center comparison-cell" style={{ minWidth: '95px' }}>
                          <div className="d-flex align-items-center justify-content-center gap-1">
                            <ArrowRight size={10} className="text-amber-600" />
                            <span className="text-amber-800" style={{ fontSize: '0.65rem', fontWeight: 700 }}>vs W{wIdx}</span>
                          </div>
                        </th>
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td className="sticky-col-1"><div className="skeleton-row w-100 rounded"></div></td>
                    <td className="sticky-col-2"><div className="skeleton-row w-100 rounded"></div></td>
                    <td className="sticky-col-3"><div className="skeleton-row w-100 rounded"></div></td>
                    <td colSpan={weeks.length * 5}><div className="skeleton-row w-100 rounded"></div></td>
                  </tr>
                ))
              ) : paginatedAsins.map((item, idx) => (
                <tr key={idx} className="border-bottom">
                  <td className="px-3 py-2 sticky-col-1">
                    <div className="d-flex flex-column">
                      <span className="fw-medium font-monospace" style={{ fontSize: '0.85rem' }}>
                        {item.asinCode}
                      </span>
                      <span className="text-muted text-truncate" style={{ maxWidth: '120px', fontSize: '0.7rem' }}>
                        {item.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center sticky-col-2">
                    <span className="price-text-stable">₹{item.uploadedPrice.toLocaleString()}</span>
                  </td>
                  <td className="px-3 py-2 text-center sticky-col-3">
                    <span className="price-text-live">₹{item.currentPrice.toLocaleString()}</span>
                  </td>
                  {weeks.map((week, wIdx) => {
                    const isExpanded = expandedWeeks[week.weekKey] !== false;
                    const comp = getWeekComparison(item, week, wIdx, weeks);

                    if (!isExpanded) {
                      const prices = Object.values(item.weekData[week.weekKey] || {});
                      const avg = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length) : null;
                      return (
                        <td key={`${week.weekKey}-collapsed`} className="text-center" style={{ backgroundColor: '#f8fafc' }}>
                          {avg !== null ? <span className="fw-bold text-slate-700">₹{Math.round(avg).toLocaleString()}</span> : '-'}
                        </td>
                      );
                    }

                    return (
                      <React.Fragment key={week.weekKey}>
                        {week.dates.map(d => {
                          const price = item.weekData?.[week.weekKey]?.[d.dateKey];
                          return (
                            <td
                              key={`${week.weekKey}-${d.dateKey}`}
                              className="px-1 py-2 text-center day-cell"
                              style={{ backgroundColor: '#f9fafb' }}
                            >
                              {price !== undefined ? (
                                <span className="price-text-positive">₹{price.toLocaleString()}</span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          );
                        })}
                        {showComparison && wIdx > 0 && (
                          <td className="px-1 py-2 text-center comparison-cell" style={{ minWidth: '95px' }}>
                            {comp ? (
                              <div className={`d-flex flex-column align-items-center gap-0`}>
                                <span className={`fw-bold small ${comp.change > 0 ? 'price-text-negative' : comp.change < 0 ? 'price-text-positive' : 'text-slate-500'}`}>
                                  {comp.change > 0 ? '▲' : comp.change < 0 ? '▼' : ''} {Math.abs(comp.percent).toFixed(1)}%
                                </span>
                                <span className="text-slate-500 fw-medium" style={{ fontSize: '0.65rem' }}>
                                  {comp.change > 0 ? '+' : comp.change < 0 ? '-' : ''}₹{Math.abs(Math.round(comp.change))}
                                </span>
                              </div>
                            ) : <span className="text-muted">-</span>}
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              {asinsData.length === 0 && (
                <tr>
                  <td colSpan={3 + weeks.reduce((sum, w, i) => sum + w.dates.length + (showComparison && i > 0 ? 1 : 0), 0)} className="text-center py-5 text-muted">
                    No price data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-top bg-light d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">Show</span>
            <select
              className="form-select form-select-sm"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ width: '70px' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-muted small">entries</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
            </span>
            <div className="d-flex align-items-center gap-1">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={i}
                    className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-dark fw-medium px-4">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PriceViewModal;