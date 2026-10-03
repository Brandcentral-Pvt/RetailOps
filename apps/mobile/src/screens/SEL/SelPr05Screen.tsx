/**
 * SEL-PR-05 · Keyword visibility
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/11-stitch-prompts-seller.md — seller register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=seller
 *       permission="keywords_view"
 *       roleKeys=[] (no role gate)
 * Scope:      own
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
  id: 'SEL-PR-05',
  name: "Keyword visibility",
  surface: 'seller',
  permission: "keywords_view",
  roleKeys: [],
  scope: "own",
  critical: false,
  requiredStates: ['empty-true', 'empty-filtered', 'offline-cached'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function SelPr05Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <SelPr05Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function SelPr05Content(_props: { data: unknown }) {
  return null;
}
