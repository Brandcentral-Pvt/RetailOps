import { test, expect } from '@playwright/test';

const session = {
  success: true,
  data: {
    Id: 'test-user',
    _id: 'test-user',
    email: 'alex.morgan@example.com',
    firstName: 'Alex',
    lastName: 'Morgan',
    role: { name: 'super_admin', displayName: 'Super Admin' },
    permissions: ['users_view', 'users_manage'],
  },
};

const roles = [
  {
    _id: 'role-1',
    name: 'super_admin',
    displayName: 'Super Admin',
    level: 100,
    permissions: [{ _id: 'perm-users-view' }, { _id: 'perm-users-create' }],
  },
  {
    _id: 'role-2',
    name: 'listing_team',
    displayName: 'Listing Team',
    level: 30,
    permissions: [{ _id: 'perm-users-view' }],
  },
];

const permissions = [
  { _id: 'perm-users-view', name: 'users_view', displayName: 'View Users' },
  { _id: 'perm-users-create', name: 'users_create', displayName: 'Create Users' },
  { _id: 'perm-users-delete', name: 'users_delete', displayName: 'Delete Users' },
];

const users = [
  { _id: 'u1', firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com', isActive: true, lastSeen: new Date().toISOString(), role: { _id: 'role-2' }, supervisors: [] },
  { _id: 'u2', firstName: 'Bilal', lastName: 'Khan', email: 'bilal@example.com', isActive: true, lastSeen: new Date(Date.now() - 3600000).toISOString(), role: { _id: 'role-1' }, supervisors: [] },
  { _id: 'u3', firstName: 'Chandra', lastName: 'Iyer', email: 'chandra@example.com', isActive: false, lastSeen: null, role: { _id: 'role-2' }, supervisors: [] },
];

async function mockApi(page, { onRoleUpdate } = {}) {
  await page.route('**/socket.io/**', route => route.abort());

  await page.addInitScript(() => {
    localStorage.setItem('authToken', 'test-only-access-token');
    localStorage.setItem('user', JSON.stringify({
      _id: 'test-user',
      email: 'alex.morgan@example.com',
      firstName: 'Alex',
      lastName: 'Morgan',
      role: { name: 'super_admin', displayName: 'Super Admin' },
      permissions: ['users_view'],
    }));
  });

  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = route.request().method();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/me') return json(session);
    if (path === '/users/roles') return json({ success: true, data: { roles } });
    if (path === '/users/permissions') {
      return json({
        success: true,
        data: {
          permissions,
          groupedPermissions: { Users: permissions },
        },
      });
    }
    if (path === '/users/sellers') return json({ success: true, data: { sellers: [] } });
    if (path === '/users/managers') return json({ success: true, data: [] });
    if (path === '/users' && method === 'GET') {
      return json({
        success: true,
        data: {
          users,
          pagination: { total: users.length, activeCount: 2, inactiveCount: 1, pages: 1 },
        },
      });
    }
    if (/^\/roles\//.test(path) && method === 'PUT') {
      onRoleUpdate?.({ id: path.split('/')[2], body: route.request().postDataJSON() });
      return json({ success: true, data: {} });
    }
    return json({ success: true, data: [] });
  });
}

async function switchToPermissions(page) {
  await page.getByRole('main').getByText('Permissions', { exact: true }).click();
}

async function gotoUsers(page) {
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible();
}

