import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../contexts/ToastContext';
import refundService from '../../services/refundService';
import LoadingSpinner from '../LoadingSpinner';
import '../../styles/admin/RefundManagementPanel.css';

const RefundManagementPanel = () => {
    const { currentUser, hasRole } = useUser();
    const { showSuccess, showError } = useToast();

    // State for active tab (refundable or history)
    const [activeTab, setActiveTab] = useState('refundable');

    // State for refundable orders
    const [refundableOrders, setRefundableOrders] = useState([]);
    const [refundableLastVisible, setRefundableLastVisible] = useState(null);
    const [hasMoreRefundable, setHasMoreRefundable] = useState(false);

    // State for refund history
    const [refundHistory, setRefundHistory] = useState([]);
    const [historyLastVisible, setHistoryLastVisible] = useState(null);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);

    // State for loading and errors
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for order detail modal
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

    // State for refund form
    const [refundReason, setRefundReason] = useState('');
    const [refundAll, setRefundAll] = useState(true);
    const [selectedItems, setSelectedItems] = useState([]);
    const [processingRefund, setProcessingRefund] = useState(false);

    // New search and filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState({
        startDate: '',
        endDate: ''
    });
    const [statusFilter, setStatusFilter] = useState('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);
    const [searchResultsCount, setSearchResultsCount] = useState(0);
    const [orderBy, setOrderBy] = useState('date_desc');

    // Fetch orders on component mount and tab change
    useEffect(() => {
        if (!currentUser || !hasRole('admin')) return;

        fetchOrders();
    }, [currentUser, hasRole, activeTab]);

    // Function to fetch orders based on active tab
    const fetchOrders = async (isLoadMore = false) => {
        if (!currentUser) return;

        setLoading(true);
        setError(null);

        try {
            if (activeTab === 'refundable') {
                const result = await refundService.getRefundableOrders(
                    10,
                    isLoadMore ? refundableLastVisible : null
                );

                if (result.success) {
                    setRefundableOrders(prev =>
                        isLoadMore ? [...prev, ...result.data] : result.data
                    );
                    setRefundableLastVisible(result.lastVisible);
                    setHasMoreRefundable(result.hasMore);
                } else {
                    setError(result.error || 'Failed to load refundable orders');
                }
            } else {
                const result = await refundService.getRefundedOrders(
                    10,
                    isLoadMore ? historyLastVisible : null
                );

                if (result.success) {
                    setRefundHistory(prev =>
                        isLoadMore ? [...prev, ...result.data] : result.data
                    );
                    setHistoryLastVisible(result.lastVisible);
                    setHasMoreHistory(result.hasMore);
                } else {
                    setError(result.error || 'Failed to load refund history');
                }
            }
        } catch (err) {
            console.error(`Error fetching ${activeTab} orders:`, err);
            setError(`Failed to load ${activeTab} orders`);
        } finally {
            setLoading(false);
        }
    };

    // Search for orders
    const searchOrders = async () => {
        if (!currentUser) return;

        setIsSearching(true);
        setError(null);

        try {
            const filters = {
                searchTerm,
                startDate: dateFilter.startDate || null,
                endDate: dateFilter.endDate || null,
                status: statusFilter !== 'all' ? statusFilter : null,
                minAmount: minAmount ? parseFloat(minAmount) : null,
                maxAmount: maxAmount ? parseFloat(maxAmount) : null,
                orderBy,
                isRefundableOnly: activeTab === 'refundable',
                isRefundedOnly: activeTab === 'history'
            };

            const result = await refundService.searchOrders(filters);

            if (result.success) {
                setSearchResults(result.data);
                setSearchResultsCount(result.count || result.data.length);
                setSearchPerformed(true);
            } else {
                setError(result.error || 'Failed to search orders');
            }
        } catch (err) {
            console.error('Error searching orders:', err);
            setError('Failed to search orders');
        } finally {
            setIsSearching(false);
        }
    };

    // Reset search
    const resetSearch = () => {
        setSearchTerm('');
        setDateFilter({ startDate: '', endDate: '' });
        setStatusFilter('all');
        setMinAmount('');
        setMaxAmount('');
        setOrderBy('date_desc');
        setSearchResults([]);
        setSearchPerformed(false);
        fetchOrders();
    };

    // Handle load more
    const handleLoadMore = () => {
        fetchOrders(true);
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    // Format date
    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    };

    // Generate a download URL for all refundable orders
    const getExportUrl = () => {
        const baseUrl = '/api/export-refundable-orders';
        const params = new URLSearchParams();
        
        if (searchTerm) params.append('searchTerm', searchTerm);
        if (dateFilter.startDate) params.append('startDate', dateFilter.startDate);
        if (dateFilter.endDate) params.append('endDate', dateFilter.endDate);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (minAmount) params.append('minAmount', minAmount);
        if (maxAmount) params.append('maxAmount', maxAmount);
        if (activeTab === 'history') params.append('isRefunded', 'true');
        
        return `${baseUrl}?${params.toString()}`;
    };

    // Open order detail modal
    const openOrderDetail = async (orderId) => {
        setLoading(true);

        try {
            const result = await refundService.getOrderById(orderId);

            if (result.success) {
                setSelectedOrder(result.data);
                setIsRefundModalOpen(true);
                // Reset refund form
                setRefundReason('');
                setRefundAll(true);
                setSelectedItems([]);
            } else {
                showError(result.error || 'Failed to fetch order details');
            }
        } catch (err) {
            console.error('Error fetching order details:', err);
            showError('Failed to fetch order details');
        } finally {
            setLoading(false);
        }
    };

    // Close order detail modal
    const closeOrderDetail = () => {
        setIsRefundModalOpen(false);
        setSelectedOrder(null);
    };

    // Handle item selection for partial refunds
    const toggleItemSelection = (itemId) => {
        setSelectedItems(prev => {
            if (prev.includes(itemId)) {
                return prev.filter(id => id !== itemId);
            } else {
                return [...prev, itemId];
            }
        });
    };

    // Process refund
    const processRefund = async () => {
        if (!selectedOrder) return;

        if (refundReason.trim() === '') {
            showError('Please provide a reason for the refund');
            return;
        }

        if (!refundAll && selectedItems.length === 0) {
            showError('Please select at least one item to refund');
            return;
        }

        setProcessingRefund(true);

        try {
            const result = await refundService.processRefund(
                selectedOrder.id,
                currentUser.uid,
                refundReason,
                refundAll,
                selectedItems
            );

            if (result.success) {
                showSuccess(result.message || 'Refund processed successfully');
                closeOrderDetail();

                // Refresh the lists
                if (searchPerformed) {
                    searchOrders();
                } else {
                    fetchOrders();
                }
            } else {
                showError(result.error || 'Failed to process refund');
            }
        } catch (err) {
            console.error('Error processing refund:', err);
            showError('Failed to process refund');
        } finally {
            setProcessingRefund(false);
        }
    };

    // Handle sort change
    const handleSortChange = (e) => {
        setOrderBy(e.target.value);
    };

    // If not admin, show access denied
    if (!currentUser || !hasRole('admin')) {
        return (
            <div className="admin-panel refund-management-panel">
                <div className="panel-header">
                    <h3>Refund Management</h3>
                </div>
                <div className="access-denied">
                    <h4>Access Denied</h4>
                    <p>You need administrator privileges to access this panel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-panel refund-management-panel">
            <div className="panel-header">
                <h3>Refund Management</h3>
                <p className="panel-description">
                    Manage refund requests and process refunds for customer orders.
                </p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'refundable' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('refundable');
                        resetSearch();
                    }}
                >
                    Refundable Orders
                </button>
                <button
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('history');
                        resetSearch();
                    }}
                >
                    Refund History
                </button>
            </div>

            {/* Advanced Search Form */}
            <div className="search-filters">
                <div className="search-form">
                    <div className="search-row">
                        <div className="search-field">
                            <label>Search:</label>
                            <input
                                type="text"
                                placeholder="Order ID, Customer email, or name"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="search-field date-range">
                            <label>Date Range:</label>
                            <div className="date-inputs">
                                <input
                                    type="date"
                                    value={dateFilter.startDate}
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    value={dateFilter.endDate}
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="search-row">
                        <div className="search-field">
                            <label>Status:</label>
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="completed">Completed</option>
                                <option value="delivered">Delivered</option>
                                <option value="processing">Processing</option>
                                <option value="shipped">Shipped</option>
                            </select>
                        </div>
                        <div className="search-field">
                            <label>Order By:</label>
                            <select 
                                value={orderBy} 
                                onChange={handleSortChange}
                            >
                                <option value="date_desc">Newest First</option>
                                <option value="date_asc">Oldest First</option>
                                <option value="amount_desc">Highest Amount</option>
                                <option value="amount_asc">Lowest Amount</option>
                            </select>
                        </div>
                    </div>
                    <div className="search-row">
                        <div className="search-field amount-range">
                            <label>Amount Range:</label>
                            <div className="amount-inputs">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                                <span>to</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>
                        <div className="search-field search-actions">
                            <button className="search-button" onClick={searchOrders} disabled={isSearching}>
                                {isSearching ? 'Searching...' : 'Search Orders'}
                            </button>
                            <button className="reset-button" onClick={resetSearch} disabled={isSearching}>
                                Reset
                            </button>
                            <a href={getExportUrl()} className="export-button" download>
                                Export to CSV
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="tab-content">
                {(loading && !isRefundModalOpen && !isSearching) ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        {/* Search Results */}
                        {searchPerformed && (
                            <div className="search-results-summary">
                                Found {searchResultsCount} {activeTab === 'refundable' ? 'refundable orders' : 'refunded orders'} matching your criteria
                            </div>
                        )}

                        {/* Refundable Orders Tab */}
                        {activeTab === 'refundable' && (
                            <div className="refundable-orders">
                                {searchPerformed ? (
                                    searchResults.length === 0 ? (
                                        <div className="no-orders">
                                            <p>No orders found matching your search criteria</p>
                                        </div>
                                    ) : (
                                        <div className="orders-table">
                                            <div className="table-header">
                                                <div className="col">Order ID</div>
                                                <div className="col">Date</div>
                                                <div className="col">Customer</div>
                                                <div className="col">Total</div>
                                                <div className="col">Status</div>
                                                <div className="col">Actions</div>
                                            </div>

                                            {searchResults.map(order => (
                                                <div key={order.id} className="table-row">
                                                    <div className="col order-id">#{order.id.slice(-6)}</div>
                                                    <div className="col">{formatDate(order.createdAt)}</div>
                                                    <div className="col">{order.shippingInfo?.email || 'N/A'}</div>
                                                    <div className="col">{formatCurrency(order.total)}</div>
                                                    <div className="col">
                                                        <span className={`status-badge ${order.status}`}>
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                    <div className="col actions">
                                                        <button
                                                            className="view-button"
                                                            onClick={() => openOrderDetail(order.id)}
                                                        >
                                                            View & Refund
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    refundableOrders.length === 0 ? (
                                        <div className="no-orders">
                                            <p>No refundable orders found</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="orders-table">
                                                <div className="table-header">
                                                    <div className="col">Order ID</div>
                                                    <div className="col">Date</div>
                                                    <div className="col">Customer</div>
                                                    <div className="col">Total</div>
                                                    <div className="col">Status</div>
                                                    <div className="col">Actions</div>
                                                </div>

                                                {refundableOrders.map(order => (
                                                    <div key={order.id} className="table-row">
                                                        <div className="col order-id">#{order.id.slice(-6)}</div>
                                                        <div className="col">{formatDate(order.createdAt)}</div>
                                                        <div className="col">{order.shippingInfo?.email || 'N/A'}</div>
                                                        <div className="col">{formatCurrency(order.total)}</div>
                                                        <div className="col">
                                                            <span className={`status-badge ${order.status}`}>
                                                                {order.status}
                                                            </span>
                                                        </div>
                                                        <div className="col actions">
                                                            <button
                                                                className="view-button"
                                                                onClick={() => openOrderDetail(order.id)}
                                                            >
                                                                View & Refund
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {hasMoreRefundable && !searchPerformed && (
                                                <div className="load-more">
                                                    <button onClick={handleLoadMore}>
                                                        Load More
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )
                                )}
                            </div>
                        )}

                        {/* Refund History Tab */}
                        {activeTab === 'history' && (
                            <div className="refund-history">
                                {searchPerformed ? (
                                    searchResults.length === 0 ? (
                                        <div className="no-orders">
                                            <p>No refund history found matching your search criteria</p>
                                        </div>
                                    ) : (
                                        <div className="orders-table">
                                            <div className="table-header">
                                                <div className="col">Order ID</div>
                                                <div className="col">Refund Date</div>
                                                <div className="col">Customer</div>
                                                <div className="col">Amount</div>
                                                <div className="col">Reason</div>
                                                <div className="col">Actions</div>
                                            </div>

                                            {searchResults.map(order => (
                                                <div key={order.id} className="table-row">
                                                    <div className="col order-id">#{order.id.slice(-6)}</div>
                                                    <div className="col">{formatDate(order.refundDate)}</div>
                                                    <div className="col">{order.shippingInfo?.email || 'N/A'}</div>
                                                    <div className="col">{formatCurrency(order.refundAmount)}</div>
                                                    <div className="col reason-col">{order.refundReason || 'N/A'}</div>
                                                    <div className="col actions">
                                                        <button
                                                            className="view-button"
                                                            onClick={() => openOrderDetail(order.id)}
                                                        >
                                                            View Details
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    refundHistory.length === 0 ? (
                                        <div className="no-orders">
                                            <p>No refund history found</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="orders-table">
                                                <div className="table-header">
                                                    <div className="col">Order ID</div>
                                                    <div className="col">Refund Date</div>
                                                    <div className="col">Customer</div>
                                                    <div className="col">Amount</div>
                                                    <div className="col">Reason</div>
                                                    <div className="col">Actions</div>
                                                </div>

                                                {refundHistory.map(order => (
                                                    <div key={order.id} className="table-row">
                                                        <div className="col order-id">#{order.id.slice(-6)}</div>
                                                        <div className="col">{formatDate(order.refundDate)}</div>
                                                        <div className="col">{order.shippingInfo?.email || 'N/A'}</div>
                                                        <div className="col">{formatCurrency(order.refundAmount)}</div>
                                                        <div className="col reason-col">{order.refundReason || 'N/A'}</div>
                                                        <div className="col actions">
                                                            <button
                                                                className="view-button"
                                                                onClick={() => openOrderDetail(order.id)}
                                                            >
                                                                View Details
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {hasMoreHistory && !searchPerformed && (
                                                <div className="load-more">
                                                    <button onClick={handleLoadMore}>
                                                        Load More
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Refund Modal */}
            {isRefundModalOpen && selectedOrder && (
                <div className="modal-overlay">
                    <div className="refund-modal">
                        <div className="modal-header">
                            <h3>
                                {selectedOrder.refundStatus === 'refunded'
                                    ? 'Refunded Order Details'
                                    : 'Process Refund'}
                            </h3>
                            <button className="close-button" onClick={closeOrderDetail}>×</button>
                        </div>

                        <div className="modal-content">
                            <div className="order-details">
                                <div className="detail-row">
                                    <span>Order ID:</span>
                                    <span>#{selectedOrder.id.slice(-6)}</span>
                                </div>
                                <div className="detail-row">
                                    <span>Order Date:</span>
                                    <span>{formatDate(selectedOrder.createdAt)}</span>
                                </div>
                                <div className="detail-row">
                                    <span>Customer:</span>
                                    <span>
                                        {selectedOrder.shippingInfo?.fullName || 'N/A'}
                                        ({selectedOrder.shippingInfo?.email || 'N/A'})
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span>Total:</span>
                                    <span>{formatCurrency(selectedOrder.total)}</span>
                                </div>
                                <div className="detail-row">
                                    <span>Status:</span>
                                    <span className={`status-badge ${selectedOrder.status}`}>
                                        {selectedOrder.status}
                                    </span>
                                </div>
                                {selectedOrder.refundStatus === 'refunded' && (
                                    <>
                                        <div className="detail-row">
                                            <span>Refund Date:</span>
                                            <span>{formatDate(selectedOrder.refundDate)}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span>Refund Amount:</span>
                                            <span>{formatCurrency(selectedOrder.refundAmount)}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span>Refund Reason:</span>
                                            <span>{selectedOrder.refundReason || 'N/A'}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="order-items">
                                <h4>Order Items</h4>
                                <div className="items-table">
                                    <div className="item-header">
                                        {selectedOrder.refundStatus !== 'refunded' && !refundAll && (
                                            <div className="col-select">Select</div>
                                        )}
                                        <div className="col-name">Product</div>
                                        <div className="col-price">Price</div>
                                        <div className="col-qty">Qty</div>
                                        <div className="col-subtotal">Subtotal</div>
                                    </div>

                                    {selectedOrder.items.map((item, index) => (
                                        <div key={index} className="item-row">
                                            {selectedOrder.refundStatus !== 'refunded' && !refundAll && (
                                                <div className="col-select">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.includes(item.id)}
                                                        onChange={() => toggleItemSelection(item.id)}
                                                    />
                                                </div>
                                            )}
                                            <div className="col-name">{item.name}</div>
                                            <div className="col-price">{formatCurrency(item.price)}</div>
                                            <div className="col-qty">{item.quantity}</div>
                                            <div className="col-subtotal">{formatCurrency(item.price * item.quantity)}</div>
                                        </div>
                                    ))}

                                    <div className="item-totals">
                                        <div className="total-row">
                                            <span>Subtotal:</span>
                                            <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                        </div>
                                        <div className="total-row">
                                            <span>Shipping:</span>
                                            <span>{formatCurrency(selectedOrder.shipping)}</span>
                                        </div>
                                        <div className="total-row grand-total">
                                            <span>Total:</span>
                                            <span>{formatCurrency(selectedOrder.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedOrder.refundStatus !== 'refunded' && (
                                <div className="refund-form">
                                    <h4>Process Refund</h4>

                                    <div className="refund-options">
                                        <div className="option">
                                            <input
                                                type="radio"
                                                id="refund-all"
                                                name="refund-type"
                                                checked={refundAll}
                                                onChange={() => setRefundAll(true)}
                                            />
                                            <label htmlFor="refund-all">Refund Entire Order</label>
                                        </div>
                                        <div className="option">
                                            <input
                                                type="radio"
                                                id="refund-partial"
                                                name="refund-type"
                                                checked={!refundAll}
                                                onChange={() => setRefundAll(false)}
                                            />
                                            <label htmlFor="refund-partial">Refund Selected Items</label>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="refund-reason">Refund Reason:</label>
                                        <textarea
                                            id="refund-reason"
                                            value={refundReason}
                                            onChange={(e) => setRefundReason(e.target.value)}
                                            placeholder="Enter reason for refund"
                                            required
                                        />
                                    </div>

                                    <div className="action-buttons">
                                        <button
                                            className="cancel-button"
                                            onClick={closeOrderDetail}
                                            disabled={processingRefund}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="refund-button"
                                            onClick={processRefund}
                                            disabled={processingRefund}
                                        >
                                            {processingRefund ? (
                                                <>
                                                    <LoadingSpinner small />
                                                    Processing...
                                                </>
                                            ) : (
                                                'Process Refund'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RefundManagementPanel;