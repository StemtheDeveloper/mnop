import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { doc, updateDoc, getDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import refundService from '../../services/refundService';

const CustomerOrdersTab = () => {
  const { currentUser, hasRole } = useUser();
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [refundRequests, setRefundRequests] = useState([]);
  const [loadingRefundRequests, setLoadingRefundRequests] = useState(false);
  const [refundDenyReason, setRefundDenyReason] = useState('');
  const [selectedRefundOrder, setSelectedRefundOrder] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderTimeFrame, setOrderTimeFrame] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [designerProducts, setDesignerProducts] = useState([]);

  console.log('CustomerOrdersTab rendered', {
    isLoggedIn: !!currentUser,
    userId: currentUser?.uid,
    isDesigner: hasRole('designer')
  });

  // Format price as currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Add formatDate helper function
  const formatDate = (date) => {
    if (!date) return 'N/A';

    // Handle Firebase Timestamp
    if (date && typeof date === 'object' && date.toDate) {
      date = date.toDate();
    }

    // Handle timestamp objects with seconds
    if (date && typeof date === 'object' && date.seconds) {
      date = new Date(date.seconds * 1000);
    }

    // If it's a string, try to convert to date
    if (typeof date === 'string') {
      date = new Date(date);
    }

    // Ensure it's a valid date
    if (!(date instanceof Date) || isNaN(date)) {
      return 'Invalid date';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Function to get status badge class for styling
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-default';
    }
  };

  // Fetch orders and refund requests on component mount
  useEffect(() => {
    if (currentUser?.uid && hasRole('designer')) {
      console.log('Designer detected, fetching orders and refund requests');
      fetchDesignerProducts();
      fetchCustomerOrders();
      fetchRefundRequests();
    }
  }, [currentUser?.uid, hasRole]);

  // Fetch designer's products
  const fetchDesignerProducts = async () => {
    const userId = currentUser?.uid;
    if (!userId || !hasRole('designer')) return;

    console.log('Fetching designer products for refund filtering');

    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('designerId', '==', userId));
      const snapshot = await getDocs(q);

      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Designer products loaded:', products.length);
      setDesignerProducts(products);
    } catch (error) {
      console.error('Error fetching designer products:', error);
    }
  };

  // Function to fetch designer's customer orders
  const fetchCustomerOrders = async () => {
    const userId = currentUser?.uid;
    if (!userId || !hasRole('designer')) return;

    setLoadingOrders(true);
    setMessage({ type: '', text: '' });

    try {
      // First get all products by this designer
      const productsRef = collection(db, 'products');
      const designerProductsQuery = query(productsRef, where('designerId', '==', userId));
      const productSnapshot = await getDocs(designerProductsQuery);

      if (productSnapshot.empty) {
        console.log('No products found for this designer');
        setCustomerOrders([]);
        setDesignerProducts([]);
        setLoadingOrders(false);
        return;
      }

      // Store designer products for reference
      const products = productSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDesignerProducts(products);

      // Get all product IDs
      const productIds = productSnapshot.docs.map(doc => doc.id);
      console.log('Designer product IDs:', productIds);

      // Find all orders that contain these products
      const ordersRef = collection(db, 'orders');
      const orderSnapshot = await getDocs(ordersRef);
      console.log('Total orders found:', orderSnapshot.size);

      // Filter orders that contain this designer's products
      const relevantOrders = [];

      orderSnapshot.forEach(orderDoc => {
        const orderData = orderDoc.data();

        // Skip if order has no items
        if (!orderData.items || !Array.isArray(orderData.items)) return;

        // Check if any item in this order is from this designer's products
        const designerItems = orderData.items.filter(item => productIds.includes(item.id));

        if (designerItems.length > 0) {
          // Handle createdAt timestamp properly
          let createdAtDate;
          if (orderData.createdAt) {
            if (orderData.createdAt.toDate) {
              // Firebase Timestamp
              createdAtDate = orderData.createdAt.toDate();
            } else if (orderData.createdAt.seconds) {
              // Timestamp stored as object with seconds
              createdAtDate = new Date(orderData.createdAt.seconds * 1000);
            } else {
              // Regular Date or timestamp
              createdAtDate = new Date(orderData.createdAt);
            }
          } else {
            createdAtDate = new Date(); // Fallback
          }

          // Handle deliveredAt timestamp properly
          let deliveredAtDate = null;
          if (orderData.deliveredAt) {
            if (orderData.deliveredAt.toDate) {
              deliveredAtDate = orderData.deliveredAt.toDate();
            } else if (orderData.deliveredAt.seconds) {
              deliveredAtDate = new Date(orderData.deliveredAt.seconds * 1000);
            } else {
              deliveredAtDate = new Date(orderData.deliveredAt);
            }
          }

          // Handle estimatedDelivery timestamp properly
          let estimatedDeliveryDate = null;
          if (orderData.estimatedDelivery) {
            if (orderData.estimatedDelivery.toDate) {
              estimatedDeliveryDate = orderData.estimatedDelivery.toDate();
            } else if (orderData.estimatedDelivery.seconds) {
              estimatedDeliveryDate = new Date(orderData.estimatedDelivery.seconds * 1000);
            } else {
              estimatedDeliveryDate = new Date(orderData.estimatedDelivery);
            }
          }

          // Only include relevant items from this designer
          relevantOrders.push({
            id: orderDoc.id,
            ...orderData,
            // Only include items from this designer
            designerItems: designerItems,
            // Calculate subtotal for just this designer's items
            designerSubtotal: designerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            // Use the properly formatted dates
            createdAt: createdAtDate,
            deliveredAt: deliveredAtDate,
            estimatedDelivery: estimatedDeliveryDate
          });
        }
      });

      console.log('Relevant orders for this designer:', relevantOrders.length);

      // Sort orders by date (newest first)
      relevantOrders.sort((a, b) => b.createdAt - a.createdAt);

      setCustomerOrders(relevantOrders);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      setMessage({ type: 'error', text: 'Failed to load customer orders.' });
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch refund requests for designer's products
  const fetchRefundRequests = async () => {
    const userId = currentUser?.uid;
    if (!userId || !hasRole('designer')) return;

    setLoadingRefundRequests(true);

    try {
      const result = await refundService.getRefundRequestsForDesigner(userId);

      if (result.success) {
        console.log('Refund requests fetched successfully:', result.data);

        // Enhanced debugging to check data integrity
        if (result.data.length > 0) {
          result.data.forEach(request => {
            console.log(`Refund request ${request.id}:`, {
              status: request.refundStatus,
              items: request.items?.length || 0,
              designerItems: request.designerItems?.length || 0,
              reason: request.refundRequestReason,
              date: request.refundRequestDate
            });
          });
        }

        setRefundRequests(result.data);
      } else {
        console.error('Error fetching refund requests:', result.error);
      }
    } catch (error) {
      console.error('Error fetching refund requests:', error);
    } finally {
      setLoadingRefundRequests(false);
    }
  };

  // Function to handle updating order status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    if (!orderId || !newStatus) return;

    // Confirm before cancelling an order
    if (newStatus === 'cancelled') {
      const confirmCancel = window.confirm('Are you sure you want to reject this order? This will automatically refund the customer. This action cannot be undone.');
      if (!confirmCancel) return;
    }

    setLoading(true);

    try {
      const orderRef = doc(db, 'orders', orderId);

      // Create status update data
      const updateData = {
        status: newStatus,
        updatedAt: new Date()
      };

      // Add additional data for delivery
      if (newStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      // Update order in Firestore
      await updateDoc(orderRef, updateData);

      // If order is being cancelled, automatically process a refund
      if (newStatus === 'cancelled') {
        const refundResult = await refundService.processRefund(
          orderId,
          currentUser.uid, // Designer ID as the admin/processor
          'Order rejected by designer',
          true, // Refund all items
          [] // No specific items since we're refunding all
        );

        if (refundResult.success) {
          // Update refund status in the order
          await updateDoc(orderRef, {
            refundStatus: 'refunded',
            refundDate: new Date(),
            refundReason: 'Order rejected by designer',
            refundedBy: currentUser.uid,
            refundAmount: refundResult.refundAmount
          });
        } else {
          console.error('Error processing automatic refund:', refundResult.error);
          // Continue with rejection even if refund fails - admin can handle refund manually
        }
      }

      // Create notification for the customer
      const orderDoc = await getDoc(orderRef);
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();

        // Add notification for customer
        await addDoc(collection(db, 'notifications'), {
          userId: orderData.userId,
          title: newStatus === 'delivered'
            ? 'Order Delivered'
            : newStatus === 'cancelled'
              ? 'Order Rejected and Refunded'
              : 'Order Status Update',
          message: newStatus === 'delivered'
            ? 'Your order has been marked as delivered.'
            : newStatus === 'cancelled'
              ? 'Your order has been rejected by the designer. A refund has been processed to your wallet.'
              : `Your order status has been updated to ${newStatus}.`,
          type: 'order_status',
          orderId: orderId,
          read: false,
          createdAt: new Date()
        });
      }

      // Update local state to reflect the change
      setCustomerOrders(prev =>
        prev.map(order =>
          order.id === orderId
            ? {
              ...order,
              status: newStatus,
              ...(newStatus === 'delivered' ? { deliveredAt: new Date() } : {}),
              ...(newStatus === 'cancelled' ? {
                refundStatus: 'refunded',
                refundDate: new Date(),
                refundReason: 'Order rejected by designer'
              } : {})
            }
            : order
        )
      );

      setMessage({
        type: 'success',
        text: newStatus === 'delivered'
          ? 'Order has been marked as delivered'
          : newStatus === 'cancelled'
            ? 'Order has been rejected and refund has been processed'
            : `Order status updated to ${newStatus}`
      });

    } catch (error) {
      console.error('Error updating order status:', error);
      setMessage({
        type: 'error',
        text: 'Failed to update order status. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to handle refunding an order
  const handleRefundOrder = async (orderId, reason) => {
    if (!orderId) return;

    // Confirm before issuing refund
    const confirmRefund = window.confirm('Are you sure you want to refund this order? This action cannot be undone.');
    if (!confirmRefund) return;

    setLoading(true);

    try {
      // Process refund through refundService
      const result = await refundService.processRefund(
        orderId,
        currentUser.uid, // Designer ID as the admin/processor
        reason || 'Refund issued by designer',
        true, // Refund all items
        [] // No specific items since we're refunding all
      );

      if (result.success) {
        // Update local state to reflect the refund
        setCustomerOrders(prev =>
          prev.map(order =>
            order.id === orderId
              ? {
                ...order,
                refundStatus: 'refunded',
                refundDate: new Date(),
                refundReason: reason || 'Refund issued by designer'
              }
              : order
          )
        );

        setMessage({
          type: 'success',
          text: `Order has been refunded. ${result.refundAmount ? formatPrice(result.refundAmount) : ''} has been returned to the customer.`
        });
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to process refund. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error refunding order:', error);
      setMessage({
        type: 'error',
        text: 'Failed to process refund. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to handle approving a refund request
  const handleApproveRefundRequest = async (orderId, reason) => {
    if (!orderId) return;

    // Confirm before approving refund
    const confirmApprove = window.confirm('Are you sure you want to approve this refund request? This will process a refund to the customer. This action cannot be undone.');
    if (!confirmApprove) return;

    setLoading(true);

    try {
      // Process refund through refundService
      const result = await refundService.processRefund(
        orderId,
        currentUser.uid, // Designer ID as the admin/processor
        reason || 'Refund request approved by designer',
        true, // Refund all items
        [] // No specific items since we're refunding all
      );

      if (result.success) {
        // Update local state to reflect the refund
        setRefundRequests(prev => prev.filter(request => request.id !== orderId));

        // Update customer orders list if the order exists there
        setCustomerOrders(prev =>
          prev.map(order =>
            order.id === orderId
              ? {
                ...order,
                refundStatus: 'refunded',
                refundDate: new Date(),
                refundReason: reason || 'Refund request approved by designer'
              }
              : order
          )
        );

        setMessage({
          type: 'success',
          text: `Refund request approved. ${result.refundAmount ? formatPrice(result.refundAmount) : ''} has been returned to the customer.`
        });

        // Refresh refund requests
        fetchRefundRequests();
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to process refund. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error approving refund request:', error);
      setMessage({
        type: 'error',
        text: 'Failed to process refund. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to handle denying a refund request
  const handleDenyRefundRequest = async (orderId, reason) => {
    if (!orderId || !reason) {
      setMessage({
        type: 'error',
        text: 'Please provide a reason for denying the refund request.'
      });
      return;
    }

    setLoading(true);

    try {
      const result = await refundService.denyRefundRequest(
        orderId,
        currentUser.uid,
        reason
      );

      if (result.success) {
        // Update local state to reflect the denied refund
        setRefundRequests(prev => prev.filter(request => request.id !== orderId));

        // Update customer orders list if the order exists there
        setCustomerOrders(prev =>
          prev.map(order =>
            order.id === orderId
              ? {
                ...order,
                refundStatus: 'denied',
                refundDeniedDate: new Date(),
                refundDeniedReason: reason
              }
              : order
          )
        );

        setMessage({
          type: 'success',
          text: 'Refund request denied successfully.'
        });

        // Reset modal state
        setRefundDenyReason('');
        setSelectedRefundOrder(null);
        setShowRefundModal(false);

        // Refresh refund requests
        fetchRefundRequests();
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to deny refund request. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error denying refund request:', error);
      setMessage({
        type: 'error',
        text: 'Failed to deny refund request. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to open refund denial modal
  const openRefundDenialModal = (order) => {
    setSelectedRefundOrder(order);
    setRefundDenyReason('');
    setShowRefundModal(true);
  };

  return (<div className="settings-section">
    <h3>Customer Orders</h3>
    <p>View and manage orders for your products</p>

    {message.text && (
      <div className={`message ${message.type}`}>
        {message.text}
      </div>
    )}

    {/* Refund Denial Modal */}
    {showRefundModal && selectedRefundOrder && (
      <div className="modal-overlay">
        <div className="refund-denial-modal">
          <h3>Deny Refund Request</h3>
          <p>Please provide a reason for denying the refund request for Order #{selectedRefundOrder.id.slice(-6)}</p>

          <div className="refund-info">
            <div className="refund-order-details">
              <p><strong>Customer:</strong> {selectedRefundOrder.shippingInfo?.fullName || 'Unknown'}</p>
              <p><strong>Order Date:</strong> {formatDate(selectedRefundOrder.createdAt)}</p>
              <p><strong>Customer Reason:</strong> {selectedRefundOrder.refundRequestReason || 'No reason provided'}</p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="refundDenyReason">Denial Reason (required)</label>
            <textarea
              id="refundDenyReason"
              name="refundDenyReason"
              value={refundDenyReason}
              onChange={(e) => setRefundDenyReason(e.target.value)}
              placeholder="Please explain why you are denying this refund request..."
              rows={4}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={() => {
                setShowRefundModal(false);
                setSelectedRefundOrder(null);
                setRefundDenyReason('');
              }}
            >
              Cancel
            </button>
            <button
              className="btn-deny-confirm"
              onClick={() => handleDenyRefundRequest(selectedRefundOrder.id, refundDenyReason)}
              disabled={!refundDenyReason.trim() || loading}
            >
              {loading ? 'Processing...' : 'Deny Refund'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Search and filtering controls */}
    <div className="order-filters">
      <div className="search-filter">
        <input
          type="text"
          placeholder="Search by order # or customer name"
          value={orderSearchTerm}
          onChange={(e) => setOrderSearchTerm(e.target.value)}
          className="search-orders-input" />
      </div>
      <div className="filter-controls">
        <select
          value={orderFilter}
          onChange={(e) => setOrderFilter(e.target.value)}
          className="order-status-filter"
        >
          <option value="all">All Orders</option>
          <option value="incomplete">Incomplete</option>
          <option value="complete">Completed</option>
        </select>
        <select
          value={orderTimeFrame}
          onChange={(e) => setOrderTimeFrame(e.target.value)}
          className="order-time-filter"
        >
          <option value="all">All Time</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>
    </div>

    {/* Developer testing button - will remove in final version */}
    {hasRole('designer') && (
      <button
        className="btn-secondary"
        style={{ marginTop: '10px' }}
        onClick={() => fetchRefundRequests()}>
        Refresh Refund Requests
      </button>
    )}

    {loadingOrders ? (
      <div className="loading-container">
        <LoadingSpinner />
        <p>Loading customer orders...</p>
      </div>
    ) : (
      <div className="orders-container">
        {/* Refund Requests Section - Always show for designers */}
        {hasRole('designer') && (
          <div className="refund-requests-section">
            <h4 className="section-title">Refund Requests</h4>
            <p className="section-description">These orders have pending refund requests from customers that require your response.</p>

            {loadingRefundRequests ? (
              <div className="loading-container">
                <LoadingSpinner />
                <p>Loading refund requests...</p>
              </div>
            ) : refundRequests.length > 0 ? (
              <div className="refund-requests-list">
                {refundRequests.map(request => (
                  <div key={request.id} className="refund-request-card">
                    <div className="request-header">
                      <div className="request-id">
                        <h3>Order #{request.id.slice(-6)}</h3>
                        <span className="status-badge status-warning">Refund Requested</span>
                      </div>
                      <div className="request-date">
                        <div>Requested on {formatDate(request.refundRequestDate)}</div>
                      </div>
                    </div>

                    <div className="customer-info">
                      <strong>Customer:</strong> {request.shippingInfo?.fullName || 'Unknown'}
                    </div>

                    <div className="refund-reason">
                      <strong>Reason:</strong> {request.refundRequestReason || 'No reason provided'}
                    </div>

                    <div className="order-items-preview">
                      {/* Use designerItems if available, otherwise filter normal items */}
                      {(request.designerItems || []).length > 0 ? (
                        // Use the pre-filtered designerItems
                        request.designerItems.slice(0, 3).map((item, index) => (
                          <div key={index} className="preview-item-image">
                            <img
                              src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                              alt={item.name} />
                            {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                          </div>
                        ))
                      ) : (
                        // Fall back to the original filtering logic
                        (request.items || []).filter(item => {
                          // Only show items from this designer
                          const product = designerProducts.find(p => p.id === item.id);
                          return !!product;
                        }).slice(0, 3).map((item, index) => (
                          <div key={index} className="preview-item-image">
                            <img
                              src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                              alt={item.name} />
                            {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="refund-actions">
                      <button
                        className="btn-approve-refund"
                        onClick={() => handleApproveRefundRequest(request.id, request.refundRequestReason)}
                      >
                        Approve Refund
                      </button>
                      <button
                        className="btn-deny-refund"
                        onClick={() => openRefundDenialModal(request)}
                      >
                        Deny Refund
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-refund-requests">
                <p>No pending refund requests at this time.</p>
              </div>
            )}
          </div>
        )}

        {/* Regular Orders Section */}
        {orderFilter !== 'complete' && (
          <div className="orders-group">
            <h4 className="orders-group-title">Pending Orders</h4>
            <div className="orders-list">
              {customerOrders
                .filter(order => {
                  // Filter by search term
                  const searchMatch = orderSearchTerm === '' ||
                    order.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                    (order.shippingInfo?.fullName || '').toLowerCase().includes(orderSearchTerm.toLowerCase());

                  // Filter by status
                  const statusMatch = order.status !== 'delivered' && order.status !== 'completed';

                  // Filter by time period
                  let timeMatch = true;
                  const orderDate = new Date(order.createdAt);
                  const now = new Date();

                  if (orderTimeFrame === 'week') {
                    const weekAgo = new Date();
                    weekAgo.setDate(now.getDate() - 7);
                    timeMatch = orderDate >= weekAgo;
                  } else if (orderTimeFrame === 'month') {
                    const monthAgo = new Date();
                    monthAgo.setMonth(now.getMonth() - 1);
                    timeMatch = orderDate >= monthAgo;
                  } else if (orderTimeFrame === 'year') {
                    const yearAgo = new Date();
                    yearAgo.setFullYear(now.getFullYear() - 1);
                    timeMatch = orderDate >= yearAgo;
                  }

                  return searchMatch && statusMatch && timeMatch;
                })
                .map(order => (
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
                        <div className="order-time">
                          {new Date(order.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="order-customer-info">
                      <strong>Customer:</strong> {order.shippingInfo?.fullName || 'Unknown'}
                    </div>

                    <div className="order-items-preview">
                      {order.designerItems.slice(0, 3).map((item, index) => (
                        <div key={index} className="preview-item-image">
                          <img
                            src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                            alt={item.name} />
                          {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                        </div>
                      ))}
                      {order.designerItems.length > 3 && (
                        <div className="more-items">
                          +{order.designerItems.length - 3} more
                        </div>
                      )}
                    </div>

                    {/* Toggle details button */}
                    <button
                      className="toggle-details-button"
                      onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                    >
                      {expandedOrderId === order.id ? 'Hide Details' : 'Show Details'}
                    </button>

                    {/* Expanded details section */}
                    {expandedOrderId === order.id && (
                      <>
                        <div className="order-details">
                          <div className="order-items-details">
                            {order.designerItems.map((item, index) => (
                              <div key={index} className="order-item-line">
                                <span className="item-name">{item.name}</span>
                                <span className="item-quantity">x{item.quantity}</span>
                                <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="order-subtotal">
                            <strong>Designer total:</strong> {formatPrice(order.designerSubtotal)}
                          </div>
                        </div>

                        {/* Shipping address */}
                        <div className="shipping-address">
                          <h4>Shipping Address</h4>
                          <p>{order.shippingInfo?.fullName}</p>
                          <p>{order.shippingInfo?.address}</p>
                          <p>{order.shippingInfo?.city}, {order.shippingInfo?.state} {order.shippingInfo?.zipCode}</p>
                          <p>{order.shippingInfo?.country}</p>
                          <p><strong>Phone:</strong> {order.shippingInfo?.phone}</p>
                          <p><strong>Email:</strong> {order.shippingInfo?.email}</p>
                        </div>
                      </>
                    )}

                    <div className="shipping-preview">
                      <div className="shipping-method">
                        <strong>Shipping:</strong> {order.shippingInfo?.shippingMethod === 'express' ? 'Express' : 'Standard'}
                      </div>
                      {order.estimatedDelivery && (
                        <div className="estimated-delivery">
                          <strong>Est. Delivery:</strong> {new Date(order.estimatedDelivery.seconds * 1000).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      )}
                    </div>

                    {/* Order action buttons */}
                    <div className="order-actions">
                      <button
                        className="btn-mark-delivered"
                        onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                      >
                        Mark as Delivered
                      </button>
                      <button
                        className="btn-reject-order"
                        onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                      >
                        Reject Order
                      </button>
                      <button
                        className="btn-refund-order"
                        onClick={() => handleRefundOrder(order.id, 'Customer requested refund')}
                      >
                        Refund Order
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Completed orders */}
        {orderFilter !== 'incomplete' && (
          <div className="orders-group">
            <h4 className="orders-group-title">Completed Orders</h4>
            <div className="orders-list">
              {customerOrders
                .filter(order => {
                  // Filter by search term
                  const searchMatch = orderSearchTerm === '' ||
                    order.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                    (order.shippingInfo?.fullName || '').toLowerCase().includes(orderSearchTerm.toLowerCase());

                  // Filter by status
                  const statusMatch = order.status === 'delivered' || order.status === 'completed';

                  // Filter by time period
                  let timeMatch = true;
                  const orderDate = new Date(order.createdAt);
                  const now = new Date();

                  if (orderTimeFrame === 'week') {
                    const weekAgo = new Date();
                    weekAgo.setDate(now.getDate() - 7);
                    timeMatch = orderDate >= weekAgo;
                  } else if (orderTimeFrame === 'month') {
                    const monthAgo = new Date();
                    monthAgo.setMonth(now.getMonth() - 1);
                    timeMatch = orderDate >= monthAgo;
                  } else if (orderTimeFrame === 'year') {
                    const yearAgo = new Date();
                    yearAgo.setFullYear(now.getFullYear() - 1);
                    timeMatch = orderDate >= yearAgo;
                  }

                  return searchMatch && statusMatch && timeMatch;
                })
                .map(order => (
                  <div key={order.id} className="order-card completed">
                    <div className="order-header">
                      <div className="order-id">
                        <h3>Order #{order.id.slice(-6)}</h3>
                        <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                      <div className="order-date">
                        <div>{formatDate(order.createdAt)}</div>
                        <div className="order-time">
                          {new Date(order.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="order-customer-info">
                      <strong>Customer:</strong> {order.shippingInfo?.fullName || 'Unknown'}
                    </div>

                    <div className="order-items-preview">
                      {order.designerItems.slice(0, 3).map((item, index) => (
                        <div key={index} className="preview-item-image">
                          <img
                            src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                            alt={item.name} />
                          {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                        </div>
                      ))}
                      {order.designerItems.length > 3 && (
                        <div className="more-items">
                          +{order.designerItems.length - 3} more
                        </div>
                      )}
                    </div>

                    {/* Toggle details button */}
                    <button
                      className="toggle-details-button"
                      onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                    >
                      {expandedOrderId === order.id ? 'Hide Details' : 'Show Details'}
                    </button>

                    {/* Expanded details section */}
                    {expandedOrderId === order.id && (
                      <>
                        <div className="order-details">
                          <div className="order-items-details">
                            {order.designerItems.map((item, index) => (
                              <div key={index} className="order-item-line">
                                <span className="item-name">{item.name}</span>
                                <span className="item-quantity">x{item.quantity}</span>
                                <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="order-subtotal">
                            <strong>Designer total:</strong> {formatPrice(order.designerSubtotal)}
                          </div>
                        </div>

                        {/* Shipping address */}
                        <div className="shipping-address">
                          <h4>Shipping Address</h4>
                          <p>{order.shippingInfo?.fullName}</p>
                          <p>{order.shippingInfo?.address}</p>
                          <p>{order.shippingInfo?.city}, {order.shippingInfo?.state} {order.shippingInfo?.zipCode}</p>
                          <p>{order.shippingInfo?.country}</p>
                          <p><strong>Phone:</strong> {order.shippingInfo?.phone}</p>
                          <p><strong>Email:</strong> {order.shippingInfo?.email}</p>
                        </div>
                      </>
                    )}

                    <div className="shipping-preview">
                      <div className="shipping-method">
                        <strong>Shipping:</strong> {order.shippingInfo?.shippingMethod === 'express' ? 'Express' : 'Standard'}
                      </div>
                      <div className="completed-date">
                        <strong>Completed:</strong> {order.deliveredAt ?
                          new Date(order.deliveredAt.seconds * 1000).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'Unknown'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    )}
  </div>);
};

export default CustomerOrdersTab;
