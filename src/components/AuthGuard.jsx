import React from 'react';
import { Redirect } from 'react-router-dom';

const AuthGuard = ({ children, isAuthenticated, role, requiredRole }) => {
  if (!isAuthenticated || role !== requiredRole) {
    return <Redirect to="/login" />;
  }

  return children;
};

export default AuthGuard;
