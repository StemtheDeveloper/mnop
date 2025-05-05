import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, updateDoc, runTransaction, increment, arrayUnion, collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../contexts/ToastContext'; // Fixed import path with 's' in contexts
import LoadingSpinner from '../components/LoadingSpinner';
import InvestmentModal from '../components/InvestmentModal';
import ManufacturerSelectionModal from '../components/ManufacturerSelectionModal'; // Add import for new component
import TrendingExtensionButton from '../components/TrendingExtensionButton';
import SocialShareButtons from '../components/SocialShareButtons';
import productTrendingService from '../services/productTrendingService';
import reviewService from '../services/reviewService'; // Import the review service
import walletService from '../services/walletService'; // Import wallet service
import '../styles/ProductDetailPage.css';
import { serverTimestamp } from 'firebase/firestore';
import DOMPurify from 'dompurify'; // Add this import for safely rendering HTML

const ProductDetailPage = () => {
    const { productId } = useParams();
    const navigate = useNavigate();
    const { currentUser, hasRole, userWallet, fundProduct } = useUser();
    const { success: showSuccess, error: showError } = useToast(); // Map to correct function names
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showInvestModal, setShowInvestModal] = useState(false);
    const [showManufacturerModal, setShowManufacturerModal] = useState(false); // New state for manufacturer modal
    const [fundAmount, setFundAmount] = useState('');
    const [isFunding, setIsFunding] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [buttonAnimation, setButtonAnimation] = useState('');
    const [designer, setDesigner] = useState(null);
    const [categoryNames, setCategoryNames] = useState([]); // Add this state for category names
    const [componentProducts, setComponentProducts] = useState([]);
    const [componentInventory, setComponentInventory] = useState({});
    const [cartQuantity, setCartQuantity] = useState(1);
    const [maxAvailableQuantity, setMaxAvailableQuantity] = useState(0);

    // Enhanced reviews state
    const [reviews, setReviews] = useState([]);
    const [reviewsToShow, setReviewsToShow] = useState(5);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [lastVisibleReview, setLastVisibleReview] = useState(null);
    const [hasMoreReviews, setHasMoreReviews] = useState(false);
    const [reviewSortBy, setReviewSortBy] = useState('newest');
    const [reviewRatingFilter, setReviewRatingFilter] = useState(0);
    const [userReview, setUserReview] = useState({ rating: 0, text: '' });
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [ratingDistribution, setRatingDistribution] = useState(null);
    const [replyingToReview, setReplyingToReview] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [moderationAction, setModerationAction] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [moderationStatus, setModerationStatus] = useState({ loading: false, error: null, success: null });
    const [moderationActionReviewId, setModerationActionReviewId] = useState(null);

    const initialReviewsCount = 5;

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

                const productData = {
                    id: productDoc.id,
                    ...productDoc.data()
                };

                setProduct(productData);

                // If this is a composite product, fetch the component products
                if (productData.isComposite && productData.componentProducts &&
                    Array.isArray(productData.componentProducts) && productData.componentProducts.length > 0) {
                    try {
                        const componentDetails = [];
                        const inventoryStatus = {};

                        // Fetch each component product details
                        for (const component of productData.componentProducts) {
                            const componentRef = doc(db, 'products', component.id);
                            const componentDoc = await getDoc(componentRef);

                            if (componentDoc.exists()) {
                                const componentData = {
                                    ...componentDoc.data(),
                                    id: componentDoc.id,
                                    quantityInComposite: component.quantity || 1
                                };

                                componentDetails.push(componentData);

                                // Track inventory for each component
                                if (componentData.trackInventory) {
                                    inventoryStatus[component.id] = {
                                        stockQuantity: componentData.stockQuantity || 0,
                                        quantityNeeded: component.quantity || 1,
                                        available: Math.floor((componentData.stockQuantity || 0) / (component.quantity || 1))
                                    };
                                } else {
                                    // If component doesn't track inventory, assume unlimited
                                    inventoryStatus[component.id] = {
                                        stockQuantity: null,
                                        quantityNeeded: component.quantity || 1,
                                        available: Number.MAX_SAFE_INTEGER
                                    };
                                }
                            }
                        }

                        setComponentProducts(componentDetails);
                        setComponentInventory(inventoryStatus);

                        // Calculate max available quantity based on component inventory
                        if (Object.keys(inventoryStatus).length > 0) {
                            const maxQuantity = Math.min(
                                ...Object.values(inventoryStatus).map(item => item.available)
                            );
                            setMaxAvailableQuantity(maxQuantity);
                        } else {
                            // If no component products have inventory tracking
                            setMaxAvailableQuantity(Number.MAX_SAFE_INTEGER);
                        }
                    } catch (err) {
                        console.error('Error fetching component products:', err);
                    }
                }

                // Fetch category names if categories exist
                if (productData.categories && Array.isArray(productData.categories) && productData.categories.length > 0) {
                    try {
                        const fetchedCategoryNames = [];
                        for (const categoryId of productData.categories) {
                            const categoryRef = doc(db, 'categories', categoryId);
                            const categoryDoc = await getDoc(categoryRef);
                            if (categoryDoc.exists()) {
                                fetchedCategoryNames.push(categoryDoc.data().name || categoryId);
                            } else {
                                fetchedCategoryNames.push(categoryId); // Fallback to ID if name not found
                            }
                        }
                        setCategoryNames(fetchedCategoryNames);
                    } catch (err) {
                        console.error('Error fetching category names:', err);
                    }
                } else if (productData.category) {
                    // Handle legacy single-category products
                    try {
                        const categoryRef = doc(db, 'categories', productData.category);
                        const categoryDoc = await getDoc(categoryRef);
                        if (categoryDoc.exists()) {
                            setCategoryNames([categoryDoc.data().name || productData.category]);
                        } else {
                            setCategoryNames([productData.category]); // Fallback to ID if name not found
                        }
                    } catch (err) {
                        console.error('Error fetching category name:', err);
                        setCategoryNames([productData.category]); // Fallback to category ID
                    }
                }

                // Fetch the designer data if designer ID exists
                if (productData.designerId) {
                    try {
                        const designerRef = doc(db, 'users', productData.designerId);
                        const designerDoc = await getDoc(designerRef);

                        if (designerDoc.exists()) {
                            setDesigner({
                                id: designerDoc.id,
                                ...designerDoc.data()
                            });
                        }
                    } catch (err) {
                        console.error('Error fetching designer info:', err);
                    }
                }

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

    // Enhanced fetch reviews with sorting, filtering and pagination
    useEffect(() => {
        const fetchReviews = async () => {
            if (!productId) return;

            setReviewsLoading(true);

            try {
                // Fetch reviews with sorting and filtering
                const result = await reviewService.getProductReviews(productId, {
                    sortBy: reviewSortBy,
                    ratingFilter: reviewRatingFilter,
                    pageSize: reviewsToShow,
                    lastDoc: null, // Initially no last document for pagination
                    withReplies: true
                });

                if (result.success) {
                    setReviews(result.data);
                    setLastVisibleReview(result.lastVisible);
                    setHasMoreReviews(result.hasMore);

                    // Fetch rating distribution
                    const distributionResult = await reviewService.getProductRatingDistribution(productId);
                    if (distributionResult.success) {
                        setRatingDistribution(distributionResult.data);
                    }

                    // Check if current user has already submitted a review
                    if (currentUser) {
                        const userReviewItem = result.data.find(review => review.userId === currentUser.uid);
                        if (userReviewItem) {
                            setUserReview({
                                rating: userReviewItem.rating,
                                text: userReviewItem.text
                            });
                        } else {
                            setUserReview({ rating: 0, text: '' });
                        }
                    }
                } else {
                    console.error('Error fetching reviews:', result.error);
                    showError("Failed to load reviews");
                }
            } catch (error) {
                console.error('Error fetching reviews:', error);
                showError("Failed to load reviews");
            } finally {
                setReviewsLoading(false);
            }
        };

        fetchReviews();
    }, [productId, currentUser, reviewSortBy, reviewRatingFilter, reviewsToShow]);

    // Handle Cart Quantity Change
    const handleQuantityChange = (e) => {
        const value = parseInt(e.target.value) || 1;
        // Ensure quantity is within valid range
        const newQuantity = Math.min(Math.max(1, value), maxAvailableQuantity);
        setCartQuantity(newQuantity);
    };

    // Increment Cart Quantity
    const incrementQuantity = () => {
        if (cartQuantity < maxAvailableQuantity) {
            setCartQuantity(cartQuantity + 1);
        }
    };

    // Decrement Cart Quantity
    const decrementQuantity = () => {
        if (cartQuantity > 1) {
            setCartQuantity(cartQuantity - 1);
        }
    };

    // Handle Add to Cart - Modified to handle composite products and quantity
    const handleAddToCart = async () => {
        if (!currentUser) {
            showError("Please sign in to add items to cart");
            return;
        }

        // Start animation and loading state
        setButtonAnimation('animate-add-to-cart');
        setIsAddingToCart(true);

        try {
            // Process the product images before adding to cart
            let imageToUse = 'https://placehold.co/300x300?text=Product';
            if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
                imageToUse = product.imageUrls[0];
            } else if (product.imageUrl) {
                imageToUse = product.imageUrl;
            }

            // Check if user has a cart
            const cartsRef = collection(db, 'carts');
            const cartQuery = query(cartsRef, where('userId', '==', currentUser.uid));
            const cartSnapshot = await getDocs(cartQuery);

            // Prepare the cart item
            const cartItem = {
                id: product.id,
                name: product.name,
                price: product.price || 0,
                imageUrl: imageToUse,
                quantity: cartQuantity,
                isComposite: product.isComposite || false,
                // Include component info for inventory tracking if this is a composite product
                componentProducts: product.isComposite ?
                    product.componentProducts.map(comp => ({
                        id: comp.id,
                        quantity: comp.quantity * cartQuantity
                    })) : []
            };

            if (cartSnapshot.empty) {
                // Create a new cart
                const cartData = {
                    userId: currentUser.uid,
                    items: [cartItem],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await addDoc(cartsRef, cartData);
            } else {
                // Update existing cart
                const cartDoc = cartSnapshot.docs[0];
                const cartData = cartDoc.data();
                const items = cartData.items || [];

                // Check if product already in cart
                const existingItemIndex = items.findIndex(item => item.id === product.id);

                if (existingItemIndex >= 0) {
                    // Increase quantity
                    items[existingItemIndex].quantity += cartQuantity;

                    // Update component quantities if this is a composite product
                    if (items[existingItemIndex].isComposite && items[existingItemIndex].componentProducts) {
                        items[existingItemIndex].componentProducts =
                            items[existingItemIndex].componentProducts.map(comp => ({
                                id: comp.id,
                                quantity: comp.quantity + (comp.quantity / items[existingItemIndex].quantity) * cartQuantity
                            }));
                    }

                    await updateDoc(doc(db, 'carts', cartDoc.id), {
                        items,
                        updatedAt: serverTimestamp()
                    });
                } else {
                    // Add new item
                    await updateDoc(doc(db, 'carts', cartDoc.id), {
                        items: [...items, cartItem],
                        updatedAt: serverTimestamp()
                    });
                }
            }

            // Create a notification in Firestore
            if (currentUser) {
                await addDoc(collection(db, 'notifications'), {
                    userId: currentUser.uid,
                    title: 'Product Added to Cart',
                    message: `${cartQuantity} ${cartQuantity > 1 ? 'units' : 'unit'} of ${product.name} added to your cart.`,
                    type: 'cart_update',
                    productId: product.id,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }

            // Show success notification with product details
            showSuccess(`Added to cart: ${cartQuantity} ${cartQuantity > 1 ? 'units' : 'unit'} of ${product.name} (${formatPrice(product.price * cartQuantity || 0)})`);

            // Reset cart quantity to 1 after successful add
            setCartQuantity(1);
        } catch (error) {
            console.error("Error adding to cart:", error);
            showError("Failed to add to cart");
        } finally {
            setIsAddingToCart(false);
            // Reset animation after a delay
            setTimeout(() => setButtonAnimation(''), 700);
        }
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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

    // Process the product images
    const productImages = [];
    if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
        productImages.push(...product.imageUrls);
    } else if (product.imageUrl) {
        productImages.push(product.imageUrl);
    } else {
        productImages.push('https://placehold.co/600x400?text=Product+Image');
    }

    // Product info section - conditional rendering based on product type
    return (
        <div className="product-detail-page">
            <div className="product-detail-container">
                <div className="product-images">
                    <div className="main-image">
                        <img src={productImages[selectedImageIndex]} alt={product.name} />
                    </div>
                    {productImages.length > 1 && (
                        <div className="image-thumbnails">
                            {productImages.map((img, index) => (
                                <img
                                    key={index}
                                    src={img}
                                    alt={`${product.name} - view ${index + 1}`}
                                    className={`thumbnail ${index === selectedImageIndex ? 'active' : ''}`}
                                    onClick={() => setSelectedImageIndex(index)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="product-info">
                    <h1 className="product-title">{product.name}</h1>
                    <p className="product-price">{formatPrice(product.price || 0)}</p>

                    {/* Social Share Buttons */}
                    <div className="product-social-share">
                        <SocialShareButtons
                            url={window.location.href}
                            title={`Check out ${product.name} on M'NOP`}
                            description={product.description ? product.description.slice(0, 150) + (product.description.length > 150 ? '...' : '') : ''}
                            mediaUrl={productImages[0]}
                            hashtags="mnop,product,design"
                            showText={false}
                            layout="horizontal"
                            platforms={['facebook', 'twitter', 'pinterest', 'linkedin', 'whatsapp', 'email', 'copy']}
                        />
                    </div>

                    {/* Product Type Badge */}
                    <div className="product-type-badge">
                        {product.isComposite ? (
                            <span className="badge composite">Composite Product</span>
                        ) : product.isCrowdfunded !== false ? (
                            <span className="badge crowdfunding">Crowdfunded Product</span>
                        ) : (
                            <span className="badge direct-sell">Direct Purchase</span>
                        )}
                    </div>

                    {/* Inventory Status */}
                    {product.isComposite ? (
                        <div className="inventory-status">
                            <span className={`inventory-badge ${maxAvailableQuantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                {maxAvailableQuantity > 0
                                    ? `In Stock (${maxAvailableQuantity > 100 ? '100+' : maxAvailableQuantity} available)`
                                    : 'Out of Stock'}
                            </span>
                        </div>
                    ) : product.trackInventory && (isFullyFunded || !product.fundingGoal) ? (
                        <div className="inventory-status">
                            <span className={`inventory-badge ${(product.stockQuantity || 0) > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                {(product.stockQuantity || 0) > 0
                                    ? `In Stock (${product.stockQuantity > 100 ? '100+' : product.stockQuantity} available)`
                                    : 'Out of Stock'}
                            </span>
                        </div>
                    ) : null}

                    {/* Categories */}
                    {categoryNames.length > 0 && (
                        <div className="product-categories">
                            <h3>Categories</h3>
                            <div className="category-tags">
                                {categoryNames.map((category, index) => (
                                    <span key={index} className="category-tag">{category}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Designer information */}
                    {designer && (
                        <div className="product-designer">
                            <h3>Designed by</h3>
                            <Link to={`/user/${designer.id}`} className="designer-info">
                                <div className="designer-avatar">
                                    {designer.photoURL ? (
                                        <img src={designer.photoURL} alt={designer.displayName || 'Designer'} />
                                    ) : (
                                        <div className="default-avatar">
                                            {designer.displayName?.charAt(0).toUpperCase() || 'D'}
                                        </div>
                                    )}
                                </div>
                                <span className="designer-name">{designer.displayName || product.designerName || 'Unknown Designer'}</span>
                            </Link>
                        </div>
                    )}

                    <div className="product-description">
                        <h3>Description</h3>
                        <p dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(product.description || '', {
                                USE_PROFILES: { html: true }
                            })
                        }}></p>
                    </div>

                    {/* Composite Product Components Section */}
                    {product.isComposite && componentProducts.length > 0 && (
                        <div className="composite-components">
                            <h3>This bundle includes:</h3>
                            <div className="component-list">
                                {componentProducts.map((component, index) => (
                                    <div key={component.id} className="component-item">
                                        <div className="component-image">
                                            <img
                                                src={component.imageUrls?.[0] || 'https://placehold.co/100x100?text=Product'}
                                                alt={component.name}
                                            />
                                        </div>
                                        <div className="component-details">
                                            <h4 className="component-name">{component.name}</h4>
                                            <div className="component-price">
                                                {formatPrice(component.price)} × {component.quantityInComposite}
                                            </div>
                                            <div className="component-inventory">
                                                {componentInventory[component.id]?.stockQuantity !== null ? (
                                                    <span className={`inventory-status ${componentInventory[component.id]?.available > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                                        {componentInventory[component.id]?.available > 0
                                                            ? `In stock`
                                                            : 'Out of stock'}
                                                    </span>
                                                ) : (
                                                    <span className="inventory-status in-stock">Available</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="composite-summary">
                                <div className="value-calculation">
                                    <div className="individual-value">
                                        <span>Individual Value:</span>
                                        <span>{formatPrice(componentProducts.reduce((total, component) =>
                                            total + (component.price * component.quantityInComposite), 0))}</span>
                                    </div>
                                    <div className="bundle-price">
                                        <span>Bundle Price:</span>
                                        <span>{formatPrice(product.price)}</span>
                                    </div>
                                    <div className="savings">
                                        <span>You Save:</span>
                                        <span className="savings-amount">{formatPrice(
                                            componentProducts.reduce((total, component) =>
                                                total + (component.price * component.quantityInComposite), 0) - product.price
                                        )}</span>
                                        <span className="savings-percentage">
                                            ({product.bundleSavingsPercent || Math.round(
                                                (componentProducts.reduce((total, component) =>
                                                    total + (component.price * component.quantityInComposite), 0) - product.price) /
                                                componentProducts.reduce((total, component) =>
                                                    total + (component.price * component.quantityInComposite), 0) * 100
                                            )}% off)
                                        </span>
                                    </div>
                                    {product.bundleDiscountType && (
                                        <div className="discount-type">
                                            <span className="discount-badge">
                                                {product.bundleDiscountType === 'percentage' ?
                                                    `${Math.round(product.bundleDiscountValue)}% Bundle Discount` :
                                                    product.bundleDiscountType === 'fixed' ?
                                                        `$${product.bundleDiscountValue.toFixed(2)} Off Bundle` :
                                                        'Special Bundle Price'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ratings and Reviews Section */}
                    <div className="product-reviews">
                        <h3>Ratings & Reviews</h3>
                        <div className="reviews-summary">
                            <div className="average-rating">
                                <span className="rating-value">{product.averageRating ? product.averageRating.toFixed(1) : '0.0'}</span>
                                <div className="rating-stars">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className={`star ${star <= Math.round(product.averageRating || 0) ? 'filled' : ''}`}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                                <span className="review-count">({product.reviewCount || 0} reviews)</span>
                            </div>

                            {/* Rating Distribution Bars */}
                            {ratingDistribution && (
                                <div className="rating-distribution">
                                    <div className="distribution-title">Rating Distribution</div>
                                    {[5, 4, 3, 2, 1].map(star => {
                                        const count = ratingDistribution.distribution[star] || 0;
                                        const percentage = ratingDistribution.reviewCount
                                            ? Math.round((count / ratingDistribution.reviewCount) * 100)
                                            : 0;

                                        return (
                                            <div key={star} className="distribution-row">
                                                <div className="distribution-label">
                                                    <span className="star">★</span> {star}
                                                </div>
                                                <div className="distribution-bar-container">
                                                    <div
                                                        className="distribution-bar"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                                <div className="distribution-count">{count}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Review Filtering and Sorting */}
                        <div className="review-filters">
                            <div className="review-filter-group">
                                <span className="review-filter-label">Sort by:</span>
                                <select
                                    className="review-filter-select"
                                    value={reviewSortBy}
                                    onChange={(e) => setReviewSortBy(e.target.value)}
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="highest">Highest Rating</option>
                                    <option value="lowest">Lowest Rating</option>
                                    <option value="helpful">Most Helpful</option>
                                </select>
                            </div>

                            <div className="review-filter-group">
                                <span className="review-filter-label">Filter by:</span>
                                <div className="star-filter-buttons">
                                    {[5, 4, 3, 2, 1].map(rating => (
                                        <button
                                            key={rating}
                                            className={`star-button ${reviewRatingFilter === rating ? 'active' : ''}`}
                                            onClick={() => setReviewRatingFilter(rating === reviewRatingFilter ? 0 : rating)}
                                        >
                                            <span className="star">★</span> {rating}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {reviewRatingFilter > 0 && (
                                <button
                                    className="review-filter-button"
                                    onClick={() => setReviewRatingFilter(0)}
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>

                        {reviewsLoading && reviews.length === 0 ? (
                            <div className="loading-container">
                                <LoadingSpinner />
                                <p>Loading reviews...</p>
                            </div>
                        ) : reviews.length > 0 ? (
                            <div className="reviews-list">
                                {reviews.map((review) => (
                                    <div key={review.id} className="review-item">
                                        <div className="review-header">
                                            <div className="reviewer-info">
                                                {review.userPhotoURL ? (
                                                    <img src={review.userPhotoURL} alt={review.userName} className="reviewer-avatar" />
                                                ) : (
                                                    <div className="reviewer-avatar default-avatar">
                                                        {review.userName?.charAt(0).toUpperCase() || 'A'}
                                                    </div>
                                                )}
                                                <span className="reviewer-name">{review.userName || 'Anonymous'}</span>
                                            </div>
                                            <div className="review-rating">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <span
                                                        key={star}
                                                        className={`star ${star <= review.rating ? 'filled' : ''}`}
                                                    >
                                                        ★
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="review-date">
                                                {review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                                            </span>
                                        </div>

                                        <div className="review-text">
                                            {review.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="reviews-empty-state">
                                <p>No reviews yet for this product. Be the first to share your thoughts!</p>
                            </div>
                        )}

                        {/* Load More Reviews Button */}
                        {hasMoreReviews && (
                            <button
                                className="load-more-reviews"
                                onClick={() => setReviewsToShow(reviewsToShow + 5)}
                                disabled={reviewsLoading}
                            >
                                {reviewsLoading ? 'Loading...' : 'Load More Reviews'}
                            </button>
                        )}
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

                    {/* Funding information for crowdfunded products only */}
                    {product.fundingGoal > 0 && product.isCrowdfunded !== false && (
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

                            {/* Add funding form for investors only */}
                            {hasRole('investor') && !isFullyFunded && (
                                <div className="funding-form">
                                    <h4>Fund This Product</h4>
                                    <div className="funding-input-group">
                                        <div className="funding-input-wrapper">
                                            <span className="currency-symbol">$</span>
                                            <input
                                                type="text"
                                                value={fundAmount}
                                                onChange={(e) => {
                                                    // Allow only positive numbers with decimal
                                                    const value = e.target.value;
                                                    if (!value || value.match(/^\d*\.?\d*$/)) {
                                                        setFundAmount(value);
                                                    }
                                                }}
                                                placeholder="Enter amount"
                                                disabled={isFunding}
                                            />
                                        </div>
                                        <button
                                            className="fund-button"
                                            onClick={async () => {
                                                if (!fundAmount || parseFloat(fundAmount) <= 0) {
                                                    showError('Please enter a valid amount');
                                                    return;
                                                }

                                                // Fetch the latest wallet balance directly from service
                                                let currentBalance = 0;
                                                try {
                                                    const wallet = await walletService.getUserWallet(currentUser.uid);
                                                    currentBalance = wallet?.balance || 0;
                                                } catch (err) {
                                                    console.error('Error fetching wallet balance:', err);
                                                }

                                                if (parseFloat(fundAmount) > currentBalance) {
                                                    showError('Insufficient funds in your wallet');
                                                    return;
                                                }

                                                setIsFunding(true);
                                                try {
                                                    const result = await fundProduct(
                                                        product.id,
                                                        product.name,
                                                        parseFloat(fundAmount)
                                                    );

                                                    if (result.success) {
                                                        showSuccess(`Successfully invested $${fundAmount} in ${product.name}`);
                                                        setFundAmount('');
                                                    } else {
                                                        showError(result.error || 'Failed to process investment');
                                                    }
                                                } catch (err) {
                                                    console.error('Error funding product:', err);
                                                    showError(err.message || 'An error occurred while processing your investment');
                                                } finally {
                                                    setIsFunding(false);
                                                }
                                            }}
                                            disabled={isFunding || !fundAmount}
                                        >
                                            {isFunding ? 'Processing...' : 'Fund Now'}
                                        </button>
                                    </div>
                                    <div className="funding-wallet-balance">
                                        Wallet Balance: {formatPrice(userWallet?.balance || 0)}
                                    </div>

                                    {remainingFunding > 0 && (
                                        <p className="funding-remaining">
                                            {formatPrice(remainingFunding)} more needed to reach the goal
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Show funding complete message if fully funded */}
                            {isFullyFunded && (
                                <div className="funding-complete-message">
                                    <span>🎉 Funding goal reached! This product is fully funded.</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="product-actions">
                        {/* Quantity controls */}
                        <div className="quantity-control">
                            <button
                                className="quantity-btn"
                                onClick={decrementQuantity}
                                disabled={isAddingToCart || cartQuantity <= 1}
                            >
                                -
                            </button>
                            <input
                                type="number"
                                value={cartQuantity}
                                onChange={handleQuantityChange}
                                min="1"
                                max={maxAvailableQuantity}
                                disabled={isAddingToCart || maxAvailableQuantity <= 0}
                            />
                            <button
                                className="quantity-btn"
                                onClick={incrementQuantity}
                                disabled={isAddingToCart || cartQuantity >= maxAvailableQuantity}
                            >
                                +
                            </button>
                        </div>

                        {/* Add to Cart Button - only enabled when product is fully funded */}
                        <button
                            className={`btn-primary add-to-cart-button ${buttonAnimation}`}
                            disabled={isAddingToCart ||
                                // Disable if product is not fully funded and has a funding goal
                                (product.fundingGoal > 0 && !isFullyFunded) ||
                                // Also disable if out of stock
                                (product.isComposite && maxAvailableQuantity <= 0) ||
                                (!product.isComposite && product.trackInventory && (product.stockQuantity || 0) <= 0)}
                            onClick={handleAddToCart}
                        >
                            {isAddingToCart ? 'Adding...' : 'Add to Cart'}
                        </button>

                        {/* Register as an Investor Button */}
                        {!hasRole('investor') && (
                            <button
                                className="btn-secondary register-investor-button"
                                onClick={() => navigate('/register-investor')}
                            >
                                Register as an Investor
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
                />
            )}

            {/* Manufacturer Selection Modal */}
            {showManufacturerModal && (
                <ManufacturerSelectionModal
                    isOpen={showManufacturerModal}
                    onClose={() => setShowManufacturerModal(false)}
                    product={product}
                />
            )}
        </div>
    );
};

export default ProductDetailPage;
