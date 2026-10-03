#!/usr/bin/env node
/**
 * gen-tokens.mjs — compiles docs/design/mobile/02-design-tokens.json into a
 * TypeScript theme module.
 *
 * The JSON token file is the single source of truth. This script is the ONLY
 * thing allowed to write src/theme/tokens.generated.ts, so the app can never
 * carry a colour, size or duration that is not in the design system.
 *
 *   node scripts/gen-tokens.mjs           # write
 *   node scripts/gen-tokens.mjs --check   # fail if the output is stale (CI)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const repoRoot = join(appDir, '..', '..');
const TOKENS = join(repoRoot, 'docs/design/mobile/02-design-tokens.json');
const OUT = join(appDir, 'src/theme/tokens.generated.ts');

const CHECK = process.argv.includes('--check');

if (!existsSync(TOKENS)) {
  console.error(`✗ design tokens not found: ${TOKENS}`);
  process.exit(2);
}

const t = JSON.parse(readFileSync(TOKENS, 'utf8'));

/** Deterministic emitter: the output must be byte-identical across runs. */
const emit = (v, indent = 0) => {
  const pad = '  '.repeat(indent);
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => emit(x, indent)).join(', ')}]`;
  const entries = Object.entries(v).filter(([k]) => !k.startsWith('$'));
  if (entries.length === 0) return '{}';
  const body = entries
    .map(([k, val]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      return `${pad}  ${key}: ${emit(val, indent + 1)},`;
    })
    .join('\n');
  return `{\n${body}\n${pad}}`;
};

const out = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Source:    docs/design/mobile/02-design-tokens.json (version ${t.version})
 * Generator: apps/mobile/scripts/gen-tokens.mjs
 *
 * To change a token, edit the design system file and run \`npm run tokens\`.
 * CI runs \`npm run tokens:check\` and fails if this file is stale.
 *
 * The consistency contract (docs/design/mobile/agents/02-consistency-contract.md)
 * forbids raw values in screen code. Everything visual resolves through here.
 */

export const TOKENS_SOURCE_VERSION = ${JSON.stringify(t.version)};

export const color = ${emit(t.color)} as const;

export const surfaceAccent = ${emit(t.surfaceAccent)} as const;

export const typography = ${emit(t.typography)} as const;

export const shape = ${emit(t.shape)} as const;

export const spacing = ${emit(t.spacing)} as const;

export const component = ${emit(t.component)} as const;

export const motion = ${emit(t.motion)} as const;

export const domain = ${emit(t.domain)} as const;

export const a11y = ${emit(t.a11y)} as const;

export const localization = ${emit(t.localization)} as const;

export type ColorScheme = keyof typeof color;
export type ColorSchemeName = 'light' | 'dark';
`;

if (CHECK) {
  if (!existsSync(OUT)) {
    console.error('✗ tokens.generated.ts is missing — run: npm run tokens');
    process.exit(1);
  }
  const current = readFileSync(OUT, 'utf8');
  if (current !== out) {
    console.error('✗ tokens.generated.ts is stale — run: npm run tokens');
    process.exit(1);
  }
  console.log('✓ tokens.generated.ts is in sync with 02-design-tokens.json');
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out, 'utf8');
console.log(`✓ wrote ${OUT.replace(repoRoot + '/', '')}  (tokens v${t.version})`);
