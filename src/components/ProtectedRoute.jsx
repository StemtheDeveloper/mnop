import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

/**
 * ProtectedRoute component for authentication-only access (no role check)
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The components to render if authenticated
 * @returns {React.ReactNode}
 */
const ProtectedRoute = ({ children }) => {
    const { currentUser, loading, authInitialized } = useUser();
    const location = useLocation();

    // Show nothing while initializing auth to prevent flash of incorrect content
    if (!authInitialized) {
        return null;
    }

    // Show loading indicator while fetching user data
    if (loading) {
        return (
            <div className="auth-loading">
                <div className="auth-loading-spinner"></div>
            </div>
        );
    }

    // If not authenticated, redirect to sign in with return path
    if (!currentUser) {
        // Save the location the user was trying to access
        return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
    }

    // User is authenticated
    return children;
};

export default ProtectedRoute;
