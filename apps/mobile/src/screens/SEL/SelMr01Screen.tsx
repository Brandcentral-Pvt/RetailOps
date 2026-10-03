/**
 * SEL-MR-01 · Chat with account team
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/11-stitch-prompts-seller.md — seller register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=seller
 *       permission="chat_view"
 *       roleKeys=[] (no role gate)
 * Scope:      own
 * Critical:   YES
 *
 * Required states (§11):
 *   ☐ empty-true
 *   ☐ offline-cached
 *   ☐ conflict
 *   ☐ upload-download
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'SEL-MR-01',
  name: "Chat with account team",
  surface: 'seller',
  permission: "chat_view",
  roleKeys: [],
  scope: "own",
  critical: true,
  requiredStates: ['empty-true', 'offline-cached', 'conflict', 'upload-download'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function SelMr01Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <SelMr01Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function SelMr01Content(_props: { data: unknown }) {
  return null;
}
