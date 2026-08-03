const {
  canTransition, calculateSLAStatus, calculateAchievement,
  calculateVariance, calculateProgress, getNextDueDate, getEscalationLevel,
} = require('../../services/pems/workflowEngine');

describe('WorkflowEngine', () => {
  describe('canTransition', () => {
    const valid = [
      ['DRAFT', 'ASSIGNED'],
      ['DRAFT', 'CANCELLED'],
      ['ASSIGNED', 'ACCEPTED'],
      ['ASSIGNED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'SUBMITTED'],
      ['SUBMITTED', 'UNDER_REVIEW'],
      ['UNDER_REVIEW', 'APPROVED'],
      ['UNDER_REVIEW', 'REJECTED'],
      ['REJECTED', 'REWORK'],
      ['REWORK', 'RESUBMITTED'],
      ['RESUBMITTED', 'UNDER_REVIEW'],
    ];

    valid.forEach(([from, to]) => {
      it(`allows ${from} → ${to}`, () => {
        expect(canTransition(from, to)).toBe(true);
      });
    });

    const invalid = [
      ['DRAFT', 'APPROVED'],
      ['APPROVED', 'IN_PROGRESS'],
      ['CANCELLED', 'DRAFT'],
      ['IN_PROGRESS', 'DRAFT'],
    ];

    invalid.forEach(([from, to]) => {
      it(`rejects ${from} → ${to}`, () => {
        expect(canTransition(from, to)).toBe(false);
      });
    });
  });

  describe('calculateSLAStatus', () => {
    it('returns WITHIN_SLA when due date is far out', () => {
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
      expect(calculateSLAStatus(future, 48)).toBe('WITHIN_SLA');
    });

    it('returns AT_RISK when within 25% of SLA window', () => {
      const nearDue = new Date(Date.now() + 6 * 60 * 60 * 1000);
      expect(calculateSLAStatus(nearDue, 48)).toBe('AT_RISK');
    });

    it('returns BREACHED when past due', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      expect(calculateSLAStatus(past, 48)).toBe('BREACHED');
    });

    it('returns WITHIN_SLA when no due date', () => {
      expect(calculateSLAStatus(null, 48)).toBe('WITHIN_SLA');
    });
  });

  describe('calculateAchievement', () => {
    it('returns percentage', () => {
      expect(calculateAchievement(50, 100)).toBe(50);
    });

    it('returns 0 for zero target', () => {
      expect(calculateAchievement(50, 0)).toBe(0);
    });
  });

  describe('calculateVariance', () => {
    it('returns difference', () => {
      expect(calculateVariance(120, 100)).toBe(20);
    });
  });

  describe('calculateProgress', () => {
    it('returns 0 for empty subtasks', () => {
      expect(calculateProgress([])).toBe(0);
    });

    it('calculates completion percentage', () => {
      const subtasks = [
        { IsCompleted: true },
        { IsCompleted: false },
        { IsCompleted: true },
      ];
      expect(calculateProgress(subtasks)).toBe(67);
    });
  });

  describe('getNextDueDate', () => {
    it('adds days for daily frequency', () => {
      const base = new Date('2025-01-01T00:00:00Z');
      const next = getNextDueDate('DAILY', null, base);
      expect(next.toISOString()).toBe('2025-01-02T00:00:00.000Z');
    });

    it('adds months for monthly frequency', () => {
      const base = new Date('2025-01-15T00:00:00Z');
      const next = getNextDueDate('MONTHLY', null, base);
      expect(next.toISOString()).toBe('2025-02-15T00:00:00.000Z');
    });

    it('defaults to 7 days for unknown frequency', () => {
      const base = new Date('2025-06-01T00:00:00Z');
      const next = getNextDueDate('UNKNOWN', null, base);
      expect(next.toISOString()).toBe('2025-06-08T00:00:00.000Z');
    });
  });

  describe('getEscalationLevel', () => {
    it('returns null when far from due', () => {
      const far = new Date(Date.now() + 48 * 60 * 60 * 1000);
      expect(getEscalationLevel(far, 48)).toBeNull();
    });

    it('returns admin when 24h past due', () => {
      const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
      expect(getEscalationLevel(past, 48)).toBe('admin');
    });

    it('returns manager when breached but less than 24h', () => {
      const past = new Date(Date.now() - 6 * 60 * 60 * 1000);
      expect(getEscalationLevel(past, 48)).toBe('manager');
    });

    it('returns reviewer when within 12h of due', () => {
      const near = new Date(Date.now() + 6 * 60 * 60 * 1000);
      expect(getEscalationLevel(near, 48)).toBe('reviewer');
    });

    it('returns assignee when within 24h of due', () => {
      const near = new Date(Date.now() + 18 * 60 * 60 * 1000);
      expect(getEscalationLevel(near, 48)).toBe('assignee');
    });
  });
});

describe('getTransitionTimestamps', () => {
  const { getTransitionTimestamps } = require('../../services/pems/workflowEngine');
  const now = new Date('2026-08-03T12:00:00Z');

  it('stamps AssignedAt on ASSIGNED', () => {
    const t = getTransitionTimestamps('DRAFT', 'ASSIGNED', now);
    expect(t.AssignedAt).toEqual(now);
    expect(t.CompletedAt).toBeUndefined();
  });

  it('stamps StartedAt on IN_PROGRESS', () => {
    const t = getTransitionTimestamps('ACCEPTED', 'IN_PROGRESS', now);
    expect(t.StartedAt).toEqual(now);
    expect(t.ReviewedAt).toBeUndefined();
  });

  it('stamps ReviewedAt + CompletedAt on APPROVED (regression: CompletedAt was never set)', () => {
    const t = getTransitionTimestamps('UNDER_REVIEW', 'APPROVED', now);
    expect(t.ReviewedAt).toEqual(now);
    expect(t.CompletedAt).toEqual(now);
  });

  it('stamps ReviewedAt and clears CompletedAt on REJECTED', () => {
    const t = getTransitionTimestamps('UNDER_REVIEW', 'REJECTED', now);
    expect(t.ReviewedAt).toEqual(now);
    expect(t.CompletedAt).toBeNull();
  });

  it('returns no timestamps for non-timestamped transitions (e.g. REWORK)', () => {
    const t = getTransitionTimestamps('REJECTED', 'REWORK', now);
    expect(Object.keys(t)).toHaveLength(0);
  });
});

describe('resolveReviewTransition', () => {
  const { resolveReviewTransition } = require('../../services/pems/workflowEngine');

  it('maps APPROVE to APPROVED', () => {
    expect(resolveReviewTransition('APPROVE')).toBe('APPROVED');
  });

  it('maps REWORK to REWORK (regression: was collapsed into REJECTED)', () => {
    expect(resolveReviewTransition('REWORK')).toBe('REWORK');
  });

  it('maps anything else to REJECTED', () => {
    expect(resolveReviewTransition('REJECT')).toBe('REJECTED');
    expect(resolveReviewTransition(undefined)).toBe('REJECTED');
    expect(resolveReviewTransition('BOGUS')).toBe('REJECTED');
  });
});
