import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import TwoFactorAuthSetup from '../components/TwoFactorAuthSetup';
import '../styles/UserSettings.css';

const UserSettingsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useUser();

    // Default to security tab if coming from 2FA prompt
    const defaultTab = location.state?.defaultTab || 'security';
    const [activeTab, setActiveTab] = useState(defaultTab);

    // Redirect message from other components (e.g., TwoFactorAuthGuard)
    const message = location.state?.message;
    const returnPath = location.state?.from;

    if (!currentUser) {
        return (
            <div className="settings-page">
                <div className="settings-container">
                    <h2>Settings</h2>
                    <p>Please sign in to access your account settings.</p>
                    <button
                        className="settings-button"
                        onClick={() => navigate('/signin', { state: { from: '/settings' } })}
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <div className="settings-container">
                <h1>Account Settings</h1>

                {message && (
                    <div className="settings-message">
                        <p>{message}</p>
                        {returnPath && (
                            <p className="return-link">
                                You will be returned to <strong>{returnPath}</strong> after setup.
                            </p>
                        )}
                    </div>
                )}

                {/* Settings tabs */}
                <div className="settings-tabs">
                    <button
                        className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        Profile
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        Security
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notifications')}
                    >
                        Notifications
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
                        onClick={() => setActiveTab('preferences')}
                    >
                        Preferences
                    </button>
                </div>

                {/* Tab content */}
                <div className="tab-content">
                    {activeTab === 'profile' && (
                        <div className="profile-settings">
                            <h2>Profile Settings</h2>
                            <p>Update your profile information here.</p>
                            {/* Profile settings form would go here */}
                            <div className="placeholder-content">
                                <p>Profile settings functionality will be implemented soon.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="security-settings">
                            <h2>Security Settings</h2>

                            {/* Two-Factor Authentication */}
                            <div className="security-section">
                                <TwoFactorAuthSetup />
                            </div>

                            {/* Password section */}
                            <div className="security-section">
                                <h3>Password</h3>
                                <p>Update your password or set up password recovery options.</p>
                                {/* Password update functionality would go here */}
                                <div className="placeholder-content">
                                    <p>Password management functionality will be implemented soon.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="notification-settings">
                            <h2>Notification Settings</h2>
                            <p>Manage how you receive notifications.</p>
                            {/* Notification settings would go here */}
                            <div className="placeholder-content">
                                <p>Notification settings functionality will be implemented soon.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preferences' && (
                        <div className="preference-settings">
                            <h2>Preferences</h2>
                            <p>Set your account preferences.</p>
                            {/* Preference settings would go here */}
                            <div className="placeholder-content">
                                <p>User preferences functionality will be implemented soon.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Return button when coming from another page */}
                {returnPath && (
                    <div className="return-section">
                        <button
                            className="return-button"
                            onClick={() => navigate(returnPath)}
                        >
                            Return to Previous Page
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserSettingsPage;
