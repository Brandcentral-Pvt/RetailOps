const {
  DEFAULT_POLICY,
  classifyAvailability,
  reconcileCase,
  resyncEligibility,
  resyncIdempotencyKey,
  applyResyncVerification,
  computePareto,
  checkSubmission,
} = require('../../services/oos/oosPolicy');

const policy = { ...DEFAULT_POLICY };
const now = new Date('2026-10-23T12:00:00Z');
const fresh = new Date('2026-10-23T11:00:00Z');
const stale = new Date('2026-10-18T11:00:00Z');

const obs = (state, quantity = null, extra = {}) => ({ state, quantity, present: true, sourceTimestamp: fresh, ...extra });

describe('OOS policy — classification (never coerce)', () => {
  it('blank/null availability is UNKNOWN, not zero and not available', () => {
    expect(classifyAvailability({}).state).toBe('UNKNOWN');
    expect(classifyAvailability({ quantity: null, availability: '' }).state).toBe('UNKNOWN');
    expect(classifyAvailability({ quantity: undefined, status: '   ' }).state).toBe('UNKNOWN');
  });

  it('a real zero quantity is OOS_ZERO; a real positive is IN_STOCK', () => {
    expect(classifyAvailability({ quantity: 0 }).state).toBe('OOS_ZERO');
    expect(classifyAvailability({ quantity: 7 }).state).toBe('IN_STOCK');
    expect(classifyAvailability({ quantity: -1 }).state).toBe('UNKNOWN');
  });

  it('maps real marketplace availability text', () => {
    expect(classifyAvailability({ availability: 'Currently unavailable.' }, policy).state).toBe('OOS');
    expect(classifyAvailability({ availability: 'OUT OF STOCK' }, policy).state).toBe('OOS');
    expect(classifyAvailability({ availability: 'Temporarily out of stock.' }, policy).state).toBe('OOS');
    expect(classifyAvailability({ status: 'AVAILABLE_DATE' }, policy).state).toBe('OOS');
    expect(classifyAvailability({ availability: 'In stock' }, policy).state).toBe('IN_STOCK');
    expect(classifyAvailability({ availability: 'ADD TO BAG' }, policy).state).toBe('IN_STOCK');
    expect(classifyAvailability({ availability: 'Available to ship in 1-2 days' }, policy).state).toBe('IN_STOCK');
  });

  it('treats "Only N left in stock" as LOW_STOCK (in stock), not OOS', () => {
    expect(classifyAvailability({ availability: 'Only 2 left in stock.' }, policy).state).toBe('LOW_STOCK');
    expect(classifyAvailability({ availability: 'Only 1 left in stock (more on the way).' }, policy).state).toBe('LOW_STOCK');
  });

  it('unknown vocabulary is UNKNOWN, never assumed available', () => {
    expect(classifyAvailability({ availability: 'some new label' }, policy).state).toBe('UNKNOWN');
  });

  it('preserves raw inputs for audit', () => {
    const c = classifyAvailability({ quantity: 3, availability: 'In stock', status: 'x' }, policy);
    expect(c.raw).toEqual({ quantity: 3, rawAvailability: 'In stock', rawStatus: 'x' });
  });
});

