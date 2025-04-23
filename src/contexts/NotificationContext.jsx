import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

    // Add refs to prevent infinite loops
    const isErrorFallbackActive = useRef(false);
    const unsubscribeRef = useRef(null);
    const isMounted = useRef(true);

    // Use cleanUp function to properly clean up resources when unmounting
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    // Memoize fetchNotifications to prevent recreation on each render
    const fetchNotifications = useCallback(async () => {
        if (!currentUser?.uid || !isMounted.current) return;

        setLoading(true);
        try {
            const result = await notificationService.getUserNotifications(currentUser.uid);

            if (result.success && isMounted.current) {
                const sortedNotifications = result.data.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                    return dateB - dateA;
                });

                setNotifications(sortedNotifications);
                setUnreadCount(sortedNotifications.filter(n => !n.read).length);
            }
        } catch (error) {
            console.error('Error in fetchNotifications:', error);
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [currentUser?.uid]);

    // Set up real-time notification listener
    useEffect(() => {
        if (!currentUser?.uid) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        // Clean up previous listener if it exists
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        // Reset the fallback flag on user change
        isErrorFallbackActive.current = false;
        setLoading(true);

        // Create a query for this user's notifications
        const notificationsRef = collection(db, 'notifications');
        const notificationsQuery = query(
            notificationsRef,
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        // Subscribe to real-time updates
        try {
            const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
                if (!isMounted.current) return;

                setLoading(false);

                const notificationsList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setNotifications(notificationsList);
                setUnreadCount(notificationsList.filter(n => !n.read).length);
            }, (error) => {
                console.error('Error fetching notifications:', error);
                if (!isMounted.current) return;

                setLoading(false);

                // Only do the fallback once to prevent infinite loops
                if (!isErrorFallbackActive.current) {
                    isErrorFallbackActive.current = true;
                    // Fallback to regular fetch if real-time updates fail
                    fetchNotifications();
                }
            });

            // Store the unsubscribe function in the ref
            unsubscribeRef.current = unsubscribe;
        } catch (error) {
            console.error('Error setting up notifications listener:', error);
            if (isMounted.current) {
                setLoading(false);
            }
        }

        // Clean up subscription on unmount or user change
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [currentUser?.uid, fetchNotifications]);

    // Manual refresh function - returns a promise for better handling
    const refresh = useCallback(async () => {
        // Set the refresh timestamp first
        setLastRefresh(Date.now());

        // Then return a promise that resolves after fetching
        if (!currentUser?.uid) {
            return Promise.resolve(); // Return resolved promise if no user
        }

        return fetchNotifications(); // This will return the promise from fetchNotifications
    }, [currentUser?.uid, fetchNotifications]);

    const markAsRead = useCallback(async (notificationId) => {
        try {
            const result = await notificationService.markAsRead(notificationId);
            if (result.success && isMounted.current) {
                // Note: We don't need to update state here if we're using onSnapshot
                // The Firestore listener will automatically update the state
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (unreadCount === 0 || !currentUser?.uid) return false;

        try {
            const result = await notificationService.markAllAsRead(currentUser.uid);
            // No need to update state here, onSnapshot will handle it
            return result.success;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return false;
        }
    }, [currentUser?.uid, unreadCount]);

    const deleteNotification = useCallback(async (notificationId) => {
        try {
            const result = await notificationService.deleteNotification(notificationId);
            // No need to update state here, onSnapshot will handle it
            return result.success;
        } catch (error) {
            console.error('Error deleting notification:', error);
            return false;
        }
    }, []);

    const deleteAllNotifications = useCallback(async () => {
        if (!currentUser?.uid) return false;

        try {
            const result = await notificationService.deleteAllNotifications(currentUser.uid);
            // No need to update state here, onSnapshot will handle it
            return result.success;
        } catch (error) {
            console.error('Error deleting all notifications:', error);
            return false;
        }
    }, [currentUser?.uid]);

    const value = {
        notifications,
        unreadCount,
        loading,
        refresh,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        lastRefresh, // Make lastRefresh available to consumers
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;
