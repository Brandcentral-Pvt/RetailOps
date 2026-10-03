/** The password/setup wall belongs in common bearer auth, not only in mobile UI. */
const defaultUser = {
  Id: 'u-1', Email: 'asha@example.com', FirstName: 'Asha', LastName: 'K', IsActive: true,
  RoleId: 'r-1', RoleName: 'brand_manager', RoleDisplayName: 'Brand Manager',
  ForcePasswordReset: true, PasswordExpiresAt: null, IsFirstLogin: false, SetupCompletedAt: null,
};
const mockUser = { ...defaultUser };

jest.mock('../../database/db', () => {
  const request = {
    input: () => request,
    query: jest.fn(async () => ({ recordset: [mockUser] })),
  };
  return { sql: { VarChar: 'VarChar' }, getPool: async () => ({ request: () => request }) };
});
jest.mock('../../config/env', () => ({ jwt: { secret: 'test-secret' } }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn(() => ({ userId: 'u-1', type: 'access', iat: 1 })) }));
jest.mock('../../services/tokenBlacklistService', () => ({
  isBlacklisted: jest.fn(async () => false),
  isUserBlacklisted: jest.fn(async () => false),
}));
jest.mock('../../services/accessProfileService', () => ({
  resolveAccessProfile: jest.fn(async () => ({
    role: { Name: 'brand_manager', name: 'brand_manager' }, permissions: ['dashboard_view'],
    assignedSellers: ['s-1'], sellers: [], scope: 'assigned',
  })),
}));
jest.mock('../../utils/requestFingerprint', () => ({ deviceFingerprint: () => 'fp' }));
jest.mock('../../services/eventBus', () => ({ EVENTS: { PERMISSION_DENIED: 'denied' }, emit: jest.fn() }));
jest.mock('../../utils/roleUtils', () => ({ isGlobalUserRole: () => false }));

const { authenticate } = require('../../middleware/auth');

function response() {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
}

function request(originalUrl) {
  return {
    originalUrl,
    headers: { authorization: 'Bearer access-token' },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

describe('credential-update bearer gate', () => {
  beforeEach(() => Object.assign(mockUser, defaultUser));

  test('blocks a force-reset account from normal protected APIs', async () => {
    const req = request('/api/dashboard');
    const res = response();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(428);
    expect(res.body).toMatchObject({ code: 'CREDENTIAL_UPDATE_REQUIRED' });
  });

  test('still permits /auth/me so clients can route to the credential screen', async () => {
    const req = request('/api/auth/me');
    const res = response();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.forcePasswordReset).toBe(true);
    expect(req.user.permissions).toEqual(['dashboard_view']);
  });

  test('permits first-login setup endpoints but not unrelated feature routes', async () => {
    mockUser.ForcePasswordReset = false;
    mockUser.IsFirstLogin = true;

    const setupReq = request('/api/setup-wizard/password');
    const setupRes = response();
    const setupNext = jest.fn();
    await authenticate(setupReq, setupRes, setupNext);
    expect(setupNext).toHaveBeenCalledTimes(1);

    const featureReq = request('/api/tasks');
    const featureRes = response();
    await authenticate(featureReq, featureRes, jest.fn());
    expect(featureRes.status).toHaveBeenCalledWith(428);
  });
});
