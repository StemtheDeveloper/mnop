import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../LoadingSpinner';
import walletService from '../../services/walletService';

const ManufacturerProductsList = () => {
    const { currentUser } = useUser();
    const { success: showSuccess, error: showError } = useToast();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [processingId, setProcessingId] = useState(null);

    // Fetch products assigned to this manufacturer
    useEffect(() => {
        const fetchProducts = async () => {
            if (!currentUser?.uid) return;

            setLoading(true);
            try {
                // Query products where this user is set as the manufacturer
                const productsQuery = query(
                    collection(db, 'products'),
                    where('manufacturerId', '==', currentUser.uid),
                    where('manufacturerFunded', '==', true)
                );

                const productsSnapshot = await getDocs(productsQuery);
                const productsData = productsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Fetch designer information for each product
                const productsWithDetails = await Promise.all(
                    productsData.map(async (product) => {
                        try {
                            if (product.designerId) {
                                const designerDoc = await getDoc(doc(db, 'users', product.designerId));
                                if (designerDoc.exists()) {
                                    return {
                                        ...product,
                                        designer: {
                                            id: designerDoc.id,
                                            ...designerDoc.data()
                                        }
                                    };
                                }
                            }
                            return product;
                        } catch (error) {
                            console.error(`Error fetching designer for product ${product.id}:`, error);
                            return product;
                        }
                    })
                );

                setProducts(productsWithDetails);
            } catch (error) {
                console.error('Error fetching products:', error);
                showError('Failed to load assigned products.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [currentUser, showError]);

    // Handle marking a product as ready for purchase
    const handleMarkReadyForPurchase = async (productId) => {
        if (!currentUser?.uid || processingId) return;

        setProcessingId(productId);
        try {
            // Call the wallet service to mark product ready for purchase
            const result = await walletService.markProductReadyForPurchase(
                currentUser.uid,
                productId
            );

            if (result.success) {
                // Update local state to reflect the change
                setProducts(products.map(product => {
                    if (product.id === productId) {
                        return {
                            ...product,
                            readyForPurchase: true,
                            readyForPurchaseAt: new Date()
                        };
                    }
                    return product;
                }));

                showSuccess('Product is now available for purchase in the shop!');
            } else {
                showError(result.error || 'Failed to mark product as ready for purchase.');
            }
        } catch (error) {
            console.error('Error marking product ready:', error);
            showError('An unexpected error occurred.');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (products.length === 0) {
        return (
            <div className="manufacturer-products empty-state">
                <h3>No Assigned Products</h3>
                <p>No funded products have been assigned to you for manufacturing yet.</p>
            </div>
        );
    }

    return (
        <div className="manufacturer-products">
            <h3>Assigned Products</h3>
            <div className="products-list">
                {products.map(product => (
                    <div key={product.id} className="product-item">
                        <div className="product-image">
                            <img
                                src={product.imageUrl || (product.imageUrls && product.imageUrls[0]) || 'https://placehold.co/300x300?text=Product'}
                                alt={product.name}
                            />
                        </div>
                        <div className="product-details">
                            <h4>{product.name}</h4>
                            <p className="product-designer">
                                Designer: {product.designer?.displayName || product.designer?.email || 'Unknown'}
                            </p>
                            <p className="funded-amount">
                                Funded: ${product.manufacturerTransferAmount?.toFixed(2) || 0}
                            </p>
                            <p className="funded-date">
                                Funds Received: {product.manufacturerFundedAt?.toDate?.().toLocaleDateString() || 'Unknown'}
                            </p>
                            {product.readyForPurchase ? (
                                <div className="status-badge ready">
                                    Ready for Purchase
                                    <span className="ready-date">
                                        {product.readyForPurchaseAt?.toDate?.().toLocaleDateString() || 'N/A'}
                                    </span>
                                </div>
                            ) : (
                                <button
                                    className="mark-ready-button"
                                    onClick={() => handleMarkReadyForPurchase(product.id)}
                                    disabled={processingId === product.id}
                                >
                                    {processingId === product.id ? (
                                        <span className="processing">Processing...</span>
                                    ) : (
                                        "Mark Ready for Purchase"
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManufacturerProductsList;
