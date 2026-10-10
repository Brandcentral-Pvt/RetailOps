#!/usr/bin/env node
/**
 * lint-contract.mjs — enforces the design system's consistency contract against
 * the app's own source.
 *
 * The design-system validator (docs/design/mobile/agents/tools/validate-screen.mjs)
 * checks prompts and generated HTML/CSS. This checks the hand-written React
 * Native, where the same rules can be broken just as easily.
 *
 *   node scripts/lint-contract.mjs           # human output
 *   node scripts/lint-contract.mjs --json    # CI
 *
 * Severity: blocker (fails CI) · major (review).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const SRC = join(appDir, 'src');

/** Generated code is exempt — it is the translation of the token file. */
const EXEMPT = ['src/theme/tokens.generated.ts', 'src/nav/screenRegistry.generated.ts'];

const findings = [];
const add = (file, rule, severity, message) => findings.push({ file, rule, severity, message });

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const ROLES = ['admin', 'operational_manager', 'Brand Manager', 'catalog_manager', 'listing_team', 'reviewer', 'viewer', 'seller_client'];

for (const abs of walk(SRC)) {
  const rel = relative(appDir, abs);
  if (EXEMPT.includes(rel)) continue;

  const src = readFileSync(abs, 'utf8');
  const lines = src.split('\n');

  // Strip line and block comments so prose in a docblock is never a finding.
  const code = lines
    .map((l) => l.replace(/^\s*(\/\/|\*|\/\*).*$/, ''))
    .join('\n');

  // C-04 · token-only styling. A raw hex outside the generated token file is
  // how palette drift enters an app.
  const hex = [...code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)];
  if (hex.length) {
    const uniq = [...new Set(hex.map((m) => m[0]))];
    add(rel, 'C-04', 'blocker', `raw colour literal(s) ${uniq.join(', ')} — read from useTheme().c instead`);
  }

  // C-05 · no gradients anywhere in the product UI.
  if (/linearGradient|expo-linear-gradient|\bradialGradient\b/i.test(code)) {
    add(rel, 'C-05', 'blocker', 'gradient used — the design system forbids gradients');
  }

  // C-02 · no role-name branching. Visibility is permission-based.
  //
  // A role test is only legitimate where the DESIGN SYSTEM itself is defined
  // by role — i.e. determining which surface an account is on. Those sites
  // carry an inline `contract-allow: C-02` with a reason, and this list
  // records the reasoning so the exception is auditable rather than invisible.
  const ALLOW_C02 = new Set([
    // Surface membership is an account TYPE, not a capability. There is no
    // permission that means "you are a merchant" — the seller surface is
    // defined by holding the seller_client role. See roles.json pseudoRoles.
    'src/auth/permissions.ts',
    // Scope mode mirrors backend/controllers/roleController.js, which derives
    // it server-side. The app should read it from the API instead — tracked
    // as a backend gap; see README §6.
    'src/services/authService.ts',
  ]);
  for (const role of ROLES) {
    const re = new RegExp(`(===|!==|==)\\s*['"]${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g');
    if (re.test(code) && !ALLOW_C02.has(rel)) {
      add(rel, 'C-02', 'major', `branches on the role name "${role}" — branch on a permission instead`);
    }
  }

  // C-11 · Indian digit grouping for money. ₹1,23,456 not ₹123,456.
  // Flag a rupee amount grouped the western way (₹1,234,567).
  const badMoney = [...code.matchAll(/₹\s?\d{1,3}(?:,\d{3}){2,}/g)];
  if (badMoney.length) {
    add(rel, 'C-11', 'major', `western digit grouping in an amount (${badMoney[0][0]}) — use toINR() from utils/formatters`);
  }

  // C-07 · touch targets. A pressable smaller than the a11y minimum.
  if (/hitSlop=\{?0\}?/.test(code)) {
    add(rel, 'C-07', 'major', 'hitSlop={0} — the a11y minimum touch target is 48dp');
  }

  // C-09 · reduced motion. An animation without a reduced-motion path.
  if (/Animated\.(timing|spring|loop)\(/.test(code) && !/useReducedMotion/.test(code) && !/Skeleton\.tsx/.test(rel)) {
    add(rel, 'C-09', 'major', 'animation without a reduced-motion path — call useReducedMotion()');
  }
}

const blockers = findings.filter((f) => f.severity === 'blocker');
const majors = findings.filter((f) => f.severity === 'major');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings, blockers: blockers.length, majors: majors.length }, null, 2));
} else {
  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  if (findings.length === 0) {
    console.log(`✓ consistency contract: clean across the app source`);
  } else {
    console.log(`\n  consistency contract\n`);
    for (const [rule, list] of [...byRule.entries()].sort()) {
      console.log(`  ${rule} — ${list.length} finding(s)`);
      for (const f of list.slice(0, 8)) console.log(`    [${f.severity}] ${f.file}\n        ${f.message}`);
      if (list.length > 8) console.log(`    … ${list.length - 8} more`);
      console.log('');
    }
  }
  console.log(`  ${blockers.length} blocker(s) · ${majors.length} major\n`);
}

process.exit(blockers.length > 0 ? 1 : 0);
