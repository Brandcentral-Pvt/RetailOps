#!/usr/bin/env node
/**
 * build-registry.mjs — compiles the agent-facing screen registry.
 *
 * Joins two sources that already exist in the repo:
 *   1. docs/design/mobile/03-screen-inventory.md   (roles, permission, scope, states)
 *   2. docs/design/mobile/0[89]-*.md, 1[01]-*.md   (the Stitch prompt bodies)
 * against the authoritative role context in
 *   3. docs/design/mobile/agents/registry/roles.json
 *
 * Outputs:
 *   agents/registry/screens.json    — the registry agents consume
 *   agents/reports/registry-report.md — coverage + consistency findings
 *
 * Side effect (opt-in with --write-prompts):
 *   Injects a normalised `Role:` / `Required states:` header into every fenced
 *   prompt block in files 08–11, so each prompt carries its role definition.
 *   Idempotent: re-running replaces an existing header rather than stacking one.
 *
 * Usage:
 *   node docs/design/mobile/agents/tools/build-registry.mjs
 *   node docs/design/mobile/agents/tools/build-registry.mjs --write-prompts
 *   node docs/design/mobile/agents/tools/build-registry.mjs --check   (exit 1 on drift)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(here, '..');
const designDir = join(agentsDir, '..');
const registryDir = join(agentsDir, 'registry');
const reportsDir = join(agentsDir, 'reports');

const args = new Set(process.argv.slice(2));
const WRITE_PROMPTS = args.has('--write-prompts');
const CHECK_ONLY = args.has('--check');

const roles = JSON.parse(readFileSync(join(registryDir, 'roles.json'), 'utf8'));
const inventoryText = readFileSync(join(designDir, '03-screen-inventory.md'), 'utf8');

const PROMPT_FILES = [
  '08-stitch-prompts-auth-home-catalog.md',
  '09-stitch-prompts-growth-ops.md',
  '10-stitch-prompts-more-system.md',
  '11-stitch-prompts-seller.md'
];

const ID_RE = /^[A-Z]+(-[A-Z]+)*-\d+$/;

/** Inventory shorthand letters → canonical state ids (01-design-schema.md §11). */
const stateLetters = {
  L: 'loading-first', E: 'empty-true', F: 'empty-filtered', N: 'no-permission',
  O: 'offline-cached', S: 'stale-partial', X: 'error-recovery', C: 'conflict',
  B: 'selection-bulk', U: 'upload-download'
};

/**
 * Normalise the loose vocabulary used in prompt metadata (`states: ...`) to the
 * same canonical ids, so every prompt states its states identically. Values that
 * are screen-specific (auth flow states) pass through unchanged.
 */
const stateSynonyms = {
  'empty': 'empty-true', 'true-empty': 'empty-true', 'empty (true)': 'empty-true',
  'filtered-empty': 'empty-filtered', 'empty (filtered)': 'empty-filtered',
  'selection': 'selection-bulk', 'selection mode': 'selection-bulk', 'bulk': 'selection-bulk',
  'offline': 'offline-cached', 'offline-cached': 'offline-cached',
  'stale': 'stale-partial', 'stale/partial': 'stale-partial', 'partial': 'stale-partial',
  'error': 'error-recovery', 'errors': 'error-recovery', 'error-recovery': 'error-recovery',
  'loading': 'loading-first', 'loading (first)': 'loading-first',
  'upload': 'upload-download', 'upload progress': 'upload-download',
  'download progress': 'upload-download', 'upload/download': 'upload-download',
  'conflict': 'conflict',
  'idle': 'idle', 'submitting': 'submitting', 'invalid': 'invalid', 'locked': 'locked',
  'rate-limited': 'rate-limited', 'wrong code': 'invalid', 'expired': 'expired',
  'resent': 'resent'
};

const canonicalState = (s) => stateSynonyms[s.trim().toLowerCase()] ?? s.trim();

/* ── 1. Parse the inventory ───────────────────────────────────────────── */

