const Message = require('../models/Message');
const axios = require('axios');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get all conversations for the logged-in user
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id,
            isActive: true
        })
            .populate('participants', 'firstName lastName email avatar role isOnline lastSeen')
            .populate('sellerId', 'name marketplace sellerId')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'firstName lastName' }
            })
            .sort({ updatedAt: -1 });

        // Calculate unread counts for each conversation
        const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
            const unreadCount = await Message.countDocuments({
                conversationId: conv._id,
                'status.readBy': { $ne: req.user._id },
                sender: { $ne: req.user._id }
            });

            return {
                ...conv.toObject(),
                unreadCount
            };
        }));

        res.json({ success: true, data: conversationsWithUnread });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get or Create a conversation between participants (Direct)
exports.getOrCreateConversation = async (req, res) => {
    try {
        const { participantId, sellerId } = req.body;

        if (!participantId) {
            return res.status(400).json({ success: false, message: 'Participant ID is required' });
        }

        if (participantId === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot start a chat with yourself' });
        }

        // Check if direct conversation already exists
        let query = {
            type: 'DIRECT',
            participants: { $all: [req.user._id, participantId], $size: 2 }
        };

        if (sellerId) {
            query.sellerId = sellerId;
        }

        let conversation = await Conversation.findOne(query)
            .populate('participants', 'firstName lastName email avatar role isOnline lastSeen')
            .populate('sellerId', 'name marketplace sellerId');

        if (!conversation) {
            conversation = await Conversation.create({
                type: 'DIRECT',
                participants: [req.user._id, participantId],
                sellerId: sellerId || undefined
            });
            conversation = await conversation.populate([
                { path: 'participants', select: 'firstName lastName email avatar role isOnline lastSeen' },
                { path: 'sellerId', select: 'name marketplace sellerId' }
            ]);
        }

        res.json({ success: true, data: conversation });
    } catch (error) {
        console.error('Error in getOrCreateConversation:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get messages for a specific conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit = 50, skip = 0 } = req.query;

        const messages = await Message.find({ conversationId })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .populate('sender', 'firstName lastName avatar')
            .populate('replyTo');

        // Reverse to get chronological order for UI
        res.json({ success: true, data: messages.reverse() });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Send a message (HTTP POST fallback or for file uploads)
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, type, content, fileUrl, replyTo } = req.body;

        const message = await Message.create({
            conversationId,
            sender: req.user._id,
            type: type || 'TEXT',
            content,
            fileUrl,
            replyTo
        });

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'firstName lastName avatar')
            .populate('replyTo');

        // Update last message in conversation
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            updatedAt: Date.now()
        });

        // Emit via Socket.io
        const io = req.app.get('io');
        if (io) {
            io.to(conversationId).emit('receive_message', populatedMessage);
        }

        res.status(201).json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Mark messages as read in a conversation
exports.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;

        await Message.updateMany(
            {
                conversationId,
                'status.readBy': { $ne: req.user._id },
                sender: { $ne: req.user._id }
            },
            { $addToSet: { 'status.readBy': req.user._id } }
        );

        // Emit read receipt via socket
        const io = req.app.get('io');
        if (io) {
            io.to(conversationId).emit('messages_read', {
                conversationId,
                userId: req.user._id,
                readAt: new Date()
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get users for chat
exports.getUsersForChat = async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id }, isActive: true })
            .select('firstName lastName email avatar role isOnline lastSeen sellerId')
            .populate('role', 'name')
            .populate('sellerId', 'name marketplace');

        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get sellers for chat
