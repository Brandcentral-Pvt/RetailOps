const eventBus = require('../services/eventBus');
const queueService = require('../services/queueService');
const { QUEUES } = require('./queueDefinitions');
const logger = require('../utils/logger');
const cacheService = require('../services/cacheService');

function registerEventHandlers() {
  eventBus.on(eventBus.EVENTS.TASK_TRANSITIONED, async (data) => {
    const { taskInstanceId, toStatus, fromStatus, userId, actorName } = data;

    // Invalidate related caches
    cacheService.delPattern('route:/api/pems:instances*').catch(() => {});
    cacheService.delPattern('route:/api/pems:dashboard*').catch(() => {});

    // Queue notification
    const notificationTypes = {
      ASSIGNED: 'TASK_ASSIGNED',
      SUBMITTED: 'TASK_SUBMITTED',
      APPROVED: 'TASK_APPROVED',
      REJECTED: 'TASK_REJECTED',
      ESCALATED: 'TASK_ESCALATED',
    };

    const notifType = notificationTypes[toStatus];
    if (notifType) {
      await queueService.add(QUEUES.PEMS_NOTIFICATION, {
        type: notifType,
        taskInstanceId,
        userId,
        title: `Task ${toStatus}`,
        message: `Task ${taskInstanceId} transitioned ${fromStatus} → ${toStatus}`,
        actionUrl: `/pems/tasks?id=${taskInstanceId}`,
      });
    }

    // Emit via Socket.IO
    try {
      const SocketService = require('../services/socketService');
      const io = SocketService.getIo();
      if (io) {
        io.to(`task:${taskInstanceId}`).emit('task_status_changed', {
          taskInstanceId,
          fromStatus,
          toStatus,
          actorName,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (_) {}

    logger.info(`Task ${taskInstanceId}: ${fromStatus} → ${toStatus} by ${actorName}`);
  });

  eventBus.on(eventBus.EVENTS.TASK_APPROVED, async (data) => {
    cacheService.delPattern('route:/api/pems:instances*').catch(() => {});
    cacheService.delPattern('route:/api/pems:dashboard*').catch(() => {});
  });

  eventBus.on(eventBus.EVENTS.SLA_BREACHED, async (data) => {
    const { taskId, assigneeId, reviewerId } = data;
    await queueService.add(QUEUES.PEMS_NOTIFICATION, {
      type: 'SLA_BREACH',
      taskInstanceId: taskId,
      userId: assigneeId,
      title: 'SLA Breached',
      message: `Task ${taskId} has breached its SLA`,
      actionUrl: `/pems/tasks?id=${taskId}`,
    });
    if (reviewerId) {
      await queueService.add(QUEUES.PEMS_NOTIFICATION, {
        type: 'SLA_BREACH',
        taskInstanceId: taskId,
        userId: reviewerId,
        title: 'SLA Breached',
        message: `Task ${taskId} has breached its SLA`,
        actionUrl: `/pems/tasks?id=${taskId}`,
      });
    }
  });

  eventBus.on(eventBus.EVENTS.PIPELINE_COMPLETED, async (data) => {
    cacheService.delPattern('route:/api/pems:dashboard*').catch(() => {});
    logger.info(`Pipeline completed: ${data.totalSellers} sellers, ${data.successful} successful`);
  });

  eventBus.on(eventBus.EVENTS.USER_LOGIN, async (data) => {
    logger.info(`User login: ${data.userId}`, { userId: data.userId, ip: data.ip });
  });

  eventBus.on(eventBus.EVENTS.PERMISSION_DENIED, async (data) => {
    logger.warn(`Permission denied`, { userId: data.userId, permission: data.permission, url: data.url });
  });

  logger.info('All event handlers registered');
}

module.exports = { registerEventHandlers };
