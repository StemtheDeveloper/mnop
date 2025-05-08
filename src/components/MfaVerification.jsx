import React, { useState, useEffect, useRef } from 'react';
import twoFactorAuthService from '../services/twoFactorAuthService';
import LoadingSpinner from './LoadingSpinner';
import '../styles/MfaVerification.css';

const MfaVerification = ({ error, onSuccess, onCancel }) => {
    const [step, setStep] = useState('select-factor');
    const [selectedFactorIndex, setSelectedFactorIndex] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [mfaInfo, setMfaInfo] = useState(null);
    const [recaptchaInitialized, setRecaptchaInitialized] = useState(false);
    const recaptchaContainerRef = useRef(null);

    useEffect(() => {
        if (!error || (error.code !== 'auth/multi-factor-required' && error.code !== 'auth/multi-factor-auth-required')) {
            return;
        }

        try {
            console.log("Processing MFA error:", error.code);

            // Process the MFA error and get information about enrolled factors
            const info = twoFactorAuthService.handleMfaRequired(error);
            console.log("MFA info retrieved:", {
                hasHints: Array.isArray(info.hints),
                hintsCount: Array.isArray(info.hints) ? info.hints.length : 0,
                hasSession: !!info.session
            });

            setMfaInfo(info);

            // Initialize reCAPTCHA with a slight delay to ensure DOM is ready
            const initRecaptcha = async () => {
                // Small delay to ensure the DOM element is rendered
                setTimeout(async () => {
                    try {
                        if (!recaptchaContainerRef.current) {
                            console.error('reCAPTCHA container ref is not available');
                            return;
                        }

                        await twoFactorAuthService.initRecaptchaVerifier('recaptcha-container-verification', true);
                        setRecaptchaInitialized(true);
                        console.log("reCAPTCHA initialized successfully for MFA verification");
                    } catch (error) {
                        console.error('Error initializing reCAPTCHA:', error);
                        setMessage({
                            type: 'error',
                            text: 'Failed to initialize verification system. Please refresh the page and try again.'
                        });
                    }
                }, 500); // 500ms delay to ensure DOM is ready
            };

            initRecaptcha();
        } catch (e) {
            console.error('Error handling MFA required:', e);
            setMessage({
                type: 'error',
                text: 'Error preparing verification: ' + (e.message || 'Unknown error')
            });
        }

        // Clean up reCAPTCHA on unmount
        return () => {
            try {
                const recaptchaVerifier = twoFactorAuthService.getRecaptchaVerifier();
                if (recaptchaVerifier) {
                    recaptchaVerifier.clear();
                }
            } catch (e) {
                console.warn('Error cleaning up reCAPTCHA:', e);
            }
        };
    }, [error]);

    // Format phone number for display
    const formatPhoneForDisplay = (phoneNumber) => {
        if (!phoneNumber) return 'Unknown';

        // If it's a full number like +1234567890, mask the middle part
        if (phoneNumber.length > 7) {
            const start = phoneNumber.slice(0, 3);
            const end = phoneNumber.slice(-4);
            return `${start}•••••${end}`;
        }

        return phoneNumber;
    };

    // Handle factor selection
    const handleSelectFactor = async (index) => {
        setSelectedFactorIndex(index);
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await twoFactorAuthService.sendMfaSignInVerificationCode(index);
            setStep('enter-code');
            setMessage({
                type: 'success',
                text: `Verification code sent to ${formatPhoneForDisplay(mfaInfo.hints[index].phoneNumber)}`
            });
        } catch (error) {
            console.error('Error sending verification code:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Failed to send verification code. Please try again.'
            });
            setSelectedFactorIndex(null);
        } finally {
            setLoading(false);
        }
    };

    // Handle verification code submission
    const handleVerifyCode = async () => {
        if (!verificationCode.trim()) {
            setMessage({ type: 'error', text: 'Please enter the verification code' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const userCredential = await twoFactorAuthService.completeMfaSignIn(verificationCode);

            setMessage({
                type: 'success',
                text: 'Verification successful!'
            });

            // Notify parent component of successful verification
            if (onSuccess) {
                onSuccess(userCredential);
            }
        } catch (error) {
            console.error('Error verifying code:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Failed to verify code. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Handle cancel button click
    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    if (!mfaInfo || !mfaInfo.hints || mfaInfo.hints.length === 0) {
        return (
            <div className="mfa-verification">
                <div className="mfa-error">
                    <h2>Verification Error</h2>
                    <p>No verification methods available. Please contact support.</p>
                    <button onClick={handleCancel} className="btn-cancel">
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mfa-verification">
            <h2>Two-Factor Authentication</h2>
            <p className="mfa-description">
                Please complete the verification process to secure your account.
            </p>

            {/* Message display */}
            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* reCAPTCHA container */}
            <div id="recaptcha-container-verification" className="recaptcha-container" ref={recaptchaContainerRef}></div>

            {/* Loading spinner */}
            {loading && <LoadingSpinner />}

            {/* Step 1: Select a factor */}
            {step === 'select-factor' && !loading && (
                <div className="factor-selection">
                    <h3>Select Verification Method</h3>
                    <div className="factors-list">
                        {mfaInfo.hints.map((hint, index) => (
                            <button
                                key={index}
                                className="factor-option"
                                onClick={() => handleSelectFactor(index)}
                                disabled={!recaptchaInitialized}
                            >
                                <div className="factor-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                    </svg>
                                </div>
                                <div className="factor-details">
                                    <span className="factor-name">{hint.displayName || 'Phone'}</span>
                                    <span className="factor-info">{formatPhoneForDisplay(hint.phoneNumber)}</span>
                                </div>
                                <div className="factor-action">
                                    <span className="action-text">Send Code</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="action-icon">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </div>
                            </button>
                        ))}
                    </div>
                    <button onClick={handleCancel} className="btn-cancel">
                        Cancel
                    </button>
                </div>
            )}

            {/* Step 2: Enter verification code */}
            {step === 'enter-code' && !loading && (
                <div className="verification-code-step">
                    <h3>Enter Verification Code</h3>
                    <p>
                        We've sent a code to {mfaInfo.hints[selectedFactorIndex] &&
                            formatPhoneForDisplay(mfaInfo.hints[selectedFactorIndex].phoneNumber)}
                    </p>

                    <div className="code-input-container">
                        <input
                            type="text"
                            placeholder="123456"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            className="code-input"
                            autoFocus
                        />
                    </div>

                    <div className="verification-actions">
                        <button
                            onClick={() => setStep('select-factor')}
                            className="btn-back"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleVerifyCode}
                            className="btn-verify"
                            disabled={!verificationCode.trim()}
                        >
                            Verify
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MfaVerification;