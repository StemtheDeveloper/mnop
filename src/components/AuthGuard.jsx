import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

/**
 * AuthGuard component for role-based access control
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The components to render if authorized
 * @param {string|string[]} [props.allowedRoles] - Required role(s) to access the route
 * @returns {React.ReactNode}
 */
const AuthGuard = ({ children, allowedRoles }) => {
  const { currentUser, userRole, loading, authInitialized } = useUser();
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

  // If user is not authenticated, redirect to sign in with return path
  if (!currentUser) {
    return <Navigate to="/signin" state={{ from: location.pathname, message: "Please sign in to access this page." }} replace />;
  }

  // If no specific roles are required, allow access
  if (!allowedRoles) {
    return children;
  }

  // Check if user has one of the allowed roles
  const hasRequiredRole = Array.isArray(allowedRoles)
    ? allowedRoles.includes(userRole)
    : allowedRoles === userRole;

  // If user doesn't have the required role, redirect to unauthorized page
  if (!hasRequiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is authenticated and authorized
  return children;
};

export default AuthGuard;
