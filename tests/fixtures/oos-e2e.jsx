/**
 * OOS-RECON-001 full E2E flow harness (OOS-049).
 *
 * Mounts OosTaskView directly (like oos-view-render.spec.js does) with mocked
 * API routes so the full flow can be exercised: upload, reconcile, affected-ASIN
 * grid, resync, export, submit, review.
 *
 * The feature flag is enabled via localStorage so TaskViewResolver would use
 * SharedTaskShell, but we mount OosTaskView directly for test stability.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { AuthProvider } from '/src/contexts/AuthContext.jsx';
import OosTaskView from '/src/modules/tasks/views/oos/OosTaskView.jsx';

// Mock auth user
const mockUser = {
  _id: 'u-oos-1',
  Id: 'u-oos-1',
  email: 'lead@example.com',
  firstName: 'Priya',
  lastName: 'Sharma',
  role: { name: 'super_admin' },
  isAdmin: true,
  permissions: ['tasks_view', 'tasks_manage', 'scraping_manage'],
};

// Mock all API calls via window.fetch
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const path = new URL(url, 'http://localhost').pathname;

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // Auth
  if (path.endsWith('/auth/me')) {
    return json({ success: true, data: mockUser });
  }

  // Task instance
  if (path === '/api/pems/instances/oos-inst-1') {
    return json({
      success: true,
      data: {
        Id: 'oos-inst-1',
        InstanceCode: 'OOS-INST-001',
        TemplateId: 'cf7dc8fb89884a2383cdde38',
        TemplateCode: 'OOS-RECON-001',
        Title: 'OOS Reconciliation - Nova Retail LLC',
        Description: 'Daily OOS reconciliation for seller Nova Retail LLC',
        Status: 'DRAFT',
        SellerId: 'seller-1',
        SellerName: 'Nova Retail LLC',
        AssignedTo: 'u-oos-1',
        brands: [],
        subTasks: [],
        Source: 'RULESET',
      },
    });
  }

  // Task view definition
  if (path === '/api/pems/instances/oos-inst-1/view') {
    return json({
      success: true,
      data: {
        viewDefinition: {
          viewKey: 'OOS_RECON_V1',
          version: 1,
          tabs: [
            { key: 'overview', label: 'Overview', widgetKey: 'OosOverviewTab' },
            { key: 'datasources', label: 'Data Sources', widgetKey: 'OosSourceUploader' },
            { key: 'affected-asins', label: 'Affected ASINs', widgetKey: 'OosAffectedAsinsGrid' },
            { key: 'incidents', label: 'Incidents', widgetKey: 'OosFollowupsTab' },
            { key: 'export', label: 'Export', widgetKey: 'OosExportPanel' },
            { key: 'review', label: 'Review', widgetKey: 'OosReviewTab' },
          ],
        },
      },
    });
  }

  // Sellers
  if (path === '/api/pems/sellers') {
    return json({
      success: true,
      data: [{ Id: 'seller-1', Name: 'Nova Retail LLC', Marketplace: 'amazon.in' }],
    });
  }

  // OOS runs
  if (path === '/api/pems/instances/oos-inst-1/oos/sellers/seller-1/runs') {
    return json({
      success: true,
      data: [
        {
          Id: 'run-1',
          TaskInstanceId: 'oos-inst-1',
          SellerId: 'seller-1',
          Channel: 'amazon.in',
          RunDate: '2026-10-26',
          Status: 'MONITORING',
        },
      ],
    });
  }

  // Uploads
  if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/files') {
    if (init?.method === 'GET') {
      return json({ success: true, data: [] });
    }
    if (init?.method === 'POST') {
      return json({
        success: true,
        import: {
          Id: 'imp-1',
          RunId: 'run-1',
          SellerId: 'seller-1',
          Channel: 'amazon.in',
          SourceType: 'BRAND_CENTRAL',
          FileName: 'bc_report.csv',
          FileHash: 'abc123',
          TotalRows: 10,
          AcceptedCount: 10,
          RejectedCount: 0,
          Status: 'VALIDATED',
        },
        idempotent: false,
      });
    }
  }

  // Affected ASINs
  if (path === '/api/pems/instances/oos-inst-1/oos/affected-asins') {
    return json({
      success: true,
      data: {
        rows: [
          {
            DecisionId: 'd-1',
            AsinCode: 'B0001',
            Sku: 'SKU-001',
            SellerId: 'seller-1',
            Channel: 'amazon.in',
            Classification: 'CONFIRMED_CHANNEL_OOS',
            PriorityGroup: '80%',
            IsNewAsin: false,
            GmsVerified: true,
            Gms: 5000,
            ResyncStatus: 'NONE',
            IncidentStatus: 'OPEN',
          },
          {
            DecisionId: 'd-2',
            AsinCode: 'B0002',
            Sku: 'SKU-002',
            SellerId: 'seller-1',
            Channel: 'amazon.in',
            Classification: 'DISCREPANCY',
            PriorityGroup: '20%',
            IsNewAsin: true,
            GmsVerified: true,
            Gms: 2000,
            ResyncStatus: 'QUEUED',
            IncidentStatus: 'OPEN',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      },
    });
  }

  // Reconcile
  if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/reconcile' && init?.method === 'POST') {
    return json({
      success: true,
      runId: 'run-1',
      analysed: 2,
      counts: { CONFIRMED_CHANNEL_OOS: 1, DISCREPANCY: 1 },
      decisions: 2,
    });
  }

  // Resync
  if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/resync/d-2' && init?.method === 'POST') {
    return json({
      success: true,
      job: { Id: 'rj-1', Status: 'QUEUED', AsinCode: 'B0002', DiscrepancyRevision: 1 },
    });
  }

  // Verify resync
  if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/resync/d-2/verify' && init?.method === 'POST') {
    return json({
      success: true,
      status: 'VERIFIED_RECOVERED',
      resolved: true,
    });
  }

  // Export
  if (path === '/api/pems/instances/oos-inst-1/oos/exports' && init?.method === 'POST') {
    return json({
      success: true,
      export: { Id: 'exp-1', RunId: 'run-1', TaskInstanceId: 'oos-inst-1', Version: 1, FileHash: 'sha256-abc' },
      fileHash: 'sha256-abc',
      version: 1,
    });
  }

  // Download export
  if (path.endsWith('/download') && path.includes('exports')) {
    return new Response('mock-xlsx-content', {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="oos-exp-1-v1.xlsx"',
        'X-Export-Hash': 'sha256-abc',
      },
    });
  }

  // Submit
  if (path === '/api/pems/instances/oos-inst-1/oos/submit' && init?.method === 'POST') {
    return json({
      success: true,
      ok: true,
      checklist: { sources: true, dispositions: true, ownership: true, export: true, reviewer: true, blocking: true },
      runStatus: 'SUBMITTED',
    });
  }

  // Review
  if (path === '/api/pems/instances/oos-inst-1/oos/review' && init?.method === 'POST') {
    return json({
      success: true,
      ok: true,
      runStatus: 'CLOSED',
    });
  }

  // Incidents
  if (path === '/api/pems/instances/oos-inst-1/oos/incidents/d-1' && init?.method === 'PATCH') {
    return json({ success: true, incident: { Id: 'd-1', Status: 'OPEN' } });
  }
  if (path === '/api/pems/instances/oos-inst-1/oos/incidents/d-1/resolve' && init?.method === 'POST') {
    return json({ success: true, incident: { Id: 'd-1', Status: 'RESOLVED' } });
  }

  // Default fallback
  return json({ success: true, data: [] });
};

// Suppress Ant Design console warnings during tests
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
  originalError.apply(console, args);
};

function AppWrapper() {
  return (
    <AuthProvider>
      <AntdApp>
        <OosTaskView
          task={{
            Id: 'oos-inst-1',
            InstanceCode: 'OOS-INST-001',
            TemplateId: 'cf7dc8fb89884a2383cdde38',
            TemplateCode: 'OOS-RECON-001',
            Title: 'OOS Reconciliation - Nova Retail LLC',
            Description: 'Daily OOS reconciliation for seller Nova Retail LLC',
            Status: 'DRAFT',
            SellerId: 'seller-1',
            SellerName: 'Nova Retail LLC',
          }}
        />
      </AntdApp>
    </AuthProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <AppWrapper />
  </BrowserRouter>
);