function parseInventory(md) {
  const rows = new Map();
  let cols = null;
  let group = null;

  for (const line of md.split('\n')) {
    const heading = line.match(/^##+ \d*\.?\s*(.+?)\s*\(`([A-Z-]+)`\)/);
    if (heading) { group = heading[2]; continue; }

    if (/^\|\s*ID\s*\|/.test(line)) {
      cols = line.split('|').slice(1, -1).map((c) => c.trim());
      continue;
    }
    if (!cols || !/^\|/.test(line)) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const id = cells[0];
    if (!ID_RE.test(id)) continue;

    const rec = { id, group };
    cols.forEach((c, i) => {
      const v = cells[i];
      if (v === undefined) return;
      if (c === 'ID') return;
      const key = c.toLowerCase()
        .replace(/\s+/g, '-')
        .replace('roles', 'rolesRaw')
        .replace('perm', 'permission');
      rec[key] = v;
    });
    rows.set(id, rec);
  }
  return rows;
}

/* ── 2. Parse the prompt markdown ─────────────────────────────────────── */

function parsePromptFile(file) {
  const path = join(designDir, file);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const found = new Map();

  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^####\s+([A-Z]+(?:-[A-Z]+)*-\d+)\s*·\s*(.+)$/);
    if (!h) continue;

    const id = h[1];
    const critical = h[2].includes('★');
    const name = h[2].replace(/★\s*critical/i, '').trim();

    // metadata line(s) until the fence
    let j = i + 1;
    const metaLines = [];
    while (j < lines.length && !lines[j].startsWith('```')) {
      if (lines[j].trim()) metaLines.push(lines[j].trim());
      j++;
    }
    if (j >= lines.length) continue;

    const fenceStart = j;
    let k = fenceStart + 1;
    const body = [];
    while (k < lines.length && !lines[k].startsWith('```')) { body.push(lines[k]); k++; }
    if (k >= lines.length) continue;

    const metaRaw = metaLines.join(' ');
    found.set(id, {
      id, name, critical, file: basename(file), metaLines, metaRaw,
      kind: (metaRaw.match(/kind:\s*([^·`]+)/) || [])[1]?.trim() ?? null,
      bodyStart: fenceStart + 1,
      bodyEnd: k,
      body
    });
    i = k;
  }
  return { path, text, lines, found };
}

/* ── 3. Join and enrich ───────────────────────────────────────────────── */

const inventory = parseInventory(inventoryText);
const promptFiles = PROMPT_FILES.map(parsePromptFile);
const allPrompts = new Map();
for (const pf of promptFiles) for (const [id, rec] of pf.found) allPrompts.set(id, rec);

function expandRoles(raw) {
  if (!raw) return [];
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const keys = [];
  for (const p of parts) {
    const mapped = roles.abbreviations[p] ?? p;
    if (roles.pseudoRoles[mapped]) {
      const pr = roles.pseudoRoles[mapped];
      if (pr.expandsTo) keys.push(...pr.expandsTo);
      else keys.push(mapped);
    } else {
      keys.push(mapped);
    }
  }
  return [...new Set(keys)];
}

function surfaceFor(inv, promptMeta) {
  if (inv?.surface) return inv.surface;
  if (inv?.group?.startsWith('SEL')) return 'seller';
  if (promptMeta?.metaRaw?.includes('surface: seller')) return 'seller';
  if (inv?.id?.startsWith('SEL')) return 'seller';
  if (inv?.id?.startsWith('AUTH') || inv?.id?.startsWith('SYS')) return 'both';
  return 'internal';
}

function parseStates(inv, promptMeta) {
  const raw = (promptMeta?.metaRaw?.match(/states:\s*([^`·]+)/) || [])[1];
  const list = raw
    ? raw.split(',').map((s) => s.trim())
    : (inv?.states && inv.states !== '—'
        ? inv.states.split(',').map((l) => stateLetters[l.trim()] ?? l.trim())
        : []);
  return [...new Set(list.filter(Boolean).map(canonicalState))];
}

function parsePermission(inv, promptMeta) {
  const raw = (promptMeta?.metaRaw?.match(/perm:\s*([^·`]+)/) || [])[1];
  let perm = raw?.trim() ?? inv?.permission?.replace(/`/g, '').trim() ?? null;
  if (!perm || perm === '—') return null;
  return perm.replace(/\*\*/g, '').trim();
}

/**
 * Build the role header that every prompt carries.
 *
 * Order of truth: explicit inventory roles → surface default. Scope comes from the
 * inventory Scope column (which describes the *data* scope the screen must request)
 * rather than being inferred from role levels, because a global-scope role can still
 * be viewing an assigned-scope screen.
 */
function roleHeader(rec) {
  let roleKeys = rec.roleKeys;
  if (!roleKeys.length && rec.surface === 'seller') roleKeys = ['seller_client'];

  const names = roleKeys
    .map((k) => roles.roles[k]?.displayName ?? roles.pseudoRoles[k]?.promptLabel ?? k)
    .filter(Boolean);

  const label = names.length ? names.join(', ') : 'any signed-in user';
  const audience =
    rec.surface === 'seller' ? 'seller client (paying merchant)' :
    rec.surface === 'both' ? 'both surfaces' :
    'internal RetailOps staff';

  const scopeText = rec.scope && rec.scope !== '—' ? ` Scope: ${rec.scope}.` : '';
  const perm = rec.permission ? ` Permission: ${rec.permission}.` : '';

  const lines = [`Role: ${audience} — ${label}.${scopeText}${perm}`];

  // Screens that ARE a state (error, offline, maintenance) must not be asked for
  // state variants; they get an explicit Kind line instead of a states list.
  if (rec.kind && /state/.test(rec.kind)) {
    lines.push('Kind: state screen — this screen is itself a state. Do not design additional state variants.');
  } else if (rec.states.length) {
    lines.push(`Required states: ${rec.states.join(', ')}.`);
  }
  return lines.join('\n');
}

/**
 * Auxiliary prompts: real prompt specs that are not screens in the inventory
 * (navigation shells, shared overlays). They get a role header and are counted
 * separately so the screen total stays equal to the inventory total.
 */
const AUX_PROMPTS = {
  'X-01': {
    kind: 'navigation-shell',
    name: 'More / navigation drawer',
    roleHeader: [
      'Role: internal RetailOps staff — all internal roles (items are permission-filtered at runtime).',
      'Kind: navigation shell, not a screen. Items shown here are the union across roles; the rendered list must contain only destinations the current permissions allow.'
    ].join('\n')
  }
};

const registry = [];
const findings = [];

for (const [id, inv] of inventory) {
  const p = allPrompts.get(id);
  const surface = surfaceFor(inv, p);
  const roleKeys = expandRoles(inv.rolesRaw);
  const permission = parsePermission(inv, p);
  const states = parseStates(inv, p);

  const rec = {
    id,
    name: p?.name ?? inv.screen ?? id,
    surface,
    group: inv.group ?? null,
    critical: Boolean(p?.critical),
    roleKeys,
    permission,
    scope: inv.scope ?? null,
    states,
    promptFile: p?.file ?? null,
    kind: p?.kind ?? null,
    hasPrompt: Boolean(p?.body?.length)
  };
  rec.roleHeader = roleHeader(rec);
  registry.push(rec);

  if (!p) findings.push({ level: 'error', id, msg: 'No prompt found for inventory screen' });
  else {
    if (!rec.states.length && !rec.kind) {
      findings.push({ level: 'warn', id, msg: 'No states declared in prompt or inventory' });
    }
    if (!rec.permission && !['AUTH', 'SYS'].includes(id.split('-')[0])) {
      findings.push({ level: 'info', id, msg: 'No permission gate (verify this is intentional)' });
    }
  }
}

for (const id of allPrompts.keys()) {
  if (!inventory.has(id) && id !== 'X-01') {
    findings.push({ level: 'error', id, msg: 'Prompt exists with no inventory entry' });
  }
}

registry.sort((a, b) => a.id.localeCompare(b.id));

/* ── 4. Write the registry ────────────────────────────────────────────── */

const out = {
  $schema: './screens.schema.json',
  name: 'retailops.mobile.screens',
  version: '1.0.0',
  generatedBy: 'agents/tools/build-registry.mjs',
  sources: {
    inventory: '03-screen-inventory.md',
    roles: 'agents/registry/roles.json',
    prompts: PROMPT_FILES
  },
  totals: {
    screens: registry.length,
    withPrompt: registry.filter((r) => r.hasPrompt).length,
    critical: registry.filter((r) => r.critical).length,
    internal: registry.filter((r) => r.surface === 'internal').length,
    seller: registry.filter((r) => r.surface === 'seller').length,
    both: registry.filter((r) => r.surface === 'both').length,
    auxiliary: Object.keys(AUX_PROMPTS).length
  },
  auxiliary: Object.entries(AUX_PROMPTS).map(([id, a]) => ({
    id,
    ...a,
    hasPrompt: allPrompts.has(id)
  })),
  screens: registry
};

mkdirSync(registryDir, { recursive: true });
mkdirSync(reportsDir, { recursive: true });

const serialised = JSON.stringify(out, null, 2) + '\n';
const screensPath = join(registryDir, 'screens.json');

if (CHECK_ONLY) {
  let current = '';
  try { current = readFileSync(screensPath, 'utf8'); } catch { /* missing */ }
  if (current !== serialised) {
    console.error('registry drift detected: run `node agents/tools/build-registry.mjs`');
    process.exit(1);
  }
}

/* ── 5. Optionally normalise the prompt files in place ────────────────── */

const HEADER_RE = /^Role: .*$/m;

function injectHeader(body, header) {
  const text = body.join('\n');
  const stripped = text
    .replace(/^Role:[^\n]*\n(?:Kind:[^\n]*\n)?(?:Required states:[^\n]*\n)?/, '')
    .replace(/^\n+/, '');
  return `${header}\n\n${stripped}`;
}

const headerFor = (id) =>
  registry.find((r) => r.id === id)?.roleHeader ?? AUX_PROMPTS[id]?.roleHeader ?? null;

let injected = 0;
if (WRITE_PROMPTS) {
  for (const pf of promptFiles) {
    const lines = [...pf.lines];
    // apply from the bottom so earlier line indexes stay valid
    const records = [...pf.found.values()].sort((a, b) => b.bodyStart - a.bodyStart);
    for (const rec of records) {
      const header = headerFor(rec.id);
      if (!header) continue;
      const newBody = injectHeader(rec.body, header);
      lines.splice(rec.bodyStart, rec.bodyEnd - rec.bodyStart, ...newBody.split('\n'));
      injected++;
    }
    writeFileSync(pf.path, lines.join('\n'), 'utf8');
  }
} else {
  for (const [id, rec] of allPrompts) {
    if (headerFor(id) && !HEADER_RE.test(rec.body.join('\n'))) injected++;
  }
}

writeFileSync(screensPath, serialised, 'utf8');

/* ── 6. Report ────────────────────────────────────────────────────────── */

const bySurface = (s) => registry.filter((r) => r.surface === s).length;
const withStates = registry.filter((r) => r.states.length).length;
const withPerm = registry.filter((r) => r.permission).length;

const report = `# Registry report — RetailOps Android screens

Generated by \`agents/tools/build-registry.mjs\`. Do not edit by hand.

## Coverage

| Metric | Value |
|---|---:|
| Screens in inventory | ${inventory.size} |
| Screens in registry | ${registry.length} |
| With a Stitch prompt | ${registry.filter((r) => r.hasPrompt).length} |
| Critical screens | ${out.totals.critical} |
| Internal surface | ${bySurface('internal')} |
| Seller surface | ${bySurface('seller')} |
| Both surfaces | ${bySurface('both')} |
| With a declared permission gate | ${withPerm} |
| With declared states | ${withStates} |
| Prompts missing a role header | ${injected} |

## Consistency findings

${findings.length ? `| Level | Screen | Finding |\n|---|---|---|\n${findings.map((f) => `| ${f.level} | \`${f.id}\` | ${f.msg} |`).join('\n')}` : 'No findings. Registry is consistent with the inventory.'}

## How agents use this

1. Read \`registry/screens.json\` for the screen you are working on.
2. Use \`roleHeader\` as the first block of the prompt you send to the model.
3. Send the matching fenced block from \`${PROMPT_FILES.join('`, `')}\`.
4. Validate the result with \`tools/validate-screen.mjs\`.
5. Record the outcome in \`agents/state/progress.json\`.
`;

writeFileSync(join(reportsDir, 'registry-report.md'), report, 'utf8');

const errors = findings.filter((f) => f.level === 'error').length;
console.log(`registry: ${registry.length} screens (${out.totals.withPrompt} prompts, ${out.totals.critical} critical)`);
console.log(`  internal ${bySurface('internal')} · seller ${bySurface('seller')} · both ${bySurface('both')}`);
console.log(`  role headers ${WRITE_PROMPTS ? `written to ${injected} prompts` : `missing on ${injected} prompts (run with --write-prompts)`}`);
console.log(`  findings: ${errors} error(s), ${findings.filter((f) => f.level === 'warn').length} warning(s)`);
if (errors) process.exit(1);
