import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/DesignerQuotesPage.css';

const DesignerQuotesPage = () => {
    const { currentUser, userRole } = useUser();
    const { showError } = useToast();
    const navigate = useNavigate();

    // State for quote data
    const [quoteRequests, setQuoteRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');

    // Check if user has designer role
    const isDesigner = Array.isArray(userRole)
        ? userRole.includes('designer')
        : userRole === 'designer';

    // Fetch quote requests made by this designer
    useEffect(() => {
        const fetchQuoteRequests = async () => {
            if (!currentUser?.uid || !isDesigner) return;

            setLoading(true);
            try {
                // Get quote requests made by this designer
                // This is now secured by Firestore rules to ensure only the designer's own requests are returned
                const requestsQuery = query(
                    collection(db, 'quoteRequests'),
                    where('designerId', '==', currentUser.uid),
                    orderBy('createdAt', 'desc')
                );

                const requestsSnapshot = await getDocs(requestsQuery);
                const requestsData = requestsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    manufacturerQuotes: [] // Will be populated with quotes
                }));

                // For each request, get the manufacturer quotes
                // This is secure because we're querying by requestId which belongs to this designer
                const enhancedRequests = [];

                for (const request of requestsData) {
                    const quotesQuery = query(
                        collection(db, 'manufacturerQuotes'),
                        where('requestId', '==', request.id),
                        orderBy('createdAt', 'desc')
                    );

                    const quotesSnapshot = await getDocs(quotesQuery);
                    const quotes = quotesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    enhancedRequests.push({
                        ...request,
                        manufacturerQuotes: quotes
                    });
                }

                setQuoteRequests(enhancedRequests);
            } catch (error) {
                console.error('Error fetching quote requests:', error);
                showError('Failed to load your quote requests');
            } finally {
                setLoading(false);
            }
        };

        fetchQuoteRequests();
    }, [currentUser, isDesigner, showError]);

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'open': return 'status-open';
            case 'pending': return 'status-pending';
            case 'accepted': return 'status-accepted';
            case 'in_progress': return 'status-in-progress';
            case 'completed': return 'status-completed';
            case 'closed': return 'status-closed';
            default: return '';
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Filter quote requests based on active tab
    const filteredRequests = quoteRequests.filter(request => {
        if (activeTab === 'pending') {
            return request.status === 'open' && request.manufacturerQuotes.some(quote => quote.status === 'pending');
        } else if (activeTab === 'accepted') {
            return request.manufacturerQuotes.some(quote =>
                quote.status === 'accepted' || quote.status === 'in_progress'
            );
        } else if (activeTab === 'completed') {
            return request.manufacturerQuotes.some(quote => quote.status === 'completed');
        }
        return true;
    });

    // Count quotes per status for the tabs
    const pendingCount = quoteRequests.filter(req =>
        req.status === 'open' && req.manufacturerQuotes.some(q => q.status === 'pending')
    ).length;

    const acceptedCount = quoteRequests.filter(req =>
        req.manufacturerQuotes.some(q => q.status === 'accepted' || q.status === 'in_progress')
    ).length;

    const completedCount = quoteRequests.filter(req =>
        req.manufacturerQuotes.some(q => q.status === 'completed')
    ).length;

    if (!isDesigner) {
        return (
            <div className="designer-quotes-page">
                <div className="role-required-container">
                    <h1>Designer Role Required</h1>
                    <p>You need to have the designer role to access this page.</p>
                    <Link to="/profile" className="btn-primary">Go to Profile</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="designer-quotes-page">
            <div className="container">
                <h1>Manufacturing Quotes</h1>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading your quote requests...</p>
                    </div>
                ) : (
                    <div className="quotes-content">
                        <div className="tabs-container">
                            <div className="tabs">
                                <button
                                    className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('pending')}
                                >
                                    Pending Quotes <span className="count">{pendingCount}</span>
                                </button>
                                <button
                                    className={`tab ${activeTab === 'accepted' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('accepted')}
                                >
                                    Accepted Quotes <span className="count">{acceptedCount}</span>
                                </button>
                                <button
                                    className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('completed')}
                                >
                                    Completed <span className="count">{completedCount}</span>
                                </button>
                                <button
                                    className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('all')}
                                >
                                    All Requests
                                </button>
                            </div>
                        </div>

                        {quoteRequests.length === 0 ? (
                            <div className="empty-state">
                                <h3>No Quote Requests Found</h3>
                                <p>You haven't made any manufacturing quote requests yet.</p>
                                <Link to="/designer/create-quote-request" className="btn-primary">Request a Quote</Link>
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="empty-state">
                                <h3>No {activeTab} Quotes Found</h3>
                                <p>You don't have any quotes in this category.</p>
                            </div>
                        ) : (
                            <div className="quote-requests-list">
                                {filteredRequests.map(request => (
                                    <div key={request.id} className="quote-request-card">
                                        <div className="quote-request-header">
                                            <h2>{request.productName || 'Quote Request'}</h2>
                                            <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                            </span>
                                        </div>

                                        <div className="quote-request-details">
                                            <div className="detail-item">
                                                <span className="detail-label">Requested:</span>
                                                <span className="detail-value">{formatDate(request.createdAt)}</span>
                                            </div>
                                            {request.deadline && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Deadline:</span>
                                                    <span className="detail-value">{formatDate(request.deadline)}</span>
                                                </div>
                                            )}
                                            <div className="detail-item">
                                                <span className="detail-label">Quotes Received:</span>
                                                <span className="detail-value">{request.manufacturerQuotes.length}</span>
                                            </div>
                                        </div>

                                        {request.manufacturerQuotes.length > 0 && (
                                            <div className="quotes-received">
                                                <h3>Manufacturing Quotes</h3>

                                                <div className="quotes-table-wrapper">
                                                    <table className="quotes-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Manufacturer</th>
                                                                <th>Price</th>
                                                                <th>Delivery Time</th>
                                                                <th>Status</th>
                                                                <th>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {request.manufacturerQuotes.map(quote => (
                                                                <tr key={quote.id} className={quote.status === 'accepted' ? 'highlight-row' : ''}>
                                                                    <td>{quote.manufacturerName || 'Unknown'}</td>
                                                                    <td>{formatCurrency(quote.price)}</td>
                                                                    <td>{quote.estimatedDeliveryDays} days</td>
                                                                    <td>
                                                                        <span className={`status-badge ${getStatusBadgeClass(quote.status)}`}>
                                                                            {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                                                                        </span>
                                                                    </td>
                                                                    <td>
                                                                        <button
                                                                            className="btn-small"
                                                                            onClick={() => navigate(`/designer/quotes/${quote.id}`)}
                                                                        >
                                                                            View Details
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        <div className="quote-request-footer">
                                            <button
                                                className="btn-secondary"
                                                onClick={() => navigate(`/designer/quote-request/${request.id}`)}
                                            >
                                                View Request Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="action-buttons">
                            <Link to="/designer/create-quote-request" className="btn-primary">
                                Request New Manufacturing Quote
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignerQuotesPage;
