import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import { formatDistanceToNow } from 'date-fns';
import './NotificationCenter.css';

const NotificationCenter = () => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    // Fetch notifications when user logs in
    useEffect(() => {
        if (currentUser?.uid) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [currentUser]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchNotifications = async () => {
        if (!currentUser?.uid) return;

        setLoading(true);
        const result = await notificationService.getUserNotifications(currentUser.uid);
        setLoading(false);

        if (result.success) {
            // Sort notifications by date (newest first)
            const sortedNotifications = result.data.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return dateB - dateA;
            });

            setNotifications(sortedNotifications);
            setUnreadCount(sortedNotifications.filter(n => !n.read).length);
        }
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const markAsRead = async (notificationId) => {
        const result = await notificationService.markAsRead(notificationId);
        if (result.success) {
            setNotifications(notifications.map(n =>
                n.id === notificationId ? { ...n, read: true } : n
            ));
            setUnreadCount(Math.max(0, unreadCount - 1));
        }
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0) return;

        const result = await notificationService.markAllAsRead(currentUser.uid);
        if (result.success) {
            setNotifications(notifications.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        }
    };

    const deleteNotification = async (notificationId) => {
        const result = await notificationService.deleteNotification(notificationId);
        if (result.success) {
            const updatedNotifications = notifications.filter(n => n.id !== notificationId);
            setNotifications(updatedNotifications);
            setUnreadCount(updatedNotifications.filter(n => !n.read).length);
        }
    };

    const formatNotificationTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp?.toDate?.() || new Date(timestamp);
        return formatDistanceToNow(date, { addSuffix: true });
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'message':
                return '✉️';
            case 'quote_request':
                return '📝';
            case 'product_approved':
                return '✅';
            case 'investment':
                return '💰';
            case 'trending':
                return '🔥';
            case 'role_change':
            case 'role_request_approved':
                return '👤';
            case 'transfer':
            case 'interest':
                return '💳';
            case 'pending_review':
                return '⏳';
            default:
                return '🔔';
        }
    };

    if (!currentUser) return null;

    return (
        <div className="notification-center" ref={dropdownRef}>
            <button
                className="notification-button"
                onClick={toggleDropdown}
                aria-label="Notifications"
            >
                <span className="notification-icon">🔔</span>
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                className="mark-all-read-btn"
                                onClick={markAllAsRead}
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="notification-list">
                        {loading ? (
                            <div className="notification-loading">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty">No notifications</div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="notification-content">
                                        <div className="notification-title">{notification.title}</div>
                                        <div className="notification-message">{notification.message}</div>
                                        <div className="notification-time">
                                            {formatNotificationTime(notification.createdAt)}
                                        </div>
                                    </div>
                                    <div className="notification-actions">
                                        {!notification.read && (
                                            <button
                                                onClick={() => markAsRead(notification.id)}
                                                className="read-btn"
                                                aria-label="Mark as read"
                                            >
                                                ✓
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteNotification(notification.id)}
                                            className="delete-btn"
                                            aria-label="Delete notification"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="notification-footer">
                        <Link to="/notifications" onClick={() => setIsOpen(false)}>
                            View all notifications
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
