// filepath: c:\Users\GGPC\Desktop\mnop-app\src\components\admin\CurrencyManagementPanel.jsx
import React, { useState, useEffect } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import currencyService from '../../services/currencyService';
import LoadingSpinner from '../LoadingSpinner';


const CurrencyManagementPanel = () => {
    const { availableCurrencies, exchangeRates, updateRates } = useCurrency();

    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [rateHistory, setRateHistory] = useState([]);

    // New currency form
    const [newCurrency, setNewCurrency] = useState({
        code: '',
        name: '',
        symbol: '',
        rate: ''
    });

    // Active tab
    const [activeTab, setActiveTab] = useState('currencies');

    // Load exchange rate history
    useEffect(() => {
        const loadRateHistory = async () => {
            try {
                const result = await currencyService.getExchangeRateHistory(10);
                if (result.success) {
                    setRateHistory(result.data);
                }
            } catch (err) {
                console.error('Error loading exchange rate history:', err);
            }
        };

        if (activeTab === 'history') {
            loadRateHistory();
        }
    }, [activeTab]);

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCurrency(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Add a new currency
    const handleAddCurrency = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!newCurrency.code || !newCurrency.name || !newCurrency.symbol || !newCurrency.rate) {
            setError('All fields are required');
            return;
        }

        if (isNaN(parseFloat(newCurrency.rate)) || parseFloat(newCurrency.rate) <= 0) {
            setError('Rate must be a positive number');
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const result = await currencyService.addCurrency(
                newCurrency.code,
                newCurrency.name,
                newCurrency.symbol,
                parseFloat(newCurrency.rate)
            );

            if (result.success) {
                setMessage(result.message || 'Currency added successfully');
                // Reset form
                setNewCurrency({
                    code: '',
                    name: '',
                    symbol: '',
                    rate: ''
                });

                // Refresh rates through the context
                await updateRates();
            } else {
                setError(result.error || 'Failed to add currency');
            }
        } catch (err) {
            setError('An error occurred while adding the currency');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Set a currency as default
    const handleSetDefault = async (currencyCode) => {
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const result = await currencyService.setDefaultCurrency(currencyCode);
            if (result.success) {
                setMessage(result.message || `${currencyCode} set as default currency`);

                // Refresh rates through the context
                await updateRates();
            } else {
                setError(result.error || 'Failed to set default currency');
            }
        } catch (err) {
            setError('An error occurred while setting the default currency');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Update exchange rates
    const handleUpdateRates = async () => {
        setUpdating(true);
        setError(null);
        setMessage(null);

        try {
            const success = await updateRates();
            if (success) {
                setMessage('Exchange rates updated successfully');

                // Reload history if on history tab
                if (activeTab === 'history') {
                    const result = await currencyService.getExchangeRateHistory(10);
                    if (result.success) {
                        setRateHistory(result.data);
                    }
                }
            } else {
                setError('Failed to update exchange rates');
            }
        } catch (err) {
            setError('An error occurred while updating exchange rates');
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    // Format date
    const formatDate = (date) => {
        if (!date) return 'N/A';
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        return dateObj.toLocaleString();
    };

    return (
        <div className="currency-management-panel">
            <h2>Currency Management</h2>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <div className="currency-tabs">
                <button
                    className={`tab-button ${activeTab === 'currencies' ? 'active' : ''}`}
                    onClick={() => setActiveTab('currencies')}
                >
                    Currencies
                </button>
                <button
                    className={`tab-button ${activeTab === 'rates' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rates')}
                >
                    Exchange Rates
                </button>
                <button
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    Rate History
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'currencies' && (
                    <div className="currencies-tab">
                        <h3>Available Currencies</h3>

                        <div className="currencies-table-container">
                            <table className="currencies-table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Symbol</th>
                                        <th>Current Rate</th>
                                        <th>Default</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(availableCurrencies).map(([code, details]) => (
                                        <tr key={code}>
                                            <td>{code}</td>
                                            <td>{details.name}</td>
                                            <td>{details.symbol}</td>
                                            <td>{exchangeRates?.rates?.[code] || 'N/A'}</td>
                                            <td>
                                                {details.default ? (
                                                    <span className="default-badge">Default</span>
                                                ) : (
                                                    <button
                                                        className="set-default-btn"
                                                        onClick={() => handleSetDefault(code)}
                                                        disabled={loading}
                                                    >
                                                        Set as Default
                                                    </button>
                                                )}
                                            </td>
                                            <td className="actions-cell">
                                                {/* For now, just the default action, we can add more later */}
                                                {!details.default && (
                                                    <button
                                                        className="set-default-btn-small"
                                                        onClick={() => handleSetDefault(code)}
                                                        disabled={loading}
                                                    >
                                                        Set Default
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3>Add New Currency</h3>
                        <form className="add-currency-form" onSubmit={handleAddCurrency}>
                            <div className="form-group">
                                <label htmlFor="code">Currency Code (e.g., USD)</label>
                                <input
                                    id="code"
                                    name="code"
                                    type="text"
                                    value={newCurrency.code}
                                    onChange={handleInputChange}
                                    placeholder="e.g., EUR, JPY"
                                    maxLength="3"
                                    disabled={loading}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="name">Currency Name</label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    value={newCurrency.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Euro, Japanese Yen"
                                    disabled={loading}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="symbol">Currency Symbol</label>
                                <input
                                    id="symbol"
                                    name="symbol"
                                    type="text"
                                    value={newCurrency.symbol}
                                    onChange={handleInputChange}
                                    placeholder="e.g., €, ¥"
                                    maxLength="3"
                                    disabled={loading}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="rate">Exchange Rate (vs USD)</label>
                                <input
                                    id="rate"
                                    name="rate"
                                    type="number"
                                    value={newCurrency.rate}
                                    onChange={handleInputChange}
                                    placeholder="e.g., 0.92 for EUR"
                                    step="0.000001"
                                    min="0.000001"
                                    disabled={loading}
                                    required
                                />
                                <small>1 USD = X of this currency</small>
                            </div>
                            <button
                                type="submit"
                                className="add-currency-btn"
                                disabled={loading}
                            >
                                {loading ? 'Adding...' : 'Add Currency'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'rates' && (
                    <div className="rates-tab">
                        <div className="rates-header">
                            <h3>Current Exchange Rates</h3>
                            <button
                                className="update-rates-btn"
                                onClick={handleUpdateRates}
                                disabled={updating}
                            >
                                {updating ? (
                                    <>
                                        <LoadingSpinner size="small" inline={true} />
                                        <span>Updating...</span>
                                    </>
                                ) : 'Update Rates'}
                            </button>
                        </div>

                        <div className="rates-info">
                            <div className="rates-metadata">
                                <p>Base Currency: {exchangeRates?.base || 'USD'}</p>
                                <p>Last Updated: {formatDate(exchangeRates?.lastUpdated)}</p>
                            </div>

                            <div className="rates-table-container">
                                <table className="rates-table">
                                    <thead>
                                        <tr>
                                            <th>Currency</th>
                                            <th>Code</th>
                                            <th>Rate vs {exchangeRates?.base || 'USD'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {exchangeRates?.rates && Object.entries(exchangeRates.rates).map(([code, rate]) => (
                                            <tr key={code}>
                                                <td>{availableCurrencies[code]?.name || code}</td>
                                                <td>{code}</td>
                                                <td>{rate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rates-info-box">
                            <h4>About Exchange Rates</h4>
                            <ul>
                                <li>Exchange rates are used to convert amounts between different currencies.</li>
                                <li>The base currency is USD (US Dollar).</li>
                                <li>Rates are expressed as 1 USD = X of the target currency.</li>
                                <li>Click "Update Rates" to fetch the latest rates from external sources.</li>
                                <li>In a production environment, rates should be updated daily via an automated schedule.</li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="history-tab">
                        <h3>Exchange Rate History</h3>

                        {rateHistory.length === 0 ? (
                            <div className="no-history">
                                <p>No exchange rate history found.</p>
                            </div>
                        ) : (
                            <div className="history-list">
                                {rateHistory.map((entry, index) => (
                                    <div key={entry.id || index} className="history-entry">
                                        <div className="history-entry-header">
                                            <span className="history-date">{formatDate(entry.loggedAt)}</span>
                                            <span className="history-base">Base: {entry.base}</span>
                                        </div>
                                        <div className="history-rates">
                                            {entry.rates && Object.entries(entry.rates).map(([code, rate]) => (
                                                <div key={code} className="history-rate-item">
                                                    <span className="history-rate-code">{code}</span>
                                                    <span className="history-rate-value">{rate}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CurrencyManagementPanel;