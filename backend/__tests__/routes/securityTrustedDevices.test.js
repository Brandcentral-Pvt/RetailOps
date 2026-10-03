const express = require('express');
const request = require('supertest');

const mockGetUserDevices = jest.fn();
const mockRevokeOthers = jest.fn();

jest.mock('../../middleware/auth', () => ({
  authenticate: (req, _res, next) => {
    req.user = { Id: 'u-1' };
    next();
  },
}));
jest.mock('../../database/db', () => ({ sql: {}, getPool: jest.fn() }));
jest.mock('../../services/trustedDeviceService', () => ({
  getUserDevices: mockGetUserDevices,
  revokeOthers: mockRevokeOthers,
  revokeAll: jest.fn(),
  revoke: jest.fn(),
}));
jest.mock('../../utils/requestFingerprint', () => ({ deviceFingerprint: () => 'current-fingerprint' }));

const securityRoutes = require('../../routes/securityRoutes');

function app() {
  const instance = express();
  instance.use(securityRoutes);
  return instance;
}

describe('trusted-device route contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns safe mobile DTOs and never exposes device fingerprints', async () => {
    mockGetUserDevices.mockResolvedValue([
      {
        Id: 'td-1', DeviceFingerprint: 'current-fingerprint', DeviceName: 'Pixel 8',
        IpAddress: '203.0.113.10', LastUsedAt: '2026-10-03T08:00:00.000Z', ExpiresAt: '2026-10-03T20:00:00.000Z',
      },
    ]);

    const response = await request(app()).get('/trusted-devices').expect(200);

    expect(response.body).toEqual({
      success: true,
      devices: [{
        id: 'td-1', name: 'Pixel 8', ipAddress: '203.0.113.10',
        lastUsedAt: '2026-10-03T08:00:00.000Z', expiresAt: '2026-10-03T20:00:00.000Z', isCurrent: true,
      }],
    });
    expect(JSON.stringify(response.body)).not.toContain('DeviceFingerprint');
  });

  test('refuses broad revocation when this installation cannot be confirmed', async () => {
    mockRevokeOthers.mockResolvedValue({ currentFound: false, revoked: 0 });

    const response = await request(app()).delete('/trusted-devices/others').expect(409);

    expect(response.body).toEqual({ success: false, message: 'Unable to identify this trusted device' });
    expect(mockRevokeOthers).toHaveBeenCalledWith('u-1', 'current-fingerprint');
  });
});
