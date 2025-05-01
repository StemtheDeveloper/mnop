import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import TwoFactorAuthPrompt from './TwoFactorAuthPrompt';

/**
 * Component that enforces two-factor authentication for protected routes
 * Specifically for admin and designer accounts
 */
const TwoFactorAuthGuard = ({ children }) => {
    const { currentUser, twoFactorStatus, userRoles } = useUser();
    const location = useLocation();

    // Check if the user is an admin or designer
    const isAdminOrDesigner = userRoles.some(role => ['admin', 'designer'].includes(role));

    // If user is not admin or designer, no need to enforce 2FA
    if (!isAdminOrDesigner) {
        return children;
    }

    // If 2FA is required but not enabled, show the prompt
    if (twoFactorStatus.required && !twoFactorStatus.enabled) {
        // Store the current location so we can redirect back after setup
        return (
            <div className="two-factor-guard-container">
                <TwoFactorAuthPrompt />
                <div className="restricted-content-message">
                    <p>
                        Access to this area is restricted until you set up two-factor authentication.
                        This additional security measure is required for all {userRoles.includes('admin') ? 'administrators' : 'designers'}.
                    </p>
                    <p>
                        Please set up two-factor authentication to continue.
                    </p>
                </div>
            </div>
        );
    }

    // If 2FA is enabled but not verified, redirect to settings
    if (twoFactorStatus.required && twoFactorStatus.enabled && !twoFactorStatus.verified) {
        return <Navigate to="/settings" state={{ from: location.pathname, message: "Please complete your two-factor authentication setup." }} />;
    }

    // If 2FA requirements are met, render the children
    return children;
};

export default TwoFactorAuthGuard;