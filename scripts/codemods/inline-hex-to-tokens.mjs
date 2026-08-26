#!/usr/bin/env node
/**
 * Phase 3 codemod: replace raw hex color STRING LITERALS with token refs.
 *
 * Safety model:
 *  - Only replaces when an ENTIRE quoted string is exactly a hex color
 *    ('#64748b' -> 'var(--bc-slate-500)'). Hexes embedded in longer strings
 *    (gradients, SVG data URIs) are counted and left for manual conversion.
 *  - Mapping source: src/styles/tokens.css primitives + legacy aliases.
 *    Exact-case-insensitive match only -> zero visual drift by construction.
 *  - Never touches files under src/CometChat (vendored) or src/styles.
 *
 * Usage:
 *   node scripts/codemods/inline-hex-to-tokens.mjs [--dry] [--embed]
 *
 * --embed: additionally replace mapped hexes INSIDE longer string literals
 *          (gradients etc.). Skips url(...)/data: payloads. Only exact
 *          token-mapped hexes are touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DRY = process.argv.includes('--dry');
const EMBED = process.argv.includes('--embed');

// ── 1. Build hex -> token map from tokens.css ────────────────────────────────
const tokensCss = fs.readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8');
const map = new Map();
const defRe = /^\s*(--[a-zA-Z][\w-]*)\s*:\s*(#[0-9a-fA-F]{6})\s*;/gm;
let m;
while ((m = defRe.exec(tokensCss)) !== null) {
  const hex = m[2].toLowerCase();
  const name = m[1];
  // First definition wins; skip EXCEPTION-marked lines (legacy divergences get
  // mapped through their legacy alias names below instead).
  const lineStart = tokensCss.lastIndexOf('\n', m.index) + 1;
  const lineEnd = tokensCss.indexOf('\n', m.index);
  const line = tokensCss.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  if (/EXCEPTION/.test(line)) continue;
  if (!map.has(hex)) map.set(hex, name);
}

// ── 2. Convert ────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // src/theme feeds antd ConfigProvider tokens & chart configs -> those
      // APIs need REAL color values, var() strings would break computation.
      if (e.name === 'CometChat' || e.name === 'styles' || e.name === 'theme' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(jsx|tsx|ts|js)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(path.join(ROOT, 'src'));
const fullLiteralRe = /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/;
const embedRe = /#[\da-fA-F]{6}\b/g;

let totalReplaced = 0, totalFiles = 0, totalEmbedded = 0;
const unmapped = new Map();
const perFile = [];

for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  const before = src;

  // Count hexes embedded inside longer strings (manual queue).
  const strLits = src.match(/(['"])(?:\\.|(?!\1)[^\\])*\1/g) || [];
  let embedded = 0;
  for (const s of strLits) {
    if (!fullLiteralRe.test(s.slice(1, -1).trim())) {
      const found = s.match(embedRe);
      if (found) {
        embedded += found.length;
        for (const h of found) {
          const k = h.toLowerCase();
          unmapped.set(k, (unmapped.get(k) || 0) + 1);
        }
      }
    }
  }
  totalEmbedded += embedded;

  // Replace FULL hex string literals.
  let count = 0;
  src = src.replace(/(['"])#([\da-fA-F]{3}|[\da-fA-F]{6})\1/g, (full, q, hex) => {
    const tok = map.get('#' + hex.toLowerCase());
    if (!tok) return full;
    count++;
    return `${q}var(${tok})${q}`;
  });

  // --embed: mapped hexes inside longer strings (gradients, shadows).
  // Skips anything that looks like a url()/data: payload.
  if (EMBED) {
    src = src.replace(/(['"])((?:\\.|(?!\1)[^\\])*)\1/g, (full, q, body) => {
      if (!/#[\da-fA-F]{3,6}\b/.test(body)) return full;
      if (/url\s*\(|data:|src\s*=/i.test(body)) return full;
      const next = body.replace(/#([\da-fA-F]{6})\b/g, (h, hex) => {
        const tok = map.get('#' + hex.toLowerCase());
        if (!tok) return h;
        count++;
        return `var(${tok})`;
      });
      return next === body ? full : `${q}${next}${q}`;
    });
  }

  if (count > 0 && !DRY) fs.writeFileSync(f, src);
  if (count > 0) {
    totalReplaced += count;
    totalFiles++;
    perFile.push([path.relative(ROOT, f), count]);
  }
}

perFile.sort((a, b) => b[1] - a[1]);
console.log(DRY ? 'DRY RUN — no files written\n' : '');
console.log(`files changed: ${totalFiles}`);
console.log(`literals replaced: ${totalReplaced}`);
console.log(`hexes left embedded in longer strings (manual): ${totalEmbedded}`);
if (unmapped.size) {
  console.log('\ntop embedded hexes:');
  [...unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([h, c]) => console.log(`  ${String(c).padStart(5)}  ${h}`));
}
console.log('\ntop files:');
perFile.slice(0, 15).forEach(([f, c]) => console.log(`  ${String(c).padStart(5)}  ${f}`));
