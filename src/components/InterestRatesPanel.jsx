import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import interestService from '../services/interestService';
import LoadingSpinner from './LoadingSpinner';


const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

const formatPercent = (value) => {
    return (value * 100).toFixed(2) + '%';
};

const InterestRatesPanel = () => {
    const [activeTab, setActiveTab] = useState('rates');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [interestRates, setInterestRates] = useState(null);
    const [interestHistory, setInterestHistory] = useState([]);
    const [estimatedInterest, setEstimatedInterest] = useState(null);
    const [calculatorBalance, setCalculatorBalance] = useState('');
    const [calculatorResults, setCalculatorResults] = useState(null);

    const { currentUser, userWallet } = useUser();

    // Load interest rates and other data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Load interest rates
                const ratesResult = await interestService.getInterestRates();
                if (ratesResult.success) {
                    setInterestRates(ratesResult.data);

                    // If user has a wallet, calculate estimated interest
                    if (userWallet && userWallet.balance > 0) {
                        const estimateResult = await interestService.estimateInterestEarnings(userWallet.balance);
                        if (estimateResult.success) {
                            setEstimatedInterest(estimateResult.data);
                        }
                    }
                } else {
                    setError("Could not load interest rates");
                }

                // Load interest history if on history tab
                if (activeTab === 'history' && currentUser) {
                    const historyResult = await interestService.getInterestHistory(currentUser.uid);
                    if (historyResult.success) {
                        setInterestHistory(historyResult.data.history);
                    }
                }
            } catch (err) {
                console.error("Error loading interest data:", err);
                setError("Failed to load interest information");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentUser, userWallet, activeTab]);

    // Handle interest calculator submission
    const handleCalculate = async (e) => {
        e.preventDefault();

        const balance = parseFloat(calculatorBalance);
        if (isNaN(balance) || balance <= 0) {
            return; // Invalid input
        }

        try {
            const result = await interestService.estimateInterestEarnings(balance);
            if (result.success) {
                setCalculatorResults(result.data);
            } else {
                setCalculatorResults({ error: result.error });
            }
        } catch (error) {
            console.error("Calculation error:", error);
            setCalculatorResults({ error: "An error occurred during calculation" });
        }
    };

    // Use current wallet balance in calculator
    const useCurrentBalance = () => {
        if (userWallet && userWallet.balance) {
            setCalculatorBalance(userWallet.balance.toString());
            // Trigger calculation
            handleCalculateWithBalance(userWallet.balance);
        }
    };

    // Helper function to calculate with a specific balance
    const handleCalculateWithBalance = async (balance) => {
        try {
            const result = await interestService.estimateInterestEarnings(balance);
            if (result.success) {
                setCalculatorResults(result.data);
            }
        } catch (error) {
            console.error("Error calculating with current balance:", error);
        }
    };

    // Display loading state
    if (loading) {
        return (
            <div className="interest-rates-panel">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading interest information...</p>
                </div>
            </div>
        );
    }

    // Display error state
    if (error) {
        return (
            <div className="interest-rates-panel">
                <div className="error-container">
                    <div className="error-message">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="interest-rates-panel">
            <div className="interest-panel-tabs">
                <button
                    className={`tab-button ${activeTab === 'rates' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rates')}
                >
                    Current Rates
                </button>
                <button
                    className={`tab-button ${activeTab === 'calculator' ? 'active' : ''}`}
                    onClick={() => setActiveTab('calculator')}
                >
                    Interest Calculator
                </button>
                <button
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    Interest History
                </button>
            </div>

            <div className="interest-panel-content">
                {activeTab === 'rates' && interestRates && (
                    <div className="rates-tab">
                        <div className="interest-rates-info">
                            <div className="rate-card base-rate">
                                <h4>Current Annual Interest Rate</h4>
                                <div className="rate-value">{formatPercent(interestRates.baseRate)}</div>
                                <p className="rate-label">{interestRates.compoundFrequency} compounding</p>
                            </div>
                        </div>

                        {interestRates.tiers && interestRates.tiers.length > 0 && (
                            <div className="interest-tiers">
                                <h4>Premium Interest Rate Tiers</h4>
                                <div className="tiers-table">
                                    <div className="tier-header">
                                        <div className="tier-min">Minimum Balance</div>
                                        <div className="tier-rate">Interest Rate</div>
                                    </div>
                                    {interestRates.tiers
                                        .sort((a, b) => a.min - b.min)
                                        .map((tier, index) => (
                                            <div key={index} className="tier-row">
                                                <div className="tier-min">{formatCurrency(tier.min)}</div>
                                                <div className="tier-rate">{formatPercent(tier.rate)}</div>
                                            </div>
                                        ))}
                                </div>
                                <p className="minimum-balance">
                                    Minimum balance required to earn interest: {formatCurrency(interestRates.minBalance)}
                                </p>
                            </div>
                        )}

                        {userWallet && estimatedInterest && (
                            <div className="estimated-earnings">
                                <h4>Your Estimated Interest Earnings</h4>
                                <div className="earnings-box">
                                    <div className="current-balance">
                                        <span className="label">Current Balance:</span>
                                        <span className="value">{formatCurrency(userWallet.balance)}</span>
                                    </div>

                                    <div className="earnings-estimates">
                                        <div className="daily-estimate">
                                            <span className="label">Daily:</span>
                                            <span className="value">{formatCurrency(estimatedInterest.dailyInterest)}</span>
                                        </div>
                                        <div className="monthly-estimate">
                                            <span className="label">Monthly:</span>
                                            <span className="value">{formatCurrency(estimatedInterest.monthlyInterest)}</span>
                                        </div>
                                        <div className="yearly-estimate">
                                            <span className="label">Annual:</span>
                                            <span className="value">{formatCurrency(estimatedInterest.yearlyInterest)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="interest-terms">
                            <h4>Interest Terms</h4>
                            <ul>
                                <li>Interest is calculated and paid daily at midnight (UTC).</li>
                                <li>Interest is only paid on balances above the minimum requirement of {formatCurrency(interestRates.minBalance)}.</li>
                                <li>Interest rates may change subject to system updates.</li>
                                <li>All interest payments are automatically added to your wallet balance.</li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'calculator' && (
                    <div className="calculator-tab">
                        <form onSubmit={handleCalculate} className="calculator-form">
                            <div className="form-group">
                                <label htmlFor="calculatorBalance">Balance Amount</label>
                                <input
                                    id="calculatorBalance"
                                    type="number"
                                    placeholder="Enter balance amount"
                                    value={calculatorBalance}
                                    onChange={(e) => setCalculatorBalance(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>

                            {userWallet && (
                                <div className="use-current-balance">
                                    <button
                                        type="button"
                                        className="link-button"
                                        onClick={useCurrentBalance}
                                    >
                                        Use my current balance ({formatCurrency(userWallet.balance)})
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="calculate-button"
                                disabled={!calculatorBalance || parseFloat(calculatorBalance) <= 0}
                            >
                                Calculate Interest
                            </button>
                        </form>

                        {calculatorResults && !calculatorResults.error && (
                            <div className="calculator-results">
                                <h4>Interest Calculation Results</h4>
                                <div className="results-container">
                                    <div className="result-row">
                                        <div className="result-label">Balance Amount:</div>
                                        <div className="result-value">{formatCurrency(parseFloat(calculatorBalance))}</div>
                                    </div>
                                    <div className="result-row interest-daily">
                                        <div className="result-label">Daily Interest:</div>
                                        <div className="result-value">{formatCurrency(calculatorResults.dailyInterest)}</div>
                                    </div>
                                    <div className="result-row interest-monthly">
                                        <div className="result-label">Monthly Interest:</div>
                                        <div className="result-value">{formatCurrency(calculatorResults.monthlyInterest)}</div>
                                    </div>
                                    <div className="result-row interest-yearly">
                                        <div className="result-label">Annual Interest:</div>
                                        <div className="result-value">{formatCurrency(calculatorResults.yearlyInterest)}</div>
                                    </div>
                                    <div className="result-row">
                                        <div className="result-label">Your Interest Rate:</div>
                                        <div className="result-value">{formatPercent(calculatorResults.annualRate)}</div>
                                    </div>
                                </div>

                                {calculatorResults.applicableTier && (
                                    <p className="calculator-note">
                                        You qualify for a premium interest rate tier (minimum balance: {formatCurrency(calculatorResults.applicableTier.min)})
                                    </p>
                                )}
                            </div>
                        )}

                        {calculatorResults && calculatorResults.error && (
                            <div className="error-message">{calculatorResults.error}</div>
                        )}

                        {calculatorResults && calculatorResults.message && (
                            <div className="calculator-note">
                                {calculatorResults.message}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="history-tab">
                        {interestHistory.length === 0 ? (
                            <div className="no-history">
                                <p>No interest payment history found.</p>
                                <p className="no-history-tip">
                                    Interest payments are applied daily. Come back tomorrow to see your earnings!
                                </p>
                            </div>
                        ) : (
                            <div className="history-table-container">
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Balance Before</th>
                                            <th>Balance After</th>
                                            <th>Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {interestHistory.map((item) => {
                                            // Convert Firestore timestamp to Date if needed
                                            const date = item.createdAt && typeof item.createdAt.toDate === 'function'
                                                ? item.createdAt.toDate()
                                                : new Date(item.createdAt);

                                            return (
                                                <tr key={item.id}>
                                                    <td>{date.toLocaleDateString()}</td>
                                                    <td className="amount">{formatCurrency(item.amount)}</td>
                                                    <td>{formatCurrency(item.previousBalance)}</td>
                                                    <td>{formatCurrency(item.newBalance)}</td>
                                                    <td>{formatPercent(item.annualRate)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InterestRatesPanel;
