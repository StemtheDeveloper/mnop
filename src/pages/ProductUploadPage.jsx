import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, collection, addDoc, serverTimestamp, getDocs, getDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageCropper from '../components/ImageCropper';
import { useToast } from '../context/ToastContext';
import { sanitizeString } from '../utils/sanitizer';
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

// Default shipping providers
const DEFAULT_SHIPPING_PROVIDERS = [
    { id: 'standard', name: 'Standard Shipping' },
    { id: 'usps', name: 'USPS' },
    { id: 'ups', name: 'UPS' },
    { id: 'fedex', name: 'FedEx' },
    { id: 'amazon', name: 'Amazon Logistics' },
    { id: 'dhl', name: 'DHL' },
    { id: 'custom', name: 'Custom Provider' }
];

const MAX_IMAGES = 5; // Maximum number of images allowed

// Helper function to calculate shipping costs based on product dimensions and weight
const calculateShippingCosts = (weight, weightUnit, dimensions) => {
    // Convert weight to pounds for calculation
    let weightInPounds = parseFloat(weight) || 0;

    if (weightUnit === 'kg') {
        weightInPounds = weightInPounds * 2.20462;
    } else if (weightUnit === 'oz') {
        weightInPounds = weightInPounds / 16;
    } else if (weightUnit === 'g') {
        weightInPounds = weightInPounds * 0.00220462;
    }

    // Calculate dimensional weight (L × W × H in inches / 166)
    let dimensionalWeight = 0;

    if (dimensions && dimensions.length && dimensions.width && dimensions.height) {
        let length = parseFloat(dimensions.length) || 0;
        let width = parseFloat(dimensions.width) || 0;
        let height = parseFloat(dimensions.height) || 0;

        // Convert dimensions to inches if needed
        if (dimensions.unit === 'cm') {
            length = length * 0.393701;
            width = width * 0.393701;
            height = height * 0.393701;
        } else if (dimensions.unit === 'm') {
            length = length * 39.3701;
            width = width * 39.3701;
            height = height * 39.3701;
        } else if (dimensions.unit === 'ft') {
            length = length * 12;
            width = width * 12;
            height = height * 12;
        }

        // Calculate dimensional weight
        dimensionalWeight = (length * width * height) / 166;
    }

    // Use the greater of actual weight or dimensional weight
    const billableWeight = Math.max(weightInPounds, dimensionalWeight);

    // Base shipping costs
    const baseCost = 10;
    const baseExpress = 25;

    // Calculate standard shipping cost (base + $1.50 per pound)
    let standardCost = baseCost + (billableWeight * 1.5);

    // Calculate express shipping cost (base + $3 per pound)
    let expressCost = baseExpress + (billableWeight * 3);

    // Round to 2 decimal places
    standardCost = Math.round(standardCost * 100) / 100;
    expressCost = Math.round(expressCost * 100) / 100;

    return {
        standardShippingCost: standardCost,
        expressShippingCost: expressCost
    };
};

