import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import notificationService from '../services/notificationService';

const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    // Fetch notifications when user changes or refresh is triggered
    useEffect(() => {
        if (currentUser?.uid) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [currentUser, lastRefresh]);

    const fetchNotifications = async () => {
        if (!currentUser?.uid) return;

        setLoading(true);
        const result = await notificationService.getUserNotifications(currentUser.uid);
        setLoading(false);

        if (result.success) {
            const sortedNotifications = result.data.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return dateB - dateA;
            });

            setNotifications(sortedNotifications);
            setUnreadCount(sortedNotifications.filter(n => !n.read).length);
        }
    };

    const refresh = () => {
        setLastRefresh(Date.now());
    };

    const markAsRead = async (notificationId) => {
        const result = await notificationService.markAsRead(notificationId);
        if (result.success) {
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
            return true;
        }
        return false;
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0 || !currentUser?.uid) return false;

        const result = await notificationService.markAllAsRead(currentUser.uid);
        if (result.success) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            return true;
        }
        return false;
    };

    const deleteNotification = async (notificationId) => {
        const result = await notificationService.deleteNotification(notificationId);
        if (result.success) {
            const updatedNotifications = notifications.filter(n => n.id !== notificationId);
            setNotifications(updatedNotifications);
            const newUnreadCount = updatedNotifications.filter(n => !n.read).length;
            setUnreadCount(newUnreadCount);
            return true;
        }
        return false;
    };

    const value = {
        notifications,
        unreadCount,
        loading,
        refresh,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;
