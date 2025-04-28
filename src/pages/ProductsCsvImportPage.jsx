import React, { useState, useRef } from 'react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import AuthGuard from '../components/AuthGuard';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/AdminTools.css';
import '../styles/CsvTools.css';

const ProductsCsvImportPage = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [preview, setPreview] = useState([]);
    const [updateSummary, setUpdateSummary] = useState(null);
    const fileInputRef = useRef(null);

    // Helper function to parse CSV text into array of objects
    const parseCSV = (csvText) => {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const headers = lines[0].split(',');

        // Ensure ID field exists
        if (!headers.includes('id')) {
            throw new Error('CSV must include an "id" column to identify products');
        }

        return lines.slice(1).map((line, lineIndex) => {
            // Handle quoted values with commas
            let inQuote = false;
            let currentValue = '';
            const values = [];

            // Parse values handling quoted fields
            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentValue);
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue); // Add the last value

            // Create object from headers and values
            const obj = {};

            headers.forEach((header, index) => {
                let value = index < values.length ? values[index] : '';

                // Clean up quoted values
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1).replace(/""/g, '"');
                }

                // Convert to appropriate types
                if (header === 'categories' && value.includes(';')) {
                    obj[header] = value.split(';').map(v => v.trim()).filter(v => v !== '');
                } else if (header === 'price' || header === 'manufacturingCost' || header === 'fundingGoal' || header === 'currentFunding') {
                    // Convert numeric values
                    const numValue = parseFloat(value);
                    obj[header] = isNaN(numValue) ? null : numValue;
                } else {
                    obj[header] = value;
                }
            });

            return obj;
        });
    };

    // Handle file selection
    const handleFileChange = (e) => {
        setError(null);
        setSuccess(null);
        setPreview([]);
        setUpdateSummary(null);

        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
            setError('Please select a CSV file');
            fileInputRef.current.value = '';
            return;
        }

        setFile(selectedFile);

        // Generate preview
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = parseCSV(e.target.result);
                setPreview(parsed.slice(0, 5)); // Show first 5 rows as preview
            } catch (err) {
                console.error('Error parsing CSV:', err);
                setError(`Error parsing CSV: ${err.message}`);
                setFile(null);
                fileInputRef.current.value = '';
            }
        };
        reader.onerror = () => {
            setError('Error reading file');
            setFile(null);
            fileInputRef.current.value = '';
        };
        reader.readAsText(selectedFile);
    };

    // Handle CSV import
    const handleImport = async () => {
        if (!file) {
            setError('Please select a CSV file first');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        setUpdateSummary(null);

        try {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const products = parseCSV(e.target.result);

                    // Validate products have IDs
                    if (products.some(p => !p.id)) {
                        throw new Error('Some products are missing ID values');
                    }

                    // Prepare batch update
                    const batch = writeBatch(db);
                    let updatedCount = 0;
                    let skippedCount = 0;
                    let errorCount = 0;
                    const updatedFields = {};
                    const errors = [];

                    // Process each product
                    for (const product of products) {
                        try {
                            const { id, ...updateData } = product;
                            const productRef = doc(db, 'products', id);

                            // Add validation/cleaning here if needed
                            // For example, ensure manufacturingCost is a valid number
                            if (updateData.manufacturingCost !== undefined && updateData.manufacturingCost !== null) {
                                if (isNaN(updateData.manufacturingCost)) {
                                    updateData.manufacturingCost = 0;
                                }
                            }

                            // Add to batch
                            batch.update(productRef, updateData);
                            updatedCount++;

                            // Track which fields were updated
                            Object.keys(updateData).forEach(field => {
                                updatedFields[field] = (updatedFields[field] || 0) + 1;
                            });
                        } catch (err) {
                            errorCount++;
                            errors.push({
                                productId: product.id,
                                error: err.message
                            });
                        }
                    }

                    // Commit the batch
                    await batch.commit();

                    setSuccess(`Successfully imported CSV. Updated ${updatedCount} products.`);
                    setUpdateSummary({
                        updatedProducts: updatedCount,
                        skippedProducts: skippedCount,
                        errors: errorCount,
                        fieldsUpdated: updatedFields,
                        errorDetails: errors.length > 0 ? errors : null
                    });
                } catch (err) {
                    console.error('Error importing CSV:', err);
                    setError(`Failed to import CSV: ${err.message}`);
                } finally {
                    setLoading(false);
                }
            };

            reader.onerror = () => {
                setError('Error reading file');
                setLoading(false);
            };

            reader.readAsText(file);
        } catch (err) {
            console.error('Error in import process:', err);
            setError(`Import process failed: ${err.message}`);
            setLoading(false);
        }
    };

    // Reset form
    const handleReset = () => {
        setFile(null);
        setPreview([]);
        setError(null);
        setSuccess(null);
        setUpdateSummary(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <AuthGuard allowedRoles="admin">
            <div className="admin-tools-page">
                <h1>Products CSV Import</h1>

                <div className="admin-tools-section">
                    <div className="csv-import-container">
                        <p className="tool-description">
                            Import a CSV file to update existing products in the database. This tool is designed
                            to work with CSV files exported from the Products CSV Export tool. You can use this
                            to update manufacturing costs and other product details in bulk.
                        </p>

                        {(success || error) && (
                            <div className={`message ${error ? 'error' : 'success'}`}>
                                {error || success}
                            </div>
                        )}

                        <div className="import-controls">
                            <div className="file-input-section">
                                <label>
                                    Select CSV File:
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                        ref={fileInputRef}
                                        disabled={loading}
                                    />
                                </label>
                                <div className="file-info">
                                    {file && (
                                        <span>Selected file: {file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                                    )}
                                </div>
                            </div>

                            <div className="button-row">
                                <button
                                    className="import-btn"
                                    onClick={handleImport}
                                    disabled={loading || !file}
                                >
                                    {loading ? 'Importing...' : 'Import CSV'}
                                </button>
                                <button
                                    className="reset-btn"
                                    onClick={handleReset}
                                    disabled={loading}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-container">
                                <LoadingSpinner />
                                <p>Importing products... This may take a moment.</p>
                            </div>
                        ) : (
                            <>
                                {preview.length > 0 && (
                                    <div className="preview-section">
                                        <h3>File Preview (First 5 rows)</h3>
                                        <div className="preview-table-container">
                                            <table className="preview-table">
                                                <thead>
                                                    <tr>
                                                        {Object.keys(preview[0]).map(header => (
                                                            <th key={header}>{header}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {preview.map((row, index) => (
                                                        <tr key={index}>
                                                            {Object.values(row).map((value, i) => (
                                                                <td key={i}>
                                                                    {Array.isArray(value)
                                                                        ? value.join(', ')
                                                                        : (value === null || value === undefined
                                                                            ? ''
                                                                            : String(value))}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {updateSummary && (
                                    <div className="update-summary">
                                        <h3>Import Summary</h3>
                                        <div className="summary-counts">
                                            <div>Products Updated: <strong>{updateSummary.updatedProducts}</strong></div>
                                            {updateSummary.skippedProducts > 0 && (
                                                <div>Products Skipped: <strong>{updateSummary.skippedProducts}</strong></div>
                                            )}
                                            {updateSummary.errors > 0 && (
                                                <div>Errors: <strong>{updateSummary.errors}</strong></div>
                                            )}
                                        </div>

                                        <div className="fields-updated">
                                            <h4>Fields Updated</h4>
                                            <ul>
                                                {Object.entries(updateSummary.fieldsUpdated).map(([field, count]) => (
                                                    <li key={field}>
                                                        <strong>{field}:</strong> updated in {count} product(s)
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {updateSummary.errorDetails && updateSummary.errorDetails.length > 0 && (
                                            <div className="error-details">
                                                <h4>Error Details</h4>
                                                <ul>
                                                    {updateSummary.errorDetails.map((error, index) => (
                                                        <li key={index}>
                                                            <strong>Product ID {error.productId}:</strong> {error.error}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        <div className="import-instructions">
                            <h3>Instructions</h3>
                            <ol>
                                <li>Start by exporting products using the "Products CSV Export" page</li>
                                <li>Edit the CSV file using a spreadsheet program (Excel, Google Sheets, etc.)</li>
                                <li>Save your changes as a CSV file</li>
                                <li>Upload the modified CSV file using the form above</li>
                                <li>Review the file preview to ensure the data looks correct</li>
                                <li>Click "Import CSV" to update the products in the database</li>
                            </ol>
                            <p className="important-note">
                                <strong>Important:</strong>
                                <ul>
                                    <li>The CSV file must include the "id" column to identify products</li>
                                    <li>Only existing products can be updated (new products cannot be created)</li>
                                    <li>Categories should be separated by semicolons (;) if multiple values</li>
                                    <li>Numeric fields like price and manufacturingCost should be numbers without currency symbols</li>
                                </ul>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="navigation-links">
                    <a href="/admin/products-csv-export" className="nav-link">Go to Export Products</a>
                    <a href="/admin" className="nav-link">Back to Admin Dashboard</a>
                </div>
            </div>
        </AuthGuard>
    );
};

export default ProductsCsvImportPage;