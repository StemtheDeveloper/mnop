/**
 * ProductVariant model
 *
 * Defines the structure for product variants with attributes like size, color, etc.
 * Each variant can have its own inventory tracking and pricing.
 */

/**
 * @typedef {Object} VariantOption
 * @property {string} name - The name of the option (e.g., "Size", "Color")
 * @property {string} value - The value of the option (e.g., "Small", "Red")
 */

/**
 * @typedef {Object} ProductVariant
 * @property {string} id - Unique identifier for the variant
 * @property {Array<VariantOption>} options - Array of variant options (e.g., [{name: "Size", value: "Small"}, {name: "Color", value: "Red"}])
 * @property {string} sku - Stock Keeping Unit for inventory tracking
 * @property {number} price - Price of this specific variant (overrides product base price)
 * @property {number} [salePrice] - Optional sale price for this variant
 * @property {number} stockQuantity - Current inventory count
 * @property {boolean} trackInventory - Whether to track inventory for this variant
 * @property {number} [lowStockThreshold] - Threshold for low stock warning
 * @property {string} [imageUrl] - Optional specific image for this variant
 * @property {boolean} active - Whether this variant is available for purchase
 * @property {number} [weight] - Optional weight for shipping calculations
 * @property {Object} [dimensions] - Optional dimensions for shipping calculations
 * @property {number} [dimensions.length] - Length in inches
 * @property {number} [dimensions.width] - Width in inches
 * @property {number} [dimensions.height] - Height in inches
 */

/**
 * Create a new product variant object with default values
 * @param {Partial<ProductVariant>} variantData - Partial variant data
 * @returns {ProductVariant} - New variant object with defaults applied
 */
export const createVariant = (variantData = {}) => {
  return {
    id: variantData.id || crypto.randomUUID(), // Generate a unique ID
    options: variantData.options || [],
    sku: variantData.sku || "",
    price: variantData.price || 0,
    salePrice: variantData.salePrice || null,
    stockQuantity: variantData.stockQuantity || 0,
    trackInventory: variantData.trackInventory ?? true,
    lowStockThreshold: variantData.lowStockThreshold || 5,
    imageUrl: variantData.imageUrl || "",
    active: variantData.active ?? true,
    weight: variantData.weight || null,
    dimensions: variantData.dimensions || null,
  };
};

/**
 * Format a variant's display name from its options
 * @param {ProductVariant} variant - The variant to format
 * @returns {string} - Formatted name (e.g. "Small / Red")
 */
export const formatVariantName = (variant) => {
  if (!variant.options || variant.options.length === 0) {
    return "Default";
  }

  return variant.options.map((option) => option.value).join(" / ");
};

/**
 * Check if a variant is low on stock
 * @param {ProductVariant} variant - The variant to check
 * @returns {boolean} - True if the variant is low on stock
 */
export const isLowStock = (variant) => {
  if (!variant.trackInventory) return false;
  return variant.stockQuantity <= variant.lowStockThreshold;
};

/**
 * Check if a variant is out of stock
 * @param {ProductVariant} variant - The variant to check
 * @returns {boolean} - True if the variant is out of stock
 */
export const isOutOfStock = (variant) => {
  if (!variant.trackInventory) return false;
  return variant.stockQuantity <= 0;
};

export default {
  createVariant,
  formatVariantName,
  isLowStock,
  isOutOfStock,
};
