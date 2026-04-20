import React, { useState } from 'react';
import { Edit3, X } from 'lucide-react';

const EditAsinModal = ({ asin, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    asinCode: asin.asinCode,
    sku: asin.sku || '',
    status: asin.status || 'Active'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(4px)', zIndex: 1080 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
        <div className="modal-content rounded-4 shadow-2xl border-0 overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="modal-header border-0 px-4 pt-4 pb-0">
              <h5 className="h5 fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
                <div className="p-2 bg-zinc-100 text-zinc-900 rounded-3 border border-zinc-200">
                  <Edit3 size={20} />
                </div>
                Edit Product Data
              </h5>
              <button type="button" className="btn-white-icon border-0 shadow-none" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body p-4">
              <div className="mb-4">
                <label className="form-label smallest fw-bold text-zinc-500 uppercase tracking-widest mb-2">ASIN Identifier</label>
                <input
                  type="text"
                  className="form-control border-zinc-200 shadow-sm rounded-3 fw-bold font-monospace bg-zinc-50"
                  value={formData.asinCode}
                  disabled
                />
              </div>
              <div className="mb-4">
                <label className="form-label smallest fw-bold text-zinc-500 uppercase tracking-widest mb-2">Internal SKU / Label</label>
                <input
                  type="text"
                  className="form-control border-zinc-200 shadow-sm rounded-3"
                  value={formData.sku}
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Enter store specific SKU"
                />
              </div>
              <div className="mb-0">
                <label className="form-label smallest fw-bold text-zinc-500 uppercase tracking-widest mb-2">Catalog Status</label>
                <select
                  className="form-select border-zinc-200 shadow-sm rounded-3"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active Tracking</option>
                  <option value="Paused">Paused / Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-footer border-0 p-4 pt-0 gap-2">
              <button type="button" className="btn btn-white fw-bold px-4 border-zinc-200 rounded-pill" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-zinc-900 fw-bold px-4 rounded-pill text-white" style={{ background: '#18181B' }}>Commit Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default React.memo(EditAsinModal);
