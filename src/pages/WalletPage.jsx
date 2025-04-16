import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import walletService from '../services/walletService';
import interestService from '../services/interestService';
import { formatCurrency, formatDate } from '../utils/formatters';
import '../styles/WalletPage.css';

const WalletPage = () => {
    const { currentUser, userWallet } = useUser();
    const { showSuccess, showError } = useToast();

    // Wallet state
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [interestTransactions, setInterestTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [transactionLoading, setTransactionLoading] = useState(true);

    // UI state
    const [activeTab, setActiveTab] = useState('summary');
    const [activeTransactionType, setActiveTransactionType] = useState('all');

    // Transfer state
    const [transferTo, setTransferTo] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferNote, setTransferNote] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferError, setTransferError] = useState('');
    const [transferSuccess, setTransferSuccess] = useState('');

    // Deposit state
    const [depositAmount, setDepositAmount] = useState('');
    const [isDepositing, setIsDepositing] = useState(false);
    const [depositError, setDepositError] = useState('');
    const [depositSuccess, setDepositSuccess] = useState('');

    useEffect(() => {
        const loadWalletData = async () => {
            setLoading(true);
            if (!currentUser) return;

            try {
                // Set balance from UserContext if available
                if (userWallet && userWallet.balance !== undefined) {
                    setBalance(userWallet.balance);
                } else {
                    const walletData = await walletService.getUserWallet(currentUser.uid);
                    if (walletData) {
                        setBalance(walletData.balance || 0);
                    }
                }
            } catch (error) {
                console.error('Error loading wallet:', error);
                showError('Failed to load wallet information');
            } finally {
                setLoading(false);
            }
        };

        loadWalletData();
    }, [currentUser, userWallet, showError]);

    useEffect(() => {
        const loadTransactions = async () => {
            if (!currentUser) return;

            setTransactionLoading(true);
            try {
                // Load regular transactions
                const txData = await walletService.getTransactionHistory(currentUser.uid, 50);
                setTransactions(txData || []);

                // Load interest transactions
                const interestTxData = await interestService.getUserInterestTransactions(currentUser.uid, 20);
                setInterestTransactions(interestTxData || []);
            } catch (error) {
                console.error('Error loading transactions:', error);
                // Don't show an error toast here to avoid duplicate errors
            } finally {
                setTransactionLoading(false);
            }
        };

        loadTransactions();
    }, [currentUser, showError]);

    // Handle transfer submission
    const handleTransfer = async (e) => {
        e.preventDefault();

        // Reset status messages
        setTransferError('');
        setTransferSuccess('');

        // Validate inputs
        if (!transferTo.trim()) {
            setTransferError('Please enter a recipient email address');
            return;
        }

        const amount = parseFloat(transferAmount);
        if (isNaN(amount) || amount <= 0) {
            setTransferError('Please enter a valid amount greater than 0');
            return;
        }

        if (amount > balance) {
            setTransferError('Insufficient funds for this transfer');
            return;
        }

        setTransferLoading(true);

        try {
            const result = await walletService.transferFunds(
                currentUser.uid,
                transferTo,
                amount,
                transferNote
            );

            if (result.success) {
                setTransferSuccess('Transfer completed successfully!');
                // Update local balance
                setBalance(prevBalance => prevBalance - amount);
                // Clear form
                setTransferTo('');
                setTransferAmount('');
                setTransferNote('');
                // Show success toast
                showSuccess(`Successfully transferred ${formatCurrency(amount)} to ${transferTo}`);
            } else {
                setTransferError(result.error || 'Transfer failed. Please try again.');
            }
        } catch (error) {
            console.error('Transfer error:', error);
            setTransferError(error.message || 'An error occurred during transfer');
        } finally {
            setTransferLoading(false);
        }
    };

    // Handle deposit submission
    const handleDeposit = async (e) => {
        e.preventDefault();

        // Reset status messages
        setDepositError('');
        setDepositSuccess('');

        // Validate input
        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            setDepositError('Please enter a valid amount greater than 0');
            return;
        }

        setIsDepositing(true);

        try {
            // For demo, we'll simulate a successful deposit
            // In production, this would integrate with a payment processor
            const result = await walletService.simulateDeposit(
                currentUser.uid,
                amount,
                'Credit card deposit'
            );

            if (result.success) {
                // Update local balance
                setBalance(prevBalance => prevBalance + amount);
                // Clear form
                setDepositAmount('');
                // Set success message
                setDepositSuccess(`Successfully added ${formatCurrency(amount)} to your wallet`);
                // Show success toast
                showSuccess(`Added ${formatCurrency(amount)} to your wallet`);
            } else {
                setDepositError(result.error || 'Deposit failed. Please try again.');
            }
        } catch (error) {
            console.error('Deposit error:', error);
            setDepositError(error.message || 'An error occurred during deposit');
        } finally {
            setIsDepositing(false);
        }
    };

    // Filter transactions based on active type
    const filteredTransactions = () => {
        if (activeTransactionType === 'all') return transactions;
        return transactions.filter(tx => tx.type === activeTransactionType);
    };

    if (loading) {
        return (
            <div className="wallet-page">
                <div className="wallet-container loading">
                    <LoadingSpinner />
                    <p>Loading your wallet...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="wallet-page">
            <div className="wallet-container">
                <div className="wallet-header">
                    <h1>My Wallet</h1>
                    <div className="wallet-balance">
                        <h2>Current Balance</h2>
                        <div className="balance-amount">{formatCurrency(balance)}</div>
                    </div>
                </div>

                <div className="wallet-tabs">
                    <button
                        className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('summary')}
                    >
                        Summary
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'transfer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transfer')}
                    >
                        Transfer Funds
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
                        onClick={() => setActiveTab('add')}
                    >
                        Add Credits
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'interest' ? 'active' : ''}`}
                        onClick={() => setActiveTab('interest')}
                    >
                        Interest
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'summary' && (
                        <div className="summary-tab">
                            <div className="transaction-filters">
                                <h3>Transaction History</h3>
                                <div className="filter-buttons">
                                    <button
                                        className={activeTransactionType === 'all' ? 'active' : ''}
                                        onClick={() => setActiveTransactionType('all')}
                                    >
                                        All
                                    </button>
                                    <button
                                        className={activeTransactionType === 'deposit' ? 'active' : ''}
                                        onClick={() => setActiveTransactionType('deposit')}
                                    >
                                        Deposits
                                    </button>
                                    <button
                                        className={activeTransactionType === 'transfer' ? 'active' : ''}
                                        onClick={() => setActiveTransactionType('transfer')}
                                    >
                                        Transfers
                                    </button>
                                    <button
                                        className={activeTransactionType === 'purchase' ? 'active' : ''}
                                        onClick={() => setActiveTransactionType('purchase')}
                                    >
                                        Purchases
                                    </button>
                                </div>
                            </div>

                            {transactionLoading ? (
                                <div className="loading-transactions">
                                    <LoadingSpinner size="small" />
                                    <p>Loading transactions...</p>
                                </div>
                            ) : filteredTransactions().length === 0 ? (
                                <div className="no-transactions">
                                    <p>No transactions found.</p>
                                </div>
                            ) : (
                                <div className="transactions-list">
                                    {filteredTransactions().map(transaction => (
                                        <div key={transaction.id} className="transaction-item">
                                            <div className="transaction-icon">
                                                {transaction.type === 'deposit' && <span className="icon deposit">+</span>}
                                                {transaction.type === 'transfer' && <span className="icon transfer">↑</span>}
                                                {transaction.type === 'purchase' && <span className="icon purchase">-</span>}
                                            </div>
                                            <div className="transaction-details">
                                                <div className="transaction-description">
                                                    {transaction.description || 'Transaction'}
                                                </div>
                                                <div className="transaction-date">
                                                    {formatDate(transaction.createdAt)}
                                                </div>
                                            </div>
                                            <div className={`transaction-amount ${transaction.amount < 0 ? 'negative' : 'positive'}`}>
                                                {transaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'transfer' && (
                        <div className="transfer-tab">
                            <h3>Transfer Credits</h3>
                            <form onSubmit={handleTransfer} className="transfer-form">
                                <div className="form-group">
                                    <label htmlFor="transferTo">Recipient Email</label>
                                    <input
                                        type="email"
                                        id="transferTo"
                                        value={transferTo}
                                        onChange={(e) => setTransferTo(e.target.value)}
                                        placeholder="Enter recipient email"
                                        disabled={transferLoading}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="transferAmount">Amount</label>
                                    <div className="amount-input">
                                        <span className="currency-symbol">$</span>
                                        <input
                                            type="number"
                                            id="transferAmount"
                                            value={transferAmount}
                                            onChange={(e) => setTransferAmount(e.target.value)}
                                            placeholder="0.00"
                                            disabled={transferLoading}
                                            min="0.01"
                                            step="0.01"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="transferNote">Note (Optional)</label>
                                    <textarea
                                        id="transferNote"
                                        value={transferNote}
                                        onChange={(e) => setTransferNote(e.target.value)}
                                        placeholder="Add a note for the recipient"
                                        disabled={transferLoading}
                                        maxLength="100"
                                    ></textarea>
                                </div>

                                {transferError && <div className="error-message">{transferError}</div>}
                                {transferSuccess && <div className="success-message">{transferSuccess}</div>}

                                <button
                                    type="submit"
                                    className="transfer-button"
                                    disabled={transferLoading}
                                >
                                    {transferLoading ? (
                                        <>
                                            <LoadingSpinner size="small" />
                                            <span>Processing...</span>
                                        </>
                                    ) : 'Transfer Credits'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'add' && (
                        <div className="add-credits-tab">
                            <h3>Add Credits to Wallet</h3>
                            <form onSubmit={handleDeposit} className="deposit-form">
                                <div className="form-group">
                                    <label htmlFor="depositAmount">Amount to Add</label>
                                    <div className="amount-input">
                                        <span className="currency-symbol">$</span>
                                        <input
                                            type="number"
                                            id="depositAmount"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isDepositing}
                                            min="1"
                                            step="1"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="payment-methods">
                                    <h4>Payment Method</h4>
                                    <div className="payment-method-selector">
                                        <div className="payment-method active">
                                            <input
                                                type="radio"
                                                id="creditCard"
                                                name="paymentMethod"
                                                value="creditCard"
                                                defaultChecked
                                                disabled={isDepositing}
                                            />
                                            <label htmlFor="creditCard">
                                                Credit Card
                                                <div className="card-icons">
                                                    <span className="card-icon visa">Visa</span>
                                                    <span className="card-icon mastercard">Mastercard</span>
                                                    <span className="card-icon amex">Amex</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {depositError && <div className="error-message">{depositError}</div>}
                                {depositSuccess && <div className="success-message">{depositSuccess}</div>}

                                <button
                                    type="submit"
                                    className="deposit-button"
                                    disabled={isDepositing}
                                >
                                    {isDepositing ? (
                                        <>
                                            <LoadingSpinner size="small" />
                                            <span>Processing...</span>
                                        </>
                                    ) : 'Add Credits'}
                                </button>

                                <div className="security-note">
                                    <p>💳 Your payment information is securely processed.</p>
                                    <p>This is for demonstration purposes only. No actual charges will be made.</p>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'interest' && (
                        <div className="interest-tab">
                            <h3>Interest Earnings</h3>
                            <div className="interest-summary">
                                <div className="interest-card">
                                    <h4>Monthly Interest Rate</h4>
                                    <div className="interest-rate">3.5%</div>
                                    <p className="interest-note">Interest is calculated daily and paid monthly</p>
                                </div>
                            </div>

                            <h4>Interest History</h4>

                            {transactionLoading ? (
                                <div className="loading-transactions">
                                    <LoadingSpinner size="small" />
                                    <p>Loading interest history...</p>
                                </div>
                            ) : interestTransactions.length === 0 ? (
                                <div className="no-transactions">
                                    <p>No interest payments found.</p>
                                    <p>Interest is calculated daily and paid monthly based on your average wallet balance.</p>
                                </div>
                            ) : (
                                <div className="transactions-list">
                                    {interestTransactions.map(transaction => (
                                        <div key={transaction.id} className="transaction-item">
                                            <div className="transaction-icon">
                                                <span className="icon interest">%</span>
                                            </div>
                                            <div className="transaction-details">
                                                <div className="transaction-description">
                                                    {transaction.description || 'Interest Payment'}
                                                </div>
                                                <div className="transaction-date">
                                                    {formatDate(transaction.createdAt)}
                                                </div>
                                            </div>
                                            <div className="transaction-amount positive">
                                                +{formatCurrency(transaction.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalletPage;
