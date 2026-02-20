const Notification = require('../models/Notification');
const User = require('../models/User');
const Seller = require('../models/Seller');
const mongoose = require('mongoose');

exports.handleCometChatWebhook = async (req, res) => {
    try {
        const event = req.body;
        console.log('📬 CometChat Webhook Received:', JSON.stringify(event, null, 2));

        // We only care about message events
        // CometChat webhook format: { event: 'message_received', data: { ... } }
        // Note: Actual event structure may vary based on CometChat version/config
        const { event: eventName, data } = event;

        if (!data || !data.receiver) {
            return res.status(200).json({ success: true, message: 'Not a message event' });
        }

        const senderUid = data.sender;
        const receiverUid = data.receiver;
        const receiverType = data.receiverType;
        const messageText = data.data?.text || 'Sent an attachment';

        // Find the sender (could be a user or a seller)
        const sender = await User.findOne({ cometChatUid: senderUid }) || await Seller.findOne({ cometChatUid: senderUid });
        const senderName = sender ? (sender.firstName ? `${sender.firstName} ${sender.lastName}` : sender.name) : 'Someone';

        if (receiverType === 'user') {
            // Direct Message
            const recipient = await User.findOne({ cometChatUid: receiverUid });
            if (recipient) {
                await Notification.create({
                    recipient: recipient._id,
                    type: 'CHAT_MESSAGE',
                    referenceModel: 'User',
                    referenceId: sender ? sender._id : mongoose.Types.ObjectId(), // If sender not found, use a dummy or skip
                    message: `${senderName}: ${messageText}`
                });
                console.log(`🔔 Notification created for User: ${recipient.email}`);
            }
        } else if (receiverType === 'group') {
            // Group Message
            // In a real scenario, we might want to notify all members of the group except the sender
            // But we don't have a reliable mapping for group members in the DB unless we sync them
            // For now, let's at least handle direct messages as per typical dashboard requirements
            console.log('Group message received, skipping multi-user notification for now (requires group sync)');
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Webhook Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