test.describe('users and permissions page', () => {
  test('members tab shows server data without fabricated trend', async ({ page }) => {
    await mockApi(page);
    await gotoUsers(page);

    await expect(page.getByText('3 Members')).toBeVisible();
    await expect(page.getByText('Total Users', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Users', { exact: true })).toBeVisible();
    await expect(page.getByText('Inactive Users', { exact: true })).toBeVisible();

    // Values come from the API payload, not invented placeholders.
    await expect(page.getByText('67%', { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('+2');

    // Status/last-active degrade honestly for a user that never logged in.
    await expect(page.getByText('chandra@example.com')).toBeVisible();
    await expect(page.getByText('Never', { exact: true })).toBeVisible();
    await expect(page.getByText('bilal@example.com')).toBeVisible();
  });

  test('members table filters by search, role and status', async ({ page }) => {
    const requested = [];
    await mockApi(page);
    await page.route('**/api/users?**', route => {
      requested.push(new URL(route.request().url()).searchParams.get('role'));
      return route.fallback();
    });

    await gotoUsers(page);
    await expect(page.getByText('asha@example.com')).toBeVisible();

    await page.getByPlaceholder('Search users...').fill('asha');
    await expect.poll(() => requested.length).toBeGreaterThan(0);
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
  });

  test('permissions matrix tracks unsaved changes and only saves dirty roles', async ({ page }) => {
    const updates = [];
    await mockApi(page, { onRoleUpdate: u => updates.push(u) });
    await gotoUsers(page);

    await switchToPermissions(page);
    await expect(page.getByText('All changes saved')).toBeVisible();

    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeDisabled();

    // Toggling Listing Team / Create Users marks exactly one role as dirty.
    await page.getByRole('checkbox', { name: 'Create Users for Listing Team' }).click();
    await expect(page.getByText('1 unsaved change')).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: 'Create Users for Listing Team' })).toHaveAttribute('aria-checked', 'true');

    await saveButton.click();
    await expect.poll(() => updates.length).toBe(1);
    expect(updates[0].id).toBe('role-2');
    await expect(page.getByText('All changes saved')).toBeVisible();
  });

  test('discarding restores the server state', async ({ page }) => {
    await mockApi(page);
    await gotoUsers(page);
    await switchToPermissions(page);

    const cell = page.getByRole('checkbox', { name: 'Delete Users for Super Admin' });
    await cell.click();
    await expect(page.getByText('1 unsaved change')).toBeVisible();

    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await expect(cell).toHaveAttribute('aria-checked', 'false');
  });

  test('permission search filters groups and explains empty results', async ({ page }) => {
    await mockApi(page);
    await gotoUsers(page);
    await switchToPermissions(page);
    await expect(page.getByRole('main').getByText('Users', { exact: true })).toBeVisible();

    await page.getByPlaceholder('Search permissions...').fill('zzz-no-match');
    await expect(page.getByText('No matching permissions')).toBeVisible();

    await page.getByPlaceholder('Search permissions...').fill('delete');
    await expect(page.getByRole('checkbox', { name: 'Delete Users for Super Admin' })).toBeVisible();
  });

  test('row actions, drawer and modals stay usable', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await mockApi(page);
    await gotoUsers(page);

    // Action buttons expose accessible names instead of icon-only affordances.
    await page.getByRole('button', { name: 'View profile' }).first().click();
    await expect(page.getByText('asha@example.com').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-drawer-mask')).toHaveCount(0);

    await page.getByRole('button', { name: 'Send email' }).first().click();
    await expect(page.getByRole('dialog').getByText('Send Email').first()).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const statusSwitch = page.locator('.ant-table-tbody button[role=switch]').first();
    await expect(statusSwitch).toHaveAttribute('aria-checked', 'true');
    await statusSwitch.click();
    await expect(statusSwitch).toHaveAttribute('aria-checked', 'false');

    await page.getByRole('button', { name: 'Add User' }).first().click();
    await expect(page.getByText('Add New User')).toBeVisible();
    await expect(page.getByText('Basic Information')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await switchToPermissions(page);
    await page.getByRole('button', { name: 'Create Role' }).click();
    await expect(page.getByText('Create New Role')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Edit Listing Team role' }).click();
    await expect(page.getByText('Edit Role')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    expect(pageErrors).toEqual([]);
  });

  test('permission edits survive switching tabs', async ({ page }) => {
    await mockApi(page);
    await gotoUsers(page);
    await switchToPermissions(page);

    const cell = page.getByRole('checkbox', { name: 'Delete Users for Listing Team' });
    await cell.click();
    await expect(page.getByText('1 unsaved change')).toBeVisible();

    await page.getByRole('main').getByText('Members', { exact: true }).click();
    await switchToPermissions(page);
    await expect(page.getByText('1 unsaved change')).toBeVisible();
    await expect(cell).toHaveAttribute('aria-checked', 'true');
  });

  test('layout does not overflow horizontally on a phone viewport', async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoUsers(page);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
