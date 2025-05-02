import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import TwoFactorAuthPrompt from './TwoFactorAuthPrompt';
import twoFactorAuthService from '../services/twoFactorAuthService';

/**
 * Component that enforces two-factor authentication for protected routes
 * Specifically for admin and designer accounts
 */
const TwoFactorAuthGuard = ({ children }) => {
    const { currentUser, twoFactorStatus, userRoles } = useUser();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [is2FARequired, setIs2FARequired] = useState(false);

    // Check if 2FA is required for the user's roles
    useEffect(() => {
        const checkRequirement = async () => {
            if (!userRoles || userRoles.length === 0) {
                setIs2FARequired(false);
                setLoading(false);
                return;
            }

            try {
                const required = await twoFactorAuthService.is2FARequiredForRoles(userRoles);
                setIs2FARequired(required);
            } catch (error) {
                console.error("Error checking 2FA requirement:", error);
                // Default to previous behavior on error
                const isAdminOrDesigner = userRoles.some(role => ['admin', 'designer'].includes(role));
                setIs2FARequired(isAdminOrDesigner);
            } finally {
                setLoading(false);
            }
        };

        checkRequirement();
    }, [userRoles]);

    // While loading, show nothing
    if (loading) {
        return null;
    }

    // If 2FA is not required for the user's roles, render the children
    if (!is2FARequired) {
        return children;
    }

    // If 2FA is required but not enabled, show the prompt
    if (is2FARequired && !twoFactorStatus.enabled) {
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
    if (is2FARequired && twoFactorStatus.enabled && !twoFactorStatus.verified) {
        return <Navigate to="/settings" state={{ from: location.pathname, message: "Please complete your two-factor authentication setup." }} />;
    }

    // If 2FA requirements are met, render the children
    return children;
};

export default TwoFactorAuthGuard;