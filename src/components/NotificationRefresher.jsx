import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

// Create a small component to briefly open and close the notification drawer
const AutoOpenCloseDrawer = ({ isActive, userId, onComplete }) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isActive && userId) {
            // Open the drawer
            setIsOpen(true);

            // Close after a short delay (500ms)
            const timer = setTimeout(() => {
                setIsOpen(false);
                if (onComplete) onComplete();
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [isActive, userId, onComplete]);

    // This will trigger the real drawer to open/close momentarily
    if (isOpen) {
        // You might need to adjust this based on your actual implementation
        document.dispatchEvent(new CustomEvent('notification-drawer-auto-open'));
    }

    return null;
};

/**
 * A "headless" component that refreshes notifications when:
 * 1. The app initially loads
 * 2. A user signs in
 * 3. The page becomes visible again (tab focus)
 * 4. Window is refreshed
 * 
 * This component doesn't render anything visible.
 */
const NotificationRefresher = () => {
    const { refresh, loading } = useNotifications();
    const { currentUser } = useAuth();
    const lastRefreshTime = useRef(0);
    const initialLoadAttempted = useRef(false);
    const [autoOpenAttempted, setAutoOpenAttempted] = useState(false);

    // Immediately refresh notifications as soon as the component mounts
    // This is the most important effect for initial page load
    useEffect(() => {
        // Only run this once on initial component mount
        if (!initialLoadAttempted.current && currentUser?.uid) {
            initialLoadAttempted.current = true;
            lastRefreshTime.current = Date.now();

            console.log('Initial notification refresh triggered on page load');
            refresh()
                .then(() => {
                    console.log('Initial notifications loaded successfully');
                    // After initial load, trigger the auto-open process
                    if (!autoOpenAttempted) {
                        setAutoOpenAttempted(true);
                    }
                })
                .catch(error => console.error('Failed to load initial notifications:', error));
        }
    }, [refresh, currentUser, autoOpenAttempted]);

    // Refresh notifications when user logs in or changes
    useEffect(() => {
        if (currentUser?.uid) {
            const now = Date.now();

            // Only refresh if it's been at least 5 seconds since last refresh
            // This prevents duplicate refreshes when multiple effects fire at once
            if (now - lastRefreshTime.current >= 5000) {
                console.log('Refreshing notifications on user change');
                lastRefreshTime.current = now;

                refresh()
                    .then(() => {
                        console.log('Notifications refreshed for user:', currentUser.uid);
                        // After user change refresh, trigger the auto-open process
                        if (!autoOpenAttempted) {
                            setAutoOpenAttempted(true);
                        }
                    })
                    .catch(error => console.error('Error refreshing notifications on user change:', error));
            }
        }
    }, [currentUser?.uid, refresh, autoOpenAttempted]);

    // Add visibility change listener to refresh when tab becomes visible again
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && currentUser?.uid) {
                const now = Date.now();
                // Only refresh if it's been at least 5 seconds since the last refresh
                if (now - lastRefreshTime.current >= 5000) {
                    console.log('Refreshing notifications on visibility change');
                    lastRefreshTime.current = now;

                    refresh()
                        .then(() => console.log('Notifications refreshed on tab focus'))
                        .catch(error => console.error('Error refreshing notifications on visibility change:', error));
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Special case: force refresh when page is already visible on mount
        if (document.visibilityState === 'visible' && currentUser?.uid) {
            const now = Date.now();
            if (now - lastRefreshTime.current >= 5000) {
                console.log('Force refreshing notifications on initial visibility');
                lastRefreshTime.current = now;

                refresh().catch(error => {
                    console.error('Error refreshing notifications on initial visibility:', error);
                });
            }
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentUser, refresh]);

    // Force immediate refresh on DOMContentLoaded
    useEffect(() => {
        const handleDOMContentLoaded = () => {
            if (currentUser?.uid) {
                console.log('DOM content loaded, refreshing notifications');
                lastRefreshTime.current = Date.now();

                refresh().catch(error => {
                    console.error('Error refreshing notifications on DOMContentLoaded:', error);
                });
            }
        };

        // Check if the DOM is already loaded
        if (document.readyState === 'complete' && currentUser?.uid) {
            handleDOMContentLoaded();
        } else {
            document.addEventListener('DOMContentLoaded', handleDOMContentLoaded);
            return () => {
                document.removeEventListener('DOMContentLoaded', handleDOMContentLoaded);
            };
        }
    }, [currentUser, refresh]);

    // Handle the auto-open completion
    const handleAutoOpenComplete = () => {
        console.log('Auto-open drawer sequence completed');
    };

    return (
        <>
            {/* This component doesn't render anything visible */}
            <AutoOpenCloseDrawer
                isActive={autoOpenAttempted}
                userId={currentUser?.uid}
                onComplete={handleAutoOpenComplete}
            />
        </>
    );
};

export default NotificationRefresher;