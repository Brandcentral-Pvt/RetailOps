import { test, expect } from '@playwright/test';

const session = {
  success: true,
  data: {
    _id: 'u1',
    Id: 'u1',
    email: 'lead@example.com',
    firstName: 'Lead',
    lastName: 'User',
    role: { name: 'super_admin' },
    isAdmin: true,
    permissions: [
      'asinmanager_view',
      'asinmanager_manage',
      'asinmanager_export',
      'asinmanager_import',
      'marketplace_amazon',
      'marketplace_ajio',
      'marketplace_myntra',
    ],
  },
};

const pagination = { page: 1, limit: 25, total: 3, totalPages: 1, pages: 1 };

const asins = [
  { _id: 'a1', asinCode: 'B0TEST0001', title: 'Test product one', price: 999, quantity: 4, status: 'active' },
  { _id: 'a2', asinCode: 'B0TEST0002', title: 'Test product two', price: 1299, quantity: 2, status: 'active' },
  { _id: 'a3', asinCode: 'B0TEST0003', title: 'Test product three', price: 499, quantity: 0, status: 'inactive' },
];

async function mockApi(page, { permissions, roleName } = {}) {
  const body = {
    ...session,
    data: {
      ...session.data,
      role: { name: roleName ?? session.data.role.name },
      permissions: permissions ?? session.data.permissions,
    },
  };
  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript((s) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(s.data));
  }, body);
  await page.addInitScript(() => {
    localStorage.removeItem('selectedMarketplace');
    localStorage.removeItem('selectedSeller');
  });

  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url());
    const json = payload => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });

    if (pathname.endsWith('/auth/me')) return json(body);
    if (pathname.endsWith('/asins/filters')) {
      return json({
        success: true,
        data: { brands: [], categories: [], statuses: [], scrapeStatuses: [], tags: [], subBsrCategories: [] },
      });
    }
    if (pathname.endsWith('/asins/stats')) {
      return json({ success: true, data: { total: 3, active: 2, inactive: 1 } });
    }
    if (pathname.endsWith('/asins/parent-view')) {
      return json({ success: true, data: { asins: [], pagination } });
    }
    if (pathname.endsWith('/sellers')) {
      return json({
        success: true,
        data: {
          sellers: [
            { _id: 's1', name: 'Acme Retail', sellerCode: 'ACME' },
            { _id: 's2', name: 'Globex Traders', sellerCode: 'GLBX' },
          ],
          pagination: { page: 1, totalPages: 1, total: 2 },
        },
      });
    }
    if (pathname.endsWith('/asins')) {
      return json({ success: true, data: { asins, pagination, globalHistoryDates: [], months: [] } });
    }
    return json({ success: true, data: {} });
  });
}

async function gotoAsinManager(page, width) {
  if (width) await page.setViewportSize({ width, height: 900 });
  await page.goto('/asin-tracker');
  // The panel only exists once the page has actually rendered. This route
  // fires several API calls, so allow for slow CI rather than flaking.
  await expect(page.locator('[class*="toolbarActions"]')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: /Collapse Overview|Expand Overview/ }).first())
    .toBeVisible({ timeout: 20000 });
}

const WIDTHS = [1920, 1440, 1280, 1024, 900, 768, 480, 390];

