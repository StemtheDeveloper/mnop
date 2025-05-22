/**
 * Utility functions for sanitizing user inputs to prevent XSS attacks
 */

/**
 * Sanitizes a string by escaping HTML characters
 * @param {string} unsafeText - The text to be sanitized
 * @returns {string} The sanitized text
 */
export const sanitizeString = (unsafeText) => {
  if (typeof unsafeText !== "string") {
    return unsafeText;
  }

  return unsafeText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Decodes HTML entities in a string
 * @param {string} encodedText - Text with HTML entities to decode
 * @returns {string} The decoded text
 */
export const decodeHtmlEntities = (encodedText) => {
  if (typeof encodedText !== "string") {
    return encodedText;
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = encodedText;
  return textarea.value;
};

/**
 * Sanitizes an object's string properties recursively
 * @param {object} obj - The object containing string properties to sanitize
 * @returns {object} A new object with sanitized string properties
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  // Handle regular objects
  const sanitized = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
};

/**
 * Sanitizes form data object (e.g., from useState for form handling)
 * @param {object} formData - Form data object with string properties
 * @returns {object} A new object with sanitized form values
 */
export const sanitizeFormData = (formData) => {
  return sanitizeObject(formData);
};

/**
 * Sanitizes URL parameters to prevent XSS in URL parameters
 * @param {string} param - URL parameter to sanitize
 * @returns {string} Sanitized URL parameter
 */
export const sanitizeUrlParam = (param) => {
  if (typeof param !== "string") {
    return param;
  }

  // Remove any HTML or script tags from URL parameters
  return param.replace(/<[^>]*>/g, "");
};
