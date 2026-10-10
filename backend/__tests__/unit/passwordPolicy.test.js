const { isPasswordCompliant, passwordPolicyError } = require('../../lib/passwordPolicy');
const schemas = require('../../validation/schemas');

describe('password policy', () => {
  test.each([
    ['short', 'Password must be at least 12 characters'],
    ['all lowercase 123!', 'Password must include an uppercase letter'],
    ['ALLUPPERCASE123!', 'Password must include a lowercase letter'],
    ['NoDigitsOrSymbol!', 'Password must include a number'],
    ['NoSymbolPassword123', 'Password must include a symbol'],
  ])('rejects %s', (password, expected) => {
    expect(passwordPolicyError(password)).toBe(expected);
    expect(isPasswordCompliant(password)).toBe(false);
  });

  test('accepts a 12+ character password with all required character classes', () => {
    expect(passwordPolicyError('RetailOps#2026')).toBeNull();
    expect(isPasswordCompliant('RetailOps#2026')).toBe(true);
  });

  test('uses the same policy at the authenticated change-password boundary', () => {
    expect(schemas.changePassword.validate({ currentPassword: 'old-password', newPassword: 'Short1!' }).error).toBeTruthy();
    expect(schemas.changePassword.validate({ currentPassword: 'old-password', newPassword: 'RetailOps#2026' }).error).toBeFalsy();
    expect(schemas.createUser.validate({ email: 'new@example.com', firstName: 'New', lastName: 'User', roleId: 'role-1', password: 'Short1!' }).error).toBeTruthy();
  });
});
