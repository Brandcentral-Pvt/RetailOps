import React, { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Filter, Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

const BSRViewModal = ({ asins, selectedAsin, isOpen, onClose }) => {
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
    
    const currentWeekBsrs = [];
    const prevWeekBsrs = [];
    
    week.dates.forEach(d => {
      const curr = item.weekData?.[week.weekKey]?.[d.dateKey];
      if (curr && curr.bsr !== undefined) currentWeekBsrs.push(curr.bsr);
    });
    
    const prevWeek = weeks[wIdx - 1];
    prevWeek.dates.forEach(d => {
      const prev = item.weekData?.[prevWeek.weekKey]?.[d.dateKey];
      if (prev && prev.bsr !== undefined) prevWeekBsrs.push(prev.bsr);
    });

    if (currentWeekBsrs.length > 0 && prevWeekBsrs.length > 0) {
      const avgCurr = currentWeekBsrs.reduce((a, b) => a + b, 0) / currentWeekBsrs.length;
      const avgPrev = prevWeekBsrs.reduce((a, b) => a + b, 0) / prevWeekBsrs.length;
      const change = avgCurr - avgPrev; // Negative change is good in BSR
      const percent = avgPrev > 0 ? (change / avgPrev) * 100 : 0;
      
      return { avgCurr, avgPrev, change, percent };
    }
    return null;
  };

  const handleExportCSV = (data, weeks) => {
    const headers = ['ASIN', 'Title', 'Current BSR'];
    const dateColumns = [];
    weeks.forEach(w => w.dates.forEach(d => dateColumns.push(d.dateKey)));
    
    const csvContent = [
      [...headers, ...dateColumns].join(','),
      ...data.map(item => [
        item.asinCode,
        `"${item.title.replace(/"/g, '""')}"`,
        item.currentBsr,
        ...dateColumns.map(dKey => {
          const wKey = Object.keys(item.weekData).find(wk => item.weekData[wk][dKey] !== undefined);
          return wKey ? item.weekData[wKey][dKey].bsr : '';
        })
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `bsr_history_${new Date().toISOString().split('T')[0]}.csv`);
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

  const processBsrData = useMemo(() => {
    if (!asinsToProcess || asinsToProcess.length === 0) return { weeks: [], asins: [] };

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
          const dateVal = h.date || h.week || h.timestamp;
          if (!dateVal) return;
          const dateKey = new Date(dateVal).toISOString().split('T')[0];
          historyMap.set(dateKey, { bsr: h.bsr, subBSRs: h.subBSRs });
        });

        const weekData = {};
        weeks.forEach(week => {
          week.dates.forEach(d => {
            const data = historyMap.get(d.dateKey);
            if (data && data.bsr !== undefined) {
              if (!weekData[week.weekKey]) weekData[week.weekKey] = {};
              weekData[week.weekKey][d.dateKey] = data;
            }
          });
        });

        return {
          asinCode: asin.asinCode,
          title: asin.title || 'Untitled Product',
          currentBsr: asin.bsr || 0,
          subBSRs: asin.subBSRs || [],
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

  const { weeks, asins: asinsData } = processBsrData;

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

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-2"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .bsr-modal-fade { animation: bsrModalFade 0.25s ease-out; }
        @keyframes bsrModalFade { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .week-toggle { cursor: pointer; user-select: none; transition: all 0.2s; }
        .week-toggle:hover { background-color: #ecfdf5; }
        .day-cell { font-size: 0.75rem; border-left: 1px solid #f1f5f9; }
        .week-header { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); }
        .day-header { background: #f0fdf4; }
        .sticky-col-1 { position: sticky; left: 0; z-index: 10; background: white; width: 160px; min-width: 160px; }
        .sticky-col-2 { position: sticky; left: 160px; z-index: 10; background: white; width: 100px; min-width: 100px; }
        thead tr:first-child th.sticky-col-1,
        thead tr:first-child th.sticky-col-2 { z-index: 20; background: #f8fafc; }
        .skeleton-row { height: 60px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.5s infinite; }
        @keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      
      <div 
        className="bg-white rounded-3 shadow-lg overflow-hidden"
        style={{ 
          width: '100%', 
          maxWidth: '100vw', 
          maxHeight: '95vh',
          animation: 'bsr-modal-fade 0.25s ease-out'
        }}
      >
        <div className="p-4 border-bottom bg-gradient-to-r from-emerald-50 to-green-50 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Award size={24} className="text-emerald-600" />
            </div>
            <div>
              <h4 className="mb-0 fw-bold text-slate-800">BSR History - Day Wise</h4>
              <p className="mb-0 text-muted small">Week-over-week BSR tracking by day (Lower is better)</p>
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
                  Current BSR
                </th>
                {weeks.map(week => {
                  const isExpanded = expandedWeeks[week.weekKey] !== false;
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
                          {!isExpanded && <span className="badge bg-white text-dark small" style={{fontSize: '0.6rem'}}>Avg</span>}
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
                        <th className="px-1 py-1 text-center" style={{ background: '#fef3c7', minWidth: '90px' }}>
                          <div className="d-flex align-items-center justify-content-center gap-1">
                            <ArrowRight size={10} />
                            <span style={{ fontSize: '0.65rem' }}>vs W{wIdx}</span>
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
                    <div className="d-flex flex-column align-items-center">
                      <span className="fw-semibold text-success">#{item.currentBsr.toLocaleString()}</span>
                      {item.subBSRs.length > 0 && (
                        <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                          {item.subBSRs.slice(0, 2).map(s => `#${s}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </td>
                  {weeks.map((week, wIdx) => {
                    const isExpanded = expandedWeeks[week.weekKey] !== false;
                    const comp = getWeekComparison(item, week, wIdx, weeks);
                    
                    if (!isExpanded) {
                      const dataArr = Object.values(item.weekData[week.weekKey] || {});
                      const avg = dataArr.length > 0 ? (dataArr.reduce((a, b) => a + b.bsr, 0) / dataArr.length) : null;
                      return (
                        <td key={`${week.weekKey}-collapsed`} className="text-center bg-light">
                          {avg !== null ? <span className="fw-bold text-success">#{Math.round(avg).toLocaleString()}</span> : '-'}
                        </td>
                      );
                    }

                    return (
                      <React.Fragment key={week.weekKey}>
                        {week.dates.map(d => {
                          const data = item.weekData?.[week.weekKey]?.[d.dateKey];
                          return (
                            <td 
                              key={`${week.weekKey}-${d.dateKey}`} 
                              className="px-1 py-2 text-center day-cell"
                              style={{ backgroundColor: '#f9fafb' }}
                            >
                              {data && data.bsr !== undefined ? (
                                <span className="text-success fw-medium">#{data.bsr.toLocaleString()}</span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          );
                        })}
                        {showComparison && wIdx > 0 && (
                          <td className="px-1 py-2 text-center" style={{ background: '#fef3c7', minWidth: '90px' }}>
                            {comp ? (
                              <div className={`d-flex flex-column align-items-center gap-0`}>
                                <div className="d-flex align-items-center gap-1">
                                  {comp.change < 0 ? <TrendingUp size={10} className="text-success" /> : <TrendingDown size={10} className="text-danger" />}
                                  <span className={`fw-bold small ${comp.change < 0 ? 'text-success' : 'text-danger'}`}>
                                    {Math.abs(comp.percent).toFixed(1)}%
                                  </span>
                                </div>
                                <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                                  {comp.change < 0 ? '-' : '+'}{Math.abs(Math.round(comp.change))} rank
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
                  <td colSpan={2 + weeks.reduce((sum, w) => sum + w.dates.length, 0)} className="text-center py-5 text-muted">
                    No BSR data available
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

export default BSRViewModal;