/**
 * authStore — the single source of "who is signed in and what may they see".
 *
 * Nothing else in the app keeps an `isAdmin` flag or a role string. Screens
 * read `session` and call `canAccess()` / `satisfies()`.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { api, type AuthTokens } from '../services/apiClient';
import { fetchMe, logout as apiLogout, toSession, type RawUser } from '../services/authService';
import type { Session } from './permissions';

const TOKEN_KEY = 'retailops.tokens';

export type AuthNotice = 'session-expired' | 'password-updated';

type AuthState = {
  session: Session | null;
  /** True until the stored token has been exchanged for an authoritative session. */
  bootstrapping: boolean;
  notice: AuthNotice | null;
  signInWithTokens: (tokens: AuthTokens) => Promise<Session>;
  signOut: () => Promise<void>;
  /** Clear the local session without calling the server (expired/revoked token). */
  clearSession: (notice?: AuthNotice) => Promise<void>;
  bootstrap: () => Promise<void>;
  /** Re-read /auth/me after a role or seller-assignment change. */
  refreshSession: () => Promise<void>;
  consumeNotice: () => void;
};

let cachedTokens: AuthTokens | null = null;
let bootstrapPromise: Promise<void> | null = null;

function validTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.accessToken === 'string'
    && record.accessToken.length > 0
    && (typeof record.refreshToken === 'string' || record.refreshToken === null);
}

async function persist(tokens: AuthTokens | null) {
  cachedTokens = tokens ? { ...tokens } : null;
  try {
    if (!tokens) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // Keep the current launch usable if a device keychain is transiently
    // unavailable. Tokens never fall back to AsyncStorage or plain files.
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const configureApi = (tokens: AuthTokens | null) => {
    api.configure(tokens, {
      onSessionLost: () => {
        void get().clearSession('session-expired');
      },
      onTokensRefreshed: (nextTokens) => {
        // Rotate secure storage before the next cold launch. Do not make the
        // in-flight API request wait on a keychain write, which can be slow on
        // a locked device.
        void persist(nextTokens).catch(() => undefined);
        set((state) => ({
          session: state.session ? { ...state.session, token: nextTokens.accessToken } : null,
        }));
        // RBAC is not token-cached on the device. A successful refresh is a
        // natural point to pull changed permissions/seller assignments.
        void get().refreshSession();
      },
    });
  };

  const clearLocal = async (notice: AuthNotice | undefined) => {
    try {
      await persist(null);
    } finally {
      configureApi(null);
      set({ session: null, bootstrapping: false, notice: notice ?? null });
    }
  };

  const apply = async (tokens: AuthTokens): Promise<Session> => {
    // Configure before /auth/me. The old implementation fetched `/auth/me`
    // first, which meant a brand-new mobile sign-in sent no Bearer header.
    configureApi(tokens);
    const user: RawUser = await fetchMe();
    const activeTokens = api.getTokens() ?? tokens;
    const session = toSession(user, activeTokens);
    await persist(activeTokens);
    configureApi(activeTokens);
    set({ session, bootstrapping: false, notice: null });
    return session;
  };

  return {
    session: null,
    bootstrapping: true,
    notice: null,

    signInWithTokens: apply,

    async signOut() {
      try {
        await apiLogout();
      } catch {
        // A failed logout call must never trap a user in the app.
      } finally {
        await clearLocal(undefined);
      }
    },

    clearSession: clearLocal,

    async bootstrap() {
      if (bootstrapPromise) return bootstrapPromise;
      bootstrapPromise = (async () => {
        try {
          let tokens = cachedTokens;
          if (!tokens) {
            const stored = await SecureStore.getItemAsync(TOKEN_KEY);
            if (stored) {
              const parsed: unknown = JSON.parse(stored);
              tokens = validTokens(parsed) ? parsed : null;
            }
          }
          if (!tokens) {
            configureApi(null);
            set({ session: null, bootstrapping: false });
            return;
          }
          await apply(tokens);
        } catch {
          // Expired, revoked or malformed secure-storage token → clean slate,
          // not a crash or a half-authenticated shell on launch.
          await clearLocal('session-expired');
        } finally {
          bootstrapPromise = null;
        }
      })();
      return bootstrapPromise;
    },

    async refreshSession() {
      const current = cachedTokens ?? api.getTokens();
      if (!current?.accessToken || !get().session) return;
      try {
        const user = await fetchMe();
        const activeTokens = api.getTokens() ?? current;
        await persist(activeTokens);
        set({ session: toSession(user, activeTokens) });
      } catch {
        // A 401 is already handled by apiClient (refresh once, then clear).
        // For transient failures keep the last known permission set rather than
        // unnecessarily logging the user out.
      }
    },

    consumeNotice() {
      set({ notice: null });
    },
  };
});
