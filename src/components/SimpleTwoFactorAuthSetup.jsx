import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import twoFactorAuthService from '../services/twoFactorAuthService';
import { auth } from '../config/firebase';
import LoadingSpinner from './LoadingSpinner';
import '../styles/MfaSetup.css';

export default function SimpleTwoFactorAuthSetup() {
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [stage, setStage] = useState('collectPhone');   // 'collectPhone' | 'collectCode' | 'done'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [recaptchaInitialized, setRecaptchaInitialized] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is authenticated
        if (!auth.currentUser) {
            setError('You must be signed in to set up two-factor authentication');
            return;
        }

        // Initialize reCAPTCHA
        const initRecaptcha = async () => {
            try {
                twoFactorAuthService.initRecaptchaVerifier('recaptcha-container', true);
                setRecaptchaInitialized(true);
            } catch (error) {
                console.error('Error initializing reCAPTCHA:', error);
                setError('Failed to initialize verification system. Please refresh the page and try again.');
            }
        };

        initRecaptcha();

        // Clean up reCAPTCHA on unmount
        return () => {
            // Any cleanup needed
        };
    }, []);

    const handleSendCode = async () => {
        if (!phone.trim()) {
            setError('Please enter a valid phone number');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Step 1: Initial sign-in happens automatically using the current user's session
            // Step 2: Send verification code to the provided phone number
            await twoFactorAuthService.enrolWithPhoneNumber(
                null, // Not needed when already signed in
                null, // Not needed when already signed in
                phone,
                null  // No verification code yet
            );

            setSuccess('Verification code sent to your phone!');
            setStage('collectCode');
        } catch (e) {
            console.error('Send code error:', e);
            setError(e.message || 'Failed to send verification code');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!code.trim()) {
            setError('Please enter the verification code');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Verify the code and enroll the phone as an MFA factor
            await twoFactorAuthService.enrolWithPhoneNumber(
                null, // Not needed when already signed in
                null, // Not needed when already signed in
                phone,
                code
            );

            setSuccess('Two-factor authentication enabled successfully!');
            setStage('done');

            // After a short delay, redirect to profile page
            setTimeout(() => {
                navigate('/profile');
            }, 2000);
        } catch (e) {
            console.error('Verification error:', e);
            setError(e.message || 'Failed to verify code');
        } finally {
            setLoading(false);
        }
    };

    const formatPhoneNumber = (value) => {
        // Keep only digits, '+' and spaces
        return value.replace(/[^\d\s+]/g, '');
    };

    const handlePhoneChange = (e) => {
        setPhone(formatPhoneNumber(e.target.value));
    };

    const handleBack = () => {
        navigate('/profile');
    };

    return (
        <div className="mfa-setup-container">
            <h2>Two-Factor Authentication Setup</h2>
            <p className="mfa-description">
                Add an extra layer of security to your account by enabling two-factor authentication.
                When you sign in, you'll need to provide a code sent to your phone.
            </p>

            {/* reCAPTCHA container */}
            <div id="recaptcha-container" className="recaptcha-container"></div>

            {/* Message display */}
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {/* Loading spinner */}
            {loading && <LoadingSpinner />}

            {stage === 'collectPhone' && !loading && (
                <div className="setup-step">
                    <h3>Step 1: Enter your phone number</h3>
                    <p>We'll send a verification code to this number.</p>

                    <div className="phone-input-container">
                        <input
                            type="tel"
                            value={phone}
                            onChange={handlePhoneChange}
                            placeholder="+1 234 567 8900"
                            className="phone-input"
                            disabled={!recaptchaInitialized}
                        />
                    </div>

                    <div className="button-group">
                        <button onClick={handleBack} className="btn-cancel">
                            Cancel
                        </button>
                        <button
                            onClick={handleSendCode}
                            disabled={!phone.trim() || !recaptchaInitialized}
                            className="btn-primary"
                        >
                            Send Verification Code
                        </button>
                    </div>
                </div>
            )}

            {stage === 'collectCode' && !loading && (
                <div className="setup-step">
                    <h3>Step 2: Enter verification code</h3>
                    <p>
                        We've sent a code to {phone}. Please enter it below.
                    </p>

                    <div className="code-input-container">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="123456"
                            className="code-input"
                            autoFocus
                        />
                    </div>

                    <div className="button-group">
                        <button onClick={() => setStage('collectPhone')} className="btn-back">
                            Back
                        </button>
                        <button
                            onClick={handleVerifyCode}
                            disabled={!code.trim()}
                            className="btn-primary"
                        >
                            Verify and Enable
                        </button>
                    </div>
                </div>
            )}

            {stage === 'done' && !loading && (
                <div className="setup-complete">
                    <div className="success-icon">✓</div>
                    <h3>Setup Complete!</h3>
                    <p>Two-factor authentication has been successfully enabled for your account.</p>
                    <button onClick={handleBack} className="btn-primary">
                        Return to Profile
                    </button>
                </div>
            )}
        </div>
    );
}