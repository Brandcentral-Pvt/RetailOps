/**
 * OOS reconciliation policy — PURE engine (no I/O, no clocks of its own).
 *
 * This module encodes the rebuild spec's non-negotiables:
 *   1. Raw quantity/availability are preserved; unknown is never zero and a
 *      blank availability is never "available".
 *   2. The candidate set is the union of RetailOps unavailable, BrandCentral
 *      zero and applicable Vendor Central zero observations.
 *   3. BrandCentral and Vendor Central quantities stay separate (channel-aware).
 *   4. Both applicable reports positive + RetailOps unavailable is a MISMATCH
 *      candidate, not a resolution.
 *   5. Resync is only a candidate from fresh, positive, same-channel evidence;
 *      an accepted request never equals a recovery — only a verified newer
 *      in-stock observation does.
 *   6. GMS Pareto uses the whole eligible seller catalog; no GMS => UNVERIFIED.
 *   7. Daily submission may pass with open incidents if each is fully owned.
 *
 * Callers pass an explicit `now` (Date) so the logic is deterministic in tests.
 */

const CHANNEL = Object.freeze({
  AMAZON_IN: 'amazon.in',
  AJIO: 'ajio',
});

const DEFAULT_POLICY = Object.freeze({
  version: 'v1',
  freshnessHoursRetailOps: 24,
  freshnessHoursUpload: 48,
  gmsWindowDays: 30,
  gmsParetoPct: 80,
  oosStatuses: ['currently unavailable', 'out of stock', 'temporarily out of stock', 'available_date'],
  inStockStatuses: ['in stock', 'add to bag'],
  lowStockPattern: '^only\\s+\\d+\\s+left in stock',
  channelPolicy: {
    [CHANNEL.AMAZON_IN]: { vendorApplicable: true },
    [CHANNEL.AJIO]: { vendorApplicable: false },
  },
});

function normalizeText(v) {
  return String(v == null ? '' : v)
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/[.!]+$/, '')
    .trim();
}

function toQuantity(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePolicy(raw) {
  const p = { ...DEFAULT_POLICY, ...(raw || {}) };
  let vocab = p.oosVocabulary || null;
  if (typeof vocab === 'string') {
    try { vocab = JSON.parse(vocab); } catch { vocab = null; }
  }
  if (vocab) {
    if (Array.isArray(vocab.oosStatuses)) p.oosStatuses = vocab.oosStatuses.map(normalizeText);
    if (Array.isArray(vocab.inStockStatuses)) p.inStockStatuses = vocab.inStockStatuses.map(normalizeText);
    if (vocab.lowStockPattern) p.lowStockPattern = vocab.lowStockPattern;
  } else {
    p.oosStatuses = p.oosStatuses.map(normalizeText);
    p.inStockStatuses = p.inStockStatuses.map(normalizeText);
  }
  let chan = p.channelPolicy;
  if (typeof chan === 'string') { try { chan = JSON.parse(chan); } catch { chan = null; } }
  p.channelPolicy = chan || DEFAULT_POLICY.channelPolicy;
  p.gmsParetoPct = Number(p.gmsParetoPct) || 80;
  return p;
}

function isVendorApplicable(channel, policy) {
  return Boolean(policy?.channelPolicy?.[channel]?.vendorApplicable);
}

/**
 * Classify a raw observation. Returns a state and the untouched raw inputs.
 * States: IN_STOCK | LOW_STOCK | OOS | OOS_ZERO | UNKNOWN.
 * `quantity` is preserved; a textual "0" is not inferred.
 */
function classifyAvailability(obs = {}, policy = DEFAULT_POLICY) {
  const p = policy || DEFAULT_POLICY;
  const quantity = toQuantity(obs.quantity);
  const rawAvailability = obs.availability == null ? null : String(obs.availability);
  const rawStatus = obs.status == null ? null : String(obs.status);

  if (quantity !== null) {
    if (quantity > 0) return { state: 'IN_STOCK', quantity, raw: { quantity, rawAvailability, rawStatus } };
    if (quantity === 0) return { state: 'OOS_ZERO', quantity, raw: { quantity, rawAvailability, rawStatus } };
    return { state: 'UNKNOWN', quantity, raw: { quantity, rawAvailability, rawStatus } };
  }

  const text = normalizeText(rawAvailability || rawStatus);
  if (!text) return { state: 'UNKNOWN', quantity: null, raw: { quantity, rawAvailability, rawStatus } };

  let lowRe = null;
  try { lowRe = new RegExp(p.lowStockPattern, 'i'); } catch { lowRe = null; }
  if (lowRe && lowRe.test(text)) {
    return { state: 'LOW_STOCK', quantity: null, raw: { quantity, rawAvailability, rawStatus } };
  }
  if ((p.oosStatuses || []).includes(text)) {
    return { state: 'OOS', quantity: null, raw: { quantity, rawAvailability, rawStatus } };
  }
  if (/^available to ship/.test(text)) {
    return { state: 'IN_STOCK', quantity: null, raw: { quantity, rawAvailability, rawStatus } };
  }
  if ((p.inStockStatuses || []).includes(text)) {
    return { state: 'IN_STOCK', quantity: null, raw: { quantity, rawAvailability, rawStatus } };
  }
  return { state: 'UNKNOWN', quantity: null, raw: { quantity, rawAvailability, rawStatus } };
}

function isOos(state) {
  return state === 'OOS' || state === 'OOS_ZERO';
}

function isFresh(timestamp, hours, now) {
  if (!timestamp) return false;
  const t = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(t.getTime())) return false;
  const ageMs = (now instanceof Date ? now : new Date(now)).getTime() - t.getTime();
  return ageMs >= 0 && ageMs <= hours * 3600_000;
}

