// LOCAL patch step for the SEA scraped build (never committed).
// playwright-core resolves browsers.json / package.json with dynamic
// require(path.join(packageRoot, ...)) — SEA forbids requiring files outside
// the snapshot, so we inline both JSONs into the bundle instead.
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node sea-patch.js <bundle.cjs>'); process.exit(1); }

const backendRoot = path.resolve(__dirname, '..', '..');
const browsers = fs.readFileSync(path.join(backendRoot, 'node_modules', 'playwright-core', 'browsers.json'), 'utf8');
const pkgJson = JSON.stringify({ name: 'playwright-core', version: '1.63.0' });

let src = fs.readFileSync(OUT, 'utf8');

const targets = [
    [ /(packageJSON = require\(import_path\d+\.default\.join\(packageRoot, "package\.json"\)\);)/, 'packageJSON = __pw_pkg_json;' ],
    [ /(registry = new Registry\(require\(import_path\d+\.default\.join\(packageRoot, "browsers\.json"\)\)\));/, 'registry = new Registry(__pw_browsers_json);' ],
];

let changed = 0;
for (const [re, replacement] of targets) {
    if (re.test(src)) { src = src.replace(re, replacement); changed++; }
}
if (changed !== targets.length) {
    console.error(`[sea-patch] matched ${changed}/${targets.length} markers — aborting`);
    process.exit(1);
}

const header = [
    '/* [sea-patch] playwright dynamic JSON requires inlined for SEA (local build only). */',
    `var __pw_pkg_json = ${pkgJson};`,
    `var __pw_browsers_json = ${browsers.trim()};`,
    '',
].join('\n');

fs.writeFileSync(OUT, header + src, 'utf8');
console.log(`[sea-patch] patched ${changed} dynamic require(s) in ${OUT}`);