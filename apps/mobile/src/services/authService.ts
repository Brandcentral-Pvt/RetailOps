/**
 * authService — the wire contract with backend/routes/authRoutes.js.
 *
 * Login is two-legged: password, then OTP, unless the device is trusted.
 * `fetchMe()` is authoritative for the effective permissions, seller scope and
 * setup state that determine the mobile shell.
 */
import type { ScopeMode, Session } from '../auth/permissions';
import { ApiError } from './ApiError';
import { api, type AuthTokens } from './apiClient';

type LoginRequest = { email: string; password: string };

type LoginOtpResponse = {
  success: true;
  requiresOtp: true;
  tempToken: string;
  destination: string;
  expiresIn: number;
  message: string;
};

type LoginDirectResponse = {
  success: true;
  requiresOtp?: false;
  data: { user: RawUser; accessToken: string; refreshToken: string };
  trustedDevice?: boolean;
  requiresSetup?: boolean;
  needsPasswordReset?: boolean;
};

export type AuthenticatedResult = {
  kind: 'authenticated';
  accessToken: string;
  refreshToken: string;
  needsPasswordReset: boolean;
  requiresSetup: boolean;
};

export type LoginResult =
  | { kind: 'otp'; tempToken: string; destination: string; expiresIn: number; message: string }
  | AuthenticatedResult;

export type RawSeller = { Id?: string; id?: string; Name?: string; name?: string };

export type RawUser = {
  id?: string;
  _id?: string;
  Id?: string;
  Email?: string;
  email?: string;
  FirstName?: string;
  firstName?: string;
  LastName?: string;
  lastName?: string;
  role?: { Name?: string; name?: string; DisplayName?: string; displayName?: string };
  permissions?: string[];
  sellers?: RawSeller[];
  assignedSellers?: string[];
  scope?: ScopeMode;
  requiresSetup?: boolean;
  needsPasswordReset?: boolean;
};

export async function login({ email, password }: LoginRequest): Promise<LoginResult> {
  const result = await api.post<LoginOtpResponse | LoginDirectResponse>(
    '/auth/login',
    { email: email.trim().toLowerCase(), password },
    { skipAuthRefresh: true },
  );

  if ('requiresOtp' in result && result.requiresOtp) {
    return {
      kind: 'otp',
      tempToken: result.tempToken,
      destination: result.destination,
      expiresIn: result.expiresIn,
      message: result.message,
    };
  }

  return toAuthenticatedResult(result as LoginDirectResponse);
}

/** POST /auth/verify-otp — completes the second leg. */
export async function verifyOtp(tempToken: string, otp: string, trustDevice: boolean): Promise<AuthenticatedResult> {
  const result = await api.post<LoginDirectResponse>(
    '/auth/verify-otp',
    { tempToken, otp, trustDevice },
    { skipAuthRefresh: true },
  );
  return toAuthenticatedResult(result);
}

export async function resendOtp(tempToken: string): Promise<{ destination?: string; expiresIn?: number; message?: string }> {
  return api.post('/auth/resend-otp', { tempToken }, { skipAuthRefresh: true });
}

/** Deliberately neutral on success so the UI never reveals whether an account exists. */
export async function forgotPassword(email: string): Promise<{ message?: string }> {
  return api.post('/auth/forgot-password', { email: email.trim().toLowerCase() }, { skipAuthRefresh: true });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message?: string }> {
  return api.post('/auth/reset-password', { token, newPassword }, { skipAuthRefresh: true });
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', {}, { skipAuthRefresh: true });
}

/** First-login setup endpoints. */
export type FirstLoginSetupStatus = {
  needsSetup?: boolean;
  completedSteps?: string[];
};

export async function getFirstLoginSetupStatus(): Promise<FirstLoginSetupStatus> {
  const result = await api.get<{ success?: boolean; data?: FirstLoginSetupStatus }>('/setup-wizard/status');
  if (!result.success || !result.data) {
    throw new ApiError(500, 'The server returned invalid setup progress.', '/setup-wizard/status', result);
  }
  return result.data;
}

export async function acknowledgeFirstLoginSetup(): Promise<void> {
  // The compact mobile flow presents the welcome/security guidance above the
  // form and records those acknowledgements before changing the password. If a
  // network request fails here, the temporary password remains usable.
  await api.post('/setup-wizard/step/welcome/complete', {});
  await api.post('/setup-wizard/step/security_tips/complete', {});
  await api.post('/setup-wizard/step/accept_policies/complete', {});
}

export async function setFirstLoginPassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/setup-wizard/password', { currentPassword, newPassword });
}

export async function completeFirstLoginSetup(): Promise<void> {
  // Kept separate from the password write so an interrupted final request can
  // be resumed on the next launch without asking for the old temporary secret.
  await api.post('/setup-wizard/step/complete/complete', {});
  await api.post('/setup-wizard/complete', {});
}

/** Standard authenticated password-change endpoint. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.put('/auth/change-password', { currentPassword, newPassword });
}

/** GET /auth/me — the authoritative session payload. */
export async function fetchMe(): Promise<RawUser> {
  const result = await api.get<{ success?: boolean; data?: RawUser }>('/auth/me');
  if (!result.success || !result.data) {
    throw new ApiError(500, 'The server returned an invalid session.', '/auth/me', result);
  }
  return result.data;
}

function toAuthenticatedResult(result: LoginDirectResponse): AuthenticatedResult {
  const accessToken = result.data?.accessToken;
  const refreshToken = result.data?.refreshToken;
  if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken) {
    throw new ApiError(500, 'The server returned an invalid sign-in response.', '/auth/login', result);
  }
  return {
    kind: 'authenticated',
    accessToken,
    refreshToken,
    needsPasswordReset: Boolean(result.needsPasswordReset),
    requiresSetup: Boolean(result.requiresSetup),
  };
}

function scopeOf(user: RawUser): ScopeMode {
  // The backend always sends this field. Failing closed to `assigned` prevents
  // an old or malformed server response from widening a seller list client-side.
  return user.scope === 'global' || user.scope === 'assigned' || user.scope === 'self' ? user.scope : 'assigned';
}

export function toSession(user: RawUser, tokens: AuthTokens): Session {
  const firstName = user.FirstName ?? user.firstName ?? '';
  const lastName = user.LastName ?? user.lastName ?? '';
  const email = (user.Email ?? user.email ?? '').trim().toLowerCase();
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || 'User';
  const role = user.role?.Name ?? user.role?.name ?? 'viewer';
  const sellerIds = (user.assignedSellers ?? (user.sellers ?? [])
    .map((seller) => seller.Id ?? seller.id ?? '')
    .filter(Boolean))
    .map(String);

  return {
    userId: String(user.Id ?? user.id ?? user._id ?? ''),
    email,
    displayName,
    role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    sellerIds: [...new Set(sellerIds)],
    scope: scopeOf(user),
    token: tokens.accessToken,
    // The API refreshes reactively on a 401. The server remains the authority
    // for expiry and revocation; a stale local timestamp must not grant access.
    expiresAt: Number.MAX_SAFE_INTEGER,
    requiresSetup: Boolean(user.requiresSetup),
    needsPasswordReset: Boolean(user.needsPasswordReset),
  };
}
