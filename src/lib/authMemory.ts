/**
 * In-memory refresh-token store.
 *
 * SECURITY: The 7-day refresh token must NOT live in localStorage (XSS-stealable).
 * It is now delivered as an httpOnly cookie (`retailops_rt`) by the backend and
 * persists across reloads that way. This module holds the token only for the
 * lifetime of the SPA session so legacy code paths (api.js authApi) keep working.
 *
 * Migration: if a legacy session still has `refreshToken` in localStorage, the
 * first get() moves it into memory and deletes the storage key immediately.
 */

let inMemoryRefreshToken: string | null = null;

export function setRefreshToken(token: string | null | undefined): void {
  inMemoryRefreshToken = typeof token === 'string' && token.length > 0 ? token : null;
}

export function clearRefreshToken(): void {
  inMemoryRefreshToken = null;
}

export function getRefreshToken(): string | null {
  // One-time migration from legacy localStorage sessions.
  if (!inMemoryRefreshToken) {
    try {
      const legacy = localStorage.getItem('refreshToken');
      if (legacy) {
        inMemoryRefreshToken = legacy;
        localStorage.removeItem('refreshToken');
      }
    } catch {
      /* storage unavailable */
    }
  }
  return inMemoryRefreshToken;
}
