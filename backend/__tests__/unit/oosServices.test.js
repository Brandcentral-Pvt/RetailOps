const { makeFakePool } = require('../../testUtils/fakePool');
const XLSX = require('xlsx');

let mockPool;
let mockId = 0;

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => mockPool,
  generateId: () => `id-${++mockId}`,
  withTransaction: async (fn) => fn(mockPool),
}));

const { clearPolicyCache } = require('../../services/oos/oosPolicyService');
const { normalizeRows } = require('../../services/oos/oosUploadService');
const incidents = require('../../services/oos/oosIncidentService');
const sync = require('../../services/oos/oosSyncService');
const exportsService = require('../../services/oos/oosExportService');
const submission = require('../../services/oos/oosSubmissionService');

const run = {
  Id: 'run-1', SellerId: 'seller-1', SellerName: 'Acme', Channel: 'amazon.in',
  RunDate: '2026-10-23', Status: 'RECONCILED', PolicyVersion: 'v1',
  CreatedBy: 'preparer', ManifestJson: '{"eligibleActiveAsins":10}',
};

beforeEach(() => {
  clearPolicyCache();
  mockId = 0;
  mockPool = makeFakePool();
});

describe('upload normalisation', () => {
  it('preserves a missing quantity as null (never 0) and records invalid ASINs', () => {
    const { rows, invalid } = normalizeRows([
      { asin: 'B00GOOD123', quantity: null, availability: 'Currently unavailable.' },
      { asin: 'not-an-asin', quantity: 0 },
      { asin: '', quantity: 4 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBeNull();
    expect(invalid.map((r) => r.invalidReason)).toEqual(['INVALID_ASIN', 'MISSING_ASIN']);
    expect(rows).toHaveLength(1);
    expect(validCount(rows)).toBe(1);

    function validCount(list) { return list.filter((r) => !r.invalidReason).length; }
  });

  it('deduplicates by ASIN, preferring the row with a real quantity', () => {
    const { rows } = normalizeRows([
      { asin: 'B00GOOD123', quantity: null, availability: 'In stock' },
      { asin: 'B00GOOD123', quantity: 7, availability: 'In stock' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(7);
  });

  it('accepts alternate column names through a mapping', () => {
    const { rows } = normalizeRows(
      [{ 'ASIN Code': 'B00GOOD123', 'Stock Level': '3', 'Stock Status': 'Only 3 left in stock.' }],
      {},
    );
    expect(rows[0].asin).toBe('B00GOOD123');
    expect(rows[0].quantity).toBe(3);
  });
});

describe('durable incidents', () => {
  it('appends evidence instead of duplicating an open incident', async () => {
    const open = { Id: 'inc-1', SellerId: 's1', Channel: 'amazon.in', AsinCode: 'A1', Status: 'OPEN' };
    mockPool = makeFakePool([
      { match: /FROM OosIncidents\s+WHERE SellerId = @sellerId AND Channel = @channel AND AsinCode = @asin/, rows: [open] },
    ]);
    const result = await incidents.ensureOpenIncident({
      sellerId: 's1', channel: 'amazon.in', asin: 'A1', runId: 'run-1', detail: { category: 'DISCREPANCY' },
    });
    expect(result.created).toBe(false);
    expect(result.incident.Id).toBe('inc-1');
    expect(mockPool.callWhere(/INSERT INTO OosIncidents/)).toBeNull();
    const evidence = mockPool.callWhere(/INSERT INTO OosIncidentEvents/);
    expect(evidence.inputs.eventType).toBe('EVIDENCE');
  });

  it('creates one incident + OPENED event when none is open', async () => {
    mockPool = makeFakePool([
      { match: /FROM OosIncidents\s+WHERE SellerId = @sellerId AND Channel = @channel AND AsinCode = @asin/, rows: [] },
      { match: /INSERT INTO OosIncidents/, rows: [{ Id: 'id-1', Status: 'OPEN' }] },
    ]);
    const result = await incidents.ensureOpenIncident({ sellerId: 's1', channel: 'amazon.in', asin: 'A1' });
    expect(result.created).toBe(true);
    expect(mockPool.callWhere(/INSERT INTO OosIncidentEvents/).inputs.eventType).toBe('OPENED');
  });
});

const asinOos = {
  AsinCode: 'A1', Availability: 'OutOfStock', AvailabilityStatus: 'Currently unavailable.',
  ScrapeStatus: 'COMPLETED', StockLevel: null, LastScrapedAt: new Date(),
};
const freshObs = (source, qty) => ({
  Source: source, Channel: 'amazon.in', RawQuantity: qty,
  RawAvailability: null, RawStatus: null, SourceTimestamp: new Date(),
});

function resyncPool({ existingJob = null, asin = asinOos, observations = [freshObs('BRAND_CENTRAL', 5), freshObs('VENDOR_CENTRAL', 3)] } = {}) {
  return makeFakePool([
    { match: /FROM OosRuns WHERE Id = @id/, rows: [run] },
    { match: /FROM Asins WHERE SellerId = @sellerId AND Marketplace = @channel AND AsinCode = @asin/, rows: [asin] },
    { match: /FROM OosObservations WHERE RunId = @runId AND AsinCode = @asin/, rows: observations },
    { match: /FROM OosDecisions/, rows: [{ Id: 'dec-1', Category: 'DISCREPANCY', Revision: 2 }] },
    { match: /FROM OosResyncJobs WHERE IdempotencyKey = @key/, rows: existingJob ? [existingJob] : [] },
    { match: /INSERT INTO OosResyncJobs/, rows: [{ Id: 'job-1', Status: 'QUEUED' }] },
  ]);
}

describe('resync', () => {
  it('collapses duplicate requests on the idempotency key', async () => {
    mockPool = resyncPool({ existingJob: { Id: 'job-old', Status: 'QUEUED' } });
    const result = await sync.requestResync({ runId: 'run-1', asin: 'A1', requestedBy: 'u1' });
    expect(result.created).toBe(false);
    expect(result.job.Id).toBe('job-old');
    expect(mockPool.callWhere(/INSERT INTO OosResyncJobs/)).toBeNull();
  });

  it('refuses a resync when evidence is not fresh/positive', async () => {
    mockPool = resyncPool({ asin: { ...asinOos, Availability: 'InStock', AvailabilityStatus: 'In stock' }, observations: [] });
    await expect(sync.requestResync({ runId: 'run-1', asin: 'A1' })).rejects.toMatchObject({
      status: 422, code: 'RESYNC_NOT_ELIGIBLE',
    });
  });

  it('accepting a request alone never resolves the discrepancy', async () => {
    mockPool = makeFakePool([
      { match: /FROM OosResyncJobs WHERE Id = @id/, rows: [{ Id: 'job-1', SellerId: 's1', Channel: 'amazon.in', AsinCode: 'A1', RunId: 'run-1', CreatedAt: new Date('2026-10-23T10:00:00Z') }] },
    ]);
    const result = await sync.verifyResync('job-1', { state: 'IN_STOCK' }, 'u1');
    expect(result.resolved).toBe(false);
    expect(result.status).toBe('OPEN_DISCREPANCY');
    const update = mockPool.callWhere(/UPDATE OosResyncJobs/);
    expect(update.inputs.status).toBe('OPEN_DISCREPANCY');
  });

  it('resolves only on a newer verified in-stock observation', async () => {
    mockPool = makeFakePool([
      { match: /FROM OosResyncJobs WHERE Id = @id/, rows: [{ Id: 'job-1', SellerId: 's1', Channel: 'amazon.in', AsinCode: 'A1', RunId: 'run-1', CreatedAt: new Date('2026-10-23T10:00:00Z') }] },
      { match: /SELECT TOP 1 Id FROM OosIncidents/, rows: [{ Id: 'inc-1' }] },
      { match: /FROM OosIncidents WHERE Id = @id/, rows: [{ Id: 'inc-1', Status: 'OPEN' }] },
    ]);
    const result = await sync.verifyResync('job-1', {
      state: 'IN_STOCK', observationTime: new Date('2026-10-23T11:00:00Z'),
    }, 'u1');
    expect(result.resolved).toBe(true);
    expect(result.status).toBe('VERIFIED_RECOVERED');
    expect(result.incidentResolved).toBe(true);
  });
});

describe('immutable export', () => {
  function exportPool() {
    return makeFakePool([
      { match: /FROM OosRuns WHERE Id = @id/, rows: [run] },
      { match: /FROM OosDecisions WHERE RunId = @runId/, rows: [{ AsinCode: 'A1', Category: 'DISCREPANCY', RuleId: 'R2', Confidence: 85, Revision: 1, Reason: 'x', EvidenceJson: '{}' }] },
      { match: /FROM OosImports WHERE RunId = @runId/, rows: [{ Id: 'imp-1', SourceType: 'BRAND_CENTRAL', TotalRows: 2, AcceptedCount: 2, RejectedCount: 0, Status: 'VALIDATED', FileHash: 'h' }] },
      { match: /FROM OosIncidents WHERE SellerId = @sellerId AND Channel = @channel/, rows: [{ Id: 'inc-1', AsinCode: 'A1', Status: 'OPEN', OwnerId: 'u1' }] },
      { match: /FROM OosResyncJobs WHERE RunId = @runId/, rows: [] },
      { match: /ISNULL\(MAX\(Version\), 0\) AS MaxVersion/, rows: [{ MaxVersion: 1 }] },
      { match: /INSERT INTO OosExports/, rows: [{ Id: 'exp-1', Version: 2, FileHash: 'abc' }] },
    ]);
  }

  it('always produces the four required sheets with a stable hash', async () => {
    mockPool = exportPool();
    const a = await exportsService.buildExport('run-1', { createdBy: 'u1' });
    const hashA = a.fileHash;
    mockPool = exportPool();
    const b = await exportsService.buildExport('run-1', { createdBy: 'u1' });
    expect(a.sheets.map((s) => s.name)).toEqual([
      'Seller Summary', 'Source Manifest', 'Incidents & Follow-ups', 'Resolved Audit',
    ]);
    expect(a.sheets).toHaveLength(4);
    expect(b.fileHash).toBe(hashA);
    expect(a.version).toBe(2);
  });

  it('renders the export as a real four-tab workbook', () => {
    const content = JSON.stringify({
      sheets: [
        { name: 'Seller Summary', rows: [{ seller: 'Acme', asinCount: 2 }] },
        { name: 'Source Manifest', rows: [{ source: 'BRAND_CENTRAL' }] },
        { name: 'Incidents & Follow-ups', rows: [{ asin: 'A1', owner: 'u1' }] },
        { name: 'Resolved Audit', rows: [{ kind: 'RESYNC', status: 'VERIFIED_RECOVERED' }] },
      ],
    });
    const buffer = exportsService.buildWorkbookBuffer(content);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual([
      'Seller Summary', 'Source Manifest', 'Incidents & Follow-ups', 'Resolved Audit',
    ]);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('daily submission gate', () => {
  const owned = {
    AsinCode: 'A1', OwnerId: 'u1', CommunicationStatus: 'APPROVED',
    NextAction: 'Chase PO', FollowUpDate: '2026-10-24',
  };

  function submissionPool({ openIncidents = [owned], exportRow = { Version: 2, FileHash: 'hash-1' } } = {}) {
    return makeFakePool([
      { match: /FROM OosRuns WHERE Id = @id/, rows: [run] },
      { match: /AS Missing/, rows: [{ Missing: 0 }] },
      { match: /FROM OosImports WHERE RunId = @runId/, rows: [{ Id: 'imp-1', Status: 'VALIDATED' }] },
      { match: /FROM OosIncidents WHERE SellerId = @sellerId AND Channel = @channel AND Status = 'OPEN'/, rows: openIncidents },
      { match: /FROM OosExports WHERE RunId = @runId ORDER BY Version DESC/, rows: exportRow ? [exportRow] : [] },
      { match: /INSERT INTO OosSubmissionReviews/, rows: [{ Id: 'rev-1', Status: 'APPROVED' }] },
    ]);
  }

  it('closes the day while fully-owned open incidents persist', async () => {
    mockPool = submissionPool();
    const result = await submission.submitRun('run-1', { reviewerId: 'reviewer-1', actorId: 'u1' });
    expect(result.ok).toBe(true);
    expect(result.runStatus).toBe('CLOSED');
    expect(result.openIncidents).toBe(1);
    expect(mockPool.callWhere(/UPDATE OosRuns SET Status = 'CLOSED'/)).not.toBeNull();
  });

  it('blocks when an open incident has no owner/communication/follow-up', async () => {
    mockPool = submissionPool({ openIncidents: [{ AsinCode: 'A1', OwnerId: 'u1' }] });
    const result = await submission.submitRun('run-1', { reviewerId: 'reviewer-1' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/communication status/i);
    expect(mockPool.callWhere(/UPDATE OosRuns SET Status = 'CLOSED'/)).toBeNull();
  });

  it('requires a reviewer independent of the preparer', async () => {
    mockPool = submissionPool();
    const result = await submission.submitRun('run-1', { reviewerId: 'preparer' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/independent/i);
  });

  it('blocks when no immutable export exists', async () => {
    mockPool = submissionPool({ exportRow: null });
    const result = await submission.submitRun('run-1', { reviewerId: 'reviewer-1' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/export/i);
  });
});
