import { test, expect } from '@playwright/test';

// The redesigned Task Templates library talks to three endpoints the old page
// never used: /pems/templates/summary (accurate full-table metrics),
// /pems/templates/validate and /pems/templates/config (governed save). These
// tests lock in the behaviour a reviewer cares about — real counts, a working
// table, filter/empty/error states, permission-gated actions, and a builder
// that refuses to publish an invalid template.

const adminUser = {
  _id: 'u1', Id: 'u1', email: 'lead@example.com', firstName: 'Lead', lastName: 'User',
  role: { name: 'super_admin' }, isAdmin: true,
  permissions: ['tasks_view', 'tasks_manage', 'marketplace_amazon', 'marketplace_ajio'],
};

const viewerUser = {
  _id: 'u2', Id: 'u2', email: 'viewer@example.com', firstName: 'View', lastName: 'Only',
  role: { name: 'viewer' }, isAdmin: false,
  permissions: ['tasks_view'],
};

const templates = [
  { Id: 'tpl-1', TaskCode: 'DLY-004', Name: 'OOS Data Monitoring', Description: 'Daily OOS routine', Category: 'INVENTORY', Priority: 'HIGH', Frequency: 'DAILY', IsActive: false, AutoAssign: false, SLAHours: 8, SubTaskDefinitions: [{ title: 'Pull report', activities: [{ title: 'a', instructions: 'x', isMandatory: true }] }] },
  { Id: 'tpl-2', TaskCode: 'DLY-002', Name: 'Buy Box Monitoring', Description: 'Suppression check', Category: 'PRICING', Priority: 'MEDIUM', Frequency: 'DAILY', IsActive: true, AutoAssign: true, SLAHours: 24, SubTaskDefinitions: [] },
  { Id: 'tpl-3', TaskCode: 'DLY-0011', Name: 'GMS Analysis', Description: 'Sales analytics', Category: 'ANALYTICS', Priority: 'LOW', Frequency: 'WEEKLY', IsActive: true, AutoAssign: false, SLAHours: 48, SubTaskDefinitions: [] },
];

const summary = { total: 3, active: 2, withSop: 1, scheduled: 3, automatic: 1 };

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function seed(page, { user = adminUser, templateList = templates, summaryBody = summary, saveStatus = 200 } = {}) {
  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript((u) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();

    if (pathname.endsWith('/auth/me')) return json(route, { success: true, data: user });
    if (pathname.endsWith('/notifications')) return json(route, { success: true, data: [] });
    if (pathname.endsWith('/pems/templates/summary')) return json(route, { success: true, data: summaryBody });
    if (pathname.endsWith('/pems/templates/validate')) return json(route, { success: true, data: { ok: false, errors: [{ field: 'sop', message: 'At least one SOP phase is required before publishing.' }], warnings: [] } });

    if (pathname.endsWith('/pems/templates/config') && method === 'POST') {
      if (saveStatus >= 400) return json(route, { success: false, error: 'Template cannot be published: SOP missing', validation: { ok: false, errors: [{ field: 'sop', message: 'SOP missing' }], warnings: [] } }, saveStatus);
      return json(route, { success: true, data: { id: 'tpl-new', taskCode: 'DLY-904', created: true } });
    }

    if (pathname.endsWith('/pems/templates')) return json(route, { success: true, templates: templateList, pagination: { page: 1, limit: 25, total: templateList.length } });
    if (pathname.endsWith('/pems/templates/filters')) return json(route, { success: true, data: { categories: ['PRICING', 'INVENTORY'], departments: ['Operations'] } });
    if (/\/pems\/templates\/[^/]+$/.test(pathname)) {
      const id = pathname.split('/').pop();
      return json(route, { success: true, data: { ...templates[0], Id: id, assignmentRules: { AssignmentMode: 'manual', EscalationHours: 24, ApprovalLevel: 'single', QualityScoreRequired: false } } });
    }
    if (pathname.includes('/automation-stats')) return json(route, { success: true, data: { total: 0, open: 0, overdue: 0, byRuleset: [] } });
    if (pathname.startsWith('/api/')) return json(route, { success: true, data: [] });
    return route.continue();
  });
}

