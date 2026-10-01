import { test, expect } from '@playwright/test';

// The task templates pages render `.tpl-*` and `.sop-*` classes that live in
// src/modules/tasks/tasks.css, but neither page imported that stylesheet. Both
// are React.lazy routes, so the page only came up styled when the user happened
// to open the task list or the review queue first — the only other importers of
// tasks.css. Landing on /tasks/templates directly (deep link, refresh, or
// arriving from anywhere else) rendered it unstyled.
//
// These tests load the templates page as a cold route and assert the rules that
// shape the page are actually in the document.

const user = {
  _id: 'u1',
  Id: 'u1',
  email: 'lead@example.com',
  firstName: 'Lead',
  lastName: 'User',
  role: { name: 'super_admin' },
  isAdmin: true,
  permissions: ['tasks_view', 'tasks_manage', 'marketplace_amazon', 'marketplace_ajio'],
};

const templates = Array.from({ length: 6 }, (_, i) => ({
  Id: `tpl-${i + 1}`,
  Name: `Template ${i + 1}`,
  Description: `Routine number ${i + 1}`,
  Category: i % 2 === 0 ? 'PRICING' : 'LISTING',
  Department: 'Operations',
  Priority: 'MEDIUM',
  Frequency: 'DAILY',
  IsActive: true,
  TargetType: 'COUNT',
  DefaultTarget: 10,
  SLAHours: 24,
  CreatedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
}));

async function seed(page) {
  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript((u) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
  await page.route('**/api/**', route => {
    const url = route.request().url();
    const pathname = new URL(url).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    // Permissions are read from /auth/me, not from the cached localStorage user.
    if (pathname.endsWith('/auth/me')) return json({ success: true, data: user });
    if (pathname.endsWith('/notifications')) return json({ success: true, data: [] });
    if (pathname.includes('/pems/templates/filters')) {
      return json({ success: true, data: { categories: ['PRICING', 'LISTING'], departments: ['Operations'] } });
    }
    if (/\/pems\/templates(\/|$)/.test(pathname) && !pathname.includes('/detail')) {
      if (pathname.endsWith('/templates')) return json({ success: true, templates });
      return json({ success: true, data: { ...templates[0], Id: pathname.split('/').pop() } });
    }
    if (pathname.includes('/pems/sellers')) return json({ success: true, data: [] });
    if (pathname.includes('/pems/brand-managers')) return json({ success: true, data: [] });
    if (pathname.includes('/pems/reviewers')) return json({ success: true, data: [] });
    if (pathname.includes('/automation-stats')) {
      return json({ success: true, data: { total: 0, open: 0, overdue: 0, byRuleset: [] } });
    }
    if (pathname.includes('/pems/dashboard/summary')) return json({ success: true, data: { kpi: {}, risk: {} } });
    if (pathname.startsWith('/api/')) return json({ success: true, data: [] });
    return route.continue();
  });
}

const innerHeightOf = (page) => page.viewportSize()?.height ?? 0;

/** True when a stylesheet in the document actually defines `.tpl-*` rules. */
async function tplRulesApplied(page) {
  return page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.selectorText && rule.selectorText.includes('.tpl-')) return true;
        }
      } catch { /* cross-origin sheet */ }
    }
    return false;
  });
}

test.describe('task templates CSS loads on a cold route', () => {
  test('the templates page is styled without visiting the task list first', async ({ page }) => {
    await seed(page);
    const cssErrors = [];
    page.on('pageerror', e => cssErrors.push(String(e)));

    await page.goto('/tasks/templates');
    await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();

    // The page renders .tpl-page / .tpl-hero / .tpl-card; if tasks.css did not
    // load these have no box model at all.
    // .tpl-page is a full-height page surface and .tpl-page-inner is a centred,
    // width-capped, padded container. Both need tasks.css to mean anything.
    const layout = await page.evaluate(() => {
      const page = document.querySelector('.tpl-page');
      const inner = document.querySelector('.tpl-page-inner');
      if (!page || !inner) return { found: false };
      const p = getComputedStyle(page);
      const i = getComputedStyle(inner);
      return {
        found: true,
        minHeight: p.minHeight,
        innerMaxWidth: i.maxWidth,
        innerPaddingLeft: i.paddingLeft,
      };
    });

    expect(layout.found).toBe(true);
    expect(parseFloat(layout.minHeight)).toBeGreaterThanOrEqual(innerHeightOf(page));
    expect(parseFloat(layout.innerMaxWidth)).toBe(1560);
    expect(parseFloat(layout.innerPaddingLeft)).toBe(24);
    expect(cssErrors).toEqual([]);
  });

  test('the templates page stylesheet is requested as its own chunk', async ({ page }) => {
    await seed(page);
    const cssRequests = [];
    page.on('request', r => { if (r.resourceType() === 'stylesheet') cssRequests.push(r.url()); });

    await page.goto('/tasks/templates');
    await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();

    // Whether the sheet ships in the entry bundle or a shared chunk, it must be
    // present in the document by the time the page is interactive.
    expect(await tplRulesApplied(page)).toBe(true);
  });

  test('the template detail page is styled on a cold route too', async ({ page }) => {
    await seed(page);
    await page.goto('/tasks/templates/tpl-1');
    await page.waitForLoadState('networkidle');

    expect(await tplRulesApplied(page)).toBe(true);
  });
});
