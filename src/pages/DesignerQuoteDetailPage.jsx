import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/DesignerQuoteDetailPage.css';

const DesignerQuoteDetailPage = () => {
    const { quoteId } = useParams();
    const { currentUser, userRole } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();

    const [quote, setQuote] = useState(null);
    const [quoteRequest, setQuoteRequest] = useState(null);
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showNegotiationForm, setShowNegotiationForm] = useState(false);

    const [negotiationMessage, setNegotiationMessage] = useState('');
    const [counterOfferPrice, setCounterOfferPrice] = useState('');

    // Check if user has designer role
    const isDesigner = Array.isArray(userRole)
        ? userRole.includes('designer')
        : userRole === 'designer';

    useEffect(() => {
        const fetchQuoteDetails = async () => {
            if (!quoteId || !currentUser?.uid || !isDesigner) return;

            setLoading(true);
            try {
                // Get the quote
                const quoteDoc = await getDoc(doc(db, 'manufacturerQuotes', quoteId));

                if (!quoteDoc.exists()) {
                    throw new Error('Quote not found');
                }

                const quoteData = { id: quoteDoc.id, ...quoteDoc.data() };

                // Check if this quote is for the current designer
                if (quoteData.designerId !== currentUser.uid) {
                    throw new Error('You do not have permission to view this quote');
                }

                setQuote(quoteData);

                // Get the quote request
                if (quoteData.requestId) {
                    const requestDoc = await getDoc(doc(db, 'quoteRequests', quoteData.requestId));
                    if (requestDoc.exists()) {
                        setQuoteRequest(requestDoc.data());
                    }
                }

                // Get the product if available
                if (quoteData.productId) {
                    const productDoc = await getDoc(doc(db, 'products', quoteData.productId));
                    if (productDoc.exists()) {
                        setProduct(productDoc.data());
                    }
                }

                // Initialize counter offer price with the current quote price
                setCounterOfferPrice(quoteData.price?.toString() || '');

            } catch (error) {
                console.error('Error fetching quote details:', error);
                showError(error.message || 'Failed to load quote details');
                navigate('/designer/quotes');
            } finally {
                setLoading(false);
            }
        };

        fetchQuoteDetails();
    }, [quoteId, currentUser, isDesigner, navigate, showError]);

    const handleAcceptQuote = async () => {
        if (!quote || actionLoading) return;

        setActionLoading(true);
        try {
            // Update quote status to accepted
            await updateDoc(doc(db, 'manufacturerQuotes', quoteId), {
                status: 'accepted',
                acceptedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                statusHistory: [
                    ...(quote.statusHistory || []),
                    {
                        status: 'accepted',
                        timestamp: new Date(),
                        userId: currentUser.uid
                    }
                ]
            });

            // Also update the quote request status
            if (quote.requestId) {
                await updateDoc(doc(db, 'quoteRequests', quote.requestId), {
                    status: 'accepted',
                    acceptedQuoteId: quoteId,
                    updatedAt: serverTimestamp()
                });
            }

            // Create notification for manufacturer
            await addDoc(collection(db, 'notifications'), {
                userId: quote.manufacturerId,
                title: 'Quote Accepted',
                message: `Your quote for "${product?.name || 'the product'}" has been accepted!`,
                type: 'quote_accepted',
                quoteId: quoteId,
                productId: quote.productId,
                read: false,
                createdAt: serverTimestamp()
            });

            // Update local state
            setQuote(prev => ({
                ...prev,
                status: 'accepted',
                acceptedAt: new Date(),
                statusHistory: [
                    ...(prev.statusHistory || []),
                    {
                        status: 'accepted',
                        timestamp: new Date(),
                        userId: currentUser.uid
                    }
                ]
            }));

            showSuccess('Quote accepted successfully!');
        } catch (error) {
            console.error('Error accepting quote:', error);
            showError('Failed to accept quote. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectQuote = async () => {
        if (!quote || actionLoading) return;

        setActionLoading(true);
        try {
            // Update quote status to rejected
            await updateDoc(doc(db, 'manufacturerQuotes', quoteId), {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                statusHistory: [
                    ...(quote.statusHistory || []),
                    {
                        status: 'rejected',
                        timestamp: new Date(),
                        userId: currentUser.uid
                    }
                ]
            });

            // Create notification for manufacturer
            await addDoc(collection(db, 'notifications'), {
                userId: quote.manufacturerId,
                title: 'Quote Rejected',
                message: `Your quote for "${product?.name || 'the product'}" was not accepted.`,
                type: 'quote_rejected',
                quoteId: quoteId,
                productId: quote.productId,
                read: false,
                createdAt: serverTimestamp()
            });

            // Update local state
            setQuote(prev => ({
                ...prev,
                status: 'rejected',
                rejectedAt: new Date(),
                statusHistory: [
                    ...(prev.statusHistory || []),
                    {
                        status: 'rejected',
                        timestamp: new Date(),
                        userId: currentUser.uid
                    }
                ]
            }));

            showSuccess('Quote rejected successfully.');
        } catch (error) {
            console.error('Error rejecting quote:', error);
            showError('Failed to reject quote. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleNegotiateQuote = async (e) => {
        e.preventDefault();

        if (!quote || actionLoading || !negotiationMessage) return;

        // Validate counter offer price if provided
        let price = null;
        if (counterOfferPrice) {
            price = parseFloat(counterOfferPrice);
            if (isNaN(price) || price <= 0) {
                showError('Please enter a valid price for your counter offer');
                return;
            }
        }

        setActionLoading(true);
        try {
            // Update quote status to negotiating
            await updateDoc(doc(db, 'manufacturerQuotes', quoteId), {
                status: 'negotiating',
                updatedAt: serverTimestamp(),
                statusHistory: [
                    ...(quote.statusHistory || []),
                    {
                        status: 'negotiating',
                        timestamp: new Date(),
                        userId: currentUser.uid
                    }
                ]
            });

            // Create negotiation record
            await addDoc(collection(db, 'quoteNegotiations'), {
                quoteId: quoteId,
                message: negotiationMessage,
                counterOfferPrice: price,
                fromUserId: currentUser.uid,
                toUserId: quote.manufacturerId,
                createdAt: serverTimestamp(),
                read: false
            });

            // Create notification for manufacturer
            await addDoc(collection(db, 'notifications'), {
                userId: quote.manufacturerId,
                title: 'Quote Negotiation Request',
                message: `The designer has proposed a negotiation for your quote on "${product?.name || 'the product'}"`,
                type: 'quote_negotiation',
                quoteId: quoteId,
                productId: quote.productId,
                read: false,
                createdAt: serverTimestamp()
            });

            // Update local state
            setQuote(prev => ({
                ...prev,
                status: 'negotiating',
                statusHistory: [
                    ...(prev.statusHistory || []),
                    {
                        status: 'negotiating',
                        timestamp: new Date(),
                        userId: currentUser.uid
                    }
                ]
            }));

            setShowNegotiationForm(false);
            setNegotiationMessage('');
            setCounterOfferPrice('');

            showSuccess('Negotiation request sent successfully');
        } catch (error) {
            console.error('Error sending negotiation request:', error);
            showError('Failed to send negotiation request. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'accepted': return 'status-accepted';
            case 'rejected': return 'status-rejected';
            case 'negotiating': return 'status-negotiating';
            case 'in_progress': return 'status-in-progress';
            case 'completed': return 'status-completed';
            default: return '';
        }
    };

    if (!isDesigner) {
        return (
            <div className="quote-detail-page">
                <div className="container">
                    <div className="role-required-message">
                        <h2>Designer Role Required</h2>
                        <p>You need to have the designer role to view quote details.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="quote-detail-page">
            <div className="container">
                <div className="page-header">
                    <button
                        className="back-button"
                        onClick={() => navigate('/designer/quotes')}
                    >
                        ← Back to Quotes
                    </button>
                    <h1>Manufacturing Quote Details</h1>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading quote details...</p>
                    </div>
                ) : (
                    <div className="quote-detail-content">
                        <div className="quote-status-card">
                            <h2>Quote Status</h2>
                            <div className="status-display">
                                <span className={`status-badge large ${getStatusBadgeClass(quote.status)}`}>
                                    {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                                </span>
                                {quote.status === 'pending' && (
                                    <div className="status-message">
                                        This quote is waiting for your review. You can accept, reject, or negotiate.
                                    </div>
                                )}
                                {quote.status === 'accepted' && (
                                    <div className="status-message success">
                                        You've accepted this quote. The manufacturer has been notified.
                                    </div>
                                )}
                                {quote.status === 'negotiating' && (
                                    <div className="status-message">
                                        You're currently negotiating this quote with the manufacturer.
                                    </div>
                                )}
                                {quote.status === 'rejected' && (
                                    <div className="status-message">
                                        You've declined this quote.
                                    </div>
                                )}
                            </div>

                            {quote.status === 'pending' && (
                                <div className="quote-actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setShowNegotiationForm(true)}
                                        disabled={actionLoading}
                                    >
                                        Negotiate
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={handleRejectQuote}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Processing...' : 'Decline Quote'}
                                    </button>
                                    <button
                                        className="btn-success"
                                        onClick={handleAcceptQuote}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Processing...' : 'Accept Quote'}
                                    </button>
                                </div>
                            )}

                            {showNegotiationForm && (
                                <div className="negotiation-form">
                                    <h3>Negotiate Quote</h3>
                                    <form onSubmit={handleNegotiateQuote}>
                                        <div className="form-group">
                                            <label htmlFor="counterOfferPrice">Counter-Offer Price (Optional)</label>
                                            <div className="price-input-wrapper">
                                                <span className="currency-symbol">$</span>
                                                <input
                                                    type="number"
                                                    id="counterOfferPrice"
                                                    value={counterOfferPrice}
                                                    onChange={(e) => setCounterOfferPrice(e.target.value)}
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="Enter your counter-offer price"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="negotiationMessage">Message to Manufacturer</label>
                                            <textarea
                                                id="negotiationMessage"
                                                value={negotiationMessage}
                                                onChange={(e) => setNegotiationMessage(e.target.value)}
                                                rows="4"
                                                required
                                                placeholder="Explain your counter-offer or ask questions about the quote..."
                                            ></textarea>
                                        </div>
                                        <div className="form-actions">
                                            <button
                                                type="button"
                                                className="btn-text"
                                                onClick={() => setShowNegotiationForm(false)}
                                                disabled={actionLoading}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn-primary"
                                                disabled={actionLoading || !negotiationMessage.trim()}
                                            >
                                                {actionLoading ? 'Sending...' : 'Send Negotiation Request'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>

                        <div className="detail-grid">
                            <div className="detail-card">
                                <h2>Quote Information</h2>
                                <div className="detail-content">
                                    <div className="detail-row">
                                        <span className="detail-label">Manufacturer</span>
                                        <span className="detail-value">{quote.manufacturerName || 'Unknown'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Quote Price</span>
                                        <span className="detail-value price">{formatCurrency(quote.price)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Estimated Delivery</span>
                                        <span className="detail-value">{quote.estimatedDeliveryDays} days</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Submitted On</span>
                                        <span className="detail-value">{formatDate(quote.submittedAt)}</span>
                                    </div>
                                    {quote.notes && (
                                        <div className="detail-notes">
                                            <h3>Notes from Manufacturer</h3>
                                            <p>{quote.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {product && (
                                <div className="detail-card">
                                    <h2>Product Information</h2>
                                    <div className="detail-content">
                                        <div className="detail-row">
                                            <span className="detail-label">Product Name</span>
                                            <span className="detail-value">{product.name || 'Unnamed Product'}</span>
                                        </div>
                                        {product.category && (
                                            <div className="detail-row">
                                                <span className="detail-label">Category</span>
                                                <span className="detail-value">{product.category}</span>
                                            </div>
                                        )}
                                        {product.description && (
                                            <div className="detail-description">
                                                <h3>Product Description</h3>
                                                <p>{product.description}</p>
                                            </div>
                                        )}
                                        {product.imageUrl && (
                                            <div className="quote-product-image">
                                                <img src={product.imageUrl} alt={product.name || 'Product'} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {quoteRequest && (
                                <div className="detail-card">
                                    <h2>Quote Request Details</h2>
                                    <div className="detail-content">
                                        <div className="detail-row">
                                            <span className="detail-label">Requested On</span>
                                            <span className="detail-value">{formatDate(quoteRequest.createdAt)}</span>
                                        </div>
                                        {quoteRequest.deadline && (
                                            <div className="detail-row">
                                                <span className="detail-label">Deadline</span>
                                                <span className="detail-value">{formatDate(quoteRequest.deadline)}</span>
                                            </div>
                                        )}
                                        {quoteRequest.description && (
                                            <div className="detail-description">
                                                <h3>Request Description</h3>
                                                <p>{quoteRequest.description}</p>
                                            </div>
                                        )}
                                        {quoteRequest.attachmentUrls && quoteRequest.attachmentUrls.length > 0 && (
                                            <div className="attachments">
                                                <h3>Attachments</h3>
                                                <ul>
                                                    {quoteRequest.attachmentUrls.map((url, index) => (
                                                        <li key={index}>
                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                Attachment {index + 1}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {quote.statusHistory && quote.statusHistory.length > 0 && (
                                <div className="detail-card">
                                    <h2>Status History</h2>
                                    <div className="detail-content">
                                        <div className="status-timeline">
                                            {quote.statusHistory.map((item, index) => (
                                                <div key={index} className="timeline-item">
                                                    <div className="timeline-icon"></div>
                                                    <div className="timeline-content">
                                                        <div className="timeline-header">
                                                            <span className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                                                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                                            </span>
                                                            <span className="timeline-date">{formatDate(item.timestamp)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="timeline-item">
                                                <div className="timeline-icon submitted"></div>
                                                <div className="timeline-content">
                                                    <div className="timeline-header">
                                                        <span className="status-badge status-submitted">Quote Received</span>
                                                        <span className="timeline-date">{formatDate(quote.submittedAt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignerQuoteDetailPage;
