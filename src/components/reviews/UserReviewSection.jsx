import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

import LoadingSpinner from '../LoadingSpinner';

const UserReviewSection = ({ userId, userProfile }) => {
    const { currentUser } = useUser();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [newReview, setNewReview] = useState({
        rating: 5,
        comment: ''
    });
    const [userStats, setUserStats] = useState({
        ordersPlaced: 0,
        ordersFulfilled: 0,
        productsDesigned: 0,
        productsManufactured: 0,
        averageRating: 0,
    });
    const [canReview, setCanReview] = useState(false);
    const [hasReviewedBefore, setHasReviewedBefore] = useState(false);

    // Fetch user reviews and stats
    useEffect(() => {
        const fetchReviewsAndStats = async () => {
            setLoading(true);
            try {
                // Fetch reviews
                const reviewsRef = collection(db, 'reviews');
                const q = query(reviewsRef, where('receiverId', '==', userId));
                const snapshot = await getDocs(q);

                const reviewsData = [];
                snapshot.forEach(doc => {
                    reviewsData.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                // Sort reviews by date (newest first)
                reviewsData.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

                setReviews(reviewsData);

                // Calculate average rating
                if (reviewsData.length > 0) {
                    const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
                    const avgRating = totalRating / reviewsData.length;
                    setUserStats(prev => ({ ...prev, averageRating: avgRating }));
                }

                // Check if current user has already reviewed this user
                if (currentUser) {
                    const hasReviewed = reviewsData.some(review => review.reviewerId === currentUser.uid);
                    setHasReviewedBefore(hasReviewed);
                }

                // Fetch additional user stats
                await fetchUserStatistics();

            } catch (err) {
                console.error('Error fetching reviews:', err);
                setError('Failed to load reviews');
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchReviewsAndStats();
            checkIfCanReview();
        }
    }, [userId, currentUser]); const checkIfCanReview = async () => {
        if (!currentUser || currentUser.uid === userId) {
            // Users can't review themselves
            setCanReview(false);
            return;
        }

        // Allow any logged in user to review other users
        // No longer require completed transactions between users
        setCanReview(true);
    };

    const fetchUserStatistics = async () => {
        try {
            const stats = {
                ordersPlaced: 0,
                ordersFulfilled: 0,
                productsDesigned: 0,
                productsManufactured: 0
            };

            // Count orders placed
            const ordersPlacedRef = collection(db, 'orders');
            const ordersPlacedQuery = query(ordersPlacedRef, where('customerId', '==', userId));
            const ordersPlacedSnap = await getDocs(ordersPlacedQuery);
            stats.ordersPlaced = ordersPlacedSnap.size;

            // Count orders fulfilled (if user is designer or manufacturer)
            if (userProfile.roles?.includes('designer') || userProfile.roles?.includes('manufacturer')) {
                const ordersFilledRef = collection(db, 'orders');
                const filledQuery = query(
                    ordersFilledRef,
                    where(userProfile.roles.includes('designer') ? 'designerId' : 'manufacturerId', '==', userId),
                    where('status', '==', 'completed')
                );
                const filledSnap = await getDocs(filledQuery);
                stats.ordersFulfilled = filledSnap.size;
            }

            // Count products designed
            if (userProfile.roles?.includes('designer')) {
                const productsRef = collection(db, 'products');
                const productsQuery = query(productsRef, where('designerId', '==', userId));
                const productsSnap = await getDocs(productsQuery);
                stats.productsDesigned = productsSnap.size;
            }

            // Count products manufactured
            if (userProfile.roles?.includes('manufacturer')) {
                const productsRef = collection(db, 'products');
                const productsQuery = query(productsRef, where('manufacturerId', '==', userId));
                const productsSnap = await getDocs(productsQuery);
                stats.productsManufactured = productsSnap.size;
            }

            setUserStats(prev => ({
                ...prev,
                ...stats
            }));

        } catch (err) {
            console.error('Error fetching user statistics:', err);
        }
    };

    const handleReviewChange = (e) => {
        const { name, value } = e.target;
        setNewReview(prev => ({
            ...prev,
            [name]: name === 'rating' ? parseInt(value, 10) : value
        }));
    }; const submitReview = async (e) => {
        e.preventDefault();

        if (!currentUser) {
            setError('You must be logged in to submit a review');
            return;
        }

        if (currentUser.uid === userId) {
            setError('You cannot review yourself');
            return;
        }

        if (newReview.comment.trim() === '') {
            setError('Review comment cannot be empty');
            return;
        }

        if (hasReviewedBefore) {
            setError('You have already reviewed this user');
            return;
        }

        // Continue with review submission - no transaction check required

        setSubmitting(true);
        setError(null);

        try {
            // Get reviewer's profile
            const reviewerRef = doc(db, 'users', currentUser.uid);
            const reviewerSnap = await getDoc(reviewerRef);

            if (!reviewerSnap.exists()) {
                throw new Error('Reviewer profile not found');
            }

            const reviewerProfile = reviewerSnap.data();

            // Create the review
            const reviewData = {
                reviewerId: currentUser.uid,
                reviewerName: reviewerProfile.displayName || 'Anonymous User',
                reviewerPhotoURL: reviewerProfile.photoURL || null,
                receiverId: userId,
                rating: newReview.rating,
                comment: newReview.comment.trim(),
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'reviews'), reviewData);

            // Add the review to the local state (with an estimated timestamp for immediate display)
            const newReviewWithDate = {
                ...reviewData,
                id: `temp-${Date.now()}`, // Temporary ID until page refresh
                createdAt: { toDate: () => new Date() } // Compatible with Firestore timestamp structure
            };

            setReviews([newReviewWithDate, ...reviews]);

            // Update average rating
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0) + newReview.rating;
            const newAvgRating = totalRating / (reviews.length + 1);
            setUserStats(prev => ({ ...prev, averageRating: newAvgRating }));

            // Reset form and state
            setNewReview({ rating: 5, comment: '' });
            setHasReviewedBefore(true);

        } catch (err) {
            console.error('Error submitting review:', err);
            setError(`Failed to submit review: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Unknown date';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const renderStars = (rating) => {
        return Array(5).fill(0).map((_, i) => (
            <span key={i} className={i < rating ? 'star filled' : 'star'}>★</span>
        ));
    };

    return (
        <div className="user-review-section">
            <h3>User Statistics & Reviews</h3>

            {loading ? (
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading user information...</p>
                </div>
            ) : (
                <>
                    <div className="user-stats">
                        <div className="stat-item">
                            <div className="stat-value">{userStats.averageRating.toFixed(1)}</div>
                            <div className="stat-label">
                                <div className="rating-stars">{renderStars(Math.round(userStats.averageRating))}</div>
                                <div>Average Rating ({reviews.length} reviews)</div>
                            </div>
                        </div>

                        <div className="stat-item">
                            <div className="stat-value">{userStats.ordersPlaced}</div>
                            <div className="stat-label">Orders Placed</div>
                        </div>

                        {userProfile.roles?.includes('designer') && (
                            <>
                                <div className="stat-item">
                                    <div className="stat-value">{userStats.productsDesigned}</div>
                                    <div className="stat-label">Products Designed</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-value">{userStats.ordersFulfilled}</div>
                                    <div className="stat-label">Orders Fulfilled</div>
                                </div>
                            </>
                        )}

                        {userProfile.roles?.includes('manufacturer') && (
                            <>
                                <div className="stat-item">
                                    <div className="stat-value">{userStats.productsManufactured}</div>
                                    <div className="stat-label">Products Manufactured</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-value">{userStats.ordersFulfilled}</div>
                                    <div className="stat-label">Orders Fulfilled</div>
                                </div>
                            </>
                        )}
                    </div>                    {currentUser && currentUser.uid !== userId && (
                        <div className="review-form-container">
                            <h4>Write a Review</h4>
                            {currentUser && !hasReviewedBefore ? (
                                <form onSubmit={submitReview} className="review-form">
                                    <div className="rating-selector">
                                        <span>Rating: </span>
                                        <div className="star-rating">
                                            {[5, 4, 3, 2, 1].map((star) => (
                                                <label key={star}>
                                                    <input
                                                        type="radio"
                                                        name="rating"
                                                        value={star}
                                                        checked={newReview.rating === star}
                                                        onChange={handleReviewChange}
                                                    />
                                                    <span className="star">★</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <textarea
                                        name="comment"
                                        value={newReview.comment}
                                        onChange={handleReviewChange}
                                        placeholder="Write your review here..."
                                        rows={4}
                                        required
                                    />
                                    {error && <div className="error-message">{error}</div>}
                                    <button
                                        type="submit"
                                        className="submit-review-btn"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Review'}
                                    </button>
                                </form>) : (
                                <div className="review-notice">
                                    {hasReviewedBefore
                                        ? "You've already reviewed this user."
                                        : canReview === false
                                            ? "You need to be logged in to review this user."
                                            : "You cannot review this user at this time."}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="reviews-list">
                        <h4>User Reviews {reviews.length > 0 ? `(${reviews.length})` : ''}</h4>

                        {reviews.length === 0 ? (
                            <div className="no-reviews">
                                <p>This user hasn't received any reviews yet.</p>
                            </div>
                        ) : (
                            reviews.map(review => (
                                <div key={review.id} className="review-card">
                                    <div className="review-header">
                                        <div className="reviewer-info">
                                            <img
                                                src={review.reviewerPhotoURL || 'https://placehold.co/40x40?text=User'}
                                                alt={review.reviewerName}
                                                className="reviewer-photo"
                                            />
                                            <div>
                                                <div className="reviewer-name">{review.reviewerName}</div>
                                                <div className="review-date">{formatDate(review.createdAt)}</div>
                                            </div>
                                        </div>
                                        <div className="review-rating">
                                            {renderStars(review.rating)}
                                        </div>
                                    </div>
                                    <div className="review-comment">
                                        {review.comment}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default UserReviewSection;