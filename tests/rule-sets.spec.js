import { test, expect } from '@playwright/test';

// The Automation Rules page had a stylesheet that referenced 15 --bc-* tokens
// that exist nowhere in the repo, so those declarations were invalid at
// computed-value time and the page rendered largely unstyled. On top of that
// the pager lied (getAllRulesets ignores page/limit and returns everything, so
// page 2 refetched the identical full list), the row-density control was
// inert, pinned columns were transparent, and a failed load rendered "No
// rulesets yet — create your first automation rule". These tests lock the
// fixes down.

const user = {
  _id: 'u1',
  Id: 'u1',
  email: 'lead@example.com',
  firstName: 'Lead',
  lastName: 'User',
  role: { name: 'super_admin' },
  isAdmin: true,
  permissions: ['rules_view', 'rules_manage', 'marketplace_amazon', 'marketplace_ajio'],
};

const now = Date.now();

const makeRuleset = (i, overrides = {}) => ({
  _id: `rs${i}`,
  id: `rs${i}`,
  name: `Ruleset ${String(i).padStart(2, '0')}`,
  description: `Automated rule number ${i}`,
  rules: JSON.stringify([{ id: `r${i}a` }, { id: `r${i}b` }]),
  isActive: i % 2 === 1,
  type: 'ASIN',
  isAutomated: i % 3 === 0,
  runFrequency: 'Daily',
  totalRunCount: i * 2,
  lastRunAt: new Date(now - i * 3_600_000).toISOString(),
  lastRunSummary: JSON.stringify({ totalMatched: i * 3 }),
  ...overrides,
});

// 25 rulesets so page 2 of a 20-per-page pager is genuinely reachable.
const rulesets = Array.from({ length: 25 }, (_, i) => makeRuleset(i + 1));

const history = [
  {
    Id: 'log1',
    Status: 'SUCCESS',
    MatchedCount: 12,
    ActionedCount: 4,
    TriggeredBy: 'schedule',
    ExecutedAt: new Date(now - 3_600_000).toISOString(),
    Summary: JSON.stringify({ executionTimeMs: 1420 }),
  },
  {
    Id: 'log2',
    Status: 'FAILED',
    MatchedCount: 0,
    ActionedCount: 0,
    TriggeredBy: 'manual',
    ExecutedAt: new Date(now - 7_200_000).toISOString(),
    Summary: JSON.stringify({ error: 'upstream timeout' }),
  },
];

async function mockApi(page, opts = {}) {
  const { listStatus = 200, listBody = null, listDelay = 0, calls = {} } = opts;

  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript(u => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);

  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    const json = payload =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });

    if (pathname.endsWith('/auth/me')) return json({ success: true, data: user });
    if (pathname.endsWith('/notifications')) return json({ success: true, data: [] });

    if (/\/rulesets\/[^/]+\/history/.test(pathname)) return json({ success: true, data: history });

    if (pathname.endsWith('/rulesets') && method === 'GET') {
      calls.list = (calls.list || 0) + 1;
      if (listDelay) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if (listStatus !== 200) {
        return route.fulfill({
          status: listStatus,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Ruleset service unavailable' }),
        });
      }
      return json({ success: true, data: listBody || rulesets });
    }

    if (/\/rulesets\/.+\/toggle/.test(pathname)) return json({ success: true, data: {} });
    if (/\/rulesets\/.+\/execute/.test(pathname)) return json({ success: true, data: {} });
    if (/\/rulesets\/.+\/duplicate/.test(pathname)) {
      return json({ success: true, data: { _id: 'rs-new', id: 'rs-new' } });
    }
    if (/\/rulesets\/[^/]+$/.test(pathname) && method === 'DELETE') {
      calls.delete = (calls.delete || 0) + 1;
      return json({ success: true });
    }
    if (/\/rulesets\/[^/]+$/.test(pathname) && method === 'PATCH') return json({ success: true, data: {} });
    if (/\/rulesets\/.+/.test(pathname)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    }

    return json({ success: true, data: {} });
  });
}

async function gotoRuleSets(page) {
  await page.goto('/rule-sets');
  await expect(page.getByRole('heading', { name: 'Automation Rules', level: 2 })).toBeVisible({ timeout: 20000 });
}

