const { sql, getPool, generateId, withTransaction } = require('../../database/db');
const eventBus = require('../eventBus');
const logger = require('../../utils/logger');
const cacheService = require('../cacheService');

const EVENT_TYPES = {
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_ACCEPTED: 'TASK_ACCEPTED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  TASK_REVIEWED: 'TASK_REVIEWED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  TASK_REWORKED: 'TASK_REWORKED',
  TASK_CANCELLED: 'TASK_CANCELLED',
  TASK_ESCALATED: 'TASK_ESCALATED',
  TASK_UPDATED: 'TASK_UPDATED',
  SUBTASK_COMPLETED: 'SUBTASK_COMPLETED',
  SUBTASK_CREATED: 'SUBTASK_CREATED',
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
  REVIEW_CREATED: 'REVIEW_CREATED',
  SLA_UPDATED: 'SLA_UPDATED',
  ACHIEVEMENT_UPDATED: 'ACHIEVEMENT_UPDATED',
  ASSIGNMENT_CHANGED: 'ASSIGNMENT_CHANGED',
};

async function ensureEventStoreTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.PemsTaskEvents', N'U') IS NULL
    BEGIN
      CREATE TABLE PemsTaskEvents (
        Id VARCHAR(24) PRIMARY KEY,
        TaskInstanceId VARCHAR(24) NOT NULL,
        EventType VARCHAR(50) NOT NULL,
        FromStatus VARCHAR(50),
        ToStatus VARCHAR(50),
        ActorId VARCHAR(24),
        ActorName NVARCHAR(255),
        Payload NVARCHAR(MAX),
        Version INT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT dbo.GetEnvDate()
      );
      CREATE INDEX IX_PemsTaskEvents_TaskId ON PemsTaskEvents(TaskInstanceId, Version);
      CREATE INDEX IX_PemsTaskEvents_Type ON PemsTaskEvents(EventType);
      CREATE INDEX IX_PemsTaskEvents_CreatedAt ON PemsTaskEvents(CreatedAt DESC);
    END
  `);
  logger.info('PemsTaskEvents table verified');
}

async function append(eventType, taskInstanceId, data = {}, attempt = 0) {
  const id = generateId();

  const payload = {
    ...data,
    timestamp: new Date().toISOString(),
  };
  delete payload.eventType;
  delete payload.taskInstanceId;

  try {
    const result = await withTransaction(async (tx) => {
      // UPDLOCK + HOLDLOCK serializes concurrent appends per task so
      // (TaskInstanceId, Version) can never collide.
      const versionResult = await tx.request()
        .input('taskId', sql.VarChar, taskInstanceId)
        .query('SELECT ISNULL(MAX(Version), 0) + 1 as nextVersion FROM PemsTaskEvents WITH (UPDLOCK, HOLDLOCK) WHERE TaskInstanceId = @taskId');
      const version = versionResult.recordset[0].nextVersion;

      await tx.request()
        .input('id', sql.VarChar, id)
        .input('taskInstanceId', sql.VarChar, taskInstanceId)
        .input('eventType', sql.VarChar, eventType)
        .input('fromStatus', sql.VarChar, data.fromStatus || null)
        .input('toStatus', sql.VarChar, data.toStatus || null)
        .input('actorId', sql.VarChar, data.actorId || null)
        .input('actorName', sql.NVarChar, data.actorName || null)
        .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(payload))
        .input('version', sql.Int, version)
        .query(`
          INSERT INTO PemsTaskEvents (Id, TaskInstanceId, EventType, FromStatus, ToStatus, ActorId, ActorName, Payload, Version)
          VALUES (@id, @taskInstanceId, @eventType, @fromStatus, @toStatus, @actorId, @actorName, @payload, @version)
        `);

      return { id, version };
    });

    // Invalidate task cache
    cacheService.del(cacheService.key('task', taskInstanceId)).catch(() => {});

    return result;
  } catch (err) {
    // Duplicate key on (TaskInstanceId, Version) — retry once
    const isDup = err.number === 2601 || err.number === 2627;
    if (isDup && attempt < 1) {
      return append(eventType, taskInstanceId, data, attempt + 1);
    }
    throw err;
  }
}

async function getEvents(taskInstanceId, fromVersion = 0) {
  const pool = await getPool();
  const result = await pool.request()
    .input('taskId', sql.VarChar, taskInstanceId)
    .input('fromVersion', sql.Int, fromVersion)
    .query(`
      SELECT * FROM PemsTaskEvents
      WHERE TaskInstanceId = @taskId AND Version > @fromVersion
      ORDER BY Version ASC
    `);
  return result.recordset.map(e => ({
    ...e,
    Payload: safeParse(e.Payload, {}),
  }));
}

async function getCurrentState(taskInstanceId) {
  const events = await getEvents(taskInstanceId);
  return foldEvents(events);
}

function foldEvents(events) {
  const state = {
    status: 'DRAFT',
    reviewStatus: 'NOT_REVIEWED',
    slaStatus: 'WITHIN_SLA',
    completedSubTasks: 0,
    totalSubTasks: 0,
    reworkCount: 0,
    assignedTo: null,
    reviewerId: null,
    lastTransitionedAt: null,
  };

  for (const e of events) {
    switch (e.EventType) {
      case EVENT_TYPES.TASK_CREATED:
        state.status = e.ToStatus || 'DRAFT';
        state.createdAt = e.CreatedAt;
        break;
      case EVENT_TYPES.TASK_ASSIGNED:
        state.status = 'ASSIGNED';
        state.assignedTo = e.Payload.assignedTo;
        break;
      case EVENT_TYPES.TASK_ACCEPTED:
        state.status = 'ACCEPTED';
        break;
      case EVENT_TYPES.TASK_STARTED:
        state.status = 'IN_PROGRESS';
        state.startedAt = e.CreatedAt;
        break;
      case EVENT_TYPES.TASK_SUBMITTED:
        state.status = 'SUBMITTED';
        state.reviewStatus = 'PENDING_REVIEW';
        break;
      case EVENT_TYPES.TASK_REVIEWED:
        state.reviewStatus = 'UNDER_REVIEW';
        break;
      case EVENT_TYPES.TASK_APPROVED:
        state.status = 'APPROVED';
        state.reviewStatus = 'APPROVED';
        state.completedAt = e.CreatedAt;
        break;
      case EVENT_TYPES.TASK_REJECTED:
        state.status = 'REJECTED';
        state.reviewStatus = 'REJECTED';
        break;
      case EVENT_TYPES.TASK_REWORKED:
        state.status = 'REWORK';
        state.reviewStatus = 'REJECTED';
        state.reworkCount++;
        break;
      case EVENT_TYPES.TASK_ESCALATED:
        state.status = 'ESCALATED';
        break;
      case EVENT_TYPES.TASK_CANCELLED:
        state.status = 'CANCELLED';
        break;
      case EVENT_TYPES.SUBTASK_COMPLETED:
        state.completedSubTasks++;
        break;
      case EVENT_TYPES.SUBTASK_CREATED:
        state.totalSubTasks++;
        break;
      case EVENT_TYPES.SLA_UPDATED:
        state.slaStatus = e.Payload.slaStatus;
        break;
      case EVENT_TYPES.ACHIEVEMENT_UPDATED:
        state.achievement = e.Payload.achievement;
        state.achievementPct = e.Payload.achievementPct;
        break;
    }
    state.lastEventType = e.EventType;
    state.lastEventAt = e.CreatedAt;
    state.lastVersion = e.Version;
  }

  return state;
}

function safeParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = {
  EVENT_TYPES,
  ensureEventStoreTable,
  append,
  getEvents,
  getCurrentState,
  foldEvents,
};
