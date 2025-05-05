import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useToast } from '../contexts/ToastContext'; // Fixed import path with 's' in contexts
import LoadingSpinner from '../components/LoadingSpinner';
import walletService from '../services/walletService';
import interestService from '../services/interestService';
import InterestRatesPanel from '../components/InterestRatesPanel'; // Import InterestRatesPanel
import { formatCurrency, formatDate } from '../utils/formatters';
import { doc, onSnapshot } from 'firebase/firestore';  // Import for real-time updates
import { db } from '../config/firebase';  // Import Firestore db
import '../styles/WalletPage.css';

const WalletPage = () => {
    const { currentUser, userWallet, userRole, hasRole } = useUser();
    const { success: showSuccess, error: showError } = useToast(); // Map to correct function names

    // Wallet state
    const [balance, setBalance] = useState(userWallet?.balance || 0);
    const [transactions, setTransactions] = useState([]);
    const [interestTransactions, setInterestTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [transactionLoading, setTransactionLoading] = useState(true);

    // UI state
    const [activeTab, setActiveTab] = useState('summary');
    const [activeTransactionType, setActiveTransactionType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedMonths, setExpandedMonths] = useState({});

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

    // Role state
    const [userRoles, setUserRoles] = useState([]);

    // Initialize user roles
    useEffect(() => {
        if (userRole) {
            // Convert to array if it's a single string
            const roles = Array.isArray(userRole) ? userRole : [userRole];
            setUserRoles(roles);
        } else {
            setUserRoles(['customer']); // Default role
        }
    }, [userRole]);

    // Keep balance in sync with userWallet from context
    useEffect(() => {
        if (userWallet && userWallet.balance !== undefined) {
            setBalance(userWallet.balance);
        }
    }, [userWallet]);

    // Function to determine if user has a specific role
    const userHasRole = (role) => {
        return userRoles.includes(role);
    };

    // Function to determine if user has access to specific tabs
    const canAccessTab = (tabName) => {
        // All users can access these tabs
        if (['summary'].includes(tabName)) return true;

        // Only admins can access the "add" tab
        if (tabName === 'add') return userHasRole('admin');

        // Transfer funds require any role beyond customer
        if (tabName === 'transfer') return userRoles.length > 0;

        // Interest tab requires investor role
        if (tabName === 'interest') {
            return userHasRole('investor');
        }

        return true;
    };

    // Memoize loadWalletData to prevent recreation on each render
    const loadWalletData = useCallback(async () => {
        setLoading(true);
        if (!currentUser) {
            // Instead of returning, we'll wait for the user context to be available
            console.log("Waiting for user authentication...");
            setTimeout(() => {
                if (currentUser) {
                    loadWalletData();
                } else {
                    setLoading(false);
                }
            }, 2000);
            return;
        }

        try {
            // Get the most up-to-date wallet data
            const walletData = await walletService.getUserWallet(currentUser.uid);
            if (walletData) {
                setBalance(walletData.balance || 0);
            }
        } catch (error) {
            console.error('Error loading wallet:', error);
            showError('Failed to load wallet information');
        } finally {
            setLoading(false);
        }
    }, [currentUser, showError]);

    // Set up real-time listener for wallet updates
    useEffect(() => {
        if (!currentUser) return;

        const walletRef = doc(db, "wallets", currentUser.uid);

        // Real-time listener for wallet updates
        const unsubscribe = onSnapshot(walletRef,
            (walletDoc) => {
                if (walletDoc.exists()) {
                    const walletData = walletDoc.data();
                    setBalance(walletData.balance || 0);
                }
            },
            (error) => {
                console.error("Error in wallet listener:", error);
                // Fallback to manual fetch if real-time updates fail
                loadWalletData();
            }
        );

        // Initial load
        loadWalletData();

        return () => unsubscribe();
    }, [currentUser, loadWalletData]);

    // Real-time listener for transactions
    useEffect(() => {
        const loadTransactions = async () => {
            if (!currentUser) {
                // If no user yet, set a timeout to check again
                setTimeout(() => {
                    if (currentUser) {
                        loadTransactions();
                    } else {
                        setTransactionLoading(false);
                    }
                }, 2000);
                return;
            }

            setTransactionLoading(true);
            try {
                // Load regular transactions - remove limit to show all
                const txData = await walletService.getTransactionHistory(currentUser.uid);
                setTransactions(txData || []);

                // Load interest transactions if user is an investor
                if (userHasRole('investor')) {
                    // No limit for interest transactions either
                    const interestTxData = await interestService.getUserInterestTransactions(currentUser.uid);
                    setInterestTransactions(interestTxData || []);
                }
            } catch (error) {
                console.error('Error loading transactions:', error);
                // Don't show an error toast here to avoid duplicate errors
            } finally {
                setTransactionLoading(false);
            }
        };

        loadTransactions();

        // Set up a refresh interval for transactions (every 30 seconds)
        const intervalId = setInterval(loadTransactions, 30000);

        return () => clearInterval(intervalId);
    }, [currentUser, userRoles, userHasRole]);

    // Handle wallet refresh button click
    const handleRefreshWallet = async () => {
        try {
            const walletData = await walletService.getUserWallet(currentUser.uid);
            if (walletData) {
                setBalance(walletData.balance || 0);
                showSuccess("Wallet updated successfully");
            }
        } catch (error) {
            console.error('Error refreshing wallet:', error);
            showError('Failed to refresh wallet information');
        }
    };

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
                // Balance will be updated automatically by the listener
                // Clear form
                setTransferTo('');
                setTransferAmount('');
                setTransferNote('');
                // Show success toast
                showSuccess(`Successfully transferred ${formatCurrency(amount)} to ${transferTo}`);

                // Refresh transactions - removed limit to get all transactions
                const txData = await walletService.getTransactionHistory(currentUser.uid);
                setTransactions(txData || []);
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
                // Clear form
                setDepositAmount('');
                // Set success message
                setDepositSuccess(`Successfully added ${formatCurrency(amount)} to your wallet`);
                // Show success toast
                showSuccess(`Added ${formatCurrency(amount)} to your wallet`);

                // Refresh transactions immediately - removed limit to show all transactions
                const txData = await walletService.getTransactionHistory(currentUser.uid);
                setTransactions(txData || []);
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

    // Filter and search transactions
    const filteredAndSearchedTransactions = () => {
        // First filter by type
        let filtered = activeTransactionType === 'all'
            ? transactions
            : transactions.filter(tx => tx.type === activeTransactionType);

        // Then filter by search query if one exists
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(tx =>
                (tx.description && tx.description.toLowerCase().includes(query)) ||
                (tx.amount && tx.amount.toString().includes(query)) ||
                (tx.type && tx.type.toLowerCase().includes(query))
            );
        }

        return filtered;
    };

    // Group transactions by month
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

    // Toggle month expansion
    const toggleMonthExpansion = (monthId) => {
        setExpandedMonths(prev => ({
            ...prev,
            [monthId]: !prev[monthId]
        }));
    };

    // Check if month is expanded
    const isMonthExpanded = (monthId) => {
        // If it's undefined (not set yet), default to true for first month, false for others
        return expandedMonths[monthId] !== undefined
            ? expandedMonths[monthId]
            : monthId === Object.keys(groupTransactionsByMonth(filteredAndSearchedTransactions()))[0];
    };

    // Render roles badges 
    const renderRoleBadges = () => {
        // If no roles are set, show default customer role
        if (!userRoles || userRoles.length === 0) {
            return (
                <div className="roles-list">
                    <div className="role-pill customer">Customer</div>
                </div>
            );
        }

        // Display all roles
        return (
            <div className="roles-list">
                {userRoles.map((role, index) => (
                    <div key={index} className={`role-pill ${role.toLowerCase()}`}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="wallet-page">
                <div className="wallet-container loading">
                    <LoadingSpinner size="medium" showText={true} text="Loading your wallet..." />
                </div>
            </div>
        );
    }

    return (
        <div className="wallet-page">
            <div className="wallet-container">
                <div className="wallet-header">
                    <h1>My Wallet</h1>
                    {renderRoleBadges()}
                    <div className="balance-card">
                        <button className="refresh-button" onClick={handleRefreshWallet} aria-label="Refresh wallet">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                            </svg>
                        </button>
                        <div className="balance-header">Current Balance</div>
                        <div className="balance-amount">{formatCurrency(balance)}</div>
                        <div className="balance-updated">Last updated: {formatDate(new Date())}</div>
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

                    {/* Only show Add Credits tab for admins */}
                    {userHasRole('admin') && (
                        <button
                            className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
                            onClick={() => setActiveTab('add')}
                        >
                            Add Credits
                        </button>
                    )}

                    {userHasRole('investor') && (
                        <button
                            className={`tab-button ${activeTab === 'interest' ? 'active' : ''}`}
                            onClick={() => setActiveTab('interest')}
                        >
                            Interest
                        </button>
                    )}
                </div>

                <div className="tab-content">
                    {activeTab === 'summary' && (
                        <div className="summary-tab">
                            <div className="transaction-filters">
                                <h3>Transaction History</h3>
                                <div className="search-bar">
                                    <input
                                        type="text"
                                        placeholder="Search transactions..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="transaction-search"
                                    />
                                    {searchQuery && (
                                        <button
                                            className="clear-search"
                                            onClick={() => setSearchQuery('')}
                                            aria-label="Clear search"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
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
                                    <LoadingSpinner size="small" showText={true} text="Loading transactions..." inline={true} />
                                </div>
                            ) : filteredAndSearchedTransactions().length === 0 ? (
                                <div className="no-transactions">
                                    {searchQuery ? (
                                        <p>No transactions match your search for "{searchQuery}".</p>
                                    ) : (
                                        <p>No {activeTransactionType !== 'all' ? activeTransactionType : ''} transactions found.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="transactions-list">
                                    {groupTransactionsByMonth(filteredAndSearchedTransactions()).map(month => (
                                        <div key={month.id} className="month-group">
                                            <div
                                                className="month-header"
                                                onClick={() => toggleMonthExpansion(month.id)}
                                            >
                                                <h4>{month.name}</h4>
                                                <div className="month-summary">
                                                    <span>{month.transactions.length} transaction{month.transactions.length !== 1 ? 's' : ''}</span>
                                                    <span className="expand-icon">
                                                        {isMonthExpanded(month.id) ? '▼' : '►'}
                                                    </span>
                                                </div>
                                            </div>

                                            {isMonthExpanded(month.id) && (
                                                <div className="month-transactions">
                                                    {month.transactions.map(transaction => (
                                                        <div key={transaction.id} className="transaction-item">
                                                            <div className="transaction-icon">
                                                                {transaction.type === 'deposit' && <span className="icon deposit">+</span>}
                                                                {transaction.type === 'transfer' && <span className="icon transfer">↑</span>}
                                                                {transaction.type === 'purchase' && <span className="icon purchase">-</span>}
                                                                {transaction.type === 'investment' && <span className="icon investment">↗</span>}
                                                                {transaction.type === 'interest' && <span className="icon interest">%</span>}
                                                                {!['deposit', 'transfer', 'purchase', 'investment', 'interest'].includes(transaction.type) &&
                                                                    <span className="icon other">•</span>}
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
                                            <LoadingSpinner size="small" inline={true} />
                                            <span className="button-text">Processing...</span>
                                        </>
                                    ) : 'Transfer Credits'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'add' && userHasRole('admin') && (
                        <div className="add-credits-tab">
                            <h3>Add Credits to Wallet</h3>
                            <div className="admin-notice">
                                You are adding credits as an administrator. This feature is only available to admin users.
                            </div>
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
                                                Admin Credit Addition
                                                <div className="admin-note">
                                                    <span>Credits are added directly to the wallet balance</span>
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
                                            <LoadingSpinner size="small" inline={true} />
                                            <span className="button-text">Processing...</span>
                                        </>
                                    ) : 'Add Credits'}
                                </button>

                                <div className="security-note admin-security-note">
                                    <p>⚠️ This is an administrative action that will directly add credits to the wallet.</p>
                                    <p>All transactions are recorded and audited.</p>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'interest' && userHasRole('investor') && (
                        <div className="interest-tab">
                            <h3>Interest Earnings</h3>
                            <InterestRatesPanel />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalletPage;
