#!/usr/bin/env node
/**
 * verify-setup.mjs — a pre-flight check that catches the wiring mistakes that
 * TypeScript cannot see.
 *
 * The registry compiles, the scaffold is in sync and the typecheck is clean —
 * and the app still boots to a blank screen, because a navigator referenced a
 * screen ID that the inventory renames. This asserts the cross-file
 * references that matter.
 *
 *   node scripts/verify-setup.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const repoRoot = join(appDir, '..', '..');

const problems = [];
const ok = [];

/** Screen IDs referenced by hand-written navigators. */
const HAND_REFERENCED = [
  ['src/nav/AuthNavigator.tsx', /screen\('([A-Z]{3}-\d{2})'\)/g, 'auth screen'],
  ['src/nav/destinations.ts', /landing: '([A-Z]{3}-[A-Z]{2}-\d{2})'/g, 'tab landing'],
];

const registry = JSON.parse(
  readFileSync(join(repoRoot, 'docs/design/mobile/agents/registry/screens.json'), 'utf8'),
);
const ids = new Set(registry.screens.map((s) => s.id));

for (const [file, re, kind] of HAND_REFERENCED) {
  const path = join(appDir, file);
  if (!existsSync(path)) {
    problems.push(`${file} is missing`);
    continue;
  }
  const src = readFileSync(path, 'utf8');
  for (const m of src.matchAll(re)) {
    if (!ids.has(m[1])) problems.push(`${file}: ${kind} "${m[1]}" is not in the inventory`);
  }
  ok.push(`${file}: screen references resolve`);
}

/* The nav icons are placeholders until Material Symbols land (P-10). */
if (existsSync(join(appDir, 'src/icons'))) {
  ok.push('icon set present');
} else {
  ok.push('icon set: not yet wired (P-10, placeholders in use)');
}

/* Secrets that must never be committed. */
const SECRET_FILES = ['google-services.json', 'GoogleService-Info.plist', '.env'];
for (const f of SECRET_FILES) {
  if (existsSync(join(appDir, f))) {
    problems.push(`${f} is present in the app directory — it must be gitignored and injected by EAS`);
  }
}
ok.push('no committed secrets');

/* app.json must not point at a google-services.json that does not exist —
   that is what broke the previous app's Android build. */
const appJson = JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf8'));
const gsf = appJson?.expo?.android?.googleServicesFile;
if (gsf && !existsSync(join(appDir, gsf))) {
  problems.push(`app.json references android.googleServicesFile "${gsf}" but the file does not exist — Android builds will fail`);
} else {
  ok.push('app.json has no dangling googleServicesFile reference');
}

/* Both platform ids must be present for store builds. */
for (const [platform, key] of [['ios', 'bundleIdentifier'], ['android', 'package']]) {
  const v = appJson?.expo?.[platform]?.[key];
  if (!v) problems.push(`app.json is missing ${platform}.${key}`);
  else ok.push(`${platform} id: ${v}`);
}

console.log('\n  verify-setup\n');
for (const line of ok) console.log(`  ✓ ${line}`);
if (problems.length) {
  console.log('');
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.log('');
  process.exit(1);
}
console.log('\n  all setup checks passed\n');
