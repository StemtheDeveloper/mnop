import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import '../../styles/AdminTools.css';

const DataFixerTool = () => {
    const [dataType, setDataType] = useState('products');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editedItem, setEditedItem] = useState(null);
    const [filter, setFilter] = useState('');
    const [queryField, setQueryField] = useState('');
    const [queryValue, setQueryValue] = useState('');
    const [queryLimit, setQueryLimit] = useState(100);

    // Define collection mapping
    const collectionMapping = {
        products: 'products',
        users: 'users',
        orders: 'orders',
        categories: 'categories',
    };

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

    // Fetch data from Firestore
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setData([]);
        setSelectedItem(null);
        setEditedItem(null);

        try {
            const collectionName = collectionMapping[dataType];
            let dataQuery;

            if (queryField && queryValue) {
                dataQuery = query(
                    collection(db, collectionName),
                    where(queryField, '==', queryValue),
                );
            } else {
                dataQuery = collection(db, collectionName);
            }

            const snapshot = await getDocs(dataQuery);

            if (snapshot.empty) {
                setError(`No ${dataType} found with the specified criteria`);
                setLoading(false);
                return;
            }

            // Get all documents and limit to queryLimit
            const fetchedData = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .slice(0, queryLimit);

            setData(fetchedData);
            setSuccess(`Successfully loaded ${fetchedData.length} ${dataType}`);
        } catch (err) {
            console.error(`Error fetching ${dataType}:`, err);
            setError(`Failed to load ${dataType}: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Update document in Firestore
    const updateDocument = async () => {
        if (!editedItem || !selectedItem) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const collectionName = collectionMapping[dataType];
            const docRef = doc(db, collectionName, editedItem.id);

            // Create a copy without the id field (since it's just for reference)
            const { id, ...updateData } = editedItem;

            // For specific data types, perform additional validation/transformation
            if (dataType === 'products') {
                // Ensure categories is always an array
                if (updateData.categories && !Array.isArray(updateData.categories)) {
                    if (typeof updateData.categories === 'string') {
                        updateData.categories = [updateData.categories];
                    } else {
                        updateData.categories = [];
                    }
                }

                // If there's a category field but no categories array, convert it
                if (updateData.category && (!updateData.categories || updateData.categories.length === 0)) {
                    updateData.categories = [updateData.category];
                }
            }

            await updateDoc(docRef, updateData);

            // Update the local data array with the edited item
            const updatedData = data.map(item =>
                item.id === editedItem.id ? editedItem : item
            );
            setData(updatedData);
            setSelectedItem(editedItem);

            setSuccess(`Successfully updated ${dataType} document: ${editedItem.id}`);
        } catch (err) {
            console.error(`Error updating ${dataType}:`, err);
            setError(`Failed to update ${dataType}: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle selecting an item to edit
    const handleSelectItem = (item) => {
        setSelectedItem(item);
        setEditedItem(JSON.parse(JSON.stringify(item))); // Deep copy
    };

    // Handle field value changes in the editor
    const handleFieldChange = (field, value) => {
        if (!editedItem) return;

        // Handle nested fields with dot notation (e.g. "user.name")
        if (field.includes('.')) {
            const parts = field.split('.');
            const newEditedItem = { ...editedItem };
            let current = newEditedItem;

            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) current[parts[i]] = {};
                current = current[parts[i]];
            }

            current[parts[parts.length - 1]] = value;
            setEditedItem(newEditedItem);
        } else {
            setEditedItem({ ...editedItem, [field]: value });
        }
    };

    // Handle array field editing
    const handleArrayFieldChange = (field, index, value) => {
        if (!editedItem || !Array.isArray(editedItem[field])) return;

        const newArray = [...editedItem[field]];
        newArray[index] = value;

        setEditedItem({ ...editedItem, [field]: newArray });
    };

    // Add item to array field
    const handleAddArrayItem = (field, value = '') => {
        if (!editedItem) return;

        const currentArray = Array.isArray(editedItem[field]) ? editedItem[field] : [];
        const newArray = [...currentArray, value];

        setEditedItem({ ...editedItem, [field]: newArray });
    };

    // Remove item from array field
    const handleRemoveArrayItem = (field, index) => {
        if (!editedItem || !Array.isArray(editedItem[field])) return;

        const newArray = [...editedItem[field]];
        newArray.splice(index, 1);

        setEditedItem({ ...editedItem, [field]: newArray });
    };

    // Render editor for the selected item
    const renderEditor = () => {
        if (!editedItem) return null;

        // Helper function to render different types of fields
        const renderField = (key, value, path = '') => {
            const currentPath = path ? `${path}.${key}` : key;

            if (value === null) {
                return (
                    <div className="editor-field" key={currentPath}>
                        <label>{key}</label>
                        <div className="field-value">
                            <input
                                type="text"
                                value="null"
                                disabled
                            />
                        </div>
                    </div>
                );
            }

            // Handle arrays specially - especially for categories
            if (Array.isArray(value)) {
                return (
                    <div className="editor-field array-field" key={currentPath}>
                        <label>{key}</label>
                        <div className="array-items">
                            {value.map((item, index) => (
                                <div className="array-item" key={`${currentPath}-${index}`}>
                                    <input
                                        type="text"
                                        value={item}
                                        onChange={(e) => handleArrayFieldChange(key, index, e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="remove-item-btn"
                                        onClick={() => handleRemoveArrayItem(key, index)}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className="add-item-btn"
                                onClick={() => handleAddArrayItem(key)}
                            >
                                + Add Item
                            </button>
                        </div>
                    </div>
                );
            }

            // Handle objects (nested fields)
            if (typeof value === 'object') {
                return (
                    <div className="editor-nested-object" key={currentPath}>
                        <div className="nested-object-label">{key}</div>
                        <div className="nested-object-fields">
                            {Object.entries(value).map(([nestedKey, nestedValue]) =>
                                renderField(nestedKey, nestedValue, currentPath)
                            )}
                        </div>
                    </div>
                );
            }

            // Handle boolean values
            if (typeof value === 'boolean') {
                return (
                    <div className="editor-field" key={currentPath}>
                        <label>{key}</label>
                        <div className="field-value">
                            <select
                                value={value.toString()}
                                onChange={(e) => handleFieldChange(currentPath, e.target.value === 'true')}
                            >
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </div>
                    </div>
                );
            }

            // Handle number values
            if (typeof value === 'number') {
                return (
                    <div className="editor-field" key={currentPath}>
                        <label>{key}</label>
                        <div className="field-value">
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => handleFieldChange(currentPath, Number(e.target.value))}
                            />
                        </div>
                    </div>
                );
            }

            // Handle string values and anything else as text
            return (
                <div className="editor-field" key={currentPath}>
                    <label>{key}</label>
                    <div className="field-value">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleFieldChange(currentPath, e.target.value)}
                        />
                    </div>
                </div>
            );
        };

        return (
            <div className="item-editor">
                <h3>Editing {dataType} Document</h3>
                <div className="item-id">ID: {editedItem.id}</div>

                <div className="editor-fields">
                    {Object.entries(editedItem)
                        .filter(([key]) => key !== 'id') // Don't show ID field in the editable fields
                        .map(([key, value]) => renderField(key, value))}
                </div>

                <div className="editor-actions">
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => {
                            setEditedItem(null);
                            setSelectedItem(null);
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="save-btn"
                        onClick={updateDocument}
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        );
    };

    // Filter data items based on search term
    const filteredData = filter
        ? data.filter(item =>
            JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
        )
        : data;

    return (
        <div className="admin-data-fixer">
            <h2>Data Fixer Tool</h2>
            <p className="tool-description">
                Use this tool to load, view, and fix data errors in the database.
                This is especially useful for fixing category issues with products.
            </p>

            <div className="data-fixer-controls">
                <div className="control-section">
                    <label>
                        Data Type:
                        <select
                            value={dataType}
                            onChange={(e) => setDataType(e.target.value)}
                            disabled={loading}
                        >
                            <option value="products">Products</option>
                            <option value="users">Users</option>
                            <option value="orders">Orders</option>
                            <option value="categories">Categories</option>
                        </select>
                    </label>

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

                <button
                    className="load-data-btn"
                    onClick={fetchData}
                    disabled={loading}
                >
                    {loading ? 'Loading...' : 'Load Data'}
                </button>
            </div>

            {(success || error) && (
                <div className={`message ${error ? 'error' : 'success'}`}>
                    {error || success}
                </div>
            )}

            {data.length > 0 && (
                <div className="data-search">
                    <input
                        type="text"
                        placeholder="Filter results..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    <span className="results-count">
                        {filteredData.length} of {data.length} items
                    </span>
                </div>
            )}

            <div className="data-explorer">
                <div className="data-list">
                    {filteredData.length > 0 ? (
                        <div className="data-items-container">
                            {filteredData.map(item => (
                                <div
                                    key={item.id}
                                    className={`data-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                                    onClick={() => handleSelectItem(item)}
                                >
                                    <div className="item-name">
                                        {item.name || item.title || item.id}
                                    </div>
                                    <div className="item-preview">
                                        {dataType === 'products' && (
                                            <>
                                                <div>Category: {item.category || 'N/A'}</div>
                                                <div>Categories: {Array.isArray(item.categories) ? item.categories.join(', ') : 'N/A'}</div>
                                            </>
                                        )}
                                        <div>ID: {item.id}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : data.length > 0 ? (
                        <div className="no-results">No matching items found.</div>
                    ) : !loading && (
                        <div className="no-data">No data loaded. Click "Load Data" to begin.</div>
                    )}
                </div>

                <div className="data-preview">
                    {selectedItem && !editedItem ? (
                        <div className="item-details">
                            <h3>{dataType} Details</h3>
                            <div className="item-id">ID: {selectedItem.id}</div>
                            <pre>{JSON.stringify(selectedItem, null, 2)}</pre>
                            <button
                                className="edit-btn"
                                onClick={() => setEditedItem(JSON.parse(JSON.stringify(selectedItem)))}
                            >
                                Edit This Item
                            </button>
                        </div>
                    ) : editedItem ? (
                        renderEditor()
                    ) : (
                        <div className="no-selection">
                            Select an item from the list to view details.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataFixerTool;