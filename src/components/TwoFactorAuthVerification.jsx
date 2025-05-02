import React, { useState, useEffect } from 'react';
import { PhoneAuthProvider } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import twoFactorAuthService from '../services/twoFactorAuthService';
import "../styles/TwoFactorAuth.css";

/**
 * Component for handling two-factor authentication verification
 * Used during sign-in when 2FA is enabled for a user
 */
const TwoFactorAuthVerification = ({
    userId,
    phoneNumber,
    mfaError,
    mfaResolver,
    onVerificationSuccess,
    onCancel
}) => {
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState('');
    const [isCodeSent, setIsCodeSent] = useState(false);
    const [verificationId, setVerificationId] = useState('');

    // Format phone number for display (show only last 4 digits)
    const formatPhoneNumber = (number) => {
        if (!number) return '';
        return number.replace(/^(.*)(\d{4})$/, '••• •••• $2');
    };

    // Initialize when component mounts
    useEffect(() => {
        // If we have an MFA resolver from Firebase, we're in the MFA resolution flow
        // No need to send code, Firebase has already handled this
        if (mfaResolver) {
            setIsCodeSent(true);
        }
    }, [mfaResolver]);

    const handleSendCode = async () => {
        if (!phoneNumber) {
            setError("Phone number is missing");
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            // Send verification code to the user's phone
            const result = await twoFactorAuthService.sendVerificationCode(phoneNumber);

            if (result.success) {
                setIsCodeSent(true);
                setVerificationId(result.data.verificationId);
            } else {
                setError(result.error || "Failed to send verification code");
            }
        } catch (err) {
            console.error("Error sending verification code:", err);
            setError("Failed to send verification code. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode) {
            setError("Please enter the verification code");
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            // Handle MFA resolution flow
            if (mfaResolver) {
                const result = await twoFactorAuthService.verifySignInCode(
                    mfaResolver,
                    verificationCode
                );

                if (result.success) {
                    // Pass the credential back to the parent component
                    onVerificationSuccess(result.credential);
                } else {
                    setError(result.error || "Verification failed");
                }
            }
            // Handle standard verification flow
            else if (verificationId) {
                // In this flow, we need to sign in again after verification
                const credential = PhoneAuthProvider.credential(
                    verificationId,
                    verificationCode
                );

                // Phone number verified successfully, now handle sign-in manually
                onVerificationSuccess();
            } else {
                setError("Verification session expired. Please try signing in again.");
            }
        } catch (err) {
            console.error("Error verifying code:", err);
            setError(err.message || "Failed to verify code. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="two-factor-verification">
            <h2>Two-Factor Authentication</h2>
            <p className="verification-instructions">
                Please enter the verification code sent to your phone
                {phoneNumber && <span className="phone-hint"> ({formatPhoneNumber(phoneNumber)})</span>}
                {!isCodeSent && !mfaResolver && " after clicking 'Send Code'"}
            </p>

            {error && <div className="error-message">{error}</div>}

            <div className="verification-section">
                {/* Conditionally render the send code button if code hasn't been sent and we're not in MFA resolution */}
                {!isCodeSent && !mfaResolver && (
                    <>
                        <button
                            onClick={handleSendCode}
                            className="verify-button"
                            disabled={isVerifying}
                        >
                            {isVerifying ? "Sending..." : "Send Verification Code"}
                        </button>
                    </>
                )}

                {/* Verification code input */}
                {(isCodeSent || mfaResolver) && (
                    <>
                        <div className="verification-input-container">
                            <input
                                type="text"
                                className="verification-input"
                                placeholder="Enter verification code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                autoComplete="one-time-code"
                                maxLength={6}
                                disabled={isVerifying}
                            />
                        </div>

                        <div className="verification-actions">
                            <button
                                onClick={handleVerifyCode}
                                className="verify-button"
                                disabled={isVerifying || !verificationCode}
                            >
                                {isVerifying ? "Verifying..." : "Verify"}
                            </button>

                            <button
                                onClick={onCancel}
                                className="cancel-button"
                                disabled={isVerifying}
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>

            <p className="verification-note">
                If you don't receive a code within 1 minute, please check your phone number and try again.
            </p>
        </div>
    );
};

export default TwoFactorAuthVerification;