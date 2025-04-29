import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import refundService from '../services/refundService';
import '../styles/OrderDetailPage.css';

const OrderDetailPage = () => {
    const { orderId } = useParams();
    const { currentUser } = useUser();
    const { success: showSuccess, error: showError } = useToast();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!currentUser || !orderId) {
                setLoading(false);
                return;
            }

            try {
                const orderRef = doc(db, 'orders', orderId);
                const orderDoc = await getDoc(orderRef);

                if (!orderDoc.exists()) {
                    setError('Order not found');
                    setLoading(false);
                    return;
                }

                const orderData = orderDoc.data();

                if (orderData.userId !== currentUser.uid) {
                    setError('You do not have permission to view this order');
                    setLoading(false);
                    return;
                }

                setOrder({
                    id: orderDoc.id,
                    ...orderData,
                    createdAt: orderData.createdAt?.toDate() || new Date()
                });
                setLoading(false);
            } catch (err) {
                console.error('Error fetching order details:', err);
                setError('Failed to load order details. Please try again.');
                setLoading(false);
            }
        };

        fetchOrder();
    }, [orderId, currentUser]);

    const isWithinCancellationWindow = (orderDate) => {
        if (!orderDate) return false;

        const orderTime = orderDate instanceof Date ? orderDate : new Date(orderDate);
        const currentTime = new Date();

        const timeDiff = currentTime - orderTime;
        const hoursDiff = timeDiff / 3600000;

        return hoursDiff < 1;
    };

    const handleCancelOrder = async () => {
        const confirmCancel = window.confirm('Are you sure you want to cancel this order? This action cannot be undone.');
        if (!confirmCancel) return;

        setIsCancelling(true);

        try {
            const orderRef = doc(db, 'orders', orderId);

            await updateDoc(orderRef, {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                cancelledBy: 'customer',
                updatedAt: serverTimestamp()
            });

            const refundResult = await refundService.processRefund(
                orderId,
                currentUser.uid,
                'Order cancelled by customer within the cancellation window',
                true,
                []
            );

            if (refundResult.success) {
                await updateDoc(orderRef, {
                    refundStatus: 'refunded',
                    refundDate: serverTimestamp(),
                    refundReason: 'Order cancelled by customer within the cancellation window',
                    refundAmount: refundResult.refundAmount
                });

                setOrder(prevOrder => ({
                    ...prevOrder,
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancelledBy: 'customer',
                    refundStatus: 'refunded',
                    refundDate: new Date(),
                    refundReason: 'Order cancelled by customer within the cancellation window'
                }));

                showSuccess('Order successfully cancelled and refunded');
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            showError('Failed to cancel order. Please try again.');
        } finally {
            setIsCancelling(false);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

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

    const formatEstimatedDelivery = (date) => {
        if (!date) return 'Not available';

        const deliveryDate = date.toDate ? date.toDate() : new Date(date);

        return formatDate(deliveryDate);
    };

    if (loading) {
        return (
            <div className="order-detail-page">
                <div className="order-detail-container">
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading order details...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="order-detail-page">
                <div className="order-detail-container">
                    <div className="error-container">
                        <p>{error}</p>
                        <Link to="/orders" className="btn-primary">
                            Back to Orders
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="order-detail-page">
                <div className="order-detail-container">
                    <div className="error-container">
                        <p>Order not found</p>
                        <Link to="/orders" className="btn-primary">
                            Back to Orders
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const canCancel = order.status === 'processing' && isWithinCancellationWindow(order.createdAt);

    return (
        <div className="order-detail-page">
            <div className="order-detail-container">
                <div className="order-detail-header">
                    <div className="back-button-container">
                        <Link to="/orders" className="back-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            Back to Orders
                        </Link>
                    </div>
                    <h1>Order Details</h1>
                </div>

                <div className="order-overview">
                    <div className="order-number-section">
                        <h2>Order #{order.id.slice(-6)}</h2>
                        <div className="order-date-time">
                            <span>Placed on {formatDate(order.createdAt)}</span>
                            <span className="time-separator">at</span>
                            <span>{formatTime(order.createdAt)}</span>
                        </div>
                    </div>
                    <div className="order-status-section">
                        <div className="status-container">
                            <span className={`status-badge large ${getStatusBadgeClass(order.status)}`}>
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>

                            {canCancel && (
                                <span className="cancellation-window-badge">
                                    Cancellable
                                </span>
                            )}
                        </div>

                        {canCancel && (
                            <button
                                className="cancel-order-button large"
                                onClick={handleCancelOrder}
                                disabled={isCancelling}
                            >
                                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="order-detail-content">
                    {canCancel && (
                        <div className="cancellation-notice">
                            <div className="cancellation-notice-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </div>
                            <div className="cancellation-notice-text">
                                <p>This order can be cancelled within 1 hour of placing it. You have until {formatTime(new Date(order.createdAt.getTime() + 3600000))} to cancel if needed.</p>
                            </div>
                        </div>
                    )}

                    {order.status === 'cancelled' && (
                        <div className="cancellation-confirmation">
                            <div className="cancellation-confirmation-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <div className="cancellation-confirmation-text">
                                <p>This order was cancelled on {order.cancelledAt ? formatDate(order.cancelledAt.toDate ? order.cancelledAt.toDate() : order.cancelledAt) : 'N/A'} and has been fully refunded.</p>
                            </div>
                        </div>
                    )}

                    <div className="order-items-section">
                        <h3>Items in Your Order</h3>
                        <div className="order-items-list">
                            {order.items.map((item, index) => (
                                <div key={index} className="order-item">
                                    <div className="item-image">
                                        <img
                                            src={item.imageUrl || 'https://via.placeholder.com/80?text=Product'}
                                            alt={item.name}
                                        />
                                    </div>
                                    <div className="item-details">
                                        <h4 className="item-name">{item.name}</h4>
                                        <div className="item-price-qty">
                                            <span className="item-price">{formatPrice(item.price)}</span>
                                            <span className="item-quantity">Quantity: {item.quantity}</span>
                                        </div>
                                    </div>
                                    <div className="item-total">
                                        {formatPrice(item.price * item.quantity)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="order-info-wrapper">
                        <div className="shipping-info">
                            <h3>Shipping Information</h3>
                            <div className="info-box">
                                <p><strong>{order.shippingInfo.fullName}</strong></p>
                                <p>{order.shippingInfo.address}</p>
                                <p>{order.shippingInfo.city}, {order.shippingInfo.state} {order.shippingInfo.zipCode}</p>
                                <p>{order.shippingInfo.country}</p>
                                <p>Phone: {order.shippingInfo.phone}</p>
                                <p className="shipping-method">
                                    <strong>Shipping Method:</strong> {order.shippingInfo.shippingMethod === 'express' ? 'Express' : 'Standard'}
                                </p>
                                <p className="delivery-estimate">
                                    <strong>Estimated Delivery:</strong> {formatEstimatedDelivery(order.estimatedDelivery)}
                                </p>
                            </div>
                        </div>

                        <div className="payment-info">
                            <h3>Payment Information</h3>
                            <div className="info-box">
                                <p><strong>Payment Method:</strong> {order.paymentMethod}</p>
                                <p><strong>Payment Status:</strong> {order.paymentStatus}</p>

                                <div className="order-summary">
                                    <div className="summary-row">
                                        <span>Subtotal:</span>
                                        <span>{formatPrice(order.subtotal)}</span>
                                    </div>
                                    <div className="summary-row">
                                        <span>Shipping:</span>
                                        <span>{formatPrice(order.shipping)}</span>
                                    </div>
                                    <div className="summary-row total">
                                        <span>Total:</span>
                                        <span>{formatPrice(order.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {order.notes && (
                        <div className="order-notes">
                            <h3>Order Notes</h3>
                            <div className="info-box">
                                <p>{order.notes}</p>
                            </div>
                        </div>
                    )}

                    <div className="order-help">
                        <h3>Need Help?</h3>
                        <p>If you need assistance with this order, please contact our customer service team.</p>
                        <Link to="/contact" className="btn-primary">Contact Support</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailPage;
