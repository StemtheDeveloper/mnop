import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../LoadingSpinner';
import notificationService from '../../services/notificationService';
import '../../styles/AdminTools.css';

const ProductApprovalPanel = () => {
    const [pendingProducts, setPendingProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [requireApproval, setRequireApproval] = useState(true);
    const [settingLoading, setSettingLoading] = useState(false);
    const [updateSuccess, setUpdateSuccess] = useState('');

    // Fetch setting on component mount
    useEffect(() => {
        const fetchApprovalSetting = async () => {
            try {
                const settingsRef = doc(db, 'settings', 'productSettings');
                const settingsSnap = await getDoc(settingsRef);

                if (settingsSnap.exists()) {
                    setRequireApproval(settingsSnap.data().requireApproval ?? true);
                }
            } catch (err) {
                console.error('Error fetching approval settings:', err);
            }
        };

        fetchApprovalSetting();
    }, []);

    // Fetch pending products
    useEffect(() => {
        const fetchPendingProducts = async () => {
            setLoading(true);
            setError(null);

            try {
                const productsRef = collection(db, 'products');
                const pendingQuery = query(productsRef, where('status', '==', 'pending'));
                const snapshot = await getDocs(pendingQuery);

                const products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                }));

                // Sort by creation date (newest first)
                products.sort((a, b) => b.createdAt - a.createdAt);

                setPendingProducts(products);
            } catch (err) {
                console.error('Error fetching pending products:', err);
                setError('Failed to load pending products. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchPendingProducts();
    }, []);

    // Toggle approval setting
    const toggleApprovalSetting = async () => {
        setSettingLoading(true);

        try {
            const settingsRef = doc(db, 'settings', 'productSettings');
            const settingsSnap = await getDoc(settingsRef);

            // Check if document exists and create it if it doesn't
            if (!settingsSnap.exists()) {
                // Create the document if it doesn't exist
                await setDoc(settingsRef, {
                    requireApproval: !requireApproval,
                    updatedAt: new Date(),
                    createdAt: new Date()
                });
            } else {
                // Update the existing document
                await updateDoc(settingsRef, {
                    requireApproval: !requireApproval,
                    updatedAt: new Date()
                });
            }

            setRequireApproval(!requireApproval);
            setUpdateSuccess(`Product ${!requireApproval ? 'approval' : 'instant activation'} mode enabled`);

            // Clear success message after 3 seconds
            setTimeout(() => {
                setUpdateSuccess('');
            }, 3000);
        } catch (err) {
            console.error('Error updating approval setting:', err);
            setError('Failed to update approval setting');
        } finally {
            setSettingLoading(false);
        }
    };

    // Approve product
    const approveProduct = async (productId) => {
        try {
            // Get product details first to get designer ID and product name
            const productRef = doc(db, 'products', productId);
            const productDoc = await getDoc(productRef);

            if (!productDoc.exists()) {
                throw new Error('Product not found');
            }

            const productData = productDoc.data();
            const designerId = productData.designerId;
            const productName = productData.name;

            // Update product status
            await updateDoc(productRef, {
                status: 'active',
                updatedAt: new Date()
            });

            // Send notification to designer
            if (designerId) {
                await notificationService.sendProductApprovalNotification(
                    designerId,
                    productId,
                    productName
                );
            }

            // Update local state
            setPendingProducts(prevProducts =>
                prevProducts.filter(product => product.id !== productId)
            );

            setUpdateSuccess('Product approved successfully');

            // Clear success message after 3 seconds
            setTimeout(() => {
                setUpdateSuccess('');
            }, 3000);
        } catch (err) {
            console.error('Error approving product:', err);
            setError('Failed to approve product. Please try again.');
        }
    };

    // Reject product
    const rejectProduct = async (productId) => {
        try {
            // Get product details first to get designer ID and product name
            const productRef = doc(db, 'products', productId);
            const productDoc = await getDoc(productRef);

            if (!productDoc.exists()) {
                throw new Error('Product not found');
            }

            const productData = productDoc.data();
            const designerId = productData.designerId;
            const productName = productData.name;

            // Update product status
            await updateDoc(productRef, {
                status: 'rejected',
                updatedAt: new Date()
            });

            // Send notification to designer
            if (designerId) {
                await notificationService.sendProductRejectionNotification(
                    designerId,
                    productId,
                    productName
                );
            }

            // Update local state
            setPendingProducts(prevProducts =>
                prevProducts.filter(product => product.id !== productId)
            );

            setUpdateSuccess('Product rejected successfully');

            // Clear success message after 3 seconds
            setTimeout(() => {
                setUpdateSuccess('');
            }, 3000);
        } catch (err) {
            console.error('Error rejecting product:', err);
            setError('Failed to reject product. Please try again.');
        }
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    // Format date
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get the first available image URL from a product
    const getProductImage = (product) => {
        // First check for imageUrls array
        if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
            return product.imageUrls[0];
        }
        // Fall back to single imageUrl if it exists
        if (product.imageUrl) {
            return product.imageUrl;
        }
        // Return placeholder if no image found
        return 'https://placehold.co/300x300?text=No+Image';
    };

    return (
        <div className="admin-panel product-approval-panel">
            <div className="panel-header">
                <h3>Product Approval Management</h3>

                <div className="approval-setting-toggle">
                    <label className="switch-label">
                        <span>Require Admin Approval:</span>
                        <div className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={requireApproval}
                                onChange={toggleApprovalSetting}
                                disabled={settingLoading}
                            />
                            <span className="switch-slider"></span>
                        </div>
                    </label>
                    <p className="setting-description">
                        {requireApproval
                            ? "New products require admin approval before appearing in shop"
                            : "New products automatically appear in shop (instant activation)"}
                    </p>
                </div>

                {updateSuccess && <div className="success-message">{updateSuccess}</div>}
                {error && <div className="error-message">{error}</div>}
            </div>

            <div className="panel-content">
                <h4>Pending Products {pendingProducts.length > 0 && `(${pendingProducts.length})`}</h4>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading pending products...</p>
                    </div>
                ) : pendingProducts.length === 0 ? (
                    <div className="no-items-message">
                        <p>No pending products to approve</p>
                    </div>
                ) : (
                    <div className="pending-products-list">
                        {pendingProducts.map(product => (
                            <div key={product.id} className="pending-product-card">
                                <div className="admin-product-image">
                                    <img
                                        src={getProductImage(product)}
                                        alt={product.name}
                                        className="product-thumbnail"
                                    />
                                    {product.wasEdited && (
                                        <div className="edited-badge">
                                            Edited
                                        </div>
                                    )}
                                </div>
                                <div className="product-details">
                                    <h4>{product.name}</h4>
                                    <p className="product-description">{product.description}</p>
                                    <div className="product-meta">
                                        <span className="product-price">{formatPrice(product.price)}</span>
                                        <span className="product-category">{product.category}</span>
                                        <span className="product-date">
                                            {product.wasEdited ? (
                                                <>Edited: {formatDate(product.lastEditedAt?.toDate() || product.updatedAt?.toDate() || new Date())}</>
                                            ) : (
                                                <>Submitted: {formatDate(product.createdAt)}</>
                                            )}
                                        </span>
                                        <span className="product-designer">
                                            By: {product.designerName || 'Unknown Designer'}
                                        </span>
                                    </div>
                                </div>
                                <div className="product-actions">
                                    <button
                                        className="approve-button"
                                        onClick={() => approveProduct(product.id)}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        className="reject-button"
                                        onClick={() => rejectProduct(product.id)}
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductApprovalPanel;
