import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    getDocs,
    doc,
    updateDoc,
    orderBy,
    limit,
    startAfter,
    where,
    Timestamp,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../LoadingSpinner';


const InventoryAlertsPanel = () => {
    // State variables
    const [lowStockAlerts, setLowStockAlerts] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeTab, setActiveTab] = useState('alerts');
    const [globalSettings, setGlobalSettings] = useState({
        defaultLowStockThreshold: 5,
        defaultReorderQuantity: 50,
        enableAutoReordering: false
    });
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [settingsForm, setSettingsForm] = useState({ ...globalSettings });

    const ITEMS_PER_PAGE = 20;

    // Load alerts and purchase orders on component mount
    useEffect(() => {
        if (activeTab === 'alerts') {
            loadLowStockAlerts();
        } else if (activeTab === 'orders') {
            loadPurchaseOrders();
        } else if (activeTab === 'settings') {
            loadGlobalSettings();
        }
    }, [activeTab]);

    // Live updates for low stock alerts
    useEffect(() => {
        if (activeTab !== 'alerts') return;

        const alertsRef = collection(db, 'lowStockAlerts');
        const alertsQuery = query(
            alertsRef,
            orderBy('timestamp', 'desc'),
            limit(ITEMS_PER_PAGE)
        );

        const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
            const alertsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date()
            }));

            setLowStockAlerts(alertsList);
            setLoading(false);
        }, (err) => {
            console.error('Error with alerts subscription:', err);
            setError('Failed to load alerts. Please try again.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activeTab]);

    // Load low stock alerts
    const loadLowStockAlerts = async () => {
        setLoading(true);
        setError(null);

        try {
            const alertsRef = collection(db, 'lowStockAlerts');
            const alertsQuery = query(
                alertsRef,
                orderBy('timestamp', 'desc'),
                limit(ITEMS_PER_PAGE)
            );

            const snapshot = await getDocs(alertsQuery);

            const alertsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date()
            }));

            // Set last visible for pagination
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more alerts
            setHasMore(alertsList.length === ITEMS_PER_PAGE);

            setLowStockAlerts(alertsList);
        } catch (err) {
            console.error('Error loading alerts:', err);
            setError('Failed to load alerts. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Load purchase orders
    const loadPurchaseOrders = async () => {
        setLoading(true);
        setError(null);

        try {
            const ordersRef = collection(db, 'purchaseOrders');
            const ordersQuery = query(
                ordersRef,
                orderBy('createdAt', 'desc'),
                limit(ITEMS_PER_PAGE)
            );

            const snapshot = await getDocs(ordersQuery);

            const ordersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date()
            }));

            // Set last visible for pagination
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more orders
            setHasMore(ordersList.length === ITEMS_PER_PAGE);

            setPurchaseOrders(ordersList);
        } catch (err) {
            console.error('Error loading purchase orders:', err);
            setError('Failed to load purchase orders. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Load global inventory settings
    const loadGlobalSettings = async () => {
        setLoading(true);
        setError(null);

        try {
            const settingsRef = doc(db, 'settings', 'inventory');
            const settingsDoc = await getDocs(settingsRef);

            if (settingsDoc.exists()) {
                const settingsData = settingsDoc.data();
                setGlobalSettings(settingsData);
                setSettingsForm(settingsData);
            }
        } catch (err) {
            console.error('Error loading inventory settings:', err);
            setError('Failed to load inventory settings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Load more alerts
    const loadMoreItems = async () => {
        if (!lastVisible || loadingMore) return;

        setLoadingMore(true);

        try {
            let itemsQuery;

            if (activeTab === 'alerts') {
                const alertsRef = collection(db, 'lowStockAlerts');
                itemsQuery = query(
                    alertsRef,
                    orderBy('timestamp', 'desc'),
                    startAfter(lastVisible),
                    limit(ITEMS_PER_PAGE)
                );
            } else if (activeTab === 'orders') {
                const ordersRef = collection(db, 'purchaseOrders');
                itemsQuery = query(
                    ordersRef,
                    orderBy('createdAt', 'desc'),
                    startAfter(lastVisible),
                    limit(ITEMS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(itemsQuery);

            const itemsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date(),
                createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date()
            }));

            // Update last visible for pagination
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more items
            setHasMore(itemsList.length === ITEMS_PER_PAGE);

            // Add new items to the list
            if (activeTab === 'alerts') {
                setLowStockAlerts(prev => [...prev, ...itemsList]);
            } else if (activeTab === 'orders') {
                setPurchaseOrders(prev => [...prev, ...itemsList]);
            }
        } catch (err) {
            console.error('Error loading more items:', err);
            setError('Failed to load more items. Please try again.');
        } finally {
            setLoadingMore(false);
        }
    };

    // Handle search
    const handleSearch = (e) => {
        e.preventDefault();

        if (!searchTerm.trim()) {
            if (activeTab === 'alerts') {
                loadLowStockAlerts();
            } else if (activeTab === 'orders') {
                loadPurchaseOrders();
            }
            return;
        }

        setLoading(true);

        const searchTermLower = searchTerm.toLowerCase();

        // Get items first (without pagination)
        const fetchAllForSearch = async () => {
            try {
                let itemsRef;
                let items = [];

                if (activeTab === 'alerts') {
                    itemsRef = collection(db, 'lowStockAlerts');
                    const snapshot = await getDocs(itemsRef);

                    items = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date()
                    }));

                    // Filter alerts based on search term
                    const filteredItems = items.filter(alert =>
                        alert.productName?.toLowerCase().includes(searchTermLower) ||
                        alert.variantName?.toLowerCase().includes(searchTermLower) ||
                        alert.productId?.toLowerCase().includes(searchTermLower)
                    );

                    setLowStockAlerts(filteredItems);
                } else if (activeTab === 'orders') {
                    itemsRef = collection(db, 'purchaseOrders');
                    const snapshot = await getDocs(itemsRef);

                    items = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date()
                    }));

                    // Filter purchase orders based on search term
                    const filteredItems = items.filter(order =>
                        order.productName?.toLowerCase().includes(searchTermLower) ||
                        order.variantName?.toLowerCase().includes(searchTermLower) ||
                        order.productId?.toLowerCase().includes(searchTermLower) ||
                        order.supplierId?.toLowerCase().includes(searchTermLower)
                    );

                    setPurchaseOrders(filteredItems);
                }

                setHasMore(false); // No pagination for search results
            } catch (err) {
                console.error('Error searching items:', err);
                setError('Failed to search. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchAllForSearch();
    };

    // Handle settings form changes
    const handleSettingChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettingsForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
        }));
    };

    // Save global settings
    const saveGlobalSettings = async () => {
        try {
            const settingsRef = doc(db, 'settings', 'inventory');
            await updateDoc(settingsRef, settingsForm);

            setGlobalSettings(settingsForm);
            setIsEditingSettings(false);

            // Alert success
            alert('Inventory settings updated successfully');
        } catch (err) {
            console.error('Error updating inventory settings:', err);
            setError('Failed to update settings. Please try again.');
        }
    };

    // Handle purchase order status change
    const updatePurchaseOrderStatus = async (orderId, newStatus) => {
        try {
            const orderRef = doc(db, 'purchaseOrders', orderId);
            await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: Timestamp.now()
            });

            // Update local state
            setPurchaseOrders(prevOrders =>
                prevOrders.map(order =>
                    order.id === orderId
                        ? { ...order, status: newStatus, updatedAt: new Date() }
                        : order
                )
            );
        } catch (err) {
            console.error('Error updating purchase order status:', err);
            setError('Failed to update order status. Please try again.');
        }
    };

    // Mark alert as resolved
    const markAlertAsResolved = async (alertId) => {
        try {
            const alertRef = doc(db, 'lowStockAlerts', alertId);
            await updateDoc(alertRef, {
                status: 'resolved',
                resolvedAt: Timestamp.now()
            });

            // Update local state
            setLowStockAlerts(prevAlerts =>
                prevAlerts.map(alert =>
                    alert.id === alertId
                        ? { ...alert, status: 'resolved', resolvedAt: new Date() }
                        : alert
                )
            );
        } catch (err) {
            console.error('Error resolving alert:', err);
            setError('Failed to resolve alert. Please try again.');
        }
    };

    // Format date
    const formatDate = (date) => {
        if (!date) return 'N/A';

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Navigate to product details
    const navigateToProduct = (productId) => {
        window.open(`/product/${productId}`, '_blank');
    };

    // Generate order as PDF
    const generateOrderPdf = (order) => {
        // This would be implemented with a PDF generation library
        alert(`PDF generation for order ${order.id} would be implemented here`);
    };

    // Render alert status badge
    const renderStatusBadge = (status) => {
        const statusClasses = {
            new: 'status-new',
            processing: 'status-processing',
            resolved: 'status-resolved',
            pending: 'status-pending',
            ordered: 'status-ordered',
            shipped: 'status-shipped',
            received: 'status-received',
            cancelled: 'status-cancelled'
        };

        return (
            <span className={`status-badge ${statusClasses[status] || ''}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="admin-panel inventory-alerts-panel">
            <div className="panel-header">
                <h3>Inventory Alerts & Reordering</h3>

                <div className="tabs">
                    <button
                        className={activeTab === 'alerts' ? 'active' : ''}
                        onClick={() => setActiveTab('alerts')}
                    >
                        Low Stock Alerts
                    </button>
                    <button
                        className={activeTab === 'orders' ? 'active' : ''}
                        onClick={() => setActiveTab('orders')}
                    >
                        Purchase Orders
                    </button>
                    <button
                        className={activeTab === 'settings' ? 'active' : ''}
                        onClick={() => setActiveTab('settings')}
                    >
                        Settings
                    </button>
                </div>

                {(activeTab === 'alerts' || activeTab === 'orders') && (
                    <div className="filters-row">
                        <div className="search-container">
                            <form onSubmit={handleSearch}>
                                <input
                                    type="text"
                                    placeholder={activeTab === 'alerts' ? "Search alerts..." : "Search orders..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <button type="submit" className="search-button">Search</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="panel-content">
                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading...</p>
                    </div>
                ) : (
                    <>
                        {/* Low Stock Alerts Tab */}
                        {activeTab === 'alerts' && (
                            <>
                                {lowStockAlerts.length === 0 ? (
                                    <div className="no-items-message">
                                        <p>No low stock alerts found</p>
                                    </div>
                                ) : (
                                    <div className="alerts-table-container">
                                        <table className="alerts-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Current Stock</th>
                                                    <th>Threshold</th>
                                                    <th>Variant</th>
                                                    <th>Date</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lowStockAlerts.map(alert => (
                                                    <tr key={alert.id} className={alert.status === 'new' ? 'highlight-row' : ''}>
                                                        <td onClick={() => navigateToProduct(alert.productId)} className="clickable">
                                                            {alert.productName}
                                                        </td>
                                                        <td className={alert.currentStock === 0 ? 'out-of-stock' : 'low-stock'}>
                                                            {alert.currentStock}
                                                        </td>
                                                        <td>{alert.threshold}</td>
                                                        <td>{alert.variantName || 'N/A'}</td>
                                                        <td>{formatDate(alert.timestamp)}</td>
                                                        <td>{renderStatusBadge(alert.status)}</td>
                                                        <td>
                                                            <div className="action-buttons">
                                                                {alert.status !== 'resolved' && (
                                                                    <button
                                                                        className="resolve-button"
                                                                        onClick={() => markAlertAsResolved(alert.id)}
                                                                        title="Mark as Resolved"
                                                                    >
                                                                        Resolve
                                                                    </button>
                                                                )}
                                                                <button
                                                                    className="view-button"
                                                                    onClick={() => navigateToProduct(alert.productId)}
                                                                    title="View Product"
                                                                >
                                                                    View Product
                                                                </button>
                                                                <button
                                                                    className="reorder-button"
                                                                    title="Create Purchase Order"
                                                                    onClick={() => window.location.href = `/admin/purchase-orders/new?productId=${alert.productId}&variantId=${alert.variantId || ''}`}
                                                                >
                                                                    Create Order
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Purchase Orders Tab */}
                        {activeTab === 'orders' && (
                            <>
                                {purchaseOrders.length === 0 ? (
                                    <div className="no-items-message">
                                        <p>No purchase orders found</p>
                                    </div>
                                ) : (
                                    <div className="orders-table-container">
                                        <table className="orders-table">
                                            <thead>
                                                <tr>
                                                    <th>Order ID</th>
                                                    <th>Product</th>
                                                    <th>Quantity</th>
                                                    <th>Date Created</th>
                                                    <th>Auto-Generated</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {purchaseOrders.map(order => (
                                                    <tr key={order.id}>
                                                        <td>{order.id}</td>
                                                        <td onClick={() => navigateToProduct(order.productId)} className="clickable">
                                                            {order.productName} {order.variantName ? `(${order.variantName})` : ''}
                                                        </td>
                                                        <td>{order.quantity}</td>
                                                        <td>{formatDate(order.createdAt)}</td>
                                                        <td>{order.autoGenerated ? 'Yes' : 'No'}</td>
                                                        <td>{renderStatusBadge(order.status)}</td>
                                                        <td>
                                                            <div className="action-buttons">
                                                                {order.status === 'pending' && (
                                                                    <>
                                                                        <button
                                                                            className="shipped-button"
                                                                            onClick={() => updatePurchaseOrderStatus(order.id, 'shipped')}
                                                                            title="Mark as Shipped"
                                                                        >
                                                                            Shipped
                                                                        </button>
                                                                        <button
                                                                            className="cancel-button"
                                                                            onClick={() => updatePurchaseOrderStatus(order.id, 'cancelled')}
                                                                            title="Cancel Order"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {order.status === 'shipped' && (
                                                                    <button
                                                                        className="received-button"
                                                                        onClick={() => updatePurchaseOrderStatus(order.id, 'received')}
                                                                        title="Mark as Received"
                                                                    >
                                                                        Received
                                                                    </button>
                                                                )}
                                                                <button
                                                                    className="pdf-button"
                                                                    onClick={() => generateOrderPdf(order)}
                                                                    title="Generate PDF"
                                                                >
                                                                    PDF
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && (
                            <div className="settings-container">
                                <h4>Global Inventory Settings</h4>

                                {isEditingSettings ? (
                                    <form className="settings-form">
                                        <div className="form-group">
                                            <label htmlFor="defaultLowStockThreshold">Default Low Stock Threshold:</label>
                                            <input
                                                type="number"
                                                id="defaultLowStockThreshold"
                                                name="defaultLowStockThreshold"
                                                value={settingsForm.defaultLowStockThreshold}
                                                onChange={handleSettingChange}
                                                min="1"
                                            />
                                            <p className="field-hint">This value will be used as the default threshold for new products</p>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="defaultReorderQuantity">Default Reorder Quantity:</label>
                                            <input
                                                type="number"
                                                id="defaultReorderQuantity"
                                                name="defaultReorderQuantity"
                                                value={settingsForm.defaultReorderQuantity}
                                                onChange={handleSettingChange}
                                                min="1"
                                            />
                                            <p className="field-hint">Default quantity for automatic reordering</p>
                                        </div>

                                        <div className="form-group checkbox-group">
                                            <label htmlFor="enableAutoReordering">
                                                <input
                                                    type="checkbox"
                                                    id="enableAutoReordering"
                                                    name="enableAutoReordering"
                                                    checked={settingsForm.enableAutoReordering}
                                                    onChange={handleSettingChange}
                                                />
                                                Enable automatic reordering system-wide
                                            </label>
                                            <p className="field-hint">This is a global setting. Individual products still need auto-reorder enabled</p>
                                        </div>

                                        <div className="form-actions">
                                            <button
                                                type="button"
                                                className="save-button"
                                                onClick={saveGlobalSettings}
                                            >
                                                Save Settings
                                            </button>
                                            <button
                                                type="button"
                                                className="cancel-button"
                                                onClick={() => {
                                                    setSettingsForm({ ...globalSettings });
                                                    setIsEditingSettings(false);
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="settings-display">
                                        <div className="settings-item">
                                            <span className="settings-label">Default Low Stock Threshold:</span>
                                            <span className="settings-value">{globalSettings.defaultLowStockThreshold}</span>
                                        </div>

                                        <div className="settings-item">
                                            <span className="settings-label">Default Reorder Quantity:</span>
                                            <span className="settings-value">{globalSettings.defaultReorderQuantity}</span>
                                        </div>

                                        <div className="settings-item">
                                            <span className="settings-label">Auto-Reordering Enabled:</span>
                                            <span className="settings-value">{globalSettings.enableAutoReordering ? 'Yes' : 'No'}</span>
                                        </div>

                                        <button
                                            className="edit-button"
                                            onClick={() => setIsEditingSettings(true)}
                                        >
                                            Edit Settings
                                        </button>
                                    </div>
                                )}

                                <div className="inventory-docs">
                                    <h4>Documentation</h4>
                                    <p>The inventory alerts system will:</p>
                                    <ul>
                                        <li>Check product inventory levels daily at midnight (UTC)</li>
                                        <li>Generate alerts when stock falls below the threshold</li>
                                        <li>Automatically create purchase orders when auto-reordering is enabled</li>
                                        <li>Update inventory levels when orders are marked as received</li>
                                    </ul>
                                    <p>Note: For auto-reordering to work, products must have:</p>
                                    <ul>
                                        <li>Inventory tracking enabled</li>
                                        <li>A low stock threshold set</li>
                                        <li>Auto-reordering enabled at the product level</li>
                                        <li>A preferred supplier set</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Load More Button */}
                        {(activeTab === 'alerts' || activeTab === 'orders') && hasMore && (
                            <div className="load-more-container">
                                <button
                                    className="load-more-button"
                                    onClick={loadMoreItems}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default InventoryAlertsPanel;