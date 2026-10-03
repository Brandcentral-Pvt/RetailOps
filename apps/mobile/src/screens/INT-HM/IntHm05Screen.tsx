/**
 * INT-HM-05 · Alert rule editor
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/08-stitch-prompts-auth-home-catalog.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=internal
 *       permission="rules_manage"
 *       roleKeys=['admin', 'operational_manager']
 * Scope:      all
 * Critical:   no
 *
 * Required states (§11):
 *   ☐ conflict
 *   ☐ error-recovery
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'INT-HM-05',
  name: "Alert rule editor",
  surface: 'internal',
  permission: "rules_manage",
  roleKeys: ['admin', 'operational_manager'],
  scope: "all",
  critical: false,
  requiredStates: ['conflict', 'error-recovery'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function IntHm05Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <IntHm05Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function IntHm05Content(_props: { data: unknown }) {
  return null;
}
