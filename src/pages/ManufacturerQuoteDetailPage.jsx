import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/ManufacturerQuoteDetailPage.css';

const ManufacturerQuoteDetailPage = () => {
    const { quoteId } = useParams();
    const { currentUser, userRole } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();

    const [quote, setQuote] = useState(null);
    const [product, setProduct] = useState(null);
    const [quoteRequest, setQuoteRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updateLoading, setUpdateLoading] = useState(false);

    // Check if user has manufacturer role
    const isManufacturer = Array.isArray(userRole)
        ? userRole.includes('manufacturer')
        : userRole === 'manufacturer';

    useEffect(() => {
        const fetchQuoteDetails = async () => {
            if (!quoteId || !currentUser?.uid) return;

            setLoading(true);
            try {
                const quoteDoc = await getDoc(doc(db, 'manufacturerQuotes', quoteId));

                if (!quoteDoc.exists()) {
                    throw new Error('Quote not found');
                }

                const quoteData = { id: quoteDoc.id, ...quoteDoc.data() };

                // Check if this quote belongs to the current manufacturer
                if (quoteData.manufacturerId !== currentUser.uid) {
                    throw new Error('You do not have permission to view this quote');
                }

                setQuote(quoteData);

                // Fetch related product if available
                if (quoteData.productId) {
                    const productDoc = await getDoc(doc(db, 'products', quoteData.productId));
                    if (productDoc.exists()) {
                        setProduct({ id: productDoc.id, ...productDoc.data() });
                    }
                }

                // Fetch related quote request if available
                if (quoteData.requestId) {
                    const requestDoc = await getDoc(doc(db, 'quoteRequests', quoteData.requestId));
                    if (requestDoc.exists()) {
                        setQuoteRequest({ id: requestDoc.id, ...requestDoc.data() });
                    }
                }
            } catch (error) {
                console.error('Error fetching quote details:', error);
                showError(error.message || 'Failed to load quote details');
                navigate('/manufacturer/quotes');
            } finally {
                setLoading(false);
            }
        };

        fetchQuoteDetails();
    }, [quoteId, currentUser, showError, navigate]);

    const handleStatusUpdate = async (newStatus) => {
        if (!quote || updateLoading) return;

        setUpdateLoading(true);
        try {
            await updateDoc(doc(db, 'manufacturerQuotes', quoteId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
                statusHistory: [
                    ...(quote.statusHistory || []),
                    {
                        status: newStatus,
                        timestamp: new Date(),
                        userId: currentUser.uid
                    }
                ]
            });

            // Update local state
            setQuote(prev => ({ ...prev, status: newStatus }));

            // Show success message
            showSuccess(`Quote status updated to ${formatStatus(newStatus)}`);
        } catch (error) {
            console.error('Error updating quote status:', error);
            showError('Failed to update quote status');
        } finally {
            setUpdateLoading(false);
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

    const formatStatus = (status) => {
        switch (status) {
            case 'pending': return 'Pending Review';
            case 'accepted': return 'Accepted';
            case 'rejected': return 'Declined';
            case 'in_progress': return 'In Production';
            case 'completed': return 'Completed';
            case 'expired': return 'Expired';
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'accepted': return 'status-accepted';
            case 'rejected': return 'status-rejected';
            case 'in_progress': return 'status-in-progress';
            case 'completed': return 'status-completed';
            case 'expired': return 'status-expired';
            default: return '';
        }
    };

    if (!isManufacturer) {
        return (
            <div className="quote-detail-page">
                <div className="container">
                    <div className="role-required-message">
                        <h2>Manufacturer Role Required</h2>
                        <p>You need to have the manufacturer role to view quote details.</p>
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
                        onClick={() => navigate('/manufacturer/quotes')}
                    >
                        ← Back to Quotes
                    </button>
                    <h1>Quote Details</h1>
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
                                    {formatStatus(quote.status)}
                                </span>
                                {quote.status === 'accepted' && (
                                    <div className="status-message">
                                        This quote has been accepted by the designer.
                                        You can start production now.
                                    </div>
                                )}
                                {quote.status === 'in_progress' && (
                                    <div className="status-message">
                                        This project is currently in production.
                                    </div>
                                )}
                                {quote.status === 'pending' && (
                                    <div className="status-message">
                                        The designer is reviewing this quote.
                                    </div>
                                )}
                            </div>

                            {quote.status === 'accepted' && (
                                <div className="status-actions">
                                    <button
                                        className="btn-primary"
                                        onClick={() => handleStatusUpdate('in_progress')}
                                        disabled={updateLoading}
                                    >
                                        {updateLoading ? 'Updating...' : 'Start Production'}
                                    </button>
                                </div>
                            )}

                            {quote.status === 'in_progress' && (
                                <div className="status-actions">
                                    <button
                                        className="btn-primary"
                                        onClick={() => handleStatusUpdate('completed')}
                                        disabled={updateLoading}
                                    >
                                        {updateLoading ? 'Updating...' : 'Mark as Completed'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="detail-grid">
                            <div className="detail-card">
                                <h2>Quote Information</h2>
                                <div className="detail-content">
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
                                            <h3>Notes</h3>
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
                                        <div className="detail-row">
                                            <span className="detail-label">Designer</span>
                                            <span className="detail-value">{product.designerName || 'Unknown'}</span>
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
                                    <h2>Request Details</h2>
                                    <div className="detail-content">
                                        <div className="detail-row">
                                            <span className="detail-label">Requested On</span>
                                            <span className="detail-value">{formatDate(quoteRequest.createdAt)}</span>
                                        </div>
                                        {quoteRequest.deadline && (
                                            <div className="detail-row">
                                                <span className="detail-label">Quote Deadline</span>
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
                                                                {formatStatus(item.status)}
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
                                                        <span className="status-badge status-submitted">Quote Submitted</span>
                                                        <span className="timeline-date">{formatDate(quote.submittedAt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {quote.status === 'pending' && (
                            <div className="quote-actions-footer">
                                <p>This quote is awaiting review from the designer.</p>
                                <p>Average response time: 2-3 business days.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManufacturerQuoteDetailPage;
