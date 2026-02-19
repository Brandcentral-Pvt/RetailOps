import React, { useState } from 'react';
import { Search, User, MessageSquare, MoreVertical, RotateCcw, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Chat.css';

const ChatSidebar = ({ onSelectUser, selectedUserId, users, loading, onlineUsers }) => {
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = Array.isArray(users) ? users.filter(user => {
        if (!user) return false;
        // Exclude current user
        const currentUserId = currentUser?._id || currentUser?.id;
        const userId = user._id || user.id;
        if (currentUserId === userId) return false;

        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        const email = user.email || '';
        const name = `${firstName} ${lastName}`.toLowerCase();
        const search = (searchTerm || '').toLowerCase();
        return name.includes(search) || email.toLowerCase().includes(search);
    }) : [];

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="chat-sidebar">
            {/* WhatsApp Sidebar Header */}
            <div className="chat-sidebar-header">
                <div className="chat-avatar" style={{ width: '40px', height: '40px', margin: 0, backgroundColor: '#dfe5e7', color: '#8696a0' }}>
                    {currentUser?.avatar ? (
                        <img src={currentUser.avatar} alt="Profile" className="w-100 h-100 rounded-circle object-fit-cover" />
                    ) : (
                        <User size={20} />
                    )}
                </div>
                <div className="d-flex gap-3 text-muted">
                    <RotateCcw size={20} className="cursor-pointer" title="Status" />
                    <MessageSquarePlus size={20} className="cursor-pointer" title="New Chat" />
                    <MoreVertical size={20} className="cursor-pointer" title="Menu" />
                </div>
            </div>

            {/* Search Wrapper */}
            <div className="chat-sidebar-search-wrapper">
                <div className="chat-search-container">
                    <Search size={16} className="text-muted" />
                    <input
                        type="text"
                        className="chat-search-input"
                        placeholder="Search or start new chat"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* User List */}
            <div className="chat-user-list">
                {loading ? (
                    <div className="p-4 text-center">
                        <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-5 text-center text-muted small">
                        {searchTerm ? 'No contacts found' : 'Start a new conversation'}
                    </div>
                ) : (
                    filteredUsers.map(user => {
                        const userId = user._id || user.id;
                        const isActive = String(selectedUserId) === String(userId);
                        const displayName = user.firstName ? `${user.firstName} ${user.lastName}` : (user.name || user.email);
                        const isOnline = onlineUsers.includes(userId);

                        return (
                            <button
                                key={userId}
                                className={`chat-user-item ${isActive ? 'active' : ''}`}
                                onClick={() => onSelectUser(user)}
                                style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', display: 'flex', alignItems: 'center' }}
                            >
                                <div className="chat-user-avatar">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={displayName} className="w-100 h-100 object-fit-cover" />
                                    ) : (
                                        <div className="w-100 h-100 d-flex align-items-center justify-content-center text-white bg-secondary bg-gradient">
                                            {user.firstName?.charAt(0) || user.email?.charAt(0)}
                                        </div>
                                    )}
                                    {isOnline && <div className="online-status-dot"></div>}
                                </div>
                                <div className="chat-user-info">
                                    <div className="chat-user-name-row">
                                        <span className="chat-user-name">{displayName}</span>
                                        {user.lastMessage && (
                                            <span className={`chat-user-time ${user.unreadCount > 0 ? 'text-success fw-medium' : ''}`}>
                                                {formatTime(user.lastMessage.createdAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="chat-user-msg-row">
                                        <span className="chat-user-last-msg">
                                            {user.lastMessage ? user.lastMessage.content : (user.role?.name || 'Contact')}
                                        </span>
                                        {user.unreadCount > 0 && (
                                            <div className="chat-unread-badge">
                                                {user.unreadCount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChatSidebar;
