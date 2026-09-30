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

// Judgement calls for what the sheet leaves empty. Minutes are per person per day.
const TASK_DEFAULTS = {
  'DLY-001':   { minutes: 75, dueTime: '18:00' },
  'DLY-002':   { minutes: 30, dueTime: '12:00' },
  'DLY-003':   { minutes: 30, dueTime: '17:00' },
  'DLY-004':   { minutes: 30, dueTime: '12:00' },
  'DLY-005':   { minutes: 45, dueTime: '13:30' },     // DF labels must be downloaded before 1:30 PM
  'DLY-006':   { minutes: 45, dueTime: '18:00' },
  'DLY-007':   { minutes: 30, dueTime: '17:00' },
  'DLY-008':   { minutes: 60, dueTime: '18:00' },
  'DLY-009':   { minutes: 30, dueTime: '18:00', onDemand: true },   // assigned by management when needed
  'DLY-0010A': { minutes: 60, dueTime: '18:00', onDemand: true },   // optimisation is need-driven
  'DLY-0010B': { minutes: 45, dueTime: '18:00', onDemand: true },
  'DLY-0011':  { minutes: 20, dueTime: '18:00' },
  'DLY-0012':  { minutes: 45, dueTime: '18:00' },
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
      cells.forEach((c, idx) => { if (HEADER_KEYS[c] && map[HEADER_KEYS[c]] === undefined) map[HEADER_KEYS[c]] = idx; });
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

const BULLET = /^\s*(?:[-•*▪●◦]|\d{1,2}[.)]|step\s*\d{1,2}\s*[:.\-–)])\s*(.+)$/i;
const ALTERNATIVE = /\b(method\s*\d|backup|back-up|when to use|alternatively|option\s*\d|either)\b/i;

/** Turn a "How to Perform" cell into activities. Alternatives are never split into separate mandatory steps. */
function splitSteps(howText, subTaskTitle) {
  const text = clean(howText);
  const single = () => [{
    title: subTaskTitle.length > 140 ? subTaskTitle.slice(0, 137) + '…' : subTaskTitle,
    instructions: text, expectedOutput: '', isMandatory: true,
  }];
  if (!text) return single();
  if (ALTERNATIVE.test(text)) return single();
  const lines = text.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  const steps = [];
  let current = null;
  for (const line of lines) {
    const m = BULLET.exec(line);
    if (m) { current = { head: m[1].trim(), rest: [] }; steps.push(current); }
    else if (current) current.rest.push(line.trim());
    else { current = { head: line.trim(), rest: [] }; steps.push(current); }
  }
  const bulleted = lines.filter(l => BULLET.test(l)).length;
  if (bulleted < 2 || steps.length < 2 || steps.length > 12) return single();
  return steps.map(s => ({
    title: s.head.length > 140 ? s.head.slice(0, 137) + '…' : s.head,
    instructions: [s.head.length > 140 ? s.head : '', ...s.rest].filter(Boolean).join('\n'),
    expectedOutput: '', isMandatory: true,
  }));
}

