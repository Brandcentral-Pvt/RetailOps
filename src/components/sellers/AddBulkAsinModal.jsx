import React from 'react';
import { Plus, Scan, RefreshCw } from 'lucide-react';

const AddBulkAsinModal = ({ seller, onClose, onAdd, isSubmitting, text, setText }) => {
  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(4px)', zIndex: 1080 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-4 shadow-2xl border-0 overflow-hidden">
          <div className="modal-header border-0 px-4 pt-4 pb-0">
            <h5 className="h5 fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 text-zinc-900 rounded-3 border border-zinc-200">
                <Plus size={20} />
              </div>
              Add ASINs to {seller.name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            <p className="text-muted smallest mb-4">Enter Amazon Standard Identification Numbers (ASINs) separated by commas or new lines. Our sync agents will start tracking them immediately.</p>
            <div className="mb-0">
              <label className="form-label smallest fw-bold uppercase text-zinc-400 mb-2 d-flex align-items-center gap-2">
                <Scan size={14} className="text-zinc-400" /> Target ASIN List
              </label>
              <textarea
                className="form-control border-zinc-200 shadow-sm font-monospace"
                rows="6"
                style={{ borderRadius: '12px', fontSize: '11px', padding: '12px' }}
                placeholder="Enter ASINs here (one per line or comma separated)..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              ></textarea>
              <div className="mt-2 smallest text-zinc-400 italic">
                Valid ASINs are 10-character alphanumeric codes.
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
            <button type="button" className="btn btn-white fw-bold rounded-pill px-4 border border-zinc-200" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-zinc-900 fw-bold rounded-pill px-4 shadow-sm text-white d-flex align-items-center gap-2"
              onClick={onAdd}
              disabled={isSubmitting || !text.trim()}
              style={{ backgroundColor: '#18181B' }}
            >
              {isSubmitting ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
              <span>{isSubmitting ? 'Adding...' : 'Add to Inventory'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AddBulkAsinModal);
