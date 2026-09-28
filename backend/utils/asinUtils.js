/**
 * ASIN normalization utility.
 * Scientific notation like 7.02793E+11 expands to 702793000000.
 * Trims, uppercases, and validates to Amazon ASIN format.
 * Pure function — no DB or network dependencies.
 */

const ASIN_REGEX = /^B0[A-Z0-9]{8}$|^([A-Z0-9]{10})$|^(\d{10,15})$/;

/**
 * Expand scientific notation (Excel-formatted numbers) to plain integer string.
 * e.g. 7.02793E+11 => 702793000000
 */
const expandScientific = (code) => {
    const n = Number(code);
    if (!isNaN(n)) {
        // toString() may produce exponential for very large/small numbers,
        // but ASINs are 10-15 digits (safe integer range), so this is fine.
        return n.toString();
    }
    return null;
};

/**
 * Normalizes an ASIN code:
 * - Expands scientific notation (e.g. 7.02793E+11 → 702793000000)
 * - Trims and uppercases
 * - Validates against Amazon ASIN patterns
 * Returns null if the code cannot be normalized to a valid ASIN.
 */
const normalizeAsin = (code) => {
    if (!code) return null;

    let asin = String(code).trim().toUpperCase();

    // Step 1: Expand scientific notation via JS Number parser
    const expanded = expandScientific(asin);
    if (expanded) asin = expanded;

    // Step 2: Strip any non-alphanumeric chars
    asin = asin.replace(/[^A-Z0-9]/g, '');

    // Step 3: Validate against known ASIN patterns
    if (ASIN_REGEX.test(asin)) {
        return asin;
    }

    // Step 4: Fallback — if we have 10-15 uppercase alphanumeric chars, accept
    if (/^[A-Z0-9]{10,15}$/.test(asin)) {
        return asin;
    }

    return null;
};

module.exports = { normalizeAsin };