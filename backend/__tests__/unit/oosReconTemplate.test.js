/**
 * OOS-RECON-001 is a NEW draft template. These tests lock the boundaries the
 * rebuild spec calls non-negotiable: a distinct identity, no activation, no
 * auto-assignment, an independent-reviewer requirement, and four phases with
 * exactly thirteen employee outcome activities matching the rebuild spec workflow.
 */
const {
  TASK_CODE,
  OOS_RECON_TEMPLATE,
  SUB_TASK_DEFINITIONS,
  ACTIVITY_COUNT,
} = require('../../services/pems/oosReconTemplate');
const { validateTemplateForPublish } = require('../../services/pems/pemsService');

describe('OOS-RECON-001 draft template', () => {
  it('uses a new identity, never reusing DLY-004', () => {
    expect(TASK_CODE).toBe('OOS-RECON-001');
    expect(OOS_RECON_TEMPLATE.taskCode).toBe('OOS-RECON-001');
    expect(OOS_RECON_TEMPLATE.taskCode).not.toBe('DLY-004');
  });

  it('ships inactive, non-auto-assigning, with independent review required', () => {
    expect(OOS_RECON_TEMPLATE.isActive).toBe(false);
    expect(OOS_RECON_TEMPLATE.autoAssign).toBe(false);
    expect(OOS_RECON_TEMPLATE.reviewRequired).toBe(true);
    expect(OOS_RECON_TEMPLATE.reviewerId).toBeNull();
  });

  it('has four phases and thirteen human outcome activities', () => {
    expect(SUB_TASK_DEFINITIONS).toHaveLength(4);
    expect(ACTIVITY_COUNT).toBe(13);
  });

  it('every activity states an outcome and requires evidence', () => {
    for (const phase of SUB_TASK_DEFINITIONS) {
      expect(phase.title).toBeTruthy();
      for (const a of phase.activities) {
        expect(a.title).toBeTruthy();
        expect(a.instructions.trim().length).toBeGreaterThan(20);
        expect(a.expectedOutput).toBeTruthy();
        expect(a.isMandatory).toBe(true);
        expect(a.evidenceRequired).toBe(true);
      }
    }
  });

  it('the phase titles follow the approved four-phase workflow', () => {
    expect(SUB_TASK_DEFINITIONS.map((p) => p.title)).toEqual([
      'PHASE 1: COLLECT AND VALIDATE DATA',
      'PHASE 2: RECONCILE AVAILABILITY',
      'PHASE 3: PRIORITIZE AND EXPORT',
      'PHASE 4: RESOLUTION AND GOVERNANCE',
    ]);
  });

  it('activity counts per phase match the workflow', () => {
    expect(SUB_TASK_DEFINITIONS[0].activities).toHaveLength(3); // Phase 1
    expect(SUB_TASK_DEFINITIONS[1].activities).toHaveLength(4); // Phase 2
    expect(SUB_TASK_DEFINITIONS[2].activities).toHaveLength(3); // Phase 3
    expect(SUB_TASK_DEFINITIONS[3].activities).toHaveLength(3); // Phase 4
  });

  it('passes the publish gate even though it is not published yet', () => {
    // A draft is allowed to be incomplete, but this template is complete enough
    // that it would validate cleanly — so activation later only needs signoff.
    const result = validateTemplateForPublish(OOS_RECON_TEMPLATE, {
      assignmentMode: 'manual',
      escalationHours: 12,
      approvalLevel: 'single',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});