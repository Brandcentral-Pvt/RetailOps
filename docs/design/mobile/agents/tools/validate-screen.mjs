#!/usr/bin/env node
/**
 * validate-screen.mjs — enforces the consistency contract (agents/02-consistency-contract.md).
 *
 * Two modes, auto-detected by file extension:
 *
 *   MARKDOWN PROMPT   a prompt from files 08–11, or a prompt an agent has just written.
 *                     Checks the prompt carries its role block, states and surface rules.
 *
 *   HTML / CSS        a generated screen (e.g. a Stitch export) before it is accepted.
 *                     Checks colours, gradients, radii, type sizes, currency formatting,
 *                     seller-surface language, and navigation shape.
 *
 * Usage:
 *   node agents/tools/validate-screen.mjs --file <path> [--surface internal|seller|both]
 *                                         [--json] [--strict]
 *
 * Exit codes: 0 = no blockers, 1 = at least one blocker.
 *
 * Severity: blocker (fails), major (review), minor (polish).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(here, '..');
const designDir = join(agentsDir, '..');

const argv = process.argv.slice(2);
const get = (flag, fallback = null) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (flag) => argv.includes(flag);

const file = get('--file');
if (!file) {
  console.error('usage: validate-screen.mjs --file <path> [--surface internal|seller|both] [--json] [--strict]');
  process.exit(2);
}

const STRICT = has('--strict');
const AS_JSON = has('--json');

const tokens = JSON.parse(readFileSync(join(designDir, '02-design-tokens.json'), 'utf8'));
const roles = JSON.parse(readFileSync(join(agentsDir, 'registry/roles.json'), 'utf8'));

/* ── Allowed palette, derived from the token file (never hard-coded here) ── */

