import React, { useState, useEffect } from 'react';
import { createVariant, formatVariantName } from '../models/ProductVariant';


/**
 * VariantManager Component
 * Allows creating and managing product variants with different attributes
 * 
 * @param {Object} props
 * @param {Array} props.variants - Current variants of the product
 * @param {Function} props.onChange - Callback when variants change
 * @param {boolean} props.disabled - Whether the component is disabled
 */
const VariantManager = ({ variants = [], onChange, disabled = false }) => {
    const [variantOptions, setVariantOptions] = useState([
        { name: 'Size', values: [] },
        { name: 'Color', values: [] }
    ]);
    const [editingVariant, setEditingVariant] = useState(null);
    const [showVariantEditor, setShowVariantEditor] = useState(false);
    const [availableOptionTypes, setAvailableOptionTypes] = useState([
        'Size', 'Color', 'Material', 'Style', 'Weight', 'Finish'
    ]);

    // Generate variants when option combinations change
    const generateVariants = () => {
        // Filter out options with no values
        const activeOptions = variantOptions.filter(opt => opt.values.length > 0);

        if (activeOptions.length === 0) {
            // No options with values, create a default variant
            if (variants.length === 0) {
                onChange([createVariant({
                    options: [],
                    price: 0
                })]);
            }
            return;
        }

        // Generate all possible combinations of option values
        const combinations = getCombinations(activeOptions);

        // Create variants for each combination, preserving existing data where possible
        const newVariants = combinations.map(combo => {
            // Check if we already have a variant with this exact combination
            const existingVariant = variants.find(v =>
                areOptionsSame(v.options, combo)
            );

            if (existingVariant) {
                return existingVariant;
            }

            // Create a new variant with this combination
            return createVariant({
                options: combo,
                price: 0, // Default to the base product price
                stockQuantity: 0
            });
        });

        onChange(newVariants);
    };

    // Get all possible combinations of option values
    const getCombinations = (options) => {
        if (options.length === 0) return [[]];

        const [firstOption, ...restOptions] = options;
        const restCombinations = getCombinations(restOptions);

        const result = [];
        for (const value of firstOption.values) {
            for (const restCombo of restCombinations) {
                result.push([
                    { name: firstOption.name, value },
                    ...restCombo
                ]);
            }
        }

        return result;
    };

    // Check if two option arrays are the same
    const areOptionsSame = (options1, options2) => {
        if (!options1 || !options2) return false;
        if (options1.length !== options2.length) return false;

        // Create a string representation for easier comparison
        const optionsString1 = options1
            .map(opt => `${opt.name}:${opt.value}`)
            .sort()
            .join('|');

        const optionsString2 = options2
            .map(opt => `${opt.name}:${opt.value}`)
            .sort()
            .join('|');

        return optionsString1 === optionsString2;
    };

    // Add a new option type
    const addOptionType = () => {
        if (availableOptionTypes.length === 0) return;

        setVariantOptions([
            ...variantOptions,
            { name: availableOptionTypes[0], values: [] }
        ]);
    };

    // Remove an option type
    const removeOptionType = (index) => {
        const newOptions = [...variantOptions];
        const removedOption = newOptions.splice(index, 1)[0];

        setVariantOptions(newOptions);

        // Add the removed option type back to available options
        if (removedOption && removedOption.name) {
            setAvailableOptionTypes([...availableOptionTypes, removedOption.name]);
        }

        // Regenerate variants without this option
        setTimeout(generateVariants, 0);
    };

    // Change an option type
    const changeOptionType = (index, newName) => {
        const newOptions = [...variantOptions];
        const oldName = newOptions[index].name;

        newOptions[index] = {
            ...newOptions[index],
            name: newName
        };

        setVariantOptions(newOptions);

        // Update available options
        const newAvailable = [...availableOptionTypes];
        const oldNameIndex = newAvailable.indexOf(newName);

        if (oldNameIndex !== -1) {
            newAvailable.splice(oldNameIndex, 1);
            newAvailable.push(oldName);
            setAvailableOptionTypes(newAvailable);
        }
    };

    // Add a value to an option
    const addOptionValue = (optionIndex, value) => {
        if (!value) return;

        const newOptions = [...variantOptions];
        if (!newOptions[optionIndex].values.includes(value)) {
            newOptions[optionIndex].values.push(value);
            setVariantOptions(newOptions);

            // Regenerate variants with the new value
            setTimeout(generateVariants, 0);
        }
    };

    // Remove a value from an option
    const removeOptionValue = (optionIndex, valueIndex) => {
        const newOptions = [...variantOptions];
        newOptions[optionIndex].values.splice(valueIndex, 1);
        setVariantOptions(newOptions);

        // Regenerate variants without this value
        setTimeout(generateVariants, 0);
    };

    // Edit a specific variant
    const editVariant = (variant) => {
        setEditingVariant({ ...variant });
        setShowVariantEditor(true);
    };

    // Save changes to a variant
    const saveVariantChanges = () => {
        if (!editingVariant) return;

        const updatedVariants = variants.map(v =>
            v.id === editingVariant.id ? editingVariant : v
        );

        onChange(updatedVariants);
        setShowVariantEditor(false);
        setEditingVariant(null);
    };

    // Update all variants with a bulk change
    const bulkUpdateVariants = (field, value) => {
        const updatedVariants = variants.map(v => ({
            ...v,
            [field]: value
        }));

        onChange(updatedVariants);
    };

    // Initialize or update variant options based on existing variants
    useEffect(() => {
        if (variants.length === 0) return;

        // Extract option types and values from existing variants
        const optionMap = new Map();

        variants.forEach(variant => {
            if (!variant.options) return;

            variant.options.forEach(opt => {
                if (!optionMap.has(opt.name)) {
                    optionMap.set(opt.name, new Set());
                }
                optionMap.get(opt.name).add(opt.value);
            });
        });

        // Convert to the format we need
        const extractedOptions = Array.from(optionMap).map(([name, valuesSet]) => ({
            name,
            values: Array.from(valuesSet)
        }));

        if (extractedOptions.length > 0) {
            setVariantOptions(extractedOptions);

            // Update available option types
            const usedTypes = extractedOptions.map(opt => opt.name);
            setAvailableOptionTypes(prev =>
                prev.filter(type => !usedTypes.includes(type))
            );
        }
    }, []);

    return (
        <div className="variant-manager">
            <h3>Product Variants</h3>

            <div className="variant-options-section">
                <h4>Variant Options</h4>
                <p className="help-text">Define the options (like size, color) that will create your variants</p>

                {variantOptions.map((option, optIndex) => (
                    <div key={optIndex} className="option-group">
                        <div className="option-header">
                            <select
                                value={option.name}
                                onChange={(e) => changeOptionType(optIndex, e.target.value)}
                                disabled={disabled}
                            >
                                <option value={option.name}>{option.name}</option>
                                {availableOptionTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>

                            <button
                                type="button"
                                className="remove-option-btn"
                                onClick={() => removeOptionType(optIndex)}
                                disabled={disabled}
                            >
                                Remove
                            </button>
                        </div>

                        <div className="option-values">
                            {option.values.map((value, valueIndex) => (
                                <div key={valueIndex} className="option-value-tag">
                                    <span>{value}</span>
                                    <button
                                        type="button"
                                        className="remove-value-btn"
                                        onClick={() => removeOptionValue(optIndex, valueIndex)}
                                        disabled={disabled}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}

                            <div className="add-value-form">
                                <input
                                    type="text"
                                    placeholder={`Add ${option.name}...`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addOptionValue(optIndex, e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                    disabled={disabled}
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        const input = e.target.previousSibling;
                                        addOptionValue(optIndex, input.value);
                                        input.value = '';
                                    }}
                                    disabled={disabled}
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {variantOptions.length < availableOptionTypes.length && (
                    <button
                        type="button"
                        className="add-option-btn"
                        onClick={addOptionType}
                        disabled={disabled}
                    >
                        Add Another Option
                    </button>
                )}
            </div>

            {variants.length > 0 && (
                <div className="variants-table-container">
                    <h4>Generated Variants</h4>
                    <p className="help-text">Each variant can have its own price, inventory, and image</p>

                    <div className="variants-bulk-actions">
                        <div className="bulk-action">
                            <label>Bulk set tracking:</label>
                            <select
                                onChange={(e) => bulkUpdateVariants('trackInventory', e.target.value === 'true')}
                                disabled={disabled}
                            >
                                <option value="">Choose...</option>
                                <option value="true">Track for all</option>
                                <option value="false">Don't track</option>
                            </select>
                        </div>

                        <div className="bulk-action">
                            <label>Bulk set threshold:</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Set for all..."
                                onChange={(e) => bulkUpdateVariants('lowStockThreshold', parseInt(e.target.value) || 5)}
                                disabled={disabled}
                            />
                        </div>
                    </div>

                    <table className="variants-table">
                        <thead>
                            <tr>
                                <th>Variant</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {variants.map((variant) => (
                                <tr key={variant.id}>
                                    <td>{formatVariantName(variant)}</td>
                                    <td>${variant.price.toFixed(2)}</td>
                                    <td>
                                        {variant.trackInventory
                                            ? variant.stockQuantity
                                            : 'Not tracked'}
                                    </td>
                                    <td>
                                        <span className={`variant-status ${variant.active ? 'active' : 'inactive'}`}>
                                            {variant.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="edit-variant-btn"
                                            onClick={() => editVariant(variant)}
                                            disabled={disabled}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showVariantEditor && editingVariant && (
                <div className="variant-editor-overlay">
                    <div className="variant-editor">
                        <h3>Edit Variant: {formatVariantName(editingVariant)}</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Price</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editingVariant.price}
                                    onChange={(e) => setEditingVariant({
                                        ...editingVariant,
                                        price: parseFloat(e.target.value) || 0
                                    })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Sale Price (optional)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editingVariant.salePrice || ''}
                                    onChange={(e) => setEditingVariant({
                                        ...editingVariant,
                                        salePrice: e.target.value ? parseFloat(e.target.value) : null
                                    })}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>SKU (Stock Keeping Unit)</label>
                                <input
                                    type="text"
                                    value={editingVariant.sku}
                                    onChange={(e) => setEditingVariant({
                                        ...editingVariant,
                                        sku: e.target.value
                                    })}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={editingVariant.trackInventory}
                                        onChange={(e) => setEditingVariant({
                                            ...editingVariant,
                                            trackInventory: e.target.checked
                                        })}
                                    />
                                    Track inventory for this variant
                                </label>
                            </div>
                        </div>

                        {editingVariant.trackInventory && (
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Stock Quantity</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingVariant.stockQuantity}
                                        onChange={(e) => setEditingVariant({
                                            ...editingVariant,
                                            stockQuantity: parseInt(e.target.value) || 0
                                        })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Low Stock Threshold</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingVariant.lowStockThreshold}
                                        onChange={(e) => setEditingVariant({
                                            ...editingVariant,
                                            lowStockThreshold: parseInt(e.target.value) || 5
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="form-row">
                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={editingVariant.active}
                                        onChange={(e) => setEditingVariant({
                                            ...editingVariant,
                                            active: e.target.checked
                                        })}
                                    />
                                    Variant is active and available for purchase
                                </label>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Variant Image URL (optional)</label>
                                <input
                                    type="text"
                                    value={editingVariant.imageUrl || ''}
                                    onChange={(e) => setEditingVariant({
                                        ...editingVariant,
                                        imageUrl: e.target.value
                                    })}
                                    placeholder="Leave empty to use main product images"
                                />
                            </div>
                        </div>

                        <div className="editor-actions">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => {
                                    setShowVariantEditor(false);
                                    setEditingVariant(null);
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="save-btn"
                                onClick={saveVariantChanges}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VariantManager;