test.describe('asin manager toolbar', () => {
  for (const width of WIDTHS) {
    test(`stays inside the viewport at ${width}px`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));

      await mockApi(page);
      await gotoAsinManager(page, width);

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `page overflow at ${width}px`).toBeLessThanOrEqual(1);

      // No individual toolbar control may exceed the viewport.
      const panel = page.locator('[class*="toolbar"]').first();
      const box = await panel.boundingBox();
      expect(box.width, `toolbar wider than viewport at ${width}px`).toBeLessThanOrEqual(width);

      const widest = await page.evaluate(() => {
        const el = document.querySelector('[class*="toolbarLeft"]');
        return [...el.querySelectorAll('*')]
          .map(n => n.getBoundingClientRect().right)
          .reduce((max, v) => Math.max(max, v), 0);
      });
      expect(widest, `a toolbar control extends past ${width}px`).toBeLessThanOrEqual(width + 1);

      expect(pageErrors).toEqual([]);
    });
  }

  test('marketplace switcher offers every accessible marketplace', async ({ page }) => {
    await mockApi(page);
    await gotoAsinManager(page);

    const switcher = page.getByRole('radiogroup', { name: 'Marketplace' });
    await expect(switcher.getByText('All', { exact: true })).toBeVisible();
    await expect(switcher.getByText('Amazon', { exact: true })).toBeVisible();
    await expect(switcher.getByText('Ajio', { exact: true })).toBeVisible();
    await expect(switcher.getByText('Myntra', { exact: true })).toBeVisible();

    // Labels are text, so the switcher survives a blocked image CDN.
    const brokenImages = await page.evaluate(() =>
      [...document.images].filter(i => i.complete && i.naturalWidth === 0).length);
    expect(brokenImages).toBe(0);
  });

  test('hides marketplaces the account cannot read', async ({ page }) => {
    await mockApi(page, { permissions: ['asinmanager_view', 'marketplace_ajio'], roleName: 'brand_manager' });
    await gotoAsinManager(page);

    const switcher = page.getByRole('radiogroup', { name: 'Marketplace' });
    await expect(switcher.getByText('Ajio', { exact: true })).toBeVisible();
    await expect(switcher.getByText('Amazon', { exact: true })).toHaveCount(0);
    await expect(switcher.getByText('Myntra', { exact: true })).toHaveCount(0);
    // A single accessible marketplace leaves nothing to choose between.
    await expect(switcher.getByText('All', { exact: true })).toHaveCount(0);
  });

  test('selecting a marketplace persists and reloads the list', async ({ page }) => {
    const requests = [];
    await mockApi(page);
    page.on('request', req => {
      if (req.url().includes('/api/asins?')) requests.push(req.url());
    });
    await gotoAsinManager(page);

    const switcher = page.getByRole('radiogroup', { name: 'Marketplace' });
    await switcher.getByText('Ajio', { exact: true }).click();
    await expect(switcher.locator('.ant-segmented-item-selected')).toHaveText('Ajio');
    expect(requests.some(u => u.includes('marketplace=ajio'))).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('selectedMarketplace'))).toBe('ajio');
  });

  test('icon-only toolbar buttons have accessible names', async ({ page }) => {
    await mockApi(page);
    await gotoAsinManager(page);

    for (const name of [
      'Bulk optimization',
      'Export ASIN data',
      'Recalculate LQS',
      'Import ASIN data',
      'Add ASIN',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
  });

  test('toolbar controls share one height and stay tappable', async ({ page }) => {
    await mockApi(page);
    await gotoAsinManager(page);

    const heights = await page.evaluate(() => {
      const panel = document.querySelector('[class*="toolbarLeft"]');
      return [...panel.querySelectorAll('.ant-btn, .ant-segmented, input')]
        .map(n => Math.round(n.getBoundingClientRect().height))
        .filter(h => h > 0);
    });
    expect(heights.length).toBeGreaterThan(3);
    for (const h of heights) {
      expect(h, `control height ${h}px is not a usable touch target`)
        .toBeGreaterThanOrEqual(28);
      expect(h, `control height ${h}px is inconsistent with the 32px row`)
        .toBeLessThanOrEqual(34);
    }

    const toggle = await page.getByRole('button', { name: /Overview$/ }).boundingBox();
    expect(toggle.height, 'inline overview toggle is too small to tap')
      .toBeGreaterThanOrEqual(24);
  });

  test.describe('touch device', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

    test('overview toggle grows to a full touch target', async ({ page }) => {
      await mockApi(page);
      await gotoAsinManager(page);

      const toggle = await page.getByRole('button', { name: /Overview$/ }).boundingBox();
      expect(toggle.height, 'overview toggle should be 32px on a touch device')
        .toBeGreaterThanOrEqual(32);
    });
  });

  test('labelled toolbar buttons keep their text instead of truncating', async ({ page }) => {
    await mockApi(page);
    await gotoAsinManager(page, 390);

    const truncated = await page.evaluate(() => {
      const panel = document.querySelector('[class*="toolbarActions"]');
      return [...panel.querySelectorAll('button')]
        .filter(b => b.scrollWidth > b.clientWidth + 1)
        .map(b => b.textContent.trim());
    });
    expect(truncated).toEqual([]);
  });
});
