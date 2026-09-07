/**
 * TaskFlow Escalation Engine
 * Handles automatic escalation based on SLA breaches and configurable rules
 */
const { sql, getPool, generateId } = require('../../database/db');
const { buildInClause } = require('../utils/sqlHelpers');
const logger = require('../../utils/logger');
const eventBus = require('../eventBus');
const workflowEngine = require('./workflowEngine');

const ESCALATION_LEVELS = {
  NONE: 0,
  ASSIGNEE: 1,
  REVIEWER: 2,
  MANAGER: 3,
  ADMIN: 4
};

const ESCALATION_TRIGGERS = {
  SLA_BREACH: 'SLA_BREACH',
  SLA_WARNING: 'SLA_WARNING',
  MANUAL: 'MANUAL',
  OVERDUE_SUBTASK: 'OVERDUE_SUBTASK',
  STALLED_TASK: 'STALLED_TASK'
};

const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  IN_APP: 'in_app',
  SLACK: 'slack',
  WEBHOOK: 'webhook',
  SMS: 'sms'
};

class EscalationEngine {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
    this.escalationRules = new Map();
  }

  /**
   * Initialize escalation rules from database
   */
  async loadEscalationRules() {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT * FROM TaskEscalationPolicies WHERE IsActive = 1
      ORDER BY Priority
    `);
    
    this.escalationRules.clear();
    result.recordset.forEach(rule => {
      this.escalationRules.set(rule.Id, {
        id: rule.Id,
        name: rule.Name,
        trigger: rule.TriggerType,
        conditions: safeParse(rule.Conditions, {}),
        actions: safeParse(rule.Actions, []),
        notifyRoles: safeParse(rule.NotifyRoles, []),
        notifyUsers: safeParse(rule.NotifyUsers, []),
        channels: safeParse(rule.Channels, ['in_app', 'email']),
        delayMinutes: rule.DelayMinutes || 0,
        repeatIntervalMinutes: rule.RepeatIntervalMinutes || 0,
        maxEscalations: rule.MaxEscalations || 3,
        cooldownMinutes: rule.CooldownMinutes || 60,
        isActive: rule.IsActive === 1
      });
    });
    
    logger.info(`Loaded ${this.escalationRules.size} escalation rules`);
  }

  /**
   * Evaluate escalation rules for a task
   */
  async evaluateTask(task) {
    if (!task.dueDate) return [];
    
    const triggeredRules = [];
    
    for (const [ruleId, rule] of this.escalationRules) {
      if (!rule.isActive) continue;
      
      // Check if rule conditions match
      if (await this.evaluateConditions(rule, task)) {
        // Check cooldown
        if (await this.isInCooldown(task.id, rule.id)) continue;
        
        // Check max escalations
        const escalationCount = await this.getEscalationCount(task.id, rule.id);
        if (escalationCount >= rule.maxEscalations) continue;
        
        // Check cooldown
        const lastEscalation = await this.getLastEscalationTime(task.id, rule.id);
        if (lastEscalation) {
          const timeSinceLast = Date.now() - new Date(lastEscalation).getTime();
          if (timeSinceLast < rule.cooldownMinutes * 60 * 1000) continue;
        }
        
        // Check delay
        if (rule.delayMinutes > 0) {
          const delayMs = rule.delayMinutes * 60 * 1000;
          if (Date.now() - new Date(task.updatedAt || task.createdAt).getTime() < delayMs) continue;
        }
        
        triggeredRules.push(rule);
      }
    }
    
    return triggeredRules;
  }

  /**
   * Evaluate escalation rule conditions against a task
   */
  async evaluateConditions(rule, task) {
    const conditions = rule.conditions;
    if (!conditions || Object.keys(conditions).length === 0) return true;
    
    // SLA breach condition
    if (conditions.slaBreached && task.slaStatus !== 'BREACHED') return false;
    
    // SLA at risk
    if (conditions.atRisk && task.slaStatus !== 'AT_RISK' && task.slaStatus !== 'BREACHED') return false;
    
    // Overdue by X hours
    if (conditions.overdueHours) {
      if (!task.dueDate) return false;
      const hoursOverdue = (new Date() - new Date(task.dueDate)) / (1000 * 60 * 60);
      if (hoursOverdue < conditions.overdueHours) return false;
    }
    
    // Hours before due
    if (conditions.hoursBeforeDue) {
      if (!task.dueDate) return false;
      const hoursUntilDue = (new Date(task.dueDate) - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilDue > conditions.hoursBeforeDue) return false;
    }
    
    // Stalled task (no activity for X hours)
    if (conditions.stalledHours) {
      const lastActivity = task.lastActivityAt || task.updatedAt;
      const hoursSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
      if (hoursSinceActivity < conditions.stalledHours) return false;
    }
    
    // Priority match
    if (conditions.priority && conditions.priority !== task.priority) return false;
    
    // Department match
    if (conditions.department && conditions.department !== task.department) return false;
    
    // Status match
    if (conditions.status && conditions.status !== task.status) return false;
    
    // Subtask completion percentage
    if (conditions.subtaskCompletionPct !== undefined) {
      const completionPct = task.totalSubTasks > 0 
        ? (task.completedSubTasks / task.totalSubTasks) * 100 
        : 100;
      if (completionPct < conditions.subtaskCompletionPct) return false;
    }
    
    return true;
  }

  /**
   * Execute escalation actions
   */
  async executeEscalation(task, rule, context = {}) {
    const { sql, getPool, generateId } = require('../../database/db');
    const pool = await getPool();
    const escalationId = generateId();
    
    const escalation = {
      id: generateId(),
      taskId: task.id,
      ruleId: rule.id,
      triggerType: context.triggerType || 'AUTOMATIC',
      escalationLevel: context.escalationLevel || 'ASSIGNEE',
      triggeredAt: new Date(),
      notifiedUsers: [],
      channels: rule.channels,
      status: 'PENDING',
      metadata: {
        triggerType: context.triggerType,
        slaStatus: context.slaStatus,
        hoursOverdue: context.hoursOverdue,
        previousEscalationLevel: context.previousLevel
      }
    };
    
    try {
      // Record escalation
      await pool.request()
        .input('id', sql.VarChar, escalation.id)
        .input('taskId', sql.VarChar, task.id)
        .input('ruleId', sql.VarChar, rule.id)
        .input('triggerType', sql.VarChar, escalation.triggerType)
        .input('escalationLevel', sql.VarChar, context.escalationLevel)
        .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify(escalation.metadata))
        .query(`
          INSERT INTO TaskEscalations (Id, TaskId, RuleId, TriggerType, EscalationLevel, TriggeredAt, Metadata, Status)
          VALUES (@id, @taskId, @ruleId, @triggerType, @escalationLevel, dbo.GetEnvDate(), @metadata, 'PENDING')
        `);
      
      // Execute actions
      const results = [];
      
      for (const action of rule.actions) {
        try {
          const result = await this.executeAction(action, task, rule);
          results.push({ action: action.type, success: true, result });
        } catch (err) {
          results.push({ action: action.type, success: false, error: err.message });
          logger.error(`Escalation action failed: ${action.type}`, { error: err.message });
        }
      }
      
      // Send notifications
      const notifiedUsers = await this.sendNotifications(task, rule, context);
      escalation.notifiedUsers = notifiedUsers;
      
      // Update escalation record
      await pool.request()
        .input('id', sql.VarChar, escalation.id)
        .input('notifiedUsers', sql.NVarChar(sql.MAX), JSON.stringify(notifiedUsers))
        .input('status', sql.VarChar, 'COMPLETED')
        .query('UPDATE TaskEscalations SET NotifiedUsers = @notifiedUsers, Status = @status WHERE Id = @id');
      
      // Log audit
      await this.logEscalation(task.id, escalation.id, rule.id, context);
      
      // Emit event
      eventBus.emit('escalation:executed', {
        escalationId: escalation.id,
        taskId: task.id,
        ruleId: rule.id,
        level: context.escalationLevel,
        results
      });
      
      return { escalation, results };
      
    } catch (err) {
      logger.error('Escalation execution failed', { error: err.message, taskId: task.id, ruleId: rule.id });
      throw err;
    }
  }

  /**
   * Execute a single escalation action
   */
  async executeAction(action, task, rule) {
    switch (action.type) {
      case 'REASSIGN':
        return await this.reassignTask(action, task);
      case 'CHANGE_PRIORITY':
        return await this.changePriority(action, task);
      case 'ADD_WATCHER':
        return await this.addWatcher(action, task);
      case 'CREATE_SUBTASK':
        return await this.createEscalationSubtask(action, task);
      case 'SEND_NOTIFICATION':
        return await this.sendCustomNotification(action, task);
      case 'RUN_WEBHOOK':
        return await this.callWebhook(action, task);
      case 'UPDATE_SLA':
        return await this.updateSlaPolicy(action, task);
      case 'ADD_COMMENT':
        return await this.addSystemComment(action, task);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Reassign task to another user
   */
  async reassignTask(action, task) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const newAssigneeId = action.newAssigneeId || action.targetUserId;
    if (!newAssigneeId) throw new Error('REASSIGN requires newAssigneeId');
    
    await pool.request()
      .input('id', sql.VarChar, task.id)
      .input('assigneeId', sql.VarChar, action.newAssigneeId)
      .input('previousAssigneeId', sql.VarChar, task.assigneeId)
      .query('UPDATE TaskInstances SET AssigneeId = @assigneeId, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
    
    return { success: true, newAssigneeId: action.newAssigneeId };
  }

  /**
   * Change task priority
   */
  async changePriority(action, task) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const newPriority = action.newPriority || action.priority;
    if (!newPriority) throw new Error('CHANGE_PRIORITY requires newPriority');
    
    await pool.request()
      .input('id', sql.VarChar, task.id)
      .input('priority', sql.VarChar, newPriority)
      .query('UPDATE TaskInstances SET Priority = @priority, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
    
    return { success: true, newPriority };
  }

  /**
   * Add watcher to task
   */
  async addWatcher(action, task) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const userId = action.userId || action.targetUserId;
    if (!userId) throw new Error('ADD_WATCHER requires userId');
    
    const { addWatcher } = require('./service');
    return await addWatcher(task.id, userId);
  }

  /**
   * Create escalation subtask
   */
  async createEscalationSubtask(action, task) {
    const { createSubTask } = require('./service');
    
    const title = action.title || `Escalation: ${task.title}`;
    const description = action.description || `Auto-generated escalation subtask for task ${task.code}`;
    
    return await createSubTask({
      taskId: task.id,
      title,
      description,
      assigneeId: action.assigneeId,
      expectedOutput: action.expectedOutput || 'Resolve escalation',
      isMandatory: action.isMandatory !== false
    });
  }

  /**
   * Send custom notification
   */
  async sendCustomNotification(action, task) {
    const { triggerNotification } = require('../pems/emailNotificationService');
    
    return await triggerNotification({
      eventType: action.notificationType || 'CUSTOM',
      task,
      recipientId: action.recipientId,
      details: {
        message: action.message,
        priority: action.priority || 'HIGH'
      },
      actionUrl: action.actionUrl
    });
  }

  /**
   * Call webhook
   */
  async callWebhook(action, task) {
    if (!action.webhookUrl) throw new Error('RUN_WEBHOOK requires webhookUrl');
    
    const payload = {
      task: {
        id: task.id,
        code: task.code,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        slaStatus: task.slaStatus
      },
      escalation: action.escalationData || {},
      timestamp: new Date().toISOString()
    };
    
    const fetch = require('node-fetch');
    const response = await fetch(action.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...action.headers
      },
      body: JSON.stringify(payload),
      timeout: action.timeout || 10000
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
    
    return { success: true, status: response.status };
  }

  /**
   * Update SLA policy for task
   */
  async updateSlaPolicy(action, task) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const policyId = action.slaPolicyId;
    if (!policyId) throw new Error('UPDATE_SLA requires slaPolicyId');
    
    await pool.request()
      .input('id', sql.VarChar, task.id)
      .input('policyId', sql.VarChar, policyId)
      .query('UPDATE TaskInstances SET SlaPolicyId = @policyId, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
    
    return { success: true, slaPolicyId: policyId };
  }

  /**
   * Add system comment
   */
  async addSystemComment(action, task) {
    const { sql, getPool, generateId } = require('../../database/db');
    const pool = await getPool();
    const id = generateId();
    
    const content = action.message || `System escalation: ${action.reason || 'Automated escalation'}`;
    
    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('taskId', sql.VarChar, task.id)
      .input('authorId', sql.VarChar, 'system')
      .input('content', sql.NVarChar, content)
      .input('isInternal', sql.Bit, 1)
      .query('INSERT INTO TaskComments (Id, TaskId, AuthorId, Content, IsInternal, CreatedAt) VALUES (@id, @taskId, @authorId, @content, @isInternal, dbo.GetEnvDate())');
    
    return { success: true };
  }

  /**
   * Send notifications based on rule configuration
   */
  async sendNotifications(task, rule, context) {
    const notifiedUsers = [];
    const channels = rule.channels || ['in_app', 'email'];
    
    // Determine recipients
    const recipients = this.getNotificationRecipients(task, rule.notifyRoles, rule.notifyUsers);
    
    for (const userId of recipients) {
      if (channels.includes('in_app')) {
        await this.sendInAppNotification(userId, {
          type: 'ESCALATION',
          title: `Task Escalated: ${task.title}`,
          message: `Task ${task.code} has been escalated to ${context.escalationLevel || 'ASSIGNEE'} level.`,
          taskId: task.id,
          taskCode: task.code,
          priority: 'HIGH'
        });
        notifiedUsers.push({ userId, channel: 'in_app', sent: true });
      }
      
      if (channels.includes('email')) {
        try {
          await this.sendEmailNotification(userId, task, context);
          notifiedUsers.push({ userId, channel: 'email', sent: true });
        } catch (err) {
          logger.warn(`Failed to send escalation email to ${userId}`, { error: err.message });
          notifiedUsers.push({ userId, channel: 'email', sent: false, error: err.message });
        }
      }
      
      if (channels.includes('slack')) {
        try {
          await this.sendSlackNotification(userId, task, context);
          notifiedUsers.push({ userId, channel: 'slack', sent: true });
        } catch (err) {
          logger.warn(`Slack notification failed`, { error: err.message });
        }
      }
      
      if (channels.includes('webhook') && action.webhookUrl) {
        try {
          await this.callWebhook(action, task);
          notifiedUsers.push({ userId: 'webhook', channel: 'webhook', sent: true });
        } catch (err) {
          logger.warn(`Webhook notification failed`, { error: err.message });
        }
      }
    }
    
    return notifiedUsers;
  }

  /**
   * Get notification recipients based on rule config
   */
  getNotificationRecipients(task, notifyRoles, notifyUsers) {
    const recipients = new Set();
    
    // Explicit users
    if (notifyUsers && notifyUsers.length > 0) {
      notifyUsers.forEach(id => recipients.add(id));
    }
    
    // Role-based recipients
    if (notifyRoles && notifyRoles.length > 0) {
      if (notifyRoles.includes('assignee') && task.assigneeId) recipients.add(task.assigneeId);
      if (notifyRoles.includes('reviewer') && task.reviewerId) recipients.add(task.reviewerId);
      if (notifyRoles.includes('manager')) {
        // Would need to look up manager
      }
      if (notifyRoles.includes('admin')) {
        // Would need to look up admins
      }
    }
    
    // Default: assignee and reviewer
    if (recipients.size === 0) {
      if (task.assigneeId) recipients.add(task.assigneeId);
      if (task.reviewerId) recipients.add(task.reviewerId);
    }
    
    return Array.from(recipients);
  }

  /**
   * Send in-app notification
   */
  async sendInAppNotification(userId, notification) {
    const { sql, getPool, generateId } = require('../../database/db');
    const pool = await getPool();
    const id = generateId();
    
    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('userId', sql.VarChar, userId)
      .input('type', sql.VarChar, notification.type)
      .input('title', sql.NVarChar, notification.title)
      .input('message', sql.NVarChar, notification.message)
      .input('actionUrl', sql.NVarChar, notification.actionUrl || `/tasks/${notification.taskId}`)
      .query(`
        INSERT INTO TaskNotifications (Id, UserId, Type, Title, Message, ActionUrl, IsRead, CreatedAt)
        VALUES (@id, @userId, @type, @title, @message, @actionUrl, 0, dbo.GetEnvDate())
      `);
    
    // Emit real-time event
    eventBus.emit('notification:created', { userId, notification });
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(userId, task, context) {
    // Would integrate with email service
    logger.info(`Email notification sent to ${userId} for task ${task.id}`);
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(userId, task, context) {
    // Would integrate with Slack API
    logger.debug(`Slack notification sent to ${userId} for task ${task.id}`);
  }

  /**
   * Call webhook
   */
  async callWebhook(url, payload) {
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
  }

  /**
   * Get escalation history for a task
   */
  async getEscalationHistory(taskId) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const result = await pool.request()
      .input('taskId', sql.VarChar, taskId)
      .query(`
        SELECT e.*, r.Name as RuleName
        FROM TaskEscalations e
        LEFT JOIN TaskEscalationPolicies r ON e.RuleId = r.Id
        WHERE e.TaskId = @taskId
        ORDER BY e.TriggeredAt DESC
      `);
    
    return result.recordset;
  }

  /**
   * Get escalation count for task/rule
   */
  async getEscalationCount(taskId, ruleId) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const result = await pool.request()
      .input('taskId', sql.VarChar, taskId)
      .input('ruleId', sql.VarChar, ruleId)
      .query('SELECT COUNT(*) as count FROM TaskEscalations WHERE TaskId = @taskId AND RuleId = @ruleId');
    
    return result.recordset[0]?.count || 0;
  }

  /**
   * Get last escalation time
   */
  async getLastEscalationTime(taskId, ruleId) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const result = await pool.request()
      .input('taskId', sql.VarChar, taskId)
      .input('ruleId', sql.VarChar, ruleId)
      .query('SELECT TOP 1 TriggeredAt FROM TaskEscalations WHERE TaskId = @taskId AND RuleId = @ruleId ORDER BY TriggeredAt DESC');
    
    return result.recordset[0]?.TriggeredAt || null;
  }

  /**
   * Check if task/rule is in cooldown
   */
  async isInCooldown(taskId, ruleId) {
    const lastEscalation = await this.getLastEscalationTime(taskId, ruleId);
    if (!lastEscalation) return false;
    
    const rule = this.escalationRules.get(ruleId);
    if (!rule) return false;
    
    const timeSinceLast = Date.now() - new Date(lastEscalation).getTime();
    return timeSinceLast < rule.cooldownMinutes * 60 * 1000;
  }

  /**
   * Log escalation to audit log
   */
  async logEscalation(taskId, escalationId, ruleId, context) {
    const { sql, getPool, generateId } = require('../../database/db');
    const pool = await getPool();
    const id = generateId();
    
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('taskId', sql.VarChar, taskId)
      .input('action', sql.VarChar, 'ESCALATION')
      .input('fromStatus', sql.VarChar, null)
      .input('toStatus', sql.VarChar, context.escalationLevel || 'ESCALATED')
      .input('actorId', sql.VarChar, 'system')
      .input('actorName', sql.NVarChar, 'Escalation Engine')
      .input('details', sql.NVarChar, `Escalated via rule: ${context.triggerType || 'AUTOMATIC'}`)
      .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify({
        escalationId,
        ruleId,
        triggerType: context.triggerType,
        slaStatus: context.slaStatus,
        hoursOverdue: context.hoursOverdue,
        previousLevel: context.previousLevel
      }))
      .query(`
        INSERT INTO TaskAuditLogs (Id, TaskId, Action, FromStatus, ToStatus, ActorId, ActorName, Details, Metadata, CreatedAt)
        VALUES (@id, @taskId, @action, @fromStatus, @toStatus, @actorId, @actorName, @details, @metadata, dbo.GetEnvDate())
      `);
  }

  /**
   * Start escalation monitoring
   */
  startMonitoring(intervalMinutes = 15) {
    if (this.isRunning) {
      logger.warn('Escalation engine already running');
      return;
    }

    this.isRunning = true;
    this.loadEscalationRules().catch(err => logger.error('Failed to load escalation rules', err));
    
    logger.info(`Starting escalation engine (interval: ${intervalMinutes} minutes)`);
    
    // Run immediately
    this.runEscalationCheck().catch(err => logger.error('Escalation check failed', err));
    
    // Schedule recurring checks
    this.checkInterval = setInterval(() => {
      this.runEscalationCheck().catch(err => logger.error('Escalation check failed', err));
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Run escalation check for all active tasks
   */
  async runEscalationCheck() {
    if (!this.isRunning) return;
    
    try {
      // Reload rules periodically
      await this.loadEscalationRules();
      
      const { sql, getPool } = require('../../database/db');
      const pool = await getPool();
      
      const BATCH_SIZE = 200;
      let offset = 0;
      let totalEvaluated = 0;
      let totalEscalated = 0;

      while (true) {
        const batch = await pool.request()
          .input('offset', sql.Int, offset)
          .input('limit', sql.Int, 200)
          .query(`
            SELECT t.*, 
              (SELECT COUNT(*) FROM TaskSubTasks WHERE TaskId = t.Id) as TotalSubTasks,
              (SELECT COUNT(*) FROM TaskSubTasks WHERE TaskId = t.Id AND Status = 'COMPLETED') as CompletedSubTasks
            FROM TaskInstances t
            WHERE t.Status NOT IN ('APPROVED', 'CANCELLED')
              AND t.DueDate IS NOT NULL
            ORDER BY t.Id
            OFFSET @offset ROWS FETCH NEXT 200 ROWS ONLY
          `);

        if (batch.recordset.length === 0) break;

        for (const task of batch.recordset) {
          totalEvaluated++;
          
          // Add computed fields
          task.completedSubTasks = task.CompletedSubTasks;
          task.totalSubTasks = task.TotalSubTasks;
          task.subtaskCompletionPct = task.TotalSubTasks > 0 
            ? Math.round((task.CompletedSubTasks / task.TotalSubTasks) * 100) 
            : 100;

          const triggeredRules = await this.evaluateTask(task);
          
          for (const rule of triggeredRules) {
            try {
              await this.executeEscalation(task, rule, {
                triggerType: 'AUTOMATIC',
                slaStatus: task.SlaStatus,
                hoursOverdue: task.DueDate ? (Date.now() - new Date(task.DueDate).getTime()) / (1000 * 60 * 60) : 0,
                previousLevel: task.EscalationLevel || 'NONE'
              });
              totalEscalated++;
            } catch (err) {
              logger.error(`Escalation failed for task ${task.Id}`, { error: err.message, ruleId: rule.id });
            }
          }
        }

        offset += 200;
        if (offset > 10000) break; // Safety limit
      }

      logger.info(`Escalation check complete: evaluated ${totalEvaluated}, escalated ${totalEscalated}`);
      return { evaluated: totalEvaluated, escalated: totalEscalated };
      
    } catch (err) {
      logger.error('Escalation check failed', err);
      throw err;
    }
  }

  /**
   * Stop escalation engine
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Escalation engine stopped');
  }

  /**
   * Manual escalation trigger
   */
  async manualEscalate(taskId, actorId, actorName, reason, escalationLevel = 'MANAGER') {
    const { sql, getPool, generateId } = require('../../database/db');
    const pool = await getPool();
    
    const taskResult = await pool.request()
      .input('id', sql.VarChar, taskId)
      .query('SELECT * FROM TaskInstances WHERE Id = @id');
    
    if (!taskResult.recordset[0]) throw new Error('Task not found');
    
    const task = taskResult.recordset[0];
    
    // Create manual escalation record
    const escalationId = generateId();
    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('taskId', sql.VarChar, taskId)
      .input('ruleId', sql.VarChar, 'MANUAL')
      .input('triggerType', sql.VarChar, 'MANUAL')
      .input('escalationLevel', sql.VarChar, escalationLevel)
      .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify({ reason, actorId, actorName }))
      .query(`
        INSERT INTO TaskEscalations (Id, TaskId, RuleId, TriggerType, EscalationLevel, TriggeredAt, Metadata, Status)
        VALUES (@id, @taskId, @ruleId, @triggerType, @escalationLevel, dbo.GetEnvDate(), @metadata, 'COMPLETED')
      `);
    
    // Update task escalation level
    await pool.request()
      .input('id', sql.VarChar, taskId)
      .input('level', sql.Int, ESCALATION_LEVELS[escalationLevel] || 3)
      .query('UPDATE TaskInstances SET EscalationLevel = @level, LastEscalationAt = dbo.GetEnvDate() WHERE Id = @id');
    
    // Notify
    const taskData = { ...task, escalationLevel };
    await this.sendNotifications(task, {
      notifyRoles: ['assignee', 'reviewer', 'manager'],
      channels: ['in_app', 'email']
    }, { escalationLevel, triggerType: 'MANUAL' });
    
    // Log audit
    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('taskId', sql.VarChar, taskId)
      .input('action', sql.VarChar, 'ESCALATION')
      .input('fromStatus', sql.VarChar, null)
      .input('toStatus', sql.VarChar, 'ESCALATED')
      .input('actorId', sql.VarChar, actorId)
      .input('actorName', sql.NVarChar, actorName)
      .input('details', sql.NVarChar, `Manual escalation to ${escalationLevel}: ${reason}`)
      .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify({ escalationLevel, reason }))
      .query('INSERT INTO TaskAuditLogs (Id, TaskId, Action, FromStatus, ToStatus, ActorId, ActorName, Details, Metadata, CreatedAt) VALUES (@id, @taskId, @action, @fromStatus, @toStatus, @actorId, @actorName, @details, @metadata, dbo.GetEnvDate())');
    
    return { success: true, escalationLevel };
  }
}

// ============================================================
// DEFAULT ESCALATION POLICIES
// ============================================================

const DEFAULT_ESCALATION_POLICIES = [
  {
    id: 'esc-sla-warning',
    name: 'SLA Warning',
    triggerType: 'SLA_WARNING',
    conditions: { atRisk: true },
    actions: [
      { type: 'SEND_NOTIFICATION', notifyRoles: ['assignee'], channels: ['in_app', 'email'] }
    ],
    notifyRoles: ['assignee'],
    channels: ['in_app', 'email'],
    delayMinutes: 0,
    repeatIntervalMinutes: 360,
    maxEscalations: 3,
    cooldownMinutes: 360,
    priority: 10
  },
  {
    id: 'esc-sla-breach',
    name: 'SLA Breach',
    triggerType: 'SLA_BREACH',
    conditions: { slaBreached: true },
    actions: [
      { type: 'SEND_NOTIFICATION', notifyRoles: ['assignee', 'reviewer', 'manager'], channels: ['in_app', 'email'] },
      { type: 'ADD_WATCHER', targetUserId: '{{reviewerId}}' }
    ],
    notifyRoles: ['assignee', 'reviewer', 'manager'],
    channels: ['in_app', 'email', 'slack'],
    delayMinutes: 0,
    repeatIntervalMinutes: 120,
    maxEscalations: 3,
    cooldownMinutes: 60,
    priority: 5
  },
  {
    id: 'esc-stalled-task',
    name: 'Stalled Task',
    triggerType: 'STALLED_TASK',
    conditions: { stalledHours: 48 },
    actions: [
      { type: 'SEND_NOTIFICATION', notifyRoles: ['assignee', 'reviewer'], channels: ['in_app', 'email'] },
      { type: 'ADD_COMMENT', message: 'Task appears stalled - no activity for 48 hours' }
    ],
    notifyRoles: ['assignee', 'reviewer'],
    channels: ['in_app', 'email'],
    delayMinutes: 0,
    repeatIntervalMinutes: 1440,
    maxEscalations: 2,
    cooldownMinutes: 1440,
    priority: 15
  },
  {
    id: 'esc-overdue-subtask',
    name: 'Overdue Subtask',
    triggerType: 'OVERDUE_SUBTASK',
    conditions: { overdueHours: 24 },
    actions: [
      { type: 'CREATE_SUBTASK', title: 'Resolve overdue subtask', assigneeId: '{{assigneeId}}' },
      { type: 'SEND_NOTIFICATION', notifyRoles: ['assignee'], channels: ['in_app', 'email'] }
    ],
    notifyRoles: ['assignee'],
    channels: ['in_app', 'email'],
    delayMinutes: 0,
    repeatIntervalMinutes: 720,
    maxEscalations: 2,
    cooldownMinutes: 720,
    priority: 20
  }
];

module.exports = {
  EscalationEngine,
  DEFAULT_ESCALATION_POLICIES,
  ESCALATION_LEVELS: {
    NONE: 0,
    ASSIGNEE: 1,
    REVIEWER: 2,
    MANAGER: 3,
    ADMIN: 4
  },
  ESCALATION_TRIGGERS: {
    SLA_BREACH: 'SLA_BREACH',
    SLA_WARNING: 'SLA_WARNING',
    MANUAL: 'MANUAL',
    OVERDUE_SUBTASK: 'OVERDUE_SUBTASK',
    STALLED_TASK: 'STALLED_TASK'
  },
  NOTIFICATION_CHANNELS: {
    EMAIL: 'email',
    IN_APP: 'in_app',
    SLACK: 'slack',
    WEBHOOK: 'webhook',
    SMS: 'sms'
  }
};