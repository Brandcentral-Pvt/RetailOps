/**
 * OOS-RECON-001 orphan-import smoke test.
 *
 * The OOS shell, view and registration module are not reachable from the app
 * entry point today, so a normal `vite build` never parses them. This script
 * asks Vite to transform each entry and every local module it imports. That
 * catches syntax errors, unresolved local imports and bad JSX without mounting
 * the React tree or requiring a browser.
 *
 * Run from the project root:
 *   npm run test:oos-imports
 *
 * OOS-003 expects this to fail until OOS-005 through OOS-009 are complete. Keep
 * it wired into CI after those fixes land so the modules cannot become
 * unreachable again.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entries = [
  '/src/modules/tasks/components/SharedTaskShell.jsx',
  '/src/modules/tasks/views/oos/OosTaskView.jsx',
  '/src/modules/tasks/views/oos/index.js',
];

// Matches static imports and re-exports after Vite rewrites local paths.
const importPattern = /(?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function firstUsefulLine(error) {
  const text = String(error?.message ?? error).replace(/\x1b\[[0-9;]*m/g, '');
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /PARSE_ERROR|Failed to resolve import|SyntaxError|Cannot find module|not exported|does not provide an export/.test(line))
    ?? lines[0]
    ?? 'Unknown transform error';
}

const server = await createServer({
  root,
  configFile: join(root, 'vite.config.js'),
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const seen = new Set();
const failures = [];

async function visit(id, importer) {
  if (seen.has(id)) return;
  seen.add(id);

  try {
    const result = await server.transformRequest(id, { ssr: false });
    const code = result?.code ?? '';
    const imports = [...code.matchAll(importPattern)].map((match) => match[1]);

    for (const specifier of imports) {
      if (specifier.startsWith('/src/')) {
        await visit(specifier, id);
      }
    }
  } catch (error) {
    const reason = firstUsefulLine(error);
    failures.push({ id, importer, reason });
    console.error(`FAIL ${id}${importer ? ` (from ${importer})` : ''}`);
    console.error(`     ${reason}`);
  }
}

try {
  for (const entry of entries) {
    await visit(entry);
  }
} finally {
  await server.close();
}

console.log(`\nTransformed ${seen.size} local module(s); ${failures.length} failure(s).`);
if (failures.length > 0) {
  console.error('OOS import smoke test failed. Expected while OOS-005 through OOS-009 are open.');
  process.exit(1);
}
console.log('OOS import smoke test passed.');
