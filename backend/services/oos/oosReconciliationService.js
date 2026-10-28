const { getPool, sql, generateId } = require('../../database/db');
const {
  classifyAvailability,
  reconcileCase,
  isVendorApplicable,
  isFresh,
  computePareto,
} = require('./oosPolicy');
const { getActivePolicy } = require('./oosPolicyService');
const incidents = require('./oosIncidentService');

// Missing-report / unknown evidence (R1/R6) is a run-level blocking exception,
// not thousands of per-ASIN incidents; only real OOS signals open incidents.
const CANDIDATE_CATEGORIES = new Set(['CONFIRMED_CHANNEL_OOS', 'DISCREPANCY']);

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function retailOpsInput(row) {
  if (!row) return { present: false, state: 'UNKNOWN', quantity: null, sourceTimestamp: null };
  let availability = row.AvailabilityStatus;
  if (row.Availability === 'OutOfStock') availability = 'Out of stock';
  else if (row.Availability === 'InStock') availability = 'In stock';
  const cls = classifyAvailability(
    { quantity: row.StockLevel, availability, status: row.ScrapeStatus },
    null,
  );
  return {
    present: true,
    state: cls.state,
    quantity: cls.quantity,
    sourceTimestamp: row.LastScrapedAt,
    raw: cls.raw,
  };
}

function observationInput(obsRow, policy) {
  if (!obsRow) return null;
  const cls = classifyAvailability(
    { quantity: obsRow.RawQuantity, availability: obsRow.RawAvailability, status: obsRow.RawStatus },
    policy,
  );
  return {
    present: true,
    state: cls.state,
    quantity: cls.quantity,
    sourceTimestamp: obsRow.SourceTimestamp,
    channel: obsRow.Channel,
    raw: cls.raw,
  };
}

async function upsertDecision(pool, { run, asin, result }) {
  const existing = await pool
    .request()
    .input('runId', sql.VarChar, run.Id)
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .input('asin', sql.VarChar, asin)
    .query(`
      SELECT TOP 1 * FROM OosDecisions
      WHERE RunId = @runId AND SellerId = @sellerId AND Channel = @channel AND AsinCode = @asin
    `);

  if (existing.recordset[0]) {
    const prior = existing.recordset[0];
    const revision = prior.Category === result.category ? prior.Revision : Number(prior.Revision) + 1;
    const updated = await pool
      .request()
      .input('id', sql.VarChar, prior.Id)
      .input('category', sql.VarChar, result.category)
      .input('ruleId', sql.VarChar, result.ruleId)
      .input('confidence', sql.Decimal(5, 2), result.confidence)
      .input('reason', sql.NVarChar, result.reason)
      .input('revision', sql.Int, revision)
      .input('evidenceJson', sql.NVarChar(sql.MAX), JSON.stringify(result.evidence))
      .query(`
        UPDATE OosDecisions SET
          Category = @category, RuleId = @ruleId, Confidence = @confidence, Reason = @reason,
          Revision = @revision, EvidenceJson = @evidenceJson, UpdatedAt = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE Id = @id
      `);
    return updated.recordset[0];
  }

  const inserted = await pool
    .request()
    .input('id', sql.VarChar, generateId())
    .input('runId', sql.VarChar, run.Id)
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .input('asin', sql.VarChar, asin)
    .input('category', sql.VarChar, result.category)
    .input('ruleId', sql.VarChar, result.ruleId)
    .input('confidence', sql.Decimal(5, 2), result.confidence)
    .input('reason', sql.NVarChar, result.reason)
    .input('evidenceJson', sql.NVarChar(sql.MAX), JSON.stringify(result.evidence))
    .query(`
      INSERT INTO OosDecisions
        (Id, RunId, SellerId, Channel, AsinCode, Category, RuleId, Confidence, Reason, Revision, EvidenceJson, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES
        (@id, @runId, @sellerId, @channel, @asin, @category, @ruleId, @confidence, @reason, 1, @evidenceJson, GETUTCDATE(), GETUTCDATE())
    `);
  return inserted.recordset[0];
}

/**
 * Persist classification metrics (PriorityGroup, IsNewAsin, GMS, etc.) to
 * OosDecisionMetrics for every decision in a run. New ASINs are always 20%.
 */
