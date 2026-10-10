/**
 * Single password policy shared by every password-changing API.
 * Login remains deliberately permissive so existing accounts are not locked
 * out; the policy is enforced when a credential is created or replaced.
 */
function passwordPolicyError(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  if (password.includes('<')) return 'Password contains unsupported characters';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol';
  return null;
}

function isPasswordCompliant(password) {
  return passwordPolicyError(password) === null;
}

module.exports = { passwordPolicyError, isPasswordCompliant };
