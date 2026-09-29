import { test, expect } from '@playwright/test';

/* The browser tests intercept every /api call. They never start the backend,
   touch a database, or send real email. */

const session = {
  success: true,
  data: {
    Id: 'test-user',
    _id: 'test-user',
    email: 'alex.morgan@example.com',
    firstName: 'Alex',
    lastName: 'Morgan',
    role: { name: 'super_admin', displayName: 'Super Admin' },
    permissions: ['tasks_view', 'tasks_manage'],
  },
};

const summary = {
  success: true,
  data: {
    kpi: {
      total: 48, active: 21, pendingReview: 7, approved: 26,
      avgAchievementPct: 84, completionRate: 54, slaCompliance: 92, overdue: 3,
    },
    pipeline: { draft: 2, assigned: 6, accepted: 3, inProgress: 12, submitted: 5, underReview: 7, approved: 26 },
    statusDistribution: { draft: 2, assigned: 6, accepted: 3, inProgress: 12, submitted: 5, underReview: 7, approved: 26, rejected: 1, rework: 2 },
    departments: [
      { Department: 'Operations', totalTasks: 30, openTasks: 18, completedTasks: 12, avgAchievementPct: 86, completionRate: 40, slaCompliance: 93, pendingReview: 4, rework: 1, overdueTasks: 2 },
      { Department: 'Catalog Team', totalTasks: 18, openTasks: 6, completedTasks: 12, avgAchievementPct: 79, completionRate: 67, slaCompliance: 89, pendingReview: 3, rework: 1, overdueTasks: 1 },
    ],
    // Every rate below is deliberately distinct from the KPI values (84 / 92)
    // so an assertion on a KPI can never be satisfied by a leaderboard cell.
    topPerformers: {
      topSellers: [
        { SellerId: 's1', SellerName: 'Asha Rao', rank: 1, tasks: 12, completed: 11, avgAchievement: 96, slaCompliance: 100 },
        { SellerId: 's2', SellerName: 'Bilal Khan', rank: 2, tasks: 9, completed: 7, avgAchievement: 71, slaCompliance: 95 },
      ],
      topManagers: [
        { UserId: 'u1', UserName: 'Chandra Iyer', rank: 1, tasks: 15, completed: 14, avgAchievement: 88, slaCompliance: 97 },
      ],
    },
    workload: [
      { AssignedTo: 'u1', AssigneeName: 'Chandra Iyer', Department: 'Operations', total: 15, assigned: 4, inProgress: 6, review: 3, rework: 2 },
    ],
    risk: { slaBreached: 1, overdue: 3, staleReviews: 4, rejected: 1, rework: 2, highPriorityDelays: 1, slaAtRisk: 5 },
  },
};

const liveTasks = {
  success: true,
  data: [
    { Id: 'i1', InstanceCode: 'TSK-1001', Title: 'Update listing images', Department: 'Operations', SellerName: 'Asha Rao', AssigneeName: 'Chandra Iyer', Status: 'IN_PROGRESS', Priority: 'HIGH', AchievementPct: 65, DueDate: '2020-01-05', SLAStatus: 'WITHIN_SLA' },
    { Id: 'i2', InstanceCode: 'TSK-1002', Title: 'Fix stock mismatch', Department: 'Catalog Team', SellerName: 'Bilal Khan', AssigneeName: 'Chandra Iyer', Status: 'APPROVED', Priority: 'MEDIUM', AchievementPct: 88, DueDate: '2030-01-05', SLAStatus: 'BREACHED' },
  ],
};

const activityFeed = {
  success: true,
  data: [
    { Id: 'a1', Action: 'STATUS_CHANGED', ActorName: 'Chandra Iyer', InstanceCode: 'TSK-1001', Title: 'Update listing images', Details: 'Draft -> In Progress', CreatedAt: new Date().toISOString() },
  ],
};

async function mockApi(page, overrides = {}) {
  await page.route('**/socket.io/**', route => route.abort());

  await page.addInitScript(() => {
    localStorage.setItem('authToken', 'test-only-access-token');
    localStorage.setItem('user', JSON.stringify({
      _id: 'test-user',
      email: 'alex.morgan@example.com',
      firstName: 'Alex',
      lastName: 'Morgan',
      role: { name: 'super_admin', displayName: 'Super Admin' },
      permissions: ['tasks_view', 'tasks_manage'],
    }));
  });

  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/me') return json(session);
    if (path === '/pems/dashboard/summary') return json(overrides.summary ?? summary);
    if (path === '/pems/dashboard/live-tasks') return json(overrides.liveTasks ?? liveTasks);
    if (path === '/pems/dashboard/activity-feed') return json(overrides.activityFeed ?? activityFeed);
    if (path === '/pems/sellers') return json({ success: true, data: [{ Id: 's1', Name: 'Asha Rao' }] });
    if (path === '/pems/brand-managers') return json({ success: true, data: [{ Id: 'u1', FullName: 'Chandra Iyer' }] });
    if (path === '/notifications') return json({ success: true, data: [] });
    return json({ success: true, data: [] });
  });
}

async function gotoDashboard(page) {
  await page.goto('/tasks/dashboard');
  await expect(page.getByRole('heading', { name: 'Task Performance' })).toBeVisible();
}

test.describe('task performance dashboard', () => {
  test('leads with performance KPIs rendered from the API', async ({ page }) => {
    await mockApi(page);
    await gotoDashboard(page);

    // Each KPI group is a labelled region, so scope assertions to the group
    // rather than the whole page (e.g. "Overdue" is also a table column).
    const performance = page.getByRole('region', { name: 'Performance' });
    await expect(performance).toBeVisible();
    await expect(performance.getByText('Achievement %', { exact: true })).toBeVisible();
    // 84% and 92% are unique to the KPI cards in this payload.
    await expect(performance.getByText('84%', { exact: true })).toBeVisible();
    await expect(performance.getByText('SLA Compliance', { exact: true })).toBeVisible();
    await expect(performance.getByText('92%', { exact: true })).toBeVisible();
    await expect(performance.getByText('Overdue', { exact: true })).toBeVisible();

    // Workload counts sit in their own group below.
    const workload = page.getByRole('region', { name: 'Workload' });
    await expect(workload).toBeVisible();
    await expect(workload.getByText('Total Tasks', { exact: true })).toBeVisible();
    await expect(workload.getByText('48', { exact: true })).toBeVisible();

    // Supporting panels still render from the same payload.
    await expect(page.getByText('Execution Pipeline', { exact: true })).toBeVisible();
    await expect(page.getByText('Department Performance', { exact: true })).toBeVisible();
    await expect(page.getByText('Risk Center', { exact: true })).toBeVisible();
    await expect(page.getByText('Live Task Queue', { exact: true })).toBeVisible();
    await expect(page.getByText('Workload Distribution', { exact: true })).toBeVisible();
    await expect(page.getByText('Activity Feed', { exact: true })).toBeVisible();
  });

  test('carries no PEMS branding in the rendered page', async ({ page }) => {
    await mockApi(page);
    await gotoDashboard(page);

    await expect(page.locator('body')).not.toContainText(/pems/i);
    await expect(page.getByRole('heading', { name: 'Task Performance' })).toBeVisible();
  });

  test('legacy /pems URLs redirect to their /tasks equivalents', async ({ page }) => {
    await mockApi(page);

    for (const [from, to] of [
      ['/pems/dashboard', '/tasks/dashboard'],
      ['/pems/templates', '/tasks/templates'],
      ['/pems/tasks', '/tasks/tasks'],
      ['/pems/reviews', '/tasks/reviews'],
      ['/pems/analytics', '/tasks/analytics'],
    ]) {
      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`${to}$`));
    }
  });

  test('legacy /pems/templates/:id keeps the template id', async ({ page }) => {
    await mockApi(page);
    await page.goto('/pems/templates/tpl-42');
    // A literal ":id" target would silently drop the user on the list page.
    await expect(page).toHaveURL(/\/tasks\/templates\/tpl-42$/);
  });

  test('/tasks alone lands on the task workspace', async ({ page }) => {
    await mockApi(page);
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/tasks\/tasks$/);
  });

  test('filters re-request the summary with the chosen department', async ({ page }) => {
    const requested = [];
    await mockApi(page);
    await page.route('**/api/pems/dashboard/summary**', route => {
      requested.push(new URL(route.request().url()).searchParams.get('department'));
      return route.fallback();
    });

    await gotoDashboard(page);
    await page.locator('.ant-select').first().click();
    await page.locator('.ant-select-item-option', { hasText: 'Operations' }).click();

    await expect.poll(() => requested).toContain('Operations');
  });

  test('surfaces a retryable error instead of an endless spinner', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/pems/dashboard/summary**', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));

    await page.goto('/tasks/dashboard');
    await expect(page.getByRole('alert')).toContainText('Could not load dashboard data');
  });

  test('reports when the data was last refreshed', async ({ page }) => {
    await mockApi(page);
    await gotoDashboard(page);
    await expect(page.getByText(/Updated (Just now|\d+[mhd] ago)/)).toBeVisible();
  });

  test('keeps all dashboard text at a readable font size', async ({ page }) => {
    await mockApi(page);
    await gotoDashboard(page);

    // Scoped to <main> so sidebar/topbar chrome is not this page's debt.
    // Regression guard for the 8/9/10px labels the page used to ship.
    const tooSmall = await page.getByRole('main').evaluate(main => {
      const bad = [];
      for (const el of main.querySelectorAll('h1, p, span, div, td, th, label, button')) {
        if (!el.textContent?.trim()) continue;
        if (el.children.length > 0) continue; // leaf nodes only
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size > 0 && size < 11) bad.push(`${size}px: ${el.textContent.trim().slice(0, 40)}`);
      }
      return bad;
    });
    expect(tooSmall).toEqual([]);
  });

  test('does not overflow horizontally on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page);
    await gotoDashboard(page);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('gives every dashboard control an accessible name', async ({ page }) => {
    await mockApi(page);
    await gotoDashboard(page);

    // Scoped to <main>: the sidebar toggle lives in the app shell.
    const unnamed = await page.getByRole('main').evaluate(main => {
      const bad = [];
      for (const el of main.querySelectorAll('button, a[href], [role="button"]')) {
        // aria-label wins, then text content, then title as the fallback.
        const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
        if (!name) bad.push(el.outerHTML.slice(0, 80));
      }
      return bad;
    });
    expect(unnamed).toEqual([]);
  });
});
