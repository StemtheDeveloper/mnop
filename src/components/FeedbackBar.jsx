import React, { useEffect } from 'react';
import { useFeedback } from '../context/FeedbackContext'; // Updated path from contexts to context
import '../styles/FeedbackBar.css';
import LoadingSpinner from './LoadingSpinner';

const FeedbackBar = () => {
    const {
        isOpen,
        feedback,
        rating,
        loading,
        isPermanentlyHidden,
        setFeedback,
        setRating,
        toggleFeedbackBar,
        hideFeedbackBarTemporarily,
        hideFeedbackBarPermanently,
        submitFeedback
    } = useFeedback();

    const handleRatingClick = (selectedRating) => {
        setRating(selectedRating === rating ? 0 : selectedRating);
    };

    // Close feedback bar when pressing Escape key
    useEffect(() => {
        const handleEscapeKey = (e) => {
            if (e.key === 'Escape' && isOpen) {
                toggleFeedbackBar();
            }
        };

        document.addEventListener('keydown', handleEscapeKey);
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, toggleFeedbackBar]);

    // Trap focus within the feedback bar when it's open
    useEffect(() => {
        if (isOpen) {
            // Set focus to the content area when opened
            const contentArea = document.querySelector('.feedback-content textarea');
            if (contentArea) {
                setTimeout(() => contentArea.focus(), 300); // Wait for animation
            }
        }
    }, [isOpen]);

    // Don't render if permanently hidden
    if (isPermanentlyHidden) {
        return null;
    }

    return (
        <div className={`feedback-bar ${isOpen ? 'open' : ''}`} role="dialog" aria-labelledby="feedback-title">
            <button
                className="feedback-tab"
                onClick={toggleFeedbackBar}
                aria-expanded={isOpen}
                aria-controls="feedback-content"
                aria-label={isOpen ? "Close feedback" : "Open feedback"}
            >
                {isOpen ? 'Close' : 'Feedback'}
            </button>

            <div id="feedback-content" className="feedback-content">
                <h3 id="feedback-title">Share Your Feedback</h3>
                <p>Help us improve your experience on this page</p>

                <div className="rating-container" role="group" aria-label="Rate your experience from 1 to 5 stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            className={`star-rating ${star <= rating ? 'active' : ''}`}
                            onClick={() => handleRatingClick(star)}
                            aria-label={`Rate ${star} out of 5 stars`}
                            aria-pressed={star <= rating}
                        >
                            <span aria-hidden="true">★</span>
                            <span className="sr-only">stars</span>
                        </button>
                    ))}
                </div>

                <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us what you think or suggest improvements..."
                    disabled={loading}
                    rows={4}
                    aria-label="Your feedback comments"
                />

                <button
                    className="submit-feedback-btn"
                    onClick={submitFeedback}
                    disabled={loading}
                    aria-busy={loading}
                >
                    {loading ? <LoadingSpinner size="small" /> : 'Submit Feedback'}
                </button>

                <div className="feedback-visibility-options">
                    {/* <button
                        className="hide-feedback-btn"
                        onClick={hideFeedbackBarTemporarily}
                        aria-label="Hide feedback bar temporarily"
                    >
                        Hide for now
                    </button> */}
                    <button
                        className="hide-feedback-permanently-btn"
                        onClick={hideFeedbackBarPermanently}
                        aria-label="Hide feedback bar permanently"
                    >
                        Never show again
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackBar;