import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, limit, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import '../styles/NotificationInbox.css';

const NotificationInbox = ({ isOpen, onClose }) => {
    const { currentUser, userRole } = useUser();
    const { showError, showSuccess } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const inboxRef = useRef(null);
    const navigate = useNavigate();

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inboxRef.current && !inboxRef.current.contains(event.target) && isOpen) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Listen for notifications in real-time
    useEffect(() => {
        if (!currentUser || !isOpen) return;

        setLoading(true);

        try {
            // Create a simpler query that doesn't require a composite index
            const notificationsRef = collection(db, 'notifications');
            const userNotificationsQuery = query(
                notificationsRef,
                where('userId', '==', currentUser.uid),
                limit(30) // Increased limit to ensure we get enough recent notifications
            );

            // Set up real-time listener
            const unsubscribe = onSnapshot(userNotificationsQuery, (snapshot) => {
                try {
                    let notificationData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        createdAt: doc.data().createdAt?.toDate() || new Date()
                    }));

                    // Sort client-side by createdAt (descending)
                    notificationData.sort((a, b) => b.createdAt - a.createdAt);

                    // Update notifications state
                    setNotifications(notificationData);

                    // Count unread notifications
                    const unreadNotifications = notificationData.filter(n => !n.read).length;
                    setUnreadCount(unreadNotifications);

                    setLoading(false);
                } catch (err) {
                    console.error('Error processing notifications:', err);
                    setLoading(false);
                }
            }, (error) => {
                console.error('Error fetching notifications:', error);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (err) {
            console.error('Error setting up notification listener:', err);
            setLoading(false);
        }
    }, [currentUser, isOpen]);

    // Mark a notification as read
    const markAsRead = async (notification) => {
        if (notification.read) return;

        try {
            await updateDoc(doc(db, 'notifications', notification.id), {
                read: true,
                readAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        if (notifications.length === 0) return;

        try {
            const unreadNotifications = notifications.filter(notif => !notif.read);

            if (unreadNotifications.length === 0) return;

            // Update each unread notification
            const updatePromises = unreadNotifications.map(notification =>
                updateDoc(doc(db, 'notifications', notification.id), {
                    read: true,
                    readAt: serverTimestamp()
                })
            );

            await Promise.all(updatePromises);
            showSuccess('All notifications marked as read');

            // Update local state
            setNotifications(notifications.map(notif => ({ ...notif, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
            showError('Failed to mark notifications as read');
        }
    };

    // Handle notification click based on type
    const handleNotificationClick = async (notification) => {
        // First mark as read
        await markAsRead(notification);

        // Then navigate based on notification type
        switch (notification.type) {
            case 'quote_request':
                navigate(`/manufacturer/quotes`);
                break;
            case 'quote_accepted':
            case 'quote_rejected':
            case 'quote_negotiation':
                navigate(`/manufacturer/quotes/${notification.quoteId}`);
                break;
            case 'role_request_approved':
                navigate('/profile');
                break;
            case 'order_status':
                navigate(`/orders/${notification.orderId}`);
                break;
            case 'investment_update':
                navigate(`/portfolio`);
                break;
            case 'product_trending':
            case 'product_updated':
                navigate(`/product/${notification.productId}`);
                break;
            case 'message':
            default:
                // Just mark as read but stay on current page
                break;
        }

        onClose();
    };

    // Format notification timestamp
    const formatTime = (timestamp) => {
        if (!timestamp) return '';

        const now = new Date();
        const notificationDate = new Date(timestamp);
        const diffMs = now - notificationDate;
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return notificationDate.toLocaleDateString();
    };

    // Get icon based on notification type
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'quote_request': return '💼';
            case 'quote_accepted': return '✅';
            case 'quote_rejected': return '❌';
            case 'quote_negotiation': return '🤝';
            case 'role_request_approved': return '🔑';
            case 'order_status': return '📦';
            case 'investment_update': return '💰';
            case 'product_trending': return '🔥';
            case 'product_updated': return '🔄';
            case 'achievement_earned': return '🏆';
            default: return '📣';
        }
    };

    // Empty state message when no notifications
    const renderEmptyState = () => (
        <div className="empty-notifications">
            <div className="empty-icon">📭</div>
            <p>No new notifications</p>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="notification-inbox-overlay">
            <div ref={inboxRef} className="notification-inbox">
                <div className="notification-inbox-header">
                    <h2>Notifications</h2>
                    <div className="inbox-actions">
                        {notifications.length > 0 && (
                            <button onClick={markAllAsRead} className="mark-all-read">
                                Mark all as read
                            </button>
                        )}
                        <button onClick={onClose} className="close-button">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="notification-inbox-content">
                    {loading ? (
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                            <p>Loading notifications...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        renderEmptyState()
                    ) : (
                        <>
                            <div className="notifications-list">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`notification-item ${notification.read ? '' : 'unread'}`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-icon">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="notification-content">
                                            <h3 className="notification-title">{notification.title}</h3>
                                            <p className="notification-message">{notification.message}</p>
                                            <span className="notification-time">
                                                {formatTime(notification.createdAt)}
                                            </span>
                                        </div>
                                        {!notification.read && <div className="unread-indicator"></div>}
                                    </div>
                                ))}
                            </div>
                            <div className="notification-footer">
                                <Link to="/notifications" onClick={onClose}>
                                    View all notifications
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationInbox;
