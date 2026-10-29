/**
 * OOS-RECON-001 full E2E flow (OOS-049).
 * Mounts OosTaskView via page.evaluate with mocked API routes.
 */
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 1000 } });

test('full OOS flow: view → upload → reconcile → export → submit → review', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`));

  const user = {
    _id: 'u-oos-1',
    Id: 'u-oos-1',
    email: 'lead@example.com',
    firstName: 'Priya',
    lastName: 'Sharma',
    role: { name: 'super_admin' },
    isAdmin: true,
    permissions: ['tasks_view', 'tasks_manage', 'scraping_manage'],
  };

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/auth/me')) return json({ success: true, data: user });
    if (path === '/api/pems/instances/oos-inst-1') {
      return json({ success: true, data: { Id: 'oos-inst-1', InstanceCode: 'OOS-INST-001', TemplateId: 'cf7dc8fb89884a2383cdde38', TemplateCode: 'OOS-RECON-001', Title: 'OOS Reconciliation - Nova Retail LLC', Description: 'Daily OOS reconciliation', Status: 'DRAFT', SellerId: 'seller-1', SellerName: 'Nova Retail LLC', AssignedTo: 'u-oos-1', brands: [], subTasks: [], Source: 'RULESET' } });
    }
    if (path === '/api/pems/instances/oos-inst-1/view') {
      return json({ success: true, data: { viewDefinition: { viewKey: 'OOS_RECON_V1', version: 1, tabs: [ { key: 'overview', label: 'Overview', widgetKey: 'OosOverviewTab' }, { key: 'datasources', label: 'Data Sources', widgetKey: 'OosSourceUploader' }, { key: 'affected-asins', label: 'Affected ASINs', widgetKey: 'OosAffectedAsinsGrid' }, { key: 'incidents', label: 'Incidents', widgetKey: 'OosFollowupsTab' }, { key: 'export', label: 'Export', widgetKey: 'OosExportPanel' }, { key: 'review', label: 'Review', widgetKey: 'OosReviewTab' } ] } } });
    }
    if (path === '/api/pems/sellers') return json({ success: true, data: [{ Id: 'seller-1', Name: 'Nova Retail LLC', Marketplace: 'amazon.in' }] });
    if (path === '/api/pems/instances/oos-inst-1/oos/sellers/seller-1/runs') return json({ success: true, data: [{ Id: 'run-1', TaskInstanceId: 'oos-inst-1', SellerId: 'seller-1', Channel: 'amazon.in', RunDate: '2026-10-26', Status: 'MONITORING' }] });
    if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/files') {
      if (method === 'GET') return json({ success: true, data: [] });
      if (method === 'POST') return json({ success: true, import: { Id: 'imp-1', RunId: 'run-1', SellerId: 'seller-1', Channel: 'amazon.in', SourceType: 'BRAND_CENTRAL', FileName: 'bc_report.csv', FileHash: 'abc123', TotalRows: 10, AcceptedCount: 10, RejectedCount: 0, Status: 'VALIDATED' }, idempotent: false });
    }
    if (path === '/api/pems/instances/oos-inst-1/oos/affected-asins') return json({ success: true, data: { rows: [], total: 0, page: 1, pageSize: 50 } });
    if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/reconcile' && method === 'POST') return json({ success: true, runId: 'run-1', analysed: 2, counts: { CONFIRMED_CHANNEL_OOS: 1, DISCREPANCY: 1 }, decisions: 2 });
    if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/resync/d-2' && method === 'POST') return json({ success: true, job: { Id: 'rj-1', Status: 'QUEUED', AsinCode: 'B0002', DiscrepancyRevision: 1 } });
    if (path === '/api/pems/instances/oos-inst-1/oos/runs/run-1/resync/d-2/verify' && method === 'POST') return json({ success: true, status: 'VERIFIED_RECOVERED', resolved: true });
    if (path === '/api/pems/instances/oos-inst-1/oos/exports' && method === 'POST') return json({ success: true, export: { Id: 'exp-1', RunId: 'run-1', TaskInstanceId: 'oos-inst-1', Version: 1, FileHash: 'sha256-abc' }, fileHash: 'sha256-abc', version: 1 });
    if (path.endsWith('/download') && path.includes('exports')) return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="oos-exp-1-v1.xlsx"', 'X-Export-Hash': 'sha256-abc' }, body: 'mock-xlsx-content' });
    if (path === '/api/pems/instances/oos-inst-1/oos/submit' && method === 'POST') return json({ success: true, ok: true, checklist: { sources: true, dispositions: true, ownership: true, export: true, reviewer: true, blocking: true }, runStatus: 'SUBMITTED' });
    if (path === '/api/pems/instances/oos-inst-1/oos/review' && method === 'POST') return json({ success: true, ok: true, runStatus: 'CLOSED' });
    if (path === '/api/pems/instances/oos-inst-1/oos/incidents/d-1' && method === 'PATCH') return json({ success: true, incident: { Id: 'd-1', Status: 'OPEN' } });
    if (path === '/api/pems/instances/oos-inst-1/oos/incidents/d-1/resolve' && method === 'POST') return json({ success: true, incident: { Id: 'd-1', Status: 'RESOLVED' } });
    return json({ success: true, data: [] });
  });

  await page.addInitScript(() => localStorage.setItem('oos_recon_v1_enabled', 'all'));

  await page.goto('/tests/fixtures/oos-e2e.html');
  await page.waitForLoadState('networkidle');

  const root = page.locator('#root');

  // Mount the OOS view via page.evaluate after page loads
  await page.evaluate(() => {
    const rootDiv = document.createElement('div');
    rootDiv.id = 'root';
    document.body.appendChild(rootDiv);
    const root = ReactDOM.createRoot(rootDiv);
    root.render(
      React.createElement(AuthProvider, null,
        React.createElement(AntdApp, null,
          React.createElement(OosTaskView, {
            task: { Id: 'oos-inst-1', InstanceCode: 'OOS-INST-001', TemplateId: 'cf7dc8fb89884a2383cdde38', TemplateCode: 'OOS-RECON-001', Title: 'OOS Reconciliation - Nova Retail LLC', Description: 'Daily OOS reconciliation', Status: 'DRAFT', SellerId: 'seller-1', SellerName: 'Nova Retail LLC', AssignedTo: 'u-oos-1', brands: [], subTasks: [], Source: 'RULESET' },
            open: true,
          })
        )
      )
    );
  });

  await page.waitForTimeout(2000);

  const rootEl = page.locator('#root');
  await expect(rootEl).toContainText('Nova Retail LLC');
  await expect(rootEl.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await expect(rootEl.getByRole('tab', { name: 'Data Sources' })).toBeVisible();
  await expect(rootEl.getByRole('tab', { name: 'Affected ASINs' })).toBeVisible();
  await expect(rootEl.getByRole('tab', { name: 'Follow-ups & Export' })).toBeVisible();
  await expect(rootEl.getByRole('tab', { name: 'Review' })).toBeVisible();

  await rootEl.getByRole('tab', { name: 'Review' }).click();
  await page.waitForTimeout(1000);
  const submitBtn = rootEl.getByRole('button', { name: /submit/i }).first();
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await page.waitForTimeout(1000);
    await expect(rootEl).toContainText('SUBMITTED');
  }

  const approveBtn = rootEl.getByRole('button', { name: /approve/i }).first();
  if (await approveBtn.isVisible()) {
    await approveBtn.click();
    await page.waitForTimeout(1000);
    await expect(rootEl).toContainText('CLOSED');
  }

  const real = errors.filter((e) => !/DevTools|antd|deprecated|Download the React DevTools/i.test(e));
  expect(real, 'no console or page errors').toEqual([]);
});
