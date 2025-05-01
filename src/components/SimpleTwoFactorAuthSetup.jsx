import { useState } from 'react';
import { enrolWithPhoneNumber } from '../services/twoFactorAuthService';

export default function SimpleTwoFactorAuthSetup() {
    const [phone, setPhone] = useState('+64275433744');
    const [code, setCode] = useState('');
    const [stage, setStage] = useState('collectPhone');   // 'collectCode' | 'done'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const email = 'user@example.com';     // <– replace with data from context / form
    const password = 'pa$$word';

    const handleSendCode = async () => {
        setLoading(true);
        setError('');
        try {
            // For demo purposes we're using a test code directly
            // In production, we'd handle this in two steps:
            // 1. Send the code, then 2. Verify with the user-entered code
            await enrolWithPhoneNumber(email, password, phone, '123456'); // test number
            setStage('done');
        } catch (e) {
            console.error('Enroll error:', e);
            setError(e.message || 'Failed to enroll phone for MFA');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        setLoading(true);
        setError('');
        try {
            // In a real implementation, we'd use the code entered by the user
            await enrolWithPhoneNumber(email, password, phone, code);
            setStage('done');
        } catch (e) {
            console.error('Verification error:', e);
            setError(e.message || 'Failed to verify code');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectCode = () => {
        // In a real implementation, this would trigger sending the verification code
        // and transition to the code collection state
        setStage('collectCode');
    };

    if (stage === 'done') return <p>✅ Phone enrolled! MFA enabled for your account.</p>;

    return (
        <section className="simple-2fa-setup">
            <h2>Enable two-factor authentication</h2>

            {error && <div className="error-message">{error}</div>}

            {stage === 'collectPhone' && (
                <>
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+64275433744"
                    />
                    <button onClick={handleCollectCode} disabled={loading}>
                        {loading ? 'Sending…' : 'Send verification code'}
                    </button>
                </>
            )}

            {stage === 'collectCode' && (
                <>
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="123456"
                    />
                    <button onClick={handleVerifyCode} disabled={loading}>
                        {loading ? 'Verifying…' : 'Verify & enable'}
                    </button>
                </>
            )}
        </section>
    );
}