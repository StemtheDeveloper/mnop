import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import twoFactorAuthService from '../services/twoFactorAuthService';
import '../styles/TwoFactorAuth.css';

/**
 * A prompt shown to users with required roles (admin, designer) who haven't set up 2FA
 */
const TwoFactorAuthPrompt = () => {
    const { userRoles, twoFactorStatus } = useUser();
    const [showPrompt, setShowPrompt] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check if the prompt should be shown based on user roles and system settings
    useEffect(() => {
        const checkPromptVisibility = async () => {
            // Don't show the prompt if 2FA is already enabled
            if (twoFactorStatus.enabled) {
                setShowPrompt(false);
                setLoading(false);
                return;
            }

            try {
                // Check if 2FA is required for this user based on system settings
                const is2FARequired = await twoFactorAuthService.is2FARequiredForRoles(userRoles);
                setShowPrompt(is2FARequired);
            } catch (error) {
                console.error('Error checking 2FA requirements:', error);
                // Default to showing if user is admin or designer
                const defaultRequired = userRoles.some(role => ['admin', 'designer'].includes(role));
                setShowPrompt(defaultRequired);
            } finally {
                setLoading(false);
            }
        };

        checkPromptVisibility();
    }, [userRoles, twoFactorStatus]);

    // Don't render anything while checking
    if (loading) {
        return null;
    }

    // Don't render if prompt shouldn't be shown
    if (!showPrompt) {
        return null;
    }

    // Determine role-specific messaging
    const isAdmin = userRoles.includes('admin');
    const roleText = isAdmin ? 'administrator' : 'designer';

    return (
        <div className="two-factor-prompt">
            <div className="prompt-content">
                <div className="prompt-icon">🔒</div>
                <div className="prompt-message">
                    <h3>Security Verification Required</h3>
                    <p>
                        As an {roleText}, you need to set up two-factor authentication
                        to access restricted areas of the platform.
                    </p>
                    <p className="prompt-urgency">
                        Please set up 2FA now to ensure continued access.
                    </p>
                </div>
                <Link to="/profile" state={{ defaultTab: 'security' }} className="setup-button">
                    Set Up Two-Factor Authentication
                </Link>
            </div>
        </div>
    );
};

export default TwoFactorAuthPrompt;