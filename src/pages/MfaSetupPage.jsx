import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import twoFactorAuthService from '../services/twoFactorAuthService';
import LoadingSpinner from '../components/LoadingSpinner';


const MfaSetupPage = () => {
    const { currentUser } = useUser();
    const navigate = useNavigate();
    const recaptchaContainerRef = useRef(null);

    // State for the MFA setup process
    const [stage, setStage] = useState('initial');  // 'initial', 'collectPhone', 'collectCode', 'success', 'manage'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [enrolledFactors, setEnrolledFactors] = useState([]);
    const [recaptchaInitialized, setRecaptchaInitialized] = useState(false);

    // Initialize on component mount
    useEffect(() => {
        if (!currentUser) {
            navigate('/signin');
            return;
        }

        // Check if user already has MFA enrolled
        const checkMfa = () => {
            const mfaStatus = twoFactorAuthService.checkMfaEnrollment(currentUser);
            if (mfaStatus.enrolled) {
                setEnrolledFactors(mfaStatus.factors);
                setStage('manage');
            }
        };

        checkMfa();

        // Initialize reCAPTCHA with delay to ensure DOM is ready
        const initRecaptcha = async () => {
            try {
                // Clear any previous message
                setMessage({ type: '', text: '' });

                // Small delay to ensure the DOM is fully rendered
                setTimeout(() => {
                    if (document.getElementById('recaptcha-container')) {
                        twoFactorAuthService.initRecaptchaVerifier('recaptcha-container', true)
                            .then(() => {
                                console.log('reCAPTCHA initialized successfully');
                                setRecaptchaInitialized(true);
                            })
                            .catch(error => {
                                console.error('Error initializing reCAPTCHA:', error);
                                setMessage({
                                    type: 'error',
                                    text: 'Failed to initialize verification system. Please refresh the page and try again.'
                                });
                            });
                    } else {
                        console.error('reCAPTCHA container not found in DOM');
                    }
                }, 500);
            } catch (error) {
                console.error('Error in initRecaptcha:', error);
                setMessage({
                    type: 'error',
                    text: 'Failed to initialize verification system. Please refresh the page and try again.'
                });
            }
        };

        initRecaptcha();

        // Cleanup
        return () => {
            // Try to clean up reCAPTCHA if it exists
            try {
                const recaptchaVerifier = twoFactorAuthService.getRecaptchaVerifier();
                if (recaptchaVerifier) {
                    recaptchaVerifier.clear();
                }
            } catch (e) {
                console.warn('Error cleaning up reCAPTCHA:', e);
            }
        };
    }, [currentUser, navigate]);

    // Start MFA enrollment process
    const handleStartEnrollment = () => {
        setStage('collectPhone');
        setMessage({ type: '', text: '' });

        // Re-initialize reCAPTCHA if needed
        if (!recaptchaInitialized) {
            try {
                twoFactorAuthService.initRecaptchaVerifier('recaptcha-container', true)
                    .then(() => {
                        setRecaptchaInitialized(true);
                    })
                    .catch(error => {
                        console.error('Error re-initializing reCAPTCHA:', error);
                        setMessage({
                            type: 'error',
                            text: 'Could not initialize verification system. Please refresh the page.'
                        });
                    });
            } catch (error) {
                console.error('Error starting enrollment:', error);
            }
        }
    };

    // Send verification code to the phone number
    const handleSendVerificationCode = async () => {
        if (!phoneNumber.trim()) {
            setMessage({ type: 'error', text: 'Please enter a valid phone number' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await twoFactorAuthService.sendVerificationCodeForEnrollment(phoneNumber);
            setStage('collectCode');
            setMessage({
                type: 'success',
                text: `Verification code sent to ${phoneNumber}. Please enter the code below.`
            });
        } catch (error) {
            console.error('Error sending verification code:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Failed to send verification code. Please try again.'
            });

            // If the error is related to reCAPTCHA, try to reinitialize it
            if (error.message && (
                error.message.includes('reCAPTCHA') ||
                error.message.includes('Firebase Phone Auth')
            )) {
                try {
                    await twoFactorAuthService.initRecaptchaVerifier('recaptcha-container', true);
                    setRecaptchaInitialized(true);
                } catch (e) {
                    console.error('Failed to reinitialize reCAPTCHA:', e);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // Verify code and complete MFA enrollment
    const handleVerifyCode = async () => {
        if (!verificationCode.trim()) {
            setMessage({ type: 'error', text: 'Please enter the verification code' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await twoFactorAuthService.completeMfaEnrollment(verificationCode, 'My Phone');
            setStage('success');

            // Refresh enrolled factors
            const mfaStatus = twoFactorAuthService.checkMfaEnrollment(currentUser);
            setEnrolledFactors(mfaStatus.factors);

            setMessage({
                type: 'success',
                text: 'Two-factor authentication has been successfully enabled for your account!'
            });
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

    // Unenroll a factor
    const handleUnenrollFactor = async (factorUid) => {
        if (!window.confirm('Are you sure you want to remove this authentication factor?')) {
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await twoFactorAuthService.unenrollFactor(factorUid);

            // Refresh enrolled factors
            const mfaStatus = twoFactorAuthService.checkMfaEnrollment(currentUser);
            if (mfaStatus.enrolled) {
                setEnrolledFactors(mfaStatus.factors);
                setMessage({
                    type: 'success',
                    text: 'Authentication factor removed successfully.'
                });
            } else {
                setEnrolledFactors([]);
                setStage('initial');
                setMessage({
                    type: 'success',
                    text: 'Two-factor authentication has been disabled for your account.'
                });
            }
        } catch (error) {
            console.error('Error unenrolling factor:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Failed to remove authentication factor. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Add another factor
    const handleAddAnotherFactor = () => {
        setStage('collectPhone');
        setPhoneNumber('');
        setVerificationCode('');
        setMessage({ type: '', text: '' });
    };

    // Go back to management screen
    const handleGoToManage = () => {
        setStage('manage');
        setMessage({ type: '', text: '' });
    };

    // Format phone number hint
    const formatPhoneHint = (phoneInfo) => {
        if (!phoneInfo) return 'Unknown';

        // If it's a full number like +1234567890
        if (phoneInfo.length > 7) {
            // Mask the middle part of the number
            const start = phoneInfo.slice(0, 3);
            const end = phoneInfo.slice(-4);
            return `${start}•••••${end}`;
        }

        return phoneInfo;
    };

    return (
        <div className="mfa-setup-page">
            <div className="mfa-container">
                <h1>Two-Factor Authentication</h1>
                <p className="mfa-description">
                    Enable two-factor authentication to add an extra layer of security to your account.
                    After entering your password, you'll need to provide a verification code sent to your phone.
                </p>

                {/* Message display */}
                {message.text && (
                    <div className={`message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                {/* reCAPTCHA container */}
                <div id="recaptcha-container" className="recaptcha-container"></div>

                {/* Loading spinner */}
                {loading && <LoadingSpinner />}

                {/* Initial stage - not enrolled in MFA */}
                {stage === 'initial' && !loading && (
                    <div className="mfa-initial">
                        <p>You haven't set up two-factor authentication yet.</p>
                        <button
                            className="primary-button"
                            onClick={handleStartEnrollment}
                            disabled={!recaptchaInitialized}
                        >
                            Set Up Two-Factor Authentication
                        </button>
                    </div>
                )}

                {/* Collect phone number stage */}
                {stage === 'collectPhone' && !loading && (
                    <div className="mfa-collect-phone">
                        <h2>Add Phone Number</h2>
                        <p>Enter your phone number to receive verification codes:</p>

                        <div className="form-group">
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="+1234567890"
                                className="phone-input"
                            />
                            <small>Please enter your phone number in international format (e.g., +1234567890)</small>
                        </div>

                        <div className="button-group">
                            <button
                                className="secondary-button"
                                onClick={() => enrolledFactors.length > 0 ? setStage('manage') : setStage('initial')}
                            >
                                Cancel
                            </button>
                            <button
                                className="primary-button"
                                onClick={handleSendVerificationCode}
                                disabled={!phoneNumber.trim() || !recaptchaInitialized}
                            >
                                Send Verification Code
                            </button>
                        </div>
                    </div>
                )}

                {/* Collect verification code stage */}
                {stage === 'collectCode' && !loading && (
                    <div className="mfa-collect-code">
                        <h2>Enter Verification Code</h2>
                        <p>We've sent a verification code to {phoneNumber}.</p>

                        <div className="form-group">
                            <input
                                type="text"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="123456"
                                className="code-input"
                            />
                        </div>

                        <div className="button-group">
                            <button
                                className="secondary-button"
                                onClick={() => setStage('collectPhone')}
                            >
                                Back
                            </button>
                            <button
                                className="primary-button"
                                onClick={handleVerifyCode}
                                disabled={!verificationCode.trim()}
                            >
                                Verify Code
                            </button>
                        </div>
                    </div>
                )}

                {/* Success stage */}
                {stage === 'success' && !loading && (
                    <div className="mfa-success">
                        <h2>Success!</h2>
                        <p>Two-factor authentication has been successfully enabled for your account.</p>
                        <p>You'll now be asked for a verification code when you sign in.</p>

                        <button
                            className="primary-button"
                            onClick={handleGoToManage}
                        >
                            Manage Two-Factor Authentication
                        </button>
                    </div>
                )}

                {/* Manage MFA stage */}
                {stage === 'manage' && !loading && (
                    <div className="mfa-manage">
                        <h2>Manage Two-Factor Authentication</h2>
                        <p>You have enabled two-factor authentication for your account.</p>

                        <div className="enrolled-factors">
                            <h3>Enrolled Factors:</h3>
                            {enrolledFactors.map((factor) => (
                                <div key={factor.uid} className="enrolled-factor">
                                    <div className="factor-info">
                                        <span className="factor-name">{factor.displayName || 'Phone'}</span>
                                        <span className="factor-phone">{formatPhoneHint(factor.phoneNumber)}</span>
                                    </div>
                                    <button
                                        className="remove-factor-button"
                                        onClick={() => handleUnenrollFactor(factor.uid)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="button-group">
                            <button
                                className="secondary-button"
                                onClick={() => navigate('/profile')}
                            >
                                Back to Profile
                            </button>
                            <button
                                className="primary-button"
                                onClick={handleAddAnotherFactor}
                            >
                                Add Another Phone
                            </button>
                        </div>

                        <div className="mfa-info">
                            <h3>Important Information</h3>
                            <p>If you lose access to your phone, you may be unable to sign in to your account.</p>
                            <p>We recommend adding at least two phone numbers for account recovery purposes.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MfaSetupPage;