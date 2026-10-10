/**
 * INT-GR-05 · Ads — import workbook
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v1.0.0)
 *   Inventory:  docs/design/mobile/03-screen-inventory.md
 *   Prompt:    docs/design/mobile/09-stitch-prompts-growth-ops.md — internal register
 *
 * Do not add a screen by hand: edit the inventory and run `npm run scaffold`.
 *
 * Gate: surface=internal
 *       permission="adsreport_import"
 *       roleKeys=['admin', 'operational_manager']
 * Scope:      all/assigned
 * Critical:   no
 *
 * Required states (§11):
 *   ☐ upload-download
 *   ☐ conflict
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: 'INT-GR-05',
  name: "Ads — import workbook",
  surface: 'internal',
  permission: "adsreport_import",
  roleKeys: ['admin', 'operational_manager'],
  scope: "all/assigned",
  critical: false,
  requiredStates: ['upload-download', 'conflict'],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function IntGr05Screen() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <IntGr05Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function IntGr05Content(_props: { data: unknown }) {
  return null;
}
