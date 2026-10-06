/**
 * Content Optimization Service
 *
 * Deterministic, intent-routed tool for the AI chat. When a user asks about
 * content quality / listing optimization priorities, this runs the weighted
 * Content Optimization Prioritization Framework against `Asins` and returns a
 * complete report package (no manual SQL for the user):
 *   1. Seller health snapshot  (totals, critical, missing A+, avg scores, …)
 *   2. Urgency tier breakdown  (critical / high / medium / low counts)
 *   3. Ranked urgency table     (UrgencyScore 0-100 + band, optional seller scope)
 *   4. Deep-dive ASIN record    (concrete Issues / Recommendations so the model
 *                                can write the fix plan + rewrites)
 *
 * Only single, read-only SELECT/WITH statements are ever executed - identical
 * safety posture to the generic database_query tool.
 */

const databaseAnalysisService = require('./databaseAnalysisService');

const WEIGHTS = { cdq: 30, title: 25, aplus: 20, lqs: 15, thinDesc: 10 };
const TOP_N = 20;

const GRADE_PENALTIES = {
  F: 100, E: 80, D: 60, C: 40, B: 20, A: 0, default: 50,
};

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
  const g = String(grade || '').toUpperCase();
  return GRADE_PENALTIES[g] != null ? GRADE_PENALTIES[g] : GRADE_PENALTIES.default;
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

/** Shared CTE for the urgency framework. {sellerFilter} is injected when scoped. */
const CTE_HEAD = `
WITH ContentScores AS (
    SELECT
        a.AsinCode, a.Title, a.Category, a.Brand,
        a.Cdq AS ContentQualityScore, a.CdqGrade, a.TitleGrade, a.LQSGrade,
        a.HasAplus, a.DescLength, a.BuyBoxStatus, a.BSR, a.CurrentPrice
    FROM Asins a
    WHERE a.Cdq IS NOT NULL {sellerFilter}
),
UrgencyCalc AS (
    SELECT *,
        CASE CdqGrade WHEN 'F' THEN 100 WHEN 'E' THEN 80 WHEN 'D' THEN 60
                      WHEN 'C' THEN 40 WHEN 'B' THEN 20 WHEN 'A' THEN 0 ELSE 50 END AS CdqPenalty,
        CASE TitleGrade WHEN 'F' THEN 100 WHEN 'E' THEN 80 WHEN 'D' THEN 60
                        WHEN 'C' THEN 40 WHEN 'B' THEN 20 WHEN 'A' THEN 0 ELSE 50 END AS TitlePenalty,
        CASE LQSGrade WHEN 'F' THEN 100 WHEN 'E' THEN 80 WHEN 'D' THEN 60
                      WHEN 'C' THEN 40 WHEN 'B' THEN 20 WHEN 'A' THEN 0 ELSE 50 END AS LQSPenalty,
        CASE WHEN ISNULL(HasAplus, 0) = 0 THEN 1 ELSE 0 END AS NoAPlusFlag,
        CASE WHEN ISNULL(DescLength, 0) < 1000 THEN 1 ELSE 0 END AS ThinDescFlag
    FROM ContentScores
)`;

const PRIORITY_TAIL = `
SELECT TOP ${TOP_N}
    AsinCode, Title, Category, Brand, ContentQualityScore, CdqGrade, TitleGrade, LQSGrade,
    CASE WHEN HasAplus = 0 THEN 'MISSING' ELSE 'Present' END AS AplusStatus,
    IsNull(DescLength, 0) AS DescLength,
    ((CdqPenalty * ${WEIGHTS.cdq}) + (TitlePenalty * ${WEIGHTS.title}) +
     (NoAPlusFlag * ${WEIGHTS.aplus} * 100) + (LQSPenalty * ${WEIGHTS.lqs}) +
     (ThinDescFlag * ${WEIGHTS.thinDesc} * 100)) / 100.0 AS UrgencyScore
FROM UrgencyCalc
ORDER BY UrgencyScore DESC, CdqGrade ASC, AsinCode ASC`;

const TIERS_TAIL = `
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

const HEALTH_TAIL = `
SELECT
    COUNT(*) AS totalListings,
    SUM(CASE WHEN CdqGrade IN ('F','E','D') THEN 1 ELSE 0 END) AS criticalListings,
    SUM(CASE WHEN ISNULL(HasAplus,0) = 0 THEN 1 ELSE 0 END) AS missingAPlus,
    AVG(Cdq) AS avgCdq,
    AVG(TitleScore) AS avgTitleScore,
    SUM(CASE WHEN ISNULL(LQSGrade,'') IN ('F','E','D') THEN 1 ELSE 0 END) AS poorLqs,
    SUM(CASE WHEN ISNULL(BuyBoxStatus,0) = 0 THEN 1 ELSE 0 END) AS noBuyBox,
    SUM(CASE WHEN ISNULL(DescLength,0) < 1000 THEN 1 ELSE 0 END) AS thinDescriptions
