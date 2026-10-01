/**
 * asinIssueClassifier — turns the free-text `Asins.TitleIssues` labels into
 * stable, filterable, exportable issue codes.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `Asins.TitleIssues` is a JSON array of human sentences produced by an upstream
 * title analyser. There are 810 distinct strings across 301,473 occurrences, but
 * only 34 distinct *patterns* — the rest are the same sentence with a different
 * character count or quoted word spliced in:
 *
 *   "[Title] Title is quite long (112 chars) - may be truncated on mobile"
 *   "[Title] Title is quite long (146 chars) - may be truncated on mobile"
 *
 * Storing or filtering on the raw sentence is therefore useless: no two rows
 * share a value, so a seller cannot group their problems and an export cannot
 * pivot them. This module collapses each sentence to a stable `code` plus a
 * `severity`, which is what the task-ASIN table, the drawer filters and the
 * seller-wise export all key on.
 *
 * The raw sentence is always preserved alongside the code, so nothing a user
 * sees is ever less specific than what the analyser actually reported.
 *
 * Rules are data, not control flow: adding a new analyser message means adding
 * a row to TITLE_ISSUE_RULES, not editing a switch.
 *
 * Pure functions — no DB, no network, no I/O.
 */

/**
 * Severity ranks, ordered so escalation is a simple max().
 * @type {Record<string, number>}
 */
const SEVERITY_RANK = {
  minor: 1,
  major: 2,
  critical: 3,
};

const SEVERITY_LABEL = {
  1: 'minor',
  2: 'major',
  3: 'critical',
};

/**
 * `Asins.TitleGrade` sets a *floor* on severity rather than the final value:
 * a title graded F is failing regardless of which specific rule tripped, so an
 * intrinsically "minor" issue on an F-grade title is reported as critical.
 * Ungraded (NULL / blank) titles are not escalated.
 */
const GRADE_SEVERITY_FLOOR = {
  'A+': 0,
  A: 0,
  B: SEVERITY_RANK.minor,
  C: SEVERITY_RANK.major,
  D: SEVERITY_RANK.critical,
  F: SEVERITY_RANK.critical,
};

/**
 * Ordered rule table. First match wins, so the more specific phrasings must come
 * before the general ones they would otherwise be swallowed by.
 *
 * `pattern` is tested against the label with the leading "[Title] " scope tag
 * already stripped (see stripScope), which keeps the rules readable.
 *
 * @type {ReadonlyArray<{code: string, severity: string, pattern: RegExp, note?: string}>}
 */
