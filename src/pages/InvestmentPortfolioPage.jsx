import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import investmentService from '../services/investmentService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/InvestmentPortfolioPage.css';

const InvestmentPortfolioPage = () => {
    const { currentUser, walletBalance, hasRole } = useUser();
    const [investments, setInvestments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalInvested, setTotalInvested] = useState(0);

    useEffect(() => {
        const fetchInvestments = async () => {
            if (!currentUser) return;

            setLoading(true);
            try {
                const result = await investmentService.getUserInvestments(currentUser.uid);

                if (result.success) {
                    setInvestments(result.data);

                    // Calculate total invested amount
                    const total = result.data.reduce((sum, investment) => sum + investment.amount, 0);
                    setTotalInvested(total);
                } else {
                    setError(result.error || 'Failed to load investments');
                }
            } catch (err) {
                console.error('Error fetching investments:', err);
                setError('An error occurred while loading your investments');
            } finally {
                setLoading(false);
            }
        };

        fetchInvestments();
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
        }).format(amount);
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

                    <div className="summary-card investment-count">
                        <h2>Investments</h2>
                        <div className="summary-value">{investments.length}</div>
                    </div>
                </div>

                <div className="portfolio-content">
                    <h2>Your Investments</h2>

                    {loading ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>Loading your investments...</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">
                            {error}
                        </div>
                    ) : investments.length === 0 ? (
                        <div className="no-investments">
                            <p>You haven't made any investments yet.</p>
                            <a href="/products" className="browse-products-link">Browse Products to Invest</a>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {investments.map(investment => (
                                        <tr key={investment.id}>
                                            <td>
                                                <a href={`/product/${investment.productId}`} className="product-link">
                                                    {investment.productName || 'Product'}
                                                </a>
                                            </td>
                                            <td className="investment-amount">{formatCurrency(investment.amount)}</td>
                                            <td>{formatDate(investment.createdAt)}</td>
                                            <td>
                                                <span className={`status-badge ${investment.status}`}>
                                                    {investment.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvestmentPortfolioPage;
