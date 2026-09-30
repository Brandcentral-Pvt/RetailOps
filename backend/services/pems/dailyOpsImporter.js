/**
 * Daily Operations Master → PEMS task templates.  PURE (no I/O) — unit tested.
 *
 * Input : the sheet as an array of rows (array of cell arrays) — what xlsx `sheet_to_json(ws,{header:1})` gives.
 * Output: { templates[], warnings[] } where each template is ready for `createTemplate`/`updateTemplate`
 *         plus routine fields (autoAssign, dueTime, runDays, owner).
 *
 * Nothing in here is hardcoded to one dataset: the sheet drives tasks, sub-tasks and SOP text.
 * Values the sheet leaves blank (estimate, due time, which tasks are on-demand) come from
 * TASK_DEFAULTS below, keyed by Task ID, and are editable in the import preview.
 */
const { inferSchedule, describeSchedule, parseHHmm, DEFAULT_DUE_TIME } = require('./routineSchedule');

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (s) => String(s == null ? '' : s).replace(/\r/g, '').trim();

/**
 * P1 → HIGH, P2 → MEDIUM, P3/P4 → LOW.
 * CRITICAL is intentionally never produced: My Day treats it as an emergency and would push everything else down.
 */
const PRIORITY_MAP = { P1: 'HIGH', P2: 'MEDIUM', P3: 'LOW', P4: 'LOW' };

// Judgement calls for what the sheet leaves empty — all editable in the import preview.
//   minutes : per BRAND when brand=true (a person's estimate = minutes × number of brands), otherwise per person per day
//   brand   : true → one task per person with a checklist of that person's brands; false → brand-independent
//   onDemand: not generated daily (need-driven work)
const TASK_DEFAULTS = {
  'DLY-001':   { minutes: 12, brand: true,  dueTime: '18:00' },
  'DLY-002':   { minutes: 6,  brand: true,  dueTime: '12:00' },
  'DLY-003':   { minutes: 6,  brand: true,  dueTime: '17:00' },
  'DLY-004':   { minutes: 6,  brand: true,  dueTime: '12:00' },
  'DLY-005':   { minutes: 8,  brand: true,  dueTime: '13:30' },   // DF labels must be downloaded before 1:30 PM
  'DLY-006':   { minutes: 45, brand: false, dueTime: '18:00' },   // PO upload is one shared process, not per brand
  'DLY-007':   { minutes: 5,  brand: true,  dueTime: '17:00' },
  'DLY-008':   { minutes: 10, brand: true,  dueTime: '18:00' },   // one WhatsApp group per seller
  'DLY-009':   { minutes: 30, brand: false, dueTime: '18:00', onDemand: true },   // assigned by management when needed
  'DLY-0010A': { minutes: 45, brand: false, dueTime: '18:00', onDemand: true },   // optimisation is need-driven
  'DLY-0010B': { minutes: 40, brand: false, dueTime: '18:00', onDemand: true },
  'DLY-0011':  { minutes: 4,  brand: true,  dueTime: '18:00' },
  'DLY-0012':  { minutes: 8,  brand: true,  dueTime: '18:00' },   // Ads report: "repeat for all brands"
  'DLY-0012-2': { minutes: 40, brand: false, dueTime: '18:00' },  // vendor-account level GMS report
};

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

function parseDailyOpsSheet(rows) {
  const warnings = [];
  const header = findHeader(rows || []);
  if (!header) throw new Error('Could not find the header row — expected columns "Task ID" and "Main Task".');
  const col = header.map;
  const cell = (row, key) => (col[key] === undefined ? '' : clean(row[col[key]]));

  // 1. Walk rows; Task ID / Main Task / Priority carry forward on continuation rows.
  const entries = [];
  let carry = { taskId: '', mainRaw: '', priority: '', owner: '' };
  for (const row of rows.slice(header.index + 1)) {
    if (!row || row.every(c => clean(c) === '')) continue;
    const taskId = cell(row, 'taskId'); const mainRaw = clean(row[col.mainTask]);
    if (taskId) carry = { taskId, mainRaw: mainRaw || carry.mainRaw, priority: '', owner: '' };
    else if (mainRaw) carry.mainRaw = mainRaw;
    const prio = cell(row, 'priority'); if (prio) carry.priority = prio;
    const ownerCell = [cell(row, 'owner'), cell(row, 'team'), cell(row, 'fn')].find(v => /^(bm|tl\b)/i.test(v)) || cell(row, 'owner') || cell(row, 'team');
    if (!carry.taskId) { warnings.push('Skipped a row before the first Task ID.'); continue; }
    entries.push({
      taskId: carry.taskId.replace(/\s+/g, '').toUpperCase(), mainRaw: carry.mainRaw,
      priority: carry.priority.toUpperCase().replace(/\s+/g, ''), owner: ownerCell || '',
      subRaw: clean(row[col.subTask]), how: clean(row[col.how]), output: cell(row, 'output'),
      supportDoc: cell(row, 'supportDoc'), trigger: cell(row, 'trigger'), fn: cell(row, 'fn'),
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
      const defaults = TASK_DEFAULTS[code] || TASK_DEFAULTS[taskId] || {};

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
      const est = defaults.minutes || Math.min(120, 15 + 10 * definitions.length);
      const descr = [first.fn, first.trigger && `Trigger: ${first.trigger}`].filter(Boolean).join(' · ') || `Daily routine ${code} (Daily Operations Master).`;

      templates.push({
        code, sourceTaskId: taskId, name, description: [descr, ...reference.map(r => `Reference — ${r}`)].join('\n\n'),
        category: inferCategory(name), department: owner.kind === 'role' && owner.role === 'brand_manager' ? 'Brand Managers' : 'Operations',
        priority: pri || 'MEDIUM', sourcePriority: first.priority || '',
        frequency: defaults.onDemand ? 'ONE_TIME' : 'DAILY',
        autoAssign: !defaults.onDemand,
        dueTime: parseHHmm(defaults.dueTime || DEFAULT_DUE_TIME).text,
        runDays: '1,2,3,4,5,6',
        brandMode, estimatedExecutionMinutes: est,
        slaHours: 8, tatHours: 8,
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

module.exports = { parseDailyOpsSheet, parseOwner, splitSteps, PRIORITY_MAP, TASK_DEFAULTS, findHeader };
