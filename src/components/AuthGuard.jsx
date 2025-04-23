import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';  // Updated to use UserContext

const AuthGuard = ({ children, allowedRoles }) => {
  const { currentUser, hasRole, loading } = useUser();  // Use the consistent UserContext
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
  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const hasRequiredRole = roles.some(role => hasRole(role));

    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" state={{ requiredRoles: roles }} replace />;
    }
  }

  // If user is authenticated and has permission, render the protected component
  return children;
};

export default AuthGuard;
