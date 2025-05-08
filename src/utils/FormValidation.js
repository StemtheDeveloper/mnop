/**
 * Form Validation Utility
 *
 * This utility provides validation functions for common form fields
 * and a FormValidator class to manage form validation state
 */

/**
 * Validation functions for common field types
 */
export const validators = {
  // Email validation with regex
  email: (value) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!value) return "Email is required";
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    return null;
  },

  // Password validation
  password: (value, options = { minLength: 6 }) => {
    if (!value) return "Password is required";
    if (value.length < options.minLength)
      return `Password must be at least ${options.minLength} characters`;
    return null;
  },

  // Confirm password validation
  confirmPassword: (value, options = { password: "" }) => {
    if (!value) return "Please confirm your password";
    if (value !== options.password) return "Passwords do not match";
    return null;
  },

  // Required field validation
  required: (value, options = { fieldName: "This field" }) => {
    if (!value || (typeof value === "string" && !value.trim()))
      return `${options.fieldName} is required`;
    return null;
  },

  // Number validation
  number: (
    value,
    options = { min: null, max: null, fieldName: "This field" }
  ) => {
    if (!value && value !== 0) return `${options.fieldName} is required`;

    const numValue = Number(value);
    if (isNaN(numValue)) return `${options.fieldName} must be a number`;

    if (options.min !== null && numValue < options.min)
      return `${options.fieldName} must be at least ${options.min}`;

    if (options.max !== null && numValue > options.max)
      return `${options.fieldName} must be at most ${options.max}`;

    return null;
  },

  // Phone number validation
  phone: (value) => {
    if (!value) return null; // Optional field

    // Remove common formatting characters
    const cleaned = value.replace(/[\s()-]/g, "");

    // Basic phone format check (can be expanded for international formats)
    if (!/^\+?[\d]{10,15}$/.test(cleaned))
      return "Please enter a valid phone number";

    return null;
  },

  // URL validation
  url: (value) => {
    if (!value) return null; // Optional field

    try {
      new URL(value);
      return null;
    } catch {
      return "Please enter a valid URL (include http:// or https://)";
    }
  },

  // Custom validation (accepts a function)
  custom: (value, options = { validator: () => null }) => {
    return options.validator(value);
  },
};

/**
 * FormValidator class to manage form validation state
 */
export class FormValidator {
  constructor(initialValues = {}) {
    this.values = initialValues;
    this.errors = {};
    this.touched = {};
  }

  // Validate a specific field
  validateField(field, validatorFn, options = {}) {
    const error = validatorFn(this.values[field], options);
    this.errors[field] = error;
    return !error;
  }

  // Mark a field as touched (user interacted with it)
  touchField(field) {
    this.touched[field] = true;
  }

  // Check if a field has an error and has been touched
  hasError(field) {
    return this.touched[field] && this.errors[field];
  }

  // Get error message for a field
  getError(field) {
    return this.hasError(field) ? this.errors[field] : null;
  }

  // Update field value
  setValue(field, value) {
    this.values[field] = value;
  }

  // Validate all specified fields
  validateAll(validations) {
    let isValid = true;

    for (const [field, { validator, options }] of Object.entries(validations)) {
      if (!this.validateField(field, validator, options)) {
        isValid = false;
        this.touchField(field);
      }
    }

    return isValid;
  }

  // Check if all specified fields are valid
  isValid(fields = Object.keys(this.values)) {
    return fields.every((field) => !this.errors[field]);
  }
}

export default {
  validators,
  FormValidator,
};
