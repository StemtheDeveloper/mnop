import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';


const BulkProductUploaderPage = () => {
    const { userProfile, userRole, hasRole } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [csvFile, setCsvFile] = useState(null);
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
                        // Convert CSV data to product format and append to existing products
                        const newProducts = results.data.map(product => ({
                            id: uuidv4(),
                            name: product.name || '',
                            description: product.description || '',
                            price: product.price || '',
                            stockQuantity: product.stockQuantity || '0',
                            categories: product.categories ? product.categories.split(',').map(cat => cat.trim()) : [],
                            tags: product.tags ? product.tags.split(',').map(tag => tag.trim()) : [],
                            productType: product.productType || 'physical',
                            manufacturingCost: product.manufacturingCost || '',
                            images: [],
                            imageFiles: [],
                            designer: product.designer || userProfile?.displayName || '',
                            designerId: userProfile.uid
                        }));

                        // Append to existing products rather than replacing them
                        setProducts(prevProducts => [...prevProducts, ...newProducts]);
                        showSuccess(`Imported ${newProducts.length} products from CSV`);
                    } else {
                        showError('The CSV file appears to be empty or malformed');
                    }

                    // Clear the file input so the same file can be selected again if needed
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                    setCsvFile(null);
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

    const addProduct = () => {
        setProducts([
            ...products,
            {
                id: uuidv4(),
                name: '',
                description: '',
                price: '',
                stockQuantity: '0',
                lowStockThreshold: '5',
                categories: [],
                tags: [],
                productType: 'physical',
                manufacturingCost: '',
                images: [],
                imageFiles: [],
                designer: userProfile?.displayName || '',
                designerId: userProfile.uid,
                trackInventory: false
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

    const processUpload = async () => {
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
                    lowStockThreshold: parseInt(product.lowStockThreshold) || 5,
                    trackInventory: product.trackInventory || false,
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
        if (window.confirm('Are you sure you want to clear all products?')) {
            setProducts([]);
            setUploadResults([]);
            setShowResults(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const exportToCsv = () => {
        if (products.length === 0) {
            showError('No products to export');
            return;
        }

        const headers = [
            'name', 'description', 'price', 'stockQuantity', 'categories',
            'tags', 'productType', 'manufacturingCost', 'designer'
        ];

        const csvData = products.map(product => ({
            name: product.name,
            description: product.description,
            price: product.price,
            stockQuantity: product.stockQuantity,
            categories: (product.categories || []).join(','),
            tags: (product.tags || []).join(','),
            productType: product.productType,
            manufacturingCost: product.manufacturingCost,
            designer: product.designer
        }));

        const csv = Papa.unparse({
            fields: headers,
            data: csvData
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `product_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderProductsTable = () => {
        if (products.length === 0) {
            return (
                <div className="empty-products">
                    <p>No products added yet. Add products by clicking the "Add Product" button or importing a CSV file.</p>
                    <button className="add-product-button" onClick={addProduct}>
                        Add Product
                    </button>
                </div>
            );
        }

        return (
            <div className="products-table-container">
                <div className="table-actions">
                    <button className="add-product-button" onClick={addProduct}>
                        Add Product
                    </button>
                    <button className="export-csv-button" onClick={exportToCsv}>
                        Export to CSV
                    </button>
                </div>

                <div className="products-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Manufacturing Cost</th>
                                <th>Categories</th>
                                <th>Images</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.id}>
                                    <td>
                                        <input
                                            type="text"
                                            value={product.name}
                                            onChange={(e) => updateProductField(product.id, 'name', e.target.value)}
                                            placeholder="Product Name"
                                            className="table-input name-input"
                                        />
                                    </td>
                                    <td>
                                        <textarea
                                            value={product.description}
                                            onChange={(e) => updateProductField(product.id, 'description', e.target.value)}
                                            placeholder="Description"
                                            className="table-input description-input"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={product.price}
                                            onChange={(e) => updateProductField(product.id, 'price', e.target.value)}
                                            placeholder="0.00"
                                            className="table-input price-input"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            value={product.stockQuantity}
                                            onChange={(e) => updateProductField(product.id, 'stockQuantity', e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            className="table-input stock-input"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={product.manufacturingCost}
                                            onChange={(e) => updateProductField(product.id, 'manufacturingCost', e.target.value)}
                                            placeholder="0.00"
                                            className="table-input cost-input"
                                        />
                                    </td>
                                    <td>
                                        <select
                                            multiple
                                            className="table-input categories-input"
                                            value={product.categories || []}
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
                                        <div className="selected-categories-text">
                                            {product.categories && product.categories.length > 0
                                                ? product.categories.join(', ')
                                                : 'None'}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="image-upload-cell">
                                            <input
                                                type="file"
                                                id={`fileInput-${product.id}`}
                                                style={{ display: 'none' }}
                                                multiple
                                                accept="image/*"
                                                onChange={(e) => handleFileSelect(product.id, e)}
                                            />

                                            <div className="image-thumbnails">
                                                {product.imageFiles && product.imageFiles.map((file, index) => (
                                                    <div className="image-thumbnail" key={index}>
                                                        <img
                                                            src={URL.createObjectURL(file)}
                                                            alt={`Thumbnail ${index}`}
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
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}

                                                <label
                                                    htmlFor={`fileInput-${product.id}`}
                                                    className="add-image-btn"
                                                >
                                                    +
                                                </label>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            className="remove-row-btn"
                                            onClick={() => removeProduct(product.id)}
                                            title="Remove product"
                                        >
                                            Delete
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
                <h1>Product Uploader</h1>

                <div className="import-section">
                    <div className="csv-action-buttons">
                        <div>
                            <button className="template-button" onClick={downloadCsvTemplate}>
                                Download CSV Template
                            </button>

                            <div className="file-input-wrapper">
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="file-input"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    id="csvFileInput"
                                />
                                <label htmlFor="csvFileInput" className="file-input-button">
                                    Import CSV
                                </label>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                className="reset-button"
                                onClick={resetForm}
                                disabled={loading || products.length === 0}
                            >
                                Clear All
                            </button>

                            <button
                                className="submit-button"
                                onClick={processUpload}
                                disabled={loading || products.length === 0}
                            >
                                {loading ? 'Uploading...' : 'Upload All Products'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="products-section">
                    {renderProductsTable()}
                </div>

                {renderUploadProgress()}
            </div>
        </div>
    );
};

export default BulkProductUploaderPage;