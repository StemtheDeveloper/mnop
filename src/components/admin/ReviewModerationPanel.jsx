import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../contexts/ToastContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import reviewService from '../../services/reviewService';
import '../../styles/components/admin/ReviewModerationPanel.css';

const ReviewModerationPanel = () => {
    const { currentUser, hasRole } = useUser();
    const { success: showSuccess, error: showError } = useToast();

    const [pendingReviews, setPendingReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [reviewStats, setReviewStats] = useState({
        pending: 0,
        rejected: 0,
        active: 0,
        total: 0
    });

    // For review rejection
    const [rejectionReasons, setRejectionReasons] = useState({});
    const [actionLoading, setActionLoading] = useState({});

    // Check if user has admin role
    useEffect(() => {
        // Redirect if not admin
        if (currentUser && !hasRole('admin')) {
            showError("Access denied. Administrator privileges required.");
            // You could add a redirect here
        }
    }, [currentUser, hasRole, showError]);

    // Fetch pending reviews
    useEffect(() => {
        const fetchPendingReviews = async () => {
            if (!currentUser || !hasRole('admin')) return;

            setLoading(true);
            try {
                const result = await reviewService.getPendingReviews(10);

                if (result.success) {
                    setPendingReviews(result.data);
                    setLastVisible(result.lastVisible);
                    setHasMore(result.hasMore);
                } else {
                    setError(result.error || "Failed to fetch pending reviews");
                }
            } catch (error) {
                console.error("Error fetching pending reviews:", error);
                setError("An error occurred while fetching reviews");
            } finally {
                setLoading(false);
            }
        };

        fetchPendingReviews();
    }, [currentUser, hasRole]);

    // Load more pending reviews
    const handleLoadMore = async () => {
        if (!lastVisible || !hasMore) return;

        setLoading(true);
        try {
            const result = await reviewService.getPendingReviews(10, lastVisible);

            if (result.success) {
                setPendingReviews(prev => [...prev, ...result.data]);
                setLastVisible(result.lastVisible);
                setHasMore(result.hasMore);
            } else {
                showError(result.error || "Failed to load more reviews");
            }
        } catch (error) {
            console.error("Error loading more reviews:", error);
            showError("An error occurred while loading more reviews");
        } finally {
            setLoading(false);
        }
    };

    // Handle review moderation
    const handleModerateReview = async (reviewId, action) => {
        if (!currentUser || !hasRole('admin')) {
            showError("You don't have permission to moderate reviews");
            return;
        }

        // For rejection, we need a reason
        if (action === 'reject' && (!rejectionReasons[reviewId] || !rejectionReasons[reviewId].trim())) {
            showError("Please provide a rejection reason");
            return;
        }

        setActionLoading(prev => ({ ...prev, [reviewId]: true }));

        try {
            const result = await reviewService.moderateReview(
                reviewId,
                action,
                currentUser.uid,
                rejectionReasons[reviewId] || ''
            );

            if (result.success) {
                showSuccess(result.message || `Review ${action}d successfully`);
                // Remove from the pending list
                setPendingReviews(prev => prev.filter(review => review.id !== reviewId));

                // Update stats
                setReviewStats(prev => ({
                    ...prev,
                    pending: prev.pending - 1,
                    [action === 'approve' ? 'active' : action === 'reject' ? 'rejected' : 'total']:
                        prev[action === 'approve' ? 'active' : action === 'reject' ? 'rejected' : 'total'] + 1
                }));
            } else {
                showError(result.error || `Failed to ${action} review`);
            }
        } catch (error) {
            console.error(`Error ${action}ing review:`, error);
            showError(`Failed to ${action} review`);
        } finally {
            setActionLoading(prev => ({ ...prev, [reviewId]: false }));
        }
    };

    // Handle rejection reason change
    const handleRejectionReasonChange = (reviewId, reason) => {
        setRejectionReasons(prev => ({
            ...prev,
            [reviewId]: reason
        }));
    };

    if (!currentUser || !hasRole('admin')) {
        return (
            <div className="admin-panel-container">
                <div className="access-denied">
                    <h3>Access Denied</h3>
                    <p>You need administrator privileges to access this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="review-moderation-panel">
            <h2>Review Moderation</h2>

            <div className="moderation-stats">
                <div className="stat-card">
                    <h3>{reviewStats.pending}</h3>
                    <p>Pending</p>
                </div>
                <div className="stat-card">
                    <h3>{reviewStats.active}</h3>
                    <p>Approved</p>
                </div>
                <div className="stat-card">
                    <h3>{reviewStats.rejected}</h3>
                    <p>Rejected</p>
                </div>
                <div className="stat-card">
                    <h3>{reviewStats.total}</h3>
                    <p>Total</p>
                </div>
            </div>

            <div className="moderation-queue">
                <h3>Pending Reviews</h3>

                {loading && pendingReviews.length === 0 ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading pending reviews...</p>
                    </div>
                ) : error ? (
                    <div className="error-message">
                        <p>{error}</p>
                    </div>
                ) : pendingReviews.length === 0 ? (
                    <div className="empty-queue">
                        <p>No pending reviews to moderate. Great job!</p>
                    </div>
                ) : (
                    <>
                        <div className="pending-reviews-list">
                            {pendingReviews.map(review => (
                                <div key={review.id} className="review-card">
                                    <div className="review-card-header">
                                        <div className="reviewer-info">
                                            {review.userPhotoURL ? (
                                                <img
                                                    src={review.userPhotoURL}
                                                    alt={review.userName}
                                                    className="reviewer-avatar"
                                                />
                                            ) : (
                                                <div className="reviewer-avatar default-avatar">
                                                    {review.userName?.charAt(0).toUpperCase() || 'A'}
                                                </div>
                                            )}
                                            <span className="reviewer-name">{review.userName || 'Anonymous'}</span>
                                        </div>

                                        <div className="review-date">
                                            {review.createdAt && new Date(review.createdAt.seconds * 1000).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="review-product">
                                        <strong>Product:</strong>
                                        <Link to={`/product/${review.productId}`}>
                                            {review.productName || review.productId}
                                        </Link>
                                    </div>

                                    <div className="review-rating">
                                        <strong>Rating:</strong>
                                        <div className="stars">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <span
                                                    key={star}
                                                    className={`star ${star <= review.rating ? 'filled' : ''}`}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="review-content">
                                        <p>{review.text}</p>
                                    </div>

                                    <div className="review-actions">
                                        <button
                                            className="action-btn approve-btn"
                                            onClick={() => handleModerateReview(review.id, 'approve')}
                                            disabled={actionLoading[review.id]}
                                        >
                                            {actionLoading[review.id] ? 'Processing...' : 'Approve'}
                                        </button>

                                        <div className="reject-action">
                                            <input
                                                type="text"
                                                placeholder="Rejection reason (required)"
                                                value={rejectionReasons[review.id] || ''}
                                                onChange={(e) => handleRejectionReasonChange(review.id, e.target.value)}
                                                className="rejection-reason-input"
                                            />
                                            <button
                                                className="action-btn reject-btn"
                                                onClick={() => handleModerateReview(review.id, 'reject')}
                                                disabled={actionLoading[review.id] || !rejectionReasons[review.id] || !rejectionReasons[review.id].trim()}
                                            >
                                                {actionLoading[review.id] ? 'Processing...' : 'Reject'}
                                            </button>
                                        </div>

                                        <button
                                            className="action-btn delete-btn"
                                            onClick={() => handleModerateReview(review.id, 'delete')}
                                            disabled={actionLoading[review.id]}
                                        >
                                            {actionLoading[review.id] ? 'Processing...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {hasMore && (
                            <button
                                className="load-more-btn"
                                onClick={handleLoadMore}
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : 'Load More Reviews'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ReviewModerationPanel;