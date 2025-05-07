import React, { Component } from 'react';
import '../../styles/ErrorBoundary.css';
import PropTypes from 'prop-types';
// C:\Users\GGPC\Desktop\mnop-app\src\styles\ErrorBoundary.css
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can log the error to an error reporting service
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // Optional: Send error to a logging service
        // logErrorToService(error, errorInfo);
    }

    render() {
        const { fallback } = this.props;

        if (this.state.hasError) {
            // You can render any custom fallback UI
            if (fallback) {
                return fallback(this.state.error);
            }

            return (
                <div className="error-boundary">
                    <div className="error-container">
                        <h2>Something went wrong.</h2>
                        <p>We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.</p>
                        <button
                            className="retry-button"
                            onClick={() => {
                                this.setState({ hasError: false });
                                window.location.reload();
                            }}
                        >
                            Refresh Page
                        </button>
                        {process.env.NODE_ENV !== 'production' && (
                            <details className="error-details">
                                <summary>Technical Details (Developers Only)</summary>
                                <p>{this.state.error && this.state.error.toString()}</p>
                                <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;