describe('OOS policy — reconciliation matrix', () => {
  it('no OOS signal anywhere => NO_CURRENT_OOS_SIGNAL', () => {
    const r = reconcileCase({ retailOps: obs('IN_STOCK'), brandCentral: obs('IN_STOCK', 5), vendor: obs('IN_STOCK', 4), vendorApplicable: true, policy });
    expect(r.category).toBe('NO_CURRENT_OOS_SIGNAL');
  });

  it('a zero-stock ASIN present only in a report still enters the candidate union', () => {
    const r = reconcileCase({ retailOps: obs('IN_STOCK'), brandCentral: obs('OOS_ZERO', 0), vendor: obs('IN_STOCK', 3), vendorApplicable: true, policy });
    expect(r.category).toBe('DISCREPANCY');
    expect(r.ruleId).toBe('R5');
  });

  it('missing required report => INSUFFICIENT_EVIDENCE', () => {
    const r = reconcileCase({ retailOps: obs('OOS'), brandCentral: obs('IN_STOCK', 5), vendor: null, vendorApplicable: true, policy });
    expect(r.category).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.ruleId).toBe('R1');
  });

  it('missing Vendor is fine when the channel is N/A', () => {
    const r = reconcileCase({ retailOps: obs('OOS'), brandCentral: obs('OOS_ZERO', 0), vendor: null, vendorApplicable: false, policy });
    expect(r.category).toBe('CONFIRMED_CHANNEL_OOS');
  });

  it('RetailOps unavailable + both reports positive => DISCREPANCY (not resolved)', () => {
    const r = reconcileCase({ retailOps: obs('OOS'), brandCentral: obs('IN_STOCK', 5), vendor: obs('IN_STOCK', 3), vendorApplicable: true, policy });
    expect(r.category).toBe('DISCREPANCY');
    expect(r.ruleId).toBe('R2');
  });

  it('BrandCentral positive + Vendor zero => channel disagreement, DISCREPANCY', () => {
    const r = reconcileCase({ retailOps: obs('OOS'), brandCentral: obs('IN_STOCK', 5), vendor: obs('OOS_ZERO', 0), vendorApplicable: true, policy });
    expect(r.category).toBe('DISCREPANCY');
    expect(r.ruleId).toBe('R3');
  });

  it('RetailOps unknown + report OOS => INSUFFICIENT_EVIDENCE', () => {
    const r = reconcileCase({ retailOps: obs('UNKNOWN'), brandCentral: obs('OOS_ZERO', 0), vendor: obs('IN_STOCK', 2), vendorApplicable: true, policy });
    expect(r.category).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.ruleId).toBe('R6');
  });

  it('never merges BrandCentral and Vendor quantities', () => {
    const r = reconcileCase({ retailOps: obs('OOS'), brandCentral: obs('IN_STOCK', 5), vendor: obs('IN_STOCK', 9), vendorApplicable: true, policy });
    expect(r.evidence.brandCentral.quantity).toBe(5);
    expect(r.evidence.vendor.quantity).toBe(9);
  });
});

describe('OOS policy — resync eligibility & verification', () => {
  const base = () => ({
    retailOps: { ...obs('OOS'), sourceTimestamp: fresh, channel: 'amazon.in' },
    brandCentral: { ...obs('IN_STOCK', 5), sourceTimestamp: fresh, channel: 'amazon.in' },
    vendor: { ...obs('IN_STOCK', 3), sourceTimestamp: fresh, channel: 'amazon.in' },
    vendorApplicable: true,
    channel: 'amazon.in',
    policy,
  });

  it('fresh positive quantities from both applicable reports => eligible', () => {
    expect(resyncEligibility(base(), now)).toEqual({ eligible: true, reason: expect.any(String) });
  });

  it('text-only stock is not a positive quantity => not eligible', () => {
    const input = base();
    input.brandCentral = { ...obs('IN_STOCK', null), sourceTimestamp: fresh, channel: 'amazon.in' };
    expect(resyncEligibility(input, now).eligible).toBe(false);
  });

  it('stale evidence is not eligible', () => {
    const input = base();
    input.brandCentral.sourceTimestamp = stale;
    expect(resyncEligibility(input, now).eligible).toBe(false);
  });

  it('channel N/A does not require a Vendor report', () => {
    const input = base();
    input.vendorApplicable = false;
    input.vendor = null;
    expect(resyncEligibility(input, now).eligible).toBe(true);
  });

  it('duplicate requests collapse via the idempotency key', () => {
    const k1 = resyncIdempotencyKey({ sellerId: 's1', channel: 'amazon.in', asin: 'A1', revision: 2 });
    const k2 = resyncIdempotencyKey({ sellerId: 's1', channel: 'amazon.in', asin: 'A1', revision: 2 });
    expect(k1).toBe(k2);
    expect(k1).not.toBe(resyncIdempotencyKey({ sellerId: 's1', channel: 'amazon.in', asin: 'A1', revision: 3 }));
  });

  it('an accepted request (no observation) never resolves', () => {
    const r = applyResyncVerification({ sellerId: 's1', channel: 'amazon.in', asin: 'A1', requestedAt: fresh }, {});
    expect(r.resolved).toBe(false);
    expect(r.status).toBe('OPEN_DISCREPANCY');
  });

  it('an unchanged/older observation never resolves', () => {
    const r = applyResyncVerification(
      { sellerId: 's1', channel: 'amazon.in', asin: 'A1', requestedAt: now },
      { sellerId: 's1', channel: 'amazon.in', asin: 'A1', state: 'IN_STOCK', observationTime: fresh },
    );
    expect(r.resolved).toBe(false);
  });

  it('a newer but out-of-stock observation stays open', () => {
    const later = new Date(now.getTime() + 60_000);
    const r = applyResyncVerification(
      { sellerId: 's1', channel: 'amazon.in', asin: 'A1', requestedAt: fresh },
      { sellerId: 's1', channel: 'amazon.in', asin: 'A1', state: 'OOS', observationTime: later },
    );
    expect(r.resolved).toBe(false);
    expect(r.status).toBe('OPEN_DISCREPANCY');
  });

  it('a verified newer in-stock observation resolves', () => {
    const later = new Date(now.getTime() + 60_000);
    const r = applyResyncVerification(
      { sellerId: 's1', channel: 'amazon.in', asin: 'A1', requestedAt: fresh },
      { sellerId: 's1', channel: 'amazon.in', asin: 'A1', state: 'IN_STOCK', observationTime: later },
    );
    expect(r.resolved).toBe(true);
    expect(r.status).toBe('VERIFIED_RECOVERED');
  });

  it('a scope mismatch is blocked', () => {
    const r = applyResyncVerification(
      { sellerId: 's1', channel: 'amazon.in', asin: 'A1', requestedAt: fresh },
      { sellerId: 's2', channel: 'amazon.in', asin: 'A1', state: 'IN_STOCK', observationTime: now },
    );
    expect(r.status).toBe('BLOCKED');
  });
});

describe('OOS policy — GMS Pareto', () => {
  it('picks the smallest set that reaches the 80% boundary', () => {
    // 80 / 10 / 6 / 4 = 100. 80 alone is exactly 80%.
    const rows = [{ asin: 'A', gms: 80 }, { asin: 'B', gms: 10 }, { asin: 'C', gms: 6 }, { asin: 'D', gms: 4 }];
    const p = computePareto(rows, 80);
    expect(p.verified).toBe(true);
    expect(p.tier1Asins).toEqual(['A']);
    expect(p.cumulativePct).toBe(80);
  });

  it('includes the next ASIN when 80% is not exactly reached', () => {
    const rows = [{ asin: 'A', gms: 79 }, { asin: 'B', gms: 21 }];
    const p = computePareto(rows, 80);
    expect(p.tier1Asins).toEqual(['A', 'B']);
  });

  it('no GMS at all => GMS_UNVERIFIED (never STANDARD)', () => {
    const p = computePareto([{ asin: 'A', gms: null }, { asin: 'B', gms: 0 }], 80);
    expect(p.verified).toBe(false);
    expect(p.reason).toBe('GMS_UNVERIFIED');
    expect(p.tier1Asins).toEqual([]);
  });

  it('uses the whole eligible catalog count as the denominator context', () => {
    const rows = [{ asin: 'A', gms: 100 }, { asin: 'B', gms: null }, { asin: 'C', gms: null }];
    const p = computePareto(rows, 80);
    expect(p.eligibleCount).toBe(3);
    expect(p.gmsCount).toBe(1);
    expect(p.tier1Asins).toEqual(['A']);
  });

  it('is deterministic for equal GMS values', () => {
    const rows = [{ asin: 'B', gms: 50 }, { asin: 'A', gms: 50 }];
    const p = computePareto(rows, 80);
    expect(p.tier1Asins).toHaveLength(2);
  });
});

describe('OOS policy — daily submission gate', () => {
  const fullIncident = {
    asin: 'A1', channel: 'amazon.in', ownerId: 'u1', communicationStatus: 'APPROVED',
    nextAction: 'Chase PO', followUpDate: '2026-10-24',
  };
  const complete = {
    sourcesValidated: true,
    casesMissingDisposition: 0,
    openIncidents: [fullIncident],
    exportHash: 'abc123',
    reviewerId: 'rev1',
    blockingReasons: [],
  };

  it('allows submission with open incidents that are fully owned', () => {
    expect(checkSubmission(complete).ok).toBe(true);
  });

  it('blocks when sources are neither validated nor excepted', () => {
    expect(checkSubmission({ ...complete, sourcesValidated: false, exceptionsRecorded: false }).ok).toBe(false);
  });

  it('blocks an open incident missing ownership/communication/follow-up', () => {
    const r = checkSubmission({ ...complete, openIncidents: [{ asin: 'A1', ownerId: 'u1' }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/communication status/i);
  });

  it('requires an immutable export hash', () => {
    expect(checkSubmission({ ...complete, exportHash: null }).ok).toBe(false);
  });

  it('requires an independent reviewer', () => {
    expect(checkSubmission({ ...complete, reviewerId: null }).ok).toBe(false);
  });

  it('surfaces blocking reasons', () => {
    const r = checkSubmission({ ...complete, blockingReasons: ['Vendor report rejected'] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Vendor report rejected/);
  });

  it('a case with no disposition blocks submission', () => {
    expect(checkSubmission({ ...complete, casesMissingDisposition: 3 }).ok).toBe(false);
  });
});
