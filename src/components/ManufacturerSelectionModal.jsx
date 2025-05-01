import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import walletService from '../services/walletService';
import verificationService from '../services/verificationService';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import '../styles/ManufacturerSelectionModal.css';

/**
 * Modal component for selecting a manufacturer and transferring funds
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when closing the modal
 * @param {Object} props.product - Product data for which to select a manufacturer
 * @param {Function} props.onSuccess - Function to call after successful transfer
 */
const ManufacturerSelectionModal = ({ isOpen, onClose, product, onSuccess }) => {
    const { currentUser } = useUser();
    const [manufacturers, setManufacturers] = useState([]);
    const [selectedManufacturer, setSelectedManufacturer] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingManufacturers, setLoadingManufacturers] = useState(false);

    // Check if user is the designer of this product
    const isDesigner = currentUser && product && currentUser.uid === product.designerId;

    // Check if product is fully funded
    const isFullyFunded = product && product.currentFunding >= product.fundingGoal;

    // Get business held funds amount
    const businessHeldFunds = product?.businessHeldFunds || 0;

    // Load verified manufacturers when the modal opens
    useEffect(() => {
        if (isOpen && isDesigner && isFullyFunded) {
            fetchManufacturers();
        }
    }, [isOpen, isDesigner, isFullyFunded]);

    // Fetch list of verified manufacturers
    const fetchManufacturers = async () => {
        setLoadingManufacturers(true);
        setError('');

        try {
            // Use verification service to get only verified manufacturers
            const verifiedManufacturers = await verificationService.getVerifiedManufacturers();

            if (verifiedManufacturers.length === 0) {
                setError('No verified manufacturers found. Please contact support for assistance.');
            }

            setManufacturers(verifiedManufacturers);
        } catch (err) {
            console.error('Error loading manufacturers:', err);
            setError('Failed to load manufacturers. Please try again.');
        } finally {
            setLoadingManufacturers(false);
        }
    };

    // Handle form submission
    const handleTransferFunds = async (e) => {
        e.preventDefault();

        // Reset status
        setError('');
        setSuccess('');

        // Validate input
        if (!selectedManufacturer) {
            setError('Please select a manufacturer');
            return;
        }

        // Confirm with user
        if (!window.confirm(`Are you sure you want to transfer ${product.businessHeldFunds?.toLocaleString()} credits to the selected manufacturer?`)) {
            return;
        }

        setLoading(true);

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

    // If product is not fully funded, show an error
    if (!isFullyFunded) {
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
        <Modal title="Select Manufacturer" onClose={onClose}>
            <div className="manufacturer-selection-container">
                <div className="product-funding-info">
                    <h3>{product.name}</h3>
                    <p>Available Funds: <strong>${businessHeldFunds.toLocaleString()}</strong></p>
                    <p>Once you transfer funds to a manufacturer, the manufacturing process will begin.</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner
                            componentId="manufacturer-transfer"
                            context="fund-transfer-process"
                        />
                        <p>Processing fund transfer...</p>
                    </div>
                ) : loadingManufacturers ? (
                    <div className="loading-container">
                        <LoadingSpinner
                            componentId="manufacturer-list"
                            context="manufacturer-selection"
                        />
                        <p>Loading verified manufacturers...</p>
                    </div>
                ) : (
                    <form onSubmit={handleTransferFunds}>
                        <div className="form-group">
                            <label htmlFor="manufacturer-select">Select a Verified Manufacturer:</label>
                            <select
                                id="manufacturer-select"
                                value={selectedManufacturer}
                                onChange={(e) => setSelectedManufacturer(e.target.value)}
                                required
                            >
                                <option value="">-- Select a manufacturer --</option>
                                {manufacturers.map(manufacturer => (
                                    <option key={manufacturer.id} value={manufacturer.id}>
                                        {manufacturer.displayName || manufacturer.email} {manufacturer.manufacturerVerified && "✓"}
                                    </option>
                                ))}
                            </select>
                            <p className="verification-note">All manufacturers shown have been verified by our admin team.</p>
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
                                <li>Funds will be transferred immediately to the selected manufacturer.</li>
                                <li>All investors will be notified that manufacturing has begun.</li>
                                <li>You will be able to track the manufacturing progress in your dashboard.</li>
                            </ul>
                        </div>

                        <button
                            type="submit"
                            className="transfer-button"
                            disabled={!selectedManufacturer || loading}
                        >
                            Transfer Funds to Manufacturer
                        </button>
                    </form>
                )}
            </div>
        </Modal>
    );
};

export default ManufacturerSelectionModal;