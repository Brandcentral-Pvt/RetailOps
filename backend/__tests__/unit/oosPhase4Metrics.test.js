/**
 * Phase 4 unit tests — OOS decision metrics, priority groups, Pareto, classification.
 *
 * Covers:
 *   - Priority group assignment: 80% / 20% / GMS_UNVERIFIED
 *   - New ASIN always 20% regardless of Pareto position
 *   - GMS_UNVERIFIED when Pareto not verified
 *   - computePareto edge cases (empty, null GMS, zero total, threshold)
 *   - Sort key allowlist prevents SQL injection
 *   - Sort direction allowlist
 *   - Pagination clamping (page, pageSize bounds)
 *   - classifyAvailability edge cases
 *   - isFresh edge cases
 */

const assert = require('node:assert');
const { test } = require('node:test');

const {
  computePareto,
  classifyAvailability,
  isFresh,
  DEFAULT_POLICY,
} = require('../../services/oos/oosPolicy');

// ── Priority group assignment logic (mirrors reconcileRun's persistDecisionMetrics) ──
function assignPriorityGroup({ isNewAsin, paretoVerified, asinInTier1 }) {
  if (isNewAsin) return '20%';
  if (!paretoVerified) return 'GMS_UNVERIFIED';
  return asinInTier1 ? '80%' : '20%';
}

test('Priority group: New ASIN is always 20%', () => {
  assert.strictEqual(assignPriorityGroup({ isNewAsin: 1, paretoVerified: true, asinInTier1: true }), '20%');
  assert.strictEqual(assignPriorityGroup({ isNewAsin: 1, paretoVerified: true, asinInTier1: false }), '20%');
  assert.strictEqual(assignPriorityGroup({ isNewAsin: 1, paretoVerified: false, asinInTier1: true }), '20%');
});

test('Priority group: GMS_UNVERIFIED when Pareto not verified', () => {
  assert.strictEqual(assignPriorityGroup({ isNewAsin: 0, paretoVerified: false, asinInTier1: true }), 'GMS_UNVERIFIED');
  assert.strictEqual(assignPriorityGroup({ isNewAsin: 0, paretoVerified: false, asinInTier1: false }), 'GMS_UNVERIFIED');
});

test('Priority group: 80% for tier-1 existing ASIN', () => {
  assert.strictEqual(assignPriorityGroup({ isNewAsin: 0, paretoVerified: true, asinInTier1: true }), '80%');
});

test('Priority group: 20% for non-tier-1 existing ASIN', () => {
  assert.strictEqual(assignPriorityGroup({ isNewAsin: 0, paretoVerified: true, asinInTier1: false }), '20%');
});

// ── computePareto: edge cases ──
test('computePareto: empty catalog returns unverified', () => {
  const result = computePareto([], 80);
  assert.strictEqual(result.verified, false);
  assert.strictEqual(result.reason, 'GMS_UNVERIFIED');
  assert.deepStrictEqual(result.tier1Asins, []);
  assert.strictEqual(result.eligibleCount, 0);
});

test('computePareto: all null GMS returns unverified', () => {
  const rows = [
    { asin: 'A', gms: null },
    { asin: 'B', gms: null },
  ];
  const result = computePareto(rows, 80);
  assert.strictEqual(result.verified, false);
  assert.deepStrictEqual(result.tier1Asins, []);
});

test('computePareto: zero total GMS returns unverified', () => {
  const rows = [
    { asin: 'A', gms: 0 },
    { asin: 'B', gms: 0 },
  ];
  const result = computePareto(rows, 80);
  assert.strictEqual(result.verified, false);
});

test('computePareto: single ASIN with GMS is tier-1', () => {
  const rows = [{ asin: 'A', gms: 1000 }];
  const result = computePareto(rows, 80);
  assert.strictEqual(result.verified, true);
  assert.deepStrictEqual(result.tier1Asins, ['A']);
  assert.strictEqual(result.cumulativePct, 100);
});

