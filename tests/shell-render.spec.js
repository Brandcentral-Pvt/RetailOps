/**
 * OOS-RECON-001 shared shell render contract.
 *
 * SharedTaskShell is not yet mounted by TaskInstancesPage (Phase 8), so this
 * fixture exercises it directly with mocked instance and view responses. It
 * guards the fallback path and the registered OOS view resolution without
 * switching the production drawer.
 */
import { test, expect } from '@playwright/test';

const user = {
  _id: 'u-shell-1',
  Id: 'u-shell-1',
  email: 'lead@example.com',
  firstName: 'Priya',
  lastName: 'Sharma',
  role: { name: 'super_admin' },
  isAdmin: true,
  permissions: ['tasks_view', 'tasks_manage', 'scraping_manage'],
};

const task = {
  Id: 'inst-1',
  InstanceCode: 'INST-0001',
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

const oosViewSnapshot = {
  version: 4,
  definition: {
    viewKey: 'OOS_RECON_V1',
    version: 4,
    tabs: [
      { key: 'overview', label: 'Overview', widgetKey: 'OosOverviewTab' },
      { key: 'sources', label: 'Data Sources', widgetKey: 'OosSourceUploader' },
      { key: 'asins', label: 'Affected ASINs', widgetKey: 'OosAffectedAsinsGrid' },
    ],
  },
};

function routeJson(route, body) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installBaseRoutes(page, { viewSnapshot }) {
  await page.addInitScript((currentUser) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(currentUser));
  }, user);

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) return routeJson(route, { success: true, data: user });
    if (/\/pems\/instances\/inst-1\/view$/.test(path)) {
      return routeJson(route, { success: true, data: viewSnapshot });
    }
    if (/\/pems\/instances\/inst-1$/.test(path)) {
      return routeJson(route, { success: true, data: { ...task, subTasks: [], activities: [], auditLogs: [] } });
    }
    return routeJson(route, { success: true, data: [] });
  });
}

async function installOosRoutes(page) {
  await page.addInitScript((currentUser) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(currentUser));
  }, user);

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) return routeJson(route, { success: true, data: user });
    if (/\/pems\/instances\/inst-1\/view$/.test(path)) {
      return routeJson(route, { success: true, data: oosViewSnapshot });
    }
    if (/\/pems\/instances\/inst-1$/.test(path)) {
      return routeJson(route, { success: true, data: { ...task, subTasks: [], activities: [], auditLogs: [] } });
    }
    if (path.endsWith('/pems/sellers')) {
      return routeJson(route, { success: true, data: [{ Id: 'seller-1', Name: 'Nova Retail LLC' }] });
    }
    if (/\/pems\/instances\/inst-1\/oos\/sellers\/[^/]+\/runs$/.test(path)) {
      return routeJson(route, {
        success: true,
        data: [{ Id: 'run-1', RunDate: '2026-10-26T00:00:00.000Z', Status: 'RECONCILED' }],
      });
    }
    if (/\/pems\/instances\/inst-1\/oos\/context$/.test(path)) {
      return routeJson(route, {
        success: true,
        data: { manifest: { runId: 'run-1' }, counts: {}, status: 'RECONCILED' },
      });
    }
    if (/\/pems\/instances\/inst-1\/oos\/affected-asins$/.test(path)) {
      if (url.searchParams.get('incidentOnly')) return routeJson(route, { success: true, data: { incidents: [] } });
      if (url.searchParams.get('submission')) return routeJson(route, { success: true, data: { submission: null } });
      return routeJson(route, { success: true, data: { rows: [], total: 0, summary: null } });
    }
    if (/\/pems\/instances\/inst-1\/oos\/runs\/[^/]+\/files$/.test(path)) {
      return routeJson(route, { success: true, data: [] });
    }
    if (/\/pems\/instances\/inst-1\/oos\/exports$/.test(path)) {
      return routeJson(route, { success: true, data: [] });
    }
    return routeJson(route, { success: true, data: [] });
  });
}

function captureErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
  return errors;
}

function realErrors(errors) {
  return errors.filter((error) => !/DevTools|antd|deprecated|Download the React DevTools/i.test(error));
}

test.use({ viewport: { width: 1600, height: 1000 } });

test('shared shell renders the standard fallback with a visible warning', async ({ page }) => {
  const errors = captureErrors(page);
  await installBaseRoutes(page, { viewSnapshot: null });

  await page.goto('/tests/fixtures/shell.html');
  const drawer = page.locator('.ant-drawer');
  await expect(drawer).toBeVisible({ timeout: 10_000 });
  await expect(drawer).toContainText('INST-0001');
  await expect(drawer).toContainText('Standard Task View');
  await expect(drawer).toContainText('using the standard task view');
  expect(realErrors(errors), 'no console or page errors').toEqual([]);
});

test('shared shell resolves the boot-registered OOS view snapshot', async ({ page }) => {
  const errors = captureErrors(page);
  await installOosRoutes(page);

  await page.goto('/tests/fixtures/shell.html');
  const drawer = page.locator('.ant-drawer');
  await expect(drawer).toBeVisible({ timeout: 10_000 });
  await expect(drawer).toContainText('INST-0001');
  await expect(drawer.getByRole('tab', { name: 'Data Sources' })).toBeVisible();
  await expect(drawer.getByRole('tab', { name: 'Affected ASINs' })).toBeVisible();
  await expect(drawer).toContainText('Nova Retail LLC');
  expect(realErrors(errors), 'no console or page errors').toEqual([]);
});
