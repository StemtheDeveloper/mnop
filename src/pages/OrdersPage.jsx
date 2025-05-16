import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import refundService from '../services/refundService';


const OrdersPage = () => {
    const { currentUser } = useUser();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refundOrderId, setRefundOrderId] = useState(null);
    const [refundReason, setRefundReason] = useState('');
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundProcessing, setRefundProcessing] = useState(false);
    const [refundMessage, setRefundMessage] = useState({ type: '', text: '' });
    const [cancellingOrderId, setCancellingOrderId] = useState(null);

    useEffect(() => {
        const fetchOrders = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            try {
                const ordersRef = collection(db, 'orders');
                const q = query(
                    ordersRef,
                    where('userId', '==', currentUser.uid),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );

                const snapshot = await getDocs(q);
                const ordersList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                }));

                setOrders(ordersList);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching orders:', err);
                setError('Failed to load your orders. Please try again.');
                setLoading(false);
            }
        };

        fetchOrders();
    }, [currentUser]);

    // Check if order is within the cancellation window (1 hour)
    const isWithinCancellationWindow = (orderDate) => {
        if (!orderDate) return false;

        const orderTime = orderDate instanceof Date ? orderDate : new Date(orderDate);
        const currentTime = new Date();

        // Calculate the difference in milliseconds
        const timeDiff = currentTime - orderTime;

        // Convert to hours (1 hour = 3600000 milliseconds)
        const hoursDiff = timeDiff / 3600000;

        // Check if less than 1 hour has passed
        return hoursDiff < 1;
    };

    // Handle order cancellation
    const handleCancelOrder = async (orderId) => {
        if (!orderId) return;

        // Confirm before cancelling
        const confirmCancel = window.confirm('Are you sure you want to cancel this order? This action cannot be undone.');
        if (!confirmCancel) return;

        setCancellingOrderId(orderId);

        try {
            const orderRef = doc(db, 'orders', orderId);

            // Update order status
            await updateDoc(orderRef, {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                cancelledBy: 'customer',
                updatedAt: serverTimestamp()
            });

            // Process refund automatically
            const refundResult = await refundService.processRefund(
                orderId,
                currentUser.uid,
                'Order cancelled by customer within the cancellation window',
                true, // Refund all items
                [] // No specific items since we're refunding all
            );

            if (refundResult.success) {
                // Update the order with refund information
                await updateDoc(orderRef, {
                    refundStatus: 'refunded',
                    refundDate: serverTimestamp(),
                    refundReason: 'Order cancelled by customer within the cancellation window',
                    refundAmount: refundResult.refundAmount
                });

                // Update local state
                setOrders(prevOrders =>
                    prevOrders.map(order =>
                        order.id === orderId
                            ? {
                                ...order,
                                status: 'cancelled',
                                cancelledAt: new Date(),
                                cancelledBy: 'customer',
                                refundStatus: 'refunded',
                                refundDate: new Date(),
                                refundReason: 'Order cancelled by customer within the cancellation window'
                            }
                            : order
                    )
                );
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            alert('Failed to cancel order. Please try again.');
        } finally {
            setCancellingOrderId(null);
        }
    };

    // Format date
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Format time
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    // Calculate total items in an order
    const calculateTotalItems = (items) => {
        return items.reduce((sum, item) => sum + item.quantity, 0);
    };

    // Get status badge class
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'processing':
                return 'status-processing';
            case 'shipped':
                return 'status-shipped';
            case 'delivered':
                return 'status-delivered';
            case 'cancelled':
                return 'status-cancelled';
            default:
                return 'status-processing';
        }
    };

    // Handle opening the refund request modal
    const handleRequestRefund = (orderId) => {
        setRefundOrderId(orderId);
        setRefundReason('');
        setRefundMessage({ type: '', text: '' });
        setShowRefundModal(true);
    };

    // Handle submitting the refund request
    const handleSubmitRefundRequest = async () => {
        if (!refundOrderId || !refundReason.trim()) {
            setRefundMessage({ type: 'error', text: 'Please provide a reason for the refund request.' });
            return;
        }

        setRefundProcessing(true);
        setRefundMessage({ type: '', text: '' });

        try {
            // Get the order to check if it's eligible for refund
            const orderResult = await refundService.getOrderById(refundOrderId);

            if (!orderResult.success) {
                setRefundMessage({ type: 'error', text: orderResult.error || 'Failed to retrieve order details.' });
                setRefundProcessing(false);
                return;
            }

            const order = orderResult.data;

            // Check if the order is already refunded or has a pending refund request
            if (order.refundStatus === 'refunded') {
                setRefundMessage({ type: 'error', text: 'This order has already been refunded.' });
                setRefundProcessing(false);
                return;
            }

            if (order.refundStatus === 'requested') {
                setRefundMessage({ type: 'error', text: 'A refund request is already pending for this order.' });
                setRefundProcessing(false);
                return;
            }

            // Update the order with refund request status
            const orderRef = doc(db, 'orders', refundOrderId);
            await updateDoc(orderRef, {
                refundStatus: 'requested',
                refundRequestDate: new Date(),
                refundRequestReason: refundReason,
                refundRequestBy: currentUser.uid
            });

            // Update the order in the local state
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.id === refundOrderId
                        ? {
                            ...order,
                            refundStatus: 'requested',
                            refundRequestDate: new Date(),
                            refundRequestReason: refundReason
                        }
                        : order
                )
            );

            setRefundMessage({ type: 'success', text: 'Your refund request has been submitted successfully. Our team will review it shortly.' });

            // Close the modal after a delay
            setTimeout(() => {
                setShowRefundModal(false);
                setRefundOrderId(null);
                setRefundReason('');
                setRefundProcessing(false);
            }, 3000);

        } catch (error) {
            console.error('Error submitting refund request:', error);
            setRefundMessage({ type: 'error', text: 'An error occurred while submitting your refund request. Please try again.' });
            setRefundProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="orders-page">
                <div className="orders-container">
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading your orders...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="orders-page">
                <div className="orders-container">
                    <div className="error-container">
                        <p>{error}</p>
                        <button onClick={() => window.location.reload()} className="btn-primary">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="orders-page">
            <div className="orders-container">
                <h1>My Orders</h1>

                {orders.length === 0 ? (
                    <div className="no-orders">
                        <div className="no-orders-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="3" width="20" height="18" rx="2" ry="2"></rect>
                                <line x1="6" y1="8" x2="18" y2="8"></line>
                                <line x1="6" y1="12" x2="18" y2="12"></line>
                                <line x1="6" y1="16" x2="12" y2="16"></line>
                            </svg>
                        </div>
                        <p>You haven't placed any orders yet.</p>
                        <Link to="/shop" className="btn-primary">Start Shopping</Link>
                    </div>
                ) : (
                    <div className="orders-list">
                        {orders.map(order => (
                            <div key={order.id} className="order-card">
                                <div className="order-header">
                                    <div className="order-id">
                                        <h3>Order #{order.id.slice(-6)}</h3>
                                        <div className="status-container">
                                            <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </span>

                                            {isWithinCancellationWindow(order.createdAt) && order.status === 'processing' && (
                                                <span className="cancellation-window-badge">
                                                    Cancellable
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="order-date">
                                        <div>{formatDate(order.createdAt)}</div>
                                        <div className="order-time">{formatTime(order.createdAt)}</div>
                                    </div>
                                </div>

                                <div className="order-items-preview">
                                    {order.items.slice(0, 3).map((item, index) => (
                                        <div key={index} className="preview-item-image">
                                            <img
                                                src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                                                alt={item.name}
                                            />
                                            {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                                        </div>
                                    ))}
                                    {order.items.length > 3 && (
                                        <div className="more-items">
                                            +{order.items.length - 3} more
                                        </div>
                                    )}
                                </div>

                                <div className="order-summary">
                                    <div className="order-info">
                                        <div><strong>Items:</strong> {calculateTotalItems(order.items)}</div>
                                        <div><strong>Total:</strong> {formatPrice(order.total)}</div>
                                    </div>

                                    <div className="order-actions">
                                        <Link to={`/orders/${order.id}`} className="view-order-button">
                                            View Details
                                        </Link>

                                        {/* Cancel order button - only show if within window and status is processing */}
                                        {isWithinCancellationWindow(order.createdAt) &&
                                            order.status === 'processing' && (
                                                <button
                                                    className="cancel-order-button"
                                                    onClick={() => handleCancelOrder(order.id)}
                                                    disabled={cancellingOrderId === order.id}
                                                >
                                                    {cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel Order'}
                                                </button>
                                            )}

                                        {/* Show refund button only for delivered orders that haven't been refunded */}
                                        {(order.status === 'delivered' || order.status === 'completed') &&
                                            order.refundStatus !== 'refunded' &&
                                            order.refundStatus !== 'requested' && (
                                                <button
                                                    className="request-refund-button"
                                                    onClick={() => handleRequestRefund(order.id)}
                                                >
                                                    Request Refund
                                                </button>
                                            )}

                                        {/* Show pending status for requested refunds */}
                                        {order.refundStatus === 'requested' && (
                                            <span className="refund-pending">Refund Requested</span>
                                        )}

                                        {/* Show refunded status */}
                                        {order.refundStatus === 'refunded' && (
                                            <span className="refund-completed">Refunded</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Refund Request Modal */}
            {showRefundModal && (
                <div className="modal-backdrop">
                    <div className="refund-modal">
                        <div className="modal-header">
                            <h3>Request a Refund</h3>
                            <button
                                className="close-modal"
                                onClick={() => !refundProcessing && setShowRefundModal(false)}
                                disabled={refundProcessing}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body">
                            {refundMessage.text && (
                                <div className={`refund-message ${refundMessage.type}`}>
                                    {refundMessage.text}
                                </div>
                            )}

                            <p>Please let us know why you're requesting a refund for Order #{refundOrderId?.slice(-6)}</p>

                            <textarea
                                placeholder="Reason for refund request..."
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                disabled={refundProcessing}
                                className="refund-reason-input"
                                rows={4}
                            />

                            <p className="refund-note">
                                <strong>Note:</strong> Refund requests are reviewed by our team and may take 1-3 business days to process.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="cancel-refund"
                                onClick={() => !refundProcessing && setShowRefundModal(false)}
                                disabled={refundProcessing}
                            >
                                Cancel
                            </button>
                            <button
                                className="submit-refund"
                                onClick={handleSubmitRefundRequest}
                                disabled={!refundReason.trim() || refundProcessing}
                            >
                                {refundProcessing ? 'Processing...' : 'Submit Refund Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
