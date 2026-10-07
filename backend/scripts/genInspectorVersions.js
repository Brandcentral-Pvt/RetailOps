/**
 * Generate Live Data Inspector pages for versions v3–v6 from the v2 template.
 *
 * Each version gets its OWN page + its own API endpoint set (/live-data/vN/*)
 * + its own dedicated API credential (see creatorsApiCredentials.js).
 * Re-run this whenever live-data-inspector-v2.html changes:
 *   node scripts/genInspectorVersions.js
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TEMPLATE = path.join(PUBLIC_DIR, 'live-data-inspector-v2.html');
const VERSIONS = [3, 4, 5, 6];

if (!fs.existsSync(TEMPLATE)) {
    console.error(`Template not found: ${TEMPLATE}`);
    process.exit(1);
}

const source = fs.readFileSync(TEMPLATE, 'utf8');

for (const ver of VERSIONS) {
    const key = `v${ver}`;
    const keyUpper = `V${ver}`;
    let html = source;

    // Titles
    html = html.replace('Live Data Inspector v2 — RetailOps', `Live Data Inspector ${keyUpper} — RetailOps`);
    html = html.replace('<div class="header-title">Live Data Inspector v2</div>', `<div class="header-title">Live Data Inspector ${keyUpper}</div>`);
    html = html.replace('Secondary credential — dedicated API key', `${keyUpper} credential — dedicated API key`);

    // Versioned endpoint set
    html = html.split("'/live-data/v2/").join(`'/live-data/${key}/`);
    html = html.split('/live-data/v2/').join(`/live-data/${key}/`);

    // Per-version credential id
    html = html.split("credId: 'secondary'").join(`credId: '${key}'`);
    html = html.split("fd.append('credId', 'secondary')").join(`fd.append('credId', '${key}')`);

    // Isolated local storage + IndexedDB per version
    html = html.replace("const DB_NAME = 'LiveDataInspector';", `const DB_NAME = 'LiveDataInspector${keyUpper}';`);
    html = html.split("'ldi_history'").join(`'ldi_history_${key}'`);

    // Credential status badge in the header (after the storage badge)
    html = html.replace(
        '<span class="header-badge" id="storageBadge" title="IndexedDB storage">',
        `<span class="header-badge" id="credBadge" title="API credential">Cred loading...</span>\n    <span class="header-badge" id="storageBadge" title="IndexedDB storage">`
    );

    // Script to populate the badge + warn when the version is not configured
    const credScript = `
// ---- ${keyUpper} credential status badge ----
async function loadCredBadge() {
  const el = document.getElementById('credBadge');
  try {
    const r = await fetch(API + '/live-data/credentials', { headers: authHeaders() }).then(r => r.json());
    const cred = r.success && r.data ? r.data.find(c => c.id === '${key}') : null;
    if (!cred) { el.textContent = '${keyUpper} (n/a)'; return; }
    if (!cred.configured) {
      el.textContent = '${keyUpper} NOT CONFIGURED';
      el.title = 'Set CREATORS_API_CLIENT_ID_${ver} and CREATORS_API_CLIENT_SECRET_${ver} in the server env to enable ${keyUpper}.';
      setTimeout(function(){ toast('${keyUpper} API credential is not configured on the server', 'warning'); }, 800);
      return;
    }
    el.textContent = '${keyUpper} \\u2022 ' + (cred.clientId || 'key');
    el.classList.add('active');
    el.title = '${keyUpper} \\u2022 ' + (cred.partnerTag || '') + ' \\u2022 ' + (cred.marketplace || '');
  } catch (e) { el.textContent = '${keyUpper} offline'; }
}
loadCredBadge();
`;
    html = html.replace('init();', credScript + '\ninit();');

    const out = path.join(PUBLIC_DIR, `live-data-inspector-${key}.html`);
    fs.writeFileSync(out, html, 'utf8');
    console.log(`Generated ${path.relative(path.join(__dirname, '..'), out)}`);
}

console.log(`Done. Versions: ${VERSIONS.map(v => `v${v}`).join(', ')}`);