/**
 * Reconcile one (seller, channel, ASIN) case from its source observations.
 *
 * @param {object} input
 * @param {object} input.retailOps   classified observation or null
 * @param {object} input.brandCentral classified observation (present flag required)
 * @param {object} input.vendor      classified observation (present flag required)
 * @param {boolean} input.vendorApplicable
 * @param {object} input.policy
 * @returns {{category:string, ruleId:string, confidence:number, reason:string, evidence:object}}
 */
function reconcileCase(input = {}) {
  const { retailOps = null, brandCentral = null, vendor = null } = input;
  const vendorApplicable = Boolean(input.vendorApplicable);
  const policy = normalizePolicy(input.policy);

  const roOos = Boolean(retailOps && isOos(retailOps.state));
  const bcOos = Boolean(brandCentral && isOos(brandCentral.state));
  const vcOos = Boolean(vendorApplicable && vendor && isOos(vendor.state));
  const bcInStock = Boolean(brandCentral && brandCentral.state === 'IN_STOCK');
  const vcInStock = Boolean(vendor && vendor.state === 'IN_STOCK');
  const candidate = roOos || bcOos || vcOos;

  const evidence = {
    retailOps: retailOps ? { state: retailOps.state, quantity: retailOps.quantity ?? null } : null,
    brandCentral: brandCentral ? { present: !!brandCentral.present, state: brandCentral.state, quantity: brandCentral.quantity ?? null } : null,
    vendor: vendorApplicable
      ? (vendor ? { present: !!vendor.present, state: vendor.state, quantity: vendor.quantity ?? null } : null)
      : { applicable: false },
    vendorApplicable,
  };

  if (!candidate) {
    return { category: 'NO_CURRENT_OOS_SIGNAL', ruleId: 'R0', confidence: 90, reason: 'No source reports this ASIN as out of stock.', evidence };
  }

  const bcPresent = Boolean(brandCentral && brandCentral.present);
  const vcPresent = Boolean(vendorApplicable && vendor && vendor.present);
  if (!bcPresent || (vendorApplicable && !vcPresent)) {
    return {
      category: 'INSUFFICIENT_EVIDENCE',
      ruleId: 'R1',
      confidence: 60,
      reason: 'A required source report (BrandCentral/Vendor Central) is missing for this channel.',
      evidence,
    };
  }

  if (roOos) {
    if (bcInStock && (!vendorApplicable || vcInStock)) {
      return {
        category: 'DISCREPANCY',
        ruleId: 'R2',
        confidence: 85,
        reason: 'RetailOps shows unavailable while both applicable reports show stock — mismatch candidate, not resolved.',
        evidence,
      };
    }
    if (vendorApplicable && bcInStock && vcOos) {
      return {
        category: 'DISCREPANCY',
        ruleId: 'R3',
        confidence: 70,
        reason: 'BrandCentral and Vendor Central disagree for the same channel scope; keep channels separate.',
        evidence,
      };
    }
    return {
      category: 'CONFIRMED_CHANNEL_OOS',
      ruleId: 'R4',
      confidence: 80,
      reason: 'RetailOps unavailable and no applicable report shows positive stock.',
      evidence,
    };
  }

  // RetailOps is not out of stock, yet a report flags OOS.
  if (retailOps && retailOps.state === 'UNKNOWN') {
    return {
      category: 'INSUFFICIENT_EVIDENCE',
      ruleId: 'R6',
      confidence: 55,
      reason: 'RetailOps availability is unknown; an uploaded report alone cannot confirm the case.',
      evidence,
    };
  }
  return {
    category: 'DISCREPANCY',
    ruleId: 'R5',
    confidence: 75,
    reason: 'An uploaded report shows out of stock while RetailOps shows the ASIN available.',
    evidence,
  };
}

