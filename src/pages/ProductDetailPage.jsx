import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot, updateDoc, runTransaction, increment, arrayUnion, collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../contexts/ToastContext'; // Fixed import path with 's' in contexts
import LoadingSpinner from '../components/LoadingSpinner';
import InvestmentModal from '../components/InvestmentModal';
import ManufacturerSelectionModal from '../components/ManufacturerSelectionModal'; // Add import for new component
import TrendingExtensionButton from '../components/TrendingExtensionButton';
import productTrendingService from '../services/productTrendingService';
import reviewService from '../services/reviewService'; // Import the review service
import '../styles/ProductDetailPage.css';
import { serverTimestamp } from 'firebase/firestore';
import DOMPurify from 'dompurify'; // Add this import for safely rendering HTML

const ProductDetailPage = () => {
    const { productId } = useParams();
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

    // Function to handle sorting reviews
    const handleSortReviews = (sortBy) => {
        if (sortBy !== reviewSortBy) {
            setReviewSortBy(sortBy);
        }
    };

    // Function to handle filtering reviews by rating
    const handleFilterByRating = (rating) => {
        setReviewRatingFilter(rating === reviewRatingFilter ? 0 : rating);
    };

    // Function to load more reviews
    const handleLoadMoreReviews = async () => {
        if (!productId || !lastVisibleReview || !hasMoreReviews || reviewsLoading) return;

        setReviewsLoading(true);

        try {
            const result = await reviewService.getProductReviews(productId, {
                sortBy: reviewSortBy,
                ratingFilter: reviewRatingFilter,
                pageSize: 5, // Load 5 more reviews
                lastDoc: lastVisibleReview,
                withReplies: true
            });

            if (result.success) {
                setReviews(prevReviews => [...prevReviews, ...result.data]);
                setLastVisibleReview(result.lastVisible);
                setHasMoreReviews(result.hasMore);
            } else {
                console.error('Error loading more reviews:', result.error);
                showError("Failed to load more reviews");
            }
        } catch (error) {
            console.error('Error loading more reviews:', error);
            showError("Failed to load more reviews");
        } finally {
            setReviewsLoading(false);
        }
    };

    // Function to mark a review as helpful
    const handleMarkReviewHelpful = async (reviewId) => {
        if (!currentUser) {
            showError("Please sign in to mark reviews as helpful");
            return;
        }

        try {
            const result = await reviewService.markReviewHelpful(reviewId, currentUser.uid, true);

            if (result.success) {
                // Update the reviews state to reflect the new helpful count
                setReviews(prevReviews => prevReviews.map(review =>
                    review.id === reviewId
                        ? {
                            ...review,
                            helpfulCount: result.data.helpfulCount,
                            helpfulVoters: review.helpfulVoters
                                ? (result.data.hasVoted
                                    ? [...review.helpfulVoters, currentUser.uid]
                                    : review.helpfulVoters.filter(id => id !== currentUser.uid))
                                : (result.data.hasVoted ? [currentUser.uid] : [])
                        }
                        : review
                ));

                showSuccess(result.message);
            } else {
                showError(result.error || "Failed to mark review as helpful");
            }
        } catch (error) {
            console.error('Error marking review as helpful:', error);
            showError("Failed to mark review as helpful");
        }
    };

    // Function to add a reply to a review
    const handleReplyToReview = async (reviewId) => {
        if (!currentUser) {
            showError("Please sign in to reply to reviews");
            return;
        }

        if (!replyText.trim()) {
            showError("Reply cannot be empty");
            return;
        }

        setIsSubmittingReply(true);

        try {
            // Determine if the current user is the designer or an admin
            const isDesigner = product.designerId === currentUser.uid;
            const isAdmin = hasRole('admin');

            const replyData = {
                reviewId,
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Anonymous',
                userPhotoURL: currentUser.photoURL || null,
                text: replyText.trim(),
                isDesigner,
                isAdmin
            };

            const result = await reviewService.addReviewReply(replyData);

            if (result.success) {
                // Update the reviews state to include the new reply
                setReviews(prevReviews => prevReviews.map(review =>
                    review.id === reviewId
                        ? {
                            ...review,
                            replies: [...(review.replies || []), result.data],
                            replyCount: (review.replyCount || 0) + 1
                        }
                        : review
                ));

                // Clear the reply form and close it
                setReplyText('');
                setReplyingToReview(null);
                showSuccess("Reply added successfully");
            } else {
                showError(result.error || "Failed to add reply");
            }
        } catch (error) {
            console.error('Error adding reply:', error);
            showError("Failed to add reply");
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Function to delete a reply
    const handleDeleteReply = async (replyId, reviewId) => {
        if (!currentUser) return;

        try {
            const result = await reviewService.deleteReviewReply(replyId, reviewId);

            if (result.success) {
                // Update the reviews state to remove the deleted reply
                setReviews(prevReviews => prevReviews.map(review =>
                    review.id === reviewId
                        ? {
                            ...review,
                            replies: (review.replies || []).filter(reply => reply.id !== replyId),
                            replyCount: Math.max(0, (review.replyCount || 0) - 1)
                        }
                        : review
                ));

                showSuccess("Reply deleted successfully");
            } else {
                showError(result.error || "Failed to delete reply");
            }
        } catch (error) {
            console.error('Error deleting reply:', error);
            showError("Failed to delete reply");
        }
    };

    // Function to moderate a review (admin only)
    const handleModerateReview = async (reviewId, action) => {
        if (!currentUser || !hasRole('admin')) {
            showError("You don't have permission to moderate reviews");
            return;
        }

        setModerationStatus({
            loading: true,
            error: null,
            success: null
        });

        try {
            // For rejection, make sure we have a reason
            if (action === 'reject' && !rejectionReason.trim()) {
                setModerationStatus({
                    loading: false,
                    error: "Please provide a reason for rejection",
                    success: null
                });
                return;
            }

            const result = await reviewService.moderateReview(
                reviewId,
                action,
                currentUser.uid,
                rejectionReason.trim()
            );

            if (result.success) {
                // Update the reviews state to reflect the moderation action
                setReviews(prevReviews => prevReviews.map(review =>
                    review.id === reviewId
                        ? {
                            ...review,
                            status: action === 'approve' ? 'active' : action === 'reject' ? 'rejected' : 'deleted',
                            isApproved: action === 'approve',
                            isDeleted: action === 'delete',
                            rejectionReason: action === 'reject' ? rejectionReason.trim() : review.rejectionReason,
                            moderatedBy: currentUser.uid,
                            moderatedAt: new Date()
                        }
                        : review
                ));

                setModerationStatus({
                    loading: false,
                    error: null,
                    success: result.message
                });

                // Clear moderation state
                setModerationAction(null);
                setRejectionReason('');

                showSuccess(result.message);
            } else {
                setModerationStatus({
                    loading: false,
                    error: result.error || "Failed to moderate review",
                    success: null
                });

                showError(result.error || "Failed to moderate review");
            }
        } catch (error) {
            console.error('Error moderating review:', error);

            setModerationStatus({
                loading: false,
                error: "Failed to moderate review",
                success: null
            });

            showError("Failed to moderate review");
        }
    };

    // Function to check if a user has marked a review as helpful
    const hasMarkedHelpful = (review) => {
        return currentUser && review.helpfulVoters && review.helpfulVoters.includes(currentUser.uid);
    };

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

    // Handle manufacturer selection success
    const handleManufacturerSuccess = (result) => {
        showSuccess(`Successfully transferred ${result.amount?.toLocaleString()} credits to manufacturer`);

        // Update the product in the UI to reflect the manufacturing status
        setProduct(prev => ({
            ...prev,
            manufacturingStatus: "funded",
            fundsSentToManufacturer: true,
            businessHeldFunds: 0, // Reset held funds since they've been transferred
        }));
    };

    // Handle Add to Cart
    const handleAddToCart = async () => {
        if (!currentUser) {
            showError("Please sign in to add items to cart");
            return;
        }

        // Check if product is fully funded
        if (product.fundingGoal && !isFullyFunded) {
            showError("This product needs to be fully funded before purchase");
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

            if (cartSnapshot.empty) {
                // Create a new cart
                const cartData = {
                    userId: currentUser.uid,
                    items: [{
                        id: product.id,
                        name: product.name,
                        price: product.price || 0,
                        imageUrl: imageToUse,
                        quantity: 1
                    }],
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
                const existingItem = items.find(item => item.id === product.id);

                if (existingItem) {
                    // Increase quantity
                    existingItem.quantity += 1;

                    await updateDoc(doc(db, 'carts', cartDoc.id), {
                        items,
                        updatedAt: serverTimestamp()
                    });
                } else {
                    // Add new item
                    await updateDoc(doc(db, 'carts', cartDoc.id), {
                        items: [...items, {
                            id: product.id,
                            name: product.name,
                            price: product.price || 0,
                            imageUrl: imageToUse,
                            quantity: 1
                        }],
                        updatedAt: serverTimestamp()
                    });
                }
            }

            // Create a notification in Firestore
            if (currentUser) {
                await addDoc(collection(db, 'notifications'), {
                    userId: currentUser.uid,
                    title: 'Product Added to Cart',
                    message: `${product.name} has been added to your cart.`,
                    type: 'cart_update',
                    productId: product.id,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }

            // Show success notification with product details
            showSuccess(`Added to cart: ${product.name} (${formatPrice(product.price || 0)})`);
        } catch (error) {
            console.error("Error adding to cart:", error);
            showError("Failed to add to cart");
        } finally {
            setIsAddingToCart(false);
            // Reset animation after a delay
            setTimeout(() => setButtonAnimation(''), 700);
        }
    };

    const handleSubmitReview = async () => {
        if (!currentUser) {
            showError("Please sign in to submit a review");
            return;
        }

        if (!userReview.rating || !userReview.text) {
            showError("Please provide a rating and review text");
            return;
        }

        setIsSubmittingReview(true);

        try {
            const reviewData = {
                productId: product.id,
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Anonymous',
                userPhotoURL: currentUser.photoURL || null,
                rating: userReview.rating,
                text: userReview.text
            };

            const result = await reviewService.addReview(reviewData);

            if (result.success) {
                showSuccess(result.message || "Review submitted successfully");

                // If it was a new review (not an update), add it to the reviews list
                if (!reviews.some(rev => rev.userId === currentUser.uid)) {
                    setReviews(prev => [
                        {
                            id: result.data.id,
                            ...reviewData,
                            createdAt: new Date()
                        },
                        ...prev
                    ]);
                } else {
                    // Update the existing review in the list
                    setReviews(prev => prev.map(rev =>
                        rev.userId === currentUser.uid
                            ? { ...rev, rating: userReview.rating, text: userReview.text, updatedAt: new Date() }
                            : rev
                    ));
                }

                // Update the product's average rating in the UI
                if (product.reviewCount) {
                    const totalRating = reviews.reduce((sum, rev) => {
                        // If this is the user's review, use the new rating
                        if (rev.userId === currentUser.uid) {
                            return sum + userReview.rating;
                        }
                        return sum + rev.rating;
                    }, 0);

                    const newAvgRating = (totalRating / product.reviewCount).toFixed(1);
                    setProduct(prev => ({
                        ...prev,
                        averageRating: parseFloat(newAvgRating)
                    }));
                }

                // Clear the review form if it was successful
                setUserReview({ rating: 0, text: '' });
            } else {
                showError(result.error || "Failed to submit review");
            }
        } catch (error) {
            console.error("Error submitting review:", error);
            showError("Failed to submit review");
        } finally {
            setIsSubmittingReview(false);
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

                    {/* Product Type Badge */}
                    <div className="product-type-badge">
                        {product.isCrowdfunded !== false ? (
                            <span className="badge crowdfunding">Crowdfunded Product</span>
                        ) : (
                            <span className="badge direct-sell">Direct Purchase</span>
                        )}
                    </div>

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
                                    onChange={(e) => handleSortReviews(e.target.value)}
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
                                            onClick={() => handleFilterByRating(rating)}
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

                        {currentUser ? (
                            <div className="write-review">
                                <h4>Write a Review</h4>
                                <div className="review-form">
                                    <div className="rating-select">
                                        <label>Your Rating:</label>
                                        <div className="star-rating-select">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <span
                                                    key={star}
                                                    className={`star ${star <= (userReview.rating || 0) ? 'filled' : ''}`}
                                                    onClick={() => setUserReview({ ...userReview, rating: star })}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="review-content">
                                        <label htmlFor="reviewText">Your Review:</label>
                                        <textarea
                                            id="reviewText"
                                            value={userReview.text}
                                            onChange={(e) => setUserReview({ ...userReview, text: e.target.value })}
                                            placeholder="Share your thoughts about this product..."
                                            rows="4"
                                        ></textarea>
                                    </div>
                                    <button
                                        className="submit-review-btn"
                                        onClick={handleSubmitReview}
                                        disabled={isSubmittingReview || !userReview.rating || !userReview.text}
                                    >
                                        {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="login-to-review">
                                <Link to="/signin">Sign in</Link> to leave a review
                            </div>
                        )}

                        {reviewsLoading && reviews.length === 0 ? (
                            <div className="loading-container">
                                <LoadingSpinner />
                                <p>Loading reviews...</p>
                            </div>
                        ) : reviews.length > 0 ? (
                            <div className="reviews-list">
                                {reviews.map((review) => (
                                    <div key={review.id} className="review-item">
                                        {/* Admin can see review status if it's not active */}
                                        {hasRole('admin') && review.status !== 'active' && (
                                            <div className={`review-status-badge ${review.status}`}>
                                                {review.status === 'pending' ? 'Pending Approval' :
                                                    review.status === 'rejected' ? 'Rejected' : 'Deleted'}
                                            </div>
                                        )}

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

                                                {/* If this user is the product designer */}
                                                {review.userId === product.designerId && (
                                                    <span className="reviewer-badge designer">Designer</span>
                                                )}

                                                {/* If user has admin role */}
                                                {review.isAdmin && (
                                                    <span className="reviewer-badge admin">Admin</span>
                                                )}
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

                                        {/* Rejection reason (admin only) */}
                                        {hasRole('admin') && review.status === 'rejected' && review.rejectionReason && (
                                            <div className="rejection-info">
                                                <strong>Rejection reason:</strong> {review.rejectionReason}
                                            </div>
                                        )}

                                        {/* Admin Moderation Controls */}
                                        {hasRole('admin') && review.status === 'pending' && (
                                            <div className="moderation-controls">
                                                <div className="moderation-title">Moderation Controls</div>
                                                <button
                                                    className="moderation-btn approve-btn"
                                                    onClick={() => handleModerateReview(review.id, 'approve')}
                                                    disabled={moderationStatus.loading}
                                                >
                                                    Approve
                                                </button>

                                                {moderationAction === 'reject' && review.id === moderationActionReviewId ? (
                                                    <>
                                                        <input
                                                            type="text"
                                                            className="rejection-reason"
                                                            value={rejectionReason}
                                                            onChange={(e) => setRejectionReason(e.target.value)}
                                                            placeholder="Reason for rejection (required)"
                                                        />
                                                        <button
                                                            className="moderation-btn reject-btn"
                                                            onClick={() => handleModerateReview(review.id, 'reject')}
                                                            disabled={moderationStatus.loading || !rejectionReason.trim()}
                                                        >
                                                            Confirm Rejection
                                                        </button>
                                                        <button
                                                            className="moderation-btn"
                                                            onClick={() => {
                                                                setModerationAction(null);
                                                                setRejectionReason('');
                                                            }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className="moderation-btn reject-btn"
                                                        onClick={() => {
                                                            setModerationAction('reject');
                                                            setModerationActionReviewId(review.id);
                                                        }}
                                                        disabled={moderationStatus.loading}
                                                    >
                                                        Reject
                                                    </button>
                                                )}

                                                <button
                                                    className="moderation-btn delete-btn"
                                                    onClick={() => handleModerateReview(review.id, 'delete')}
                                                    disabled={moderationStatus.loading}
                                                >
                                                    Delete
                                                </button>

                                                {moderationStatus.error && (
                                                    <div className="moderation-action-msg error">{moderationStatus.error}</div>
                                                )}

                                                {moderationStatus.success && (
                                                    <div className="moderation-action-msg success">{moderationStatus.success}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Review Action Buttons (helpful, reply) */}
                                        <div className="review-actions">
                                            <div className="review-action-buttons">
                                                <button
                                                    className={`helpful-btn ${hasMarkedHelpful(review) ? 'active' : ''}`}
                                                    onClick={() => handleMarkReviewHelpful(review.id)}
                                                    disabled={!currentUser}
                                                >
                                                    <span className="helpful-icon">👍</span>
                                                    {hasMarkedHelpful(review) ? 'Helpful' : 'Mark as Helpful'}
                                                    <span className="helpful-count">({review.helpfulCount || 0})</span>
                                                </button>

                                                {currentUser && (
                                                    <button
                                                        className="reply-btn"
                                                        onClick={() => setReplyingToReview(
                                                            replyingToReview === review.id ? null : review.id
                                                        )}
                                                    >
                                                        <span className="reply-icon">↩️</span>
                                                        Reply
                                                    </button>
                                                )}

                                                {hasRole('admin') && (
                                                    <button className="report-btn">
                                                        <span className="report-icon">🚫</span>
                                                        Report
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Review Replies */}
                                        {review.replies && review.replies.length > 0 && (
                                            <div className="review-replies">
                                                <div className="reply-count">
                                                    {review.replies.length} {review.replies.length === 1 ? 'reply' : 'replies'}
                                                </div>
                                                <div className="reply-list">
                                                    {review.replies
                                                        .filter(reply => !reply.isDeleted)
                                                        .map(reply => (
                                                            <div
                                                                key={reply.id}
                                                                className={`reply-item ${reply.isDesigner ? 'designer' : ''} ${reply.isAdmin ? 'admin' : ''}`}
                                                            >
                                                                <div className="reply-header">
                                                                    <div className="replier-info">
                                                                        {reply.userPhotoURL ? (
                                                                            <img
                                                                                src={reply.userPhotoURL}
                                                                                alt={reply.userName}
                                                                                className="replier-avatar"
                                                                            />
                                                                        ) : (
                                                                            <div className="replier-avatar default-avatar">
                                                                                {reply.userName?.charAt(0).toUpperCase() || 'A'}
                                                                            </div>
                                                                        )}
                                                                        <span className="replier-name">{reply.userName || 'Anonymous'}</span>

                                                                        {reply.isDesigner && (
                                                                            <span className="replier-badge designer">Designer</span>
                                                                        )}

                                                                        {reply.isAdmin && (
                                                                            <span className="replier-badge admin">Admin</span>
                                                                        )}
                                                                    </div>
                                                                    <span className="reply-date">
                                                                        {reply.createdAt ? new Date(reply.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                                                                    </span>
                                                                </div>

                                                                <div className="reply-text">
                                                                    {reply.text}
                                                                </div>

                                                                {/* Delete button for own replies or admin */}
                                                                {((currentUser && currentUser.uid === reply.userId) || hasRole('admin')) && (
                                                                    <button
                                                                        className="reply-delete-btn"
                                                                        onClick={() => handleDeleteReply(reply.id, review.id)}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Reply Form */}
                                        {replyingToReview === review.id && currentUser && (
                                            <div className="reply-form">
                                                <textarea
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder="Write your reply..."
                                                    rows="3"
                                                ></textarea>
                                                <div className="reply-form-actions">
                                                    <button
                                                        className="reply-form-cancel-btn"
                                                        onClick={() => {
                                                            setReplyingToReview(null);
                                                            setReplyText('');
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        className="reply-form-submit-btn"
                                                        onClick={() => handleReplyToReview(review.id)}
                                                        disabled={isSubmittingReply || !replyText.trim()}
                                                    >
                                                        {isSubmittingReply ? 'Submitting...' : 'Submit Reply'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
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
                                onClick={handleLoadMoreReviews}
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

                            {/* Funding Form - only show for crowdfunded products that aren't fully funded */}
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

                                    {/* Show manufacturer selection button for the product designer */}
                                    {currentUser && product.designerId === currentUser.uid &&
                                        !product.fundsSentToManufacturer && (
                                            <div className="manufacturing-options">
                                                <button
                                                    className="btn-secondary select-manufacturer-button"
                                                    onClick={() => setShowManufacturerModal(true)}
                                                >
                                                    Select Manufacturer
                                                </button>
                                                <p className="manufacturer-info-text">
                                                    Your product is fully funded. Select a manufacturer to begin production.
                                                </p>
                                            </div>
                                        )}

                                    {/* Show manufacturing in progress message */}
                                    {product.fundsSentToManufacturer && (
                                        <div className="manufacturing-status">
                                            <p className="manufacturing-progress">
                                                <span className="badge manufacturing">Manufacturing In Progress</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="product-actions">
                        {/* Add to Cart Button - enabled if product is direct sell or fully funded */}
                        <button
                            className={`btn-primary add-to-cart-button ${(!isFullyFunded && product.isCrowdfunded !== false) ? 'disabled' : ''} ${buttonAnimation}`}
                            disabled={(product.isCrowdfunded !== false && !isFullyFunded) || isAddingToCart}
                            onClick={handleAddToCart}
                        >
                            {isAddingToCart ? 'Adding...' :
                                (product.isCrowdfunded === false || isFullyFunded) ?
                                    'Add to Cart' : 'Funding Required'}
                        </button>

                        {/* Investment Button - only show for crowdfunded products */}
                        {currentUser && hasRole('investor') && product.fundingGoal > 0 &&
                            product.isCrowdfunded !== false && !isFullyFunded && (
                                <button
                                    className="invest-button btn-secondary"
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

            {/* Manufacturer Selection Modal */}
            {showManufacturerModal && (
                <ManufacturerSelectionModal
                    isOpen={showManufacturerModal}
                    onClose={() => setShowManufacturerModal(false)}
                    product={product}
                    onSuccess={handleManufacturerSuccess}
                />
            )}
        </div>
    );
};

export default ProductDetailPage;
