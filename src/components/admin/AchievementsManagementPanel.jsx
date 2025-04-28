import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, writeBatch, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import LoadingSpinner from '../LoadingSpinner';
import achievementsData from '../../data/achievementsData';
import '../../styles/AchievementsManagement.css';

const AchievementsManagementPanel = () => {
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [achievementName, setAchievementName] = useState('');
    const [achievementDescription, setAchievementDescription] = useState('');
    const [achievementImage, setAchievementImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [points, setPoints] = useState(0);
    const [triggerType, setTriggerType] = useState('manual');
    const [triggerCondition, setTriggerCondition] = useState('');
    const [triggerValue, setTriggerValue] = useState('');
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [customTriggerScript, setCustomTriggerScript] = useState('');

    // Edit state
    const [editMode, setEditMode] = useState(false);
    const [currentAchievement, setCurrentAchievement] = useState(null);

    // Bulk operation states
    const [selectedAchievements, setSelectedAchievements] = useState([]);
    const [bulkEditMode, setBulkEditMode] = useState(false);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
    const [selectAll, setSelectAll] = useState(false);
    const [bulkPoints, setBulkPoints] = useState(0);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [defaultAchievementsLoading, setDefaultAchievementsLoading] = useState(false);

    const fileInputRef = useRef(null);

    // Available trigger types and their descriptions
    const triggerTypes = [
        { id: 'manual', name: 'Manual Award', description: 'Manually awarded by administrators.' },
        { id: 'product_upload', name: 'Product Upload', description: 'Awarded when user uploads a specific number of products.' },
        { id: 'investment', name: 'Investment Made', description: 'Awarded when user invests a specific amount or number of times.' },
        { id: 'product_funded', name: 'Product Fully Funded', description: 'Awarded when user\'s product gets fully funded.' },
        { id: 'order_placed', name: 'Order Placed', description: 'Awarded when user places a specific number of orders.' },
        { id: 'profile_complete', name: 'Profile Completion', description: 'Awarded when user completes their profile.' },
        { id: 'time_registered', name: 'Registration Anniversary', description: 'Awarded based on time since registration.' },
        { id: 'custom', name: 'Custom Trigger', description: 'Define a custom trigger condition with advanced settings.' }
    ];

    // Fetch all achievements on component mount
    useEffect(() => {
        fetchAchievements();
    }, []);

    // Fetch achievements from Firestore
    const fetchAchievements = async () => {
        setLoading(true);
        setError('');

        try {
            const achievementsRef = collection(db, 'achievements');
            const snapshot = await getDocs(achievementsRef);

            const achievementsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setAchievements(achievementsList);
        } catch (err) {
            console.error('Error fetching achievements:', err);
            setError('Failed to fetch achievements. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle image selection
    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                setError('Image size exceeds 2MB limit');
                return;
            }

            // Validate file type
            if (!file.type.match('image.*') && !file.type.match('image/svg+xml')) {
                setError('Only image files (including SVGs) are allowed');
                return;
            }

            // Clear previous error
            setError('');

            // Set the image directly
            setAchievementImage(file);

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
        if (!achievementName.trim()) {
            setError('Achievement name is required');
            return false;
        }

        if (!achievementDescription.trim()) {
            setError('Achievement description is required');
            return false;
        }

        if (!achievementImage && !editMode) {
            setError('Achievement badge image is required');
            return false;
        }

        if (triggerType !== 'manual') {
            if (triggerType === 'custom' && !customTriggerScript.trim()) {
                setError('Custom trigger script is required for custom trigger type');
                return false;
            } else if (triggerType !== 'custom' && (!triggerCondition || !triggerValue)) {
                setError('Trigger condition and value are required for automatic achievements');
                return false;
            }
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
            if (achievementImage) {
                const timestamp = Date.now();
                // Keep original file extension
                const fileExtension = achievementImage.name.split('.').pop().toLowerCase();
                const fileName = `${timestamp}-achievement.${fileExtension}`;
                storagePath = `achievements/${fileName}`;

                // Create storage reference
                const storageRef = ref(storage, storagePath);

                // Upload file
                await uploadBytes(storageRef, achievementImage);

                // Get download URL
                imageUrl = await getDownloadURL(storageRef);
            }

            // Prepare the trigger configuration
            let triggerConfig;

            if (triggerType === 'manual') {
                triggerConfig = { type: 'manual' };
            } else if (triggerType === 'custom') {
                triggerConfig = {
                    type: 'custom',
                    script: customTriggerScript
                };
            } else {
                triggerConfig = {
                    type: triggerType,
                    condition: triggerCondition,
                    value: triggerValue
                };
            }

            if (editMode && currentAchievement) {
                // Update existing achievement
                const achievementRef = doc(db, 'achievements', currentAchievement.id);

                // Prepare update data
                const updateData = {
                    name: achievementName.trim(),
                    description: achievementDescription.trim(),
                    points: Number(points),
                    triggerConfig: triggerConfig,
                    updatedAt: serverTimestamp()
                };

                // Add image if changed
                if (imageUrl) {
                    updateData.imageUrl = imageUrl;
                    updateData.storagePath = storagePath;

                    // Delete old image if it exists
                    if (currentAchievement.storagePath) {
                        try {
                            const oldImageRef = ref(storage, currentAchievement.storagePath);
                            await deleteObject(oldImageRef);
                        } catch (err) {
                            console.warn('Failed to delete old image:', err);
                            // Continue anyway as this is not critical
                        }
                    }
                }

                await updateDoc(achievementRef, updateData);
                setSuccess(`"${achievementName}" updated successfully!`);
            } else {
                // Create new achievement
                const achievementData = {
                    name: achievementName.trim(),
                    description: achievementDescription.trim(),
                    imageUrl: imageUrl,
                    storagePath: storagePath,
                    points: Number(points),
                    triggerConfig: triggerConfig,
                    awardCount: 0,  // Initialize with zero awards
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await addDoc(collection(db, 'achievements'), achievementData);
                setSuccess(`"${achievementName}" added successfully!`);
            }

            // Reset form
            resetForm();

            // Refresh achievements list
            fetchAchievements();
        } catch (err) {
            console.error('Error saving achievement:', err);
            setError(`Failed to ${editMode ? 'update' : 'create'} achievement: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle edit achievement
    const handleEditAchievement = (achievement) => {
        setAchievementName(achievement.name);
        setAchievementDescription(achievement.description);
        setPoints(achievement.points || 0);
        setImagePreview(achievement.imageUrl);
        setAchievementImage(null);

        // Set trigger configuration
        const triggerConfig = achievement.triggerConfig || { type: 'manual' };
        setTriggerType(triggerConfig.type);

        if (triggerConfig.type === 'custom') {
            setCustomTriggerScript(triggerConfig.script || '');
            setIsAdvancedMode(true);
        } else if (triggerConfig.type !== 'manual') {
            setTriggerCondition(triggerConfig.condition || '');
            setTriggerValue(triggerConfig.value || '');
            setIsAdvancedMode(false);
        }

        setEditMode(true);
        setCurrentAchievement(achievement);
        setError('');
        setSuccess('');
    };

    // Handle delete achievement
    const handleDeleteAchievement = async (achievement) => {
        if (!window.confirm(`Are you sure you want to delete "${achievement.name}"?`)) {
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Delete document from Firestore
            await deleteDoc(doc(db, 'achievements', achievement.id));

            // Delete image from Storage if it exists
            if (achievement.storagePath) {
                try {
                    const imageRef = ref(storage, achievement.storagePath);
                    await deleteObject(imageRef);
                } catch (err) {
                    console.warn('Failed to delete image from storage:', err);
                    // Continue anyway as the document is already deleted
                }
            }

            setSuccess(`"${achievement.name}" deleted successfully!`);

            // If currently editing this achievement, reset form
            if (editMode && currentAchievement && currentAchievement.id === achievement.id) {
                resetForm();
            }

            // Refresh achievements list
            fetchAchievements();
        } catch (err) {
            console.error('Error deleting achievement:', err);
            setError(`Failed to delete achievement: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Toggle achievement selection
    const toggleAchievementSelection = (achievementId) => {
        setSelectedAchievements(prev => {
            if (prev.includes(achievementId)) {
                return prev.filter(id => id !== achievementId);
            } else {
                return [...prev, achievementId];
            }
        });
    };

    // Toggle select all achievements
    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedAchievements([]);
        } else {
            setSelectedAchievements(achievements.map(a => a.id));
        }
        setSelectAll(!selectAll);
    };

    // Enter bulk edit mode
    const enterBulkEditMode = () => {
        if (selectedAchievements.length === 0) {
            setError('Please select at least one achievement to edit');
            return;
        }
        setBulkEditMode(true);
        setBulkDeleteMode(false);
        setError('');
    };

    // Enter bulk delete mode
    const enterBulkDeleteMode = () => {
        if (selectedAchievements.length === 0) {
            setError('Please select at least one achievement to delete');
            return;
        }
        setBulkDeleteMode(true);
        setBulkEditMode(false);
        setError('');
    };

    // Cancel bulk operations
    const cancelBulkOperations = () => {
        setBulkEditMode(false);
        setBulkDeleteMode(false);
        setConfirmBulkDelete(false);
        setError('');
    };

    // Handle bulk edit submission
    const handleBulkEdit = async () => {
        if (selectedAchievements.length === 0) {
            setError('No achievements selected for bulk edit');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Use batch to update multiple documents
            const batch = writeBatch(db);

            // Update each selected achievement
            selectedAchievements.forEach(id => {
                const achievementRef = doc(db, 'achievements', id);
                batch.update(achievementRef, {
                    points: Number(bulkPoints),
                    updatedAt: serverTimestamp()
                });
            });

            // Commit the batch
            await batch.commit();

            setSuccess(`Successfully updated ${selectedAchievements.length} achievements`);
            setBulkEditMode(false);
            setSelectedAchievements([]);
            setSelectAll(false);

            // Refresh the achievements list
            fetchAchievements();
        } catch (err) {
            console.error('Error performing bulk edit:', err);
            setError(`Failed to update achievements: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle bulk delete
    const handleBulkDelete = async () => {
        if (selectedAchievements.length === 0) {
            setError('No achievements selected for deletion');
            return;
        }

        // If confirmation not yet shown, show it first
        if (!confirmBulkDelete) {
            setConfirmBulkDelete(true);
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Use batch to delete multiple documents
            const batch = writeBatch(db);

            // Get all achievements to delete (for image cleanup)
            const achievementsToDelete = achievements.filter(a => selectedAchievements.includes(a.id));

            // Add each document to the batch for deletion
            selectedAchievements.forEach(id => {
                const achievementRef = doc(db, 'achievements', id);
                batch.delete(achievementRef);
            });

            // Commit the batch
            await batch.commit();

            // Delete all associated images from Storage
            const deleteImagePromises = achievementsToDelete
                .filter(a => a.storagePath)
                .map(a => {
                    try {
                        const imageRef = ref(storage, a.storagePath);
                        return deleteObject(imageRef);
                    } catch (err) {
                        console.warn(`Failed to delete image for achievement ${a.id}:`, err);
                        return Promise.resolve(); // Continue even if image deletion fails
                    }
                });

            // Wait for all image deletions (if any)
            await Promise.all(deleteImagePromises);

            setSuccess(`Successfully deleted ${selectedAchievements.length} achievements`);
            setBulkDeleteMode(false);
            setConfirmBulkDelete(false);
            setSelectedAchievements([]);
            setSelectAll(false);

            // Refresh the achievements list
            fetchAchievements();
        } catch (err) {
            console.error('Error performing bulk delete:', err);
            setError(`Failed to delete achievements: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Reset form and bulk operations
    const resetForm = () => {
        setAchievementName('');
        setAchievementDescription('');
        setPoints(0);
        setAchievementImage(null);
        setImagePreview(null);
        setTriggerType('manual');
        setTriggerCondition('');
        setTriggerValue('');
        setCustomTriggerScript('');
        setIsAdvancedMode(false);
        setEditMode(false);
        setCurrentAchievement(null);
        setError('');
        setSuccess('');
        setBulkEditMode(false);
        setBulkDeleteMode(false);
        setConfirmBulkDelete(false);
        setSelectedAchievements([]);
        setSelectAll(false);
        setBulkPoints(0);
    };

    // Toggle advanced mode
    const toggleAdvancedMode = () => {
        setIsAdvancedMode(!isAdvancedMode);
    };

    // Get trigger condition options based on trigger type
    const getTriggerConditionOptions = () => {
        switch (triggerType) {
            case 'product_upload':
                return [
                    { value: 'count', label: 'Number of products uploaded' },
                    { value: 'category', label: 'Upload in specific category' }
                ];
            case 'investment':
                return [
                    { value: 'amount', label: 'Total investment amount' },
                    { value: 'count', label: 'Number of investments' },
                    { value: 'single', label: 'Single investment amount' }
                ];
            case 'product_funded':
                return [
                    { value: 'any', label: 'Any product fully funded' },
                    { value: 'count', label: 'Number of products funded' }
                ];
            case 'order_placed':
                return [
                    { value: 'count', label: 'Number of orders placed' },
                    { value: 'amount', label: 'Total order amount' }
                ];
            case 'profile_complete':
                return [
                    { value: 'percent', label: 'Percentage complete' },
                    { value: 'fields', label: 'Specific fields completed' }
                ];
            case 'time_registered':
                return [
                    { value: 'days', label: 'Days since registration' },
                    { value: 'years', label: 'Years since registration' }
                ];
            default:
                return [];
        }
    };

    const initializeDefaultAchievements = async () => {
        setDefaultAchievementsLoading(true);
        setError('');
        setSuccess('');

        try {
            const achievementsRef = collection(db, 'achievements');
            const snapshot = await getDocs(achievementsRef);

            const existingAchievements = snapshot.docs.map(doc => doc.data().name);

            const missingAchievements = achievementsData.filter(
                defaultAchievement => !existingAchievements.includes(defaultAchievement.name)
            );

            const batch = writeBatch(db);

            missingAchievements.forEach(achievement => {
                const achievementData = {
                    ...achievement,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                batch.set(doc(achievementsRef), achievementData);
            });

            await batch.commit();

            setSuccess('Default achievements initialized successfully!');
            fetchAchievements();
        } catch (err) {
            console.error('Error initializing default achievements:', err);
            setError('Failed to initialize default achievements. Please try again.');
        } finally {
            setDefaultAchievementsLoading(false);
        }
    };

    return (
        <div className="achievements-management-panel">
            <h2>Achievements & Badges Management</h2>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="achievements-management-container">
                <div className="achievements-form-section">
                    {bulkEditMode ? (
                        <div className="bulk-edit-form">
                            <h3>Bulk Edit {selectedAchievements.length} Achievements</h3>
                            <div className="form-group">
                                <label htmlFor="bulkPoints">Points Value</label>
                                <input
                                    type="number"
                                    id="bulkPoints"
                                    value={bulkPoints}
                                    onChange={(e) => setBulkPoints(e.target.value)}
                                    min="0"
                                    placeholder="Points to set for all selected achievements"
                                    disabled={loading}
                                />
                                <p className="form-hint">This will change the points value for all selected achievements.</p>
                            </div>
                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={cancelBulkOperations}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="submit-button"
                                    onClick={handleBulkEdit}
                                    disabled={loading}
                                >
                                    {loading ? <LoadingSpinner /> : 'Update All Selected'}
                                </button>
                            </div>
                        </div>
                    ) : bulkDeleteMode ? (
                        <div className="bulk-delete-form">
                            <h3>Bulk Delete {selectedAchievements.length} Achievements</h3>

                            {confirmBulkDelete ? (
                                <div className="confirm-bulk-delete">
                                    <p className="warning-message">⚠️ WARNING: This will permanently delete {selectedAchievements.length} achievements and cannot be undone!</p>
                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="cancel-button"
                                            onClick={cancelBulkOperations}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="delete-button"
                                            onClick={handleBulkDelete}
                                            disabled={loading}
                                        >
                                            {loading ? <LoadingSpinner /> : 'Confirm Delete'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p>You're about to delete {selectedAchievements.length} achievements.</p>
                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="cancel-button"
                                            onClick={cancelBulkOperations}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="delete-button"
                                            onClick={handleBulkDelete}
                                            disabled={loading}
                                        >
                                            {loading ? <LoadingSpinner /> : 'Delete Selected Achievements'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="achievements-form">
                            <h3>{editMode ? 'Edit Achievement' : 'Create New Achievement'}</h3>

                            <div className="form-group">
                                <label htmlFor="achievementName">Achievement Name*</label>
                                <input
                                    type="text"
                                    id="achievementName"
                                    value={achievementName}
                                    onChange={(e) => setAchievementName(e.target.value)}
                                    placeholder="Enter achievement name"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="achievementDescription">Description*</label>
                                <textarea
                                    id="achievementDescription"
                                    value={achievementDescription}
                                    onChange={(e) => setAchievementDescription(e.target.value)}
                                    placeholder="Describe what this achievement represents"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="points">Points Value</label>
                                <input
                                    type="number"
                                    id="points"
                                    value={points}
                                    onChange={(e) => setPoints(e.target.value)}
                                    min="0"
                                    placeholder="Points awarded for this achievement"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Badge Image* (JPG, PNG, SVG supported)</label>
                                <div className="image-upload-area">
                                    {imagePreview && (
                                        <div className="image-preview-container">
                                            <img src={imagePreview} alt="Achievement Badge Preview" className="image-preview" />
                                            <button
                                                type="button"
                                                className="remove-image-btn"
                                                onClick={() => {
                                                    setAchievementImage(null);
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
                                            <p>Click to upload badge image</p>
                                            <span>(Max size: 2MB)</span>
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
                                {editMode && !achievementImage && (
                                    <p className="form-hint">Leave empty to keep the current image</p>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="triggerType">Award Trigger*</label>
                                <select
                                    id="triggerType"
                                    value={triggerType}
                                    onChange={(e) => {
                                        setTriggerType(e.target.value);
                                        setTriggerCondition('');
                                        setTriggerValue('');
                                        if (e.target.value === 'custom') {
                                            setIsAdvancedMode(true);
                                        }
                                    }}
                                    disabled={loading}
                                >
                                    {triggerTypes.map(type => (
                                        <option key={type.id} value={type.id}>{type.name}</option>
                                    ))}
                                </select>
                                <p className="trigger-description">
                                    {triggerTypes.find(t => t.id === triggerType)?.description || ''}
                                </p>
                            </div>

                            {/* Trigger configuration for non-manual, non-custom triggers */}
                            {triggerType !== 'manual' && triggerType !== 'custom' && (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="triggerCondition">Trigger Condition*</label>
                                        <select
                                            id="triggerCondition"
                                            value={triggerCondition}
                                            onChange={(e) => setTriggerCondition(e.target.value)}
                                            disabled={loading}
                                        >
                                            <option value="">Select a condition</option>
                                            {getTriggerConditionOptions().map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="triggerValue">Trigger Value*</label>
                                        <input
                                            type="text"
                                            id="triggerValue"
                                            value={triggerValue}
                                            onChange={(e) => setTriggerValue(e.target.value)}
                                            placeholder="The value that triggers the achievement"
                                            disabled={loading}
                                        />
                                        <p className="form-hint">
                                            Example: If condition is "Number of products uploaded", value could be "5"
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Advanced mode for custom triggers */}
                            {triggerType === 'custom' && isAdvancedMode && (
                                <div className="form-group">
                                    <label htmlFor="customTriggerScript">Custom Trigger Script*</label>
                                    <textarea
                                        id="customTriggerScript"
                                        value={customTriggerScript}
                                        onChange={(e) => setCustomTriggerScript(e.target.value)}
                                        placeholder="Define a custom trigger condition with JavaScript..."
                                        className="code-editor"
                                        rows={8}
                                        disabled={loading}
                                    />
                                    <p className="form-hint">
                                        Example: Write a custom function that evaluates user data to determine if the achievement should be awarded.
                                    </p>
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={resetForm}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="submit-button"
                                    disabled={loading}
                                >
                                    {loading ? <LoadingSpinner /> : editMode ? 'Update Achievement' : 'Create Achievement'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div className="achievements-list-section">
                    <div className="achievements-list-header">
                        <h3>All Achievements</h3>

                        {/* Bulk operations controls */}
                        {achievements.length > 0 && (
                            <div className="bulk-actions">
                                <div className="select-all-container">
                                    <input
                                        type="checkbox"
                                        id="selectAll"
                                        checked={selectAll}
                                        onChange={toggleSelectAll}
                                        disabled={loading || bulkEditMode || bulkDeleteMode}
                                    />
                                    <label htmlFor="selectAll">Select All</label>
                                </div>
                                <div className="bulk-action-buttons">
                                    <button
                                        className="bulk-edit-button"
                                        onClick={enterBulkEditMode}
                                        disabled={loading || selectedAchievements.length === 0 || bulkEditMode || bulkDeleteMode}
                                    >
                                        Bulk Edit
                                    </button>
                                    <button
                                        className="bulk-delete-button"
                                        onClick={enterBulkDeleteMode}
                                        disabled={loading || selectedAchievements.length === 0 || bulkEditMode || bulkDeleteMode}
                                    >
                                        Bulk Delete
                                    </button>
                                </div>
                                {selectedAchievements.length > 0 && (
                                    <div className="selected-count">
                                        {selectedAchievements.length} selected
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {loading && achievements.length === 0 ? (
                        <div className="loading-container">
                            <LoadingSpinner />
                            <p>Loading achievements...</p>
                        </div>
                    ) : (
                        <>
                            <div className="achievements-default-actions">
                                <button
                                    onClick={initializeDefaultAchievements}
                                    className="initialize-defaults-button"
                                    disabled={defaultAchievementsLoading || loading}
                                >
                                    {defaultAchievementsLoading ? <LoadingSpinner /> : 'Initialize Default Achievements'}
                                </button>
                                <p className="form-hint">
                                    This will add all missing default achievements from the predefined list.
                                </p>
                            </div>

                            {achievements.length === 0 ? (
                                <div className="no-achievements-message">
                                    <p>No achievements found. Create your first achievement or initialize the default ones!</p>
                                </div>
                            ) : (
                                <div className="achievements-grid">
                                    {achievements.map(achievement => (
                                        <div
                                            key={achievement.id}
                                            className={`achievement-card ${selectedAchievements.includes(achievement.id) ? 'selected' : ''}`}
                                        >
                                            <div className="achievement-selection">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAchievements.includes(achievement.id)}
                                                    onChange={() => toggleAchievementSelection(achievement.id)}
                                                    disabled={loading || bulkEditMode || bulkDeleteMode}
                                                />
                                            </div>
                                            <div className="achievement-image-container">
                                                <img src={achievement.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(achievement.name)}&background=random&color=fff&size=128`} alt={achievement.name} className="achievement-image" />
                                            </div>
                                            <div className="achievement-info">
                                                <h4 className="achievement-name">{achievement.name}</h4>
                                                <p className="achievement-description">{achievement.description}</p>
                                                <div className="achievement-meta">
                                                    <span className="achievement-points">{achievement.points || 0} pts</span>
                                                    <span className="achievement-trigger-type">{triggerTypes.find(t => t.id === (achievement.triggerConfig?.type || 'manual'))?.name || 'Manual'}</span>
                                                </div>
                                                <div className="achievement-actions">
                                                    <button
                                                        onClick={() => handleEditAchievement(achievement)}
                                                        className="edit-button"
                                                        disabled={loading || bulkEditMode || bulkDeleteMode}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAchievement(achievement)}
                                                        className="delete-button"
                                                        disabled={loading || bulkEditMode || bulkDeleteMode}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AchievementsManagementPanel;