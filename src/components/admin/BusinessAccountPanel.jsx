import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../LoadingSpinner';
import walletService from '../../services/walletService';
import '../../styles/AdminTools.css';

const BusinessAccountPanel = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [businessWallet, setBusinessWallet] = useState(null);
    const [settings, setSettings] = useState({
        enabled: true,
        commissionRate: 2.0 // Default 2% commission
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [transactions, setTransactions] = useState([]);

    // Fetch business wallet and settings on component load
    useEffect(() => {
        const fetchBusinessAccount = async () => {
            try {
                setLoading(true);

                // Get business wallet
                const walletRef = doc(db, 'wallets', 'business');
                const walletDoc = await getDoc(walletRef);

                if (walletDoc.exists()) {
                    setBusinessWallet(walletDoc.data());
                } else {
                    // Initialize empty wallet if none exists
                    setBusinessWallet({ balance: 0 });
                }

                // Get commission settings
                const settingsRef = doc(db, 'settings', 'businessAccount');
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists()) {
                    setSettings(settingsDoc.data());
                } else {
                    // Create initial settings if they don't exist
                    const initialSettings = {
                        enabled: true,
                        commissionRate: 2.0,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    try {
                        await setDoc(settingsRef, initialSettings);
                        setSettings(initialSettings);
                        console.log('Created initial business account settings');
                    } catch (err) {
                        console.error('Error creating initial business account settings:', err);
                    }
                }

                // Get recent transactions
                if (walletDoc.exists()) {
                    const transactionData = await walletService.getTransactionHistory('business', 10);
                    setTransactions(transactionData || []);
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching business account:', err);
                setError('Failed to load business account information');
                setLoading(false);
            }
        };

        fetchBusinessAccount();
    }, []);

    // Handle commission toggle
    const handleCommissionToggle = () => {
        setSettings(prev => ({
            ...prev,
            enabled: !prev.enabled
        }));
    };

    // Handle commission rate change
    const handleCommissionRateChange = (e) => {
        const value = e.target.value;

        // Only allow numbers and decimal points with max 2 decimal places
        if (/^\d*\.?\d{0,2}$/.test(value)) {
            setSettings(prev => ({
                ...prev,
                commissionRate: value
            }));
        }
    };

    // Save settings
    const saveSettings = async () => {
        try {
            setSaving(true);
            setError('');
            setSuccess('');

            // Validate commission rate
            const commissionRate = parseFloat(settings.commissionRate);
            if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 50) {
                setError('Commission rate must be between 0 and 50%');
                setSaving(false);
                return;
            }

            // Update settings in Firestore
            const settingsRef = doc(db, 'settings', 'businessAccount');
            await updateDoc(settingsRef, {
                enabled: settings.enabled,
                commissionRate: commissionRate,
                updatedAt: serverTimestamp()
            });

            setSuccess('Business account settings saved successfully');

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccess('');
            }, 3000);
        } catch (err) {
            console.error('Error saving business account settings:', err);
            setError('Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Format date
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
    };

    if (loading) {
        return (
            <div className="admin-panel business-account-panel">
                <div className="panel-header">
                    <h3>Business Account</h3>
                </div>
                <div className="loading-container">
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    return (
        <div className="admin-panel business-account-panel">
            <div className="panel-header">
                <h3>Business Account</h3>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="business-account-balance">
                <h4>M'NOP Business Wallet Balance</h4>
                <div className="balance-display">
                    {formatCurrency(businessWallet?.balance || 0)}
                </div>
                <p className="balance-description">
                    Accumulated commissions from product sales
                </p>
            </div>

            <div className="settings-group">
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Commission Collection</h4>
                        <p>Enable or disable commission on product sales</p>
                    </div>
                    <div className="setting-control">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={settings.enabled}
                                onChange={handleCommissionToggle}
                                disabled={saving}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Commission Rate</h4>
                        <p>Percentage of profit taken as commission on each sale</p>
                    </div>
                    <div className="setting-control">
                        <div className="commission-input">
                            <input
                                type="text"
                                value={settings.commissionRate}
                                onChange={handleCommissionRateChange}
                                disabled={saving || !settings.enabled}
                            />
                            <span className="unit">%</span>
                        </div>
                    </div>
                </div>
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

            {transactions.length > 0 && (
                <div className="recent-transactions" style={{ marginTop: '30px' }}>
                    <h4>Recent Transactions</h4>
                    <div className="users-table-container" style={{ marginTop: '15px' }}>
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Product</th>
                                    <th>Amount</th>
                                    <th>Commission Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(transaction => (
                                    <tr key={transaction.id}>
                                        <td>{formatDate(transaction.createdAt)}</td>
                                        <td>{transaction.description}</td>
                                        <td>{formatCurrency(transaction.amount)}</td>
                                        <td>{transaction.commissionRate}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessAccountPanel;