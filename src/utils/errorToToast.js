// This utility function helps migrate from div error messages to toast notifications

/**
 * Convert error messages shown in divs to toast notifications
 * @param {string} errorMessage - The error message to display
 * @param {Function} showError - The showError function from useToast hook
 * @param {number} duration - Optional duration to show the toast (in ms)
 * @returns {null} - Returns null to be used in place of the error div
 */
export const errorToToast = (errorMessage, showError, duration = 5000) => {
  if (errorMessage) {
    showError(errorMessage, duration);
  }
  return null;
};

/**
 * Handles API or operation errors and shows toast notifications
 * @param {Error} error - The error object
 * @param {Function} showError - The showError function from useToast hook
 * @param {string} defaultMessage - Default message to show if error doesn't have a message
 * @param {number} duration - Optional duration to show the toast (in ms)
 * @returns {string} - Returns the error message (useful for error state tracking)
 */
export const handleErrorWithToast = (
  error,
  showError,
  defaultMessage = "An error occurred",
  duration = 5000
) => {
  const errorMessage = error?.message || defaultMessage;
  showError(errorMessage, duration);
  return errorMessage;
};

export default errorToToast;
