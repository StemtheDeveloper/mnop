import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, collection, updateDoc, getDoc, getDocs, serverTimestamp, addDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageCropper from '../components/ImageCropper';
import { useToast } from '../contexts/ToastContext';
import { sanitizeString, sanitizeFormData } from '../utils/sanitizer';
import useLocalStorageForm from '../hooks/useLocalStorageForm'; // Import the new hook
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
    const { currentUser, userRoles, hasRole } = useUser(); // Use userRoles and hasRole function
    const { success, error } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorState, setErrorState] = useState('');
    const [product, setProduct] = useState(null);
    const [originalProductData, setOriginalProductData] = useState(null); // Store original product data for comparison

    // Multiple image handling state
    const [productImages, setProductImages] = useState([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
    const [existingImageUrls, setExistingImageUrls] = useState([]);
    const [imagesToDelete, setImagesToDelete] = useState([]);
    const [showImageCropper, setShowImageCropper] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState('');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const imageInputRef = useRef(null);

    // Default form state - will be populated from the product data
    const defaultFormData = {
        name: '',
        description: '',
        price: '',
        fundingGoal: '',
        category: '',
        categories: [],
        customCategory: '',
        isCrowdfunded: true,
        manufacturingCost: '',
        stockQuantity: '0',
        lowStockThreshold: '5',
        trackInventory: false,
        // Add shipping related fields
        customShipping: false,
        standardShippingCost: '',
        expressShippingCost: '',
        freeShipping: false,
        freeShippingThreshold: '',
        shippingProvider: 'standard',
        customProviderName: ''
    };

    // Categories state
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [useCustomCategory, setUseCustomCategory] = useState(false);

    // Use our custom localStorage form hook
    const formStorageKey = `product_edit_${productId}_${currentUser?.uid}`;
    const {
        formData,
        setFormData,
        hasChanges,
        handleChange: handleFormChange,
        updateFormData,
        clearStoredData,
        resetForm
    } = useLocalStorageForm(formStorageKey, defaultFormData, originalProductData, sanitizeString);

    // Check if user has designer role or admin role using the hasRole function
    const isDesigner = hasRole('designer') || hasRole('admin');

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

                // Check if the current user is the designer of this product or an admin
                const isAdmin = hasRole('admin');
                const isProductDesigner = productData.designerId === currentUser.uid;

                // Log user and product info for debugging authorization issues
                console.log('Product Edit Authorization Check:', {
                    currentUserId: currentUser.uid,
                    productDesignerId: productData.designerId,
                    userRoles: userRoles,
                    isAdmin,
                    isProductDesigner
                });

                if (!isProductDesigner && !isAdmin) {
                    throw new Error('You do not have permission to edit this product');
                }

                setProduct({
                    id: productSnap.id,
                    ...productData
                });

                // Store original product data for change detection
                const originalData = {
                    name: productData.name || '',
                    description: productData.description || '',
                    price: productData.price ? productData.price.toString() : '',
                    category: productData.category || '',
                    categories: productData.categories || [productData.category || ''],
                    fundingGoal: productData.fundingGoal ? productData.fundingGoal.toString() : '',
                    customCategory: productData.categoryType === 'custom' ? productData.category : '',
                    isCrowdfunded: productData.isCrowdfunded !== false,
                    manufacturingCost: productData.manufacturingCost ? productData.manufacturingCost.toString() : '',
                    trackInventory: productData.trackInventory || false,
                    stockQuantity: productData.stockQuantity ? productData.stockQuantity.toString() : '0',
                    lowStockThreshold: productData.lowStockThreshold ? productData.lowStockThreshold.toString() : '5',
                    customShipping: productData.customShipping || false,
                    standardShippingCost: productData.standardShippingCost ? productData.standardShippingCost.toString() : '',
                    expressShippingCost: productData.expressShippingCost ? productData.expressShippingCost.toString() : '',
                    freeShipping: productData.freeShipping || false,
                    freeShippingThreshold: productData.freeShippingThreshold ? productData.freeShippingThreshold.toString() : '',
                    shippingProvider: productData.shippingProvider || 'standard',
                    customProviderName: productData.customProviderName || ''
                };
                setOriginalProductData(originalData);

                // Set form data (our hook will use localStorage value if available)
                updateFormData(originalData);

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
                setErrorState(err.message || 'Failed to load product data');
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productId, currentUser, updateFormData, userRoles, hasRole]);

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

    // Handle form input changes - now using our custom hook
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        // Special handling for price and fundingGoal to ensure they're numeric
        if (name === 'price' || name === 'fundingGoal') {
            // Allow only numbers and decimal point
            const numericValue = value.replace(/[^0-9.]/g, '');
            // Ensure only one decimal point
            const parts = numericValue.split('.');
            const formattedValue = parts.length > 1
                ? `${parts[0]}.${parts.slice(1).join('')}`
                : numericValue;

            updateFormData({ [name]: formattedValue });
        }
        // Handle category selection with special case for 'custom'
        else if (name === 'category') {
            if (value === 'custom') {
                setUseCustomCategory(true);
                updateFormData({ [name]: value });
            } else {
                setUseCustomCategory(false);
                updateFormData({ [name]: value });
            }
        }
        // Handle checkbox inputs
        else if (type === 'checkbox') {
            updateFormData({ [name]: checked });
        }
        else {
            // Use the handleFormChange from our hook for other fields
            handleFormChange(e);
        }
    };

    // Toggle product type (crowdfunded vs. direct sell)
    const handleProductTypeToggle = (e) => {
        const isCrowdfunded = e.target.value === 'crowdfunded';
        updateFormData({ isCrowdfunded });
    };

    // Handle category selection (for multi-select)
    const handleCategoryChange = (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);

        // Update both the categories array and the category field for backward compatibility
        const primaryCategory = selectedOptions.length > 0 ? selectedOptions[0] : '';

        updateFormData({
            categories: selectedOptions,
            category: primaryCategory // Keep first selected category in the single category field
        });
    };

    // Toggle custom category
    const toggleCustomCategory = () => {
        const newValue = !useCustomCategory;
        setUseCustomCategory(newValue);
        if (newValue) {
            updateFormData({ category: 'custom' });
        } else {
            updateFormData({
                category: '',
                customCategory: ''
            });
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
                setErrorState('Image size exceeds 5MB limit');
                return;
            }

            // Validate file type
            if (!file.type.match('image.*')) {
                setErrorState('Only image files are allowed');
                return;
            }

            // Check if we've reached the image limit (existing + new)
            if ((existingImageUrls.length + productImages.length) >= MAX_IMAGES) {
                setErrorState(`You can upload a maximum of ${MAX_IMAGES} images`);
                return;
            }

            // Clear previous error
            setErrorState('');

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
            setErrorState('Error processing the cropped image');
        }
    };

    // Validate form before submission
    const validateForm = () => {
        if (!formData.name.trim()) {
            setErrorState('Product name is required');
            return false;
        }

        if (!formData.description.trim()) {
            setErrorState('Product description is required');
            return false;
        }

        if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
            setErrorState('Please enter a valid price');
            return false;
        }

        // Validate category: either regular categories are selected or custom category is provided
        if (useCustomCategory) {
            if (!formData.customCategory.trim()) {
                setErrorState('Please enter a custom category');
                return false;
            }
        } else if (formData.categories.length === 0) {
            setErrorState('Please select at least one category');
            return false;
        }

        // Only validate funding goal for crowdfunded products
        if (formData.isCrowdfunded) {
            if (!formData.fundingGoal || isNaN(parseFloat(formData.fundingGoal)) || parseFloat(formData.fundingGoal) <= 0) {
                setErrorState('Please enter a valid funding goal');
                return false;
            }
        }

        // Make sure there's at least one image (either existing or new)
        if (existingImageUrls.length === 0 && productImages.length === 0) {
            setErrorState('At least one product image is required');
            return false;
        }

        return true;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Reset error state
        setErrorState('');

        // Validate form
        if (!validateForm()) {
            return;
        }

        // Check if there are actual changes to save
        if (!hasChanges && productImages.length === 0 && imagesToDelete.length === 0) {
            success("No changes detected. Nothing to save.");
            navigate(`/product/${productId}`);
            return;
        }

        setSaving(true);

        try {
            // 1. Upload any new images to Storage
            const newImageUrls = await Promise.all(productImages.map(async (image) => {
                const timestamp = Date.now();
                const fileName = `${timestamp}-product-${Math.random().toString(36).substring(7)}.jpg`;
                const imagePath = `products/${productId}/${fileName}`;
                const imageRef = ref(storage, imagePath);

                await uploadBytes(imageRef, image);
                const downloadUrl = await getDownloadURL(imageRef);

                return downloadUrl;
            }));

            // 2. Delete any images marked for deletion
            for (const imageUrl of imagesToDelete) {
                try {
                    // Extract the path from the URL
                    const decodedUrl = decodeURIComponent(imageUrl);
                    const urlParts = decodedUrl.split('/o/')[1]?.split('?')[0];

                    if (urlParts) {
                        const storagePath = urlParts.replace(/%2F/g, '/');
                        const imageRef = ref(storage, storagePath);
                        await deleteObject(imageRef);
                        console.log(`Deleted image: ${storagePath}`);
                    }
                } catch (deleteErr) {
                    console.warn(`Failed to delete image ${imageUrl}`, deleteErr);
                    // Continue with the update even if image deletion fails
                }
            }

            // 3. Combine existing (that weren't deleted) and new image URLs
            const allImageUrls = [...existingImageUrls, ...newImageUrls];

            // 4. If it's a custom category, add it to the categories collection
            let categoryToUse = formData.category;
            let categoryTypeToUse = 'standard';

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
                    categoryToUse = categoryRef.id;
                    categoryTypeToUse = 'standard'; // now it's stored in the database
                } catch (categoryError) {
                    console.error('Failed to add custom category, using text value instead:', categoryError);
                    categoryToUse = sanitizeString(formData.customCategory.trim());
                    categoryTypeToUse = 'custom';
                }
            }

            // 5. Check if approval is required for edited products
            let productStatus = product.status; // Default to current status
            let statusMessage = "Product updated successfully!";

            // Check product approval setting
            const settingsRef = doc(db, 'settings', 'productSettings');
            const settingsSnap = await getDoc(settingsRef);
            const requireApproval = settingsSnap.exists() ?
                (settingsSnap.data().requireApproval ?? true) : true;

            // If approval is required and the product was active, change to pending
            if (requireApproval && productStatus === 'active') {
                productStatus = 'pending';
                statusMessage = "Product updated successfully and sent for review. It will be hidden from the shop until approved.";
            }

            // 6. Update product document in Firestore
            const productData = {
                name: sanitizeString(formData.name),
                description: sanitizeString(formData.description),
                price: parseFloat(formData.price),
                // Handle direct selling products appropriately
                fundingGoal: formData.isCrowdfunded ? parseFloat(formData.fundingGoal) : 0,
                manufacturingCost: parseFloat(formData.manufacturingCost), // Add manufacturing cost
                category: categoryToUse,
                categories: useCustomCategory ? [categoryToUse] : formData.categories, // Store multiple categories
                categoryType: categoryTypeToUse,
                imageUrls: allImageUrls,
                updatedAt: serverTimestamp(),
                status: productStatus,
                wasEdited: true, // Flag to indicate this was an edit
                lastEditedAt: serverTimestamp(),
                isCrowdfunded: formData.isCrowdfunded, // Store whether product is crowdfunded
                isDirectSell: !formData.isCrowdfunded, // Flag for direct selling products
                // For direct selling products, set currentFunding equal to price (mark as ready to purchase)
                currentFunding: formData.isCrowdfunded ? product.currentFunding || 0 : parseFloat(formData.price)
            };

            // Add stock management fields if tracking inventory
            if (formData.trackInventory) {
                productData.stockQuantity = parseInt(formData.stockQuantity) || 0;
                productData.lowStockThreshold = parseInt(formData.lowStockThreshold) || 5;
                productData.trackInventory = true;
            } else {
                productData.trackInventory = false;
                // Keep stockQuantity if it exists, but mark as not tracked
            }

            // Add shipping settings to product data if custom shipping is enabled
            if (formData.customShipping) {
                productData.customShipping = true;
                productData.standardShippingCost = parseFloat(formData.standardShippingCost) || 10;
                productData.expressShippingCost = parseFloat(formData.expressShippingCost) || 25;
                productData.freeShipping = formData.freeShipping;
                productData.freeShippingThreshold = parseFloat(formData.freeShippingThreshold) || 0;
                productData.shippingProvider = formData.shippingProvider;

                if (formData.shippingProvider === 'custom') {
                    productData.customProviderName = formData.customProviderName;
                }
            } else {
                // If custom shipping is disabled, remove any previously set custom shipping values
                productData.customShipping = false;
            }

            // Update the product document
            await updateDoc(doc(db, 'products', productId), productData);

            // 7. Notify admins if the product needs approval
            if (productStatus === 'pending') {
                // Get all admin users
                const usersRef = collection(db, 'users');
                const adminQuery = query(usersRef, where('roles', 'array-contains', 'admin'));
                const adminSnapshot = await getDocs(adminQuery);

                // Create notifications for each admin
                for (const adminDoc of adminSnapshot.docs) {
                    const adminId = adminDoc.id;

                    await addDoc(collection(db, 'notifications'), {
                        userId: adminId,
                        title: 'Product Edit Needs Review',
                        message: `An edited product "${formData.name}" needs approval before returning to the shop.`,
                        type: 'product_edit_pending',
                        productId: productId,
                        read: false,
                        createdAt: serverTimestamp()
                    });
                }
            }

            // Clear local storage data after successful save
            clearStoredData();

            // Show success message
            success(statusMessage);

            // Redirect back to product detail or management page
            navigate(`/product/${productId}`);
        } catch (error) {
            console.error('Error updating product:', error);
            setErrorState(error.message || 'Failed to update product. Please try again.');
            error("Failed to update product");
        } finally {
            setSaving(false);
        }
    };

    // React form cancel button handler
    const handleCancel = () => {
        // Ask for confirmation if there are unsaved changes
        if (hasChanges || productImages.length > 0 || imagesToDelete.length > 0) {
            if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                clearStoredData();
                navigate(-1);
            }
        } else {
            navigate(-1);
        }
    };

    // Redirect if user is not a designer or admin
    if (userRoles !== null && !isDesigner) {
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
    if (errorState && !product) {
        return (
            <div className="product-upload-page">
                <div className="product-upload-container">
                    <h1>Edit Product</h1>
                    <div className="error-message">{errorState}</div>
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

                {errorState && <div className="error-message">{errorState}</div>}

                {/* Display changes indicator if there are unsaved changes */}
                {hasChanges && (
                    <div className="changes-indicator">
                        You have unsaved changes
                    </div>
                )}

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
                            <div className="form-group product-type-selection">
                                <label>Product Type*</label>
                                <div className="product-type-toggle">
                                    <label htmlFor="productTypeCrowdfunded">
                                        <input
                                            type="radio"
                                            id="productTypeCrowdfunded"
                                            name="productType"
                                            value="crowdfunded"
                                            checked={formData.isCrowdfunded}
                                            onChange={handleProductTypeToggle}
                                            disabled={saving}
                                        />
                                        Crowdfunded Product
                                    </label>
                                    <label htmlFor="productTypeDirect">
                                        <input
                                            type="radio"
                                            id="productTypeDirect"
                                            name="productType"
                                            value="direct"
                                            checked={!formData.isCrowdfunded}
                                            onChange={handleProductTypeToggle}
                                            disabled={saving}
                                        />
                                        Direct Selling (Existing Product)
                                    </label>
                                </div>
                                <p className="form-hint">
                                    {formData.isCrowdfunded
                                        ? "Crowdfunded products need to reach a funding goal before they can be purchased."
                                        : "Direct selling products are immediately available for purchase without funding."}
                                </p>
                            </div>

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

                                {formData.isCrowdfunded && (
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
                                )}
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="manufacturingCost">Manufacturing Cost per Unit ($)*</label>
                                    <input
                                        type="text"
                                        id="manufacturingCost"
                                        name="manufacturingCost"
                                        value={formData.manufacturingCost}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        disabled={saving}
                                    />
                                    <p className="form-hint">
                                        This is the cost to produce each unit. It's used to calculate profits and investor revenue sharing.
                                    </p>
                                </div>
                            </div>

                            <div className="form-group stock-management">
                                <h3>Stock Management</h3>

                                <div className="stock-tracking-toggle">
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="trackInventory"
                                            checked={formData.trackInventory}
                                            onChange={(e) => setFormData({ ...formData, trackInventory: e.target.checked })}
                                            disabled={saving}
                                        />
                                        Track inventory for this product
                                    </label>
                                    <p className="form-hint">
                                        Enable to track stock levels and receive notifications when inventory is low.
                                    </p>
                                </div>

                                {formData.trackInventory && (
                                    <div className="stock-fields">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label htmlFor="stockQuantity">Stock Quantity*</label>
                                                <input
                                                    type="number"
                                                    id="stockQuantity"
                                                    name="stockQuantity"
                                                    value={formData.stockQuantity}
                                                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                                                    placeholder="0"
                                                    min="0"
                                                    disabled={saving}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="lowStockThreshold">Low Stock Threshold</label>
                                                <input
                                                    type="number"
                                                    id="lowStockThreshold"
                                                    name="lowStockThreshold"
                                                    value={formData.lowStockThreshold}
                                                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                                                    placeholder="5"
                                                    min="0"
                                                    disabled={saving}
                                                />
                                                <p className="form-hint">
                                                    You'll be notified when stock reaches this level.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-group shipping-settings">
                                <h3>Shipping Settings</h3>

                                <div className="shipping-toggle">
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="customShipping"
                                            checked={formData.customShipping}
                                            onChange={(e) => setFormData({ ...formData, customShipping: e.target.checked })}
                                            disabled={saving}
                                        />
                                        Use custom shipping for this product (override default settings)
                                    </label>
                                    <p className="form-hint">
                                        Enable to set shipping costs specifically for this product, overriding your default shipping settings.
                                    </p>
                                </div>

                                {formData.customShipping && (
                                    <div className="shipping-fields">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label htmlFor="standardShippingCost">Standard Shipping Cost ($)</label>
                                                <input
                                                    type="number"
                                                    id="standardShippingCost"
                                                    name="standardShippingCost"
                                                    value={formData.standardShippingCost}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        standardShippingCost: e.target.value
                                                    })}
                                                    placeholder="10.00"
                                                    min="0"
                                                    step="0.01"
                                                    disabled={saving}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="expressShippingCost">Express Shipping Cost ($)</label>
                                                <input
                                                    type="number"
                                                    id="expressShippingCost"
                                                    name="expressShippingCost"
                                                    value={formData.expressShippingCost}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        expressShippingCost: e.target.value
                                                    })}
                                                    placeholder="25.00"
                                                    min="0"
                                                    step="0.01"
                                                    disabled={saving}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group checkbox">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    name="freeShipping"
                                                    checked={formData.freeShipping}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        freeShipping: e.target.checked
                                                    })}
                                                    disabled={saving}
                                                />
                                                Offer free shipping for this product
                                            </label>
                                        </div>

                                        {!formData.freeShipping && (
                                            <div className="form-group">
                                                <label htmlFor="freeShippingThreshold">Free Shipping Threshold ($)</label>
                                                <input
                                                    type="number"
                                                    id="freeShippingThreshold"
                                                    name="freeShippingThreshold"
                                                    value={formData.freeShippingThreshold}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        freeShippingThreshold: e.target.value
                                                    })}
                                                    placeholder="50.00"
                                                    min="0"
                                                    step="0.01"
                                                    disabled={saving}
                                                />
                                                <p className="form-hint">
                                                    Orders that include this product will receive free shipping if the total order amount exceeds this threshold.
                                                </p>
                                            </div>
                                        )}

                                        <div className="form-group">
                                            <label htmlFor="shippingProvider">Shipping Provider</label>
                                            <select
                                                id="shippingProvider"
                                                name="shippingProvider"
                                                value={formData.shippingProvider}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        shippingProvider: value,
                                                        customProviderName: value === 'custom' ? formData.customProviderName : ''
                                                    });
                                                }}
                                                disabled={saving}
                                            >
                                                <option value="standard">Standard Shipping</option>
                                                <option value="usps">USPS</option>
                                                <option value="ups">UPS</option>
                                                <option value="fedex">FedEx</option>
                                                <option value="amazon">Amazon Logistics</option>
                                                <option value="dhl">DHL</option>
                                                <option value="custom">Custom Provider</option>
                                            </select>
                                        </div>

                                        {formData.shippingProvider === 'custom' && (
                                            <div className="form-group">
                                                <label htmlFor="customProviderName">Custom Provider Name</label>
                                                <input
                                                    type="text"
                                                    id="customProviderName"
                                                    name="customProviderName"
                                                    value={formData.customProviderName}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        customProviderName: e.target.value
                                                    })}
                                                    placeholder="Enter shipping provider name"
                                                    disabled={saving || formData.shippingProvider !== 'custom'}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                            <label htmlFor="categories">Categories* (Hold Ctrl/Cmd to select multiple)</label>
                                            <select
                                                id="categories"
                                                name="categories"
                                                multiple
                                                size={Math.min(5, categories.length)}
                                                value={formData.categories}
                                                onChange={handleCategoryChange}
                                                disabled={saving || loadingCategories || useCustomCategory}
                                                className="multi-select"
                                            >
                                                {categories.map(category => (
                                                    <option key={category.id} value={category.id}>
                                                        {category.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {formData.categories.length > 0 && (
                                                <div className="selected-categories">
                                                    <p>Selected: {formData.categories.map(catId => {
                                                        const category = categories.find(c => c.id === catId);
                                                        return category ? category.name : catId;
                                                    }).join(', ')}</p>
                                                </div>
                                            )}
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
                            onClick={handleCancel}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="submit-button"
                            disabled={saving || (!hasChanges && productImages.length === 0 && imagesToDelete.length === 0)}
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