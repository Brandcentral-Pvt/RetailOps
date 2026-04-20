import React, { useState, Suspense, lazy } from 'react';
import { Package, X, RefreshCw, FileJson, Plus, Database, CheckCircle2, PauseCircle, Eye, Edit3, Trash2 } from 'lucide-react';
import { asinApi, marketSyncApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ProgressBar from '../common/ProgressBar';

const AddBulkAsinModal = lazy(() => import('./AddBulkAsinModal'));
const EditAsinModal = lazy(() => import('./EditAsinModal'));
const AsinDetailsModal = lazy(() => import('./AsinDetailsModal'));

const SellerAsinsModal = ({
  seller,
  asins,
  onClose,
  onAddAsin,
  onDeleteAsin,
  onToggleStatus,
  onUpdateAsin,
  onSyncAsin,
  isAdmin,
  isGlobalUser,
  onRefresh,
  pagination = { page: 1, limit: 50, total: 0, totalPages: 0 },
  onLoadMore,
  loading
}) => {
  const { addToast } = useToast();
  const [showAddAsinModal, setShowAddAsinModal] = useState(false);
  const [showEditAsinModal, setShowEditAsinModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingAsin, setEditingAsin] = useState(null);
  const [detailedAsin, setDetailedAsin] = useState(null);
  const [newAsinsText, setNewAsinsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  const handleJsonUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      addToast({ title: 'Invalid File', message: 'Please upload a valid JSON file.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      let pInterval;
      try {
        const jsonData = JSON.parse(event.target.result);
        setIsSubmitting(true);
        setSubmitProgress(10);

        pInterval = setInterval(() => {
          setSubmitProgress(prev => Math.min(prev + 5, 95));
        }, 300);

        const result = await marketSyncApi.bulkInjectJson(seller._id, jsonData);

        addToast({
          title: 'Import Success',
          message: result.message || 'Data injected successfully',
          type: 'success'
        });

        setSubmitProgress(100);
        if (onRefresh) await onRefresh();
      } catch (error) {
        addToast({
          title: 'Import Failed',
          message: 'Failed to process JSON: ' + error.message,
          type: 'error'
        });
      } finally {
        if (pInterval) clearInterval(pInterval);
        setIsSubmitting(false);
        setSubmitProgress(0);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleEditAsin = (asin) => {
    setEditingAsin(asin);
    setShowEditAsinModal(true);
  };

  const handleViewDetails = (asin) => {
    setDetailedAsin(asin);
    setShowDetailsModal(true);
  };

  const handleBulkAddAsins = async () => {
    if (!newAsinsText.trim()) return;

    let sInterval;
    setIsSubmitting(true);
    setSubmitProgress(10);

    try {
      const asinList = newAsinsText.split(/[,\s\n]+/).map(a => a.trim().toUpperCase()).filter(a => a.length > 0);
      const asinsPayload = asinList.map(code => ({
        asinCode: code,
        seller: seller._id,
        status: 'Active'
      }));

      setSubmitProgress(20);
      sInterval = setInterval(() => {
        setSubmitProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await asinApi.createBulk(asinsPayload);
      setSubmitProgress(100);

      if (onRefresh) await onRefresh();

      if (result.duplicatesCount > 0) {
        addToast({
          title: 'Partial Success',
          message: `${result.insertedCount} added. ${result.duplicatesCount} skipped.`,
          type: 'warning',
          duration: 10000
        });
      } else {
        addToast({
          title: 'Success',
          message: `Successfully added ${result.insertedCount} ASIN(s).`,
          type: 'success'
        });
      }

      setNewAsinsText('');
      setShowAddAsinModal(false);
    } catch (error) {
      addToast({
        title: 'Bulk Add Failed',
        message: error.message || 'Failed to process ASINs',
        type: 'error'
      });
    } finally {
      if (sInterval) clearInterval(sInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.6)', backdropFilter: 'blur(12px)', zIndex: 1060 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden" style={{ background: '#fff', maxHeight: '90vh' }}>
          <div className="modal-header border-0 px-4 pt-4 pb-0 d-flex align-items-center justify-content-between">
            <h5 className="modal-title d-flex align-items-center gap-2 text-zinc-900 fw-bold" style={{ fontSize: '15px' }}>
              <div className="p-1.5 bg-zinc-900 text-white rounded-2 shadow-sm">
                <Package size={18} strokeWidth={2.5} />
              </div>
              ASIN Inventory — {seller.name}
            </h5>
            <button type="button" className="btn-white-icon border-0 shadow-none" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body p-0 d-flex flex-column" style={{ overflow: 'hidden' }}>
            {isSubmitting && (
              <div className="px-4 py-2 bg-zinc-50 border-bottom border-zinc-100">
                <ProgressBar value={submitProgress} label="Processing operation..." size="xs" color="primary" />
              </div>
            )}

            <div className="px-1 py-4 flex-grow-1 overflow-auto">
              <div className="px-3">
                <div className="d-flex justify-content-between align-items-center mb-4 px-1">
                  <div className="d-flex align-items-center gap-3">
                    <span className="text-zinc-400 smallest fw-bold uppercase tracking-wider">{pagination.total} ASINs Cataloged</span>
                    {loading && <div className="spinner-border spinner-border-sm text-zinc-300" role="status"></div>}
                  </div>
                  <div className="d-flex gap-2">
                    <input type="file" id="jsonUpload" hidden accept=".json" onChange={handleJsonUpload} />
                    <button
                      className="btn btn-white btn-sm border-zinc-200 shadow-sm d-flex align-items-center gap-2 px-3 rounded-3"
                      onClick={() => document.getElementById('jsonUpload').click()}
                      disabled={isSubmitting}
                      style={{ height: '34px', fontSize: '12px' }}
                    >
                      <FileJson size={14} className="text-zinc-600" />
                      <span className="fw-bold">Bulk JSON Sync</span>
                    </button>
                    <button
                      className="btn btn-zinc-900 btn-sm shadow-sm d-flex align-items-center gap-2 px-3 rounded-3"
                      onClick={() => setShowAddAsinModal(true)}
                      style={{ height: '34px', fontSize: '12px', background: '#18181B', color: '#fff' }}
                    >
                      <Plus size={14} />
                      <span className="fw-bold">Add ASIN(s)</span>
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table data-table mb-0 align-middle">
                    <thead className="sticky-top bg-white" style={{ zIndex: 10, top: '-1px' }}>
                      <tr className="border-bottom border-zinc-100">
                        <th className="py-3 text-zinc-500 smallest fw-bold uppercase text-start">Identifier</th>
                        <th className="py-3 text-zinc-500 smallest fw-bold uppercase text-start">Identity & Specs</th>
                        <th className="py-3 text-zinc-500 smallest fw-bold uppercase text-start">Commercials</th>
                        <th className="py-3 text-zinc-500 smallest fw-bold uppercase text-start">Inventory</th>
                        <th className="py-3 text-zinc-500 smallest fw-bold uppercase text-start">Status</th>
                        <th className="py-3 text-zinc-500 smallest fw-bold uppercase text-end">Control</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asins.length === 0 && !loading ? (
                        <tr>
                          <td colSpan="6" className="text-center py-5">
                            <div className="d-flex flex-column align-items-center opacity-40">
                              <Database size={40} className="mb-2 text-zinc-300" />
                              <span className="fw-medium text-zinc-400">No ASINs tracked for this store yet</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {asins.map(asin => (
                            <tr key={asin._id} className="border-bottom border-zinc-50 hover-bg-zinc-50 transition-colors">
                              <td className="py-3 fw-bold text-zinc-900 font-monospace smallest">{asin.asinCode}</td>
                              <td className="py-3">
                                <div className="d-flex flex-column gap-0.5">
                                  <span className="fw-bold text-zinc-800 tracking-tight" style={{ fontSize: '11px' }}>{asin.sku || 'N/A'}</span>
                                  <span className="text-zinc-400 truncate opacity-80" style={{ maxWidth: '220px', fontSize: '10px' }}>{asin.title || 'Loading title...'}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="d-flex flex-column gap-0.5">
                                  <span className="fw-black text-zinc-900" style={{ fontSize: '11px' }}>₹{asin.currentPrice?.toLocaleString() || '0'}</span>
                                  <span className="text-zinc-400 smallest fw-medium opacity-80">Rank: #{asin.bsr || 'N/A'}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className={`d-inline-flex px-1.5 py-0.5 rounded-1 fw-bold smallest ${asin.stockLevel > 20 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                  {asin.stockLevel || 0}
                                </div>
                              </td>
                              <td className="py-3">
                                <button
                                  className={`btn btn-sm p-0 border-0 d-flex align-items-center gap-1.5 ${asin.status === 'Active' ? 'text-success' : 'text-zinc-400'}`}
                                  onClick={() => onToggleStatus(asin._id, asin.status)}
                                >
                                  {asin.status === 'Active' ? <CheckCircle2 size={15} /> : <PauseCircle size={15} />}
                                  <span className="fw-bold uppercase tracking-widest" style={{ fontSize: '9px' }}>{asin.status}</span>
                                </button>
                              </td>
                              <td className="py-3">
                                <div className="d-flex gap-1 justify-content-end">
                                  <button onClick={() => handleViewDetails(asin)} className="btn-white-icon smaller border-zinc-200" title="Details">
                                    <Eye size={13} />
                                  </button>
                                  <button onClick={() => onSyncAsin(asin._id)} className="btn-white-icon smaller border-zinc-200" title="Sync">
                                    <RefreshCw size={13} />
                                  </button>
                                  <button onClick={() => handleEditAsin(asin)} className="btn-white-icon smaller border-zinc-200" title="Modify">
                                    <Edit3 size={13} />
                                  </button>
                                  {isAdmin && (
                                    <button onClick={() => onDeleteAsin(asin._id)} className="btn-white-icon smaller border-zinc-200 text-danger" title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {pagination.page < pagination.totalPages && (
                  <div className="py-4 d-flex justify-content-center">
                    <button
                      className="btn btn-white border-zinc-200 px-4 rounded-pill fw-bold smallest text-zinc-600 shadow-sm"
                      onClick={onLoadMore}
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="d-flex align-items-center gap-2">
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Fetching More Data...</span>
                        </div>
                      ) : (
                        <span>Load More Results ({pagination.total - asins.length} remaining)</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer border-0 px-4 py-3 bg-zinc-50/50">
            <button className="btn btn-white fw-bold px-4 border-zinc-200 rounded-pill shadow-sm" onClick={onClose} style={{ fontSize: '12px' }}>Close</button>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {showAddAsinModal && (
          <AddBulkAsinModal
            seller={seller}
            onClose={() => setShowAddAsinModal(false)}
            onAdd={handleBulkAddAsins}
            isSubmitting={isSubmitting}
            text={newAsinsText}
            setText={setNewAsinsText}
          />
        )}

        {showEditAsinModal && editingAsin && (
          <EditAsinModal
            asin={editingAsin}
            onClose={() => { setShowEditAsinModal(false); setEditingAsin(null); }}
            onSave={(data) => {
              onUpdateAsin(editingAsin._id, data);
              setShowEditAsinModal(false);
            }}
          />
        )}

        {showDetailsModal && detailedAsin && (
          <AsinDetailsModal
            asin={detailedAsin}
            onClose={() => { setShowDetailsModal(false); setDetailedAsin(null); }}
          />
        )}
      </Suspense>
    </div>
  );
};

export default React.memo(SellerAsinsModal);
