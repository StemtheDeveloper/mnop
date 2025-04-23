import React, { useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * A "headless" component that refreshes notifications when the app starts.
 * This component doesn't render anything visible.
 */
const NotificationRefresher = () => {
    const { refresh } = useNotifications();
    const { currentUser } = useAuth();

    // Refresh notifications when the app loads if a user is logged in
    useEffect(() => {
        if (currentUser?.uid) {
            // Call refresh to fetch the latest notifications
            refresh().catch(error => {
                console.error('Error refreshing notifications on app start:', error);
            });
        }
    }, [currentUser, refresh]);

    // This component doesn't render anything
    return null;
};

export default NotificationRefresher;