/**
 * ASIN normalization + usability utilities.
 *
 * ── Why this file is strict ──────────────────────────────────────────────────
 * An earlier version of `normalizeAsin` expanded Excel scientific notation
 * ("7.02793E+11" -> "702793000000") and then ACCEPTED the result, because its
 * validator allowed 10-15 digit numbers. A 12-digit number is not an ASIN —
 * Amazon ASINs are exactly 10 characters — so that path invented plausible
 * looking codes that are indistinguishable from real ones once stored.
 *
 * 541 such rows are in `Asins` today. They are unrecoverable: they carry no
 * Title, Brand, Images, Price, BSR or sync source, and their `ParentAsin`,
 * `ScrapedAsin` and `Sku` are all empty. 38 sellers own nothing but these rows.
 *
 * The rule here is therefore: NEVER fabricate. If a code arrives in scientific
 * notation it is refused, not expanded. Callers that already do `normalizeAsin(x) || x`
 * keep working unchanged.
 *
 * Pure functions — no DB or network dependencies.
 */

/**
 * The real Amazon ASIN shape: exactly 10 uppercase alphanumerics.
 * Covers modern ("B0FP99TYDH") and legacy 10-digit numeric ASINs alike.
 */
const ASIN_STRICT_REGEX = /^[A-Z0-9]{10}$/;

/** Anything Excel touched has a decimal point and/or an exponent marker. */
const SCIENTIFIC_REGEX = /[eE]\s*[+-]?\d|\./;

/**
 * True when a code arrived in (or is still in) Excel scientific notation.
 * These are always corrupt, whatever the mantissa happens to look like.
 */
const isScientificNotation = (code) => {
  if (code === null || code === undefined) return false;
  return SCIENTIFIC_REGEX.test(String(code).trim());
};

/**
 * Whether an ASIN code is safe to store, key on, or hand to a user in an export.
 *
 * This is a *predicate*, not a repair. It answers "can I trust this code?"
 * and never returns a value derived from the input.
 */
const isUsableAsinCode = (code) => {
  if (code === null || code === undefined) return false;

  const raw = String(code).trim();
  if (!raw) return false;
  if (isScientificNotation(raw)) return false;
  if (raw !== raw.toUpperCase()) return false;

  return ASIN_STRICT_REGEX.test(raw);
};

/**
 * Normalizes a code that is *already* trustworthy: trims and uppercases.
 *
 * Deliberately does not expand scientific notation — see the file header. A code
 * that needs expanding has been corrupted upstream and must be rejected by the
 * caller, not silently reshaped here.
 *
 * @returns {string|null} the clean code, or null if the code is not usable.
 */
const normalizeAsin = (code) => {
  if (!isUsableAsinCode(code)) return null;
  return String(code).trim().toUpperCase();
};

/**
 * SQL predicate for filtering corrupt codes at the source, so the junk never
 * reaches a backfill or an export.
 *
 * Use as:  WHERE ${ASIN_USABLE_SQL}   (after aliasing the column, e.g. `a.AsinCode`)
 *
 * Implemented in SQL rather than in JS so the filter survives SELECT COUNT
 * queries, index seeks and the batched backfill — filtering after the rows
 * arrive would mean transferring 541 unusable rows on every poll.
 */
const ASIN_USABLE_SQL = `LTRIM(RTRIM([AsinCode])) <> ''
  AND [AsinCode] NOT LIKE '%E+%'
  AND [AsinCode] NOT LIKE '%.%'
  AND LEN(LTRIM(RTRIM([AsinCode]))) = 10`;

/** The same predicate as a parameterised clause, when the column needs an alias. */
const asinUsableSqlFor = (column) =>
  `LTRIM(RTRIM(${column})) <> ''
   AND ${column} NOT LIKE '%E+%'
   AND ${column} NOT LIKE '%.%'
   AND LEN(LTRIM(RTRIM(${column}))) = 10`;

/**
 * Drops unusable codes from a list of rows, returning the kept rows and a count
 * of what was dropped. Used by the ASIN backfill and the seller-wise export so
 * neither can ever emit a fabricated code.
 */
const partitionUsableAsins = (rows, codeKey = 'AsinCode') => {
  const kept = [];
  let dropped = 0;
  for (const row of rows) {
    if (isUsableAsinCode(row?.[codeKey])) kept.push(row);
    else dropped++;
  }
  return { kept, dropped };
};

module.exports = {
  ASIN_STRICT_REGEX,
  ASIN_USABLE_SQL,
  isScientificNotation,
  isUsableAsinCode,
  normalizeAsin,
  asinUsableSqlFor,
  partitionUsableAsins,
};
