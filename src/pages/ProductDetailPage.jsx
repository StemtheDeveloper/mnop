import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import InvestmentModal from '../components/InvestmentModal';
import TrendingExtensionButton from '../components/TrendingExtensionButton';
import productTrendingService from '../services/productTrendingService';
import '../styles/ProductDetailPage.css';

const ProductDetailPage = () => {
    const { productId } = useParams();
    const { currentUser, hasRole } = useUser();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showInvestModal, setShowInvestModal] = useState(false);

    useEffect(() => {
        // Track product view when component mounts
        const trackView = async () => {
            if (productId && (!currentUser || currentUser.uid !== product?.designerId)) {
                await productTrendingService.trackProductView(
                    productId,
                    currentUser ? currentUser.uid : null
                );
            }
        };

        if (product) {
            trackView();
        }
    }, [productId, product, currentUser]);

    useEffect(() => {
        if (!productId) return;

        setLoading(true);
        setError(null);

        // Set up real-time listener for product updates
        const productRef = doc(db, 'products', productId);

        const unsubscribe = onSnapshot(
            productRef,
            (doc) => {
                if (doc.exists()) {
                    setProduct({ id: doc.id, ...doc.data() });
                } else {
                    setError('Product not found');
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching product:', err);
                setError('Error loading product');
                setLoading(false);
            }
        );

        // Clean up listener on unmount
        return () => unsubscribe();
    }, [productId]);

    const handleInvestSuccess = (amount, updatedFundingProgress) => {
        // Update the local product data with the new investment
        setProduct(prev => ({
            ...prev,
            fundingProgress: updatedFundingProgress || (prev.fundingProgress || 0) + amount
        }));
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    if (loading) {
        return (
            <div className="product-detail-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading product details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="product-detail-page">
                <div className="error-container">
                    <h2>Error</h2>
                    <p>{error}</p>
                    <Link to="/products" className="back-button">Back to Products</Link>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="product-detail-page">
                <div className="error-container">
                    <h2>Product Not Found</h2>
                    <p>The product you are looking for does not exist or has been removed.</p>
                    <Link to="/products" className="back-button">Back to Products</Link>
                </div>
            </div>
        );
    }

    // Calculate funding progress percentage
    const fundingPercentage = product.fundingGoal
        ? Math.min(((product.fundingProgress || 0) / product.fundingGoal) * 100, 100)
        : 0;

    return (
        <div className="product-detail-page">
            <div className="product-detail-container">
                <div className="product-images">
                    <div className="main-image">
                        <img src={product.imageUrl || '/placeholder-product.jpg'} alt={product.name} />
                    </div>
                    {/* Additional images would go here */}
                </div>

                <div className="product-info">
                    <h1 className="product-title">{product.name}</h1>
                    <p className="product-price">{formatPrice(product.price || 0)}</p>

                    <div className="product-description">
                        <h3>Description</h3>
                        <p>{product.description}</p>
                    </div>

                    {product.features && product.features.length > 0 && (
                        <div className="product-features">
                            <h3>Features</h3>
                            <ul>
                                {product.features.map((feature, index) => (
                                    <li key={index}>{feature}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {product.specifications && (
                        <div className="product-specifications">
                            <h3>Specifications</h3>
                            <table>
                                <tbody>
                                    {Object.entries(product.specifications).map(([key, value]) => (
                                        <tr key={key}>
                                            <td>{key}</td>
                                            <td>{value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Funding information for investment products */}
                    {product.fundingGoal && (
                        <div className="product-funding">
                            <h3>Funding Progress</h3>
                            <div className="funding-stats">
                                <span>{formatPrice(product.fundingProgress || 0)} raised</span>
                                <span className="funding-goal">Goal: {formatPrice(product.fundingGoal)}</span>
                            </div>
                            <div className="funding-progress-bar">
                                <div className="progress" style={{ width: `${fundingPercentage}%` }}></div>
                            </div>
                            <div className="funding-percentage">{Math.round(fundingPercentage)}% funded</div>
                        </div>
                    )}

                    <div className="product-actions">
                        {/* Add to Cart Button */}
                        <button className="add-to-cart-button">
                            Add to Cart
                        </button>

                        {/* Investment Button - only show for users with investor role */}
                        {currentUser && hasRole('investor') && product.fundingGoal && (
                            <button
                                className="invest-button"
                                onClick={() => setShowInvestModal(true)}
                            >
                                Invest in This Product
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Show trending extension button for the designer */}
            {product && <TrendingExtensionButton product={product} />}

            {/* Investment Modal */}
            {showInvestModal && (
                <InvestmentModal
                    isOpen={showInvestModal}
                    onClose={() => setShowInvestModal(false)}
                    product={product}
                    onSuccess={handleInvestSuccess}
                />
            )}
        </div>
    );
};

export default ProductDetailPage;
