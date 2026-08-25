/**
 * Shared minimal HTTP-error handling for the LEGACY fetch stack
 * (src/services/api.js and other raw-fetch services).
 *
 * The modern axios stack (src/lib/api-client.ts) owns 401 / silent-refresh.
 * The legacy stack deliberately does NOT refresh yet — documented follow-up:
 * migrating namespaces onto api-client is the only way refresh can apply
 * globally. This module only normalizes failures into a typed `ApiError`
 * carrying the HTTP status, so callers/UI can branch on `err.status`, and so
 * mixed-stack consumers cannot build infinite retry loops: no layer here ever
 * retries automatically.
 */

export class ApiError extends Error {
  /**
   * @param {string} message  human-readable message (from body or statusText)
   * @param {number|undefined} status  HTTP status code, when known
   * @param {string|undefined} url  request URL, when known
   */
  constructor(message, status, url) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

/**
 * Build an ApiError from a failed fetch Response (body not yet consumed).
 * @param {Response} res
 * @param {string} defaultMessage
 * @returns {Promise<ApiError>}
 */
export async function toApiError(res, defaultMessage = 'Request failed') {
  let errorMsg = defaultMessage;
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const body = await res.json();
      errorMsg = body.error || body.message || errorMsg;
    } else {
      const text = await res.text();
      errorMsg = text
        ? (text.length > 150 ? `${text.substring(0, 150)}...` : text)
        : `HTTP Error ${res.status}: ${res.statusText}`;
    }
  } catch {
    errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
  }
  return new ApiError(errorMsg, res.status, res.url);
}