async function persistDecisionMetrics(pool, run, decisions, policy) {
  const sellerId = run.SellerId;
  const channel = run.Channel;
  const now = new Date();
  const gmsWindowDays = policy.gmsWindowDays || 30;

  // Gather GMS per ASIN from the policy service (seller-wide catalog)
  let pareto;
  try {
    const paretoResult = await require('./oosParetoService').getSellerPareto({
      sellerId, channel, pct: policy.gmsParetoPct,
    });
    pareto = paretoResult;
  } catch {
    pareto = { verified: false, tier1Asins: [], asinDetails: {} };
  }
  const tier1Asins = new Set(pareto.tier1Asins || []);
  const asinGms = new Map();
  const asinGmsShare = new Map();
  const asinCumulativePct = new Map();
  if (pareto.asinDetails) {
    for (const [asin, details] of Object.entries(pareto.asinDetails)) {
      asinGms.set(asin, details.gms ?? null);
      asinGmsShare.set(asin, details.gmsSharePct ?? null);
      asinCumulativePct.set(asin, details.cumulativePct ?? null);
    }
  }

  // Get first-seen dates from OosObservations (first RetailOps observation per ASIN)
  const firstSeenResult = await pool
    .request()
    .input('sellerId', sql.VarChar, sellerId)
    .input('channel', sql.VarChar, channel)
    .query(`
      SELECT AsinCode, MIN(SourceTimestamp) as FirstSeenAt
      FROM OosObservations
      WHERE SellerId = @sellerId AND Channel = @channel AND Source = 'RETAILOPS'
      GROUP BY AsinCode
    `);
  const firstSeenMap = new Map();
  for (const row of firstSeenResult.recordset) {
    firstSeenMap.set(row.AsinCode, row.FirstSeenAt);
  }

  for (const decision of decisions) {
    const asin = decision.AsinCode;
    const firstSeenAt = firstSeenMap.get(asin);

    // New ASINs are always 20%: first observed within the GMS window
    const isNewAsin = firstSeenAt
      ? (now.getTime() - new Date(firstSeenAt).getTime()) <= gmsWindowDays * 24 * 60 * 60 * 1000
        ? 1
        : 0
      : 0;

    let priorityGroup;
    if (isNewAsin) {
      priorityGroup = '20%';
    } else if (!pareto.verified) {
      priorityGroup = 'GMS_UNVERIFIED';
    } else if (tier1Asins.has(asin)) {
      priorityGroup = '80%';
    } else {
      priorityGroup = '20%';
    }

    const gms = asinGms.get(asin) ?? null;
    const gmsVerified = pareto.verified ? 1 : 0;
    const gmsSharePct = asinGmsShare.get(asin) ?? null;
    const cumulativePct = asinCumulativePct.get(asin) ?? null;

    const existing = await pool
      .request()
      .input('decisionId', sql.VarChar, decision.Id)
      .query('SELECT TOP 1 * FROM OosDecisionMetrics WHERE DecisionId = @decisionId');

    if (existing.recordset[0]) {
      await pool
        .request()
        .input('id', sql.VarChar, existing.recordset[0].Id)
        .input('priorityGroup', sql.VarChar, priorityGroup)
        .input('isNewAsin', sql.Bit, isNewAsin)
        .input('firstSeenAt', sql.DateTime2, firstSeenAt ?? null)
        .input('gmsVerified', sql.Bit, gmsVerified)
        .input('gms', sql.Decimal(18, 2), gms)
        .input('gmsSharePct', sql.Decimal(9, 4), gmsSharePct)
        .input('cumulativePct', sql.Decimal(9, 4), cumulativePct)
        .input('classificationVersion', sql.VarChar, policy.version)
        .input('computedAt', sql.DateTime2, now)
        .query(`
          UPDATE OosDecisionMetrics SET
            PriorityGroup = @priorityGroup, IsNewAsin = @isNewAsin,
            FirstSeenAt = @firstSeenAt, GmsVerified = @gmsVerified,
            Gms = @gms, GmsSharePct = @gmsSharePct, CumulativePct = @cumulativePct,
            ClassificationVersion = @classificationVersion,
            ComputedAt = @computedAt
            WHERE Id = @id
        `);
    } else {
      await pool
        .request()
        .input('id', sql.VarChar, generateId())
        .input('decisionId', sql.VarChar, decision.Id)
        .input('priorityGroup', sql.VarChar, priorityGroup)
        .input('isNewAsin', sql.Bit, isNewAsin)
        .input('firstSeenAt', sql.DateTime2, firstSeenAt ?? null)
        .input('gmsVerified', sql.Bit, gmsVerified)
        .input('gms', sql.Decimal(18, 2), gms)
        .input('gmsSharePct', sql.Decimal(9, 4), gmsSharePct)
        .input('cumulativePct', sql.Decimal(9, 4), cumulativePct)
        .input('classificationVersion', sql.VarChar, policy.version)
        .input('computedAt', sql.DateTime2, now)
        .query(`
          INSERT INTO OosDecisionMetrics
            (Id, DecisionId, PriorityGroup, IsNewAsin, FirstSeenAt, GmsVerified, Gms,
             GmsSharePct, CumulativePct, ClassificationVersion, ComputedAt)
          VALUES
            (@id, @decisionId, @priorityGroup, @isNewAsin, @firstSeenAt, @gmsVerified,
             @gms, @gmsSharePct, @cumulativePct, @classificationVersion, @computedAt)
        `);
    }
  }
}

