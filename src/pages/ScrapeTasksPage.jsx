import React, { useState, useEffect } from 'react';
import KPICard from '../components/KPICard';
import { sellerApi, asinApi } from '../services/api';
import octoparseService from '../services/octoparseService';

const ScrapeTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [scrapeType, setScrapeType] = useState('all');
  const [creating, setCreating] = useState(false);
  const [sellerAsins, setSellerAsins] = useState([]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await octoparseService.getScrapeTasks(1, 50);
      setTasks(response.tasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
    setLoading(false);
  };

  const loadSellers = async () => {
    try {
      const response = await sellerApi.getAll();
      setSellers(response.sellers);
    } catch (error) {
      console.error('Failed to load sellers:', error);
    }
  };

  const loadSellerAsins = async (sellerId) => {
    try {
      const asins = await asinApi.getBySeller(sellerId);
      setSellerAsins(asins);
    } catch (error) {
      console.error('Failed to load ASINs:', error);
      setSellerAsins([]);
    }
  };

  useEffect(() => {
    loadTasks();
    loadSellers();
  }, []);

  const handleCreateTask = async () => {
    if (!selectedSellerId) return;
    
    setCreating(true);
    try {
      const seller = sellers.find(s => s._id === selectedSellerId);
      if (!seller) return;
      
      // Get ASINs based on scrape type
      let asins = [];
      if (sellerAsins.length > 0) {
        asins = sellerAsins.map(a => a.asinCode);
      } else {
        // If no ASINs in DB, use demo ASINs
        asins = ['B07XYZ123', 'B07ABC456', 'B07DEF789', 'B07GHI012', 'B07JKL345'];
      }
      
      if (asins.length === 0) {
        alert('No ASINs found for this seller. Please add ASINs in the Sellers page first.');
        setCreating(false);
        return;
      }
      
      const result = await octoparseService.startScrapeTask(asins, seller.marketplace);
      
      // Add seller info to the task
      const updatedTasks = [{
        ...result,
        sellerName: seller.name,
        sellerId: seller.sellerId,
        asinsCount: asins.length,
        scrapeType,
        createdAt: new Date().toISOString(),
      }, ...tasks];
      
      setTasks(updatedTasks);
      setShowCreateModal(false);
      setSelectedSellerId('');
      setSellerAsins([]);
      setScrapeType('all');
      
      alert(`Scraping task created for ${seller.name}. ${asins.length} ASINs will be scraped.`);
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create scraping task: ' + error.message);
    }
    setCreating(false);
  };

  const handleSellerChange = async (sellerId) => {
    setSelectedSellerId(sellerId);
    if (sellerId) {
      await loadSellerAsins(sellerId);
    } else {
      setSellerAsins([]);
    }
  };

  const handleViewResults = async (task) => {
    setSelectedTask(task);
    if (task.status === 'COMPLETED') {
      try {
        const response = await octoparseService.getTaskResults(task.executionId);
        setResults(response.results);
        setShowResults(true);
      } catch (error) {
        console.error('Failed to get results:', error);
      }
    }
  };

  const handleDeleteTask = async (task) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await octoparseService.deleteScrapeTask(task.executionId);
      loadTasks();
    }
  };

  const kpis = [
    { title: 'Total Tasks', value: tasks.length.toString(), icon: 'bi-list-task', trend: tasks.length, trendType: 'neutral' },
    { title: 'Running', value: tasks.filter(t => t.status === 'RUNNING').length.toString(), icon: 'bi-gear', trend: 0, trendType: 'neutral' },
    { title: 'Completed', value: tasks.filter(t => t.status === 'COMPLETED').length.toString(), icon: 'bi-check-circle', trend: tasks.filter(t => t.status === 'COMPLETED').length, trendType: 'positive' },
    { title: 'Failed', value: tasks.filter(t => t.status === 'FAILED').length.toString(), icon: 'bi-x-circle', trend: tasks.filter(t => t.status === 'FAILED').length, trendType: 'negative' },
  ];

  const getStatusBadge = (status) => {
    const map = {
      'PENDING': { class: 'badge-secondary', icon: 'bi-clock' },
      'RUNNING': { class: 'badge-primary', icon: 'bi-gear spin' },
      'COMPLETED': { class: 'badge-success', icon: 'bi-check-circle' },
      'FAILED': { class: 'badge-danger', icon: 'bi-x-circle' },
    };
    const { class: className, icon } = map[status] || { class: 'badge-secondary', icon: 'bi-question-circle' };
    return (
      <span className={`badge ${className}`}>
        <i className={`bi ${icon} me-1`}></i>
        {status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <>
        <header className="main-header">
          <h1 className="page-title"><i className="bi bi-cloud-download"></i>Scrape Tasks</h1>
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
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <h1 className="page-title"><i className="bi bi-cloud-download"></i>Scrape Tasks</h1>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <i className="bi bi-plus-lg me-2"></i>Create Task
          </button>
        </div>
      </header>
      <div className="page-content">
        <div className="kpi-grid mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {kpis.map((kpi, idx) => (
            <KPICard key={idx} title={kpi.title} value={kpi.value} icon={kpi.icon} trend={kpi.trend} trendType={kpi.trendType} />
          ))}
        </div>

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0"><i className="bi bi-list-task"></i> All Scrape Tasks</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={loadTasks}>
                <i className="bi bi-arrow-repeat me-1"></i>Refresh
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table data-table mb-0">
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Seller</th>
                    <th>ASINs</th>
                    <th>Marketplace</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center text-muted py-4">
                        <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '24px' }}></i>
                        No scrape tasks yet. Click "Create Task" to start scraping.
                      </td>
                    </tr>
                  ) : (
                    tasks.map(task => (
                      <tr key={task.executionId}>
                        <td className="fw-medium font-monospace" style={{ fontSize: '0.85rem' }}>
                          {task.executionId.substring(0, 16)}...
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="seller-avatar bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px', fontSize: '0.75rem', fontWeight: '600' }}>
                              {(task.sellerName || 'S').charAt(0)}
                            </div>
                            <span>{task.sellerName || 'Unknown'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-info-subtle text-info">{task.asinsCount || task.asins?.length || 0} ASINs</span>
                        </td>
                        <td>
                          <span className="badge bg-primary-subtle text-primary">{task.marketplace || '-'}</span>
                        </td>
                        <td>
                          <span className={`badge ${task.scrapeType === 'all' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
                            {task.scrapeType === 'all' ? 'All ASINs' : 'Pending Only'}
                          </span>
                        </td>
                        <td>{getStatusBadge(task.status)}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: '8px', width: '100px' }}>
                              <div 
                                className={`progress-bar ${task.status === 'FAILED' ? 'bg-danger' : ''}`}
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                            <span className="fs-sm">{task.progress}%</span>
                          </div>
                        </td>
                        <td className="text-muted fs-sm">{formatDate(task.startedAt || task.createdAt)}</td>
                        <td>
                          <div className="d-flex gap-1">
                            {task.status === 'COMPLETED' && (
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleViewResults(task)}
                                title="View Results"
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                            )}
                            {(task.status === 'PENDING' || task.status === 'RUNNING') && (
                              <button 
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => octoparseService.cancelScrapeTask(task.executionId).then(loadTasks)}
                                title="Cancel"
                              >
                                <i className="bi bi-x"></i>
                              </button>
                            )}
                            <button 
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleDeleteTask(task)}
                              title="Delete"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-plus-circle me-2"></i>Create Scrape Task</h5>
                <button type="button" className="btn-close" onClick={() => { setShowCreateModal(false); setSelectedSellerId(''); setSellerAsins([]); }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Select Seller *</label>
                  <select 
                    className="form-select"
                    value={selectedSellerId}
                    onChange={(e) => handleSellerChange(e.target.value)}
                  >
                    <option value="">Choose a seller...</option>
                    {sellers.filter(s => s.status === 'Active').map(seller => (
                      <option key={seller._id} value={seller._id}>
                        {seller.name} ({seller.marketplace})
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    {sellers.filter(s => s.status === 'Active').length} active sellers available
                  </div>
                </div>
                
                {selectedSellerId && (
                  <div className="mb-3">
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      {(() => {
                        const seller = sellers.find(s => s._id === selectedSellerId);
                        return `${seller?.name} has ${sellerAsins.length} ASINs in the database`;
                      })()}
                    </div>
                  </div>
                )}
                
                <div className="mb-3">
                  <label className="form-label">Scrape Type</label>
                  <div className="d-flex gap-3">
                    <div className="form-check">
                      <input 
                        type="radio" 
                        className="form-check-input"
                        id="scrapeAll"
                        name="scrapeType"
                        checked={scrapeType === 'all'}
                        onChange={() => setScrapeType('all')}
                      />
                      <label className="form-check-label" htmlFor="scrapeAll">
                        <i className="bi bi-box-seam me-1"></i>All ASINs
                      </label>
                      <div className="form-text">Scrape all ASINs for this seller</div>
                    </div>
                    <div className="form-check">
                      <input 
                        type="radio" 
                        className="form-check-input"
                        id="scrapePending"
                        name="scrapeType"
                        checked={scrapeType === 'pending'}
                        onChange={() => setScrapeType('pending')}
                      />
                      <label className="form-check-label" htmlFor="scrapePending">
                        <i className="bi bi-clock me-1"></i>Pending Only
                      </label>
                      <div className="form-text">Only scrape ASINs not scraped recently</div>
                    </div>
                  </div>
                </div>

                {!sellers || sellers.filter(s => s.status === 'Active').length === 0 && (
                  <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    No active sellers found. Please add sellers first in the Sellers page.
                    <a href="/sellers" className="ms-2">Go to Sellers</a>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateModal(false); setSelectedSellerId(''); setSellerAsins([]); }}>Cancel</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleCreateTask}
                  disabled={!selectedSellerId || creating || sellers.filter(s => s.status === 'Active').length === 0}
                >
                  {creating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-arrow-down me-2"></i>
                      Start Scraping
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResults && selectedTask && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Scrape Results - {selectedTask.executionId}</h5>
                <button type="button" className="btn-close" onClick={() => setShowResults(false)}></button>
              </div>
              <div className="modal-body">
                <div className="table-responsive">
                  <table className="table data-table mb-0">
                    <thead>
                      <tr>
                        <th>ASIN</th>
                        <th>Title</th>
                        <th>Price</th>
                        <th>Rating</th>
                        <th>Reviews</th>
                        <th>Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, idx) => (
                        <tr key={idx}>
                          <td className="fw-medium">{result.asin}</td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {result.title}
                          </td>
                          <td>₹{result.price.toFixed(2)}</td>
                          <td>{result.rating}</td>
                          <td>{result.reviews.toLocaleString()}</td>
                          <td>#{result.rank.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-primary" onClick={() => console.log('Import to ASIN Manager', results)}>
                  <i className="bi bi-plus me-1"></i>Import to ASIN Manager
                </button>
                <button className="btn btn-secondary" onClick={() => setShowResults(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScrapeTasksPage;