FROM Asins a
WHERE a.Cdq IS NOT NULL {sellerFilter}`;

const DEEP_DIVE_SQL = `
SELECT TOP 1
    AsinCode, Title, BulletPoints, ProductDescription,
    TitleIssues, TitleRecommendations,
    BulletIssues, BulletRecommendations,
    ImageIssues, ImageRecommendations,
    DescriptionIssues, DescriptionRecommendations,
    DescLength, HasAplus, CdqGrade, LQSGrade,
    BuyBoxStatus, BSR, CurrentPrice
FROM Asins
WHERE AsinCode = @asin`;

function buildDeepDive(row) {
  if (!row) return null;
  const pick = (v, cap) => compactArray(parseList(v), cap).map((s) => trimCell(s, 180));
  return {
    asin: row.AsinCode,
    title: trimCell(row.Title, 160),
    bulletPoints: compactArray(parseList(row.BulletPoints), 4).map((b) => trimCell(b, 140)),
    description: trimCell(row.ProductDescription, 240),
    descLength: row.DescLength != null ? Number(row.DescLength) : 0,
    hasAplus: row.HasAplus === 1 || row.HasAplus === true,
    cdqGrade: row.CdqGrade || 'N/A',
    lqsGrade: row.LQSGrade || 'N/A',
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
 * Resolve a free-text seller token to a canonical Asins.SellerId.
 * Exact match first, then a single unambiguous LIKE match.
 */
async function resolveSeller(raw) {
  if (!raw) return null;
  const exact = await databaseAnalysisService.executeQuery(
    'SELECT TOP 1 SellerId FROM Asins WHERE SellerId = @s',
    { s: raw },
  );
  if (exact.success && exact.data[0]) return { raw, id: exact.data[0].SellerId, exact: true };

  const like = await databaseAnalysisService.executeQuery(
    'SELECT DISTINCT TOP 6 SellerId FROM Asins WHERE SellerId LIKE @s',
    { s: `%${raw}%` },
  );
  if (like.success && like.data.length === 1) return { raw, id: like.data[0].SellerId, exact: false };
  if (like.success && like.data.length > 1) {
    return { raw, id: null, matches: like.data.map((r) => r.SellerId) };
  }
  return { raw, id: null, matches: [] };
}

/**
 * Run the Content Optimization Prioritization tool.
 * Returns null on hard failure to keep parity with runDatabaseTool's
 * fall-through semantics; otherwise a complete report package.
 */
async function runContentPriorityTool(message) {
  try {
    const sellerRaw = extractSeller(message);
    let sellerId = null;
    let sellerMatches = null;
    if (sellerRaw) {
      const resolved = await resolveSeller(sellerRaw);
      if (resolved.id) {
        sellerId = resolved.id;
        if (resolved.exact) sellerRaw = resolved.id;
      } else if (resolved.matches && resolved.matches.length > 1) {
        sellerMatches = resolved.matches;
      }
    }

    const filter = sellerId ? ' AND a.SellerId = @sellerId' : '';
    const params = sellerId ? { sellerId } : {};

    const priority = await databaseAnalysisService.executeQuery(CTE_HEAD.replace('{sellerFilter}', filter) + PRIORITY_TAIL, params);
    if (!priority.success) {
      return { tool: 'content_priority', sql: CTE_HEAD + PRIORITY_TAIL, error: priority.error };
    }

    const tiers = await databaseAnalysisService.executeQuery(CTE_HEAD.replace('{sellerFilter}', filter) + TIERS_TAIL, params);
    const healthRes = await databaseAnalysisService.executeQuery(HEALTH_TAIL.replace('{sellerFilter}', filter), params);

    const deepAsin = extractAsin(message) || priority.data[0]?.AsinCode;
    let deepDive = null;
    if (deepAsin) {
      const detail = await databaseAnalysisService.executeQuery(DEEP_DIVE_SQL, { asin: deepAsin });
      if (detail.success) deepDive = buildDeepDive(detail.data[0]);
    }

    const rows = priority.data.map((r) => {
      const score = Math.round((Number(r.UrgencyScore) || 0) * 10) / 10;
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
        aplus: r.AplusStatus || (r.HasAplus ? 'Present' : 'MISSING'),
        descLength: r.DescLength != null ? Number(r.DescLength) : 0,
        urgencyScore: score,
        band: band.band,
      };
    });
    rows.forEach((r, i) => { r.rank = i + 1; });

    const tierMap = { critical: 0, high: 0, medium: 0, low: 0 };
    (tiers.success ? tiers.data : []).forEach((r) => { tierMap[r.tier] = Number(r.n) || 0; });

    const health = healthRes.success && healthRes.data[0] ? healthRes.data[0] : null;

    return {
      tool: 'content_priority',
      sql: CTE_HEAD.replace('{sellerFilter}', filter) + PRIORITY_TAIL,
      data: rows,
      rowCount: rows.length,
      truncated: false,
      json: JSON.stringify(rows),
      sellerId,
      sellerMatches,
      health,
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