const palette = new Set();
(function collect(node) {
  if (typeof node === 'string') {
    if (/^#[0-9a-fA-F]{3,8}$/.test(node)) palette.add(node.toLowerCase());
    return;
  }
  if (node && typeof node === 'object') Object.values(node).forEach(collect);
})(tokens);
// Colours that legitimately appear in any web/CSS artifact.
['#fff', '#ffffff', '#000', '#000000', '#ffffff00', 'transparent'].forEach((c) => palette.add(c));

const NAV = roles.surfaces;
const RADII = new Set([0, 4, 8, 12, 16, 28, 999]);
const FORBIDDEN_SELLER = Object.keys(roles.glossary.forbidden)
  .filter((k) => !k.includes(' '))            // skip the prose entry
  .filter((k) => !['GMS', 'ACoS', 'ROAS', 'BSR'].includes(k) || true); // keep, they are glossary terms

const violations = [];
const add = (id, severity, rule, detail, fix) =>
  violations.push({ id, severity, rule, detail, fix });

const text = readFileSync(file, 'utf8');
const ext = extname(file).toLowerCase();
const declaredSurface = get('--surface', null);

/* ═══════════════════════════════════════════════════════════════════════
   MODE 1 — markdown prompt
   ═══════════════════════════════════════════════════════════════════════ */

function validatePrompt(src) {
  const fences = [...src.matchAll(/```\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (!fences.length) {
    add('C-00', 'blocker', 'Prompt body present', 'No fenced prompt block found', 'Wrap the prompt in a ``` fence');
    return;
  }

  let surface = declaredSurface;
  if (!surface) {
    // infer: the file path or the body itself
    if (/seller/i.test(file) || /RetailOps Seller|merchant app/i.test(fences[0])) surface = 'seller';
    else if (/auth|system/i.test(file)) surface = 'both';
    else surface = 'internal';
  }

  // Prompt bodies wrap across lines; flatten so phrase checks are reliable.
  for (const raw of fences) {
    const body = raw.replace(/\s+/g, ' ').trim();
    const noNav = /no navigation bar|no bottom navigation/i.test(body);

    // C-01 role defined
    if (!/^Role:/m.test(body) && !/\bRole: /i.test(body)) {
      add('C-01', 'blocker', 'Role definition', 'Prompt has no `Role:` line', 'Run build-registry.mjs --write-prompts');
    }
    // C-02 states declared
    if (!/Required states: /.test(body) && !/Kind: /.test(body)) {
      add('C-02', 'major', 'States declared', 'Prompt declares no required states', 'Add `Required states:` or justify');
    }
    // C-03 platform + mode stated
    if (!/Android Material 3/i.test(body)) {
      add('C-03', 'major', 'Platform stated', 'Prompt does not say "Android Material 3"', 'Open with the platform phrase');
    }
    // C-04 single screen
    if (!/Design a single/i.test(body)) {
      add('C-04', 'major', 'One screen per prompt', 'Prompt does not say "Design a single ... screen"', 'One screen per prompt');
    }
    // C-05 nav shape
    if (!/Kind: navigation shell/.test(body) && surface !== 'both') {
      const surfaceNav = surface === 'seller' ? NAV.seller.navItems : NAV.internal.navItems;
      const missing = surfaceNav.filter((n) => !new RegExp(`\\b${n}\\b`).test(body));
      if (missing.length && !noNav) {
        add('C-05', 'major', 'Navigation shape', `Nav items not specified: ${missing.join(', ')}`, `State the ${surfaceNav.join(' / ')} bar`);
      }

      // C-06 surface-specific leakage only. "Home" and "More" exist on both
      // surfaces, so they can never be evidence of the wrong bar.
      const shared = NAV.internal.navItems.filter((n) => NAV.seller.navItems.includes(n));
      const wrongNav = (surface === 'seller' ? NAV.internal.navItems : NAV.seller.navItems)
        .filter((n) => !shared.includes(n));
      const navClause = (body.match(/bottom navigation[^.]*\./i) || [''])[0];
      const leaked = wrongNav.filter((n) => new RegExp(`\\b${n}\\b`).test(navClause));
      if (leaked.length) {
        add('C-06', 'blocker', 'Surface navigation', `Wrong surface nav items: ${leaked.join(', ')}`, `Use the ${surface} nav list`);
      }
    }
    // C-07 seller surface must exclude the switcher
    if (surface === 'seller' && /All sellers/.test(body) && !/no seller switcher/i.test(body)) {
      add('C-07', 'blocker', 'Seller scope', '"All sellers" appears on the seller surface', 'Seller is pinned to one account');
    }
    // C-08 negative constraints present
    if (!/no gradients/i.test(body)) {
      add('C-08', 'minor', 'Negative constraints', 'Prompt does not forbid gradients', 'Close with the standard negative constraints');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MODE 2 — generated screen (HTML / CSS)
   ═══════════════════════════════════════════════════════════════════════ */

function validateArtifact(src) {
  let surface = declaredSurface;
  if (!surface) {
    surface = /RetailOps Seller|merchant app/i.test(src) ? 'seller' : 'internal';
  }

  // C-10 no gradients
  if (/linear-gradient|radial-gradient|conic-gradient/i.test(src)) {
    add('C-10', 'blocker', 'No gradients', 'A gradient was found in the artifact', 'Use flat fills from the token palette');
  }
  // C-11 no glassmorphism
  if (/backdrop-filter|blur\(/i.test(src)) {
    add('C-11', 'blocker', 'No glassmorphism', 'backdrop-filter or blur() found', 'Flat surfaces only');
  }
  // C-12 palette compliance
  const hexes = [...new Set((src.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((h) => h.toLowerCase()))];
  const unknown = hexes.filter((h) => !palette.has(h));
  if (unknown.length) {
    add('C-12', STRICT ? 'blocker' : 'major', 'Token palette', `${unknown.length} colour(s) outside the token set: ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}`, 'Use 02-design-tokens.json values, or add the value to the token file');
  }

  // C-13 currency grouping (Indian)
  const westernMoney = src.match(/₹\s?\d{1,3}(?:,\d{3}){2,}/g);
  if (westernMoney) {
    add('C-13', 'blocker', 'Indian digit grouping', `Western grouping found: ${westernMoney.slice(0, 3).join(', ')}`, 'Use ₹1,24,802 not ₹124,802');
  }
  // C-14 wrong currency
  if (/(^|[^A-Za-z])\$\s?\d/.test(src) || /\bUSD\b/.test(src)) {
    add('C-14', 'major', 'Currency symbol', 'Dollar amounts found in an INR product', 'Use ₹ with Indian grouping');
  }

  // C-15 radius scale
  const radii = [...new Set([...src.matchAll(/border-radius:\s*([\d.]+)px/g)].map((m) => Number(m[1])))];
  const badRadii = radii.filter((r) => !RADII.has(r) && r !== 0);
  if (badRadii.length) {
    add('C-15', 'minor', 'Shape scale', `Off-scale radii: ${badRadii.join(', ')}px`, 'Use 4 / 8 / 12 / 16 / 28 / full');
  }

  // C-16 card shadows
  if (/box-shadow:/i.test(src) && !/box-shadow:\s*(none|0\s+0)/i.test(src)) {
    add('C-16', 'minor', 'Flat cards', 'box-shadow found; cards should be flat with a hairline border', 'Remove or reserve shadows for sheets, dialogs and the nav bar');
  }

  // C-17 typography floor
  const sizes = [...src.matchAll(/font-size:\s*([\d.]+)(px|sp|rem)/g)]
    .map((m) => (m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])));
  const tooSmall = [...new Set(sizes.filter((s) => s < 12))];
  if (tooSmall.length) {
    add('C-17', 'major', 'Minimum type size', `Font sizes below 12sp: ${tooSmall.join(', ')}`, 'Nothing below 12sp (schema §15)');
  }

  // C-18 font family
  const families = [...new Set([...src.matchAll(/font-family:\s*([^;\n]+)/g)].map((m) => m[1].trim()))];
  const wrongFamily = families.filter((f) => !/Roboto|system-ui|sans-serif|inherit|var\(/i.test(f));
  if (wrongFamily.length) {
    add('C-18', 'minor', 'Type family', `Unexpected font families: ${wrongFamily.join(' | ')}`, 'Roboto (system sans)');
  }

  // C-19 nav shape in the artifact
  if (surface !== 'both' && !/nav|tab.?bar/i.test(src) === false) { /* noop guard */ }
  const surfaceNav = surface === 'seller' ? NAV.seller.navItems : NAV.internal.navItems;
  const navPresent = surfaceNav.filter((n) => new RegExp(`>\\s*${n}\\s*<|\\b${n}\\b`).test(src));
  if (navPresent.length > 0 && navPresent.length < surfaceNav.length) {
    add('C-19', 'major', 'Navigation shape', `Only ${navPresent.length} of ${surfaceNav.length} nav items found`, `Expected ${surfaceNav.join(' / ')}`);
  }

  // C-20 seller surface language
  if (surface === 'seller') {
    const leaked = FORBIDDEN_SELLER.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(src));
    if (leaked.length) {
      add('C-20', 'blocker', 'Seller language', `Internal jargon on the seller surface: ${leaked.join(', ')}`, `Use: ${leaked.map((t) => roles.glossary.forbidden[t]).join(', ')}`);
    }
    if (/\bAll sellers\b/.test(src) || /seller switcher/i.test(src)) {
      add('C-21', 'blocker', 'Seller scope', 'Seller switcher or "All sellers" present on the seller surface', 'The seller surface is pinned to one account');
    }
    // seller accent
    if (/#1976d2|#1565c0|#2563eb/i.test(src) && !/#0e7490/i.test(src)) {
      add('C-22', 'major', 'Seller accent', 'Internal blue used on the seller surface', 'Seller primary is #0E7490');
    }
  }

  // C-23 internal jargon completeness check is human — flag absence of a status word
  if (/#(b91c1c|dc2626|ef4444)/i.test(src) && !/\b(overdue|breached|failed|danger|error|lost)\b/i.test(src)) {
    add('C-23', 'minor', 'Colour independence', 'A danger colour appears with no status word nearby', 'Pair every status colour with an icon and a word (schema §15)');
  }
}

/* ── Run ──────────────────────────────────────────────────────────────── */

if (ext === '.md') validatePrompt(text);
else validateArtifact(text);

const blockers = violations.filter((v) => v.severity === 'blocker');
const majors = violations.filter((v) => v.severity === 'major');
const minors = violations.filter((v) => v.severity === 'minor');

if (AS_JSON) {
  console.log(JSON.stringify({ file, surface: declaredSurface, violations, summary: { blockers: blockers.length, majors: majors.length, minors: minors.length } }, null, 2));
} else {
  console.log(`validate: ${file}`);
  if (!violations.length) {
    console.log('  ✅ no violations');
  } else {
    for (const v of violations) {
      const mark = v.severity === 'blocker' ? '❌' : v.severity === 'major' ? '⚠️ ' : '•';
      console.log(`  ${mark} ${v.id} ${v.rule}: ${v.detail}`);
      console.log(`      fix: ${v.fix}`);
    }
  }
  console.log(`\n  ${blockers.length} blocker(s) · ${majors.length} major · ${minors.length} minor`);
}

process.exit(blockers.length ? 1 : 0);
