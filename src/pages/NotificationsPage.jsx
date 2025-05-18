import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../components/notifications';
import { useToast } from '../context/ToastContext';
import '../styles/NotificationsPage.css';

const NotificationsPage = () => {
    const { currentUser } = useAuth();
    const {
        notifications,
        loading,
        refresh,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        isInitialized
    } = useNotifications();
    const { showSuccess, showError } = useToast();
    const [filter, setFilter] = useState('all');
    const [displayedNotifications, setDisplayedNotifications] = useState([]);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [autoRefreshAttempted, setAutoRefreshAttempted] = useState(false);

    // Auto refresh when the page first loads if needed
    useEffect(() => {
        const autoRefresh = async () => {
            if (currentUser && !autoRefreshAttempted) {
                setAutoRefreshAttempted(true);

                try {
                    await refresh();
                } catch (error) {
                    console.error('Error auto-refreshing notifications:', error);
                }
            }
        };

        autoRefresh();
    }, [currentUser, refresh, autoRefreshAttempted]);

    // Apply filters to notifications when they change
    useEffect(() => {
        let filtered = [...notifications];

        if (filter === 'unread') {
            filtered = filtered.filter(n => !n.read);
        }

        setDisplayedNotifications(filtered);
    }, [notifications, filter]);

    const handleMarkAsRead = async (id) => {
        try {
            const success = await markAsRead(id);
            if (success) {
                showSuccess('Notification marked as read');
            }
        } catch (error) {
            showError('Failed to mark notification as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const success = await markAllAsRead();
            if (success) {
                showSuccess('All notifications marked as read');
            }
        } catch (error) {
            showError('Failed to mark all notifications as read');
        }
    };

    const handleDeleteNotification = async (id) => {
        try {
            const success = await deleteNotification(id);
            if (success) {
                showSuccess('Notification deleted');
            }
        } catch (error) {
            showError('Failed to delete notification');
        }
    };

    // Show delete all confirmation dialog
    const promptDeleteAll = () => {
        if (notifications.length === 0) return;
        setShowDeleteConfirmation(true);
    };

    // Handle delete all notifications
    const handleDeleteAllNotifications = async () => {
        // Close the confirmation dialog
        setShowDeleteConfirmation(false);

        try {
            const success = await deleteAllNotifications();
            if (success) {
                showSuccess('All notifications deleted');
            }
        } catch (error) {
            showError('Failed to delete all notifications');
        }
    };

    // Close delete confirmation dialog
    const closeDeleteConfirmation = () => {
        setShowDeleteConfirmation(false);
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

    const formatNotificationTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp?.toDate?.() || new Date(timestamp);
        return {
            relative: formatDistanceToNow(date, { addSuffix: true }),
            exact: format(date, 'PPpp')
        };
    };

    if (!currentUser) {
        return (
            <div className="notifications-page">
                <div className="notifications-container">
                    <h1>Notifications</h1>
                    <p>Please sign in to view your notifications.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="notifications-page">
            <div className="notifications-container">
                <div className="notifications-header">
                    <h1>Your Notifications</h1>
                    <div className="notifications-actions">
                        <button
                            className="refresh-btn"
                            onClick={refresh}
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                        <button
                            className="mark-all-btn"
                            onClick={handleMarkAllAsRead}
                            disabled={loading || notifications.every(n => n.read)}
                        >
                            Mark all as read
                        </button>
                        {notifications.length > 0 && (
                            <button
                                className="delete-all-btn"
                                onClick={promptDeleteAll}
                                disabled={loading}
                            >
                                Delete all
                            </button>
                        )}
                    </div>
                </div>

                <div className="notifications-filters">
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button
                        className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
                        onClick={() => setFilter('unread')}
                    >
                        Unread
                    </button>
                </div>

                {loading ? (
                    <div className="loading-message">Loading notifications...</div>
                ) : displayedNotifications.length === 0 ? (
                    <div className="empty-notifications">
                        <p>No notifications to display</p>
                        {filter !== 'all' && (
                            <button onClick={() => setFilter('all')}>Show all notifications</button>
                        )}
                    </div>
                ) : (
                    <div className="notifications-list">
                        {displayedNotifications.map(notification => {
                            const time = formatNotificationTime(notification.createdAt);

                            // Use the achievement icon if it's an achievement notification and has a custom icon
                            const notificationIcon = notification.type === 'achievement_earned' && notification.achievementIcon
                                ? notification.achievementIcon
                                : getNotificationIcon(notification.type);

                            return (
                                <div
                                    key={notification.id}
                                    className={`notification-card ${!notification.read ? 'unread' : ''} ${notification.type === 'achievement_earned' ? 'achievement-notification' : ''}`}
                                >
                                    <div className={`notification-icon ${notification.type === 'achievement_earned' ? `tier-${notification.achievementTier || 1}` : ''}`}>
                                        {notificationIcon}
                                    </div>
                                    <div className="notification-details">
                                        <h3>{notification.title}</h3>
                                        <p>{notification.message}</p>
                                        {notification.type === 'achievement_earned' && notification.achievementPoints > 0 && (
                                            <p className="achievement-points">+{notification.achievementPoints} points</p>
                                        )}
                                        <div className="notification-meta">
                                            <span className="notification-time" title={time.exact}>
                                                {time.relative}
                                            </span>
                                            {notification.link && (
                                                <Link to={notification.link} className="notification-link">
                                                    View details
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                    <div className="notification-actions-container">
                                        {!notification.read && (
                                            <button
                                                className="action-btn read-btn"
                                                onClick={() => handleMarkAsRead(notification.id)}
                                                title="Mark as read"
                                            >
                                                ✓
                                            </button>
                                        )}
                                        <button
                                            className="action-btn delete-btn"
                                            onClick={() => handleDeleteNotification(notification.id)}
                                            title="Delete notification"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Delete All Confirmation Dialog */}
            {showDeleteConfirmation && (
                <div className="delete-confirmation-overlay">
                    <div className="delete-confirmation-dialog">
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

export default NotificationsPage;