import React, { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import notificationService from '../services/notificationService';
import '../styles/NotificationsInboxPage.css';

const NotificationsInboxPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const { currentUser } = useUser();
    const { showError, showSuccess } = useToast();

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!currentUser) return;

            try {
                const response = await notificationService.getUserNotifications(currentUser.uid);
                if (response.success) {
                    setNotifications(response.data);
                } else {
                    showError('Failed to load notifications');
                }
            } catch (err) {
                console.error('Error loading notifications:', err);
                showError('An error occurred while loading your notifications');
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, [currentUser, showError]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            const result = await notificationService.markAsRead(notificationId);
            if (result.success) {
                setNotifications(prevNotifications =>
                    prevNotifications.map(notification =>
                        notification.id === notificationId
                            ? { ...notification, read: true }
                            : notification
                    )
                );
            }
        } catch (err) {
            console.error('Error marking notification as read:', err);
            showError('Failed to mark notification as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const result = await notificationService.markAllAsRead(currentUser.uid);
            if (result.success) {
                setNotifications(prevNotifications =>
                    prevNotifications.map(notification => ({ ...notification, read: true }))
                );
                showSuccess(`Marked ${result.count} notifications as read`);
            }
        } catch (err) {
            console.error('Error marking all as read:', err);
            showError('Failed to mark all notifications as read');
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            const result = await notificationService.deleteNotification(notificationId);
            if (result.success) {
                setNotifications(prevNotifications =>
                    prevNotifications.filter(notification => notification.id !== notificationId)
                );
                showSuccess('Notification deleted');
            }
        } catch (err) {
            console.error('Error deleting notification:', err);
            showError('Failed to delete notification');
        }
    };

    return (
        <div className="notifications-page">
            <div className="notifications-container">
                <h1>Notifications</h1>

                {loading ? (
                    <div className="loading">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div className="empty-notifications">
                        <p>You have no notifications</p>
                    </div>
                ) : (
                    <>
                        <div className="notification-actions">
                            <button onClick={handleMarkAllAsRead} className="mark-all-read-btn">
                                Mark all as read
                            </button>
                        </div>

                        <div className="notifications-list">
                            {notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                                >
                                    <div className="notification-content">
                                        <div className="notification-header">
                                            <h3>{notification.title}</h3>
                                            <span className="notification-time">
                                                {formatDate(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className="notification-message">{notification.message}</p>
                                    </div>
                                    <div className="notification-actions">
                                        {!notification.read && (
                                            <button
                                                onClick={() => handleMarkAsRead(notification.id)}
                                                className="mark-read-btn"
                                            >
                                                Mark as read
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteNotification(notification.id)}
                                            className="delete-btn"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Helper function to format dates
const formatDate = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

export default NotificationsInboxPage;
