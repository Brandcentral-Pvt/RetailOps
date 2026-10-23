/**
 * Daily Operations Master → PEMS task templates.  PURE (no I/O) — unit tested.
 *
 * Input : the sheet as an array of rows (array of cell arrays) — what xlsx `sheet_to_json(ws,{header:1})` gives.
 * Output: { templates[], warnings[] } where each template is ready for `createTemplate`/`updateTemplate`
 *         plus routine fields (autoAssign, dueTime, runDays, owner).
 *
 * Nothing in here is hardcoded to one dataset: the sheet drives tasks, sub-tasks, SOP text, owners,
 * outputs, priorities and (when the columns are filled) frequency, TAT and SLA. Values the sheet
 * leaves blank (estimate, due time, which tasks are on-demand) come from config/dailyOps.defaults.json
 * — editable data, overridable per import — and every one of them can still be changed in the
 * import preview before anything is saved.
 */
const { inferSchedule, describeSchedule, parseHHmm, DEFAULT_DUE_TIME } = require('./routineSchedule');
const { loadDailyOpsDefaults } = require('./dailyOpsDefaults');

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (s) => String(s == null ? '' : s).replace(/\r/g, '').trim();

/**
 * P1 → HIGH, P2 → MEDIUM, P3/P4 → LOW.
 * CRITICAL is intentionally never produced: My Day treats it as an emergency and would push everything else down.
 */
const PRIORITY_MAP = { P1: 'HIGH', P2: 'MEDIUM', P3: 'LOW', P4: 'LOW' };

/**
 * The blank-cell judgement calls, loaded from config/dailyOps.defaults.json (data, not code).
 *   minutes : per BRAND when brand=true (a person's estimate = minutes × number of brands), otherwise per person per day
 *   brand   : true → one task per person with a checklist of that person's brands; false → brand-independent
 *   onDemand: not generated daily (need-driven work)
 * `base` applies to every task, including Task IDs that only exist in the sheet.
 * Overridable per call: parseDailyOpsSheet(rows, { defaults }) — a defaults file or a flat code map.
 */
const SHIPPED_DEFAULTS = loadDailyOpsDefaults();

/** Accepts a defaults file ({ base, byCode }) or a flat { 'DLY-001': {…} } map. */
function normaliseDefaults(input) {
  if (!input) return { base: {}, byCode: {} };
  if (input.base || input.byCode) return { base: input.base || {}, byCode: input.byCode || {} };
  return { base: {}, byCode: input };
}

/** Backwards-compatible flat view of the shipped defaults (shared settings folded into each code). */
const TASK_DEFAULTS = Object.fromEntries(
  Object.keys(SHIPPED_DEFAULTS.byCode).map((code) => [code, { ...SHIPPED_DEFAULTS.base, ...SHIPPED_DEFAULTS.byCode[code] }]),
);

/**
 * Rough effort for a routine with no estimate in the defaults file: base + per sub-task, capped.
 * The numbers come from the defaults file (`shared.estimate`) so they can be tuned without code.
 */
function estimateFromSubTasks(subTaskCount, rule) {
  const base = Number(rule && rule.baseMinutes) || 15;
  const per = Number(rule && rule.perSubTaskMinutes) || 10;
  const max = Number(rule && rule.maxMinutes) || 120;
  return Math.min(max, base + per * subTaskCount);
}

/**
 * Free text from the sheet's "Frequency" column → PEMS frequency enum. First match wins.
 */
const FREQUENCY_RULES = [
  [/\b(on[\s-]?demand|need[\s-]?(based|driven)|as required|when required|whenever|ad[\s-]?hoc|management assigned)\b/i, 'ONE_TIME'],
  [/\b(twice|2\s*x|bi)\s*(a|per)?\s*week|fortnight/i, 'BI_WEEKLY'],
  [/\b(weekly|every\s+week|each\s+week)\b/i, 'WEEKLY'],
  [/\b(monthly|every\s+month|each\s+month)\b/i, 'MONTHLY'],
  [/\bquarter/i, 'QUARTERLY'],
  [/\b(half[\s-]?year|semi[\s-]?annual)/i, 'HALF_YEARLY'],
  [/\b(yearly|annual|every\s+year)\b/i, 'YEARLY'],
  [/\b(daily|every\s+day|each\s+day)\b/i, 'DAILY'],
];
/** null = column blank or unrecognised — the caller then falls back to the sheet/defaults, never invents one. */
function mapFrequency(text) {
  const t = clean(text);
  if (!t) return null;
  for (const [re, value] of FREQUENCY_RULES) if (re.test(t)) return value;
  return null;
}

