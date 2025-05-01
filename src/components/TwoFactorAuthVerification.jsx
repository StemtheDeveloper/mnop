// filepath: c:\Users\GGPC\Desktop\mnop-app\src\components\TwoFactorAuthVerification.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import twoFactorAuthService from '../services/twoFactorAuthService';
import '../styles/TwoFactorAuth.css';

const TwoFactorAuthVerification = ({ mfaError, mfaResolver, onVerificationSuccess, onCancel }) => {
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCode, setBackupCode] = useState('');
    const [useBackupCode, setUseBackupCode] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // MFA verification references
    const verificationIdRef = useRef(null);
    const resolverRef = useRef(mfaResolver);

    // Generate a unique ID for the recaptcha container
    const recaptchaContainerId = useRef('recaptcha-container-verification-' + Math.random().toString(36).substring(2, 11));

    // Cleanup function on unmount
    useEffect(() => {
        return () => {
            // Cleanup will happen automatically with Firebase
        };
    }, []);

    // Initialize verification on mount
    useEffect(() => {
        if (mfaError && !codeSent) {
            initializeMfaVerification();
        }
    }, [mfaError]);

    // Handle countdown timer
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const initializeMfaVerification = async () => {
        setLoading(true);
        setError('');

        try {
            // Initialize MFA verification using the resolver from the auth error
            const result = await twoFactorAuthService.handleMfaRequired(
                mfaError,
                recaptchaContainerId.current
            );

            if (result.success) {
                // Store verification details
                verificationIdRef.current = result.verificationId;
                resolverRef.current = result.resolver;
                setCodeSent(true);
                setCountdown(60); // 60 second cooldown
            } else {
                setError(result.error || 'Failed to start verification');
            }
        } catch (error) {
            console.error('Error initializing MFA verification:', error);
            setError('Failed to start verification. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setLoading(true);
        setError('');

        try {
            // Re-initialize the MFA verification
            await initializeMfaVerification();
        } catch (error) {
            console.error('Error resending code:', error);
            setError('Failed to resend verification code');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setLoading(true);
        setError('');

        if (!verificationCode && !useBackupCode) {
            setError('Please enter the verification code');
            setLoading(false);
            return;
        }

        if (useBackupCode && !backupCode) {
            setError('Please enter a backup code');
            setLoading(false);
            return;
        }

        try {
            if (useBackupCode) {
                // Verify using backup code
                // For backup codes, we'd need the userId
                const { currentUser } = useUser();
                if (!currentUser || !currentUser.uid) {
                    throw new Error('User information not available');
                }

                const result = await twoFactorAuthService.verifyBackupCode(
                    currentUser.uid,
                    backupCode
                );

                if (result.success) {
                    if (onVerificationSuccess) {
                        onVerificationSuccess();
                    }
                } else {
                    setError(result.error || 'Invalid backup code');
                }
            } else {
                // Verify using SMS code with Firebase MFA
                if (!verificationIdRef.current || !resolverRef.current) {
                    throw new Error('Verification session expired. Please try again.');
                }

                const result = await twoFactorAuthService.completeMfaSignIn(
                    resolverRef.current,
                    verificationIdRef.current,
                    verificationCode
                );

                if (result.success) {
                    if (onVerificationSuccess) {
                        onVerificationSuccess(result.credential);
                    }
                } else {
                    setError(result.error || 'Invalid verification code');
                }
            }
        } catch (error) {
            console.error('Error during verification:', error);
            setError('An error occurred during verification. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleUseBackupCode = () => {
        setUseBackupCode(!useBackupCode);
        setError('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleVerify();
        }
    };

    return (
        <div className="two-factor-verification">
            <h2>Two-Factor Authentication</h2>

            <p className="verification-instructions">
                {useBackupCode
                    ? 'Enter one of your backup codes to sign in.'
                    : 'Enter the verification code sent to your phone.'}
            </p>

            {!useBackupCode ? (
                <div className="verification-input-container">
                    {/* Visible reCAPTCHA container */}
                    <div
                        id={recaptchaContainerId.current}
                        className="recaptcha-container"
                        style={{ marginBottom: '10px', minHeight: '70px', width: '100%' }}
                    ></div>

                    <input
                        type="text"
                        placeholder="Enter verification code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.trim())}
                        onKeyDown={handleKeyDown}
                        className="verification-input"
                        autoFocus
                    />
                    {codeSent && countdown === 0 && (
                        <button
                            onClick={handleResendCode}
                            className="resend-code-button"
                            disabled={loading}
                        >
                            Resend Code
                        </button>
                    )}
                    {countdown > 0 && (
                        <div className="countdown-timer">
                            Resend in {countdown}s
                        </div>
                    )}
                </div>
            ) : (
                <div className="verification-input-container">
                    <input
                        type="text"
                        placeholder="Enter backup code (XXXXX-XXXXX)"
                        value={backupCode}
                        onChange={(e) => setBackupCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="verification-input"
                        autoFocus
                    />
                </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <div className="verification-actions">
                <button
                    onClick={handleVerify}
                    disabled={loading || (!useBackupCode && !verificationCode) || (useBackupCode && !backupCode)}
                    className="verify-button"
                >
                    {loading ? 'Verifying...' : 'Verify'}
                </button>

                <button
                    onClick={toggleUseBackupCode}
                    className="toggle-backup-button"
                >
                    {useBackupCode ? 'Use text message code instead' : 'Use a backup code instead'}
                </button>

                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="cancel-button"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};

export default TwoFactorAuthVerification;