const TITLE_ISSUE_RULES = Object.freeze([
  // ── Hard length breaches ──────────────────────────────────────────────────
  {
    code: 'TITLE_TOO_LONG',
    severity: 'critical',
    pattern: /exceeds\s+\d+\s+character\s+limit/i,
    note: 'Breaks the limit outright, not merely approaching it.',
  },
  {
    code: 'TITLE_TOO_LONG',
    severity: 'major',
    pattern: /very\s+long\s*\(/i,
  },
  {
    code: 'TITLE_TOO_LONG',
    severity: 'major',
    pattern: /quite\s+long\s*\(/i,
  },
  {
    code: 'TITLE_TOO_LONG',
    severity: 'minor',
    pattern: /approaching\s+the\s+\d+\s+character\s+limit/i,
  },

  // ── Too short to be useful on mobile ─────────────────────────────────────
  {
    code: 'TITLE_TOO_SHORT',
    severity: 'major',
    pattern: /too\s+short\s*\(/i,
  },

  // ── Missing / unusable content ───────────────────────────────────────────
  { code: 'TITLE_MISSING', severity: 'critical', pattern: /^missing\s+title$/i },

  // ── Character-set problems ───────────────────────────────────────────────
  {
    code: 'TITLE_RESTRICTED_CHARS',
    severity: 'major',
    pattern: /contains\s+restricted\s+characters/i,
  },

  // ── Brand / product identity ─────────────────────────────────────────────
  {
    code: 'TITLE_BRAND_NOT_FIRST',
    severity: 'major',
    pattern: /brand\s+name\s+not\s+clearly\s+identified/i,
  },
  {
    code: 'TITLE_PRODUCT_TYPE',
    severity: 'major',
    pattern: /missing\s+a\s+clear\s+product\s+type/i,
  },

  // ── Repetition ───────────────────────────────────────────────────────────
  {
    code: 'TITLE_REPETITION',
    severity: 'minor',
    pattern: /words\s+repeated\s+more\s+than\s+twice/i,
  },
  {
    code: 'TITLE_REPETITION',
    severity: 'minor',
    pattern: /multiple\s+words\s+used\s+exactly\s+twice/i,
  },

  // ── Promotional language (Amazon policy risk) ────────────────────────────
  {
    code: 'TITLE_PROMOTIONAL',
    severity: 'minor',
    pattern: /subjective\/promotional\s+language/i,
  },
  {
    code: 'TITLE_PROMOTIONAL',
    severity: 'minor',
    pattern: /promotional\s+content/i,
  },

  // ── Formatting / structure ───────────────────────────────────────────────
  {
    code: 'TITLE_SPELLED_NUMBERS',
    severity: 'minor',
    pattern: /spelled-out\s+numbers\s+found/i,
  },
  {
    code: 'TITLE_CAPITALIZATION',
    severity: 'minor',
    pattern: /capitalization\s+is\s+inconsistent/i,
  },
  {
    code: 'TITLE_STRUCTURE',
    severity: 'minor',
    pattern: /better\s+information\s+structure/i,
  },
  {
    code: 'TITLE_STRUCTURE',
    severity: 'minor',
    pattern: /lacks\s+structured\s+information\s+order/i,
  },
  {
    code: 'TITLE_DESCRIPTIVE',
    severity: 'minor',
    pattern: /could\s+be\s+more\s+descriptive/i,
  },
]);

/**
 * Removes the analyser's scope prefix so rules match on the sentence itself.
 * "[Title] Title is quite long (112 chars)" -> "Title is quite long (112 chars)"
 */
const stripScope = (label) => String(label || '').replace(/^\[[^\]]+\]\s*/, '').trim();

/**
 * Raises `severity` to `floorRank` when the floor is higher.
 *
 * Works in rank space on both sides: `GRADE_SEVERITY_FLOOR` holds ranks (0-3),
 * not severity names, so it must be compared numerically and only converted to a
 * name on the way out. Passing a name here would silently no-op, because
 * `SEVERITY_RANK[3]` is undefined and `undefined || 0` never exceeds anything.
 */
const escalate = (severity, floorRank) =>
  (floorRank || 0) > SEVERITY_RANK[severity] ? SEVERITY_LABEL[floorRank] : severity;

/**
 * Classifies a single raw label.
 *
 * Unrecognised labels are NOT dropped and NOT guessed at: they come back as
 * `OTHER_TITLE_ISSUE` at `minor` severity, so an unrecognised message shows up in
 * the UI and the export as work to triage rather than vanishing silently. The
 * test suite asserts the real 810-label corpus leaves no residue in this bucket.
 *
 * @param {string} label raw entry from `Asins.TitleIssues`
 * @param {string} [titleGrade] `Asins.TitleGrade`, sets the severity floor
 * @returns {{code: string, severity: string, label: string, scope: string, rule: string|null}}
 */
function classifyIssue(label, titleGrade) {
  const raw = String(label ?? '').trim();
  const scopeMatch = raw.match(/^\[([^\]]+)\]/);
  const scope = scopeMatch ? scopeMatch[1] : null;
  const sentence = stripScope(raw);

  if (!sentence) {
    return { code: 'OTHER_TITLE_ISSUE', severity: 'minor', label: raw, scope, rule: null };
  }

  const rule = TITLE_ISSUE_RULES.find(r => r.pattern.test(sentence));
  if (!rule) {
    return {
      code: 'OTHER_TITLE_ISSUE',
      severity: escalate('minor', GRADE_SEVERITY_FLOOR[String(titleGrade || '').trim().toUpperCase()]),
      label: raw,
      scope,
      rule: null,
    };
  }

  const floor = GRADE_SEVERITY_FLOOR[String(titleGrade || '').trim().toUpperCase()];
  return {
    code: rule.code,
    severity: escalate(rule.severity, floor),
    label: raw,
    scope,
    rule: rule.pattern.source,
  };
}

/**
 * Parses a `TitleIssues` JSON column and classifies every entry.
 * Tolerates NULL, '', '[]', malformed JSON and non-array payloads.
 *
 * @param {string|null|undefined} titleIssuesJson raw column value
 * @param {string} [titleGrade]
 * @returns {Array<{code: string, severity: string, label: string, scope: string|null, rule: string|null}>}
 */
function classifyAsinIssues(titleIssuesJson, titleGrade) {
  if (titleIssuesJson === null || titleIssuesJson === undefined) return [];

  let parsed;
  try {
    const text = String(titleIssuesJson).trim();
    if (!text || text === '[]') return [];
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(entry => (typeof entry === 'string' ? entry : entry?.label ?? entry?.issue ?? null))
    .filter(Boolean)
    .map(label => classifyIssue(label, titleGrade));
}

/**
 * Rolls classified issues up into the counts a seller-facing view needs.
 * `byCode` is ordered by descending severity then frequency, so the worst
 * problem is always first.
 *
 * @param {Array<{code: string, severity: string}>} issues
 */
function summariseIssues(issues) {
  const byCode = new Map();
  let critical = 0;
  let major = 0;
  let minor = 0;

  for (const issue of issues || []) {
    if (issue.severity === 'critical') critical++;
    else if (issue.severity === 'major') major++;
    else minor++;

    const entry = byCode.get(issue.code);
    if (entry) entry.count++;
    else byCode.set(issue.code, { code: issue.code, count: 1, severity: issue.severity });
  }

  const codes = [...byCode.values()].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.count - a.count || a.code.localeCompare(b.code)
  );

  return {
    total: (issues || []).length,
    critical,
    major,
    minor,
    byCode: codes,
    /** Highest severity present, or null when there are no issues. */
    worst: codes.length ? codes[0].severity : null,
  };
}

/** Every code the classifier can emit, for API validation and export headers. */
const KNOWN_ISSUE_CODES = Object.freeze([
  ...new Set(TITLE_ISSUE_RULES.map(r => r.code)),
  'OTHER_TITLE_ISSUE',
].sort());

module.exports = {
  SEVERITY_RANK,
  SEVERITY_LABEL,
  GRADE_SEVERITY_FLOOR,
  TITLE_ISSUE_RULES,
  KNOWN_ISSUE_CODES,
  stripScope,
  classifyIssue,
  classifyAsinIssues,
  summariseIssues,
};
