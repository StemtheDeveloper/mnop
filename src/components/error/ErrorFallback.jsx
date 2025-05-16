import React from 'react';
import '../../styles/components/ErrorBoundary.css';

/**
 * A fallback component to display when an error occurs
 * @param {Object} props - Component props
 * @param {Error} props.error - The error that was thrown
 * @param {Function} props.resetErrorBoundary - Function to reset the error boundary
 * @returns {JSX.Element} - The error fallback UI
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => {
    const handleReset = () => {
        // Reset the error boundary state
        if (resetErrorBoundary) resetErrorBoundary();

        // Optionally refresh the page
        // window.location.reload();
    };

    return (
        <div className="error-boundary">
            <div className="error-container">
                <h2>Something went wrong.</h2>
                <p>We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.</p>
                <button className="retry-button" onClick={handleReset}>
                    Try Again
                </button>
                {process.env.NODE_ENV !== 'production' && (
                    <details className="error-details">
                        <summary>Technical Details (Developers Only)</summary>
                        <p>{error && error.toString()}</p>
                        {error && error.stack && (
                            <pre>{error.stack}</pre>
                        )}
                    </details>
                )}
            </div>
        </div>
    );
};

export default ErrorFallback;