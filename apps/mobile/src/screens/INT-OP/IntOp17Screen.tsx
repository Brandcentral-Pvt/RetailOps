/**
 * INT-OP-17 · Scheduled runs
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/09-stitch-prompts-growth-ops.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=internal
 *       permission="scraping_view"
 *       roleKeys=['admin', 'operational_manager', 'Brand Manager', 'catalog_manager', 'listing_team', 'reviewer', 'viewer']
 * Scope:      all
 * Critical:   no
 *
 * Required states (§11):
 *   ☐ empty-true
 *   ☐ empty-filtered
 *   ☐ offline-cached
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'INT-OP-17',
  name: "Scheduled runs",
  surface: 'internal',
  permission: "scraping_view",
  roleKeys: ['admin', 'operational_manager', 'Brand Manager', 'catalog_manager', 'listing_team', 'reviewer', 'viewer'],
  scope: "all",
  critical: false,
  requiredStates: ['empty-true', 'empty-filtered', 'offline-cached'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function IntOp17Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <IntOp17Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function IntOp17Content(_props: { data: unknown }) {
  return null;
}
