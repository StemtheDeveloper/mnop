import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import LoadingSpinner from './LoadingSpinner';
import '../styles/InvestmentModal.css';

/**
 * Modal component for making investments in products
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when closing the modal
 * @param {Object} props.product - Product data to invest in
 * @param {Function} props.onSuccess - Function to call after successful investment
 */
const InvestmentModal = ({ isOpen, onClose, product, onSuccess }) => {
    const { currentUser, walletBalance, hasRole, getWalletBalance, fundProduct } = useUser();
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [investmentProgress, setInvestmentProgress] = useState({
        step: 'idle',
        message: ''
    });

    if (!isOpen) return null;

    const handleAmountChange = (e) => {
        const value = e.target.value;
        // Allow only positive numbers
        if (!value || value.match(/^\d*\.?\d*$/)) {
            setAmount(value);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError('');
        setSuccess('');
        setLoading(true);

        // Validate amount
        const investmentAmount = parseFloat(amount);
        if (!investmentAmount || investmentAmount <= 0) {
            setError('Please enter a valid investment amount');
            setLoading(false);
            return;
        }

        // Check if user has enough balance
        if (investmentAmount > walletBalance) {
            setError('Insufficient funds in your wallet');
            setLoading(false);
            return;
        }

        // Check if user is an investor
        if (!hasRole('investor')) {
            setError('You need investor role to invest in products');
            setLoading(false);
            return;
        }

        try {
            setInvestmentProgress({
                step: 'processing',
                message: 'Processing your investment...'
            });

            // Use the fundProduct function from UserContext instead of createInvestment
            const result = await fundProduct(
                product.id,
                product.name,
                investmentAmount
            );

            if (result.success) {
                setInvestmentProgress({
                    step: 'success',
                    message: 'Investment completed successfully!'
                });

                setSuccess(`Successfully invested $${investmentAmount} in ${product.name}`);
                setAmount('');

                // Refresh wallet balance
                await getWalletBalance();

                // Call the success callback with updated funding progress
                if (onSuccess) {
                    onSuccess(investmentAmount, result.newTotal);
                }

                // Auto close after successful investment
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setInvestmentProgress({
                    step: 'error',
                    message: 'Investment failed'
                });
                setError(result.error || 'Failed to process investment');
            }
        } catch (err) {
            setInvestmentProgress({
                step: 'error',
                message: 'Error occurred'
            });
            setError(err.message || 'An error occurred while processing your investment');
            console.error('Investment error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="investment-modal-overlay">
            <div className="investment-modal">
                <button className="close-button" onClick={onClose} disabled={loading}>×</button>
                <h2>Invest in {product.name}</h2>

                <div className="product-funding-info">
                    <p>
                        <strong>Current Funding:</strong> ${product.fundingProgress?.toLocaleString() || '0'}
                    </p>
                    {product.fundingGoal && (
                        <p>
                            <strong>Funding Goal:</strong> ${product.fundingGoal.toLocaleString()}
                        </p>
                    )}
                    {product.fundingProgress !== undefined && product.fundingGoal && (
                        <div className="funding-progress-container">
                            <div
                                className="funding-progress-bar"
                                style={{ width: `${Math.min((product.fundingProgress / product.fundingGoal) * 100, 100)}%` }}
                            ></div>
                        </div>
                    )}
                </div>

                <div className="wallet-balance">
                    <p>Your Wallet Balance: <strong>${walletBalance?.toLocaleString() || '0'}</strong></p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                {loading ? (
                    <div className="investment-processing">
                        <LoadingSpinner />
                        <p>{investmentProgress.message}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="investment-amount">Investment Amount ($)</label>
                            <input
                                id="investment-amount"
                                type="text"
                                value={amount}
                                onChange={handleAmountChange}
                                placeholder="Enter amount to invest"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        <div className="investment-benefits">
                            <h3>Benefits of Investing</h3>
                            <ul>
                                <li>Early access to product releases</li>
                                <li>Share in product revenues</li>
                                <li>Influence product development</li>
                                <li>Exclusive investor community access</li>
                            </ul>
                        </div>

                        <button
                            type="submit"
                            className="invest-button"
                            disabled={loading || !amount}
                        >
                            {loading ? 'Processing...' : 'Confirm Investment'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default InvestmentModal;