const ProductUploadPage = () => {
    const navigate = useNavigate();
    const { currentUser, userRole, userProfile, hasRole } = useUser();
    const { success: showSuccess, error: showError } = useToast();
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
        stockQuantity: '',
        category: 'cat_0',
        categories: [],
        tags: [],
        productType: 'physical',
        manufacturingCost: '',
        isCrowdfunded: false,
        isDirectSell: true,
        isComposite: false, // New field for composite products
        componentProducts: [], // New field to store component products
        bundleDiscountType: 'fixed', // Default discount type
        bundleDiscountValue: '', // Discount value (percentage or fixed amount)
        fundingGoal: '0',
        customShipping: false,
        standardShippingCost: '',
        expressShippingCost: '',
        freeShipping: false,
        freeShippingThreshold: '',
        freeExpressShipping: false, // New field for free express shipping
        shippingProvider: 'standard',
        customProviderName: '',
        trackInventory: false,
        lowStockThreshold: '5',
        weight: '', // New field for weight
        weightUnit: 'lb', // New field for weight unit
        dimensions: { length: '', width: '', height: '', unit: 'inches' } // New field for dimensions
    });

    // Component products state
    const [availableProducts, setAvailableProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [showComponentSearch, setShowComponentSearch] = useState(false);

    // Multiple image handling state
    const [productImages, setProductImages] = useState([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
    const [showImageCropper, setShowImageCropper] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState('');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const imageInputRef = useRef(null);
    const dragAreaRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // Categories state
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [useCustomCategory, setUseCustomCategory] = useState(false);

    // Check if user has designer role
    const isDesigner = hasRole('designer');

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

    // Setup drag and drop event handlers
    useEffect(() => {
        const dragArea = dragAreaRef.current;
        if (!dragArea) return;

        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        };

        const handleDragEnter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
        };

        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (loading) return;

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleDroppedFiles(files);
            }
        };

        dragArea.addEventListener('dragover', handleDragOver);
        dragArea.addEventListener('dragenter', handleDragEnter);
        dragArea.addEventListener('dragleave', handleDragLeave);
        dragArea.addEventListener('drop', handleDrop);

        return () => {
            dragArea.removeEventListener('dragover', handleDragOver);
            dragArea.removeEventListener('dragenter', handleDragEnter);
            dragArea.removeEventListener('dragleave', handleDragLeave);
            dragArea.removeEventListener('drop', handleDrop);
        };
    }, [loading, productImages.length]);

    // Fetch available products that can be used as components
    useEffect(() => {
        if (formData.isComposite) {
            const fetchProducts = async () => {
                try {
                    const productsRef = collection(db, 'products');
                    const q = query(
                        productsRef,
                        where('designerId', '==', currentUser.uid),
                        where('status', '==', 'active'),
                        where('isComposite', '==', false) // Prevent recursive composite products
                    );
                    const snapshot = await getDocs(q);

                    const fetchedProducts = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        quantityInComposite: 1 // Default quantity for composite
                    }));

                    setAvailableProducts(fetchedProducts);
                } catch (err) {
                    console.error('Error fetching available products:', err);
                    showError('Error loading available products for composite');
                }
            };
            fetchProducts();
        }
    }, [formData.isComposite, currentUser]);

    // Handle files dropped into the drag area
    const handleDroppedFiles = (files) => {
        // Filter for image files only
        const imageFiles = Array.from(files).filter(file => file.type.match('image.*'));

        if (imageFiles.length === 0) {
            setError('Please drop image files only');
            return;
        }

        // Check if adding these files would exceed the limit
        if ((productImages.length + imageFiles.length) > MAX_IMAGES) {
            setError(`You can upload a maximum of ${MAX_IMAGES} images. Please select fewer images.`);
            return;
        }

        // Process each valid image file
        for (const file of imageFiles) {
            // Check file size
            if (file.size > 5 * 1024 * 1024) {
                setError(`Image ${file.name} exceeds 5MB limit`);
                continue;
            }

            // Process the image file
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setShowImageCropper(true);

            // We'll only process one file at a time and wait for user to crop
            break;
        }
    };

    // Handle form input changes
    const handleChange = (e) => {
        const { name, value } = e.target;

        // Special handling for price and fundingGoal to ensure they're numeric
        if (name === 'price' || name === 'fundingGoal' || name === 'manufacturingCost' || name === 'bundleDiscountValue') {
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
            // Store unsanitized value for display in the form
            setFormData({ ...formData, [name]: value });
        }
    };

    // Toggle product type (crowdfunded vs. direct sell)
    const handleProductTypeToggle = (e) => {
        const isCrowdfunded = e.target.value === 'crowdfunded';
        setFormData(prev => ({
            ...prev,
            isCrowdfunded
        }));
    };

    // Toggle composite product type
    const handleCompositeToggle = (e) => {
        const isComposite = e.target.checked;
        setFormData(prev => ({
            ...prev,
            isComposite,
            // If turning on composite, reset component selection
            componentProducts: isComposite ? prev.componentProducts : []
        }));

        // Reset component selection when toggling off
        if (!isComposite) {
            setSelectedComponents([]);
        }
    };

    // Handle bundle discount type change
    const handleDiscountTypeChange = (type) => {
        setFormData(prev => ({
            ...prev,
            bundleDiscountType: type,
            // Reset the discount value when changing types to avoid confusion
            bundleDiscountValue: ''
        }));
    };

    // Handle component product search
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Filter available products based on search term
    const filteredProducts = searchTerm
        ? availableProducts.filter(product =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())))
        : availableProducts;

    // Add component to the composite product
    const addComponent = (component) => {
        // Check if component already exists in the selection
        const exists = selectedComponents.some(item => item.id === component.id);

        if (!exists) {
            const componentWithQuantity = {
                ...component,
                quantityInComposite: 1 // Default quantity
            };
            setSelectedComponents([...selectedComponents, componentWithQuantity]);

            // Update form data with component products
            setFormData(prev => ({
                ...prev,
                componentProducts: [...prev.componentProducts, {
                    id: component.id,
                    name: component.name,
                    quantity: 1
                }]
            }));
        }
    };

    // Remove component from the composite product
    const removeComponent = (componentId) => {
        setSelectedComponents(selectedComponents.filter(item => item.id !== componentId));

        // Update form data with remaining component products
        setFormData(prev => ({
            ...prev,
            componentProducts: prev.componentProducts.filter(item => item.id !== componentId)
        }));
    };

    // Update component quantity in the composite product
    const updateComponentQuantity = (componentId, quantity) => {
        const numericQuantity = parseInt(quantity) || 1;

        // Update the selected components list
        setSelectedComponents(prevComponents =>
            prevComponents.map(component =>
                component.id === componentId
                    ? { ...component, quantityInComposite: numericQuantity }
                    : component
            )
        );

        // Update the form data
        setFormData(prev => ({
            ...prev,
            componentProducts: prev.componentProducts.map(component =>
                component.id === componentId
                    ? { ...component, quantity: numericQuantity }
                    : component
            )
        }));
    };

    // Calculate bundle pricing and savings
    const calculateBundlePricing = () => {
        if (!formData.isComposite || selectedComponents.length === 0) {
            return { totalComponentsValue: 0, bundlePrice: 0, savings: 0, savingsPercentage: 0 };
        }

        // Calculate the total value of components
        const totalComponentsValue = selectedComponents.reduce(
            (total, component) => total + (component.price * component.quantityInComposite), 0
        );

        let bundlePrice = 0;
        let savings = 0;
        let savingsPercentage = 0;

        // Calculate bundle price based on discount type and value
        if (formData.bundleDiscountType === 'percentage' && formData.bundleDiscountValue) {
            const discountPercent = Math.min(parseFloat(formData.bundleDiscountValue) || 0, 100);
            bundlePrice = totalComponentsValue * (1 - (discountPercent / 100));
            savings = totalComponentsValue - bundlePrice;
            savingsPercentage = discountPercent;
        } else if (formData.bundleDiscountType === 'fixed' && formData.bundleDiscountValue) {
            const fixedDiscount = Math.min(parseFloat(formData.bundleDiscountValue) || 0, totalComponentsValue);
            bundlePrice = totalComponentsValue - fixedDiscount;
            savings = fixedDiscount;
            savingsPercentage = (savings / totalComponentsValue) * 100;
        } else if (formData.bundleDiscountType === 'price' && formData.price) {
            bundlePrice = parseFloat(formData.price) || 0;
            savings = totalComponentsValue - bundlePrice;
            savingsPercentage = (savings / totalComponentsValue) * 100;
        } else {
            bundlePrice = totalComponentsValue;
        }

        // Ensure bundle price is not negative
        bundlePrice = Math.max(bundlePrice, 0);

        // If the price field should be updated automatically
        if (formData.bundleDiscountType !== 'price') {
            setFormData(prev => ({
                ...prev,
                price: bundlePrice.toFixed(2)
            }));
        }

        return {
            totalComponentsValue,
            bundlePrice,
            savings,
            savingsPercentage
        };
    };

    // Calculate bundle pricing whenever relevant data changes
    const bundlePricing = calculateBundlePricing();

    // Handle category selection (for multi-select)
    const handleCategoryChange = (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);

        // Update both the categories array and the category field for backward compatibility
        const primaryCategory = selectedOptions.length > 0 ? selectedOptions[0] : '';

        setFormData(prev => ({
            ...prev,
            categories: selectedOptions,
            category: primaryCategory // Keep first selected category in the single category field
        }));
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

            // Create URL for the cropper and store reference to original file
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setShowImageCropper(true);

            // Store the original file to pass to the image cropper
            // This way we can preserve WEBP files
            sessionStorage.setItem('currentUploadFile', JSON.stringify({
                type: file.type,
                name: file.name
            }));
        }
    };

    // Handle image crop completion
    const handleCropComplete = async (blob, originalFile) => {
        try {
            setShowImageCropper(false);

            // Determine whether to keep original format (for WEBP) or use JPEG
            const isWebP = originalFile && originalFile.type === 'image/webp';
            const fileType = isWebP ? 'image/webp' : 'image/jpeg';
            const fileExt = isWebP ? 'webp' : 'jpg';

            // Create a File from the blob with the appropriate type
            const croppedFile = new File(
                [blob],
                `product-image-${Date.now()}.${fileExt}`,
                { type: fileType }
            );

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

    // Handle navigation to bulk uploader
    const handleBulkUpload = () => {
        navigate('/products/products-csv-import');
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

        // Validate category: either regular categories are selected or custom category is provided
        if (useCustomCategory) {
            if (!formData.customCategory.trim()) {
                setError('Please enter a custom category');
                return false;
            }
        } else if (formData.categories.length === 0) {
            setError('Please select at least one category');
            return false;
        }

        // Only validate funding goal for crowdfunded products
        if (formData.isCrowdfunded) {
            if (!formData.fundingGoal || isNaN(parseFloat(formData.fundingGoal)) || parseFloat(formData.fundingGoal) <= 0) {
                setError('Please enter a valid funding goal');
                return false;
            }
        }

        if (!formData.manufacturingCost || isNaN(parseFloat(formData.manufacturingCost)) || parseFloat(formData.manufacturingCost) <= 0) {
            setError('Please enter a valid manufacturing cost');
            return false;
        }

        // For composite products, validate component selection
        if (formData.isComposite && formData.componentProducts.length < 2) {
            setError('Composite products must have at least 2 component products');
            return false;
        }

        // For composite products with discounts, validate discount values
        if (formData.isComposite) {
            if (formData.bundleDiscountType === 'percentage' && formData.bundleDiscountValue) {
                const discountPercent = parseFloat(formData.bundleDiscountValue);
                if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
                    setError('Percentage discount must be between 0 and 100');
                    return false;
                }
            } else if (formData.bundleDiscountType === 'fixed' && formData.bundleDiscountValue) {
                const fixedDiscount = parseFloat(formData.bundleDiscountValue);
                if (isNaN(fixedDiscount) || fixedDiscount < 0) {
                    setError('Fixed discount must be a positive number');
                    return false;
                }

                // Calculate total components value to compare against fixed discount
                const totalComponentsValue = selectedComponents.reduce(
                    (total, component) => total + (component.price * component.quantityInComposite), 0
                );

                if (fixedDiscount > totalComponentsValue) {
                    setError('Fixed discount cannot be greater than the total value of components');
                    return false;
                }
            }
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

                // Get the appropriate file extension based on the file type
                // This ensures WebP files keep their .webp extension
                let fileExt = 'jpg'; // Default
                if (image.type === 'image/webp') {
                    fileExt = 'webp';
                } else if (image.type === 'image/png') {
                    fileExt = 'png';
                } else if (image.type === 'image/gif') {
                    fileExt = 'gif';
                }

                const fileName = `${timestamp}-product-${i}.${fileExt}`;
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

                console.log(`Image ${i + 1} uploaded: ${imageUrl} (${fileExt} format)`);
            }

            // 2. Create product document in Firestore with the image URLs
            const productData = {
                name: sanitizeString(formData.name),
                description: sanitizeString(formData.description),
                price: parseFloat(formData.price),
                // For direct selling products, set fundingGoal to 0 and currentFunding to the goal (fully funded)
                fundingGoal: formData.isCrowdfunded ? parseFloat(formData.fundingGoal) : 0,
                manufacturingCost: parseFloat(formData.manufacturingCost),
                imageUrls: imageUrls, // Store all image URLs from Firebase Storage
                designerId: currentUser.uid,
                designerName: userProfile?.displayName || 'Designer',
                status: requireApproval ? 'pending' : 'active', // Set status based on approval setting
                // For direct selling products, set currentFunding equal to fundingGoal (mark as fully funded)
                currentFunding: formData.isCrowdfunded ? 0 : parseFloat(formData.price), // Initial funding amount or fully funded for direct selling
                isCrowdfunded: formData.isCrowdfunded, // Store whether product is crowdfunded
                isDirectSell: !formData.isCrowdfunded, // Add a direct sell flag for filtering
                isComposite: formData.isComposite, // Add flag for composite products
                componentProducts: formData.isComposite ? formData.componentProducts : [], // Add component products for composite
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                storagePaths: storagePaths, // Store the correct paths for future reference
                // Add stock management data - for composite products, this is calculated from components
                trackInventory: formData.isComposite ? true : formData.trackInventory,
                stockQuantity: formData.isComposite ? null : (formData.trackInventory ? parseInt(formData.stockQuantity) || 0 : null),
                lowStockThreshold: formData.isComposite ? 5 : (formData.trackInventory ? parseInt(formData.lowStockThreshold) || 5 : null),                // Add shipping dimensions and weight
                dimensions: formData.dimensions ? {
                    length: parseFloat(formData.dimensions.length) || 0,
                    width: parseFloat(formData.dimensions.width) || 0,
                    height: parseFloat(formData.dimensions.height) || 0,
                    unit: formData.dimensions.unit || 'inches'
                } : null,
                weight: parseFloat(formData.weight) || 0,
                weightUnit: formData.weightUnit || 'lb',
                // Add shipping settings
                customShipping: formData.customShipping,
                standardShippingCost: formData.customShipping ? parseFloat(formData.standardShippingCost) || 10 : null,
                expressShippingCost: formData.customShipping ? parseFloat(formData.expressShippingCost) || 25 : null,
                freeShipping: formData.customShipping ? formData.freeShipping : false,
                freeShippingThreshold: formData.customShipping && !formData.freeShipping ? parseFloat(formData.freeShippingThreshold) || 0 : null,
                freeExpressShipping: formData.customShipping ? formData.freeExpressShipping : false,
                shippingProvider: formData.customShipping ? formData.shippingProvider : null,
                customProviderName: formData.customShipping && formData.shippingProvider === 'custom' ? formData.customProviderName : null,
            };

            // Add bundle discount information for composite products
            if (formData.isComposite) {
                productData.bundleDiscountType = formData.bundleDiscountType;
                productData.bundleDiscountValue = parseFloat(formData.bundleDiscountValue) || 0;

                // Calculate and store the original price (sum of components)
                productData.bundleOriginalPrice = selectedComponents.reduce(
                    (total, component) => total + (component.price * component.quantityInComposite), 0
                );

                // Calculate and store the savings amount
                productData.bundleSavingsAmount = productData.bundleOriginalPrice - productData.price;

                // Calculate and store the savings percentage
                productData.bundleSavingsPercent = productData.bundleOriginalPrice > 0
                    ? Math.round((productData.bundleSavingsAmount / productData.bundleOriginalPrice) * 100)
                    : 0;
            }

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
                    productData.categories = [categoryRef.id]; // Add as array with single ID
                    productData.categoryType = 'standard'; // now it's stored in the database
                } catch (categoryError) {
                    console.error('Failed to add custom category, using text value instead:', categoryError);
                    // If we can't create a category, use a fallback approach
                    productData.category = sanitizeString(formData.customCategory.trim());
                    productData.categories = [sanitizeString(formData.customCategory.trim())];
                    productData.categoryType = 'custom';
                }
            } else {
                // Use the selected category IDs directly
                productData.category = formData.category; // Primary category (first selected)
                productData.categories = formData.categories; // All selected category IDs
                productData.categoryType = 'standard';
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
                categories: [], // Ensure this is initialized as an empty array, not undefined
                customCategory: '',
                fundingGoal: '',
                isCrowdfunded: true, // Reset to default
                isComposite: false, // Reset to default
                componentProducts: [], // Reset component products
                manufacturingCost: '', // Reset to default
                stockQuantity: '', // Reset to default
                lowStockThreshold: '', // Reset to default
                trackInventory: false, // Reset to default value
                customShipping: false,
                standardShippingCost: '',
                expressShippingCost: '',
                freeShipping: false,
                freeShippingThreshold: '',
                freeExpressShipping: false, // Reset to default
                shippingProvider: 'standard',
                customProviderName: '',
                weight: '', // Reset to default
                weightUnit: 'lb', // Reset to default
                dimensions: { length: '', width: '', height: '', unit: 'inches' } // Reset to default
            });
            setProductImages([]);
            setImagePreviewUrls([]);
            setUseCustomCategory(false);
            setSelectedComponents([]);

            // On successful upload, check for achievements, but don't let failures affect success state
            try {
                console.log('Checking achievements...');
            } catch (achievementError) {
                console.error('Error checking achievements (non-critical):', achievementError);
                // Don't set error state here as the product was successfully created
            }

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

                <div className="upload-mode-toggle">
                    <button
                        className="mode-toggle-btn active"
                        disabled={loading}
                    >
                        Single Product
                    </button>
                    <button
                        className="mode-toggle-btn"
                        onClick={handleBulkUpload}
                        disabled={loading}
                    >
                        Bulk Upload
                    </button>
                </div>

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
                                            disabled={loading || formData.isComposite}
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
                                            disabled={loading || formData.isComposite}
                                        />
                                        Direct Selling (Existing Product)
                                    </label>
                                </div>

                                {/* Add composite product toggle */}
                                <div className="composite-toggle">
                                    <label htmlFor="isComposite">
                                        <input
                                            type="checkbox"
                                            id="isComposite"
                                            name="isComposite"
                                            checked={formData.isComposite}
                                            onChange={handleCompositeToggle}
                                            disabled={loading}
                                        />
                                        Create a composite product (bundle)
                                    </label>
                                </div>
                                <p className="form-hint">
                                    {formData.isComposite
                                        ? "Composite products combine multiple products into a single item. Inventory is tracked across all components."
                                        : formData.isCrowdfunded
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

                                {formData.isCrowdfunded && !formData.isComposite && (
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
                                        disabled={loading}
                                    />
                                    <p className="form-hint">
                                        {formData.isComposite
                                            ? "This is the additional cost beyond the components (e.g., assembly, packaging)."
                                            : "This is the cost to produce each unit. It's used to calculate profits and investor revenue sharing."}
                                    </p>
                                </div>
                            </div>

                            {/* Composite product component selection */}
                            {formData.isComposite && (
                                <div className="form-group composite-products">
                                    <h3>Component Products</h3>
                                    <p className="form-hint">
                                        Select at least 2 products to include in this composite product bundle.
                                    </p>

                                    <div className="component-search">
                                        <button
                                            type="button"
                                            className="search-toggle-btn"
                                            onClick={() => setShowComponentSearch(!showComponentSearch)}
                                        >
                                            {showComponentSearch ? "Hide Product Search" : "Search Products to Add"}
                                        </button>

                                        {showComponentSearch && (
                                            <div className="search-container">
                                                <input
                                                    type="text"
                                                    placeholder="Search your products..."
                                                    value={searchTerm}
                                                    onChange={handleSearchChange}
                                                    className="component-search-input"
                                                />

                                                <div className="product-search-results">
                                                    {filteredProducts.length === 0 ? (
                                                        <p className="no-results">No matching products found</p>
                                                    ) : (
                                                        filteredProducts.map(product => (
                                                            <div key={product.id} className="product-search-item">
                                                                <div className="product-search-info">
                                                                    <img
                                                                        src={product.imageUrls && product.imageUrls[0] ? product.imageUrls[0] : '/placeholder.jpg'}
                                                                        alt={product.name}
                                                                        className="product-search-image"
                                                                    />
                                                                    <div className="product-search-details">
                                                                        <h4>{product.name}</h4>
                                                                        <p>${product.price ? product.price.toFixed(2) : '0.00'}</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="add-component-btn"
                                                                    onClick={() => addComponent(product)}
                                                                    disabled={selectedComponents.some(item => item.id === product.id)}
                                                                >
                                                                    {selectedComponents.some(item => item.id === product.id) ? 'Added' : 'Add'}
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="selected-components">
                                        <h4>Selected Components ({selectedComponents.length})</h4>
                                        {selectedComponents.length === 0 ? (
                                            <p className="no-components">No components selected yet</p>
                                        ) : (
                                            <div className="component-list">
                                                {selectedComponents.map(component => (
                                                    <div key={component.id} className="component-item">
                                                        <div className="component-info">
                                                            <img
                                                                src={component.imageUrls && component.imageUrls[0] ? component.imageUrls[0] : '/placeholder.jpg'}
                                                                alt={component.name}
                                                                className="component-image"
                                                            />
                                                            <div className="component-details">
                                                                <h4>{component.name}</h4>
                                                                <p>${component.price ? component.price.toFixed(2) : '0.00'} each</p>
                                                            </div>
                                                        </div>
                                                        <div className="component-actions">
                                                            <div className="quantity-control">
                                                                <label htmlFor={`quantity-${component.id}`}>Qty:</label>
                                                                <input
                                                                    type="number"
                                                                    id={`quantity-${component.id}`}
                                                                    min="1"
                                                                    value={component.quantityInComposite}
                                                                    onChange={(e) => updateComponentQuantity(component.id, e.target.value)}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="remove-component-btn"
                                                                onClick={() => removeComponent(component.id)}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Bundle pricing options - only for composite products */}
                                                {selectedComponents.length >= 2 && (
                                                    <div className="bundle-pricing-options">
                                                        <h4>Bundle Pricing Options</h4>
                                                        <div className="discount-type-options">
                                                            <label className={`discount-type-option ${formData.bundleDiscountType === 'percentage' ? 'active' : ''}`}>
                                                                <input
                                                                    type="radio"
                                                                    name="bundleDiscountType"
                                                                    value="percentage"
                                                                    checked={formData.bundleDiscountType === 'percentage'}
                                                                    onChange={() => handleDiscountTypeChange('percentage')}
                                                                />
                                                                Percentage Discount
                                                            </label>
                                                            <label className={`discount-type-option ${formData.bundleDiscountType === 'fixed' ? 'active' : ''}`}>
                                                                <input
                                                                    type="radio"
                                                                    name="bundleDiscountType"
                                                                    value="fixed"
                                                                    checked={formData.bundleDiscountType === 'fixed'}
                                                                    onChange={() => handleDiscountTypeChange('fixed')}
                                                                />
                                                                Fixed Amount Off
                                                            </label>
                                                            <label className={`discount-type-option ${formData.bundleDiscountType === 'price' ? 'active' : ''}`}>
                                                                <input
                                                                    type="radio"
                                                                    name="bundleDiscountType"
                                                                    value="price"
                                                                    checked={formData.bundleDiscountType === 'price'}
                                                                    onChange={() => handleDiscountTypeChange('price')}
                                                                />
                                                                Set Custom Price
                                                            </label>
                                                        </div>

                                                        {formData.bundleDiscountType === 'percentage' && (
                                                            <div className="discount-value-input">
                                                                <label htmlFor="bundleDiscountValue">Percentage Discount (%)</label>
                                                                <input
                                                                    type="number"
                                                                    id="bundleDiscountValue"
                                                                    name="bundleDiscountValue"
                                                                    value={formData.bundleDiscountValue}
                                                                    onChange={handleChange}
                                                                    placeholder="Enter discount percentage"
                                                                    min="0"
                                                                    max="100"
                                                                />
                                                                <p className="form-hint">
                                                                    Enter a discount percentage (0-100%) to apply to the bundle.
                                                                </p>
                                                            </div>
                                                        )}

                                                        {formData.bundleDiscountType === 'fixed' && (
                                                            <div className="discount-value-input">
                                                                <label htmlFor="bundleDiscountValue">Fixed Amount Off ($)</label>
                                                                <input
                                                                    type="text"
                                                                    id="bundleDiscountValue"
                                                                    name="bundleDiscountValue"
                                                                    value={formData.bundleDiscountValue}
                                                                    onChange={handleChange}
                                                                    placeholder="Enter fixed discount amount"
                                                                    min="0"
                                                                />
                                                                <p className="form-hint">
                                                                    Enter a fixed dollar amount to discount from the total component value.
                                                                </p>
                                                            </div>
                                                        )}

                                                        {formData.bundleDiscountType === 'price' && (
                                                            <div className="discount-value-input">
                                                                <p className="form-hint">
                                                                    Using the bundle price from the main price field: {formData.price ? `$${formData.price}` : '$0.00'}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Summary of component values and pricing */}
                                                        <div className="components-summary pricing-details">
                                                            <div className="pricing-row">
                                                                <span>Total Components Value:</span>
                                                                <span>${bundlePricing.totalComponentsValue.toFixed(2)}</span>
                                                            </div>
                                                            <div className="pricing-row">
                                                                <span>Bundle Price:</span>
                                                                <span>${bundlePricing.bundlePrice.toFixed(2)}</span>
                                                            </div>
                                                            <div className="pricing-row highlight">
                                                                <span>Customer Savings:</span>
                                                                <span>${bundlePricing.savings.toFixed(2)} ({Math.round(bundlePricing.savingsPercentage)}%)</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Summary of component values */}
                                                <div className="components-summary">
                                                    <p>
                                                        <strong>Total Components Value:</strong> $
                                                        {selectedComponents.reduce((total, component) =>
                                                            total + (component.price * component.quantityInComposite), 0).toFixed(2)}
                                                    </p>
                                                    <p>
                                                        <strong>Bundle Price:</strong> $
                                                        {formData.price ? parseFloat(formData.price).toFixed(2) : '0.00'}
                                                    </p>
                                                    {formData.price && (
                                                        <p>
                                                            <strong>Customer Savings:</strong> $
                                                            {(selectedComponents.reduce((total, component) =>
                                                                total + (component.price * component.quantityInComposite), 0) -
                                                                parseFloat(formData.price)).toFixed(2)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

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
                                            <label htmlFor="categories">Categories* (Hold Ctrl/Cmd to select multiple)</label>
                                            <select
                                                id="categories"
                                                name="categories"
                                                multiple
                                                size={Math.min(5, categories.length)}
                                                value={formData.categories}
                                                onChange={handleCategoryChange}
                                                disabled={loading || loadingCategories || useCustomCategory}
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
                                <div
                                    className={`image-upload-area ${isDragging ? 'dragging' : ''}`}
                                    ref={dragAreaRef}
                                >
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
                                            <p>Click or drag images here</p>
                                            <span>(Max size: 5MB per image)</span>
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
                                <p className="drag-drop-hint">Pro tip: Drag and drop images directly onto the upload area</p>
                            </div>

                            {/* Stock Management Section - only show for non-composite products */}
                            {!formData.isComposite && (
                                <div className="form-group stock-management">
                                    <h3>Stock Management</h3>

                                    <div className="stock-tracking-toggle">
                                        <label>
                                            <input
                                                type="checkbox"
                                                name="trackInventory"
                                                checked={formData.trackInventory}
                                                onChange={(e) => setFormData({ ...formData, trackInventory: e.target.checked })}
                                                disabled={loading}
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
                                                    <label htmlFor="stockQuantity">Initial Stock Quantity*</label>
                                                    <input
                                                        type="number"
                                                        id="stockQuantity"
                                                        name="stockQuantity"
                                                        value={formData.stockQuantity}
                                                        onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                                                        placeholder="0"
                                                        min="0"
                                                        disabled={loading}
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
                                                        disabled={loading}
                                                    />
                                                    <p className="form-hint">
                                                        You'll be notified when stock reaches this level.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* For composite products, show an inventory note instead */}
                            {formData.isComposite && (
                                <div className="form-group composite-inventory-note">
                                    <h3>Inventory Management</h3>
                                    <p>
                                        <strong>Note:</strong> Inventory for composite products is automatically tracked based on the
                                        availability of all component products. When a composite product is purchased, inventory for
                                        each component will be reduced accordingly.
                                    </p>
                                </div>
                            )}

                            {/* Add Shipping Settings Section */}
                            <div className="form-group shipping-settings">
                                <h3>Shipping Settings</h3>

                                <div className="shipping-toggle">
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="customShipping"
                                            checked={formData.customShipping}
                                            onChange={(e) => setFormData({ ...formData, customShipping: e.target.checked })}
                                            disabled={loading}
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
                                                    disabled={loading}
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
                                                    disabled={loading}
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
                                                    disabled={loading}
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
                                                    placeholder="0.00"
                                                    min="0"
                                                    step="0.01"
                                                    disabled={loading}
                                                />
                                                <p className="form-hint">
                                                    Orders that include this product will receive free shipping if the total order amount exceeds this threshold.
                                                    Set to 0 to disable free shipping threshold.
                                                </p>

                                                <div className="form-group checkbox">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            name="freeExpressShipping"
                                                            checked={formData.freeExpressShipping}
                                                            onChange={(e) => setFormData({
                                                                ...formData,
                                                                freeExpressShipping: e.target.checked
                                                            })}
                                                            disabled={loading}
                                                        />
                                                        Include express shipping in free shipping threshold
                                                    </label>
                                                    <p className="form-hint">
                                                        If enabled, customers will get both standard and express shipping free when the threshold is met.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {formData.freeShipping && (
                                            <div className="form-group checkbox">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        name="freeExpressShipping"
                                                        checked={formData.freeExpressShipping}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            freeExpressShipping: e.target.checked
                                                        })}
                                                        disabled={loading}
                                                    />
                                                    Include express shipping in free shipping offer
                                                </label>
                                                <p className="form-hint">
                                                    If enabled, both standard and express shipping will be free for this product.
                                                </p>
                                            </div>
                                        )}

                                        <div className="product-dimensions">
                                            <h4>Product Dimensions and Weight</h4>
                                            <p className="form-hint">
                                                These details help calculate accurate shipping costs for large or heavy items.
                                            </p>

                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label htmlFor="weight">Product Weight</label>
                                                    <div className="input-with-select">
                                                        <input
                                                            type="number"
                                                            id="weight"
                                                            name="weight"
                                                            value={formData.weight}
                                                            onChange={(e) => setFormData({
                                                                ...formData,
                                                                weight: e.target.value
                                                            })}
                                                            placeholder="0.00"
                                                            min="0"
                                                            step="0.01"
                                                            disabled={loading}
                                                        />
                                                        <select
                                                            name="weightUnit"
                                                            value={formData.weightUnit}
                                                            onChange={(e) => setFormData({
                                                                ...formData,
                                                                weightUnit: e.target.value
                                                            })}
                                                            disabled={loading}
                                                        >
                                                            <option value="lb">lb</option>
                                                            <option value="kg">kg</option>
                                                            <option value="oz">oz</option>
                                                            <option value="g">g</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label>Product Dimensions</label>
                                                <div className="dimensions-container">
                                                    <div className="form-row">
                                                        <div className="form-group">
                                                            <label htmlFor="length">Length</label>
                                                            <input
                                                                type="number"
                                                                id="length"
                                                                name="dimensions.length"
                                                                value={formData.dimensions.length}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    dimensions: {
                                                                        ...formData.dimensions,
                                                                        length: e.target.value
                                                                    }
                                                                })}
                                                                placeholder="0.00"
                                                                min="0"
                                                                step="0.01"
                                                                disabled={loading}
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="width">Width</label>
                                                            <input
                                                                type="number"
                                                                id="width"
                                                                name="dimensions.width"
                                                                value={formData.dimensions.width}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    dimensions: {
                                                                        ...formData.dimensions,
                                                                        width: e.target.value
                                                                    }
                                                                })}
                                                                placeholder="0.00"
                                                                min="0"
                                                                step="0.01"
                                                                disabled={loading}
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="height">Height</label>
                                                            <input
                                                                type="number"
                                                                id="height"
                                                                name="dimensions.height"
                                                                value={formData.dimensions.height}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    dimensions: {
                                                                        ...formData.dimensions,
                                                                        height: e.target.value
                                                                    }
                                                                })}
                                                                placeholder="0.00"
                                                                min="0"
                                                                step="0.01"
                                                                disabled={loading}
                                                            />
                                                        </div>

                                                        <div className="form-group">
                                                            <label htmlFor="dimensionUnit">Unit</label>
                                                            <select
                                                                id="dimensionUnit"
                                                                name="dimensions.unit"
                                                                value={formData.dimensions.unit}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    dimensions: {
                                                                        ...formData.dimensions,
                                                                        unit: e.target.value
                                                                    }
                                                                })}
                                                                disabled={loading}
                                                            >
                                                                <option value="inches">inches</option>
                                                                <option value="cm">cm</option>
                                                                <option value="m">m</option>
                                                                <option value="ft">ft</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="form-hint">
                                                    Weight and dimensions help calculate accurate shipping costs for larger or heavier items.
                                                </p>
                                            </div>
                                        </div>

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
                                                disabled={loading}
                                            >
                                                {DEFAULT_SHIPPING_PROVIDERS.map(provider => (
                                                    <option key={provider.id} value={provider.id}>
                                                        {provider.name}
                                                    </option>
                                                ))}
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
                                                    disabled={loading || formData.shippingProvider !== 'custom'}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
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
