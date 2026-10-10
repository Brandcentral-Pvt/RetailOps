/**
 * AUTH-07 · Security policy consent
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/08-stitch-prompts-auth-home-catalog.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=both
 *       permission=null (no permission gate)
 *       roleKeys=['ALL_AUTHENTICATED']
 * Scope:      n/a
 * Critical:   no
 *
 * Required states (§11):
 *   ☐ idle
 *   ☐ submitting
 *   ☐ error-recovery
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'AUTH-07',
  name: "Security policy consent",
  surface: 'both',
  permission: null,
  roleKeys: ['ALL_AUTHENTICATED'],
  scope: null,
  critical: false,
  requiredStates: ['idle', 'submitting', 'error-recovery'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function Auth07Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <Auth07Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function Auth07Content(_props: { data: unknown }) {
  return null;
}
