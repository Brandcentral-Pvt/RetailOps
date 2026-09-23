/**
 * Auth store (zustand) — single source of truth for the mobile session.
 *
 * Responsibilities:
 *  - Persist/restore access + refresh tokens and the normalised user.
 *  - Expose permission helpers.
 *  - Wire axios refresh / force-logout callbacks.
 *  - Start authenticated session services after login/bootstrap.
 */

import { create } from 'zustand';

import { STORAGE_KEYS } from '../config/env';

import {
  getItem,
  getJson,
  removeItems,
  setItem,
  setJson,
} from '../services/storage';

import {
  authService,
  // Keep your existing authService import/API.
} from '../services/authService';

import {
  getApiErrorMessage,
  setAuthHandlers,
} from '../services/apiClient';

import {
  connectSocket,
  disconnectSocket,
} from '../services/socketService';

import { useNotificationStore } from './notificationStore';
import { useChatStore } from './chatStore';

import type {
  LoginResponse,
  User,
  VerifyOtpResponse,
} from '../types';

const ADMIN_ROLE_TOKENS = [
  'admin',
  'super_admin',
  'super admin',
  'supert admin',
];

function roleNameOf(user: User | null): string {
  if (!user) return '';

  const raw =
    user.role?.name ||
    user.role?.Name ||
    '';

  return String(raw).toLowerCase();
}

type RawUser = Partial<User> & Record<string, unknown>;

/**
 * Normalise backend user payload.
 */
export function normalizeUser(
  input: User | RawUser,
): User {
  const raw = input as RawUser;

  const firstName =
    (raw.firstName as string) ||
    (raw.FirstName as string) ||
    '';

  const lastName =
    (raw.lastName as string) ||
    (raw.LastName as string) ||
    '';

  const roleRaw = raw.role;

  const role =
    roleRaw && typeof roleRaw === 'object'
      ? {
          ...(roleRaw as object),

          name:
            (roleRaw as Record<string, string>).name ||
            (roleRaw as Record<string, string>).Name,

          displayName:
            (roleRaw as Record<string, string>).displayName ||
            (roleRaw as Record<string, string>).DisplayName ||
            (roleRaw as Record<string, string>).Name,
        }
      : {
          name: String(roleRaw ?? ''),
          displayName: String(roleRaw ?? ''),
        };

  const id =
    (raw.id as string) ||
    (raw._id as string) ||
    '';

  return {
    ...(raw as User),

    id,
    _id: id,

    firstName,
    lastName,

    fullName:
      `${firstName} ${lastName}`.trim(),

    role: role as User['role'],

    permissions:
      Array.isArray(raw.permissions)
        ? (raw.permissions as string[])
        : [],

    phone:
      (raw.phone as string) ||
      (raw.Phone as string) ||
      undefined,

    createdAt:
      (raw.createdAt as string) ||
      (raw.CreatedAt as string) ||
      undefined,

    lastSeen:
      (raw.lastSeen as string) ||
      (raw.LastSeen as string) ||
      undefined,

    passwordChangedAt:
      (raw.passwordChangedAt as string) ||
      (raw.PasswordChangedAt as string) ||
      undefined,

    isFirstLogin:
      (raw.isFirstLogin as boolean) ??
      (raw.IsFirstLogin as boolean) ??
      undefined,

    isActive:
      (raw.isActive as boolean) ??
      (raw.IsActive as boolean) ??
      undefined,
  };
}

interface AuthState {
  user: User | null;

  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoggingIn: boolean;

  error: string | null;

  bootstrap: () => Promise<void>;

  login: (
    email: string,
    password: string,
  ) => Promise<LoginResponse>;

  verifyOtp: (
    tempToken: string,
    otp: string,
    trustDevice?: boolean,
  ) => Promise<VerifyOtpResponse>;

  logout: () => Promise<void>;

  clearError: () => void;

  applyUserUpdate: (
    patch: Partial<User>,
  ) => void;

  hasPermission: (
    name: string,
  ) => boolean;

  hasAnyPermission: (
    names: string[],
  ) => boolean;

  isAdmin: () => boolean;
}

async function persistSession(
  user: User,
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  await setItem(
    STORAGE_KEYS.accessToken,
    accessToken,
  );

  await setJson(
    STORAGE_KEYS.user,
    user,
  );

  if (refreshToken) {
    await setItem(
      STORAGE_KEYS.refreshToken,
      refreshToken,
    );
  }
}

async function clearSession(): Promise<void> {
  await removeItems([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.user,
  ]);
}

let sessionServicesStarted = false;

function startSessionServices(): void {
  if (sessionServicesStarted) {
    return;
  }

  sessionServicesStarted = true;

  connectSocket().catch(() => undefined);

  useNotificationStore
    .getState()
    .init()
    .catch(() => undefined);

  useChatStore
    .getState()
    .init()
    .catch(() => undefined);
}

function stopSessionServices(): void {
  sessionServicesStarted = false;

  useNotificationStore
    .getState()
    .reset();

  useChatStore
    .getState()
    .reset();

  disconnectSocket();
}

