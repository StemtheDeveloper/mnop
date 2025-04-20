import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, collection, addDoc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageCropper from '../components/ImageCropper';
import useAchievements from '../hooks/useAchievements';
import { sanitizeString, sanitizeFormData } from '../utils/sanitizer';
import '../styles/ProductUpload.css';

// Default categories in case Firestore fetch fails
const DEFAULT_CATEGORIES = [
    { id: 'furniture', name: 'Furniture' },
    { id: 'electronics', name: 'Electronics' },
    { id: 'clothing', name: 'Clothing' },
    { id: 'kitchenware', name: 'Kitchenware' },
    { id: 'toys', name: 'Toys & Games' },
    { id: 'decor', name: 'Home Decor' },
    { id: 'gadgets', name: 'Gadgets' },
    { id: 'outdoor', name: 'Outdoor' }
];

const MAX_IMAGES = 5; // Maximum number of images allowed

const ProductUploadPage = () => {
    const navigate = useNavigate();
    const { currentUser, userRole, userProfile } = useUser();
    const { checkProductAchievements } = useAchievements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [requireApproval, setRequireApproval] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');

    // Product form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        fundingGoal: '',
        customCategory: '',  // New field for custom category
    });

    // Multiple image handling state
    const [productImages, setProductImages] = useState([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
    const [showImageCropper, setShowImageCropper] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState('');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const imageInputRef = useRef(null);

    // Categories state
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [useCustomCategory, setUseCustomCategory] = useState(false);

    // Check if user has designer role
    const isDesigner = userRole && (
        typeof userRole === 'string' ?
            userRole === 'designer' :
            Array.isArray(userRole) && userRole.includes('designer')
    );

    // Fetch categories on component mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesRef = collection(db, 'categories');
                const snapshot = await getDocs(categoriesRef);
                const categoriesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Use fetched categories if available, otherwise use defaults
                if (categoriesData.length > 0) {
                    setCategories(categoriesData);
                } else {
                    setCategories(DEFAULT_CATEGORIES);
                    console.log('Using default categories as fallback');
                }
            } catch (err) {
                console.error('Error fetching categories:', err);
                // Use default categories as fallback
                setCategories(DEFAULT_CATEGORIES);
                console.log('Using default categories due to fetch error');
            } finally {
                setLoadingCategories(false);
            }
        };

        fetchCategories();
    }, []);

    // Fetch approval setting on component mount
    useEffect(() => {
        const fetchApprovalSetting = async () => {
            try {
                const settingsRef = doc(db, 'settings', 'productSettings');
                const settingsSnap = await getDoc(settingsRef);

                if (settingsSnap.exists()) {
                    setRequireApproval(settingsSnap.data().requireApproval ?? true);
                }
            } catch (err) {
                console.error('Error fetching approval settings:', err);
                // Default to requiring approval if there's an error
            }
        };

        fetchApprovalSetting();
    }, []);

    // Handle form input changes
    const handleChange = (e) => {
        const { name, value } = e.target;

        // Special handling for price and fundingGoal to ensure they're numeric
        if (name === 'price' || name === 'fundingGoal') {
            // Allow only numbers and decimal point
            const numericValue = value.replace(/[^0-9.]/g, '');
            // Ensure only one decimal point
            const parts = numericValue.split('.');
            const formattedValue = parts.length > 1
                ? `${parts[0]}.${parts.slice(1).join('')}`
                : numericValue;

            setFormData({ ...formData, [name]: formattedValue });
        }
        // Handle category selection with special case for 'custom'
        else if (name === 'category') {
            if (value === 'custom') {
                setUseCustomCategory(true);
                setFormData({ ...formData, [name]: value });
            } else {
                setUseCustomCategory(false);
                setFormData({ ...formData, [name]: value });
            }
        }
        else {
            setFormData({ ...formData, [name]: sanitizeString(value) });
        }
    };

    // Toggle custom category
    const toggleCustomCategory = () => {
        const newValue = !useCustomCategory;
        setUseCustomCategory(newValue);
        if (newValue) {
            setFormData(prev => ({ ...prev, category: 'custom' }));
        } else {
            setFormData(prev => ({ ...prev, category: '', customCategory: '' }));
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

            // Validate file type
            if (!file.type.match('image.*')) {
                setError('Only image files are allowed');
                return;
            }

            // Check if we've reached the image limit
            if (productImages.length >= MAX_IMAGES) {
                setError(`You can upload a maximum of ${MAX_IMAGES} images`);
                return;
            }

            // Clear previous error
            setError('');

            // Create URL for the cropper
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setShowImageCropper(true);
        }
    };

    // Handle image crop completion
    const handleCropComplete = async (blob) => {
        try {
            setShowImageCropper(false);

            // Create a File from the blob
            const croppedFile = new File([blob], `product-image-${Date.now()}.jpg`, { type: 'image/jpeg' });

            // Add the new image to the array
            setProductImages(prevImages => [...prevImages, croppedFile]);

            // Create preview URL
            const previewUrl = URL.createObjectURL(blob);
            setImagePreviewUrls(prevUrls => [...prevUrls, previewUrl]);

            // Reset file input to allow selecting the same file again
            if (imageInputRef.current) {
                imageInputRef.current.value = "";
            }
        } catch (error) {
            console.error("Error processing cropped image:", error);
            setError('Error processing the cropped image');
        }
    };

    // Validate form before submission
    const validateForm = () => {
        if (!formData.name.trim()) {
            setError('Product name is required');
            return false;
        }

        if (!formData.description.trim()) {
            setError('Product description is required');
            return false;
        }

        if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
            setError('Please enter a valid price');
            return false;
        }

        // Validate category: either regular category is selected or custom category is provided
        if (useCustomCategory) {
            if (!formData.customCategory.trim()) {
                setError('Please enter a custom category');
                return false;
            }
        } else if (!formData.category) {
            setError('Please select a category');
            return false;
        }

        if (!formData.fundingGoal || isNaN(parseFloat(formData.fundingGoal)) || parseFloat(formData.fundingGoal) <= 0) {
            setError('Please enter a valid funding goal');
            return false;
        }

        if (productImages.length === 0) {
            setError('At least one product image is required');
            return false;
        }

        return true;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Reset error and success states
        setError('');
        setSuccess(false);

        // Validate form
        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            // Track storage paths for uploaded files to store them later
            const storagePaths = [];
            const imageUrls = [];

            // 1. Upload images to Storage with properly structured path
            for (let i = 0; i < productImages.length; i++) {
                const image = productImages[i];
                const timestamp = Date.now();
                const fileName = `${timestamp}-product-${i}.jpg`;
                const storagePath = `products/${currentUser.uid}/${fileName}`;

                // Add storage path to the array
                storagePaths.push(storagePath);

                // Create storage reference
                const storageRef = ref(storage, storagePath);

                // Upload file
                await uploadBytes(storageRef, image);

                // Get download URL
                const imageUrl = await getDownloadURL(storageRef);
                imageUrls.push(imageUrl);

                console.log(`Image ${i + 1} uploaded: ${imageUrl}`);
            }

            // 2. Create product document in Firestore with the image URLs
            const productData = {
                name: sanitizeString(formData.name),
                description: sanitizeString(formData.description),
                price: parseFloat(formData.price),
                fundingGoal: parseFloat(formData.fundingGoal),
                category: useCustomCategory ? sanitizeString(formData.customCategory.trim()) : formData.category,
                categoryType: useCustomCategory ? 'custom' : 'standard',
                imageUrls: imageUrls, // Store all image URLs from Firebase Storage
                designerId: currentUser.uid,
                designerName: userProfile?.displayName || 'Designer',
                status: requireApproval ? 'pending' : 'active', // Set status based on approval setting
                currentFunding: 0, // Initial funding amount
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                storagePaths: storagePaths // Store the correct paths for future reference
            };

            console.log('Creating Firestore document with data:', {
                ...productData,
                imageUrls: imageUrls,
                storagePaths: storagePaths,
                imageCount: imageUrls.length
            });

            // If it's a custom category, add it to the categories collection
            if (useCustomCategory && formData.customCategory.trim()) {
                const customCategoryData = {
                    name: sanitizeString(formData.customCategory.trim()),
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.uid,
                    type: 'user-created'
                };

                try {
                    const categoryRef = await addDoc(collection(db, 'categories'), customCategoryData);
                    console.log('Added custom category with ID:', categoryRef.id);

                    // Use the new category ID instead
                    productData.category = categoryRef.id;
                    productData.categoryType = 'standard'; // now it's stored in the database
                } catch (categoryError) {
                    console.error('Failed to add custom category, using text value instead:', categoryError);
                }
            }

            const docRef = await addDoc(collection(db, 'products'), productData);
            console.log('Firestore document created with ID:', docRef.id);

            // Success message based on approval setting
            if (requireApproval) {
                setSuccess(true);
                setSuccessMessage("Product submitted for approval! It will appear in the shop once approved.");
            } else {
                setSuccess(true);
                setSuccessMessage("Product created successfully! It is now live in the shop.");
            }

            // Success! Reset form and show success message
            setFormData({
                name: '',
                description: '',
                price: '',
                category: '',
                customCategory: '',
                fundingGoal: '',
            });
            setProductImages([]);
            setImagePreviewUrls([]);
            setUseCustomCategory(false);

            // On successful upload, check for achievements
            await checkProductAchievements();

            // Redirect to the new product page after a delay
            setTimeout(() => {
                navigate(`/product/${docRef.id}`);
            }, 2000);

        } catch (error) {
            console.error('Error creating product:', error);

            // More detailed error handling
            let errorMessage = 'Failed to create product. Please try again.';

            // Check for specific Firebase errors
            if (error.code) {
                if (error.code.includes('storage/unauthorized')) {
                    errorMessage = 'You do not have permission to upload images. Please check your account permissions.';
                } else if (error.code.includes('storage/quota-exceeded')) {
                    errorMessage = 'Storage quota exceeded. Please contact support.';
                } else if (error.code.includes('storage/')) {
                    errorMessage = `Storage error: ${error.message}`;
                } else if (error.code.includes('firestore/')) {
                    errorMessage = `Database error: ${error.message}`;
                }
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Redirect if user is not a designer
    if (userRole !== null && !isDesigner) {
        return (
            <div className="role-error-container">
                <h2>Designer Access Only</h2>
                <p>You need to have the designer role to upload products.</p>
                <button
                    className="back-button"
                    onClick={() => navigate('/profile')}
                >
                    Go to Profile
                </button>
            </div>
        );
    }

    return (
        <div className="product-upload-page">
            <div className="product-upload-container">
                <h1>Upload New Product</h1>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">
                    {successMessage || "Product created successfully! Redirecting..."}
                </div>}

                {showImageCropper && (
                    <ImageCropper
                        imageUrl={cropImageSrc}
                        aspect={1}
                        onCropComplete={handleCropComplete}
                        onCancel={() => {
                            setShowImageCropper(false);
                            URL.revokeObjectURL(cropImageSrc);
                        }}
                    />
                )}

                <form onSubmit={handleSubmit} className="product-form">
                    <div className="form-layout">
                        <div className="form-left">
                            <div className="form-group">
                                <label htmlFor="name">Product Name*</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter product name"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Description*</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Describe your product"
                                    disabled={loading}
                                    rows="6"
                                ></textarea>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="price">Price ($)*</label>
                                    <input
                                        type="text"
                                        id="price"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="fundingGoal">Funding Goal ($)*</label>
                                    <input
                                        type="text"
                                        id="fundingGoal"
                                        name="fundingGoal"
                                        value={formData.fundingGoal}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <div className="category-selection">
                                    <div className="category-toggle">
                                        <label htmlFor="useExistingCategory">
                                            <input
                                                type="radio"
                                                id="useExistingCategory"
                                                name="categoryToggle"
                                                checked={!useCustomCategory}
                                                onChange={() => toggleCustomCategory()}
                                                disabled={loading}
                                            />
                                            Use existing category
                                        </label>
                                        <label htmlFor="useCustomCategory">
                                            <input
                                                type="radio"
                                                id="useCustomCategory"
                                                name="categoryToggle"
                                                checked={useCustomCategory}
                                                onChange={() => toggleCustomCategory()}
                                                disabled={loading}
                                            />
                                            Create custom category
                                        </label>
                                    </div>

                                    {!useCustomCategory ? (
                                        <>
                                            <label htmlFor="category">Category*</label>
                                            <select
                                                id="category"
                                                name="category"
                                                value={formData.category}
                                                onChange={handleChange}
                                                disabled={loading || loadingCategories || useCustomCategory}
                                            >
                                                <option value="">Select a category</option>
                                                {categories.map(category => (
                                                    <option key={category.id} value={category.id}>
                                                        {category.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {loadingCategories && <span className="loading-text">Loading categories...</span>}
                                        </>
                                    ) : (
                                        <>
                                            <label htmlFor="customCategory">Custom Category*</label>
                                            <input
                                                type="text"
                                                id="customCategory"
                                                name="customCategory"
                                                value={formData.customCategory}
                                                onChange={handleChange}
                                                placeholder="Enter a new category name"
                                                disabled={loading || !useCustomCategory}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-right">
                            <div className="form-group image-upload">
                                <label>Product Images* ({imagePreviewUrls.length}/{MAX_IMAGES})</label>
                                <div className="image-upload-area">
                                    {imagePreviewUrls.map((url, index) => (
                                        <div key={index} className="image-preview-container">
                                            <img src={url} alt={`Product Preview ${index + 1}`} className="image-preview" />
                                            <button
                                                type="button"
                                                className="remove-image-btn"
                                                onClick={() => {
                                                    setProductImages(prevImages => prevImages.filter((_, i) => i !== index));
                                                    setImagePreviewUrls(prevUrls => prevUrls.filter((_, i) => i !== index));
                                                }}
                                                disabled={loading}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    {productImages.length < MAX_IMAGES && (
                                        <div
                                            className="upload-placeholder"
                                            onClick={() => !loading && imageInputRef.current.click()}
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
                                    ref={imageInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() => navigate(-1)}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="submit-button"
                            disabled={loading}
                        >
                            {loading ? <LoadingSpinner /> : 'Upload Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductUploadPage;
