/**
 * Runtime configuration for the RetailOps mobile app.
 *
 * Values come from Expo public env vars (EXPO_PUBLIC_*) so they can be set in
 * `.env` / EAS build profiles without leaking secrets (only EXPO_PUBLIC_* is
 * embedded in the client bundle — never put secrets here).
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function readEnv(key: string, fallback: string): string {
  const fromProcess = (process.env as Record<string, string | undefined>)[key];
  const fromExtra = extra[key];
  if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return fallback;
}

/** Backend REST base URL (must include the `/api` prefix). */
export const API_BASE_URL = readEnv('EXPO_PUBLIC_API_URL', 'https://data.brandcentral.in/api');

/** Socket.IO server origin (no `/api`). */
export const SOCKET_URL = readEnv('EXPO_PUBLIC_SOCKET_URL', 'https://data.brandcentral.in');

/** Request timeout (ms) for the shared axios client. */
export const API_TIMEOUT = Number(readEnv('EXPO_PUBLIC_API_TIMEOUT', '30000'));

/** AsyncStorage keys (namespaced to avoid collisions). */
export const STORAGE_KEYS = {
  accessToken: '@retailops/accessToken',
  refreshToken: '@retailops/refreshToken',
  user: '@retailops/user',
} as const;

export const APP_CONFIG = {
  name: 'RetailOps',
  version: (Constants.expoConfig?.version as string) ?? '1.0.0',
  supportEmail: 'developer@brandcentral.in',
} as const;