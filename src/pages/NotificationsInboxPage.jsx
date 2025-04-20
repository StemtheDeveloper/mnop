import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../components/notifications/NotificationSystem';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/NotificationsInboxPage.css';
import LoadingSpinner from '../components/LoadingSpinner';

const NotificationsInboxPage = () => {
    const { notifications, loading, error, markAsRead, markAllAsRead } = useNotifications();
    const [activeFilter, setActiveFilter] = useState('all');
    const [deletingIds, setDeletingIds] = useState([]);
    const navigate = useNavigate();

    const handleMarkAllAsRead = () => {
        markAllAsRead();
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            setDeletingIds(prev => [...prev, notificationId]);
            const notificationRef = doc(db, 'notifications', notificationId);
            await deleteDoc(notificationRef);
            setDeletingIds(prev => prev.filter(id => id !== notificationId));
        } catch (err) {
            console.error('Error deleting notification:', err);
            setDeletingIds(prev => prev.filter(id => id !== notificationId));
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        if (notification.link) {
            navigate(notification.link);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'product_approved': return '✅';
            case 'investment': return '💰';
            case 'message': return '✉️';
            case 'trending': return '📈';
            case 'expiring': return '⏰';
            case 'role_change': return '🔄';
            case 'transfer': return '💸';
            default: return 'ℹ️';
        }
    };

    // Filter notifications based on active filter
    const filteredNotifications = notifications.filter(notification => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'unread') return !notification.read;
        return notification.type === activeFilter;
    });

    return (
        <div className="notifications-page">
            <div className="notifications-container">
                <h1>Notifications</h1>

                {loading ? (
                    <div className="loading">
                        <LoadingSpinner />
                        <p className="loading-text">Loading notifications...</p>
                    </div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <>
                        <div className="notification-actions">
                            {notifications.some(n => !n.read) && (
                                <button
                                    className="mark-all-read-btn"
                                    onClick={handleMarkAllAsRead}
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="notification-filters">
                            <button
                                className={`notification-filter ${activeFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('all')}
                            >
                                All
                            </button>
                            <button
                                className={`notification-filter ${activeFilter === 'unread' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('unread')}
                            >
                                Unread
                            </button>
                            <button
                                className={`notification-filter ${activeFilter === 'product_approved' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('product_approved')}
                            >
                                Product Approvals
                            </button>
                            <button
                                className={`notification-filter ${activeFilter === 'investment' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('investment')}
                            >
                                Investments
                            </button>
                            <button
                                className={`notification-filter ${activeFilter === 'message' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('message')}
                            >
                                Messages
                            </button>
                            <button
                                className={`notification-filter ${activeFilter === 'trending' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('trending')}
                            >
                                Trending
                            </button>
                        </div>

                        {filteredNotifications.length === 0 ? (
                            <div className="empty-notifications">
                                <div className="empty-icon">📭</div>
                                <p>No notifications to display</p>
                            </div>
                        ) : (
                            <div className="notification-list">
                                {filteredNotifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                                    >
                                        <div className="notification-icon">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="notification-content" onClick={() => handleNotificationClick(notification)}>
                                            <div className="notification-header">
                                                <h3>{notification.title}</h3>
                                                <span className="notification-time">{formatDate(notification.timestamp)}</span>
                                            </div>
                                            <p className="notification-message">{notification.message}</p>

                                            {notification.link && (
                                                <div className="notification-link-wrapper">
                                                    <span className="view-details-link">View Details</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="notification-actions-buttons">
                                            {!notification.read && (
                                                <button
                                                    className="mark-read-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    title="Mark as Read"
                                                >
                                                    ✓
                                                </button>
                                            )}
                                            <button
                                                className="delete-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteNotification(notification.id);
                                                }}
                                                disabled={deletingIds.includes(notification.id)}
                                                title="Delete"
                                            >
                                                {deletingIds.includes(notification.id) ? '...' : '×'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default NotificationsInboxPage;