/**
 * "8", "8 hrs", "8 hours" → 8. Day/week/month wording is rejected rather than converted, so a
 * column that means something else never silently becomes a wrong SLA.
 */
function parseHours(text) {
  const t = clean(text);
  if (!t) return null;
  if (/\b(day|days|week|weeks|month|months|min|minute|minutes)\b/i.test(t)) return null;
  const m = /(\d+(?:\.\d+)?)/.exec(t);
  if (!m) return null;
  const n = Math.round(Number(m[1]));
  return n > 0 && n <= 8760 ? n : null;
}

const CATEGORY_RULES = [
  [/\bads?\b|adbrew|advertis/i, 'ADS'],
  [/buy\s*box|asp|price|pricing/i, 'PRICING'],
  [/catalog|listing/i, 'LISTING'],
  [/oos|inventory|stock|order|\bpo\b|purchase/i, 'INVENTORY'],
  [/gms|report|performance|analysis|analytics|sales/i, 'ANALYTICS'],
  [/ticket|complian|suppress/i, 'COMPLIANCE'],
];
const inferCategory = (s) => { for (const [re, c] of CATEGORY_RULES) if (re.test(s)) return c; return 'GENERAL'; };

const HEADER_KEYS = {
  seq: 'seq', taskid: 'taskId', priority: 'priority', maintask: 'mainTask', subtaskno: 'subNo',
  subtask: 'subTask', howtoperform: 'how', function: 'fn', team: 'team', owner: 'owner',
  expectedoutput: 'output', supportperson: 'supportPerson', supportdocument: 'supportDoc',
  frequency: 'frequency', trigger: 'trigger', target: 'target', tat: 'tat', sla: 'sla',
};

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).map(norm);
    if (cells.includes('taskid') && cells.includes('maintask')) {
      const map = {};
      cells.forEach((c, idx) => {
        // exact match first; "How to Perform - Execute (SOP Steps)" etc. match by prefix
        const key = HEADER_KEYS[c] || (c.startsWith('howtoperform') ? 'how' : c.startsWith('expectedoutput') ? 'output' : null);
        if (key && map[key] === undefined) map[key] = idx;
      });
      return { index: i, map };
    }
  }
  return null;
}

/** "BM" → brand managers; "TL-Chintan, Jay, Anjali" → named people; anything else → role brand_manager with a warning. */
function parseOwner(tag) {
  const t = clean(tag);
  if (!t) return { kind: 'role', role: 'brand_manager', label: 'BM', names: [] };
  if (/^bm$/i.test(t) || /^brand\s*managers?$/i.test(t)) return { kind: 'role', role: 'brand_manager', label: 'BM', names: [] };
  const m = /^tl\b[\s\-:–]*(.*)$/i.exec(t);
  if (m) {
    const names = m[1].split(/[,&/]|\band\b/i).map(s => s.trim()).filter(Boolean);
    return { kind: names.length ? 'people' : 'role', role: 'operational_manager', label: t, names };
  }
  return { kind: 'role', role: 'brand_manager', label: t, names: [], unknown: true };
}

const BULLET = /^\s*(?:[-•*▪●◦]|\d{1,2}\s*[.)])\s*(.+)$/;
const SUBBULLET = /^\s*o\s+/;
const PARENT = /^\s*(?:[-•*▪●◦]\s*)?((?:task|step)\s*\d{1,2}\s*[:.\-–)]?\s*.*)$/i;
const ALTERNATIVE = /\b(method\s*\d|backup|back-up|when to use|alternatively|option\s*\d|either)\b/i;
const GENERIC_LEAD = /^(discuss|record|review|identify|include|compare|calculate|check|includes?)\b[^.]{0,20}:?\s*$/i;

const cut = (t, n = 140) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const stripColon = (t) => t.replace(/[:\s]+$/, '');

/**
 * "Tick outcomes, not clicks."
 * A sub-task is the unit people complete. Its SOP text is shown as "How?" instructions. Only two structures become
 * separate tickable activities:
 *   1. parent-labelled groups  ("Task 1: …", "Step 2: …" — at least two), children stay in the instructions
 *   2. headed sections         (a heading line followed by a list — at least two headings)
 * Alternatives (Method 1/2, Option 1/2, backup) and everything else stay ONE activity carrying the full text.
 */
