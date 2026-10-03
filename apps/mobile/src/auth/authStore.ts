/**
 * authStore — the single source of "who is signed in and what may they see".
 *
 * Nothing else in the app keeps an `isAdmin` flag or a role string. Screens
 * read `session` and call `canAccess()` / `satisfies()`.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/apiClient';
import { fetchMe, logout as apiLogout, toSession, type RawUser } from '../services/authService';
import type { Session } from './permissions';

const TOKEN_KEY = 'retailops.tokens';

type Tokens = { accessToken: string; refreshToken: string };

type AuthState = {
  session: Session | null;
  /** True until the stored token has been exchanged for a session. */
  bootstrapping: boolean;
  signInWithTokens: (tokens: Tokens) => Promise<Session>;
  signOut: () => Promise<void>;
  bootstrap: () => Promise<void>;
  /** Re-read /auth/me — call after a role or seller-assignment change. */
  refreshSession: () => Promise<void>;
};

let cachedTokens: Tokens | null = null;

async function persist(tokens: Tokens | null) {
  cachedTokens = tokens;
  if (!tokens) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export const useAuthStore = create<AuthState>((set, get) => {
  const apply = async (tokens: Tokens) => {
    const user: RawUser = await fetchMe();
    const session = toSession(user, tokens);
    await persist(tokens);
    api.configure(tokens, () => void get().signOut());
    set({ session, bootstrapping: false });
    return session;
  };

  return {
    session: null,
    bootstrapping: true,

    signInWithTokens: apply,

    async signOut() {
      try {
        await apiLogout();
      } catch {
        // A failed logout call must never trap the user in the app.
      }
      await persist(null);
      api.configure(null);
      set({ session: null, bootstrapping: false });
    },

    async bootstrap() {
      try {
        let tokens = cachedTokens;
        if (!tokens) {
          const stored = await SecureStore.getItemAsync(TOKEN_KEY);
          tokens = stored ? (JSON.parse(stored) as Tokens) : null;
        }
        if (!tokens) {
          set({ session: null, bootstrapping: false });
          return;
        }
        await apply(tokens);
      } catch {
        // Expired or revoked token → clean slate, not a crash on launch.
        await persist(null);
        api.configure(null);
        set({ session: null, bootstrapping: false });
      }
    },

    async refreshSession() {
      const { session } = get();
      if (!session) return;
      const tokens = { accessToken: session.token, refreshToken: '' };
      try {
        const user = await fetchMe();
        set({ session: toSession(user, tokens) });
      } catch {
        // Keep the previous session; the next request will 401 and sign out.
      }
    },
  };
});
