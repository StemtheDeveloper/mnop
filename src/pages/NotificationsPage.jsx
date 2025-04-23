import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';
import './NotificationsPage.css';

const NotificationsPage = () => {
    const { currentUser } = useAuth();
    const {
        notifications,
        loading,
        refresh,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotifications();
    const toast = useToast();
    const [filter, setFilter] = useState('all');
    const [displayedNotifications, setDisplayedNotifications] = useState([]);

    // Fetch notifications when component mounts
    useEffect(() => {
        if (currentUser?.uid) {
            refresh();
        }
    }, [currentUser, refresh]);

    useEffect(() => {
        // Apply filters to notifications
        let filtered = [...notifications];

        if (filter === 'unread') {
            filtered = filtered.filter(n => !n.read);
        }

        setDisplayedNotifications(filtered);
    }, [notifications, filter]);

    const handleMarkAsRead = async (id) => {
        const success = await markAsRead(id);
        if (success) {
            toast.success('Notification marked as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        const success = await markAllAsRead();
        if (success) {
            toast.success('All notifications marked as read');
        }
    };

    const handleDeleteNotification = async (id) => {
        const success = await deleteNotification(id);
        if (success) {
            toast.success('Notification deleted');
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
            case 'pending_review':
                return '⏳';
            default:
                return '🔔';
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
                            Refresh
                        </button>
                        <button
                            className="mark-all-btn"
                            onClick={handleMarkAllAsRead}
                            disabled={loading || notifications.every(n => n.read)}
                        >
                            Mark all as read
                        </button>
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

                            return (
                                <div
                                    key={notification.id}
                                    className={`notification-card ${!notification.read ? 'unread' : ''}`}
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="notification-details">
                                        <h3>{notification.title}</h3>
                                        <p>{notification.message}</p>
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
        </div>
    );
};

export default NotificationsPage;
