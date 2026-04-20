import React, { useState, useEffect } from 'react';
import { FileUp, X, ExternalLink, ShieldCheck, ChevronRight, RefreshCw, FileCheck } from 'lucide-react';
import { userApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const ImportSellerModal = ({ onClose, onImport }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileStats, setFileStats] = useState(null);
  const [managers, setManagers] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    userApi.getManagers()
      .then(data => setManagers(data))
      .catch(() => setManagers([]));
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      addToast({ title: 'Invalid File', message: 'Please upload a CSV file.', type: 'error' });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV is empty or missing data rows.');

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const dataLines = lines.slice(1);

        const nameIdx = headers.findIndex(h => h.includes('name'));
        const idIdx = headers.findIndex(h => h.includes('id'));
        const managerIdx = headers.findIndex(h => h.includes('manager'));
        const marketIdx = headers.findIndex(h => h.includes('market'));

        if (nameIdx === -1 || idIdx === -1) {
          throw new Error('CSV must contain "Store Name" and "Seller ID" columns.');
        }

        const parsedSellers = dataLines.map(line => {
          const cells = line.split(',').map(c => c.trim());
          const name = cells[nameIdx];
          const sellerId = cells[idIdx];
          const managerSearch = managerIdx !== -1 ? cells[managerIdx] : '';
          const marketplace = marketIdx !== -1 ? (cells[marketIdx] || 'amazon.in') : 'amazon.in';

          let managerId = '';
          if (managerSearch) {
            const match = managers.find(m =>
              m.email?.toLowerCase() === managerSearch.toLowerCase() ||
              `${m.firstName} ${m.lastName}`.toLowerCase().includes(managerSearch.toLowerCase())
            );
            if (match) managerId = match._id;
          }

          return { name, sellerId, marketplace, managerId, plan: 'Starter' };
        }).filter(s => s.name && s.sellerId);

        setFileStats({
          name: file.name,
          count: parsedSellers.length,
          data: parsedSellers
        });
      } catch (err) {
        addToast({ title: 'Parse Error', message: err.message, type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImportComplete = async () => {
    if (!fileStats) return;
    setIsImporting(true);
    try {
      await onImport(fileStats.data);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(10px)', zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
        <div className="modal-content overflow-hidden border-0 shadow-2xl rounded-4">
          <div className="modal-header border-0 px-4 pt-4 pb-2">
            <h5 className="h5 fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 rounded-3 border border-zinc-200">
                <FileUp size={20} className="text-zinc-600" />
              </div>
              Bulk Migration Pipeline
            </h5>
            <button type="button" className="btn-white-icon border-0 shadow-none" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body p-4">
            {!fileStats ? (
              <div className="text-center py-5 px-4 bg-zinc-50 rounded-4 border-2 border-dashed border-zinc-200">
                <div className="bg-white p-3 rounded-circle shadow-sm d-inline-flex mb-3 border border-zinc-100">
                  <FileUp size={32} className="text-primary" />
                </div>
                <h6 className="fw-black text-zinc-900 mb-1">Select Inventory Manifest</h6>
                <p className="text-muted smallest mb-4">Upload a .csv file containing store names, merchant IDs, and assigned managers.</p>
                <input
                  type="file"
                  id="csvUpload"
                  className="d-none"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="csvUpload"
                  className="btn btn-zinc-900 fw-bold px-4 rounded-pill text-white shadow-sm cursor-pointer"
                  style={{ backgroundColor: '#18181B' }}
                >
                  {isUploading ? <RefreshCw size={16} className="spin me-2" /> : <ChevronRight size={16} className="me-2" />}
                  Browse manifests
                </label>
              </div>
            ) : (
              <div>
                <div className="p-4 bg-success-subtle border border-success-subtle rounded-4 mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-success text-white p-2 rounded-circle shadow-sm">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="fw-bold text-success-emphasis">{fileStats.name}</div>
                      <div className="smallest text-success-emphasis opacity-75">{fileStats.count} Valid store profiles identified</div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 p-3 rounded-3 border border-zinc-100 mb-4">
                  <div className="d-flex align-items-center justify-content-between smallest mb-2">
                    <span className="fw-bold text-zinc-400 text-uppercase tracking-widest">Target Database</span>
                    <span className="badge bg-zinc-900 text-white rounded-pill px-2">Live Sync</span>
                  </div>
                  <div className="fw-medium text-zinc-600 smallest">Our sync agents will automatically allocate these stores to the respective managers and start scanning ASIN inventory.</div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
            <button className="btn btn-white fw-bold px-4 rounded-pill border border-zinc-200" onClick={onClose}>Abort</button>
            <button
              className="btn btn-zinc-900 fw-bold px-4 rounded-pill shadow-xl text-white d-flex align-items-center gap-2"
              disabled={!fileStats || isImporting}
              onClick={handleImportComplete}
              style={{ backgroundColor: '#18181B' }}
            >
              {isImporting ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />}
              <span>{isImporting ? 'Syncing...' : 'Confirm Migration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ImportSellerModal);
