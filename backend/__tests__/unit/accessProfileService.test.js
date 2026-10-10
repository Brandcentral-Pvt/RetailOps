/**
 * Regression contract for the RBAC data resolver shared by /auth/me and the
 * bearer middleware. These are intentionally pure tests: a role change must
 * not make the client see a permission that routes do not enforce.
 */
jest.mock('../../database/db', () => ({ sql: {} }));

const {
  canonicalRole,
  resolveEffectivePermissions,
  scopeForRole,
  toPublicUser,
} = require('../../services/accessProfileService');
const { deviceFingerprint } = require('../../utils/requestFingerprint');

describe('access profile resolution', () => {
  test('normalizes legacy role spellings and derives seller scope server-side', () => {
    expect(canonicalRole(' Brand Manager ')).toBe('brand_manager');
    expect(canonicalRole('super-admin')).toBe('admin');
    expect(canonicalRole('SuperAdmin')).toBe('admin');
    expect(scopeForRole('seller client')).toBe('self');
    expect(scopeForRole('operational-manager')).toBe('global');
    expect(scopeForRole('brand_manager')).toBe('assigned');
  });

  test('merges role grants and user overrides, then applies exclusions', () => {
    const allPermissions = [
      { Id: 'p-dashboard', Name: 'dashboard_view' },
      { Id: 'p-targets', Name: 'targets_view' },
      { Id: 'p-tasks', Name: 'tasks_manage' },
      { Id: 'p-secret', Name: 'secret_view' },
    ];
    const permissions = resolveEffectivePermissions({
      rolePermissions: [{ Name: 'dashboard_view' }, { Name: 'targets_view' }],
      allPermissions,
      // Admin UI has historically stored either permission IDs or names.
      extraPermissions: JSON.stringify(['p-tasks', 'secret_view', 'unknown']),
      excludedPermissions: JSON.stringify(['targets_view', 'p-secret']),
    });

    expect(permissions).toEqual(['dashboard_view', 'tasks_manage']);
  });

  test('public auth user omits credentials and raw override storage', () => {
    const result = toPublicUser(
      {
        Id: 'u-1', Email: 'Asha@Example.com', FirstName: 'Asha', LastName: 'K',
        Password: 'never-send', RefreshToken: 'never-send', ExtraPermissions: '["*"]',
        ForcePasswordReset: true,
      },
      {
        role: { Name: 'brand_manager', DisplayName: 'Brand Manager' },
        permissions: ['dashboard_view'], assignedSellers: ['s-1'], sellers: [], scope: 'assigned',
      },
    );

    expect(result).toMatchObject({ id: 'u-1', email: 'asha@example.com', needsPasswordReset: true });
    expect(result).not.toHaveProperty('Password');
    expect(result).not.toHaveProperty('RefreshToken');
    expect(result).not.toHaveProperty('ExtraPermissions');
  });
});

describe('device fingerprint', () => {
  test('uses a stable native device id rather than a changing mobile IP address', () => {
    const first = deviceFingerprint({ headers: { 'x-device-id': 'mob-0123456789abcdef', 'user-agent': 'Expo' }, socket: { remoteAddress: '10.0.0.1' } });
    const afterNetworkChange = deviceFingerprint({ headers: { 'x-device-id': 'mob-0123456789abcdef', 'user-agent': 'Expo' }, socket: { remoteAddress: '100.64.0.2' } });

    expect(first).toEqual(afterNetworkChange);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test('keeps the legacy user-agent/IP fallback for clients without a device id', () => {
    const request = { headers: { 'user-agent': 'Legacy Browser' }, socket: { remoteAddress: '127.0.0.1' } };
    expect(deviceFingerprint(request)).toEqual(deviceFingerprint(request));
  });
});
