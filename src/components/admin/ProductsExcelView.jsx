import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../LoadingSpinner';
import '../../styles/AdminTools.css';
import '../../styles/ProductsExcelView.css';

const ProductsExcelView = () => {
    const [products, setProducts] = useState([]);
    const [originalProducts, setOriginalProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [filter, setFilter] = useState('');
    const [queryField, setQueryField] = useState('');
    const [queryValue, setQueryValue] = useState('');
    const [queryLimit, setQueryLimit] = useState(100);

    // Track all possible fields across all products
    const [allFields, setAllFields] = useState([]);
    // Track edited cells to highlight them
    const [editedCells, setEditedCells] = useState({});
    // Track expanded image rows
    const [expandedRows, setExpandedRows] = useState({});

    // Add fullscreen state
    const [isFullScreen, setIsFullScreen] = useState(false);

    // Toggle fullscreen mode
    const toggleFullScreen = () => {
        setIsFullScreen(!isFullScreen);
    };

    // Exit fullscreen when ESC key is pressed
    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape' && isFullScreen) {
                setIsFullScreen(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isFullScreen]);

    // Clear messages after a delay
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    // Load products from Firestore
    const loadProducts = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            let productsQuery;

            if (queryField && queryValue) {
                productsQuery = query(
                    collection(db, 'products'),
                    where(queryField, '==', queryValue),
                );
            } else {
                productsQuery = collection(db, 'products');
            }

            const snapshot = await getDocs(productsQuery);

            if (snapshot.empty) {
                setError('No products found with the specified criteria');
                setLoading(false);
                return;
            }

            // Get all products and limit to queryLimit
            const fetchedProducts = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _modified: false // Add a flag to track modified items
                }))
                .slice(0, queryLimit);

            // Extract all unique field names from all products
            const fieldSet = new Set(['id']);
            fetchedProducts.forEach(product => {
                Object.keys(product).forEach(key => {
                    if (key !== '_modified') {
                        fieldSet.add(key);
                    }
                });
            });

            // Convert to array and sort
            // Place important fields first
            const priorityFields = ['id', 'name', 'price', 'category', 'categories', 'manufacturingCost', 'status', 'description', 'imageUrls'];
            const otherFields = [...fieldSet].filter(field => !priorityFields.includes(field));
            const sortedFields = [...priorityFields.filter(field => fieldSet.has(field)), ...otherFields.sort()];

            setAllFields(sortedFields);
            setProducts(fetchedProducts);
            setOriginalProducts(JSON.parse(JSON.stringify(fetchedProducts)));
            setSuccess(`Successfully loaded ${fetchedProducts.length} products`);
        } catch (err) {
            console.error('Error fetching products:', err);
            setError(`Failed to load products: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle field value changes
    const handleCellChange = (productId, field, value) => {
        setProducts(prevProducts => {
            return prevProducts.map(product => {
                if (product.id === productId) {
                    // If field is a number type, convert the value
                    const newValue = (field === 'price' || field === 'manufacturingCost' || field === 'fundingGoal' || field === 'currentFunding')
                        ? (value === '' ? '' : Number(value))
                        : value;

                    // Track this cell as edited
                    setEditedCells(prev => ({
                        ...prev,
                        [`${productId}-${field}`]: true
                    }));

                    return {
                        ...product,
                        [field]: newValue,
                        _modified: true
                    };
                }
                return product;
            });
        });
    };

    // Handle array field changes (like categories)
    const handleArrayChange = (productId, field, value) => {
        // Split by comma and trim each value
        const arrayValues = value.split(',').map(v => v.trim()).filter(v => v);

        setProducts(prevProducts => {
            return prevProducts.map(product => {
                if (product.id === productId) {
                    // Track this cell as edited
                    setEditedCells(prev => ({
                        ...prev,
                        [`${productId}-${field}`]: true
                    }));

                    return {
                        ...product,
                        [field]: arrayValues,
                        _modified: true
                    };
                }
                return product;
            });
        });
    };

    // Handle boolean field changes
    const handleBooleanChange = (productId, field, value) => {
        setProducts(prevProducts => {
            return prevProducts.map(product => {
                if (product.id === productId) {
                    // Track this cell as edited
                    setEditedCells(prev => ({
                        ...prev,
                        [`${productId}-${field}`]: true
                    }));

                    return {
                        ...product,
                        [field]: value === 'true',
                        _modified: true
                    };
                }
                return product;
            });
        });
    };

    // Toggle row expansion to show images
    const toggleRowExpansion = (productId) => {
        setExpandedRows(prev => ({
            ...prev,
            [productId]: !prev[productId]
        }));
    };

    // Save all changes to Firestore
    const saveChanges = async () => {
        const modifiedProducts = products.filter(p => p._modified);

        if (modifiedProducts.length === 0) {
            setError('No changes to save');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const batch = writeBatch(db);

            modifiedProducts.forEach(product => {
                const { id, _modified, ...updateData } = product;
                const productRef = doc(db, 'products', id);

                // Ensure categories is always an array
                if (updateData.categories && !Array.isArray(updateData.categories)) {
                    if (typeof updateData.categories === 'string') {
                        updateData.categories = [updateData.categories];
                    } else {
                        updateData.categories = [];
                    }
                }

                // Ensure category field is consistent with categories array
                if (updateData.category && (!updateData.categories || updateData.categories.length === 0)) {
                    updateData.categories = [updateData.category];
                } else if (Array.isArray(updateData.categories) && updateData.categories.length > 0 && !updateData.category) {
                    updateData.category = updateData.categories[0];
                }

                batch.update(productRef, updateData);
            });

            await batch.commit();

            // Reset edited cells and modified flags
            setEditedCells({});
            setProducts(prevProducts =>
                prevProducts.map(p => ({ ...p, _modified: false }))
            );
            setOriginalProducts(JSON.parse(JSON.stringify(products.map(p => ({ ...p, _modified: false })))));

            setSuccess(`Successfully saved changes to ${modifiedProducts.length} products`);
        } catch (err) {
            console.error('Error saving products:', err);
            setError(`Failed to save changes: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Discard all changes
    const discardChanges = () => {
        setProducts(JSON.parse(JSON.stringify(originalProducts)));
        setEditedCells({});
        setSuccess('All changes discarded');
    };

    // Filter products based on search term
    const filteredProducts = filter
        ? products.filter(product =>
            Object.entries(product).some(([key, value]) => {
                if (key === '_modified') return false;
                const stringValue = typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value);
                return stringValue.toLowerCase().includes(filter.toLowerCase());
            })
        )
        : products;

    // Render a table cell based on field type
    const renderCell = (product, field) => {
        // Don't show the _modified flag
        if (field === '_modified') {
            return null;
        }

        // Handle ID field as read-only
        if (field === 'id') {
            return (
                <td key={`${product.id}-${field}`} className="id-cell">
                    {product.id}
                </td>
            );
        }

        // Handle missing fields
        if (product[field] === undefined) {
            return (
                <td
                    key={`${product.id}-${field}`}
                    className="empty-cell"
                    onClick={() => handleCellChange(product.id, field, '')}
                >
                    <span className="add-field">+ Add</span>
                </td>
            );
        }

        // Handle array fields (like categories, imageUrls)
        if (Array.isArray(product[field])) {
            // Special handling for imageUrls
            if (field === 'imageUrls') {
                const imageCount = product[field].length;
                return (
                    <td
                        key={`${product.id}-${field}`}
                        className={`image-cell ${editedCells[`${product.id}-${field}`] ? 'edited-cell' : ''}`}
                    >
                        {imageCount > 0 ? (
                            <button
                                className="image-toggle-btn"
                                onClick={() => toggleRowExpansion(product.id)}
                            >
                                {imageCount} image{imageCount !== 1 ? 's' : ''} {expandedRows[product.id] ? '▼' : '►'}
                            </button>
                        ) : (
                            'No images'
                        )}
                    </td>
                );
            }

            // Regular array field
            return (
                <td
                    key={`${product.id}-${field}`}
                    className={`array-cell ${editedCells[`${product.id}-${field}`] ? 'edited-cell' : ''}`}
                >
                    <input
                        type="text"
                        value={product[field].join(', ')}
                        onChange={(e) => handleArrayChange(product.id, field, e.target.value)}
                        placeholder="comma-separated values"
                    />
                </td>
            );
        }

        // Handle boolean fields
        if (typeof product[field] === 'boolean') {
            return (
                <td
                    key={`${product.id}-${field}`}
                    className={`boolean-cell ${editedCells[`${product.id}-${field}`] ? 'edited-cell' : ''}`}
                >
                    <select
                        value={product[field].toString()}
                        onChange={(e) => handleBooleanChange(product.id, field, e.target.value)}
                    >
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                </td>
            );
        }

        // Handle number fields
        if (typeof product[field] === 'number') {
            return (
                <td
                    key={`${product.id}-${field}`}
                    className={`number-cell ${editedCells[`${product.id}-${field}`] ? 'edited-cell' : ''}`}
                >
                    <input
                        type="number"
                        value={product[field]}
                        onChange={(e) => handleCellChange(product.id, field, e.target.value)}
                        step={field === 'price' || field === 'manufacturingCost' ? '0.01' : '1'}
                    />
                </td>
            );
        }

        // Handle timestamp objects
        if (product[field] && typeof product[field] === 'object' && product[field].seconds) {
            const date = new Date(product[field].seconds * 1000);
            return (
                <td
                    key={`${product.id}-${field}`}
                    className="timestamp-cell"
                >
                    {date.toLocaleString()}
                </td>
            );
        }

        // Handle objects (nested data)
        if (product[field] && typeof product[field] === 'object') {
            return (
                <td
                    key={`${product.id}-${field}`}
                    className="object-cell"
                >
                    {JSON.stringify(product[field])}
                </td>
            );
        }

        // Default: text input for string fields
        return (
            <td
                key={`${product.id}-${field}`}
                className={`text-cell ${editedCells[`${product.id}-${field}`] ? 'edited-cell' : ''}`}
            >
                <input
                    type="text"
                    value={product[field] || ''}
                    onChange={(e) => handleCellChange(product.id, field, e.target.value)}
                />
            </td>
        );
    };

    // Render expanded image row if product is expanded
    const renderImageRow = (product) => {
        if (!expandedRows[product.id] || !product.imageUrls || product.imageUrls.length === 0) {
            return null;
        }

        return (
            <tr className="expanded-image-row">
                <td colSpan={allFields.length}>
                    <div className="image-gallery">
                        {product.imageUrls.map((url, index) => (
                            <div className="product-image-container" key={`${product.id}-img-${index}`}>
                                <img src={url} alt={`${product.name || 'Product'} ${index + 1}`} className="admin-product-image" />
                                <div className="image-index">Image {index + 1}</div>
                            </div>
                        ))}
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className={`products-excel-view ${isFullScreen ? 'fullscreen' : ''}`}>
            <h2>Products Excel View</h2>
            <p className="tool-description">
                Edit multiple products at once in a spreadsheet-like interface. All fields are shown, including missing fields.
                Changes are highlighted and can be saved in batch.
            </p>

            <div className="excel-view-controls">
                <div className="control-section">
                    <label>
                        Limit Results:
                        <input
                            type="number"
                            min="1"
                            max="500"
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
                        onClick={loadProducts}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Load Products'}
                    </button>

                    {products.length > 0 && (
                        <>
                            <button
                                className="save-changes-btn"
                                onClick={saveChanges}
                                disabled={saving || products.filter(p => p._modified).length === 0}
                            >
                                {saving ? 'Saving...' : `Save Changes (${products.filter(p => p._modified).length})`}
                            </button>

                            <button
                                className="discard-changes-btn"
                                onClick={discardChanges}
                                disabled={products.filter(p => p._modified).length === 0}
                            >
                                Discard Changes
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="fullscreen-toggle">
                <button onClick={toggleFullScreen}>
                    {isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                </button>
            </div>

            {(success || error) && (
                <div className={`message ${error ? 'error' : 'success'}`}>
                    {error || success}
                </div>
            )}

            {products.length > 0 && (
                <div className="excel-view-filter">
                    <input
                        type="text"
                        placeholder="Filter products..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    <span className="results-count">
                        {filteredProducts.length} of {products.length} products
                    </span>
                </div>
            )}

            {loading ? (
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading products...</p>
                </div>
            ) : products.length > 0 ? (
                <div className="excel-table-container">
                    <table className="excel-table">
                        <thead>
                            <tr>
                                {allFields.map(field => (
                                    field !== '_modified' && (
                                        <th key={field}>
                                            {field}
                                        </th>
                                    )
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(product => (
                                <React.Fragment key={product.id}>
                                    <tr className={product._modified ? 'modified-row' : ''}>
                                        {allFields.map(field => renderCell(product, field))}
                                    </tr>
                                    {renderImageRow(product)}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="no-data">
                    No products loaded. Click "Load Products" to begin.
                </div>
            )}
        </div>
    );
};

export default ProductsExcelView;