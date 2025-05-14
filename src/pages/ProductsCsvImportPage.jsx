import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import '../styles/BulkProductUploader.css';
import '../styles/UnifiedProductManager.css';
import '../styles/ColumnHighlight.css';
import ImageCropper from '../components/ImageCropper';
import { unsanitizeString } from '../utils/unsanitizer';

// Default categories as fallback
const DEFAULT_CATEGORIES = [
    { id: 'cat_0', name: 'Electronics' },
    { id: 'cat_1', name: 'Clothing' },
    { id: 'cat_2', name: 'Home & Garden' },
    { id: 'cat_3', name: 'Toys & Games' },
    { id: 'cat_4', name: 'Beauty' },
    { id: 'cat_5', name: 'Sports' }
];

const ProductsCsvImportPage = () => {
    const { userProfile, hasRole } = useUser();
    const toast = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const csvInputRef = useRef(null);
    const tableRef = useRef(null);
    // Image cropper state
    const [showImageCropper, setShowImageCropper] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState('');

    // Safely access toast functions
    const showSuccess = (message) => {
        if (toast && typeof toast.success === 'function') {
            toast.success(message);
        } else {
            console.log('Success:', message);
        }
    };

    const showError = (message) => {
        if (toast && typeof toast.error === 'function') {
            toast.error(message);
        } else {
            console.error('Error:', message);
        }
    };

    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResults, setUploadResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [categoryMapping, setCategoryMapping] = useState({});
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [currentProductId, setCurrentProductId] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [advancedMode, setAdvancedMode] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [highlightedColumn, setHighlightedColumn] = useState(null);

    // Handle column hover for highlighting
    const handleColumnMouseEnter = (header) => {
        setHighlightedColumn(header);
    };

    // Handle column mouse leave to remove highlighting
    const handleColumnMouseLeave = () => {
        setHighlightedColumn(null);
    };

    // Check if a cell should be highlighted
    const isHighlighted = (header) => {
        return highlightedColumn === header;
    };

    // Header descriptions for tooltips
    const headerDescriptions = {
        'name': 'Product name - required',
        'description': 'Full product description',
        'price': 'Selling price in your currency',
        'stockQuantity': 'Number of available items',
        'categories': 'Product categories separated by semicolons',
        'tags': 'Tags for search optimization separated by commas',
        'productType': 'Physical or digital product',
        'manufacturingCost': 'Cost to manufacture each unit',
        'images': 'Product images (drag and drop here)',
        'isCrowdfunded': 'Whether the product is crowdfunded (true/false)',
        'fundingGoal': 'Target amount for successful funding',
        'averageRating': 'Average product rating',
        'businessHeldFunds': 'Funds held by the business',
        'categoryType': 'Type of product category',
        'manufacturerEmail': 'Email address of manufacturer',
        'manufacturingStatus': 'Current production status'
    };

    // const defaultHeaders = [
    //     'name', 'description', 'price', 'stockQuantity', 'categories',
    //     'tags', 'productType', 'manufacturingCost', 'images',
    //     'isCrowdfunded', 'isDirectSell', 'fundingGoal', 'averageRating',
    //     'businessHeldFunds', 'categoryType', 'manufacturerEmail', 'manufacturingStatus'
    // ];

    const defaultHeaders = [
        'name', 'description', 'price', 'stockQuantity', 'categories',
        'tags', 'productType', 'manufacturingCost', 'images',
        'isCrowdfunded', 'fundingGoal', 'averageRating',
        'businessHeldFunds', 'categoryType', 'manufacturerEmail', 'manufacturingStatus'
    ];
    const [headers, setHeaders] = useState(defaultHeaders);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        stockQuantity: '',
        category: '',
        categories: [],
        tags: [],
        productType: 'physical',
        manufacturingCost: '',
        designer: userProfile?.displayName || '',
        isCrowdfunded: false,
        isDirectSell: true,
        fundingGoal: '0',
        // Add new shipping fields
        customShipping: false,
        standardShippingCost: '',
        expressShippingCost: '',
        freeShipping: false,
        freeShippingThreshold: '',
        shippingProvider: 'standard',
        customProviderName: ''
    });

    // Fetch categories on component mount
    useEffect(() => {
        const fetchCategories = async () => {
            setLoadingCategories(true);
            try {
                const categoriesRef = collection(db, 'categories');
                const snapshot = await getDocs(categoriesRef);
                const categoriesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Extract category names from the fetched data
                const categoryNames = categoriesData.map(cat => cat.name);

                // Use fetched categories if available, otherwise use defaults
                if (categoryNames.length > 0) {
                    setCategories(categoryNames);

                    // Create category mapping for lookups
                    const catMap = {};
                    categoryNames.forEach((name, index) => {
                        catMap[name.toLowerCase()] = categoriesData[index].id || `cat_${index}`;
                    });
                    setCategoryMapping(catMap);
                } else {
                    // Use default categories as fallback
                    setCategories(DEFAULT_CATEGORIES.map(cat => cat.name));

                    // Create default category mapping
                    const defaultCatMap = {};
                    DEFAULT_CATEGORIES.forEach(cat => {
                        defaultCatMap[cat.name.toLowerCase()] = cat.id;
                    });
                    setCategoryMapping(defaultCatMap);
                    console.log('Using default categories as fallback');
                }
            } catch (err) {
                console.error('Error fetching categories:', err);
                // Use default categories as fallback
                setCategories(DEFAULT_CATEGORIES.map(cat => cat.name));

                // Create default category mapping
                const defaultCatMap = {};
                DEFAULT_CATEGORIES.forEach(cat => {
                    defaultCatMap[cat.name.toLowerCase()] = cat.id;
                });
                setCategoryMapping(defaultCatMap);
                console.log('Using default categories due to fetch error');
            } finally {
                setLoadingCategories(false);
            }
        };

        fetchCategories();
    }, []);

    // Add this function to save new categories to Firestore
    const addNewCategory = async (newCategoryName) => {
        const categoryName = newCategoryName || newCategory;
        if (!categoryName || categoryName.trim() === '') {
            showError('Please enter a valid category name');
            return;
        }

        try {
            // Check if category already exists (case insensitive)
            if (categories.some(cat => cat.toLowerCase() === categoryName.toLowerCase())) {
                showError('This category already exists');
                return;
            }

            // Create a new category in the categories collection
            const categoryData = {
                name: categoryName,
                createdAt: serverTimestamp(),
                createdBy: userProfile?.uid || 'system'
            };

            // Add to Firestore categories collection
            const categoryRef = collection(db, 'categories');
            const newCategoryDoc = await addDoc(categoryRef, categoryData);
            const newCategoryId = newCategoryDoc.id;

            // Update local state with the new category
            const updatedCategories = [...categories, categoryName];
            setCategories(updatedCategories);

            // Update category mapping
            const catMap = { ...categoryMapping };
            catMap[categoryName.toLowerCase()] = newCategoryId;
            setCategoryMapping(catMap);

            showSuccess(`Added new category: ${categoryName}`);
            if (!newCategoryName) setNewCategory('');

            return {
                id: newCategoryId,
                name: categoryName
            };
        } catch (error) {
            console.error('Error adding category:', error);
            showError('Failed to add category');
            return null;
        }
    };

    const updateProductField = (productId, field, value) => {
        setProducts(products.map(p =>
            p.id === productId ? { ...p, [field]: value } : p
        ));
    };

    const handleDragOverCsv = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeaveCsv = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    };

    const handleDropCsv = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                if (csvInputRef.current) {
                    csvInputRef.current.files = files;
                    handleCsvImport({ target: { files: [file] } });
                }
            } else {
                showError('Please drop a valid CSV file');
            }
        }
    };

    const handleDragOver = (e, productId) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    };

    const handleDrop = (e, productId) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleImageDrop(productId, Array.from(files));
        }
    }; const handleImageDrop = (productId, files) => {
        // Filter only image files
        const imageFiles = files.filter(file =>
            file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024 // 5MB limit
        );

        if (imageFiles.length === 0) {
            showError('Please drop valid image files (max 5MB each)');
            return;
        }

        // Process the first image through the cropper
        const file = imageFiles[0];

        // Create URL for the cropper and store reference to original file
        const imageUrl = URL.createObjectURL(file);
        setCropImageSrc(imageUrl);
        setCurrentProductId(productId);
        setShowImageCropper(true);

        // Store the original file info to pass to the image cropper
        // This way we can preserve WebP files
        sessionStorage.setItem('currentUploadFile', JSON.stringify({
            type: file.type,
            name: file.name
        }));
    };

    const handleCropComplete = async (blob, originalFile) => {
        try {
            setShowImageCropper(false);

            // Determine whether to keep original format (for WEBP) or use JPEG
            const isWebP = originalFile && originalFile.type === 'image/webp';
            const fileType = isWebP ? 'image/webp' : 'image/jpeg';
            const fileExt = isWebP ? 'webp' : 'jpg';

            // Create a File from the blob with appropriate type
            const croppedFile = new File(
                [blob],
                `product-image-${Date.now()}.${fileExt}`,
                { type: fileType }
            );

            // Add the cropped image to the product
            setProducts(products.map(product => {
                if (product.id === currentProductId) {
                    const existingFiles = product.imageFiles || [];
                    return {
                        ...product,
                        imageFiles: [...existingFiles, croppedFile]
                    };
                }
                return product;
            }));

            // Clean up
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc('');

        } catch (error) {
            console.error("Error processing cropped image:", error);
            showError('Error processing the cropped image');
        }
    };

    const handleImageSelect = (productId, e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleImageDrop(productId, files);
            // Reset the input
            if (imageInputRef.current) {
                imageInputRef.current.value = '';
            }
        }
    };

    const removeImageFile = (productId, fileIndex) => {
        setProducts(products.map(product => {
            if (product.id === productId && product.imageFiles) {
                const newFiles = [...product.imageFiles];
                newFiles.splice(fileIndex, 1);
                return {
                    ...product,
                    imageFiles: newFiles
                };
            }
            return product;
        }));
    };

    const removeProduct = (productId) => {
        if (!window.confirm('Are you sure you want to remove this product?')) {
            return;
        }

        setProducts(products.filter(product => product.id !== productId));
        setSelectedProducts(selectedProducts.filter(id => id !== productId));
    };    // Define filteredProducts as a computed property
    const filteredProducts = products.filter(product => {
        if (!filterText) return true;
        const searchLower = filterText.toLowerCase();
        return (
            (product.name && unsanitizeString(product.name).toLowerCase().includes(searchLower)) ||
            (product.description && unsanitizeString(product.description).toLowerCase().includes(searchLower)) ||
            (Array.isArray(product.categories) &&
                product.categories.some(cat => unsanitizeString(cat).toLowerCase().includes(searchLower))) ||
            (Array.isArray(product.tags) &&
                product.tags.some(tag => unsanitizeString(tag).toLowerCase().includes(searchLower)))
        );
    });

    const sortedProducts = () => {
        const sortableProducts = [...filteredProducts];
        if (sortConfig.key) {
            sortableProducts.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle arrays (like categories, tags)
                if (Array.isArray(aValue)) aValue = aValue.join(', ');
                if (Array.isArray(bValue)) bValue = bValue.join(', ');

                // Convert to lowercase for string comparison
                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                // Handle numeric sorting
                if (sortConfig.key === 'price' ||
                    sortConfig.key === 'stockQuantity' ||
                    sortConfig.key === 'manufacturingCost' ||
                    sortConfig.key === 'fundingGoal') {
                    aValue = parseFloat(aValue) || 0;
                    bValue = parseFloat(bValue) || 0;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableProducts;
    };

    const handleCsvImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            // Add these options for better handling of quoted fields and separators
            quoteChar: '"',
            escapeChar: '"',
            delimiter: ",",
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    const newProducts = results.data.map(row => {
                        // Handle categories array - may be semicolon or comma separated
                        const categoriesArray = row.categories
                            ? typeof row.categories === 'string'
                                ? row.categories.split(/[,;]/).map(cat => cat.trim()).filter(cat => cat)
                                : row.categories
                            : [];

                        // Handle tags array - may be semicolon or comma separated
                        const tagsArray = row.tags
                            ? typeof row.tags === 'string'
                                ? row.tags.split(/[,;]/).map(tag => tag.trim()).filter(tag => tag)
                                : row.tags
                            : [];

                        return {
                            id: uuidv4(),
                            name: row.name || 'Unnamed Product',
                            description: row.description || '',
                            price: row.price || '0',
                            stockQuantity: row.stockQuantity || '0',
                            categories: categoriesArray,
                            tags: tagsArray,
                            productType: row.productType || 'physical',
                            manufacturingCost: row.manufacturingCost || '0',
                            isCrowdfunded: row.isCrowdfunded === 'true' || true,
                            isDirectSell: row.isDirectSell === 'true' || false,
                            fundingGoal: row.fundingGoal || '0',
                            averageRating: row.averageRating || '0',
                            businessHeldFunds: row.businessHeldFunds || '0',
                            categoryType: row.categoryType || 'standard',
                            manufacturerEmail: row.manufacturerEmail || '',
                            manufacturingStatus: row.manufacturingStatus || 'pending',
                            rating1Count: row.rating1Count || '0',
                            rating2Count: row.rating2Count || '0',
                            rating3Count: row.rating3Count || '0',
                            rating4Count: row.rating4Count || '0',
                            rating5Count: row.rating5Count || '0',
                            reviewCount: row.reviewCount || '0',
                            images: [],
                            imageFiles: [],
                            designer: row.designer || userProfile?.displayName || '',
                            designerId: userProfile.uid,
                            designerName: row.designerName || userProfile?.displayName || '',
                            isFromCsv: true,
                            originalCsvData: row
                        };
                    }); setProducts(prevProducts => [...prevProducts, ...newProducts]);
                    // Note: Removed incorrect isCrowdfunded reference that was causing errors
                    const newHeaders = results.meta.fields || [];
                    if (newHeaders.includes('images')) {
                        setHeaders(prevHeaders => {
                            const combinedHeaders = [...new Set([...prevHeaders, ...newHeaders])];
                            return combinedHeaders;
                        });
                    } else {
                        setHeaders(defaultHeaders);
                    }

                    showSuccess(`Added ${newProducts.length} products from CSV`);

                    setTimeout(() => {
                        if (tableRef.current) {
                            tableRef.current.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 100);
                } else {
                    showError('The CSV file appears to be empty or malformed');
                }
            },
            error: (error) => {
                console.error('CSV parsing error:', error);
                showError('Failed to parse CSV file');
            }
        });

        if (csvInputRef.current) {
            csvInputRef.current.value = '';
        }
    };

    const downloadCsvTemplate = () => {
        const headers = [
            'name', 'description', 'price', 'stockQuantity', 'categories',
            'tags', 'productType', 'manufacturingCost', 'designer',
            'isCrowdfunded', 'isDirectSell', 'fundingGoal', 'averageRating',
            'businessHeldFunds', 'categoryType', 'manufacturerEmail', 'manufacturingStatus'
        ];

        const sampleData = [
            {
                name: 'Sample Product',
                description: 'This is a sample product description',
                price: '19.99',
                stockQuantity: '50',
                categories: 'Category1,Category2',
                tags: 'tag1,tag2,tag3',
                productType: 'physical',
                manufacturingCost: '5.99',
                designer: userProfile?.displayName || '',
                isCrowdfunded: 'false',
                isDirectSell: 'true',
                fundingGoal: '0',
                averageRating: '0',
                businessHeldFunds: '0',
                categoryType: 'standard',
                manufacturerEmail: '',
                manufacturingStatus: 'pending'
            }
        ];

        const csv = Papa.unparse({
            fields: headers,
            data: sampleData
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'product_upload_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }; const exportCurrentData = () => {
        if (products.length === 0) {
            showError('No products to export');
            return;
        }

        const csvData = products.map(product => {
            // Properly format arrays and handle complex values WITHOUT sanitizing data
            return {
                name: product.name ? unsanitizeString(product.name) : '',
                description: product.description ? unsanitizeString(product.description) : '',
                price: product.price || '0',
                stockQuantity: product.stockQuantity || '0',
                categories: Array.isArray(product.categories)
                    ? product.categories.map(cat => unsanitizeString(cat)).join(';')
                    : product.categories ? unsanitizeString(product.categories) : '',
                tags: Array.isArray(product.tags)
                    ? product.tags.map(tag => unsanitizeString(tag)).join(';')
                    : product.tags ? unsanitizeString(product.tags) : '',
                productType: product.productType ? unsanitizeString(product.productType) : 'physical',
                manufacturingCost: product.manufacturingCost || '0',
                designer: product.designer ? unsanitizeString(product.designer) : '',
                isCrowdfunded: product.isCrowdfunded?.toString() || 'false',
                isDirectSell: product.isDirectSell?.toString() || 'true',
                fundingGoal: product.fundingGoal || '0',
                averageRating: product.averageRating || '0',
                businessHeldFunds: product.businessHeldFunds || '0', categoryType: product.categoryType ? unsanitizeString(product.categoryType) : 'standard',
                manufacturerEmail: product.manufacturerEmail ? unsanitizeString(product.manufacturerEmail) : '',
                manufacturingStatus: product.manufacturingStatus ? unsanitizeString(product.manufacturingStatus) : 'pending',
                rating1Count: product.rating1Count || '0',
                rating2Count: product.rating2Count || '0',
                rating3Count: product.rating3Count || '0',
                rating4Count: product.rating4Count || '0',
                rating5Count: product.rating5Count || '0',
                reviewCount: product.reviewCount || '0'
            };
        });

        // Configure Papa Parse with proper options for consistent formatting
        const csv = Papa.unparse({
            fields: headers.filter(h => h !== 'images'),
            data: csvData
        }, {
            quotes: true,  // Quote all fields
            quoteChar: '"',
            escapeChar: '"',
            delimiter: ",",
            header: true,
            newline: "\r\n"
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'exported_products.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const addProduct = () => {
        const newProduct = {
            id: uuidv4(),
            name: '',
            description: '',
            price: '',
            stockQuantity: '',
            categories: [],
            tags: [],
            productType: 'physical',
            manufacturingCost: '',
            isCrowdfunded: false,
            isDirectSell: true,
            fundingGoal: '0',
            averageRating: '0',
            businessHeldFunds: '0',
            categoryType: 'standard',
            manufacturerEmail: '',
            manufacturingStatus: 'pending',
            rating1Count: '0',
            rating2Count: '0',
            rating3Count: '0',
            rating4Count: '0',
            rating5Count: '0',
            reviewCount: '0',
            currentFunding: '0',
            investorCount: '0',
            fundsSentToManufacturer: false,
            images: [],
            imageFiles: [],
            designer: userProfile?.displayName || '',
            designerId: userProfile.uid,
            designerName: userProfile?.displayName || ''
        };

        setProducts([...products, newProduct]);

        setTimeout(() => {
            const productRows = document.querySelectorAll('.product-table tbody tr');
            if (productRows.length > 0) {
                const lastRow = productRows[productRows.length - 1];
                lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const firstInput = lastRow.querySelector('input');
                if (firstInput) {
                    firstInput.focus();
                }
            }
        }, 100);
    };

    const duplicateSelectedProducts = () => {
        if (selectedProducts.length === 0) {
            showError('No products selected for duplication');
            return;
        }

        const duplicatedProducts = [];

        selectedProducts.forEach(productId => {
            const originalProduct = products.find(p => p.id === productId);
            if (originalProduct) {
                const duplicatedProduct = {
                    ...originalProduct,
                    id: uuidv4(),
                    name: `${originalProduct.name} (Copy)`,
                    imageFiles: [...(originalProduct.imageFiles || [])],
                };
                duplicatedProducts.push(duplicatedProduct);
            }
        });

        setProducts([...products, ...duplicatedProducts]);
        showSuccess(`Duplicated ${duplicatedProducts.length} products`);
    };

    const removeSelectedProducts = () => {
        if (selectedProducts.length === 0) {
            showError('No products selected for removal');
            return;
        }

        if (!window.confirm(`Are you sure you want to remove ${selectedProducts.length} selected products?`)) {
            return;
        }

        setProducts(products.filter(product => !selectedProducts.includes(product.id)));
        setSelectedProducts([]);
        showSuccess(`Removed ${selectedProducts.length} products`);
    };

    const resetForm = () => {
        if (products.length === 0) {
            return;
        }

        if (!window.confirm('Are you sure you want to clear all products? This action cannot be undone.')) {
            return;
        }

        setProducts([]);
        setSelectedProducts([]);
        setUploadResults([]);
        setShowResults(false);
        showSuccess('All products have been cleared');
    };

    const uploadSelectedProducts = async () => {
        const productsToUpload = selectedProducts.length > 0
            ? products.filter(product => selectedProducts.includes(product.id))
            : products;

        if (productsToUpload.length === 0) {
            showError('No products selected for upload');
            return;
        }

        if (!window.confirm(`Are you sure you want to upload ${productsToUpload.length} products to the database?`)) {
            return;
        }

        setLoading(true);
        setIsUploading(true);
        setUploadProgress(0);
        setUploadResults([]);
        setShowResults(true);

        const results = [];
        let successCount = 0;

        for (let i = 0; i < productsToUpload.length; i++) {
            const product = productsToUpload[i];
            const currentProgress = Math.round(((i) / productsToUpload.length) * 100);
            setUploadProgress(currentProgress);

            try {
                if (!product.name) {
                    throw new Error('Product name is required');
                }

                const imageUrls = [];
                const storagePaths = [];
                if (product.imageFiles && product.imageFiles.length > 0) {
                    for (const [index, imageFile] of product.imageFiles.entries()) {
                        const uniqueId = Date.now();
                        const fileExtension = imageFile.name.split('.').pop();
                        const fileName = `products/${userProfile.uid}/${uniqueId}-product-${index}.${fileExtension}`;
                        const storageRef = ref(storage, fileName);

                        await uploadBytes(storageRef, imageFile);
                        const downloadUrl = await getDownloadURL(storageRef);

                        imageUrls.push(downloadUrl);
                        storagePaths.push(fileName);
                    }
                } let categoriesArray = product.categories;
                if (!Array.isArray(categoriesArray)) {
                    if (typeof categoriesArray === 'string') {
                        categoriesArray = categoriesArray.split(/[,;]/).map(cat => cat.trim());
                    } else {
                        categoriesArray = [];
                    }
                }

                // Convert category names to category IDs
                const categoryIds = categoriesArray.map(categoryName => {
                    // Try to find the category ID in the mapping
                    return categoryMapping[categoryName.toLowerCase()] || null;
                }).filter(id => id !== null); // Remove any null values

                let tagsArray = product.tags;
                if (!Array.isArray(tagsArray)) {
                    if (typeof tagsArray === 'string') {
                        tagsArray = tagsArray.split(/[,;]/).map(tag => tag.trim());
                    } else {
                        tagsArray = [];
                    }
                }

                const categoryId = categoryIds.length > 0 ? categoryIds[0] : ''; const productData = {
                    name: product.name,
                    description: product.description || '',
                    price: parseFloat(product.price) || 0,
                    stockQuantity: parseInt(product.stockQuantity) || 0,
                    categories: categoryIds, // Store category IDs instead of names
                    categoryNames: categoriesArray, // Keep category names for reference
                    category: categoryId,
                    tags: tagsArray,
                    productType: product.productType || 'physical',
                    manufacturingCost: parseFloat(product.manufacturingCost) || 0,
                    // Ensure booleans are properly stored as boolean values
                    isCrowdfunded: Boolean(product.isCrowdfunded === true || product.isCrowdfunded === 'true'),
                    isDirectSell: Boolean(product.isDirectSell === true || product.isDirectSell === 'true'),
                    fundingGoal: parseFloat(product.fundingGoal) || 0,
                    averageRating: parseFloat(product.averageRating) || 0,
                    businessHeldFunds: parseFloat(product.businessHeldFunds) || 0,
                    categoryType: product.categoryType || 'standard',
                    manufacturerEmail: product.manufacturerEmail || '',
                    manufacturingStatus: product.manufacturingStatus || 'pending',
                    rating1Count: parseInt(product.rating1Count) || 0,
                    rating2Count: parseInt(product.rating2Count) || 0,
                    rating3Count: parseInt(product.rating3Count) || 0,
                    rating4Count: parseInt(product.rating4Count) || 0,
                    rating5Count: parseInt(product.rating5Count) || 0,
                    reviewCount: parseInt(product.reviewCount) || 0,
                    currentFunding: parseFloat(product.currentFunding) || 0,
                    investorCount: parseInt(product.investorCount) || 0,
                    fundsSentToManufacturer: product.fundsSentToManufacturer === true || product.fundsSentToManufacturer === 'true',
                    funders: [],
                    imageUrls: imageUrls,
                    storagePaths: storagePaths,
                    designer: product.designer || userProfile?.displayName || 'Unknown Designer',
                    designerId: userProfile.uid,
                    designerName: product.designerName || userProfile?.displayName || 'Unknown Designer',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    status: 'active',
                    approved: false,
                    manufacturerId: null,
                    manufacturer: null
                };

                const docRef = await addDoc(collection(db, 'products'), productData);

                results.push({
                    name: product.name,
                    status: 'success',
                    id: docRef.id
                });

                successCount++;
            } catch (error) {
                console.error('Error uploading product:', error);

                results.push({
                    name: product.name || 'Unnamed Product',
                    status: 'failed',
                    error: error.message
                });
            }
        }

        setUploadProgress(100);
        setUploadResults(results);
        setLoading(false);
        setIsUploading(false);

        if (successCount > 0) {
            const successfulIds = results
                .filter(result => result.status === 'success')
                .map(result => result.id);

            setProducts(products.filter(product =>
                !selectedProducts.includes(product.id) ||
                results.some(r => r.name === product.name && r.status === 'failed')
            ));

            setSelectedProducts([]);
            showSuccess(`Successfully uploaded ${successCount} out of ${productsToUpload.length} products`);
        } else {
            showError('Failed to upload any products');
        }
    };

    const toggleProductSelection = (productId) => {
        setSelectedProducts(prevSelected =>
            prevSelected.includes(productId)
                ? prevSelected.filter(id => id !== productId)
                : [...prevSelected, productId]
        );
    };

    const selectAllProducts = () => {
        if (selectedProducts.length === filteredProducts.length) {
            // If all products are selected, unselect all
            setSelectedProducts([]);
        } else {
            // Otherwise, select all filtered products
            setSelectedProducts(filteredProducts.map(product => product.id));
        }
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const renderCategoryManager = () => {
        return (
            <div className="category-manager">
                <h3>Category Management</h3>
                <div className="category-input-container">
                    <input
                        type="text"
                        placeholder="New category name..."
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="category-input"
                    />
                    <button
                        type="button"
                        className="tool-button tool-button-primary add-category-btn"
                        onClick={() => addNewCategory()}
                        disabled={!newCategory.trim()}
                    >
                        Add Category
                    </button>
                </div>
                <div className="categories-list">
                    {categories.length > 0 ? (
                        <div className="category-tags">
                            {categories.map((category, index) => (
                                <span key={index} className="category-tag">
                                    {category}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="no-categories">No categories available. Add your first category above.</p>
                    )}
                </div>
            </div>
        );
    };

    const renderProductTable = () => {
        if (products.length === 0) {
            return (
                <div className="no-products">
                    <p>No products added. Import a CSV file or add products manually.</p>
                    <button
                        type="button"
                        className="tool-button"
                        onClick={addProduct}
                    >
                        Add Your First Product
                    </button>
                </div>
            );
        }

        const displayHeaders = advancedMode
            ? headers
            : ['name', 'description', 'price', 'stockQuantity', 'categories', 'tags', 'productType', 'manufacturingCost', 'images'];

        return (
            <div className="product-table-container" ref={tableRef}>
                <div className="table-toolbar">
                    <div className="table-filter">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="search-input"
                        />
                        <span className="filter-count">
                            {filteredProducts.length} of {products.length} products
                        </span>
                    </div>
                    <div className="view-mode-toggle">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={advancedMode}
                                onChange={() => setAdvancedMode(!advancedMode)}
                            />
                            <span className="toggle-slider"></span>
                            <span className="toggle-label">Advanced Mode</span>
                        </label>
                    </div>
                </div>
                <div className="table-scroll-container">
                    <table className="product-table">
                        <thead>
                            <tr>
                                <th className="selection-column">
                                    <input
                                        type="checkbox"
                                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                                        onChange={selectAllProducts}
                                    />
                                </th>                                {displayHeaders.map((header, index) => (
                                    <th
                                        key={index}
                                        onClick={() => requestSort(header)}
                                        onMouseEnter={() => handleColumnMouseEnter(header)}
                                        onMouseLeave={handleColumnMouseLeave}
                                        className={`${sortConfig.key === header ? `sort-${sortConfig.direction}` : ''} ${isHighlighted(header) ? 'highlighted-column' : ''}`}
                                        data-title={headerDescriptions[header] || header}
                                    >
                                        {header.charAt(0).toUpperCase() + header.slice(1)}
                                        {sortConfig.key === header && (
                                            <span className="sort-indicator">
                                                {sortConfig.direction === 'ascending' ? ' ▲' : ' ▼'}
                                            </span>
                                        )}
                                    </th>
                                ))}
                                <th className="actions-column">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducts().map((product) => (
                                <tr key={product.id} className={selectedProducts.includes(product.id) ? 'selected-row' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedProducts.includes(product.id)}
                                            onChange={() => toggleProductSelection(product.id)}
                                        />
                                    </td>
                                    {displayHeaders.map((header, index) => {
                                        if (header === 'images') {
                                            return (
                                                <td key={index} className={`image-cell ${isHighlighted(header) ? 'highlighted-cell' : ''}`}>
                                                    <div
                                                        className="image-drop-area"
                                                        onDragOver={(e) => handleDragOver(e, product.id)}
                                                        onDragEnter={handleDragEnter}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, product.id)}
                                                    >
                                                        {product.imageFiles && product.imageFiles.length > 0 ? (
                                                            <div className="image-previews">
                                                                {product.imageFiles.map((file, fileIndex) => (
                                                                    <div key={fileIndex} className="image-preview-container">
                                                                        <img
                                                                            src={URL.createObjectURL(file)}
                                                                            alt={`Preview ${fileIndex}`}
                                                                            className="image-preview"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            className="remove-image"
                                                                            onClick={() => removeImageFile(product.id, fileIndex)}
                                                                        >
                                                                            &times;
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    type="button"
                                                                    className="add-more-images"
                                                                    onClick={() => {
                                                                        setCurrentProductId(product.id);
                                                                        imageInputRef.current.click();
                                                                    }}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="drop-instructions">
                                                                <p>Drop images here</p>
                                                                <p>or</p>
                                                                <button
                                                                    type="button"
                                                                    className="browse-button"
                                                                    onClick={() => {
                                                                        setCurrentProductId(product.id);
                                                                        imageInputRef.current.click();
                                                                    }}
                                                                >
                                                                    Browse
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        } else if (header === 'categories') {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>
                                                    <div className="categories-input-wrapper">                                                    <select
                                                        multiple
                                                        className="categories-select"
                                                        value={Array.isArray(product.categories) ? product.categories : []}
                                                        onChange={(e) => {
                                                            const selectedCategoryNames = Array.from(
                                                                e.target.selectedOptions,
                                                                option => option.value
                                                            );
                                                            updateProductField(product.id, 'categories', selectedCategoryNames);
                                                        }}
                                                    >
                                                        {categories.map((category, catIndex) => (<option key={catIndex} value={category}>
                                                            {category}
                                                        </option>
                                                        ))}
                                                        {/* If the product has a custom category not in the main list, add it as an option */}
                                                        {Array.isArray(product.categories) &&
                                                            product.categories
                                                                .filter(cat => !categories.includes(cat))
                                                                .map((customCat, idx) => (<option key={`custom-${idx}`} value={customCat}>
                                                                    {unsanitizeString(customCat)} (Custom)
                                                                </option>
                                                                ))
                                                        }
                                                    </select>                                                        <div className="category-input-actions">
                                                            <input
                                                                type="text"
                                                                placeholder="Add custom category"
                                                                className="custom-category-input"
                                                                onKeyDown={async (e) => {
                                                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                                                        e.preventDefault();
                                                                        const newCat = e.target.value.trim();
                                                                        const currentCategories = Array.isArray(product.categories) ? [...product.categories] : [];

                                                                        if (!currentCategories.includes(newCat)) {
                                                                            // Also update the global categories list if it's not already there
                                                                            if (!categories.includes(newCat)) {
                                                                                // Add the new category and get its ID
                                                                                const result = await addNewCategory(newCat);
                                                                                if (result) {
                                                                                    const updatedCategories = [...currentCategories, newCat];
                                                                                    updateProductField(product.id, 'categories', updatedCategories);
                                                                                }
                                                                            } else {
                                                                                // Category already exists in the list, just add it to this product
                                                                                const updatedCategories = [...currentCategories, newCat];
                                                                                updateProductField(product.id, 'categories', updatedCategories);
                                                                            }

                                                                            e.target.value = '';
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </div>                                                        <div className="field-info">
                                                            {Array.isArray(product.categories) && product.categories.length > 0
                                                                ? product.categories.map((cat, idx) => (<span key={idx} className="category-tag product-category-tag">
                                                                    {unsanitizeString(cat)}
                                                                    <button
                                                                        className="remove-tag-btn"
                                                                        onClick={() => {
                                                                            const updatedCategories = [...product.categories];
                                                                            updatedCategories.splice(idx, 1);
                                                                            updateProductField(product.id, 'categories', updatedCategories);
                                                                        }}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </span>
                                                                ))
                                                                : <span className="no-categories-msg">No categories selected</span>
                                                            }
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        } else if (header === 'tags') {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>                                                    <input
                                                    type="text" value={Array.isArray(product.tags)
                                                        ? product.tags.map(tag => tag ? unsanitizeString(tag) : '').join(', ')
                                                        : product.tags ? unsanitizeString(product.tags) : ''}
                                                    onChange={(e) => {
                                                        const tagsArray = e.target.value
                                                            .split(',')
                                                            .map(tag => tag.trim())
                                                            .filter(tag => tag);
                                                        updateProductField(product.id, 'tags', tagsArray);
                                                    }}
                                                    placeholder="tag1, tag2, tag3"
                                                />
                                                </td>
                                            );
                                        } else if (header === 'productType') {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>
                                                    <select
                                                        value={product.productType || 'physical'}
                                                        onChange={(e) => updateProductField(product.id, 'productType', e.target.value)}
                                                    >
                                                        <option value="physical">Physical</option>
                                                        <option value="digital">Digital</option>
                                                        <option value="service">Service</option>
                                                    </select>
                                                </td>
                                            );
                                        } else if (header === 'categoryType') {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>
                                                    <select
                                                        value={product.categoryType || 'standard'}
                                                        onChange={(e) => updateProductField(product.id, 'categoryType', e.target.value)}
                                                    >
                                                        <option value="standard">Standard</option>
                                                        <option value="featured">Featured</option>
                                                        <option value="seasonal">Seasonal</option>
                                                    </select>
                                                </td>
                                            );
                                        } else if (header === 'manufacturingStatus') {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>
                                                    <select
                                                        value={product.manufacturingStatus || 'pending'}
                                                        onChange={(e) => updateProductField(product.id, 'manufacturingStatus', e.target.value)}
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="funded">Funded</option>
                                                        <option value="in_production">In Production</option>
                                                        <option value="ready">Ready</option>
                                                        <option value="shipped">Shipped</option>
                                                    </select>
                                                </td>
                                            );
                                        } else if (['isCrowdfunded', 'isDirectSell', 'fundsSentToManufacturer'].includes(header)) {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>
                                                    <select
                                                        value={product[header]?.toString() || 'false'}
                                                        onChange={(e) => updateProductField(
                                                            product.id,
                                                            header,
                                                            e.target.value === 'true'
                                                        )}
                                                    >
                                                        <option value="true">Yes</option>
                                                        <option value="false">No</option>
                                                    </select>
                                                </td>
                                            );
                                        } else if (['price', 'manufacturingCost', 'fundingGoal', 'averageRating', 'businessHeldFunds', 'currentFunding'].includes(header)) {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={product[header] || ''}
                                                        onChange={(e) => updateProductField(product.id, header, e.target.value)}
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                            );
                                        } else if (['stockQuantity', 'rating1Count', 'rating2Count', 'rating3Count', 'rating4Count', 'rating5Count', 'reviewCount', 'investorCount'].includes(header)) {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={product[header] || ''}
                                                        onChange={(e) => updateProductField(product.id, header, e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                            );
                                        } else if (header === 'description') {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>                                                    <textarea
                                                    value={product[header] ? unsanitizeString(product[header]) : ''}
                                                    onChange={(e) => updateProductField(product.id, header, e.target.value)}
                                                    placeholder="Product description"
                                                />
                                                </td>
                                            );
                                        } else {
                                            return (
                                                <td key={index} className={isHighlighted(header) ? 'highlighted-cell' : ''}>                                                    <input
                                                    type="text"
                                                    value={product[header] ? unsanitizeString(product[header]) : ''}
                                                    onChange={(e) => updateProductField(product.id, header, e.target.value)}
                                                    placeholder={`Enter ${header}`}
                                                />
                                                </td>
                                            );
                                        }
                                    })}
                                    <td className="actions-cell">
                                        <button
                                            type="button"
                                            className="delete-product-btn"
                                            onClick={() => removeProduct(product.id)}
                                            title="Delete product"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            className="duplicate-product-btn"
                                            onClick={() => {
                                                const duplicatedProduct = {
                                                    ...product,
                                                    id: uuidv4(),
                                                    name: `${product.name} (Copy)`,
                                                    imageFiles: [...(product.imageFiles || [])],
                                                };
                                                setProducts([...products, duplicatedProduct]);
                                            }}
                                            title="Duplicate product"
                                        >
                                            Copy
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderUploadResults = () => {
        if (!showResults || uploadResults.length === 0) return null;

        return (
            <div className="upload-results-container">
                <h2>Upload Results</h2>
                <div className="results-summary">
                    <span>{uploadResults.filter(r => r.status === 'success').length} successful, </span>
                    <span>{uploadResults.filter(r => r.status === 'failed').length} failed</span>
                </div>
                <div className="results-list">
                    {uploadResults.map((result, index) => (
                        <div
                            key={index}
                            className={`result-item ${result.status}`}
                        >
                            <div className="result-name">{result.name ? unsanitizeString(result.name) : ''}</div>
                            <div className="result-status">
                                {result.status === 'success' ? 'Success' : 'Failed'}
                            </div>
                            {result.error && (
                                <div className="result-error">{result.error}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }; return (
        <div className="unified-product-manager">
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

            <h1>Unified Product Manager</h1>
            <p className="description">
                Import products from CSV, add products manually, edit them, and upload to the database.
            </p>

            <div className="csv-import-container">
                <div
                    className="csv-dropzone"
                    onDragOver={handleDragOverCsv}
                    onDragEnter={handleDragOverCsv}
                    onDragLeave={handleDragLeaveCsv}
                    onDrop={handleDropCsv}
                >
                    <div className="dropzone-content">
                        <h3>Import CSV</h3>
                        <p>Drag & drop a CSV file here or</p>
                        <div className="csv-buttons">
                            <button
                                type="button"
                                className="tool-button"
                                onClick={() => csvInputRef.current.click()}
                            >
                                Browse Files
                            </button>
                            <button
                                type="button"
                                className="tool-button"
                                onClick={downloadCsvTemplate}
                            >
                                Download Template
                            </button>
                        </div>
                        <p className="small-text">
                            CSV will be appended to existing data
                        </p>
                    </div>
                </div>
            </div>

            {renderCategoryManager()}

            <div className="toolbar">
                <div className="toolbar-section">
                    <button
                        type="button"
                        className="tool-button"
                        onClick={addProduct}
                    >
                        Add Product
                    </button>

                    <button
                        type="button"
                        className="tool-button"
                        onClick={duplicateSelectedProducts}
                        disabled={selectedProducts.length === 0}
                    >
                        Duplicate Selected
                    </button>

                    <button
                        type="button"
                        className="tool-button tool-button-warning"
                        onClick={removeSelectedProducts}
                        disabled={selectedProducts.length === 0}
                    >
                        Remove Selected
                    </button>

                    <button
                        type="button"
                        className="tool-button tool-button-danger"
                        onClick={resetForm}
                        disabled={products.length === 0}
                    >
                        Clear All
                    </button>
                </div>

                <div className="toolbar-section">
                    <button
                        type="button"
                        className="tool-button tool-button-primary"
                        onClick={uploadSelectedProducts}
                        disabled={products.length === 0 || isUploading}
                    >
                        {isUploading ? 'Uploading...' : selectedProducts.length > 0
                            ? `Upload ${selectedProducts.length} Selected`
                            : `Upload All (${products.length})`}
                    </button>

                    <button
                        type="button"
                        className="tool-button"
                        onClick={exportCurrentData}
                        disabled={products.length === 0}
                    >
                        Export as CSV
                    </button>
                </div>
            </div>

            {loading && (
                <div className="progress-container">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                    <div className="progress-text">{uploadProgress}% Complete</div>
                </div>
            )}

            <input
                type="file"
                accept=".csv"
                ref={csvInputRef}
                onChange={handleCsvImport}
                style={{ display: 'none' }}
            />

            <input
                type="file"
                accept="image/*"
                multiple
                ref={imageInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (currentProductId) {
                        handleImageSelect(currentProductId, e);
                    }
                }}
            />

            {renderProductTable()}
            {renderUploadResults()}

            <div className="bottom-navigation">
                <a href="/admin" className="back-button">Back to Admin Dashboard</a>
            </div>
        </div>
    );
};

export default ProductsCsvImportPage;