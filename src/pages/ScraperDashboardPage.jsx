import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import KPICard from '../components/KPICard';
import ProgressBar from '../components/common/ProgressBar';
import { scraperApi } from '../services/api';
import { 
  Store, 
  RefreshCcw, 
  Package, 
  Percent, 
  Play, 
  XCircle, 
  RotateCcw, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Activity,
  Server,
  Zap
} from 'lucide-react';

const ScraperDashboardPage = () => {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState({}); // jobId -> action
  const [polling, setPolling] = useState(false);
  const pollingInterval = useRef(null);

  const loadAll = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    try {
      const [healthRes, statsRes, jobsRes, sellersRes] = await Promise.allSettled([
        scraperApi.getHealth(),
        scraperApi.getStats(),
        scraperApi.getJobs({ limit: 20 }),
        scraperApi.getSellersSummary(),
      ]);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.stats || null);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.jobs || []);
      if (sellersRes.status === 'fulfilled') setSellers(sellersRes.value.sellers || []);
    } catch (error) {
      console.error('Failed to load scraper dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    pollingInterval.current = setInterval(() => {
      loadAll(false);
    }, 15000);
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [loadAll]);

  const handleStartScrape = async (seller) => {
    setActingOn(prev => ({ ...prev, [seller.sellerId]: 'start' }));
    try {
      const res = await scraperApi.startScrape({ sellerId: seller.sellerId });
      alert(res.message || `Scrape job started for ${seller.sellerName}`);
      loadAll(false);
    } catch (error) {
      alert('Failed: ' + error.message);
    } finally {
      setActingOn(prev => ({ ...prev, [seller.sellerId]: null }));
    }
  };

  const handleCancelJob = async (jobId) => {
    setActingOn(prev => ({ ...prev, [jobId]: 'cancel' }));
    try {
      const res = await scraperApi.cancelJob(jobId);
      alert(res.message || 'Job cancelled');
      loadAll(false);
    } catch (error) {
      alert('Failed: ' + error.message);
    } finally {
      setActingOn(prev => ({ ...prev, [jobId]: null }));
    }
  };

  const handleRetryJob = async (jobId) => {
    setActingOn(prev => ({ ...prev, [jobId]: 'retry' }));
    try {
      const res = await scraperApi.retryJob(jobId);
      alert(res.message || 'Job retry started');
      loadAll(false);
    } catch (error) {
      alert('Failed: ' + error.message);
    } finally {
      setActingOn(prev => ({ ...prev, [jobId]: null }));
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'QUEUED': { className: 'badge-idle', icon: Clock, label: 'Queued' },
      'RUNNING': { className: 'badge-running', icon: RefreshCcw, label: 'Running', spin: true },
      'COMPLETED': { className: 'badge-success', icon: CheckCircle, label: 'Completed' },
      'CANCELLED': { className: 'badge-warning', icon: XCircle, label: 'Cancelled' },
      'FAILED': { className: 'badge-danger', icon: AlertTriangle, label: 'Failed' },
    };
    const { className, icon: Icon, label, spin } = map[status] || { className: 'badge-idle', icon: Clock, label: status };
    return (
      <span className={`sync-status-badge ${className}`}>
        {spin ? <span className="icon-[svg-spinners--eclipse] me-1" style={{ fontSize: 14 }} aria-hidden="true" /> : <Icon size={14} className="me-1" />}
        {label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    if (isNaN(date)) return 'Never';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calcProgress = (job) => {
    if (!job || !job.TotalAsins) return 0;
    const done = (job.CompletedAsins || 0) + (job.FailedAsins || 0);
    return Math.min(100, Math.round((done / job.TotalAsins) * 100));
  };

  const runningJobs = jobs.filter(j => j.Status === 'RUNNING' || j.Status === 'QUEUED');
  const totalProcessed = jobs.reduce((acc, j) => acc + (j.CompletedAsins || 0) + (j.FailedAsins || 0), 0);

  const kpis = [
    { title: 'Scraper Ready', value: health?.ready ? (health.headless ? 'Headless' : 'Visible') : 'Offline', icon: 'Server', trend: 0, trendType: health?.ready ? 'up' : 'neutral' },
    { title: 'Total Jobs', value: (stats?.totalJobs ?? 0).toString(), icon: 'Activity', trend: 0, trendType: 'neutral' },
    { title: 'ASINs Scraped', value: (stats?.asinsScraped ?? 0).toLocaleString(), icon: 'Package', trend: 0, trendType: 'neutral' },
    { title: 'Active Jobs', value: (stats?.running ?? runningJobs.length).toString(), icon: 'Zap', trend: 0, trendType: 'neutral' },
  ];

  if (loading) return <Spinner />;

  return (
    <div className="scraper-dashboard-container container-fluid p-4">
      <style>{`
        .scraper-dashboard-container {
          background: #f9fafb;
          min-height: 100vh;
        }
        .sync-status-badge {
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          letter-spacing: 0.01em;
          text-transform: uppercase;
        }
        .badge-idle { background: #f3f4f6; color: #4b5563; }
        .badge-running { background: rgba(59, 130, 246, 0.1); color: #0288D1; }
        .badge-success { background: rgba(16, 185, 129, 0.1); color: #2E7D32; }
        .badge-warning { background: rgba(245, 158, 11, 0.1); color: #E65100; }
        .badge-danger { background: rgba(239, 68, 68, 0.1); color: #C62828; }

        .data-table-v2 {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .data-table-v2 thead th {
          background: #fafafa;
          padding: 0.875rem 1.25rem;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table-v2 tbody td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }
        .data-table-v2 tbody tr:last-child td { border-bottom: none; }
        .data-table-v2 tbody tr:hover { background-color: #f9fafb; }
        .font-monospace {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
        }
      `}</style>

      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">Playwright Scraper</h4>
          <p className="text-muted small mb-0">In-house scraper replacing Octoparse — stats, jobs and seller sync.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-white shadow-sm border px-3 d-flex align-items-center gap-2" onClick={() => loadAll(true)} disabled={refreshing}>
            {refreshing ? <span className="icon-[svg-spinners--eclipse]" aria-hidden="true"></span> : <RefreshCcw size={16} />}
            Refresh
          </button>
          <span className={`align-self-center small fw-semibold ${health?.ready ? 'text-success' : 'text-danger'}`}>
            {health?.ready ? `Playwright ${health.browserVersion}` : 'Playwright offline'}
          </span>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="col-md-3">
            <KPICard title={kpi.title} value={kpi.value} icon={kpi.icon} trend={kpi.trend} trendType={kpi.trendType} />
          </div>
        ))}
      </div>

      <div className="data-table-v2 mb-5">
        <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between bg-white">
          <h6 className="mb-0 text-dark fw-bold">Recent Scrape Jobs</h6>
          <div className="small text-muted">{jobs.length} Jobs</div>
        </div>
        <div className="table-responsive">
          <table className="table data-table mb-0">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Type / Target</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Completed</th>
                <th>Failed</th>
                <th>Started</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div className="text-muted opacity-50">
                      <div className="mb-3"><Activity size={48} /></div>
                      No scrape jobs yet. Use the Sellers section below to start one.
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.Id}>
                    <td>
                      <div className="font-monospace text-primary fw-medium" style={{ fontSize: '0.75rem' }}>{job.Id?.slice(0, 13)}</div>
                      <div className="text-muted x-small" style={{ fontSize: '0.7rem' }}>{job.JobType || 'SCRAPE'}</div>
                    </td>
                    <td>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>{job.TargetId?.slice(0, 16) || 'Bulk'}</div>
                        <div className="text-muted x-small" style={{ fontSize: '0.7rem' }}>{job.TargetType}</div>
                      </div>
                    </td>
                    <td>{getStatusBadge(job.Status)}</td>
                    <td>
                      <div style={{ width: '120px' }}>
                        <ProgressBar value={calcProgress(job)} color={job.Status === 'RUNNING' ? 'primary' : 'success'} size="sm" />
                        <div className="x-small text-muted mt-1 fw-medium">{calcProgress(job)}%</div>
                      </div>
                    </td>
                    <td>{job.CompletedAsins ?? 0}<span className="text-muted x-small"> / {job.TotalAsins ?? 0}</span></td>
                    <td className={job.FailedAsins ? 'text-danger fw-semibold' : ''}>{job.FailedAsins ?? 0}</td>
                    <td className="small text-muted">{formatDate(job.StartedAt || job.CreatedAt)}</td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end">
                        {(job.Status === 'RUNNING' || job.Status === 'QUEUED') && (
                          <button className="btn btn-outline-danger" title="Cancel job" disabled={!!actingOn[job.Id]}
                            onClick={() => handleCancelJob(job.Id)}>
                            {actingOn[job.Id] === 'cancel' ? <span className="icon-[svg-spinners--eclipse]" aria-hidden="true"></span> : <XCircle size={16} />}
                          </button>
                        )}
                        {(job.Status === 'FAILED' || job.Status === 'CANCELLED') && (
                          <button className="btn btn-outline-primary" title="Retry failed ASINs" disabled={!!actingOn[job.Id]}
                            onClick={() => handleRetryJob(job.Id)}>
                            {actingOn[job.Id] === 'retry' ? <span className="icon-[svg-spinners--eclipse]" aria-hidden="true"></span> : <RotateCcw size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-table-v2 mb-5">
        <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between bg-white">
          <h6 className="mb-0 text-dark fw-bold">Sellers</h6>
          <div className="small text-muted">{sellers.length} Sellers</div>
        </div>
        <div className="table-responsive">
          <table className="table data-table mb-0">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Total ASINs</th>
                <th>Scraped</th>
                <th>Last Scraped</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-5 text-muted">
                    <div className="mb-3"><Store size={48} className="opacity-50" /></div>
                    No sellers found.
                  </td>
                </tr>
              ) : (
                sellers.map(seller => (
                  <tr key={seller.sellerId}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="bg-primary text-white rounded-3 d-flex align-items-center justify-content-center me-3" style={{ width: '38px', height: '38px', fontSize: '1rem', fontWeight: '700' }}>
                          {seller.sellerName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>{seller.sellerName}</div>
                          <div className="font-monospace text-muted x-small" style={{ fontSize: '0.7rem' }}>{seller.sellerId.slice(0, 13)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="fw-bold text-dark">{seller.totalAsins?.toLocaleString()}</td>
                    <td className="text-success fw-semibold">{seller.scrapedCount?.toLocaleString()}</td>
                    <td className="small text-muted">{formatDate(seller.lastScrapedAt)}</td>
                    <td className="text-end">
                      <button className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2" 
                        onClick={() => handleStartScrape(seller)}
                        disabled={!!actingOn[seller.sellerId]}>
                        {actingOn[seller.sellerId] === 'start' ? <span className="icon-[svg-spinners--eclipse]" aria-hidden="true"></span> : <Play size={14} />}
                        Scrape
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hint-card d-flex align-items-start gap-3">
        <div className="icon-box bg-primary-subtle p-2 rounded-3 text-primary">
          <Info size={20} />
        </div>
        <div>
          <h6 className="fw-bold text-dark mb-1">Why this replaces Octoparse</h6>
          <p className="text-muted small mb-0">
            Scraping now runs in-house with Playwright — no Octoparse task IDs needed. Stats and per-ASIN snapshots are
            stored in the database and streamed live via Socket.IO. Octoparse data remains intact, just no longer driving sync.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScraperDashboardPage;