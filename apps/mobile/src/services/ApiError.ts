/** ApiError — every failure in the app is one of these. Screens branch on `status`. */
export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly payload: unknown;

  constructor(status: number, message: string, path: string, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
    this.payload = payload;
  }

  /** No network / timed out — the offline banner, not a server error. */
  get isOffline(): boolean {
    return this.status === 0;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** 5xx and 0 are the full-screen fatal state; everything else is inline. */
  get isFatal(): boolean {
    return this.status >= 500 || this.status === 0;
  }

  /** Support needs a request id; take it from the body when the API sends one. */
  get requestId(): string | null {
    if (this.payload && typeof this.payload === 'object') {
      const p = this.payload as Record<string, unknown>;
      for (const key of ['requestId', 'request_id', 'traceId', 'correlationId']) {
        if (typeof p[key] === 'string') return p[key] as string;
      }
    }
    return null;
  }
}