// The fixture renders 25 rows, which can outrun the default 5s assertion
// budget on a cold dev server.
const SETTLED = { timeout: 20000 };

async function expectFirstRow(page) {
  await expect(page.getByRole('button', { name: 'Ruleset 01', exact: true })).toBeVisible(SETTLED);
}

test.describe('automation rules', () => {
  test('every --bc-* token in the stylesheet is actually defined', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await mockApi(page);
    await gotoRuleSets(page);

    // Ask the browser which of the tokens the sheet uses actually resolve.
    // An undefined custom property makes the whole declaration invalid at
    // computed-value time, so the surface silently falls back to inherited.
    const unresolved = await page.evaluate(() => {
      // Vite inlines the page CSS, so the rules are located by selector rather
      // than by stylesheet href.
      const tokens = new Set();
      const walk = rules => {
        for (const rule of rules) {
          const sel = rule.selectorText || '';
          if (sel.includes('rulesets')) {
            for (const prop of rule.style) {
              for (const m of rule.style.getPropertyValue(prop).matchAll(/var\((--bc-[a-z0-9-]+)/g)) {
                tokens.add(m[1]);
              }
            }
          }
          if (rule.cssRules) walk(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        try { walk(sheet.cssRules); } catch { /* cross-origin */ }
      }
      if (tokens.size === 0) return { error: 'no .rulesets rules found' };

      // A token is usable if it resolves against the document root. Setting it
      // to 'initial' would blank it, so read the inherited value instead.
      const rootStyle = getComputedStyle(document.documentElement);
      const missing = [];
      for (const name of tokens) {
        if (rootStyle.getPropertyValue(name).trim() === '') missing.push(name);
      }
      return { checked: tokens.size, missing };
    });

    expect(unresolved.error).toBeUndefined();
    expect(unresolved.checked).toBeGreaterThan(20);
    expect(unresolved.missing).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('pinned columns are opaque so rows do not scroll through them', async ({ page }) => {
    await mockApi(page);
    await gotoRuleSets(page);
    await expectFirstRow(page);

    // The first cell is the frozen Name column and the last is Actions. Both
    // relied on `background: inherit`, which resolved to the transparent <tr>.
    const opacity = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.rulesets-tablewrap tbody tr.ant-table-row td')];
      if (cells.length === 0) return null;
      const row = cells[0].closest('tr');
      const all = [...row.querySelectorAll('td')];
      return {
        first: getComputedStyle(all[0]).backgroundColor,
        last: getComputedStyle(all[all.length - 1]).backgroundColor,
      };
    });

    expect(opacity).not.toBeNull();
    for (const value of [opacity.first, opacity.last]) {
      expect(value).not.toBe('rgba(0, 0, 0, 0)');
      expect(value).not.toBe('transparent');
    }
  });

  test('pagination slices the list instead of refetching the same page', async ({ page }) => {
    const calls = {};
    await mockApi(page, { calls });
    await gotoRuleSets(page);
    await expectFirstRow(page);

    // 25 rulesets at 20 per page => page 1 shows 01..20 and hides 21..25.
    await expect(page.getByRole('button', { name: 'Ruleset 20', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ruleset 21', exact: true })).toHaveCount(0);

    const listCallsAfterFirstPage = calls.list;
    await page.getByTitle('2', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ruleset 21', exact: true })).toBeVisible({ timeout: 10000 });

    // Page 2 must show the remaining five, and must not refetch: the endpoint
    // ignores page/limit, so a refetch would return the same 25 rows.
    await expect(page.getByRole('button', { name: 'Ruleset 25', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ruleset 01', exact: true })).toHaveCount(0);
    expect(calls.list).toBe(listCallsAfterFirstPage);
  });

  test('row density control actually changes the table', async ({ page }) => {
    await mockApi(page);
    await gotoRuleSets(page);
    await expectFirstRow(page);

    const table = page.locator('.rulesets-tablewrap');
    await expect(table).toHaveAttribute('data-density', 'comfortable');

    const heightOf = () => page.evaluate(() => {
      // Skip antd's hidden measure row; measure a real one.
      const td = document.querySelector('.rulesets-tablewrap tbody tr.ant-table-row td');
      return td ? Math.round(td.getBoundingClientRect().height) : 0;
    });

    const comfortable = await heightOf();
    const densityBtn = page.getByRole('button', { name: /^Row density/ });

    // The cycle runs compact -> comfortable -> roomy -> compact, so from the
    // comfortable default one click advances to roomy.
    const heights = { comfortable };
    for (const expected of ['roomy', 'compact', 'comfortable']) {
      await densityBtn.click();
      await expect(table).toHaveAttribute('data-density', expected);
      heights[expected] = await heightOf();
    }

    expect(heights.compact).toBeLessThan(heights.comfortable);
    expect(heights.roomy).toBeGreaterThan(heights.comfortable);
    // The control is not merely flipping an attribute: the rendered row box
    // actually changes size.
    expect(new Set([heights.compact, heights.comfortable, heights.roomy]).size).toBe(3);
  });

  test('a failed load shows an error, not a false empty state', async ({ page }) => {
    await mockApi(page, { listStatus: 500 });
    await gotoRuleSets(page);

    await expect(page.getByText('Could not load rulesets')).toBeVisible({ timeout: 20000 });
    // The old code swallowed the error and told the user to create a first
    // ruleset, which is actively misleading when the list is merely broken.
    await expect(page.getByText(/No rulesets yet/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('a filter with no matches does not offer to create a ruleset', async ({ page }) => {
    await mockApi(page, { listBody: [makeRuleset(1, { isActive: true })] });
    await gotoRuleSets(page);
    await expectFirstRow(page);

    await page.getByLabel('Filter by status').click();
    await page.getByTitle('Paused').click();

    // One active ruleset, so the Paused filter legitimately matches nothing.
    await expect(page.getByText('No paused rulesets')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create First Ruleset' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear filters' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expectFirstRow(page);
  });

  test('a search with no matches reports a search miss, not an empty list', async ({ page }) => {
    await mockApi(page);
    await gotoRuleSets(page);
    await expectFirstRow(page);

    const search = page.getByLabel('Search rulesets');
    await search.click();
    await search.pressSequentially('zzzznotathing');

    await expect(page.getByText('No rulesets match your search')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create First Ruleset' })).toHaveCount(0);
  });

  test('opening the delete action asks for confirmation and does not delete', async ({ page }) => {
    const calls = {};
    await mockApi(page, { calls });
    await gotoRuleSets(page);
    await expectFirstRow(page);

    await page.getByRole('button', { name: 'Actions for Ruleset 01' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Deleting discards the rules and execution history with no undo, so the
    // old one-click delete must not reach the API on its own.
    const dialog = page.getByRole('dialog', { name: 'Delete this ruleset?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Ruleset 01')).toBeVisible();
    expect(calls.delete || 0).toBe(0);

    // Backing out must not delete.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect(calls.delete || 0).toBe(0);
    await expectFirstRow(page);
  });

  test('confirming the delete removes the ruleset', async ({ page }) => {
    const calls = {};
    await mockApi(page, { calls });
    await gotoRuleSets(page);
    await expectFirstRow(page);

    await page.getByRole('button', { name: 'Actions for Ruleset 01' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this ruleset?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('button', { name: 'Ruleset 01', exact: true })).toHaveCount(0, { timeout: 10000 });
    expect(calls.delete).toBe(1);
  });

  test('row controls are named and the ruleset name is keyboard operable', async ({ page }) => {
    await mockApi(page);
    await gotoRuleSets(page);
    await expectFirstRow(page);

    // Every interactive control carries an accessible name.
    await expect(page.getByRole('switch', { name: 'Pause Ruleset 01' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Activate Ruleset 02' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions for Ruleset 01' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Column visibility' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh rulesets' })).toBeVisible();
    await expect(page.getByLabel('Search rulesets')).toBeVisible();
    await expect(page.getByLabel('Filter by status')).toBeVisible();

    // The name is a real <button>, so it is reachable and activatable by
    // keyboard. It used to be a <span onClick>, making the page mouse-only.
    const name = page.getByRole('button', { name: 'Ruleset 01', exact: true });
    await expect(name).toHaveJSProperty('tagName', 'BUTTON');
    await name.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/rule-sets\/rs1$/);
  });

  test('pausing a failed toggle reverts the optimistic switch', async ({ page }) => {
    await page.route('**/socket.io/**', route => route.abort());
    await page.addInitScript(u => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('user', JSON.stringify(u));
    }, user);
    await page.route('**/api/**', route => {
      const { pathname } = new URL(route.request().url());
      const json = payload => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(payload),
      });
      if (pathname.endsWith('/auth/me')) return json({ success: true, data: user });
      if (pathname.endsWith('/notifications')) return json({ success: true, data: [] });
      if (/\/rulesets\/.+\/toggle/.test(pathname)) {
        return route.fulfill({
          status: 500, contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Toggle rejected' }),
        });
      }
      if (pathname.endsWith('/rulesets')) return json({ success: true, data: rulesets });
      return json({ success: true, data: {} });
    });

    await gotoRuleSets(page);
    const toggle = page.getByRole('switch', { name: 'Pause Ruleset 01' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();

    // The switch must snap back and report the failure rather than leaving the
    // UI asserting a state the server rejected.
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10000 });
    await expect(page.getByText('Toggle rejected')).toBeVisible();
  });

  test('history drawer names the ruleset and distinguishes failure from success', async ({ page }) => {
    await mockApi(page);
    await gotoRuleSets(page);
    await expectFirstRow(page);

    await page.getByRole('button', { name: 'Actions for Ruleset 01' }).click();
    await page.getByRole('menuitem', { name: 'Execution History' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Execution History — Ruleset 01/)).toBeVisible();

    // Pass/fail is conveyed by icon shape and a text label, not colour alone.
    await expect(drawer.getByText('12 matched · 4 actioned')).toBeVisible();
    await expect(drawer.getByText('Failed')).toBeVisible();
  });

  test('structural columns cannot be hidden', async ({ page }) => {
    await mockApi(page);
    await gotoRuleSets(page);
    await expectFirstRow(page);

    await page.getByRole('button', { name: 'Column visibility' }).click();
    // Hiding Name or Actions would leave rows with no way to open or act on a
    // ruleset, so those two entries are not selectable.
    await expect(page.getByRole('menuitem', { name: 'Ruleset Name' })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Actions' })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Last Run' })).toBeEnabled();
  });

  test('a stale stored column preference cannot blank the table', async ({ page }) => {
    await page.route('**/socket.io/**', route => route.abort());
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('user', JSON.stringify(JSON.parse('null') || '{}'));
      // Preferences from an older column set reference keys that no longer
      // exist; those must be ignored rather than hiding everything.
      localStorage.setItem('rulesets-visible-columns', JSON.stringify({ removedColumn: false, anotherGone: false }));
      localStorage.setItem('rulesets-table-density', 'nonsense');
    });
    await page.route('**/api/**', route => {
      const { pathname } = new URL(route.request().url());
      const json = payload => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(payload),
      });
      if (pathname.endsWith('/auth/me')) return json({ success: true, data: user });
      if (pathname.endsWith('/notifications')) return json({ success: true, data: [] });
      if (pathname.endsWith('/rulesets')) return json({ success: true, data: rulesets });
      return json({ success: true, data: {} });
    });

    await gotoRuleSets(page);
    await expectFirstRow(page);
    await expect(page.getByRole('button', { name: 'Ruleset 25', exact: true })).toHaveCount(0);
    // The invalid density value falls back to the default rather than
    // rendering an unstyled table.
    await expect(page.locator('.rulesets-tablewrap')).toHaveAttribute('data-density', 'comfortable');
  });

  const WIDTHS = [1440, 1280, 1024, 768, 390];

  for (const width of WIDTHS) {
    test(`table stays usable at ${width}px without horizontal page overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page);
      await gotoRuleSets(page);
      await expectFirstRow(page);

      // The old nth-child rules hid whichever column happened to land on
      // index 4/5/6, which drifted as soon as a user hid any column.
      await expectFirstRow(page);
      await expect(page.getByRole('button', { name: /^Row density/ })).toBeVisible();

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
