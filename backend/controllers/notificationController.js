const Notification = require('../models/Notification');

// Get notifications for the current user
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const unreadOnly = req.query.unreadOnly === 'true';

        const query = { recipient: userId };
        if (unreadOnly) {
            query.isRead = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });

        res.json({
            success: true,
            data: notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            unreadCount
        });
    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Mark notification(s) as read
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { notificationId } = req.body;

        if (notificationId === 'all') {
            await Notification.updateMany(
                { recipient: userId, isRead: false },
                { $set: { isRead: true } }
            );
        } else {
            const notification = await Notification.findOne({ _id: notificationId, recipient: userId });
            if (!notification) {
                return res.status(404).json({ success: false, message: 'Notification not found' });
            }
            notification.isRead = true;
            await notification.save();
        }

        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Permanently delete a notification (dismiss)
exports.deleteNotification = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (id === 'all-read') {
            // Delete all read notifications for this user
            await Notification.deleteMany({ recipient: userId, isRead: true });
        } else {
            const result = await Notification.findOneAndDelete({ _id: id, recipient: userId });
            if (!result) {
                return res.status(404).json({ success: false, message: 'Notification not found' });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete Notification Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Internal helper to create notification
exports.createNotification = async (recipientId, type, referenceModel, referenceId, message) => {
    try {
        await Notification.create({
            recipient: recipientId,
            type,
            referenceModel,
            referenceId,
            message
        });
    } catch (error) {
        console.error('Create Notification Error:', error);
        // Don't throw, just log. Notifications shouldn't break the main flow.
    }
};
