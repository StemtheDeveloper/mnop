import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import notificationService from '../services/notificationService';
import '../styles/NotificationCenter.css';

const NotificationCenter = ({ isOpen, onClose }) => {
    const { currentUser } = useUser();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const notificationRef = useRef(null);

    useEffect(() => {
        // Load notifications when opened
        if (isOpen && currentUser) {
            loadNotifications();
        }
    }, [isOpen, currentUser]);

    useEffect(() => {
        // Handle clicks outside of notification center
        function handleClickOutside(event) {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const loadNotifications = async () => {
        if (!currentUser) return;

        setLoading(true);
        setError(null);

        try {
            const response = await notificationService.getUserNotifications(currentUser.uid);
            if (response.success) {
                setNotifications(response.data);
            } else {
                setError(response.error || 'Failed to load notifications');
            }
        } catch (err) {
            setError('Error loading notifications');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await notificationService.markAsRead(notificationId);
            setNotifications(prevNotifications =>
                prevNotifications.map(notification =>
                    notification.id === notificationId
                        ? { ...notification, read: true }
                        : notification
                )
            );
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!currentUser || notifications.length === 0) return;

        try {
            await notificationService.markAllAsRead(currentUser.uid);
            setNotifications(prevNotifications =>
                prevNotifications.map(notification => ({ ...notification, read: true }))
            );
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            await notificationService.deleteNotification(notificationId);
            setNotifications(prevNotifications =>
                prevNotifications.filter(notification => notification.id !== notificationId)
            );
        } catch (err) {
            console.error('Error deleting notification:', err);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 60) {
            return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'product_archived':
                return '🗃️';
            case 'product_restored':
                return '🔄';
            case 'funding_update':
                return '💰';
            case 'system_message':
                return '⚙️';
            default:
                return '📝';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="notification-overlay">
            <div className="notification-center" ref={notificationRef}>
                <div className="notification-header">
                    <h3>Notifications</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                {loading ? (
                    <div className="notification-loading">Loading notifications...</div>
                ) : error ? (
                    <div className="notification-error">{error}</div>
                ) : notifications.length === 0 ? (
                    <div className="empty-notifications">
                        <p>No notifications</p>
                    </div>
                ) : (
                    <>
                        <div className="notification-actions">
                            <button onClick={handleMarkAllAsRead}>Mark all as read</button>
                        </div>

                        <div className="notification-list">
                            {notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    <div className="notification-content">
                                        <div className="notification-title">{notification.title}</div>
                                        <div className="notification-message">{notification.message}</div>
                                        <div className="notification-time">{formatDate(notification.createdAt)}</div>

                                        {notification.productId && (
                                            <div className="notification-actions">
                                                <Link
                                                    to={`/product/${notification.productId}`}
                                                    onClick={() => {
                                                        handleMarkAsRead(notification.id);
                                                        onClose();
                                                    }}
                                                >
                                                    View Product
                                                </Link>
                                            </div>
                                        )}
                                    </div>

                                    <div className="notification-buttons">
                                        {!notification.read && (
                                            <button
                                                className="mark-read-btn"
                                                onClick={() => handleMarkAsRead(notification.id)}
                                                title="Mark as read"
                                            >
                                                ✓
                                            </button>
                                        )}
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleDeleteNotification(notification.id)}
                                            title="Delete"
                                        >
                                            🗑️
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

export default NotificationCenter;
