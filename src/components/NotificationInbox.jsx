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
        loading: contextLoading,
        refresh,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        unreadCount,
        lastRefresh
    } = useNotifications();
    const inboxRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);
    const [notificationsList, setNotificationsList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const refreshAttemptedRef = useRef(false);

    // Handle smooth closing animation
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300); // Match animation duration in CSS
    };

    // Load notifications only when inbox is first opened
    useEffect(() => {
        if (isOpen && currentUser && !refreshAttemptedRef.current) {
            // Set the flag to prevent multiple refresh attempts
            refreshAttemptedRef.current = true;

            // Don't set isLoading here, rely on the context's loading state
            refresh().catch(error => {
                console.error("Error refreshing notifications:", error);
            });
        }

        // Reset the flag when the inbox is closed
        if (!isOpen) {
            refreshAttemptedRef.current = false;
        }
    }, [isOpen, currentUser]);

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
    }, [isOpen]);

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
            case 'order_received':
                return '📦';
            case 'pending_review':
                return '⏳';
            default:
                return '🔔';
        }
    };

    // Handle refresh button click safely
    const handleRefresh = () => {
        if (isLoading || contextLoading) return; // Prevent multiple refreshes

        setIsLoading(true);
        refresh().catch(error => {
            console.error("Error refreshing notifications:", error);
        }).finally(() => {
            setIsLoading(false);
        });
    };

    // Handle notification deletion with local state update to prevent flickering
    const handleDeleteNotification = (id) => {
        // Optimistically update UI first
        setNotificationsList(prev => prev.filter(n => n.id !== id));

        // Then perform the actual deletion
        deleteNotification(id).catch(error => {
            console.error("Error deleting notification:", error);
            // Revert the optimistic update if needed
        });
    };

    // Handle mark as read with local state update
    const handleMarkAsRead = (id) => {
        // Optimistically update UI first
        setNotificationsList(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );

        // Then perform the actual update
        markAsRead(id).catch(error => {
            console.error("Error marking notification as read:", error);
        });
    };

    // Handle mark all as read with local state update
    const handleMarkAllAsRead = () => {
        if (unreadCount === 0) return;

        // Optimistically update UI first
        setNotificationsList(prev =>
            prev.map(n => ({ ...n, read: true }))
        );

        // Then perform the actual update
        markAllAsRead().catch(error => {
            console.error("Error marking all notifications as read:", error);
        });
    };

    if (!isOpen || !currentUser) return null;

    // Use the loading state from the context OR the local state
    const loading = contextLoading || isLoading;

    return (
        <div className="notification-inbox-overlay">
            <div className={`notification-inbox ${isClosing ? 'closing' : ''}`} ref={inboxRef}>
                <div className="notification-inbox-header">
                    <h3>Recent Notifications</h3>
                    <div className="notification-inbox-actions">
                        <button
                            className="refresh-btn"
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Refresh'}
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
                    {loading ? (
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