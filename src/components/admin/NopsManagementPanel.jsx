import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import LoadingSpinner from '../LoadingSpinner';
import '../../styles/NopsManagement.css';

const NopsManagementPanel = () => {
    const [nops, setNops] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [nopName, setNopName] = useState('');
    const [nopImage, setNopImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // Edit state
    const [editMode, setEditMode] = useState(false);
    const [currentNop, setCurrentNop] = useState(null);

    const fileInputRef = useRef(null);

    // Fetch all nops on component mount
    useEffect(() => {
        fetchNops();
    }, []);

    // Fetch nops from Firestore
    const fetchNops = async () => {
        setLoading(true);
        setError('');

        try {
            const nopsRef = collection(db, 'nops');
            const snapshot = await getDocs(nopsRef);

            const nopsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setNops(nopsList);
        } catch (err) {
            console.error('Error fetching nops:', err);
            setError('Failed to fetch nops. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle image selection
    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size exceeds 5MB limit');
                return;
            }

            // Validate file type for both images and SVGs
            if (!file.type.match('image.*') && !file.type.match('image/svg+xml')) {
                setError('Only image files (including SVGs) are allowed');
                return;
            }

            // Clear previous error
            setError('');

            // Set the image directly without cropping
            setNopImage(file);

            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    // Form validation
    const validateForm = () => {
        if (!nopName.trim()) {
            setError('Nop name is required');
            return false;
        }

        if (!nopImage && !editMode) {
            setError('Nop image is required');
            return false;
        }

        return true;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            let imageUrl = '';
            let storagePath = '';

            // Upload image if provided
            if (nopImage) {
                const timestamp = Date.now();
                // Keep original file extension for SVGs
                const fileExtension = nopImage.name.split('.').pop().toLowerCase();
                const fileName = `${timestamp}-nop.${fileExtension}`;
                storagePath = `nops/${fileName}`;

                // Create storage reference
                const storageRef = ref(storage, storagePath);

                // Upload file
                await uploadBytes(storageRef, nopImage);

                // Get download URL
                imageUrl = await getDownloadURL(storageRef);
            }

            if (editMode && currentNop) {
                // Update existing nop
                const nopRef = doc(db, 'nops', currentNop.id);

                // Prepare update data
                const updateData = {
                    name: nopName.trim(),
                    updatedAt: serverTimestamp()
                };

                // Add image if changed
                if (imageUrl) {
                    updateData.imageUrl = imageUrl;
                    updateData.storagePath = storagePath;

                    // Delete old image if it exists
                    if (currentNop.storagePath) {
                        try {
                            const oldImageRef = ref(storage, currentNop.storagePath);
                            await deleteObject(oldImageRef);
                        } catch (err) {
                            console.warn('Failed to delete old image:', err);
                            // Continue anyway as this is not critical
                        }
                    }
                }

                await updateDoc(nopRef, updateData);
                setSuccess(`"${nopName}" updated successfully!`);
            } else {
                // Create new nop
                const nopData = {
                    name: nopName.trim(),
                    imageUrl: imageUrl,
                    storagePath: storagePath,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await addDoc(collection(db, 'nops'), nopData);
                setSuccess(`"${nopName}" added successfully!`);
            }

            // Reset form
            setNopName('');
            setNopImage(null);
            setImagePreview(null);
            setEditMode(false);
            setCurrentNop(null);

            // Refresh nops list
            fetchNops();
        } catch (err) {
            console.error('Error saving nop:', err);
            setError(`Failed to ${editMode ? 'update' : 'create'} nop: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle edit nop
    const handleEditNop = (nop) => {
        setNopName(nop.name);
        setImagePreview(nop.imageUrl);
        setNopImage(null);
        setEditMode(true);
        setCurrentNop(nop);
        setError('');
        setSuccess('');
    };

    // Handle delete nop
    const handleDeleteNop = async (nop) => {
        if (!window.confirm(`Are you sure you want to delete "${nop.name}"?`)) {
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Delete document from Firestore
            await deleteDoc(doc(db, 'nops', nop.id));

            // Delete image from Storage if it exists
            if (nop.storagePath) {
                try {
                    const imageRef = ref(storage, nop.storagePath);
                    await deleteObject(imageRef);
                } catch (err) {
                    console.warn('Failed to delete image from storage:', err);
                    // Continue anyway as the document is already deleted
                }
            }

            setSuccess(`"${nop.name}" deleted successfully!`);

            // If currently editing this nop, reset form
            if (editMode && currentNop && currentNop.id === nop.id) {
                setNopName('');
                setNopImage(null);
                setImagePreview(null);
                setEditMode(false);
                setCurrentNop(null);
            }

            // Refresh nops list
            fetchNops();
        } catch (err) {
            console.error('Error deleting nop:', err);
            setError(`Failed to delete nop: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Reset form
    const handleCancel = () => {
        setNopName('');
        setNopImage(null);
        setImagePreview(null);
        setEditMode(false);
        setCurrentNop(null);
        setError('');
        setSuccess('');
    };

    return (
        <div className="nops-management-panel">
            <h2>Nops Collectibles Management</h2>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="nops-management-container">
                <div className="nops-form-section">
                    <form onSubmit={handleSubmit} className="nops-form">
                        <h3>{editMode ? 'Edit Nop' : 'Add New Nop'}</h3>

                        <div className="form-group">
                            <label htmlFor="nopName">Nop Name*</label>
                            <input
                                type="text"
                                id="nopName"
                                value={nopName}
                                onChange={(e) => setNopName(e.target.value)}
                                placeholder="Enter nop name"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Nop Image* (JPG, PNG, GIF, SVG supported)</label>
                            <div className="image-upload-area">
                                {imagePreview && (
                                    <div className="image-preview-container">
                                        <img src={imagePreview} alt="Nop Preview" className="image-preview" />
                                        <button
                                            type="button"
                                            className="remove-image-btn"
                                            onClick={() => {
                                                setNopImage(null);
                                                setImagePreview(null);
                                            }}
                                            disabled={loading}
                                        >
                                            Change Image
                                        </button>
                                    </div>
                                )}

                                {!imagePreview && (
                                    <div
                                        className="upload-placeholder"
                                        onClick={() => !loading && fileInputRef.current.click()}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                            <polyline points="21 15 16 10 5 21"></polyline>
                                        </svg>
                                        <p>Click to upload image</p>
                                        <span>(Max size: 5MB)</span>
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                accept="image/*,.svg"
                                style={{ display: 'none' }}
                                disabled={loading}
                            />
                            {editMode && !nopImage && (
                                <p className="form-hint">Leave empty to keep the current image</p>
                            )}
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={handleCancel}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="submit-button"
                                disabled={loading}
                            >
                                {loading ? <LoadingSpinner /> : editMode ? 'Update Nop' : 'Create Nop'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="nops-list-section">
                    <h3>All Nops</h3>

                    {loading && nops.length === 0 ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>Loading nops...</p>
                        </div>
                    ) : nops.length === 0 ? (
                        <div className="no-nops-message">
                            <p>No nops found. Add your first nop!</p>
                        </div>
                    ) : (
                        <div className="nops-grid">
                            {nops.map(nop => (
                                <div key={nop.id} className="nop-card">
                                    <div className="nop-image-container">
                                        <img src={nop.imageUrl} alt={nop.name} className="nop-image" />
                                    </div>
                                    <div className="nop-info">
                                        <h4 className="nop-name">{nop.name}</h4>
                                        <div className="nop-actions">
                                            <button
                                                onClick={() => handleEditNop(nop)}
                                                className="edit-button"
                                                disabled={loading}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteNop(nop)}
                                                className="delete-button"
                                                disabled={loading}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NopsManagementPanel;