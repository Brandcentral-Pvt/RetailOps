#!/usr/bin/env node
/**
 * glProductGroup extractor - Node version of gl_product_group.py
 *
 * Same priority order, same result shape. Use when the scraper pipeline is JS/TS.
 *
 *   node gl_product_group.js page.html
 *   node gl_product_group.js page.html --json
 *   node gl_product_group.js --dir ./html_dump --csv results.csv
 *
 * Verified against real Amazon source: B000G77PF0 -> gl_apparel,
 * B000Q9WILY -> gl_apparel, 0735211299 (book) -> gl_book, B07BK75XKG -> gl_biss.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const PATTERNS = [
  ["p1_view_model", "rhapsodyARIngress JS object literal: glProductGroup: `gl_...`",
    /glProductGroup\s*:\s*["'`]?(gl_[A-Za-z0-9_]+)["'`]?/],
  ["p2_widget_attr", "data-gl-product-group-id attribute",
    /data-gl-product-group-id\s*=\s*["'](gl_[A-Za-z0-9_]+)["']/],
  ["p3_card_attr", "data-gl-product-group attribute",
    /data-gl-product-group\s*=\s*["'](gl_[A-Za-z0-9_]+)["']/],
  ["p4_csa_attr", "data-csa-c-gl clickstream attribute",
    /data-csa-c-gl\s*=\s*["'](gl_[A-Za-z0-9_]+)["']/],
  ["p5_hidden_input", 'hidden input name="productCategory"',
    /name\s*=\s*["']productCategory["'][^>]*?value\s*=\s*["'](gl_[A-Za-z0-9_]+)["']/],
  ["p5b_hidden_input", 'hidden input id="productCategory" (value before name)',
    /value\s*=\s*["'](gl_[A-Za-z0-9_]+)["'][^>]*?name\s*=\s*["']productCategory["']/],
  ["p6_loose", "loose glProductGroup key, unprefixed value normalised",
    /glProductGroup\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/],
];

const WDG = /websiteDisplayGroup\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/;

const BLOCKED_MARKERS = [
  "enter the characters you see below",
  "api-services-support@amazon.com",
  "/errors/validatecaptcha",
  "503 - service unavailable",
  "to discuss automated access to amazon data",
];

const normalise = (v) => {
  const s = String(v).trim().toLowerCase();
  return s.startsWith("gl_") ? s : `gl_${s}`;
};

function extract(html) {
  const allMatches = {};
  for (const [pid, , rx] of PATTERNS) {
    const found = [];
    for (const m of html.matchAll(new RegExp(rx.source, "gi"))) {
      const v = normalise(m[1]);
      if (!found.includes(v)) found.push(v);
    }
    if (found.length) allMatches[pid] = found;
  }

  let value = null;
  let matchedBy = null;
  for (const [pid, desc] of PATTERNS) {
    if (allMatches[pid]) {
      value = allMatches[pid][0];
      matchedBy = `${pid} (${desc})`;
      break;
    }
  }

  // p6 is a looser restatement of the p1 key, so it cannot independently confirm it.
  const sources = {};
  for (const [pid, vals] of Object.entries(allMatches)) {
    if (vals.length === 1 && pid !== "p6_loose") sources[pid] = vals[0];
  }
  const distinct = new Set(Object.values(sources));
  const agreement = !value
    ? "not_found"
    : distinct.size > 1
      ? "conflict"
      : Object.keys(sources).length > 1
        ? "confirmed"
        : "single_source";

  const wdg = html.match(WDG);
  const head = html.slice(0, 6000).toLowerCase();

  return {
    value,
    group: value ? value.slice(3) : null,
    matched_by: matchedBy,
    agreement,
    sources,
    all_matches: allMatches,
    website_display_group: wdg ? wdg[1].toLowerCase() : null,
    blocked: BLOCKED_MARKERS.some((m) => head.includes(m)),
  };
}

function loadHtml(p) {
  const buf = fs.readFileSync(p);
  return p.endsWith(".gz")
    ? zlib.gunzipSync(buf).toString("utf8")
    : buf.toString("utf8");
}

function walkDir(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkDir(full));
    else if (/\.html?$|\.html?\.gz$/.test(e.name)) out.push(full);
  }
  return out.sort();
}

function parseArgs(argv) {
  const opts = { json: false, csv: null, dir: null, positional: [] };
  const takesValue = { "--csv": "csv", "--dir": "dir" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (takesValue[a]) opts[takesValue[a]] = argv[++i] ?? null;
    else if (a.startsWith("--")) throw new Error(`unknown flag: ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const asJson = opts.json;
  const csvOut = opts.csv;
  const dir = opts.dir;
  const positional = opts.positional;

  let files = dir ? walkDir(dir) : positional;
  if (positional.length && !dir) {
    files = positional.flatMap((f) =>
      /[*?[]/.test(f)
        ? fs
            .readdirSync(path.dirname(f) || ".")
            .filter((n) => new RegExp("^" + path.basename(f).replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$").test(n))
            .map((n) => path.join(path.dirname(f) || ".", n))
            .sort()
        : [f]
    );
  }

  if (!files.length) {
    console.error("no input files");
    process.exit(2);
  }

  const rows = files.map((f) => {
    const r = extract(loadHtml(f));
    r.file = f;
    return r;
  });

  if (csvOut) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["file", "glProductGroup", "group", "agreement", "matched_by", "website_display_group", "blocked"].join(","),
      ...rows.map((r) =>
        [r.file, r.value, r.group, r.agreement, r.matched_by, r.website_display_group, r.blocked].map(esc).join(",")
      ),
    ];
    fs.writeFileSync(csvOut, lines.join("\n") + "\n");
    const found = rows.filter((r) => r.value).length;
    console.log(`wrote ${csvOut}: ${found}/${rows.length} resolved`);
    process.exit(found ? 0 : 2);
  }

  if (asJson || rows.length > 1) {
    console.log(JSON.stringify(rows.length > 1 ? rows : rows[0], null, 2));
  } else {
    const r = rows[0];
    if (r.value) console.log(`glProductGroup = ${r.value}   [${r.matched_by}]  (${r.agreement})`);
    else {
      console.log(`glProductGroup not found in ${r.file}${r.blocked ? "  (looks like a bot-check page)" : ""}`);
      process.exit(2);
    }
  }
}

if (require.main === module) main();
module.exports = { extract };