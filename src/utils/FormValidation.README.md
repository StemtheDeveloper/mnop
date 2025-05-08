# Form Validation System

This document describes how to implement form validation with error messages for all user inputs in the M'NOP application.

## Overview

The form validation system consists of:

1. **FormValidation.js utility** - Contains validation functions for common field types and a FormValidator class
2. **FormInput.jsx component** - Reusable form input component with validation display
3. **FormInput.css styles** - Styling for form inputs and validation states

## How to Use

### Basic Usage

Here's a simple example of how to implement form validation in a component:

```jsx
import React, { useState } from "react";
import FormInput from "../components/FormInput";
import { validators } from "../utils/FormValidation";
import "../styles/FormInput.css";

const MyFormComponent = () => {
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
  });

  const [formErrors, setFormErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues({
      ...formValues,
      [name]: value,
    });

    // Validate the field if it's been touched
    if (touchedFields[name]) {
      validateField(name, value);
    }
  };

  const handleInputBlur = (e) => {
    const { name, value } = e.target;
    setTouchedFields({
      ...touchedFields,
      [name]: true,
    });

    validateField(name, value);
  };

  const validateField = (name, value) => {
    let error = null;

    switch (name) {
      case "name":
        error = validators.required(value, { fieldName: "Name" });
        break;
      case "email":
        error = validators.email(value);
        break;
      default:
        break;
    }

    setFormErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error,
    }));

    return !error;
  };

  const validateForm = () => {
    // Validate all fields
    const fieldsToValidate = ["name", "email"];

    // Mark all fields as touched
    const newTouched = fieldsToValidate.reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});

    setTouchedFields(newTouched);

    // Validate each field
    let isValid = true;

    fieldsToValidate.forEach((field) => {
      const valid = validateField(field, formValues[field]);
      if (!valid) isValid = false;
    });

    return isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      // Form is valid, proceed with submission
      console.log("Form submitted:", formValues);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormInput
        id="name"
        name="name"
        label="Name"
        value={formValues.name}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        error={touchedFields.name ? formErrors.name : null}
        placeholder="Your name"
        required
      />

      <FormInput
        id="email"
        name="email"
        label="Email"
        type="email"
        value={formValues.email}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        error={touchedFields.email ? formErrors.email : null}
        placeholder="Your email address"
        required
      />

      <button type="submit">Submit</button>
    </form>
  );
};

export default MyFormComponent;
```

### Available Validators

The following validators are available in `validators` object:

- `email(value)` - Validates email format
- `password(value, options)` - Validates password with customizable minimum length
- `confirmPassword(value, options)` - Validates that passwords match
- `required(value, options)` - Validates that a field is not empty
- `number(value, options)` - Validates numeric values with optional min/max
- `phone(value)` - Validates phone number format (optional field)
- `url(value)` - Validates URL format (optional field)
- `custom(value, options)` - Allows custom validation logic

### Using FormValidator Class

For more complex forms, you can use the FormValidator class:

```jsx
import { FormValidator, validators } from "../utils/FormValidation";

// Initialize validator
const validator = new FormValidator({
  name: "",
  email: "",
  password: "",
});

// Update value
validator.setValue("email", "test@example.com");

// Validate a single field
validator.validateField("email", validators.email);

// Check if field has error
if (validator.hasError("email")) {
  console.log(validator.getError("email"));
}

// Validate all fields at once
validator.validateAll({
  name: { validator: validators.required, options: { fieldName: "Name" } },
  email: { validator: validators.email },
  password: { validator: validators.password },
});

// Check if form is valid
if (validator.isValid()) {
  // Submit form
}
```

## Accessibility Features

The FormInput component includes several accessibility features:

- Labels are properly associated with inputs using `htmlFor`
- Required fields are marked with visual indicator and screen reader text
- Error messages use `role="alert"` for screen readers
- Invalid fields have `aria-invalid="true"` and `aria-describedby` pointing to error message
- Focus state is clearly visible
- Added `aria-required="true"` to required fields

## Best Practices

1. **Validate on blur** to avoid distracting users while typing
2. **Show validation messages** only after the user interacts with a field
3. **Provide clear error messages** that explain what's wrong and how to fix it
4. **Include visual indicators** for required fields
5. **Provide immediate feedback** when fields are corrected
6. **Use appropriate input types** (`email`, `tel`, etc.) to trigger appropriate mobile keyboards
7. **Add `noValidate` to forms** to prevent browser validation that might conflict with our system
