/**
 * Content Optimization Service
 *
 * Deterministic, intent-routed tool for the AI chat. When a user asks about
 * content quality / listing optimization priorities, this runs the Content
 * Optimization Prioritization Framework against `Asins` and returns a complete
 * report package (no manual SQL for the user):
 *   1. Seller health + data coverage snapshot (which scoring pillars exist)
 *   2. Urgency tier breakdown (critical / high / medium / low counts)
 *   3. Ranked urgency table (UrgencyScore 0-100 + band, optional seller scope)
 *   4. Deep-dive ASIN record (concrete Issues / Recommendations so the model
 *      can write the fix plan + rewrites)
 *
 * DATA-ADAPTIVE: the framework checks which scoring columns are actually
 * populated for the requested scope and only scores with those (renormalizing
 * weights to a 0-100 UrgencyScore). Missing pillars (e.g. CDQ, A+ content,
 * buy-box, description length) are reported as "not synced" instead of
 * silently empty results.
 *
 * Sellers are resolved by display name or id via the Sellers table (real
 * Asins.SellerId values are opaque GUIDs), so "seller 101-Bharvita" or
 * "seller AJ13-BHARVITA" both work.
 *
 * Only single, read-only SELECT/WITH statements are ever executed.
 */

const databaseAnalysisService = require('./databaseAnalysisService');

const WEIGHTS = { cdq: 30, title: 25, aplus: 20, lqs: 15, thinDesc: 10 };
const TOP_N = 20;
const MIN_PART_RATIO = 0.5;

const BANDS = [
  { min: 80, band: 'critical', label: 'CRITICAL' },
  { min: 60, band: 'high', label: 'HIGH' },
  { min: 40, band: 'medium', label: 'MEDIUM' },
  { min: 0, band: 'low', label: 'LOW' },
];

const INTENT_RE = /content\s*optim|content\s*quality|cdq|urgency|urgent|prioriti[sz]|what\s*(should|to)\s*fix|fix.*listing|listing.*fix|improve.*listing|optimiz.*listing|listing.*quality|title\s*grade|title\s*score|a\+|aplus|a-plus|thin.*description|rewrite.*(title|bullet)|bullet.*(improv|rewrite)|grade\s*[def]/i;

