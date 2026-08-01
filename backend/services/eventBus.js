const EventEmitter = require('events');
const logger = require('../utils/logger');

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

const EVENTS = {
  TASK_CREATED: 'pems:task:created',
  TASK_TRANSITIONED: 'pems:task:transitioned',
  TASK_APPROVED: 'pems:task:approved',
  TASK_REJECTED: 'pems:task:rejected',
  SUBTASK_COMPLETED: 'pems:subtask:completed',
  SLA_UPDATED: 'pems:sla:updated',
  SLA_BREACHED: 'pems:sla:breached',
  NOTIFICATION_CREATED: 'pems:notification:created',
  PIPELINE_STARTED: 'system:pipeline:started',
  PIPELINE_COMPLETED: 'system:pipeline:completed',
  PIPELINE_FAILED: 'system:pipeline:failed',
  ASIN_SYNCED: 'system:asin:synced',
  USER_LOGIN: 'auth:user:login',
  USER_LOGOUT: 'auth:user:logout',
  PERMISSION_DENIED: 'auth:permission:denied',
};

function emit(event, data) {
  try {
    emitter.emit(event, data);
    logger.debug(`Event emitted: ${event}`, { event, hasData: !!data });
  } catch (err) {
    logger.error(`Event emit failed: ${event}`, { error: err.message });
  }
}

async function emitAsync(event, data) {
  const handlers = emitter.listeners(event);
  const results = await Promise.allSettled(
    handlers.map(h => {
      try {
        return h(data);
      } catch (err) {
        return Promise.reject(err);
      }
    })
  );
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn(`Event ${event}: ${failures.length}/${handlers.length} handlers failed`, {
      errors: failures.map(f => f.reason?.message).join('; '),
    });
  }
  return results;
}

function on(event, handler) {
  emitter.on(event, handler);
  logger.debug(`Event listener registered: ${event}`);
  return () => emitter.off(event, handler);
}

function once(event, handler) {
  emitter.once(event, handler);
  return () => emitter.off(event, handler);
}

function off(event, handler) {
  emitter.off(event, handler);
}

function removeAll(event) {
  emitter.removeAllListeners(event);
}

function listenerCount(event) {
  return emitter.listenerCount(event);
}

module.exports = {
  EVENTS,
  emit,
  emitAsync,
  on,
  once,
  off,
  removeAll,
  listenerCount,
  emitter,
};
