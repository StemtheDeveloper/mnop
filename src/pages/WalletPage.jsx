import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import InterestRatesPanel from '../components/InterestRatesPanel';
import InterestHistory from '../components/InterestHistory';
import '../styles/WalletPage.css';

const WalletPage = () => {
    const {
        currentUser,
        walletBalance,
        walletLoading,
        getWalletBalance,
        addCredits,
        subtractCredits,
        transferCredits,
        getTransactionHistory
    } = useUser();

    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [transferData, setTransferData] = useState({
        recipientId: '',
        amount: '',
        description: ''
    });
    const [depositData, setDepositData] = useState({
        amount: '',
        description: ''
    });
    const [transferError, setTransferError] = useState('');
    const [transferSuccess, setTransferSuccess] = useState('');
    const [depositError, setDepositError] = useState('');
    const [depositSuccess, setDepositSuccess] = useState('');

    // Load wallet data on component mount
    useEffect(() => {
        loadWalletData();
    }, [currentUser]);

    const loadWalletData = async () => {
        setLoading(true);
        try {
            // Refresh wallet balance
            await getWalletBalance();

            // Get transaction history
            const history = await getTransactionHistory(10);
            setTransactions(history);
        } catch (error) {
            console.error("Error loading wallet data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Handle transfer form input changes
    const handleTransferChange = (e) => {
        const { name, value } = e.target;
        setTransferData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle deposit form input changes
    const handleDepositChange = (e) => {
        const { name, value } = e.target;
        setDepositData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle transfer submission
    const handleTransfer = async (e) => {
        e.preventDefault();
        setTransferError('');
        setTransferSuccess('');

        // Validate input
        if (!transferData.recipientId || !transferData.amount || !transferData.description) {
            setTransferError('Please fill out all fields');
            return;
        }

        // Validate amount is a positive number
        const amount = parseFloat(transferData.amount);
        if (isNaN(amount) || amount <= 0) {
            setTransferError('Please enter a valid positive amount');
            return;
        }

        // Check if recipient is the same as sender
        if (transferData.recipientId === currentUser.uid) {
            setTransferError('You cannot transfer credits to yourself');
            return;
        }

        try {
            const success = await transferCredits(
                transferData.recipientId,
                amount,
                transferData.description
            );

            if (success) {
                setTransferSuccess('Transfer completed successfully!');
                // Reset form
                setTransferData({
                    recipientId: '',
                    amount: '',
                    description: ''
                });
                // Reload wallet data
                loadWalletData();
            } else {
                setTransferError('Transfer failed. Please check recipient ID and try again.');
            }
        } catch (error) {
            setTransferError(error.message || 'An error occurred during the transfer');
        }
    };

    // Handle deposit submission (for demonstration)
    const handleDeposit = async (e) => {
        e.preventDefault();
        setDepositError('');
        setDepositSuccess('');

        // Validate input
        if (!depositData.amount || !depositData.description) {
            setDepositError('Please fill out all fields');
            return;
        }

        // Validate amount is a positive number
        const amount = parseFloat(depositData.amount);
        if (isNaN(amount) || amount <= 0) {
            setDepositError('Please enter a valid positive amount');
            return;
        }

        try {
            // In a real app, this would likely integrate with a payment gateway
            // For demo purposes, we're just adding credits directly
            const success = await addCredits(amount, depositData.description);

            if (success) {
                setDepositSuccess('Credits added successfully!');
                // Reset form
                setDepositData({
                    amount: '',
                    description: ''
                });
                // Reload wallet data
                loadWalletData();
            } else {
                setDepositError('Failed to add credits. Please try again.');
            }
        } catch (error) {
            setDepositError(error.message || 'An error occurred while adding credits');
        }
    };

    // Format timestamp
    const formatDate = (timestamp) => {
        if (!timestamp || !timestamp.seconds) return 'N/A';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleString();
    };

    // Format amount with currency symbol
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    if (loading || walletLoading) {
        return (
            <div className="wallet-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading wallet data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="wallet-page">
            <div className="wallet-container">
                <h1>Virtual Wallet</h1>

                <div className="balance-card">
                    <div className="balance-header">Your Balance</div>
                    <div className="balance-amount">{formatCurrency(walletBalance || 0)}</div>
                    <button
                        className="refresh-button"
                        onClick={loadWalletData}
                        aria-label="Refresh wallet data"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                        </svg>
                    </button>
                </div>

                <div className="wallet-tabs">
                    <button
                        className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'interest' ? 'active' : ''}`}
                        onClick={() => setActiveTab('interest')}
                    >
                        Interest
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'transfer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transfer')}
                    >
                        Transfer
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'deposit' ? 'active' : ''}`}
                        onClick={() => setActiveTab('deposit')}
                    >
                        Add Credits
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'overview' && (
                        <div className="overview-tab">
                            <h2>Recent Transactions</h2>

                            {transactions.length === 0 ? (
                                <div className="no-transactions">
                                    <p>No transaction history yet.</p>
                                </div>
                            ) : (
                                <div className="transaction-list">
                                    {transactions.map(transaction => (
                                        <div
                                            key={transaction.id}
                                            className={`transaction-item ${transaction.type}`}
                                        >
                                            <div className="transaction-icon">
                                                {transaction.type === 'credit' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <polyline points="19 12 12 19 5 12"></polyline>
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="19" x2="12" y2="5"></line>
                                                        <polyline points="5 12 12 5 19 12"></polyline>
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="transaction-details">
                                                <div className="transaction-description">{transaction.description}</div>
                                                <div className="transaction-date">{formatDate(transaction.createdAt)}</div>
                                            </div>
                                            <div className="transaction-amount">
                                                {transaction.type === 'credit' ? '+' : '-'} {formatCurrency(transaction.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Interest Rates Section */}
                            <InterestRatesPanel walletBalance={walletBalance || 0} />
                        </div>
                    )}

                    {activeTab === 'interest' && (
                        <div className="interest-tab">
                            <h2>Interest Earnings</h2>
                            <p className="interest-info">
                                Earn daily interest on your wallet balance. Interest is calculated and paid daily at midnight UTC.
                            </p>

                            <InterestRatesPanel walletBalance={walletBalance || 0} />

                            <div className="interest-history-section">
                                <InterestHistory limit={15} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'transfer' && (
                        <div className="transfer-tab">
                            <h2>Transfer Credits</h2>

                            {transferError && <div className="error-message">{transferError}</div>}
                            {transferSuccess && <div className="success-message">{transferSuccess}</div>}

                            <form className="transfer-form" onSubmit={handleTransfer}>
                                <div className="form-group">
                                    <label htmlFor="recipientId">Recipient ID</label>
                                    <input
                                        type="text"
                                        id="recipientId"
                                        name="recipientId"
                                        value={transferData.recipientId}
                                        onChange={handleTransferChange}
                                        placeholder="Enter recipient's user ID"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="amount">Amount</label>
                                    <input
                                        type="number"
                                        id="amount"
                                        name="amount"
                                        value={transferData.amount}
                                        onChange={handleTransferChange}
                                        placeholder="Enter amount to transfer"
                                        min="1"
                                        step="any"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description">Description</label>
                                    <input
                                        type="text"
                                        id="description"
                                        name="description"
                                        value={transferData.description}
                                        onChange={handleTransferChange}
                                        placeholder="What's this transfer for?"
                                        required
                                    />
                                </div>

                                <button type="submit" className="transfer-button">
                                    Transfer Credits
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'deposit' && (
                        <div className="deposit-tab">
                            <h2>Add Credits</h2>

                            {depositError && <div className="error-message">{depositError}</div>}
                            {depositSuccess && <div className="success-message">{depositSuccess}</div>}

                            <form className="deposit-form" onSubmit={handleDeposit}>
                                <div className="form-group">
                                    <label htmlFor="deposit-amount">Amount</label>
                                    <input
                                        type="number"
                                        id="deposit-amount"
                                        name="amount"
                                        value={depositData.amount}
                                        onChange={handleDepositChange}
                                        placeholder="Enter amount to add"
                                        min="1"
                                        step="any"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="deposit-description">Description</label>
                                    <input
                                        type="text"
                                        id="deposit-description"
                                        name="description"
                                        value={depositData.description}
                                        onChange={handleDepositChange}
                                        placeholder="Why are you adding credits?"
                                        required
                                    />
                                </div>

                                <button type="submit" className="deposit-button">
                                    Add Credits
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalletPage;
