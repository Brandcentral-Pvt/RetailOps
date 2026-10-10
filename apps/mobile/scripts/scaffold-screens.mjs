#!/usr/bin/env node
/**
 * scaffold-screens.mjs — generates the app's screen tree from the design
 * system registry.
 *
 * The screen inventory (docs/design/mobile/03-screen-inventory.md) is the
 * source of truth for what screens exist, who may see them, and which states
 * they must handle. This script is the only thing allowed to write:
 *
 *   src/screens/<GROUP>/*Screen.tsx   140 screen modules
 *   src/nav/screenRegistry.generated.ts  the typed screen table + route map
 *
 * Re-run after any inventory change. CI runs `--check` and fails on drift, so
 * a spec change can never silently diverge from the app.
 *
 *   node scripts/scaffold-screens.mjs           # write
 *   node scripts/scaffold-screens.mjs --check   # fail if stale (CI)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const repoRoot = join(appDir, '..', '..');
const REGISTRY = join(repoRoot, 'docs/design/mobile/agents/registry/screens.json');
const SCREENS_DIR = join(appDir, 'src/screens');
const REGISTRY_OUT = join(appDir, 'src/nav/screenRegistry.generated.ts');

const CHECK = process.argv.includes('--check');

if (!existsSync(REGISTRY)) {
  console.error(`✗ screen registry not found: ${REGISTRY}`);
  process.exit(2);
}

const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const screens = reg.screens;

/* ── Normalisation ─────────────────────────────────────────────────────────
 * The inventory uses both long and abbreviated surface labels. Collapse them
 * so the app has exactly one vocabulary. See README §6 "Known registry debt".
 * ------------------------------------------------------------------------ */
const SURFACE_ALIAS = { int: 'internal', sel: 'seller', internal: 'internal', seller: 'seller', both: 'both' };
const normaliseSurface = (s) => {
  const v = SURFACE_ALIAS[s];
  if (!v) throw new Error(`screen has unknown surface "${s}"`);
  return v;
};

/** INT-HM-01 → IntHm01 · SEL-MR-04 → SelMr04 */
const toIdent = (id) =>
  id
    .split('-')
    .map((part, i) => (i === 0 || part.length <= 2 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part.toLowerCase()))
    .join('');

const toComponentName = (id) => `${toIdent(id)}Screen`;
const toRouteName = (id) => toIdent(id);

/* ── Collision guard ───────────────────────────────────────────────────────
 * Two screen IDs that normalise to the same component name would produce one
 * file that silently overwrites the other. Fail at generate time rather than
 * shipping 139 screens and calling it 140.
 * -------------------------------------------------------------------------- */
{
  const seen = new Map();
  const clashes = [];
  for (const s of screens) {
    const name = toComponentName(s.id);
    if (seen.has(name)) clashes.push(`${seen.get(name)} and ${s.id} both generate ${name}`);
    else seen.set(name, s.id);
  }
  if (clashes.length) {
    console.error('✗ screen ID collision in the registry:\n  ' + clashes.join('\n  '));
    process.exit(1);
  }
}

/* ── Screen module ──────────────────────────────────────────────────────── */

function screenSource(s) {
  const surface = normaliseSurface(s.surface);
  const ident = toIdent(s.id);
  const component = toComponentName(s.id);
  const states = s.states ?? [];
  const roleKeys = s.roleKeys ?? [];

  const gateComment = [
    ` * Gate: surface=${surface}`,
    ` *       permission=${s.permission ? `"${s.permission}"` : 'null (no permission gate)'}`,
    ` *       roleKeys=${roleKeys.length ? `[${roleKeys.map((r) => `'${r}'`).join(', ')}]` : '[] (no role gate)'}`,
  ].join('\n');

  const stateLines = states.length
    ? states.map((st) => ` *   ☐ ${st}`).join('\n')
    : ' *   ☐ loading-first\n *   ☐ error-recovery   ← terminal state; the other eight do not apply';

  return `/**
 * ${s.id} · ${s.name}
 *
 * ⚠ AUTO-GENERATED SCAFFOLD — generated from the design system registry.
 *   Registry:   docs/design/mobile/agents/registry/screens.json (v${reg.version})
 *   Inventory:  docs/design/mobile/03-screen-inventory.md${s.promptFile ? `\n *   Prompt:    docs/design/mobile/${s.promptFile} — ${s.promptFile.startsWith('11') ? 'seller register' : 'internal register'}` : ''}
 *
 * Do not add a screen by hand: edit the inventory and run \`npm run scaffold\`.
 *
${gateComment}
 * Scope:      ${s.scope ?? 'n/a'}
 * Critical:   ${s.critical ? 'YES' : 'no'}
 *
 * Required states (§11):
${stateLines}
 */
import React from 'react';
import { ScreenShell } from '../../components/ScreenShell';
import type { ScreenMeta } from '../../nav/types';
import { useScreenData } from '../../hooks/useScreenData';

export const meta: ScreenMeta = {
  id: '${s.id}',
  name: ${JSON.stringify(s.name)},
  surface: '${surface}',
  permission: ${s.permission ? JSON.stringify(s.permission) : 'null'},
  roleKeys: [${roleKeys.map((r) => `'${r}'`).join(', ')}],
  scope: ${s.scope ? JSON.stringify(s.scope) : 'null'},
  critical: ${s.critical},
  requiredStates: [${states.map((st) => `'${st}'`).join(', ')}],
};

/** TODO(owner): wire the real endpoint. See docs/design/mobile/06-api-screen-mapping.md */
export const endpoint = null as string | null;

export default function ${component}() {
  const { status, error, data, retry } = useScreenData<unknown>(endpoint);

  return (
    <ScreenShell meta={meta} state={status} error={error} onRetry={retry}>
      {(ready) => (
        <${ident}Content data={ready} />
      )}
    </ScreenShell>
  );
}

/** Replace this with the real layout. It must satisfy every state listed above. */
function ${ident}Content(_props: { data: unknown }) {
  return null;
}
`;
}

