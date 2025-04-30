import React, { useEffect, useRef } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * A "headless" component that refreshes notifications when:
 * 1. The app initially loads
 * 2. A user signs in
 * 3. The page becomes visible again (tab focus)
 * 
 * This component doesn't render anything visible.
 */
const NotificationRefresher = () => {
    const { refresh } = useNotifications();
    const { currentUser } = useAuth();
    const initialRefreshCompleted = useRef(false);
    const lastRefreshTime = useRef(0);
    const initialLoadRef = useRef(true);

    // Refresh notifications when the app loads - even on first load
    useEffect(() => {
        // This effect only runs once when the component mounts
        // regardless of user state to ensure immediate notification refresh
        if (initialLoadRef.current) {
            initialLoadRef.current = false;

            const refreshOnFirstLoad = async () => {
                if (currentUser?.uid) {
                    try {
                        await refresh();
                        console.log('Notifications refreshed on initial app load');
                    } catch (error) {
                        console.error('Error refreshing notifications on first load:', error);
                    }
                }
            };

            refreshOnFirstLoad();
        }
    }, []);

    // Refresh notifications when the app loads if a user is logged in
    useEffect(() => {
        const refreshNotifications = async () => {
            if (currentUser?.uid) {
                try {
                    // Prevent excessive refreshes by checking time since last refresh (minimum 30 seconds)
                    const now = Date.now();
                    if (now - lastRefreshTime.current < 30000) {
                        return;
                    }

                    lastRefreshTime.current = now;
                    initialRefreshCompleted.current = true;

                    // Call refresh to fetch the latest notifications
                    await refresh();
                    console.log('Notifications refreshed on user auth change or app start');
                } catch (error) {
                    console.error('Error refreshing notifications:', error);
                }
            }
        };

        // Refresh when component mounts or user changes
        refreshNotifications();

        // Reset the flag when user changes (logs out)
        return () => {
            if (!currentUser) {
                initialRefreshCompleted.current = false;
            }
        };
    }, [currentUser, refresh]);

    // Add visibility change listener to refresh when tab becomes visible again
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && currentUser?.uid) {
                const now = Date.now();
                // Only refresh if it's been at least 30 seconds since the last refresh
                if (now - lastRefreshTime.current >= 30000) {
                    lastRefreshTime.current = now;
                    refresh().catch(error => {
                        console.error('Error refreshing notifications on visibility change:', error);
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentUser, refresh]);

    // This component doesn't render anything
    return null;
};

export default NotificationRefresher;