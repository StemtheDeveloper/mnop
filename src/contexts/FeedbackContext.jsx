import React, { createContext, useState, useContext } from 'react';
import { addFeedback } from '../firebase/feedbackService';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const FeedbackContext = createContext();

export const useFeedback = () => useContext(FeedbackContext);

export const FeedbackProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [loading, setLoading] = useState(false);
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    const toggleFeedbackBar = () => {
        setIsOpen(prev => !prev);
        if (isOpen) {
            // Reset form when closing
            setFeedback('');
            setRating(0);
        }
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
        setFeedback,
        setRating,
        toggleFeedbackBar,
        submitFeedback
    };

    return (
        <FeedbackContext.Provider value={value}>
            {children}
        </FeedbackContext.Provider>
    );
};