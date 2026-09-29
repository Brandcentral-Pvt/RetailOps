import { test, expect } from '@playwright/test';

// Pinned columns (select / ASIN / actions) are position:sticky and rely on
// their own background to hide the columns scrolling underneath them. Two
// regressions made them transparent and let the table show through:
//   1. compact density set --asin-zebra to `transparent`
//   2. the sticky zebra rule outranked the out-of-stock row tint by specificity
// These tests pin both invariants down across every density.

const user = {
  _id: 'u1',
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
};

// Row 3 is deliberately out of stock so the tinted row state is exercised,
// and it sits on an even index so the zebra rule and the row tint collide.
const asins = Array.from({ length: 10 }, (_, i) => ({
  _id: `a${i}`,
  asinCode: `B0TEST${String(i).padStart(4, '0')}`,
  title: `Test product ${i}`,
  sku: `SKU-${i}`,
  price: 999 + i,
  quantity: 4,
  status: 'active',
  availabilityStatus: i === 3 ? 'out_of_stock' : 'in_stock',
  brand: 'Acme',
  category: 'Home',
  bsr: 1234 + i,
  rating: 4.2,
  reviewCount: 120,
  scrapeStatus: 'done',
  sellerId: null,
  createdAt: new Date(2026, 0, 1 + i).toISOString(),
}));

async function mockApi(page, density) {
  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript(
    ([u, d]) => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('asin-table-density', d);
      localStorage.removeItem('selectedMarketplace');
      localStorage.removeItem('selectedSeller');
    },
    [user, density]
  );

  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url());
    const json = payload =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });

    if (pathname.endsWith('/auth/me')) return json({ success: true, data: user });
    if (pathname.endsWith('/asins/filters')) {
      return json({
        success: true,
        data: { brands: [], categories: [], statuses: [], scrapeStatuses: [], tags: [], subBsrCategories: [] },
      });
    }
    if (pathname.endsWith('/asins/stats')) {
      return json({ success: true, data: { total: asins.length, active: 9, inactive: 1 } });
    }
    if (pathname.endsWith('/asins/parent-view')) {
      return json({ success: true, data: { asins: [], pagination: { page: 1, totalPages: 1, total: 0 } } });
    }
    if (pathname.endsWith('/sellers')) {
      return json({
        success: true,
        data: { sellers: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      });
    }
    // asinApi.getAll resolves to the raw JSON body, not a { data } envelope.
    if (/\/asins\/?$/.test(pathname)) {
      return json({
        asins,
        pagination: { page: 1, limit: 50, total: asins.length, totalPages: 1 },
        globalHistoryDates: [],
        months: [],
      });
    }
    return json({ success: true, data: {} });
  });
}

async function openGrid(page, density) {
  await mockApi(page, density);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/asin-tracker');

  const grid = page.locator('.asin-grid-scroll');
  await expect(grid).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.asin-grid tbody tr.asin-grid__row').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.asin-grid tbody .asin-grid__sticky').first()).toBeVisible();

  // Guard against a vacuous pass: the bug is only observable once the table
  // actually overflows and the pinned columns have content sliding under them.
  const { scrollWidth, clientWidth } = await grid.evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(
    scrollWidth,
    'table must overflow horizontally for this regression to be observable'
  ).toBeGreaterThan(clientWidth + 5);

  await grid.evaluate(el => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect
    .poll(() => grid.evaluate(el => el.scrollLeft))
    .toBeGreaterThan(0);

  return grid;
}

// Computes the alpha channel of a computed rgb()/rgba() colour.
const alphaOf = colour => {
  const match = colour.match(/rgba?\(([^)]+)\)/);
  if (!match) return 1;
  const parts = match[1].split(',').map(parseFloat);
  return parts.length === 4 ? parts[3] : 1;
};

function readPinnedCells(page) {
  return page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('.asin-grid tbody tr').forEach((tr, index) => {
      const pinned = [...tr.querySelectorAll('.asin-grid__sticky')].map(td => {
        const cs = getComputedStyle(td);
        return { kind: (td.className.match(/--[a-z-]+/) || [''])[0], background: cs.backgroundColor };
      });
      if (!pinned.length) return;
      const scroller = tr.querySelector('td:not(.asin-grid__sticky)');
      rows.push({
        index,
        unavailable: tr.classList.contains('asin-grid__row--unavailable'),
        selected: tr.classList.contains('is-selected'),
        pinned,
        scrolledCellBackground: scroller ? getComputedStyle(scroller).backgroundColor : null,
      });
    });
    return rows;
  });
}

const DENSITIES = ['comfortable', 'compact', 'roomy'];

test.describe('asin manager sticky columns', () => {
  for (const density of DENSITIES) {
    test(`pinned columns stay opaque while scrolled at ${density} density`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));

      await openGrid(page, density);
      const rows = await readPinnedCells(page);
      expect(rows.length).toBeGreaterThan(0);

      const transparent = rows.flatMap(row =>
        row.pinned
          .filter(cell => alphaOf(cell.background) < 1)
          .map(cell => `row ${row.index} ${cell.kind} -> ${cell.background}`)
      );

      expect(
        transparent,
        `pinned cells must be opaque so they can occlude the scrolled columns:\n${transparent.join('\n')}`
      ).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test(`pinned columns keep the out-of-stock tint at ${density} density`, async ({ page }) => {
      await openGrid(page, density);
      const rows = await readPinnedCells(page);

      const tinted = rows.find(row => row.unavailable);
      expect(tinted, 'fixture must render an out-of-stock row').toBeTruthy();
      expect(tinted.scrolledCellBackground, 'out-of-stock row body must be tinted').not.toBe(
        'rgba(0, 0, 0, 0)'
      );

      // The pinned cells have to carry the same tint as the rest of their row,
      // otherwise the row looks broken where the columns are frozen.
      for (const cell of tinted.pinned) {
        expect(cell.background, `pinned ${cell.kind} lost the row tint`).toBe(
          tinted.scrolledCellBackground
        );
      }
    });
  }

  test('pinned columns stay opaque on hover and when selected', async ({ page }) => {
    await openGrid(page, 'compact');

    const evenRow = page.locator('.asin-grid tbody tr').nth(3);
    await evenRow.hover();
    await page.waitForTimeout(150);

    const hovered = await readPinnedCells(page);
    const transparentOnHover = hovered
      .flatMap(row => row.pinned)
      .filter(cell => alphaOf(cell.background) < 1);
    expect(transparentOnHover.map(c => c.background)).toEqual([]);

    // Selecting a row repaints it with the info tint; the pinned cells must
    // follow rather than reverting to the zebra value.
    await page.locator('.asin-grid tbody tr').first().locator('input[type="checkbox"]').first().check();
    await expect(page.locator('.asin-grid tbody tr.is-selected').first()).toBeVisible();

    const selected = await readPinnedCells(page);
    const selectedRow = selected.find(row => row.selected);
    expect(selectedRow, 'fixture must render a selected row').toBeTruthy();
    for (const cell of selectedRow.pinned) {
      expect(alphaOf(cell.background), `pinned ${cell.kind} transparent when selected`).toBeGreaterThanOrEqual(1);
    }
  });
});
