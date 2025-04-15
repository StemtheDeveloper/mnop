import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import interestService from '../services/interestService';
import LoadingSpinner from './LoadingSpinner';
import '../styles/InterestHistory.css';

/**
 * Component to display a user's interest earnings history
 * @param {Object} props
 * @param {number} props.limit - Maximum number of transactions to show
 */
const InterestHistory = ({ limit = 10 }) => {
    const { currentUser, interestSummary, loadInterestSummary } = useUser();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchInterestHistory = async () => {
            if (!currentUser) return;

            setLoading(true);
            setError(null);

            try {
                const result = await interestService.getUserInterestTransactions(currentUser.uid, limit);

                if (result.success) {
                    setTransactions(result.data.transactions);

                    // Refresh the interest summary in the user context if needed
                    if (!interestSummary) {
                        loadInterestSummary();
                    }
                } else {
                    setError(result.error || 'Failed to load interest history');
                }
            } catch (err) {
                console.error('Error fetching interest history:', err);
                setError('An error occurred while fetching your interest history');
            } finally {
                setLoading(false);
            }
        };

        fetchInterestHistory();
    }, [currentUser, limit, loadInterestSummary, interestSummary]);

    // Format date from timestamp
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

    if (loading) {
        return (
            <div className="interest-history loading">
                <LoadingSpinner />
                <p>Loading interest history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="interest-history error">
                <p className="error-message">{error}</p>
            </div>
        );
    }

    if (!transactions || transactions.length === 0) {
        return (
            <div className="interest-history empty">
                <p>No interest transactions found. Interest is paid daily on balances above the minimum requirement.</p>
            </div>
        );
    }

    return (
        <div className="interest-history">
            <h3>Interest Payment History</h3>

            {interestSummary && (
                <div className="interest-summary">
                    <p>Total interest earned: <strong>{formatCurrency(interestSummary.totalInterest)}</strong></p>
                </div>
            )}

            <div className="transaction-list">
                {transactions.map(transaction => (
                    <div key={transaction.id} className="transaction-item">
                        <div className="transaction-date">
                            {formatDate(transaction.createdAt)}
                        </div>
                        <div className="transaction-description">
                            {transaction.description}
                        </div>
                        <div className="transaction-amount">
                            {formatCurrency(transaction.amount)}
                        </div>
                    </div>
                ))}
            </div>

            {transactions.length >= limit && (
                <div className="view-more">
                    <a href="/wallet">View all interest transactions</a>
                </div>
            )}
        </div>
    );
};

export default InterestHistory;
