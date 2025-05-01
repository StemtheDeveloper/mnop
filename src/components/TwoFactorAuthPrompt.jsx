// filepath: c:\Users\GGPC\Desktop\mnop-app\src\components\TwoFactorAuthPrompt.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import '../styles/TwoFactorAuth.css';

const TwoFactorAuthPrompt = () => {
    const { twoFactorStatus, userRoles } = useUser();
    const navigate = useNavigate();

    // Don't show anything if:
    // - Two-factor auth is not required
    // - Or if it's already enabled
    if (!twoFactorStatus.required || twoFactorStatus.enabled) {
        return null;
    }

    const roleNames = userRoles
        .filter(role => role === 'admin' || role === 'designer')
        .map(role => role.charAt(0).toUpperCase() + role.slice(1))
        .join(' and ');

    const handleNavigateToSettings = () => {
        navigate('/settings');
    };

    return (
        <div className="two-factor-prompt">
            <div className="prompt-content">
                <div className="prompt-icon">🔐</div>
                <div className="prompt-message">
                    <h3>Security Enhancement Required</h3>
                    <p>
                        As a {roleNames}, your account requires two-factor authentication for added security.
                        Please set up text message verification in your account settings.
                    </p>
                    <p className="prompt-urgency">
                        This is required to access {roleNames.toLowerCase()} features.
                    </p>
                </div>
                <button
                    onClick={handleNavigateToSettings}
                    className="setup-button"
                >
                    Set Up Two-Factor Authentication
                </button>
            </div>
        </div>
    );
};

export default TwoFactorAuthPrompt;