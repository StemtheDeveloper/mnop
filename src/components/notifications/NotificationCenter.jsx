import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import notificationService from '../../services/notificationService';
import { formatDistanceToNow } from 'date-fns';
import './NotificationCenter.css';
import { useNavigate } from 'react-router-dom';

const NotificationCenter = ({ isOpen, onClose, userId }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const notificationRef = useRef(null);
    const navigate = useNavigate();

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Load notifications
    useEffect(() => {
        const loadNotifications = async () => {
            if (!userId || !isOpen) return;

            setLoading(true);
            try {
                const response = await notificationService.getUserNotifications(userId);
                if (response.success) {
                    // Sort by date, newest first
                    const sortedNotifications = response.data
                        .sort((a, b) => {
                            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                            return dateB - dateA;
                        })
                        .slice(0, 5); // Show only latest 5

                    setNotifications(sortedNotifications);
                }
            } catch (error) {
                console.error('Error loading notifications:', error);
            } finally {
                setLoading(false);
            }
        };

        loadNotifications();
    }, [userId, isOpen]);

    const markAsRead = async (id) => {
        try {
            await notificationService.markAsRead(id);
            // Update local state to mark as read
            setNotifications(prev =>
                prev.map(notification =>
                    notification.id === id ? { ...notification, read: true } : notification
                )
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }

        // If there's a link, navigate to it
        if (notification.link) {
            navigate(notification.link);
            onClose();
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!userId) return;

        try {
            await notificationService.markAllAsRead(userId);
            // Update local state
            setNotifications(prev =>
                prev.map(notification => ({ ...notification, read: true }))
            );
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return formatDistanceToNow(date, { addSuffix: true });
    };

    const viewAllNotifications = () => {
        navigate('/notifications');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="notification-center-overlay">
            <div className="notification-center" ref={notificationRef}>
                <div className="notification-header">
                    <h3>Notifications</h3>
                    <div className="notification-actions">
                        <button
                            className="mark-all-read-btn"
                            onClick={handleMarkAllAsRead}
                        >
                            Mark all as read
                        </button>
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="notification-list">
                    {loading ? (
                        <div className="notification-loading">Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                        <div className="no-notifications">No notifications</div>
                    ) : (
                        notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`notification-item ${notification.read ? '' : 'unread'}`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="notification-content">
                                    <div className="notification-title">{notification.title}</div>
                                    <div className="notification-message">{notification.message}</div>
                                    <div className="notification-time">{formatTime(notification.createdAt)}</div>
                                </div>
                                {!notification.read && <div className="unread-indicator"></div>}
                            </div>
                        ))
                    )}
                </div>

                <div className="notification-footer">
                    <button className="view-all-btn" onClick={viewAllNotifications}>
                        View All Notifications
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationCenter;
