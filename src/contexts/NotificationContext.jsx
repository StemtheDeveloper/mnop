import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import notificationService from '../services/notificationService';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

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

    // Set up real-time notification listener
    useEffect(() => {
        if (!currentUser?.uid) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        setLoading(true);

        // Create a query for this user's notifications
        const notificationsRef = collection(db, 'notifications');
        const notificationsQuery = query(
            notificationsRef,
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        // Subscribe to real-time updates
        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            setLoading(false);

            const notificationsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setNotifications(notificationsList);
            setUnreadCount(notificationsList.filter(n => !n.read).length);
        }, (error) => {
            console.error('Error fetching notifications:', error);
            setLoading(false);

            // Fallback to regular fetch if real-time updates fail
            fetchNotifications();
        });

        // Clean up subscription on unmount
        return () => unsubscribe();
    }, [currentUser]);

    // Legacy fetch method as backup and for manual refresh
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

    // Manual refresh function - mostly for legacy support
    const refresh = () => {
        // With real-time updates, manual refresh is less necessary
        // but we keep it for fallback purposes
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