const SELLER_RE = /(?:seller|account)[\s:]*(?:id)?[\s:=]+['"]?([A-Za-z0-9][A-Za-z0-9\s\-]{1,45})['"]?/i;
const SELLER_CODE_RE = /\b(\d{1,5}-[A-Z][A-Za-z0-9\-]{0,40})\b/;
const ASIN_RE = /\bB0[A-Z0-9]{8}\b/i;

/** Grade -> penalty (0-100) SQL, handling A+/A-/B+/B-/C+/C- grades too. */
function gradeCase(col) {
  return `CASE ${col} WHEN 'A+' THEN 0 WHEN 'A-' THEN 20 WHEN 'A' THEN 0 WHEN 'B+' THEN 15 WHEN 'B-' THEN 25 WHEN 'B' THEN 20 WHEN 'C+' THEN 35 WHEN 'C-' THEN 45 WHEN 'C' THEN 40 WHEN 'D' THEN 60 WHEN 'E' THEN 80 WHEN 'F' THEN 100 ELSE 50 END`;
}

/** Scoring pillars. `countKey` is the coverage column that gates inclusion. */
const PART_SPECS = [
  {
    key: 'cdq',
    weight: 30,
    label: 'CDQ content score',
    countKey: 'withCdq',
    minRatio: 0.5,
    sql: gradeCase('CdqGrade'),
  },
  {
    key: 'title',
    weight: 25,
    label: 'title grade',
    countKey: 'withTitleGrade',
    minRatio: 0.5,
    sql: gradeCase('TitleGrade'),
  },
  {
    key: 'aplus',
    weight: 20,
    label: 'missing A+ content',
    countKey: 'withAplus',
    minRatio: 0.5,
    sql: 'CASE WHEN ISNULL(HasAplus, 0) = 0 THEN 100 ELSE 0 END',
  },
  {
    key: 'lqs',
    weight: 15,
    label: 'LQS grade',
    countKey: 'withLqs',
    minRatio: 0.5,
    sql: gradeCase('LQSGrade'),
  },
  {
    key: 'thinDesc',
    weight: 10,
    label: 'thin description (<1000 chars)',
    countKey: 'fullDesc',
    minRatio: 0.3,
    sql: 'CASE WHEN ISNULL(DescLength, 0) < 1000 THEN 100 ELSE 0 END',
  },
  {
    key: 'bullets',
    weight: 10,
    label: 'bullet-point quality',
    countKey: 'withBullets',
    minRatio: 0.5,
    sql: 'CASE WHEN BulletScore IS NULL THEN 0 WHEN BulletScore < 100 THEN 100 - BulletScore ELSE 0 END',
  },
  {
    key: 'images',
    weight: 10,
    label: 'image quality',
    countKey: 'withImages',
    minRatio: 0.5,
    sql: 'CASE WHEN ImageScore IS NULL THEN 0 WHEN ImageScore < 100 THEN 100 - ImageScore ELSE 0 END',
  },
  {
    key: 'description',
    weight: 10,
    label: 'description quality',
    countKey: 'withDescription',
    minRatio: 0.5,
    sql: 'CASE WHEN DescriptionScore IS NULL THEN 0 WHEN DescriptionScore < 100 THEN 100 - DescriptionScore ELSE 0 END',
  },
];

const COVERAGE_SQL = `
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN Cdq IS NOT NULL THEN 1 ELSE 0 END) AS withCdq,
    SUM(CASE WHEN TitleScore IS NOT NULL THEN 1 ELSE 0 END) AS withTitle,
    SUM(CASE WHEN TitleGrade IS NOT NULL THEN 1 ELSE 0 END) AS withTitleGrade,
    SUM(CASE WHEN BulletScore IS NOT NULL THEN 1 ELSE 0 END) AS withBullets,
    SUM(CASE WHEN ImageScore IS NOT NULL THEN 1 ELSE 0 END) AS withImages,
    SUM(CASE WHEN DescriptionScore IS NOT NULL THEN 1 ELSE 0 END) AS withDescription,
    SUM(CASE WHEN LQSGrade IS NOT NULL THEN 1 ELSE 0 END) AS withLqs,
    SUM(CASE WHEN HasAplus IS NOT NULL THEN 1 ELSE 0 END) AS withAplus,
    SUM(CASE WHEN HasAplus IS NOT NULL AND ISNULL(HasAplus, 0) = 0 THEN 1 ELSE 0 END) AS missingAplus,
    SUM(CASE WHEN ISNULL(DescLength, 0) >= 1000 THEN 1 ELSE 0 END) AS fullDesc,
    SUM(CASE WHEN BuyBoxStatus IS NOT NULL THEN 1 ELSE 0 END) AS withBuyBox,
    SUM(CASE WHEN ISNULL(LQSGrade, '') IN ('F', 'E', 'D') THEN 1 ELSE 0 END) AS poorLqs,
    AVG(CASE WHEN TitleScore IS NOT NULL THEN TitleScore END) AS avgTitle,
    AVG(CASE WHEN BulletScore IS NOT NULL THEN BulletScore END) AS avgBullets,
    AVG(CASE WHEN ImageScore IS NOT NULL THEN ImageScore END) AS avgImages,
    AVG(CASE WHEN DescriptionScore IS NOT NULL THEN DescriptionScore END) AS avgDescription,
    AVG(CASE WHEN Cdq IS NOT NULL THEN Cdq END) AS avgCdq
FROM Asins a
WHERE 1 = 1 {sellerFilter}`;

function detectContentIntent(message) {
  const text = String(message || '');
  if (INTENT_RE.test(text)) return true;
  return !!extractSeller(text) && /listing|content|quality|title|grade|optim|fix|urger/i.test(text);
}

function extractSeller(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  const m = text.match(SELLER_RE) || text.match(SELLER_CODE_RE);
  if (m && m[1]) return m[1].replace(/\s{2,}/g, ' ').trim();
  return null;
}

function extractAsin(message) {
  const m = String(message || '').match(ASIN_RE);
  return m ? m[0].toUpperCase() : null;
}

function gradePenalty(grade) {
  const map = {
    'A+': 0, A: 0, 'A-': 20, 'B+': 15, 'B-': 25, B: 20,
    'C+': 35, 'C-': 45, C: 40, D: 60, E: 80, F: 100,
  };
  const g = String(grade || '').toUpperCase();
  return map[g] != null ? map[g] : 50;
}

function bandFor(score) {
  return BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1];
}