/**
 * Strict resync eligibility. Requires fresh positive *quantities* from both
 * applicable reports for the same channel, plus a fresh RetailOps unavailable.
 */
function resyncEligibility(input = {}, now = new Date()) {
  const { retailOps = null, brandCentral = null, vendor = null } = input;
  const policy = normalizePolicy(input.policy);
  const vendorApplicable = Boolean(input.vendorApplicable);

  if (!retailOps || !isOos(retailOps.state)) {
    return { eligible: false, reason: 'RetailOps is not reporting this ASIN unavailable.' };
  }
  if (!brandCentral || !brandCentral.present) {
    return { eligible: false, reason: 'BrandCentral report is missing.' };
  }
  if (vendorApplicable && (!vendor || !vendor.present)) {
    return { eligible: false, reason: 'Vendor Central report is required for this channel.' };
  }
  if (!isFresh(retailOps.sourceTimestamp, policy.freshnessHoursRetailOps, now)) {
    return { eligible: false, reason: 'RetailOps observation is stale.' };
  }
  if (!isFresh(brandCentral.sourceTimestamp, policy.freshnessHoursUpload, now)) {
    return { eligible: false, reason: 'BrandCentral report is stale.' };
  }
  if (vendorApplicable && !isFresh(vendor.sourceTimestamp, policy.freshnessHoursUpload, now)) {
    return { eligible: false, reason: 'Vendor Central report is stale.' };
  }

  const bcPositive = brandCentral.state === 'IN_STOCK' && typeof brandCentral.quantity === 'number' && brandCentral.quantity > 0;
  if (!bcPositive) {
    return { eligible: false, reason: 'BrandCentral has no positive fresh quantity (text-only stock is not enough).' };
  }
  if (vendorApplicable) {
    const vcPositive = vendor.state === 'IN_STOCK' && typeof vendor.quantity === 'number' && vendor.quantity > 0;
    if (!vcPositive) {
      return { eligible: false, reason: 'Vendor Central has no positive fresh quantity (text-only stock is not enough).' };
    }
  }
  if (input.channel && retailOps.channel && input.channel !== retailOps.channel) {
    return { eligible: false, reason: 'Channel scope mismatch; cross-channel joins are not allowed.' };
  }
  return { eligible: true, reason: 'Fresh positive quantities from all applicable reports; eligible for scoped resync.' };
}

/**
 * Build a stable idempotency key for a resync request so duplicate calls for the
 * same discrepancy revision collapse to one job.
 */
function resyncIdempotencyKey({ sellerId, channel, asin, revision }) {
  return `${sellerId}|${channel}|${asin}|r${revision || 1}`;
}

/**
 * Apply a post-sync verification to a job. An accepted request never resolves;
 * only a NEWER in-stock observation for the same scope does.
 *
 * @returns {{status:string, resolved:boolean, reason:string}}
 */
function applyResyncVerification(job = {}, verification = {}) {
  const scopeMismatch =
    (job.sellerId && verification.sellerId && job.sellerId !== verification.sellerId) ||
    (job.channel && verification.channel && job.channel !== verification.channel) ||
    (job.asin && verification.asin && job.asin !== verification.asin);
  if (scopeMismatch) {
    return { status: 'BLOCKED', resolved: false, reason: 'Verification scope does not match the requested discrepancy.' };
  }

  const requestedAt = job.requestedAt ? new Date(job.requestedAt) : null;
  const observedAt = verification.observationTime ? new Date(verification.observationTime) : null;
  if (!observedAt || Number.isNaN(observedAt.getTime())) {
    return { status: 'OPEN_DISCREPANCY', resolved: false, reason: 'No verified observation time; case remains open.' };
  }
  if (requestedAt && observedAt.getTime() <= requestedAt.getTime()) {
    return { status: 'OPEN_DISCREPANCY', resolved: false, reason: 'Observation is not newer than the request; cannot resolve.' };
  }
  if (verification.state !== 'IN_STOCK') {
    return { status: 'OPEN_DISCREPANCY', resolved: false, reason: 'Post-sync observation is not in stock; discrepancy stays open.' };
  }
  return { status: 'VERIFIED_RECOVERED', resolved: true, reason: 'A newer in-stock observation for the affected scope resolved the mismatch.' };
}

