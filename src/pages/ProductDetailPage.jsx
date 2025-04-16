import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot, updateDoc, runTransaction, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import InvestmentModal from '../components/InvestmentModal';
import TrendingExtensionButton from '../components/TrendingExtensionButton';
import productTrendingService from '../services/productTrendingService';
import '../styles/ProductDetailPage.css';

const ProductDetailPage = () => {
    const { productId } = useParams();
    const { currentUser, hasRole, userWallet, fundProduct } = useUser();
    const { showSuccess, showError } = useToast();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showInvestModal, setShowInvestModal] = useState(false);
    const [fundAmount, setFundAmount] = useState('');
    const [isFunding, setIsFunding] = useState(false);

    // Calculate if product is fully funded
    const isFullyFunded = product && product.currentFunding >= product.fundingGoal;

    // Calculate remaining funding needed
    const remainingFunding = product ? Math.max(0, product.fundingGoal - product.currentFunding) : 0;

    useEffect(() => {
        // Track product view when component mounts
        const trackView = async () => {
            if (productId && currentUser && product && currentUser.uid !== product.designerId) {
                try {
                    await productTrendingService.trackProductView(productId);
                } catch (err) {
                    console.error('Error tracking product view:', err);
                }
            }
        };

        // Get product details
        const fetchProduct = async () => {
            try {
                const productRef = doc(db, 'products', productId);
                const productDoc = await getDoc(productRef);

                if (!productDoc.exists()) {
                    setError('Product not found');
                    setLoading(false);
                    return;
                }

                setProduct({
                    id: productDoc.id,
                    ...productDoc.data()
                });
                setLoading(false);
            } catch (err) {
                console.error('Error fetching product:', err);
                setError('Error loading product details');
                setLoading(false);
            }
        };

        if (productId) {
            fetchProduct();

            // Set up real-time listener for product updates
            const productRef = doc(db, 'products', productId);
            const unsubscribe = onSnapshot(productRef, (doc) => {
                if (doc.exists()) {
                    setProduct({
                        id: doc.id,
                        ...doc.data()
                    });
                    setLoading(false);
                } else {
                    setError('Product not found');
                    setLoading(false);
                }
            }, (error) => {
                console.error("Error listening to product:", error);
                setError('Error loading product details');
                setLoading(false);
            });

            if (currentUser && product) {
                trackView();
            }

            return () => unsubscribe();
        }
    }, [productId, currentUser, product?.designerId]);

    // Handle funding amount change
    const handleFundAmountChange = (e) => {
        const value = e.target.value;
        // Allow only numbers and decimal points
        if (/^\d*\.?\d*$/.test(value)) {
            setFundAmount(value);
        }
    };

    // Handle funding submission
    const handleFundProduct = async () => {
        if (!currentUser) {
            showError("Please sign in to fund this product");
            return;
        }

        const amount = parseFloat(fundAmount);

        if (isNaN(amount) || amount <= 0) {
            showError("Please enter a valid funding amount");
            return;
        }

        // Check if user has sufficient wallet balance
        if (!userWallet || amount > userWallet.balance) {
            showError("Insufficient wallet balance");
            return;
        }

        setIsFunding(true);

        try {
            const result = await fundProduct(productId, product.name, amount);
            showSuccess(`Successfully funded ${amount.toFixed(2)} credits`);
            setFundAmount(''); // Clear the input field

            // Update the product's funding in the UI
            setProduct(prev => ({
                ...prev,
                currentFunding: result.newTotal,
            }));

        } catch (err) {
            console.error('Error funding product:', err);
            showError(err.message || 'Failed to fund product');
        } finally {
            setIsFunding(false);
        }
    };

    const handleInvestSuccess = (amount, updatedFundingProgress) => {
        showSuccess(`Successfully invested ${amount.toFixed(2)} credits`);
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
        ? Math.min(((product.currentFunding || 0) / product.fundingGoal) * 100, 100)
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
                                <span>{formatPrice(product.currentFunding || 0)} raised</span>
                                <span className="funding-goal">Goal: {formatPrice(product.fundingGoal)}</span>
                            </div>
                            <div className="funding-progress-bar">
                                <div className="progress" style={{ width: `${fundingPercentage}%` }}></div>
                            </div>
                            <div className="funding-percentage">{Math.round(fundingPercentage)}% funded</div>

                            {/* Funding Form */}
                            {!isFullyFunded && currentUser && (
                                <div className="funding-form">
                                    <h4>Help fund this product</h4>
                                    <div className="funding-input-group">
                                        <div className="funding-input-wrapper">
                                            <span className="currency-symbol">$</span>
                                            <input
                                                type="text"
                                                value={fundAmount}
                                                onChange={handleFundAmountChange}
                                                placeholder={`Up to ${formatPrice(remainingFunding)}`}
                                                disabled={isFunding}
                                            />
                                        </div>
                                        <button
                                            className="fund-button"
                                            onClick={handleFundProduct}
                                            disabled={isFunding || !fundAmount}
                                        >
                                            {isFunding ? 'Processing...' : 'Fund Now'}
                                        </button>
                                    </div>
                                    <div className="funding-wallet-balance">
                                        Your wallet balance: {formatPrice(userWallet?.balance || 0)}
                                    </div>
                                </div>
                            )}

                            {/* If fully funded, show success message */}
                            {isFullyFunded && (
                                <div className="funding-complete-message">
                                    This product has been fully funded! 🎉
                                </div>
                            )}
                        </div>
                    )}

                    <div className="product-actions">
                        {/* Add to Cart Button - only enabled if product is fully funded */}
                        <button
                            className={`add-to-cart-button ${!isFullyFunded ? 'disabled' : ''}`}
                            disabled={!isFullyFunded}
                        >
                            {isFullyFunded ? 'Add to Cart' : 'Funding Required'}
                        </button>

                        {/* Investment Button - only show for users with investor role */}
                        {currentUser && hasRole('investor') && product.fundingGoal && !isFullyFunded && (
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
