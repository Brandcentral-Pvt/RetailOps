const mockQuery = jest.fn();
const mockRequest = jest.fn(() => {
  const chain = {
    input: jest.fn(() => chain),
    query: mockQuery,
  };
  return chain;
});

jest.mock('../../database/db', () => ({
  sql: { NVarChar: 'NVarChar' },
  getPool: jest.fn(async () => ({ request: mockRequest })),
}));

const trustedDevices = require('../../services/trustedDeviceService');

describe('trusted-device revocation safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not revoke everything when the request device cannot be matched', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    await expect(trustedDevices.revokeOthers('u-1', 'unknown-fingerprint'))
      .resolves.toEqual({ currentFound: false, revoked: 0 });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain('DeviceFingerprint = @fingerprint');
  });

  test('only revokes other records after confirming the current trusted device', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ Id: 'td-current' }] })
      .mockResolvedValueOnce({ rowsAffected: [2] });

    await expect(trustedDevices.revokeOthers('u-1', 'current-fingerprint'))
      .resolves.toEqual({ currentFound: true, revoked: 2 });

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0]).toContain('DeviceFingerprint <> @fingerprint');
  });
});
