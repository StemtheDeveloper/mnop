import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';  // Updated to use UserContext

const AuthGuard = ({ children, allowedRoles }) => {
  // Safe access to user context properties
  const userContext = useUser();
  const currentUser = userContext?.currentUser;
  const loading = userContext?.loading || false;
  const userRoles = userContext?.userRoles || [];

  // Use location for redirect state
  const location = useLocation();

  // Wait for authentication to initialize
  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // If user is not logged in, redirect to login page
  if (!currentUser) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  // If roles are specified, check if user has access
  if (allowedRoles && allowedRoles.length > 0) {
    const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    // Check if user has any of the required roles
    const hasRequiredRole = rolesToCheck.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" state={{ requiredRoles: rolesToCheck }} replace />;
    }
  }

  // If user is authenticated and has permission, render the protected component
  return children;
};

export default AuthGuard;