/* ── Screen registry module ─────────────────────────────────────────────── */

function registrySource() {
  const rows = screens
    .map((s) => {
      const surface = normaliseSurface(s.surface);
      const ident = toIdent(s.id);
      const states = s.states ?? [];
      return `  '${s.id}': {
    meta: {
      id: '${s.id}',
      name: ${JSON.stringify(s.name)},
      surface: '${surface}',
      permission: ${s.permission ? JSON.stringify(s.permission) : 'null'},
      roleKeys: [${(s.roleKeys ?? []).map((r) => `'${r}'`).join(', ')}],
      scope: ${s.scope ? JSON.stringify(s.scope) : 'null'},
      critical: ${s.critical},
      requiredStates: [${states.map((st) => `'${st}'`).join(', ')}],
    },
    component: ${toComponentName(s.id)},
    route: '${toRouteName(s.id)}',
    group: '${s.group}',
  },`;
    })
    .join('\n');

  const imports = [...new Set(screens.map((s) => s.group))]
    .sort()
    .flatMap((g) =>
      screens
        .filter((s) => s.group === g)
        .map((s) => `import ${toComponentName(s.id)} from '../screens/${g}/${toComponentName(s.id)}';`),
    )
    .join('\n');

  return `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * The screen table is compiled from docs/design/mobile/agents/registry/screens.json
 * (version ${reg.version}) by apps/mobile/scripts/scaffold-screens.mjs.
 *
 * ${screens.length} screens. The navigation shell, the permission gate and the
 * consistency validator all read from THIS file, so a screen cannot exist in
 * the app without existing in the design system.
 *
 * Regenerate:  npm run scaffold
 * Verify:      npm run scaffold:check
 */
import type { ScreenMeta, ScreenEntry, ScreenId } from './types';

${imports}

export const SCREENS: Record<ScreenId, ScreenEntry> = {
${rows}
};

export const ALL_SCREEN_IDS = Object.keys(SCREENS) as ScreenId[];

export const CRITICAL_SCREEN_IDS = ALL_SCREEN_IDS.filter((id) => SCREENS[id]!.meta.critical);

export function getScreen(id: ScreenId): ScreenEntry {
  const entry = SCREENS[id];
  if (!entry) throw new Error(\`Unknown screen id "\${id}" — it is not in the design system registry.\`);
  return entry;
}
`;
}

/* ── Emit ───────────────────────────────────────────────────────────────── */

const written = [];
const wanted = new Set();

for (const group of [...new Set(screens.map((s) => s.group))].sort()) {
  const dir = join(SCREENS_DIR, group);
  for (const s of screens.filter((x) => x.group === group)) {
    const file = join(dir, `${toComponentName(s.id)}.tsx`);
    wanted.add(file);
    written.push({ file, content: screenSource(s) });
  }
}

written.push({ file: REGISTRY_OUT, content: registrySource() });

if (CHECK) {
  const stale = [];
  const missing = [];
  for (const { file, content } of written) {
    if (!existsSync(file)) {
      missing.push(file.replace(appDir + '/', ''));
    } else if (readFileSync(file, 'utf8') !== content) {
      stale.push(file.replace(appDir + '/', ''));
    }
  }
  // Orphans: files that no registry entry generates any more.
  const orphans = [];
  if (existsSync(SCREENS_DIR)) {
    for (const g of readdirSync(SCREENS_DIR, { withFileTypes: true })) {
      if (!g.isDirectory()) continue;
      for (const f of readdirSync(join(SCREENS_DIR, g.name))) {
        const p = join(SCREENS_DIR, g.name, f);
        if (!wanted.has(p)) orphans.push(`src/screens/${g.name}/${f}`);
      }
    }
  }

  if (missing.length || stale.length || orphans.length) {
    if (missing.length) console.error(`✗ ${missing.length} missing — run: npm run scaffold\n  ${missing.slice(0, 5).join('\n  ')}`);
    if (stale.length) console.error(`✗ ${stale.length} stale — run: npm run scaffold\n  ${stale.slice(0, 5).join('\n  ')}`);
    if (orphans.length) console.error(`✗ ${orphans.length} orphaned screen file(s) not in the registry:\n  ${orphans.slice(0, 5).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✓ ${screens.length} screens in sync with the design registry`);
  process.exit(0);
}

for (const { file, content } of written) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

const critical = screens.filter((s) => s.critical).length;
console.log(`✓ scaffolded ${screens.length} screens across ${new Set(screens.map((s) => s.group)).size} groups (${critical} critical)`);
console.log(`  ${written.length} files written`);
