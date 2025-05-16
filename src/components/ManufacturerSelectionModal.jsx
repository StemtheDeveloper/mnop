import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import walletService from '../services/walletService';
import verificationService from '../services/verificationService';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';


/**
 * Custom confirmation modal component
 */
const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    amount,
    showWarning,
    warningMessage
}) => {
    if (!isOpen) return null;

    return (
        <div className="confirmation-overlay" onClick={onClose}>
            <div className="confirmation-modal" onClick={e => e.stopPropagation()}>
                <div className="confirmation-modal-header">
                    <h3>{title}</h3>
                </div>
                <div className="confirmation-modal-body">
                    {showWarning && (
                        <div className="confirmation-modal-warning">
                            <strong>Warning</strong>
                            <p>{warningMessage}</p>
                        </div>
                    )}
                    <div className="confirmation-modal-message">
                        {message}
                    </div>
                    {amount && (
                        <div className="confirmation-modal-amount">
                            ${amount.toLocaleString()}
                        </div>
                    )}
                </div>
                <div className="confirmation-modal-footer">
                    <button className="confirmation-modal-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={`confirmation-modal-confirm ${showWarning ? 'confirmation-modal-warning-confirm' : ''}`}
                        onClick={onConfirm}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Modal component for selecting a manufacturer and transferring funds
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when closing the modal
 * @param {Object} props.product - Product data for which to select a manufacturer
 * @param {Function} props.onSuccess - Function to call after successful transfer
 * @param {boolean} props.preSelection - Whether this is for pre-selecting a manufacturer (no fund transfer)
 */
const ManufacturerSelectionModal = ({ isOpen, onClose, product, onSuccess, preSelection = false }) => {
    const { currentUser } = useUser();
    const [manufacturers, setManufacturers] = useState([]);
    const [selectedManufacturer, setSelectedManufacturer] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingManufacturers, setLoadingManufacturers] = useState(false);

    // For custom confirmation dialog
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationType, setConfirmationType] = useState('');
    const [confirmationDetails, setConfirmationDetails] = useState({});

    // Check if user is the designer of this product
    const isDesigner = currentUser && product && currentUser.uid === product.designerId;

    // Check if product is fully funded
    const isFullyFunded = product && product.currentFunding >= product.fundingGoal;

    // Get business held funds amount
    const businessHeldFunds = product?.businessHeldFunds || 0;

    // Load manufacturers (both verified and unverified) when the modal opens
    useEffect(() => {
        if (isOpen && isDesigner) {
            fetchManufacturers();
        }
    }, [isOpen, isDesigner]);

    // Handle change in manufacturer selection
    useEffect(() => {
        if (selectedManufacturer) {
            const selectedMfr = manufacturers.find(m => m.id === selectedManufacturer);
            setShowWarning(selectedMfr && !selectedMfr.verified);
        } else {
            setShowWarning(false);
        }
    }, [selectedManufacturer, manufacturers]);

    // Fetch list of all manufacturers (both verified and unverified)
    const fetchManufacturers = async () => {
        setLoadingManufacturers(true);
        setError('');

        try {
            // Use verification service to get all manufacturers
            const allManufacturers = await verificationService.getAllManufacturers();

            if (allManufacturers.length === 0) {
                setError('No manufacturers found. Please contact support for assistance.');
            }

            setManufacturers(allManufacturers);
        } catch (err) {
            console.error('Error loading manufacturers:', err);
            setError('Failed to load manufacturers. Please try again.');
        } finally {
            setLoadingManufacturers(false);
        }
    };

    // Show confirmation modal with appropriate message
    const showConfirmationDialog = (type) => {
        const selectedMfr = manufacturers.find(m => m.id === selectedManufacturer);
        if (type === 'unverified-preselection') {
            setConfirmationDetails({
                title: 'Confirm Unverified Manufacturer Selection',
                message: 'You have selected an unverified manufacturer. This manufacturer has not been vetted by our team and may pose risks. Are you sure you want to continue?',
                showWarning: true,
                warningMessage: 'Unverified manufacturers have not been vetted by our team.'
            });
        } else if (type === 'unverified-transfer') {
            setConfirmationDetails({
                title: 'Confirm Funds Transfer to Unverified Manufacturer',
                message: 'You have selected an unverified manufacturer. This manufacturer has not been vetted by our team and may pose risks. Funds will be transferred immediately and cannot be recovered.',
                showWarning: true,
                warningMessage: 'Transferring funds to unverified manufacturers carries additional risks.'
            });
        } else if (type === 'transfer-confirmation') {
            setConfirmationDetails({
                title: 'Confirm Funds Transfer',
                message: `Are you sure you want to transfer the following amount to ${selectedMfr?.displayName || selectedMfr?.email || 'the selected manufacturer'}?`,
                amount: product.businessHeldFunds,
                showWarning: false
            });
        }
        setConfirmationType(type);
        setShowConfirmation(true);
    };

    // Handle confirmation dialog result
    const handleConfirmation = async () => {
        setShowConfirmation(false);

        // Process based on confirmation type
        if (confirmationType === 'unverified-preselection' || confirmationType === 'preselection') {
            await processPreselection();
        } else if (confirmationType === 'unverified-transfer' || confirmationType === 'transfer-confirmation') {
            await processFundsTransfer();
        }
    };

    // Process manufacturer preselection
    const processPreselection = async () => {
        setLoading(true);
        setError('');

        try {
            // Update the product with the pre-selected manufacturer ID
            const { updateDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');

            // Get the selected manufacturer
            const manufacturer = manufacturers.find(m => m.id === selectedManufacturer);
            if (!manufacturer) {
                throw new Error('Selected manufacturer not found');
            }

            // Update the product document with the pre-selected manufacturer
            await updateDoc(doc(db, 'products', product.id), {
                preSelectedManufacturerId: selectedManufacturer,
                preSelectedManufacturerName: manufacturer.displayName || manufacturer.email,
                preSelectedManufacturerVerified: manufacturer.verified || false,
                manufacturerNote: note,
                updatedAt: new Date()
            });

            setSuccess(`Successfully selected ${manufacturer.displayName || manufacturer.email} as the preferred manufacturer for this product`);

            // Call onSuccess callback if provided
            if (onSuccess) {
                onSuccess({
                    success: true,
                    manufacturerId: selectedManufacturer,
                    manufacturerName: manufacturer.displayName || manufacturer.email
                });
            }

            // Auto close after success
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error('Error selecting manufacturer:', err);
            setError(err.message || 'An error occurred while selecting the manufacturer');
        } finally {
            setLoading(false);
        }
    };

    // Process funds transfer to manufacturer
    const processFundsTransfer = async () => {
        setLoading(true);
        setError('');

        try {
            // Get the email of the selected manufacturer
            const manufacturer = manufacturers.find(m => m.id === selectedManufacturer);
            if (!manufacturer) {
                throw new Error('Selected manufacturer not found');
            }

            // Call the wallet service to transfer funds
            const result = await walletService.transferProductFundsToManufacturer(
                currentUser.uid,
                product.id,
                manufacturer.email,
                note
            );

            if (result.success) {
                setSuccess(`Successfully transferred ${result.amount?.toLocaleString()} credits to ${manufacturer.displayName || manufacturer.email}`);

                // Call onSuccess callback if provided
                if (onSuccess) {
                    onSuccess(result);
                }

                // Auto close after success
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setError(result.error || 'Failed to transfer funds. Please try again.');
            }
        } catch (err) {
            console.error('Error transferring funds:', err);
            setError(err.message || 'An error occurred while transferring funds');
        } finally {
            setLoading(false);
        }
    };

    // Handle form submission for pre-selection (no fund transfer)
    const handlePreSelect = (e) => {
        e.preventDefault();

        // Reset status
        setError('');
        setSuccess('');

        // Validate input
        if (!selectedManufacturer) {
            setError('Please select a manufacturer');
            return;
        }

        // If the selected manufacturer is not verified, show confirmation dialog
        const selectedMfr = manufacturers.find(m => m.id === selectedManufacturer);
        if (selectedMfr && !selectedMfr.verified) {
            showConfirmationDialog('unverified-preselection');
        } else {
            showConfirmationDialog('preselection');
        }
    };

    // Handle form submission for transferring funds
    const handleTransferFunds = (e) => {
        e.preventDefault();

        // Reset status
        setError('');
        setSuccess('');

        // Validate input
        if (!selectedManufacturer) {
            setError('Please select a manufacturer');
            return;
        }

        // If the selected manufacturer is not verified, show confirmation dialog with warning
        const selectedMfr = manufacturers.find(m => m.id === selectedManufacturer);
        if (selectedMfr && !selectedMfr.verified) {
            showConfirmationDialog('unverified-transfer');
        } else {
            // For verified manufacturers, still show confirmation dialog but without warning
            showConfirmationDialog('transfer-confirmation');
        }
    };

    // If modal is not open, don't render anything
    if (!isOpen) return null;

    // If user is not the designer, show an error
    if (!isDesigner) {
        return (
            <Modal title="Manufacturer Selection" onClose={onClose}>
                <div className="manufacturer-error">
                    <p>Only the product designer can select a manufacturer and transfer funds.</p>
                </div>
            </Modal>
        );
    }

    // If this is for fund transfer and product isn't fully funded, show an error
    if (!preSelection && !isFullyFunded) {
        return (
            <Modal title="Manufacturer Selection" onClose={onClose}>
                <div className="manufacturer-error">
                    <p>This product must be fully funded before transferring to a manufacturer.</p>
                    <p>Current funding: ${product.currentFunding?.toLocaleString()} / ${product.fundingGoal?.toLocaleString()}</p>
                </div>
            </Modal>
        );
    }

    return (
        <>
            <Modal title={preSelection ? "Pre-select Manufacturer" : "Select Manufacturer and Transfer Funds"} onClose={onClose}>
                <div className="manufacturer-selection-container">
                    <div className="product-funding-info">
                        <h3>{product.name}</h3>
                        {!preSelection && (
                            <p>Available Funds: <strong>${businessHeldFunds.toLocaleString()}</strong></p>
                        )}
                        {preSelection ? (
                            <p>Pre-selecting a manufacturer allows you to prepare for production before your product is fully funded.</p>
                        ) : (
                            <p>Once you transfer funds to a manufacturer, the manufacturing process will begin.</p>
                        )}
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    {loading ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>{preSelection ? 'Saving manufacturer selection...' : 'Processing fund transfer...'}</p>
                        </div>
                    ) : loadingManufacturers ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>Loading manufacturers...</p>
                        </div>
                    ) : (
                        <form onSubmit={preSelection ? handlePreSelect : handleTransferFunds}>
                            <div className="form-group">
                                <label htmlFor="manufacturer-select">Select a Manufacturer:</label>
                                <select
                                    id="manufacturer-select"
                                    value={selectedManufacturer}
                                    onChange={(e) => setSelectedManufacturer(e.target.value)}
                                    required
                                    className={showWarning ? 'unverified-selection' : ''}
                                >
                                    <option value="">-- Select a manufacturer --</option>
                                    {manufacturers.map(manufacturer => (
                                        <option key={manufacturer.id} value={manufacturer.id}>
                                            {manufacturer.displayName || manufacturer.email} {manufacturer.verified ? "✓" : "(Unverified)"}
                                        </option>
                                    ))}
                                </select>
                                <p className="verification-note">
                                    Manufacturers marked with ✓ have been verified by our team. Unverified manufacturers have not been vetted.
                                </p>

                                {showWarning && (
                                    <div className="verification-warning">
                                        <strong>Warning:</strong> You have selected an unverified manufacturer. Unverified manufacturers have not been vetted by our team.
                                        {!preSelection && ' Transferring funds to unverified manufacturers carries additional risks.'}
                                        <p>We recommend working with verified manufacturers for greater security.</p>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="note-input">Note (Optional):</label>
                                <textarea
                                    id="note-input"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Add a note for the manufacturer..."
                                    rows={3}
                                />
                            </div>

                            <div className="manufacturer-info">
                                <h4>Important Information:</h4>
                                <ul>
                                    {preSelection ? (
                                        <>
                                            <li>Your preferred manufacturer will be notified of your interest.</li>
                                            <li>No funds will be transferred until the product is fully funded.</li>
                                            <li>You can change your preferred manufacturer at any time before funds are transferred.</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>Funds will be transferred immediately to the selected manufacturer.</li>
                                            <li>All investors will be notified that manufacturing has begun.</li>
                                            <li>You will be able to track the manufacturing progress in your dashboard.</li>
                                        </>
                                    )}
                                </ul>
                            </div>

                            <button
                                type="submit"
                                className="transfer-button"
                                disabled={!selectedManufacturer || loading}
                            >
                                {preSelection ? 'Save Manufacturer Selection' : 'Transfer Funds to Manufacturer'}
                            </button>
                        </form>
                    )}
                </div>
            </Modal>

            {/* Custom Confirmation Modal */}
            <ConfirmationModal
                isOpen={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={handleConfirmation}
                title={confirmationDetails.title}
                message={confirmationDetails.message}
                amount={confirmationDetails.amount}
                showWarning={confirmationDetails.showWarning}
                warningMessage={confirmationDetails.warningMessage}
            />
        </>
    );
};

export default ManufacturerSelectionModal;