function trimCell(value, max = 200) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function compactArray(raw, cap) {
  if (!Array.isArray(raw)) return [];
  if (raw.length > cap) return raw.slice(0, cap).concat([`… and ${raw.length - cap} more`]);
  return raw;
}

function parseList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(raw)];
  } catch (e) {
    return [String(raw)];
  }
}

function buildDeepDive(row) {
  if (!row) return null;
  const pick = (v, cap) => compactArray(parseList(v), cap).map((s) => trimCell(s, 180));
  return {
    asin: row.AsinCode,
    title: trimCell(row.Title, 160),
    bulletPoints: compactArray(parseList(row.BulletPoints), 4).map((b) => trimCell(b, 140)),
    description: trimCell(row.ProductDescription, 240),
    descLength: row.DescLength != null ? Number(row.DescLength) : null,
    hasAplus: row.HasAplus === 1 || row.HasAplus === true ? true : row.HasAplus != null ? false : null,
    titleGrade: row.TitleGrade || 'N/A',
    lqsGrade: row.LQSGrade || 'N/A',
    cdqGrade: row.CdqGrade || 'N/A',
    buyBoxStatus: row.BuyBoxStatus || '',
    bsr: row.BSR != null ? Number(row.BSR) : null,
    price: row.CurrentPrice != null ? Number(row.CurrentPrice) : null,
    titleIssues: pick(row.TitleIssues, 5),
    titleRecommendations: pick(row.TitleRecommendations, 3),
    bulletIssues: pick(row.BulletIssues, 5),
    bulletRecommendations: pick(row.BulletRecommendations, 3),
    imageIssues: pick(row.ImageIssues, 4),
    imageRecommendations: pick(row.ImageRecommendations, 3),
    descriptionIssues: pick(row.DescriptionIssues, 5),
    descriptionRecommendations: pick(row.DescriptionRecommendations, 3),
  };
}

/**
 * Resolve a free-text seller token to a canonical Sellers record.
 * Exact match on Name or SellerId first, then a single unambiguous LIKE.
 */
async function resolveSeller(raw) {
  if (!raw) return null;
  const exact = await databaseAnalysisService.executeQuery(
    'SELECT TOP 1 s.SellerId AS id, s.Name FROM Sellers s WHERE s.Name = @s OR s.SellerId = @s',
    { s: raw },
  );
  if (exact.success && exact.data[0]) return { raw, id: exact.data[0].id, name: exact.data[0].Name, exact: true };

  const like = await databaseAnalysisService.executeQuery(
    'SELECT TOP 6 s.SellerId AS id, s.Name FROM Sellers s WHERE s.Name LIKE @like OR s.SellerId LIKE @like',
    { like: `%${raw}%` },
  );
  if (like.success && like.data.length === 1) return { raw, id: like.data[0].id, name: like.data[0].Name, exact: false };
  if (like.success && like.data.length > 1) return { raw, id: null, matches: like.data.map((r) => r.Name || r.id) };
  return { raw, id: null, matches: [] };
}

/**
 * Choose which pillars are usable given data coverage, then build the
 * normalized UrgencyScore expression (0-100).
 */