export const useAuthStore = create<AuthState>(
  (set, get) => {
    const isRoleAdmin = (): boolean => {
      const name = roleNameOf(get().user);

      return (
        ADMIN_ROLE_TOKENS.includes(name) ||
        name.includes('super')
      );
    };

    const hasPermission = (
      permissionName: string,
    ): boolean => {
      const { user } = get();

      if (!user) {
        return false;
      }

      if (isRoleAdmin()) {
        return true;
      }

      if (
        Array.isArray(user.permissions) &&
        user.permissions.includes(permissionName)
      ) {
        return true;
      }

      if (
        roleNameOf(user) ===
        'operational_manager'
      ) {
        const excluded = [
          'settings_manage',
          'users_view',
          'users_manage',
          'roles_view',
          'roles_manage',
          'apikeys_manage',
        ];

        return !excluded.includes(
          permissionName,
        );
      }

      const rolePermissions = (
        user.role as {
          permissions?: {
            name: string;
          }[];
        } | undefined
      )?.permissions;

      return (
        Array.isArray(rolePermissions) &&
        rolePermissions.some(
          (permission) =>
            permission.name ===
            permissionName,
        )
      );
    };

    /*
     * Configure axios callbacks once when the store
     * module is initialised.
     */
    setAuthHandlers({
      onTokensRefreshed: async (
        accessToken,
        refreshToken,
      ) => {
        await setItem(
          STORAGE_KEYS.accessToken,
          accessToken,
        );

        if (refreshToken) {
          await setItem(
            STORAGE_KEYS.refreshToken,
            refreshToken,
          );
        }
      },

      onUnauthorized: async () => {
        stopSessionServices();

        await clearSession();

        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },
    });

    return {
      user: null,

      isAuthenticated: false,

      isBootstrapping: true,

      isLoggingIn: false,

      error: null,

      bootstrap: async () => {
        try {
          const token = await getItem(
            STORAGE_KEYS.accessToken,
          );

          if (!token) {
            await clearSession();

            stopSessionServices();

            set({
              user: null,
              isAuthenticated: false,
              isBootstrapping: false,
            });

            return;
          }

          /*
           * Hydrate cached user first.
           */
          const cached =
            await getJson<User>(
              STORAGE_KEYS.user,
            );

          if (cached) {
            set({
              user: normalizeUser(cached),
              isAuthenticated: true,
            });
          }

          /*
           * Validate against backend.
           */
          const fresh =
            await authService.getMe();

          const normalized =
            normalizeUser(fresh);

          await setJson(
            STORAGE_KEYS.user,
            normalized,
          );

          set({
            user: normalized,
            isAuthenticated: true,
            isBootstrapping: false,
          });

          startSessionServices();
        } catch {
          stopSessionServices();

          await clearSession();

          set({
            user: null,
            isAuthenticated: false,
            isBootstrapping: false,
          });
        }
      },

      login: async (
        email,
        password,
      ) => {
        set({
          isLoggingIn: true,
          error: null,
        });

        try {
          const result =
            await authService.login(
              email,
              password,
            );

          /*
           * Trusted-device/direct-login flow.
           */
          if (
            result.success &&
            result.data?.accessToken &&
            !result.requiresOtp
          ) {
            const normalized =
              normalizeUser(
                result.data.user,
              );

            await persistSession(
              normalized,
              result.data.accessToken,
              result.data.refreshToken,
            );

            set({
              user: normalized,
              isAuthenticated: true,
            });

            startSessionServices();
          }

          return result;
        } catch (error) {
          const message =
            getApiErrorMessage(
              error,
              'Login failed',
            );

          set({
            error: message,
          });

          return {
            success: false,
            message,
          };
        } finally {
          set({
            isLoggingIn: false,
          });
        }
      },

      verifyOtp: async (
        tempToken,
        otp,
        trustDevice = false,
      ) => {
        set({
          isLoggingIn: true,
          error: null,
        });

        try {
          const result =
            await authService.verifyOtp(
              tempToken,
              otp,
              trustDevice,
            );

          if (
            result.success &&
            result.data?.accessToken
          ) {
            const normalized =
              normalizeUser(
                result.data.user,
              );

            await persistSession(
              normalized,
              result.data.accessToken,
              result.data.refreshToken,
            );

            set({
              user: normalized,
              isAuthenticated: true,
            });

            startSessionServices();
          }

          return result;
        } catch (error) {
          const message =
            getApiErrorMessage(
              error,
              'Verification failed',
            );

          set({
            error: message,
          });

          return {
            success: false,
            message,
          };
        } finally {
          set({
            isLoggingIn: false,
          });
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } catch {
          // Best effort.
        }

        stopSessionServices();

        await clearSession();

        set({
          user: null,
          isAuthenticated: false,
          error: null,
          isBootstrapping: false,
        });
      },

      clearError: () => {
        set({
          error: null,
        });
      },

      applyUserUpdate: (
        patch,
      ) => {
        const current =
          get().user;

        if (!current) {
          return;
        }

        const updated: User = {
          ...current,
          ...patch,

          firstName:
            patch.firstName ??
            current.firstName,

          lastName:
            patch.lastName ??
            current.lastName,

          phone:
            patch.phone ??
            current.phone,

          fullName:
            `${patch.firstName ?? current.firstName} ${
              patch.lastName ?? current.lastName
            }`.trim(),
        };

        set({
          user: updated,
        });

        setJson(
          STORAGE_KEYS.user,
          updated,
        ).catch(() => undefined);
      },

      hasPermission,

      hasAnyPermission: (
        names,
      ) => {
        for (const name of names) {
          if (hasPermission(name)) {
            return true;
          }
        }

        return false;
      },

      isAdmin: isRoleAdmin,
    };
  },
);

export default useAuthStore;