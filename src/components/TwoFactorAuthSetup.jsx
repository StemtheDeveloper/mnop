// filepath: c:\Users\GGPC\Desktop\mnop-app\src\components\TwoFactorAuthSetup.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import twoFactorAuthService from '../services/twoFactorAuthService';
import { resetVerifier, getVerifier } from '../services/recaptchaSingleton';
import '../styles/TwoFactorAuth.css';

const TwoFactorAuthSetup = ({ onSetupComplete }) => {
    const { currentUser } = useUser();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // For reauthentication
    const [needsReauth, setNeedsReauth] = useState(false);
    const [password, setPassword] = useState('');

    // Reference to store the verification ID needed for enrollment
    const verificationIdRef = useRef(null);
    const countdownTimerRef = useRef(null);

    // Initialize recaptcha on mount
    useEffect(() => {
        // Ensure the reCAPTCHA is initialized early
        try {
            getVerifier();
            console.log("reCAPTCHA initialized on component mount");
        } catch (err) {
            console.error("Failed to initialize reCAPTCHA:", err);
        }

        return () => {
            // Clean up any timers when component unmounts
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, []);

    // Handle countdown timer with useEffect
    useEffect(() => {
        if (countdown > 0) {
            countdownTimerRef.current = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);

            return () => {
                clearInterval(countdownTimerRef.current);
            };
        } else if (countdown === 0) {
            clearInterval(countdownTimerRef.current);
        }
    }, [countdown]);

    // Format phone number as user types (support both US and NZ formats)
    const handlePhoneNumberChange = (e) => {
        const input = e.target.value.replace(/\D/g, '');
        let formatted = '';

        // Check for NZ number (starting with 02)
        if (input.startsWith('02')) {
            // Format as NZ mobile
            if (input.length > 0) {
                formatted = `(${input.substring(0, 2)})`;
                if (input.length > 2) {
                    formatted += ` ${input.substring(2, 5)}`;
                    if (input.length > 5) {
                        formatted += `-${input.substring(5, 10)}`;
                    }
                }
            }
        } else {
            // Use US format as fallback
            if (input.length > 0) {
                formatted = `(${input.substring(0, 3)}`;
                if (input.length > 3) {
                    formatted += `) ${input.substring(3, 6)}`;
                    if (input.length > 6) {
                        formatted += `-${input.substring(6, 10)}`;
                    }
                }
            }
        }

        setPhoneNumber(input.length > 0 ? formatted : '');
    };

    // Get raw phone number without formatting
    const getRawPhoneNumber = () => {
        return phoneNumber.replace(/\D/g, '');
    };

    // Handle reauthentication
    const handleReauthenticate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Reauthenticate with Firebase
            const credential = EmailAuthProvider.credential(
                currentUser.email,
                password
            );

            await reauthenticateWithCredential(currentUser, credential);

            // Successfully reauthenticated
            setNeedsReauth(false);
            setPassword('');

            // Continue with the send code process
            await sendVerificationCode();
        } catch (error) {
            console.error('Reauthentication error:', error);
            setError(error.message || 'Incorrect password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Send verification code to user's phone
    const sendVerificationCode = async () => {
        setLoading(true);
        setError('');

        const rawPhoneNumber = getRawPhoneNumber();
        console.log("Raw phone number:", rawPhoneNumber);

        // Special validation for NZ numbers
        if (rawPhoneNumber.startsWith('02')) {
            // For NZ mobile numbers (starting with 02), validate as 9 or 10 digits
            if (rawPhoneNumber.length < 9 || rawPhoneNumber.length > 10) {
                setError('Please enter a valid New Zealand mobile number');
                setLoading(false);
                return;
            }
            // Valid NZ mobile number
            console.log("Valid NZ number detected");
        } else if (rawPhoneNumber.length !== 10) {
            // For other numbers, require exactly 10 digits
            setError('Please enter a valid 10-digit phone number');
            setLoading(false);
            return;
        }

        try {
            // Reset the reCAPTCHA verifier before proceeding
            resetVerifier();

            let formattedPhone;

            // Format phone number with appropriate country code
            if (rawPhoneNumber.startsWith('02')) {
                // New Zealand format: +64 + number without leading 0
                formattedPhone = `+64${rawPhoneNumber.substring(1)}`;
                console.log("Using NZ phone format:", formattedPhone);
            } else {
                // US format
                formattedPhone = `+1${rawPhoneNumber}`;
                console.log("Using US phone format:", formattedPhone);
            }

            // Enroll with Firebase MFA
            const result = await twoFactorAuthService.enrollWithPhoneNumber(
                currentUser,
                formattedPhone
            );

            if (result.success) {
                // Store the verification ID for later use
                console.log("Verification successful, ID stored");
                verificationIdRef.current = result.verificationId;
                setCodeSent(true);

                // Start a 60-second countdown before showing resend option
                setCountdown(60);
            } else if (result.requiresReauth || (result.error && result.error.includes('requires-recent-login'))) {
                console.log("Recent authentication required");
                setNeedsReauth(true);
            } else {
                console.error("Verification failed:", result.error);
                setError(result.error || 'Failed to send verification code');
            }
        } catch (error) {
            console.error('Error sending verification code:', error);
            if (error.code === 'auth/requires-recent-login') {
                setNeedsReauth(true);
            } else {
                setError(`Error: ${error.message || 'An error occurred sending the verification code. Please try again.'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendCode = async () => {
        // Check if we need to reauthenticate first
        if (needsReauth) {
            return;
        }

        // Otherwise proceed with sending the code
        await sendVerificationCode();
    };

    const handleVerify = async () => {
        setLoading(true);
        setError('');

        if (!verificationCode) {
            setError('Please enter the verification code');
            setLoading(false);
            return;
        }

        try {
            if (!verificationIdRef.current) {
                throw new Error('Verification session expired. Please request a new code.');
            }

            // Complete enrollment with Firebase MFA
            const result = await twoFactorAuthService.completeEnrollment(
                currentUser,
                verificationIdRef.current,
                verificationCode
            );

            if (result.success) {
                // Generate backup codes
                const newBackupCodes = twoFactorAuthService.generateBackupCodes();
                setBackupCodes(newBackupCodes);

                // Save backup codes
                await twoFactorAuthService.saveBackupCodes(
                    currentUser.uid,
                    newBackupCodes
                );

                // Update phone number in user profile
                await twoFactorAuthService.updateUserMfaStatus(
                    currentUser.uid,
                    true,
                    true
                );

                // Move to next step
                setStep(2);
            } else {
                setError(result.error || 'Invalid verification code. Please try again.');
            }
        } catch (error) {
            console.error('Error verifying code:', error);
            setError('Failed to verify the code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        if (onSetupComplete) {
            onSetupComplete();
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                alert('Copied to clipboard');
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    };

    const copyBackupCodes = () => {
        const codesText = backupCodes.join('\n');
        copyToClipboard(codesText);
    };

    // Render reauthentication form
    if (needsReauth) {
        return (
            <div className="two-factor-setup">
                <h2>Authentication Required</h2>
                <p>
                    For security reasons, please re-enter your password to continue setting up
                    two-factor authentication.
                </p>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleReauthenticate} className="reauth-form">
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="verify-button"
                    >
                        {loading ? 'Verifying...' : 'Continue'}
                    </button>
                </form>
            </div>
        );
    }

    if (loading && step === 1 && !codeSent) {
        return <div className="two-factor-loading">Setting up two-factor authentication...</div>;
    }

    return (
        <div className="two-factor-setup">
            {step === 1 ? (
                <>
                    <h2>Set Up Two-Factor Authentication</h2>
                    <p className="setup-instructions">
                        Two-factor authentication adds an extra layer of security to your account.
                        Every time you sign in, we'll send a verification code to your phone
                        in addition to requiring your password.
                    </p>

                    <div className="phone-setup-section">
                        <h3>Step 1: Enter your phone number</h3>
                        <div className="phone-input-container">
                            <input
                                type="tel"
                                placeholder="(123) 456-7890"
                                value={phoneNumber}
                                onChange={handlePhoneNumberChange}
                                className="phone-input"
                                disabled={codeSent}
                            />

                            {!codeSent && (
                                <button
                                    onClick={handleSendCode}
                                    disabled={loading || (getRawPhoneNumber().length < 9)}
                                    className="send-code-button"
                                >
                                    {loading ? 'Sending...' : 'Send Code'}
                                </button>
                            )}
                        </div>

                        {codeSent && (
                            <div className="verification-section">
                                <h3>Step 2: Enter the verification code</h3>
                                <p>
                                    We've sent a verification code to your phone number. Enter it below
                                    to verify your phone.
                                </p>
                                <div className="code-input-container">
                                    <input
                                        type="text"
                                        placeholder="Enter verification code"
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value.trim())}
                                        className="verification-input"
                                        autoFocus
                                    />

                                    {countdown === 0 ? (
                                        <button
                                            onClick={handleSendCode}
                                            className="resend-code-button"
                                            disabled={loading}
                                        >
                                            Resend Code
                                        </button>
                                    ) : (
                                        <div className="countdown-timer">
                                            Resend in {countdown}s
                                        </div>
                                    )}
                                </div>

                                {error && <div className="error-message">{error}</div>}

                                <button
                                    onClick={handleVerify}
                                    disabled={loading || !verificationCode.trim()}
                                    className="verify-button"
                                >
                                    {loading ? 'Verifying...' : 'Verify & Enable'}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="backup-codes-section">
                    <h2>Two-Factor Authentication Enabled!</h2>
                    <p>
                        Your account is now protected with two-factor authentication.
                        We'll send a verification code to your phone when you sign in.
                    </p>

                    <div className="backup-codes">
                        <h3>Backup Codes</h3>
                        <p>
                            If you lose access to your phone, you can use one of these backup codes to sign in.
                            Each code can only be used once. Keep these codes in a safe place!
                        </p>

                        <button
                            onClick={() => setShowBackupCodes(!showBackupCodes)}
                            className="toggle-codes-button"
                        >
                            {showBackupCodes ? 'Hide Backup Codes' : 'Show Backup Codes'}
                        </button>

                        {showBackupCodes && (
                            <>
                                <div className="backup-codes-grid">
                                    {backupCodes.map((code, index) => (
                                        <div key={index} className="backup-code">
                                            {code}
                                        </div>
                                    ))}
                                </div>
                                <button onClick={copyBackupCodes} className="copy-codes-button">
                                    Copy All Codes
                                </button>
                            </>
                        )}
                    </div>

                    <div className="finish-section">
                        <p>
                            You've successfully set up two-factor authentication. From now on, you'll
                            need to provide a verification code sent to your phone when signing in.
                        </p>
                        <button onClick={handleFinish} className="finish-button">
                            Finish Setup
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TwoFactorAuthSetup;