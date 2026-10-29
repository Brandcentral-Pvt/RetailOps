// In production the app and API share an origin, so cookies stay first-party
// and response headers such as Retry-After are readable. Local development
// points VITE_API_URL at a remote host, which makes auth cross-origin and hides
// those headers. Route auth through the Vite proxy in dev so it behaves like
// production instead of silently falling back to a default cooldown.
const API_BASE = import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL || '/api';
export const AUTH_REQUEST_TIMEOUT_MS = 30_000;

// Only these messages reach the authentication UI. API response text is used
// to recognize the existing backend's legacy errors, never displayed verbatim.
export const AUTH_MESSAGES = Object.freeze({
  INVALID_CREDENTIALS: 'Your email or password is incorrect.',
  ACCOUNT_LOCKED: 'Your account is temporarily locked. Contact your administrator.',
  ACCESS_RESTRICTED: 'Access to this workspace is unavailable. Contact your administrator.',
  OTP_INVALID: 'The verification code is incorrect. Please try again.',
  OTP_INCOMPLETE: 'Enter all six digits of your verification code.',
  OTP_EXPIRED: 'This verification code has expired. Request a new code.',
  OTP_ATTEMPTS: 'Too many incorrect attempts. Request a new verification code.',
  OTP_DAILY_LIMIT: 'The daily verification limit has been reached. Try again tomorrow or contact your administrator.',
  SESSION_EXPIRED: 'Your sign-in session has expired. Please sign in again.',
  RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
  NETWORK_ERROR: "We couldn't connect to RetailOps. Check your connection and try again.",
  REQUEST_TIMEOUT: 'This is taking longer than expected. Please try again.',
  SERVER_ERROR: 'RetailOps is temporarily unavailable. Please try again shortly.',
});

export class AuthRequestError extends Error {
  constructor(code, { status = 0, retryAfter = 0 } = {}) {
    super(AUTH_MESSAGES[code] || AUTH_MESSAGES.SERVER_ERROR);
    this.name = 'AuthRequestError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function safeAuthError(error) {
  const code = Object.hasOwn(AUTH_MESSAGES, error?.code) ? error.code : 'SERVER_ERROR';
  return { code, message: AUTH_MESSAGES[code], retryAfter: error?.retryAfter || 0 };
}

function responseError(response, data, operation) {
  const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
  const retryHeader = response.headers.get('Retry-After');
  let retryAfter = Number(retryHeader) || 0;
  if (retryHeader && !retryAfter) retryAfter = Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000);
  // Some deployments keep Retry-After out of the CORS-exposed header list, so
  // accept the same value from the JSON body before falling back to a default.
  if (!retryAfter) retryAfter = Number(data?.retryAfter ?? data?.data?.retryAfter) || 0;
  if (!retryAfter) retryAfter = Number(message.match(/wait (\d+) seconds/)?.[1]) || 0;
  retryAfter = Number.isFinite(retryAfter) ? Math.min(86400, Math.max(0, retryAfter)) : 0;

  let code = 'SERVER_ERROR';
  if (response.status >= 500) {
    code = 'SERVER_ERROR';
  } else if (response.status === 423) {
    code = 'ACCOUNT_LOCKED';
  } else if (operation !== 'login' && (data?.code === 'SESSION_EXPIRED' || /session expired|invalid session token|user not found/.test(message))) {
    code = 'SESSION_EXPIRED';
  } else if (response.status === 429) {
    code = message.includes('daily otp limit') ? 'OTP_DAILY_LIMIT' : 'RATE_LIMITED';
    retryAfter = retryAfter || 60;
  } else if (response.status === 403) {
    code = 'ACCESS_RESTRICTED';
  } else if (operation === 'verify-otp') {
    if (/too many incorrect|no more attempts/.test(message)) code = 'OTP_ATTEMPTS';
    else if (/otp expired|code.*expired/.test(message)) code = 'OTP_EXPIRED';
    else if (response.status === 401 || response.status === 400) code = 'OTP_INVALID';
  } else if (operation === 'login' && (response.status === 401 || response.status === 400)) {
    code = 'INVALID_CREDENTIALS';
  }
  return new AuthRequestError(code, { status: response.status, retryAfter });
}

// Tokens now live in httpOnly cookies, so the only proof of a session is the
// user payload plus the success flag. Legacy localStorage tokens are cleared
// on this path so an old browser session cannot keep sending a stale Bearer.
export function hasAuthSession(result) {
  return Boolean(result?.success && result.data?.user);
}

export function storeAuthSession(result) {
  if (!hasAuthSession(result)) throw new AuthRequestError('SERVER_ERROR');
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.setItem('user', JSON.stringify(result.data.user));
}

export async function requestAuthentication(operation, body, { signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AUTH_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/auth/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new AuthRequestError('SERVER_ERROR', { status: response.status });
    }
    if (!response.ok || !data?.success) throw responseError(response, data, operation);
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    return data;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (timedOut) throw new AuthRequestError('REQUEST_TIMEOUT');
    if (error instanceof AuthRequestError) throw error;
    throw new AuthRequestError('NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function maskDestination(destination, fallbackEmail = '') {
  const email = typeof destination === 'string' && destination.includes('@') ? destination : fallbackEmail;
  const at = email.lastIndexOf('@');
  if (at < 1) return 'your work email';
  return `${email[0]}•••••${email.slice(at)}`;
}
