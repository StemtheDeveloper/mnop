import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for managing form state with localStorage persistence and change detection
 *
 * @param {string} storageKey - Unique key for storing form data in localStorage
 * @param {object} defaultData - Default values for the form
 * @param {object} originalData - Original data to compare against for detecting changes
 * @param {function} sanitizer - Optional function to sanitize input values
 * @returns {object} Form state and helper functions
 */
const useLocalStorageForm = (
  storageKey,
  defaultData,
  originalData,
  sanitizer = (val) => val
) => {
  // Initialize form data from localStorage or use default data
  const [formData, setFormData] = useState(() => {
    try {
      // Try to get stored form data from localStorage
      const storedData = localStorage.getItem(storageKey);

      // Parse the stored data or use defaultData if nothing is stored
      return storedData ? JSON.parse(storedData) : defaultData;
    } catch (error) {
      console.error("Error reading form data from localStorage:", error);
      return defaultData;
    }
  });

  // Track whether the form has changes compared to original data
  const [hasChanges, setHasChanges] = useState(false);

  // Update localStorage whenever formData changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(formData));

      // Check if form has changes compared to original data
      if (originalData) {
        const hasFormChanges = checkForChanges(formData, originalData);
        setHasChanges(hasFormChanges);
      }
    } catch (error) {
      console.error("Error saving form data to localStorage:", error);
    }
  }, [formData, originalData, storageKey]);

  // Standard handleChange function for form inputs
  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;

      const fieldValue = type === "checkbox" ? checked : sanitizer(value);

      setFormData((prevData) => ({
        ...prevData,
        [name]: fieldValue,
      }));
    },
    [sanitizer]
  );

  // Function to update multiple form fields at once
  const updateFormData = useCallback((newData) => {
    setFormData((prevData) => ({
      ...prevData,
      ...newData,
    }));
  }, []);

  // Function to reset form to original data
  const resetForm = useCallback(() => {
    if (originalData) {
      setFormData(originalData);
    }
  }, [originalData]);

  // Function to clear stored data from localStorage
  const clearStoredData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Error clearing form data from localStorage:", error);
    }
  }, [storageKey]);

  // Helper function to check for differences between current form and original data
  const checkForChanges = (current, original) => {
    if (!original) return false;

    // Compare each field in the form data with the original data
    for (const key in current) {
      // Skip if the property doesn't exist in original (can happen with newly added fields)
      if (!Object.prototype.hasOwnProperty.call(original, key)) continue;

      // Handle arrays specifically (like categories)
      if (Array.isArray(current[key]) && Array.isArray(original[key])) {
        // Check if arrays have different lengths
        if (current[key].length !== original[key].length) return true;

        // Check if array contents are different
        for (let i = 0; i < current[key].length; i++) {
          if (current[key][i] !== original[key][i]) return true;
        }
      }
      // Handle objects recursively
      else if (
        typeof current[key] === "object" &&
        current[key] !== null &&
        typeof original[key] === "object" &&
        original[key] !== null
      ) {
        if (checkForChanges(current[key], original[key])) return true;
      }
      // Simple value comparison for primitive types
      else if (current[key] !== original[key]) {
        return true;
      }
    }

    return false;
  };

  return {
    formData,
    setFormData,
    hasChanges,
    handleChange,
    updateFormData,
    resetForm,
    clearStoredData,
  };
};

export default useLocalStorageForm;
