import React from 'react';
import { Tooltip } from 'antd';
import styles from '../AsinManager.module.css';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (KPI pills strip region).
const KpiStrip = ({ kpis, showDashboard }) => {
    return (
      <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: showDashboard ? '52px' : '0px', transition: 'all 0.3s ease', opacity: showDashboard ? 1 : 0, pointerEvents: showDashboard ? 'auto' : 'none' }}>
        <div className={`px-3 py-1 d-flex align-items-center gap-2 overflow-x-auto ${styles.customScrollbar}`} style={{ width: '100%' }}>
          {kpis.map((kpi, idx) => (
            <Tooltip key={idx} title={kpi.sub || null} placement="bottom" mouseEnterDelay={0.3}>
              <div
                className={`bg-white border shadow-sm d-flex align-items-center gap-2 px-3 ${styles.hoverUpMild}`}
                style={{
                  height: '32px',
                  minWidth: 'max-content',
                  flexShrink: 0,
                  cursor: kpi.onClick ? 'pointer' : 'default',
                  borderRadius: '6px',
                  borderColor: 'var(--border-light)'
                }}
                onClick={kpi.onClick}
              >
                {/* Status Dot */}
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: kpi.color,
                    flexShrink: 0
                  }}
                />

                {/* Label */}
                <span className="text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.03em', color: kpi.color, whiteSpace: 'nowrap' }}>
                  {kpi.label}
                </span>

                {/* Value */}
                <span className="fw-bolder ms-1" style={{ fontSize: 'var(--font-size-xs)', color: '#09090b' }}>
                  {kpi.value}
                </span>

                {/* Inline sub hint */}
                {kpi.sub && (
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '2px' }}>
                    ({kpi.sub})
                  </span>
                )}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
    );
};

export default KpiStrip;