exports.getSellersForChat = async (req, res) => {
    try {
        const Seller = require('../models/Seller');
        const sellers = await Seller.find({ status: 'Active' })
            .select('name marketplace sellerId users');

        res.json({ success: true, data: sellers });
    } catch (error) {
        console.error('Error fetching sellers:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// Create a new group conversation
exports.createGroup = async (req, res) => {
    try {
        const { name, participants, sellerId } = req.body;

        if (!name || !participants || !Array.isArray(participants) || participants.length === 0) {
            return res.status(400).json({ success: false, message: 'Group name and participants are required' });
        }

        // Add creator to participants if not already included
        const allParticipants = [...new Set([...participants, req.user._id.toString()])];

        const conversation = await Conversation.create({
            type: 'GROUP',
            name,
            participants: allParticipants,
            admins: [req.user._id],
            memberRoles: [
                { user: req.user._id, role: 'ADMIN' },
                ...participants.map(id => ({ user: id, role: 'PARTICIPANT' }))
            ],
            sellerId: sellerId || undefined
        });

        const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'firstName lastName email avatar role isOnline lastSeen')
            .populate('sellerId', 'name marketplace sellerId');

        // Notify all participants via socket
        const io = req.app.get('io');
        if (io) {
            allParticipants.forEach(userId => {
                io.to(userId).emit('new_conversation', populatedConversation);
            });
        }

        res.status(201).json({ success: true, data: populatedConversation });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Add members to a group
exports.addGroupMembers = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { participants } = req.body;

        if (!participants || !Array.isArray(participants)) {
            return res.status(400).json({ success: false, message: 'Participants array required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.type !== 'GROUP') {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        // Only admins can add members
        if (!conversation.admins.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Only admins can add members' });
        }

        const updatedConversation = await Conversation.findByIdAndUpdate(
            conversationId,
            {
                $addToSet: {
                    participants: { $each: participants },
                    memberRoles: { $each: participants.map(id => ({ user: id, role: 'PARTICIPANT' })) }
                }
            },
            { new: true }
        ).populate('participants', 'firstName lastName email avatar role isOnline lastSeen');

        res.json({ success: true, data: updatedConversation });
    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Remove a member from a group or leave group
exports.removeGroupMember = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId } = req.body;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.type !== 'GROUP') {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        // Can remove self (leave) OR admin can remove others
        const isSelf = userId === req.user._id.toString();
        const isAdmin = conversation.admins.includes(req.user._id);

        if (!isSelf && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const updatedConversation = await Conversation.findByIdAndUpdate(
            conversationId,
            {
                $pull: {
                    participants: userId,
                    admins: userId,
                    memberRoles: { user: userId }
                }
            },
            { new: true }
        ).populate('participants', 'firstName lastName email avatar role isOnline lastSeen');

        // If no participants left, deactivate
        if (updatedConversation.participants.length === 0) {
            updatedConversation.isActive = false;
            await updatedConversation.save();
        }

        res.json({ success: true, data: updatedConversation });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Search messages
exports.searchMessages = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, message: 'Search query is required' });
        }

        const userConversations = await Conversation.find({
            participants: req.user._id,
            isActive: true
        }).select('_id');

        const conversationIds = userConversations.map(c => c._id);

        const messages = await Message.find({
            conversationId: { $in: conversationIds },
            content: { $regex: query, $options: 'i' },
            type: 'TEXT'
        })
            .populate('sender', 'firstName lastName avatar')
            .populate({
                path: 'conversationId',
                populate: { path: 'participants', select: 'firstName lastName' }
            })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Error searching messages:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Edit a message
exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only sender can edit message' });
        }

        if (message.type !== 'TEXT') {
            return res.status(400).json({ success: false, message: 'Only text messages can be edited' });
        }

        message.content = content;
        message.edited = true;
        await message.save();

        const populatedMessage = await Message.findById(messageId).populate('sender', 'firstName lastName avatar').populate('replyTo');

        // Emit update via socket
        const io = req.app.get('io');
        if (io) {
            io.to(message.conversationId.toString()).emit('message_updated', populatedMessage);
        }

        res.json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete a message (Soft delete)
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only sender can delete message' });
        }

        message.deleted = true;
        message.content = '🚫 This message was deleted';
        message.type = 'TEXT';
        message.fileUrl = undefined;
        await message.save();

        // Emit deletion via socket
        const io = req.app.get('io');
        if (io) {
            io.to(message.conversationId.toString()).emit('message_deleted', {
                messageId,
                conversationId: message.conversationId,
                content: message.content
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Forward a message
exports.forwardMessage = async (req, res) => {
    try {
        const { messageId, targetConversationId } = req.body;

        if (!messageId || !targetConversationId) {
            return res.status(400).json({ success: false, message: 'Message ID and Target Conversation ID are required' });
        }

        const originalMessage = await Message.findById(messageId);
        if (!originalMessage) return res.status(404).json({ success: false, message: 'Original message not found' });

        const newMessageData = {
            conversationId: targetConversationId,
            sender: req.user._id,
            type: originalMessage.type,
            content: originalMessage.content,
            fileUrl: originalMessage.fileUrl
        };

        const newMessage = await Message.create(newMessageData);
        const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'firstName lastName avatar');

        // Update last message in target conversation
        await Conversation.findByIdAndUpdate(targetConversationId, {
            lastMessage: newMessage._id,
            updatedAt: Date.now()
        });

        // Emit to target conversation
        const io = req.app.get('io');
        if (io) {
            io.to(targetConversationId.toString()).emit('receive_message', populatedMessage);
        }

        res.status(201).json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error forwarding message:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get message read receipts details
exports.getMessageReadReceipts = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId)
            .populate('status.readBy', 'firstName lastName avatar email lastSeen');

        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

        res.json({ success: true, data: message.status.readBy });
    } catch (error) {
        console.error('Error fetching read receipts details:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get link preview metadata
exports.getLinkPreview = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

        const response = await axios.get(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GMSBot/1.0)' }
        });

        const html = response.data;
        const metadata = {
            url,
            title: '',
            description: '',
            image: ''
        };

        // Simple regex-based parsing (cheerio would be better but not in package.json)
        const titleMatch = html.match(/<title>(.*?)<\/title>/i) || html.match(/<meta property="og:title" content="(.*?)"/i);
        if (titleMatch) metadata.title = titleMatch[1];

        const descMatch = html.match(/<meta name="description" content="(.*?)"/i) || html.match(/<meta property="og:description" content="(.*?)"/i);
        if (descMatch) metadata.description = descMatch[1];

        const imageMatch = html.match(/<meta property="og:image" content="(.*?)"/i);
        if (imageMatch) metadata.image = imageMatch[1];

        res.json({ success: true, data: metadata });
    } catch (error) {
        console.error('Error fetching link preview:', error.message);
        res.json({ success: false, message: 'Could not fetch preview' });
    }
};

// Update member role (Admin only)
exports.updateMemberRole = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId, role } = req.body;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const isAdmin = conversation.admins.includes(req.user._id);
        if (!isAdmin) return res.status(403).json({ success: false, message: 'Only admins can update roles' });

        const memberIndex = conversation.memberRoles.findIndex(mr => mr.user.toString() === userId);
        if (memberIndex === -1) {
            conversation.memberRoles.push({ user: userId, role });
        } else {
            conversation.memberRoles[memberIndex].role = role;
        }

        // Keep legacy admins array in sync
        if (role === 'ADMIN') {
            if (!conversation.admins.includes(userId)) conversation.admins.push(userId);
        } else {
            conversation.admins = conversation.admins.filter(id => id.toString() !== userId);
        }

        await conversation.save();
        res.json({ success: true, data: conversation.memberRoles });
    } catch (error) {
        console.error('Error updating member role:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get shared media for a conversation
exports.getSharedMedia = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { type } = req.query; // 'IMAGE', 'VIDEO', 'FILE', 'AUDIO'

        const query = { conversationId, deleted: false };
        if (type) {
            query.type = type;
        } else {
            query.type = { $in: ['IMAGE', 'VIDEO', 'FILE', 'AUDIO'] };
        }

        const media = await Message.find(query)
            .sort({ createdAt: -1 })
            .select('content type fileUrl createdAt sender')
            .populate('sender', 'firstName lastName avatar');

        res.json({ success: true, data: media });
    } catch (error) {
        console.error('Error fetching shared media:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Toggle pin status of a message
exports.togglePinMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

        // Only group admins or message sender can pin?
        // Let's say group admins can pin any message, or in DIRECT chats anyone can pin.
        message.pinned = !message.pinned;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.conversationId.toString()).emit('message_pinned_toggled', { messageId, pinned: message.pinned });
        }

        res.json({ success: true, data: { pinned: message.pinned } });
    } catch (error) {
        console.error('Error toggling pin:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create a new poll message
exports.createPoll = async (req, res) => {
    try {
        const { conversationId, question, options, expiresAt } = req.body;
        if (!conversationId || !question || !options || !Array.isArray(options)) {
            return res.status(400).json({ success: false, message: 'Invalid poll data' });
        }

        const pollData = {
            question,
            options: options.map(opt => ({ text: opt, votes: [] })),
            expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h
        };

        const message = await Message.create({
            conversationId,
            sender: req.user._id,
            type: 'POLL',
            pollData
        });

        const populatedMessage = await Message.findById(message._id).populate('sender', 'firstName lastName avatar');

        const io = req.app.get('io');
        if (io) {
            io.to(conversationId.toString()).emit('receive_message', populatedMessage);
        }

        res.status(201).json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Vote on a poll
exports.votePoll = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { optionIndex } = req.body;

        const message = await Message.findById(messageId);
        if (!message || message.type !== 'POLL') {
            return res.status(404).json({ success: false, message: 'Poll not found' });
        }

        // Remove user's previous votes from all options
        message.pollData.options.forEach(opt => {
            opt.votes = opt.votes.filter(v => v.toString() !== req.user._id.toString());
        });

        // Add user's vote to the selected option
        if (optionIndex >= 0 && optionIndex < message.pollData.options.length) {
            message.pollData.options[optionIndex].votes.push(req.user._id);
        }

        await message.save();

        const populatedMessage = await Message.findById(messageId).populate('sender', 'firstName lastName avatar');

        const io = req.app.get('io');
        if (io) {
            io.to(message.conversationId.toString()).emit('message_updated', populatedMessage);
        }

        res.json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error voting on poll:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
