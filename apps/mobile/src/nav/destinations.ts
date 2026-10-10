/**
 * The destination registry.
 *
 * Design decision 03 (README §"five decisions"): the registry IS the product.
 * The bottom bar, the rail, the drawer, "More" and search all derive from this
 * one filtered list. A destination is visible iff
 *
 *     surface × permission × scope
 *
 * holds for the current session — the same formula every screen gate uses.
 *
 * Nothing here names a role. A tab disappears because the session lacks the
 * permission, never because a role string failed an `if`.
 */
import { SCREENS, ALL_SCREEN_IDS } from './screenRegistry.generated';
import { satisfies, permissionSet, surfaceOf, type Session, type Surface } from '../auth/permissions';
import type { Destinations, ScreenId } from './types';

/**
 * Tab → the screen-id families that populate it.
 *
 * Matched on the ID prefix rather than `group`, because several tabs share a
 * group: all 26 seller screens are group `SEL`, and `SYS` belongs to both
 * surfaces' "More". Grouping by prefix is what keeps Performance and My
 * Products from each returning the whole seller surface.
 */
type TabSpec = {
  tab: string;
  label: string;
  icon: string;
  surface: Surface;
  /** Screen-ID prefixes owned by this tab, e.g. 'SEL-PF' matches SEL-PF-01. */
  prefixes: string[];
  landing: ScreenId;
};

const INTERNAL_TABS: TabSpec[] = [
  { tab: 'home', label: 'Home', icon: 'home', surface: 'internal', prefixes: ['INT-HM'], landing: 'INT-HM-01' },
  { tab: 'catalog', label: 'Catalog', icon: 'catalog', surface: 'internal', prefixes: ['INT-CT'], landing: 'INT-CT-01' },
  { tab: 'growth', label: 'Growth', icon: 'growth', surface: 'internal', prefixes: ['INT-GR'], landing: 'INT-GR-01' },
  { tab: 'ops', label: 'Ops', icon: 'ops', surface: 'internal', prefixes: ['INT-OP'], landing: 'INT-OP-01' },
  { tab: 'more', label: 'More', icon: 'more', surface: 'internal', prefixes: ['INT-MR', 'SYS'], landing: 'INT-MR-01' },
];

const SELLER_TABS: TabSpec[] = [
  { tab: 'home', label: 'Home', icon: 'home', surface: 'seller', prefixes: ['SEL-HM'], landing: 'SEL-HM-01' },
  { tab: 'performance', label: 'Performance', icon: 'performance', surface: 'seller', prefixes: ['SEL-PF'], landing: 'SEL-PF-01' },
  { tab: 'products', label: 'My Products', icon: 'products', surface: 'seller', prefixes: ['SEL-PR'], landing: 'SEL-PR-01' },
  { tab: 'requests', label: 'Requests', icon: 'requests', surface: 'seller', prefixes: ['SEL-RQ'], landing: 'SEL-RQ-01' },
  { tab: 'more', label: 'More', icon: 'more', surface: 'seller', prefixes: ['SEL-MR', 'SYS'], landing: 'SEL-MR-03' },
];

const TABS = { internal: INTERNAL_TABS, seller: SELLER_TABS } as const;

const ownedBy = (spec: TabSpec, id: ScreenId): boolean =>
  spec.prefixes.some((p) => id === p || id.startsWith(`${p}-`));

const specsFor = (surface: Surface): readonly TabSpec[] => TABS[surface === 'seller' ? 'seller' : 'internal'];

/** Every screen the session may open, given surface and permission. */
export function visibleScreens(session: Session): ScreenId[] {
  const surface = surfaceOf(session);
  const granted = permissionSet(session.permissions);
  return ALL_SCREEN_IDS.filter((id) => {
    const { meta } = SCREENS[id]!;
    if (meta.surface !== 'both' && meta.surface !== surface) return false;
    return satisfies(granted, meta.permission);
  });
}

/**
 * The bottom bar for this session.
 *
 * A tab is shown iff the session can open its landing screen. That means a role
 * with no ads permission never sees the Growth tab at all — there is no
 * disabled tab and there is no tap-into-403.
 *
 * A seller whose landing screen is unreachable falls back to their first
 * reachable tab, so a seller always has somewhere to land.
 */
export function destinationsFor(session: Session | null): Destinations[] {
  if (!session) return [];
  const surface = surfaceOf(session);
  const granted = permissionSet(session.permissions);
  const reachable = new Set(visibleScreens(session));
  const specs = specsFor(surface);

  const usable = specs.filter((spec) => {
    const landing = SCREENS[spec.landing];
    // Unknown landing (registry changed without this map being updated) →
    // fall back to "any owned screen is reachable".
    if (!landing) return [...reachable].some((id) => ownedBy(spec, id));
    return reachable.has(spec.landing);
  });

  const visible = usable.length > 0 ? usable : specs.filter((s) => reachable.has(s.landing));

  return visible.map((spec) => ({
    tab: spec.tab,
    label: spec.label,
    route: SCREENS[spec.landing]!.route,
    icon: spec.icon,
    // Unmet permissions for this tab. An empty list means every screen inside
    // is already reachable with what the session holds.
    permissions: [
      ...new Set(
        ALL_SCREEN_IDS.filter((id) => ownedBy(spec, id)).map((id) => SCREENS[id]!.meta.permission),
      ),
    ].filter((p): p is string => typeof p === 'string' && p.length > 0 && !granted.has(p.toLowerCase())),
  }));
}

/** Screens for a given tab, already filtered for this session. */
export function screensForTab(session: Session, tab: string): ScreenId[] {
  const surface = surfaceOf(session);
  const spec = specsFor(surface).find((s) => s.tab === tab);
  if (!spec) return [];
  const reachable = new Set(visibleScreens(session));
  return ALL_SCREEN_IDS.filter((id) => ownedBy(spec, id) && reachable.has(id));
}

/** Where a session lands after sign-in. Falls back through the visible tabs. */
export function landingFor(session: Session | null): Destinations | null {
  const dests = destinationsFor(session);
  if (dests.length === 0) return null;
  const home = dests.find((d) => d.tab === 'home');
  return home ?? dests[0]!;
}

export const TAB_SPECS = TABS;
