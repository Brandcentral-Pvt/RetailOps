/**
 * TaskFlow Phase 2 — Escalation Policies, Escalations log, unified
 * Notifications, Notification Preferences, plus default escalation policies.
 *
 * Converted from plain .sql to JS: FK columns to Users/TaskInstances are typed
 * from the *actual* referenced column at runtime (live EF-schema uses
 * nvarchar(100) for Users.Id, VARCHAR(50) varchar for TaskInstances.Id).
 */
const { sql, columnExists, createTableIfMissing } = require('./_helpers');

module.exports = {
  up: async (pool) => {
    // ── TaskEscalationPolicies ──
    await createTableIfMissing(pool, {
      name: 'TaskEscalationPolicies',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['Name', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['Description', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['TriggerType', { ddl: 'NVARCHAR(50) NOT NULL' }],
        ['Conditions', { ddl: 'NVARCHAR(MAX) NOT NULL' }],
        ['Actions', { ddl: 'NVARCHAR(MAX) NOT NULL' }],
        ['NotifyRoles', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['NotifyUsers', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['Channels', { ddl: 'NVARCHAR(MAX) NOT NULL' }],
        ['DelayMinutes', { ddl: 'INT NOT NULL DEFAULT 0' }],
        ['RepeatIntervalMinutes', { ddl: 'INT NOT NULL DEFAULT 0' }],
        ['MaxEscalations', { ddl: 'INT NOT NULL DEFAULT 3' }],
        ['CooldownMinutes', { ddl: 'INT NOT NULL DEFAULT 60' }],
        ['Priority', { ddl: 'INT NOT NULL DEFAULT 10' }],
        ['IsActive', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['CreatedBy', { ddl: 'VARCHAR(50) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskEscalationPolicies_Active', cols: ['IsActive'] },
        { name: 'IX_TaskEscalationPolicies_Trigger', cols: ['TriggerType'] },
      ],
    });

    // ── TaskEscalations ──
    await createTableIfMissing(pool, {
      name: 'TaskEscalations',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['RuleId', { fk: { table: 'TaskEscalationPolicies', col: 'Id' }, nullable: false }],
        ['TriggerType', { ddl: 'NVARCHAR(50) NOT NULL' }],
        ['EscalationLevel', { ddl: 'NVARCHAR(20) NOT NULL' }],
        ['TriggeredAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['Metadata', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['NotifiedUsers', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['Status', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'PENDING'" }],
        ['ErrorMessage', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskEscalations_TaskId', cols: ['TaskId'] },
        { name: 'IX_TaskEscalations_RuleId', cols: ['RuleId'] },
        { name: 'IX_TaskEscalations_TriggeredAt', cols: ['TriggeredAt DESC'] },
        { name: 'IX_TaskEscalations_Status', cols: ['Status'] },
      ],
    });

    // ── TaskNotifications ──
    await createTableIfMissing(pool, {
      name: 'TaskNotifications',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['UserId', { fk: { table: 'Users', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['Type', { ddl: 'NVARCHAR(50) NOT NULL' }],
        ['Title', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['Message', { ddl: 'NVARCHAR(MAX) NOT NULL' }],
        ['ActionUrl', { ddl: 'NVARCHAR(500) NULL' }],
        ['Priority', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'normal'" }],
        ['IsRead', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['ReadAt', { ddl: 'DATETIME2 NULL' }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, onDelete: 'SET NULL' }],
        ['Metadata', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskNotifications_UserId_IsRead', cols: ['UserId', 'IsRead'] },
        { name: 'IX_TaskNotifications_UserId_CreatedAt', cols: ['UserId', 'CreatedAt DESC'] },
        { name: 'IX_TaskNotifications_TaskId', cols: ['TaskId'] },
        { name: 'IX_TaskNotifications_Type', cols: ['Type'] },
      ],
    });

    // ── UserNotificationPreferences (per-user, seeded on first login) ──
    await createTableIfMissing(pool, {
      name: 'UserNotificationPreferences',
      columns: [
        ['UserId', { fk: { table: 'Users', col: 'Id' }, nullable: false, onDelete: 'CASCADE', pk: true }],
        ['Email', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['InApp', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['Slack', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['Webhook', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['Sms', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['QuietHoursStart', { ddl: "NVARCHAR(10) NOT NULL DEFAULT '22:00'" }],
        ['QuietHoursEnd', { ddl: "NVARCHAR(10) NOT NULL DEFAULT '08:00'" }],
        ['Timezone', { ddl: "NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata'" }],
        ['EmailDigest', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['DigestFrequency', { ddl: 'NVARCHAR(20) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
    });

    // ── Default escalation policies (guarded: only when migration schema present) ──
    const hasChannels = await columnExists(pool, 'TaskEscalationPolicies', 'Channels');
    if (hasChannels) {
      const seeds = [
        ['esc-sla-warning', 'SLA Warning', 'Notify assignee when task is at risk of SLA breach', 'SLA_WARNING',
          '{"atRisk": true}',
          '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee"], "channels": ["in_app", "email"]}]',
          '["assignee"]', '["in_app", "email"]', 0, 360, 3, 360, 10],
        ['esc-sla-breach', 'SLA Breach', 'Escalate when task SLA is breached', 'SLA_BREACH',
          '{"slaBreached": true}',
          '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee", "reviewer", "manager"], "channels": ["in_app", "email", "slack"]}, {"type": "ADD_WATCHER", "targetUserId": "{{reviewerId}}"}, {"type": "ADD_COMMENT", "message": "SLA breached - automatic escalation triggered"}]',
          '["assignee", "reviewer", "manager"]', '["in_app", "email", "slack"]', 0, 120, 3, 60, 5],
        ['esc-stalled-task', 'Stalled Task', 'Escalate when task has no activity for 48 hours', 'STALLED_TASK',
          '{"stalledHours": 48}',
          '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee", "reviewer"], "channels": ["in_app", "email"]}, {"type": "ADD_COMMENT", "message": "Task appears stalled - no activity for 48 hours"}]',
          '["assignee", "reviewer"]', '["in_app", "email"]', 0, 1440, 2, 1440, 15],
        ['esc-overdue-subtask', 'Overdue Subtask', 'Escalate when subtask is overdue by 24 hours', 'OVERDUE_SUBTASK',
          '{"overdueHours": 24}',
          '[{"type": "CREATE_SUBTASK", "title": "Resolve overdue subtask", "assigneeId": "{{assigneeId}}"}, {"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee"], "channels": ["in_app", "email"]}]',
          '["assignee"]', '["in_app", "email"]', 0, 720, 2, 720, 20],
      ];
      for (const [id, name, desc, triggerType, conditions, actions, notifyRoles, channels, delay, repeat, maxEsc, cooldown, priority] of seeds) {
        const req = pool.request();
        req.input('id', sql.NVarChar, id);
        req.input('name', sql.NVarChar, name);
        req.input('desc', sql.NVarChar, desc);
        req.input('triggerType', sql.NVarChar, triggerType);
        req.input('conditions', sql.NVarChar, conditions);
        req.input('actions', sql.NVarChar, actions);
        req.input('notifyRoles', sql.NVarChar, notifyRoles);
        req.input('channels', sql.NVarChar, channels);
        req.input('delay', sql.Int, delay);
        req.input('repeat', sql.Int, repeat);
        req.input('maxEsc', sql.Int, maxEsc);
        req.input('cooldown', sql.Int, cooldown);
        req.input('priority', sql.Int, priority);
        await req.query(`
          IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = @id)
          BEGIN
            INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
            VALUES (@id, @name, @desc, @triggerType, @conditions, @actions, @notifyRoles, @channels,
                    @delay, @repeat, @maxEsc, @cooldown, @priority, 1, dbo.GetEnvDate(), dbo.GetEnvDate());
            PRINT 'Inserted default escalation policy: ' + @name;
          END
        `);
      }
    }

    console.log('010_taskflow_phase2_escalation_notifications complete');
  },
};