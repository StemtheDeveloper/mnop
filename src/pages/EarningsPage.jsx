import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import walletService from '../services/walletService';
import investmentService from '../services/investmentService';
import interestService from '../services/interestService';
import { formatCurrency, formatDate } from '../utils/formatters';


const EarningsPage = () => {
    const { currentUser, userWallet, hasRole } = useUser();
    const { error: showError } = useToast();

    // State variables
    const [loading, setLoading] = useState(true);
    const [earningsSummary, setEarningsSummary] = useState({
        totalEarnings: 0,
        investmentReturns: 0,
        interestEarnings: 0,
        salesRevenue: 0,
        commissions: 0
    });
    const [transactions, setTransactions] = useState([]);
    const [timeFrame, setTimeFrame] = useState('all');
    const [activeTab, setActiveTab] = useState('summary');

    // Fetch all earnings data
    const fetchEarningsData = useCallback(async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            // Get all transactions
            const allTransactions = await walletService.getTransactionHistory(currentUser.uid, 500);

            // Filter only income transactions
            const incomeTransactions = allTransactions.filter(tx => tx.amount > 0);
            setTransactions(incomeTransactions);

            // Calculate earnings by category
            let totalEarnings = 0;
            let investmentReturns = 0;
            let interestEarnings = 0;
            let salesRevenue = 0;
            let commissions = 0;

            incomeTransactions.forEach(tx => {
                const amount = tx.amount || 0;
                totalEarnings += amount;

                // Categorize by transaction type
                if (tx.type === 'revenue_share') {
                    investmentReturns += amount;
                } else if (tx.type === 'interest') {
                    interestEarnings += amount;
                } else if (tx.type === 'sale') {
                    salesRevenue += amount;
                } else if (tx.type === 'commission') {
                    commissions += amount;
                }
            });

            // If user is an investor, get more detailed investment stats
            if (hasRole('investor')) {
                const investmentStats = await investmentService.getInvestorStatistics(currentUser.uid);
                if (investmentStats.success) {
                    investmentReturns = investmentStats.data.returns.total || investmentReturns;
                }
            }

            // Get interest history for more accurate interest earnings
            const interestHistory = await interestService.getInterestHistory(currentUser.uid);
            if (interestHistory.success) {
                interestEarnings = interestHistory.data.totalInterest || interestEarnings;
            }

            setEarningsSummary({
                totalEarnings,
                investmentReturns,
                interestEarnings,
                salesRevenue,
                commissions
            });

        } catch (error) {
            console.error('Error fetching earnings data:', error);
            showError('Failed to load earnings information');
        } finally {
            setLoading(false);
        }
    }, [currentUser, hasRole, showError]);

    // Filter transactions based on selected time frame
    const getFilteredTransactions = () => {
        if (timeFrame === 'all') {
            return transactions;
        }

        const now = new Date();
        let cutoff = new Date();

        if (timeFrame === 'month') {
            cutoff.setMonth(now.getMonth() - 1);
        } else if (timeFrame === 'quarter') {
            cutoff.setMonth(now.getMonth() - 3);
        } else if (timeFrame === 'year') {
            cutoff.setFullYear(now.getFullYear() - 1);
        }

        return transactions.filter(tx => {
            const txDate = tx.createdAt?.toDate?.() || new Date(tx.createdAt);
            return txDate >= cutoff;
        });
    };

    // Update summary data when time frame changes
    useEffect(() => {
        if (transactions.length === 0) return;

        const filteredTransactions = getFilteredTransactions();

        let totalEarnings = 0;
        let investmentReturns = 0;
        let interestEarnings = 0;
        let salesRevenue = 0;
        let commissions = 0;

        filteredTransactions.forEach(tx => {
            const amount = tx.amount || 0;
            totalEarnings += amount;

            if (tx.type === 'revenue_share') {
                investmentReturns += amount;
            } else if (tx.type === 'interest') {
                interestEarnings += amount;
            } else if (tx.type === 'sale') {
                salesRevenue += amount;
            } else if (tx.type === 'commission') {
                commissions += amount;
            }
        });

        setEarningsSummary({
            totalEarnings,
            investmentReturns,
            interestEarnings,
            salesRevenue,
            commissions
        });

    }, [timeFrame, transactions]);

    // Fetch data on component mount
    useEffect(() => {
        fetchEarningsData();
    }, [fetchEarningsData]);

    // Format date for display
    const formatDateDisplay = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return formatDate(date);
    };

    // Group transactions by month for display
    const groupTransactionsByMonth = (transactions) => {
        const groups = {};

        transactions.forEach(transaction => {
            const date = transaction.createdAt?.toDate?.() || new Date(transaction.createdAt);
            const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
            const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

            if (!groups[monthYear]) {
                groups[monthYear] = {
                    name: monthName,
                    transactions: []
                };
            }

            groups[monthYear].transactions.push(transaction);
        });

        // Sort months in reverse chronological order (newest first)
        return Object.entries(groups)
            .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
            .map(([key, value]) => ({
                id: key,
                name: value.name,
                transactions: value.transactions
            }));
    };

    // Show loading state
    if (loading) {
        return (
            <div className="earnings-page">
                <div className="earnings-container loading">
                    <LoadingSpinner size="medium" showText={true} text="Loading your earnings data..." />
                </div>
            </div>
        );
    }

    const filteredTransactions = getFilteredTransactions();
    const groupedTransactions = groupTransactionsByMonth(filteredTransactions);

    return (
        <div className="earnings-page">
            <div className="earnings-container">
                <h1>My Earnings</h1>

                <div className="time-filter">
                    <button
                        className={timeFrame === 'all' ? 'active' : ''}
                        onClick={() => setTimeFrame('all')}
                    >
                        All Time
                    </button>
                    <button
                        className={timeFrame === 'year' ? 'active' : ''}
                        onClick={() => setTimeFrame('year')}
                    >
                        Past Year
                    </button>
                    <button
                        className={timeFrame === 'quarter' ? 'active' : ''}
                        onClick={() => setTimeFrame('quarter')}
                    >
                        Past 3 Months
                    </button>
                    <button
                        className={timeFrame === 'month' ? 'active' : ''}
                        onClick={() => setTimeFrame('month')}
                    >
                        Past Month
                    </button>
                </div>

                <div className="earnings-summary">
                    <div className="summary-card total">
                        <h2>Total Earnings</h2>
                        <div className="amount">{formatCurrency(earningsSummary.totalEarnings)}</div>
                    </div>

                    {hasRole('investor') && (
                        <div className="summary-card investment">
                            <h2>Investment Returns</h2>
                            <div className="amount">{formatCurrency(earningsSummary.investmentReturns)}</div>
                        </div>
                    )}

                    {hasRole('investor') && (
                        <div className="summary-card interest">
                            <h2>Interest Earnings</h2>
                            <div className="amount">{formatCurrency(earningsSummary.interestEarnings)}</div>
                        </div>
                    )}

                    {hasRole('designer') && (
                        <div className="summary-card sales">
                            <h2>Sales Revenue</h2>
                            <div className="amount">{formatCurrency(earningsSummary.salesRevenue)}</div>
                        </div>
                    )}

                    {hasRole('manufacturer') && (
                        <div className="summary-card commission">
                            <h2>Commissions</h2>
                            <div className="amount">{formatCurrency(earningsSummary.commissions)}</div>
                        </div>
                    )}
                </div>

                <div className="earnings-tabs">
                    <button
                        className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('summary')}
                    >
                        Summary
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'transactions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transactions')}
                    >
                        Transactions
                    </button>
                    {hasRole('investor') && (
                        <button
                            className={`tab-button ${activeTab === 'investments' ? 'active' : ''}`}
                            onClick={() => setActiveTab('investments')}
                        >
                            Investments
                        </button>
                    )}
                </div>

                <div className="tab-content">
                    {activeTab === 'summary' && (
                        <div className="summary-tab">
                            <div className="earnings-chart">
                                <h3>Earnings Breakdown</h3>
                                <div className="chart-container">
                                    <div className="chart-placeholder">
                                        {/* Visual earnings breakdown */}
                                        <div className="pie-chart">
                                            {earningsSummary.investmentReturns > 0 && (
                                                <div
                                                    className="pie-segment investment"
                                                    style={{
                                                        '--percentage': `${(earningsSummary.investmentReturns / earningsSummary.totalEarnings) * 100}%`
                                                    }}
                                                    title={`Investment Returns: ${formatCurrency(earningsSummary.investmentReturns)}`}
                                                />
                                            )}
                                            {earningsSummary.interestEarnings > 0 && (
                                                <div
                                                    className="pie-segment interest"
                                                    style={{
                                                        '--percentage': `${(earningsSummary.interestEarnings / earningsSummary.totalEarnings) * 100}%`
                                                    }}
                                                    title={`Interest Earnings: ${formatCurrency(earningsSummary.interestEarnings)}`}
                                                />
                                            )}
                                            {earningsSummary.salesRevenue > 0 && (
                                                <div
                                                    className="pie-segment sales"
                                                    style={{
                                                        '--percentage': `${(earningsSummary.salesRevenue / earningsSummary.totalEarnings) * 100}%`
                                                    }}
                                                    title={`Sales Revenue: ${formatCurrency(earningsSummary.salesRevenue)}`}
                                                />
                                            )}
                                            {earningsSummary.commissions > 0 && (
                                                <div
                                                    className="pie-segment commission"
                                                    style={{
                                                        '--percentage': `${(earningsSummary.commissions / earningsSummary.totalEarnings) * 100}%`
                                                    }}
                                                    title={`Commissions: ${formatCurrency(earningsSummary.commissions)}`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="chart-legend">
                                        {earningsSummary.investmentReturns > 0 && (
                                            <div className="legend-item">
                                                <span className="legend-color investment"></span>
                                                <span className="legend-label">Investment Returns</span>
                                                <span className="legend-value">{formatCurrency(earningsSummary.investmentReturns)}</span>
                                            </div>
                                        )}
                                        {earningsSummary.interestEarnings > 0 && (
                                            <div className="legend-item">
                                                <span className="legend-color interest"></span>
                                                <span className="legend-label">Interest Earnings</span>
                                                <span className="legend-value">{formatCurrency(earningsSummary.interestEarnings)}</span>
                                            </div>
                                        )}
                                        {earningsSummary.salesRevenue > 0 && (
                                            <div className="legend-item">
                                                <span className="legend-color sales"></span>
                                                <span className="legend-label">Sales Revenue</span>
                                                <span className="legend-value">{formatCurrency(earningsSummary.salesRevenue)}</span>
                                            </div>
                                        )}
                                        {earningsSummary.commissions > 0 && (
                                            <div className="legend-item">
                                                <span className="legend-color commission"></span>
                                                <span className="legend-label">Commissions</span>
                                                <span className="legend-value">{formatCurrency(earningsSummary.commissions)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="earnings-stats">
                                <h3>Earnings Statistics</h3>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <h4>Total Transactions</h4>
                                        <div className="stat-value">{filteredTransactions.length}</div>
                                    </div>
                                    <div className="stat-item">
                                        <h4>Average Transaction</h4>
                                        <div className="stat-value">
                                            {formatCurrency(
                                                filteredTransactions.length > 0
                                                    ? earningsSummary.totalEarnings / filteredTransactions.length
                                                    : 0
                                            )}
                                        </div>
                                    </div>
                                    <div className="stat-item">
                                        <h4>First Earning</h4>
                                        <div className="stat-value">
                                            {filteredTransactions.length > 0
                                                ? formatDateDisplay(transactions[transactions.length - 1]?.createdAt)
                                                : 'N/A'
                                            }
                                        </div>
                                    </div>
                                    <div className="stat-item">
                                        <h4>Most Recent</h4>
                                        <div className="stat-value">
                                            {filteredTransactions.length > 0
                                                ? formatDateDisplay(filteredTransactions[0]?.createdAt)
                                                : 'N/A'
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'transactions' && (
                        <div className="transactions-tab">
                            <h3>Earnings Transactions</h3>
                            {filteredTransactions.length === 0 ? (
                                <div className="no-transactions">
                                    <p>No earnings transactions found for the selected period.</p>
                                </div>
                            ) : (
                                <div className="transactions-list">
                                    {groupedTransactions.map(month => (
                                        <div key={month.id} className="month-group">
                                            <h4 className="month-header">{month.name}</h4>
                                            {month.transactions.map(transaction => (
                                                <div key={transaction.id} className="transaction-item">
                                                    <div className="transaction-icon">
                                                        {transaction.type === 'revenue_share' && <span className="icon investment">↗</span>}
                                                        {transaction.type === 'interest' && <span className="icon interest">%</span>}
                                                        {transaction.type === 'sale' && <span className="icon sales">$</span>}
                                                        {transaction.type === 'commission' && <span className="icon commission">€</span>}
                                                        {!['revenue_share', 'interest', 'sale', 'commission'].includes(transaction.type) &&
                                                            <span className="icon other">+</span>}
                                                    </div>
                                                    <div className="transaction-details">
                                                        <div className="transaction-description">
                                                            {transaction.description || 'Earnings transaction'}
                                                        </div>
                                                        <div className="transaction-date">
                                                            {formatDateDisplay(transaction.createdAt)}
                                                        </div>
                                                    </div>
                                                    <div className="transaction-amount positive">
                                                        +{formatCurrency(transaction.amount)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'investments' && (
                        <div className="investments-tab">
                            <h3>Investment Returns</h3>
                            <p className="tab-description">
                                This section shows your earnings from product investments. View detailed investment
                                information on the <a href="/portfolio">Investment Portfolio</a> page.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EarningsPage;
