const SystemLogService = require('../services/SystemLogService');

exports.getLogs = async (req, res) => {
    try {
        const logs = await SystemLogService.getLogs();
        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
};
