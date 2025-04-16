import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import walletService from '../services/walletService';
import '../styles/WalletFundingModal.css';

const WalletFundingModal = ({ isOpen, onClose }) => {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const { currentUser, userWallet } = useUser();
    const { showSuccess, showError } = useToast();

    if (!isOpen) return null;

    const handleAmountChange = (e) => {
        const value = e.target.value;
        // Allow only numbers and decimal points
        if (/^\d*\.?\d*$/.test(value)) {
            setAmount(value);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            showError('Please enter a valid amount');
            return;
        }

        setLoading(true);

        try {
            await walletService.addFunds(
                currentUser.uid,
                parsedAmount,
                'Added credits to wallet'
            );

            showSuccess(`Successfully added ${parsedAmount.toFixed(2)} credits to your wallet`);
            setAmount('');
            onClose();

            // Reload the page to reflect updated balance
            window.location.reload();
        } catch (error) {
            console.error('Error funding wallet:', error);
            showError('Failed to add funds to your wallet');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    };

    return (
        <div className="modal-overlay">
            <div className="wallet-funding-modal">
                <div className="modal-header">
                    <h2>Add Credits to Your Wallet</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="modal-content">
                    <div className="wallet-balance">
                        <p>Current Balance:</p>
                        <p className="balance-amount">{formatCurrency(userWallet?.balance || 0)}</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="fundAmount">Amount to Add:</label>
                            <div className="amount-input-wrapper">
                                <span className="currency-symbol">$</span>
                                <input
                                    id="fundAmount"
                                    type="text"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    placeholder="Enter amount"
                                    disabled={loading}
                                    required
                                />
                            </div>
                        </div>

                        <div className="quick-amount-buttons">
                            <button type="button" onClick={() => setAmount('10')} disabled={loading}>$10</button>
                            <button type="button" onClick={() => setAmount('25')} disabled={loading}>$25</button>
                            <button type="button" onClick={() => setAmount('50')} disabled={loading}>$50</button>
                            <button type="button" onClick={() => setAmount('100')} disabled={loading}>$100</button>
                        </div>

                        <div className="form-note">
                            <p>Note: This is a simulation. No actual payment will be processed.</p>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="submit-button"
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'Add Credits'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default WalletFundingModal;
