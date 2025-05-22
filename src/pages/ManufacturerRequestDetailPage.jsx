import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/ManufacturerRequestDetail.css';

const ManufacturerRequestDetailPage = () => {
    const { requestId } = useParams();
    const { currentUser, hasRole } = useUser();
    const { success: showSuccess, error: showError } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState(null);
    const [product, setProduct] = useState(null);
    const [processingAction, setProcessingAction] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [costEstimate, setCostEstimate] = useState('');
    const [retailPriceSuggestion, setRetailPriceSuggestion] = useState('');
    const [estimateMessage, setEstimateMessage] = useState('');
    const imageInterval = useRef(null);

    // Check if user has manufacturer role using the hasRole function
    const isManufacturer = hasRole('manufacturer');

    console.log('ManufacturerRequestDetailPage - User info:', {
        uid: currentUser?.uid,
        isManufacturer,
        hasManufacturerRole: hasRole('manufacturer')
    }); useEffect(() => {
        // Don't redirect if we're still loading
        if (loading) return;

        // Only redirect if user is authenticated but definitely not a manufacturer
        if (currentUser && !isManufacturer) {
            console.log('User authenticated but not a manufacturer - redirecting to unauthorized');
            console.log('Current roles:', currentUser.uid);
            // Check all roles in local storage for debugging
            const roles = localStorage.getItem(`user_roles_${currentUser.uid}`);
            console.log('Roles in localStorage:', roles);

            showError('You must be a registered manufacturer to view this page.');
            navigate('/unauthorized', { replace: true });
        }
    }, [isManufacturer, loading, navigate, showError, currentUser]);
    // Fetch request and product details
    useEffect(() => {
        const fetchRequestDetails = async () => {
            if (!requestId || !currentUser?.uid) return;

            setLoading(true);
            try {
                console.log(`Fetching request details for ID: ${requestId}`);
                console.log(`Current user ID: ${currentUser.uid}`);

                // Get the request document
                const requestRef = doc(db, 'manufacturerRequests', requestId);
                const requestSnap = await getDoc(requestRef);

                if (!requestSnap.exists()) {
                    console.log('Request not found in database');
                    showError('Request not found.');
                    navigate('/manufacturer/dashboard', { replace: true });
                    return;
                } const requestData = requestSnap.data();

                // Only verify manufacturer ID if there is one set in the request
                // This allows all manufacturers to view requests even if assigned to another manufacturer
                // The user has already been verified as a manufacturer by the route guard
                if (requestData.manufacturerId && requestData.manufacturerId !== currentUser.uid) {
                    console.log(`Request is assigned to manufacturer ${requestData.manufacturerId} but current user is ${currentUser.uid}`);
                    console.log('Allowing access since user is a manufacturer');
                }

                // Format timestamps for display
                const formattedRequest = {
                    id: requestSnap.id,
                    ...requestData,
                    createdAt: requestData.createdAt?.toDate() || new Date(),
                    updatedAt: requestData.updatedAt?.toDate() || new Date(),
                    approvedAt: requestData.approvedAt?.toDate() || null,
                    rejectedAt: requestData.rejectedAt?.toDate() || null,
                    fundsTransferredAt: requestData.fundsTransferredAt?.toDate() || null,
                    deadline: requestData.deadline?.toDate() || null
                }; setRequest(formattedRequest);

                // If we already have estimates, initialize form fields
                if (requestData.manufacturingCostEstimate) {
                    setCostEstimate(requestData.manufacturingCostEstimate);
                    setRetailPriceSuggestion(requestData.retailPriceSuggestion || '');
                    setEstimateMessage(requestData.estimateMessage || '');
                }

                // If product ID exists, fetch product details
                if (requestData.productId) {
                    const productRef = doc(db, 'products', requestData.productId);
                    const productSnap = await getDoc(productRef);

                    if (productSnap.exists()) {
                        const productData = productSnap.data();

                        // Update the request with designer info from product if not already set
                        if (!formattedRequest.designerName || formattedRequest.designerName === 'Unknown Designer') {
                            setRequest(prev => ({
                                ...prev,
                                designerName: productData.designerName || 'Unknown Designer'
                            }));
                        }

                        // Handle various image formats from product data
                        const processedProductData = {
                            ...productData,
                            // If imageUrls is not available, try to use images or image
                            imageUrls: productData.imageUrls ||
                                (productData.images?.length ? productData.images :
                                    (productData.image ? [productData.image] : []))
                        };

                        setProduct({
                            id: productSnap.id,
                            ...processedProductData
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching request details:', error);
                showError('An error occurred while loading the request details.');
            } finally {
                setLoading(false);
            }
        };

        fetchRequestDetails();
    }, [requestId, currentUser?.uid, navigate, showError]);

    // Handle approving a request
    const handleApproveRequest = async () => {
        if (processingAction || !request || request.status !== 'pending') return;

        setProcessingAction(true);
        try {
            // Update the request status
            const requestRef = doc(db, 'manufacturerRequests', requestId);
            await updateDoc(requestRef, {
                status: 'approved',
                approvedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Create a notification for the designer
            await addDoc(collection(db, 'notifications'), {
                userId: request.designerId,
                title: 'Manufacturing Request Approved',
                message: `Your request for manufacturer approval of "${request.productName}" has been approved. You can now transfer funds for manufacturing.`,
                type: 'manufacturer_request_approved',
                productId: request.productId,
                read: false,
                createdAt: serverTimestamp()
            });

            // Update the local state
            setRequest({
                ...request,
                status: 'approved',
                approvedAt: new Date(),
                updatedAt: new Date()
            });

            showSuccess('Request approved successfully!');
        } catch (error) {
            console.error('Error approving request:', error);
            showError('Failed to approve request. Please try again.');
        } finally {
            setProcessingAction(false);
        }
    };

    // Handle rejecting a request
    const handleRejectRequest = async () => {
        if (processingAction || !request || request.status !== 'pending') return;

        setProcessingAction(true);
        try {
            // Update the request status
            const requestRef = doc(db, 'manufacturerRequests', requestId);
            await updateDoc(requestRef, {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Create a notification for the designer
            await addDoc(collection(db, 'notifications'), {
                userId: request.designerId,
                title: 'Manufacturing Request Rejected',
                message: `Your request for manufacturer approval of "${request.productName}" has been rejected. Please select another manufacturer.`,
                type: 'manufacturer_request_rejected',
                productId: request.productId,
                read: false,
                createdAt: serverTimestamp()
            });

            // Update the local state
            setRequest({
                ...request,
                status: 'rejected',
                rejectedAt: new Date(),
                updatedAt: new Date()
            });

            showSuccess('Request rejected successfully.');
        } catch (error) {
            console.error('Error rejecting request:', error);
            showError('Failed to reject request. Please try again.');
        } finally {
            setProcessingAction(false);
        }
    };

    // Format date for display
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };
    // Format currency for display
    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // Handle submitting cost estimate and retail price suggestion
    const handleSubmitEstimate = async () => {
        if (!request || !product || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Validate inputs
            const costValue = parseFloat(costEstimate);
            const priceValue = parseFloat(retailPriceSuggestion);

            if (isNaN(costValue) || costValue <= 0) {
                showError('Please enter a valid manufacturing cost estimate.');
                return;
            }

            if (retailPriceSuggestion && (isNaN(priceValue) || priceValue <= 0)) {
                showError('Please enter a valid retail price suggestion.');
                return;
            }

            // Update the request with the cost estimate and retail price suggestion
            const requestRef = doc(db, 'manufacturerRequests', requestId);
            await updateDoc(requestRef, {
                manufacturingCostEstimate: costValue,
                retailPriceSuggestion: priceValue || null,
                estimateMessage: estimateMessage || '',
                estimateProvidedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Create a notification for the designer
            await addDoc(collection(db, 'notifications'), {
                userId: request.designerId,
                title: 'Manufacturing Cost Estimate Received',
                message: `The manufacturer has provided a cost estimate of ${formatCurrency(costValue)} for "${request.productName}".`,
                type: 'manufacturer_cost_estimate',
                productId: request.productId,
                requestId: request.id,
                read: false,
                createdAt: serverTimestamp()
            });

            // Update the local state
            setRequest(prev => ({
                ...prev,
                manufacturingCostEstimate: costValue,
                retailPriceSuggestion: priceValue || null,
                estimateMessage: estimateMessage || '',
                estimateProvidedAt: new Date(),
                updatedAt: new Date()
            }));

            showSuccess('Cost estimate submitted successfully!');
        } catch (error) {
            console.error('Error submitting cost estimate:', error);
            showError('Failed to submit cost estimate. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Format currency for display

    // Get status badge class
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'approved': return 'status-approved';
            case 'rejected': return 'status-rejected';
            case 'completed': return 'status-completed';
            case 'in_progress': return 'status-in-progress';
            case 'cancelled': return 'status-cancelled';
            default: return 'status-pending';
        }
    };

    // Get readable status text
    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'Pending Approval';
            case 'approved': return 'Approved';
            case 'rejected': return 'Rejected';
            case 'completed': return 'Completed';
            case 'in_progress': return 'In Progress';
            case 'cancelled': return 'Cancelled';
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <LoadingSpinner />
                <p>Loading request details...</p>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="error-container">
                <h2>Request Not Found</h2>
                <p>The request you're looking for doesn't exist or you don't have permission to view it.</p>
                <button
                    onClick={() => navigate('/manufacturer/dashboard')}
                    className="mrdp-back-button"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="manufacturer-request-detail">
            <div className="page-header">
                <h1>Manufacturing Request Details</h1>
                <button
                    onClick={() => navigate('/manufacturer/dashboard')}
                    className="mrdp-back-button"
                >
                    Back to Dashboard
                </button>
            </div>

            <div className="request-status-card">
                <h3>Request Status</h3>
                <div className={`status-badge large ${getStatusBadgeClass(request.status)}`}>
                    {getStatusText(request.status)}
                </div>

                {request.status === 'pending' && (
                    <div className="request-actions">
                        <button
                            className="reject-button"
                            onClick={handleRejectRequest}
                            disabled={processingAction}
                        >
                            {processingAction ? 'Processing...' : 'Reject Request'}
                        </button>
                        <button
                            className="approve-button"
                            onClick={handleApproveRequest}
                            disabled={processingAction}
                        >
                            {processingAction ? 'Processing...' : 'Approve Request'}
                        </button>
                    </div>
                )}
            </div>      <div className="detail-card product-info-card">
                <h3>Product Information</h3>
                <div className="info-row">
                    <span className="label">Product Name:</span>
                    <span className="value">{request.productName || 'Unnamed Product'}</span>
                </div>

                {product && (
                    <>
                        <div className="info-row">
                            <span className="label">Description:</span>
                            <span className="value">{product.description || 'No description provided'}</span>
                        </div>

                        {/* Display product images in a carousel */}
                        {((product.imageUrls && product.imageUrls.length > 0) || (product.images && product.images.length > 0)) && (
                            <div className="product-images-container">
                                <h4>Product Images</h4>
                                <div className="image-carousel">
                                    {/* Main image display */}
                                    <div className="main-image-container">
                                        <img
                                            src={product.imageUrls?.[currentImageIndex] || product.images?.[currentImageIndex] || product.image || 'https://placehold.co/300x300?text=Product'}
                                            alt={`${product.name || 'Product'}`}
                                            className="main-product-image"
                                        />

                                        {/* Navigation arrows - only show when there are multiple images */}
                                        {(product.imageUrls?.length > 1 || product.images?.length > 1) && (
                                            <>
                                                <button
                                                    className="image-nav-button prev"
                                                    aria-label="Previous image"
                                                    onClick={() => {
                                                        const imageCount = product.imageUrls?.length || product.images?.length || 0;
                                                        const newIndex = currentImageIndex === 0 ? imageCount - 1 : currentImageIndex - 1;
                                                        setCurrentImageIndex(newIndex);
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="15 18 9 12 15 6"></polyline>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="image-nav-button next"
                                                    aria-label="Next image"
                                                    onClick={() => {
                                                        const imageCount = product.imageUrls?.length || product.images?.length || 0;
                                                        const newIndex = currentImageIndex === imageCount - 1 ? 0 : currentImageIndex + 1;
                                                        setCurrentImageIndex(newIndex);
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="9 18 15 12 9 6"></polyline>
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Thumbnail navigation */}
                                    {(product.imageUrls?.length > 1 || product.images?.length > 1) && (
                                        <div className="image-thumbnails">
                                            {(product.imageUrls || product.images || []).map((url, index) => (
                                                <div
                                                    key={index}
                                                    className={`image-thumbnail ${currentImageIndex === index ? 'active' : ''}`}
                                                    onClick={() => setCurrentImageIndex(index)}
                                                >
                                                    <img
                                                        src={url}
                                                        alt={`Thumbnail ${index + 1}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="info-row">
                            <span className="label">Current Manufacturing Cost:</span>
                            <span className="value">{formatCurrency(product.manufacturingCost || 0)}</span>
                        </div>

                        <div className="info-row">
                            <span className="label">Current Retail Price:</span>
                            <span className="value">{formatCurrency(product.price || 0)}</span>
                        </div>

                        <div className="info-row">
                            <span className="label">Funding Goal:</span>
                            <span className="value">{formatCurrency(product.fundingGoal || 0)}</span>
                        </div>

                        <div className="info-row">
                            <span className="label">Current Funding:</span>
                            <span className="value">{formatCurrency(product.currentFunding || 0)}</span>
                        </div>

                        <div className="info-row">
                            <span className="label">Fully Funded:</span>
                            <span className="value">
                                {product.fundingGoal && product.currentFunding >= product.fundingGoal ? 'Yes' : 'No'}
                            </span>
                        </div>

                        {/* Manufacturing Cost Estimate Form */}
                        <div className="cost-estimate-section">
                            <h4>Provide Manufacturing Cost Estimate</h4>
                            {request.manufacturingCostEstimate ? (
                                <div className="current-estimate">
                                    <p>You have provided an estimate of {formatCurrency(request.manufacturingCostEstimate)} on {formatDate(request.estimateProvidedAt)}.</p>
                                    <p>{request.retailPriceSuggestion ? `Suggested retail price: ${formatCurrency(request.retailPriceSuggestion)}` : ''}</p>
                                    {request.estimateMessage && (
                                        <div className="estimate-message">
                                            <p><strong>Your message:</strong></p>
                                            <p>{request.estimateMessage}</p>
                                        </div>
                                    )}
                                    <button
                                        className="update-estimate-button"
                                        onClick={() => {
                                            setCostEstimate(request.manufacturingCostEstimate);
                                            setRetailPriceSuggestion(request.retailPriceSuggestion || '');
                                            setEstimateMessage(request.estimateMessage || '');
                                        }}
                                    >
                                        Update Estimate
                                    </button>
                                </div>
                            ) : (<div className="estimate-form">
                                <div className="form-group">
                                    <label htmlFor="costEstimate">Manufacturing Cost Estimate ($)*</label>
                                    <input
                                        id="costEstimate"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={costEstimate}
                                        onChange={(e) => setCostEstimate(e.target.value)}
                                        placeholder="Enter cost estimate"
                                        required
                                    />
                                    <small>This estimate will help the designer update their manufacturing cost in the product details.</small>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="retailPrice">Suggested Retail Price ($)</label>
                                    <input
                                        id="retailPrice"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={retailPriceSuggestion}
                                        onChange={(e) => setRetailPriceSuggestion(e.target.value)}
                                        placeholder="Suggest a retail price (optional)"
                                    />
                                    <small>This is a recommendation for the designer to consider.</small>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="estimateMessage">Message to Designer (optional)</label>
                                    <textarea
                                        id="estimateMessage"
                                        value={estimateMessage}
                                        onChange={(e) => setEstimateMessage(e.target.value)}
                                        placeholder="Add any notes or explanations about your estimate"
                                        rows="3"
                                    ></textarea>
                                </div>

                                <button
                                    className="submit-estimate-button"
                                    onClick={handleSubmitEstimate}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Estimate'}
                                </button>
                            </div>
                            )}
                        </div>
                    </>
                )}
            </div>      <div className="detail-card designer-info-card">
                <h3>Designer Information</h3>
                <div className="info-row">
                    <span className="label">Designer Name:</span>
                    <span className="value">{request.designerName || product?.designerName || 'Unknown'}</span>
                </div>
                <div className="info-row">
                    <span className="label">Designer Email:</span>
                    <span className="value">{request.designerEmail || product?.designerEmail || 'Not provided'}</span>
                </div>
            </div>      <div className="detail-card request-info-card">
                <h3>Request Details</h3>
                <div className="info-row">
                    <span className="label">Request ID:</span>
                    <span className="value">{request.id}</span>
                </div>
                <div className="info-row">
                    <span className="label">Requested On:</span>
                    <span className="value">{formatDate(request.createdAt)}</span>
                </div>
                {request.deadline && (
                    <div className="info-row">
                        <span className="label">Deadline:</span>
                        <span className="value">{formatDate(request.deadline)}</span>
                    </div>
                )}
                <div className="info-row">
                    <span className="label">Original Budget:</span>
                    <span className="value">{formatCurrency(request.budget || 0)}</span>
                </div>
                {product && (
                    <div className="info-row">
                        <span className="label">Available Budget (Current Funding):</span>
                        <span className="value">{formatCurrency(product.currentFunding || request.budget || 0)}</span>
                    </div>
                )}
                {request.message && (
                    <div className="info-row">
                        <span className="label">Designer's Message:</span>
                        <div className="request-message">{request.message}</div>
                    </div>
                )}
                {request.approvedAt && (
                    <div className="info-row">
                        <span className="label">Approved On:</span>
                        <span className="value">{formatDate(request.approvedAt)}</span>
                    </div>
                )}
                {request.rejectedAt && (
                    <div className="info-row">
                        <span className="label">Rejected On:</span>
                        <span className="value">{formatDate(request.rejectedAt)}</span>
                    </div>
                )}
                {request.fundsTransferredAt && (
                    <div className="info-row">
                        <span className="label">Funds Transferred On:</span>
                        <span className="value">{formatDate(request.fundsTransferredAt)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManufacturerRequestDetailPage;
