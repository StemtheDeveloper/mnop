import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import ProductsExcelView from './ProductsExcelView';
import usePerformanceMonitoring from '../../hooks/usePerformanceMonitoring';
import '../../styles/AdminTools.css';

// Split into smaller components
const SchemaManager = ({
    dataType,
    schemas,
    setSchemas,
    selectedItem,
    activeSchema,
    setActiveSchema,
    setShowSchemaManager,
    loading,
    setLoading,
    setError,
    setSuccess
}) => {
    const [editingSchema, setEditingSchema] = useState(null);
    const [schemaName, setSchemaName] = useState('');
    const [schemaJSON, setSchemaJSON] = useState('');

    // Create a schema from an existing document
    const createSchemaFromDocument = useCallback((item) => {
        if (!item) return;

        const newSchema = {};
        Object.entries(item).forEach(([key, value]) => {
            if (key === 'id') return; // Skip ID

            if (Array.isArray(value)) {
                newSchema[key] = 'array';
            } else if (value === null) {
                newSchema[key] = 'null';
            } else {
                newSchema[key] = typeof value;
            }
        });

        setEditingSchema({
            name: `${dataType} Schema`,
            schema: newSchema
        });
        setSchemaName(`${dataType} Schema`);
        setSchemaJSON(JSON.stringify(newSchema, null, 2));
    }, [dataType]);

    // Save schema
    const saveSchema = async () => {
        try {
            setLoading(true);
            const schemaObj = JSON.parse(schemaJSON);

            // Update local state first for immediate feedback
            const updatedSchemas = {
                ...schemas,
                [dataType]: {
                    name: schemaName,
                    schema: schemaObj
                }
            };

            setSchemas(updatedSchemas);
            setActiveSchema(dataType);

            // Save to Firestore for persistence
            const schemasRef = doc(db, 'settings', 'dataSchemas');
            await setDoc(schemasRef, updatedSchemas, { merge: true });

            setEditingSchema(null);
            setSchemaName('');
            setSchemaJSON('');
            setSuccess(`Schema for ${dataType} saved successfully`);
        } catch (err) {
            setError(`Failed to save schema: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="schema-manager-modal">
            <div className="schema-manager-content">
                <h3>Schema Manager</h3>

                {editingSchema ? (
                    <div className="schema-editor">
                        <div className="form-group">
                            <label>Schema Name:</label>
                            <input
                                type="text"
                                value={schemaName}
                                onChange={(e) => setSchemaName(e.target.value)}
                                placeholder="e.g. Product Schema"
                            />
                        </div>
                        <div className="form-group">
                            <label>Schema Definition (JSON):</label>
                            <textarea
                                rows="10"
                                value={schemaJSON}
                                onChange={(e) => setSchemaJSON(e.target.value)}
                                placeholder={'{\n  "field": "type"\n}'}
                            />
                            <div className="helper-text">
                                Define field types as: "string", "number", "boolean", "array", or "object"
                            </div>
                        </div>
                        <div className="schema-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => {
                                    setEditingSchema(null);
                                    setSchemaName('');
                                    setSchemaJSON('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="save-btn"
                                onClick={saveSchema}
                            >
                                Save Schema
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="schema-actions-top">
                            <button
                                className="create-schema-btn"
                                onClick={() => {
                                    setEditingSchema({ name: '', schema: {} });
                                    setSchemaName(`${dataType} Schema`);
                                    setSchemaJSON('{\n  \n}');
                                }}
                            >
                                Create New Schema
                            </button>
                            {selectedItem && (
                                <button
                                    className="sample-schema-btn"
                                    onClick={() => createSchemaFromDocument(selectedItem)}
                                >
                                    Create From Selected Document
                                </button>
                            )}
                        </div>

                        <h4>Available Schemas</h4>
                        {Object.keys(schemas).length === 0 ? (
                            <div className="no-schemas">No schemas defined yet</div>
                        ) : (
                            <div className="schema-list">
                                {Object.entries(schemas).map(([key, { name, schema }]) => (
                                    <div
                                        key={key}
                                        className={`schema-item ${activeSchema === key ? 'active' : ''}`}
                                        onClick={() => setActiveSchema(key)}
                                    >
                                        <div className="schema-item-header">
                                            <span className="schema-item-name">{name}</span>
                                            <div className="schema-item-actions">
                                                <button
                                                    className="edit-schema-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingSchema({ name, schema });
                                                        setSchemaName(name);
                                                        setSchemaJSON(JSON.stringify(schema, null, 2));
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="delete-schema-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Delete schema "${name}"?`)) {
                                                            setSchemas(prev => {
                                                                const newSchemas = { ...prev };
                                                                delete newSchemas[key];
                                                                return newSchemas;
                                                            });
                                                            if (activeSchema === key) {
                                                                setActiveSchema(null);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        {activeSchema === key && (
                                            <pre className="schema-details">
                                                {JSON.stringify(schema, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <button
                    className="close-schema-btn"
                    onClick={() => setShowSchemaManager(false)}
                >
                    Close Schema Manager
                </button>
            </div>
        </div>
    );
};

// Item Editor Component
const ItemEditor = ({ editedItem, setEditedItem, setSelectedItem, updateDocument, loading, dataType }) => {
    // Handler for field changes
    const handleFieldChange = useCallback((field, value) => {
        if (!editedItem) return;

        // Handle nested fields with dot notation (e.g. "user.name")
        if (field.includes('.')) {
            const parts = field.split('.');
            setEditedItem(prev => {
                const newItem = { ...prev };
                let current = newItem;

                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }

                current[parts[parts.length - 1]] = value;
                return newItem;
            });
        } else {
            setEditedItem(prev => ({ ...prev, [field]: value }));
        }
    }, [editedItem, setEditedItem]);

    // Handle array field editing
    const handleArrayFieldChange = useCallback((field, index, value) => {
        if (!editedItem || !Array.isArray(editedItem[field])) return;

        setEditedItem(prev => {
            const newItem = { ...prev };
            const newArray = [...newItem[field]];
            newArray[index] = value;
            newItem[field] = newArray;
            return newItem;
        });
    }, [editedItem, setEditedItem]);

    // Add item to array field
    const handleAddArrayItem = useCallback((field, value = '') => {
        if (!editedItem) return;

        setEditedItem(prev => {
            const newItem = { ...prev };
            const currentArray = Array.isArray(newItem[field]) ? newItem[field] : [];
            newItem[field] = [...currentArray, value];
            return newItem;
        });
    }, [editedItem, setEditedItem]);

    // Remove item from array field
    const handleRemoveArrayItem = useCallback((field, index) => {
        if (!editedItem || !Array.isArray(editedItem[field])) return;

        setEditedItem(prev => {
            const newItem = { ...prev };
            const newArray = [...newItem[field]];
            newArray.splice(index, 1);
            newItem[field] = newArray;
            return newItem;
        });
    }, [editedItem, setEditedItem]);

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

// Validation Results Component
const ValidationResults = ({
    schemaValidation,
    setValidationComplete,
    setSchemaValidation,
    applySchemaFixes,
    applyMultiCollectionFixes,
    loading,
    multiCollectionMode
}) => {
    const itemsWithIssues = useMemo(() => {
        return schemaValidation.filter(item => item.issues.length > 0);
    }, [schemaValidation]);

    if (schemaValidation.length === 0) return null;

    return (
        <div className="validation-results">
            <h3>Schema Validation Results</h3>

            {itemsWithIssues.length === 0 ? (
                <div className="validation-success">
                    All selected items comply with the schema
                </div>
            ) : (
                <>
                    <div className="validation-summary">
                        Found issues in {itemsWithIssues.length} of {schemaValidation.length} items
                    </div>

                    <div className="validation-items">
                        {itemsWithIssues.map(item => (
                            <div key={item.id} className="validation-item">
                                <div className="validation-item-header">
                                    <span className="validation-item-name">{item.name}</span>
                                    {item.collectionType && (
                                        <span className="validation-item-collection">{item.collectionType}</span>
                                    )}
                                    <span className="validation-item-id">ID: {item.id}</span>
                                </div>
                                <div className="validation-issues">
                                    {item.issues.map((issue, index) => (
                                        <div key={index} className="validation-issue">
                                            <strong>{issue.field}:</strong> {issue.issue || `Type mismatch - Expected ${issue.expectedType}, got ${issue.currentType}`}
                                            <div className="issue-fix">Fix: {issue.fix}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="apply-fixes-btn"
                        onClick={multiCollectionMode ? applyMultiCollectionFixes : applySchemaFixes}
                        disabled={loading}
                    >
                        {loading ? 'Applying Fixes...' : `Apply Fixes to ${itemsWithIssues.length} Items`}
                    </button>
                </>
            )}

            <button
                className="close-validation-btn"
                onClick={() => {
                    setValidationComplete(false);
                    setSchemaValidation([]);
                }}
            >
                Close Validation Results
            </button>
        </div>
    );
};

const DataFixerTool = () => {
    // Initialize performance monitoring
    const performance = usePerformanceMonitoring('DataFixerTool', {
        customMetrics: {
            component_type: 'admin_tool'
        }
    });

    const [dataType, setDataType] = useState('products');
    const [viewMode, setViewMode] = useState('standard'); // 'standard' or 'excel' view
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

    // Schema management
    const [showSchemaManager, setShowSchemaManager] = useState(false);
    const [activeSchema, setActiveSchema] = useState(null);

    const [schemas, setSchemas] = useState({
        products: {
            name: 'Product Schema',
            schema: {
                name: 'string',
                description: 'string',
                price: 'number',
                categories: 'array',
                status: 'string',
                imageUrls: 'array',
                category: 'string',
                categoryType: 'string',
                createdAt: 'timestamp',
                currentFunding: 'number',
                designerId: 'string',
                designerName: 'string',
                fundingGoal: 'number',
                lastEditedAt: 'timestamp',
                storagePaths: 'array',
                updatedAt: 'timestamp',
                wasEdited: 'boolean',
            }
        }
    });

    // Batch operations
    const [batchMode, setBatchMode] = useState(false);
    const [multiCollectionBatchMode, setMultiCollectionBatchMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [multiCollectionItems, setMultiCollectionItems] = useState({});
    const [schemaValidation, setSchemaValidation] = useState([]);
    const [validationComplete, setValidationComplete] = useState(false);
    const [selectedCollections, setSelectedCollections] = useState([]);

    // Define collection mapping
    const collectionMapping = useMemo(() => ({
        products: 'products',
        users: 'users',
        orders: 'orders',
        categories: 'categories',
    }), []);

    // Clear messages after a delay
    useEffect(() => {
        let timer;
        if (success || error) {
            timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 5000);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [success, error]);

    // Reset batch state when data type changes
    useEffect(() => {
        setBatchMode(false);
        setSelectedItems([]);
        setSchemaValidation([]);
        setValidationComplete(false);
    }, [dataType]);

    // Load schemas from Firestore on mount
    useEffect(() => {
        const loadSchemas = async () => {
            try {
                const schemasRef = doc(db, 'settings', 'dataSchemas');
                const schemasDoc = await getDoc(schemasRef);

                if (schemasDoc.exists()) {
                    const loadedSchemas = schemasDoc.data();
                    // Only update if there are schemas saved
                    if (Object.keys(loadedSchemas).length > 0) {
                        setSchemas(loadedSchemas);
                    }
                }
            } catch (err) {
                console.error('Error loading schemas:', err);
                // Don't show error on load, just keep default schemas
            }
        };

        loadSchemas();
    }, []);

    // Fetch data from Firestore
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setData([]);
        setSelectedItem(null);
        setEditedItem(null);
        setSelectedItems([]);
        setSchemaValidation([]);
        setValidationComplete(false);

        try {
            // Use performance monitoring to track data fetch time
            return await performance.measureUserAction('fetch_data', async () => {
                const collectionName = collectionMapping[dataType];
                let dataQuery;

                performance.recordMetric('collection_type', 1);
                performance.setAttribute('collection_name', collectionName);

                if (queryField && queryValue) {
                    dataQuery = query(
                        collection(db, collectionName),
                        where(queryField, '==', queryValue),
                    );
                    performance.setAttribute('query_filter', `${queryField}=${queryValue}`);
                } else {
                    dataQuery = collection(db, collectionName);
                }

                const startTime = performance.now();
                const snapshot = await getDocs(dataQuery);
                const queryTime = performance.now() - startTime;
                performance.recordMetric('query_execution_ms', queryTime);

                if (snapshot.empty) {
                    setError(`No ${dataType} found with the specified criteria`);
                    performance.setAttribute('query_result', 'empty');
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

                performance.recordMetric('items_fetched', fetchedData.length);

                setData(fetchedData);
                setSuccess(`Successfully loaded ${fetchedData.length} ${dataType}`);
            });
        } catch (err) {
            console.error(`Error fetching ${dataType}:`, err);
            setError(`Failed to load ${dataType}: ${err.message}`);
            performance.setAttribute('error', err.message);
        } finally {
            setLoading(false);
        }
    }, [collectionMapping, dataType, queryField, queryValue, queryLimit, performance]);

    // Update document in Firestore
    const updateDocument = useCallback(async () => {
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
            setData(prevData => prevData.map(item =>
                item.id === editedItem.id ? editedItem : item
            ));
            setSelectedItem(editedItem);

            setSuccess(`Successfully updated ${dataType} document: ${editedItem.id}`);
        } catch (err) {
            console.error(`Error updating ${dataType}:`, err);
            setError(`Failed to update ${dataType}: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [editedItem, selectedItem, collectionMapping, dataType]);

    // Handle selecting an item to edit
    const handleSelectItem = useCallback((item) => {
        setSelectedItem(item);
        setEditedItem(JSON.parse(JSON.stringify(item))); // Deep copy
    }, []);

    // Toggle item selection for batch operations
    const toggleItemSelection = useCallback((itemId) => {
        setSelectedItems(prev => {
            if (prev.includes(itemId)) {
                return prev.filter(id => id !== itemId);
            } else {
                return [...prev, itemId];
            }
        });
    }, []);

    // Toggle selection for all items
    const toggleSelectAll = useCallback(() => {
        setSelectedItems(prev => {
            if (prev.length === data.length) {
                return [];
            } else {
                return data.map(item => item.id);
            }
        });
    }, [data]);

    // Validate selected items against schema
    const validateAgainstSchema = useCallback(() => {
        if (!schemas[dataType]) {
            setError(`No schema defined for ${dataType}`);
            return;
        }

        return performance.measureUserAction('validate_schema', () => {
            const schema = schemas[dataType].schema;
            const itemsToValidate = data.filter(item => selectedItems.includes(item.id));

            performance.recordMetric('items_to_validate', itemsToValidate.length);
            performance.setAttribute('validation_data_type', dataType);

            const startTime = performance.now();

            const validation = itemsToValidate.map(item => {
                const issues = [];
                let needsFix = false;

                // Special case for products.categories
                if (dataType === 'products') {
                    // Check if categories should be an array but isn't
                    if (schema.categories === 'array' && !Array.isArray(item.categories)) {
                        issues.push({
                            field: 'categories',
                            currentType: item.categories ? typeof item.categories : 'missing',
                            expectedType: 'array',
                            fix: 'Convert to array or create from category field'
                        });
                        needsFix = true;
                    }

                    // Check if there's a category field but no categories array
                    if (item.category && (!item.categories || item.categories.length === 0)) {
                        issues.push({
                            field: 'category',
                            issue: 'Single category field exists but no categories array',
                            fix: 'Create categories array from category field'
                        });
                        needsFix = true;
                    }
                }

                // Check all schema fields to ensure they exist in the data
                Object.entries(schema).forEach(([field, type]) => {
                    if (field === 'categories' && dataType === 'products') {
                        // Already handled in special case
                        return;
                    }

                    // Handle missing or null/undefined fields
                    if (item[field] === undefined || item[field] === null) {
                        issues.push({
                            field,
                            issue: item[field] === undefined ? 'Field is undefined' : 'Field is null',
                            expectedType: type,
                            fix: `Create ${field} as ${type === 'array' ? '[]' : type === 'object' ? '{}' : type === 'string' ? '""' : type === 'number' ? '0' : type === 'boolean' ? 'false' : 'default value'}`
                        });
                        needsFix = true;
                    }
                    // Handle type mismatches
                    else if (
                        (type === 'array' && !Array.isArray(item[field])) ||
                        (type !== 'array' && typeof item[field] !== type)
                    ) {
                        issues.push({
                            field,
                            currentType: Array.isArray(item[field]) ? 'array' : typeof item[field],
                            expectedType: type,
                            fix: `Convert to ${type}`
                        });
                        needsFix = true;
                    }
                });

                return {
                    id: item.id,
                    name: item.name || item.title || item.id,
                    issues,
                    needsFix
                };
            });

            const validationTime = performance.now() - startTime;
            performance.recordMetric('validation_time_ms', validationTime);

            // Count items with issues
            const itemsWithIssues = validation.filter(item => item.issues.length > 0).length;
            performance.recordMetric('items_with_issues', itemsWithIssues);
            performance.setAttribute('validation_success', itemsWithIssues === 0 ? 'true' : 'false');

            setSchemaValidation(validation);
            setValidationComplete(true);
        });
    }, [schemas, dataType, data, selectedItems, performance]);

    // Apply schema fixes to selected items
    const applySchemaFixes = useCallback(async () => {
        if (!validationComplete || schemaValidation.length === 0) {
            setError('Please validate items against schema first');
            return;
        }

        const itemsToFix = schemaValidation.filter(item => item.needsFix);

        if (itemsToFix.length === 0) {
            setSuccess('No issues to fix in selected items');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            return await performance.measureUserAction('apply_schema_fixes', async () => {
                performance.recordMetric('items_to_fix', itemsToFix.length);
                performance.setAttribute('collection_type', dataType);

                const collectionName = collectionMapping[dataType];
                const batch = writeBatch(db);
                let fixedCount = 0;

                // Start timing the batch preparation
                const batchPrepStart = performance.now();

                // Get all the items that need fixing
                for (const item of itemsToFix) {
                    const itemData = data.find(d => d.id === item.id);
                    if (!itemData) continue;

                    const docRef = doc(db, collectionName, item.id);
                    const updates = {};

                    // Process issues and apply fixes
                    if (dataType === 'products') {
                        // Handle category/categories inconsistency
                        if (!Array.isArray(itemData.categories)) {
                            if (itemData.category) {
                                // Create categories array from category field
                                updates.categories = [itemData.category];
                            } else {
                                // Create empty categories array
                                updates.categories = [];
                            }
                        }
                    }

                    // Apply other schema-based fixes here
                    const schema = schemas[dataType].schema;
                    Object.entries(schema).forEach(([field, type]) => {
                        if (field in updates) return; // Skip if already handled

                        if (itemData[field] === undefined || itemData[field] === null) {
                            // Create missing field with default value
                            if (type === 'array') updates[field] = [];
                            else if (type === 'object') updates[field] = {};
                            else if (type === 'string') updates[field] = '';
                            else if (type === 'number') updates[field] = 0;
                            else if (type === 'boolean') updates[field] = false;
                        } else if (
                            (type === 'array' && !Array.isArray(itemData[field])) ||
                            (type !== 'array' && typeof itemData[field] !== type)
                        ) {
                            // Convert field to correct type
                            if (type === 'array') {
                                updates[field] = typeof itemData[field] === 'string'
                                    ? [itemData[field]]
                                    : [];
                            } else if (type === 'string') {
                                updates[field] = String(itemData[field]);
                            } else if (type === 'number') {
                                updates[field] = Number(itemData[field]) || 0;
                            } else if (type === 'boolean') {
                                updates[field] = Boolean(itemData[field]);
                            } else if (type === 'object') {
                                updates[field] = {};
                            }
                        }
                    });

                    if (Object.keys(updates).length > 0) {
                        batch.update(docRef, updates);
                        fixedCount++;
                    }
                }

                const batchPrepTime = performance.now() - batchPrepStart;
                performance.recordMetric('batch_preparation_ms', batchPrepTime);
                performance.recordMetric('items_fixed', fixedCount);

                // Measure the time it takes to commit the batch
                const commitStart = performance.now();
                await batch.commit();
                const commitTime = performance.now() - commitStart;
                performance.recordMetric('batch_commit_ms', commitTime);

                // Reload data to reflect changes
                await fetchData();

                setSuccess(`Successfully fixed ${fixedCount} ${dataType} documents according to schema`);
                setValidationComplete(false);
                setSelectedItems([]);
                setSchemaValidation([]);
                setBatchMode(false);
            });
        } catch (err) {
            console.error(`Error fixing ${dataType}:`, err);
            setError(`Failed to apply fixes: ${err.message}`);
            performance.setAttribute('error', err.message);
        } finally {
            setLoading(false);
        }
    }, [validationComplete, schemaValidation, collectionMapping, dataType, data, schemas, fetchData, performance]);

    // Helper functions for multi-collection batch mode
    const fetchMultiCollectionData = useCallback(async () => {
        if (selectedCollections.length === 0) {
            setError('Please select at least one collection type');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        setMultiCollectionItems({});

        try {
            const collectionResults = {};

            // Fetch data from each selected collection
            for (const collType of selectedCollections) {
                const collectionName = collectionMapping[collType];
                const dataQuery = collection(db, collectionName);
                const snapshot = await getDocs(dataQuery);

                if (!snapshot.empty) {
                    const fetchedData = snapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            __collectionType: collType // Add metadata about which collection this item belongs to
                        }))
                        .slice(0, queryLimit);

                    collectionResults[collType] = fetchedData;
                } else {
                    collectionResults[collType] = [];
                }
            }

            setMultiCollectionItems(collectionResults);

            const totalItems = Object.values(collectionResults)
                .reduce((acc, curr) => acc + curr.length, 0);

            setSuccess(`Successfully loaded ${totalItems} items from ${selectedCollections.length} collections`);
        } catch (err) {
            console.error('Error fetching multiple collections:', err);
            setError(`Failed to load collections: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [selectedCollections, collectionMapping, queryLimit]);

    // Check if all items in a collection are selected
    const isCollectionFullySelected = useCallback((collType) => {
        if (!multiCollectionItems[collType] || multiCollectionItems[collType].length === 0) {
            return false;
        }

        const collectionItemIds = multiCollectionItems[collType].map(item => item.id);
        const selectedItemsInCollection = multiCollectionItems[collType]
            .filter(item => item.__selected)
            .map(item => item.id);

        return selectedItemsInCollection.length === collectionItemIds.length;
    }, [multiCollectionItems]);

    // Toggle selection for all items in a collection
    const toggleAllInCollection = useCallback((collType) => {
        if (!multiCollectionItems[collType]) return;

        setMultiCollectionItems(prev => {
            const newItems = { ...prev };
            const allSelected = isCollectionFullySelected(collType);

            newItems[collType] = newItems[collType].map(item => ({
                ...item,
                __selected: !allSelected
            }));

            return newItems;
        });
    }, [isCollectionFullySelected, multiCollectionItems]);

    // Get total number of selected items across all collections
    const getTotalSelectedItems = useCallback(() => {
        return Object.values(multiCollectionItems)
            .flat()
            .filter(item => item.__selected)
            .length;
    }, [multiCollectionItems]);

    // Check if schemas exist for all selected collection types with selected items
    const allSchemasExist = useCallback(() => {
        for (const [collType, items] of Object.entries(multiCollectionItems)) {
            const hasSelectedItems = items.some(item => item.__selected);

            if (hasSelectedItems && !schemas[collType]) {
                return false;
            }
        }
        return true;
    }, [multiCollectionItems, schemas]);

    // Validate multiple collections against their schemas
    const validateMultiCollections = useCallback(() => {
        const validationResults = [];

        for (const [collType, items] of Object.entries(multiCollectionItems)) {
            // Skip if no items selected from this collection
            if (!items.some(item => item.__selected)) continue;

            // Skip if no schema for this collection type
            if (!schemas[collType]) continue;

            const schema = schemas[collType].schema;

            items.forEach(item => {
                if (!item.__selected) return;

                const issues = [];
                let needsFix = false;

                // Special case for products.categories
                if (collType === 'products') {
                    // Check if categories should be an array but isn't
                    if (schema.categories === 'array' && !Array.isArray(item.categories)) {
                        issues.push({
                            field: 'categories',
                            currentType: item.categories ? typeof item.categories : 'missing',
                            expectedType: 'array',
                            fix: 'Convert to array or create from category field'
                        });
                        needsFix = true;
                    }

                    // Check if there's a category field but no categories array
                    if (item.category && (!item.categories || item.categories.length === 0)) {
                        issues.push({
                            field: 'category',
                            issue: 'Single category field exists but no categories array',
                            fix: 'Create categories array from category field'
                        });
                        needsFix = true;
                    }
                }

                // Check other fields against schema
                Object.entries(schema).forEach(([field, type]) => {
                    if (field === 'categories' && collType === 'products') {
                        // Already handled in special case
                        return;
                    }

                    // Handle missing or null/undefined fields
                    if (item[field] === undefined || item[field] === null) {
                        issues.push({
                            field,
                            issue: item[field] === undefined ? 'Field is undefined' : 'Field is null',
                            expectedType: type,
                            fix: `Create ${field} as ${type === 'array' ? '[]' : type === 'object' ? '{}' : type === 'string' ? '""' : type === 'number' ? '0' : type === 'boolean' ? 'false' : 'default value'}`
                        });
                        needsFix = true;
                    }
                    // Handle type mismatches
                    else if (
                        (type === 'array' && !Array.isArray(item[field])) ||
                        (type !== 'array' && typeof item[field] !== type)
                    ) {
                        issues.push({
                            field,
                            currentType: Array.isArray(item[field]) ? 'array' : typeof item[field],
                            expectedType: type,
                            fix: `Convert to ${type}`
                        });
                        needsFix = true;
                    }
                });

                if (issues.length > 0) {
                    validationResults.push({
                        id: item.id,
                        name: item.name || item.title || item.id,
                        collectionType: collType,
                        issues,
                        needsFix
                    });
                }
            });
        }

        setSchemaValidation(validationResults);
        setValidationComplete(true);
    }, [multiCollectionItems, schemas]);

    // Apply fixes to items from multiple collections
    const applyMultiCollectionFixes = useCallback(async () => {
        if (!validationComplete || schemaValidation.length === 0) {
            setError('Please validate items against schemas first');
            return;
        }

        const itemsToFix = schemaValidation.filter(item => item.needsFix);

        if (itemsToFix.length === 0) {
            setSuccess('No issues to fix in selected items');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Group items by collection type for efficient batch processing
            const itemsByCollection = {};

            for (const item of itemsToFix) {
                const { collectionType } = item;
                if (!itemsByCollection[collectionType]) {
                    itemsByCollection[collectionType] = [];
                }
                itemsByCollection[collectionType].push(item);
            }

            let totalFixedCount = 0;

            // Process each collection type separately
            for (const [collType, items] of Object.entries(itemsByCollection)) {
                const collectionName = collectionMapping[collType];
                const batch = writeBatch(db);
                let fixedCount = 0;

                for (const validationItem of items) {
                    const originalItem = multiCollectionItems[collType].find(i => i.id === validationItem.id);
                    if (!originalItem) continue;

                    const docRef = doc(db, collectionName, validationItem.id);
                    const updates = {};

                    // Apply collection-specific fixes
                    if (collType === 'products') {
                        // Handle category/categories inconsistency
                        if (!Array.isArray(originalItem.categories)) {
                            if (originalItem.category) {
                                updates.categories = [originalItem.category];
                            } else {
                                updates.categories = [];
                            }
                        }
                    }

                    // Apply schema-based fixes
                    const schema = schemas[collType].schema;
                    Object.entries(schema).forEach(([field, type]) => {
                        if (field in updates) return; // Skip if already handled

                        if (originalItem[field] === undefined || originalItem[field] === null) {
                            // Create missing field with default value
                            if (type === 'array') updates[field] = [];
                            else if (type === 'object') updates[field] = {};
                            else if (type === 'string') updates[field] = '';
                            else if (type === 'number') updates[field] = 0;
                            else if (type === 'boolean') updates[field] = false;
                        } else if (
                            (type === 'array' && !Array.isArray(originalItem[field])) ||
                            (type !== 'array' && typeof originalItem[field] !== type)
                        ) {
                            // Convert field to correct type
                            if (type === 'array') {
                                updates[field] = typeof originalItem[field] === 'string'
                                    ? [originalItem[field]]
                                    : [];
                            } else if (type === 'string') {
                                updates[field] = String(originalItem[field]);
                            } else if (type === 'number') {
                                updates[field] = Number(originalItem[field]) || 0;
                            } else if (type === 'boolean') {
                                updates[field] = Boolean(originalItem[field]);
                            } else if (type === 'object') {
                                updates[field] = {};
                            }
                        }
                    });

                    if (Object.keys(updates).length > 0) {
                        batch.update(docRef, updates);
                        fixedCount++;
                    }
                }

                // Commit batch for this collection type
                if (fixedCount > 0) {
                    await batch.commit();
                    totalFixedCount += fixedCount;
                }
            }

            // Refresh data if fixes were applied
            if (totalFixedCount > 0) {
                await fetchMultiCollectionData();
                setSuccess(`Successfully fixed ${totalFixedCount} documents across multiple collections`);
            } else {
                setSuccess('No documents needed updates');
            }

            setValidationComplete(false);
            setSchemaValidation([]);
        } catch (err) {
            console.error('Error applying multi-collection fixes:', err);
            setError(`Failed to apply fixes: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [validationComplete, schemaValidation, multiCollectionItems, schemas, collectionMapping, fetchMultiCollectionData]);

    // Filter data items based on search term
    const filteredData = useMemo(() => {
        if (!filter) return data;
        return data.filter(item =>
            JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
        );
    }, [data, filter]);

    return (
        <div className="admin-data-fixer">
            <h2>Data Fixer Tool</h2>
            <p className="tool-description">
                Use this tool to validate data against schemas and fix inconsistencies like
                category/categories fields in products.
                {dataType === 'products' && (
                    <>
                        {viewMode === 'excel' ?
                            ' Use Excel View for spreadsheet-like bulk editing.' :
                            ' Switch to Excel View for spreadsheet-like bulk editing.'}
                    </>
                )}
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

                    {dataType === 'products' && (
                        <div className="view-mode-selector">
                            <label>View Mode:</label>
                            <div className="view-mode-buttons">
                                <button
                                    className={`view-mode-btn ${viewMode === 'standard' ? 'active' : ''}`}
                                    onClick={() => setViewMode('standard')}
                                >
                                    Standard View
                                </button>
                                <button
                                    className={`view-mode-btn ${viewMode === 'excel' ? 'active' : ''}`}
                                    onClick={() => setViewMode('excel')}
                                >
                                    Excel View
                                </button>
                            </div>
                        </div>
                    )}

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
                        onClick={fetchData}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Load Data'}
                    </button>

                    <button
                        className="schema-manager-btn"
                        onClick={() => setShowSchemaManager(true)}
                    >
                        Manage Schemas
                    </button>

                    {data.length > 0 && (
                        <>
                            <button
                                className={`batch-mode-btn ${batchMode ? 'active' : ''}`}
                                onClick={() => {
                                    setBatchMode(prev => !prev);
                                    setMultiCollectionBatchMode(false);
                                    setSelectedItems([]);
                                    setValidationComplete(false);
                                    setSchemaValidation([]);
                                }}
                            >
                                {batchMode ? 'Exit Batch Mode' : 'Enter Batch Mode'}
                            </button>

                            <button
                                className={`multi-collection-batch-btn ${multiCollectionBatchMode ? 'active' : ''}`}
                                onClick={() => {
                                    setMultiCollectionBatchMode(prev => !prev);
                                    setBatchMode(false);
                                    setSelectedItems([]);
                                    setMultiCollectionItems({});
                                    setSelectedCollections([]);
                                    setValidationComplete(false);
                                    setSchemaValidation([]);
                                }}
                            >
                                {multiCollectionBatchMode ? 'Exit Multi-Collection Mode' : 'Multi-Collection Batch Mode'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {(success || error) && (
                <div className={`message ${error ? 'error' : 'success'}`}>
                    {error || success}
                </div>
            )}

            {dataType === 'products' && viewMode === 'excel' ? (
                <ProductsExcelView />
            ) : (
                <>
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

                    {batchMode && data.length > 0 && (
                        <div className="batch-controls">
                            <div className="batch-selection">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.length === data.length}
                                        onChange={toggleSelectAll}
                                    />
                                    Select All ({selectedItems.length} of {data.length} selected)
                                </label>
                            </div>

                            {selectedItems.length > 0 && schemas[dataType] && (
                                <button
                                    className="validate-btn"
                                    onClick={validateAgainstSchema}
                                    disabled={loading}
                                >
                                    Validate Against Schema
                                </button>
                            )}

                            {selectedItems.length > 0 && !schemas[dataType] && (
                                <div className="no-schema-warning">
                                    No schema defined for {dataType}. Please create a schema first.
                                </div>
                            )}
                        </div>
                    )}

                    {multiCollectionBatchMode && (
                        <div className="multi-collection-controls">
                            <h3>Multi-Collection Batch Mode</h3>
                            <p>Select collection types to include in batch operations:</p>

                            <div className="collection-selection">
                                {Object.keys(collectionMapping).map(collType => (
                                    <label key={collType} className="collection-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedCollections.includes(collType)}
                                            onChange={() => {
                                                setSelectedCollections(prev =>
                                                    prev.includes(collType)
                                                        ? prev.filter(c => c !== collType)
                                                        : [...prev, collType]
                                                );
                                            }}
                                        />
                                        {collType.charAt(0).toUpperCase() + collType.slice(1)}
                                    </label>
                                ))}
                            </div>

                            {selectedCollections.length > 0 && (
                                <button
                                    className="load-multi-collections-btn"
                                    onClick={fetchMultiCollectionData}
                                    disabled={loading}
                                >
                                    {loading ? 'Loading...' : 'Load Selected Collections'}
                                </button>
                            )}

                            {Object.keys(multiCollectionItems).length > 0 && (
                                <div className="multi-collection-summary">
                                    <h4>Loaded Collections:</h4>
                                    <ul>
                                        {Object.entries(multiCollectionItems).map(([collType, items]) => (
                                            <li key={collType}>
                                                {collType}: {items.length} items
                                                {items.length > 0 && (
                                                    <button
                                                        className="toggle-selection-btn"
                                                        onClick={() => toggleAllInCollection(collType)}
                                                    >
                                                        {isCollectionFullySelected(collType) ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>

                                    {getTotalSelectedItems() > 0 && allSchemasExist() && (
                                        <button
                                            className="validate-multi-btn"
                                            onClick={validateMultiCollections}
                                            disabled={loading}
                                        >
                                            Validate {getTotalSelectedItems()} Items Against Schemas
                                        </button>
                                    )}

                                    {getTotalSelectedItems() > 0 && !allSchemasExist() && (
                                        <div className="schema-warning">
                                            Some selected collections don't have schemas defined.
                                            Please create schemas for all selected collection types.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {multiCollectionBatchMode && Object.keys(multiCollectionItems).length > 0 && (
                        <div className="multi-collection-data-display">
                            <h4>Data from Multiple Collections</h4>

                            {Object.entries(multiCollectionItems).map(([collType, items]) => (
                                <div key={collType} className="multi-collection-section">
                                    <div className="collection-header">
                                        <h5>{collType.charAt(0).toUpperCase() + collType.slice(1)} ({items.length})</h5>
                                        <button
                                            className="toggle-collection-btn"
                                            onClick={() => toggleAllInCollection(collType)}
                                        >
                                            {isCollectionFullySelected(collType) ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>

                                    <div className="collection-items">
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className={`multi-collection-item ${item.__selected ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setMultiCollectionItems(prev => {
                                                        const newItems = { ...prev };
                                                        const collectionItems = [...newItems[collType]];

                                                        const itemIndex = collectionItems.findIndex(i => i.id === item.id);
                                                        if (itemIndex !== -1) {
                                                            collectionItems[itemIndex] = {
                                                                ...collectionItems[itemIndex],
                                                                __selected: !collectionItems[itemIndex].__selected
                                                            };
                                                        }

                                                        newItems[collType] = collectionItems;
                                                        return newItems;
                                                    });
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={item.__selected || false}
                                                    onChange={() => { }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="item-details">
                                                    <div className="item-name">{item.name || item.title || item.id}</div>
                                                    <div className="item-id">ID: {item.id}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="data-explorer">
                        <div className="data-list">
                            {filteredData.length > 0 ? (
                                <div className="data-items-container">
                                    {filteredData.map(item => (
                                        <div
                                            key={item.id}
                                            className={`data-item ${selectedItem?.id === item.id ? 'selected' : ''} ${batchMode && selectedItems.includes(item.id) ? 'batch-selected' : ''}`}
                                            onClick={() => batchMode ? toggleItemSelection(item.id) : handleSelectItem(item)}
                                        >
                                            {batchMode && (
                                                <div className="batch-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.includes(item.id)}
                                                        onChange={() => toggleItemSelection(item.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            )}
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
                            {validationComplete && (
                                <ValidationResults
                                    schemaValidation={schemaValidation}
                                    setValidationComplete={setValidationComplete}
                                    setSchemaValidation={setSchemaValidation}
                                    applySchemaFixes={applySchemaFixes}
                                    applyMultiCollectionFixes={applyMultiCollectionFixes}
                                    loading={loading}
                                    multiCollectionMode={multiCollectionBatchMode}
                                />
                            )}

                            {!validationComplete && (
                                selectedItem && !editedItem ? (
                                    <div className="item-details">
                                        <h3>{dataType} Details</h3>
                                        <div className="item-id">ID: {selectedItem.id}</div>
                                        <pre>{JSON.stringify(selectedItem, null, 2)}</pre>
                                        <div className="item-actions">
                                            <button
                                                className="edit-btn"
                                                onClick={() => setEditedItem(JSON.parse(JSON.stringify(selectedItem)))}
                                            >
                                                Edit This Item
                                            </button>
                                        </div>
                                    </div>
                                ) : editedItem ? (
                                    <ItemEditor
                                        editedItem={editedItem}
                                        setEditedItem={setEditedItem}
                                        setSelectedItem={setSelectedItem}
                                        updateDocument={updateDocument}
                                        loading={loading}
                                        dataType={dataType}
                                    />
                                ) : (
                                    <div className="no-selection">
                                        {batchMode ?
                                            'Select items and validate against a schema to fix data inconsistencies.' :
                                            'Select an item from the list to view details.'}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </>
            )}

            {showSchemaManager && (
                <SchemaManager
                    dataType={dataType}
                    schemas={schemas}
                    setSchemas={setSchemas}
                    selectedItem={selectedItem}
                    activeSchema={activeSchema}
                    setActiveSchema={setActiveSchema}
                    setShowSchemaManager={setShowSchemaManager}
                    loading={loading}
                    setLoading={setLoading}
                    setError={setError}
                    setSuccess={setSuccess}
                />
            )}
        </div>
    );
};

export default DataFixerTool;