/**
 * SYS-06 · Something went wrong
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/10-stitch-prompts-more-system.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=both
 *       permission=null (no permission gate)
 *       roleKeys=[] (no role gate)
 * Scope:      n/a
 * Critical:   no
 *
 * Required states (§11):
 *   ☐ loading-first
 *   ☐ error-recovery   ← terminal state; the other eight do not apply
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'SYS-06',
  name: "Something went wrong",
  surface: 'both',
  permission: null,
  roleKeys: [],
  scope: null,
  critical: false,
  requiredStates: [],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function Sys06Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <Sys06Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function Sys06Content(_props: { data: unknown }) {
  return null;
}
