import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../contexts/ToastContext';
import { storage, db } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import '../styles/BulkProductUploader.css';

const ProductsCsvImportPage = () => {
    const { userProfile, userRole, hasRole } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState('csv');
    const [loading, setLoading] = useState(false);
    const [csvFile, setCsvFile] = useState(null);
    const [csvData, setCsvData] = useState([]);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResults, setUploadResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoryRef = doc(db, 'settings', 'categories');
                const categorySnap = await getDoc(categoryRef);

                if (categorySnap.exists()) {
                    setCategories(categorySnap.data().categories || []);
                } else {
                    console.log('No categories found');
                    setCategories([]);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
                showError('Failed to load categories');
            }
        };

        fetchCategories();
    }, [showError]);

    if (!hasRole('designer')) {
        return (
            <div className="bulk-product-uploader-page">
                <div className="role-error-container">
                    <h2>Access Denied</h2>
                    <p>You need designer permissions to access this page.</p>
                </div>
            </div>
        );
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCsvFile(file);

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data && results.data.length > 0) {
                        setCsvHeaders(results.meta.fields || []);
                        setCsvData(results.data);
                    } else {
                        showError('The CSV file appears to be empty or malformed');
                        setCsvHeaders([]);
                        setCsvData([]);
                    }
                },
                error: (error) => {
                    console.error('CSV parsing error:', error);
                    showError('Failed to parse CSV file');
                }
            });
        }
    };

    const downloadCsvTemplate = () => {
        const headers = [
            'name', 'description', 'price', 'stockQuantity', 'categories',
            'tags', 'productType', 'manufacturingCost', 'designer'
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
                designer: userProfile?.displayName || ''
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
    };

    const uploadImage = async (file, productName) => {
        if (!file) return null;

        const uniqueId = uuidv4();
        const fileExtension = file.name.split('.').pop();
        const fileName = `products/${userProfile.uid}/${uniqueId}.${fileExtension}`;
        const storageRef = ref(storage, fileName);

        try {
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);
            return downloadUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw new Error(`Failed to upload image for ${productName}`);
        }
    };

    const processCsvUpload = async () => {
        if (!csvData || csvData.length === 0) {
            showError('No CSV data found');
            return;
        }

        setLoading(true);
        setUploadProgress(0);
        setUploadResults([]);
        setShowResults(true);

        const results = [];
        let successCount = 0;

        for (let i = 0; i < csvData.length; i++) {
            const product = csvData[i];
            const currentProgress = Math.round(((i) / csvData.length) * 100);
            setUploadProgress(currentProgress);

            try {
                const categoriesArray = product.categories ?
                    product.categories.split(',').map(cat => cat.trim()) : [];

                const tagsArray = product.tags ?
                    product.tags.split(',').map(tag => tag.trim()) : [];

                const productData = {
                    name: product.name || 'Unnamed Product',
                    description: product.description || '',
                    price: parseFloat(product.price) || 0,
                    stockQuantity: parseInt(product.stockQuantity) || 0,
                    categories: categoriesArray,
                    tags: tagsArray,
                    productType: product.productType || 'physical',
                    manufacturingCost: parseFloat(product.manufacturingCost) || 0,
                    images: [],
                    designer: product.designer || userProfile?.displayName || 'Unknown Designer',
                    designerId: userProfile.uid,
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

        showSuccess(`Successfully uploaded ${successCount} out of ${csvData.length} products`);
    };

    const addProduct = () => {
        setProducts([
            ...products,
            {
                id: uuidv4(),
                name: '',
                description: '',
                price: '',
                stockQuantity: '',
                categories: [],
                tags: [],
                productType: 'physical',
                manufacturingCost: '',
                images: [],
                imageFiles: [],
                designer: userProfile?.displayName || '',
                designerId: userProfile.uid
            }
        ]);
    };

    const removeProduct = (productId) => {
        setProducts(products.filter(product => product.id !== productId));
    };

    const updateProductField = (productId, field, value) => {
        setProducts(products.map(product => {
            if (product.id === productId) {
                return { ...product, [field]: value };
            }
            return product;
        }));
    };

    const handleFileSelect = (productId, e) => {
        const files = Array.from(e.target.files);

        if (files.length > 0) {
            setProducts(products.map(product => {
                if (product.id === productId) {
                    return {
                        ...product,
                        imageFiles: [...product.imageFiles, ...files]
                    };
                }
                return product;
            }));
        }
    };

    const processManualUpload = async () => {
        if (products.length === 0) {
            showError('No products to upload');
            return;
        }

        setLoading(true);
        setUploadProgress(0);
        setUploadResults([]);
        setShowResults(true);

        const results = [];
        let successCount = 0;

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const currentProgress = Math.round(((i) / products.length) * 100);
            setUploadProgress(currentProgress);

            try {
                if (!product.name) {
                    throw new Error('Product name is required');
                }

                const imageUrls = [];
                for (const imageFile of product.imageFiles) {
                    const imageUrl = await uploadImage(imageFile, product.name);
                    if (imageUrl) {
                        imageUrls.push(imageUrl);
                    }
                }

                const productData = {
                    name: product.name,
                    description: product.description || '',
                    price: parseFloat(product.price) || 0,
                    stockQuantity: parseInt(product.stockQuantity) || 0,
                    categories: product.categories || [],
                    tags: product.tags || [],
                    productType: product.productType || 'physical',
                    manufacturingCost: parseFloat(product.manufacturingCost) || 0,
                    images: imageUrls,
                    designer: userProfile?.displayName || 'Unknown Designer',
                    designerId: userProfile.uid,
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

        if (successCount > 0) {
            showSuccess(`Successfully uploaded ${successCount} out of ${products.length} products`);
        } else {
            showError('Failed to upload any products');
        }
    };

    const resetForm = () => {
        if (activeTab === 'csv') {
            setCsvFile(null);
            setCsvData([]);
            setCsvHeaders([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } else {
            setProducts([]);
        }

        setUploadResults([]);
        setShowResults(false);
        setUploadProgress(0);
    };

    const renderCsvPreview = () => {
        if (!csvData || csvData.length === 0) return null;

        return (
            <div className="csv-preview">
                <h3>CSV Preview ({csvData.length} products)</h3>
                <div className="preview-table-container">
                    <table className="preview-table">
                        <thead>
                            <tr>
                                {csvHeaders.map((header, index) => (
                                    <th key={index}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {csvData.slice(0, 5).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {csvHeaders.map((header, colIndex) => (
                                        <td key={colIndex}>{row[header]}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {csvData.length > 5 && (
                    <p className="preview-note">Showing first 5 of {csvData.length} products</p>
                )}
            </div>
        );
    };

    const renderProductForm = (product, index) => {
        return (
            <div className="product-entry" key={product.id}>
                <div className="product-entry-header">
                    <h3>Product #{index + 1}</h3>
                    <button
                        type="button"
                        className="remove-product-btn"
                        onClick={() => removeProduct(product.id)}
                    >
                        Remove
                    </button>
                </div>

                <div className="product-form-layout">
                    <div className="product-form-left">
                        <div className="form-group">
                            <label htmlFor={`name-${product.id}`}>Product Name *</label>
                            <input
                                type="text"
                                id={`name-${product.id}`}
                                value={product.name}
                                onChange={(e) => updateProductField(product.id, 'name', e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor={`description-${product.id}`}>Description</label>
                            <textarea
                                id={`description-${product.id}`}
                                value={product.description}
                                onChange={(e) => updateProductField(product.id, 'description', e.target.value)}
                                rows={4}
                            />
                        </div>

                        <div className="form-group">
                            <label>Product Type</label>
                            <div className="product-type-toggle">
                                <label>
                                    <input
                                        type="radio"
                                        value="physical"
                                        checked={product.productType === 'physical'}
                                        onChange={() => updateProductField(product.id, 'productType', 'physical')}
                                    />
                                    Physical
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        value="digital"
                                        checked={product.productType === 'digital'}
                                        onChange={() => updateProductField(product.id, 'productType', 'digital')}
                                    />
                                    Digital
                                </label>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor={`price-${product.id}`}>Price ($)</label>
                                <input
                                    type="text"
                                    id={`price-${product.id}`}
                                    value={product.price}
                                    onChange={(e) => updateProductField(product.id, 'price', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor={`stockQuantity-${product.id}`}>Stock Quantity</label>
                                <input
                                    type="text"
                                    id={`stockQuantity-${product.id}`}
                                    value={product.stockQuantity}
                                    onChange={(e) => updateProductField(product.id, 'stockQuantity', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor={`manufacturingCost-${product.id}`}>Manufacturing Cost ($)</label>
                                <input
                                    type="text"
                                    id={`manufacturingCost-${product.id}`}
                                    value={product.manufacturingCost}
                                    onChange={(e) => updateProductField(product.id, 'manufacturingCost', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="product-form-right">
                        <div className="form-group">
                            <label htmlFor={`categories-${product.id}`}>Categories</label>
                            <select
                                id={`categories-${product.id}`}
                                multiple
                                className="multi-select"
                                value={product.categories}
                                onChange={(e) => {
                                    const selectedCategories = Array.from(
                                        e.target.selectedOptions,
                                        option => option.value
                                    );
                                    updateProductField(product.id, 'categories', selectedCategories);
                                }}
                            >
                                {categories.map((category, index) => (
                                    <option key={index} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                            <span className="selected-categories">
                                {product.categories && product.categories.length > 0
                                    ? `Selected: ${product.categories.join(', ')}`
                                    : 'No categories selected'}
                            </span>
                        </div>

                        <div className="form-group">
                            <label htmlFor={`tags-${product.id}`}>Tags (comma separated)</label>
                            <input
                                type="text"
                                id={`tags-${product.id}`}
                                value={product.tags}
                                onChange={(e) => {
                                    const tagsArray = e.target.value.split(',').map(tag => tag.trim());
                                    updateProductField(product.id, 'tags', tagsArray);
                                }}
                                placeholder="e.g. summer, outdoor, kids"
                            />
                        </div>

                        <div className="form-group">
                            <label>Product Images</label>
                            <input
                                type="file"
                                id={`fileInput-${product.id}`}
                                style={{ display: 'none' }}
                                multiple
                                accept="image/*"
                                onChange={(e) => handleFileSelect(product.id, e)}
                            />

                            <div className="image-upload-area">
                                {product.imageFiles && product.imageFiles.map((file, index) => (
                                    <div className="image-preview-container" key={index}>
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt={`Preview ${index}`}
                                            className="image-preview"
                                        />
                                        <button
                                            type="button"
                                            className="remove-image-btn"
                                            onClick={() => {
                                                const updatedImageFiles = [...product.imageFiles];
                                                updatedImageFiles.splice(index, 1);
                                                updateProductField(product.id, 'imageFiles', updatedImageFiles);
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}

                                <label
                                    htmlFor={`fileInput-${product.id}`}
                                    className="upload-placeholder"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    <p>Add Images</p>
                                    <span>Click or drag files</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderUploadProgress = () => {
        if (!showResults) return null;

        return (
            <div className="upload-progress">
                <h3>Upload Progress</h3>
                <div className="progress-bar-container">
                    <div
                        className="progress-bar"
                        style={{ width: `${uploadProgress}%` }}
                    ></div>
                </div>
                <div className="progress-stats">
                    <span>{uploadProgress}% Complete</span>
                    <span>{uploadResults.filter(r => r.status === 'success').length} Successful / {uploadResults.length} Total</span>
                </div>

                {uploadResults.length > 0 && (
                    <div className="upload-results">
                        <h3>Upload Results</h3>
                        <div className="results-list">
                            {uploadResults.map((result, index) => (
                                <div
                                    key={index}
                                    className={`result-item ${result.status}`}
                                >
                                    <span className="result-name">{result.name}</span>
                                    <span className="result-status">
                                        {result.status === 'success' ? 'Success' : 'Failed'}
                                    </span>
                                    {result.error && (
                                        <div className="result-error">{result.error}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bulk-product-uploader-page">
            <div className="bulk-product-uploader-container">
                <h1>Bulk Product Uploader</h1>

                <div className="upload-tabs">
                    <button
                        className={`tab-button ${activeTab === 'csv' ? 'active' : ''}`}
                        onClick={() => setActiveTab('csv')}
                    >
                        CSV Import
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('manual')}
                    >
                        Manual Entry
                    </button>
                </div>

                {activeTab === 'csv' ? (
                    <div className="csv-import-section">
                        <p className="upload-instructions">
                            Upload a CSV file containing product information. The CSV should have headers matching the product fields.
                            You can download a template below to get started.
                        </p>

                        <div className="csv-template-section">
                            <h3>CSV Template</h3>
                            <p>Download a template CSV file with required headers and example data.</p>
                            <button
                                className="template-button"
                                onClick={downloadCsvTemplate}
                            >
                                Download Template
                            </button>
                        </div>

                        <div className="file-input-wrapper">
                            <label className="file-input-label">Select CSV File</label>
                            <input
                                type="file"
                                accept=".csv"
                                className="file-input"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                id="csvFileInput"
                            />
                            <label htmlFor="csvFileInput" className="file-input-button">
                                Choose File
                            </label>

                            {csvFile && (
                                <div className="file-info">
                                    Selected file: {csvFile.name} ({Math.round(csvFile.size / 1024)} KB)
                                </div>
                            )}
                        </div>

                        {renderCsvPreview()}

                        <div className="form-actions">
                            <button
                                className="reset-button"
                                onClick={resetForm}
                                disabled={loading || (!csvFile && uploadResults.length === 0)}
                            >
                                Reset
                            </button>

                            <button
                                className="submit-button"
                                onClick={processCsvUpload}
                                disabled={loading || !csvFile || csvData.length === 0}
                            >
                                {loading ? 'Uploading...' : 'Upload Products'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="manual-entry-section">
                        {products.length === 0 ? (
                            <div className="empty-products">
                                <p>No products added yet. Click the button below to add your first product.</p>
                                <button
                                    className="add-product-button"
                                    onClick={addProduct}
                                >
                                    Add Product
                                </button>
                            </div>
                        ) : (
                            <div className="product-entries">
                                {products.map((product, index) => renderProductForm(product, index))}

                                <div className="add-product-container">
                                    <button
                                        className="add-product-button"
                                        onClick={addProduct}
                                    >
                                        Add Another Product
                                    </button>
                                </div>

                                <div className="form-actions">
                                    <button
                                        className="reset-button"
                                        onClick={resetForm}
                                        disabled={loading}
                                    >
                                        Reset
                                    </button>

                                    <button
                                        className="submit-button"
                                        onClick={processManualUpload}
                                        disabled={loading || products.length === 0}
                                    >
                                        {loading ? 'Uploading...' : 'Upload Products'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {renderUploadProgress()}
            </div>
        </div>
    );
};

export default ProductsCsvImportPage;