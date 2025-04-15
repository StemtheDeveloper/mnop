import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/OrdersPage.css';

const OrdersPage = () => {
    const { currentUser } = useUser();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                                        <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                        </span>
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

                                    <Link to={`/orders/${order.id}`} className="view-order-button">
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrdersPage;
