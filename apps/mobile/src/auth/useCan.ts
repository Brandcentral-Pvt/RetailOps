/** Hooks for the two questions a screen ever asks: am I signed in, may I? */
import { useAuthStore } from './authStore';
import { canAccess, satisfies, permissionSet, type Session, type Surface, type RoleRef } from './permissions';
import { useMemo } from 'react';

export function useSession(): Session | null {
  return useAuthStore((s) => s.session);
}

/**
 * `useCan({ surface, permission, roleKeys })` mirrors one registry entry.
 * Every screen declares its own gate from the screen inventory, so the
 * component tree and the spec cannot diverge.
 */
export function useCan(gate: { surface: Surface; permission: string | null; roleKeys: RoleRef[] }): boolean {
  const session = useSession();
  return useMemo(() => canAccess(session, gate).allowed, [session, gate.surface, gate.permission]);
}

/** Narrow check for a single permission string, e.g. an edit button. */
export function usePermission(permission: string | null | undefined): boolean {
  const session = useSession();
  return useMemo(() => (session ? satisfies(permissionSet(session.permissions), permission) : false), [
    session,
    permission,
  ]);
}
