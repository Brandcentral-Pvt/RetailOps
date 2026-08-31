import React from 'react';
import { Button } from 'antd';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (applied-filters badge bar region).
const ActiveFiltersBar = ({
  appliedFilters,
  appliedSearchQuery,
  selectedSeller,
  getAppliedFiltersBadges,
  resetAllFilters,
}) => {
    return (Object.values(appliedFilters).some(v => v !== '' && (!Array.isArray(v) || v.length > 0)) || appliedSearchQuery || selectedSeller) && (
            <div className="border-bottom d-flex align-items-center flex-wrap gap-3" style={{ flexShrink: 0, padding: '8px 24px', backgroundColor: 'var(--bg-secondary)' }}>
              <span className="text-secondary fw-bold text-uppercase tracking-wider" style={{ fontSize: '9px' }}>
                Active Filters
              </span>
              <div className="d-flex flex-wrap gap-2">
                {getAppliedFiltersBadges()}
              </div>
              <Button
                type="link"
                className="text-danger text-decoration-none ms-auto fw-bold p-0"
                style={{ fontSize: 'var(--font-size-xs)' }}
                onClick={resetAllFilters}
              >
                Clear All
              </Button>
            </div>
          );
};

export default ActiveFiltersBar;