function splitSteps(howText, subTaskTitle) {
  const text = clean(howText);
  const title = cut(subTaskTitle);
  const single = () => [{ title, instructions: text, expectedOutput: '', isMandatory: true }];
  if (!text || ALTERNATIVE.test(text)) return single();
  const lines = text.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());

  // 1. parent-labelled groups
  const parentIdx = lines.map((l, i) => (PARENT.test(l) && !SUBBULLET.test(l) ? i : -1)).filter(i => i >= 0);
  if (parentIdx.length >= 2 && parentIdx.length <= 12 && parentIdx[0] === 0) {
    return parentIdx.map((start, k) => {
      const end = k + 1 < parentIdx.length ? parentIdx[k + 1] : lines.length;
      const head = PARENT.exec(lines[start])[1].trim();
      return { title: cut(stripColon(head)), instructions: lines.slice(start + 1, end).join('\n'), expectedOutput: '', isMandatory: true };
    });
  }

  // 2. headed sections
  const isItem = (l) => BULLET.test(l) || SUBBULLET.test(l);
  const sections = [];
  let pendingHeads = []; let cur = null;
  for (const line of lines) {
    if (isItem(line)) {
      if (!cur) {
        let h = pendingHeads[pendingHeads.length - 1];
        // "Discuss:" / "Record:" are lead-ins — the real heading is the line before
        if (h && GENERIC_LEAD.test(h) && pendingHeads.length > 1) h = pendingHeads[pendingHeads.length - 2];
        cur = { head: h || '', items: [] }; sections.push(cur); pendingHeads = [];
      }
      cur.items.push(line);
    } else {
      // a text line after items: continuation of a sub-bullet wrapped line, or the next heading
      const lastItem = cur && cur.items.length ? cur.items[cur.items.length - 1] : '';
      // wrapped text, or the line after "Navigate to:" — part of the previous item, not a new heading
      if (cur && cur.items.length && (line.length > 70 || /[.;,]$/.test(line.trim()) || /:\s*$/.test(lastItem))) { cur.items.push(line); continue; }
      cur = null; pendingHeads.push(line.trim());
    }
  }
  const headed = sections.filter(sec => sec.head);
  if (headed.length >= 2 && headed.length === sections.length && sections.length <= 12) {
    return sections.map(sec => ({
      title: cut(stripColon(sec.head)), instructions: sec.items.join('\n'), expectedOutput: '', isMandatory: true,
    }));
  }
  return single();
}

const BRAND_SIGNAL = /\b(all (assigned )?brands|each brand|every brand|respective brand|required brand|appropriate brand|select the brand|for all brands|brand dropdown)\b/i;

const METHOD = /^method\s*\d+\s*[:.\-–]\s*/i;
const REFERENCE = /^(key points?|notes?|root causes?|important( notes?)?)\b/i;

/** Longest shared trailing words of titles: ["Brand Central Inventory Monitoring", "Retail Ops Inventory Monitoring"] → "Inventory Monitoring" */
function commonSuffix(titles) {
  const words = titles.map(t => t.replace(/\([^)]*\)/g, '').trim().split(/\s+/));
  const out = [];
  for (let i = 1; i <= Math.min(...words.map(w => w.length)); i++) {
    const w = words[0][words[0].length - i];
    if (words.every(arr => arr[arr.length - i].toLowerCase() === w.toLowerCase())) out.unshift(w); else break;
  }
  return out.join(' ');
}

