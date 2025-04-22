import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import './NotificationInbox.css'; // Use our new CSS file

const NotificationInbox = ({ isOpen, onClose }) => {
    const { currentUser } = useAuth();
    const {
        notifications,
        loading,
        refresh,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        unreadCount
    } = useNotifications();
    const inboxRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);
    const [notificationsList, setNotificationsList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Handle smooth closing animation
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300); // Match animation duration in CSS
    };

    // Load notifications and manage local state to prevent flickering
    useEffect(() => {
        if (isOpen && currentUser) {
            setIsLoading(true);
            try {
                // Call refresh and handle both Promise and non-Promise return values
                const result = refresh();

                if (result && typeof result.then === 'function') {
                    // If refresh returns a Promise
                    result.then(() => {
                        setIsLoading(false);
                    }).catch(() => {
                        setIsLoading(false);
                    });
                } else {
                    // If refresh doesn't return a Promise
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error refreshing notifications:", error);
                setIsLoading(false);
            }
        }
    }, [isOpen, currentUser, refresh]);

    // Update local notifications list when notifications change
    useEffect(() => {
        if (notifications) {
            setNotificationsList(notifications);
        }
    }, [notifications]);

    // Close the inbox when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inboxRef.current && !inboxRef.current.contains(event.target)) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

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
            case 'product_rejected':
                return '❌';
            case 'investment':
            case 'investment_confirmation':
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

    // Handle refresh button click safely
    const handleRefresh = () => {
        setIsLoading(true);
        try {
            const result = refresh();

            if (result && typeof result.then === 'function') {
                result.then(() => {
                    setIsLoading(false);
                }).catch(() => {
                    setIsLoading(false);
                });
            } else {
                // If refresh doesn't return a Promise, use the loading state from context
                // Or set a timeout to give time for the refresh to complete
                setTimeout(() => {
                    setIsLoading(false);
                }, 500);
            }
        } catch (error) {
            console.error("Error refreshing notifications:", error);
            setIsLoading(false);
        }
    };

    // Handle notification deletion with local state update to prevent flickering
    const handleDeleteNotification = async (id) => {
        // Optimistically update UI first
        setNotificationsList(prev => prev.filter(n => n.id !== id));

        // Then perform the actual deletion
        await deleteNotification(id);
    };

    // Handle mark as read with local state update
    const handleMarkAsRead = async (id) => {
        // Optimistically update UI first
        setNotificationsList(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );

        // Then perform the actual update
        await markAsRead(id);
    };

    // Handle mark all as read with local state update
    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;

        // Optimistically update UI first
        setNotificationsList(prev =>
            prev.map(n => ({ ...n, read: true }))
        );

        // Then perform the actual update
        await markAllAsRead();
    };

    if (!isOpen || !currentUser) return null;

    return (
        <div className="notification-inbox-overlay">
            <div className={`notification-inbox ${isClosing ? 'closing' : ''}`} ref={inboxRef}>
                <div className="notification-inbox-header">
                    <h3>Recent Notifications</h3>
                    <div className="notification-inbox-actions">
                        <button
                            className="refresh-btn"
                            onClick={handleRefresh}
                            disabled={isLoading}
                        >
                            Refresh
                        </button>
                        {unreadCount > 0 && (
                            <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                                Mark all as read
                            </button>
                        )}
                        <button className="close-btn" onClick={handleClose}>
                            Close
                        </button>
                    </div>
                </div>

                <div className="notification-inbox-content">
                    {isLoading ? (
                        <div className="notification-loading">Loading notifications...</div>
                    ) : notificationsList.length === 0 ? (
                        <div className="notification-empty">No notifications</div>
                    ) : (
                        <div className="notification-list-scrollable">
                            {notificationsList.map(notification => (
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
                                        {notification.link && (
                                            <Link to={notification.link} className="notification-link" onClick={handleClose}>
                                                View details
                                            </Link>
                                        )}
                                    </div>
                                    <div className="notification-actions">
                                        {!notification.read && (
                                            <button
                                                onClick={() => handleMarkAsRead(notification.id)}
                                                className="read-btn"
                                                aria-label="Mark as read"
                                            >
                                                ✓
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteNotification(notification.id)}
                                            className="delete-btn"
                                            aria-label="Delete notification"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="notification-inbox-footer">
                    <Link to="/notifications" onClick={handleClose}>
                        View all notifications
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotificationInbox;