import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../LoadingSpinner';


const ManufacturerSelectionModal = ({ isOpen, onClose, product, onSuccess, preSelection }) => {
    const [loading, setLoading] = useState(false);
    const [manufacturers, setManufacturers] = useState([]);
    const [selectedManufacturerId, setSelectedManufacturerId] = useState('');
    const [error, setError] = useState('');
    const [transferFunds, setTransferFunds] = useState(true);
    const { currentUser } = useUser();

    useEffect(() => {
        if (!isOpen) return;

        const loadManufacturers = async () => {
            setLoading(true);
            try {
                // Query for verified manufacturers
                const usersRef = collection(db, 'users');
                const manufacturersQuery = query(
                    usersRef,
                    where('roles', 'array-contains', 'manufacturer'),
                    where('manufacturerVerified', '==', true)
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedManufacturerId) {
            setError('Please select a manufacturer');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Update the product with the selected manufacturer
            const productRef = doc(db, 'products', product.id);
            await updateDoc(productRef, {
                manufacturerId: selectedManufacturerId,
                manufacturerAssignedAt: new Date()
            });

            // If transfer funds is selected, transfer the funds to manufacturer
            if (transferFunds && product.currentFunding && product.currentFunding >= product.fundingGoal) {
                const selectedManufacturer = manufacturers.find(m => m.id === selectedManufacturerId);

                if (selectedManufacturer) {
                    const walletService = await import('../../services/walletService').then(module => module.default);

                    await walletService.transferProductFundsToManufacturer(
                        currentUser.uid,
                        product.id,
                        selectedManufacturer.email,
                        "Designer selected manufacturer for fully funded product"
                    );
                }
            }

            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Error assigning manufacturer:', err);
            setError('Failed to assign manufacturer: ' + err.message);
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
                            </div>

                            {error && <div className="error-message">{error}</div>}

                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label htmlFor="manufacturer-select">Select a Manufacturer:</label>
                                    <select
                                        id="manufacturer-select"
                                        value={selectedManufacturerId}
                                        onChange={(e) => setSelectedManufacturerId(e.target.value)}
                                    >
                                        <option value="">-- Select a manufacturer --</option>
                                        {manufacturers.map(manufacturer => (
                                            <option key={manufacturer.id} value={manufacturer.id}>
                                                {manufacturer.displayName} {manufacturer.manufacturerVerified && "✓"}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {product.currentFunding >= product.fundingGoal && (
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
                                        disabled={loading || !selectedManufacturerId}
                                    >
                                        {loading ? 'Processing...' : 'Assign Manufacturer'}
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
