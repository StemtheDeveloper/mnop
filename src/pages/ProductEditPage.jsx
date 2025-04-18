import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, collection, updateDoc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageCropper from '../components/ImageCropper';
import { useToast } from '../context/ToastContext';
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

const ProductEditPage = () => {
    const navigate = useNavigate();
    const { productId } = useParams();
    const { currentUser, userRole } = useUser();
    const { showSuccess, showError } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [product, setProduct] = useState(null);

    // Product form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        fundingGoal: '',
        customCategory: '',
    });

    // Multiple image handling state
    const [productImages, setProductImages] = useState([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
    const [existingImageUrls, setExistingImageUrls] = useState([]);
    const [imagesToDelete, setImagesToDelete] = useState([]);
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

    // Fetch the product data
    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId || !currentUser) return;

            try {
                const productRef = doc(db, 'products', productId);
                const productSnap = await getDoc(productRef);

                if (!productSnap.exists()) {
                    throw new Error('Product not found');
                }

                const productData = productSnap.data();

                // Check if the current user is the designer of this product
                if (productData.designerId !== currentUser.uid) {
                    throw new Error('You do not have permission to edit this product');
                }

                setProduct({
                    id: productSnap.id,
                    ...productData
                });

                // Set form data from product
                setFormData({
                    name: productData.name || '',
                    description: productData.description || '',
                    price: productData.price ? productData.price.toString() : '',
                    category: productData.category || '',
                    fundingGoal: productData.fundingGoal ? productData.fundingGoal.toString() : '',
                    customCategory: productData.categoryType === 'custom' ? productData.category : '',
                });

                // Set useCustomCategory based on categoryType
                setUseCustomCategory(productData.categoryType === 'custom');

                // Set existing image URLs
                if (productData.imageUrls && Array.isArray(productData.imageUrls)) {
                    setExistingImageUrls(productData.imageUrls);
                    setImagePreviewUrls(productData.imageUrls);
                } else if (productData.imageUrl) {
                    // Handle case where only a single imageUrl exists
                    setExistingImageUrls([productData.imageUrl]);
                    setImagePreviewUrls([productData.imageUrl]);
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching product:', err);
                setError(err.message || 'Failed to load product data');
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productId, currentUser]);

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
                }
            } catch (err) {
                console.error('Error fetching categories:', err);
                // Use default categories as fallback
                setCategories(DEFAULT_CATEGORIES);
            } finally {
                setLoadingCategories(false);
            }
        };

        fetchCategories();
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

    // Handle existing image removal
    const handleRemoveExistingImage = (index) => {
        const urlToRemove = existingImageUrls[index];
        setExistingImageUrls(existingImageUrls.filter((_, i) => i !== index));
        setImagePreviewUrls(imagePreviewUrls.filter((_, i) => i !== index));

        // Add URL to list of images to delete on save
        if (urlToRemove) {
            setImagesToDelete([...imagesToDelete, urlToRemove]);
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

            // Check if we've reached the image limit (existing + new)
            if ((existingImageUrls.length + productImages.length) >= MAX_IMAGES) {
                setError(`You can upload a maximum of ${MAX_IMAGES} images`);
                return;
            }

            // Clear previous error
            setError('');

            // Create URL for the cropper
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setCurrentImageIndex(productImages.length); // Set index for the new image
            setShowImageCropper(true);
        }
    };

    // Handle image crop completion
    const handleCropComplete = async (blob) => {
        try {
            setShowImageCropper(false);

            // Create a File from the blob
            const croppedFile = new File([blob], `product-image-${Date.now()}.jpg`, { type: 'image/jpeg' });

            // Add the new image to the array instead of using specific index
            setProductImages(prevImages => [...prevImages, croppedFile]);

            // Create preview URL and add to the end of preview URLs
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

        // Make sure there's at least one image (either existing or new)
        if (existingImageUrls.length === 0 && productImages.length === 0) {
            setError('At least one product image is required');
            return false;
        }

        return true;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Reset error state
        setError('');

        // Validate form
        if (!validateForm()) {
            return;
        }

        setSaving(true);

        try {
            // 1. Upload any new images to Storage
            const newImageUrls = await Promise.all(productImages.map(async (image) => {
                const timestamp = Date.now();
                const fileName = `${timestamp}-product-${Math.random().toString(36).substring(7)}.jpg`;
                const storageRef = ref(storage, `products/${currentUser.uid}/${fileName}`);

                // Upload the file
                await uploadBytes(storageRef, image);

                // Get the download URL
                const imageUrl = await getDownloadURL(storageRef);
                return imageUrl;
            }));

            // 2. Delete any images that were marked for deletion
            // Only attempt to delete if we have storage paths
            if (product.storagePaths && Array.isArray(product.storagePaths)) {
                for (const imageUrl of imagesToDelete) {
                    // Find the storage path that corresponds to this URL
                    const pathIndex = product.imageUrls.indexOf(imageUrl);
                    if (pathIndex >= 0 && pathIndex < product.storagePaths.length) {
                        const storagePath = product.storagePaths[pathIndex];
                        try {
                            const imageRef = ref(storage, storagePath);
                            await deleteObject(imageRef);
                        } catch (deleteError) {
                            console.error('Error deleting image:', deleteError);
                            // Continue with the update even if image deletion fails
                        }
                    }
                }
            }

            // 3. Combine existing (that weren't deleted) and new image URLs
            const allImageUrls = [...existingImageUrls, ...newImageUrls];

            // 4. Update product document in Firestore
            const productData = {
                name: sanitizeString(formData.name),
                description: sanitizeString(formData.description),
                price: parseFloat(formData.price),
                fundingGoal: parseFloat(formData.fundingGoal),
                category: useCustomCategory ? sanitizeString(formData.customCategory.trim()) : sanitizeString(formData.category),
                categoryType: useCustomCategory ? 'custom' : 'standard',
                imageUrls: allImageUrls,
                updatedAt: serverTimestamp()
            };

            // Update the product document
            await updateDoc(doc(db, 'products', productId), productData);

            // Show success message
            showSuccess("Product updated successfully!");

            // Redirect back to product detail or management page
            navigate(`/product/${productId}`);
        } catch (error) {
            console.error('Error updating product:', error);
            setError(error.message || 'Failed to update product. Please try again.');
            showError("Failed to update product");
        } finally {
            setSaving(false);
        }
    };

    // Redirect if user is not a designer
    if (userRole !== null && !isDesigner) {
        return (
            <div className="role-error-container">
                <h2>Designer Access Only</h2>
                <p>You need to have the designer role to edit products.</p>
                <button
                    className="back-button"
                    onClick={() => navigate('/profile')}
                >
                    Go to Profile
                </button>
            </div>
        );
    }

    // Display loading state
    if (loading) {
        return (
            <div className="product-upload-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading product data...</p>
                </div>
            </div>
        );
    }

    // Display error state if product couldn't be loaded
    if (error && !product) {
        return (
            <div className="product-upload-page">
                <div className="product-upload-container">
                    <h1>Edit Product</h1>
                    <div className="error-message">{error}</div>
                    <button
                        className="back-button"
                        onClick={() => navigate(-1)}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="product-upload-page">
            <div className="product-upload-container">
                <h1>Edit Product</h1>

                {error && <div className="error-message">{error}</div>}

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
                                    disabled={saving}
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
                                    disabled={saving}
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
                                        disabled={saving}
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
                                        disabled={saving}
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
                                                disabled={saving}
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
                                                disabled={saving}
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
                                                disabled={saving || loadingCategories || useCustomCategory}
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
                                                disabled={saving || !useCustomCategory}
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
                                    {/* Display existing images */}
                                    {existingImageUrls.map((url, index) => (
                                        <div key={`existing-${index}`} className="image-preview-container">
                                            <img src={url} alt={`Product Preview ${index + 1}`} className="image-preview" />
                                            <button
                                                type="button"
                                                className="remove-image-btn"
                                                onClick={() => handleRemoveExistingImage(index)}
                                                disabled={saving}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}

                                    {/* Display new images */}
                                    {productImages.map((_, index) => (
                                        <div key={`new-${index}`} className="image-preview-container">
                                            <img
                                                src={imagePreviewUrls[existingImageUrls.length + index]}
                                                alt={`New Product Preview ${index + 1}`}
                                                className="image-preview"
                                            />
                                            <button
                                                type="button"
                                                className="remove-image-btn"
                                                onClick={() => {
                                                    setProductImages(prevImages => prevImages.filter((_, i) => i !== index));
                                                    setImagePreviewUrls(prevUrls => {
                                                        const updatedUrls = [...prevUrls];
                                                        updatedUrls.splice(existingImageUrls.length + index, 1);
                                                        return updatedUrls;
                                                    });
                                                }}
                                                disabled={saving}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}

                                    {/* Upload new image button */}
                                    {imagePreviewUrls.length < MAX_IMAGES && (
                                        <div
                                            className="upload-placeholder"
                                            onClick={() => !saving && imageInputRef.current.click()}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                <polyline points="21 15 16 10 5 21"></polyline>
                                            </svg>
                                            <p>Add image</p>
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
                                    disabled={saving}
                                />
                            </div>

                            {product && (
                                <div className="product-status-info">
                                    <h3>Product Status</h3>
                                    <div className={`status-badge status-${product.status || 'pending'}`}>
                                        {product.status || 'Pending'}
                                    </div>

                                    {product.fundingGoal > 0 && (
                                        <div className="funding-progress">
                                            <p>
                                                {(product.currentFunding || 0) > 0
                                                    ? `${Math.round((product.currentFunding / product.fundingGoal) * 100)}% Funded`
                                                    : 'No funding yet'}
                                            </p>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress"
                                                    style={{ width: `${Math.min(((product.currentFunding || 0) / product.fundingGoal) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    <p className="hint-text">
                                        Note: Editing this product may require re-approval if product approval is required.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() => navigate(-1)}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="submit-button"
                            disabled={saving}
                        >
                            {saving ? <LoadingSpinner /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductEditPage;