import { test, expect } from '@playwright/test';

// The Activity Log used to fetch on every keystroke (the raw input value sat
// in the fetch effect's dependency list), rebuild its whole table on each
// render via a Math.random() rowKey, and paint text in #94a3b8 on white
// (~2.5:1, below WCAG AA). These tests lock down the fixes.

const user = {
  _id: 'u1',
  Id: 'u1',
  email: 'lead@example.com',
  firstName: 'Lead',
  lastName: 'User',
  role: { name: 'super_admin' },
  isAdmin: true,
  permissions: ['activitylogs_view', 'marketplace_amazon', 'marketplace_ajio', 'marketplace_myntra'],
};

const logs = [
  {
    Id: 'l1',
    type: 'UPDATE',
    entityType: 'ASIN',
    entityTitle: 'Nike Running Shoes',
    description: 'Price updated from 1299 to 1399',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    user: { firstName: 'Lead', lastName: 'User', email: 'lead@example.com' },
    metadata: JSON.stringify({ oldPrice: 1299, newPrice: 1399 }),
  },
  {
    Id: 'l2',
    type: 'AUTH_FAILURE',
    entityType: 'USER',
    entityTitle: 'Failed sign-in attempt',
    description: 'Invalid password for lead@example.com',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    user: null,
    metadata: null,
  },
  {
    Id: 'l3',
    type: 'AUTOMATION_TASK',
    entityType: 'ACTION',
    entityTitle: 'Nightly scrape run',
    description: 'Automation completed with 412 items',
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
    user: { firstName: 'Ops', lastName: 'Bot', email: 'ops@example.com' },
    metadata: { items: 412, status: 'ok' },
  },
];

const otpLogs = [
  {
    Id: 'o1',
    CreatedAt: new Date(Date.now() - 120_000).toISOString(),
    FirstName: 'Lead',
    LastName: 'User',
    Email: 'lead@example.com',
    Action: 'OTP_VERIFIED',
    Status: 'SUCCESS',
    Reason: 'matched',
    IpAddress: '10.0.0.4',
  },
  {
    Id: 'o2',
    CreatedAt: new Date(Date.now() - 300_000).toISOString(),
    FirstName: null,
    LastName: null,
    Email: 'someone@example.com',
    Action: 'OTP_FAILED',
    Status: 'FAILED',
    Reason: null,
    IpAddress: '10.0.0.9',
  },
];

// Counts requests so the debounce behaviour can be asserted directly.
async function mockApi(page, counter) {
  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript(u => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);

  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url());
    const json = payload =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });

    if (pathname.endsWith('/auth/me')) return json({ success: true, data: user });
    if (pathname.endsWith('/notifications')) return json({ success: true, data: [] });
    if (pathname.includes('/logs')) {
      counter.logs += 1;
      return json({ success: true, data: logs, pagination: { page: 1, limit: 50, total: logs.length } });
    }
    if (pathname.endsWith('/security/otp-logs')) {
      counter.otp += 1;
      return json({ success: true, data: otpLogs, total: otpLogs.length });
    }
    return json({ success: true, data: {} });
  });
}

async function gotoActivityLog(page) {
  await page.goto('/activity-log');
  // The app header already renders an <h1> with the page name; the page's own
  // title is the <h2> (same pattern as UsersPage), so scope to level 2.
  await expect(page.getByRole('heading', { name: 'Activity Log', level: 2 })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Nike Running Shoes')).toBeVisible({ timeout: 20000 });
}

test.describe('activity log', () => {
  test('renders system log rows and event badges', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await mockApi(page, { logs: 0, otp: 0 });

    await gotoActivityLog(page);

    await expect(page.getByText('Updated', { exact: true })).toBeVisible();
    await expect(page.getByText('Login Failed', { exact: true })).toBeVisible();
    await expect(page.getByText('Automation', { exact: true })).toBeVisible();
    await expect(page.getByText('3 events', { exact: true })).toBeVisible();
    await expect(page.getByText('Showing', { exact: false })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('search is debounced instead of firing per keystroke', async ({ page }) => {
    const counter = { logs: 0, otp: 0 };
    await mockApi(page, counter);
    await gotoActivityLog(page);

    const afterLoad = counter.logs;
    const search = page.getByLabel('Search events');
    await search.click();
    await search.pressSequentially('nike', { delay: 40 });

    // Still inside the debounce window — nothing extra should have been sent.
    await page.waitForTimeout(120);
    expect(counter.logs).toBe(afterLoad);

    await expect.poll(() => counter.logs, { timeout: 4000 }).toBe(afterLoad + 1);
  });

  test('rows keep a stable identity across re-renders', async ({ page }) => {
    await mockApi(page, { logs: 0, otp: 0 });
    await gotoActivityLog(page);

    // A Math.random() fallback rowKey gives every row a brand new key on each
    // render, which destroys and recreates the whole row subtree. Tag a node,
    // force a re-render, and confirm the same node is still there.
    const detailsButton = page.getByRole('button', { name: /View details for Nike Running Shoes/ }).first();
    await detailsButton.waitFor();
    await detailsButton.evaluate(el => { el.dataset.probe = 'stable'; });

    // Sorting re-renders the same rows in place without refetching.
    await page.getByRole('columnheader', { name: /Time/ }).click();
    await page.waitForTimeout(300);

    const survived = await page
      .getByRole('button', { name: /View details for Nike Running Shoes/ })
      .first()
      .evaluate(el => el.dataset.probe === 'stable')
      .catch(() => false);

    expect(survived, 'row must not be remounted by a re-render').toBe(true);
  });

  test('event details open from the keyboard', async ({ page }) => {
    await mockApi(page, { logs: 0, otp: 0 });
    await gotoActivityLog(page);

    const detailsButton = page.getByRole('button', { name: /View details for Nike Running Shoes/ }).first();
    await detailsButton.focus();
    await expect(detailsButton).toBeFocused();

    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Event Details')).toBeVisible();
    await expect(dialog.getByText('Price updated from 1299 to 1399')).toBeVisible();
  });

  test('show-all toggle is labelled and controls the request', async ({ page }) => {
    const counter = { logs: 0, otp: 0 };
    await mockApi(page, counter);
    await gotoActivityLog(page);

    const toggle = page.getByLabel('Show all events');
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();

    await toggle.check();
    await expect(toggle).toBeChecked();
    await expect.poll(() => counter.logs).toBeGreaterThan(1);
  });

  test('otp audit tab loads and renders its rows', async ({ page }) => {
    const counter = { logs: 0, otp: 0 };
    await mockApi(page, counter);
    await gotoActivityLog(page);

    await page.locator('.ant-segmented-item', { hasText: 'OTP Audit' }).click();
    await expect(page.getByRole('heading', { name: 'OTP Audit', level: 2 })).toBeVisible();
    await expect(page.getByText('lead@example.com').first()).toBeVisible();
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();
    await expect(page.getByText('Failed', { exact: true })).toBeVisible();
    expect(counter.otp).toBeGreaterThan(0);
  });

  const WIDTHS = [1920, 1440, 1024, 768, 480, 390];

  for (const width of WIDTHS) {
    test(`does not overflow the page horizontally at ${width}px`, async ({ page }) => {
      await mockApi(page, { logs: 0, otp: 0 });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/activity-log');
      await expect(page.getByText('Nike Running Shoes')).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(250);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `page must not scroll horizontally at ${width}px`).toBeLessThanOrEqual(1);
    });
  }
});
