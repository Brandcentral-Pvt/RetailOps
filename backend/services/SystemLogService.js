const SystemLog = require('../models/SystemLog');

class SystemLogService {
    async log({ type, entityType, entityId, entityTitle, user, description, metadata }) {
        try {
            const logEntry = new SystemLog({
                type,
                entityType,
                entityId,
                entityTitle,
                user: user._id || user,
                description,
                metadata
            });
            await logEntry.save();
            return logEntry;
        } catch (error) {
            console.error('[SystemLogService] Failed to create log:', error);
        }
    }

    async getLogs(filter = {}, limit = 100) {
        return SystemLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('user', 'firstName lastName email');
    }
}

module.exports = new SystemLogService();
