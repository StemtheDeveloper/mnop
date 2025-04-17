import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { sanitizeString, sanitizeFormData } from '../utils/sanitizer';
import '../styles/ManufacturerQuotesPage.css';

const ManufacturerQuotesPage = () => {
    const { currentUser, userRole, userProfile } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();

    // State for quotes data
    const [quoteRequests, setQuoteRequests] = useState([]);
    const [activeQuotes, setActiveQuotes] = useState([]);
    const [pastQuotes, setPastQuotes] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('requests');

    // State for quote form
    const [quoteForm, setQuoteForm] = useState({
        price: '',
        estimatedDeliveryDays: '',
        notes: '',
        termsAccepted: false
    });

    // Check if user has manufacturer role
    const isManufacturer = Array.isArray(userRole)
        ? userRole.includes('manufacturer')
        : userRole === 'manufacturer';

    // Fetch quote requests and submitted quotes
    useEffect(() => {
        const loadQuotes = async () => {
            if (!currentUser?.uid || !isManufacturer) return;

            setLoading(true);
            try {
                // Fetch quote requests that are open for bidding
                const requestsQuery = query(
                    collection(db, 'quoteRequests'),
                    where('status', '==', 'open'),
                    orderBy('createdAt', 'desc')
                );
                const requestsSnapshot = await getDocs(requestsQuery);
                const requestsData = requestsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Fetch quotes submitted by this manufacturer
                // This is secured by Firestore rules to ensure only this manufacturer's quotes are returned
                const quotesQuery = query(
                    collection(db, 'manufacturerQuotes'),
                    where('manufacturerId', '==', currentUser.uid),
                    orderBy('createdAt', 'desc')
                );
                const quotesSnapshot = await getDocs(quotesQuery);
                const quotesData = quotesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Separate active and past quotes
                const active = quotesData.filter(q =>
                    q.status === 'pending' || q.status === 'accepted' || q.status === 'in_progress' || q.status === 'negotiating'
                );
                const past = quotesData.filter(q =>
                    q.status === 'completed' || q.status === 'rejected' || q.status === 'expired'
                );

                // Filter out requests that the manufacturer has already quoted
                const quotedRequestIds = quotesData.map(quote => quote.requestId);
                const openRequests = requestsData.filter(request =>
                    !quotedRequestIds.includes(request.id)
                );

                setQuoteRequests(openRequests);
                setActiveQuotes(active);
                setPastQuotes(past);
            } catch (error) {
                console.error('Error loading quotes:', error);
                showError('Failed to load quote information. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        loadQuotes();
    }, [currentUser, isManufacturer, showError]);

    const handleRequestSelect = async (request) => {
        setSelectedRequest(request);

        // Reset form
        setQuoteForm({
            price: '',
            estimatedDeliveryDays: '',
            notes: '',
            termsAccepted: false
        });

        // Fetch additional product details if needed
        if (request.productId) {
            try {
                const productDoc = await getDoc(doc(db, 'products', request.productId));
                if (productDoc.exists()) {
                    setSelectedRequest(prev => ({
                        ...prev,
                        productDetails: productDoc.data()
                    }));
                }
            } catch (error) {
                console.error('Error fetching product details:', error);
            }
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setQuoteForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmitQuote = async (e) => {
        e.preventDefault();

        if (!selectedRequest) return;
        if (!quoteForm.termsAccepted) {
            showError('You must accept the terms and conditions to submit a quote');
            return;
        }

        // Validate form
        const price = parseFloat(quoteForm.price);
        const deliveryDays = parseInt(quoteForm.estimatedDeliveryDays);

        if (isNaN(price) || price <= 0) {
            showError('Please enter a valid price');
            return;
        }

        if (isNaN(deliveryDays) || deliveryDays <= 0) {
            showError('Please enter a valid estimated delivery time');
            return;
        }

        setSubmitLoading(true);
        try {
            // Create the quote document
            const quoteData = {
                requestId: selectedRequest.id,
                productId: selectedRequest.productId,
                designerId: selectedRequest.designerId,
                manufacturerId: currentUser.uid,
                manufacturerName: userProfile.displayName || userProfile.companyName || 'Unnamed Manufacturer',
                price: price,
                estimatedDeliveryDays: deliveryDays,
                notes: quoteForm.notes.trim(),
                status: 'pending',
                submittedAt: serverTimestamp()
            };

            // Add to manufacturerQuotes collection
            const docRef = await addDoc(collection(db, 'manufacturerQuotes'), quoteData);

            // Update the request with this quote
            await updateDoc(doc(db, 'quoteRequests', selectedRequest.id), {
                quotesReceived: (selectedRequest.quotesReceived || 0) + 1,
                lastQuoteAt: serverTimestamp()
            });

            // Show success message
            showSuccess('Quote submitted successfully!');

            // Update local state - remove this request from available requests
            setQuoteRequests(prev => prev.filter(req => req.id !== selectedRequest.id));

            // Add to active quotes
            setActiveQuotes(prev => [...prev, { ...quoteData, id: docRef.id }]);

            // Close the form
            setSelectedRequest(null);

            // Switch to "active" tab
            setActiveTab('active');
        } catch (error) {
            console.error('Error submitting quote:', error);
            showError('Failed to submit quote. Please try again.');
        } finally {
            setSubmitLoading(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
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
            case 'in_progress': return 'status-in-progress';
            case 'completed': return 'status-completed';
            case 'expired': return 'status-expired';
            case 'negotiating': return 'status-negotiating'; // Add this case
            default: return '';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'Pending Review';
            case 'accepted': return 'Accepted';
            case 'rejected': return 'Declined';
            case 'negotiating': return 'Negotiating'; // Add this case
            case 'in_progress': return 'In Production';
            case 'completed': return 'Completed';
            case 'expired': return 'Expired';
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    if (!isManufacturer) {
        return (
            <div className="manufacturer-quotes-page">
                <div className="role-required-container">
                    <h1>Manufacturer Role Required</h1>
                    <p>You need to have the manufacturer role to access this page.</p>
                    <Link to="/profile" className="btn-primary">Go to Profile</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="manufacturer-quotes-page">
            <div className="container">
                <h1>Manufacturing Quotes</h1>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading quote information...</p>
                    </div>
                ) : (
                    <div className="quotes-content">
                        <div className="tabs-container">
                            <div className="tabs">
                                <button
                                    className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('requests')}
                                >
                                    Quote Requests <span className="count">{quoteRequests.length}</span>
                                </button>
                                <button
                                    className={`tab ${activeTab === 'active' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('active')}
                                >
                                    Active Quotes <span className="count">{activeQuotes.length}</span>
                                </button>
                                <button
                                    className={`tab ${activeTab === 'past' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('past')}
                                >
                                    Past Quotes <span className="count">{pastQuotes.length}</span>
                                </button>
                            </div>
                        </div>

                        {activeTab === 'requests' && (
                            <div className="tab-content">
                                {quoteRequests.length === 0 ? (
                                    <div className="empty-state">
                                        <h3>No Available Quote Requests</h3>
                                        <p>When designers request manufacturing quotes, they'll appear here.</p>
                                    </div>
                                ) : selectedRequest ? (
                                    <div className="quote-form-container">
                                        <div className="quote-details-header">
                                            <h2>Submit a Quote</h2>
                                            <button
                                                className="btn-text"
                                                onClick={() => setSelectedRequest(null)}
                                            >
                                                Back to Quote Requests
                                            </button>
                                        </div>

                                        <div className="request-details">
                                            <div className="product-info">
                                                <h3>{selectedRequest.productName || 'Product Quote Request'}</h3>
                                                <p><strong>Designer:</strong> {selectedRequest.designerName || 'Anonymous'}</p>
                                                <p><strong>Requested:</strong> {formatDate(selectedRequest.createdAt)}</p>

                                                {selectedRequest.deadline && (
                                                    <p><strong>Quote Deadline:</strong> {formatDate(selectedRequest.deadline)}</p>
                                                )}

                                                <div className="product-details">
                                                    <p>{selectedRequest.description || 'No description provided'}</p>
                                                </div>

                                                {selectedRequest.attachmentUrls && selectedRequest.attachmentUrls.length > 0 && (
                                                    <div className="attachments">
                                                        <h4>Attachments</h4>
                                                        <ul>
                                                            {selectedRequest.attachmentUrls.map((url, index) => (
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

                                            <form className="quote-form" onSubmit={handleSubmitQuote}>
                                                <h3>Your Quote</h3>

                                                <div className="form-group">
                                                    <label htmlFor="price">Price (USD)</label>
                                                    <div className="price-input-wrapper">
                                                        <span className="currency-symbol">$</span>
                                                        <input
                                                            type="number"
                                                            id="price"
                                                            name="price"
                                                            value={quoteForm.price}
                                                            onChange={handleFormChange}
                                                            min="0"
                                                            step="0.01"
                                                            required
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="estimatedDeliveryDays">Estimated Delivery Time (Days)</label>
                                                    <input
                                                        type="number"
                                                        id="estimatedDeliveryDays"
                                                        name="estimatedDeliveryDays"
                                                        value={quoteForm.estimatedDeliveryDays}
                                                        onChange={handleFormChange}
                                                        min="1"
                                                        required
                                                        placeholder="Number of days"
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="notes">Notes (Optional)</label>
                                                    <textarea
                                                        id="notes"
                                                        name="notes"
                                                        value={quoteForm.notes}
                                                        onChange={handleFormChange}
                                                        rows="4"
                                                        placeholder="Add any additional details about your quote here"
                                                    ></textarea>
                                                </div>

                                                <div className="form-group checkbox-group">
                                                    <input
                                                        type="checkbox"
                                                        id="termsAccepted"
                                                        name="termsAccepted"
                                                        checked={quoteForm.termsAccepted}
                                                        onChange={handleFormChange}
                                                        required
                                                    />
                                                    <label htmlFor="termsAccepted">
                                                        I agree to the <Link to="/terms" target="_blank">terms and conditions</Link> for manufacturing quotes
                                                    </label>
                                                </div>

                                                <div className="form-actions">
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        onClick={() => setSelectedRequest(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="btn-primary"
                                                        disabled={submitLoading || !quoteForm.termsAccepted}
                                                    >
                                                        {submitLoading ? 'Submitting...' : 'Submit Quote'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="quotes-list">
                                        <h2>Available Quote Requests</h2>
                                        <div className="quote-cards">
                                            {quoteRequests.map(request => (
                                                <div key={request.id} className="quote-card">
                                                    <div className="quote-card-header">
                                                        <h3>{request.productName || 'Product Quote Request'}</h3>
                                                        {request.urgent && <span className="urgent-badge">Urgent</span>}
                                                    </div>

                                                    <div className="quote-card-body">
                                                        <p><strong>Designer:</strong> {request.designerName || 'Anonymous'}</p>
                                                        <p><strong>Posted:</strong> {formatDate(request.createdAt)}</p>
                                                        {request.deadline && (
                                                            <p><strong>Quote Deadline:</strong> {formatDate(request.deadline)}</p>
                                                        )}
                                                        <p className="quote-description">
                                                            {request.description
                                                                ? (request.description.length > 100
                                                                    ? `${request.description.slice(0, 100)}...`
                                                                    : request.description)
                                                                : 'No description provided'
                                                            }
                                                        </p>
                                                    </div>

                                                    <div className="quote-card-footer">
                                                        <button
                                                            className="btn-primary"
                                                            onClick={() => handleRequestSelect(request)}
                                                        >
                                                            Submit Quote
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'active' && (
                            <div className="tab-content">
                                <h2>Active Quotes</h2>

                                {activeQuotes.length === 0 ? (
                                    <div className="empty-state">
                                        <h3>No Active Quotes</h3>
                                        <p>You haven't submitted any quotes that are currently active.</p>
                                    </div>
                                ) : (
                                    <div className="quotes-table-wrapper">
                                        <table className="quotes-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Price</th>
                                                    <th>Delivery Time</th>
                                                    <th>Submitted</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeQuotes.map(quote => (
                                                    <tr key={quote.id}>
                                                        <td>{quote.productName || 'Unnamed Product'}</td>
                                                        <td>{formatCurrency(quote.price)}</td>
                                                        <td>{quote.estimatedDeliveryDays} days</td>
                                                        <td>{formatDate(quote.submittedAt)}</td>
                                                        <td>
                                                            <span className={`status-badge ${getStatusBadgeClass(quote.status)}`}>
                                                                {getStatusLabel(quote.status)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn-small"
                                                                onClick={() => navigate(`/manufacturer/quotes/${quote.id}`)}
                                                            >
                                                                View Details
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'past' && (
                            <div className="tab-content">
                                <h2>Past Quotes</h2>

                                {pastQuotes.length === 0 ? (
                                    <div className="empty-state">
                                        <h3>No Past Quotes</h3>
                                        <p>You don't have any completed, rejected, or expired quotes.</p>
                                    </div>
                                ) : (
                                    <div className="quotes-table-wrapper">
                                        <table className="quotes-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Price</th>
                                                    <th>Delivery Time</th>
                                                    <th>Submitted</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pastQuotes.map(quote => (
                                                    <tr key={quote.id}>
                                                        <td>{quote.productName || 'Unnamed Product'}</td>
                                                        <td>{formatCurrency(quote.price)}</td>
                                                        <td>{quote.estimatedDeliveryDays} days</td>
                                                        <td>{formatDate(quote.submittedAt)}</td>
                                                        <td>
                                                            <span className={`status-badge ${getStatusBadgeClass(quote.status)}`}>
                                                                {getStatusLabel(quote.status)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn-small"
                                                                onClick={() => navigate(`/manufacturer/quotes/${quote.id}`)}
                                                            >
                                                                View Details
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="dashboard-metrics">
                            <div className="metric-card">
                                <h3>Open Requests</h3>
                                <div className="metric-value">{quoteRequests.length}</div>
                            </div>
                            <div className="metric-card">
                                <h3>Pending Quotes</h3>
                                <div className="metric-value">
                                    {activeQuotes.filter(q => q.status === 'pending').length}
                                </div>
                            </div>
                            <div className="metric-card">
                                <h3>Accepted Quotes</h3>
                                <div className="metric-value">
                                    {activeQuotes.filter(q => q.status === 'accepted' || q.status === 'in_progress').length}
                                </div>
                            </div>
                            <div className="metric-card">
                                <h3>Completed Projects</h3>
                                <div className="metric-value">
                                    {pastQuotes.filter(q => q.status === 'completed').length}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManufacturerQuotesPage;
