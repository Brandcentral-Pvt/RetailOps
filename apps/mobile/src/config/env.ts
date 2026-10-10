/**
 * Environment. Values are injected at build time by EAS (see eas.json `env`).
 * Local overrides come from apps/mobile/.env, which is gitignored.
 *
 * There is no secret in this app: the API is a Bearer-token service and the
 * token lives in memory + secure storage, never in the bundle.
 */
const raw = (key: string, fallback: string): string => {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
};

export const EXPO_PUBLIC_API_URL = raw('EXPO_PUBLIC_API_URL', 'https://data.brandcentral.in/api');
export const EXPO_PUBLIC_SOCKET_URL = raw('EXPO_PUBLIC_SOCKET_URL', 'https://data.brandcentral.in');
export const EXPO_PUBLIC_API_TIMEOUT = Number(raw('EXPO_PUBLIC_API_TIMEOUT', '30000'));
export const EXPO_PUBLIC_USE_MOCKS = raw('EXPO_PUBLIC_USE_MOCKS', 'false') === 'true';
