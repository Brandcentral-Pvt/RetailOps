/**
 * Content Optimization Service
 *
 * Determinstic, intent-routed tool for the AI chat. When a user asks about
 * content quality / listing optimization priorities, this runs the weighted
 * Content Optimization Prioritization Framework against `Asins` and returns:
 *   1. A ranked urgency table (UrgencyScore 0-100 + band)
 *   2. A deep-dive record for the most urgent ASIN (or one mentioned in chat)
 *      with its concrete Issues / Recommendations so the model can generate
 *      rewritten title / bullets / description instead of generic advice.
 *
 * Only single, read-only SELECT/WITH statements are ever executed - identical
 * safety posture to the generic database_query tool.
 */

const databaseAnalysisService = require('./databaseAnalysisService');

const WEIGHTS = { cdq: 30, title: 25, aplus: 20, lqs: 15, thinDesc: 10 };
const TOP_N = 20;

const GRADE_PENALTIES = {
  F: 100,
  E: 80,
  D: 60,
  C: 40,
  B: 20,
  A: 0,
  default: 50,
};

const BANDS = [
  { min: 80, band: 'critical', label: '🔴 CRITICAL' },
  { min: 60, band: 'high', label: '🟠 HIGH' },
  { min: 40, band: 'medium', label: '🟡 MEDIUM' },
  { min: 0, band: 'low', label: '🟢 LOW' },
];

const INTENT_RE = /content\s*optim|content\s*quality|cdq|urgency|urgent|prioriti[sz]|what\s*(should|to)\s*fix|fix.*listing|listing.*fix|improve.*listing|optimiz.*listing|listing.*quality|title\s*grade|title\s*score|a\+|aplus|a-plus|missing.*\ba\b|thin.*description|rewrite.*(title|bullet)|bullet.*(improv|rewrite)|grade\s*[def]/i;

const ASIN_RE = /\bB0[A-Z0-9]{8}\b/i;

function detectContentIntent(message) {
  return INTENT_RE.test(String(message || ''));
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

/**
 * Compact a raw cell for prompt injection (bounded length).
 */
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

const PRIORITY_SQL = `
WITH ContentScores AS (
    SELECT
        a.AsinCode,
        a.Title,
        a.Category,
        a.Brand,
        a.Cdq AS ContentQualityScore,
        a.CdqGrade,
        a.TitleGrade,
        a.LQSGrade,
        a.HasAplus,
        a.DescLength,
        a.BuyBoxStatus,
        a.BSR,
        a.CurrentPrice
    FROM Asins a
    WHERE a.Cdq IS NOT NULL
),
UrgencyCalc AS (
    SELECT
        *,
        CASE CdqGrade WHEN 'F' THEN 100 WHEN 'E' THEN 80 WHEN 'D' THEN 60
                      WHEN 'C' THEN 40 WHEN 'B' THEN 20 WHEN 'A' THEN 0 ELSE 50 END AS CdqPenalty,
        CASE TitleGrade WHEN 'F' THEN 100 WHEN 'E' THEN 80 WHEN 'D' THEN 60
                        WHEN 'C' THEN 40 WHEN 'B' THEN 20 WHEN 'A' THEN 0 ELSE 50 END AS TitlePenalty,
        CASE LQSGrade WHEN 'F' THEN 100 WHEN 'E' THEN 80 WHEN 'D' THEN 60
                      WHEN 'C' THEN 40 WHEN 'B' THEN 20 WHEN 'A' THEN 0 ELSE 50 END AS LQSPenalty,
        CASE WHEN ISNULL(HasAplus, 0) = 0 THEN 1 ELSE 0 END AS NoAPlusFlag,
        CASE WHEN ISNULL(DescLength, 0) < 1000 THEN 1 ELSE 0 END AS ThinDescFlag
    FROM ContentScores
)
SELECT TOP ${TOP_N}
    AsinCode,
    Title,
    Category,
    Brand,
    ContentQualityScore,
    CdqGrade,
    TitleGrade,
    LQSGrade,
    CASE WHEN HasAplus = 0 THEN 'MISSING' ELSE 'Present' END AS AplusStatus,
    IsNull(DescLength, 0) AS DescLength,
    ((CdqPenalty * ${WEIGHTS.cdq}) + (TitlePenalty * ${WEIGHTS.title}) +
     (NoAPlusFlag * ${WEIGHTS.aplus} * 100) + (LQSPenalty * ${WEIGHTS.lqs}) +
     (ThinDescFlag * ${WEIGHTS.thinDesc} * 100)) / 100.0 AS UrgencyScore
FROM UrgencyCalc
ORDER BY UrgencyScore DESC, CdqGrade ASC`;

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
 * Run the Content Optimization Prioritization tool.
 * Returns null when the query fails to keep parity with runDatabaseTool's
 * fall-through semantics; otherwise the tool result with sql/data/deepDive.
 */
async function runContentPriorityTool(message) {
  try {
    const priority = await databaseAnalysisService.executeQuery(PRIORITY_SQL);
    if (!priority.success) {
      return { tool: 'content_priority', sql: PRIORITY_SQL, error: priority.error };
    }

    const deepAsin = extractAsin(message) || priority.data[0]?.AsinCode;
    const deepUnknown = !deepAsin;
    let deepDive = null;
    if (deepAsin) {
      const detail = await databaseAnalysisService.executeQuery(DEEP_DIVE_SQL, { asin: deepAsin });
      if (detail.success) {
        deepDive = buildDeepDive(detail.data[0]);
      }
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

    const json = JSON.stringify(rows);
    return {
      tool: 'content_priority',
      sql: PRIORITY_SQL,
      data: rows,
      rowCount: rows.length,
      truncated: false,
      json,
      deepDive,
      deepDiveJson: deepDive ? JSON.stringify(deepDive) : null,
      deepUnknown,
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  WEIGHTS,
  detectContentIntent,
  extractAsin,
  gradePenalty,
  bandFor,
  runContentPriorityTool,
};