function parseDailyOpsSheet(rows, opts = {}) {
  const warnings = [];
  const header = findHeader(rows || []);
  if (!header) throw new Error('Could not find the header row — expected columns "Task ID" and "Main Task".');
  const col = header.map;
  const cell = (row, key) => (col[key] === undefined ? '' : clean(row[col[key]]));

  // 1. Walk rows, carrying Task ID / Main Task / Priority / owner forward on continuation rows.
  const entries = [];
  let carry = { taskId: '', mainTask: '', priority: '', owner: '' };
  for (const row of rows.slice(header.index + 1)) {
    if (!row || row.every(c => clean(c) === '')) continue;
    const taskId = cell(row, 'taskId'); const mainTask = cell(row, 'mainTask');
    if (taskId) carry = { taskId, mainTask: mainTask || carry.mainTask, priority: cell(row, 'priority') || '', owner: '' };
    else if (mainTask) carry.mainTask = mainTask;
    const prio = cell(row, 'priority'); if (prio) carry.priority = prio;
    const ownerCell = [cell(row, 'owner'), cell(row, 'team'), cell(row, 'fn')].find(v => /^(bm|tl\b)/i.test(v)) ||
      cell(row, 'owner') || cell(row, 'team');
    if (ownerCell) carry.owner = ownerCell;
    if (!carry.taskId) { warnings.push('Skipped a row before the first Task ID.'); continue; }
    entries.push({
      taskId: carry.taskId.replace(/\s+/g, '').toUpperCase(), mainTask: carry.mainTask,
      priority: carry.priority.toUpperCase().replace(/\s+/g, ''), owner: carry.owner,
      subNo: cell(row, 'subNo'), subTask: cell(row, 'subTask'), how: clean(row[col.how]),
      output: cell(row, 'output'), supportDoc: cell(row, 'supportDoc'), trigger: cell(row, 'trigger'),
      fn: cell(row, 'fn'),
    });
  }

  // 2. Group by Task ID; split into variants when one ID has several distinct owner tags.
  const byTask = new Map();
  for (const e of entries) { if (!byTask.has(e.taskId)) byTask.set(e.taskId, []); byTask.get(e.taskId).push(e); }

  const templates = [];
  for (const [taskId, list] of byTask) {
    const ownerTags = [...new Set(list.map(e => e.owner).filter(Boolean))];
    const variants = ownerTags.length > 1
      ? ownerTags.map((tag, i) => ({ suffix: `-${i + 1}`, tag, rows: list.filter(e => (e.owner || ownerTags[0]) === tag) }))
      : [{ suffix: '', tag: ownerTags[0] || '', rows: list }];

    for (const v of variants) {
      const first = v.rows[0];
      const code = `${taskId}${v.suffix}`.slice(0, 20);
      const owner = parseOwner(v.tag);
      if (owner.unknown) warnings.push(`${code}: owner "${v.tag}" not recognised — defaulted to Brand Managers.`);
      const defaults = TASK_DEFAULTS[taskId] || {};

      // sub-tasks: a new one starts when Sub Task text is present; text-less rows continue the previous one
      const subTasks = []; const outputs = [];
      for (const e of v.rows) {
        if (/^(expected\s+)?outputs?\b/i.test(e.subTask)) { if (e.how) outputs.push(e.how); continue; }
        if (!e.subTask && subTasks.length && (e.how || e.output)) {
          const last = subTasks[subTasks.length - 1];
          last.how = [last.how, e.how].filter(Boolean).join('\n'); last.output = last.output || e.output; continue;
        }
        if (!e.subTask && !e.how) continue;
        subTasks.push({ no: e.subNo, title: e.subTask || e.mainTask, how: e.how, output: e.output, doc: e.supportDoc });
      }

      const definitions = subTasks.map((s) => {
        const schedule = inferSchedule(s.title);
        return {
          title: s.title, description: '', expectedOutput: s.output || '',
          ...(schedule ? { schedule } : {}),
          activities: splitSteps(s.how, s.title).map(a => ({ ...a, supportDocuments: s.doc ? [s.doc] : [] })),
        };
      });
      if (!definitions.length) warnings.push(`${code}: no sub-tasks found.`);

      const pri = PRIORITY_MAP[first.priority];
      if (!pri) warnings.push(`${code}: priority "${first.priority || '—'}" not recognised — set to Medium.`);
      const est = defaults.minutes || Math.min(120, 15 + 10 * definitions.length);
      const name = variants.length > 1 ? `${first.mainTask} — ${owner.label}` : first.mainTask;

      templates.push({
        code, sourceTaskId: taskId, name,
        description: [first.fn, first.trigger && `Trigger: ${first.trigger}`].filter(Boolean).join(' · ') ||
          `Daily routine ${code} (from the Daily Operations Master).`,
        category: inferCategory(first.mainTask), department: owner.kind === 'role' && owner.role === 'brand_manager' ? 'Brand Managers' : 'Operations',
        priority: pri || 'MEDIUM', sourcePriority: first.priority || '',
        frequency: defaults.onDemand ? 'ONE_TIME' : 'DAILY',
        autoAssign: !defaults.onDemand,
        dueTime: parseHHmm(defaults.dueTime || DEFAULT_DUE_TIME).text,
        runDays: '1,2,3,4,5,6',
        estimatedExecutionMinutes: est,
        slaHours: 8, tatHours: 8,
        expectedOutput: outputs.join(' ') || first.output || '',
        owner, assigneeRole: owner.role,
        subTaskDefinitions: definitions,
        subTaskCount: definitions.length,
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
