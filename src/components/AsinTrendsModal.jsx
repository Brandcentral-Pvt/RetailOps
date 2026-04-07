import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { X, TrendingUp, TrendingDown, IndianRupee, Star, Award, Activity, DollarSign, BarChart3 } from 'lucide-react';
import { createPortal } from 'react-dom';

const AsinTrendsModal = ({ asin, isOpen, onClose }) => {
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asin) return null;

  const history = asin.history || asin.weekHistory || [];

  const filteredHistory = useMemo(() => {
    if (dateFilter === 'all' || history.length === 0) return history;
    
    const now = new Date();
    const daysMap = { '7days': 7, '30days': 30, '90days': 90 };
    const days = daysMap[dateFilter] || 0;
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return history.filter(h => {
      const itemDate = h.date ? new Date(h.date) : new Date(h.week);
      return itemDate >= cutoffDate;
    });
  }, [history, dateFilter]);

  const getCategoryLabel = (h) => h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : h.week || '';

  // Price Chart
  const priceSeries = [{
    name: 'Price',
    data: filteredHistory.map(h => h.price || null)
  }];

  const priceOptions = {
    chart: {
      id: 'price-chart',
      toolbar: { show: true, tools: { download: true, zoom: true, pan: true, reset: true } },
      zoom: { enabled: true },
      background: 'transparent'
    },
    colors: ['#2563eb'],
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: filteredHistory.map(h => getCategoryLabel(h)),
      labels: { style: { fontSize: '10px' } }
    },
    yaxis: {
      title: { text: 'Price (₹)', style: { fontWeight: 600 } },
      labels: { formatter: (val) => val ? `₹${val.toLocaleString()}` : '' }
    },
    markers: { size: 4 },
    tooltip: { y: { formatter: (val) => val ? `₹${val.toLocaleString()}` : 'N/A' } },
    grid: { borderColor: '#f1f5f9' }
  };

  // BSR Chart
  const bsrSeries = [{
    name: 'BSR',
    data: filteredHistory.map(h => h.bsr || null)
  }];

  const bsrOptions = {
    chart: {
      id: 'bsr-chart',
      toolbar: { show: true, tools: { download: true, zoom: true, pan: true, reset: true } },
      zoom: { enabled: true },
      background: 'transparent'
    },
    colors: ['#10b981'],
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: filteredHistory.map(h => getCategoryLabel(h)),
      labels: { style: { fontSize: '10px' } }
    },
    yaxis: {
      reversed: true,
      title: { text: 'Rank (BSR)', style: { fontWeight: 600 } },
      labels: { formatter: (val) => `#${val}` }
    },
    markers: { size: 4 },
    tooltip: { y: { formatter: (val) => `#${val.toLocaleString()}` } },
    grid: { borderColor: '#f1f5f9' }
  };

  // Rating Chart
  const ratingSeries = [{
    name: 'Rating',
    data: filteredHistory.map(h => h.rating || null)
  }];

  const ratingOptions = {
    chart: {
      id: 'rating-chart',
      toolbar: { show: true, tools: { download: true, zoom: true, pan: true, reset: true } },
      zoom: { enabled: true },
      background: 'transparent'
    },
    colors: ['#f59e0b'],
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: filteredHistory.map(h => getCategoryLabel(h)),
      labels: { style: { fontSize: '10px' } }
    },
    yaxis: {
      min: 0,
      max: 5,
      title: { text: 'Rating', style: { fontWeight: 600 } },
      labels: { formatter: (val) => val?.toFixed(1) || '' }
    },
    markers: { size: 4 },
    tooltip: { y: { formatter: (val) => val?.toFixed(1) || 'N/A' } },
    grid: { borderColor: '#f1f5f9' }
  };

  // Calculate trends
  const getTrend = (metric, key) => {
    if (filteredHistory.length < 2) return null;
    const first = filteredHistory[0];
    const last = filteredHistory[filteredHistory.length - 1];
    
    const change = last[key] - first[key];
    if (metric === 'bsr') {
      return { change, percent: first[key] ? (change / first[key]) * 100 : 0, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral' };
    }
    return { change, percent: first[key] ? (change / first[key]) * 100 : 0, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral' };
  };

  const priceTrend = getTrend('price', 'price');
  const bsrTrend = getTrend('bsr', 'bsr');
  const ratingTrend = getTrend('rating', 'rating');

  const TrendIndicator = ({ trend, metric }) => {
    if (!trend) return <span className="text-muted small">-</span>;
    const isBsr = metric === 'bsr';
    const displayValue = isBsr 
      ? (trend.change > 0 ? `+${Math.round(trend.change)}` : `${Math.round(trend.change)}`)
      : (trend.direction !== 'neutral' && trend.percent ? `${trend.percent > 0 ? '+' : ''}${Math.round(trend.percent)}%` : 'No change');
    return (
      <div className={`d-flex align-items-center gap-1 ${trend.direction === 'up' ? 'text-success' : trend.direction === 'down' ? 'text-danger' : 'text-muted'}`}>
        {trend.direction === 'up' && <TrendingUp size={14} />}
        {trend.direction === 'down' && <TrendingDown size={14} />}
        <span className="small fw-medium">{displayValue}</span>
      </div>
    );
  };

  return createPortal(
    <div 
      className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .trend-fade-in { animation: trendFadeIn 0.25s ease-out; }
        @keyframes trendFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      
      <div 
        className="bg-white rounded-3 shadow-lg overflow-hidden"
        style={{ 
          width: '100%', 
          maxWidth: '1100px', 
          maxHeight: '90vh',
          animation: 'trendFadeIn 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div className="p-4 border-bottom bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Activity size={20} className="text-primary" />
              </div>
              <div>
                <h5 className="mb-0 fw-bold">ASIN Performance Trends</h5>
                <p className="text-muted small mb-0">{asin.asinCode} • {asin.title?.substring(0, 40)}...</p>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-link text-muted p-0 hover:text-dark">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-bottom bg-light">
          <div className="d-flex justify-content-end">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Period:</span>
              <div className="btn-group">
                {[
                  { value: 'all', label: 'All' },
                  { value: '30days', label: '30D' },
                  { value: '90days', label: '90D' }
                ].map(d => (
                  <button
                    key={d.value}
                    className={`btn btn-sm ${dateFilter === d.value ? 'btn-dark' : 'btn-outline-secondary'}`}
                    onClick={() => setDateFilter(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4" style={{ maxHeight: 'calc(90vh - 180px)', overflowY: 'auto' }}>
          {/* Cards Row - Horizontal */}
          <div className="row g-3 mb-4">
            {/* Price Card */}
            <div className="col-md-4">
              <div className="p-3 border rounded-3 h-100" style={{ backgroundColor: '#f8fafc' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <IndianRupee size={18} className="text-primary" />
                    <span className="text-muted small fw-medium">PRICE</span>
                  </div>
                  <TrendIndicator trend={priceTrend} metric="price" />
                </div>
                <div className="h4 mb-0 fw-bold text-primary">
                  ₹{asin.currentPrice?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-muted small">Current Price</div>
              </div>
            </div>

            {/* BSR Card */}
            <div className="col-md-4">
              <div className="p-3 border rounded-3 h-100" style={{ backgroundColor: '#f8fafc' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Award size={18} className="text-emerald-600" />
                    <span className="text-muted small fw-medium">BSR</span>
                  </div>
                  <TrendIndicator trend={bsrTrend} metric="bsr" />
                </div>
                <div className="h4 mb-0 fw-bold text-emerald-600">
                  #{asin.bsr?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-muted small">Best Seller Rank</div>
              </div>
            </div>

            {/* Rating Card */}
            <div className="col-md-4">
              <div className="p-3 border rounded-3 h-100" style={{ backgroundColor: '#f8fafc' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Star size={18} className="text-amber-500" />
                    <span className="text-muted small fw-medium">RATING</span>
                  </div>
                  <TrendIndicator trend={ratingTrend} metric="rating" />
                </div>
                <div className="h4 mb-0 fw-bold text-amber-500">
                  {asin.rating || 'N/A'}
                </div>
                <div className="text-muted small">Current Rating</div>
              </div>
            </div>
          </div>

          {/* Price Chart */}
          <div className="border rounded mb-3 bg-white">
            <h6 className="fw-bold p-3 pb-0 d-flex align-items-center gap-2 text-primary">
              <IndianRupee size={16} />
              Price Trend
            </h6>
            <div style={{ height: '200px' }}>
              <Chart 
                options={priceOptions} 
                series={priceSeries} 
                type="area" 
                height="100%" 
              />
            </div>
          </div>

          {/* BSR Chart */}
          <div className="border rounded mb-3 bg-white">
            <h6 className="fw-bold p-3 pb-0 d-flex align-items-center gap-2 text-emerald-600">
              <BarChart3 size={16} />
              BSR Trend
            </h6>
            <div style={{ height: '200px' }}>
              <Chart 
                options={bsrOptions} 
                series={bsrSeries} 
                type="line" 
                height="100%" 
              />
            </div>
          </div>

          {/* Rating Chart */}
          <div className="border rounded bg-white">
            <h6 className="fw-bold p-3 pb-0 d-flex align-items-center gap-2 text-amber-500">
              <Star size={16} />
              Rating Trend
            </h6>
            <div style={{ height: '200px' }}>
              <Chart 
                options={ratingOptions} 
                series={ratingSeries} 
                type="line" 
                height="100%" 
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-top bg-light d-flex justify-content-between align-items-center">
          <div className="text-muted small">
            Data Points: {filteredHistory.length} • Interactive - Use toolbar to zoom/pan/download
          </div>
          <button onClick={onClose} className="btn btn-dark fw-bold px-4 rounded-pill">
            CLOSE
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AsinTrendsModal;