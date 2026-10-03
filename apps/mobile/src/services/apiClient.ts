/**
 * apiClient — the single HTTP egress point.
 *
 * Responsibilities:
 *   - attach the Bearer token (the backend enforces `Authorization: Bearer <jwt>`)
 *   - transparently refresh once on 401, then retry
 *   - normalise every error into `ApiError` so screens can show state 5/6
 *
 * It never knows about roles. Permission decisions live in src/auth/permissions.ts.
 */
import { EXPO_PUBLIC_API_URL, EXPO_PUBLIC_API_TIMEOUT } from '../config/env';
import { ApiError } from './ApiError';

type Tokens = { accessToken: string; refreshToken: string | null };

type Retrying = RequestInit & { __retried?: boolean };

class ApiClient {
  private baseUrl: string;
  private tokens: Tokens | null = null;
  private refreshing: Promise<boolean> | null = null;
  private onSessionLost: (() => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  configure(tokens: Tokens | null, onSessionLost?: () => void) {
    this.tokens = tokens;
    if (onSessionLost) this.onSessionLost = onSessionLost;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXPO_PUBLIC_API_TIMEOUT);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.tokens ? { Authorization: `Bearer ${this.tokens.accessToken}` } : {}),
          ...(init.headers ?? {}),
        },
      });

      if (res.status === 401 && !init.__retried) {
        const refreshed = await this.refresh();
        if (refreshed) return this.request<T>(method, path, { ...init, __retried: true });
        this.onSessionLost?.();
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
        );
      }
      return payload as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(0, 'The request timed out. Check your connection.', path);
      }
      // Network failure → this is state 8 (offline), not a server error.
      throw new ApiError(0, 'You appear to be offline. Showing the last saved data.', path);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Single-flight refresh: concurrent 401s share one refresh call. */
  private refresh(): Promise<boolean> {
    const current = this.tokens;
    if (!current?.refreshToken) return Promise.resolve(false);
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) return false;
        const payload = (await res.json()) as { data?: { accessToken?: string; refreshToken?: string } };
        const accessToken = payload.data?.accessToken;
        if (!accessToken) return false;
        this.tokens = { accessToken, refreshToken: payload.data?.refreshToken ?? current.refreshToken };
        return true;
      } catch {
        return false;
      } finally {
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
    return { message: text };
  }
}

function extractMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const m = (payload as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return null;
}

export const api = new ApiClient(EXPO_PUBLIC_API_URL);
