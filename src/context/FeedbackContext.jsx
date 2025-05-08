import React, { createContext, useState, useContext, useEffect } from 'react';
import { addFeedback } from '../firebase/feedbackService';
import { useAuth } from './AuthContext'; // Updated import path
import { useToast } from './ToastContext'; // Updated import path

const FeedbackContext = createContext();

export const useFeedback = () => useContext(FeedbackContext);

export const FeedbackProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isPermanentlyHidden, setIsPermanentlyHidden] = useState(false);
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    // Check localStorage on first load
    useEffect(() => {
        const hideFeedbackBar = localStorage.getItem('hideFeedbackBar');
        if (hideFeedbackBar === 'permanently') {
            setIsPermanentlyHidden(true);
        }
    }, []);

    const toggleFeedbackBar = () => {
        setIsOpen(prev => !prev);
        if (isOpen) {
            // Reset form when closing
            setFeedback('');
            setRating(0);
        }
    };

    const hideFeedbackBarTemporarily = () => {
        setIsOpen(false);
        setFeedback('');
        setRating(0);
    };

    const hideFeedbackBarPermanently = () => {
        setIsOpen(false);
        setIsPermanentlyHidden(true);
        setFeedback('');
        setRating(0);
        localStorage.setItem('hideFeedbackBar', 'permanently');
    };

    const showFeedbackBar = () => {
        setIsPermanentlyHidden(false);
        setIsOpen(true);
        localStorage.removeItem('hideFeedbackBar');
    };

    const submitFeedback = async () => {
        if (!feedback.trim() && rating === 0) {
            showToast('Please provide feedback or a rating', 'error');
            return;
        }

        setLoading(true);
        try {
            const feedbackData = {
                userId: currentUser?.uid || 'anonymous',
                userEmail: currentUser?.email || 'anonymous',
                feedback: feedback.trim(),
                rating,
                page: window.location.pathname,
                timestamp: new Date(),
            };

            await addFeedback(feedbackData);
            showToast('Thank you for your feedback!', 'success');
            setFeedback('');
            setRating(0);
            setIsOpen(false);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            showToast('Failed to submit feedback. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const value = {
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
        showFeedbackBar,
        submitFeedback
    };

    return (
        <FeedbackContext.Provider value={value}>
            {children}
        </FeedbackContext.Provider>
    );
};

// Export the context as default instead of the provider
export default FeedbackContext;