import type { ComponentType } from 'react';
import type { RoleRef, ScopeMode, Surface } from '../auth/permissions';

export type ScreenId = string;

export type ScreenMeta = {
  id: ScreenId;
  name: string;
  surface: Surface;
  /** `null` = no permission gate (system screens, shell). */
  permission: string | null;
  roleKeys: RoleRef[];
  scope: string | null;
  critical: boolean;
  requiredStates: string[];
};

export type ScreenEntry = {
  meta: ScreenMeta;
  component: ComponentType<Record<string, never>>;
  route: string;
  group: string;
};

/** What a screen tells the shell about its own load. */
export type ScreenStatus =
  | { kind: 'loading-first' }
  | { kind: 'loading-refresh' }
  | { kind: 'ready'; data: unknown }
  | { kind: 'error'; error: unknown; fatal: boolean }
  | { kind: 'empty-true' }
  | { kind: 'empty-filtered' };

export type Destinations = {
  /** Bottom-nav key, e.g. 'Home' | 'Catalog' | 'More'. */
  tab: string;
  label: string;
  /** A stack route name. */
  route: string;
  icon: string;
  /** Union of permissions; the item shows if the session holds any. */
  permissions: string[];
};
