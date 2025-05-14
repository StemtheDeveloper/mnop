import React from 'react';
import { useUser } from '../../context/UserContext';
import AdminProductNotifier from './AdminProductNotifier';

/**
 * Wrapper component that provides user context directly to AdminProductNotifier
 */
const WrappedAdminProductNotifier = () => {
    const userContext = useUser();

    console.log('WrappedAdminProductNotifier userContext:', userContext);

    // If user context is not ready, don't render anything
    if (!userContext) {
        console.log('No userContext available');
        return null;
    }

    if (userContext.loading) {
        console.log('UserContext loading');
        return null;
    }

    return <AdminProductNotifier userContext={userContext} />;
};

export default WrappedAdminProductNotifier;
