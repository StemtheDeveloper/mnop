import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import '../../styles/ManufacturerRequests.css';

/**
 * Component to display and manage incoming manufacturer requests
 */
const ManufacturerRequestsList = () => {
    const { currentUser, hasRole } = useUser();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [processingId, setProcessingId] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });    // Fetch all pending manufacturer requests for this manufacturer
    useEffect(() => {
        const fetchRequests = async () => {
            if (!currentUser?.uid || !hasRole('manufacturer')) {
                setLoading(false);
                setMessage({ type: 'warning', text: 'You must have manufacturer permissions to view requests.' });
                return;
            }

            setLoading(true);
            try {
                const requestsRef = collection(db, 'manufacturerRequests');
                const q = query(
                    requestsRef,
                    where('manufacturerId', '==', currentUser.uid),
                    where('status', '==', 'pending')
                );

                const snapshot = await getDocs(q);
                const requestsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));                // Fetch product details for each request
                const enhancedRequests = await Promise.all(
                    requestsData.map(async (request) => {
                        try {
                            const productRef = doc(db, 'products', request.productId);
                            const productSnap = await getDoc(productRef);

                            if (productSnap.exists()) {
                                const productData = productSnap.data();
                                return {
                                    ...request,
                                    budget: request.budget || productData.fundingGoal || 0,
                                    designerName: request.designerName || productData.designerName || 'Unknown Designer',
                                    product: {
                                        id: productSnap.id,
                                        ...productData
                                    }
                                };
                            }
                            return request;
                        } catch (error) {
                            console.error(`Error fetching product details for request ${request.id}:`, error);
                            return request;
                        }
                    })
                );

                setRequests(enhancedRequests);
            } catch (error) {
                console.error('Error fetching manufacturer requests:', error);
                setMessage({ type: 'error', text: 'Failed to load manufacturer requests.' });
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [currentUser?.uid]);

    // Handle approving a manufacturing request
    const handleApproveRequest = async (requestId) => {
        if (processingId) return;

        setProcessingId(requestId);
        setMessage({ type: '', text: '' });

        try {
            const request = requests.find(r => r.id === requestId);
            if (!request) {
                throw new Error('Request not found');
            }

            // Update the request status to approved
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

            // Update local state
            setRequests(prevRequests =>
                prevRequests.map(r =>
                    r.id === requestId
                        ? { ...r, status: 'approved', approvedAt: new Date() }
                        : r
                )
            );

            setMessage({
                type: 'success',
                text: `Successfully approved manufacturing request for ${request.productName}.`
            });

            // If this was the selected request, update it
            if (selectedRequest && selectedRequest.id === requestId) {
                setSelectedRequest({ ...selectedRequest, status: 'approved', approvedAt: new Date() });
            }
        } catch (error) {
            console.error('Error approving request:', error);
            setMessage({ type: 'error', text: 'Failed to approve request. Please try again.' });
        } finally {
            setProcessingId(null);
        }
    };

    // Handle rejecting a manufacturing request
    const handleRejectRequest = async (requestId) => {
        if (processingId) return;

        setProcessingId(requestId);
        setMessage({ type: '', text: '' });

        try {
            const request = requests.find(r => r.id === requestId);
            if (!request) {
                throw new Error('Request not found');
            }

            // Update the request status to rejected
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

            // Update local state
            setRequests(prevRequests =>
                prevRequests.map(r =>
                    r.id === requestId
                        ? { ...r, status: 'rejected', rejectedAt: new Date() }
                        : r
                )
            );

            setMessage({
                type: 'success',
                text: `Successfully rejected manufacturing request for ${request.productName}.`
            });

            // If this was the selected request, update it
            if (selectedRequest && selectedRequest.id === requestId) {
                setSelectedRequest({ ...selectedRequest, status: 'rejected', rejectedAt: new Date() });
            }
        } catch (error) {
            console.error('Error rejecting request:', error);
            setMessage({ type: 'error', text: 'Failed to reject request. Please try again.' });
        } finally {
            setProcessingId(null);
        }
    };

    // Format date for display
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    // Format currency for display
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (requests.length === 0) {
        return (
            <div className="empty-requests-state">
                <h3>No Pending Requests</h3>
                <p>You don't have any pending manufacturing requests at this time.</p>
            </div>
        );
    }

    return (
        <div className="manufacturer-requests">
            <h3>Manufacturing Requests</h3>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="requests-container">
                <div className="requests-list">
                    {requests.map(request => (
                        <div
                            key={request.id}
                            className={`request-item ${selectedRequest && selectedRequest.id === request.id ? 'selected' : ''}`}
                            onClick={() => setSelectedRequest(request)}
                        >
                            <div className="request-header">
                                <h4>{request.productName || 'Unnamed Product'}</h4>
                                <span className="request-date">{formatDate(request.createdAt)}</span>
                            </div>                            <div className="request-designer">
                                From: {request.designerName || request.product?.designerName || request.designerEmail || 'Unknown Designer'}
                            </div>
                            {request.isFullyFunded && (
                                <div className="funding-status fully-funded">
                                    Fully Funded: {formatCurrency(request.fundingAmount)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {selectedRequest && (
                    <div className="request-details">
                        <h3>Request Details</h3>

                        <div className="product-info">
                            <div className="product-header">
                                <h4>{selectedRequest.productName}</h4>
                                {selectedRequest.product?.imageUrl && (
                                    <div className="product-image">
                                        <img
                                            src={selectedRequest.product.imageUrl}
                                            alt={selectedRequest.productName}
                                        />
                                    </div>
                                )}
                            </div>                            <div className="request-info-item">                                <label>Designer:</label>
                                <div>{selectedRequest.designerName || selectedRequest.product?.designerName || selectedRequest.designerEmail || 'Unknown Designer'}</div>
                            </div>

                            <div className="request-info-item">
                                <label>Requested On:</label>
                                <div>{formatDate(selectedRequest.createdAt)}</div>
                            </div>

                            {(selectedRequest.budget || selectedRequest.fundingAmount) && (
                                <div className="request-info-item">
                                    <label>Budget/Funding Amount:</label>
                                    <div className="funding-amount">{formatCurrency(selectedRequest.budget || selectedRequest.fundingAmount)}</div>
                                </div>
                            )}

                            {selectedRequest.product?.description && (
                                <div className="request-info-item">
                                    <label>Product Description:</label>
                                    <div className="product-description">{selectedRequest.product.description}</div>
                                </div>
                            )}                            <div className="request-actions">
                                <button
                                    className="reject-button"
                                    onClick={() => handleRejectRequest(selectedRequest.id)}
                                    disabled={processingId === selectedRequest.id}
                                >
                                    {processingId === selectedRequest.id ? 'Processing...' : 'Reject Request'}
                                </button>
                                <button
                                    className="approve-button"
                                    onClick={() => handleApproveRequest(selectedRequest.id)}
                                    disabled={processingId === selectedRequest.id}
                                >
                                    {processingId === selectedRequest.id ? 'Processing...' : 'Approve Request'}
                                </button>
                                <button
                                    className="view-details-button"
                                    onClick={() => navigate(`/manufacturer/requests/${selectedRequest.id}`)}
                                >
                                    View Full Details
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManufacturerRequestsList;
