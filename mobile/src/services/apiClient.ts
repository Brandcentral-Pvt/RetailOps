/**
 * Shared axios client for the RetailOps backend.
 *
 * - Injects the Bearer access token on every request.
 * - Serialises concurrent 401s and performs a single refresh-token rotation.
 * - Exposes `setAuthHandlers` so the auth store can wire token persistence and
 *   force-logout without a circular import.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL, API_TIMEOUT, STORAGE_KEYS } from '../config/env';
import { getItem } from './storage';

export interface AuthHandlers {
  /** Called when tokens are rotated so the store can persist them. */
  onTokensRefreshed?: (accessToken: string, refreshToken?: string) => void | Promise<void>;
  /** Called when the refresh fails — the store should clear the session. */
  onUnauthorized?: () => void | Promise<void>;
}

let handlers: AuthHandlers = {};

export function setAuthHandlers(next: AuthHandlers): void {
  handlers = next;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach access token ───────────────────────────────────────────
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getItem(STORAGE_KEYS.accessToken);
  if (token) {
    config.headers.set?.('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ── Response: single-flight refresh on 401 ─────────────────────────────────
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = await getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/refresh-token`,
      { refreshToken },
      { timeout: API_TIMEOUT },
    );
    const tokens = data?.data ?? {};
    const accessToken: string | undefined = tokens.accessToken;
    if (!accessToken) return null;
    await handlers.onTokensRefreshed?.(accessToken, tokens.refreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';

    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh-token') || url.includes('/auth/verify-otp');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      refreshPromise = refreshPromise ?? performRefresh();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      await handlers.onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from any axios error. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (!error.response) return 'Network error. Check your connection.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default apiClient;