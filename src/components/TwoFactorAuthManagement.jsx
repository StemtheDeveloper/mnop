// filepath: c:\Users\GGPC\Desktop\mnop-app\src\components\TwoFactorAuthManagement.jsx
import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import twoFactorAuthService from '../services/twoFactorAuthService';
import TwoFactorAuthSetup from './TwoFactorAuthSetup';
import '../styles/TwoFactorAuth.css';

const TwoFactorAuthManagement = ({ initialShowSetup = false }) => {
    const { currentUser, userRoles, refreshUserData } = useUser();
    const [twoFactorStatus, setTwoFactorStatus] = useState({
        enabled: false,
        verified: false,
        phoneNumber: null,
        backupCodesGenerated: false
    });
    const [showSetup, setShowSetup] = useState(initialShowSetup);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const is2FARequired = twoFactorAuthService.is2FARequiredForRoles(userRoles);

    // Update showSetup if initialShowSetup changes
    useEffect(() => {
        setShowSetup(initialShowSetup);
    }, [initialShowSetup]);

    useEffect(() => {
        if (currentUser) {
            fetchTwoFactorStatus();
        }
    }, [currentUser]);

    const fetchTwoFactorStatus = async () => {
        setLoading(true);

        try {
            const result = await twoFactorAuthService.get2FAStatus(currentUser.uid);

            if (result.success) {
                setTwoFactorStatus(result.data);

                // Auto-show setup if 2FA is required but not enabled
                if (is2FARequired && !result.data.enabled && !showSetup) {
                    setShowSetup(true);
                }
            } else {
                setError(result.error || 'Failed to get two-factor authentication status');
            }
        } catch (error) {
            console.error('Error fetching 2FA status:', error);
            setError('An error occurred while checking two-factor authentication status');
        } finally {
            setLoading(false);
        }
    };

    const handleDisable2FA = async () => {
        if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
            return;
        }

        if (is2FARequired) {
            setError('Two-factor authentication is required for your account due to your role.');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const result = await twoFactorAuthService.disable2FA(currentUser.uid);

            if (result.success) {
                setMessage('Two-factor authentication has been disabled');
                await fetchTwoFactorStatus();
                await refreshUserData();
            } else {
                setError(result.error || 'Failed to disable two-factor authentication');
            }
        } catch (error) {
            console.error('Error disabling 2FA:', error);
            setError('An error occurred while disabling two-factor authentication');
        } finally {
            setLoading(false);
        }
    };

    const handleSetupComplete = async () => {
        setShowSetup(false);
        await fetchTwoFactorStatus();
        await refreshUserData();
        setMessage('Two-factor authentication has been successfully set up!');
    };

    if (loading && !twoFactorStatus.enabled && !showSetup) {
        return <div className="two-factor-loading">Loading two-factor authentication status...</div>;
    }

    if (showSetup) {
        return <TwoFactorAuthSetup onSetupComplete={handleSetupComplete} />;
    }

    // Format phone number for display
    const formatPhoneNumber = (number) => {
        if (!number) return '';
        const cleaned = ('' + number).replace(/\D/g, '');
        if (cleaned.length !== 10) return number;
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    };

    return (
        <div className="two-factor-management">
            <h2>Two-Factor Authentication</h2>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <div className="status-section">
                <p>
                    Status:
                    <span className={`status-indicator ${twoFactorStatus.enabled ? 'status-enabled' : 'status-disabled'}`}>
                        {twoFactorStatus.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </p>

                {twoFactorStatus.enabled && twoFactorStatus.phoneNumber && (
                    <p className="phone-info">
                        Verification codes will be sent to: {formatPhoneNumber(twoFactorStatus.phoneNumber)}
                    </p>
                )}

                {is2FARequired && !twoFactorStatus.enabled && (
                    <div className="required-notice">
                        <p>
                            <strong>Important:</strong> Two-factor authentication is required for your account
                            due to your {userRoles.includes('admin') ? 'administrator' : 'designer'} role.
                        </p>
                        <p>Please set up two-factor authentication to enhance your account security.</p>
                    </div>
                )}

                <p className="security-info">
                    Two-factor authentication adds an extra layer of security to your account.
                    When enabled, you'll need to provide a verification code sent to your phone
                    every time you sign in, in addition to your password.
                </p>
            </div>

            <div className="management-actions">
                {twoFactorStatus.enabled ? (
                    <button
                        onClick={handleDisable2FA}
                        className="disable-button"
                        disabled={loading || is2FARequired}
                    >
                        {loading ? 'Processing...' : 'Disable Two-Factor Authentication'}
                    </button>
                ) : (
                    <button
                        onClick={() => setShowSetup(true)}
                        className="setup-button"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Set Up Two-Factor Authentication'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TwoFactorAuthManagement;