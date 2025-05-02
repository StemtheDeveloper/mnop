import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useUser } from '../context/UserContext';
import twoFactorAuthService from '../services/twoFactorAuthService';
import "../styles/TwoFactorAuth.css";

/**
 * Component for setting up two-factor authentication
 * Allows users to enroll in 2FA with their phone number
 */
const TwoFactorAuthSetup = () => {
    const navigate = useNavigate();
    const { currentUser, twoFactorStatus, setupTwoFactorAuth, disableTwoFactorAuth } = useUser();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [step, setStep] = useState('phone'); // phone -> verify -> success
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check auth state when component mounts
    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
            setAuthChecked(true);
        });

        return () => unsubscribe();
    }, []);

    // Format and validate phone number
    const formatPhoneNumber = (value) => {
        // Remove all non-numeric characters
        const numericValue = value.replace(/\D/g, '');

        // Format as international number if it doesn't start with '+'
        if (!value.startsWith('+') && numericValue.length > 0) {
            return `+${numericValue}`;
        }

        return value;
    };

    const handlePhoneNumberChange = (e) => {
        setPhoneNumber(formatPhoneNumber(e.target.value));
    };

    const handleSendVerificationCode = async () => {
        // Basic validation
        if (!phoneNumber || phoneNumber.length < 10) {
            setError("Please enter a valid phone number");
            return;
        }

        // Check authentication status
        if (!isAuthenticated) {
            setError("You need to be signed in to enable two-factor authentication. Please sign in again.");
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            // Send verification code to the phone number
            const result = await twoFactorAuthService.sendVerificationCode(phoneNumber);

            if (result.success) {
                setVerificationId(result.data.verificationId);
                setStep('verify');
            } else {
                if (result.error && result.error.includes("not authenticated")) {
                    setError("Authentication error. Please sign out, sign in again, and then try setting up 2FA.");
                } else {
                    throw new Error(result.error || "Failed to send verification code");
                }
            }
        } catch (err) {
            console.error("Error sending verification code:", err);
            if (err.message && err.message.includes("not authenticated")) {
                setError("Authentication error. Please sign out, sign in again, and then try setting up 2FA.");
            } else {
                setError(err.message || "Failed to send verification code. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode || verificationCode.length < 6) {
            setError("Please enter the 6-digit verification code");
            return;
        }

        // Check authentication status again
        if (!isAuthenticated) {
            setError("You need to be signed in to verify the code. Please sign in again.");
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            // Verify the code and enroll the user in 2FA
            const result = await twoFactorAuthService.verifyPhoneAndEnroll(
                verificationId,
                verificationCode,
                phoneNumber
            );

            if (result.success) {
                // Update context with 2FA status
                await setupTwoFactorAuth(phoneNumber, true);
                setStep('success');
            } else {
                if (result.error && result.error.includes("not authenticated")) {
                    setError("Authentication error. Please sign out, sign in again, and then try setting up 2FA.");
                } else {
                    throw new Error(result.error || "Failed to verify code");
                }
            }
        } catch (err) {
            console.error("Error verifying code:", err);
            if (err.message && err.message.includes("not authenticated")) {
                setError("Authentication error. Please sign out, sign in again, and then try setting up 2FA.");
            } else {
                setError(err.message || "Verification failed. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisable2FA = async () => {
        setIsLoading(true);
        setError('');

        try {
            const result = await disableTwoFactorAuth();

            if (result.success) {
                // Reset state
                setPhoneNumber('');
                setVerificationCode('');
                setVerificationId('');
                setStep('phone');
            } else {
                throw new Error(result.error || "Failed to disable two-factor authentication");
            }
        } catch (err) {
            console.error("Error disabling 2FA:", err);
            setError(err.message || "Failed to disable two-factor authentication");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = () => {
        navigate('/signin?action=refresh', { state: { message: "Please sign in again to set up two-factor authentication" } });
    };

    // If we haven't checked auth state yet, show nothing
    if (!authChecked) {
        return null;
    }

    return (
        <div className="two-factor-setup">
            <h2>Two-Factor Authentication</h2>

            {/* Show current status */}
            <div className={`status-indicator ${twoFactorStatus.enabled ? 'status-enabled' : 'status-disabled'}`}>
                {twoFactorStatus.enabled
                    ? "Two-factor authentication is enabled"
                    : "Two-factor authentication is disabled"}
            </div>

            {!isAuthenticated && (
                <div className="auth-notice">
                    <p>
                        <strong>Authentication Required:</strong> You need to be signed in to manage two-factor authentication.
                    </p>
                    <button onClick={handleSignOut} className="btn-primary">
                        Sign In Again
                    </button>
                </div>
            )}

            {isAuthenticated && twoFactorStatus.required && !twoFactorStatus.enabled && (
                <div className="required-notice">
                    <p>
                        <strong>Required for your role:</strong> As an admin or designer, two-factor authentication is required for your account.
                    </p>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {/* Show appropriate UI based on current setup state and 2FA status */}
            {isAuthenticated && !twoFactorStatus.enabled ? (
                <>
                    {step === 'phone' && (
                        <div className="setup-phone-section">
                            <p className="setup-instructions">
                                To enable two-factor authentication, please enter your phone number.
                                You'll receive a verification code via SMS.
                            </p>

                            <div className="phone-input-container">
                                <input
                                    type="tel"
                                    className="phone-input"
                                    placeholder="Enter phone number (e.g., +15551234567)"
                                    value={phoneNumber}
                                    onChange={handlePhoneNumberChange}
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                onClick={handleSendVerificationCode}
                                className="verify-button"
                                disabled={isLoading || !phoneNumber}
                            >
                                {isLoading ? "Sending..." : "Send Verification Code"}
                            </button>
                        </div>
                    )}

                    {step === 'verify' && (
                        <div className="verification-section">
                            <p className="verification-instructions">
                                Enter the 6-digit verification code sent to {phoneNumber}
                            </p>

                            <div className="verification-input-container">
                                <input
                                    type="text"
                                    className="verification-input"
                                    placeholder="Enter verification code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="verification-actions">
                                <button
                                    onClick={handleVerifyCode}
                                    className="verify-button"
                                    disabled={isLoading || !verificationCode}
                                >
                                    {isLoading ? "Verifying..." : "Verify and Enable 2FA"}
                                </button>

                                <button
                                    onClick={() => setStep('phone')}
                                    className="cancel-button"
                                    disabled={isLoading}
                                >
                                    Back
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="success-section">
                            <div className="success-icon">✓</div>
                            <h3>Two-Factor Authentication Enabled</h3>
                            <p>
                                You've successfully set up two-factor authentication. You'll now need to verify
                                your phone number when signing in to your account.
                            </p>
                            <p className="security-note">
                                This adds an extra layer of security to your account.
                            </p>
                        </div>
                    )}
                </>
            ) : isAuthenticated && (
                <div className="management-section">
                    <h3>Manage Two-Factor Authentication</h3>
                    <p>
                        Your account is currently protected with two-factor authentication.
                    </p>
                    {twoFactorStatus.phoneNumber && (
                        <p className="phone-info">
                            Phone number: {twoFactorStatus.phoneNumber}
                        </p>
                    )}

                    <div className="management-actions">
                        {!twoFactorStatus.required && (
                            <button
                                onClick={handleDisable2FA}
                                className="disable-button"
                                disabled={isLoading}
                            >
                                {isLoading ? "Disabling..." : "Disable Two-Factor Authentication"}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TwoFactorAuthSetup;