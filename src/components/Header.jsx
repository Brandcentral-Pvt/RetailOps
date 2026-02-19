import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell,
    Search,
    Menu,
    User,
    LogOut,
    Settings,
    ChevronDown,
    BarChart2,
    Wrench,
    Database,
    Shield,
    MessageSquare,
    TrendingUp,
    Layout,
    Info,
    Check
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { DropdownButton } from './DropdownButton';
import { Dropdown } from './base/dropdown/dropdown';
import './Header.css';

const Header = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const notificationRef = useRef(null);
    const userMenuRef = useRef(null);
    const socket = useSocket();

    const fetchNotifications = async () => {
        try {
            const response = await api.notificationApi.getNotifications({ limit: 5 });
            if (response && response.success) {
                setNotifications(response.data);
                setUnreadCount(response.unreadCount);
            }
        } catch (error) {
            if (error.message && !error.message.includes('404')) {
                console.warn('Failed to fetch notifications:', error);
            }
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;
        socket.on('new-notification', ({ notification, unreadCount }) => {
            setNotifications(prev => [notification, ...prev].slice(0, 10));
            setUnreadCount(unreadCount);
        });
        return () => {
            socket.off('new-notification');
        };
    }, [socket]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'ALERT': return <Bell size={14} />;
            case 'ACTION_ASSIGNED': return <Check size={14} />;
            case 'CHAT_MENTION':
            case 'CHAT_MESSAGE': return <MessageSquare size={14} />;
            default: return <Info size={14} />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'ALERT': return '#ff3b30'; // iOS red
            case 'ACTION_ASSIGNED': return '#34c759'; // iOS green
            case 'CHAT_MENTION':
            case 'CHAT_MESSAGE': return '#5856d6'; // iOS purple
            default: return '#007aff'; // iOS blue
        }
    };

    const handleMarkAsRead = async (id, e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        try {
            const response = await api.notificationApi.markAsRead(id);
            if (response && response.success) {
                setNotifications(prev => prev.map(n =>
                    n._id === id ? { ...n, isRead: true } : n
                ));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to mark as read', error);
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.isRead) {
            handleMarkAsRead(notification._id);
        }
        setShowNotifications(false);

        // Navigate based on type
        if (notification.type === 'ALERT' || notification.type === 'SYSTEM') {
            navigate('/alerts');
        } else if (notification.type === 'ACTION_ASSIGNED' || notification.type === 'CHAT_MENTION') {
            if (notification.referenceId) {
                navigate(`/actions?id=${notification.referenceId}`);
            } else {
                navigate('/actions');
            }
        } else if (notification.type === 'CHAT_MESSAGE') {
            if (notification.referenceId) {
                navigate(`/chat?userId=${notification.referenceId}`);
            } else {
                navigate('/chat');
            }
        }
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: 'bi-grid-3x3-gap' },
        { path: '/sellers', label: 'Sellers', icon: 'bi-shop' },
        { path: '/asin-tracker', label: 'ASIN Manager', icon: 'bi-upc-scan' },
        { path: '/actions', label: 'Actions', icon: 'bi-diagram-3' },
    ];

    const analysisItems = [
        { path: '/actions/achievement-report', label: 'Performance', icon: 'bi-bar-chart-line' },
        { path: '/ads-report', label: 'Ads Report', icon: 'bi-megaphone' },
        { path: '/sku-report', label: 'SKU Report', icon: 'bi-box-seam' },
        { path: '/parent-asin-report', label: 'Parent ASIN', icon: 'bi-collection' },
        { path: '/month-wise-report', label: 'Monthly Report', icon: 'bi-calendar3' },
        { path: '/profit-loss', label: 'Profit & Loss', icon: 'bi-currency-dollar' },
        { path: '/activity-log', label: 'Activity Log', icon: 'bi-journal-text' },
    ];

    const toolItems = [
        { path: '/scrape-tasks', label: 'Scrape Tasks', icon: 'bi-cloud-download' },
        { path: '/revenue-calculator', label: 'Revenue Calc', icon: 'bi-calculator' },
        { path: '/inventory', label: 'Inventory', icon: 'bi-box-seam' },
        { path: '/alerts', label: 'Alerts', icon: 'bi-bell' },
        { path: '/upload-export', label: 'Upload/Export', icon: 'bi-arrow-left-right' },
        { path: '/actions/templates', label: 'Task Templates', icon: 'bi-clipboard-check' },
        { path: '/chat', label: 'Direct Chat', icon: 'bi-chat-dots' },
    ];

    return (
        <header className="main-header">
            <div className="header-container">
                {/* Logo Section */}
                <div className="header-logo" onClick={() => navigate('/')}>
                    <div className="logo-icon">
                        <TrendingUp size={22} color="white" strokeWidth={2.5} />
                    </div>
                    <span className="logo-text">Retail<span style={{ color: '#2563eb' }}>Ops</span></span>
                </div>

                {/* Navigation Section */}
                <nav className="header-nav">
                    <ul className="nav-list">
                        {navItems.map(item => (
                            <li key={item.path} className="nav-item">
                                <NavLink to={item.path} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                    <i className={`bi ${item.icon} me-1`}></i>
                                    {item.label}
                                </NavLink>
                            </li>
                        ))}

                        {/* Analysis Dropdown */}
                        <li className="nav-item dropdown">
                            <button className="nav-link dropdown-toggle btn btn-link">
                                <BarChart2 size={16} className="me-1" />
                                Analytics
                                <ChevronDown size={12} className="ms-1" />
                            </button>
                            <div className="dropdown-menu-content shadow-sm">
                                {analysisItems.map(item => (
                                    <NavLink key={item.path} to={item.path} className="dropdown-item-link">
                                        <i className={`bi ${item.icon} me-2`}></i>
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        </li>

                        {/* Tools Dropdown */}
                        <li className="nav-item dropdown">
                            <button className="nav-link dropdown-toggle btn btn-link">
                                <Layout size={16} className="me-1" />
                                Tools
                                <ChevronDown size={12} className="ms-1" />
                            </button>
                            <div className="dropdown-menu-content shadow-sm">
                                {toolItems.map(item => (
                                    <NavLink key={item.path} to={item.path} className="dropdown-item-link">
                                        <i className={`bi ${item.icon} me-2`}></i>
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        </li>
                    </ul>
                </nav>

                {/* Right Side Section */}
                <div className="header-right">
                    {/* Search Bar */}
                    <div className="header-search">
                        <Search size={16} className="search-icon" />
                        <input type="text" placeholder="Search..." />
                    </div>

                    {/* Notifications */}
                    <Dropdown.Root>
                        <Dropdown.Trigger className="header-action-item">
                            <button className="action-btn">
                                <Bell size={20} />
                                {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                            </button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                            <div className="notification-container-glass" style={{ width: '360px', maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                                    <span className="fw-bold text-dark h6 mb-0">Notifications</span>
                                    {unreadCount > 0 && <span className="badge bg-primary rounded-pill small">{unreadCount} New</span>}
                                </div>
                                <div className="notification-list p-2" style={{ overflowY: 'auto' }}>
                                    {notifications.length > 0 ? (
                                        notifications.map(n => (
                                            <Dropdown.Item key={n._id} onClick={() => handleNotificationClick(n)}>
                                                <div className="d-flex gap-3 w-100 p-1 align-items-start">
                                                    <div className="ios-app-icon flex-shrink-0 mt-1" style={{ width: '32px', height: '32px', background: `${getTypeColor(n.type)}15`, color: getTypeColor(n.type) }}>
                                                        {getTypeIcon(n.type)}
                                                    </div>
                                                    <div className="flex-grow-1 min-width-0">
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="smallest text-uppercase fw-bold text-muted">{n.type?.replace('_', ' ') || 'SYSTEM'}</span>
                                                            <span className="smallest text-muted">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <p className="mb-0 small text-wrap text-dark" style={{ lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                            {n.message}
                                                        </p>
                                                    </div>
                                                    {!n.isRead && <div className="notification-unread-dot mt-2 ms-2"></div>}
                                                </div>
                                            </Dropdown.Item>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center">
                                            <div className="bg-light d-inline-block p-3 rounded-circle mb-2">
                                                <Bell size={24} className="text-muted opacity-50" />
                                            </div>
                                            <div className="text-muted small">No new notifications</div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-2 border-top bg-light bg-opacity-10 text-center">
                                    <button className="btn btn-link btn-sm text-decoration-none transition-all fw-semibold" onClick={() => navigate('/alerts')}>
                                        View All Activity
                                    </button>
                                </div>
                            </div>
                        </Dropdown.Popover>
                    </Dropdown.Root>

                    {/* User Profile */}
                    <DropdownButton />
                </div>
            </div>
        </header>
    );
};

export default Header;
