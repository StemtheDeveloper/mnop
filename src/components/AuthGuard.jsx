import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';  // Updated to use UserContext

const AuthGuard = ({ children, allowedRoles }) => {
  // Safe access to user context properties
  const userContext = useUser();
  const currentUser = userContext?.currentUser;
  const loading = userContext?.loading || false;
  const userRoles = userContext?.userRoles || [];
  const userRole = userContext?.userRole; // Add access to legacy userRole property

  console.log('AuthGuard - current user:', currentUser?.uid);
  console.log('AuthGuard - user roles:', userRoles);
  console.log('AuthGuard - user role (legacy):', userRole);
  console.log('AuthGuard - allowed roles:', allowedRoles);

  // Use location for redirect state
  const location = useLocation();

  // Wait for authentication to initialize
  if (loading) {
    return <div className="loading">Loading authentication status...</div>;
  }

  // If user is not logged in, redirect to login page
  if (!currentUser) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }
  // If roles are specified, check if user has access
  if (allowedRoles && allowedRoles.length > 0) {
    const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Handle both userRoles array and possible userRole string from legacy data
    const userRolesArray = userRoles || [];
    const legacyRoleArray = userRole ? (Array.isArray(userRole) ? userRole : [userRole]) : [];
    const combinedRoles = [...new Set([...userRolesArray, ...legacyRoleArray])];

    // Check if user has any of the required roles
    const hasRequiredRole = rolesToCheck.some(role =>
      combinedRoles.includes(role)
    );

    if (!hasRequiredRole) {
      console.log(`Access denied: User lacks required role. Has ${combinedRoles.join(', ')}, needs one of ${rolesToCheck.join(', ')}`);
      return <Navigate to="/unauthorized" state={{ requiredRoles: rolesToCheck }} replace />;
    }
  }

  // If user is authenticated and has permission, render the protected component
  return children;
};

export default AuthGuard;
