import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../../context/UserContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/formatters';

const MySalesTab = () => {
  const { currentUser, hasRole } = useUser();
  const [designerSales, setDesignerSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesTimeFrame, setSalesTimeFrame] = useState('all'); // 'all', 'week', 'month', 'year'
  const [salesFilter, setSalesFilter] = useState('all'); // 'all', 'completed', 'cancelled'
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Format price as currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Get status badge class for styling
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

  // Fetch designer's sales history
  const fetchSalesHistory = useCallback(async () => {
    if (!currentUser?.uid || !hasRole('designer')) return;

    setLoadingSales(true);
    setMessage({ type: '', text: '' });

    try {
      // First get all products by this designer
      const productsRef = collection(db, 'products');
      const designerProductsQuery = query(productsRef, where('designerId', '==', currentUser.uid));
      const productSnapshot = await getDocs(designerProductsQuery);

      if (productSnapshot.empty) {
        console.log('No products found for this designer');
        setDesignerSales([]);
        setLoadingSales(false);
        return;
      }

      // Get all product IDs
      const productIds = productSnapshot.docs.map(doc => doc.id);

      // Find all orders that contain these products
      const ordersRef = collection(db, 'orders');
      const orderSnapshot = await getDocs(ordersRef);

      // Filter orders that contain this designer's products
      const designerSales = [];

      orderSnapshot.forEach(orderDoc => {
        const orderData = orderDoc.data();

        // Skip if order has no items or is not completed/delivered
        if (!orderData.items || !Array.isArray(orderData.items) ||
          (orderData.status !== 'completed' && orderData.status !== 'delivered')) return;

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

          // Calculate sales amount for this designer's items
          const designerRevenue = designerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

          // Add sales entry
          designerSales.push({
            id: orderDoc.id,
            orderId: orderDoc.id,
            orderNumber: orderDoc.id.slice(-6), // Last 6 chars of order ID for display
            customerName: orderData.shippingInfo?.fullName || 'Unknown',
            customerEmail: orderData.shippingInfo?.email || 'No email',
            items: designerItems,
            quantity: designerItems.reduce((sum, item) => sum + item.quantity, 0),
            revenue: designerRevenue,
            date: createdAtDate,
            deliveredDate: deliveredAtDate,
            status: orderData.status,
            shippingInfo: orderData.shippingInfo || {},
            paymentInfo: {
              method: orderData.paymentMethod || 'N/A',
              total: designerRevenue
            }
          });
        }
      });

      // Sort sales by date (newest first)
      designerSales.sort((a, b) => b.date - a.date);

      console.log('Designer sales history loaded:', designerSales.length);
      setDesignerSales(designerSales);

    } catch (error) {
      console.error('Error fetching sales history:', error);
      setMessage({ type: 'error', text: 'Failed to load sales history.' });
    } finally {
      setLoadingSales(false);
    }
  }, [currentUser?.uid, hasRole]);

  // Fetch sales history when component mounts
  useEffect(() => {
    fetchSalesHistory();
  }, [fetchSalesHistory]);

  // Calculate filtered sales based on search and filter settings
  const filteredSales = useMemo(() => {
    if (!designerSales || designerSales.length === 0) return [];

    return designerSales.filter(sale => {
      // Filter by search term
      const searchMatch = salesSearchTerm === '' ||
        sale.orderNumber.toLowerCase().includes(salesSearchTerm.toLowerCase()) ||
        sale.customerName.toLowerCase().includes(salesSearchTerm.toLowerCase());

      // Filter by status
      const statusMatch = salesFilter === 'all' ||
        (salesFilter === 'completed' && (sale.status === 'completed' || sale.status === 'delivered')) ||
        (salesFilter === 'cancelled' && (sale.status === 'cancelled' || sale.refundStatus === 'refunded'));

      // Filter by time period
      let timeMatch = true;
      const saleDate = new Date(sale.date);
      const now = new Date();

      if (salesTimeFrame === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        timeMatch = saleDate >= weekAgo;
      } else if (salesTimeFrame === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        timeMatch = saleDate >= monthAgo;
      } else if (salesTimeFrame === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);
        timeMatch = saleDate >= yearAgo;
      }

      return searchMatch && statusMatch && timeMatch;
    });
  }, [designerSales, salesSearchTerm, salesFilter, salesTimeFrame]);

  // Function to handle exporting sales report
  const handleExportSalesReport = () => {
    if (filteredSales.length === 0) {
      setMessage({ type: 'error', text: 'No sales data to export' });
      return;
    }

    try {
      // Format sales data for export
      const csvData = filteredSales.map(sale => ({
        'Order #': sale.orderNumber,
        'Date': formatDate(sale.date),
        'Customer Name': sale.customerName,
        'Customer Email': sale.customerEmail,
        'Items': sale.items.map(item => `${item.name} (×${item.quantity})`).join(', '),
        'Quantity': sale.quantity,
        'Revenue': formatPrice(sale.revenue).replace('$', ''),
        'Status': sale.status,
      }));

      // Convert to CSV
      const replacer = (key, value) => value === null ? '' : value;
      const header = Object.keys(csvData[0]);
      let csv = csvData.map(row => header.map(fieldName =>
        JSON.stringify(row[fieldName], replacer)).join(','));
      csv.unshift(header.join(','));
      csv = csv.join('\r\n');

      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: 'success', text: 'Sales report exported successfully' });
    } catch (error) {
      console.error('Error exporting sales report:', error);
      setMessage({ type: 'error', text: 'Failed to export sales report' });
    }
  };
  return (<div className="settings-section sales-history-section">
    <h3>Sales History</h3>
    <p>View your completed sales and revenue history</p>

    {/* Search and filtering controls */}
    <div className="sales-filters">
      <div className="search-filter">
        <input
          type="text"
          placeholder="Search by order # or customer name"
          value={salesSearchTerm}
          onChange={(e) => setSalesSearchTerm(e.target.value)}
          className="search-sales-input" />
      </div>
      <div className="filter-controls">
        <select
          value={salesFilter}
          onChange={(e) => setSalesFilter(e.target.value)}
          className="sales-status-filter"
        >
          <option value="all">All Sales</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled/Refunded</option>
        </select>
        <select
          value={salesTimeFrame}
          onChange={(e) => setSalesTimeFrame(e.target.value)}
          className="sales-time-filter"
        >
          <option value="all">All Time</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>
    </div>

    {loadingSales ? (
      <div className="loading-container">
        <LoadingSpinner />
        <p>Loading sales history...</p>
      </div>
    ) : (
      <div className="sales-container">
        {/* Sales Summary */}
        <div className="sales-summary">
          <div className="summary-card total-sales">
            <h4>Total Sales</h4>
            <div className="summary-value">
              {designerSales.length}
            </div>
          </div>
          <div className="summary-card total-revenue">
            <h4>Total Revenue</h4>
            <div className="summary-value">
              {formatPrice(designerSales.reduce((total, sale) => total + sale.revenue, 0))}
            </div>
          </div>
          <div className="summary-card total-items">
            <h4>Items Sold</h4>
            <div className="summary-value">
              {designerSales.reduce((total, sale) => total + sale.quantity, 0)}
            </div>
          </div>
        </div>

        {/* Sales Table */}
        {designerSales.length > 0 ? (
          <div className="sales-table-container">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {designerSales.map(sale => (
                  <React.Fragment key={sale.id}>
                    <tr className="sales-row">
                      <td className="sales-order-id" data-label="Order #">{sale.orderNumber}</td>
                      <td className="sales-date" data-label="Date">{formatDate(sale.date)}</td>
                      <td className="sales-customer" data-label="Customer">{sale.customerName}</td>
                      <td className="sales-items" data-label="Items">
                        <div className="sales-items-preview">
                          {sale.items.slice(0, 2).map((item, index) => (
                            <div key={index} className="sales-item-name">
                              {item.name} {item.quantity > 1 && `(×${item.quantity})`}
                            </div>
                          ))}
                          {sale.items.length > 2 && (
                            <div className="more-items">
                              +{sale.items.length - 2} more
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="sales-revenue" data-label="Revenue">{formatPrice(sale.revenue)}</td>
                      <td className="sales-status" data-label="Status">
                        <span className={`status-badge ${getStatusBadgeClass(sale.status)}`}>
                          {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                        </span>
                      </td>
                      <td className="sales-actions" data-label="Actions">
                        <button
                          className="view-details-btn"
                          onClick={() => setExpandedOrderId(expandedOrderId === sale.id ? null : sale.id)}
                        >
                          {expandedOrderId === sale.id ? 'Hide Details' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedOrderId === sale.id && (
                      <tr className="expanded-details-row">
                        <td colSpan="7">
                          <div className="expanded-order-details">
                            <div className="expanded-details-grid">
                              <div className="detail-group">
                                <h5>Order Info</h5>
                                <p>Order #: {sale.orderNumber}</p>
                                <p>Date: {formatDate(sale.date)}</p>
                                <p>Status: {sale.status}</p>
                              </div>
                              <div className="detail-group">
                                <h5>Customer</h5>
                                <p>{sale.customerName}</p>
                                <p>{sale.shippingInfo?.email || 'No email provided'}</p>
                              </div>
                              <div className="detail-group">
                                <h5>Revenue</h5>
                                <p>Total: {formatPrice(sale.revenue)}</p>
                                {sale.paymentInfo?.method && (
                                  <p>Payment Method: {sale.paymentInfo.method}</p>
                                )}
                              </div>
                              {sale.deliveredDate && (
                                <div className="detail-group">
                                  <h5>Delivery</h5>
                                  <p className="completed-date">Delivered: {formatDate(sale.deliveredDate)}</p>
                                </div>
                              )}
                            </div>

                            <div className="items-list">
                              <h5>Ordered Items</h5>
                              {sale.items.map((item, idx) => (
                                <div className="item-entry" key={idx}>
                                  <span className="item-name">{item.name}</span>
                                  <span className="item-quantity">×{item.quantity}</span>
                                  <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-sales">
            <p>No sales found matching your criteria.</p>
          </div>
        )}
      </div>
    )}

    {/* Download Sales Report Button */}
    <div className="sales-export-section">
      <button className="export-sales-btn" onClick={handleExportSalesReport}>
        Export Sales Report
      </button>
    </div>
  </div>);
};

export default MySalesTab;
