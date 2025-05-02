import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import '../styles/FeedbackAdmin.css';
import LoadingSpinner from '../components/LoadingSpinner';

const FeedbackAdminPage = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!currentUser) {
                setIsAdmin(false);
                return;
            }

            try {
                const userDoc = await doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userDoc);

                if (userSnap.exists() && userSnap.data().role === 'admin') {
                    setIsAdmin(true);
                    fetchFeedback();
                } else {
                    setIsAdmin(false);
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        };

        checkAdminStatus();
    }, [currentUser]);

    const fetchFeedback = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);

            const feedbackData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate()
            }));

            setFeedback(feedbackData);
        } catch (error) {
            console.error('Error fetching feedback:', error);
            showToast('Failed to load feedback data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this feedback?')) {
            try {
                await deleteDoc(doc(db, 'feedback', id));
                setFeedback(feedback.filter(item => item.id !== id));
                showToast('Feedback deleted successfully', 'success');
            } catch (error) {
                console.error('Error deleting feedback:', error);
                showToast('Failed to delete feedback', 'error');
            }
        }
    };

    if (loading) {
        return (
            <div className="feedback-admin-container">
                <h1>Feedback Administration</h1>
                <div className="loading-container">
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="feedback-admin-container">
                <h1>Unauthorized Access</h1>
                <p>You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="feedback-admin-container">
            <h1>Feedback Administration</h1>
            <button className="refresh-button" onClick={fetchFeedback}>
                Refresh Data
            </button>

            {feedback.length === 0 ? (
                <p>No feedback submissions found.</p>
            ) : (
                <div className="feedback-list">
                    {feedback.map((item) => (
                        <div key={item.id} className="feedback-item">
                            <div className="feedback-header">
                                <div>
                                    <h3>Page: {item.page}</h3>
                                    <p className="feedback-meta">
                                        From: {item.userEmail} •
                                        {new Date(item.timestamp).toLocaleString()}
                                    </p>
                                </div>
                                <div className="rating-display">
                                    {item.rating > 0 ? '★'.repeat(item.rating) : 'No rating'}
                                </div>
                            </div>

                            <div className="feedback-body">
                                {item.feedback ? (
                                    <p>{item.feedback}</p>
                                ) : (
                                    <p className="no-comment">No comment provided</p>
                                )}
                            </div>

                            <div className="feedback-actions">
                                <button
                                    className="delete-button"
                                    onClick={() => handleDelete(item.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FeedbackAdminPage;