function parseDailyOpsSheet(rows, { defaults: defaultOverrides } = {}) {
  const warnings = [];
  const header = findHeader(rows || []);
  if (!header) throw new Error('Could not find the header row — expected columns "Task ID" and "Main Task".');
  const col = header.map;
  const cell = (row, key) => (col[key] === undefined ? '' : clean(row[col[key]]));
  const overrides = normaliseDefaults(defaultOverrides);
  const baseDefaults = { ...SHIPPED_DEFAULTS.base, ...overrides.base };

  // 1. Walk rows; Task ID / Main Task / Priority carry forward on continuation rows.
  const entries = [];
  let carry = { taskId: '', mainRaw: '', priority: '', owner: '', frequency: '', tat: '', sla: '' };
  for (const row of rows.slice(header.index + 1)) {
    if (!row || row.every(c => clean(c) === '')) continue;
    const taskId = cell(row, 'taskId'); const mainRaw = clean(row[col.mainTask]);
    if (taskId) carry = { taskId, mainRaw: mainRaw || carry.mainRaw, priority: '', owner: '', frequency: '', tat: '', sla: '' };
    else if (mainRaw) carry.mainRaw = mainRaw;
    const prio = cell(row, 'priority'); if (prio) carry.priority = prio;
    // Frequency / TAT / SLA are usually written on the first row of a block only — carry them down.
    for (const key of ['frequency', 'tat', 'sla']) { const v = cell(row, key); if (v) carry[key] = v; }
    const ownerCell = [cell(row, 'owner'), cell(row, 'team'), cell(row, 'fn')].find(v => /^(bm|tl\b)/i.test(v)) || cell(row, 'owner') || cell(row, 'team');
    if (!carry.taskId) { warnings.push('Skipped a row before the first Task ID.'); continue; }
    entries.push({
      taskId: carry.taskId.replace(/\s+/g, '').toUpperCase(), mainRaw: carry.mainRaw,
      priority: carry.priority.toUpperCase().replace(/\s+/g, ''), owner: ownerCell || '',
      subRaw: clean(row[col.subTask]), how: clean(row[col.how]), output: cell(row, 'output'),
      supportDoc: cell(row, 'supportDoc'), trigger: cell(row, 'trigger'), fn: cell(row, 'fn'),
      frequency: carry.frequency, tat: carry.tat, sla: carry.sla,
    });
  }

  // 2. Group by Task ID; one ID may hold several variants — different Main Task text ("Daily Business Report (1)" /
  //    "(2)"), or failing that different owner tags.
  const byTask = new Map();
  for (const e of entries) { if (!byTask.has(e.taskId)) byTask.set(e.taskId, []); byTask.get(e.taskId).push(e); }

  const templates = [];
  for (const [taskId, list] of byTask) {
    const mainKeys = [...new Set(list.map(e => e.mainRaw.replace(/\s+/g, ' ').trim()))];
    const ownerTags = [...new Set(list.map(e => e.owner).filter(Boolean))];
    let variants;
    if (mainKeys.length > 1) variants = mainKeys.map((k, i) => ({ suffix: `-${i + 1}`, rows: list.filter(e => e.mainRaw.replace(/\s+/g, ' ').trim() === k) }));
    else if (ownerTags.filter(t => /^tl\b/i.test(t)).length > 1) variants = ownerTags.map((t, i) => ({ suffix: `-${i + 1}`, rows: list.filter(e => (e.owner || ownerTags[0]) === t) }));
    else variants = [{ suffix: '', rows: list }];

    for (const v of variants) {
      const first = v.rows[0];
      const code = `${taskId}${v.suffix}`.slice(0, 20);
      const mainLines = first.mainRaw.split('\n').map(l => l.trim()).filter(Boolean);
      const name = mainLines[0] || taskId;
      // Owner: a "TL-…" line inside Main Task wins over a generic "BM" in the Owner column
      const tlHint = mainLines.slice(1).find(l => /^tl\b/i.test(l));
      const ownerTag = tlHint || v.rows.map(e => e.owner).find(o => /^tl\b/i.test(o)) || v.rows.map(e => e.owner).find(Boolean) || '';
      const owner = parseOwner(ownerTag);
      if (owner.unknown) warnings.push(`${code}: owner "${ownerTag}" not recognised — defaulted to Brand Managers.`);
      // Shipped defaults file first, then anything the caller passed for this run.
      const pick = (table) => table[code] || table[taskId] || {};
      const defaults = { ...baseDefaults, ...pick(SHIPPED_DEFAULTS.byCode), ...pick(overrides.byCode) };

      // 3. Sub-tasks
      const raw = []; const outputs = []; const reference = [];
      for (const e of v.rows) {
        const lines = e.subRaw.split('\n').map(l => l.trim()).filter(Boolean);
        const title = (lines[0] || '').replace(/\s+/g, ' ');
        const desc = lines.slice(1).join('\n');
        if (/^(expected\s+)?outputs?\b/i.test(title)) { if (e.how) outputs.push(e.how); continue; }
        if (!title && raw.length && (e.how || e.output)) { // continuation row
          const last = raw[raw.length - 1];
          last.how = [last.how, e.how].filter(Boolean).join('\n'); last.output = last.output || e.output; continue;
        }
        if (!title && !e.how) continue;
        if (REFERENCE.test(title)) { reference.push(`${title}\n${e.how}`.trim()); continue; }
        raw.push({ title: title || name, desc, how: e.how, output: e.output, doc: e.supportDoc });
      }

      // 3a. Consecutive "Method N:" rows are ALTERNATIVES → one sub-task, one step, all methods in the instructions
      const merged = [];
      for (let i = 0; i < raw.length; i++) {
        if (METHOD.test(raw[i].title)) {
          const group = [];
          while (i < raw.length && METHOD.test(raw[i].title)) group.push(raw[i++]); i--;
          const base = commonSuffix(group.map(g => g.title.replace(METHOD, ''))) || 'Check';
          merged.push({
            title: base, desc: `Choose the method you have access to (${group.length} available; the last may be a backup).`,
            how: group.map(g => `${g.title}\n${g.how}`).join('\n\n— — —\n\n'), output: '', doc: group[0].doc, alternatives: true,
          });
        } else merged.push(raw[i]);
      }

      // 3b. A "Backup Process" sub-task is reference material, not a daily step → attach to the step before it
      const kept = [];
      for (const r of merged) {
        if (/\bbackup\b/i.test(r.title) && kept.length && !r.alternatives) {
          const prev = kept[kept.length - 1];
          prev.how = `${prev.how}\n\n— — —\nBACKUP — ${[r.title, r.desc].filter(Boolean).join(' · ')}\n${r.how}`.trim();
          warnings.push(`${code}: "${r.title}" attached to "${prev.title}" as reference instead of a daily step.`);
        } else kept.push(r);
      }

      const definitions = kept.map((s) => {
        const schedule = inferSchedule(s.title);
        const activities = s.alternatives
          ? [{ title: `${s.title} — use the method available to you`, instructions: s.how, expectedOutput: '', isMandatory: true }]
          : splitSteps(s.how, s.title);
        return {
          title: s.title, description: s.desc || '', expectedOutput: s.output || '',
          ...(schedule ? { schedule } : {}),
          activities: activities.map(a => ({ ...a, supportDocuments: s.doc ? [s.doc] : [] })),
        };
      });
      if (!definitions.length) warnings.push(`${code}: no sub-tasks found.`);

      const pri = PRIORITY_MAP[first.priority];
      if (!pri) warnings.push(`${code}: priority "${first.priority || '—'}" not recognised — set to Medium.`);

      const allText = v.rows.map(e => `${e.subRaw}\n${e.how}`).join('\n');
      const brandMode = (defaults.brand !== undefined ? defaults.brand : BRAND_SIGNAL.test(allText)) ? 'CHECKLIST' : 'NONE';
      const est = defaults.minutes || estimateFromSubTasks(definitions.length, defaults.estimate);
      const descr = [first.fn, first.trigger && `Trigger: ${first.trigger}`].filter(Boolean).join(' · ') || `Daily routine ${code} (Daily Operations Master).`;

      // Frequency / TAT / SLA: the sheet wins when its column is filled and readable, then the
      // defaults file, then the system default. Unreadable cells are reported, never guessed.
      const frequency = mapFrequency(first.frequency) || (defaults.onDemand ? 'ONE_TIME' : null);
      if (first.frequency && !frequency) {
        warnings.push(`${code}: frequency "${first.frequency}" not recognised — using ${defaults.frequency || 'the system default'}.`);
      }
      for (const [key, text] of [['TAT', first.tat], ['SLA', first.sla]]) {
        if (text && !parseHours(text)) warnings.push(`${code}: ${key} "${text}" is not a number of hours — ignored.`);
      }
      const slaHours = parseHours(first.sla) || defaults.slaHours;
      const tatHours = parseHours(first.tat) || defaults.tatHours || slaHours;

      templates.push({
        code, sourceTaskId: taskId, name, description: [descr, ...reference.map(r => `Reference — ${r}`)].join('\n\n'),
        category: inferCategory(name), department: owner.kind === 'role' && owner.role === 'brand_manager' ? 'Brand Managers' : 'Operations',
        priority: pri || 'MEDIUM', sourcePriority: first.priority || '',
        frequency: frequency || defaults.frequency,
        autoAssign: frequency !== 'ONE_TIME' && !defaults.onDemand,
        dueTime: parseHHmm(defaults.dueTime || DEFAULT_DUE_TIME).text,
        runDays: defaults.runDays,
        brandMode, estimatedExecutionMinutes: est,
        slaHours, tatHours,
        expectedOutput: outputs.join('\n') || first.output || '',
        owner, assigneeRole: owner.role,
        subTaskDefinitions: definitions, subTaskCount: definitions.length,
        activityCount: definitions.reduce((n, d) => n + d.activities.length, 0),
        scheduledSubTasks: definitions.filter(d => d.schedule).map(d => ({ title: d.title, runs: describeSchedule(d.schedule) })),
        tags: ['daily-ops', taskId],
      });
    }
  }
  if (!templates.length) warnings.push('No tasks found under the header row.');
  return { templates, warnings };
}

module.exports = { parseDailyOpsSheet, parseOwner, splitSteps, mapFrequency, parseHours, PRIORITY_MAP, TASK_DEFAULTS, findHeader };
