import React, { useState, useEffect } from 'react';
import productArchiveService from '../../services/productArchiveService';
import '../../styles/admin/ProductArchivePanel.css';

const ProductArchivePanel = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [archivedProducts, setArchivedProducts] = useState([]);
    const [loadingArchived, setLoadingArchived] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');

    useEffect(() => {
        loadArchivedProducts();
    }, []);

    const loadArchivedProducts = async () => {
        setLoadingArchived(true);
        try {
            const response = await productArchiveService.getArchivedProducts({ limit: 10 });
            if (response.success) {
                setArchivedProducts(response.data);
            }
        } catch (err) {
            console.error('Error loading archived products:', err);
        } finally {
            setLoadingArchived(false);
        }
    };

    const handleManualCheck = async () => {
        setLoading(true);
        setResult(null);

        try {
            const overrideDate = selectedDate ? new Date(selectedDate).toISOString() : null;
            const response = await productArchiveService.manuallyCheckDeadlines(overrideDate);

            if (response.success) {
                setResult({
                    success: true,
                    message: response.data.message,
                    details: {
                        processed: response.data.processed,
                        archived: response.data.archived,
                        notificationsSent: response.data.notificationsSent
                    }
                });

                // Reload archived products if any were archived
                if (response.data.archived > 0) {
                    await loadArchivedProducts();
                }
            } else {
                setResult({
                    success: false,
                    message: response.error || 'Failed to check product deadlines'
                });
            }
        } catch (err) {
            console.error('Error checking product deadlines:', err);
            setResult({
                success: false,
                message: err.message || 'An error occurred'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreProduct = async (productId) => {
        if (!window.confirm('Are you sure you want to restore this product?')) {
            return;
        }

        try {
            const response = await productArchiveService.restoreProduct(productId);
            if (response.success) {
                // Remove from the list or reload
                await loadArchivedProducts();
            } else {
                alert('Failed to restore product: ' + (response.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error restoring product:', err);
            alert('Error restoring product: ' + err.message);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';

        if (timestamp.seconds) {
            // Firestore timestamp
            return new Date(timestamp.seconds * 1000).toLocaleString();
        }

        return new Date(timestamp).toLocaleString();
    };

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    return (
        <div className="product-archive-panel">
            <h2>Product Archive Management</h2>
            <div className="archive-controls">
                <div className="control-group">
                    <label htmlFor="deadlineDate">Check Deadline Date (Optional):</label>
                    <input
                        type="date"
                        id="deadlineDate"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <p className="hint-text">
                        Leave empty to use current date. Set a date to test products with deadlines before that date.
                    </p>
                </div>

                <button
                    className="check-deadlines-button"
                    onClick={handleManualCheck}
                    disabled={loading}
                >
                    {loading ? 'Processing...' : 'Check Product Deadlines'}
                </button>
            </div>

            {result && (
                <div className={`result-message ${result.success ? 'success' : 'error'}`}>
                    <h3>{result.success ? 'Success' : 'Error'}</h3>
                    <p>{result.message}</p>

                    {result.success && result.details && (
                        <div className="result-details">
                            <p>Products processed: {result.details.processed}</p>
                            <p>Products archived: {result.details.archived}</p>
                            <p>Notifications sent: {result.details.notificationsSent}</p>
                        </div>
                    )}
                </div>
            )}

            <div className="archived-products-section">
                <h3>Recently Archived Products</h3>

                {loadingArchived ? (
                    <div className="loading-indicator">Loading archived products...</div>
                ) : archivedProducts.length === 0 ? (
                    <div className="no-archived-products">
                        <p>No archived products found</p>
                    </div>
                ) : (
                    <div className="archived-products-list">
                        <table className="archived-products-table">
                            <thead>
                                <tr>
                                    <th>Product Name</th>
                                    <th>Designer</th>
                                    <th>Funding</th>
                                    <th>Goal</th>
                                    <th>Archived Date</th>
                                    <th>Reason</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {archivedProducts.map(product => (
                                    <tr key={product.id}>
                                        <td>{product.name}</td>
                                        <td>{product.designerName || product.designerId}</td>
                                        <td>{formatCurrency(product.currentFunding)}</td>
                                        <td>{formatCurrency(product.fundingGoal)}</td>
                                        <td>{formatDate(product.archivedAt)}</td>
                                        <td>{productArchiveService.formatReason(product.archiveReason)}</td>
                                        <td>
                                            <button
                                                className="restore-button"
                                                onClick={() => handleRestoreProduct(product.id)}
                                            >
                                                Restore
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductArchivePanel;