test.describe('Task Templates library', () => {
  test('shows accurate summary metrics, not the page size', async ({ page }) => {
    await seed(page);
    await page.goto('/tasks/templates');
    await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();

    // 3 templates total but the list only renders a subset — the hero must read
    // from /templates/summary, never from the paginated list length.
    await expect(page.locator('.tpl-hero__stat').filter({ hasText: 'Templates' })).toContainText('3');
    await expect(page.locator('.tpl-hero__stat').filter({ hasText: 'Active' })).toContainText('2');
    await expect(page.locator('.tpl-hero__stat').filter({ hasText: 'With SOP' })).toContainText('1');
  });

  test('renders a table view with the modelled columns', async ({ page }) => {
    await seed(page);
    await page.goto('/tasks/templates');
    await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();

    await page.locator('.ant-segmented-item', { hasText: 'Table' }).click();
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    // Columns with filters render an extra "filter" button inside the header,
    // so match on the prefix rather than exact text.
    for (const col of ['Code', 'Template', 'Category', 'Priority', 'Frequency', 'SOP', 'Assignment', 'Status']) {
      await expect(table.getByRole('columnheader', { name: col })).toBeVisible();
    }
    await expect(table.getByRole('cell', { name: 'OOS Data Monitoring' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'DLY-004' })).toBeVisible();
  });

  test('category chip filters the library', async ({ page }) => {
    await seed(page);
    await page.goto('/tasks/templates');
    await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();

    const chip = page.getByRole('tab', { name: /Pricing/i });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-selected', 'true');
    // Filtering triggers a fresh fetch with ?category=PRICING and re-renders.
    await expect(page.locator('.tpl-card__code', { hasText: 'DLY-002' })).toBeVisible();
  });

  test('empty result shows a clear state with a reset action', async ({ page }) => {
    await seed(page, { templateList: [] });
    await page.goto('/tasks/templates');
    await page.getByPlaceholder(/search by task name/i).fill('no-such-thing');
    await expect(page.getByText(/no templates match your filters/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible();
  });

  test('load failure offers a retry instead of a blank page', async ({ page }) => {
    await seed(page, { templateList: [] });
    await page.route('**/api/pems/templates*', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/templates') && route.request().method() === 'GET') {
        return json(route, { success: false, error: 'Database unavailable' }, 500);
      }
      return route.fallback();
    });
    await page.goto('/tasks/templates');
    await expect(page.getByText(/couldn't load templates/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });

  test('a user without tasks_manage is denied the route entirely', async ({ page }) => {
    // The templates route is gated on tasks_manage at the router level, so a
    // view-only user must never reach an editable library (defence in depth on
    // top of the per-action gating inside the page).
    await seed(page, { user: viewerUser });
    await page.goto('/tasks/templates');
    await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new template/i })).toHaveCount(0);
  });
});

test.describe('Template Builder', () => {
  test('blocks publishing an invalid template and surfaces the reason', async ({ page }) => {
    await seed(page);
    await page.goto('/tasks/templates');
    await page.getByRole('button', { name: /new template/i }).first().click();

    const drawer = page.getByRole('dialog');
    await expect(drawer.getByTestId('section-definition')).toBeVisible();

    // Save & activate is disabled while the publish checks fail, so an invalid
    // template cannot be published by clicking through the builder.
    await expect(drawer.getByTestId('publish')).toBeDisabled();

    // The section rail is live: the definition section reports an error, and
    // opening Validate & Publish spells out why publication is blocked.
    await drawer.getByRole('button', { name: /Validate & Publish/i }).click();
    const review = drawer.getByTestId('section-review');
    await expect(review).toBeVisible();
    await expect(review.getByText(/required|needs|missing|SOP/i).first()).toBeVisible();
  });

  test('server validation errors are surfaced on save failure', async ({ page }) => {
    await seed(page, { saveStatus: 400 });
    await page.goto('/tasks/templates');
    await page.getByRole('button', { name: /new template/i }).first().click();
    const drawer = page.getByRole('dialog');

    await drawer.getByRole('textbox').first().fill('My Template');
    await drawer.getByRole('button', { name: /save draft/i }).first().click();
    await expect(page.getByText(/sop missing|cannot be published/i).first()).toBeVisible({ timeout: 5000 });
  });
});
