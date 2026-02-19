import React, { useState, useEffect, useRef } from 'react';
import DataTable from '../components/DataTable';
import KPICard from '../components/KPICard';
import ResultsPage from '../components/ResultsPage';
import FeesPage from '../components/FeesPage';
import { db } from '../services/db';

// --- Helper: Robust CSV Parser ---
const parseCSV = (text) => {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let insideQuotes = false;

  const cleanedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanedText.length; i++) {
    const char = cleanedText[i];
    const nextChar = cleanedText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }
  return rows;
};

// --- Dashboard View Component ---
const DashboardView = ({ asins, onNavigate }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [keepaKey, setKeepaKey] = useState(db.getKeepaKey());

  const saveSettings = () => {
    db.saveKeepaKey(keepaKey);
    setShowSettings(false);
    alert('Settings Saved');
  };

  // Ensure asins is always an array
  const asinList = Array.isArray(asins) ? asins : [];

  const stats = {
    total: asinList.length,
    processed: asinList.filter(a => a.status === 'calculated').length,
    errors: asinList.filter(a => a.status === 'error').length,
    avgMargin: 0
  };

  const calculatedItems = asinList.filter(a => a.status === 'calculated' && a.marginPercent !== undefined);
  if (calculatedItems.length > 0) {
    const sum = calculatedItems.reduce((acc, curr) => acc + (curr.marginPercent || 0), 0);
    stats.avgMargin = sum / calculatedItems.length;
  }

  const kpis = [
    { title: 'Total Inventory', value: stats.total.toString(), icon: 'bi-box', trend: 0, trendType: 'neutral' },
    { title: 'Calculated ASINs', value: stats.processed.toString(), icon: 'bi-calculator', trend: 0, trendType: 'neutral' },
    { title: 'Average Margin', value: `${stats.avgMargin.toFixed(1)}%`, icon: 'bi-currency-rupee', trend: 0, trendType: stats.avgMargin > 0 ? 'positive' : 'negative' },
    { title: 'Issues Found', value: stats.errors.toString(), icon: 'bi-exclamation-triangle', trend: 0, trendType: 'negative' },
  ];

  return (
    <>
      <header className="main-header">
        <h1 className="page-title"><i className="bi bi-calculator"></i>Revenue Calculator Dashboard</h1>
      </header>
      <div className="page-content">
        {/* API Settings Toggle */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <i className="bi bi-gear me-2"></i>
              {showSettings ? 'Hide Settings' : 'API Configuration'}
            </button>
          </div>
        </div>

        {/* API Settings Panel */}
        {showSettings && (
          <div className="card mb-4" style={{ backgroundColor: '#f8fafc' }}>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h5 className="card-title">External Integrations</h5>
                  <p className="text-muted small">Configure APIs used for live pricing and historical data.</p>
                  <div className="mb-3">
                    <label className="form-label">Keepa API Key</label>
                    <input
                      type="password"
                      className="form-control"
                      value={keepaKey}
                      onChange={(e) => setKeepaKey(e.target.value)}
                      placeholder="Enter your Keepa API key"
                    />
                  </div>
                  <button className="btn btn-primary" onClick={saveSettings}>
                    <i className="bi bi-check me-2"></i>Save Configuration
                  </button>
                </div>
                <div className="col-md-6">
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>Security Note:</strong> API keys are stored locally in your browser. A valid Keepa subscription is required for real-time data access.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="kpi-grid mb-4">
          {kpis.map((kpi, idx) => (
            <KPICard key={idx} title={kpi.title} value={kpi.value} icon={kpi.icon} trend={kpi.trend} trendType={kpi.trendType} />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card h-100">
              <div className="card-body text-center">
                <i className="bi bi-upload fs-1 text-primary"></i>
                <h5 className="card-title mt-3">Bulk Import</h5>
                <p className="text-muted small">Add ASINs via CSV or manual entry</p>
                <button className="btn btn-primary btn-sm" onClick={() => onNavigate('upload')}>
                  <i className="bi bi-plus me-1"></i>Import ASINs
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card h-100">
              <div className="card-body text-center">
                <i className="bi bi-table fs-1 text-success"></i>
                <h5 className="card-title mt-3">Analysis Results</h5>
                <p className="text-muted small">View profitability calculations</p>
                <button className="btn btn-success btn-sm" onClick={() => onNavigate('results')}>
                  <i className="bi bi-eye me-1"></i>View Results
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card h-100">
              <div className="card-body text-center">
                <i className="bi bi-currency-rupee fs-1 text-warning"></i>
                <h5 className="card-title mt-3">Fee Configuration</h5>
                <p className="text-muted small">Manage Amazon fee settings</p>
                <button className="btn btn-warning btn-sm" onClick={() => onNavigate('fees')}>
                  <i className="bi bi-sliders me-1"></i>Configure Fees
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card h-100">
              <div className="card-body text-center">
                <i className="bi bi-arrow-repeat fs-1 text-info"></i>
                <h5 className="card-title mt-3">Recalculate</h5>
                <p className="text-muted small">Refresh all profit calculations</p>
                <button className="btn btn-info btn-sm" onClick={() => window.location.reload()}>
                  <i className="bi bi-arrow-clockwise me-1"></i>Refresh All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent ASINs Table */}
        <DataTable
          title="Recent ASINs"
          data={asinList.slice(0, 10)}
          columns={['asin', 'stapleLevel', 'status', 'marginPercent', 'createdAt']}
          searchable={true}
          sortable={true}
          customRenderers={{
            status: (item) => {
              const statusMap = {
                'pending': { class: 'badge-secondary', label: 'Pending' },
                'calculated': { class: 'badge-success', label: 'Calculated' },
                'error': { class: 'badge-danger', label: 'Error' },
                'processing': { class: 'badge-primary', label: 'Processing' },
              };
              const { class: className, label } = statusMap[item.status] || { class: 'badge-secondary', label: item.status };
              return <span className={`badge ${className}`}>{label}</span>;
            },
            marginPercent: (item) => {
              const margin = item.marginPercent;
              if (margin === undefined) return '-';
              const colorClass = margin >= 0 ? 'text-success' : 'text-danger';
              return <span className={colorClass}>{margin.toFixed(1)}%</span>;
            },
          }}
          actions={[
            { label: 'View', icon: 'bi-eye', className: 'btn-sm', onClick: (item) => console.log('View', item) },
            { label: 'Recalculate', icon: 'bi-arrow-repeat', className: 'btn-sm btn-outline-secondary', onClick: (item) => console.log('Recalculate', item) },
          ]}
        />
      </div>
    </>
  );
};

// --- Upload Page Component ---
const UploadPage = ({ onUploadComplete, onNavigate }) => {
  const [rawText, setRawText] = useState('');
  const [stapleLevel, setStapleLevel] = useState('Standard');
  const fileRef = useRef(null);

  const handleUploadText = async () => {
    const asinList = rawText.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    if (asinList.length === 0) return;
    await db.addAsinsBulk(asinList.map(a => ({ asin: a, stapleLevel })));
    setRawText('');
    onUploadComplete();
    onNavigate('results');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result;
      const rows = parseCSV(text);

      const newAsins = [];
      rows.forEach(parts => {
        const asin = parts[0]?.trim().toUpperCase();
        if (!asin || asin.toLowerCase() === 'asin') return;
        let sLevel = stapleLevel;
        if (parts[1]) {
          const val = parts[1].trim().toLowerCase();
          if (val === 'heavy') sLevel = 'Heavy';
          else if (val === 'oversize') sLevel = 'Oversize';
        }
        newAsins.push({ asin, stapleLevel: sLevel });
      });
      if (newAsins.length > 0) {
        await db.addAsinsBulk(newAsins);
        onUploadComplete();
        onNavigate('results');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <header className="main-header">
        <h1 className="page-title"><i className="bi bi-upload"></i>Bulk Import ASINs</h1>
      </header>
      <div className="page-content">
        <div className="row g-4">
          {/* Manual Entry */}
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-body">
                <h5 className="card-title"><i className="bi bi-pencil me-2"></i>Manual ASIN Entry</h5>
                <p className="text-muted small">Enter ASINs one per line</p>

                <div className="mb-3">
                  <label className="form-label">ASIN List</label>
                  <textarea
                    className="form-control font-monospace"
                    rows="9"
                    placeholder="B08N5KWB9H&#10;B07XJ8C8F5&#10;B09XYZ1234"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Default Size Tier</label>
                  <select
                    className="form-select"
                    value={stapleLevel}
                    onChange={(e) => setStapleLevel(e.target.value)}
                  >
                    <option value="Standard">Standard Size</option>
                    <option value="Oversize">Oversize</option>
                    <option value="Heavy">Heavy & Bulky</option>
                  </select>
                </div>

                <button
                  className="btn btn-primary w-100"
                  onClick={handleUploadText}
                  disabled={!rawText}
                >
                  <i className="bi bi-upload me-2"></i>Process ASINs
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-body d-flex flex-column justify-content-center align-items-center text-center">
                <i className="bi bi-file-earmark-spreadsheet fs-1 text-success"></i>
                <h5 className="card-title mt-3">Upload CSV File</h5>
                <p className="text-muted small">Upload a CSV or TXT file containing ASINs</p>
                <p className="font-monospace small text-muted">Format: ASIN, SizeTier (optional)</p>

                <input
                  type="file"
                  accept=".csv,.txt"
                  ref={fileRef}
                  className="d-none"
                  onChange={handleFileUpload}
                />

                <button
                  className="btn btn-success"
                  onClick={() => fileRef.current?.click()}
                >
                  <i className="bi bi-folder2-open me-2"></i>Browse Files
                </button>

                <p className="text-muted small mt-2 mb-0">Maximum recommended size: 10,000 ASINs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// --- Main Revenue Calculator Page Component ---
const RevenueCalculatorPage = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const items = await db.getAsins();
      // Ensure items is always an array
      setAsins(Array.isArray(items) ? items : []);
      setLoading(false);
    };
    loadData();
  }, []);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleUploadComplete = async () => {
    const items = await db.getAsins();
    setAsins(Array.isArray(items) ? items : []);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardView asins={asins} onNavigate={handlePageChange} />;
      case 'upload':
        return <UploadPage onUploadComplete={handleUploadComplete} onNavigate={handlePageChange} />;
      case 'results':
        return <ResultsPage asins={asins} onNavigate={handlePageChange} />;
      case 'fees':
        return <FeesPage />;
      default:
        return <DashboardView asins={asins} onNavigate={handlePageChange} />;
    }
  };

  if (loading) {
    return (
      <>
        <header className="main-header">
          <h1 className="page-title"><i className="bi bi-calculator"></i>Revenue Calculator</h1>
        </header>
        <div className="page-content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="main-header">
        <h1 className="page-title"><i className="bi bi-calculator"></i>Revenue Calculator</h1>
      </header>
      <div className="page-content">
        {/* Quick Navigation */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
              { id: 'upload', label: 'Bulk Upload', icon: 'bi-upload' },
              { id: 'results', label: 'Results', icon: 'bi-table' },
              { id: 'fees', label: 'Fees', icon: 'bi-currency-rupee' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handlePageChange(item.id)}
                className={`btn ${currentPage === item.id ? 'btn-primary' : 'btn-outline-primary'} btn-sm`}
              >
                <i className={`${item.icon} me-1`}></i>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Page Content */}
        {renderPage()}
      </div>
    </>
  );
};

export default RevenueCalculatorPage;
