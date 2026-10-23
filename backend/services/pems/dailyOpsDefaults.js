/**
 * Loads the Daily Operations Master "sheet leaves this blank" defaults.
 *
 * The sheet is the source of truth for tasks, sub-tasks, SOP text, owners, outputs and priorities.
 * The few operational judgement calls that have no column in the sheet (minutes per brand, due
 * time, per-brand vs shared, on-demand, run days, SLA) live in config/dailyOps.defaults.json so
 * they are editable data instead of constants buried in the importer.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '../../config/dailyOps.defaults.json');

const isCode = (k) => typeof k === 'string' && k.length > 0 && !k.startsWith('_') && !k.startsWith('$');
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * @param {string} [file]  path to a defaults JSON file (same shape as config/dailyOps.defaults.json)
 * @returns {{ base: Object, byCode: Object }} `base` applies to every task (including new Task IDs
 *   that only exist in the sheet); `byCode` holds the per-Task-Code settings.
 */
function loadDailyOpsDefaults(file = DEFAULT_FILE) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`[dailyOpsDefaults] Could not read ${file} (${err.message}) — falling back to sheet values only.`);
    return { base: {}, byCode: {} };
  }
  const base = isObject(raw) && isObject(raw.shared) ? raw.shared : {};
  const source = isObject(raw) && isObject(raw.tasks) ? raw.tasks : (isObject(raw) ? raw : {});
  const byCode = {};
  for (const [code, value] of Object.entries(source)) {
    if (!isCode(code)) continue;
    byCode[code] = isObject(value) ? value : {};
  }
  return { base, byCode };
}

module.exports = { loadDailyOpsDefaults, DEFAULT_FILE };
