import React from 'react';
import PropTypes from 'prop-types';
// Import the CSS file with our button styles

/**
 * Standardized Button component
 * 
 * @param {string} variant - Button style variant (primary, secondary, success, danger, warning, info, light, dark)
 * @param {string} size - Button size (sm, md, lg)
 * @param {boolean} outline - Whether to use outline style
 * @param {boolean} block - Whether button should be full width
 * @param {string} className - Additional custom classes
 * @param {React.ReactNode} children - Button content
 * @param {React.ReactNode} leftIcon - Optional icon to display before text
 * @param {React.ReactNode} rightIcon - Optional icon to display after text
 * @param {boolean} isLoading - Whether button is in loading state
 */
const Button = ({
    variant = 'primary',
    size = '',
    outline = false,
    block = false,
    className = '',
    children,
    leftIcon,
    rightIcon,
    isLoading = false,
    ...props
}) => {
    // Build the class string based on props
    const getButtonClasses = () => {
        // Start with base btn class
        let classes = ['btn'];

        // Add size if provided
        if (size) {
            classes.push(`btn-${size}`);
        }

        // Add variant
        if (outline) {
            classes.push(`btn-outline-${variant}`);
        } else {
            classes.push(`btn-${variant}`);
        }

        // Add block class if needed
        if (block) {
            classes.push('w-full');
        }

        // Add loading state styling
        if (isLoading) {
            classes.push('opacity-75 cursor-wait');
        }

        // Add any custom classes
        if (className) {
            classes.push(className);
        }

        return classes.join(' ');
    };

    return (
        <button
            className={getButtonClasses()}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading && (
                <span className="mr-xs inline-block">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </span>
            )}

            {leftIcon && <span className="mr-xs">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-xs">{rightIcon}</span>}
        </button>
    );
};

Button.propTypes = {
    variant: PropTypes.oneOf([
        'primary', 'secondary', 'success', 'danger',
        'warning', 'info', 'light', 'dark'
    ]),
    size: PropTypes.oneOf(['sm', 'lg', '']),
    outline: PropTypes.bool,
    block: PropTypes.bool,
    className: PropTypes.string,
    children: PropTypes.node,
    leftIcon: PropTypes.node,
    rightIcon: PropTypes.node,
    isLoading: PropTypes.bool,
    disabled: PropTypes.bool,
    onClick: PropTypes.func,
    type: PropTypes.string
};

export default Button;