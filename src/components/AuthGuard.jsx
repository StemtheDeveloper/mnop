import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthGuard = ({ children, allowedRoles }) => {
  const { currentUser, hasRole, loading } = useAuth();
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
  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // If user is authenticated and has permission, render the protected component
  return children;
};

export default AuthGuard;
