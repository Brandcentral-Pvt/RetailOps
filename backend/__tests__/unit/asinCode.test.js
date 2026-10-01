/**
 * ASIN code usability.
 *
 * The defect this locks down: `normalizeAsin` used to expand Excel scientific
 * notation and then accept the result. "7.02793E+11" became "702793000000",
 * which passed its own `^(\d{10,15})$` branch — so the importer stored a
 * 12-digit number as if it were an ASIN. 541 such rows are in `Asins` today,
 * and they are indistinguishable from real codes once written.
 *
 * The rule now: never fabricate. Scientific notation is refused, not expanded.
 */
const {
  ASIN_STRICT_REGEX,
  isScientificNotation,
  isUsableAsinCode,
  normalizeAsin,
  asinUsableSqlFor,
  partitionUsableAsins,
} = require('../../utils/asinUtils');

describe('isScientificNotation', () => {
  test.each([
    '7.02793E+11', '7.01252E+11', '7.02E+11', '1.5E-3', '2.78176E+14',
  ])('flags %s as Excel-damaged', (code) => {
    expect(isScientificNotation(code)).toBe(true);
  });

  test.each(['B0FP99TYDH', '0001234567', 'B0G3XQZTGP'])('leaves real code %s alone', (code) => {
    expect(isScientificNotation(code)).toBe(false);
  });
});

describe('isUsableAsinCode', () => {
  test.each(['B0FP99TYDH', 'B0G823KR7B', 'B0G3XQZTGP', 'B0H5CG14JW', '0001234567'])(
    'accepts real 10-char ASIN %s', (code) => {
      expect(isUsableAsinCode(code)).toBe(true);
    }
  );

  // The regression that mattered: these must never be treated as real ASINs.
  test.each(['7.02793E+11', '7.01252E+11', '7.02E+11', '7.0169E+11', '702793000000'])(
    'rejects %s', (code) => {
      expect(isUsableAsinCode(code)).toBe(false);
    }
  );

  test('rejects the 12-digit expansion the old code accepted', () => {
    // "7.02793E+11" expanded to 12 digits. A 12-digit string is not a 10-char ASIN.
    const expanded = String(Number('7.02793E+11'));
    expect(expanded).toHaveLength(12);
    expect(ASIN_STRICT_REGEX.test(expanded)).toBe(false);
    expect(isUsableAsinCode(expanded)).toBe(false);
  });

  test.each([null, undefined, '', '   ', 'B0FP99TY', 'B0FP99TYDHH'])(
    'rejects wrong length / empty: %p', (code) => {
      expect(isUsableAsinCode(code)).toBe(false);
    }
  );

  test('rejects lowercase rather than guessing at intent', () => {
    expect(isUsableAsinCode('b0fp99tydh')).toBe(false);
  });
});

describe('normalizeAsin', () => {
  test('trims and uppercases a code that is already trustworthy', () => {
    expect(normalizeAsin('  B0FP99TYDH  ')).toBe('B0FP99TYDH');
  });

  test('refuses scientific notation instead of expanding it', () => {
    expect(normalizeAsin('7.02793E+11')).toBeNull();
  });

  test('refuses an over-long numeric code', () => {
    expect(normalizeAsin('702793000000')).toBeNull();
  });

  test('returns null for unusable input so callers can fall back', () => {
    expect(normalizeAsin(null)).toBeNull();
    expect(normalizeAsin('')).toBeNull();
  });
});

describe('asinUsableSqlFor', () => {
  test('builds a predicate for an aliased column', () => {
    const sql = asinUsableSqlFor('a.AsinCode');
    expect(sql).toContain('a.AsinCode NOT LIKE \'%E+%\'');
    expect(sql).toContain('a.AsinCode NOT LIKE \'%.%\'');
    expect(sql).toContain('LEN(LTRIM(RTRIM(a.AsinCode))) = 10');
  });
});

describe('partitionUsableAsins', () => {
  const rows = [
    { AsinCode: 'B0FP99TYDH' },
    { AsinCode: '7.02793E+11' },
    { AsinCode: 'B0G823KR7B' },
    { AsinCode: '702793000000' },
    { AsinCode: null },
  ];

  test('keeps only trustworthy codes and counts the rest', () => {
    const { kept, dropped } = partitionUsableAsins(rows);
    expect(kept).toHaveLength(2);
    expect(kept.map(r => r.AsinCode)).toEqual(['B0FP99TYDH', 'B0G823KR7B']);
    expect(dropped).toBe(3);
  });

  test('never emits a fabricated code, whatever the input', () => {
    const { kept } = partitionUsableAsins(rows);
    for (const r of kept) {
      expect(r.AsinCode).not.toMatch(/[eE]\+/);
      expect(r.AsinCode).toHaveLength(10);
    }
  });

  test('handles an empty list', () => {
    expect(partitionUsableAsins([])).toEqual({ kept: [], dropped: 0 });
  });
});
