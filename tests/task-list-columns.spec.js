/**
 * Task list row contract.
 *
 * Guards the column set the seller actually asked for: task name, seller name,
 * a details overview, the assignee, and the required-document counters. This
 * locks both the header labels and the row cells, so a future column change
 * that silently drops (say) the seller or the details overview fails here
 * instead of shipping a table that looks fine but answers nothing.
 */
import { test, expect } from '@playwright/test';

// Priority moved into the task cell as a tag and SLA became a dot next to the
// due date, so the row is 9 columns. An earlier 11-column version could not fit
// the flexible task/details tracks in a card with the insights panel open, which
// wrapped every cell into ~400px rows; the row now scrolls sideways instead.
const HEADER_LABELS = ['Task', 'Seller', 'Details', 'Assignee', 'Progress', 'Status', 'Due / SLA', 'Actions'];

// /auth/me is the source of truth for permissions; ProtectedRoute reads it, not
// the cached localStorage user.
const user = {
  _id: 'u-1',
  Id: 'u-1',
  email: 'lead@example.com',
  firstName: 'Priya',
  lastName: 'Sharma',
  role: { name: 'super_admin' },
  isAdmin: true,
  permissions: ['tasks_view', 'tasks_manage'],
};

/** Stubs every endpoint the page hits so the list renders deterministically. */
async function mockTasksPage(page, tasks) {
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.addInitScript((u) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);

  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname.endsWith('/auth/me')) return json({ success: true, data: user });
    if (pathname.endsWith('/auth/permissions')) return json({ success: true, data: user.permissions });
    if (pathname.endsWith('/notifications')) return json({ success: true, data: [] });
    if (pathname.includes('/pems/instances')) {
      return json({ success: true, instances: tasks, pagination: { page: 1, limit: 25, total: tasks.length, totalPages: 1 } });
    }
    if (pathname.includes('/pems/automation-stats')) {
      return json({ success: true, data: { total: 0, open: 0, overdue: 0, byRuleset: [] } });
    }
    if (pathname.includes('/pems/templates/filters')) {
      return json({ success: true, data: { categories: ['PRICING', 'LISTING'], departments: ['Operations'] } });
    }
    return json({ success: true, data: [] });
  });
}

const task = {
  Id: 'inst-1',
  InstanceCode: 'PT-0001',
  Title: 'Reconcile Amazon listing buybox for SKU batch',
  Description: 'Buybox is being lost on 42 SKUs across the catalog. Reconcile pricing, fix the lowest two offers and re-verify the featured offer.',
  SellerId: 's-1',
  SellerName: 'Nova Retail LLC',
  AssignedTo: 'u-1',
  AssigneeName: 'Priya Sharma',
  ReviewerId: 'u-2',
  ReviewerName: 'Daniel Okafor',
  Status: 'IN_PROGRESS',
  Priority: 'HIGH',
  Category: 'PRICING',
  Frequency: 'WEEKLY',
  SLAStatus: 'AT_RISK',
  DueDate: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  ProgressPct: 45,
  SubTaskCount: 6,
  CompletedSubTasks: 3,
  Tags: ['buybox', 'q3'],
  Asins: ['B01', 'B02', 'B03'],
  Attachments: [{ name: 'buybox-report.csv' }],
  Source: 'TEMPLATE',
};

test.describe('Task list — required columns', () => {
  // The desktop table only renders above 960px, so pin a desktop viewport here
  // instead of relying on whatever the runner defaults to.
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('header exposes task, seller, details, assignee and the rest', async ({ page }) => {
    await mockTasksPage(page, [task]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    const header = page.locator('.tasks-list-header');
    await expect(header).toBeVisible();
    for (const label of HEADER_LABELS) {
      await expect(header.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('row shows task name, seller name, details overview and assignee', async ({ page }) => {
    await mockTasksPage(page, [task]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    const row = page.locator('.tasks-task-row').first();
    await expect(row).toBeVisible();

    // task name
    await expect(row.getByText('Reconcile Amazon listing buybox for SKU batch')).toBeVisible();
    // seller name, in its own column (not buried in the meta line)
    await expect(row.getByText('Nova Retail LLC')).toBeVisible();
    // details overview — the description is summarised, not dumped in full
    await expect(row.getByText(/Buybox is being lost on 42 SKUs/)).toBeVisible();
    // assignee, and the reviewer alongside them
    await expect(row.getByText('Priya Sharma')).toBeVisible();
    await expect(row.getByText(/Rev: Daniel Okafor/)).toBeVisible();
  });

  test('row shows the required-document counters', async ({ page }) => {
    await mockTasksPage(page, [task]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    const row = page.locator('.tasks-task-row').first();
    await expect(row).toBeVisible();
    // sub-task completion, attachments, ASINs in scope
    await expect(row.getByText('3/6')).toBeVisible();
    await expect(row.getByText('1', { exact: true })).toBeVisible();
  });

  test('brand-less task is labelled instead of showing a blank seller', async ({ page }) => {
    await mockTasksPage(page, [{ ...task, Id: 'inst-2', SellerId: null, SellerName: null }]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    const row = page.locator('.tasks-task-row').first();
    await expect(row.getByText('All brands')).toBeVisible();
  });

  test('unassigned task shows an explicit Unassigned state', async ({ page }) => {
    await mockTasksPage(page, [{ ...task, Id: 'inst-3', AssigneeName: null, AssignedTo: null }]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    const row = page.locator('.tasks-task-row').first();
    await expect(row.getByText('Unassigned')).toBeVisible();
  });

  test('a single task stays a single compact row', async ({ page }) => {
    await mockTasksPage(page, [task]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    const row = page.locator('.tasks-task-row').first();
    await expect(row).toBeVisible();
    const box = await row.boundingBox();

    // A long description plus six document chips used to wrap the row to ~394px.
    // One line of data must not be a screen tall.
    expect(box.height).toBeLessThan(140);

    // Details chips are capped and scroll with the row rather than wrapping,
    // and the header must stay aligned with the cells beneath it.
    const header = page.locator('.tasks-list-header');
    const headerBox = await header.boundingBox();
    expect(Math.abs(headerBox.width - box.width)).toBeLessThan(2);
  });

  test('narrow desktops scroll the row instead of crushing it', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await mockTasksPage(page, [task]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    const scroller = page.locator('.tasks-list-scroll').first();
    await expect(scroller).toBeVisible();

    const metrics = await scroller.evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth + 1,
      overflowX: getComputedStyle(el).overflowX,
    }));
    expect(metrics.overflowX).toBe('auto');
    // Below the row min-width the list must scroll, otherwise cells wrap again.
    expect(metrics.scrollable).toBe(true);
  });

  test('no automation-stats 500 in the console', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await mockTasksPage(page, [task]);
    await page.goto('/tasks/tasks');
    await page.waitForLoadState('networkidle');

    expect(errors.filter((e) => /automation-stats.*500|500.*automation-stats/i.test(e))).toEqual([]);
  });
});
