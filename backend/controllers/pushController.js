const PushService = require('../services/pushService');

/**
 * Register the current user's device push token (Expo push token).
 */
exports.registerToken = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const { token, platform } = req.body || {};

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Push token is required' });
        }

        await PushService.registerToken(userId, token.trim(), platform || null);

        res.json({ success: true, message: 'Push token registered' });
    } catch (error) {
        console.error('Push register error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to register push token' });
    }
};

/**
 * Remove the current user's device push token (e.g. on logout).
 */
exports.unregisterToken = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const { token } = req.body || {};

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Push token is required' });
        }

        await PushService.unregisterToken(userId, token.trim());

        res.json({ success: true, message: 'Push token removed' });
    } catch (error) {
        console.error('Push unregister error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to remove push token' });
    }
};