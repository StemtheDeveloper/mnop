import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';

/**
 * ProtectedRoute component for authentication-only access
 * Can also check for specific user roles if required
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The components to render if authenticated
 * @param {string|string[]} [props.requiredRoles] - Optional: specific role(s) required to access the route
 * @returns {React.ReactNode}
 */
const ProtectedRoute = ({ children, requiredRoles }) => {
    const { currentUser, hasRole, loading, authInitialized } = useUser();
    const location = useLocation();
    const { showError } = useToast();

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

    // If not authenticated, redirect to sign in with return path and custom message
    if (!currentUser) {
        // Notify the user they need to sign in
        useEffect(() => {
            showError("Please sign in to access this page");
        }, []);

        // Save the location the user was trying to access
        return <Navigate to="/signin" state={{
            from: location.pathname,
            message: "Please sign in to access this page"
        }} replace />;
    }

    // If specific roles are required, check if the user has one of them
    if (requiredRoles) {
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        // Use the hasRole function from UserContext to check if user has any of the required roles
        const hasRequiredRole = roles.some(role => hasRole(role));

        // Special case for trending product extension requests
        if (location.pathname.includes('/extend-trending-product') && hasRole('designer')) {
            return children;
        }

        if (!hasRequiredRole) {
            // Show permission error toast
            useEffect(() => {
                const roleText = roles.length > 1
                    ? `one of these roles: ${roles.join(', ')}`
                    : `the ${roles[0]} role`;
                showError(`Access denied. You need ${roleText} to view this page.`);
            }, []);

            // Redirect to unauthorized page with info about required roles
            return <Navigate to="/unauthorized" state={{ requiredRoles: roles }} replace />;
        }
    }

    // User is authenticated and has required role(s) if specified
    return children;
};

export default ProtectedRoute;
