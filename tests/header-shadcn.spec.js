import { test, expect } from '@playwright/test';

const session = {
  success: true,
  data: {
    Id: 'header-user',
    _id: 'header-user',
    email: 'ops@example.com',
    firstName: 'Ops',
    lastName: 'User',
    fullName: 'Ops User',
    role: { name: 'admin', displayName: 'Admin' },
    permissions: ['dashboard_view', 'users_view', 'settings_manage', 'gms_tracker_view', 'asinmanager_view', 'tasks_view'],
  },
};

const limitedSession = {
  success: true,
  data: {
    Id: 'header-limited',
    _id: 'header-limited',
    email: 'viewer@example.com',
    firstName: 'Viewer',
    lastName: 'User',
    fullName: 'Viewer User',
    role: { name: 'operational_manager', displayName: 'Operational Manager' },
    permissions: ['dashboard_view'],
  },
};

const json = (route, body, status = 200, headers = {}) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers });

async function mockAuthenticated(page, user = session) {
  await page.route('**/api/auth/me', route => json(route, user));
  await page.route('**/api/**', route => json(route, { success: true, data: [] }));
  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript((currentUser) => {
    localStorage.setItem('authToken', 'test-only-access-token');
    localStorage.setItem('user', JSON.stringify(currentUser));
  }, user);
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

test.describe('shadcn header (H1/H2)', () => {
  test('1920 px: header shell, 64px height, no horizontal overflow', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/profile');
    await expect(page.locator('.shadcn-header')).toBeVisible({ timeout: 10_000 });
    const height = await page.locator('.shadcn-header').evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('64px');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.locator('.shadcn-connection')).toContainText('Disconnected');
    expect(realErrors(errors), 'no console or page errors').toEqual([]);
  });

  test('1440 px: header shell, 64px height, no horizontal overflow', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/profile');
    await expect(page.locator('.shadcn-header')).toBeVisible({ timeout: 10_000 });
    const height = await page.locator('.shadcn-header').evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('64px');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.locator('.shadcn-connection')).toContainText('Disconnected');
    expect(realErrors(errors), 'no console or page errors').toEqual([]);
  });

  test('1024 px: header shell, 64px height, no horizontal overflow', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/profile');
    await expect(page.locator('.shadcn-header')).toBeVisible({ timeout: 10_000 });
    const height = await page.locator('.shadcn-header').evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('64px');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.locator('.shadcn-connection')).toContainText('Disconnected');
    expect(realErrors(errors), 'no console or page errors').toEqual([]);
  });

  test('768 px: header shell, 56px height, no horizontal overflow', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/profile');
    await expect(page.locator('.shadcn-header')).toBeVisible({ timeout: 10_000 });
    const height = await page.locator('.shadcn-header').evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('56px');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.locator('.shadcn-connection')).toContainText('Disconnected');
    expect(realErrors(errors), 'no console or page errors').toEqual([]);
  });

  test('390 px: header shell, 56px height, no horizontal overflow', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/profile');
    await expect(page.locator('.shadcn-header')).toBeVisible({ timeout: 10_000 });
    const height = await page.locator('.shadcn-header').evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('56px');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.locator('.shadcn-connection')).toContainText('Disconnected');
    expect(realErrors(errors), 'no console or page errors').toEqual([]);
  });

  test('renders accessible breadcrumbs and page title', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.goto('/profile');
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toContainText('Profile');
    await expect(page.locator('h1')).toContainText('Profile');
    expect(realErrors(errors)).toEqual([]);
  });

  test('mobile hamburger toggle visible on mobile, hidden on desktop (Rule 7)', async ({ page }) => {
    await mockAuthenticated(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/profile');
    const toggle = page.getByRole('button', { name: /open navigation menu/i });
    await expect(toggle).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/profile');
    await expect(toggle).toBeHidden();
  });

  test('command palette opens via search button and Cmd+K (Rule 9)', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: /open command palette/i }).click();
    await expect(page.getByRole('dialog', { name: /Commands/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[placeholder*="command"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Commands/ })).toBeHidden();

    await page.keyboard.down('Meta');
    await page.keyboard.press('k');
    await page.keyboard.up('Meta');
    await expect(page.getByRole('dialog', { name: /Commands/ })).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    expect(realErrors(errors)).toEqual([]);
  });

  test('command palette keyboard navigation + select (Rule 9)', async ({ page }) => {
    await mockAuthenticated(page);
    await page.goto('/profile');
    await page.keyboard.down('Meta');
    await page.keyboard.press('k');
    await page.keyboard.up('Meta');
    await expect(page.getByRole('dialog', { name: /Commands/ })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /Commands/ })).toBeHidden();
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 5_000 });
  });

  test('enforces RBAC: limited user does not see settings command (Rule 10)', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page, limitedSession);
    await page.goto('/profile');
    await page.keyboard.down('Meta');
    await page.keyboard.press('k');
    await page.keyboard.up('Meta');
    await expect(page.getByRole('dialog', { name: /Commands/ })).toBeVisible();
    await expect(page.getByText('Workspace settings')).toBeHidden();
    await expect(page.getByText('Go to Dashboard')).toBeVisible();
    expect(realErrors(errors)).toEqual([]);
  });

  test('no mock / console-only commands appear (Rule 11)', async ({ page }) => {
    const errors = captureErrors(page);
    await mockAuthenticated(page);
    await page.goto('/profile');
    await page.keyboard.down('Meta');
    await page.keyboard.press('k');
    await page.keyboard.up('Meta');
    await expect(page.getByRole('dialog', { name: /Commands/ })).toBeVisible();
    await expect(page.getByText('Sync data now')).toBeHidden();
    await expect(page.getByText('Export report')).toBeVisible();
    expect(realErrors(errors)).toEqual([]);
  });
});
