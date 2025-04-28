import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { Link } from 'react-router-dom';
import investmentService from '../services/investmentService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/InvestmentPortfolioPage.css';

const InvestmentPortfolioPage = () => {
    const { currentUser, walletBalance, hasRole } = useUser();
    const [investments, setInvestments] = useState([]);
    const [returns, setReturns] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalInvested, setTotalInvested] = useState(0);
    const [totalReturns, setTotalReturns] = useState(0);
    const [activeTab, setActiveTab] = useState('investments');
    const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
    const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
    const [selectedInvestment, setSelectedInvestment] = useState(null);
    const [withdrawalReason, setWithdrawalReason] = useState('');
    const [withdrawalFeedback, setWithdrawalFeedback] = useState({ message: '', type: '' });
    const [noticePeriod, setNoticePeriod] = useState(7); // Default to 7 days

    useEffect(() => {
        const fetchInvestorData = async () => {
            if (!currentUser) return;

            setLoading(true);
            try {
                // Get the notice period from settings
                const periodResult = await investmentService.getNoticePeriod();
                if (periodResult.success) {
                    setNoticePeriod(periodResult.data.noticePeriodDays);
                }

                // Get comprehensive statistics
                const statsResult = await investmentService.getInvestmentStatistics(currentUser.uid);

                if (statsResult.success) {
                    setStatistics(statsResult.data);
                    setInvestments(statsResult.data.investments.items);
                    setTotalInvested(statsResult.data.investments.total);
                    setReturns(statsResult.data.returns.items || []);
                    setTotalReturns(statsResult.data.returns.total || 0);

                    // Get any pending withdrawal requests
                    const pendingWithdrawals = statsResult.data.investments.items.filter(
                        investment => investment.status === 'pending_withdrawal'
                    );
                    setPendingWithdrawals(pendingWithdrawals);
                } else {
                    setError(statsResult.error || 'Failed to load investment statistics');
                }
            } catch (err) {
                console.error('Error fetching investment data:', err);
                setError('An error occurred while loading your investment data');
            } finally {
                setLoading(false);
            }
        };

        fetchInvestorData();
    }, [currentUser]);

    // Format date
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    // Handle withdrawal request
    const openWithdrawalModal = (investment) => {
        if (investment.status === 'pending_withdrawal') {
            setWithdrawalFeedback({
                type: 'error',
                message: 'This investment already has a pending withdrawal request.'
            });
            return;
        }

        // Check if product is fully funded
        if (investment.productFullyFunded) {
            setWithdrawalFeedback({
                type: 'error',
                message: 'Cannot withdraw from fully funded products.'
            });
            return;
        }

        setSelectedInvestment(investment);
        setWithdrawalReason('');
        setWithdrawalModalOpen(true);
    };

    const closeWithdrawalModal = () => {
        setSelectedInvestment(null);
        setWithdrawalModalOpen(false);
        setWithdrawalReason('');
    };

    const submitWithdrawalRequest = async () => {
        if (!selectedInvestment) return;

        try {
            const result = await investmentService.requestPullFunding(
                selectedInvestment.id,
                currentUser.uid,
                withdrawalReason
            );

            if (result.success) {
                // Update the UI to reflect the pending withdrawal
                setInvestments(prevInvestments =>
                    prevInvestments.map(inv =>
                        inv.id === selectedInvestment.id
                            ? {
                                ...inv,
                                status: 'pending_withdrawal',
                                scheduledWithdrawalDate: result.withdrawalDate,
                                withdrawalReason: withdrawalReason
                            }
                            : inv
                    )
                );

                setPendingWithdrawals(prev => [...prev, {
                    ...selectedInvestment,
                    status: 'pending_withdrawal',
                    scheduledWithdrawalDate: result.withdrawalDate,
                    withdrawalReason: withdrawalReason
                }]);

                setWithdrawalFeedback({
                    type: 'success',
                    message: result.message
                });

                closeWithdrawalModal();
            } else {
                setWithdrawalFeedback({
                    type: 'error',
                    message: result.error
                });
            }
        } catch (err) {
            console.error('Error requesting withdrawal:', err);
            setWithdrawalFeedback({
                type: 'error',
                message: 'An error occurred while processing your withdrawal request.'
            });
        }
    };

    const cancelWithdrawalRequest = async (investmentId) => {
        try {
            const result = await investmentService.cancelPullFundingRequest(
                investmentId,
                currentUser.uid
            );

            if (result.success) {
                // Update the UI to reflect cancellation
                setInvestments(prevInvestments =>
                    prevInvestments.map(inv =>
                        inv.id === investmentId
                            ? {
                                ...inv,
                                status: 'active',
                                scheduledWithdrawalDate: null,
                                withdrawalReason: null
                            }
                            : inv
                    )
                );

                setPendingWithdrawals(prev =>
                    prev.filter(inv => inv.id !== investmentId)
                );

                setWithdrawalFeedback({
                    type: 'success',
                    message: result.message
                });
            } else {
                setWithdrawalFeedback({
                    type: 'error',
                    message: result.error
                });
            }
        } catch (err) {
            console.error('Error canceling withdrawal request:', err);
            setWithdrawalFeedback({
                type: 'error',
                message: 'An error occurred while canceling your withdrawal request.'
            });
        }
    };

    // Check if user is an investor
    const isInvestor = hasRole('investor');

    if (!isInvestor) {
        return (
            <div className="investment-portfolio-page">
                <div className="role-required-container">
                    <h1>Investor Role Required</h1>
                    <p>You need the investor role to access this page. Please visit your profile settings to request the investor role.</p>
                    <a href="/profile" className="profile-link">Go to Profile</a>
                </div>
            </div>
        );
    }

    return (
        <div className="investment-portfolio-page">
            <div className="investment-portfolio-container">
                <h1>Investment Portfolio</h1>

                <div className="portfolio-summary">
                    <div className="summary-card wallet-balance">
                        <h2>Wallet Balance</h2>
                        <div className="summary-value">{formatCurrency(walletBalance || 0)}</div>
                    </div>

                    <div className="summary-card total-invested">
                        <h2>Total Invested</h2>
                        <div className="summary-value">{formatCurrency(totalInvested)}</div>
                    </div>

                    <div className="summary-card total-returns">
                        <h2>Total Returns</h2>
                        <div className="summary-value">{formatCurrency(totalReturns)}</div>
                    </div>

                    <div className="summary-card roi">
                        <h2>ROI</h2>
                        <div className="summary-value">
                            {statistics?.roi ? `${statistics.roi}%` : '0%'}
                        </div>
                    </div>
                </div>

                {withdrawalFeedback.message && (
                    <div className={`feedback-message ${withdrawalFeedback.type}`}>
                        {withdrawalFeedback.message}
                        <button
                            className="dismiss-button"
                            onClick={() => setWithdrawalFeedback({ message: '', type: '' })}
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="portfolio-tabs">
                    <button
                        className={`tab-button ${activeTab === 'investments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('investments')}
                    >
                        Investments
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'returns' ? 'active' : ''}`}
                        onClick={() => setActiveTab('returns')}
                    >
                        Revenue
                    </button>
                    {pendingWithdrawals.length > 0 && (
                        <button
                            className={`tab-button ${activeTab === 'withdrawals' ? 'active' : ''}`}
                            onClick={() => setActiveTab('withdrawals')}
                        >
                            Pending Withdrawals
                            <span className="badge">{pendingWithdrawals.length}</span>
                        </button>
                    )}
                </div>

                <div className="portfolio-content">
                    {loading ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>Loading your investment data...</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            {error}
                        </div>
                    ) : activeTab === 'investments' ? (
                        investments.length === 0 ? (
                            <div className="no-investments">
                                <p>You haven't made any investments yet.</p>
                                <Link to="/products" className="browse-products-link">Browse Products to Invest</Link>
                            </div>
                        ) : (
                            <div className="investments-table-container">
                                <table className="investments-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Amount</th>
                                            <th>Date</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {investments
                                            .filter(inv => inv.status !== 'pending_withdrawal')
                                            .map(investment => (
                                                <tr key={investment.id}>
                                                    <td>
                                                        <Link to={`/product/${investment.productId}`} className="product-link">
                                                            {investment.productName || 'Product'}
                                                        </Link>
                                                    </td>
                                                    <td className="investment-amount">{formatCurrency(investment.amount)}</td>
                                                    <td>{formatDate(investment.createdAt)}</td>
                                                    <td>
                                                        <span className={`status-badge ${investment.status}`}>
                                                            {investment.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {investment.status === 'active' && (
                                                            <button
                                                                className="action-button withdraw-button"
                                                                onClick={() => openWithdrawalModal(investment)}
                                                            >
                                                                Pull Funding
                                                            </button>
                                                        )}
                                                        {investment.status === 'pending_withdrawal' && (
                                                            <button
                                                                className="action-button cancel-button"
                                                                onClick={() => cancelWithdrawalRequest(investment.id)}
                                                            >
                                                                Cancel Request
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : activeTab === 'returns' ? (
                        returns.length === 0 ? (
                            <div className="no-investments">
                                <p>You haven't received any investment returns yet.</p>
                                <p className="info-text">Once products you've invested in start generating revenue, your share will appear here.</p>
                            </div>
                        ) : (
                            <div className="returns-table-container">
                                <table className="investments-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Amount</th>
                                            <th>Date</th>
                                            <th>Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returns.map(returnItem => (
                                            <tr key={returnItem.id}>
                                                <td>
                                                    <Link to={`/product/${returnItem.productId}`} className="product-link">
                                                        {returnItem.description.includes('from sale of')
                                                            ? returnItem.description.split('from sale of ')[1]
                                                            : 'Product'}
                                                    </Link>
                                                </td>
                                                <td className="return-amount positive">+{formatCurrency(returnItem.amount)}</td>
                                                <td>{formatDate(returnItem.createdAt)}</td>
                                                <td>
                                                    <span className="status-badge completed">
                                                        Revenue Share
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : activeTab === 'withdrawals' && (
                        pendingWithdrawals.length === 0 ? (
                            <div className="no-investments">
                                <p>You don't have any pending withdrawal requests.</p>
                            </div>
                        ) : (
                            <div className="withdrawals-table-container">
                                <table className="investments-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Amount</th>
                                            <th>Requested Date</th>
                                            <th>Scheduled Withdrawal</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingWithdrawals.map(withdrawal => (
                                            <tr key={withdrawal.id}>
                                                <td>
                                                    <Link to={`/product/${withdrawal.productId}`} className="product-link">
                                                        {withdrawal.productName || 'Product'}
                                                    </Link>
                                                </td>
                                                <td className="withdrawal-amount">{formatCurrency(withdrawal.amount)}</td>
                                                <td>{formatDate(withdrawal.withdrawalRequestDate)}</td>
                                                <td>{formatDate(withdrawal.scheduledWithdrawalDate)}</td>
                                                <td>
                                                    <button
                                                        className="action-button cancel-button"
                                                        onClick={() => cancelWithdrawalRequest(withdrawal.id)}
                                                    >
                                                        Cancel Request
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="withdrawal-notice">
                                    <p>
                                        Note: Withdrawal requests have a notice period of {noticePeriod} days before funds are returned to your wallet.
                                    </p>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* Withdrawal Request Modal */}
                {withdrawalModalOpen && selectedInvestment && (
                    <div className="modal-overlay">
                        <div className="withdrawal-modal">
                            <h2>Request to Pull Funding</h2>
                            <p>You are about to request the withdrawal of your investment from <strong>{selectedInvestment.productName}</strong>.</p>

                            <div className="withdrawal-details">
                                <div className="detail-row">
                                    <span>Investment Amount:</span>
                                    <span>{formatCurrency(selectedInvestment.amount)}</span>
                                </div>
                                <div className="detail-row">
                                    <span>Notice Period:</span>
                                    <span>{noticePeriod} days</span>
                                </div>
                                <div className="detail-row">
                                    <span>Estimated Return Date:</span>
                                    <span>{new Date(Date.now() + (noticePeriod * 24 * 60 * 60 * 1000)).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="withdrawal-reason">Reason for withdrawal (optional):</label>
                                <textarea
                                    id="withdrawal-reason"
                                    value={withdrawalReason}
                                    onChange={(e) => setWithdrawalReason(e.target.value)}
                                    placeholder="Please share your reason for withdrawing your investment..."
                                    rows={3}
                                />
                            </div>

                            <div className="modal-notice">
                                <p>
                                    <strong>Note:</strong> You can only withdraw from products that have not yet reached their funding goal.
                                    Once approved, your funds will be returned to your wallet after the {noticePeriod}-day notice period.
                                </p>
                            </div>

                            <div className="modal-actions">
                                <button
                                    className="action-button cancel-button"
                                    onClick={closeWithdrawalModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="action-button confirm-button"
                                    onClick={submitWithdrawalRequest}
                                >
                                    Confirm Withdrawal Request
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="investment-achievements">
                    <h2>Investment Achievements</h2>
                    <div className="achievements-container">
                        <div className={`achievement ${totalInvested >= 1000 ? 'unlocked' : 'locked'}`}>
                            <div className="achievement-icon">🥉</div>
                            <div className="achievement-info">
                                <h3>Bronze Investor</h3>
                                <p>Invest $1,000 or more</p>
                            </div>
                        </div>

                        <div className={`achievement ${totalInvested >= 5000 ? 'unlocked' : 'locked'}`}>
                            <div className="achievement-icon">🥈</div>
                            <div className="achievement-info">
                                <h3>Silver Investor</h3>
                                <p>Invest $5,000 or more</p>
                            </div>
                        </div>

                        <div className={`achievement ${totalInvested >= 10000 ? 'unlocked' : 'locked'}`}>
                            <div className="achievement-icon">🥇</div>
                            <div className="achievement-info">
                                <h3>Gold Investor</h3>
                                <p>Invest $10,000 or more</p>
                            </div>
                        </div>

                        <div className={`achievement ${totalReturns >= 500 ? 'unlocked' : 'locked'}`}>
                            <div className="achievement-icon">💰</div>
                            <div className="achievement-info">
                                <h3>Revenue Earner</h3>
                                <p>Earn $500 or more in revenue shares</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvestmentPortfolioPage;
