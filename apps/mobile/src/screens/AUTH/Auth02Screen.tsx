/**
 * AUTH-02 · Sign in
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
 * Critical:   YES
 *
 * Required states (§11):
 *   ☐ idle
 *   ☐ submitting
 *   ☐ invalid
 *   ☐ locked
 *   ☐ rate-limited
 *   ☐ offline-cached
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'AUTH-02',
  name: "Sign in",
  surface: 'both',
  permission: null,
  roleKeys: ['ALL_AUTHENTICATED'],
  scope: null,
  critical: true,
  requiredStates: ['idle', 'submitting', 'invalid', 'locked', 'rate-limited', 'offline-cached'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function Auth02Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <Auth02Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function Auth02Content(_props: { data: unknown }) {
  return null;
}
