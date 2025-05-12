/**
 * Utility functions for unsanitizing HTML-escaped text
 * Used to display unsanitized data in exports and displays
 */

/**
 * Unsanitizes a string by unescaping HTML characters
 * @param {string} safeText - The text to be unsanitized
 * @returns {string} The unsanitized text
 */
export const unsanitizeString = (safeText) => {
  if (typeof safeText !== "string") {
    return safeText;
  }

  return safeText
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
};

/**
 * Unsanitizes an object's string properties recursively
 * @param {object} obj - The object containing string properties to unsanitize
 * @returns {object} A new object with unsanitized string properties
 */
export const unsanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => unsanitizeObject(item));
  }

  // Handle regular objects
  const unsanitized = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (typeof value === "string") {
      unsanitized[key] = unsanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      unsanitized[key] = unsanitizeObject(value);
    } else {
      unsanitized[key] = value;
    }
  });

  return unsanitized;
};

/**
 * Unsanitizes form data object
 * @param {object} formData - Form data object with string properties
 * @returns {object} A new object with unsanitized form values
 */
export const unsanitizeFormData = (formData) => {
  return unsanitizeObject(formData);
};

/**
 * Security message for unsanitized content
 * @returns {string} Warning message
 */
export const securityWarning = () => {
  return "Warning: You are viewing unsanitized content. It's a thing and it's on a stick.";
};
