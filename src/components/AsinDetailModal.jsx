import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, IndianRupee, Star, Award, Store, Activity, BarChart3, TrendingUp, TrendingDown, Eye, ExternalLink, Calendar } from 'lucide-react';
import { createPortal } from 'react-dom';
import Chart from 'react-apexcharts';

const AsinDetailModal = ({ asin, isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [dateFilter, setDateFilter] = useState('All'); // All, 90D, 30D, 7D

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  // 1. All hooks must be called unconditionally
  const history = useMemo(() => {
    if (!asin) return [];
    
    let rawHistory = asin.history || asin.weekHistory || [];
    if (rawHistory.length === 0) return [];

    // Sort by date to ensure correct filtering and display
    const sorted = [...rawHistory].sort((a, b) => new Date(a.date || a.week) - new Date(b.date || b.week));

    if (dateFilter === 'All') return sorted;

    const daysMap = { '7D': 7, '30D': 30, '90D': 90 };
    const days = daysMap[dateFilter] || 0;
    
    // Calculate cutoff based on the latest available date in data
    const latestDate = new Date(sorted[sorted.length - 1].date || sorted[sorted.length - 1].week);
    const cutoffDate = new Date(latestDate.getTime() - days * 24 * 60 * 60 * 1000);

    return sorted.filter(h => {
      const itemDate = new Date(h.date || h.week);
      return itemDate >= cutoffDate;
    });
  }, [asin, dateFilter]);

  const chartCategories = history.map(h => {
    if (!h.date && !h.week) return '';
    const d = new Date(h.date || h.week);
    return d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
  });

  // Common Chart Base Options
  const commonOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent'
    },
    xaxis: {
      categories: chartCategories,
      labels: { style: { fontSize: '10px', fontWeight: 500, colors: '#64748b' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 },
    tooltip: { theme: 'light' }
  };

  // Price History Chart Config
  const priceSeries = [{
    name: 'Price (₹)',
    data: history.map(h => h.price || h.currentPrice)
  }];

  const priceOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'area', height: 250 },
    dataLabels: {
      enabled: history.length <= 15, // Hide labels if too many points
      formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: ['#6366f1'] },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'smooth', width: 3, colors: ['#6366f1'] },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [20, 100],
        colorStops: [{ offset: 0, color: '#6366f1', opacity: 0.4 }, { offset: 100, color: '#6366f1', opacity: 0 }]
      }
    },
    yaxis: {
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', colors: ['#6366f1'] }
  };

  // BSR Trend Chart Config
  const bsrSeries = [{
    name: 'Main BSR',
    data: history.map(h => h.bsr)
  }];

  const bsrOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'line', height: 250 },
    dataLabels: {
      enabled: history.length <= 15,
      formatter: (val) => val ? `#${Number(val).toLocaleString()}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: ['#10b981'] },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'smooth', width: 3, colors: ['#10b981'] },
    yaxis: {
      reversed: true, // Lower BSR is better
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val ? `#${Number(val).toLocaleString()}` : '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', colors: ['#10b981'] }
  };

  // Rating History Chart Config
  const ratingSeries = [{
    name: 'Rating',
    data: history.map(h => h.rating)
  }];

  const ratingOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'line', height: 250 },
    dataLabels: {
      enabled: history.length <= 15,
      formatter: (val) => val ? `${Number(val).toFixed(1)}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: ['#f59e0b'] },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'straight', width: 3, colors: ['#f59e0b'] },
    yaxis: {
      min: 0, max: 5, tickAmount: 5,
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val?.toFixed(1) || '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', colors: ['#f59e0b'] },
    colors: ['#f59e0b']
  };

  if (!isOpen || !asin) return null;

  return createPortal(
    <div 
      className={`position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4 ${isClosing ? 'fade-out' : 'fade-in'}`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <style>{`
        .fade-in { animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .fade-out { animation: fadeOut 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes fadeOut { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.95) translateY(10px); } }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        
        .filter-btn { border: 1px solid #e2e8f0; background: #fff; color: #64748b; font-size: 0.75rem; font-weight: 600; padding: 0.5rem 1rem; transition: all 0.2s ease; }
        .filter-btn:hover { background: #f8fafc; color: #1e293b; }
        .filter-btn.active { background: #1e293b; color: #fff; border-color: #1e293b; }
        .filter-btn:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
        .filter-btn:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }
        
        .stat-item { padding: 1rem; border-right: 1px solid #f1f5f9; }
        .stat-item:last-child { border-right: none; }
        .stat-label { color: #64748b; font-size: 0.75rem; font-weight: 500; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.025em; }
        .stat-value { font-weight: 700; color: #1e293b; font-size: 1rem; }
      `}</style>
      
      <div 
        className="bg-white shadow-2xl overflow-hidden"
        style={{ 
          width: '100%', maxWidth: '1280px', maxHeight: '95vh', borderRadius: '24px', display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-bottom bg-white d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
              <Package size={24} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h4 className="mb-0 fw-bold text-slate-900">{asin.asinCode}</h4>
                <span className="badge bg-slate-100 text-slate-600 border rounded-pill px-3">{asin.category || 'ASIN Details'}</span>
              </div>
              <p className="text-secondary small mb-0 d-flex align-items-center gap-1">
                <Store size={14} /> Association: {asin.sellerName || 'Direct Seller'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="btn btn-light rounded-circle p-2 border-0 hover:bg-slate-100 transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-auto bg-slate-50/50" style={{ flex: 1 }}>
          
          {/* Filters Bar */}
          <div className="d-flex justify-content-between align-items-center mb-5 bg-white p-3 rounded-2xl border shadow-sm">
            <div className="d-flex align-items-center gap-2 text-slate-600 fw-medium">
              <Calendar size={18} className="text-indigo-600" />
              <span>Historical Range</span>
            </div>
            <div className="d-flex shadow-sm" style={{ borderRadius: '10px', overflow: 'hidden' }}>
              {['7D', '30D', '90D', 'All'].map(range => (
                <button 
                  key={range} 
                  className={`filter-btn ${dateFilter === range ? 'active' : ''}`}
                  onClick={() => setDateFilter(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Product Details Bar */}
          <div className="bg-white border rounded-3xl p-4 shadow-sm mb-5 d-flex align-items-center gap-4">
            {/* Product Thumbnail */}
            <div 
              className="flex-shrink-0" 
              style={{ width: '180px', height: '180px', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden', backgroundColor: '#f8fafc', padding: '12px' }}
            >
              {asin.imageUrl ? (
                <img src={asin.imageUrl} alt={asin.asinCode} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-slate-200"><Package size={60} /></div>
              )}
            </div>

            {/* Info and Stats */}
            <div className="flex-grow-1 overflow-hidden">
              <div className="mb-4">
                <h5 className="fw-bold text-slate-800 mb-2 truncate-2-lines" style={{ lineHeight: '1.4' }}>{asin.title}</h5>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg font-monospace border border-indigo-100">{asin.asinCode}</span>
                  <a href={`https://www.amazon.in/dp/${asin.asinCode}`} target="_blank" rel="noopener noreferrer" className="btn btn-link p-0 text-slate-400 hover:text-indigo-600"><ExternalLink size={16} /></a>
                </div>
              </div>

              {/* Stats Row */}
              <div className="d-flex bg-slate-50 rounded-2xl border overflow-hidden">
                <div className="stat-item flex-fill"><div className="stat-label">Price</div><div className="stat-value text-indigo-600">₹{asin.currentPrice?.toLocaleString() || 0}</div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Buy Box</div><div className="stat-value"><Store size={16} className="text-slate-400 me-2" /><span className="truncate">{asin.soldBy || 'Amazon.in'}</span></div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Main BSR</div><div className="stat-value text-emerald-600">#{asin.bsr?.toLocaleString() || '-'}</div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Rating</div><div className="stat-value"><Star size={16} className="text-amber-400 fill-amber-400 me-1" />{asin.rating || 0}</div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Reviews</div><div className="stat-value">{asin.reviewCount?.toLocaleString() || 0}</div></div>
              </div>
            </div>
          </div>

          {/* Visualizations Stack (Full Width) */}
          <div className="d-flex flex-column gap-5">
            {/* Price History Chart */}
            <div className="bg-white border p-5 rounded-3xl shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><IndianRupee size={20} /></div>
                  <h6 className="mb-0 fw-bold text-slate-800">PRICE HISTORY</h6>
                </div>
                <span className="text-slate-400 small font-medium">Snapshot Count: {history.length}</span>
              </div>
              <div style={{ minHeight: '300px' }}><Chart options={priceOptions} series={priceSeries} type="area" height={300} /></div>
            </div>

            {/* BSR Trend Chart */}
            <div className="bg-white border p-5 rounded-3xl shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><BarChart3 size={20} /></div>
                  <h6 className="mb-0 fw-bold text-slate-800">BEST SELLERS RANK TREND</h6>
                </div>
                <div className="d-flex align-items-center gap-1 text-slate-400 small font-medium"><Eye size={14} /> Interactive View</div>
              </div>
              <div style={{ minHeight: '300px' }}><Chart options={bsrOptions} series={bsrSeries} type="line" height={300} /></div>
            </div>

            {/* Rating History Chart */}
            <div className="bg-white border p-5 rounded-3xl shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Star size={20} /></div>
                  <h6 className="mb-0 fw-bold text-slate-800">RATING PROGRESSION</h6>
                </div>
                <span className="text-slate-400 small font-medium">Scale (0 - 5)</span>
              </div>
              <div style={{ minHeight: '300px' }}><Chart options={ratingOptions} series={ratingSeries} type="line" height={300} /></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-white border-top d-flex justify-content-end">
          <button onClick={handleClose} className="btn btn-dark fw-bold px-5 py-2 rounded-xl transition-all hover:scale-105" style={{ borderRadius: '12px' }}>CLOSE</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AsinDetailModal;