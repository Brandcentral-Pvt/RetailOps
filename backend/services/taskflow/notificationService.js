/**
 * TaskFlow Notification Service
 * Handles multi-channel notifications (in-app, email, Slack, webhook, SMS)
 */
const { sql, getPool, generateId } = require('../../database/db');
const logger = require('../../utils/logger');
const eventBus = require('../eventBus');
const emailService = require('../emailService');

const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_ACCEPTED: 'TASK_ACCEPTED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  TASK_REVIEWED: 'TASK_REVIEWED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  TASK_REWORK: 'TASK_REWORK',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_CANCELLED: 'TASK_CANCELLED',
  SUBTASK_COMPLETED: 'SUBTASK_COMPLETED',
  ACTIVITY_COMPLETED: 'ACTIVITY_COMPLETED',
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  SLA_WARNING: 'SLA_WARNING',
  SLA_BREACH: 'SLA_BREACH',
  ESCALATION: 'ESCALATION',
  MENTION: 'MENTION',
  WATCHER_ADDED: 'WATCHER_ADDED'
};

const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  IN_APP: 'in_app',
  SLACK: 'slack',
  WEBHOOK: 'webhook',
  SMS: 'sms'
};

const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

const NOTIFICATION_TEMPLATES = {
  TASK_ASSIGNED: {
    subject: 'Task Assigned: {{taskTitle}}',
    inApp: 'You have been assigned to task {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/task_assigned.html',
    slack: '📋 *Task Assigned*\n*{{taskCode}}*: {{taskTitle}}\nAssigned to: {{assigneeName}}\nDue: {{dueDate}}\nPriority: {{priority}}'
  },
  TASK_ACCEPTED: {
    subject: 'Task Accepted: {{taskTitle}}',
    inApp: '{{assigneeName}} has accepted task {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/task_accepted.html',
    slack: '✅ *Task Accepted*\n*{{taskCode}}*: {{taskTitle}}\nAccepted by: {{assigneeName}}'
  },
  TASK_STARTED: {
    subject: 'Task Started: {{taskTitle}}',
    inApp: '{{assigneeName}} started working on {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/task_started.html',
    slack: '🚀 *Task Started*\n*{{taskCode}}*: {{taskTitle}}\nStarted by: {{assigneeName}}'
  },
  TASK_SUBMITTED: {
    subject: 'Task Submitted for Review: {{taskTitle}}',
    inApp: '{{assigneeName}} submitted {{taskCode}}: {{taskTitle}} for review',
    email: 'email/templates/task_submitted.html',
    slack: '📤 *Task Submitted for Review*\n*{{taskCode}}*: {{taskTitle}}\nSubmitted by: {{assigneeName}}\nReviewer: {{reviewerName}}'
  },
  TASK_APPROVED: {
    subject: 'Task Approved: {{taskTitle}}',
    inApp: '{{reviewerName}} approved {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/task_approved.html',
    slack: '✅ *Task Approved*\n*{{taskCode}}*: {{taskTitle}}\nApproved by: {{reviewerName}}'
  },
  TASK_REJECTED: {
    subject: 'Task Rejected: {{taskTitle}}',
    inApp: '{{reviewerName}} rejected {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/task_rejected.html',
    slack: '❌ *Task Rejected*\n*{{taskCode}}*: {{taskTitle}}\nRejected by: {{reviewerName}}\nFeedback: {{feedback}}'
  },
  TASK_REWORK: {
    subject: 'Task Rework Required: {{taskTitle}}',
    inApp: '{{reviewerName}} requested rework on {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/task_rework.html',
    slack: '🔄 *Rework Required*\n*{{taskCode}}*: {{taskTitle}}\nRequested by: {{reviewerName}}\nFeedback: {{feedback}}'
  },
  TASK_COMPLETED: {
    subject: 'Task Completed: {{taskTitle}}',
    inApp: 'Task {{taskCode}}: {{taskTitle}} has been completed',
    email: 'email/templates/task_completed.html',
    slack: '🎉 *Task Completed*\n*{{taskCode}}*: {{taskTitle}}\nCompleted by: {{assigneeName}}'
  },
  TASK_CANCELLED: {
    subject: 'Task Cancelled: {{taskTitle}}',
    inApp: 'Task {{taskCode}}: {{taskTitle}} has been cancelled',
    email: 'email/templates/task_cancelled.html',
    slack: '🚫 *Task Cancelled*\n*{{taskCode}}*: {{taskTitle}}\nCancelled by: {{actorName}}'
  },
  SUBTASK_COMPLETED: {
    subject: 'Subtask Completed: {{subtaskTitle}}',
    inApp: 'Subtask {{subtaskCode}}: {{subtaskTitle}} completed in task {{taskCode}}',
    email: 'email/templates/subtask_completed.html',
    slack: '✅ *Subtask Completed*\n*{{subtaskCode}}*: {{subtaskTitle}}\nTask: {{taskCode}}'
  },
  ACTIVITY_COMPLETED: {
    subject: 'Activity Completed: {{activityTitle}}',
    inApp: 'Activity {{activityTitle}} completed in subtask {{subtaskCode}}',
    email: 'email/templates/activity_completed.html',
    slack: '✅ *Activity Completed*\n*{{activityTitle}}*\nSubtask: {{subtaskCode}}\nTask: {{taskCode}}'
  },
  EVIDENCE_UPLOADED: {
    subject: 'Evidence Uploaded: {{taskTitle}}',
    inApp: 'Evidence uploaded to {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/evidence_uploaded.html',
    slack: '📎 *Evidence Uploaded*\n*{{taskCode}}*: {{taskTitle}}\nFile: {{fileName}}'
  },
  COMMENT_ADDED: {
    subject: 'New Comment on {{taskTitle}}',
    inApp: '{{authorName}} commented on {{taskCode}}: {{commentPreview}}',
    email: 'email/templates/comment_added.html',
    slack: '💬 *New Comment*\n*{{taskCode}}*: {{taskTitle}}\n{{authorName}}: {{commentPreview}}'
  },
  SLA_WARNING: {
    subject: '⚠️ SLA Warning: {{taskTitle}}',
    inApp: '⚠️ SLA at risk for {{taskCode}}: {{taskTitle}} ({{hoursRemaining}}h remaining)',
    email: 'email/templates/sla_warning.html',
    slack: '⚠️ *SLA Warning*\n*{{taskCode}}*: {{taskTitle}}\n{{hoursRemaining}}h remaining\nAssignee: {{assigneeName}}'
  },
  SLA_BREACH: {
    subject: '🚨 SLA BREACHED: {{taskTitle}}',
    inApp: '🚨 SLA BREACHED for {{taskCode}}: {{taskTitle}} ({{hoursOverdue}}h overdue)',
    email: 'email/templates/sla_breach.html',
    slack: '🚨 *SLA BREACH*\n*{{taskCode}}*: {{taskTitle}}\n{{hoursOverdue}}h overdue\nAssignee: {{assigneeName}}\nEscalated to: {{escalationLevel}}'
  },
  ESCALATION: {
    subject: '📈 Task Escalated: {{taskTitle}}',
    inApp: 'Task {{taskCode}} escalated to {{escalationLevel}} level',
    email: 'email/templates/escalation.html',
    slack: '📈 *Task Escalated*\n*{{taskCode}}*: {{taskTitle}}\nEscalated to: {{escalationLevel}}\nReason: {{reason}}'
  },
  MENTION: {
    subject: 'You were mentioned in {{taskTitle}}',
    inApp: '{{authorName}} mentioned you in {{taskCode}}: {{commentPreview}}',
    email: 'email/templates/mention.html',
    slack: '👋 *Mention*\n{{authorName}} mentioned you in *{{taskCode}}*: {{commentPreview}}'
  },
WATCHER_ADDED: {
    subject: 'You are now watching {{taskTitle}}',
    inApp: 'You are now watching {{taskCode}}: {{taskTitle}}',
    email: 'email/templates/watcher_added.html',
    slack: '👁 *Now Watching*\n*{{taskCode}}*: {{taskTitle}}'
  }
};
 
