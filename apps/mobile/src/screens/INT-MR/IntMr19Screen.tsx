/**
 * INT-MR-19 · Activity log
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/10-stitch-prompts-more-system.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=internal
 *       permission="activitylogs_view"
 *       roleKeys=['admin', 'operational_manager']
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
  id: 'INT-MR-19',
  name: "Activity log",
  surface: 'internal',
  permission: "activitylogs_view",
  roleKeys: ['admin', 'operational_manager'],
  scope: "all",
  critical: false,
  requiredStates: ['empty-true', 'empty-filtered', 'offline-cached'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function IntMr19Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <IntMr19Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function IntMr19Content(_props: { data: unknown }) {
  return null;
}
