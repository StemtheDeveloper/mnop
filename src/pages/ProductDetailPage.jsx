import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, onSnapshot, updateDoc, runTransaction, increment, arrayUnion, collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import InvestmentModal from '../components/InvestmentModal';
import ManufacturerSelectionModal from '../components/ManufacturerSelectionModal';
import TrendingExtensionButton from '../components/TrendingExtensionButton';
import productTrendingService from '../services/productTrendingService';
import reviewService from '../services/reviewService';
import '../styles/ProductDetailPage.css';
import { serverTimestamp } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import BlockedContentIndicator from '../components/BlockedContentIndicator';
import { useBlockedContentFilter } from '../components/BlockedContentFilter';

const ProductDetailPage = () => {
    const { productId } = useParams();
    const { currentUser, hasRole, userWallet, fundProduct } = useUser();
    const { success: showSuccess, error: showError } = useToast();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showInvestModal, setShowInvestModal] = useState(false);
    const [showManufacturerModal, setShowManufacturerModal] = useState(false);
    const [fundAmount, setFundAmount] = useState('');
    const [isFunding, setIsFunding] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [buttonAnimation, setButtonAnimation] = useState('');
    const [designer, setDesigner] = useState(null);
    const [categoryNames, setCategoryNames] = useState([]);

    const [reviews, setReviews] = useState([]);
    const [allReviews, setAllReviews] = useState([]);
    const [hiddenReviewIds, setHiddenReviewIds] = useState([]);
    const [hiddenReplyIds, setHiddenReplyIds] = useState([]);
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

    const isFullyFunded = product && product.currentFunding >= product.fundingGoal;
    const remainingFunding = product ? Math.max(0, product.fundingGoal - product.currentFunding) : 0;

    const handleToggleBlockedReview = (reviewId) => {
        if (hiddenReviewIds.includes(reviewId)) {
            setHiddenReviewIds(prev => prev.filter(id => id !== reviewId));
        } else {
            setHiddenReviewIds(prev => [...prev, reviewId]);
        }
    };

    const handleToggleBlockedReply = (replyId) => {
        if (hiddenReplyIds.includes(replyId)) {
            setHiddenReplyIds(prev => prev.filter(id => id !== replyId));
        } else {
            setHiddenReplyIds(prev => [...prev, replyId]);
        }
    };

    const filteredReviews = useBlockedContentFilter(allReviews, 'userId');

    useEffect(() => {
        let reviewsToDisplay = [...filteredReviews];

        if (allReviews.length > filteredReviews.length) {
            const blockedReviews = allReviews.filter(review => {
                return !filteredReviews.some(fr => fr.id === review.id) &&
                    !hiddenReviewIds.includes(review.id);
            });

            reviewsToDisplay = [...reviewsToDisplay, ...blockedReviews];
        }

        reviewsToDisplay = reviewsToDisplay.map(review => {
            if (!review.replies || review.replies.length === 0) return review;

            const reviewCopy = { ...review, replies: [...review.replies] };

            const filteredReplies = reviewCopy.replies.filter(reply => {
                if (!reply.userId || !isUserBlocked || !isUserBlocked(reply.userId)) return true;
                return hiddenReplyIds.includes(reply.id);
            });

            const blockedVisibleReplies = reviewCopy.replies.filter(reply => {
                return !filteredReplies.some(fr => fr.id === reply.id) &&
                    hiddenReplyIds.includes(reply.id);
            });

            reviewCopy.replies = [...filteredReplies, ...blockedVisibleReplies];

            return reviewCopy;
        });

        setReviews(reviewsToDisplay);
    }, [filteredReviews, allReviews, hiddenReviewIds, hiddenReplyIds]);

    useEffect(() => {
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

                if (productData.categories && Array.isArray(productData.categories) && productData.categories.length > 0) {
                    try {
                        const fetchedCategoryNames = [];
                        for (const categoryId of productData.categories) {
                            const categoryRef = doc(db, 'categories', categoryId);
                            const categoryDoc = await getDoc(categoryRef);
                            if (categoryDoc.exists()) {
                                fetchedCategoryNames.push(categoryDoc.data().name || categoryId);
                            } else {
                                fetchedCategoryNames.push(categoryId);
                            }
                        }
                        setCategoryNames(fetchedCategoryNames);
                    } catch (err) {
                        console.error('Error fetching category names:', err);
                    }
                } else if (productData.category) {
                    try {
                        const categoryRef = doc(db, 'categories', productData.category);
                        const categoryDoc = await getDoc(categoryRef);
                        if (categoryDoc.exists()) {
                            setCategoryNames([categoryDoc.data().name || productData.category]);
                        } else {
                            setCategoryNames([productData.category]);
                        }
                    } catch (err) {
                        console.error('Error fetching category name:', err);
                        setCategoryNames([productData.category]);
                    }
                }

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

            return () => unsubscribe();
        }
    }, [productId]);

    useEffect(() => {
        const fetchReviews = async () => {
            if (!productId) return;

            setReviewsLoading(true);

            try {
                const result = await reviewService.getProductReviews(productId, {
                    sortBy: reviewSortBy,
                    ratingFilter: reviewRatingFilter,
                    pageSize: reviewsToShow,
                    lastDoc: null,
                    withReplies: true
                });

                if (result.success) {
                    setAllReviews(result.data);
                    setLastVisibleReview(result.lastVisible);
                    setHasMoreReviews(result.hasMore);

                    const distributionResult = await reviewService.getProductRatingDistribution(productId);
                    if (distributionResult.success) {
                        setRatingDistribution(distributionResult.data);
                    }

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

    return (
        <div className="product-detail-page">
            <div className="product-detail-container">
                <div className="product-images">
                    <div className="main-image">
                        <img src={product.imageUrls?.[selectedImageIndex] || 'https://placehold.co/600x400?text=Product+Image'} alt={product.name} />
                    </div>
                </div>

                <div className="pdp-product-info">
                    <h1 className="pdp-product-title">{product.name}</h1>
                    <p className="pdp-product-price">{product.price}</p>

                    <div className="product-reviews">
                        <h3>Ratings & Reviews</h3>
                        <div className="reviews-list">
                            {reviews.map(review => {
                                const isBlocked = isUserBlocked && isUserBlocked(review.userId);

                                if (isBlocked && !hiddenReviewIds.includes(review.id)) {
                                    return (
                                        <BlockedContentIndicator
                                            key={review.id}
                                            userId={review.userId}
                                            contentType="review"
                                            onShowContent={() => handleToggleBlockedReview(review.id)}
                                        />
                                    );
                                }

                                return (
                                    <div key={review.id} className="review-item">
                                        <div className="review-replies">
                                            <div className="reply-list">
                                                {review.replies?.map(reply => {
                                                    const isReplyBlocked = isUserBlocked && isUserBlocked(reply.userId);

                                                    if (isReplyBlocked && !hiddenReplyIds.includes(reply.id)) {
                                                        return (
                                                            <BlockedContentIndicator
                                                                key={reply.id}
                                                                userId={reply.userId}
                                                                contentType="reply"
                                                                onShowContent={() => handleToggleBlockedReply(reply.id)}
                                                            />
                                                        );
                                                    }

                                                    return (
                                                        <div key={reply.id} className="reply-item">
                                                            {/* Reply content */}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailPage;