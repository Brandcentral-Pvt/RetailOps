import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { X, TrendingUp, TrendingDown, Filter, ArrowRight, Star, ChevronLeft, ChevronRight, Calendar, ArrowUpDown, Search, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import api, { asinApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const RatingViewModal = ({ selectedAsin, isOpen, onClose }) => {
  const { isAdmin, user } = useAuth();
  const [dateFilter, setDateFilter] = useState('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [showComparison, setShowComparison] = useState(true);
  
  // Infinite Scroll State
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [sortField, setSortField] = useState('asinCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [globalMinDate, setGlobalMinDate] = useState(null);
  
  const scrollContainerRef = useRef(null);

  const fetchSellers = useCallback(async () => {
    try {
      const res = await api.get('/sellers');
      const sellerList = res?.data?.sellers || res?.data || [];
      setSellers(Array.isArray(sellerList) ? sellerList : []);
    } catch (err) {
      console.error('Error fetching sellers:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchSellers();
  }, [isOpen, fetchSellers]);

  const loadData = useCallback(async (pageNum = 1, append = false) => {
    if (!isOpen) return;
    
    try {
      if (pageNum === 1) setIsLoading(true);
      else setIsFetchingMore(true);

      const params = {
        page: pageNum,
        limit: 50,
        seller: selectedBrand === 'all' ? undefined : selectedBrand,
        search: searchQuery || undefined,
        sortBy: sortField.startsWith('day-') ? 'lastScraped' : sortField,
        sortOrder: sortOrder
      };

      const res = await asinApi.getAll(params);
      const newAsins = res?.asins || [];
      
      if (res?.minDate) setGlobalMinDate(new Date(res.minDate));
      
      setItems(prev => append ? [...prev, ...newAsins] : newAsins);
      setTotalCount(res?.pagination?.total || 0);
      setHasMore(newAsins.length === 50);
      setPage(pageNum);
      
    } catch (err) {
      console.error('Error loading ASINs for Rating modal:', err);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [isOpen, selectedBrand, searchQuery, sortField, sortOrder]);

  useEffect(() => {
    if (isOpen) {
      loadData(1, false);
    } else {
      setItems([]);
      setPage(1);
      setHasMore(true);
    }
  }, [isOpen, selectedBrand, searchQuery, sortField, sortOrder, loadData]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !isFetchingMore && !isLoading) {
      loadData(page + 1, true);
    }
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
    } else {
      // All time - use global min date if available, otherwise fallback to 90 days
      startDate = globalMinDate || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // Clamp to the absolute minimum date in the database to avoid showing empty leading columns
    if (globalMinDate && startDate < globalMinDate) {
      startDate = new Date(globalMinDate);
    }

    return { startDate, endDate };
  };

  // Generate Data-Driven Columns based on actual database entries
  const dateColumns = useMemo(() => {
    const { startDate, endDate } = getFilteredDates();
    
    // Collect all unique dates from all loaded items' histories
    const uniqueDateStrs = new Set();
    items.forEach(asin => {
      const history = asin.history || asin.weekHistory || [];
      history.forEach(h => {
        const d = h.date || h.week;
        if (d) {
          try {
            uniqueDateStrs.add(new Date(d).toISOString().split('T')[0]);
          } catch (e) { /* ignore malformed dates */ }
        }
      });
    });

    // Handle case where we have no history yet - show at least today
    if (uniqueDateStrs.size === 0) {
      uniqueDateStrs.add(new Date().toISOString().split('T')[0]);
    }

    // Filter and Sort the dates based on requested range
    const sortedDates = Array.from(uniqueDateStrs)
      .map(ds => new Date(ds))
      .filter(d => d >= startDate && d <= endDate)
      .sort((a, b) => b - a); // Newest first

    // Group into weeks for headers
    const weekMap = new Map();
    sortedDates.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const weekNum = getWeekNumber(date);
      const year = date.getFullYear();
      const weekKey = `${year}-W${weekNum}`;

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekKey,
          shortKey: `W${weekNum}`,
          year,
          dates: []
        });
      }
      weekMap.get(weekKey).dates.push({ dateKey, date });
    });

    return Array.from(weekMap.values());
  }, [items, dateFilter, customStartDate, customEndDate, globalMinDate]);

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  const processedItems = useMemo(() => {
    return items.map(asin => {
      const history = asin.history || asin.weekHistory || [];
      const historyMap = new Map();
      
      const sortedHistory = [...history].sort((a, b) => new Date(a.date || a.week) - new Date(b.date || b.week));
      let lastRating = asin.rating || 0;
      let lastReviews = asin.reviewCount || asin.reviews || 0;
      
      if (sortedHistory.length > 0) {
        const latest = sortedHistory[sortedHistory.length - 1];
        lastRating = latest.rating || lastRating;
        lastReviews = latest.reviewCount || latest.reviews || lastReviews;
      }

      sortedHistory.forEach(h => {
        const dateVal = h.date || h.week || h.timestamp;
        if (!dateVal) return;
        const dateKey = new Date(dateVal).toISOString().split('T')[0];
        if (h.rating) historyMap.set(dateKey, { rating: h.rating, reviews: h.reviewCount || h.reviews || lastReviews });
      });

      const weekData = {};
      dateColumns.forEach(week => {
        weekData[week.weekKey] = {};
        week.dates.forEach(d => {
          weekData[week.weekKey][d.dateKey] = historyMap.get(d.dateKey) || null;
        });
      });

      return {
        ...asin,
        id: asin._id || asin.id,
        processedWeekData: weekData,
        sellerName: sellers.find(s => s._id === asin.sellerId)?.name || 'Unknown'
      };
    });
  }, [items, dateColumns, sellers]);

  const displayItems = useMemo(() => {
    if (!sortField.startsWith('day-')) return processedItems;
    
    const dayKey = sortField.replace('day-', '');
    return [...processedItems].sort((a, b) => {
      let valA = 0; 
      let valB = 0;
      
      Object.values(a.processedWeekData).forEach(w => { if (w[dayKey]) valA = w[dayKey].rating; });
      Object.values(b.processedWeekData).forEach(w => { if (w[dayKey]) valB = w[dayKey].rating; });

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [processedItems, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleWeek = (weekKey) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  const handleExportCSV = (data, weeks) => {
    const headers = ['#', 'ASIN', 'Title', 'Brand', 'Live Rating', 'Live Reviews'];
    const dateHeaders = [];
    weeks.forEach(w => w.dates.forEach(d => dateHeaders.push(d.dateKey)));

    const csvRows = [
      [...headers, ...dateHeaders].join(','),
      ...data.map((item, idx) => [
        idx + 1,
        item.asinCode,
        `"${item.title.replace(/"/g, '""')}"`,
        `"${item.sellerName}"`,
        item.rating || 0,
        item.reviewCount || 0,
        ...dateHeaders.map(dKey => {
            let p = null;
            Object.values(item.processedWeekData).forEach(w => { if(w[dKey]) p = w[dKey].rating; });
            return p || '';
        })
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `rating_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-2"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .rating-modal-fade { animation: ratingModalFade 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes ratingModalFade { from { opacity: 0; transform: scale(0.98) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .week-toggle { cursor: pointer; user-select: none; transition: all 0.2s; position: relative; }
        .week-toggle:hover { background-color: #fffbeb !important; }
        .day-cell { font-size: 0.75rem; border-left: 1.5px solid #f1f5f9; color: #475569; }
        .week-header { background: #fffbeb; border-bottom: 2px solid #fef3c7; font-weight: 700; color: #92400e; }
        .day-header { background: #ffffff; color: #64748b; font-weight: 600; cursor: pointer; }
        .day-header:hover { background: #fffbeb; color: #92400e; }
        
        .sticky-col-idx { position: sticky; left: 0; z-index: 11; background: white; width: 40px; min-width: 40px; text-align: center; border-right: 1px solid #f1f5f9; }
        .sticky-col-1 { position: sticky; left: 40px; z-index: 10; background: white; width: 140px; min-width: 140px; border-right: 2px solid #f1f5f9; }
        .sticky-col-2 { position: sticky; left: 180px; z-index: 10; background: white; width: 90px; min-width: 90px; }
        .sticky-col-3 { position: sticky; left: 270px; z-index: 10; background: white; width: 90px; min-width: 90px; border-right: 2px solid #f1f5f9; }
        
        thead th { position: sticky; top: 0; z-index: 5; background: #fffbeb; }
        thead tr:first-child th.sticky-col-idx,
        thead tr:first-child th.sticky-col-1,
        thead tr:first-child th.sticky-col-2,
        thead tr:first-child th.sticky-col-3 { z-index: 21; background: #fffbeb; }
        
        .skeleton-row { height: 20px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.5s infinite; border-radius: 4px; }
        @keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        
        tbody tr:hover td { background-color: #fffbeb !important; }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div
        className="bg-white rounded-4 shadow-2xl overflow-hidden rating-modal-fade"
        style={{
          width: '98vw',
          height: '95vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-3 shadow-sm">
              <Star size={22} fill="currentColor" />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-slate-900">Rating Analysis Matrix</h5>
              <div className="d-flex align-items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {totalCount} total units
                </span>
                {/* <span className="text-slate-400 small">•</span>
                <span className="text-slate-500 small">Infinite Scroll Enabled</span> */}
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="d-flex gap-2 bg-slate-100 p-1 rounded-3">
              {['7days', '14days', '30days', 'all'].map(period => (
                <button
                  key={period}
                  onClick={() => setDateFilter(period)}
                  className={`px-3 py-1.5 rounded-2 border-0 small fw-semibold transition-all ${
                    dateFilter === period ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {period === '7days' ? '1W' : period === '14days' ? '2W' : period === '30days' ? '1M' : 'ALL'}
                </button>
              ))}
            </div>

            <div className="vr mx-1 my-2 text-slate-300"></div>

            <div className="input-group input-group-sm" style={{ width: '220px' }}>
              <span className="input-group-text bg-transparent border-end-0 text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0 text-slate-600"
                placeholder="Search ASIN or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-select form-select-sm text-slate-600 fw-medium"
              style={{ width: '150px' }}
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="all">Everywhere</option>
              {sellers.map(s => <option key={s._id} value={s._id}>{s.name.substring(0, 15)}...</option>)}
            </select>

            <button
              className="btn btn-sm btn-outline-slate-200 text-slate-600 d-flex align-items-center gap-2 px-3"
              onClick={() => handleExportCSV(processedItems, dateColumns)}
            >
              <ArrowRight size={14} className="rotate-90" />
              Export CSV
            </button>

            <button onClick={onClose} className="btn btn-ghost-slate rounded-circle p-1.5 hover:bg-slate-100">
              <X size={22} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div 
          className="overflow-auto flex-grow-1 position-relative" 
          onScroll={handleScroll}
          ref={scrollContainerRef}
        >
          <table className="table table-borderless mb-0 w-100" style={{ minWidth: '1500px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th rowSpan={2} className="sticky-col-idx py-3">#</th>
                <th rowSpan={2} className="sticky-col-1 py-3" onClick={() => handleSort('asinCode')} style={{ cursor: 'pointer' }}>
                  <div className="d-flex align-items-center justify-content-between px-2">
                    IDENTIFIER {sortField === 'asinCode' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th rowSpan={2} className="sticky-col-2 py-3 text-center" onClick={() => handleSort('rating')} style={{ cursor: 'pointer' }}>
                   RATING {sortField === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th rowSpan={2} className="sticky-col-3 py-3 text-center" onClick={() => handleSort('reviewCount')} style={{ cursor: 'pointer' }}>
                   REVIEWS {sortField === 'reviewCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                {dateColumns.map(week => {
                  const isExpanded = expandedWeeks[week.weekKey] !== false;
                  return (
                    <th
                      key={week.weekKey}
                      colSpan={isExpanded ? (week.dates.length + (showComparison ? 1 : 0)) : 1}
                      className="week-header text-center py-2 px-3 border-bottom border-start border-amber-100 week-toggle"
                      onClick={() => toggleWeek(week.weekKey)}
                    >
                      <div className="d-flex align-items-center justify-content-center gap-2">
                         <span className="text-amber-700/40 fw-medium small">{week.year}</span>
                         <span>{week.shortKey}</span>
                         <span className="text-amber-300">{isExpanded ? '▼' : '▶'}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {dateColumns.map((week, wIdx) => {
                  const isExpanded = expandedWeeks[week.weekKey] !== false;
                  if (!isExpanded) return null;
                  return (
                    <React.Fragment key={`${week.weekKey}-days`}>
                      {week.dates.map(d => (
                        <th
                          key={d.dateKey}
                          className="day-header text-center py-2 border-start border-slate-100"
                          onClick={() => handleSort(`day-${d.dateKey}`)}
                        >
                          <div className="small">{d.date.toLocaleDateString('en-IN', { day: '2-digit' })}</div>
                          <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                            {d.date.toLocaleDateString('en-IN', { month: 'short' })}
                          </div>
                        </th>
                      ))}
                      {showComparison && wIdx < dateColumns.length - 1 && (
                        <th className="text-center py-2 bg-amber-50 text-amber-700" style={{ fontSize: '0.65rem', fontWeight: 700 }}>
                          DIFF
                        </th>
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody style={{ backgroundColor: '#fff' }}>
              {isLoading && items.length === 0 ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td className="sticky-col-idx"><div className="skeleton-row mx-auto" style={{ width: '20px' }}></div></td>
                    <td className="sticky-col-1"><div className="skeleton-row w-75"></div></td>
                    <td className="sticky-col-2"><div className="skeleton-row w-50 mx-auto"></div></td>
                    <td className="sticky-col-3"><div className="skeleton-row w-50 mx-auto"></div></td>
                    <td colSpan={100}><div className="skeleton-row w-100"></div></td>
                  </tr>
                ))
              ) : displayItems.map((item, idx) => (
                <tr key={item.id} className="border-bottom border-slate-50">
                  <td className="sticky-col-idx text-slate-400 small fw-medium">{idx + 1}</td>
                  <td className="sticky-col-1 px-3 py-2">
                     <div className="d-flex flex-column" style={{ maxWidth: '120px' }}>
                        <span className="fw-bold text-slate-800 font-monospace small">{item.asinCode}</span>
                        <span className="text-slate-400 text-truncate" style={{ fontSize: '0.65rem' }}>{item.title}</span>
                     </div>
                  </td>
                  <td className="sticky-col-2 text-center text-amber-600 fw-bold small">
                     <div className="d-flex align-items-center justify-content-center gap-1">
                        <Star size={10} fill="currentColor" />
                        <span>{item.rating?.toFixed(1)}</span>
                     </div>
                  </td>
                  <td className="sticky-col-3 text-center text-slate-600 fw-medium small">{item.reviewCount?.toLocaleString()}</td>
                  {dateColumns.map((week, wIdx) => {
                    const isExpanded = expandedWeeks[week.weekKey] !== false;
                    
                    if (!isExpanded) {
                      const data = Object.values(item.processedWeekData[week.weekKey] || {}).filter(v => v !== null);
                      const avg = data.length > 0 ? (data.reduce((a, b) => a + b.rating, 0) / data.length) : null;
                      return (
                        <td key={`${week.weekKey}-col`} className="text-center py-2 border-start border-slate-100 bg-amber-50/10">
                           {avg ? (
                             <div className="d-flex align-items-center justify-content-center gap-1 text-amber-700 fw-semibold extra-small">
                               <Star size={8} fill="currentColor" />
                               <span>{avg.toFixed(1)}</span>
                             </div>
                           ) : <span className="text-slate-300">-</span>}
                        </td>
                      );
                    }

                    return (
                      <React.Fragment key={week.weekKey}>
                         {week.dates.map(d => {
                            const data = item.processedWeekData[week.weekKey][d.dateKey];
                            return (
                               <td key={d.dateKey} className="text-center day-cell py-2">
                                  {data ? (
                                    <div className="d-flex flex-column align-items-center">
                                       <span className="fw-medium text-slate-700">{data.rating.toFixed(1)}</span>
                                       <span className="text-slate-400" style={{ fontSize: '0.55rem' }}>{data.reviews}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                               </td>
                            );
                         })}
                         {showComparison && wIdx < dateColumns.length - 1 && (
                           <td className="text-center bg-amber-50/10 border-start border-slate-100">
                             <span className="text-slate-300 small">-</span>
                           </td>
                         )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          
          {(isFetchingMore || hasMore) && (
            <div className="p-4 d-flex justify-content-center align-items-center gap-3">
              <Loader2 className="animate-spin text-amber-600" size={24} />
              <span className="text-slate-500 fw-medium">Loading more review analytics...</span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 border-top d-flex justify-content-between align-items-center">
           <div className="d-flex gap-4">
              <div className="d-flex align-items-center gap-2">
                 <div className="p-1.5 bg-amber-100 rounded-circle text-amber-700 small fw-bold">4.5+</div>
                 <span className="small text-slate-600">Healthy Rating</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                 <div className="p-1.5 bg-red-100 rounded-circle text-red-700 small fw-bold">&lt;3.5</div>
                 <span className="small text-slate-600">Critical Attention</span>
              </div>
           </div>
           
           <div className="text-slate-400 small">
              Sentiment: Star Rating & Review Velocity • BuildRO v2.4
           </div>
           
           <button onClick={onClose} className="btn btn-dark btn-sm px-4 py-1.5 rounded-2 fw-bold">
              Dismiss Modal
           </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RatingViewModal;