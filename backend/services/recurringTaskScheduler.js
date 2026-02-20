const cron = require('node-cron');
const Action = require('../models/Action');

class RecurringTaskScheduler {
    constructor() {
        this.job = null;
    }

    start() {
        // Run every hour to check for recurring tasks
        this.job = cron.schedule('0 * * * *', async () => {
            console.log('Running recurring task scheduler...');
            await this.processRecurringTasks();
            await this.checkAndNotifyOverdueTasks();
        });

        // Run CometChat full sync every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            console.log('Running background CometChat sync...');
            try {
                const { syncAllToCometChat } = require('./cometChatService');
                await syncAllToCometChat();
            } catch (err) {
                console.error('Background CometChat sync failed:', err);
            }
        });

        console.log('Recurring task scheduler started');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            console.log('Recurring task scheduler stopped');
        }
    }

    async processRecurringTasks() {
        try {
            const now = new Date();

            // Find all completed actions with recurring enabled and next occurrence due
            const dueActions = await Action.find({
                'recurring.enabled': true,
                'recurring.nextOccurrence': { $lte: now },
                status: 'COMPLETED'
            }).populate('asin').populate('assignedTo').populate('createdBy');

            console.log(`Found ${dueActions.length} recurring tasks due for creation`);

            for (const action of dueActions) {
                try {
                    // Create new instance
                    const newAction = await Action.createRecurringInstance(action);
                    await newAction.save();

                    console.log(`Created recurring instance for action ${action._id}: ${newAction._id}`);

                    // Update parent action's next occurrence
                    action.recurring.nextOccurrence = action.calculateNextOccurrence();
                    await action.save();

                    console.log(`Updated next occurrence for action ${action._id}: ${action.recurring.nextOccurrence}`);
                } catch (error) {
                    console.error(`Failed to create recurring instance for action ${action._id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error processing recurring tasks:', error);
        }
    }

    async checkAndNotifyOverdueTasks() {
        try {
            const { sendOverdueReminder } = require('./emailService');
            const now = new Date();

            // Find incomplete actions that are overdue and haven't been notified today
            // Note: In a real app, track 'lastRemindedAt' to avoid spamming
            const overdueActions = await Action.find({
                'timeTracking.deadline': { $lte: now },
                status: { $ne: 'COMPLETED' },
                'timeTracking.isOverdue': false // Or use a separate emailed flag
            }).populate('assignedTo');

            for (const action of overdueActions) {
                if (action.assignedTo && action.assignedTo.email) {
                    await sendOverdueReminder(action.assignedTo, action);
                    console.log(`Sent overdue reminder for action ${action._id}`);

                    // Mark as overdue processed (optional, to avoid re-sending immediately)
                    // action.timeTracking.isOverdue = true; // This matches the flag we query
                    // await action.save();
                }
            }
        } catch (error) {
            console.error('Error checking overdue tasks:', error);
        }
    }

    // Manual trigger for testing
    async triggerNow() {
        console.log('Manually triggering recurring task processing...');
        await this.processRecurringTasks();
    }
}

// Singleton instance
const scheduler = new RecurringTaskScheduler();

module.exports = scheduler;
