import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import notificationService from '../services/notificationService';
import { collection, query, where, onSnapshot, orderBy, getDocs, limit } from 'firebase/firestore';
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const unsubscribeRef = useRef(null);
    const userIdRef = useRef(null);

    // Track when user ID changes to properly handle auth state
    useEffect(() => {
        if (currentUser?.uid) {
            console.log('User ID updated:', currentUser.uid);
            userIdRef.current = currentUser.uid;
            // Ensure we load notifications when user signs in
            if (isInitialized) {
                console.log('User changed, refreshing notifications');
                fetchNotificationsDirectly(currentUser.uid);
            }
        } else {
            console.log('No user or user signed out');
            userIdRef.current = null;
            // Clear notifications when user signs out
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [currentUser, isInitialized]);

    // Set up real-time notification listener
    useEffect(() => {
        // Mark the provider as initialized
        setIsInitialized(true);
        
        // Function to setup the notification listener
        const setupNotificationListener = async () => {
            const userId = currentUser?.uid || userIdRef.current;
            console.log('Setting up notification listener, user:', userId);
            
            // Clean up any existing listener
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            
            // Don't do anything if no user is logged in
            if (!userId) {
                setNotifications([]);
                setUnreadCount(0);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // First, try direct fetch to get initial data quickly
                const initialFetchSuccess = await fetchNotificationsDirectly(userId);
                
                if (!initialFetchSuccess) {
                    console.log('Initial fetch failed, will rely on listener');
                }
                
                // Create a query for this user's notifications
                const notificationsRef = collection(db, 'notifications');
                const notificationsQuery = query(
                    notificationsRef,
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc'),
                    limit(50) // Limit to 50 most recent notifications
                );

                console.log('Setting up Firebase listener for notifications');
                
                // Subscribe to real-time updates
                const unsubscribe = onSnapshot(
                    notificationsQuery, 
                    (snapshot) => {
                        const notificationsList = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        console.log('Notification snapshot received, count:', notificationsList.length);
                        
                        // Update state with the new notifications
                        setNotifications(notificationsList);
                        setUnreadCount(notificationsList.filter(n => !n.read).length);
                        setLoading(false);
                        setError(null);
                    }, 
                    (err) => {
                        console.error('Error in notification listener:', err);
                        setError(err.message);
                        setLoading(false);
                    }
                );

                // Save unsubscribe function to ref
                unsubscribeRef.current = unsubscribe;
            } catch (err) {
                console.error('Failed to set up notification listener:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        // Setup the listener
        setupNotificationListener();

        // Clean up subscription on unmount
        return () => {
            console.log('Cleaning up notification listener');
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [currentUser]);

    // Direct fetch method that doesn't use a listener
    const fetchNotificationsDirectly = async (userId) => {
        if (!userId) {
            console.log('Cannot fetch notifications: No userId provided');
            return false;
        }

        console.log('Fetching notifications directly for user:', userId);
        setError(null);
        
        try {
            const result = await notificationService.getUserNotifications(userId);
            
            if (result.success && Array.isArray(result.data)) {
                console.log('Direct fetch successful, notifications:', result.data.length);
                
                const sortedNotifications = result.data.sort((a, b) => {
                    let dateA, dateB;
                    
                    try {
                        dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    } catch (e) {
                        dateA = new Date(0); // Default to epoch if invalid
                    }
                    
                    try {
                        dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    } catch (e) {
                        dateB = new Date(0); // Default to epoch if invalid
                    }
                    
                    return dateB - dateA;
                });

                setNotifications(sortedNotifications);
                setUnreadCount(sortedNotifications.filter(n => !n.read).length);
                setLoading(false);
                return true;
            } else {
                console.error('Direct fetch failed:', result.error || 'Unknown error');
                if (result.error) {
                    setError(result.error);
                }
                // Don't update loading state here if we're also using the listener
                return false;
            }
        } catch (error) {
            console.error('Error in direct notification fetch:', error);
            setError(error.message);
            // Don't update loading state here if we're also using the listener
            return false;
        }
    };

    // Public refresh method for components to call
    const refresh = useCallback(async () => {
        const userId = currentUser?.uid || userIdRef.current;
        
        if (!userId) {
            console.log('Cannot refresh notifications: No user ID available');
            return false;
        }
        
        console.log('Manual refresh requested for user:', userId);
        setLoading(true);
        return await fetchNotificationsDirectly(userId);
    }, [currentUser]);

    // Mark a notification as read
    const markAsRead = useCallback(async (notificationId) => {
        try {
            const result = await notificationService.markAsRead(notificationId);
            if (result.success) {
                // Local state update to avoid waiting for Firebase to sync
                setNotifications(prev =>
                    prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error marking notification as read:", error);
            return false;
        }
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        const userId = currentUser?.uid || userIdRef.current;
        
        if (unreadCount === 0 || !userId) return false;

        try {
            const result = await notificationService.markAllAsRead(userId);
            if (result.success) {
                // Local state update to avoid waiting for Firebase to sync
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                setUnreadCount(0);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
            return false;
        }
    }, [currentUser, unreadCount]);

    // Delete a notification
    const deleteNotification = useCallback(async (notificationId) => {
        try {
            const result = await notificationService.deleteNotification(notificationId);
            if (result.success) {
                // Local state update to avoid waiting for Firebase to sync
                const updatedNotifications = notifications.filter(n => n.id !== notificationId);
                setNotifications(updatedNotifications);
                const newUnreadCount = updatedNotifications.filter(n => !n.read).length;
                setUnreadCount(newUnreadCount);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error deleting notification:", error);
            return false;
        }
    }, [notifications]);

    const value = {
        notifications,
        unreadCount,
        loading,
        error,
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
