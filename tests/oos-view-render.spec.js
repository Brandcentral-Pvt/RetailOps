/**
 * OOS-RECON-001 OOS view render contract.
 *
 * Mounts OosTaskView in isolation with mocked task data and mocked API
 * responses. The active task list still uses TaskWorkspace until Phase 8, so
 * this harness guards the OOS view itself without changing the production
 * drawer behaviour.
 */
import { test, expect } from '@playwright/test';

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

test.use({ viewport: { width: 1600, height: 1000 } });

test('OOS view renders with mocked task and run data without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));

  await page.addInitScript((currentUser) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(currentUser));
  }, user);

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path.endsWith('/auth/me')) return json({ success: true, data: user });
    if (path.endsWith('/pems/sellers')) {
      return json({ success: true, data: [{ Id: 'seller-1', Name: 'Nova Retail LLC' }] });
    }
    if (/\/pems\/instances\/oos-inst-1\/oos\/sellers\/[^/]+\/runs$/.test(path)) {
      return json({
        success: true,
        data: [{ Id: 'run-1', RunDate: '2026-10-26T00:00:00.000Z', Status: 'RECONCILED' }],
      });
    }
    if (/\/pems\/instances\/oos-inst-1\/oos\/context$/.test(path)) {
      return json({
        success: true,
        data: {
          manifest: { runId: 'run-1' },
          counts: { affected: 0, resync: 0, incidents: 0 },
          status: 'RECONCILED',
        },
      });
    }
    if (/\/pems\/instances\/oos-inst-1\/oos\/affected-asins$/.test(path)) {
      if (url.searchParams.get('incidentOnly')) return json({ success: true, data: { incidents: [] } });
      if (url.searchParams.get('submission')) return json({ success: true, data: { submission: null } });
      return json({ success: true, data: { rows: [], total: 0, summary: null } });
    }
    if (/\/pems\/instances\/oos-inst-1\/oos\/runs\/[^/]+\/files$/.test(path)) {
      return json({ success: true, data: [] });
    }
    if (/\/pems\/instances\/oos-inst-1\/oos\/exports$/.test(path)) {
      return json({ success: true, data: [] });
    }
    return json({ success: true, data: [] });
  });

  await page.goto('/tests/fixtures/oos-view.html');
  await page.waitForLoadState('networkidle');

  const root = page.locator('#root');
  await expect(root).toContainText('Nova Retail LLC');
  await expect(root.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await expect(root.getByRole('tab', { name: 'Data Sources' })).toBeVisible();
  await expect(root.getByRole('tab', { name: 'Affected ASINs' })).toBeVisible();
  await expect(root.getByRole('tab', { name: 'Follow-ups & Export' })).toBeVisible();
  await expect(root.getByRole('tab', { name: 'Review' })).toBeVisible();

  const real = errors.filter((error) => !/DevTools|antd|deprecated|Download the React DevTools/i.test(error));
  expect(real, 'no console or page errors').toEqual([]);
});
