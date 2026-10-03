/**
 * INT-OP-07 · Approval queue
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/09-stitch-prompts-growth-ops.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=internal
 *       permission="tasks_manage"
 *       roleKeys=['reviewer', 'admin']
 * Scope:      all/assigned
 * Critical:   no
 *
 * Required states (§11):
 *   ☐ empty-true
 *   ☐ empty-filtered
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'INT-OP-07',
  name: "Approval queue",
  surface: 'internal',
  permission: "tasks_manage",
  roleKeys: ['reviewer', 'admin'],
  scope: "all/assigned",
  critical: false,
  requiredStates: ['empty-true', 'empty-filtered'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function IntOp07Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <IntOp07Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function IntOp07Content(_props: { data: unknown }) {
  return null;
}
