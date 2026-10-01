/**
 * asinIssueClassifier against the real label corpus.
 *
 * The important assertions are the two coverage ones at the bottom. The unit
 * tests below them can all pass while the classifier is useless if the analyser
 * has started emitting messages nobody handles — that is the failure mode this
 * suite exists to catch, so `CONCRETE_CODES` and `unclassified` are checked
 * against the committed 810-label fixture rather than against hand-picked
 * examples.
 */
const fs = require('fs');
const path = require('path');

const {
  SEVERITY_RANK,
  GRADE_SEVERITY_FLOOR,
  TITLE_ISSUE_RULES,
  KNOWN_ISSUE_CODES,
  stripScope,
  classifyIssue,
  classifyAsinIssues,
  summariseIssues,
} = require('../../services/pems/asinIssueClassifier');

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'asinIssueLabels.json'), 'utf8')
);
const ALL_LABELS = FIXTURE.labels.map(l => l.label);

describe('fixture sanity', () => {
  test('the corpus is the full set, not a sample', () => {
    expect(ALL_LABELS.length).toBe(810);
    expect(FIXTURE.labels.reduce((s, l) => s + l.n, 0)).toBe(301473);
  });

  test('every fixture label is a non-empty string', () => {
    for (const l of ALL_LABELS) {
      expect(typeof l).toBe('string');
      expect(l.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('stripScope', () => {
  test('removes the [Title] scope tag', () => {
    expect(stripScope('[Title] Missing brand')).toBe('Missing brand');
  });

  test('leaves untagged labels intact', () => {
    expect(stripScope('Missing title')).toBe('Missing title');
  });
});

describe('classifyIssue — representative cases', () => {
  const cases = [
    ['Missing title', 'TITLE_MISSING'],
    ['[Title] Title is very long (271 chars) - will be truncated on most devices', 'TITLE_TOO_LONG'],
    ['[Title] Title is quite long (212 chars) - may be truncated on mobile', 'TITLE_TOO_LONG'],
    ['[Title] Title is approaching the 200 character limit', 'TITLE_TOO_LONG'],
    ['[Title] Title exceeds 200 character limit by 15 characters (215/200)', 'TITLE_TOO_LONG'],
    ['[Title] Title is too short (18 chars) - mobile users may not see enough info', 'TITLE_TOO_SHORT'],
    ['[Title] Contains restricted characters: !', 'TITLE_RESTRICTED_CHARS'],
    ['[Title] Brand name not clearly identified at the start of the title', 'TITLE_BRAND_NOT_FIRST'],
    ['[Title] Title may be missing a clear product type identifier', 'TITLE_PRODUCT_TYPE'],
    ['[Title] Words repeated more than twice: "silicone" (4x)', 'TITLE_REPETITION'],
    ['[Title] Multiple words used exactly twice, approaching repetition limits', 'TITLE_REPETITION'],
    ['[Title] Title contains subjective/promotional language: "best"', 'TITLE_PROMOTIONAL'],
    ['[Title] Title contains promotional content: "sale"', 'TITLE_PROMOTIONAL'],
    ['[Title] Spelled-out numbers found: three - should use numerals', 'TITLE_SPELLED_NUMBERS'],
    ['[Title] Title capitalization is inconsistent', 'TITLE_CAPITALIZATION'],
    ['[Title] Title lacks structured information order', 'TITLE_STRUCTURE'],
    ['[Title] Title could be more descriptive', 'TITLE_DESCRIPTIVE'],
  ];

  test.each(cases)('maps %s -> %s', (label, code) => {
    expect(classifyIssue(label).code).toBe(code);
  });
});

describe('classifyIssue — severity', () => {
  test('a limit breach is critical, an approach is not', () => {
    expect(classifyIssue('[Title] Title exceeds 200 character limit by 15 characters (215/200)').severity).toBe('critical');
    expect(classifyIssue('[Title] Title is approaching the 200 character limit').severity).toBe('minor');
  });

  test('missing title is critical', () => {
    expect(classifyIssue('Missing title').severity).toBe('critical');
  });

  test('title grade raises the floor but never lowers severity', () => {
    // intrinsically minor, but graded F -> critical
    expect(classifyIssue('[Title] Title capitalization is inconsistent', 'F').severity).toBe('critical');
    expect(classifyIssue('[Title] Title capitalization is inconsistent', 'B').severity).toBe('minor');
    expect(classifyIssue('[Title] Title capitalization is inconsistent', 'A').severity).toBe('minor');
  });

  test('a major issue graded A+ stays major', () => {
    expect(classifyIssue('[Title] Brand name not clearly identified at the start of the title', 'A+').severity).toBe('major');
  });

  test('missing/blank grade does not escalate', () => {
    expect(classifyIssue('[Title] Title capitalization is inconsistent', null).severity).toBe('minor');
    expect(classifyIssue('[Title] Title capitalization is inconsistent', '  ').severity).toBe('minor');
    expect(classifyIssue('[Title] Title capitalization is inconsistent', 'Z').severity).toBe('minor');
  });

  test('every severity produced is a known severity', () => {
    for (const l of ALL_LABELS) {
      for (const grade of Object.keys(GRADE_SEVERITY_FLOOR)) {
        expect(SEVERITY_RANK[classifyIssue(l, grade).severity]).toBeGreaterThan(0);
      }
    }
  });
});

describe('classifyIssue — unrecognised labels are surfaced, not dropped', () => {
  test('unknown message becomes OTHER_TITLE_ISSUE', () => {
    const r = classifyIssue('[Title] Some brand-new message nobody has seen');
    expect(r.code).toBe('OTHER_TITLE_ISSUE');
    expect(r.rule).toBeNull();
  });

  test('the raw label is always preserved', () => {
    const r = classifyIssue('[Title] Some brand-new message nobody has seen');
    expect(r.label).toBe('[Title] Some brand-new message nobody has seen');
  });

  test('empty and null input do not throw', () => {
    expect(classifyIssue('').code).toBe('OTHER_TITLE_ISSUE');
    expect(classifyIssue(null).code).toBe('OTHER_TITLE_ISSUE');
    expect(classifyIssue(undefined).code).toBe('OTHER_TITLE_ISSUE');
  });
});

describe('classifyAsinIssues — column parsing', () => {
  test('classifies a JSON array of labels', () => {
    const json = JSON.stringify(['Missing title', '[Title] Contains restricted characters: _']);
    const out = classifyAsinIssues(json);
    expect(out.map(o => o.code)).toEqual(['TITLE_MISSING', 'TITLE_RESTRICTED_CHARS']);
  });

  test('applies the title grade floor to every entry', () => {
    const json = JSON.stringify(['[Title] Title capitalization is inconsistent']);
    expect(classifyAsinIssues(json, 'F')[0].severity).toBe('critical');
  });

  test('returns [] for null, undefined, empty and "[]"', () => {
    expect(classifyAsinIssues(null)).toEqual([]);
    expect(classifyAsinIssues(undefined)).toEqual([]);
    expect(classifyAsinIssues('')).toEqual([]);
    expect(classifyAsinIssues('[]')).toEqual([]);
  });

  test('returns [] for malformed JSON rather than throwing', () => {
    expect(classifyAsinIssues('{not json')).toEqual([]);
  });

  test('returns [] for a non-array payload', () => {
    expect(classifyAsinIssues('"just a string"')).toEqual([]);
    expect(classifyAsinIssues('{"a":1}')).toEqual([]);
  });

  test('accepts object entries carrying a label/issue field', () => {
    const json = JSON.stringify([{ label: 'Missing title' }, { issue: '[Title] Title is too short (18 chars) - lacks sufficient product information' }]);
    expect(classifyAsinIssues(json).map(o => o.code)).toEqual(['TITLE_MISSING', 'TITLE_TOO_SHORT']);
  });

  test('drops non-string entries without entries', () => {
    expect(classifyAsinIssues(JSON.stringify([null, 42, {}, 'Missing title']))).toHaveLength(1);
  });
});

describe('summariseIssues', () => {
  const issues = [
    { code: 'TITLE_REPETITION', severity: 'minor' },
    { code: 'TITLE_TOO_LONG', severity: 'critical' },
    { code: 'TITLE_TOO_LONG', severity: 'critical' },
    { code: 'TITLE_BRAND_NOT_FIRST', severity: 'major' },
  ];

  test('counts severities and totals', () => {
    const s = summariseIssues(issues);
    expect(s.total).toBe(4);
    expect(s.critical).toBe(2);
    expect(s.major).toBe(1);
    expect(s.minor).toBe(1);
  });

  test('groups by code and orders worst-first', () => {
    const s = summariseIssues(issues);
    expect(s.byCode.map(c => c.code)).toEqual(['TITLE_TOO_LONG', 'TITLE_BRAND_NOT_FIRST', 'TITLE_REPETITION']);
    expect(s.byCode[0].count).toBe(2);
  });

  test('worst reflects the highest severity present', () => {
    expect(summariseIssues(issues).worst).toBe('critical');
    expect(summariseIssues([{ code: 'X', severity: 'minor' }]).worst).toBe('minor');
  });

  test('handles empty input', () => {
    const s = summariseIssues([]);
    expect(s).toEqual({ total: 0, critical: 0, major: 0, minor: 0, byCode: [], worst: null });
    expect(summariseIssues(null).total).toBe(0);
  });
});

describe('COVERAGE — every real label maps to a concrete code', () => {
  const CONCRETE = KNOWN_ISSUE_CODES.filter(c => c !== 'OTHER_TITLE_ISSUE');

  test('no real label falls into OTHER_TITLE_ISSUE', () => {
    const unclassified = ALL_LABELS.filter(l => classifyIssue(l).code === 'OTHER_TITLE_ISSUE');
    expect(unclassified).toEqual([]);
  });

  test('every one of the 810 labels resolves to a known code', () => {
    const unknown = [...new Set(ALL_LABELS.map(l => classifyIssue(l).code))].filter(
      c => !KNOWN_ISSUE_CODES.includes(c)
    );
    expect(unknown).toEqual([]);
  });

  test('classification is stable: same label always yields the same code', () => {
    for (const l of ALL_LABELS) {
      expect(classifyIssue(l).code).toBe(classifyIssue(l).code);
    }
  });

  test('scope tag never affects the resulting code', () => {
    // Same sentence, once tagged, once not, must agree.
    for (const l of ALL_LABELS.filter(x => x.startsWith('[Title] '))) {
      const tagged = classifyIssue(l);
      const bare = classifyIssue(l.replace(/^\[Title\]\s*/, ''));
      expect(bare.code).toBe(tagged.code);
    }
  });

  test('the full corpus collapses 810 labels down to a small set of codes', () => {
    const emitted = new Set(ALL_LABELS.map(l => classifyIssue(l).code));
    // Proves the classifier is actually generalising rather than enumerating.
    expect(emitted.size).toBeGreaterThanOrEqual(11);
    expect(emitted.size).toBeLessThan(20);
  });
});

describe('COVERAGE — the rule table stays maintainable', () => {
  test('no two rules share an identical pattern', () => {
    const seen = new Map();
    for (const r of TITLE_ISSUE_RULES) {
      const key = r.pattern.source;
      expect(seen.has(key)).toBe(false);
      seen.set(key, r.code);
    }
  });

  test('every rule code is a declared known code', () => {
    for (const r of TITLE_ISSUE_RULES) {
      expect(KNOWN_ISSUE_CODES).toContain(r.code);
      expect(SEVERITY_RANK[r.severity]).toBeGreaterThan(0);
    }
  });

  test('the rules are frozen against accidental mutation', () => {
    expect(Object.isFrozen(TITLE_ISSUE_RULES)).toBe(true);
  });
});
