import React from 'react';

/**
 * A reusable form input component with validation and accessibility features
 * 
 * @param {Object} props - Component props
 * @param {string} props.id - Unique ID for the input
 * @param {string} props.name - Name attribute for the input
 * @param {string} props.label - Label text
 * @param {string} props.type - Input type (text, email, password, etc.)
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Change handler function
 * @param {Function} props.onBlur - Blur handler function (for validation)
 * @param {string|null} props.error - Error message to display
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.required - Whether the field is required
 * @param {Object} props.ariaProps - Additional ARIA attributes
 * @param {Object} props.inputProps - Additional input attributes
 */
const FormInput = ({
    id,
    name,
    label,
    type = 'text',
    value,
    onChange,
    onBlur,
    error = null,
    placeholder = '',
    required = false,
    ariaProps = {},
    inputProps = {},
    className = '',
    labelClassName = ''
}) => {
    // Generate a unique ID if not provided
    const inputId = id || `input-${name}-${Math.random().toString(36).substring(2, 9)}`;

    // Determine if we should show error state
    const hasError = !!error;

    // Additional ARIA attributes for accessibility
    const ariaAttributes = {
        'aria-invalid': hasError ? 'true' : 'false',
        ...ariaProps
    };

    if (hasError) {
        ariaAttributes['aria-describedby'] = `${inputId}-error`;
    }

    return (
        <div className={`form-group ${className} ${hasError ? 'has-error' : ''}`}>
            <label
                htmlFor={inputId}
                className={`form-label ${labelClassName} ${required ? 'required' : ''}`}
            >
                {label}
                {required && <span className="sr-only"> (required)</span>}
            </label>

            <input
                id={inputId}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                className={`form-control ${hasError ? 'is-invalid' : ''}`}
                required={required}
                {...ariaAttributes}
                {...inputProps}
            />

            {hasError && (
                <div
                    id={`${inputId}-error`}
                    className="invalid-feedback"
                    role="alert"
                >
                    {error}
                </div>
            )}
        </div>
    );
};

export default FormInput;