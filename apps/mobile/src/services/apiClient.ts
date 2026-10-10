/**
 * apiClient — the single HTTP egress point.
 *
 * Responsibilities:
 *   - attach the Bearer token (the backend enforces `Authorization: Bearer <jwt>`)
 *   - transparently refresh once on 401, then retry
 *   - atomically notify the auth store when rotated tokens must be persisted
 *   - normalise every error into `ApiError` so screens can show the right state
 *
 * It never knows about roles. Permission decisions live in src/auth/permissions.ts.
 */
import * as SecureStore from 'expo-secure-store';
import { EXPO_PUBLIC_API_TIMEOUT, EXPO_PUBLIC_API_URL } from '../config/env';
import { ApiError } from './ApiError';

const DEVICE_ID_KEY = 'retailops.device-id';

function generateDeviceId(): string {
  const bytes = new Uint8Array(18);
  const randomValues = (globalThis as {
    crypto?: { getRandomValues?: (target: Uint8Array) => Uint8Array };
  }).crypto?.getRandomValues;
  if (randomValues) {
    randomValues(bytes);
    return `mob-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  // Older runtimes without Web Crypto still get a per-installation identifier;
  // it supplements authentication rather than acting as a credential.
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export type AuthTokens = { accessToken: string; refreshToken: string | null };

type SessionCallbacks = {
  onSessionLost?: () => void | Promise<void>;
  onTokensRefreshed?: (tokens: AuthTokens) => void | Promise<void>;
};

type Retrying = RequestInit & {
  __retried?: boolean;
  /** Public endpoints and explicit logout must never start a refresh loop. */
  skipAuthRefresh?: boolean;
};

class ApiClient {
  private baseUrl: string;
  private tokens: AuthTokens | null = null;
  private refreshing: Promise<boolean> | null = null;
  private callbacks: SessionCallbacks = {};
  private deviceId: string | null = null;
  private deviceIdPromise: Promise<string> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  configure(tokens: AuthTokens | null, callbacks: SessionCallbacks = {}) {
    this.tokens = tokens ? { ...tokens } : null;
    // Reset callbacks at the same time as tokens. A failed public sign-in must
    // not invoke an old session's logout handler.
    this.callbacks = callbacks;
  }

  /** A snapshot for the auth store after a token rotation. */
  getTokens(): AuthTokens | null {
    return this.tokens ? { ...this.tokens } : null;
  }

  /**
   * A secure-storage-backed device identifier. It binds a trusted-device token
   * to this installation without making the current network/IP part of a
   * mobile session fingerprint (mobile networks change frequently).
   */
  private async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    if (!this.deviceIdPromise) {
      this.deviceIdPromise = (async () => {
        const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        if (stored && /^[a-z0-9-]{16,128}$/i.test(stored)) {
          this.deviceId = stored;
          return stored;
        }
        // This is an installation identifier, not a credential. The server
        // hashes it before storing it in a token/device record.
        const generated = generateDeviceId();
        try {
          await SecureStore.setItemAsync(DEVICE_ID_KEY, generated, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
        } catch {
          // Requests remain usable for this launch; a later launch will create
          // a replacement identifier if secure storage is unavailable.
        }
        this.deviceId = generated;
        return generated;
      })();
    }
    try {
      return await this.deviceIdPromise;
    } finally {
      this.deviceIdPromise = null;
    }
  }

  get<T>(path: string, init?: Retrying): Promise<T> {
    return this.request<T>('GET', path, init);
  }

  post<T>(path: string, body?: unknown, init?: Retrying): Promise<T> {
    return this.request<T>('POST', path, { ...init, body: JSON.stringify(body ?? {}) });
  }

  put<T>(path: string, body?: unknown, init?: Retrying): Promise<T> {
    return this.request<T>('PUT', path, { ...init, body: JSON.stringify(body ?? {}) });
  }

  patch<T>(path: string, body?: unknown, init?: Retrying): Promise<T> {
    return this.request<T>('PATCH', path, { ...init, body: JSON.stringify(body ?? {}) });
  }

  delete<T>(path: string, init?: Retrying): Promise<T> {
    return this.request<T>('DELETE', path, init);
  }

  private async request<T>(method: string, path: string, init: Retrying = {}): Promise<T> {
    const { __retried = false, skipAuthRefresh = false, signal: callerSignal, ...requestInit } = init;
    const deviceId = await this.getDeviceId();
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, EXPO_PUBLIC_API_TIMEOUT);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...requestInit,
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Platform': 'mobile',
          'X-Device-Id': deviceId,
          ...(this.tokens ? { Authorization: `Bearer ${this.tokens.accessToken}` } : {}),
          ...(requestInit.headers ?? {}),
        },
      });

      if (res.status === 401 && !skipAuthRefresh && !__retried) {
        const refreshed = await this.refresh();
        if (refreshed) return this.request<T>(method, path, { ...init, __retried: true });
        if (this.tokens) void this.callbacks.onSessionLost?.();
        throw new ApiError(401, 'Your session has expired. Please sign in again.', path);
      }

      if (res.status === 204) return undefined as T;

      const text = await res.text();
      const payload = text ? safeParse(text) : null;
      if (!res.ok) {
        throw new ApiError(
          res.status,
          extractMessage(payload) ?? `Request failed (${res.status})`,
          path,
          payload,
          { retryAfter: retryAfterSeconds(res.headers.get('retry-after')) },
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        const message = timedOut ? 'The request timed out. Check your connection.' : 'The request was cancelled.';
        throw new ApiError(0, message, path);
      }
      // Network failure → this is state 8 (offline), not a server error.
      throw new ApiError(0, 'You appear to be offline. Showing the last saved data.', path);
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }
  }

  /** Single-flight refresh: concurrent 401s share one token-rotation call. */
  private refresh(): Promise<boolean> {
    const current = this.tokens;
    if (!current?.refreshToken) return Promise.resolve(false);
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EXPO_PUBLIC_API_TIMEOUT);
      try {
        const deviceId = await this.getDeviceId();
        const res = await fetch(`${this.baseUrl}/auth/refresh-token`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Platform': 'mobile',
            'X-Device-Id': deviceId,
          },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) return false;
        const payload = (await res.json()) as { data?: { accessToken?: unknown; refreshToken?: unknown } };
        const accessToken = payload.data?.accessToken;
        if (typeof accessToken !== 'string' || accessToken.length === 0) return false;
        const refreshToken = typeof payload.data?.refreshToken === 'string'
          ? payload.data.refreshToken
          : current.refreshToken;
        // A logout or a new sign-in can happen while this refresh is in flight.
        // Never let an old response restore an abandoned session.
        if (this.tokens?.refreshToken !== current.refreshToken) return false;
        const next = { accessToken, refreshToken };
        this.tokens = next;
        await this.callbacks.onTokensRefreshed?.({ ...next });
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return null;
}

function retryAfterSeconds(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

export const api = new ApiClient(EXPO_PUBLIC_API_URL);
