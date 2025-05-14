import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import verificationService from '../services/verificationService';
import '../styles/VerificationRequestPage.css';

const VerificationRequestPage = () => {
    const { role } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useUser();
    const { success: showSuccess, error: showError } = useToast();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [formData, setFormData] = useState({
        businessName: '',
        businessAddress: '',
        businessWebsite: '',
        yearsInBusiness: '',
        businessDescription: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        references: '',
        additionalInfo: ''
    });

    // Validate that role is one of the allowed types
    useEffect(() => {
        if (!['manufacturer', 'designer'].includes(role)) {
            setError('Invalid role type. Please select either manufacturer or designer.');
        } else {
            setError(null);
            checkExistingVerification();
        }
    }, [role]);

    const checkExistingVerification = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            const status = await verificationService.getUserVerificationStatus(currentUser.uid);

            // If user is already verified for this role
            if ((role === 'manufacturer' && status.manufacturerVerified) ||
                (role === 'designer' && status.designerVerified)) {
                setError(`You are already verified as a ${role}.`);
            }
            // If user has a pending verification request
            else if (status.pendingVerification && status.pendingVerification.includes(role)) {
                setError(`You already have a pending verification request for ${role}. Please wait for admin review.`);
            }
            // If user doesn't have the role they're trying to get verified for
            else if (!status.roles.includes(role)) {
                setError(`You must have the ${role} role before requesting verification. Please update your profile first.`);
            }
        } catch (err) {
            console.error("Error checking verification status:", err);
            setError(`Failed to check verification status: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Require business name and contact info
        if (!formData.businessName || !formData.contactName || !formData.contactEmail) {
            setError('Please provide your business name and contact information.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await verificationService.submitVerificationRequest(
                currentUser.uid,
                role,
                formData
            );

            if (result.success) {
                setSuccess(result.message);
                // Clear form after successful submission
                setFormData({
                    businessName: '',
                    businessAddress: '',
                    businessWebsite: '',
                    yearsInBusiness: '',
                    businessDescription: '',
                    contactName: '',
                    contactPhone: '',
                    contactEmail: '',
                    references: '',
                    additionalInfo: ''
                });
                // Show toast notification
                showSuccess(result.message);

                // Redirect after a delay
                setTimeout(() => {
                    navigate('/profile');
                }, 3000);
            } else {
                setError(result.error || 'Failed to submit verification request');
                showError(result.error || 'Failed to submit verification request');
            }
        } catch (err) {
            console.error("Error submitting verification request:", err);
            setError(`Failed to submit request: ${err.message}`);
            showError(`Failed to submit request: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="verification-request-page">
                <div className="verification-request-container">
                    <LoadingSpinner />
                    <p>Checking verification status...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="verification-request-page">
            <div className="verification-request-container">
                <h1>{role.charAt(0).toUpperCase() + role.slice(1)} Verification Request</h1>
                <p className="verification-info">
                    To ensure quality and trust on our platform, we verify all {role}s.
                    Please provide your business information below.
                </p>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                {!error && !success && (
                    <form onSubmit={handleSubmit} className="verification-form">
                        <div className="form-section">
                            <h2>Business Information</h2>

                            <div className="form-group">
                                <label htmlFor="businessName">Business Name *</label>
                                <input
                                    type="text"
                                    id="businessName"
                                    name="businessName"
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="businessAddress">Business Address</label>
                                <input
                                    type="text"
                                    id="businessAddress"
                                    name="businessAddress"
                                    value={formData.businessAddress}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="businessWebsite">Business Website</label>
                                <input
                                    type="url"
                                    id="businessWebsite"
                                    name="businessWebsite"
                                    value={formData.businessWebsite}
                                    onChange={handleChange}
                                    placeholder="https://example.com"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="yearsInBusiness">Years in Business</label>
                                <input
                                    type="number"
                                    id="yearsInBusiness"
                                    name="yearsInBusiness"
                                    value={formData.yearsInBusiness}
                                    onChange={handleChange}
                                    min="0"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="businessDescription">Business Description</label>
                                <textarea
                                    id="businessDescription"
                                    name="businessDescription"
                                    value={formData.businessDescription}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Please describe your business, experience, and the services you offer..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="form-section">
                            <h2>Contact Information</h2>

                            <div className="form-group">
                                <label htmlFor="contactName">Contact Name *</label>
                                <input
                                    type="text"
                                    id="contactName"
                                    name="contactName"
                                    value={formData.contactName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="contactPhone">Contact Phone</label>
                                <input
                                    type="tel"
                                    id="contactPhone"
                                    name="contactPhone"
                                    value={formData.contactPhone}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="contactEmail">Contact Email *</label>
                                <input
                                    type="email"
                                    id="contactEmail"
                                    name="contactEmail"
                                    value={formData.contactEmail}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-section">
                            <h2>Additional Information</h2>

                            <div className="form-group">
                                <label htmlFor="references">References (Optional)</label>
                                <textarea
                                    id="references"
                                    name="references"
                                    value={formData.references}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="List any references or existing clients that can vouch for your work..."
                                ></textarea>
                            </div>

                            <div className="form-group">
                                <label htmlFor="additionalInfo">Additional Information (Optional)</label>
                                <textarea
                                    id="additionalInfo"
                                    name="additionalInfo"
                                    value={formData.additionalInfo}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Any other information that might help us with your verification..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="submit-button"
                                disabled={submitting}
                            >
                                {submitting ? 'Submitting...' : 'Submit Verification Request'}
                            </button>
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={() => navigate('/profile')}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {success && (
                    <div className="next-steps">
                        <p>Your request has been submitted and will be reviewed by our team.</p>
                        <p>You will receive a notification once your verification status is updated.</p>
                        <button
                            className="return-button"
                            onClick={() => navigate('/profile')}
                        >
                            Return to Profile
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerificationRequestPage;