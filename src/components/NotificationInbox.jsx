import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import './NotificationInbox.css';

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

    // Load notifications and refresh when the inbox is opened
    useEffect(() => {
        console.log('NotificationInbox opened:', isOpen, 'user:', currentUser?.uid);
        
        if (isOpen && currentUser) {
            setIsLoading(true);
            
            try {
                console.log('Refreshing notifications in inbox');
                const result = refresh();

                if (result && typeof result.then === 'function') {
                    // If refresh returns a Promise
                    result.then((success) => {
                        console.log('Notification refresh completed:', success);
                        setIsLoading(false);
                    }).catch((error) => {
                        console.error('Error in notification refresh promise:', error);
                        setIsLoading(false);
                    });
                } else {
                    // If refresh doesn't return a Promise
                    console.log('Notification refresh called (not a promise)');
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error refreshing notifications:", error);
                setIsLoading(false);
            }
        }
    }, [isOpen, currentUser, refresh]);

    // Update local notifications list when notifications change from context
    useEffect(() => {
        console.log('Notifications updated in context, count:', notifications?.length);
        if (notifications && Array.isArray(notifications)) {
            setNotificationsList(notifications);
            // If we were loading and got notifications, stop loading
            if (isLoading && notifications.length > 0) {
                setIsLoading(false);
            }
        }
    }, [notifications, isLoading]);

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

        try {
            const date = timestamp?.toDate?.() || new Date(timestamp);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch (error) {
            console.error('Error formatting notification time:', error);
            return '';
        }
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

    // Handle refresh button click
    const handleRefresh = () => {
        console.log('Manual refresh requested');
        setIsLoading(true);
        
        try {
            const result = refresh();

            if (result && typeof result.then === 'function') {
                result.then(() => {
                    console.log('Manual refresh completed');
                    setIsLoading(false);
                }).catch((error) => {
                    console.error('Error in manual refresh:', error);
                    setIsLoading(false);
                });
            } else {
                // Set a timeout to give time for the refresh to complete
                console.log('Manual refresh called (not a promise)');
                setTimeout(() => {
                    setIsLoading(false);
                }, 1000);
            }
        } catch (error) {
            console.error("Error in manual refresh:", error);
            setIsLoading(false);
        }
    };

    // Handle notification deletion
    const handleDeleteNotification = async (id) => {
        console.log('Deleting notification:', id);
        // Optimistically update UI first
        setNotificationsList(prev => prev.filter(n => n.id !== id));

        // Then perform the actual deletion
        try {
            const result = await deleteNotification(id);
            console.log('Notification deletion result:', result);
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    // Handle mark as read
    const handleMarkAsRead = async (id) => {
        console.log('Marking notification as read:', id);
        // Optimistically update UI first
        setNotificationsList(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );

        // Then perform the actual update
        try {
            const result = await markAsRead(id);
            console.log('Mark as read result:', result);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Handle mark all as read
    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;
        
        console.log('Marking all notifications as read');
        // Optimistically update UI first
        setNotificationsList(prev =>
            prev.map(n => ({ ...n, read: true }))
        );

        // Then perform the actual update
        try {
            const result = await markAllAsRead();
            console.log('Mark all as read result:', result);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    // Don't render anything if inbox is closed or no user
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
                            {isLoading ? 'Loading...' : 'Refresh'}
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
                    {isLoading || loading ? (
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkAsRead(notification.id);
                                                }}
                                                className="read-btn"
                                                aria-label="Mark as read"
                                            >
                                                ✓
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteNotification(notification.id);
                                            }}
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