/**
 * PermissionGate — declarative access control.
 *
 * A screen wraps its content once, declaring the same gate the screen
 * inventory declares. The gate renders the 403 state instead of the content
 * when access is refused, so there is never a "dead tab" (schema §11 state 7).
 */
import React from 'react';
import { useCan } from './useCan';
import type { RoleRef, Surface } from './permissions';
import { NoAccess } from '../components/states';

type GateProps = {
  surface: Surface;
  permission?: string | null;
  roleKeys?: RoleRef[];
  /** Human name of the module, shown in the refusal copy. */
  module: string;
  children: React.ReactNode;
  /** Custom refusal, for the rarer cases. */
  fallback?: React.ReactNode;
};

export function PermissionGate({
  surface,
  permission = null,
  roleKeys = [],
  module,
  children,
  fallback,
}: GateProps) {
  const allowed = useCan({ surface, permission, roleKeys });
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <NoAccess module={module} />}</>;
}

/**
 * Inline variant for a single control (an edit, an export, a bulk action).
 * Renders nothing rather than a disabled control, so the UI never offers an
 * action that will 403.
 */
export function PermissionGateText({
  permission,
  children,
}: {
  permission: string | null | undefined;
  children: React.ReactNode;
}) {
  const session = useCan({ surface: 'both', permission: permission ?? null, roleKeys: [] });
  return session ? <>{children}</> : null;
}
