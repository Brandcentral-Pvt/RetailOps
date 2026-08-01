const { foldEvents, EVENT_TYPES } = require('../../services/pems/eventStore');

describe('EventStore', () => {
  describe('foldEvents', () => {
    it('returns default state for empty events', () => {
      const state = foldEvents([]);
      expect(state.status).toBe('DRAFT');
      expect(state.reviewStatus).toBe('NOT_REVIEWED');
      expect(state.completedSubTasks).toBe(0);
    });

    it('tracks task creation', () => {
      const events = [
        { EventType: EVENT_TYPES.TASK_CREATED, ToStatus: 'ASSIGNED', CreatedAt: new Date().toISOString(), Payload: {} },
      ];
      const state = foldEvents(events);
      expect(state.status).toBe('ASSIGNED');
    });

    it('tracks full lifecycle', () => {
      const events = [
        { EventType: EVENT_TYPES.TASK_CREATED, ToStatus: 'DRAFT', CreatedAt: '2025-01-01', Payload: {} },
        { EventType: EVENT_TYPES.TASK_ASSIGNED, Payload: { assignedTo: 'user1' } },
        { EventType: EVENT_TYPES.TASK_ACCEPTED, Payload: {} },
        { EventType: EVENT_TYPES.TASK_STARTED, CreatedAt: '2025-01-02', Payload: {} },
        { EventType: EVENT_TYPES.TASK_SUBMITTED, Payload: {} },
        { EventType: EVENT_TYPES.TASK_REVIEWED, Payload: {} },
        { EventType: EVENT_TYPES.TASK_APPROVED, CreatedAt: '2025-01-03', Payload: {} },
      ];
      const state = foldEvents(events);
      expect(state.status).toBe('APPROVED');
      expect(state.reviewStatus).toBe('APPROVED');
      expect(state.assignedTo).toBe('user1');
      expect(state.completedAt).toBe('2025-01-03');
    });

    it('tracks rejection and rework', () => {
      const events = [
        { EventType: EVENT_TYPES.TASK_CREATED, ToStatus: 'DRAFT', Payload: {} },
        { EventType: EVENT_TYPES.TASK_SUBMITTED, Payload: {} },
        { EventType: EVENT_TYPES.TASK_REJECTED, Payload: {} },
        { EventType: EVENT_TYPES.TASK_REWORKED, Payload: {} },
      ];
      const state = foldEvents(events);
      expect(state.status).toBe('REWORK');
      expect(state.reviewStatus).toBe('REJECTED');
      expect(state.reworkCount).toBe(1);
    });

    it('tracks cancellation', () => {
      const events = [
        { EventType: EVENT_TYPES.TASK_CREATED, ToStatus: 'DRAFT', Payload: {} },
        { EventType: EVENT_TYPES.TASK_CANCELLED, Payload: {} },
      ];
      const state = foldEvents(events);
      expect(state.status).toBe('CANCELLED');
    });

    it('tracks subtask counts', () => {
      const events = [
        { EventType: EVENT_TYPES.TASK_CREATED, ToStatus: 'DRAFT', Payload: {} },
        { EventType: EVENT_TYPES.SUBTASK_CREATED, Payload: {} },
        { EventType: EVENT_TYPES.SUBTASK_CREATED, Payload: {} },
        { EventType: EVENT_TYPES.SUBTASK_CREATED, Payload: {} },
        { EventType: EVENT_TYPES.SUBTASK_COMPLETED, Payload: {} },
        { EventType: EVENT_TYPES.SUBTASK_COMPLETED, Payload: {} },
      ];
      const state = foldEvents(events);
      expect(state.totalSubTasks).toBe(3);
      expect(state.completedSubTasks).toBe(2);
    });
  });
});