function buildScoring(coverage) {
  const total = Number(coverage.total) || 0;
  const active = PART_SPECS.filter((p) => {
    const cnt = Number(coverage[p.countKey]) || 0;
    return cnt > 0 && cnt >= total * p.minRatio;
  });
  const missing = PART_SPECS.filter((p) => !active.includes(p))
    .map((p) => p.label)
    .filter((label, i, arr) => arr.indexOf(label) === i);

  const sumWeights = active.reduce((s, p) => s + p.weight, 0);
  let urgencyExpr = null;
  if (active.length > 0) {
    const terms = active.map((p) => `((${p.sql}) * ${p.weight})`);
    urgencyExpr = `CAST((${terms.join(' + ')}) / ${sumWeights}.0 AS FLOAT)`;
  }

  // Only include rows that have at least one usable scoring field.
  const usableCols = ['TitleScore', 'LQSGrade', 'Cdq', 'BulletScore', 'ImageScore', 'DescriptionScore']
    .filter((c) => {
      const key = { TitleScore: 'withTitle', LQSGrade: 'withLqs', Cdq: 'withCdq', BulletScore: 'withBullets', ImageScore: 'withImages', DescriptionScore: 'withDescription' }[c];
      return (Number(coverage[key]) || 0) > 0;
    })
    .map((c) => `a.${c} IS NOT NULL`)
    .join(' OR ');

  return {
    active,
    weights: active.map((p) => ({ key: p.key, label: p.label, weight: p.weight })),
    sumWeights,
    urgencyExpr,
    coreFilter: usableCols ? ` AND (${usableCols})` : ' AND 1 = 1',
    missing,
  };
}

function fieldsForDeepDive() {
  return `
    AsinCode, Title, BulletPoints, ProductDescription,
    TitleScore, BulletScore, ImageScore, DescriptionScore,
    TitleIssues, TitleRecommendations,
    BulletIssues, BulletRecommendations,
    ImageIssues, ImageRecommendations,
    DescriptionIssues, DescriptionRecommendations,
    DescLength, HasAplus, TitleGrade, LQSGrade, CdqGrade,
    BuyBoxStatus, BSR, CurrentPrice`;
}

const DEEP_DIVE_SQL = `
SELECT TOP 1 ${fieldsForDeepDive()}
FROM Asins
WHERE AsinCode = @asin`;

/**
 * Run the Content Optimization Prioritization tool.
 * Returns null on hard failure to keep parity with the generic database tool.
 */
async function runContentPriorityTool(message) {
  try {
    const sellerRaw = extractSeller(message);
    let sellerId = null;
    let sellerName = null;
    let sellerMatches = null;
    if (sellerRaw) {
      const resolved = await resolveSeller(sellerRaw);
      if (resolved.id) {
        sellerId = resolved.id;
        sellerName = resolved.name || sellerRaw;
      } else if (resolved.matches && resolved.matches.length > 1) {
        sellerMatches = resolved.matches;
      }
    }

    const filter = sellerId ? ' AND a.SellerId = @sellerId' : '';
    const params = sellerId ? { sellerId } : {};

    const coverageRes = await databaseAnalysisService.executeQuery(COVERAGE_SQL.replace('{sellerFilter}', filter), params);
    const coverage = coverageRes.success && coverageRes.data[0] ? coverageRes.data[0] : {};
    const scoring = buildScoring(coverage);

    const dataNotes =
      scoring.missing.length > 0
        ? `The following scoring pillars are NOT populated for this scope and were excluded: ${scoring.missing.join(', ')}.`
        : 'All framework scoring pillars are populated.';

    if (!scoring.urgencyExpr) {
      return {
        tool: 'content_priority',
        sql: COVERAGE_SQL.replace('{sellerFilter}', filter),
        error:
          'No listing-quality fields (CDQ, title, LQS, bullets, images, description) are populated in this scope, so no urgency score can be computed.',
        dataNotes,
        health: coverage,
      };
    }

    const coreFilter = scoring.coreFilter;
    const cteHead = `
WITH ContentScores AS (
    SELECT ${fieldsForDeepDive()},
        Category, Brand, ContentQualityScore = Cdq,
        CASE WHEN HASAPLUS IS NULL THEN 'Unknown' WHEN HasAplus = 0 THEN 'MISSING' ELSE 'Present' END AS AplusStatus,
        ISNULL(DescLength, 0) AS DescLen
    FROM Asins a
    WHERE 1 = 1 ${filter}${coreFilter}
),
UrgencyCalc AS (
    SELECT *,
        ${scoring.urgencyExpr} AS UrgencyScore
    FROM ContentScores
)`;

    const prioritySql = `${cteHead}
SELECT TOP ${TOP_N}
    AsinCode, Title, Category, Brand, ContentQualityScore, CdqGrade,
    TitleGrade, LQSGrade, AplusStatus, DescLen,
    UrgencyScore
FROM UrgencyCalc
ORDER BY UrgencyScore DESC, TitleGrade ASC, AsinCode ASC`;

    const priority = await databaseAnalysisService.executeQuery(prioritySql, params);
    if (!priority.success) {
      return { tool: 'content_priority', sql: prioritySql, error: priority.error, dataNotes, health: coverage };
    }

    const tiersSql = `${cteHead}
SELECT CASE
        WHEN UrgencyScore >= 80 THEN 'critical'
        WHEN UrgencyScore >= 60 THEN 'high'
        WHEN UrgencyScore >= 40 THEN 'medium'
        ELSE 'low' END AS tier,
    COUNT(*) AS n
FROM UrgencyCalc
GROUP BY CASE
        WHEN UrgencyScore >= 80 THEN 'critical'
        WHEN UrgencyScore >= 60 THEN 'high'
        WHEN UrgencyScore >= 40 THEN 'medium'
        ELSE 'low' END`;
    const tiersRes = await databaseAnalysisService.executeQuery(tiersSql, params);

    const deepAsin = extractAsin(message) || priority.data[0]?.AsinCode;
    let deepDive = null;
    if (deepAsin) {
      const detail = await databaseAnalysisService.executeQuery(DEEP_DIVE_SQL, { asin: deepAsin });
      if (detail.success) deepDive = buildDeepDive(detail.data[0]);
    }

    const rows = priority.data.map((r) => {
      const raw = Number(r.UrgencyScore);
      const score = Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
      const band = bandFor(score);
      return {
        rank: null,
        asin: r.AsinCode,
        title: trimCell(r.Title, 60),
        category: r.Category || '',
        brand: r.Brand || '',
        cdq: r.ContentQualityScore != null ? Number(r.ContentQualityScore) : null,
        cdqGrade: r.CdqGrade || 'N/A',
        titleGrade: r.TitleGrade || 'N/A',
        lqsGrade: r.LQSGrade || 'N/A',
        aplus: r.AplusStatus || 'Unknown',
        descLength: r.DescLen != null ? Number(r.DescLen) : 0,
        urgencyScore: score,
        band: band.band,
      };
    });
    rows.forEach((r, i) => { r.rank = i + 1; });

    const tierMap = { critical: 0, high: 0, medium: 0, low: 0 };
    (tiersRes.success ? tiersRes.data : []).forEach((r) => { tierMap[r.tier] = Number(r.n) || 0; });

    return {
      tool: 'content_priority',
      sql: prioritySql,
      data: rows,
      rowCount: rows.length,
      truncated: false,
      json: JSON.stringify(rows),
      sellerId,
      sellerName,
      sellerMatches,
      weights: scoring.weights,
      sumWeights: scoring.sumWeights,
      dataNotes,
      health: coverage,
      tiers: tierMap,
      deepDive,
      deepDiveJson: deepDive ? JSON.stringify(deepDive) : null,
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  WEIGHTS,
  detectContentIntent,
  extractAsin,
  extractSeller,
  gradePenalty,
  bandFor,
  runContentPriorityTool,
};