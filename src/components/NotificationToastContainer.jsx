import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';

const NotificationToastContainer = () => {
    const { notifications, loading } = useNotifications();
    const { showToast } = useToast();
    const [processedIds, setProcessedIds] = useState(new Set());
    const initialLoadComplete = useRef(false);
    const previousNotificationsLength = useRef(0);
    
    // Monitor notifications and show toasts for new ones
    useEffect(() => {
        console.log('NotificationToastContainer effect triggered', { 
            loading, 
            notificationsCount: notifications?.length || 0,
            initialLoadComplete: initialLoadComplete.current,
            previousLength: previousNotificationsLength.current
        });
        
        // Don't process anything while loading
        if (loading) {
            return;
        }
        
        // Skip processing if there are no notifications
        if (!notifications || notifications.length === 0) {
            return;
        }
        
        // Skip the first load to avoid showing toasts for existing notifications
        if (!initialLoadComplete.current) {
            console.log('Initial load complete, caching notification IDs');
            // Initialize the processed IDs with existing notifications
            setProcessedIds(new Set(notifications.map(n => n.id)));
            initialLoadComplete.current = true;
            previousNotificationsLength.current = notifications.length;
            return;
        }
        
        try {
            // Find new notifications (ones that aren't in processedIds)
            const currentIds = Array.from(processedIds);
            console.log('Comparing notifications', { 
                current: notifications.length, 
                previous: previousNotificationsLength.current,
                processedCount: currentIds.length
            });
            
            // Find notifications that we haven't processed yet
            const newNotifications = notifications.filter(n => !processedIds.has(n.id));
            
            if (newNotifications.length > 0) {
                console.log('Found new notifications:', newNotifications.length);
                
                // Create a new set to avoid directly modifying state
                const updatedProcessedIds = new Set(processedIds);
                
                // Show a toast for each new notification
                newNotifications.forEach(notification => {
                    console.log('Showing toast for notification:', notification.title);
                    updatedProcessedIds.add(notification.id);
                    
                    // Determine the toast type based on notification type
                    let toastType = 'info';
                    if (['product_approved', 'role_request_approved', 'investment_confirmation', 'interest'].includes(notification.type)) {
                        toastType = 'success';
                    } else if (['product_rejected', 'expiring'].includes(notification.type)) {
                        toastType = 'warning';
                    } else if (notification.type === 'trending') {
                        toastType = 'trending';
                    }
                    
                    // Display the toast
                    showToast({
                        type: toastType,
                        title: notification.title,
                        message: notification.message,
                        link: notification.link,
                        duration: 5000, // 5 seconds
                        notification: notification
                    });
                });
                
                // Update processed IDs state only once
                setProcessedIds(updatedProcessedIds);
            }
            
            // Always update our reference count
            previousNotificationsLength.current = notifications.length;
            
        } catch (error) {
            console.error('Error processing notifications in toast container:', error);
        }
    }, [notifications, loading, processedIds, showToast]);

    // This component doesn't render anything visible, it just processes notifications
    return null;
};

export default NotificationToastContainer;