/**
 * GMS Pareto: smallest sorted set of ASINs whose cumulative GMS reaches/exceeds
 * `pct` of the seller's whole eligible catalog. Unknown/absent GMS is never
 * treated as standard — it is UNVERIFIED.
 *
 * @param {Array<{asin:string, gms:number|null}>} rows
 * @param {number} pct
 */
function computePareto(rows = [], pct = 80) {
  const clean = rows
    .map((r) => ({ asin: r.asin, gms: r.gms === null || r.gms === undefined ? null : Number(r.gms) }))
    .filter((r) => r.asin);
  const withGms = clean.filter((r) => Number.isFinite(r.gms) && r.gms > 0);
  const totalCents = withGms.reduce((s, r) => s + Math.round(r.gms * 100), 0);

  if (withGms.length === 0 || totalCents <= 0) {
    return {
      verified: false,
      reason: 'GMS_UNVERIFIED',
      tier1: [],
      tier1Asins: [],
      totalCents: 0,
      cumulativePct: 0,
      eligibleCount: clean.length,
      gmsCount: 0,
    };
  }

  const sorted = withGms.sort((a, b) => b.gms - a.gms);
  const threshold = (totalCents * Number(pct)) / 100;
  const tier1 = [];
  let cumulative = 0;
  for (const row of sorted) {
    tier1.push(row);
    cumulative += Math.round(row.gms * 100);
    if (cumulative >= threshold) break;
  }

  return {
    verified: true,
    reason: null,
    tier1,
    tier1Asins: tier1.map((r) => r.asin),
    totalCents,
    cumulativePct: Math.round((cumulative / totalCents) * 10000) / 100,
    eligibleCount: clean.length,
    gmsCount: withGms.length,
  };
}

/**
 * Daily submission gate. Open incidents are allowed while the day is submitted,
 * but EVERY open incident must carry an owner, a communication status, a next
 * action and a follow-up date. Evidence (export hash) and an independent
 * reviewer are mandatory.
 */
function checkSubmission(input = {}) {
  const errors = [];
  const openIncidents = Array.isArray(input.openIncidents) ? input.openIncidents : [];

  const sourcesOk = Boolean(input.sourcesValidated) || Boolean(input.exceptionsRecorded);
  if (!sourcesOk) errors.push('Sources must be validated, or every exception recorded.');

  const missingDisposition = Number(input.casesMissingDisposition) || 0;
  if (missingDisposition > 0) errors.push(`${missingDisposition} analysed case(s) have no disposition.`);

  for (const inc of openIncidents) {
    const label = inc.asin ? `${inc.channel || 'channel'} ${inc.asin}` : 'an open incident';
    if (!inc.ownerId) errors.push(`Open incident ${label} has no owner.`);
    if (!inc.communicationStatus) errors.push(`Open incident ${label} has no communication status.`);
    if (!inc.nextAction) errors.push(`Open incident ${label} has no next action.`);
    if (!inc.followUpDate) errors.push(`Open incident ${label} has no follow-up date.`);
  }

  if (!input.exportHash) errors.push('An immutable export (with hash) is required before submission.');
  if (!input.reviewerId) errors.push('An independent reviewer is required before submission.');

  const blocking = Array.isArray(input.blockingReasons) ? input.blockingReasons.filter(Boolean) : [];
  if (blocking.length) errors.push(...blocking.map((r) => `Blocking reason: ${r}`));

  const checklist = [
    { key: 'sources', label: 'Sources validated or exceptions recorded', ok: sourcesOk },
    { key: 'dispositions', label: 'Every analysed case has a disposition', ok: missingDisposition === 0 },
    { key: 'ownership', label: 'Every open incident has owner, communication, next action and follow-up',
      ok: openIncidents.every((i) => i.ownerId && i.communicationStatus && i.nextAction && i.followUpDate) },
    { key: 'export', label: 'Immutable export with hash', ok: Boolean(input.exportHash) },
    { key: 'reviewer', label: 'Independent reviewer named', ok: Boolean(input.reviewerId) },
    { key: 'blocking', label: 'No unresolved blocking reasons', ok: blocking.length === 0 },
  ];

  return { ok: errors.length === 0, errors, checklist };
}

module.exports = {
  CHANNEL,
  DEFAULT_POLICY,
  normalizePolicy,
  isVendorApplicable,
  classifyAvailability,
  isOos,
  isFresh,
  reconcileCase,
  resyncEligibility,
  resyncIdempotencyKey,
  applyResyncVerification,
  computePareto,
  checkSubmission,
  toQuantity,
};
