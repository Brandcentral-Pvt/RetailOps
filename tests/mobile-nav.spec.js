import { test, expect } from '@playwright/test';

const session = {
  success: true,
  data: {
    Id: 'test-user',
    _id: 'test-user',
    email: 'alex.morgan@example.com',
    firstName: 'Alex',
    lastName: 'Morgan',
    fullName: 'Alex Morgan',
    role: { name: 'admin', displayName: 'Admin' },
    permissions: ['dashboard_view', 'users_view', 'settings_manage'],
  },
};

const json = (route, body, status = 200, headers = {}) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers });

async function mockAuthenticated(page) {
  await page.route('**/api/auth/me', route => json(route, session));
  await page.route('**/api/**', route => json(route, { success: true, data: [] }));
  await page.route('**/socket.io/**', route => route.abort());
  // Set auth token before app loads so AuthContext restores session
  await page.addInitScript(() => {
    localStorage.setItem('authToken', 'test-only-access-token');
    localStorage.setItem('user', JSON.stringify({
      Id: 'test-user',
      _id: 'test-user',
      email: 'alex.morgan@example.com',
      firstName: 'Alex',
      lastName: 'Morgan',
      fullName: 'Alex Morgan',
      role: { name: 'admin', displayName: 'Admin' },
      permissions: ['dashboard_view'],
    }));
  });
}

test.describe('mobile navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page);
  });

  test('hamburger is visible on mobile and hidden on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /open navigation menu/i });
    await expect(toggle).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 960 });
    // On desktop the mobile toggle should be hidden (display: none)
    await expect(toggle).toBeHidden();
  });

  test('sidebar is hidden initially on mobile and opens via hamburger', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeHidden();

    const toggle = page.getByRole('button', { name: /open navigation menu/i });
    await toggle.click();
    await expect(sidebar).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('backdrop click closes mobile sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /open navigation menu/i });
    await toggle.click();
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    const backdrop = page.locator('.sidebar-mobile-backdrop');
    await expect(backdrop).toBeVisible();
    await backdrop.click();
    await expect(sidebar).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('Escape key closes mobile sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /open navigation menu/i });
    await toggle.click();
    await expect(page.locator('#sidebar')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#sidebar')).toBeHidden();
  });

  test('navigation closes mobile drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /open navigation menu/i });
    await toggle.click();
    await expect(page.locator('#sidebar')).toBeVisible();

    // Click first menu item (Dashboard)
    const firstItem = page.locator('.ant-menu-item').first();
    await firstItem.click();
    await expect(page.locator('#sidebar')).toBeHidden();
  });

  test('desktop collapse toggle is hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation menu/i }).click();
    const collapseToggle = page.locator('.sidebar-toggle');
    await expect(collapseToggle).toBeHidden();
  });

  test('body scroll is locked when mobile drawer open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /open navigation menu/i });
    await toggle.click();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');

    await page.keyboard.press('Escape');
    const after = await page.evaluate(() => document.body.style.overflow);
    expect(after).not.toBe('hidden');
  });

  test('sidebar has accessible navigation label', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation menu/i }).click();
    await expect(page.locator('#sidebar')).toHaveAttribute('aria-label', 'Main navigation');
  });
});
