const mockRequirePermission = jest.fn(() => (_req, _res, next) => next());

jest.mock('../../middleware/auth', () => ({
  auth: (_req, _res, next) => next(),
  requirePermission: mockRequirePermission,
}));
jest.mock('../../controllers/systemSettingController', () => ({
  getSettings: jest.fn(),
  getScheduleConfig: jest.fn(),
  getOctoparseAutomation: jest.fn(),
  toggleOctoparseAutomation: jest.fn(),
  getSettingByKey: jest.fn(),
  updateSettings: jest.fn(),
  testEmail: jest.fn(),
}));

require('../../routes/systemSettingRoutes');

test('settings writes are gated by the effective settings_manage capability', () => {
  expect(mockRequirePermission).toHaveBeenCalledTimes(3);
  expect(mockRequirePermission).toHaveBeenNthCalledWith(1, 'settings_manage');
  expect(mockRequirePermission).toHaveBeenNthCalledWith(2, 'settings_manage');
  expect(mockRequirePermission).toHaveBeenNthCalledWith(3, 'settings_manage');
});
