import React from 'react';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (repair progress banner region).
const RepairStatusBanner = ({ repairStatus }) => {
    return repairStatus && (
        <div className="mt-2 py-1 px-3 bg-amber-50 border border-amber-100 rounded-2 d-flex align-items-center gap-3">
          <span className="icon-[svg-spinners--eclipse] text-amber-500" style={{ fontSize: 12 }} aria-hidden="true" />
          <span className="smallest text-amber-900 fw-bold text-uppercase tracking-wider" style={{ fontSize: '9px' }}>Data Repair</span>
          <div className="flex-grow-1" style={{ height: '4px', background: 'var(--bc-amber-100)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--text-warning)', width: `${repairStatus.percentage}%`, transition: 'width 0.4s ease' }} />
          </div>
          <span className="smallest text-amber-600 fw-bold" style={{ fontSize: '9px' }}>{repairStatus.processed}/{repairStatus.total}</span>
        </div>
      );
};

export default RepairStatusBanner;
