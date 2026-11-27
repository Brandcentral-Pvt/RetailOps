// GMS uses calendar dates, not timestamps. Keep legacy ISO timestamp inputs
// compatible while binding a validated date-only value to every SQL query.
function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    throw new Error('Dates must be valid YYYY-MM-DD values');
  }
  const day = value.slice(0, 10);
  const parsed = new Date(day + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day ||
      (value.length > 10 && !Number.isFinite(Date.parse(value)))) {
    throw new Error('Dates must be valid YYYY-MM-DD values');
  }
  return day;
}

function dateWindow(start, end, { required = false } = {}) {
  if (required && (!start || !end)) throw new Error('Both start and end dates are required');
  const from = start == null || start === '' ? null : dateOnly(start);
  const to = end == null || end === '' ? null : dateOnly(end);
  if (from && to && from > to) throw new Error('Start date must not be after end date');
  return { from, to };
}

function exportWindow(params) {
  const mode = params.exportDateType ?? 'all';
  if (mode === 'all') return { from: null, to: null };
  if (mode === 'current') return dateWindow(params.startDate, params.endDate, { required: true });
  if (mode === 'custom' && Array.isArray(params.exportCustomDates) && params.exportCustomDates.length === 2) {
    return dateWindow(...params.exportCustomDates, { required: true });
  }
  throw new Error('Invalid export date selection');
}

// Legacy GMS facts are keyed by ASIN/date, not by a verified owner. Until the
// warehouse migration, never expose an ASIN shared by distinct sellers to a
// restricted user, even when one catalog row belongs to their portfolio.
const unambiguousSellerSql = (alias = 'a') =>
  `NOT EXISTS (SELECT 1 FROM Asins other WHERE other.AsinCode = ${alias}.AsinCode AND (other.SellerId IS NULL OR other.SellerId <> ${alias}.SellerId))`;

// Resolve at most one catalog row per fact. NULL-owned facts automatically
// obtain the current unique catalog assignment; conflicting mappings stay
// unmatched. Verified stored owners are never silently reassigned.
const gmsCatalogApplySql = `OUTER APPLY (
  SELECT TOP (1) c.AsinCode, c.SellerId, c.Title
  FROM Asins c
  WHERE UPPER(LTRIM(RTRIM(c.AsinCode))) = UPPER(LTRIM(RTRIM(g.Asin)))
    AND NULLIF(LTRIM(RTRIM(c.SellerId)), '') IS NOT NULL
    AND (g.SellerId = c.SellerId OR (g.SellerId IS NULL AND NOT EXISTS (
      SELECT 1 FROM Asins other
      WHERE UPPER(LTRIM(RTRIM(other.AsinCode))) = UPPER(LTRIM(RTRIM(c.AsinCode)))
        AND (NULLIF(LTRIM(RTRIM(other.SellerId)), '') IS NULL OR other.SellerId <> c.SellerId)
    )))
  ORDER BY c.Id
) a`;
module.exports = { dateOnly, dateWindow, exportWindow, unambiguousSellerSql, gmsCatalogApplySql };