test('computePareto: 80% threshold picks smallest set reaching threshold', () => {
  const rows = [
    { asin: 'A', gms: 50 },
    { asin: 'B', gms: 30 },
    { asin: 'C', gms: 15 },
    { asin: 'D', gms: 5 },
  ];
  const result = computePareto(rows, 80);
  // Total = 100, threshold = 80. Sorted: A(50), B(30)=80 -> threshold met after B
  assert.strictEqual(result.verified, true);
  assert.deepStrictEqual(result.tier1Asins, ['A', 'B']);
  assert.strictEqual(result.cumulativePct, 80);
});

test('computePareto: unknown GMS excluded from tier-1 but counted in eligible', () => {
  const rows = [
    { asin: 'A', gms: 100 },
    { asin: 'B', gms: null },
    { asin: 'C', gms: 50 },
  ];
  const result = computePareto(rows, 80);
  assert.strictEqual(result.verified, true);
  // Total = 150, threshold = 120. A(100), C(50)=150 -> threshold met after A+C
  assert.deepStrictEqual(result.tier1Asins, ['A', 'C']);
  assert.strictEqual(result.eligibleCount, 3); // includes null-GMS B
  assert.strictEqual(result.gmsCount, 2); // only A and C have GMS
});

// ── Sort key allowlist (mirrors getAffectedAsins controller) ──
const ALLOWED_SORT_KEYS = new Set([
  'AsinCode', 'Sku', 'PriorityGroup', 'Gms', 'GmsSharePct', 'CumulativePct',
  'Category', 'IsNewAsin', 'FirstSeenAt', 'CreatedAt', 'Classification',
  'IncidentStatus', 'ResyncStatus'
]);
const ALLOWED_SORT_DIRS = new Set(['asc', 'desc']);

function resolveSort(sortBy, sortOrder) {
  const key = ALLOWED_SORT_KEYS.has(sortBy) ? sortBy : 'PriorityGroup';
  const dir = ALLOWED_SORT_DIRS.has(String(sortOrder).toLowerCase())
    ? String(sortOrder).toLowerCase() : 'desc';
  return { key, dir };
}

test('Sort key allowlist: valid keys pass through', () => {
  for (const key of ALLOWED_SORT_KEYS) {
    const { key: resolved } = resolveSort(key, 'asc');
    assert.strictEqual(resolved, key);
  }
});

test('Sort key allowlist: injection attempt falls back to default', () => {
  const malicious = [
    'PriorityGroup; DROP TABLE OosDecisions',
    "PriorityGroup' OR '1'='1",
    'PriorityGroup UNION SELECT * FROM OosDecisions',
    'PriorityGroup)--',
    '1; DELETE FROM OosDecisions',
  ];
  for (const bad of malicious) {
    const { key } = resolveSort(bad, 'asc');
    assert.strictEqual(key, 'PriorityGroup', `Should default for: ${bad}`);
  }
});

test('Sort direction allowlist: case-insensitive valid values pass through', () => {
  const { dir: ascUpper } = resolveSort('PriorityGroup', 'ASC');
  assert.strictEqual(ascUpper, 'asc');
  const { dir: descUpper } = resolveSort('PriorityGroup', 'DESC');
  assert.strictEqual(descUpper, 'desc');
});

test('Sort direction allowlist: invalid values fall back to desc', () => {
  for (const bad of ['DROP', '1;--', '', null, undefined]) {
    const { dir } = resolveSort('PriorityGroup', bad);
    assert.strictEqual(dir, 'desc', `Should default to desc for: ${JSON.stringify(bad)}`);
  }
});

// ── Pagination clamping ──
function clampPagination(page, pageSize) {
  const p = Math.max(parseInt(page) || 1, 1);
  const s = Math.min(Math.max(parseInt(pageSize) || 50, 1), 200);
  return { page: p, pageSize: s };
}

