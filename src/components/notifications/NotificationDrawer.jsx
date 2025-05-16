import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import '../../styles/components/NotificationDrawer.css'; // Will be created next

/**
 * NotificationDrawer component that shows a slide-in drawer with user notifications
 * Replaces both NotificationCenter and NotificationInbox components
 */
const NotificationDrawer = ({ isOpen, onClose }) => {
    console.log("NotificationDrawer rendering with isOpen:", isOpen); // Debug logging

    const { currentUser } = useAuth();
    const {
        notifications,
        loading: contextLoading,
        refresh,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        unreadCount
    } = useNotifications();

    const drawerRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);
    const [notificationsList, setNotificationsList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    // Handle smooth closing animation
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300); // Match animation duration in CSS
    };

    // Close delete confirmation dialog
    const closeDeleteConfirmation = useCallback(() => {
        setShowDeleteConfirmation(false);
    }, []);

    // Load notifications only when drawer is first opened
    useEffect(() => {
        if (isOpen && currentUser) {
            refresh().catch(error => {
                console.error("Error refreshing notifications:", error);
            });
        }
    }, [isOpen, currentUser, refresh]);

    // Update local notifications list when notifications change
    useEffect(() => {
        if (notifications) {
            setNotificationsList(notifications);
        }
    }, [notifications]);

    // Close the drawer when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target)) {
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
            case 'message': return '✉️';
            case 'quote_request': return '📝';
            case 'product_approved': return '✅';
            case 'product_rejected': return '❌';
            case 'investment':
            case 'investment_confirmation': return '💰';
            case 'trending': return '🔥';
            case 'role_change':
            case 'role_request_approved': return '👤';
            case 'transfer':
            case 'interest': return '💳';
            case 'order_received': return '📦';
            case 'pending_review': return '⏳';
            case 'revenue_share': return '💵';
            case 'expiring': return '⏰';
            case 'product_stock':
            case 'PRODUCT_BACK_IN_STOCK': return '🔄';
            case 'LOW_STOCK_ALERT': return '⚠️';
            case 'cart_reminder': return '🛒';
            case 'product_archived': return '🗄️';
            case 'achievement_earned': return '🏆';
            default: return '🔔';
        }
    };

    // Handle refresh button click safely
    const handleRefresh = () => {
        if (isLoading || contextLoading) return; // Prevent multiple refreshes

        setIsLoading(true);
        refresh()
            .catch(error => {
                console.error("Error refreshing notifications:", error);
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    // Handle notification deletion with local state update
    const handleDeleteNotification = (id, event) => {
        if (event) {
            event.stopPropagation(); // Prevent event bubbling
        }

        // Optimistically update UI first
        setNotificationsList(prev => prev.filter(n => n.id !== id));

        // Then perform the actual deletion
        deleteNotification(id).catch(error => {
            console.error("Error deleting notification:", error);
        });
    };

    // Show delete all confirmation dialog
    const promptDeleteAll = () => {
        if (notificationsList.length === 0) return;
        setShowDeleteConfirmation(true);
    };

    // Handle delete all notifications
    const handleDeleteAllNotifications = () => {
        // Close the confirmation dialog
        setShowDeleteConfirmation(false);

        // Optimistically update UI first
        setNotificationsList([]);

        // Then perform the actual deletion
        deleteAllNotifications().catch(error => {
            console.error("Error deleting all notifications:", error);
        });
    };

    // Handle mark as read with local state update
    const handleMarkAsRead = (id, event) => {
        if (event) {
            event.stopPropagation(); // Prevent event bubbling
        }

        // Optimistically update UI first
        setNotificationsList(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );

        // Then perform the actual update
        markAsRead(id).catch(error => {
            console.error("Error marking notification as read:", error);
        });
    };

    // Handle notification click - marks as read and follows link if present
    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            handleMarkAsRead(notification.id);
        }
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
        <div className="notification-drawer-overlay">
            <div className={`notification-drawer ${isClosing ? 'closing' : ''}`} ref={drawerRef}>
                <div className="notification-drawer-header">
                    <h3>Notifications</h3>
                    <button
                        className="close-btn"
                        onClick={handleClose}
                        aria-label="Close notifications"
                    >
                        X
                    </button>

                </div>
                <div className="notification-function-btns">
                    <button
                        className="refresh-btn"
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Refresh notifications"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                    {unreadCount > 0 && (
                        <button
                            className="mark-all-read-btn"
                            onClick={handleMarkAllAsRead}
                            title="Mark all as read"
                        >
                            Mark all as read
                        </button>
                    )}
                    {notificationsList.length > 0 && (
                        <button
                            className="delete-all-btn"
                            onClick={promptDeleteAll}
                            title="Delete all notifications"
                        >
                            Delete all
                        </button>
                    )}
                </div>

                <div className="notification-drawer-content">
                    {loading ? (
                        <div className="notification-loading">Loading notifications...</div>
                    ) : notificationsList.length === 0 ? (
                        <div className="notification-empty">No notifications</div>
                    ) : (
                        <div className="notification-list">
                            {notificationsList.map(notification => {
                                // Use the achievement icon if it's an achievement notification and has a custom icon
                                const notificationIcon = notification.type === 'achievement_earned' && notification.achievementIcon
                                    ? notification.achievementIcon
                                    : getNotificationIcon(notification.type);

                                return (
                                    <div
                                        key={notification.id}
                                        className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.type === 'achievement_earned' ? 'achievement-notification' : ''}`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className={`notification-icon ${notification.type === 'achievement_earned' ? `tier-${notification.achievementTier || 1}` : ''}`}>
                                            {notificationIcon}
                                        </div>
                                        <div className="notification-content">
                                            <div className="notification-title">{notification.title}</div>
                                            <div className="notification-message">{notification.message}</div>
                                            {notification.type === 'achievement_earned' && notification.achievementPoints > 0 && (
                                                <div className="achievement-points">+{notification.achievementPoints} points</div>
                                            )}
                                            <div className="notification-time">
                                                {formatNotificationTime(notification.createdAt)}
                                            </div>
                                            {notification.link && (
                                                <Link
                                                    to={notification.link}
                                                    className="notification-link"
                                                    onClick={handleClose}
                                                >
                                                    View details
                                                </Link>
                                            )}
                                        </div>
                                        <div className="notification-actions">
                                            {!notification.read && (
                                                <button
                                                    onClick={(e) => handleMarkAsRead(notification.id, e)}
                                                    className="read-btn"
                                                    aria-label="Mark as read"
                                                    title="Mark as read"
                                                >
                                                    ✓
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteNotification(notification.id, e)}
                                                className="delete-btn"
                                                aria-label="Delete notification"
                                                title="Delete notification"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="notification-drawer-footer">
                    <Link to="/notifications" onClick={handleClose}>
                        View all notifications
                    </Link>
                </div>
            </div>

            {/* Delete All Confirmation Dialog */}
            {showDeleteConfirmation && (
                <div className="confirmation-overlay" onClick={closeDeleteConfirmation}>
                    <div className="confirmation-dialog" onClick={e => e.stopPropagation()}>
                        <h3>Delete All Notifications</h3>
                        <p>Are you sure you want to delete all notifications? This action cannot be undone.</p>
                        <div className="confirmation-actions">
                            <button className="cancel-btn" onClick={closeDeleteConfirmation}>
                                Cancel
                            </button>
                            <button className="confirm-btn" onClick={handleDeleteAllNotifications}>
                                Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDrawer;