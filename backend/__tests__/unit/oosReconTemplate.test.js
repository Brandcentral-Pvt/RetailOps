/**
 * OOS-RECON-001 is a NEW draft template. These tests lock the boundaries the
 * rebuild spec calls non-negotiable: a distinct identity, no activation, no
 * auto-assignment, an independent-reviewer requirement, and six phases with
 * exactly twelve employee outcome activities.
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

  it('has six phases and twelve human outcome activities', () => {
    expect(SUB_TASK_DEFINITIONS).toHaveLength(6);
    expect(ACTIVITY_COUNT).toBe(12);
    for (const phase of SUB_TASK_DEFINITIONS) {
      expect(phase.activities).toHaveLength(2);
    }
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

  it('the phase titles follow the approved six-phase playbook', () => {
    expect(SUB_TASK_DEFINITIONS.map((p) => p.title)).toEqual([
      '01 Scope & snapshot',
      '02 Report intake',
      '03 Reconcile & prioritize',
      '04 Marketplace verification',
      '05 Export & handover',
      '06 Review & close daily run',
    ]);
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
