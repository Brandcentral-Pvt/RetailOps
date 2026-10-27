import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import { AuthProvider } from '/src/contexts/AuthContext.jsx';
import OosTaskView from '/src/modules/tasks/views/oos/OosTaskView.jsx';

const task = {
  Id: 'oos-inst-1',
  InstanceCode: 'OOS-0001',
  Title: 'Reconcile out-of-stock exposure',
  Description: 'OOS reconciliation run',
  SellerName: 'Nova Retail LLC',
  Status: 'IN_PROGRESS',
  Priority: 'HIGH',
  Source: 'TEMPLATE',
  TemplateCode: 'OOS-RECON-001',
  TemplateName: 'OOS Reconciliation',
  Asins: '[]',
  ProgressPct: 25,
  SubTasks: [],
  Activities: [],
  AuditLogs: [],
};

const viewDefinition = {
  viewKey: 'OOS_RECON_V1',
  version: 4,
  tabs: [
    { key: 'overview', label: 'Overview', widgetKey: 'OosOverviewTab' },
    { key: 'sources', label: 'Data Sources', widgetKey: 'OosSourceUploader' },
    { key: 'asins', label: 'Affected ASINs', widgetKey: 'OosAffectedAsinsGrid' },
  ],
};

createRoot(document.getElementById('root')).render(
  <ConfigProvider>
    <AntApp>
      <AuthProvider>
        <OosTaskView task={task} viewDefinition={viewDefinition} />
      </AuthProvider>
    </AntApp>
  </ConfigProvider>,
);
