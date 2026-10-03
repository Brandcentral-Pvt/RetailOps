/**
 * authService — the wire contract with backend/routes/authRoutes.js.
 *
 * Login is two-legged: password, then OTP, unless the device is trusted.
 * `hydrate()` uses GET /auth/me, which is the *only* endpoint that returns the
 * assigned sellers alongside the permissions, so it is what builds the session.
 */
import { api } from './apiClient';
import type { RoleKey, ScopeMode, Session } from '../auth/permissions';

type LoginRequest = { email: string; password: string };

/** POST /auth/login → OTP branch */
type LoginOtpResponse = {
  success: true;
  requiresOtp: true;
  tempToken: string;
  destination: string;
  expiresIn: number;
  message: string;
};

/** POST /auth/login → trusted-device branch */
type LoginDirectResponse = {
  success: true;
  requiresOtp?: false;
  data: { user: RawUser; accessToken: string; refreshToken: string };
  trustedDevice: boolean;
  requiresSetup: boolean;
  needsPasswordReset: boolean;
};

export type LoginResult =
  | { kind: 'otp'; tempToken: string; destination: string; expiresIn: number; message: string }
  | { kind: 'authenticated'; accessToken: string; refreshToken: string; needsPasswordReset: boolean; requiresSetup: boolean };

export type RawUser = {
  id: string;
  _id?: string;
  Email?: string;
  email?: string;
  FirstName?: string;
  LastName?: string;
  role: { Name: string; DisplayName: string };
  permissions: string[];
  sellers?: { Id: string; Name: string }[];
  assignedSellers?: string[];
};

export async function login({ email, password }: LoginRequest): Promise<LoginResult> {
  const res = await api.post<LoginOtpResponse | LoginDirectResponse>('/auth/login', {
    email: email.trim().toLowerCase(),
    password,
  });

  if ('requiresOtp' in res && res.requiresOtp) {
    return {
      kind: 'otp',
      tempToken: res.tempToken,
      destination: res.destination,
      expiresIn: res.expiresIn,
      message: res.message,
    };
  }

  const direct = res as LoginDirectResponse;
  return {
    kind: 'authenticated',
    accessToken: direct.data.accessToken,
    refreshToken: direct.data.refreshToken,
    needsPasswordReset: direct.needsPasswordReset,
    requiresSetup: direct.requiresSetup,
  };
}

/** POST /auth/verify-otp — completes the second leg. */
export async function verifyOtp(tempToken: string, code: string) {
  const res = await api.post<LoginDirectResponse>('/auth/verify-otp', { tempToken, code });
  return {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    needsPasswordReset: res.needsPasswordReset,
    requiresSetup: res.requiresSetup,
  };
}

export async function resendOtp(tempToken: string) {
  const res = await api.post<{ message: string; expiresIn: number }>('/auth/resend-otp', { tempToken });
  return res;
}

export async function forgotPassword(email: string) {
  return api.post<{ message: string }>('/auth/forgot-password', { email: email.trim().toLowerCase() });
}

export async function logout() {
  return api.post('/auth/logout');
}

/** GET /auth/me — the authoritative session payload. */
export async function fetchMe(): Promise<RawUser> {
  const res = await api.get<{ success: true; data: RawUser }>('/auth/me');
  return res.data;
}

const ROLE_KEYS: readonly string[] = [
  'admin',
  'operational_manager',
  'Brand Manager',
  'catalog_manager',
  'listing_team',
  'reviewer',
  'viewer',
  'seller_client',
];

// contract-allow: C-02 — scope mode is server-derived account metadata.
// This mirrors backend/controllers/roleController.js, which computes it from
// the role. The correct fix is for /auth/me to return `scope` directly; that
// is tracked as a backend gap (README §6). Until then this is the only place
// that may map a role name to a scope.
function scopeFor(user: RawUser): ScopeMode {
  if (user.role?.Name === 'seller_client') return 'self';
  if (user.role?.Name === 'admin' || user.role?.Name === 'operational_manager') return 'global';
  return 'assigned';
}

/**
 * Normalise the raw user into a Session.
 *
 * NOTE (backend gap, see docs/design/mobile/agents/06-api-screen-mapping.md):
 * both /auth/login and /auth/me return `permissions` straight from
 * RolePermissions, while backend/middleware/auth.js additionally applies each
 * user's ExtraPermissions and ExcludedPermissions. Until that is fixed on the
 * server, this app's nav can disagree with the server for users with custom
 * permission overrides. See apps/mobile/README.md §6.
 */
export function toSession(user: RawUser, tokens: { accessToken: string; refreshToken: string }): Session {
  const name = [user.FirstName, user.LastName].filter(Boolean).join(' ') || user.Email || user.email || 'User';
  return {
    userId: user.id ?? user._id ?? '',
    email: (user.Email ?? user.email ?? '').toLowerCase(),
    displayName: name,
    role: (ROLE_KEYS.includes(user.role?.Name ?? '') ? user.role.Name : 'viewer') as RoleKey,
    permissions: user.permissions ?? [],
    sellerIds: user.assignedSellers ?? (user.sellers ?? []).map((s) => s.Id),
    scope: scopeFor(user),
    token: tokens.accessToken,
    // The JWT is refreshed on 401 rather than pre-emptively; treat it as
    // "valid until the server says otherwise".
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
}
