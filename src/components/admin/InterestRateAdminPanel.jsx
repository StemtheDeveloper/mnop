import React, { useState, useEffect } from 'react';
import interestService from '../../services/interestService';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';


const InterestRateAdminPanel = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [config, setConfig] = useState({
        dailyRate: 0.0001,  // 0.01% daily
        minBalance: 100,
        lastUpdated: new Date()
    });

    useEffect(() => {
        const loadConfig = async () => {
            try {
                setLoading(true);
                const settingsRef = doc(db, 'systemSettings', 'interestRates');
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists()) {
                    setConfig(settingsDoc.data());
                }
            } catch (err) {
                console.error('Error loading interest rate config:', err);
                setError('Failed to load interest rate configuration');
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: name === 'minBalance' ? parseInt(value, 10) : parseFloat(value)
        }));
    };

    const saveConfig = async () => {
        try {
            setSaving(true);
            setError(null);
            setResult(null);

            const settingsRef = doc(db, 'systemSettings', 'interestRates');
            await setDoc(settingsRef, {
                ...config,
                lastUpdated: new Date()
            });

            setResult('Interest rate configuration saved successfully.');
        } catch (err) {
            console.error('Error saving interest rate config:', err);
            setError('Failed to save interest rate configuration.');
        } finally {
            setSaving(false);
        }
    };

    const triggerInterestCalculation = async () => {
        try {
            setTriggering(true);
            setError(null);
            setResult(null);

            const result = await interestService.triggerInterestCalculation(
                config.dailyRate,
                config.minBalance
            );

            if (result.success) {
                setResult(`Interest calculation triggered: ${result.data.message}`);
            } else {
                setError(result.error || 'Failed to trigger interest calculation.');
            }
        } catch (err) {
            console.error('Error triggering interest calculation:', err);
            setError('An error occurred while triggering interest calculation.');
        } finally {
            setTriggering(false);
        }
    };

    const formatPercentage = (value) => {
        return (value * 100).toFixed(4);
    };

    if (loading) {
        return (
            <div className="admin-panel-loading">
                <div className="loading-spinner"></div>
                <p>Loading interest rate configuration...</p>
            </div>
        );
    }

    return (
        <div className="interest-rate-admin-panel">
            <h2>Interest Rate Configuration</h2>

            {error && <div className="admin-error-message">{error}</div>}
            {result && <div className="admin-success-message">{result}</div>}

            <div className="config-card">
                <div className="config-form">
                    <div className="form-group">
                        <label htmlFor="dailyRate">Daily Interest Rate (%)</label>
                        <input
                            type="number"
                            id="dailyRate"
                            name="dailyRate"
                            value={formatPercentage(config.dailyRate)}
                            onChange={(e) => handleInputChange({
                                target: {
                                    name: 'dailyRate',
                                    value: parseFloat(e.target.value) / 100
                                }
                            })}
                            step="0.0001"
                            min="0.0001"
                            max="1"
                        />
                        <small>Annual equivalent: {formatPercentage(config.dailyRate * 365)}%</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="minBalance">Minimum Balance Required</label>
                        <input
                            type="number"
                            id="minBalance"
                            name="minBalance"
                            value={config.minBalance}
                            onChange={handleInputChange}
                            step="10"
                            min="0"
                        />
                        <small>Users must have at least this amount to earn interest</small>
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        className="save-button"
                        onClick={saveConfig}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>

                    <button
                        className="trigger-button"
                        onClick={triggerInterestCalculation}
                        disabled={triggering}
                    >
                        {triggering ? 'Processing...' : 'Trigger Interest Calculation Now'}
                    </button>
                </div>
            </div>

            <div className="admin-info-box">
                <h3>Interest System Information</h3>
                <ul>
                    <li>Interest is calculated and applied automatically once per day at midnight UTC.</li>
                    <li>Changes to interest rates will take effect on the next scheduled calculation.</li>
                    <li>The minimum balance setting prevents small or inactive accounts from earning interest.</li>
                    <li>Use the "Trigger" button to manually process interest for all eligible users immediately.</li>
                    <li>Interest amounts are always rounded down to the nearest whole number.</li>
                </ul>
            </div>
        </div>
    );
};

export default InterestRateAdminPanel;
