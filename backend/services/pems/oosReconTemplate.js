/**
 * OOS-RECON-001 — "OOS Monitoring & Reconciliation" draft template definition.
 *
 * PURE module (no I/O). It describes the employee-facing task only: four
 * playbook phases matching the rebuild spec workflow, with outcome-confirmation
 * activities. The heavy lifting (report intake, reconciliation engine,
 * per-seller GMS Pareto, privileged resync, durable incidents, four-sheet
 * export, submission policy) is implemented in backend services; this template
 * is the governed front door for that work.
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
    title: 'PHASE 1: COLLECT AND VALIDATE DATA',
    description: 'RetailOps resolves sellers/channels/active ASINs and retrieves the latest availability snapshot + GMS; employee uploads BrandCentral and applicable Vendor Central reports; system validates coverage, freshness and required fields; candidate union built from RetailOps unavailable OR BrandCentral zero OR Vendor Central zero.',
    expectedOutput: 'Validated scope manifest, accepted reports with timestamps, candidate ASIN set.',
    activities: [
      outcome(
        'Verify RetailOps scope and snapshot',
        [
          'Open the run manifest generated for today — confirm assigned sellers, marketplace channels and active ASIN count.',
          'Review the RetailOps availability snapshot: unavailable ASINs and GMS period match the agreed window.',
          'If the snapshot is stale or incomplete, record the freshness exception and reason before continuing.',
        ],
        'Scope IDs, freshness timestamps and unavailable count confirmed; any exceptions recorded.',
      ),
      outcome(
        'Upload and validate source reports',
        [
          'Upload the BrandCentral inventory report for each assigned seller.',
          'Upload the Vendor Central report where that channel applies; explicitly mark N/A where it does not.',
          'A blank upload is not zero stock — never leave a required report blank.',
          'Wait for server-side format validation: file coverage, seller mapping, required fields, freshness.',
        ],
        'Every seller has a BrandCentral file; Vendor Central is uploaded or explicitly N/A; all files pass validation.',
      ),
      outcome(
        'Confirm candidate union',
        [
          'Verify the system built the candidate set from: RetailOps unavailable OR BrandCentral zero stock OR applicable Vendor Central zero stock.',
          'Confirm no candidate was silently dropped and that channel quantities (BrandCentral vs Vendor Central) remain separate.',
          'If any mapping is ambiguous, flag it for manual exception with a reason.',
        ],
        'Candidate ASIN set confirmed; channel quantities kept separate; exceptions documented.',
      ),
    ],
  },
  {
    title: 'PHASE 2: RECONCILE AVAILABILITY',
    description: 'System joins source observations, classifies each candidate and surfaces read-only decisions. Employee reviews and confirms — never re-does the automation.',
    expectedOutput: 'Classification decisions (Confirmed OOS / Resync candidate / Unverified-Conflict) audited with reasons.',
    activities: [
      outcome(
        'Review Confirmed Channel OOS',
        [
          'For cases where RetailOps unavailable AND no applicable report shows positive stock → Confirmed Channel OOS.',
          'Confirm the channel is identified and source evidence (RetailOps + BC/VC) is retained.',
          'If evidence disagrees, record why the case still qualifies as confirmed.',
        ],
        'Each Confirmed Channel OOS has channel identified and evidence preserved.',
      ),
      outcome(
        'Act on Resync Candidates',
        [
          'For cases where RetailOps unavailable BUT both applicable reports show fresh positive stock → Resync Candidate.',
          'Queue one controlled marketplace resync per candidate; log request ID, time and pre-status.',
          'Wait for fresh post-sync RetailOps observation — an accepted request is NOT a recovery.',
        ],
        'Each Resync Candidate has a queued job ID with pre-status; outcome pending verification.',
      ),
      outcome(
        'Verify Resync Results',
        [
          'A verified newer in-stock observation resolves the mismatch — record before/after audit and omit from active OOS.',
          'If resync is unavailable, failed, timed out or status unchanged → keep discrepancy open; record why.',
          'Deduplicate against the existing job for the same discrepancy revision — do not retry broadly.',
        ],
        'Every Resync Candidate is either verified recovered (with evidence) or remains an open discrepancy with a documented reason.',
      ),
      outcome(
        'Disposition Unverified / Conflict Cases',
        [
          'For missing, stale or divergent evidence → Unverified / Conflict.',
          'Request manual check; record a reasoned decision for each (the decision is audited).',
          'Never silently treat GMS-unavailable cases as standard — confirm GMS_UNVERIFIED disposition.',
        ],
        'Every Unverified/Conflict case has an audited, reasoned decision.',
      ),
    ],
  },
  {
    title: 'PHASE 3: PRIORITIZE AND EXPORT',
    description: 'System deduplicates OPEN OOS + OPEN discrepancies per seller + channel + ASIN; computes seller-wide GMS Pareto (80% threshold, full catalog denominator); produces the immutable 4-tab workbook.',
    expectedOutput: 'Tier 1 Pareto cohorts confirmed; 4-tab workbook exported with hash; open incidents upserted with ownership fields.',
    activities: [
      outcome(
        'Confirm deduplication and Pareto',
        [
          'Review OPEN OOS + OPEN discrepancies deduplicated per seller + channel + ASIN.',
          'Confirm each seller\'s Tier 1 cohort: smallest set reaching ≥80% of that seller\'s entire eligible GMS (full catalog denominator).',
          'If GMS is unavailable for a seller, confirm the cohort is marked GMS_UNVERIFIED — never silently low priority.',
        ],
        'Per-seller Tier 1 cohorts confirmed against full-catalog denominator; GMS_UNVERIFIED flagged.',
      ),
      outcome(
        'Export and verify the 4-tab workbook',
        [
          'Preview the four sheets: (1) Seller/channel summary, (2) Source manifest, (3) Incidents & follow-ups, (4) Resolved audit.',
          'Download the immutable export; record its version and SHA-256 hash.',
          'Confirm open incident IDs, owners and follow-up dates appear in the Incidents tab.',
        ],
        'Export version/hash recorded; workbook contains all required tabs and open incident data.',
      ),
      outcome(
        'Assign ownership and seller communication',
        [
          'Assign an owner, a replenishment ETA and a next follow-up date to every open incident.',
          'Approve seller communication explicitly before any message is sent (no automatic seller messages).',
          'Log the communication approval, who was informed and when.',
        ],
        'Every open incident has an owner, ETA, follow-up date and logged communication approval.',
      ),
    ],
  },
  {
    title: 'PHASE 4: RESOLUTION AND GOVERNANCE',
    description: 'Employee validates affected ASINs, assigns owners and seller communication actions; periodic verified stock refresh; close on verified restore; submit with independent review; open incidents persist.',
    expectedOutput: 'Incidents resolved only on fresh verified stock; daily run submitted and closed under independent review; open incidents remain tracked.',
    activities: [
      outcome(
        'Validate affected ASINs and assign actions',
        [
          'Confirm each open incident has an owner, communication status, next action and follow-up date.',
          'Record seller replenishment ETA; update communication status as messages are approved/sent.',
        ],
        'All open incidents fully owned with ETA, next action and follow-up.',
      ),
      outcome(
        'Periodic verified stock refresh',
        [
          'For each open incident, trigger a controlled re-verification (fresh post-sync RetailOps observation).',
          'Only a verified newer in-stock observation for the same scope closes the incident — preserve before/after audit.',
          'If stock not restored, keep incident OPEN; follow up or escalate per approved policy.',
        ],
        'Incidents closed only on fresh verified in-stock evidence; unresolved incidents remain OPEN with documented reason.',
      ),
      outcome(
        'Submit daily monitoring report and outstanding-incident handover',
        [
          'Complete the submission checklist: sources validated/exceptions recorded, every analysed case has a disposition, every open incident has owner+communication+next action+follow-up, export hash recorded, independent reviewer named, no blocking reasons.',
          'Submit to the independent reviewer (must differ from the preparer).',
          'Close the daily run ONLY with approval; leave every still-open incident OPEN and tracked for next cycle.',
        ],
        'Independent approval recorded; daily run closed; open incidents persist beyond task closure.',
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
    'Four-phase OOS monitoring and reconciliation (Collect & Validate → Reconcile → Prioritize & Export → Resolution & Governance).',
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
  expectedOutput: 'Scope verified, sources validated or excepted, cases reconciled and prioritised, resyncs verified, workbook exported, open incidents owned with follow-ups — all under independent review.',
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