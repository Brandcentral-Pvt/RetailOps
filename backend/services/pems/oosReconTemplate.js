/**
 * OOS-RECON-001 — "OOS Monitoring & Reconciliation" draft template definition.
 *
 * PURE module (no I/O). It describes the employee-facing task only: six
 * playbook phases and twelve human outcome-confirmation activities. The heavy
 * lifting described in the rebuild spec (report intake, reconciliation engine,
 * per-seller GMS Pareto, privileged resync, durable incidents, four-sheet
 * export, submission policy) is NOT implemented here — those need services,
 * storage and UI. This template is the governed front door for that work.
 *
 * Deliberately a DRAFT:
 *   - isActive: false        → never schedulable until policies + reviewer +
 *                              test coverage + independent signoff exist
 *   - autoAssign: false      → must not auto-generate while DLY-004 is live
 *   - reviewRequired: true, reviewerId: null → independent review enforced,
 *                              reviewer to be named before activation
 *
 * It must never reuse, rewrite or deactivate DLY-004.
 */

const TASK_CODE = 'OOS-RECON-001';

/** Employee confirms an automated, read-only step produced a trustworthy outcome. */
function outcome(title, instructions, expectedOutput, extra = {}) {
  return {
    title,
    instructions: instructions.join('\n'),
    expectedOutput,
    isMandatory: true,
    evidenceRequired: true,
    ...extra,
  };
}

const SUB_TASK_DEFINITIONS = [
  {
    title: '01 Scope & snapshot',
    description: 'The system resolves the assigned sellers/channels, eligible catalog, latest raw availability and GMS snapshot (read-only).',
    expectedOutput: 'Run manifest with scope IDs and source timestamps.',
    activities: [
      outcome(
        'Verify scope and freshness',
        [
          'Open the run manifest generated for today.',
          'Confirm the assigned sellers/channels and eligible catalog match your brands — there are no missing or extra sellers.',
          'Review the freshness exception status for each source (RetailOps availability, uploaded reports, GMS).',
          'If a source is stale or missing, record the exception and its reason before continuing.',
        ],
        'Scope IDs and timestamps confirmed; every freshness exception recorded.',
      ),
      outcome(
        'Acknowledge snapshot completeness',
        [
          'Confirm the GMS period shown matches the agreed trailing window.',
          'Confirm the RetailOps unavailable count in the manifest is present (not blank).',
          'Acknowledge the snapshot so reconciliation may proceed; note any source you have flagged as unreliable.',
        ],
        'Snapshot acknowledged with GMS period and unavailable count verified.',
      ),
    ],
  },
  {
    title: '02 Report intake',
    description: 'The system stores original uploads, maps the schema, validates rows and preserves channel identities.',
    expectedOutput: 'File IDs, checksums and timestamps for every accepted report; invalid rows rejected.',
    activities: [
      outcome(
        'Upload source reports',
        [
          'Upload the BrandCentral report for each assigned seller.',
          'Upload the Vendor Central report where that channel applies; mark it explicitly N/A where it does not.',
          'Never leave a required upload blank — a blank upload is not zero stock.',
          'Wait for the server-side format check to pass for each file.',
        ],
        'Every seller has a BrandCentral file, and Vendor Central is uploaded or explicitly marked N/A.',
      ),
      outcome(
        'Resolve invalid inputs',
        [
          'Review the rows the intake validation rejected (bad SKU/ASIN, conflicting matches, missing quantity).',
          'Correct and re-upload, or move genuinely ambiguous rows to manual exception with a reason.',
          'Keep channel identities separate — do not merge BrandCentral and Vendor Central quantities.',
        ],
        'No rejected row is silently dropped; each is corrected or logged as an exception.',
      ),
    ],
  },
  {
    title: '03 Reconcile & prioritize',
    description: 'The system joins source observations, classifies, deduplicates and computes the seller-wide Pareto (read-only decisions surfaced for review).',
    expectedOutput: 'Classification decisions, GMS scoring snapshot and per-seller Tier 1 cohort.',
    activities: [
      outcome(
        'Decide ambiguous mappings and GMS-unverified cases',
        [
          'Review every case the engine could not classify with confidence.',
          'Record a reason for each manual decision (the decision is audited).',
          'Where GMS is unavailable, confirm the case is dispositioned as GMS_UNVERIFIED — never silently treated as standard.',
        ],
        'Every ambiguous and GMS-unverified case has a reasoned, audited decision.',
      ),
      outcome(
        'Confirm the priority cohort',
        [
          'Review each seller’s Tier 1 Pareto cohort (smallest set reaching ≥80% of that seller’s eligible GMS).',
          'Confirm the denominator is the entire eligible active catalog, not only OOS ASINs.',
          'Flag any seller whose cohort looks wrong before handover.',
        ],
        'Per-seller Tier 1 cohort confirmed against the full-catalog denominator.',
      ),
    ],
  },
  {
    title: '04 Marketplace verification',
    description: 'The system queues authorized targeted resync under quota/idempotency and waits for a fresh observation.',
    expectedOutput: 'Resync job ID plus pre/post status and observation times for each candidate.',
    activities: [
      outcome(
        'Act on resync results',
        [
          'Review the scoped resync candidates (RetailOps unavailable with fresh positive quantities from both applicable reports for the same channel).',
          'A request being accepted is not a recovery — only a verified newer in-stock observation resolves the mismatch.',
          'For blocked, unchanged, failed or timed-out jobs, keep the discrepancy open and record the outcome.',
        ],
        'Each candidate is either verified recovered with before/after evidence, or remains an open discrepancy.',
      ),
      outcome(
        'Handle exceptions',
        [
          'For candidates the resync could not resolve, record why (quota, unchanged, timeout).',
          'Escalate any privileged-sync failure to the authorised executor.',
          'Do not retry broadly — deduplicate against the existing job for the same discrepancy revision.',
        ],
        'Unresolved candidates carry a documented reason and an escalation where required.',
      ),
    ],
  },
  {
    title: '05 Export & handover',
    description: 'The system produces the four-tab workbook and upserts durable incidents.',
    expectedOutput: 'Export version/hash and an ownership + communication log for every open incident.',
    activities: [
      outcome(
        'Export and verify the workbook',
        [
          'Preview the four sheets (seller/channel, source manifest, incidents, resolved audit).',
          'Download the immutable export and record its version and hash.',
          'Confirm open incident IDs and follow-up dates appear in the export.',
        ],
        'Export version and hash recorded; open incidents present in the workbook.',
      ),
      outcome(
        'Assign ownership and approve communication',
        [
          'Assign an owner, a replenishment ETA and a next follow-up date to every open incident.',
          'Approve seller communication explicitly before any message is sent (no automatic seller messages).',
          'Log the communication approval and who was informed.',
        ],
        'Every open incident has an owner, ETA, follow-up date and logged communication approval.',
      ),
    ],
  },
  {
    title: '06 Review & close daily run',
    description: 'The system enforces submission completeness and records the audit event.',
    expectedOutput: 'Approval record; still-open incidents remain open.',
    activities: [
      outcome(
        'Complete the submission checklist',
        [
          'Confirm sources validated or exceptions recorded.',
          'Confirm every analysed case has a disposition and every open case has an owner and follow-up.',
          'Confirm the export ID/hash and the named independent reviewer.',
          'Resolve any blocking reason the checklist surfaces.',
        ],
        'Submission checklist complete with no unaddressed blocking reason.',
      ),
      outcome(
        'Submit for independent review',
        [
          'Submit the monitoring manifest to the independent reviewer.',
          'Record the approval (or the rejection and its reason).',
          'Close the daily run only with approval; leave every still-open incident open.',
        ],
        'Independent approval recorded; open incidents persist beyond task closure.',
      ),
    ],
  },
];

/**
 * Draft template payload for `saveTemplateConfig` / `createTemplate`.
 * Intentionally inactive and non-auto-assigning.
 */
const OOS_RECON_TEMPLATE = {
  taskCode: TASK_CODE,
  name: 'OOS Monitoring & Reconciliation',
  description: [
    'Three-source (BrandCentral + Vendor Central + RetailOps) OOS monitoring and reconciliation for assigned sellers.',
    'Employees confirm read-only automated outcomes; they never re-do the automation by hand.',
    '',
    'DRAFT: inactive and non-auto-assigning until source policies, reviewer, test coverage and independent signoff exist. DLY-004 remains untouched.',
  ].join('\n'),
  category: 'INVENTORY',
  department: 'Brand Managers',
  frequency: 'DAILY',
  priority: 'HIGH',
  targetType: 'NUMERIC',
  defaultTarget: 0,
  slaHours: 8,
  tatHours: 8,
  dueTime: '12:00',
  runDays: '1,2,3,4,5,6',
  brandMode: 'CHECKLIST',
  estimatedExecutionMinutes: 55, // per brand; pending acceptance
  autoAssign: false,             // never auto-generate while DLY-004 is live
  isActive: false,               // draft only — must not be schedulable
  reviewRequired: true,
  reviewerId: null,              // to be named before activation
  assigneeRole: 'brand_manager',
  expectedOutput: 'Scope verified, sources validated or excepted, cases reconciled and prioritised, resyncs verified, workbook exported, and open incidents owned with follow-ups — all under independent review.',
  subTaskDefinitions: SUB_TASK_DEFINITIONS,
  tags: ['oos', 'reconciliation', 'pilot', TASK_CODE],
};

const ACTIVITY_COUNT = SUB_TASK_DEFINITIONS.reduce((n, p) => n + p.activities.length, 0);

module.exports = {
  TASK_CODE,
  OOS_RECON_TEMPLATE,
  SUB_TASK_DEFINITIONS,
  ACTIVITY_COUNT,
};
