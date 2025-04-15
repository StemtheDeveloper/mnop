import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import interestService from '../services/interestService';
import '../styles/InterestRatesPanel.css';

const InterestRatesPanel = ({ walletBalance }) => {
    const [interestConfig, setInterestConfig] = useState(null);
    const [estimatedInterest, setEstimatedInterest] = useState(null);
    const [interestHistory, setInterestHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const { currentUser } = useUser();

    useEffect(() => {
        const loadInterestData = async () => {
            setLoading(true);
            try {
                // Get interest configuration
                const configResult = await interestService.getInterestRateConfig();
                if (configResult.success) {
                    setInterestConfig(configResult.data);
                }

                if (currentUser && walletBalance) {
                    // Calculate estimated interest
                    const estimateResult = await interestService.calculateEstimatedInterest(walletBalance, 30);
                    if (estimateResult.success) {
                        setEstimatedInterest(estimateResult.data);
                    }

                    // Get interest transaction history
                    const historyResult = await interestService.getUserInterestTransactions(currentUser.uid, 10);
                    if (historyResult.success) {
                        setInterestHistory(historyResult.data.transactions);
                    }
                }
            } catch (error) {
                console.error("Error loading interest data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadInterestData();
    }, [currentUser, walletBalance]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const formatPercentage = (rate) => {
        return (rate * 100).toFixed(3) + '%';
    };

    if (loading) {
        return (
            <div className="interest-rates-panel loading">
                <div className="loading-spinner-small"></div>
                <p>Loading interest data...</p>
            </div>
        );
    }

    return (
        <div className="interest-rates-panel">
            <div className="interest-panel-tabs">
                <button
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Interest Overview
                </button>
                <button
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    Interest History
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-tab">
                        <div className="interest-info-card">
                            <div className="rate-info">
                                <h3>Current Interest Rate</h3>
                                <div className="rate-display">
                                    <span className="daily-rate">{interestConfig && formatPercentage(interestConfig.dailyRate)}</span>
                                    <span className="rate-period">daily</span>
                                </div>
                                <div className="annual-rate">
                                    Annual rate: {interestConfig && formatPercentage(interestConfig.dailyRate * 365)}
                                </div>
                            </div>

                            <div className="min-balance-info">
                                <h4>Minimum Balance Required</h4>
                                <div className="min-balance">
                                    {interestConfig && formatCurrency(interestConfig.minBalance)}
                                </div>
                                {walletBalance < (interestConfig?.minBalance || 0) && (
                                    <div className="balance-warning">
                                        Your current balance is below the minimum required to earn interest.
                                    </div>
                                )}
                            </div>

                            {estimatedInterest && (
                                <div className="interest-estimates">
                                    <h4>Estimated Interest (Next 30 Days)</h4>
                                    <div className="estimate-info">
                                        <div className="daily-estimate">
                                            <span className="label">Daily:</span>
                                            <span className="value">{formatCurrency(estimatedInterest.dailyInterest)}</span>
                                        </div>
                                        <div className="monthly-estimate">
                                            <span className="label">Monthly:</span>
                                            <span className="value">{formatCurrency(estimatedInterest.totalInterest)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="interest-terms">
                            <h4>Interest Terms</h4>
                            <ul>
                                <li>Interest is calculated and paid daily at midnight (UTC).</li>
                                <li>Interest is only paid on balances above the minimum requirement.</li>
                                <li>Interest rates may change subject to system updates.</li>
                                <li>All interest payments are automatically added to your wallet balance.</li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="history-tab">
                        <h3>Interest Payment History</h3>

                        {interestHistory.length === 0 ? (
                            <div className="no-history">
                                <p>No interest payments found. Interest is credited to your account daily when your balance meets the minimum requirement.</p>
                            </div>
                        ) : (
                            <div className="interest-history">
                                <table className="interest-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {interestHistory.map((transaction) => (
                                            <tr key={transaction.id}>
                                                <td>{formatDate(transaction.createdAt)}</td>
                                                <td className="amount">{formatCurrency(transaction.amount)}</td>
                                                <td>{transaction.description}</td>
                                            </tr>
                                        ))}
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
