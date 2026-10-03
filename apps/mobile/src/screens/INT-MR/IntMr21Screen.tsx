/**
 * INT-MR-21 · Upload / export queue
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/10-stitch-prompts-more-system.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=internal
 *       permission=null (no permission gate)
 *       roleKeys=['ALL_AUTHENTICATED']
 * Scope:      own
 * Critical:   no
 *
 * Required states (§11):
 *   ☐ upload-download
 *   ☐ error-recovery
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'INT-MR-21',
  name: "Upload / export queue",
  surface: 'internal',
  permission: null,
  roleKeys: ['ALL_AUTHENTICATED'],
  scope: "own",
  critical: false,
  requiredStates: ['upload-download', 'error-recovery'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function IntMr21Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <IntMr21Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function IntMr21Content(_props: { data: unknown }) {
  return null;
}
