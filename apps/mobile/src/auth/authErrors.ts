import { ApiError } from '../services/ApiError';

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'account-locked'
  | 'access-restricted'
  | 'otp-invalid'
  | 'otp-expired'
  | 'otp-attempts'
  | 'session-expired'
  | 'rate-limited'
  | 'current-password'
  | 'password-policy'
  | 'network'
  | 'timeout'
  | 'server';

export type AuthError = { code: AuthErrorCode; message: string; retryAfter: number | null };

const COPY: Record<AuthErrorCode, string> = {
  'invalid-credentials': 'Your email or password is incorrect.',
  'account-locked': 'Your account is temporarily locked. Contact your administrator.',
  'access-restricted': 'Access to this workspace is unavailable. Contact your administrator.',
  'otp-invalid': 'The verification code is incorrect. Please try again.',
  'otp-expired': 'This verification code has expired. Request a new code.',
  'otp-attempts': 'Too many incorrect codes. Request a new verification code.',
  'session-expired': 'Your sign-in session has expired. Please sign in again.',
  'rate-limited': 'Too many attempts. Please wait before trying again.',
  'current-password': 'Your current password is incorrect.',
  'password-policy': 'Choose a different password and try again.',
  network: "We couldn't connect to RetailOps. Check your connection and try again.",
  timeout: 'This is taking longer than expected. Please try again.',
  server: 'RetailOps is temporarily unavailable. Please try again shortly.',
};

/**
 * Authentication errors are deliberately mapped to a small safe vocabulary.
 * Backend text is used only to classify legacy responses — never rendered — so
 * SQL details, token failures and account metadata cannot leak into the UI.
 */
export function authErrorFor(error: unknown, operation: 'login' | 'otp' | 'resend' | 'password' = 'login'): AuthError {
  if (!(error instanceof ApiError)) return { code: 'server', message: COPY.server, retryAfter: null };
  const sourceMessage = payloadMessage(error.payload).toLowerCase();
  const retryAfter = error.retryAfter ?? (error.status === 429 ? 60 : null);

  if (error.status === 0) {
    const code: AuthErrorCode = /timed out/i.test(error.message) ? 'timeout' : 'network';
    return { code, message: COPY[code], retryAfter: null };
  }
  if (error.status >= 500) return { code: 'server', message: COPY.server, retryAfter: null };
  if (error.status === 423) return { code: 'account-locked', message: COPY['account-locked'], retryAfter: null };
  if (error.status === 429) return { code: 'rate-limited', message: COPY['rate-limited'], retryAfter };
  if (error.status === 403) return { code: 'access-restricted', message: COPY['access-restricted'], retryAfter: null };

  if (operation !== 'login') {
    if (error.code === 'SESSION_EXPIRED' || /session expired|invalid session token|user not found/.test(sourceMessage)) {
      return { code: 'session-expired', message: COPY['session-expired'], retryAfter: null };
    }
    if (operation === 'password' && error.status === 400) {
      const code: AuthErrorCode = /current password/.test(sourceMessage) ? 'current-password' : 'password-policy';
      return { code, message: COPY[code], retryAfter: null };
    }
    if (/too many incorrect|no more attempts/.test(sourceMessage)) {
      return { code: 'otp-attempts', message: COPY['otp-attempts'], retryAfter: null };
    }
    if (/otp expired|code.*expired/.test(sourceMessage)) {
      return { code: 'otp-expired', message: COPY['otp-expired'], retryAfter: null };
    }
    if (error.status === 400 || error.status === 401) {
      return { code: 'otp-invalid', message: COPY['otp-invalid'], retryAfter: null };
    }
  }

  if (operation === 'login' && (error.status === 400 || error.status === 401)) {
    return { code: 'invalid-credentials', message: COPY['invalid-credentials'], retryAfter: null };
  }

  return { code: 'server', message: COPY.server, retryAfter: null };
}

export function authCopy(code: AuthErrorCode): string {
  return COPY[code];
}

export function maskDestination(destination: string | undefined, fallbackEmail: string): string {
  const email = destination && destination.includes('@') ? destination : fallbackEmail;
  const at = email.lastIndexOf('@');
  if (at < 1) return 'your work email';
  return `${email.slice(0, 1)}•••••${email.slice(at)}`;
}

function payloadMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const message = (payload as Record<string, unknown>).message;
  return typeof message === 'string' ? message : '';
}
