import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import OosAffectedAsinsGrid from '/src/modules/tasks/views/oos/components/OosAffectedAsinsGrid.jsx';

const baseRow = {
  sellerName: 'Nova Retail LLC',
  sellerId: 'seller-1',
  channel: 'AMAZON',
  sku: 'SKU-1',
  productTitle: 'Test product',
  retailOpsState: 'OOS',
  retailOpsQuantity: 0,
  brandCentralState: 'OOS_ZERO',
  brandCentralQuantity: 0,
  vendorApplicable: false,
  gms: 1000,
  gmsVerified: true,
  gmsSharePct: 50,
  cumulativePct: 50,
  classification: 'CONFIRMED_CHANNEL_OOS',
  confidence: 80,
  resyncStatus: 'NONE',
  resyncEligible: false,
  incidentStatus: 'OPEN',
};

const rows = [
  { ...baseRow, id: 'row-80', asinCode: 'B000000080', priorityGroup: '80%', isNewAsin: false },
  { ...baseRow, id: 'row-20', asinCode: 'B000000020', priorityGroup: '20%', isNewAsin: false },
  { ...baseRow, id: 'row-unverified', asinCode: 'B0000000UN', priorityGroup: 'GMS_UNVERIFIED', gms: null, gmsVerified: false, isNewAsin: false },
  { ...baseRow, id: 'row-new', asinCode: 'B0000000NW', priorityGroup: '80%', isNewAsin: true, firstSeenAt: '2026-10-01T00:00:00.000Z' },
];

createRoot(document.getElementById('root')).render(
  <ConfigProvider>
    <AntApp>
      <OosAffectedAsinsGrid
        data={rows}
        pagination={{ current: 1, pageSize: 50, total: rows.length }}
      />
    </AntApp>
  </ConfigProvider>,
);
