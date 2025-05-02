import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import '../../styles/AdminTools.css';

const SecuritySettingsPanel = () => {
    const [settings, setSettings] = useState({
        requireTwoFactorAuth: true,
        requiredRoles: ['admin', 'designer']
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    // Available roles that can require 2FA
    const availableRoles = [
        { id: 'admin', name: 'Administrator' },
        { id: 'designer', name: 'Designer' },
        { id: 'manufacturer', name: 'Manufacturer' },
        { id: 'investor', name: 'Investor' },
    ];

    // Fetch current security settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsRef = doc(db, 'settings', 'securitySettings');
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setSettings({
                        requireTwoFactorAuth: data.requireTwoFactorAuth ?? true,
                        requiredRoles: data.requiredRoles ?? ['admin', 'designer']
                    });
                }
            } catch (err) {
                console.error('Error fetching security settings:', err);
                setError('Failed to load security settings');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // Toggle 2FA requirement
    const toggleTwoFactorRequirement = () => {
        setSettings(prev => ({
            ...prev,
            requireTwoFactorAuth: !prev.requireTwoFactorAuth
        }));
    };

    // Toggle role requirement
    const toggleRoleRequirement = (roleId) => {
        setSettings(prev => {
            const currentRoles = [...prev.requiredRoles];

            if (currentRoles.includes(roleId)) {
                // Don't allow removing all roles - keep at least one
                if (currentRoles.length > 1) {
                    return {
                        ...prev,
                        requiredRoles: currentRoles.filter(id => id !== roleId)
                    };
                }
                return prev;
            } else {
                return {
                    ...prev,
                    requiredRoles: [...currentRoles, roleId]
                };
            }
        });
    };

    // Save settings
    const saveSettings = async () => {
        setSaving(true);
        setError(null);
        setSuccess('');

        try {
            const settingsRef = doc(db, 'settings', 'securitySettings');
            await setDoc(settingsRef, {
                ...settings,
                updatedAt: new Date()
            });

            setSuccess('Security settings saved successfully');
        } catch (err) {
            console.error('Error saving security settings:', err);
            setError('Failed to save security settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="loading-container">Loading security settings...</div>;
    }

    return (
        <div className="admin-settings-panel security-settings-panel">
            <h3>Security Settings</h3>

            {error && <div className="admin-error-message">{error}</div>}
            {success && <div className="admin-success-message">{success}</div>}

            <div className="settings-card">
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Two-Factor Authentication</h4>
                        <p>Require two-factor authentication for certain user roles</p>
                    </div>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={settings.requireTwoFactorAuth}
                            onChange={toggleTwoFactorRequirement}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>

                {settings.requireTwoFactorAuth && (
                    <div className="roles-section">
                        <h4>Required Roles</h4>
                        <p>Select which roles require two-factor authentication:</p>

                        <div className="role-checkboxes">
                            {availableRoles.map(role => (
                                <div key={role.id} className="role-checkbox">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.requiredRoles.includes(role.id)}
                                            onChange={() => toggleRoleRequirement(role.id)}
                                            disabled={
                                                settings.requiredRoles.length === 1 &&
                                                settings.requiredRoles.includes(role.id)
                                            }
                                        />
                                        {role.name}
                                    </label>
                                </div>
                            ))}
                        </div>

                        {settings.requiredRoles.length === 1 && (
                            <p className="note">At least one role must require two-factor authentication.</p>
                        )}
                    </div>
                )}

                <div className="form-actions">
                    <button
                        className="save-button"
                        onClick={saveSettings}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            <div className="admin-info-box">
                <h3>Security Information</h3>
                <ul>
                    <li>Two-factor authentication adds an additional layer of security by requiring a verification code sent to the user's phone.</li>
                    <li>When enabled, users with the selected roles will be prompted to set up 2FA.</li>
                    <li>Users can still enable 2FA for their accounts even if it's not required for their role.</li>
                    <li>Changes to these settings will take effect immediately for new logins.</li>
                </ul>
            </div>
        </div>
    );
};

export default SecuritySettingsPanel;