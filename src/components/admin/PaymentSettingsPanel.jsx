import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../LoadingSpinner';


const PaymentSettingsPanel = () => {
    const [settings, setSettings] = useState({
        useWalletPayment: true,
        allowCreditCardPayment: false,
        enableCancellationPeriodTesting: false,
        cancellationPeriodMinutes: 60, // Default to 60 minutes (1 hour)
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    // Fetch current payment settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsRef = doc(db, 'settings', 'paymentSettings');
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setSettings({
                        useWalletPayment: data.useWalletPayment ?? true,
                        allowCreditCardPayment: data.allowCreditCardPayment ?? false,
                        enableCancellationPeriodTesting: data.enableCancellationPeriodTesting ?? false,
                        cancellationPeriodMinutes: data.cancellationPeriodMinutes ?? 60,
                    });
                } else {
                    // Create default settings if they don't exist
                    await setDoc(settingsRef, {
                        useWalletPayment: true,
                        allowCreditCardPayment: false,
                        enableCancellationPeriodTesting: false,
                        cancellationPeriodMinutes: 60,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }
            } catch (err) {
                console.error('Error fetching payment settings:', err);
                setError('Failed to load payment settings');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // Handle toggle changes
    const handleToggle = (setting) => {
        setSettings(prev => ({
            ...prev,
            [setting]: !prev[setting]
        }));
    };

    // Handle numeric input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        // Ensure we have a valid positive number
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue > 0) {
            setSettings(prev => ({
                ...prev,
                [name]: numValue
            }));
        }
    };

    // Save settings to Firestore
    const saveSettings = async () => {
        setSaving(true);
        setError(null);
        setSuccess('');

        try {
            const settingsRef = doc(db, 'settings', 'paymentSettings');
            await updateDoc(settingsRef, {
                ...settings,
                updatedAt: serverTimestamp()
            });

            setSuccess('Payment settings updated successfully');

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccess('');
            }, 3000);
        } catch (err) {
            console.error('Error updating payment settings:', err);
            setError('Failed to update payment settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="admin-panel payment-settings-panel">
                <div className="panel-header">
                    <h3>Payment Settings</h3>
                </div>
                <div className="loading-container">
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    return (
        <div className="admin-panel payment-settings-panel">
            <div className="panel-header">
                <h3>Payment Settings</h3>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <h4 className="settings-section-title">Payment Methods</h4>
            <div className="settings-group">
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Enable Wallet Payments</h4>
                        <p>Allow users to pay for orders using their wallet balance</p>
                    </div>
                    <div className="setting-control">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.useWalletPayment}
                                onChange={() => handleToggle('useWalletPayment')}
                                disabled={saving}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Enable Credit Card Payments</h4>
                        <p>Allow users to pay for orders using a credit card</p>
                    </div>
                    <div className="setting-control">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.allowCreditCardPayment}
                                onChange={() => handleToggle('allowCreditCardPayment')}
                                disabled={saving}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="settings-note">
                <p><strong>Note:</strong> At least one payment method must be enabled. If both are enabled, users will be able to choose their preferred payment method during checkout.</p>
            </div>

            <h4 className="settings-section-title">Testing Settings</h4>
            <div className="settings-group testing-settings">
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Enable Cancellation Period Testing</h4>
                        <p>Allow testing of the cancellation period by adjusting its duration</p>
                    </div>
                    <div className="setting-control">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.enableCancellationPeriodTesting}
                                onChange={() => handleToggle('enableCancellationPeriodTesting')}
                                disabled={saving}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Cancellation Period (Minutes)</h4>
                        <p>Set the cancellation period in minutes for testing purposes</p>
                    </div>
                    <div className="setting-control input-with-label">
                        <input
                            type="number"
                            name="cancellationPeriodMinutes"
                            value={settings.cancellationPeriodMinutes}
                            onChange={handleInputChange}
                            disabled={saving || !settings.enableCancellationPeriodTesting}
                            min="1"
                            max="1440"
                        />
                        <span className="input-label">minutes</span>
                    </div>
                </div>
            </div>

            <div className="settings-note warning">
                <p><strong>Warning:</strong> Testing settings should only be used in development/testing environments. The standard cancellation period is 60 minutes (1 hour).</p>
            </div>

            <div className="setting-actions">
                <button
                    className="admin-button"
                    onClick={saveSettings}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
};

export default PaymentSettingsPanel;
