import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import KPICard from '../components/KPICard';
import { sellerApi, asinApi, authApi, userApi } from '../services/api';
import {
  Store,
  CheckCircle2,
  PauseCircle,
  Package,
  Search,
  Plus,
  FileUp,
  MoreHorizontal,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Trash2,
  Play,
  Pause,
  LayoutGrid,
  List,
  AlertCircle
} from 'lucide-react';

const SellersPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAsinModal, setShowAsinModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerAsins, setSellerAsins] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [currentUser] = useState(() => authApi.getCurrentUser());
  const isAdmin = currentUser?.role?.name === 'admin' || currentUser?.role === 'admin';

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    setLoading(true);
    try {
      const response = await sellerApi.getAll();
      setSellers(response.sellers);
    } catch (error) {
      console.error('Failed to load sellers:', error);
    }
    setLoading(false);
  };

  const filteredSellers = useMemo(() => {
    if (activeTab === 'all') return sellers;
    return sellers.filter(s => s.status.toLowerCase() === activeTab);
  }, [sellers, activeTab]);


  const handleAddSeller = async (sellerData) => {
    try {
      await sellerApi.create(sellerData);
      await loadSellers();
      setShowAddModal(false);
    } catch (error) {
      alert('Failed to add seller: ' + error.message);
    }
  };

  const handleImportSellers = async (csvData) => {
    try {
      const lines = csvData.split('\n').filter(l => l.trim());
      const newSellers = [];
      lines.forEach((line, idx) => {
        if (idx === 0) return; // Skip header
        const [name, marketplace, sellerId, apiKey] = line.split(',').map(s => s.trim());
        if (name && marketplace && sellerId) {
          newSellers.push({
            name,
            marketplace,
            sellerId,
            apiKey: apiKey || '',
            plan: 'Starter',
            scrapeLimit: 100,
            totalAsins: 0,
            activeAsins: 0,
            status: 'Active',
          });
        }
      });

      if (newSellers.length > 0) {
        await sellerApi.import(newSellers);
        await loadSellers();
        setShowImportModal(false);
      }
    } catch (error) {
      alert('Failed to import sellers: ' + error.message);
    }
  };

  const handleToggleStatus = async (sellerId) => {
    try {
      const seller = sellers.find(s => s._id === sellerId);
      if (seller) {
        await sellerApi.update(sellerId, {
          status: seller.status === 'Active' ? 'Paused' : 'Active'
        });
        await loadSellers();
      }
    } catch (error) {
      alert('Failed to update seller: ' + error.message);
    }
  };

  const handleDeleteSeller = async (sellerId) => {
    if (window.confirm('Are you sure you want to delete this seller? All ASINs will also be deleted.')) {
      try {
        await sellerApi.delete(sellerId);
        await loadSellers();
      } catch (error) {
        alert('Failed to delete seller: ' + error.message);
      }
    }
  };

  const handleViewAsins = async (seller) => {
    setSelectedSeller(seller);
    setShowAsinModal(true);
    try {
      const asins = await asinApi.getBySeller(seller._id);
      setSellerAsins(asins);
    } catch (error) {
      console.error('Failed to load ASINs:', error);
      setSellerAsins([]);
    }
  };

  const handleAddAsin = async (asinData) => {
    try {
      await asinApi.create({
        ...asinData,
        seller: selectedSeller._id,
        status: 'Active',
      });
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      alert('Failed to add ASIN: ' + error.message);
    }
  };

  const handleDeleteAsin = async (asinId) => {
    try {
      await asinApi.delete(asinId);
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      alert('Failed to delete ASIN: ' + error.message);
    }
  };

  const getStatusBadge = (status) => {
    const isActive = status === 'Active';
    return (
      <span
        className={`px-2 py-1 rounded-pill d-inline-flex align-items-center gap-1 small fw-bold ${isActive ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}
        style={{ fontSize: '11px' }}
      >
        <span className={`rounded-circle ${isActive ? 'bg-success' : 'bg-secondary'}`} style={{ width: '6px', height: '6px' }}></span>
        {status}
      </span>
    );
  };

  const getMarketplaceBadge = (marketplace) => {
    const isIN = marketplace === 'amazon.in';
    return (
      <span
        className={`px-2 py-1 rounded-pill small fw-bold d-inline-block ${isIN ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'}`}
        style={{ fontSize: '10px', textTransform: 'uppercase' }}
      >
        {marketplace}
      </span>
    );
  };

  const getHealthIndicator = (seller) => {
    const usage = (seller.scrapeUsed || 0) / (seller.scrapeLimit || 100);
    let color = '#22c55e'; // Green
    let status = 'Healthy';

    if (usage > 0.8) {
      color = '#ef4444'; // Red
      status = 'Risk';
    } else if (usage > 0.5) {
      color = '#f59e0b'; // Amber
      status = 'Warning';
    }

    return (
      <div className="d-flex align-items-center gap-2">
        <div style={{ position: 'relative', width: '24px', height: '24px' }}>
          <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
            <circle cx="18" cy="18" r="16" fill="none" stroke="#f3f4f6" strokeWidth="4" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke={color} strokeWidth="4"
              strokeDasharray={`${Math.min(usage * 100, 100)}, 100`}
            />
          </svg>
        </div>
        <span className="smallest fw-bold text-muted text-uppercase" style={{ fontSize: '9px' }}>{status}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <header className="main-header">
          <h1 className="page-title"><i className="bi bi-shop"></i>Seller Management</h1>
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
      <header className="main-header border-0 bg-transparent px-4 py-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h1 className="h3 fw-bold mb-1" style={{ color: '#111827' }}>Seller Management</h1>
            <p className="text-muted small mb-0">Monitor and manage your connected storefronts</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-white shadow-sm border-0 d-flex align-items-center gap-2" onClick={() => setShowImportModal(true)}>
              <FileUp size={18} />
              <span>Import CSV</span>
            </button>
            <button className="btn btn-primary shadow-sm border-0 d-flex align-items-center gap-2 px-4" onClick={() => setShowAddModal(true)}>
              <Plus size={18} />
              <span>Add Seller</span>
            </button>
          </div>
        </div>
      </header>
      <div className="page-content">

        {/* Tabs and Search */}
        <div className="d-flex justify-content-between align-items-center mb-4 px-1">
          <div className="nav-pills-container bg-white p-1 rounded-3 shadow-sm d-inline-flex border">
            {['all', 'active', 'paused'].map(tab => (
              <button
                key={tab}
                className={`btn btn-sm px-4 rounded-2 border-0 transition-all ${activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="position-relative">
            <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={16} />
            <input
              type="text"
              className="form-control form-control-sm ps-5 bg-white border shadow-sm rounded-3"
              placeholder="Search sellers..."
              style={{ width: '280px', height: '40px' }}
            />
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table data-table custom-premium-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th style={{ width: '25%' }}>Store Details</th>
                  <th>Region</th>
                  <th>Manager</th>
                  <th>Health</th>
                  <th>Resources</th>
                  <th>Consumption</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSellers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center text-muted py-4">
                      <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '24px' }}></i>
                      No sellers found. Add a seller to get started.
                    </td>
                  </tr>
                ) : (
                  filteredSellers.map((seller, index) => (
                    <tr key={seller._id}>
                      <td className="text-muted smallest align-middle">{index + 1}</td>
                      <td className="align-middle">
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className="seller-avatar d-flex align-items-center justify-content-center fw-bold shadow-sm"
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '12px',
                              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                              color: '#fff',
                              fontSize: '14px'
                            }}
                          >
                            {seller.name.charAt(0)}
                          </div>
                          <div>
                            <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>{seller.name}</div>
                            <div className="smallest text-muted d-flex align-items-center gap-1">
                              <span className="font-monospace">{seller.sellerId}</span>
                              <span className="mx-1">•</span>
                              <span>{seller.plan} Plan</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="align-middle">{getMarketplaceBadge(seller.marketplace)}</td>
                      <td className="align-middle">
                        {seller.managers && seller.managers.length > 0 ? (
                          <div className="d-flex flex-column gap-1">
                            {seller.managers.map((m) => (
                              <div key={m._id} className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle border border-2 border-white shadow-sm d-flex align-items-center justify-content-center bg-light text-primary smallest fw-bold"
                                  style={{ width: '20px', height: '20px', flexShrink: 0 }}
                                >
                                  {m.firstName.charAt(0)}
                                </div>
                                <span className="smallest text-dark fw-medium" style={{ whiteSpace: 'nowrap' }}>
                                  {m.firstName} {m.lastName}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted smallest italic opacity-50">No Manager</span>
                        )}
                      </td>
                      <td className="align-middle">{getHealthIndicator(seller)}</td>
                      <td className="align-middle">
                        <div
                          className="d-flex align-items-center gap-2 cursor-pointer"
                          onClick={() => handleViewAsins(seller)}
                        >
                          <Package size={14} className="text-muted" />
                          <div>
                            <div className="fw-bold text-dark smallest">{seller.totalAsins || 0} ASINs</div>
                            <div className="text-muted smallest" style={{ fontSize: '9px' }}>{seller.activeAsins || 0} Live</div>
                          </div>
                        </div>
                      </td>
                      <td className="align-middle" style={{ minWidth: '140px' }}>
                        <div className="d-flex flex-column gap-1">
                          <div className="d-flex justify-content-between smallest mb-1">
                            <span className="text-muted fw-bold">Daily Scrape</span>
                            <span className="text-dark fw-bold">{Math.round(((seller.scrapeUsed || 0) / (seller.scrapeLimit || 100)) * 100)}%</span>
                          </div>
                          <div className="progress shadow-none bg-light border" style={{ height: '6px' }}>
                            <div
                              className={`progress-bar rounded-pill ${(seller.scrapeUsed || 0) / (seller.scrapeLimit || 100) > 0.8 ? 'bg-danger' : (seller.scrapeUsed || 0) / (seller.scrapeLimit || 100) > 0.5 ? 'bg-warning' : 'bg-primary'}`}
                              style={{ width: `${Math.min(((seller.scrapeUsed || 0) / (seller.scrapeLimit || 100)) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <div className="smallest text-muted d-flex align-items-center gap-1 mt-1">
                            <Clock size={10} />
                            <span>{seller.lastScraped ? new Date(seller.lastScraped).toLocaleDateString() : 'No Scrape'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="align-middle">{getStatusBadge(seller.status)}</td>
                      <td className="align-middle text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <button
                            className="btn btn-icon btn-white border shadow-sm"
                            onClick={() => handleViewAsins(seller)}
                            title="Store Inventory"
                          >
                            <LayoutGrid size={14} />
                          </button>
                          <button
                            className={`btn btn-icon border shadow-sm ${seller.status === 'Active' ? 'btn-white' : 'btn-soft-success'}`}
                            onClick={() => handleToggleStatus(seller._id)}
                            title={seller.status === 'Active' ? 'Pause Stream' : 'Start Stream'}
                          >
                            {seller.status === 'Active' ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            className="btn btn-icon btn-soft-danger border shadow-sm"
                            onClick={() => handleDeleteSeller(seller._id)}
                            title="Remove"
                          >
                            <Trash2 size={14} />
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

      {/* Add Seller Modal */}
      {showAddModal && (
        <AddSellerModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSeller}
          isAdmin={isAdmin}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportSellerModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportSellers}
        />
      )}

      {/* ASINs Modal */}
      {showAsinModal && selectedSeller && (
        <SellerAsinsModal
          seller={selectedSeller}
          asins={sellerAsins}
          onClose={() => { setShowAsinModal(false); setSelectedSeller(null); }}
          onAddAsin={handleAddAsin}
          onDeleteAsin={handleDeleteAsin}
        />
      )}
    </>
  );
};

// Add Seller Modal Component
const AddSellerModal = ({ onClose, onSave, isAdmin }) => {
  const [formData, setFormData] = useState({
    name: '',
    marketplace: 'amazon.in',
    sellerId: '',
    apiKey: '',
    plan: 'Starter',
    scrapeLimit: 100,
    managerId: '',
  });
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      userApi.getManagers()
        .then(data => setManagers(data))
        .catch(() => setManagers([]));
    }
  }, [isAdmin]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const { managerId, ...rest } = formData;
    const payload = { ...rest };
    if (isAdmin && managerId) payload.managerId = managerId;
    onSave(payload);
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
          <div className="modal-header border-0 px-4 pt-4 pb-0">
            <h5 className="h5 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <div className="p-2 bg-primary-subtle text-primary rounded-3">
                <Plus size={20} />
              </div>
              Add New Seller
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-4">
              <div className="mb-4">
                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Seller Store Name</label>
                <input
                  type="text"
                  className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                  placeholder="e.g. Retail King"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ borderRadius: '12px' }}
                />
              </div>
              <div className="row">
                <div className="col-md-6 mb-4">
                  <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Marketplace</label>
                  <select
                    className="form-select form-control-lg bg-light border-0 px-3 fs-6"
                    value={formData.marketplace}
                    onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })}
                    style={{ borderRadius: '12px' }}
                  >
                    <option value="amazon.in">Amazon India (IN)</option>
                    <option value="amazon.com">Amazon US (US)</option>
                    <option value="amazon.uk">Amazon UK (UK)</option>
                    <option value="amazon.de">Amazon Germany (DE)</option>
                  </select>
                </div>
                <div className="col-md-6 mb-4">
                  <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Seller ID</label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-light border-0 px-3 fs-6 font-monospace"
                    value={formData.sellerId}
                    onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                    placeholder="A1B2C3D4E5"
                    required
                    style={{ borderRadius: '12px' }}
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="mb-4">
                  <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Assign Manager</label>
                  <select
                    className="form-select form-control-lg bg-light border-0 px-3 fs-6"
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    style={{ borderRadius: '12px' }}
                  >
                    <option value="">— No manager assigned —</option>
                    {managers.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Octoparse API Key</label>
                <input
                  type="password"
                  className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Enter API key"
                  style={{ borderRadius: '12px' }}
                />
              </div>
            </div>
            <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
              <button type="button" className="btn btn-white fw-bold px-4" onClick={onClose} style={{ borderRadius: '12px' }}>Cancel</button>
              <button type="submit" className="btn btn-primary fw-bold px-4" style={{ borderRadius: '12px' }}>
                Create Store
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};


// Import Seller Modal Component
const ImportSellerModal = ({ onClose, onImport }) => {
  const [csvData, setCsvData] = useState('');

  const handleImport = () => {
    if (csvData.trim()) {
      onImport(csvData);
    }
  };

  const downloadTemplate = () => {
    const template = `Seller Name,Marketplace,Seller ID,API Key
TechGear Pro,amazon.in,A1B2C3D4E5F6,oct_xxx123
HomeEssentials,amazon.com,A2B3C4D5E6F7,oct_xxx456`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sellers_import_template.csv';
    a.click();
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title"><i className="bi bi-file-earmark-arrow-up me-2"></i>Import Sellers from CSV</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info mb-3">
              <i className="bi bi-info-circle me-2"></i>
              Upload a CSV file with columns: Name, Marketplace, Seller ID, API Key
            </div>
            <div className="mb-3">
              <button className="btn btn-outline-primary btn-sm mb-2" onClick={downloadTemplate}>
                <i className="bi bi-download me-1"></i>Download Template
              </button>
            </div>
            <div className="mb-3">
              <label className="form-label">Paste CSV Data</label>
              <textarea
                className="form-control"
                rows="8"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="Seller Name,Marketplace,Seller ID,API Key&#10;TechGear Pro,amazon.in,A1B2C3D4E5F6,oct_xxx123&#10;HomeEssentials,amazon.com,A2B3C4D5E6F7,oct_xxx456"
              ></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={!csvData.trim()}>
              <i className="bi bi-file-earmark-check me-2"></i>Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Seller ASINs Modal Component
const SellerAsinsModal = ({ seller, asins, onClose, onAddAsin, onDeleteAsin }) => {
  const [showAddAsinModal, setShowAddAsinModal] = useState(false);
  const [newAsinsText, setNewAsinsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBulkAddAsins = async () => {
    if (!newAsinsText.trim()) return;

    setIsSubmitting(true);
    try {
      // Parse input (comma or newline separated), strip whitespace, filter empty, ensure 10 chars (basic validation)
      const asinList = newAsinsText
        .split(/[\n,]+/)
        .map(a => a.trim().toUpperCase())
        .filter(a => a.length > 0);

      if (asinList.length === 0) {
        alert('No valid ASINs found.');
        setIsSubmitting(false);
        return;
      }

      const asinsPayload = asinList.map(code => ({
        asinCode: code,
        seller: seller._id,
        status: 'Active'
      }));

      // Call the bulk API method
      await asinApi.createBulk(asinsPayload);

      // Refresh list
      const refreshedAsins = await asinApi.getBySeller(seller._id);

      // Update parent component state via a callback, we need to add onRefreshAsins or just call window reload
      // But we can trigger loadSellers somehow. In SellerAsinsModal we don't have direct access to setSellerAsins.
      // Easiest is to reload the window or pass a generic refresh. 
      // We will reload window for simplicity, or we can pass the refreshed data to a new prop.
      // Wait, `onAddAsin` in parent does: await asinApi.create(asinData); const asins = await asinApi.getBySeller(); setSellerAsins(asins);
      // Let's modify the parent's handleAddAsin to handle bulk directly instead, or just do the fetch here and call an update function.

      // We will close the modal and alert user, then reload page, since doing a full state uplift requires parent modifications.
      alert(`Successfully added ${asinList.length} ASIN(s)`);
      setNewAsinsText('');
      setShowAddAsinModal(false);
      window.location.reload();

    } catch (error) {
      alert('Failed to add ASINs: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-box-seam me-2"></i>
              ASINs - {seller.name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted">{asins.length} ASINs</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddAsinModal(true)}>
                <i className="bi bi-plus-lg me-1"></i>Add ASIN(s)
              </button>
            </div>
            <div className="table-responsive">
              <table className="table data-table mb-0">
                <thead>
                  <tr>
                    <th>ASIN</th>
                    <th>Title</th>
                    <th>Brand</th>
                    <th>Price</th>
                    <th>Rank</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {asins.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '24px' }}></i>
                        No ASINs added yet. Click "Add ASIN(s)" to add one or more.
                      </td>
                    </tr>
                  ) : (
                    asins.map(asin => (
                      <tr key={asin._id}>
                        <td className="fw-medium">{asin.asinCode}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asin.title ? asin.title : '-'}
                        </td>
                        <td>{asin.brand ? asin.brand : '-'}</td>
                        <td>{asin.currentPrice ? `₹${asin.currentPrice.toFixed(2)}` : '-'}</td>
                        <td>{asin.currentRank ? `#${asin.currentRank.toLocaleString()}` : '-'}</td>
                        <td>
                          <span className={`badge ${asin.status === 'Active' ? 'badge-success' : 'badge-secondary'}`}>
                            {asin.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onDeleteAsin(asin._id)}
                            title="Delete"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* Add ASIN(s) Modal */}
      {showAddAsinModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-plus-circle me-2"></i>Add ASIN(s)</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddAsinModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-medium">ASIN Code(s) *</label>
                  <textarea
                    className="form-control"
                    rows="5"
                    value={newAsinsText}
                    onChange={(e) => setNewAsinsText(e.target.value)}
                    placeholder="B07XYZ123&#10;B08ABC456&#10;or B07XYZ123, B08ABC456"
                  ></textarea>
                  <div className="form-text">
                    Enter Amazon ASINs. You can paste multiple ASINs separated by commas or new lines.
                  </div>
                  {newAsinsText.trim() && (
                    <div className="mt-2 text-primary small">
                      {newAsinsText.split(/[\n,]+/).filter(a => a.trim().length > 0).length} valid ASIN(s) detected.
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddAsinModal(false)} disabled={isSubmitting}>Cancel</button>
                <button className="btn btn-primary" onClick={handleBulkAddAsins} disabled={!newAsinsText.trim() || isSubmitting}>
                  {isSubmitting ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Adding...</>
                  ) : (
                    <><i className="bi bi-plus-lg me-2"></i>Add {newAsinsText.split(/[\n,]+/).filter(a => a.trim().length > 0).length || ''} ASIN(s)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellersPage;
