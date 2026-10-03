/**
 * Refresh-token type/secret separation is critical: a refresh JWT must not be
 * accepted as an access token, and a deployed JWT_REFRESH_SECRET must actually
 * be used for rotation.
 */
const mockQuery = jest.fn();
const mockPool = {
  request: () => {
    const chain = {
      input: () => chain,
      query: mockQuery,
    };
    return chain;
  },
};

jest.mock('../../database/db', () => ({
  sql: { VarChar: 'VarChar', NVarChar: 'NVarChar', Int: 'Int', DateTime: 'DateTime' },
  getPool: jest.fn(async () => mockPool),
  generateId: () => 'generated-id',
}));
jest.mock('../../config/env', () => ({
  jwt: { secret: 'access-secret', refreshSecret: 'refresh-secret', expiresIn: '2h', refreshExpiresIn: '7d' },
}));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn(), sign: jest.fn() }));
jest.mock('../../services/SystemLogService', () => ({ log: jest.fn(async () => undefined) }));
jest.mock('../../services/otpService', () => ({ sendOtp: jest.fn(), verifyOtp: jest.fn() }));
jest.mock('../../services/trustedDeviceService', () => ({ isTrusted: jest.fn(), trust: jest.fn() }));
jest.mock('../../services/tokenBlacklistService', () => ({ blacklist: jest.fn(), blacklistUser: jest.fn() }));
jest.mock('../../services/accessProfileService', () => ({ resolveAccessProfile: jest.fn(), toPublicUser: jest.fn() }));
jest.mock('../../utils/requestFingerprint', () => ({ clientIp: () => '127.0.0.1', deviceFingerprint: () => 'fp' }));
jest.mock('../../middleware/loginRateLimiter', () => ({
  recordFailedAttempt: jest.fn(), recordSuccessfulLogin: jest.fn(), GENERIC_BLOCK: 'Invalid credentials',
}));

const jwt = require('jsonwebtoken');
const { refreshToken } = require('../../controllers/authController');

function response() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockImplementation(async (query) => {
    if (/SELECT \* FROM Users/.test(query)) {
      return { recordset: [{ Id: 'u-1', RefreshToken: 'refresh-value', IsActive: true }] };
    }
    return { recordset: [] };
  });
  jwt.sign.mockImplementation((payload) => (payload.type === 'access' ? 'next-access' : 'next-refresh'));
});

describe('refresh-token contract', () => {
  test('verifies with the dedicated refresh secret and preserves device binding', async () => {
    jwt.verify.mockReturnValue({ userId: 'u-1', type: 'refresh', fp: 'stable-device' });
    const res = response();

    await refreshToken({ body: { refreshToken: 'refresh-value' } }, res);

    expect(jwt.verify).toHaveBeenCalledWith('refresh-value', 'refresh-secret');
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'u-1', type: 'access', fp: 'stable-device' },
      'access-secret',
      { expiresIn: '2h' },
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { accessToken: 'next-access', refreshToken: 'next-refresh' },
    });
  });

  test('rejects an access-token payload at the refresh endpoint', async () => {
    jwt.verify.mockReturnValue({ userId: 'u-1', type: 'access' });
    const res = response();

    await refreshToken({ body: { refreshToken: 'access-value' } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
