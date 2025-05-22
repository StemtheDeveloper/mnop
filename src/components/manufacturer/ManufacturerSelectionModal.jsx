import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../LoadingSpinner';
import '../../styles/ManufacturerModal.css';

const ManufacturerSelectionModal = ({ isOpen, onClose, product, onSuccess, preSelection }) => {
    const [loading, setLoading] = useState(false);
    const [manufacturers, setManufacturers] = useState([]);
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('');
    const [error, setError] = useState('');
    const [transferFunds, setTransferFunds] = useState(true);
    const { currentUser } = useUser();
    const [existingRequest, setExistingRequest] = useState(null);
    const [showUnverifiedWarning, setShowUnverifiedWarning] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const loadManufacturers = async () => {
            setLoading(true);
            try {
                // Query for all manufacturers (verified and unverified)
                const usersRef = collection(db, 'users');
                const manufacturersQuery = query(
                    usersRef,
                    where('roles', 'array-contains', 'manufacturer')
                );

                const manufacturersSnap = await getDocs(manufacturersQuery);
                const manufacturersList = manufacturersSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    displayName: doc.data().displayName || doc.data().email
                }));

                setManufacturers(manufacturersList);

                // Check if there's a preselected manufacturer for this product
                if (product) {
                    const settingsRef = doc(db, 'designerSettings', currentUser.uid);
                    const settingsDoc = await getDoc(settingsRef);

                    if (settingsDoc.exists()) {
                        const settings = settingsDoc.data();
                        if (settings.manufacturerSettings &&
                            settings.manufacturerSettings[product.id]) {
                            setSelectedManufacturerId(settings.manufacturerSettings[product.id]);
                        }
                    }

                    // Check for existing request
                    await checkExistingRequest(product.id);
                }
            } catch (err) {
                console.error('Error loading manufacturers:', err);
                setError('Failed to load manufacturers');
            } finally {
                setLoading(false);
            }
        };

        loadManufacturers();
    }, [isOpen, product, currentUser]);

    useEffect(() => {
        if (!selectedManufacturerId) {
            setShowUnverifiedWarning(false);
            return;
        }
        const selected = manufacturers.find(m => m.id === selectedManufacturerId);
        setShowUnverifiedWarning(selected && !selected.manufacturerVerified);
    }, [selectedManufacturerId, manufacturers]);

    const checkExistingRequest = async (productId) => {
        try {
            const requestsRef = collection(db, 'manufacturerRequests');
            const q = query(
                requestsRef,
                where('productId', '==', productId),
                where('designerId', '==', currentUser.uid)
            );

            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const requestData = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
                setExistingRequest(requestData);

                if (requestData.manufacturerId) {
                    setSelectedManufacturerId(requestData.manufacturerId);
                }

                return requestData;
            }

            return null;
        } catch (error) {
            console.error('Error checking existing request:', error);
            return null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedManufacturerId) {
            setError('Please select a manufacturer');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const selectedManufacturer = manufacturers.find(m => m.id === selectedManufacturerId);

            if (!selectedManufacturer) {
                setError('Selected manufacturer not found');
                return;
            }

            // Check if we're dealing with an approved request
            if (existingRequest && existingRequest.status === 'approved') {
                // If approved and fully funded, transfer funds
                if (transferFunds && product.currentFunding >= product.fundingGoal) {
                    // Update the product with the selected manufacturer
                    const productRef = doc(db, 'products', product.id);
                    await updateDoc(productRef, {
                        manufacturerId: selectedManufacturerId,
                        manufacturerAssignedAt: new Date()
                    });

                    // Transfer funds to manufacturer
                    const walletService = await import('../../services/walletService').then(module => module.default);

                    await walletService.transferProductFundsToManufacturer(
                        currentUser.uid,
                        product.id,
                        selectedManufacturer.email,
                        "Designer sent funds to approved manufacturer for fully funded product"
                    );

                    // Update request status
                    const requestRef = doc(db, 'manufacturerRequests', existingRequest.id);
                    await updateDoc(requestRef, {
                        status: 'completed',
                        fundsTransferred: true,
                        fundsTransferredAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }
            } else {
                // Create or update a manufacturer request
                const requestData = {
                    productId: product.id,
                    productName: product.name,
                    designerId: currentUser.uid,
                    designerEmail: currentUser.email,
                    manufacturerId: selectedManufacturerId,
                    manufacturerEmail: selectedManufacturer.email,
                    status: 'pending',
                    fundingAmount: product.currentFunding >= product.fundingGoal ? product.currentFunding : 0,
                    isFullyFunded: product.currentFunding >= product.fundingGoal,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                if (existingRequest) {
                    // Update existing request
                    const requestRef = doc(db, 'manufacturerRequests', existingRequest.id);
                    await updateDoc(requestRef, {
                        ...requestData,
                        createdAt: existingRequest.createdAt // Preserve original creation date
                    });
                } else {
                    // Create new request
                    await addDoc(collection(db, 'manufacturerRequests'), requestData);
                }
            }

            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Error processing manufacturer request:', err);
            setError('Failed to process request: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !product) return null;

    return (
        <div className="modal-overlay">
            <div className="manufacturer-modal">
                <div className="modal-header">
                    <h2>Select Manufacturer</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>Loading manufacturers...</p>
                        </div>
                    ) : (
                        <>
                            <div className="product-info">
                                <h3>Product: {product.name}</h3>
                                <p>Status: {product.currentFunding >= product.fundingGoal ? 'Fully Funded' : 'Funding in Progress'}</p>

                                {product.currentFunding >= product.fundingGoal && (
                                    <div className="funding-complete">
                                        <p>This product has reached its funding goal and is ready for manufacturing!</p>
                                    </div>
                                )}

                                {existingRequest && (
                                    <div className="request-status">
                                        <p>Request Status: <span className={`status-${existingRequest.status}`}>{existingRequest.status}</span></p>
                                        {existingRequest.status === 'approved' && (
                                            <p className="approved-message">This manufacturer has approved your request!</p>
                                        )}
                                        {existingRequest.status === 'rejected' && (
                                            <p className="rejected-message">This manufacturer has declined your request. Please select another manufacturer.</p>
                                        )}
                                        {existingRequest.status === 'pending' && (
                                            <p className="pending-message">Your request is still pending approval from the manufacturer.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {error && <div className="error-message">{error}</div>}

                            {showUnverifiedWarning && (
                                <div className="verification-warning">
                                    <strong>Warning:</strong> You have selected an <b>unverified</b> manufacturer. This is not recommended. Unverified manufacturers have not been vetted by our team and may pose additional risks.
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label htmlFor="manufacturer-select">Select a Manufacturer:</label>
                                    <select
                                        id="manufacturer-select"
                                        value={selectedManufacturerId}
                                        onChange={(e) => setSelectedManufacturerId(e.target.value)}
                                        disabled={existingRequest?.status === 'pending'}
                                    >
                                        <option value="">-- Select a manufacturer --</option>
                                        {manufacturers.map(manufacturer => (
                                            <option key={manufacturer.id} value={manufacturer.id}>
                                                {manufacturer.displayName} {manufacturer.manufacturerVerified ? '✓' : '(Unverified)'}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="verification-note">
                                        Manufacturers marked with ✓ have been verified by our team. Unverified manufacturers have not been vetted.
                                    </p>
                                </div>

                                {product.currentFunding >= product.fundingGoal && existingRequest?.status === 'approved' && (
                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="transfer-funds"
                                            checked={transferFunds}
                                            onChange={(e) => setTransferFunds(e.target.checked)}
                                        />
                                        <label htmlFor="transfer-funds">
                                            Transfer funds to manufacturer immediately
                                        </label>
                                    </div>
                                )}

                                <div className="modal-actions">
                                    <button type="button" className="btn-cancel" onClick={onClose}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={loading || !selectedManufacturerId || existingRequest?.status === 'pending'}
                                    >
                                        {loading ? 'Processing...' : existingRequest?.status === 'approved' && transferFunds ? 'Transfer Funds' : 'Send Request'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManufacturerSelectionModal;
