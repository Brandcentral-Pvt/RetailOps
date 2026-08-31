import { isAxiosError } from 'axios';

/**
 * Legacy-stack compatibility shims — Increment 1 of the HTTP-stack unification.
 *
 * Namespaces in `src/services/api.js` historically:
 *   1. Resolved to the FULL `{ success, data, ... }` response body (callers read
 *      `res.success`, `res.data`, `res.unreadCount`, `res.pagination`, ...) — never
 *      an unwrapped payload; and
 *   2. Rejected with a plain `Error(message)` (never an AxiosError), so call sites
 *      can rely on `.catch(e => e.message)`.
 *
 * The helpers below preserve both contracts on top of `apiClient`, letting migrated
 * namespaces gain the Bearer auto-inject + single-flight silent-refresh 401 flow
 * without touching a single call site.
 *
 * DELETE THIS FILE when `services/api.js` is fully retired.
 */

/**
 * Response envelope every legacy namespace resolved with. Backend-specific extra
 * keys (`unreadCount`, `pagination`, `total`, `stats`, ...) ride along here.
 */
export interface ApiEnvelope<TData = unknown> {
  success: boolean;
  data?: TData;
  message?: string;
  [key: string]: unknown;
}

/**
 * Convert any rejection into the plain `Error` the legacy fetch stack threw.
 *
 * Message precedence: response-body `message` → caller-supplied legacy default
 * (the static string the old code threw) → `Request failed: <statusText>` (the
 * old generic-client wording) → axios/network message → generic fallback.
 */
export function toLegacyError(error: unknown, fallbackMessage?: string): Error {
  if (isAxiosError(error)) {
    const body = error.response?.data as { message?: string } | string | undefined;
    const bodyMessage = typeof body === 'string' ? undefined : body?.message;
    const statusText = error.response?.statusText;
    const message =
      bodyMessage ||
      fallbackMessage ||
      (statusText ? `Request failed: ${statusText}` : '') ||
      error.message ||
      'Request failed';
    return new Error(message);
  }
  if (error instanceof Error) return error;
  return new Error(fallbackMessage || 'Request failed');
}

/**
 * Run an apiClient request under the legacy contract: resolve with the full
 * response body (the `{ success, data, ... }` envelope), reject with a plain
 * `Error` carrying the legacy-compatible message.
 */
export async function legacyRequest<TData = unknown>(
  run: () => Promise<{ data: ApiEnvelope<TData> }>,
  fallbackMessage?: string
): Promise<ApiEnvelope<TData>> {
  try {
    const response = await run();
    return response.data;
  } catch (error) {
    throw toLegacyError(error, fallbackMessage);
  }
}
