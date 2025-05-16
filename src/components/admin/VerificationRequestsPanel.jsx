import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../contexts/ToastContext';
import verificationService from '../../services/verificationService';
import LoadingSpinner from '../LoadingSpinner';


const VerificationRequestsPanel = () => {
    const navigate = useNavigate();
    const { currentUser, hasRole } = useUser();
    const { success: showSuccess, error: showError } = useToast();

    // State variables
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);

    // Stats for dashboard
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0
    });

    // Load verification requests on component mount and when tab changes
    useEffect(() => {
        fetchRequests();
    }, [activeTab]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const pendingRequests = await verificationService.getVerificationRequests('pending');
            const approvedRequests = await verificationService.getVerificationRequests('approved');
            const rejectedRequests = await verificationService.getVerificationRequests('rejected');

            // Update stats
            setStats({
                pending: pendingRequests.length,
                approved: approvedRequests.length,
                rejected: rejectedRequests.length
            });

            // Set the requests based on active tab
            switch (activeTab) {
                case 'pending':
                    setRequests(pendingRequests);
                    break;
                case 'approved':
                    setRequests(approvedRequests);
                    break;
                case 'rejected':
                    setRequests(rejectedRequests);
                    break;
                default:
                    setRequests(pendingRequests);
            }
        } catch (error) {
            console.error('Error fetching verification requests:', error);
            showError('Failed to load verification requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId) => {
        setProcessingAction(true);
        try {
            const result = await verificationService.approveVerificationRequest(requestId);
            if (result.success) {
                showSuccess(result.message);
                // Remove the approved request from the list
                setRequests(prev => prev.filter(request => request.id !== requestId));
                // Update stats
                setStats(prev => ({
                    ...prev,
                    pending: prev.pending - 1,
                    approved: prev.approved + 1
                }));
            } else {
                showError(result.error || 'Failed to approve verification request');
            }
        } catch (error) {
            console.error('Error approving verification request:', error);
            showError('An error occurred while approving the request');
        } finally {
            setProcessingAction(false);
        }
    };

    const openRejectionModal = (request) => {
        setSelectedRequest(request);
        setRejectionReason('');
        setShowRejectionModal(true);
    };

    const handleReject = async () => {
        if (!selectedRequest) return;

        if (!rejectionReason.trim()) {
            showError('Please provide a reason for rejection');
            return;
        }

        setProcessingAction(true);
        try {
            const result = await verificationService.rejectVerificationRequest(selectedRequest.id, rejectionReason);
            if (result.success) {
                showSuccess(result.message);
                // Remove the rejected request from the list
                setRequests(prev => prev.filter(request => request.id !== selectedRequest.id));
                // Update stats
                setStats(prev => ({
                    ...prev,
                    pending: prev.pending - 1,
                    rejected: prev.rejected + 1
                }));
                // Close the modal
                setShowRejectionModal(false);
                setSelectedRequest(null);
            } else {
                showError(result.error || 'Failed to reject verification request');
            }
        } catch (error) {
            console.error('Error rejecting verification request:', error);
            showError('An error occurred while rejecting the request');
        } finally {
            setProcessingAction(false);
        }
    };

    const viewUserProfile = (userId) => {
        navigate(`/user/${userId}`);
    };

    // Format date for display
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Check if user has admin role
    if (!hasRole('admin')) {
        return (
            <div className="verification-requests-panel">
                <div className="panel-header">
                    <h3>Verification Requests</h3>
                </div>
                <div className="access-denied">
                    <h4>Access Denied</h4>
                    <p>You need administrator privileges to access this panel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="verification-requests-panel">
            <div className="panel-header">
                <h3>Verification Requests</h3>
                <p className="panel-description">
                    Manage user verification requests for designers and manufacturers
                </p>
            </div>

            <div className="verification-stats">
                <div className="stat-card">
                    <div className="stat-value">{stats.pending}</div>
                    <div className="stat-label">Pending</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.approved}</div>
                    <div className="stat-label">Approved</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.rejected}</div>
                    <div className="stat-label">Rejected</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.pending + stats.approved + stats.rejected}</div>
                    <div className="stat-label">Total</div>
                </div>
            </div>

            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                >
                    Pending Requests
                    {stats.pending > 0 && <span className="count-badge">{stats.pending}</span>}
                </button>
                <button
                    className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
                    onClick={() => setActiveTab('approved')}
                >
                    Approved
                </button>
                <button
                    className={`tab-button ${activeTab === 'rejected' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rejected')}
                >
                    Rejected
                </button>
            </div>

            <div className="tab-content">
                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading verification requests...</p>
                    </div>
                ) : (
                    <>
                        {requests.length === 0 ? (
                            <div className="no-requests">
                                <p>No {activeTab} verification requests found.</p>
                            </div>
                        ) : (
                            <div className="requests-list">
                                {requests.map(request => (
                                    <div key={request.id} className="request-card">
                                        <div className="request-header">
                                            <div className="user-info">
                                                <div className="user-avatar">
                                                    {request.user.photoURL ? (
                                                        <img src={request.user.photoURL} alt={request.user.displayName} />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {request.user.displayName[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="user-details">
                                                    <h4 onClick={() => viewUserProfile(request.user.id)} className="user-name clickable">
                                                        {request.user.displayName}
                                                    </h4>
                                                    <span className="user-email">{request.user.email}</span>
                                                </div>
                                            </div>
                                            <div className="request-meta">
                                                <span className={`role-badge ${request.role}`}>
                                                    {request.role.charAt(0).toUpperCase() + request.role.slice(1)}
                                                </span>
                                                <span className="request-date">
                                                    Submitted: {formatDate(request.createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="request-content">
                                            <h4>Business Information</h4>
                                            <div className="business-details">
                                                <p><strong>Business Name:</strong> {request.businessInfo.businessName}</p>
                                                {request.businessInfo.businessAddress && (
                                                    <p><strong>Address:</strong> {request.businessInfo.businessAddress}</p>
                                                )}
                                                {request.businessInfo.businessWebsite && (
                                                    <p>
                                                        <strong>Website:</strong>
                                                        <a href={request.businessInfo.businessWebsite} target="_blank" rel="noopener noreferrer">
                                                            {request.businessInfo.businessWebsite}
                                                        </a>
                                                    </p>
                                                )}
                                                {request.businessInfo.yearsInBusiness && (
                                                    <p><strong>Years in Business:</strong> {request.businessInfo.yearsInBusiness}</p>
                                                )}
                                            </div>

                                            {request.businessInfo.businessDescription && (
                                                <div className="business-description">
                                                    <h5>Description</h5>
                                                    <p>{request.businessInfo.businessDescription}</p>
                                                </div>
                                            )}

                                            <div className="contact-details">
                                                <h5>Contact Information</h5>
                                                <p><strong>Name:</strong> {request.businessInfo.contactName}</p>
                                                {request.businessInfo.contactPhone && (
                                                    <p><strong>Phone:</strong> {request.businessInfo.contactPhone}</p>
                                                )}
                                                <p><strong>Email:</strong> {request.businessInfo.contactEmail}</p>
                                            </div>

                                            {request.businessInfo.references && (
                                                <div className="references">
                                                    <h5>References</h5>
                                                    <p>{request.businessInfo.references}</p>
                                                </div>
                                            )}

                                            {request.businessInfo.additionalInfo && (
                                                <div className="additional-info">
                                                    <h5>Additional Information</h5>
                                                    <p>{request.businessInfo.additionalInfo}</p>
                                                </div>
                                            )}

                                            {/* For rejected requests, show rejection reason */}
                                            {request.status === 'rejected' && request.rejectionReason && (
                                                <div className="rejection-reason">
                                                    <h5>Rejection Reason</h5>
                                                    <p>{request.rejectionReason}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions only for pending requests */}
                                        {activeTab === 'pending' && (
                                            <div className="request-actions">
                                                <button
                                                    className="approve-button"
                                                    onClick={() => handleApprove(request.id)}
                                                    disabled={processingAction}
                                                >
                                                    {processingAction ? 'Processing...' : 'Approve'}
                                                </button>
                                                <button
                                                    className="reject-button"
                                                    onClick={() => openRejectionModal(request)}
                                                    disabled={processingAction}
                                                >
                                                    {processingAction ? 'Processing...' : 'Reject'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Rejection Modal */}
            {showRejectionModal && selectedRequest && (
                <div className="modal-overlay">
                    <div className="rejection-modal">
                        <h3>Reject Verification Request</h3>
                        <p>Please provide a reason for rejecting this verification request from <strong>{selectedRequest.user.displayName}</strong>.</p>

                        <div className="form-group">
                            <label htmlFor="rejectionReason">Rejection Reason:</label>
                            <textarea
                                id="rejectionReason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Please provide specific feedback..."
                                rows="4"
                            ></textarea>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="confirm-button"
                                onClick={handleReject}
                                disabled={!rejectionReason.trim() || processingAction}
                            >
                                {processingAction ? 'Processing...' : 'Confirm Rejection'}
                            </button>
                            <button
                                className="cancel-button"
                                onClick={() => setShowRejectionModal(false)}
                                disabled={processingAction}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VerificationRequestsPanel;