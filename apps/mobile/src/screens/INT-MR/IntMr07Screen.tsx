/**
 * INT-MR-07 · Conversation
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/10-stitch-prompts-more-system.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=internal
 *       permission="chat_view"
 *       roleKeys=['admin', 'operational_manager', 'Brand Manager', 'catalog_manager', 'listing_team', 'reviewer', 'viewer']
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
  id: 'INT-MR-07',
  name: "Conversation",
  surface: 'internal',
  permission: "chat_view",
  roleKeys: ['admin', 'operational_manager', 'Brand Manager', 'catalog_manager', 'listing_team', 'reviewer', 'viewer'],
  scope: "own",
  critical: true,
  requiredStates: ['empty-true', 'offline-cached', 'conflict', 'upload-download'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function IntMr07Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <IntMr07Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function IntMr07Content(_props: { data: unknown }) {
  return null;
}
