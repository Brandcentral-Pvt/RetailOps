/**
 * TaskFlow SLA Engine
 * Handles SLA calculations, breach detection, and monitoring
 */
const { sql, getPool, generateId } = require('../../database/db');
const { buildInClause } = require('../utils/sqlHelpers');
const logger = require('../../utils/logger');
const eventBus = require('../eventBus');
const workflowEngine = require('./workflowEngine');

const SLA_STATUS = {
  WITHIN_SLA: 'WITHIN_SLA',
  AT_RISK: 'AT_RISK',
  BREACHED: 'BREACHED'
};

const SLA_EVENT_TYPES = {
  WARNING: 'SLA_WARNING',
  BREACH: 'SLA_BREACH',
  ESCALATION: 'SLA_ESCALATION',
  RESOLVED: 'SLA_RESOLVED'
};

class SlaEngine {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
  }

  /**
   * Calculate SLA status for a task based on due date and SLA policy
   */
  calculateTaskSlaStatus(task, slaPolicy = null) {
    if (!task.dueDate) return 'WITHIN_SLA';
    
    const slaHours = task.slaHours || 48;
    const policy = slaPolicy || { 
      warningHours: [24, 12, 6],
      businessHoursOnly: true,
      excludeWeekends: true,
      timezone: 'Asia/Kolkata'
    };
    
    const now = new Date();
    const due = new Date(task.dueDate);
    
    if (now > due) return 'BREACHED';
    
    const hoursRemaining = (new Date(task.dueDate) - new Date()) / (1000 * 60 * 60);
    const riskThreshold = (task.slaHours || 48) * 0.25;
    
    if (hoursRemaining <= riskThreshold) return 'AT_RISK';
    return 'WITHIN_SLA';
  }

  /**
   * Calculate detailed SLA metrics for a task
   */
  calculateTaskSlaMetrics(task, slaPolicy = null) {
    if (!task.dueDate) {
      return {
        status: 'WITHIN_SLA',
        hoursRemaining: null,
        hoursOverdue: 0,
        businessHoursRemaining: null,
        riskLevel: 'none',
        escalationLevel: null
      };
    }

    const now = new Date();
    const due = new Date(task.dueDate);
    const slaHours = task.slaHours || 48;
    
    const hoursRemaining = (new Date(task.dueDate) - new Date()) / (1000 * 60 * 60);
    const isOverdue = new Date() > new Date(task.dueDate);
    
    let businessHoursRemaining = hoursRemaining;
    let hoursOverdue = 0;
    
    if (now > new Date(task.dueDate)) {
      hoursOverdue = (new Date() - new Date(task.dueDate)) / (1000 * 60 * 60);
    }
    
    // Calculate business hours remaining
    // Simplified - would need business hours calculation
    
    const status = this.calculateTaskSlaStatus({ 
      dueDate: task.dueDate, 
      slaHours: task.slaHours || 48 
    });
    
    const escalationLevel = this.getEscalationLevel(task.dueDate, task.slaHours || 48);
    
    return {
      status,
      hoursRemaining: Math.max(0, hoursRemaining),
      hoursOverdue: Math.max(0, -hoursRemaining),
      businessHoursRemaining: Math.max(0, businessHoursRemaining),
      riskLevel: this.getRiskLevel(hoursRemaining, task.slaHours || 48),
      escalationLevel: this.getEscalationLevel(task.dueDate, task.slaHours || 48),
      hoursUntilBreach: Math.max(0, hoursRemaining),
      hoursOverdue: Math.max(0, hoursOverdue)
    };
  }

  getRiskLevel(hoursRemaining, slaHours) {
    if (hoursRemaining <= 0) return 'critical';
    if (hoursRemaining <= 12) return 'high';
    if (hoursRemaining <= 24) return 'medium';
    if (hoursRemaining <= slaHours * 0.25) return 'low';
    return 'none';
  }

  getEscalationLevel(dueDate, slaHours) {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const hoursUntilDue = (due - now) / (1000 * 60 * 60);
    
    if (hoursUntilDue < -24) return 'admin';
    if (hoursUntilDue < 0) return 'manager';
    if (hoursUntilDue <= 12) return 'reviewer';
    if (hoursUntilDue <= 24) return 'assignee';
    return null;
  }

  /**
   * Check and update SLA status for all active tasks
   * This is called by a scheduled job
   */
  async checkAndUpdateSlaStatuses() {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const BATCH_SIZE = 500;
    let offset = 0;
    let updated = 0;
    let warningsSent = 0;
    let breachesDetected = 0;
    let escalationsTriggered = 0;

    while (true) {
      const batch = await pool.request()
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, BATCH_SIZE)
        .query(`
          SELECT Id, AssignedTo, AssigneeName, ReviewerId, ReviewerName, DueDate, SlaHours,
                 Status, SlaStatus, Title, LastSlaWarningAt, LastSlaBreachAt, SlaPolicyId,
                 EscalationLevel, LastEscalationAt
          FROM TaskInstances
          WHERE Status NOT IN ('APPROVED', 'CANCELLED')
            AND DueDate IS NOT NULL
          ORDER BY Id
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

      if (batch.recordset.length === 0) break;

      for (const task of batch.recordset) {
        const previousSlaStatus = task.SlaStatus;
        const newSlaStatus = this.calculateTaskSlaStatus({ 
          dueDate: task.DueDate, 
          slaHours: task.SlaHours || 48 
        });

        // Update SLA status if changed
        if (newSlaStatus !== previousSlaStatus) {
          await pool.request()
            .input('id', sql.VarChar, task.Id)
            .input('sla', sql.VarChar, newSlaStatus)
            .query('UPDATE TaskInstances SET SlaStatus = @sla WHERE Id = @id');
          
          updated++;
          
          // Emit SLA status change event
          eventBus.emit('sla:status_changed', {
            taskId: task.Id,
            previousStatus: previousSlaStatus,
            newStatus: newSlaStatus,
            taskTitle: task.Title
          });

          // Emit warning/breach events
          if (newSlaStatus === 'AT_RISK' && previousSlaStatus === 'WITHIN_SLA') {
            warningsSent++;
            await this.sendSlaWarning(task);
          } else if (newSlaStatus === 'BREACHED' && previousSlaStatus !== 'BREACHED') {
            breachesDetected++;
            await this.handleSlaBreach(task);
          }
        }

        // Check escalation
        const escalationLevel = this.getEscalationLevel(task.DueDate, task.SlaHours || 48);
        if (escalationLevel && escalationLevel !== task.EscalationLevel) {
          await this.handleEscalation(task, escalationLevel);
          escalationsTriggered++;
        }

        // Check warning/breach notifications (deduplicated)
        await this.checkAndSendNotifications(task);
      }

      offset += BATCH_SIZE;
    }

    return { updated, warningsSent, breachesDetected, escalationsTriggered };
  }

  /**
   * Send SLA warning notification
   */
  async sendSlaWarning(task) {
    logger.info(`SLA Warning sent for task ${task.Id}`);
  }

  /**
   * Handle SLA breach
   */
  async handleSlaBreach(task) {
    logger.warn(`SLA BREACH: Task ${task.Id} (${task.Title}) has breached SLA`);
    
    eventBus.emit('sla:breach', {
      taskId: task.Id,
      taskTitle: task.Title,
      assigneeId: task.AssignedTo,
      reviewerId: task.ReviewerId,
      breachedAt: new Date()
    });
  }

  /**
   * Handle escalation
   */
  async handleEscalation(task, escalationLevel) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    await pool.request()
      .input('id', sql.VarChar, task.Id)
      .input('level', sql.VarChar, escalationLevel)
      .input('now', sql.DateTime2, new Date())
      .query('UPDATE TaskInstances SET EscalationLevel = @level, LastEscalationAt = @now WHERE Id = @id');

    await this.sendEscalationNotifications(task, escalationLevel);

    eventBus.emit('sla:escalation', {
      taskId: task.Id,
      level: escalationLevel,
      assigneeId: task.AssignedTo,
      reviewerId: task.ReviewerId
    });

    logger.warn(`SLA Escalation to ${escalationLevel} for task ${task.Id}`);
  }

  /**
   * Send escalation notifications
   */
  async sendEscalationNotifications(task, escalationLevel) {
    logger.info(`Escalation notifications sent for task ${task.Id} at level ${escalationLevel}`);
  }

  /**
   * Check and send SLA warning/breach notifications (deduplicated)
   */
  async checkAndSendNotifications(task) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    const now = new Date();
    const H12 = 12 * 60 * 60 * 1000;
    const H24 = 24 * 60 * 60 * 1000;
    
    const lastWarn = task.LastSlaWarningAt ? new Date(task.LastSlaWarningAt).getTime() : 0;
    const lastBreach = task.LastSlaBreachAt ? new Date(task.LastSlaBreachAt).getTime() : 0;
    
    const slaStatus = this.calculateTaskSlaStatus({ 
      dueDate: task.DueDate, 
      slaHours: task.SlaHours || 48 
    });

    // Warning notification (once per 12 hours when at risk)
    if (task.SlaStatus === 'AT_RISK' && (now.getTime() - lastWarn) >= 12 * 60 * 60 * 1000) {
      await pool.request()
        .input('id', sql.VarChar, task.Id)
        .input('t', sql.DateTime2, new Date())
        .query('UPDATE TaskInstances SET LastSlaWarningAt = @t WHERE Id = @id');
    }

    // Breach notification (once per 24 hours)
    if (task.SlaStatus === 'BREACHED' && (now.getTime() - lastBreach) >= 24 * 60 * 60 * 1000) {
      await pool.request()
        .input('id', sql.VarChar, task.Id)
        .input('t', sql.DateTime2, new Date())
        .query('UPDATE TaskInstances SET LastSlaBreachAt = @t WHERE Id = @id');
    }
  }

  /**
   * Start the SLA monitoring job
   */
  startMonitoring(intervalMinutes = 30) {
    if (this.isRunning) {
      logger.warn('SLA Engine already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting SLA monitoring job (interval: ${intervalMinutes} minutes)`);

    this.checkAndUpdateSlaStatuses().catch(err => logger.error('SLA check failed:', err));

    this.checkInterval = setInterval(() => {
      this.checkAndUpdateSlaStatuses().catch(err => logger.error('SLA check failed:', err));
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the SLA monitoring job
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('SLA monitoring stopped');
  }

  /**
   * Get SLA metrics for dashboard
   */
  async getSlaMetrics(filters = {}) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    let where = 'WHERE 1=1';
    const req = pool.request();

    if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
    if (filters.assigneeId) { where += ' AND AssigneeId = @assigneeId'; req.input('assigneeId', sql.VarChar, filters.assigneeId); }
    if (filters.reviewerId) { where += ' AND ReviewerId = @reviewerId'; req.input('reviewerId', sql.VarChar, filters.reviewerId); }
    if (filters.status) { where += ' AND Status = @status'; req.input('status', sql.VarChar, filters.status); }

    const result = await req.query(`
      SELECT 
        SlaStatus, COUNT(*) as count
      FROM TaskInstances
      ${where}
      GROUP BY SlaStatus
    `);

    const totalResult = await pool.request().query(`
      SELECT COUNT(*) as total FROM TaskInstances ${where}
    `);

    const total = totalResult.recordset[0]?.total || 0;
    const breakdown = {};
    let breached = 0, atRisk = 0, within = 0;

    result.recordset.forEach(r => {
      breakdown[r.SlaStatus] = r.count;
      if (r.SlaStatus === 'BREACHED') breached = r.count;
      else if (r.SlaStatus === 'AT_RISK') atRisk = r.count;
      else if (r.SlaStatus === 'WITHIN_SLA') within = r.count;
    });

    return {
      total,
      withinSla: within,
      atRisk,
      breached,
      breachRate: total > 0 ? (breached / total * 100).toFixed(2) : 0,
      atRiskRate: total > 0 ? (atRisk / total * 100).toFixed(2) : 0,
      breakdown
    };
  }

  /**
   * Get SLA trends over time
   */
  async getSlaTrends(days = 30, filters = {}) {
    const { sql, getPool } = require('../../database/db');
    const pool = await getPool();
    
    let where = 'WHERE 1=1';
    const req = pool.request();
    
    if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    req.input('startDate', sql.DateTime2, startDate);

    const result = await req.query(`
      SELECT 
        CAST(CreatedAt AS DATE) as Date,
        SUM(CASE WHEN SlaStatus = 'BREACHED' THEN 1 ELSE 0 END) as Breached,
        SUM(CASE WHEN SlaStatus = 'AT_RISK' THEN 1 ELSE 0 END) as AtRisk,
        SUM(CASE WHEN SlaStatus = 'WITHIN_SLA' THEN 1 ELSE 0 END) as WithinSla,
        COUNT(*) as Total
      FROM TaskInstances
      ${where} AND CreatedAt >= @startDate
      GROUP BY CAST(CreatedAt AS DATE)
      ORDER BY Date ASC
    `);

    return result.recordset.map(r => ({
      date: r.Date,
      breached: r.Breached,
      atRisk: r.AtRisk,
      withinSla: r.WithinSla,
      total: r.Total,
      breachRate: r.Total > 0 ? (r.Breached / r.Total * 100).toFixed(2) : 0
    }));
  }
}

module.exports = new SlaEngine();