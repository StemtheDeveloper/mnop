import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import AuthGuard from '../components/AuthGuard';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/AdminTools.css';
import '../styles/CsvTools.css';

const ProductsCsvExportPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [queryLimit, setQueryLimit] = useState(500);
    const [queryField, setQueryField] = useState('');
    const [queryValue, setQueryValue] = useState('');
    const [includeFields, setIncludeFields] = useState({
        id: true,
        name: true,
        description: true,
        price: true,
        manufacturingCost: true,
        fundingGoal: true,
        categories: true,
        status: true,
        currentFunding: true,
        designerId: true,
        businessHeldFunds: true,
        category: true,
        categoryType: true,
        createdAt: true,
        designerName: true,
        funders: true,
        fundsSentToManufacturer: true,
        imageUrls: true,
        investorCount: true,
        isCrowdfunded: true,
        isDirectSell: true,
        lastFundedAt: true,
        likesCount: true,
        manufacturerEmail: true,
        manufacturerId: true,
        manufacturingStartDate: true,
        manufacturingStatus: true,
        storagePaths: true,
        updatedAt: true
    });

    // Function to fetch products
    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            let productsQuery;

            if (queryField && queryValue) {
                productsQuery = query(
                    collection(db, 'products'),
                    where(queryField, '==', queryValue),
                    limit(queryLimit)
                );
            } else {
                productsQuery = query(
                    collection(db, 'products'),
                    limit(queryLimit)
                );
            }

            const snapshot = await getDocs(productsQuery);

            if (snapshot.empty) {
                setError('No products found with the specified criteria');
                setLoading(false);
                return;
            }

            const fetchedProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setProducts(fetchedProducts);
            setSuccess(`Successfully loaded ${fetchedProducts.length} products`);
        } catch (err) {
            console.error('Error fetching products:', err);
            setError(`Failed to load products: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Function to convert objects to CSV
    const convertToCSV = (objArray) => {
        if (objArray.length === 0) return '';

        // Get all selected field keys
        const selectedFields = Object.keys(includeFields).filter(key => includeFields[key]);

        // Create header row
        const header = selectedFields.join(',');

        // Create data rows
        const rows = objArray.map(obj => {
            return selectedFields.map(field => {
                let value = obj[field];

                // Handle special cases
                if (field === 'categories' && Array.isArray(value)) {
                    // Convert array to string with semicolons
                    value = value.join(';');
                } else if (value instanceof Date) {
                    // Format dates as strings
                    value = value.toISOString();
                } else if (typeof value === 'object' && value !== null) {
                    // Handle Firebase timestamps
                    if (value.seconds !== undefined && value.nanoseconds !== undefined) {
                        const date = new Date(value.seconds * 1000);
                        value = date.toISOString();
                    } else {
                        // Stringify other objects
                        value = JSON.stringify(value);
                    }
                } else if (typeof value === 'string') {
                    // Escape quotes and wrap in quotes if the value contains a comma or newline
                    value = value.replace(/"/g, '""');
                    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                        value = `"${value}"`;
                    }
                } else if (value === undefined || value === null) {
                    // Return empty string for undefined/null values
                    value = '';
                }

                return value;
            }).join(',');
        });

        return [header, ...rows].join('\n');
    };

    // Function to export products as CSV
    const exportToCSV = () => {
        try {
            if (products.length === 0) {
                setError('No products available to export');
                return;
            }

            const csv = convertToCSV(products);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setSuccess('Products exported successfully');
        } catch (err) {
            console.error('Error exporting products:', err);
            setError(`Failed to export products: ${err.message}`);
        }
    };

    // Toggle all fields
    const toggleAllFields = (value) => {
        const updatedFields = {};
        Object.keys(includeFields).forEach(field => {
            updatedFields[field] = value;
        });
        setIncludeFields(updatedFields);
    };

    // Handle individual field toggle
    const handleFieldToggle = (field) => {
        setIncludeFields(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    return (
        <AuthGuard allowedRoles="admin">
            <div className="admin-tools-page">
                <h1>Products CSV Export</h1>

                <div className="admin-tools-section">
                    <div className="csv-export-container">
                        <p className="tool-description">
                            Export products data to a CSV file for offline editing. You can filter the products
                            and select which fields to include in the export. After modifying the CSV, you can
                            re-import it to update product information including manufacturing costs.
                        </p>

                        {(success || error) && (
                            <div className={`message ${error ? 'error' : 'success'}`}>
                                {error || success}
                            </div>
                        )}

                        <div className="export-controls">
                            <div className="control-section">
                                <label>
                                    Limit Results:
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={queryLimit}
                                        onChange={(e) => setQueryLimit(parseInt(e.target.value) || 100)}
                                        disabled={loading}
                                    />
                                </label>
                            </div>

                            <div className="control-section">
                                <label>
                                    Query Field (optional):
                                    <input
                                        type="text"
                                        value={queryField}
                                        onChange={(e) => setQueryField(e.target.value.trim())}
                                        placeholder="e.g. category"
                                        disabled={loading}
                                    />
                                </label>

                                <label>
                                    Query Value (optional):
                                    <input
                                        type="text"
                                        value={queryValue}
                                        onChange={(e) => setQueryValue(e.target.value.trim())}
                                        placeholder="e.g. electronics"
                                        disabled={loading}
                                    />
                                </label>
                            </div>

                            <div className="button-row">
                                <button
                                    className="load-data-btn"
                                    onClick={fetchProducts}
                                    disabled={loading}
                                >
                                    {loading ? 'Loading...' : 'Load Products'}
                                </button>

                                <button
                                    className="export-btn"
                                    onClick={exportToCSV}
                                    disabled={loading || products.length === 0}
                                >
                                    Export to CSV
                                </button>
                            </div>
                        </div>

                        <div className="field-selection-section">
                            <h3>Fields to Include in Export</h3>
                            <div className="field-toggle-all">
                                <button onClick={() => toggleAllFields(true)}>Select All</button>
                                <button onClick={() => toggleAllFields(false)}>Deselect All</button>
                            </div>
                            <div className="field-checkboxes">
                                {Object.keys(includeFields).map(field => (
                                    <label key={field} className="field-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={includeFields[field]}
                                            onChange={() => handleFieldToggle(field)}
                                        />
                                        {field}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-container">
                                <LoadingSpinner />
                                <p>Loading products...</p>
                            </div>
                        ) : (
                            <div className="products-preview">
                                <h3>Products Preview ({products.length})</h3>
                                {products.length > 0 ? (
                                    <div className="preview-table-container">
                                        <table className="preview-table">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Name</th>
                                                    <th>Price</th>
                                                    <th>Manufacturing Cost</th>
                                                    <th>Categories</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {products.slice(0, 10).map(product => (
                                                    <tr key={product.id}>
                                                        <td>{product.id}</td>
                                                        <td>{product.name}</td>
                                                        <td>${product.price}</td>
                                                        <td>${product.manufacturingCost || 'Not set'}</td>
                                                        <td>{Array.isArray(product.categories) ? product.categories.join(', ') : (product.category || 'None')}</td>
                                                    </tr>
                                                ))}
                                                {products.length > 10 && (
                                                    <tr>
                                                        <td colSpan="5" className="more-indicator">
                                                            ... and {products.length - 10} more products
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="no-products">No products loaded. Click "Load Products" to begin.</p>
                                )}
                            </div>
                        )}

                        <div className="export-instructions">
                            <h3>Instructions</h3>
                            <ol>
                                <li>Set optional filters to narrow down the products to export</li>
                                <li>Click "Load Products" to retrieve the data</li>
                                <li>Select which fields to include in the CSV export</li>
                                <li>Click "Export to CSV" to download the file</li>
                                <li>Edit the CSV file using a spreadsheet program like Excel or Google Sheets</li>
                                <li>Save the file in CSV format when done</li>
                                <li>Use the "Import Products from CSV" page to update the products with your changes</li>
                            </ol>
                            <p className="important-note">
                                <strong>Important:</strong> When editing the CSV:
                                <ul>
                                    <li>Do not change the ID column as it's used to identify the products</li>
                                    <li>If the categories field contains multiple values, they should be separated by semicolons (;)</li>
                                    <li>Do not add quotes around numeric values like price or manufacturingCost</li>
                                </ul>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="navigation-links">
                    <a href="/admin/products-csv-import" className="nav-link">Go to Import Products</a>
                    <a href="/admin" className="nav-link">Back to Admin Dashboard</a>
                </div>
            </div>
        </AuthGuard>
    );
};

export default ProductsCsvExportPage;