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
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  // If specific roles are required, check if user has one of them
  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if user has any of the required roles
    const hasAllowedRole = roles.some(role =>
      userRole && (typeof userRole === 'string'
        ? userRole === role
        : userRole.includes(role))
    );

    if (!hasAllowedRole) {
      // Redirect to unauthorized page with info about required roles
      return <Navigate to="/unauthorized" state={{ requiredRoles: roles }} replace />;
    }
  }

  // User is authenticated and has required role(s)
  return children;
}

export default AuthGuard;
