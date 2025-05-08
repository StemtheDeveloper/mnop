/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: USD)
 * @param {Object} options - Additional formatting options
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = "USD", options = {}) => {
  // Handle null or undefined
  if (amount === null || amount === undefined) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    ...options,
  }).format(amount);
};

/**
 * This version of formatCurrency is for use without the CurrencyContext
 * CurrencyContext's formatAmount method is preferred when available
 */

/**
 * Format a date in a user-friendly format
 * @param {Date|Object} date - Date object or Firestore timestamp
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return "N/A";

  // Handle Firebase Timestamp objects
  const dateObj = date.toDate ? date.toDate() : new Date(date);

  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Format a date as relative time (e.g. "2 days ago", "just now")
 * @param {Date|Object} date - Date object or Firestore timestamp
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return "N/A";

  // Handle Firebase Timestamp objects
  const dateObj = date.toDate ? date.toDate() : new Date(date);

  const now = new Date();
  const diff = now - dateObj;

  // Convert diff to seconds
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return "just now";
  }

  // Minutes
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  // Hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  // Days
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1 ? "yesterday" : `${days} days ago`;
  }

  // Months
  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  // Years
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
};
