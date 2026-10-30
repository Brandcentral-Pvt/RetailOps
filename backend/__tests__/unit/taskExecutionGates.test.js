'use strict';

const { makeFakePool } = require('../../testUtils/fakePool');
jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
}));
const gates = require('../../services/pems/taskExecutionGates');

const makeActivity = (evidenceRequired = true, evidence = []) => makeFakePool([
  { match: /FROM PemsActivities a WITH \(UPDLOCK, ROWLOCK\)/, rows: [{
    Id: 'a1', TaskInstanceId: 'task1', SubTaskId: 'phase1',
    Status: 'IN_PROGRESS', IsCompleted: 0, EvidenceRequired: evidenceRequired ? 1 : 0,
  }] },
  { match: /SELECT TOP \(1\) Id FROM PemsEvidence/, rows: evidence },
]);

describe('Phase 1 task execution gate invariants', () => {
  const original = process.env.PEMS_STRICT_ACTIVITY_GATES;
  afterAll(() => {
    if (original === undefined) delete process.env.PEMS_STRICT_ACTIVITY_GATES;
    else process.env.PEMS_STRICT_ACTIVITY_GATES = original;
  });

  test('production gating remains opt-in', () => {
    delete process.env.PEMS_STRICT_ACTIVITY_GATES;
    expect(gates.strictGatesEnabled()).toBe(false);
    process.env.PEMS_STRICT_ACTIVITY_GATES = 'true';
    expect(gates.strictGatesEnabled()).toBe(true);
  });

  test('rejects mandatory evidence without a linked record', async () => {
    await expect(gates.assertActivityReady(makeActivity(), 'a1'))
      .rejects.toMatchObject({ code: 'ACTIVITY_EVIDENCE_REQUIRED', status: 409 });
  });

  test('accepts correctly linked activity evidence', async () => {
    const result = await gates.assertActivityReady(makeActivity(true, [{ Id: 'ev1' }]), 'a1');
    expect(result.TaskInstanceId).toBe('task1');
    expect(result.alreadyCompleted).toBeUndefined();
  });

  test('activities with no evidence requirement may proceed', async () => {
    await expect(gates.assertActivityReady(makeActivity(false), 'a1')).resolves.toMatchObject({ Id: 'a1' });
  });

  test('rejects closing a phase with required work still pending', async () => {
    const pool = makeFakePool([
      { match: /FROM PemsSubTasks st WITH \(UPDLOCK, ROWLOCK\)/, rows: [{ Id:'p1', TaskInstanceId:'t1', Status:'IN_PROGRESS', IsCompleted:0 }] },
      { match: /FROM PemsActivities a WHERE a.SubTaskId/, rows: [{ PendingRequired:1, MissingEvidence:0 }] },
    ]);
    await expect(gates.assertPhaseReady(pool, 'p1'))
      .rejects.toMatchObject({ code:'PHASE_INCOMPLETE', gate:{ pendingRequired:1 } });
  });

  test('blocks task submission when brands remain unchecked', async () => {
    const pool = makeFakePool([{ match: /AS PendingBrands/, rows: [{
      PendingRequired:0, PendingPhases:0, PendingBrands:2, MissingEvidence:0,
    }] }]);
    await expect(gates.assertSubmissionReady(pool,'t1'))
      .rejects.toMatchObject({ code:'TASK_WORK_INCOMPLETE', gate:{ pendingBrands:2 } });
  });

  test('permits a fully verified submission', async () => {
    const pool = makeFakePool([{ match: /AS PendingBrands/, rows: [{
      PendingRequired:0, PendingPhases:0, PendingBrands:0, MissingEvidence:0,
    }] }]);
    await expect(gates.assertSubmissionReady(pool,'t1')).resolves.toMatchObject({ pendingRequired:0 });
  });

  test('reconciles count and weighted progress from the same transaction', async () => {
    const pool = makeFakePool([
      { match: /SELECT Id, IsCompleted, WeightagePct FROM PemsSubTasks/, rows: [
        { Id:'a', IsCompleted:1, WeightagePct:30 },
        { Id:'b', IsCompleted:0, WeightagePct:70 },
      ] },
      { match: /SELECT SubTaskId, IsMandatory, IsCompleted FROM PemsActivities/, rows: [] },
      { match: /SELECT IsCompleted FROM PemsTaskBrands/, rows: [] },
    ]);
    const result = await gates.reconcileTaskProgress(pool,'t1');
    expect(result).toMatchObject({ total:2, completed:1, progress:50, weighted:30 });
    const update = pool.callWhere(/UPDATE PemsTaskInstances/);
    expect(update.inputs).toMatchObject({ done:1, progress:50, weighted:30 });
  });

  test('partial mandatory activity progress is visible before the phase is completed', async () => {
    const pool = makeFakePool([
      { match: /SELECT Id, IsCompleted, WeightagePct FROM PemsSubTasks/, rows: [
        { Id:'p1', IsCompleted:0, WeightagePct:100 },
      ] },
      { match: /SELECT SubTaskId, IsMandatory, IsCompleted FROM PemsActivities/, rows: [
        { SubTaskId:'p1', IsMandatory:1, IsCompleted:1 },
        { SubTaskId:'p1', IsMandatory:1, IsCompleted:0 },
        { SubTaskId:'p1', IsMandatory:1, IsCompleted:0 },
      ] },
    ]);
    const progress = await gates.reconcileTaskProgress(pool, 't1');
    expect(progress).toMatchObject({ progress:33, weighted:33, completedActivities:1, totalActivities:3 });
  });

  test('brand checklist progress combines with mandatory activity progress', async () => {
    const pool = makeFakePool([
      { match: /SELECT Id, IsCompleted, WeightagePct FROM PemsSubTasks/, rows: [{ Id:'p1', IsCompleted:0, WeightagePct:100 }] },
      { match: /SELECT SubTaskId, IsMandatory, IsCompleted FROM PemsActivities/, rows: [
        { SubTaskId:'p1', IsMandatory:1, IsCompleted:1 },
      ] },
      { match: /SELECT IsCompleted FROM PemsTaskBrands/, rows: [
        { IsCompleted:1 }, { IsCompleted:0 }, { IsCompleted:0 },
      ] },
    ]);
    const progress = await gates.reconcileTaskProgress(pool, 't1');
    expect(progress).toMatchObject({ progress:50, weighted:50, completedBrands:1, totalBrands:3 });
  });

  test('parent lock precedes activity changes', async () => {
    const pool = makeFakePool([
      { match: /FROM PemsActivities WHERE Id = @id/, rows: [{ TaskInstanceId:'t1' }] },
      { match: /FROM PemsTaskInstances WITH \(UPDLOCK, HOLDLOCK\)/, rows: [{ Id:'t1', Status:'IN_PROGRESS' }] },
    ]);
    const id = await gates.lockChildParent(pool, 'activity', 'a1');
    expect(id).toBe('t1');
    expect(pool.calls[1].sql).toContain('UPDLOCK, HOLDLOCK');
  });

  test('idempotent ready phase update is scoped by both phase and task', async () => {
    const pool = makeFakePool([
      { match: /FROM PemsActivities WHERE SubTaskId/, rows:[{Total:1, Required:1, PendingRequired:0, PendingAll:0}] },
      { match: /UPDATE PemsSubTasks/, rows:[{}] },
    ]);
    await gates.autoCompleteReadyPhase(pool,'p1','t1');
    const update = pool.callWhere(/UPDATE PemsSubTasks/);
    expect(update.sql).toContain('TaskInstanceId = @taskId');
    expect(update.sql).toContain('IsCompleted = 0');
  });
});
