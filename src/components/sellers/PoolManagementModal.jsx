import React, { useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { marketSyncApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const PoolManagementModal = ({ stats, onClose, onRefresh }) => {
  const { addToast } = useToast();
  const [taskIdsText, setTaskIdsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = async () => {
    const ids = taskIdsText.split(/[\n,]+/).map(id => id.trim()).filter(id => id.length > 0);
    if (ids.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await marketSyncApi.uploadPoolTasks(ids);
      if (response.success) {
        addToast({
          title: 'Success',
          message: response.message,
          type: 'success'
        });
        setTaskIdsText('');
        onRefresh();
      }
    } catch (error) {
      addToast({
        title: 'Upload Failed',
        message: error.message,
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4">
          <div className="modal-header border-0 p-4 pb-0">
            <h5 className="fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 rounded-3 border border-zinc-200">
                <Database size={20} className="text-zinc-600" />
              </div>
              Octoparse Task Pool
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            <div className="row g-3 mb-4">
              <div className="col-4">
                <div className="bg-zinc-50 p-3 rounded-3 border border-zinc-100 text-center">
                  <div className="smallest text-zinc-400 fw-bold uppercase mb-1">Total</div>
                  <div className="h4 fw-bold mb-0">{stats.total}</div>
                </div>
              </div>
              <div className="col-4">
                <div className="bg-success-subtle p-3 rounded-3 border border-success-subtle text-center">
                  <div className="smallest text-success-emphasis fw-bold uppercase mb-1">Available</div>
                  <div className="h4 fw-bold mb-0 text-success">{stats.available}</div>
                </div>
              </div>
              <div className="col-4">
                <div className="bg-zinc-100 p-3 rounded-3 border border-zinc-200 text-center">
                  <div className="smallest text-zinc-500 fw-bold uppercase mb-1">Assigned</div>
                  <div className="h4 fw-bold mb-0">{stats.assigned}</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Import New Task IDs</label>
              <textarea
                className="form-control form-control-sm border-zinc-200 font-monospace"
                rows="8"
                placeholder="c6ebbaff-448f-3c6d-92d2-5caa10ea5db5&#10;74be0547-1adc-4c46-a31d-011d759d672d..."
                value={taskIdsText}
                onChange={(e) => setTaskIdsText(e.target.value)}
                style={{ fontSize: '11px' }}
              ></textarea>
              <div className="form-text smallest text-muted mt-2">
                Paste one or more Octoparse Task IDs (one per line). These will be stored in the pool and automatically allocated to sellers when you click the magic wand.
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 p-4 pt-0 gap-2">
            <button className="btn btn-white fw-bold px-4 border border-zinc-200 rounded-pill" onClick={onClose}>Close</button>
            <button
              className="btn btn-zinc-900 fw-bold px-4 rounded-pill shadow-sm d-flex align-items-center gap-2"
              onClick={handleUpload}
              disabled={isSubmitting || !taskIdsText.trim()}
              style={{ backgroundColor: '#18181B', color: '#fff' }}
            >
              {isSubmitting ? <RefreshCw size={16} className="spin" /> : <Database size={16} />}
              <span>{isSubmitting ? 'Importing Tasks' : 'Register to Pool'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PoolManagementModal);
