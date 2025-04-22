import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import notificationService from '../../services/notificationService';

/**
 * Component that checks for pending products and notifies admins
 * This is a "headless" component - it doesn't render anything visible
 */
const AdminProductNotifier = () => {
    const { currentUser, hasRole } = useAuth();
    const [lastCheck, setLastCheck] = useState(null);

    useEffect(() => {
        // Only run for admin users
        if (!currentUser?.uid || !hasRole('admin')) return;

        // Don't check more often than every 5 minutes
        const now = new Date();
        if (lastCheck && (now - lastCheck) < 5 * 60 * 1000) return;

        const checkPendingProducts = async () => {
            try {
                // Query for products with 'pending' status
                const productsRef = collection(db, 'products');
                const pendingQuery = query(
                    productsRef,
                    where('status', '==', 'pending')
                );

                const snapshot = await getDocs(pendingQuery);
                const pendingCount = snapshot.size;

                // If there are pending products, send notification
                if (pendingCount > 0) {
                    await notificationService.sendPendingProductsNotification(
                        currentUser.uid,
                        pendingCount
                    );
                }

                setLastCheck(now);
            } catch (error) {
                console.error('Error checking pending products:', error);
            }
        };

        checkPendingProducts();

        // Set up interval to check periodically (every 30 minutes)
        const interval = setInterval(checkPendingProducts, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, [currentUser, hasRole, lastCheck]);

    // This component doesn't render anything
    return null;
};

export default AdminProductNotifier;