/**
 * Reconcile a run: candidate union => rule matrix => decisions => durable incidents.
 * Observation rows are never mutated or coerced.
 */
async function reconcileRun(runId, { actorId } = {}) {
  const pool = await getPool();
  const runResult = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  const run = runResult.recordset[0];
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  const policy = await getActivePolicy();
  const vendorApplicable = isVendorApplicable(run.Channel, policy);

  const obsResult = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query(`
      SELECT AsinCode, Channel, Source, RawQuantity, RawAvailability, RawStatus, SourceTimestamp
      FROM OosObservations WHERE RunId = @runId AND IsValid = 1
    `);
  const obsByAsin = new Map();
  for (const row of obsResult.recordset) {
    if (!obsByAsin.has(row.AsinCode)) obsByAsin.set(row.AsinCode, {});
    obsByAsin.get(row.AsinCode)[row.Source] = row;
  }

  const candidateResult = await pool
    .request()
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .query(`
      SELECT AsinCode FROM Asins
      WHERE SellerId = @sellerId AND Marketplace = @channel AND Status = 'Active'
        AND (Availability = 'OutOfStock'
             OR LOWER(ISNULL(AvailabilityStatus, '')) LIKE '%unavailable%'
             OR LOWER(ISNULL(AvailabilityStatus, '')) LIKE '%out of stock%')
    `);

  const candidateSet = new Set(candidateResult.recordset.map((r) => r.AsinCode));
  for (const asin of obsByAsin.keys()) candidateSet.add(asin);

  const asinRows = new Map();
  for (const batch of chunk([...candidateSet], 500)) {
    const request = pool.request();
    const placeholders = batch.map((asin, i) => {
      const key = `a${i}`;
      request.input(key, sql.VarChar, asin);
      return `@${key}`;
    });
    request.input('sellerId', sql.VarChar, run.SellerId);
    request.input('channel', sql.VarChar, run.Channel);
    const rows = await request.query(`
      SELECT AsinCode, Availability, AvailabilityStatus, ScrapeStatus, StockLevel, LastScrapedAt
      FROM Asins
      WHERE SellerId = @sellerId AND Marketplace = @channel AND AsinCode IN (${placeholders.join(',')})
    `);
    for (const row of rows.recordset) asinRows.set(row.AsinCode, row);
  }

  const counts = {};
  const decisions = [];
  for (const asin of candidateSet) {
    const raw = asinRows.get(asin);
    const retailOps = retailOpsInput(raw);
    const retailFresh = isFresh(retailOps.sourceTimestamp, policy.freshnessHoursRetailOps, new Date());
    if (retailOps.present) retailOps.isFresh = retailFresh;

    const sources = obsByAsin.get(asin) || {};
    const brandCentral = observationInput(sources.BRAND_CENTRAL, policy);
    const vendor = observationInput(sources.VENDOR_CENTRAL, policy);

    const result = reconcileCase({ retailOps, brandCentral, vendor, vendorApplicable, policy });
    const decision = await upsertDecision(pool, { run, asin, result });
    decisions.push(decision);
    counts[result.category] = (counts[result.category] || 0) + 1;

    if (CANDIDATE_CATEGORIES.has(result.category)) {
      await incidents.ensureOpenIncident({
        sellerId: run.SellerId,
        sellerName: run.SellerName,
        channel: run.Channel,
        asin,
        runId: run.Id,
        actorId,
        detail: { category: result.category, ruleId: result.ruleId, reason: result.reason, evidence: result.evidence },
      });
    }
  }

  // Persist classification metrics (PriorityGroup, IsNewAsin, GMS, etc.)
  await persistDecisionMetrics(pool, run, decisions, policy);

  await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query("UPDATE OosRuns SET Status = 'RECONCILED', UpdatedAt = GETUTCDATE() WHERE Id = @id AND Status IN ('MONITORING','OPEN')");

  return { runId, analysed: candidateSet.size, counts, decisions: decisions.length };
}

async function listDecisions(runId, { category } = {}) {
  const pool = await getPool();
  const request = pool.request().input('runId', sql.VarChar, runId);
  let clause = 'WHERE RunId = @runId';
  if (category) { request.input('category', sql.VarChar, category); clause += ' AND Category = @category'; }
  const result = await request.query(`SELECT * FROM OosDecisions ${clause} ORDER BY Category, AsinCode`);
  return result.recordset;
}

module.exports = { reconcileRun, listDecisions, retailOpsInput, observationInput, CANDIDATE_CATEGORIES };