class NotificationService {
  constructor() {
    this.templates = NOTIFICATION_TEMPLATES;
    this.channels = NOTIFICATION_CHANNELS;
    this.renderCache = new Map();
  }

  /**
   * Render notification template with data
   */
  renderTemplate(template, data) {
    if (!template) return { subject: '', inApp: '', email: '', slack: '' };
    
    const render = (str) => {
      if (!str) return '';
      return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
      });
    };

    return {
      subject: render(template.subject || ''),
      inApp: render(template.inApp || ''),
      email: render(template.email || ''),
      slack: render(template.slack || ''),
      webhook: template.webhook ? JSON.stringify(data) : null
    };
  }

  /**
   * Send notification through multiple channels
   */
  async sendNotification(userId, type, data, options = {}) {
    const { 
      channels = ['in_app', 'email'], 
      priority = 'normal',
      actionUrl = null,
      skipInApp = false,
      skipEmail = false,
      templateOverride = null 
    } = options;

    const template = templateOverride || this.templates[type];
    if (!template) {
      logger.warn(`No template found for notification type: ${type}`);
      return { success: false, error: 'Template not found' };
    }

    // Prepare template data
    const templateData = {
      ...data,
      taskCode: data.task?.code || data.taskCode,
      taskTitle: data.task?.title || data.taskTitle,
      taskId: data.task?.id || data.taskId,
      assigneeName: data.assigneeName || data.assignee?.firstName + ' ' + data.assignee?.lastName,
      reviewerName: data.reviewer?.firstName + ' ' + data.reviewer?.lastName,
      authorName: data.author?.firstName + ' ' + data.author?.lastName,
      commentPreview: data.comment?.substring(0, 100) + '...',
      subTaskCode: data.subTask?.code,
      subTaskTitle: data.subTask?.title,
      activityTitle: data.activity?.title,
      hoursRemaining: data.hoursRemaining,
      hoursOverdue: data.hoursOverdue,
      hoursOverdue: data.hoursOverdue,
      escalationLevel: data.escalationLevel,
      reason: data.reason,
      actorName: data.actorName,
      dueDate: data.dueDate ? new Date(data.dueDate).toLocaleDateString() : '',
      hoursRemaining: data.hoursRemaining,
      hoursOverdue: data.hoursOverdue,
      escalationLevel: data.escalationLevel,
      reason: data.reason,
      actorName: data.actorName
    };

    const rendered = this.renderTemplate(template, templateData);
    const results = {};

    // In-app notification
    if (channels.includes('in_app') && !skipInApp) {
      try {
        const result = await this.sendInAppNotification(userId, {
          type,
          title: rendered.subject,
          message: rendered.inApp,
          actionUrl: actionUrl || `/tasks/${data.taskId || data.taskId}`,
          priority,
          taskId: data.taskId || data.taskId,
          metadata: { type, ...data }
        });
        results.inApp = { success: true, id: result.id };
      } catch (err) {
        logger.error('In-app notification failed', { error: err.message, userId, type });
        results.inApp = { success: false, error: err.message };
      }
    }

    // Email
    if (channels.includes('email') && !skipEmail) {
      try {
        await this.sendEmailNotification(userId, {
          subject: rendered.subject,
          html: rendered.email || rendered.inApp,
          text: rendered.inApp,
          priority
        });
        results.email = { success: true };
      } catch (err) {
        logger.error('Email notification failed', { error: err.message, userId, type });
        results.email = { success: false, error: err.message };
      }
    }

    // Slack
    if (channels.includes('slack')) {
      try {
        await this.sendSlackNotification(userId, {
          text: rendered.slack,
          blocks: this.buildSlackBlocks(rendered, type, data),
          priority
        });
        results.slack = { success: true };
      } catch (err) {
        logger.warn('Slack notification failed', { error: err.message, userId, type });
        results.slack = { success: false, error: err.message };
      }
    }

    // Webhook
    if (channels.includes('webhook')) {
      try {
        await this.sendWebhook(data.webhookUrl || process.env.NOTIFICATION_WEBHOOK_URL, {
          type,
          userId,
          data,
          rendered,
          priority
        });
        results.webhook = { success: true };
      } catch (err) {
        logger.warn('Webhook notification failed', { error: err.message, type });
        results.webhook = { success: false, error: err.message };
      }
    }

    // SMS
    if (channels.includes('sms')) {
      try {
        await this.sendSms(userId, rendered.subject + ': ' + rendered.inApp);
        results.sms = { success: true };
      } catch (err) {
        logger.warn('SMS notification failed', { error: err.message, userId });
        results.sms = { success: false, error: err.message };
      }
    }

    return { success: true, results, rendered };
  }

  /**
   * Send in-app notification
   */
  async sendInAppNotification(userId, notification) {
    const { sql, getPool, generateId } = require('../../database/db');
    const pool = await getPool();
    const id = generateId();

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('userId', sql.VarChar, userId)
      .input('type', sql.VarChar, notification.type)
      .input('title', sql.NVarChar, notification.title)
      .input('message', sql.NVarChar, notification.message)
      .input('actionUrl', sql.NVarChar, notification.actionUrl || '')
      .input('priority', sql.VarChar, notification.priority || 'normal')
      .input('taskId', sql.VarChar, notification.taskId || null)
      .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify(notification.metadata || {}))
      .query(`
        INSERT INTO TaskNotifications (Id, UserId, Type, Title, Message, ActionUrl, Priority, IsRead, TaskId, Metadata, CreatedAt)
        VALUES (@id, @userId, @type, @title, @message, @actionUrl, @priority, 0, @taskId, @metadata, dbo.GetEnvDate())
      `);

    // Emit real-time event
    eventBus.emit('notification:created', { userId, notification: { id, ...notification } });

    return { id };
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(userId, options) {
    const { emailService } = require('../emailService');
    const { getPool } = require('../../database/db');
    const pool = await getPool();

    // Get user email
    const userResult = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query('SELECT Email, FirstName, LastName FROM Users WHERE Id = @userId');

    const user = userResult.recordset[0];
    if (!user?.Email) {
      logger.warn(`Cannot send email: user ${userId} has no email`);
      return { success: false, reason: 'No email' };
    }

    try {
      await emailService.send({
        to: user.Email,
        subject: options.subject,
        html: options.html,
        text: options.text
      });
      return { success: true };
    } catch (err) {
      logger.error('Email send failed', { error: err.message, userId });
      throw err;
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(userId, options) {
    // Would integrate with Slack API
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      logger.debug('Slack webhook URL not configured');
      return { success: false, reason: 'Not configured' };
    }

    try {
      const fetch = require('node-fetch');
      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: options.text,
          blocks: options.blocks,
          username: 'TaskFlow',
          icon_emoji: ':clipboard:'
        })
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      return { success: true };
    } catch (err) {
      logger.warn('Slack notification failed', { error: err.message });
      throw err;
    }
  }

  /**
   * Build Slack blocks for rich formatting
   */
  buildSlackBlocks(rendered, type, data) {
    const colorMap = {
      'TASK_ASSIGNED': '#3b82f6',
      'TASK_APPROVED': '#22c55e',
      'TASK_REJECTED': '#ef4444',
      'SLA_WARNING': '#f59e0b',
      'SLA_BREACH': '#ef4444',
      'ESCALATION': '#f59e0b',
      'TASK_COMPLETED': '#22c55e'
    };

    const color = colorMap[type] || '#3b82f6';

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${this.templates[type]?.subject || 'Notification'}*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Your notification content here'
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Task: ${data.taskCode} | Priority: ${data.priority}`
          }
        ]
      }
    ];
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(url, payload) {
    if (!url) return { success: false, reason: 'No webhook URL' };

    try {
      const fetch = require('node-fetch');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      return { success: true, status: response.status };
    } catch (err) {
      logger.warn('Webhook notification failed', { error: err.message });
      throw err;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSms(userId, message) {
    // Would integrate with Twilio or similar
    logger.debug(`SMS sent to user ${userId}: ${message.substring(0, 50)}...`);
    return { success: true };
  }

  /**
   * Send notification to multiple users
   */
  async notifyUsers(userIds, type, data, options = {}) {
    const results = [];
    for (const userId of userIds) {
      try {
        const result = await this.sendNotification(userId, type, data, options);
        results.push({ userId, ...result });
      } catch (err) {
        logger.error(`Failed to notify user ${userId}`, { error: err.message });
        results.push({ userId, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Notify task assignee and reviewer
   */
  async notifyTaskParticipants(task, type, data = {}, options = {}) {
    const recipients = new Set();
    
    if (data.assigneeId) recipients.add(data.assigneeId);
    if (data.reviewerId) recipients.add(data.reviewerId);
    if (data.actorId) recipients.add(data.actorId);

    const userIds = Array.from(recipients);
    const results = [];

    for (const userId of userIds) {
      try {
        await this.sendNotification(userId, type, { ...data, task: { ...data.task, id: data.taskId } }, options);
        results.push({ success: true });
      } catch (err) {
        results.push({ success: false, error: err.message });
      }
    }

    return userIds.map((userId, i) => ({ userId, success: results[i]?.success }));
  }

  /**
   * Batch send notifications
   */
  async sendBatch(notifications) {
    const results = [];
    for (const n of notifications) {
      try {
        const result = await this.sendNotification(n.userId, n.type, n.data, n.options);
        results.push({ userId: n.userId, success: true, result });
      } catch (err) {
        results.push({ userId: n.userId, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Create notification from task event
   */
  async createFromEvent(eventType, task, actor, details = {}) {
    const typeMap = {
      'TASK_CREATED': 'TASK_ASSIGNED',
      'TASK_ASSIGNED': 'TASK_ASSIGNED',
      'TASK_ACCEPTED': 'TASK_ACCEPTED',
      'TASK_STARTED': 'TASK_STARTED',
      'TASK_SUBMITTED': 'TASK_SUBMITTED',
      'TASK_REVIEWED': 'TASK_SUBMITTED',
      'TASK_APPROVED': 'TASK_APPROVED',
      'TASK_REJECTED': 'TASK_REJECTED',
      'TASK_REWORK': 'TASK_REWORK',
      'TASK_COMPLETED': 'TASK_COMPLETED',
      'TASK_CANCELLED': 'TASK_CANCELLED',
      'SUBTASK_COMPLETED': 'SUBTASK_COMPLETED',
      'ACTIVITY_COMPLETED': 'ACTIVITY_COMPLETED',
      'EVIDENCE_UPLOADED': 'EVIDENCE_UPLOADED',
      'COMMENT_ADDED': 'COMMENT_ADDED',
      'SLA_WARNING': 'SLA_WARNING',
      'SLA_BREACH': 'SLA_BREACH',
      'ESCALATION': 'ESCALATION',
      'MENTION': 'MENTION',
      'WATCHER_ADDED': 'WATCHER_ADDED'
    };

    const type = typeMap[eventType] || 'TASK_UPDATED';
    
    const data = {
      task: { id: task.id, code: task.code, title: task.title },
      taskId: task.id,
      taskCode: task.code,
      taskTitle: task.title,
      assigneeId: task.assigneeId,
      reviewerId: task.reviewerId,
      assigneeName: task.assigneeName,
      reviewerName: task.reviewerName,
      actorId: actor?.id,
      actorName: actor?.name,
      dueDate: task.dueDate,
      priority: task.priority,
      ...details
    };

    return this.sendNotificationForType(task.assigneeId, type, data);
  }

  /**
   * Get notification preferences for user
   */
  async getUserPreferences(userId) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query('SELECT * FROM UserNotificationPreferences WHERE UserId = @userId');
    
    return result.recordset[0] || {
      email: true,
      inApp: true,
      slack: false,
      webhook: false,
      sms: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      timezone: 'Asia/Kolkata'
    };
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId, preferences) {
    const { sql, getPool, generateId } = require('../../database/db');
    const pool = await getPool();
    
    await pool.request()
      .input('userId', sql.VarChar, userId)
      .input('email', sql.Bit, preferences.email ? 1 : 0)
      .input('inApp', sql.Bit, preferences.inApp ? 1 : 0)
      .input('slack', sql.Bit, preferences.slack ? 1 : 0)
      .input('webhook', sql.Bit, preferences.webhook ? 1 : 0)
      .input('sms', sql.Bit, preferences.sms ? 1 : 0)
      .input('quietHoursStart', sql.VarChar, preferences.quietHoursStart || '22:00')
      .input('quietHoursEnd', sql.VarChar, preferences.quietHoursEnd || '08:00')
      .input('timezone', sql.VarChar, preferences.timezone || 'Asia/Kolkata')
      .query(`
        MERGE UserNotificationPreferences AS target
        USING (SELECT @userId as UserId) AS source
        ON target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET Email = @email, InApp = @inApp, Slack = @slack, Webhook = @webhook, Sms = @sms,
            QuietHoursStart = @quietHoursStart, QuietHoursEnd = @quietHoursEnd, Timezone = @timezone, UpdatedAt = dbo.GetEnvDate()
        WHEN NOT MATCHED THEN
          INSERT (UserId, Email, InApp, Slack, Webhook, Sms, QuietHoursStart, QuietHoursEnd, Timezone, CreatedAt, UpdatedAt)
          VALUES (@userId, @email, @inApp, @slack, @webhook, @sms, @quietHoursStart, @quietHoursEnd, @timezone, dbo.GetEnvDate(), dbo.GetEnvDate());
      `);
  }
}

// Singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;
module.exports.NotificationService = NotificationService;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.NOTIFICATION_CHANNELS = NOTIFICATION_CHANNELS;
module.exports.NOTIFICATION_PRIORITY = NOTIFICATION_PRIORITY;
module.exports.NOTIFICATION_TEMPLATES = NOTIFICATION_TEMPLATES;