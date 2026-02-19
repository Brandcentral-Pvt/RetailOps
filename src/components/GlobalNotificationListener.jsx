import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const GlobalNotificationListener = () => {
    const socket = useSocket();
    const { addToast } = useToast();
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!socket || !currentUser) return;

        const handlePrivateMessage = (message) => {
            // Don't show toast if we're already on the chat page with this user
            const isChatPage = location.pathname === '/chat';
            const urlParams = new URLSearchParams(location.search);
            const activeChatUserId = urlParams.get('userId');

            const senderId = message.sender?._id || message.sender?.id || message.sender;
            const currentUserId = currentUser?._id || currentUser?.id;

            // Only show if I'm the recipient and not in the chat
            if (senderId !== currentUserId) {
                if (!isChatPage || activeChatUserId !== senderId) {
                    addToast({
                        title: `${message.sender?.firstName || 'New Message'}`,
                        message: message.content,
                        type: 'message',
                        onClick: () => navigate(`/chat?userId=${senderId}`)
                    });
                }
            }
        };

        const handleNewNotification = (data) => {
            const notification = data.notification || data;
            // Only show if it's not a basic chat message (handled above)
            if (notification.type !== 'CHAT_MESSAGE') {
                addToast({
                    title: 'New Notification',
                    message: notification.message,
                    type: 'info',
                    onClick: () => {
                        if (notification.referenceModel === 'Action') {
                            navigate(`/actions?id=${notification.referenceId}`);
                        } else {
                            navigate('/alerts');
                        }
                    }
                });
            }
        };

        socket.on('private-message', handlePrivateMessage);
        socket.on('new-notification', handleNewNotification);

        return () => {
            socket.off('private-message', handlePrivateMessage);
            socket.off('new-notification', handleNewNotification);
        };
    }, [socket, currentUser, addToast, navigate, location]);

    return null;
};

export default GlobalNotificationListener;
