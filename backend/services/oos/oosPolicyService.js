const { getPool, sql } = require('../../database/db');
const { normalizePolicy, DEFAULT_POLICY } = require('./oosPolicy');

const POLICY_COLUMNS = `
  Version, FreshnessHoursRetailOps, FreshnessHoursUpload, GmsWindowDays,
  GmsParetoPct, OosVocabulary, ChannelPolicy, IsActive, CreatedAt
`;

let cached = null;

function mapPolicyRow(row) {
  if (!row) return normalizePolicy(DEFAULT_POLICY);
  return normalizePolicy({
    version: row.Version,
    freshnessHoursRetailOps: row.FreshnessHoursRetailOps,
    freshnessHoursUpload: row.FreshnessHoursUpload,
    gmsWindowDays: row.GmsWindowDays,
    gmsParetoPct: row.GmsParetoPct,
    oosVocabulary: row.OosVocabulary,
    channelPolicy: row.ChannelPolicy,
  });
}

async function getActivePolicy({ useCache = true } = {}) {
  if (useCache && cached) return cached;
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT TOP 1 ${POLICY_COLUMNS} FROM OosWorkflowPolicies WHERE IsActive = 1 ORDER BY CreatedAt DESC`,
  );
  cached = mapPolicyRow(result.recordset[0]);
  return cached;
}

function clearPolicyCache() {
  cached = null;
}

module.exports = { getActivePolicy, mapPolicyRow, clearPolicyCache, POLICY_COLUMNS };
