import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

// ─── Auth lifecycle routes that must NEVER trigger a silent refresh ───────────
// (a 401 from these means the credentials themselves are bad/expired)
const NO_REFRESH_ROUTES = [
  '/auth/login',
  '/auth/verify-otp',
  '/auth/request-otp',
  '/auth/resend-otp',
  '/auth/logout',
  '/auth/refresh-token',
];

// Storage keys cleared on unrecoverable session expiry — mirrors AuthContext.
const AUTH_STORAGE_KEYS = ['authToken', 'refreshToken', 'user'] as const;

let redirectingToLogin = false;

/** Clear the auth-related storage keys (matches AuthContext key list). */
export function clearAuthStorage(): void {
  AUTH_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  });
}

/** Hard-redirect to /login exactly once (guards against redirect loops). */
export function handleSessionExpired(): void {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  window.location.href = '/login';
}

// ─── Single-flight silent refresh ─────────────────────────────────────────────
let refreshInFlight: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw Object.assign(new Error('No refresh token available'), { fatal: true });
  }

  // Raw fetch — deliberately NOT apiClient, so a failing refresh can never
  // re-enter the 401 handler below (no recursion, no infinite loops).
  const res = await fetch(`${API_BASE}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  // 400/401/403 from the refresh endpoint itself => refresh token is invalid/
  // expired/revoked => the session is unrecoverable.
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('Refresh token rejected'), { fatal: true });
  }
  if (!res.ok) {
    // Transient failure (network glitch, 5xx, 429): keep the session alive,
    // just fail the requests that were waiting on this refresh.
    throw new Error(`Token refresh failed with status ${res.status}`);
  }

  const data = await res.json();
  const accessToken: string | undefined = data?.data?.accessToken;
  if (!accessToken) {
    throw Object.assign(new Error('Malformed refresh-token response'), { fatal: true });
  }

  // Persist under the existing keys (rotation-aware).
  localStorage.setItem('authToken', accessToken);
  if (data?.data?.refreshToken) {
    localStorage.setItem('refreshToken', data.data.refreshToken);
  }
  return accessToken;
}

/**
 * Refresh the access token silently. Single-flight: concurrent 401s share one
 * in-flight promise; later callers queue on the same promise instead of
 * stampeding the refresh endpoint. Resolves with the fresh access token.
 */
export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// Add a response interceptor: 401 -> silent refresh -> replay (GETs only)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isAuthRoute = NO_REFRESH_ROUTES.some((route) => url.includes(route));

    if (status !== 401 || !original || original._retried || isAuthRoute) {
      return Promise.reject(error);
    }

    try {
      const newToken = await refreshAccessToken();

      // React Query safety: mutations are NEVER auto-replayed (would double-fire
      // side effects). They reject with the original 401 so the caller decides
      // whether/how to retry. Only idempotent GETs are transparently replayed.
      if ((original.method ?? 'get').toLowerCase() !== 'get') {
        return Promise.reject(error);
      }

      original._retried = true;
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient.request(original);
    } catch (refreshError) {
      // Unrecoverable refresh => tear the dead session down and go to /login
      // exactly once. Transient failures just propagate the original error.
      if ((refreshError as { fatal?: boolean } | null)?.fatal === true) {
        clearAuthStorage();
        handleSessionExpired();
      }
      return Promise.reject(error);
    }
  }
);
