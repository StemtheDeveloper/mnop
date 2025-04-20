import React, { createContext, useState, useContext, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import '../../styles/NotificationSystem.css';

// Create context for notifications
export const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user] = useAuthState(auth);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Query notifications for the current user, ordered by timestamp (newest first)
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(
            notificationsQuery,
            (snapshot) => {
                const notificationData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setNotifications(notificationData);
                setUnreadCount(notificationData.filter(n => !n.read).length);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching notifications:', err);
                setError('Failed to load notifications');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    // Mark a notification as read
    const markAsRead = async (notificationId) => {
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, { read: true });
        } catch (err) {
            console.error('Error marking notification as read:', err);
            setError('Failed to update notification');
        }
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        try {
            const promises = notifications
                .filter(n => !n.read)
                .map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));

            await Promise.all(promises);
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
            setError('Failed to update notifications');
        }
    };

    // Delete a notification
    const deleteNotification = async (notificationId) => {
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await deleteDoc(notificationRef);
        } catch (err) {
            console.error('Error deleting notification:', err);
            setError('Failed to delete notification');
        }
    };

    // Delete all notifications
    const deleteAllNotifications = async () => {
        try {
            const promises = notifications.map(n =>
                deleteDoc(doc(db, 'notifications', n.id))
            );
            await Promise.all(promises);
        } catch (err) {
            console.error('Error deleting all notifications:', err);
            setError('Failed to delete notifications');
        }
    };

    const value = {
        notifications,
        unreadCount,
        loading,
        error,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

// Toast notification component
export const NotificationToast = ({ notification, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(notification.id);
        }, 5000);

        return () => clearTimeout(timer);
    }, [notification.id, onClose]);

    const getIcon = () => {
        switch (notification.type) {
            case 'product_approved': return '✅';
            case 'investment': return '💰';
            case 'message': return '✉️';
            case 'trending': return '📈';
            case 'expiring': return '⏰';
            default: return 'ℹ️';
        }
    };

    return (
        <div className={`notification-toast ${notification.read ? 'read' : 'unread'}`}>
            <div className="notification-icon">{getIcon()}</div>
            <div className="notification-content">
                <div className="notification-title">{notification.title}</div>
                <div className="notification-message">{notification.message}</div>
            </div>
            <button className="notification-close" onClick={() => onClose(notification.id)}>×</button>
        </div>
    );
};

// Toast container to display new notifications
export const NotificationToastContainer = () => {
    const { notifications, markAsRead } = useNotifications();
    const [toasts, setToasts] = useState([]);

    // Track new notifications and display them as toasts
    useEffect(() => {
        // Find new unread notifications that are not already displayed
        const newNotifications = notifications
            .filter(n => !n.read && !toasts.some(t => t.id === n.id))
            .slice(0, 3); // Limit to 3 toasts at once

        if (newNotifications.length > 0) {
            setToasts(prev => [...prev, ...newNotifications]);
        }
    }, [notifications]);

    const handleClose = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        markAsRead(id);
    };

    if (toasts.length === 0) return null;

    return (
        <div className="notification-toast-container">
            {toasts.map(notification => (
                <NotificationToast
                    key={notification.id}
                    notification={notification}
                    onClose={handleClose}
                />
            ))}
        </div>
    );
};