test('Pagination: valid values pass through', () => {
  assert.deepStrictEqual(clampPagination(1, 50), { page: 1, pageSize: 50 });
  assert.deepStrictEqual(clampPagination(3, 25), { page: 3, pageSize: 25 });
});

test('Pagination: page < 1 clamps to 1', () => {
  assert.deepStrictEqual(clampPagination(0, 50), { page: 1, pageSize: 50 });
  assert.deepStrictEqual(clampPagination(-5, 50), { page: 1, pageSize: 50 });
  assert.deepStrictEqual(clampPagination('abc', 50), { page: 1, pageSize: 50 });
});

test('Pagination: pageSize clamping', () => {
  // 0 is falsy -> 50
  assert.deepStrictEqual(clampPagination(1, 0), { page: 1, pageSize: 50 });
  // -10 is truthy -> Math.max(-10, 1) = 1
  assert.deepStrictEqual(clampPagination(1, -10), { page: 1, pageSize: 1 });
  // valid small positive passes through
  assert.deepStrictEqual(clampPagination(1, 1), { page: 1, pageSize: 1 });
  // > 200 clamps to 200
  assert.deepStrictEqual(clampPagination(1, 9999), { page: 1, pageSize: 200 });
  assert.deepStrictEqual(clampPagination(1, 201), { page: 1, pageSize: 200 });
});

// ── DEFAULT_POLICY constants ──
test('DEFAULT_POLICY: gmsParetoPct defaults to 80', () => {
  assert.strictEqual(DEFAULT_POLICY.gmsParetoPct, 80);
});

test('DEFAULT_POLICY: gmsWindowDays defaults to 30', () => {
  assert.strictEqual(DEFAULT_POLICY.gmsWindowDays, 30);
});

// ── classifyAvailability edge cases ──
test('classifyAvailability: quantity > 0 is IN_STOCK', () => {
  const result = classifyAvailability({ quantity: 10, availability: 'In stock' });
  assert.strictEqual(result.state, 'IN_STOCK');
  assert.strictEqual(result.quantity, 10);
});

test('classifyAvailability: quantity === 0 is OOS_ZERO', () => {
  const result = classifyAvailability({ quantity: 0, availability: 'Out of stock' });
  assert.strictEqual(result.state, 'OOS_ZERO');
  assert.strictEqual(result.quantity, 0);
});

test('classifyAvailability: null quantity + unknown text is UNKNOWN', () => {
  const result = classifyAvailability({ quantity: null, availability: '' });
  assert.strictEqual(result.state, 'UNKNOWN');
  assert.strictEqual(result.quantity, null);
});

test('classifyAvailability: blank availability + blank status is UNKNOWN', () => {
  const result = classifyAvailability({ quantity: null, availability: '', status: '' });
  assert.strictEqual(result.state, 'UNKNOWN');
});

test('classifyAvailability: OOS status text is OOS', () => {
  const result = classifyAvailability({ quantity: null, availability: 'out of stock' });
  assert.strictEqual(result.state, 'OOS');
});

// ── isFresh edge cases ──
test('isFresh: future timestamp is not fresh', () => {
  const future = new Date(Date.now() + 100000);
  assert.strictEqual(isFresh(future, 24, new Date()), false);
});

test('isFresh: null timestamp is not fresh', () => {
  assert.strictEqual(isFresh(null, 24, new Date()), false);
});

test('isFresh: invalid timestamp is not fresh', () => {
  assert.strictEqual(isFresh(new Date('invalid'), 24, new Date()), false);
});

test('isFresh: exactly at boundary is fresh', () => {
  const now = new Date();
  const boundary = new Date(now.getTime() - 24 * 3600_000);
  assert.strictEqual(isFresh(boundary, 24, now), true);
});

test('isFresh: just past boundary is not fresh', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 25 * 3600_000);
  assert.strictEqual(isFresh(past, 24, now), false);
});
